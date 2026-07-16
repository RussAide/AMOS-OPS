import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ALL_ROLES } from "@/constants/roles";
import {
  M41B_CADENCES,
  M41B_ENVIRONMENT_LABEL,
  M41B_GUIDANCE_INTENTS,
  M41B_MATERIAL_DOMAINS,
  type M41bScenarioResult,
  type M41bWorkplanItem,
} from "@contracts/m41b";

export const M41B_CRITERIA = [
  "M4.1B-01",
  "M4.1B-02",
  "M4.1B-03",
  "M4.1B-04",
  "M4.1B-05",
  "M4.1B-06",
  "M4.1B-07",
  "M4.1B-08",
  "M4.1B-09",
  "M4.1B-10",
] as const;

export const M41B_EVIDENCE_FILES = {
  scenario: "M4_1B_INTEGRATED_SCENARIO_RESULT.json",
  roleCadence: "M4_1B_ROLE_CADENCE_WORKPLAN_MATRIX.json",
  priorities: "M4_1B_PRIORITY_GENERATION_RESULT.json",
  askAmos: "M4_1B_ASK_AMOS_RESULT.json",
  sourceTransparency: "M4_1B_SOURCE_TRANSPARENCY_RESULT.json",
  humanGate: "M4_1B_HUMAN_GATE_RESULT.json",
  recommendationTask: "M4_1B_RECOMMENDATION_TASK_RESULT.json",
  fiveCadence: "M4_1B_FIVE_CADENCE_RESULT.json",
  accessRefusal: "M4_1B_ACCESS_REFUSAL_RESULT.json",
  auditLineage: "M4_1B_AUDIT_LINEAGE_RESULT.json",
  personaScenario: "M4_1B_PERSONA_SCENARIO_RESULT.json",
  manifest: "M4_1B_ACCEPTANCE_MANIFEST.json",
  summary: "M4_1B_ACCEPTANCE_SUMMARY.md",
  checksums: "M4_1B_SHA256SUMS.txt",
  qa: "M4_1B_INTEGRATED_QA.json",
} as const;

export const M41B_CRITERION_EVIDENCE_FILES = {
  "M4.1B-01": M41B_EVIDENCE_FILES.roleCadence,
  "M4.1B-02": M41B_EVIDENCE_FILES.priorities,
  "M4.1B-03": M41B_EVIDENCE_FILES.askAmos,
  "M4.1B-04": M41B_EVIDENCE_FILES.sourceTransparency,
  "M4.1B-05": M41B_EVIDENCE_FILES.humanGate,
  "M4.1B-06": M41B_EVIDENCE_FILES.recommendationTask,
  "M4.1B-07": M41B_EVIDENCE_FILES.fiveCadence,
  "M4.1B-08": M41B_EVIDENCE_FILES.accessRefusal,
  "M4.1B-09": M41B_EVIDENCE_FILES.auditLineage,
  "M4.1B-10": M41B_EVIDENCE_FILES.personaScenario,
} as const;

const M41B_OBSOLETE_GROUPED_EVIDENCE_FILES = [
  "M4_1B_WORKPLAN_AND_CADENCE_COVERAGE.json",
  "M4_1B_GUIDED_ASSISTANCE_RESULT.json",
  "M4_1B_HUMAN_GATE_AND_TASK_RESULT.json",
  "M4_1B_RECOMMENDATION_TO_EVIDENCE_LINEAGE.json",
  "M4_1B_FAIL_CLOSED_CONTROL_RESULT.json",
  "M4_1B_ROLE_DIVISION_SCENARIO_COVERAGE.json",
] as const;

const M41B_CONTROL_REFERENCES = [
  "controls/AGENT_FILE_OWNERSHIP.csv",
  "controls/DEFERRED_SEQUENCE_BACKLOG.md",
  "controls/M4_1B_ACCEPTANCE_MATRIX.csv",
  "controls/M4_1B_REQUIREMENT_BASELINE.md",
  "controls/M4_1B_SCOPE_BOUNDARY.md",
  "controls/M4_1B_SPRINT_CHARTER.md",
  "../M4.1A_Executive_Decision_Intelligence_Operational/evidence/M4_1A_ACCEPTANCE_MANIFEST.json",
] as const;

const REQUIRED_REFUSAL_CODES = [
  "M41B_SOURCE_UNAVAILABLE",
  "M41B_SOURCE_CONTRADICTORY",
  "M41B_CROSS_DIVISION_ACCESS_DENIED",
  "M41B_SOURCE_PERMISSION_DENIED",
  "M41B_MODEL_ONLY_ACTION_DENIED",
  "M41B_PRODUCTION_ACTION_BLOCKED",
  "M41B_ACTION_NOT_DELEGATED",
  "M41B_STALE_SOURCE_ACTION_DENIED",
] as const;

