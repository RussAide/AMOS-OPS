import { createHash } from "node:crypto";
import { M41B_CADENCES, type M41bCadence } from "@contracts/m41b";
import {
  type M41cClinicalCadenceBrief,
  type M41cClinicalGuidanceInput,
  type M41cClinicalGuidanceIntent,
  type M41cClinicalGuidanceResponse,
  type M41cClinicalWorkplan,
  type M41cClinicalWorkplanAccessMode,
  type M41cClinicalWorkplanItem,
} from "@contracts/m41c/experience";
import {
  M41C_DEMO_BOUNDARY,
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
  M41C_PROHIBITED_ACTIONS,
  type M41cClinicalCitation,
  type M41cClinicalRecommendation,
  type M41cClinicalSource,
  type M41cHumanGate,
} from "@contracts/m41c/shared";
import type { UserRole } from "@/constants/roles";
import { getPermissions } from "@/constants/roles";
import { buildM41bWorkplan } from "../m41b/workplan-engine";
import {
  buildM41cClinicalRoleContext,
  evaluateM41cClinicalAccess,
} from "./clinical-access";
import { createSyntheticM41cClinicalKnowledgeRegistry } from "./clinical-knowledge-registry";

export { M41C_CLINICAL_GUIDANCE_INTENTS } from "@contracts/m41c/experience";

export interface M41cClinicalGuidanceRequest extends M41cClinicalGuidanceInput {
  role: UserRole;
  actorId?: string;
}

const CADENCE_DEFINITION: Readonly<
  Record<
    M41bCadence,
    {
      title: string;
      purpose: string;
      sourceIds: readonly string[];
      offsetHours: number;
      evidence: readonly string[];
    }
  >
> = {
  daily: {
    title: "Daily safety, due-item, and clinical handoff review",
    purpose:
      "Surface synthetic safety signals, overdue reviews, missing inputs, and accountable handoffs.",
    sourceIds: [
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ],
    offsetHours: 8,
    evidence: ["human disposition", "completed safety or handoff evidence"],
  },
  weekly: {
    title: "Weekly caseload and non-response review",
    purpose:
      "Review synthetic caseload progression, reassessment needs, non-response, and supervisor routing.",
    sourceIds: [
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ],
    offsetHours: 72,
    evidence: ["caseload review record", "non-response disposition"],
  },
  monthly: {
    title: "Monthly outcomes and pathway-fidelity review",
    purpose:
      "Review synthetic outcomes, fidelity, overrides, alert burden, and unintended effects.",
    sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
    offsetHours: 240,
    evidence: ["outcome review", "fidelity and override review"],
  },
  quarterly: {
    title: "Quarterly TRR, continuum, and disparity review",
    purpose:
      "Review metadata readiness, continuum transitions, reconciliation, disparities, and unresolved exceptions.",
    sourceIds: [
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-TRR-CANS-METADATA",
      "M41C-SRC-DFPS-CANS-3-METADATA",
    ],
    offsetHours: 720,
    evidence: ["continuum review", "metadata and disparity disposition"],
  },
  annual: {
    title:
      "Annual pathway, certification, license, and governance reauthorization",
    purpose:
      "Reauthorize synthetic pathways and review every source, profile, competency, license, and governance record.",
    sourceIds: [
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-TRR-CANS-METADATA",
      "M41C-SRC-DFPS-CANS-3-METADATA",
    ],
    offsetHours: 1440,
    evidence: [
      "signed synthetic validation record",
      "competency and license review",
    ],
  },
};

function deterministicId(prefix: string, ...parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
  return `${prefix}-${digest}`;
}

function sourceById(id: string): M41cClinicalSource {
  const source = createSyntheticM41cClinicalKnowledgeRegistry().sources.find(
    (candidate) => candidate.id === id,
  );
  if (!source) throw new Error(`M41C_CLINICAL_SOURCE_NOT_FOUND:${id}`);
  return source;
}

