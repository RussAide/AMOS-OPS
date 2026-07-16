import type { UserRole } from "@/constants/roles";
import {
  M41B_EVALUATION_AS_OF,
  M41B_SOURCE_REGISTER,
  buildM41bRoleContext,
  canViewM41bSource,
  m41bAccountableRoles,
  m41bTierAtLeast,
  type M41bGovernedSource,
  type M41bGuidanceRequest,
  type M41bGuidanceResponse,
  type M41bMaterialDomain,
  type M41bRoleContext,
  type M41bSourceCitation,
  type M41bSourceState,
} from "@contracts/m41b";

const CONTROL_SOURCE_ID = "M41B-SRC-DAILY-OPS";

const ACTION_INTENTS = new Set<M41bGuidanceRequest["intent"]>([
  "launch_workflow",
  "create_task",
]);

const MODEL_ONLY_ACTION_PATTERN =
  /\b(model[- ]only|without (?:a )?human|skip (?:the )?(?:human )?approval|bypass (?:the )?(?:human )?(?:gate|approval)|auto(?:matically)?[- ]?approve|approve (?:it|this) yourself|act autonomously)\b/i;

const PRODUCTION_ACTION_PATTERN =
  /\b(production|live (?:system|connector|tenant)|deploy|send (?:an )?(?:email|message)|contact (?:the )?(?:client|patient|employee|payer)|write (?:it )?to (?:c[mh]bhs|fhir|microsoft 365))\b/i;

export interface M41bSourceAccessDecision {
  allowed: boolean;
  code:
    | "ALLOW_SOURCE"
    | "DENY_TIER"
    | "DENY_SENSITIVITY"
    | "DENY_DIVISION"
    | "DENY_REQUESTED_SCOPE";
  reason: string;
}

interface CanonicalContextResult {
  context: M41bRoleContext | null;
  error: string | null;
}

interface SourceResolution {
  sources: readonly M41bGovernedSource[];
  citations: readonly M41bSourceCitation[];
  states: readonly M41bSourceState[];
  domain: M41bMaterialDomain;
  missingSourceIds: readonly string[];
  refusalCode: string | null;
  refusalReason: string | null;
  concealRequestedSources: boolean;
}

function unique<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)]);
}

