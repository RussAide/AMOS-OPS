import { describe, expect, it } from "vitest";
import { DX1_SCENARIO_ID } from "../services/dx1/contracts";
import { DX1_PILOT_FIXTURE } from "../services/dx1/fixtures";
import {
  DX1_PILOT_ACTORS,
  evaluateDx1PilotAccess,
} from "../services/dx1/pilot";
import type {
  Dx1PilotAccessRequest,
  Dx1SecurityAction,
  Dx1SecurityDomain,
} from "../services/dx1/pilot";

function request(
  input: Partial<Dx1PilotAccessRequest> = {},
): Dx1PilotAccessRequest {
  return {
    requestId: "SYNTH-DX1-TEST-ACCESS-REQUEST-001",
    scenarioId: DX1_SCENARIO_ID,
    stageId: "cross-enterprise",
    actor: DX1_PILOT_ACTORS.clinician,
    domain: "phi-like-clinical",
    action: "view",
    recordId: DX1_PILOT_FIXTURE.episodeId,
    subjectId: DX1_PILOT_FIXTURE.youthId,
    requestedFields: ["support_context", "human_gate_status"],
    ...input,
  };
}

describe("DX.1-08 cross-domain authorization adapter", () => {
  it.each<{
    domain: Dx1SecurityDomain;
    action: Dx1SecurityAction;
    actor: Dx1PilotAccessRequest["actor"];
    recordId: string;
    subjectId?: string;
    fields: readonly string[];
  }>([
    {
      domain: "phi-like-clinical",
      action: "view",
      actor: DX1_PILOT_ACTORS.clinician,
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
      fields: ["support_context", "human_gate_status"],
    },
    {
      domain: "hr",
      action: "view",
      actor: DX1_PILOT_ACTORS.hr,
      recordId: "SYNTH-DX1-WORKFORCE-001",
      fields: ["workforce_status", "credential_status"],
    },
    {
      domain: "finance",
      action: "record",
      actor: DX1_PILOT_ACTORS.revenue,
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-BILLING`,
      fields: ["billing_gate_status", "service_units"],
    },
    {
      domain: "executive",
      action: "summarize",
      actor: DX1_PILOT_ACTORS.executive,
      recordId: DX1_SCENARIO_ID,
      fields: [
        "aggregate_operational_status",
        "aggregate_compliance_risk",
        "aggregate_revenue_status",
        "aggregate_workforce_status",
        "provenance_ids",
      ],
    },
    {
      domain: "compliance",
      action: "review",
      actor: DX1_PILOT_ACTORS.qa,
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-QA`,
      fields: ["qa_status", "evidence_gate_status", "audit_event_ids"],
    },
  ])("allows the minimum representative $domain duty", (entry) => {
    const result = evaluateDx1PilotAccess(
      request({
        requestId: `SYNTH-DX1-TEST-ALLOW-${entry.domain}`,
        domain: entry.domain,
        action: entry.action,
        actor: entry.actor,
        recordId: entry.recordId,
        subjectId: entry.subjectId,
        requestedFields: entry.fields,
      }),
    );
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("DX1_ACCESS_ALLOWED");
    expect(result.permittedFields).toEqual(entry.fields);
    expect(result.suppressedFields).toEqual([]);
    expect(result.auditEvent.outcome).toBe("allowed");
  });

  it.each([
    ["hr", DX1_PILOT_ACTORS.revenue, "workforce_status"],
    ["finance", DX1_PILOT_ACTORS.intake, "billing_gate_status"],
    ["executive", DX1_PILOT_ACTORS.clinician, "aggregate_operational_status"],
    ["compliance", DX1_PILOT_ACTORS.revenue, "qa_status"],
  ] as const)("denies a cross-duty request into %s", (domain, actor, field) => {
    const result = evaluateDx1PilotAccess(
      request({
        requestId: `SYNTH-DX1-TEST-DENY-${domain}`,
        domain,
        actor,
        recordId: `SYNTH-DX1-${domain.toUpperCase()}-001`,
        subjectId: undefined,
        requestedFields: [field],
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DX1_CANONICAL_PERMISSION_DENIED");
    expect(result.auditEvent.outcome).toBe("denied");
  });

  it("narrows broad executive permission away from direct PHI-like detail", () => {
    const result = evaluateDx1PilotAccess(
      request({
        actor: DX1_PILOT_ACTORS.executive,
        requestedFields: ["youth_reference"],
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DX1_LEAST_PRIVILEGE_ROLE_DENIED");
  });

  it("rejects fields outside the frozen minimum-necessary set", () => {
    const result = evaluateDx1PilotAccess(
      request({ requestedFields: ["support_context", "diagnosis_text"] }),
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DX1_MINIMUM_NECESSARY_DENIED");
    expect(result.permittedFields).toEqual(["support_context"]);
    expect(result.suppressedFields).toEqual(["diagnosis_text"]);
  });

  it.each([
    [
      "DX1_SCENARIO_BOUNDARY_DENIED",
      { scenarioId: "SYNTH-DX1-WRONG-SCENARIO" },
    ],
    [
      "DX1_SYNTHETIC_ACTOR_REQUIRED",
      {
        actor: {
          ...DX1_PILOT_ACTORS.clinician,
          actorId: "REAL-ACTOR-NOT-ALLOWED",
        },
      },
    ],
    [
      "DX1_SYNTHETIC_RECORD_REQUIRED",
      { recordId: "REAL-RECORD-NOT-ALLOWED" },
    ],
    [
      "DX1_SYNTHETIC_SUBJECT_REQUIRED",
      { subjectId: "REAL-SUBJECT-NOT-ALLOWED" },
    ],
  ] as const)("fails closed with %s", (code, override) => {
    const result = evaluateDx1PilotAccess(request(override));
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(code);
    expect(result.auditEvent.synthetic).toBe(true);
  });

  it("reconciles PHI-like permission through the inherited clinical policy", () => {
    const result = evaluateDx1PilotAccess(request());
    expect(result.allowed).toBe(true);
    expect(result.canonicalClinicalDecisionCode).toBe("M41C_ACCESS_ALLOWED");
  });

  it("is deterministic and returns immutable decisions", () => {
    const first = evaluateDx1PilotAccess(request());
    const second = evaluateDx1PilotAccess(request());
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.auditEvent)).toBe(true);
    expect(Object.isFrozen(first.permittedFields)).toBe(true);
  });
});