function citation(source: M41cClinicalSource): M41cClinicalCitation {
  return Object.freeze({
    sourceId: source.id,
    title: source.title,
    publisher: source.publisher,
    version: source.version,
    canonicalUrl: source.canonicalUrl,
    effectiveAt: source.effectiveAt,
    reviewedAt: source.reviewedAt,
    sourceState: source.state,
    licenseState: source.licenseState,
    evidenceGrade: source.evidenceGrade,
    limitations: Object.freeze([...source.limitations]),
    missingEvidence: Object.freeze([...source.missingEvidence]),
  });
}

function accessMode(role: UserRole): M41cClinicalWorkplanAccessMode {
  const permissions = getPermissions(role);
  if (permissions.canViewClinical) return "clinical_detail";
  if (permissions.canViewExecutive || permissions.canViewCompliance)
    return "aggregate_governance";
  if (permissions.canViewGRO || permissions.canEditGRO)
    return "operational_handoff";
  return "suppressed";
}

function itemFor(
  role: UserRole,
  cadence: M41bCadence,
): M41cClinicalWorkplanItem {
  const definition = CADENCE_DEFINITION[cadence];
  const mode = accessMode(role);
  const sources = definition.sourceIds.map(sourceById);
  const missingEvidence = Object.freeze([
    ...new Set(sources.flatMap((source) => source.missingEvidence)),
  ]);
  const sourceBlocked = sources.some(
    (source) =>
      source.state !== "current" ||
      !["not_required", "licensed_demo"].includes(source.licenseState),
  );
  const status: M41cClinicalWorkplanItem["status"] =
    mode === "suppressed"
      ? "access_suppressed"
      : mode === "operational_handoff"
        ? "operational_route_only"
        : sourceBlocked
          ? "blocked_source_validation"
          : "ready_human_review";
  const subjectIds =
    mode === "clinical_detail" && cadence !== "annual"
      ? Object.freeze(["SYNTH-YOUTH-CONTINUUM-001"])
      : Object.freeze([]);
  return Object.freeze({
    id: deterministicId("SYNTH-M41C-WORKPLAN", role, cadence),
    cadence,
    title:
      mode === "suppressed"
        ? `${definition.title} — no authorized clinical detail`
        : definition.title,
    purpose:
      mode === "operational_handoff"
        ? "Use the approved operational safety handoff; no clinical detail or clinical disposition is available to this role."
        : mode === "suppressed"
          ? "No clinical-detail work is assigned. Route a concern through the approved supervisor workflow."
          : definition.purpose,
    ownerRole: role,
    accessMode: mode,
    sourceIds: Object.freeze([...definition.sourceIds]),
    subjectIds,
    dueAt: new Date(
      Date.parse(M41C_EVALUATION_AS_OF) + definition.offsetHours * 3_600_000,
    ).toISOString(),
    status,
    requiredHumanApprover: Object.freeze([
      "clinical-director",
      "bhc-director",
    ] satisfies UserRole[]),
    evidenceRequirements: Object.freeze([...definition.evidence]),
    missingEvidence,
    productionActionBlocked: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export function buildM41cClinicalWorkplan(
  role: UserRole,
): M41cClinicalWorkplan {
  const context = buildM41cClinicalRoleContext(role, {
    purpose: getPermissions(role).canViewClinical
      ? "direct_care"
      : "training_oversight",
  });
  const baseWorkplan = buildM41bWorkplan(context, {
    asOf: M41C_EVALUATION_AS_OF,
  });
  const briefs = Object.fromEntries(
    M41B_CADENCES.map((cadence) => {
      const item = itemFor(role, cadence);
      return [
        cadence,
        Object.freeze({
          cadence,
          title: item.title,
          purpose: item.purpose,
          items: Object.freeze([item]),
          limitations: Object.freeze([
            M41C_DEMO_BOUNDARY.label,
            "Clinical detail is limited by role, consent, Part 2, and minimum necessary.",
          ]),
        }),
      ];
    }),
  ) as unknown as Readonly<Record<M41bCadence, M41cClinicalCadenceBrief>>;
  return Object.freeze({
    milestone: "M4.1C",
    generatedAt: M41C_EVALUATION_AS_OF,
    role,
    baseWorkplan,
    briefs: Object.freeze(briefs),
    representedCadences: Object.freeze([...M41B_CADENCES]),
    allFiveCadences: true,
    productionActionsBlocked: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

function humanGate(requestId: string): M41cHumanGate {
  return Object.freeze({
    gateId: deterministicId("SYNTH-M41C-GATE", requestId),
    domain: "clinical",
    required: true,
    accountableRoles: Object.freeze([
      "clinical-director",
      "bhc-director",
    ] satisfies UserRole[]),
    qualifiedRoleRequired: true,
    competencyIdsRequired: Object.freeze([
      "M41C-COMP-CLINICAL-GUIDANCE-REVIEWER",
    ]),
    status: "pending",
    decidedBy: null,
    decidedByRole: null,
    decidedAt: null,
    rationale: null,
    overrideReason: null,
  });
}

function answerFor(
  intent: M41cClinicalGuidanceIntent,
  sourceCount: number,
  missingCount: number,
): { answer: string; nextSteps: readonly string[] } {
  const byIntent: Readonly<
    Record<
      M41cClinicalGuidanceIntent,
      { answer: string; nextSteps: readonly string[] }
    >
  > = {
    what_requires_attention: {
      answer:
        "Review the synthetic safety, due-item, missing-evidence, and non-response signals assigned in the governed clinical workplan.",
      nextSteps: [
        "Open the assigned workplan item",
        "Route the accountable human review",
      ],
    },
    why_flag_fired: {
      answer: `The flag is explained only by ${sourceCount} visible governed source record(s); ${missingCount} missing-evidence condition(s) remain visible.`,
      nextSteps: [
        "Inspect the cited source state",
        "Confirm the signal with a qualified human",
      ],
    },
    which_source_governs: {
      answer:
        "The citations below are the complete governed source set for this response; no free-form model source is treated as authority.",
      nextSteps: [
        "Review version and owner",
        "Confirm effective and review dates",
      ],
    },
    what_evidence_is_missing: {
      answer:
        missingCount > 0
          ? `${missingCount} required evidence condition(s) remain unresolved and block the affected workflow.`
          : "The selected synthetic source set reports no missing evidence.",
      nextSteps: [
        "Review each missing-evidence label",
        "Route unresolved evidence to clinical governance",
      ],
    },
    start_approved_workflow: {
      answer:
        "The approved synthetic workflow may be prepared, but execution remains blocked until source readiness, competency, and the named human gate pass.",
      nextSteps: [
        "Verify source readiness",
        "Obtain named qualified human disposition",
      ],
    },
    route_human_review: {
      answer:
        "The request is routed to the Clinical Director and BHC Director human gate with source and access context preserved.",
      nextSteps: [
        "Record qualified reviewer",
        "Document rationale and any override",
      ],
    },
  };
  return byIntent[intent];
}

export function askM41cClinicalGuidance(
  input: M41cClinicalGuidanceRequest,
): M41cClinicalGuidanceResponse {
  if (!input.requestId.startsWith("SYNTH-"))
    throw new Error("M41C_SYNTHETIC_REQUEST_ID_REQUIRED");
  if (!input.prompt.trim()) throw new Error("M41C_CLINICAL_PROMPT_REQUIRED");
  const createdAt = input.createdAt ?? M41C_EVALUATION_AS_OF;
  if (!Number.isFinite(Date.parse(createdAt)))
    throw new Error("M41C_CLINICAL_GUIDANCE_TIME_INVALID");
  if (input.workplanItemId && !input.workplanItemId.startsWith("SYNTH-"))
    throw new Error("M41C_SYNTHETIC_WORKPLAN_ITEM_REQUIRED");
  const requestedFields = input.requestedFields ?? ["safety_status"];
  const minimumNecessaryFields =
    input.minimumNecessaryFields ?? requestedFields;
  const access = evaluateM41cClinicalAccess({
    role: input.role,
    actorId: input.actorId,
    subjectId: input.subjectId,
    purpose: "direct_care",
    consentState: input.consentState,
    part2: input.part2 ?? false,
    requestedFields,
    minimumNecessaryFields,
  });
  const registry = createSyntheticM41cClinicalKnowledgeRegistry();
  const requestedSourceIds =
    input.sourceIds && input.sourceIds.length > 0
      ? input.sourceIds
      : ["M41C-SRC-CONTROLLING-DOCTRINE"];
  const sources = requestedSourceIds.map((sourceId) => {
    const found = registry.sources.find(
      (candidate) => candidate.id === sourceId,
    );
    if (!found) throw new Error(`M41C_CLINICAL_SOURCE_NOT_FOUND:${sourceId}`);
    return found;
  });
  const citations = Object.freeze(sources.map(citation));
  const missingEvidence = Object.freeze([
    ...new Set(sources.flatMap((source) => source.missingEvidence)),
  ]);
  const sourceReady = sources.every(
    (source) =>
      source.state === "current" &&
      Date.parse(source.reviewDueAt) > Date.parse(createdAt) &&
      ["not_required", "licensed_demo"].includes(source.licenseState),
  );
  const gate = humanGate(input.requestId);
  const refused = !access.allowed || !sourceReady;
  const refusalCode = !access.allowed
    ? access.code
    : !sourceReady
      ? "M41C_SOURCE_NOT_DEMO_READY"
      : null;
  const responseText = answerFor(
    input.intent,
    citations.length,
    missingEvidence.length,
  );
  const recommendationId = deterministicId(
    "SYNTH-M41C-RECOMMENDATION",
    input.requestId,
    input.intent,
  );
  const recommendation: M41cClinicalRecommendation | null = refused
    ? null
    : Object.freeze({
        id: recommendationId,
        subjectId: input.subjectId,
        pathwayId: "SYNTH-M41C-GOVERNED-GUIDANCE-PATHWAY",
        pathwayVersion: "1.0",
        summary: responseText.answer,
        rationale: Object.freeze([
          "Governed source records were current and permitted.",
          "A named qualified human disposition remains required.",
        ]),
        sourceIds: Object.freeze([...requestedSourceIds]),
        citations,
        missingEvidence,
        uncertainty:
          "Synthetic prototype guidance does not establish clinical truth or replace licensed review.",
        confidence: null,
        requiredHumanApprover: Object.freeze([
          "clinical-director",
          "bhc-director",
        ] satisfies UserRole[]),
        humanGate: gate,
        workplanCadences: Object.freeze([
          "daily",
          "weekly",
        ] satisfies M41bCadence[]),
        workplanItemIds: Object.freeze(
          input.workplanItemId ? [input.workplanItemId] : [],
        ),
        prohibitedActions: Object.freeze([...M41C_PROHIBITED_ACTIONS]),
        status: "proposed",
        createdAt,
        evidenceClass: M41C_EVIDENCE_CLASS,
      });
  return Object.freeze({
    responseId: deterministicId("SYNTH-M41C-GUIDANCE", input.requestId),
    requestId: input.requestId,
    intent: input.intent,
    answer: refused
      ? `${responseText.answer} No clinical recommendation was created: ${refusalCode}.`
      : responseText.answer,
    nextSteps: Object.freeze([...responseText.nextSteps]),
    citations,
    missingEvidence,
    limitations: Object.freeze([
      M41C_DEMO_BOUNDARY.label,
      ...sources.flatMap((source) => source.limitations),
    ]),
    uncertainty:
      missingEvidence.length > 0
        ? "Required source evidence remains incomplete."
        : "Synthetic guidance remains subject to qualified human review.",
    humanGate: gate,
    recommendation,
    workplanItemId: input.workplanItemId ?? null,
    refused,
    refusalCode,
    productionActionBlocked: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}