function token(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return normalized || "EMPTY";
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

/** Stable IDs make retries idempotent and make evidence snapshots reproducible. */
export function m41bDeterministicId(
  prefix: string,
  ...parts: readonly string[]
): string {
  const material = parts.join("|");
  return `${token(prefix)}-${token(parts[0] ?? "record")}-${stableHash(material)}`;
}

function controlSource(): M41bGovernedSource {
  const source = M41B_SOURCE_REGISTER.find(
    (candidate) => candidate.id === CONTROL_SOURCE_ID,
  );
  if (!source) throw new Error("M41B_CONTROL_SOURCE_MISSING");
  return source;
}

function sourceStateAt(
  source: M41bGovernedSource,
  asOf: string,
): M41bSourceState {
  if (source.state !== "current") return source.state;
  const asOfTime = Date.parse(asOf);
  if (!Number.isFinite(asOfTime)) return "missing";
  if (Date.parse(source.effectiveAt) > asOfTime) return "missing";
  if (source.expiresAt && Date.parse(source.expiresAt) < asOfTime)
    return "stale";
  if (!source.refreshedAt) return "missing";
  return "current";
}

export function buildM41bSourceCitation(
  source: M41bGovernedSource,
  asOf = M41B_EVALUATION_AS_OF,
): M41bSourceCitation {
  const state = sourceStateAt(source, asOf);
  const freshnessLimit =
    state === source.state
      ? `Freshness state: ${state}`
      : `Freshness state at ${asOf}: ${state} (registered state: ${source.state})`;
  return Object.freeze({
    sourceId: source.id,
    title: source.title,
    version: source.version,
    ownerRole: source.ownerRole,
    effectiveAt: source.effectiveAt,
    refreshedAt: source.refreshedAt,
    state,
    applicableLimits: Object.freeze([
      ...source.applicableLimits,
      freshnessLimit,
      `Effective ${source.effectiveAt}`,
      ...(source.expiresAt ? [`Expires ${source.expiresAt}`] : []),
    ]),
    missingEvidence: Object.freeze([
      ...source.missingEvidence,
      ...(state === "missing" && source.missingEvidence.length === 0
        ? ["A current governed source record"]
        : []),
    ]),
    confidence:
      state === "missing" || state === "contradictory"
        ? null
        : source.confidence,
    uncertainty:
      source.uncertainty ??
      (state === "stale"
        ? "The governed source is outside its controlled validity window."
        : state === "missing"
          ? "A governed source required for this response is unavailable."
          : null),
    recordIds: Object.freeze(
      state === "suppressed" ? [] : [...source.recordIds],
    ),
  });
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function canonicalizeContext(claimed: M41bRoleContext): CanonicalContextResult {
  try {
    const canonical = buildM41bRoleContext(claimed.role, claimed.userId);
    const matches =
      claimed.evidenceClass === "synthetic_demo" &&
      claimed.tier === canonical.tier &&
      claimed.division === canonical.division &&
      claimed.department === canonical.department &&
      sameValues(claimed.caseloadIds, canonical.caseloadIds) &&
      sameValues(claimed.delegatedActions, canonical.delegatedActions) &&
      sameValues(claimed.supervisorRoles, canonical.supervisorRoles);
    return matches
      ? { context: canonical, error: null }
      : {
          context: canonical,
          error: "Role-context claims do not match the authoritative registry.",
        };
  } catch {
    return {
      context: null,
      error: "The requesting role is not authorized for Ask AMOS.",
    };
  }
}

export function evaluateM41bSourceAccess(
  context: M41bRoleContext,
  source: M41bGovernedSource,
  requestedDivision?: M41bGuidanceRequest["requestedDivision"],
): M41bSourceAccessDecision {
  if (!m41bTierAtLeast(context.tier, source.minimumTier))
    return Object.freeze({
      allowed: false,
      code: "DENY_TIER" as const,
      reason: `Role tier ${context.tier} does not meet source minimum ${source.minimumTier}.`,
    });

  if (!canViewM41bSource(context.role, source))
    return Object.freeze({
      allowed: false,
      code: "DENY_SENSITIVITY" as const,
      reason:
        "The canonical role permission does not permit this governed source.",
    });

  if (requestedDivision && !source.divisions.includes(requestedDivision))
    return Object.freeze({
      allowed: false,
      code: "DENY_REQUESTED_SCOPE" as const,
      reason: "The source is not governed for the requested division.",
    });

  const sourceIncludesOwnDivision = source.divisions.includes(context.division);
  const enterpriseCrossDivision =
    context.tier === "T1" &&
    context.delegatedActions.includes("route_cross_division");
  if (
    !sourceIncludesOwnDivision &&
    enterpriseCrossDivision &&
    !requestedDivision
  )
    return Object.freeze({
      allowed: false,
      code: "DENY_REQUESTED_SCOPE" as const,
      reason:
        "A controlled cross-division handoff requires an explicit requested division.",
    });
  if (!sourceIncludesOwnDivision && !enterpriseCrossDivision)
    return Object.freeze({
      allowed: false,
      code: "DENY_DIVISION" as const,
      reason:
        "The source belongs to another division and no controlled handoff is delegated.",
    });

  return Object.freeze({
    allowed: true,
    code: "ALLOW_SOURCE" as const,
    reason:
      "The role tier, division scope, and canonical source permission permit this governed source.",
  });
}

function selectDefaultSource(
  context: M41bRoleContext,
  request: M41bGuidanceRequest,
): M41bGovernedSource | null {
  const requestedDivision = request.requestedDivision ?? context.division;
  const requestedDomain = request.requestedDomain ?? "operational";
  return (
    M41B_SOURCE_REGISTER.find(
      (source) =>
        source.materialDomain === requestedDomain &&
        source.divisions.includes(requestedDivision) &&
        evaluateM41bSourceAccess(context, source, requestedDivision).allowed,
    ) ?? null
  );
}

function resolveSources(
  request: M41bGuidanceRequest,
  context: M41bRoleContext,
): SourceResolution {
  const requestedIds = unique((request.sourceIds ?? []).filter(Boolean));
  const missingSourceIds = requestedIds.filter(
    (id) => !M41B_SOURCE_REGISTER.some((source) => source.id === id),
  );
  let sources = requestedIds
    .map((id) => M41B_SOURCE_REGISTER.find((source) => source.id === id))
    .filter((source): source is M41bGovernedSource => source !== undefined);

  if (requestedIds.length === 0) {
    const selected = selectDefaultSource(context, request);
    sources = selected ? [selected] : [];
  }

  if (missingSourceIds.length > 0)
    return {
      sources: Object.freeze(sources),
      citations: Object.freeze(
        (sources.length > 0 ? sources : [controlSource()]).map((source) =>
          buildM41bSourceCitation(source, request.createdAt),
        ),
      ),
      states: Object.freeze(
        sources.map((source) => sourceStateAt(source, request.createdAt)),
      ),
      domain:
        request.requestedDomain ?? sources[0]?.materialDomain ?? "operational",
      missingSourceIds,
      refusalCode: "M41B_SOURCE_NOT_FOUND",
      refusalReason: "One or more requested governed sources are unavailable.",
      concealRequestedSources: false,
    };

  if (sources.length === 0)
    return {
      sources: Object.freeze([]),
      citations: Object.freeze([
        buildM41bSourceCitation(controlSource(), request.createdAt),
      ]),
      states: Object.freeze([]),
      domain: request.requestedDomain ?? "operational",
      missingSourceIds: Object.freeze([]),
      refusalCode: "M41B_SOURCE_UNAVAILABLE",
      refusalReason:
        "No governed source is available for the requested division and material domain.",
      concealRequestedSources: false,
    };

  const denied = sources.find(
    (source) =>
      !evaluateM41bSourceAccess(context, source, request.requestedDivision)
        .allowed,
  );
  if (denied) {
    const decision = evaluateM41bSourceAccess(
      context,
      denied,
      request.requestedDivision,
    );
    return {
      sources: Object.freeze([]),
      citations: Object.freeze([
        buildM41bSourceCitation(controlSource(), request.createdAt),
      ]),
      states: Object.freeze([]),
      domain: request.requestedDomain ?? "operational",
      missingSourceIds: Object.freeze([]),
      refusalCode:
        decision.code === "DENY_DIVISION" ||
        decision.code === "DENY_REQUESTED_SCOPE"
          ? "M41B_CROSS_DIVISION_ACCESS_DENIED"
          : "M41B_SOURCE_PERMISSION_DENIED",
      refusalReason: decision.reason,
      concealRequestedSources: true,
    };
  }

  const domains = unique(sources.map((source) => source.materialDomain));
  if (
    request.requestedDomain &&
    domains.some((domain) => domain !== request.requestedDomain)
  )
    return {
      sources: Object.freeze(sources),
      citations: Object.freeze(
        sources.map((source) =>
          buildM41bSourceCitation(source, request.createdAt),
        ),
      ),
      states: Object.freeze(
        sources.map((source) => sourceStateAt(source, request.createdAt)),
      ),
      domain: request.requestedDomain,
      missingSourceIds: Object.freeze([]),
      refusalCode: "M41B_SOURCE_DOMAIN_MISMATCH",
      refusalReason:
        "The requested sources do not belong to the requested material domain.",
      concealRequestedSources: false,
    };

  if (domains.length > 1)
    return {
      sources: Object.freeze(sources),
      citations: Object.freeze(
        sources.map((source) =>
          buildM41bSourceCitation(source, request.createdAt),
        ),
      ),
      states: Object.freeze(
        sources.map((source) => sourceStateAt(source, request.createdAt)),
      ),
      domain: domains[0],
      missingSourceIds: Object.freeze([]),
      refusalCode: "M41B_MULTI_DOMAIN_REVIEW_REQUIRED",
      refusalReason:
        "Sources from multiple accountable domains require separate governed requests and human gates.",
      concealRequestedSources: false,
    };

  return {
    sources: Object.freeze(sources),
    citations: Object.freeze(
      sources.map((source) =>
        buildM41bSourceCitation(source, request.createdAt),
      ),
    ),
    states: Object.freeze(
      sources.map((source) => sourceStateAt(source, request.createdAt)),
    ),
    domain: request.requestedDomain ?? domains[0],
    missingSourceIds: Object.freeze([]),
    refusalCode: null,
    refusalReason: null,
    concealRequestedSources: false,
  };
}

function routesFor(
  context: M41bRoleContext | null,
  domain: M41bMaterialDomain,
  sources: readonly M41bGovernedSource[],
  targetDivision: M41bRoleContext["division"],
): readonly UserRole[] {
  return unique([
    ...(context?.supervisorRoles ?? []),
    ...accountableRolesFor(domain, targetDivision),
    ...sources.map((source) => source.ownerRole),
  ]);
}

function accountableRolesFor(
  domain: M41bMaterialDomain,
  targetDivision: M41bRoleContext["division"],
): readonly UserRole[] {
  return Object.freeze(
    m41bAccountableRoles(domain).filter((role) => {
      const roleContext = buildM41bRoleContext(role);
      return (
        roleContext.tier === "T1" || roleContext.division === targetDivision
      );
    }),
  );
}

interface RefusalOptions {
  code: string;
  reason: string;
  domain: M41bMaterialDomain;
  citations?: readonly M41bSourceCitation[];
  sources?: readonly M41bGovernedSource[];
  context?: M41bRoleContext | null;
  targetDivision?: M41bRoleContext["division"];
  limits?: readonly string[];
  missingEvidence?: readonly string[];
}

function refusalResponse(
  request: M41bGuidanceRequest,
  options: RefusalOptions,
): M41bGuidanceResponse {
  const citations =
    options.citations && options.citations.length > 0
      ? options.citations
      : [buildM41bSourceCitation(controlSource(), request.createdAt)];
  const routeTo = routesFor(
    options.context ?? null,
    options.domain,
    options.sources ?? [],
    options.targetDivision ?? options.context?.division ?? "eo",
  );
  const accountableRoles = accountableRolesFor(
    options.domain,
    options.targetDivision ?? options.context?.division ?? "eo",
  );
  const missingEvidence = unique([
    ...(options.missingEvidence ?? []),
    ...citations.flatMap((citation) => citation.missingEvidence),
  ]);
  const limits = unique([
    ...(options.limits ?? []),
    ...citations.flatMap((citation) => citation.applicableLimits),
    "No workflow or task was created.",
    "No model output may substitute for accountable human authority.",
  ]);
  return Object.freeze({
    responseId: m41bDeterministicId(
      "M41B-REFUSAL",
      request.requestId,
      options.code,
    ),
    requestId: request.requestId,
    answer: `Ask AMOS refused this request: ${options.reason}`,
    nextSteps: Object.freeze([
      "Do not act on or disclose the requested material.",
      `Route the request to an accountable human: ${routeTo.join(", ")}.`,
      ...(missingEvidence.length > 0
        ? ["Obtain the missing governed evidence before resubmitting."]
        : []),
    ]),
    citations: Object.freeze([...citations]),
    confidence: null,
    uncertainty: options.reason,
    applicableLimits: limits,
    missingEvidence,
    recommendationId: null,
    workflowLaunch: null,
    humanGate: Object.freeze({
      required: false,
      materialDomain: options.domain,
      accountableRoles,
      disposition: "not_required" as const,
      decisionId: null,
    }),
    escalation: Object.freeze({
      required: true,
      routeTo,
      reason: options.reason,
    }),
    refused: true,
    refusalCode: options.code,
    evidenceClass: "synthetic_demo",
  });
}

function validateRequest(
  request: M41bGuidanceRequest,
  context: M41bRoleContext,
): M41bGuidanceResponse | null {
  if (!request.requestId.trim() || !request.prompt.trim())
    return refusalResponse(request, {
      code: "M41B_INVALID_GUIDANCE_REQUEST",
      reason: "A request ID and a non-empty prompt are required.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  if (!Number.isFinite(Date.parse(request.createdAt)))
    return refusalResponse(request, {
      code: "M41B_INVALID_GUIDANCE_TIMESTAMP",
      reason: "The request timestamp is not a valid governed time value.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  if (
    request.requestedDivision &&
    request.requestedDivision !== context.division &&
    !(
      context.tier === "T1" &&
      context.delegatedActions.includes("route_cross_division")
    )
  )
    return refusalResponse(request, {
      code: "M41B_CROSS_DIVISION_ACCESS_DENIED",
      reason:
        "The requested division is outside the caller's delegated authority.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  if (PRODUCTION_ACTION_PATTERN.test(request.prompt))
    return refusalResponse(request, {
      code: "M41B_PRODUCTION_ACTION_BLOCKED",
      reason:
        "M4.1B is a synthetic prototype and cannot perform production, connector, or external-message actions.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  if (MODEL_ONLY_ACTION_PATTERN.test(request.prompt))
    return refusalResponse(request, {
      code: "M41B_MODEL_ONLY_ACTION_DENIED",
      reason: "Material action cannot bypass the accountable human gate.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  if (
    request.intent === "launch_workflow" &&
    !context.delegatedActions.includes("route_workflow")
  )
    return refusalResponse(request, {
      code: "M41B_ACTION_NOT_DELEGATED",
      reason: "Workflow routing is not delegated to this role.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  if (
    request.intent === "create_task" &&
    !context.delegatedActions.includes("create_owned_task")
  )
    return refusalResponse(request, {
      code: "M41B_ACTION_NOT_DELEGATED",
      reason: "Task creation is not delegated to this role.",
      domain: request.requestedDomain ?? "operational",
      context,
    });
  return null;
}

function sourceLabel(citations: readonly M41bSourceCitation[]): string {
  return citations
    .map((citation) => `${citation.title} v${citation.version}`)
    .join("; ");
}

function answerFor(
  request: M41bGuidanceRequest,
  domain: M41bMaterialDomain,
  citations: readonly M41bSourceCitation[],
  accountableRoles: readonly UserRole[],
): string {
  const sources = sourceLabel(citations);
  const accountable = accountableRoles.join(", ");
  switch (request.intent) {
    case "answer_question":
      return `Governed answer: ${sources} is the cited source set for this ${domain} question. Treat the answer as guidance pending review by ${accountable}.`;
    case "explain_priority":
      return `The governed ${domain} priority is to review the cited source state and its evidence requirements before action. Priority basis: ${sources}.`;
    case "explain_next_step":
      return `The next governed step is documented review of ${sources}, followed by disposition from an accountable human (${accountable}).`;
    case "launch_workflow":
      return `A ${domain} workflow launch is prepared from ${sources}, but execution remains blocked until an accountable human approves it.`;
    case "create_task":
      return `A task recommendation is prepared from ${sources}. No task exists until an accountable human approves the recommendation.`;
    case "escalate":
      return `A sourced ${domain} escalation is prepared from ${sources}; the listed accountable and supervisory roles must receive and disposition it.`;
    case "route_supervisor":
      return `Supervisor routing is prepared from ${sources}. The route is advisory until a human accepts the handoff.`;
  }
}

function nextStepsFor(
  request: M41bGuidanceRequest,
  accountableRoles: readonly UserRole[],
  hasStaleSource: boolean,
): readonly string[] {
  return Object.freeze([
    ...(hasStaleSource
      ? [
          "Request a controlled source refresh and preserve the stale-source warning.",
        ]
      : ["Review the cited source metadata, limits, and evidence references."]),
    `Obtain a documented disposition from one of: ${accountableRoles.join(", ")}.`,
    ...(request.intent === "launch_workflow"
      ? ["Launch the workflow only after the human decision is recorded."]
      : request.intent === "create_task"
        ? [
            "Create an owned, dated task only after the human decision is recorded.",
          ]
        : request.intent === "escalate" || request.intent === "route_supervisor"
          ? ["Record receipt and disposition of the controlled handoff."]
          : ["Use the guidance only within the cited limits."]),
  ]);
}

/**
 * Deterministic Ask AMOS policy engine. It never invokes a model, creates a
 * task, launches a workflow, or treats generated text as approval.
 */
export function buildM41bGuidance(
  request: M41bGuidanceRequest,
): M41bGuidanceResponse {
  const canonical = canonicalizeContext(request.roleContext);
  if (!canonical.context || canonical.error)
    return refusalResponse(request, {
      code: canonical.context
        ? "M41B_CONTEXT_CLAIM_MISMATCH"
        : "M41B_ROLE_ACCESS_DENIED",
      reason: canonical.error ?? "The role context is not authorized.",
      domain: request.requestedDomain ?? "operational",
      context: canonical.context,
    });

  const context = canonical.context;
  const invalid = validateRequest(request, context);
  if (invalid) return invalid;

  const resolution = resolveSources(request, context);
  if (resolution.refusalCode)
    return refusalResponse(request, {
      code: resolution.refusalCode,
      reason:
        resolution.refusalReason ?? "The governed source request was refused.",
      domain: resolution.domain,
      citations: resolution.citations,
      sources: resolution.concealRequestedSources ? [] : resolution.sources,
      context,
      targetDivision: request.requestedDivision ?? context.division,
      missingEvidence: resolution.missingSourceIds.map(
        (id) => `Governed source ${id}`,
      ),
    });

  const states = new Set(resolution.states);
  if (states.has("missing"))
    return refusalResponse(request, {
      code: "M41B_SOURCE_UNAVAILABLE",
      reason:
        "Required governed evidence is unavailable; no substantive answer or action is permitted.",
      domain: resolution.domain,
      citations: resolution.citations,
      sources: resolution.sources,
      context,
      targetDivision: request.requestedDivision ?? context.division,
    });
  if (states.has("contradictory"))
    return refusalResponse(request, {
      code: "M41B_SOURCE_CONTRADICTORY",
      reason:
        "Governed sources contradict one another; Ask AMOS will not select a preferred value or action.",
      domain: resolution.domain,
      citations: resolution.citations,
      sources: resolution.sources,
      context,
      targetDivision: request.requestedDivision ?? context.division,
    });
  if (states.has("suppressed"))
    return refusalResponse(request, {
      code: "M41B_SOURCE_SUPPRESSED",
      reason: "The source detail is suppressed for this guidance path.",
      domain: resolution.domain,
      citations: resolution.citations,
      sources: resolution.sources,
      context,
      targetDivision: request.requestedDivision ?? context.division,
    });
  if (states.has("stale") && ACTION_INTENTS.has(request.intent))
    return refusalResponse(request, {
      code: "M41B_STALE_SOURCE_ACTION_DENIED",
      reason:
        "A stale source may explain context but cannot initiate a workflow or task.",
      domain: resolution.domain,
      citations: resolution.citations,
      sources: resolution.sources,
      context,
      targetDivision: request.requestedDivision ?? context.division,
    });

  const targetDivision = request.requestedDivision ?? context.division;
  const accountableRoles = accountableRolesFor(
    resolution.domain,
    targetDivision,
  );
  const hasStaleSource = states.has("stale");
  const sourceConfidence = resolution.citations.map(
    (citation) => citation.confidence,
  );
  const confidence = sourceConfidence.some((value) => value === null)
    ? null
    : Math.min(...(sourceConfidence as number[]));
  const uncertainty = unique(
    resolution.citations
      .map((citation) => citation.uncertainty)
      .filter((value): value is string => Boolean(value)),
  ).join(" ");
  const recommendationId = m41bDeterministicId(
    "M41B-RECOMMENDATION",
    request.requestId,
    resolution.domain,
  );
  const escalationRequired =
    hasStaleSource ||
    request.intent === "escalate" ||
    request.intent === "route_supervisor";
  const routeTo =
    request.intent === "route_supervisor"
      ? unique(context.supervisorRoles)
      : routesFor(
          context,
          resolution.domain,
          resolution.sources,
          targetDivision,
        );
  const workflowLaunch =
    request.intent === "launch_workflow"
      ? Object.freeze({
          workflowKey: `m41b-${resolution.domain}-${request.requestedDivision ?? context.division}-review`,
          blockedPendingApproval: true,
        })
      : null;

  return Object.freeze({
    responseId: m41bDeterministicId("M41B-GUIDANCE", request.requestId),
    requestId: request.requestId,
    answer: answerFor(
      request,
      resolution.domain,
      resolution.citations,
      accountableRoles,
    ),
    nextSteps: nextStepsFor(request, accountableRoles, hasStaleSource),
    citations: resolution.citations,
    confidence,
    uncertainty: uncertainty || null,
    applicableLimits: unique([
      ...resolution.citations.flatMap((citation) => citation.applicableLimits),
      "Guidance is non-binding until the accountable human disposition is recorded.",
      "Synthetic prototype only; production actions are blocked.",
      ...(hasStaleSource
        ? ["Do not use stale guidance to initiate material action."]
        : []),
    ]),
    missingEvidence: unique(
      resolution.citations.flatMap((citation) => citation.missingEvidence),
    ),
    recommendationId,
    workflowLaunch,
    humanGate: Object.freeze({
      required: true,
      materialDomain: resolution.domain,
      accountableRoles,
      disposition: "pending" as const,
      decisionId: null,
    }),
    escalation: Object.freeze({
      required: escalationRequired,
      routeTo,
      reason: hasStaleSource
        ? "A controlled source refresh and human review are required."
        : escalationRequired
          ? "The caller requested a controlled human handoff."
          : null,
    }),
    refused: false,
    refusalCode: null,
    evidenceClass: "synthetic_demo",
  });
}