const REQUIRED_AUDIT_EVENTS = [
  "prompt_received",
  "source_retrieved",
  "guidance_issued",
  "human_disposition_recorded",
  "task_created",
  "completion_evidence_added",
  "task_completed",
] as const;

export interface M41bEvidenceOptions {
  root: string;
  output: string;
}

export interface M41bFileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

export function assertM41b(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function normalizeM41bPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isM41bPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function parseM41bEvidenceOptions(
  argv: readonly string[],
): M41bEvidenceOptions {
  let root: string | undefined;
  let output: string | undefined;
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence");
  return { root: resolvedRoot, output: path.resolve(output) };
}

export function m41bSourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1B source root is missing under ${root}.`);
}

export function m41bMilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m41bSourceRoot(root));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stableM41bJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function atomicWriteM41b(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function hashM41bBuffer(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function m41bFileRecord(
  absolutePath: string,
  label = path.basename(absolutePath),
): M41bFileRecord {
  const contents = fs.readFileSync(absolutePath);
  return {
    path: normalizeM41bPath(label),
    bytes: contents.length,
    sha256: hashM41bBuffer(contents),
  };
}

export function readM41bJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function inspectM41bSyntheticBoundary(value: unknown, source: string): void {
  const visit = (candidate: unknown, pointer: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => visit(child, `${pointer}[${index}]`));
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(
      candidate as Record<string, unknown>,
    )) {
      const normalized = key.toLowerCase().replaceAll("_", "");
      const childPointer = `${pointer}.${key}`;
      if (normalized === "evidenceclass")
        assertM41b(
          child === "synthetic_demo" || child === null,
          `${source} contains non-synthetic evidence at ${childPointer}.`,
        );
      if (normalized === "productionrows")
        assertM41b(
          child === 0,
          `${source} reports production rows at ${childPointer}.`,
        );
      if (normalized === "usesproductiondata")
        assertM41b(
          child === false,
          `${source} reports production-data use at ${childPointer}.`,
        );
      visit(child, childPointer);
    }
  };
  visit(value, "$");
}

export function m41bWorkplanItems(
  result: Pick<M41bScenarioResult, "workplans">,
): readonly M41bWorkplanItem[] {
  const byId = new Map<string, M41bWorkplanItem>();
  for (const workplan of result.workplans)
    for (const cadence of M41B_CADENCES)
      for (const item of workplan.briefs[cadence].items)
        byId.set(item.id, item);
  return [...byId.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function validateM41bScenario(value: unknown): M41bScenarioResult {
  assertM41b(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "M4.1B integrated scenario returned no result object.",
  );
  const result = value as Partial<M41bScenarioResult>;
  inspectM41bSyntheticBoundary(result, "M4.1B integrated scenario");
  assertM41b(
    result.milestone === "M4.1B" &&
      result.evidenceClass === "synthetic_demo" &&
      result.productionActionsBlocked === true,
    "M4.1B scenario identity or synthetic production boundary drifted.",
  );
  assertM41b(
    typeof result.scenarioId === "string" &&
      result.scenarioId.startsWith("SYNTH-M41B-") &&
      typeof result.startedAt === "string" &&
      Number.isFinite(Date.parse(result.startedAt)) &&
      typeof result.completedAt === "string" &&
      Number.isFinite(Date.parse(result.completedAt)) &&
      Date.parse(result.completedAt) >= Date.parse(result.startedAt),
    "M4.1B scenario identity or execution timestamps are invalid.",
  );
  assertM41b(result.exitGate === true, "M4.1B exit gate is not passing.");
  assertM41b(Array.isArray(result.criteria), "M4.1B criteria are missing.");
  assertM41b(
    JSON.stringify(result.criteria.map((row) => row.criterionId).sort()) ===
      JSON.stringify([...M41B_CRITERIA].sort()),
    "M4.1B scenario must contain exactly ten controlling criteria.",
  );
  assertM41b(
    result.criteria.every(
      (row) =>
        row.passed && row.summary.length > 0 && row.evidenceIds.length > 0,
    ),
    "Every M4.1B criterion must pass with linked evidence.",
  );

  assertM41b(
    Array.isArray(result.workplans) &&
      result.workplans.length === ALL_ROLES.length,
    `M4.1B must produce one workplan for all ${ALL_ROLES.length} authorized roles.`,
  );
  const coveredRoles = new Set(
    result.workplans.map((plan) => plan.roleContext.role),
  );
  assertM41b(
    ALL_ROLES.every((role) => coveredRoles.has(role)) &&
      coveredRoles.size === ALL_ROLES.length,
    "M4.1B workplan role coverage is incomplete or duplicated.",
  );
  for (const workplan of result.workplans) {
    assertM41b(
      workplan.milestone === "M4.1B" &&
        workplan.evidenceClass === "synthetic_demo" &&
        workplan.productionActionsBlocked &&
        workplan.environmentLabel === M41B_ENVIRONMENT_LABEL,
      `M4.1B workplan boundary drifted for ${workplan.roleContext.role}.`,
    );
    assertM41b(
      workplan.roleContext.evidenceClass === "synthetic_demo" &&
        workplan.roleContext.userId.startsWith("SYNTH-M41B-") &&
        workplan.roleContext.supervisorRoles.length > 0,
      `M4.1B role context is incomplete for ${workplan.roleContext.role}.`,
    );
    for (const cadence of M41B_CADENCES) {
      const brief = workplan.briefs[cadence];
      assertM41b(
        brief?.cadence === cadence &&
          brief.purpose.length > 20 &&
          brief.items.length > 0,
        `${workplan.roleContext.role} is missing a governed ${cadence} brief.`,
      );
      for (const item of brief.items)
        assertM41b(
          item.cadence === cadence &&
            item.ownerId === workplan.roleContext.userId &&
            item.ownerRole === workplan.roleContext.role &&
            item.sourceIds.length > 0 &&
            item.dueAt.length > 0 &&
            item.evidenceClass === "synthetic_demo",
          `${workplan.roleContext.role}/${item.id} is not a governed role-scoped item.`,
        );
    }
  }

  assertM41b(
    Array.isArray(result.guidance) && result.guidance.length > 0,
    "M4.1B guided-assistance evidence is missing.",
  );
  assertM41b(
    Array.isArray(result.requests) &&
      result.requests.length === result.guidance.length,
    "M4.1B authorized original guidance requests are missing or incomplete.",
  );
  const requestById = new Map(
    result.requests.map((request) => [request.requestId, request]),
  );
  assertM41b(
    requestById.size === result.requests.length &&
      result.requests.every(
        (request) =>
          request.requestId.startsWith("SYNTH-M41B-") &&
          request.prompt.trim().length > 0 &&
          ALL_ROLES.includes(request.roleContext.role) &&
          request.roleContext.userId.startsWith("SYNTH-M41B-") &&
          request.roleContext.department.trim().length > 0 &&
          request.roleContext.delegatedActions.length > 0 &&
          request.roleContext.supervisorRoles.length > 0 &&
          request.roleContext.evidenceClass === "synthetic_demo",
      ) &&
      result.guidance.every((response) => requestById.has(response.requestId)),
    "M4.1B requests do not retain a non-empty prompt and canonical synthetic role context for every response.",
  );
  const refusals = result.guidance.filter((response) => response.refused);
  const successful = result.guidance.filter((response) => !response.refused);
  const refusalCodes = new Set(
    refusals.map((response) => response.refusalCode),
  );
  assertM41b(
    REQUIRED_REFUSAL_CODES.every((code) => refusalCodes.has(code)),
    "M4.1B fail-closed refusal coverage is incomplete.",
  );
  assertM41b(
    result.silentClosureControl?.attemptId.length > 0 &&
      result.silentClosureControl.taskId.length > 0 &&
      result.silentClosureControl.evidenceCount === 0 &&
      result.silentClosureControl.blocked === true &&
      result.silentClosureControl.observedCode ===
        "M41B_TASK_COMPLETION_EVIDENCE_REQUIRED",
    "M4.1B does not prove that task completion without evidence is blocked.",
  );
  for (const response of result.guidance) {
    assertM41b(
      response.evidenceClass === "synthetic_demo" &&
        response.citations.length > 0 &&
        response.applicableLimits.length > 0,
      `${response.responseId} is missing governed guidance evidence.`,
    );
    for (const citation of response.citations)
      assertM41b(
        Boolean(
          citation.sourceId &&
          citation.version &&
          citation.ownerRole &&
          citation.effectiveAt,
        ) &&
          citation.applicableLimits.length > 0 &&
          Object.prototype.hasOwnProperty.call(citation, "refreshedAt") &&
          Object.prototype.hasOwnProperty.call(citation, "missingEvidence") &&
          Object.prototype.hasOwnProperty.call(citation, "confidence") &&
          Object.prototype.hasOwnProperty.call(citation, "uncertainty"),
        `${response.responseId}/${citation.sourceId} lacks source transparency.`,
      );
    if (response.refused)
      assertM41b(
        response.refusalCode !== null && response.recommendationId === null,
        `${response.responseId} is not a clean fail-closed refusal.`,
      );
    else
      assertM41b(
        response.recommendationId !== null &&
          response.humanGate.required &&
          response.nextSteps.length > 0,
        `${response.responseId} bypassed the accountable human gate.`,
      );
  }

  assertM41b(
    Array.isArray(result.recommendations) &&
      Array.isArray(result.decisions) &&
      Array.isArray(result.completionEvidence) &&
      Array.isArray(result.auditEvents),
    "M4.1B recommendation-to-evidence lineage is incomplete.",
  );
  assertM41b(
    result.recommendations.every((recommendation) => {
      const request = requestById.get(recommendation.requestId);
      return (
        request !== undefined &&
        request.prompt.trim().length > 0 &&
        request.roleContext.evidenceClass === "synthetic_demo"
      );
    }),
    "M4.1B recommendation lineage cannot resolve every requestId to its original prompt and canonical context.",
  );
  const tasks = m41bWorkplanItems(result as M41bScenarioResult);
  const decisions = new Map(
    result.decisions.map((decision) => [decision.id, decision]),
  );
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const evidenceByTask = new Map<string, number>();
  for (const evidence of result.completionEvidence)
    evidenceByTask.set(
      evidence.taskId,
      (evidenceByTask.get(evidence.taskId) ?? 0) + 1,
    );
  for (const recommendation of result.recommendations) {
    const decision = recommendation.humanDecisionId
      ? decisions.get(recommendation.humanDecisionId)
      : undefined;
    const task = recommendation.downstreamTaskId
      ? taskById.get(recommendation.downstreamTaskId)
      : undefined;
    assertM41b(
      recommendation.status === "approved" &&
        decision?.recommendationId === recommendation.id &&
        task?.recommendationId === recommendation.id &&
        task.approvalId === decision.id &&
        task.status === "completed" &&
        task.closedAt !== null &&
        task.dependencyIds.length > 0 &&
        task.completionEvidenceIds.length > 0 &&
        (evidenceByTask.get(task.id) ?? 0) > 0,
      `${recommendation.id} is not traceable through approval, task, and evidence.`,
    );
  }
  const overrideDecisions = result.decisions.filter(
    (decision) => decision.disposition === "override",
  );
  assertM41b(
    overrideDecisions.length > 0 &&
      overrideDecisions.every(
        (decision) =>
          typeof decision.overrideReason === "string" &&
          decision.overrideReason.trim().length > 0 &&
          result.auditEvents.some(
            (event) =>
              event.eventType === "human_disposition_recorded" &&
              event.entityId === decision.id &&
              event.after?.disposition === "override" &&
              event.after.overrideReason === decision.overrideReason,
          ),
      ),
    "M4.1B must retain a non-empty accountable-human override reason in the decision and audit lineage.",
  );
  const domains = new Set(
    successful.map((response) => response.humanGate.materialDomain),
  );
  assertM41b(
    M41B_MATERIAL_DOMAINS.every((domain) => domains.has(domain)),
    "M4.1B material human-gate domain coverage is incomplete.",
  );
  const auditTypes = new Set(
    result.auditEvents.map((event) => event.eventType),
  );
  assertM41b(
    REQUIRED_AUDIT_EVENTS.every((eventType) => auditTypes.has(eventType)) &&
      auditTypes.has("guidance_refused") &&
      auditTypes.has("task_escalated"),
    "M4.1B append-only lineage does not cover the complete governed lifecycle.",
  );
  assertM41b(
    result.auditEvents.every(
      (event) =>
        event.id.length > 0 &&
        event.correlationId.length > 0 &&
        event.actorId.length > 0 &&
        event.evidenceClass === "synthetic_demo",
    ),
    "M4.1B contains an incomplete audit event.",
  );
  return result as M41bScenarioResult;
}

export async function loadM41bScenario(root: string): Promise<unknown> {
  const modulePath = path.join(
    m41bSourceRoot(root),
    "api",
    "services",
    "m41b",
    "index.ts",
  );
  assertM41b(
    fs.existsSync(modulePath),
    `M4.1B service entry point is missing: ${modulePath}`,
  );
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<
    string,
    unknown
  >;
  const runner = loaded.runM41bIntegratedScenario;
  assertM41b(
    typeof runner === "function",
    "M4.1B service must export runM41bIntegratedScenario().",
  );
  return Promise.resolve((runner as () => unknown)());
}

export function m41bControlReferences(root: string): M41bFileRecord[] {
  const milestoneRoot = m41bMilestoneRoot(root);
  const allowedParent = path.dirname(milestoneRoot);
  return M41B_CONTROL_REFERENCES.map((repoPath) => {
    const absolute = path.resolve(milestoneRoot, repoPath);
    assertM41b(
      isM41bPathWithin(allowedParent, absolute),
      `M4.1B control reference escapes the milestone repository: ${repoPath}`,
    );
    assertM41b(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `M4.1B control reference is missing: ${repoPath}`,
    );
    return m41bFileRecord(absolute, repoPath);
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function parseCsvRow(value: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else field += character;
  }
  assertM41b(!quoted, "M4.1B acceptance matrix contains an unclosed quote.");
  fields.push(field);
  return fields;
}

export function validateM41bAcceptanceMatrix(root: string) {
  const matrixPath = path.join(
    m41bMilestoneRoot(root),
    "controls",
    "M4_1B_ACCEPTANCE_MATRIX.csv",
  );
  const lines = fs
    .readFileSync(matrixPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const headers = parseCsvRow(lines[0]);
  const criterionIndex = headers.indexOf("criterion_id");
  const evidenceIndex = headers.indexOf("evidence_path");
  assertM41b(
    criterionIndex >= 0 && evidenceIndex >= 0,
    "M4.1B acceptance matrix is missing criterion_id or evidence_path.",
  );
  const rows = lines.slice(1).map((line) => {
    const fields = parseCsvRow(line);
    return {
      criterionId: fields[criterionIndex],
      evidencePath: fields[evidenceIndex],
    };
  });
  assertM41b(
    rows.length === M41B_CRITERIA.length &&
      M41B_CRITERIA.every((criterionId) => {
        const row = rows.find(
          (candidate) => candidate.criterionId === criterionId,
        );
        return (
          row?.evidencePath ===
          `evidence/${M41B_CRITERION_EVIDENCE_FILES[criterionId]}`
        );
      }),
    "M4.1B acceptance matrix evidence paths do not match the ten criterion artifacts.",
  );
  return rows;
}

export function buildM41bEvidenceReports(
  result: M41bScenarioResult,
): Readonly<Record<string, unknown>> {
  const tasks = m41bWorkplanItems(result);
  const workplanCoverage = result.workplans.map((workplan) => ({
    userId: workplan.roleContext.userId,
    role: workplan.roleContext.role,
    tier: workplan.roleContext.tier,
    division: workplan.roleContext.division,
    department: workplan.roleContext.department,
    caseloadIds: workplan.roleContext.caseloadIds,
    delegatedActions: workplan.roleContext.delegatedActions,
    supervisorRoles: workplan.roleContext.supervisorRoles,
    cadenceItemCounts: Object.fromEntries(
      M41B_CADENCES.map((cadence) => [
        cadence,
        workplan.briefs[cadence].items.length,
      ]),
    ),
    sourceStates: Object.fromEntries(
      M41B_CADENCES.map((cadence) => [
        cadence,
        workplan.briefs[cadence].sourceStates,
      ]),
    ),
    productionActionsBlocked: workplan.productionActionsBlocked,
  }));
  const successfulGuidance = result.guidance.filter(
    (response) => !response.refused,
  );
  const refusedGuidance = result.guidance.filter(
    (response) => response.refused,
  );
  const decisionById = new Map(
    result.decisions.map((decision) => [decision.id, decision]),
  );
  const requestById = new Map(
    result.requests.map((request) => [request.requestId, request]),
  );
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const evidenceByTask = new Map<string, typeof result.completionEvidence>();
  for (const evidence of result.completionEvidence)
    evidenceByTask.set(evidence.taskId, [
      ...(evidenceByTask.get(evidence.taskId) ?? []),
      evidence,
    ]);
  const cadenceCoverage = Object.fromEntries(
    M41B_CADENCES.map((cadence) => [
      cadence,
      {
        rolesCovered: result.workplans.filter(
          (workplan) => workplan.briefs[cadence].items.length > 0,
        ).length,
        items: result.workplans.reduce(
          (count, workplan) => count + workplan.briefs[cadence].items.length,
          0,
        ),
        briefs: result.workplans.map((workplan) => ({
          role: workplan.roleContext.role,
          userId: workplan.roleContext.userId,
          title: workplan.briefs[cadence].title,
          purpose: workplan.briefs[cadence].purpose,
          generatedAt: workplan.briefs[cadence].generatedAt,
          itemIds: workplan.briefs[cadence].items.map((item) => item.id),
          sourceStates: workplan.briefs[cadence].sourceStates,
          limitations: workplan.briefs[cadence].limitations,
        })),
      },
    ]),
  );
  const priorityRows = result.workplans.flatMap((workplan) =>
    M41B_CADENCES.flatMap((cadence) =>
      workplan.briefs[cadence].items.map((item) => ({
        userId: workplan.roleContext.userId,
        role: workplan.roleContext.role,
        tier: workplan.roleContext.tier,
        homeDivision: workplan.roleContext.division,
        itemDivision: item.division,
        department: workplan.roleContext.department,
        caseloadIds: workplan.roleContext.caseloadIds,
        delegatedActions: workplan.roleContext.delegatedActions,
        cadence,
        itemId: item.id,
        naturalKey: item.naturalKey,
        priority: item.priority,
        workflowKey: item.workflowKey,
        workflowState: item.status,
        sourceIds: item.sourceIds,
        dependencyIds: item.dependencyIds,
        humanApprovalRequired: item.humanApprovalRequired,
        evidenceClass: item.evidenceClass,
      })),
    ),
  );
  const lineageRows = result.recommendations.map((recommendation) => {
    const request = requestById.get(recommendation.requestId) ?? null;
    const decision = recommendation.humanDecisionId
      ? (decisionById.get(recommendation.humanDecisionId) ?? null)
      : null;
    const task = recommendation.downstreamTaskId
      ? (taskById.get(recommendation.downstreamTaskId) ?? null)
      : null;
    return {
      originalRequest: request,
      promptContextResolved:
        request !== null &&
        request.prompt.trim().length > 0 &&
        request.roleContext.evidenceClass === "synthetic_demo",
      recommendation,
      humanDisposition: decision,
      overrideReason: decision?.overrideReason ?? null,
      downstreamTask: task,
      completionEvidence: task ? (evidenceByTask.get(task.id) ?? []) : [],
      auditEvents: result.auditEvents.filter(
        (event) =>
          event.entityId === recommendation.id ||
          event.entityId === decision?.id ||
          event.entityId === task?.id ||
          (task?.completionEvidenceIds ?? []).includes(event.entityId),
      ),
    };
  });
  const criterion = (criterionId: (typeof M41B_CRITERIA)[number]) =>
    result.criteria.find((row) => row.criterionId === criterionId);

  return {
    [M41B_EVIDENCE_FILES.roleCadence]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-01",
      passed: true,
      evidenceClass: "synthetic_demo",
      environmentLabel: M41B_ENVIRONMENT_LABEL,
      authorizedRoles: ALL_ROLES.length,
      workplansProduced: result.workplans.length,
      requiredCadences: M41B_CADENCES,
      acceptance: criterion("M4.1B-01"),
      workplans: workplanCoverage,
    },
    [M41B_EVIDENCE_FILES.priorities]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-02",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-02"),
      priorityOrder: ["critical", "high", "medium", "low"],
      inputs: [
        "role",
        "tier",
        "division",
        "caseload",
        "delegated_actions",
        "governed_source",
        "workflow_state",
      ],
      rows: priorityRows,
    },
    [M41B_EVIDENCE_FILES.askAmos]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-03",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-03"),
      requiredIntents: M41B_GUIDANCE_INTENTS,
      totalResponses: result.guidance.length,
      successfulResponses: successfulGuidance.length,
      refusedResponses: refusedGuidance.length,
      workflowLaunchesPrepared: successfulGuidance.filter(
        (response) => response.workflowLaunch !== null,
      ).length,
      supervisorRoutes: successfulGuidance.filter(
        (response) => response.escalation.routeTo.length > 0,
      ).length,
      responses: result.guidance,
    },
    [M41B_EVIDENCE_FILES.sourceTransparency]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-04",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-04"),
      citationCount: result.guidance.reduce(
        (count, response) => count + response.citations.length,
        0,
      ),
      citations: result.guidance.flatMap((response) =>
        response.citations.map((citation) => ({
          responseId: response.responseId,
          requestId: response.requestId,
          refused: response.refused,
          refusalCode: response.refusalCode,
          sourceId: citation.sourceId,
          title: citation.title,
          version: citation.version,
          ownerRole: citation.ownerRole,
          effectiveAt: citation.effectiveAt,
          refreshedAt: citation.refreshedAt,
          state: citation.state,
          applicableLimits: citation.applicableLimits,
          missingEvidence: citation.missingEvidence,
          confidence: citation.confidence,
          uncertainty: citation.uncertainty,
          recordIds: citation.recordIds,
          metadataComplete: true,
        })),
      ),
    },
    [M41B_EVIDENCE_FILES.humanGate]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-05",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-05"),
      requiredDomains: M41B_MATERIAL_DOMAINS,
      guidanceGates: successfulGuidance.map((response) => ({
        responseId: response.responseId,
        recommendationId: response.recommendationId,
        humanGate: response.humanGate,
        workflowLaunch: response.workflowLaunch,
      })),
      recommendations: result.recommendations,
      decisions: result.decisions,
      overrideDecisions: result.decisions.filter(
        (decision) => decision.disposition === "override",
      ),
    },
    [M41B_EVIDENCE_FILES.recommendationTask]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-06",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-06"),
      recommendations: result.recommendations,
      tasks,
      completionEvidence: result.completionEvidence,
      sourceToTaskRows: tasks.map((task) => ({
        taskId: task.id,
        sourceIds: task.sourceIds,
        recommendationId: task.recommendationId,
        ownerId: task.ownerId,
        ownerRole: task.ownerRole,
        dueAt: task.dueAt,
        dependencyIds: task.dependencyIds,
        status: task.status,
        completionEvidenceIds: task.completionEvidenceIds,
      })),
    },
    [M41B_EVIDENCE_FILES.fiveCadence]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-07",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-07"),
      requiredCadences: M41B_CADENCES,
      cadenceCoverage,
    },
    [M41B_EVIDENCE_FILES.accessRefusal]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-08",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-08"),
      requiredRefusalCodes: REQUIRED_REFUSAL_CODES,
      productionActionsBlocked: result.productionActionsBlocked,
      silentClosureControl: result.silentClosureControl,
      refusals: refusedGuidance.map((response) => ({
        responseId: response.responseId,
        requestId: response.requestId,
        refusalCode: response.refusalCode,
        answer: response.answer,
        sourceIds: response.citations.map((citation) => citation.sourceId),
        sourceStates: response.citations.map((citation) => citation.state),
        applicableLimits: response.applicableLimits,
        missingEvidence: response.missingEvidence,
        recommendationId: response.recommendationId,
        workflowLaunch: response.workflowLaunch,
      })),
    },
    [M41B_EVIDENCE_FILES.auditLineage]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-09",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-09"),
      requiredAuditEvents: REQUIRED_AUDIT_EVENTS,
      authorizedOriginalRequests: result.requests,
      lineages: lineageRows,
      overrideProof: lineageRows.filter(
        (lineage) => lineage.humanDisposition?.disposition === "override",
      ),
      auditEvents: result.auditEvents,
    },
    [M41B_EVIDENCE_FILES.personaScenario]: {
      milestone: "M4.1B",
      criterionId: "M4.1B-10",
      passed: true,
      evidenceClass: "synthetic_demo",
      acceptance: criterion("M4.1B-10"),
      roleCount: result.workplans.length,
      tiers: [
        ...new Set(result.workplans.map((plan) => plan.roleContext.tier)),
      ].sort(),
      divisions: [
        ...new Set(result.workplans.map((plan) => plan.roleContext.division)),
      ].sort(),
      materialDomains: [
        ...new Set(
          successfulGuidance.map(
            (response) => response.humanGate.materialDomain,
          ),
        ),
      ].sort(),
      controlledHandoff: criterion("M4.1B-10"),
      escalationEvents: result.auditEvents.filter(
        (event) => event.eventType === "task_escalated",
      ),
      refusalCodes: refusedGuidance.map((response) => response.refusalCode),
      roles: workplanCoverage.map((role) => ({
        userId: role.userId,
        role: role.role,
        tier: role.tier,
        division: role.division,
        department: role.department,
        caseloadIds: role.caseloadIds,
        delegatedActions: role.delegatedActions,
        supervisorRoles: role.supervisorRoles,
        sourceStates: role.sourceStates,
        productionActionsBlocked: role.productionActionsBlocked,
      })),
    },
  };
}

export function buildM41bSummary(result: M41bScenarioResult): string {
  const rows = result.criteria
    .map(
      (criterion) =>
        `| ${criterion.criterionId} | PASS | ${criterion.summary.replaceAll("|", "\\|")} |`,
    )
    .join("\n");
  return `# AMOS-OPS M4.1B — Acceptance Summary

**Milestone:** Executive Intelligence Assistant and Workplan Orchestration Operational  
**Status:** COMPLETE  
**Evidence boundary:** Synthetic demonstration only  
**Criteria verified:** 10/10  
**Exit gate:** PASS  
**Production rows:** 0

| Criterion | Status | Evidence summary |
|---|---|---|
${rows}

## Verified experience

- All ${result.workplans.length} authorized roles receive role-, division-, caseload-, permission-, and workflow-aware workplans across daily, weekly, monthly, quarterly, and annual cadences.
- Ask AMOS provides sourced guided explanations, workflow preparation, task creation, escalation, and supervisor routing while exposing source freshness, confidence, uncertainty, limitations, and missing evidence.
- ${result.recommendations.length} synthetic recommendations retain their original prompt and canonical role context, accountable human disposition, owned task, completion evidence, and append-only audit history.
- Missing, contradictory, stale-for-action, cross-division, source-permission, out-of-authority, model-only, and production requests fail closed.
- Accountable-human override provenance retains the non-empty reason in the decision and audit lineage.
- Representative T1-T4 roles, all four divisions, controlled handoff, escalation, contradiction, missing evidence, and refusal paths are exercised.

M4.1C clinical intelligence, M4.1D enterprise DMS integration, live Microsoft connectors, real data, autonomous approval, and production execution are not claimed by this evidence set.
`;
}

export async function exportM41bEvidence(
  options: M41bEvidenceOptions,
  suppliedResult?: unknown,
) {
  const result = validateM41bScenario(
    suppliedResult ?? (await loadM41bScenario(options.root)),
  );
  assertM41b(
    !isM41bPathWithin(m41bSourceRoot(options.root), options.output),
    "M4.1B evidence output cannot be written inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });
  for (const fileName of M41B_OBSOLETE_GROUPED_EVIDENCE_FILES)
    fs.rmSync(path.join(options.output, fileName), { force: true });

  const scenarioPath = path.join(options.output, M41B_EVIDENCE_FILES.scenario);
  atomicWriteM41b(scenarioPath, stableM41bJson(result));
  const reports = buildM41bEvidenceReports(result);
  for (const [fileName, report] of Object.entries(reports))
    atomicWriteM41b(
      path.join(options.output, fileName),
      stableM41bJson(report),
    );
  atomicWriteM41b(
    path.join(options.output, M41B_EVIDENCE_FILES.summary),
    buildM41bSummary(result),
  );

  const inventoryNames = [
    M41B_EVIDENCE_FILES.scenario,
    ...Object.keys(reports),
    M41B_EVIDENCE_FILES.summary,
  ].sort();
  const inventory = inventoryNames.map((fileName) =>
    m41bFileRecord(path.join(options.output, fileName), fileName),
  );
  const tasks = m41bWorkplanItems(result);
  const manifest = {
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-M4.1B-ACCEPTANCE-EVIDENCE",
    milestone: "M4.1B",
    title:
      "Executive Intelligence Assistant and Workplan Orchestration Operational",
    status: "complete",
    evidenceClass: "synthetic_demo",
    criteriaExpected: 10,
    criteriaPassed: 10,
    exitGate: true,
    syntheticBoundary: {
      dataMode: "synthetic_demo",
      productionRows: 0,
      usesProductionData: false,
      productionActionsBlocked: result.productionActionsBlocked,
      environmentLabel: M41B_ENVIRONMENT_LABEL,
    },
    scenario: {
      scenarioId: result.scenarioId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      resultPath: M41B_EVIDENCE_FILES.scenario,
      deterministicReplayRequired: true,
    },
    criteria: result.criteria,
    criterionEvidence: validateM41bAcceptanceMatrix(options.root),
    coverage: {
      authorizedRoles: ALL_ROLES.length,
      workplans: result.workplans.length,
      cadences: M41B_CADENCES.length,
      authorizedRequests: result.requests.length,
      guidanceResponses: result.guidance.length,
      recommendations: result.recommendations.length,
      humanDecisions: result.decisions.length,
      downstreamTasks: tasks.filter((task) => task.recommendationId !== null)
        .length,
      completionEvidence: result.completionEvidence.length,
      auditEvents: result.auditEvents.length,
    },
    controlReferences: m41bControlReferences(m41bMilestoneRoot(options.root)),
    inventory,
    nonredundancy: {
      canonicalSourceTrees: 1,
      integratedScenarioExecutions: 1,
      duplicateWorkplanEngines: 0,
      duplicateAssistantEngines: 0,
      sourceCopiesInEvidence: 0,
    },
  } as const;
  const manifestPath = path.join(options.output, M41B_EVIDENCE_FILES.manifest);
  atomicWriteM41b(manifestPath, stableM41bJson(manifest));
  const checksumRecords = [
    ...inventory,
    m41bFileRecord(manifestPath, M41B_EVIDENCE_FILES.manifest),
  ].sort((left, right) => left.path.localeCompare(right.path));
  atomicWriteM41b(
    path.join(options.output, M41B_EVIDENCE_FILES.checksums),
    `${checksumRecords
      .map((record) => `${record.sha256}  ${record.path}`)
      .join("\n")}\n`,
  );
  return manifest;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        await exportM41bEvidence(
          parseM41bEvidenceOptions(process.argv.slice(2)),
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
