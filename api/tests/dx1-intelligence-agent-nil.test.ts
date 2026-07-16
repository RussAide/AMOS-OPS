import { describe, expect, it } from "vitest";
import { AGENT_PERSONAS } from "@/components/agents/agent-personas";
import { DX1_PILOT_FIXTURE } from "../services/dx1/fixtures";
import {
  createDx1RelationshipGraph,
  createDx1RelationshipNilActors,
  queryDx1RelationshipNil,
  runDx1AgentAssistanceVerification,
  runDx1AgentBypassProbe,
  runDx1NilVerification,
} from "../services/dx1/intelligence";

describe("DX.1 bounded agents and relationship-aware NIL", () => {
  it("provides cited, human-gated assistance at five points of work", () => {
    const result = runDx1AgentAssistanceVerification();
    expect(result.accepted).toBe(true);
    expect(result.registeredPersonaCount).toBe(13);
    expect(result.assistance).toHaveLength(5);
    for (const item of result.assistance) {
      expect(item.agent.operatingStatus).toBe("active");
      expect(item.response.refused).toBe(false);
      expect(item.response.citations.length).toBeGreaterThan(0);
      expect(item.response.humanGate.required).toBe(true);
      expect(item.actionExecuted).toBe(false);
      expect(item.approvalBypassed).toBe(false);
    }
    expect(AGENT_PERSONAS["amos-prime"]?.status).toBe("deferred");
    expect(
      result.assistance.find(
        (item) => item.stageId === "executive-risk-revenue-summary",
      )?.agent,
    ).toMatchObject({
      registeredPersonaKey: "amos-prime",
      operatingPersonaKey: "amos-core",
      deferredFallbackApplied: true,
    });
  });

  it("refuses an agent request to bypass approval and act in production", () => {
    const response = runDx1AgentBypassProbe();
    expect(response).toMatchObject({
      refused: true,
      recommendationId: null,
      workflowLaunch: null,
    });
    expect(response.refusalCode).toMatch(
      /M41B_(MODEL_ONLY_ACTION_DENIED|PRODUCTION_ACTION_BLOCKED)/,
    );
  });

  it("connects the shared youth record to risk, corrective action, and decision", () => {
    const result = runDx1NilVerification();
    const path = result.relationshipAnswer.paths[0]!;
    const kinds = path.nodeIds.map(
      (nodeId) =>
        result.graph.nodes.find((candidate) => candidate.nodeId === nodeId)!
          .kind,
    );
    expect(result.nodeKinds).toEqual(
      expect.arrayContaining([
        "document",
        "synthetic_youth_record",
        "staff_role",
        "workflow",
        "policy",
        "risk",
        "corrective_action",
        "decision",
      ]),
    );
    expect(kinds).toEqual(
      expect.arrayContaining([
        "synthetic_youth_record",
        "workflow",
        "risk",
        "corrective_action",
        "decision",
      ]),
    );
    expect(result.relationshipAnswer).toMatchObject({
      permissionTrimmedBeforeTraversal: true,
      permissionTrimmedBeforeAnswer: true,
      permissionTrimmedBeforeCitation: true,
      externalModelCalls: 0,
      externalWrites: 0,
    });
  });

  it("denies an unauthorized youth starting point without leaking its graph", () => {
    const graph = createDx1RelationshipGraph();
    const actors = createDx1RelationshipNilActors();
    expect(() =>
      queryDx1RelationshipNil(graph, actors.operationsReader, {
        question: "Show the synthetic youth relationship.",
        startNodeId: DX1_PILOT_FIXTURE.youthId,
        targetKind: "decision",
      }),
    ).toThrow("DX1_NIL_START_NODE_NOT_AUTHORIZED");

    const authorized = queryDx1RelationshipNil(graph, actors.operationsReader, {
      question: "How does the policy constrain the workflow?",
      startNodeId: "SYNTH-DX1-POLICY-EVIDENCE-GATE",
      targetKind: "workflow",
    });
    expect(JSON.stringify(authorized)).not.toContain(DX1_PILOT_FIXTURE.youthId);
  });
});
