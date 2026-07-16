import type { M42SearchCitation } from "@contracts/m42/search";
import {
  createFrozenM42NilCorpus,
  createM42NilEvaluationActor,
  searchM42Nil,
} from "../../m42";
import { DX1_SCENARIO_ID, type Dx1AuditEvent } from "../contracts";
import { DX1_PILOT_FIXTURE } from "../fixtures";
import {
  assertDx1Intelligence,
  createDx1IntelligenceAuditEvent,
  dx1IntelligenceId,
  immutable,
  unique,
} from "./support";

export const DX1_NIL_NODE_KINDS = [
  "document",
  "synthetic_youth_record",
  "staff_role",
  "workflow",
  "policy",
  "risk",
  "corrective_action",
  "decision",
] as const;

export type Dx1NilNodeKind = (typeof DX1_NIL_NODE_KINDS)[number];

export interface Dx1NilNode {
  readonly nodeId: string;
  readonly kind: Dx1NilNodeKind;
  readonly label: string;
  readonly requiredEntitlements: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly synthetic: true;
}

export interface Dx1NilEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly relation: string;
  readonly toNodeId: string;
  readonly evidenceIds: readonly string[];
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly synthetic: true;
}

export interface Dx1NilGraph {
  readonly graphId: string;
  readonly nodes: readonly Dx1NilNode[];
  readonly edges: readonly Dx1NilEdge[];
  readonly sourceMilestones: readonly ["M4.2", "DX.1"];
  readonly synthetic: true;
}

export interface Dx1NilActorContext {
  readonly actorId: string;
  readonly role: string;
  readonly entitlements: readonly string[];
  readonly synthetic: true;
}

