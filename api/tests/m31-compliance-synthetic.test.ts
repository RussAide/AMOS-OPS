import { describe, expect, it } from "vitest";
import { M31_CRITERIA } from "@contracts/phase3/m31";
import {
  areM31AuditEventsImmutable,
  assertM31CanonicalHumanRole,
  assertM31SyntheticWrite,
  buildM31AuditLedger,
  buildM31SyntheticSnapshot,
  routeM31Finding,
  runM31SyntheticSuite,
} from "../services/m31";
import { ALL_ROLES, type UserRole } from "@/constants/roles";

describe("M3.1 compliance and audit synthetic module", () => {
  it("returns every exact acceptance criterion as passed", () => {
    const result = runM31SyntheticSuite();

    expect(result.milestone).toBe("M3.1");
    expect(result.domain).toBe("COMPLIANCE");
    expect(result.evidenceClass).toBe("synthetic_demo");
    expect(result.passed).toBe(true);
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      M31_CRITERIA,
    );
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
  });

  it("executes the fixed 90/60/30 calendar lifecycle", () => {
    const snapshot = buildM31SyntheticSnapshot();
    const alerts = [...snapshot.alerts].sort(
      (left, right) => right.windowDays - left.windowDays,
    );

    expect(alerts.map((alert) => alert.windowDays)).toEqual([90, 60, 30]);
    expect(alerts[0]?.acknowledgedAt).toBe("2026-07-14T10:00:00.000Z");
    expect(alerts[1]).toMatchObject({
      status: "escalated",
      escalationRole: "managing-director",
    });
    expect(alerts[2]).toMatchObject({
      status: "closed",
      closedAt: "2026-09-30T16:00:00.000Z",
    });
    expect(alerts[2]?.closureEvidenceIds).toEqual([
      "SYNTH-EVIDENCE-LICENSE-RENEWAL-001",
    ]);
    expect(snapshot.calendarEvents[0]?.alertIds).toEqual(
      alerts.map((alert) => alert.id),
    );
  });

  it("provides all six configurable audit instruments", () => {
    const templates = buildM31SyntheticSnapshot().auditTemplates;

    expect(new Set(templates.map((template) => template.category))).toEqual(
      new Set([
        "chart",
        "personnel",
        "facility",
        "billing",
        "privacy",
        "operational",
      ]),
    );
    expect(templates).toHaveLength(6);
    expect(
      templates.every(
        (template) =>
          template.configurable &&
          template.controls.every((control) => control.required),
      ),
    ).toBe(true);
  });

  it("routes by division and severity with deterministic due dates and escalation", () => {
    const routedAt = "2026-07-14T12:00:00.000Z";

    expect(routeM31Finding("BHC", "critical", routedAt)).toEqual({
      division: "BHC",
      severity: "critical",
      responsibleRole: "chart-auditor",
      responsibleTier: "T4",
      dueAt: "2026-07-15T12:00:00.000Z",
      escalationPath: [
        "clinical-supervisor",
        "bhc-director",
        "managing-director",
      ],
      escalationTiers: ["T3", "T2", "T1"],
    });
    expect(routeM31Finding("GAD", "moderate", routedAt).dueAt).toBe(
      "2026-07-28T12:00:00.000Z",
    );
    expect(routeM31Finding("EO", "low", routedAt).dueAt).toBe(
      "2026-08-13T12:00:00.000Z",
    );
  });

  it("enforces independent CAP verification, effectiveness, and closure", () => {
    const cap = buildM31SyntheticSnapshot().correctiveActionPlans.find(
      (item) => item.status === "closed",
    );

    expect(cap).toBeDefined();
    expect(cap?.rootCauseMethod).toBe("five_whys");
    expect(
      cap?.tasks.every(
        (task) => task.status === "completed" && task.evidenceIds.length > 0,
      ),
    ).toBe(true);
    expect(cap?.verification?.outcome).toBe("verified");
    expect(cap?.effectivenessReview?.outcome).toBe("effective");
    expect(cap?.closureApproval?.outcome).toBe("approved");
    expect(
      new Set([
        cap?.ownerId,
        cap?.verification?.actorId,
        cap?.closureApproval?.actorId,
      ]).size,
    ).toBe(3);
  });

  it("completes mock-survey operations and derived risk views", () => {
    const snapshot = buildM31SyntheticSnapshot();
    const survey = snapshot.mockSurveys[0];
    const enterprise = snapshot.riskViews.find(
      (view) => view.scope === "enterprise",
    );

    expect(survey).toMatchObject({
      status: "completed",
      readinessBand: "ready",
      readinessScore: 94,
    });
    expect(
      survey?.evidenceRequests.every(
        (request) => request.status === "fulfilled",
      ),
    ).toBe(true);
    expect(survey?.samples[0]?.selectedRecordIds).toHaveLength(
      survey?.samples[0]?.sampleSize ?? 0,
    );
    expect(enterprise).toMatchObject({
      overdueControls: 1,
      repeatFindings: 2,
      openCaps: 1,
      priorRiskScore: 100,
      riskScore: 95,
      riskTrend: "improving",
    });
    expect(
      snapshot.riskViews.filter((view) => view.scope === "division"),
    ).toHaveLength(4);
  });

  it("uses only canonical human roles and tier-ordered escalation paths", () => {
    const result = runM31SyntheticSuite();
    const canonical = new Set(ALL_ROLES);
    const humanRoles = [
      ...result.snapshot.calendarEvents.map((item) => item.controlOwnerRole),
      ...result.snapshot.alerts.flatMap((item) => [
        item.assignedRole,
        ...(item.escalationRole ? [item.escalationRole] : []),
      ]),
      ...result.snapshot.auditTemplates.map((item) => item.controlOwnerRole),
      ...result.snapshot.findings.flatMap((item) => [
        item.responsibleRole,
        ...item.escalationPath,
      ]),
      ...result.snapshot.correctiveActionPlans.flatMap((item) => [
        item.ownerRole,
        ...item.tasks.map((task) => task.assignedRole),
      ]),
      ...result.auditEvents
        .map((event) => event.actorRole)
        .filter((role): role is UserRole => role !== "system"),
    ];

    expect(humanRoles.every((role) => canonical.has(role))).toBe(true);
    expect(
      result.snapshot.findings.every(
        (finding) =>
          finding.escalationTiers[finding.escalationTiers.length - 1] === "T1",
      ),
    ).toBe(true);
    expect(() => assertM31CanonicalHumanRole("privacy-officer")).toThrowError(
      "M31_NONCANONICAL_ROLE:privacy-officer",
    );
  });

  it("freezes the audit ledger and includes every required action", () => {
    const events = buildM31AuditLedger();
    const actions = new Set(events.map((event) => event.action));

    expect(areM31AuditEventsImmutable(events)).toBe(true);
    expect(actions).toEqual(
      new Set([
        "access",
        "change",
        "approval",
        "disclosure",
        "export",
        "administrative_action",
        "routing",
        "gate_decision",
        "scenario",
      ]),
    );
    expect(() => {
      (events[0] as { reason: string }).reason = "tampered";
    }).toThrow(TypeError);
  });

  it("blocks every production or non-synthetic write request", () => {
    expect(() =>
      assertM31SyntheticWrite({
        environment: "evaluation",
        evidenceClass: "synthetic_demo",
        entityId: "SYNTH-M31-VALID",
        operation: "create",
      }),
    ).not.toThrow();
    expect(() =>
      assertM31SyntheticWrite({
        environment: "production",
        evidenceClass: "synthetic_demo",
        entityId: "SYNTH-M31-BLOCK",
        operation: "update",
      }),
    ).toThrow("M31_PRODUCTION_WRITE_BLOCKED");
    expect(() =>
      assertM31SyntheticWrite({
        environment: "evaluation",
        evidenceClass: "production",
        entityId: "SYNTH-M31-BLOCK",
        operation: "approve",
      }),
    ).toThrow("M31_PRODUCTION_WRITE_BLOCKED");
    expect(() =>
      assertM31SyntheticWrite({
        environment: "evaluation",
        evidenceClass: "synthetic_demo",
        entityId: "M31-LIVE-ID",
        operation: "export",
      }),
    ).toThrow("M31_PRODUCTION_WRITE_BLOCKED");
  });

  it("replays deterministically", () => {
    expect(runM31SyntheticSuite()).toEqual(runM31SyntheticSuite());
  });
});