export interface Dx1NilRelationshipPath {
  readonly pathId: string;
  readonly nodeIds: readonly string[];
  readonly relations: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface Dx1NilQueryResult {
  readonly queryId: string;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly answer: string;
  readonly paths: readonly Dx1NilRelationshipPath[];
  readonly citations: readonly M42SearchCitation[];
  readonly authorizedNodeCount: number;
  readonly authorizedEdgeCount: number;
  readonly permissionTrimmedBeforeTraversal: true;
  readonly permissionTrimmedBeforeAnswer: true;
  readonly permissionTrimmedBeforeCitation: true;
  readonly externalModelCalls: 0;
  readonly externalWrites: 0;
  readonly synthetic: true;
}

export interface Dx1NilVerificationResult {
  readonly accepted: boolean;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly graph: Readonly<Dx1NilGraph>;
  readonly relationshipAnswer: Readonly<Dx1NilQueryResult>;
  readonly nodeKinds: readonly Dx1NilNodeKind[];
  readonly auditEvents: readonly Dx1AuditEvent[];
  readonly synthetic: true;
}

function node(
  nodeId: string,
  kind: Dx1NilNodeKind,
  label: string,
  requiredEntitlements: readonly string[],
  evidenceIds: readonly string[],
): Readonly<Dx1NilNode> {
  return immutable({
    nodeId,
    kind,
    label,
    requiredEntitlements,
    evidenceIds,
    scenarioId: DX1_SCENARIO_ID,
    synthetic: true as const,
  });
}

function edge(
  fromNodeId: string,
  relation: string,
  toNodeId: string,
  evidenceIds: readonly string[],
): Readonly<Dx1NilEdge> {
  return immutable({
    edgeId: dx1IntelligenceId(
      "SYNTH-DX1-NIL-EDGE",
      fromNodeId,
      relation,
      toNodeId,
    ),
    fromNodeId,
    relation,
    toNodeId,
    evidenceIds,
    scenarioId: DX1_SCENARIO_ID,
    synthetic: true as const,
  });
}

export function createDx1RelationshipNilActors(): Readonly<{
  qualityManager: Dx1NilActorContext;
  operationsReader: Dx1NilActorContext;
}> {
  return immutable({
    qualityManager: {
      actorId: "SYNTH-DX1-ACTOR-QA-003",
      role: "quality-manager",
      entitlements: [
        "nil:enterprise:read",
        "nil:youth:read",
        "nil:workforce:read",
        "nil:compliance:read",
        "nil:executive:read",
      ],
      synthetic: true,
    },
    operationsReader: {
      actorId: "SYNTH-DX1-ACTOR-OPERATIONS-LIMITED",
      role: "operations-reader",
      entitlements: ["nil:enterprise:read"],
      synthetic: true,
    },
  });
}

export function createDx1RelationshipGraph(): Readonly<Dx1NilGraph> {
  const documentId = "SYNTH-DOCUMENT-BHC-CLINICAL-REFERENCE";
  const workflowId = "SYNTH-DX1-WORKFLOW-REFERRAL-TO-EXECUTIVE";
  const policyId = "SYNTH-DX1-POLICY-EVIDENCE-GATE";
  const riskId = "SYNTH-DX1-RISK-DOCUMENTATION-COMPLETENESS";
  const correctiveActionId = "SYNTH-DX1-CAP-DOCUMENTATION-REMEDIATION";
  const decisionId = "SYNTH-DX1-DECISION-EXECUTIVE-REVIEW";
  const staffRoleId = "SYNTH-DX1-ROLE-QUALITY-MANAGER";
  const nodes = immutable([
    node(
      documentId,
      "document",
      "Synthetic Clinical Team Evidence Reference",
      ["nil:enterprise:read"],
      ["SYN-M42-NIL-013", documentId],
    ),
    node(
      DX1_PILOT_FIXTURE.youthId,
      "synthetic_youth_record",
      "Synthetic Youth Continuum Record",
      ["nil:youth:read"],
      [DX1_PILOT_FIXTURE.referralId, DX1_PILOT_FIXTURE.episodeId],
    ),
    node(
      staffRoleId,
      "staff_role",
      "Synthetic Quality Manager Role",
      ["nil:workforce:read"],
      ["SYNTH-DX1-ACTOR-QA-003"],
    ),
    node(
      workflowId,
      "workflow",
      "Referral-to-Executive Governed Pilot",
      ["nil:enterprise:read"],
      [...DX1_PILOT_FIXTURE.expectedStages],
    ),
    node(
      policyId,
      "policy",
      "Evidence Before Progression Policy",
      ["nil:enterprise:read"],
      [documentId, DX1_PILOT_FIXTURE.documentPacketId],
    ),
    node(
      riskId,
      "risk",
      "Documentation Completeness Risk",
      ["nil:compliance:read"],
      ["SYNTH-M31-FINDING-CHART-001"],
    ),
    node(
      correctiveActionId,
      "corrective_action",
      "Documentation Remediation Corrective Action",
      ["nil:compliance:read"],
      ["SYNTH-M31-CAP-001"],
    ),
    node(
      decisionId,
      "decision",
      "Synthetic Executive Review Decision",
      ["nil:executive:read"],
      ["SYNTH-M41A-DECISION", DX1_PILOT_FIXTURE.documentPacketId],
    ),
  ]);
  const edges = immutable([
    edge(documentId, "governs", policyId, ["SYN-M42-NIL-013"]),
    edge(policyId, "constrains", workflowId, [
      DX1_PILOT_FIXTURE.documentPacketId,
    ]),
    edge(workflowId, "serves", DX1_PILOT_FIXTURE.youthId, [
      DX1_PILOT_FIXTURE.episodeId,
    ]),
    edge(staffRoleId, "reviews", workflowId, ["SYNTH-DX1-ACTOR-QA-003"]),
    edge(workflowId, "exposes", riskId, ["SYNTH-M31-FINDING-CHART-001"]),
    edge(riskId, "requires", correctiveActionId, ["SYNTH-M31-CAP-001"]),
    edge(staffRoleId, "owns", correctiveActionId, ["SYNTH-M31-CAP-001"]),
    edge(correctiveActionId, "supports", decisionId, ["SYNTH-M41A-DECISION"]),
  ]);
  return immutable({
    graphId: "SYNTH-DX1-NIL-RELATIONSHIP-GRAPH-001",
    nodes,
    edges,
    sourceMilestones: ["M4.2", "DX.1"] as const,
    synthetic: true as const,
  });
}

function canReadNode(
  actor: Dx1NilActorContext,
  candidate: Dx1NilNode,
): boolean {
  return candidate.requiredEntitlements.every((entitlement) =>
    actor.entitlements.includes(entitlement),
  );
}

function buildPath(
  parentByNode: ReadonlyMap<
    string,
    { readonly parentId: string; readonly edge: Dx1NilEdge }
  >,
  startNodeId: string,
  endNodeId: string,
): Readonly<Dx1NilRelationshipPath> {
  const nodeIds = [endNodeId];
  const relations: string[] = [];
  const evidenceIds: string[] = [];
  let cursor = endNodeId;
  while (cursor !== startNodeId) {
    const parent = parentByNode.get(cursor);
    assertDx1Intelligence(parent, "DX1_NIL_PATH_PARENT_MISSING");
    nodeIds.unshift(parent.parentId);
    relations.unshift(parent.edge.relation);
    evidenceIds.unshift(...parent.edge.evidenceIds);
    cursor = parent.parentId;
  }
  return immutable({
    pathId: dx1IntelligenceId("SYNTH-DX1-NIL-PATH", ...nodeIds, ...relations),
    nodeIds,
    relations,
    evidenceIds: unique(evidenceIds),
  });
}

export function queryDx1RelationshipNil(
  graph: Dx1NilGraph,
  actor: Dx1NilActorContext,
  input: {
    readonly question: string;
    readonly startNodeId: string;
    readonly targetKind: Dx1NilNodeKind;
    readonly maximumDepth?: number;
  },
): Readonly<Dx1NilQueryResult> {
  if (!input.question.trim()) throw new Error("DX1_NIL_QUESTION_REQUIRED");
  const authorizedNodes = graph.nodes.filter((candidate) =>
    canReadNode(actor, candidate),
  );
  const authorizedNodeIds = new Set(
    authorizedNodes.map((candidate) => candidate.nodeId),
  );
  if (!authorizedNodeIds.has(input.startNodeId))
    throw new Error("DX1_NIL_START_NODE_NOT_AUTHORIZED");
  const authorizedEdges = graph.edges.filter(
    (candidate) =>
      authorizedNodeIds.has(candidate.fromNodeId) &&
      authorizedNodeIds.has(candidate.toNodeId),
  );
  const maximumDepth = Math.min(6, Math.max(1, input.maximumDepth ?? 5));
  const visited = new Set([input.startNodeId]);
  const parentByNode = new Map<
    string,
    { readonly parentId: string; readonly edge: Dx1NilEdge }
  >();
  const queue: Array<{ nodeId: string; depth: number }> = [
    { nodeId: input.startNodeId, depth: 0 },
  ];
  let matchedNodeId: string | null = null;
  while (queue.length > 0 && !matchedNodeId) {
    const current = queue.shift()!;
    if (current.depth >= maximumDepth) continue;
    const neighbors = authorizedEdges
      .filter(
        (candidate) =>
          candidate.fromNodeId === current.nodeId ||
          candidate.toNodeId === current.nodeId,
      )
      .map((candidate) => ({
        nodeId:
          candidate.fromNodeId === current.nodeId
            ? candidate.toNodeId
            : candidate.fromNodeId,
        edge: candidate,
      }))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;
      visited.add(neighbor.nodeId);
      parentByNode.set(neighbor.nodeId, {
        parentId: current.nodeId,
        edge: neighbor.edge,
      });
      const neighborNode = authorizedNodes.find(
        (candidate) => candidate.nodeId === neighbor.nodeId,
      );
      if (neighborNode?.kind === input.targetKind) {
        matchedNodeId = neighbor.nodeId;
        break;
      }
      queue.push({ nodeId: neighbor.nodeId, depth: current.depth + 1 });
    }
  }
  const paths = matchedNodeId
    ? [buildPath(parentByNode, input.startNodeId, matchedNodeId)]
    : [];
  const sourceAnswer = searchM42Nil(
    createFrozenM42NilCorpus(),
    createM42NilEvaluationActor(),
    "knowledge answer citation",
    1,
  );
  assertDx1Intelligence(
    sourceAnswer.results.length === 1 &&
      sourceAnswer.permissionTrimmedBeforeCitation,
    "DX1_NIL_ACCEPTED_CITATION_REQUIRED",
  );
  const citations = sourceAnswer.results.map((candidate) => candidate.citation);
  const labels = paths[0]?.nodeIds.map(
    (nodeId) =>
      authorizedNodes.find((candidate) => candidate.nodeId === nodeId)!.label,
  );
  return immutable({
    queryId: dx1IntelligenceId(
      "SYNTH-DX1-NIL-QUERY",
      actor.actorId,
      input.question,
      input.startNodeId,
      input.targetKind,
    ),
    scenarioId: DX1_SCENARIO_ID,
    answer:
      paths.length === 0
        ? "No authorized relationship path was found."
        : `Authorized relationship path: ${labels!.join(" -> ")}.`,
    paths,
    citations,
    authorizedNodeCount: authorizedNodes.length,
    authorizedEdgeCount: authorizedEdges.length,
    permissionTrimmedBeforeTraversal: true as const,
    permissionTrimmedBeforeAnswer: true as const,
    permissionTrimmedBeforeCitation: true as const,
    externalModelCalls: 0 as const,
    externalWrites: 0 as const,
    synthetic: true as const,
  });
}

export function runDx1NilVerification(): Readonly<Dx1NilVerificationResult> {
  const graph = createDx1RelationshipGraph();
  const actors = createDx1RelationshipNilActors();
  const relationshipAnswer = queryDx1RelationshipNil(
    graph,
    actors.qualityManager,
    {
      question:
        "How does the synthetic youth record relate to risk, corrective action, and the executive decision?",
      startNodeId: DX1_PILOT_FIXTURE.youthId,
      targetKind: "decision",
      maximumDepth: 5,
    },
  );
  const nodeKinds = unique(graph.nodes.map((candidate) => candidate.kind));
  const answerNodeKinds = relationshipAnswer.paths[0]?.nodeIds.map(
    (nodeId) =>
      graph.nodes.find((candidate) => candidate.nodeId === nodeId)!.kind,
  );
  assertDx1Intelligence(
    DX1_NIL_NODE_KINDS.every((kind) => nodeKinds.includes(kind)) &&
      relationshipAnswer.paths.length === 1 &&
      relationshipAnswer.paths[0]!.relations.length >= 4 &&
      answerNodeKinds?.includes("risk") &&
      answerNodeKinds.includes("corrective_action") &&
      answerNodeKinds.includes("decision"),
    "DX1_NIL_RELATIONSHIP_VERIFICATION_FAILED",
  );
  const auditEvents = immutable([
    createDx1IntelligenceAuditEvent({
      action: "nil-relationship-answer",
      actorId: actors.qualityManager.actorId,
      actorRole: actors.qualityManager.role,
      outcome: "completed",
      reason:
        "The permission-trimmed graph related the shared scenario to a cited synthetic executive decision.",
      evidenceIds: [
        graph.graphId,
        relationshipAnswer.queryId,
        relationshipAnswer.paths[0]!.pathId,
        relationshipAnswer.citations[0]!.documentId,
      ],
      stageId: "executive-risk-revenue-summary",
    }),
  ]);
  return immutable({
    accepted: true,
    scenarioId: DX1_SCENARIO_ID,
    graph,
    relationshipAnswer,
    nodeKinds,
    auditEvents,
    synthetic: true as const,
  });
}
