import { describe, expect, it } from "vitest";
import {
  M32_CRITERIA,
  type M32DutyAssignment,
  type M32EffectiveConfiguration,
  type M32LedgerRow,
  type M32SubmissionRow,
} from "@contracts/phase3/m32";
import {
  M32_EXPECTED_CLAIM_PATH,
  M32_REQUIRED_CLAIM_STATES,
  areM32AuditEventsImmutable,
  assertM32SyntheticWrite,
  buildM32AgingReport,
  buildM32AuditLedger,
  buildM32SyntheticSnapshot,
  calculateM32RevenueMetrics,
  evaluateM32ApprovalLimit,
  hasCompleteM32Lifecycle,
  runM32SyntheticSuite,
  selectEffectiveM32Configuration,
  validateM32ConfigurationTimeline,
  validateM32ClaimHandoff,
  validateM32Segregation,
} from "../services/m32";

describe("M3.2 revenue cycle synthetic module", () => {
  it("maps validation handoff identities through the synthetic boundary", () => {
    expect(() => buildM32SyntheticSnapshot()).not.toThrow();
    expect(buildM32SyntheticSnapshot().handoffValidations.every((validation) => (
      validation.handoffId.startsWith("SYNTH-") && validation.evidenceClass === "synthetic_demo"
    ))).toBe(true);
  });

  it("returns every exact acceptance criterion as passed", () => {
    const result = runM32SyntheticSuite();

    expect(result.milestone).toBe("M3.2");
    expect(result.domain).toBe("REVENUE");
    expect(result.evidenceClass).toBe("synthetic_demo");
    expect(result.passed).toBe(true);
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(M32_CRITERIA);
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
  });

  it("selects effective configurations and rejects overlaps", () => {
    const configurations = buildM32SyntheticSnapshot().configurations;
    const kinds = new Set(configurations.map((item) => item.kind));

    expect(kinds).toEqual(new Set(["payer", "plan", "provider", "contract", "eligibility", "authorization", "fee", "service_code"]));
    expect(selectEffectiveM32Configuration(configurations, "contract", "2026-06-15", "BHC-TX-MEDICAID")?.version).toBe(1);
    expect(selectEffectiveM32Configuration(configurations, "contract", "2026-07-15", "BHC-TX-MEDICAID")?.version).toBe(2);
    expect(selectEffectiveM32Configuration(configurations, "authorization", "2026-07-10", "SYNTH-AUTH-T1017-001")?.id).toBe("SYNTH-M32-CONFIG-AUTH-T1017");

    const current = configurations.find((item) => item.id === "SYNTH-M32-CONFIG-CONTRACT-002");
    expect(current).toBeDefined();
    const overlapping: M32EffectiveConfiguration = {
      ...(current as M32EffectiveConfiguration),
      id: "SYNTH-M32-CONFIG-CONTRACT-OVERLAP",
      effectiveFrom: "2026-07-15",
    };
    expect(() => validateM32ConfigurationTimeline([...configurations, overlapping])).toThrow("M32_CONFIGURATION_OVERLAP");
  });

  it("accepts only documented ready T1017 and H2017 handoffs", () => {
    const snapshot = buildM32SyntheticSnapshot();
    const accepted = snapshot.handoffValidations.filter((validation) => validation.accepted);
    const acceptedInputs = accepted.map((validation) => snapshot.handoffs.find((handoff) => handoff.id === validation.handoffId));

    expect(accepted).toHaveLength(2);
    expect(accepted.every((validation) => validation.configurationIds.length === 8)).toBe(true);
    expect(acceptedInputs.map((handoff) => [handoff?.program, handoff?.procedureCode])).toEqual([
      ["MHTCM", "T1017"],
      ["MHRS", "H2017"],
    ]);
    expect(acceptedInputs.map((handoff) => [
      handoff?.phase2HandoffId,
      handoff?.phase2EncounterId,
      handoff?.phase2Status,
    ])).toEqual([
      ["M22-CLAIM-HANDOFF-0024", "SYNTH-M22-ENC-001", "ready_for_revenue"],
      ["M23-CLAIM-0002", "SYNTH-M23-ENC-002", "ready_for_revenue"],
    ]);
    expect(acceptedInputs.map((handoff) => ({
      payer: handoff?.payerNaturalKey,
      plan: handoff?.planNaturalKey,
      member: handoff?.memberNaturalKey,
      provider: handoff?.providerNaturalKey,
      contract: handoff?.contractNaturalKey,
      authorization: handoff?.authorizationNaturalKey,
      fee: handoff?.feeNaturalKey,
      serviceCode: handoff?.serviceCodeNaturalKey,
    }))).toEqual([
      {
        payer: "TX-MEDICAID",
        plan: "SYNTH-STAR-PLAN",
        member: "SYNTH-MEMBER-001",
        provider: "SYNTH-PROVIDER-001",
        contract: "BHC-TX-MEDICAID",
        authorization: "SYNTH-AUTH-T1017-001",
        fee: "TX-MEDICAID|T1017",
        serviceCode: "T1017",
      },
      {
        payer: "TX-MEDICAID",
        plan: "SYNTH-STAR-PLAN",
        member: "SYNTH-MEMBER-001",
        provider: "SYNTH-PROVIDER-001",
        contract: "BHC-TX-MEDICAID",
        authorization: "SYNTH-AUTH-H2017-001",
        fee: "TX-MEDICAID|H2017",
        serviceCode: "H2017",
      },
    ]);
  });

  it("fails closed when exact configuration keys or documentation-to-charge math drift", () => {
    const snapshot = buildM32SyntheticSnapshot();
    const accepted = snapshot.handoffs[0];
    const missingPlan = validateM32ClaimHandoff(
      { ...accepted, id: "SYNTH-M32-KEY-MISMATCH", planNaturalKey: "SYNTH-UNKNOWN-PLAN" },
      snapshot.configurations,
      new Set(),
    );
    const wrongCharge = validateM32ClaimHandoff(
      { ...accepted, id: "SYNTH-M32-CHARGE-MISMATCH", chargeCents: accepted.chargeCents + 1 },
      snapshot.configurations,
      new Set(),
    );
    const invalidUnits = validateM32ClaimHandoff(
      { ...accepted, id: "SYNTH-M32-UNIT-MISMATCH", units: 0, chargeCents: 0 },
      snapshot.configurations,
      new Set(),
    );

    expect(missingPlan).toMatchObject({ accepted: false });
    expect(missingPlan.rejectionCodes).toContain("CONFIGURATION_NOT_EFFECTIVE");
    expect(wrongCharge.rejectionCodes).toContain("CHARGE_MISMATCH");
    expect(invalidUnits.rejectionCodes).toContain("CHARGE_MISMATCH");
  });

  it("fails closed for every prohibited handoff condition", () => {
    const rejectedCodes = new Set(
      buildM32SyntheticSnapshot().handoffValidations.flatMap((validation) => validation.rejectionCodes),
    );

    expect(rejectedCodes).toEqual(new Set([
      "PHASE2_HANDOFF_NOT_READY",
      "DUPLICATE_HANDOFF",
      "ELIGIBILITY_MISSING",
      "AUTHORIZATION_MISSING",
      "DOCUMENTATION_INCOMPLETE",
      "PROVIDER_NOT_CREDENTIALED",
      "SERVICE_NOT_BILLABLE",
      "CHARGE_MISMATCH",
      "CONFIGURATION_NOT_EFFECTIVE",
    ]));
  });

  it("executes complete T1017 and H2017 exception-to-payment lifecycles", () => {
    const scenarios = buildM32SyntheticSnapshot().claimScenarios;

    expect(scenarios.map((scenario) => scenario.procedureCode)).toEqual(["T1017", "H2017"]);
    for (const scenario of scenarios) {
      expect(hasCompleteM32Lifecycle(scenario)).toBe(true);
      expect(new Set(scenario.events.map((event) => event.state))).toEqual(new Set(M32_REQUIRED_CLAIM_STATES));
      expect(scenario.events.map((event) => event.state)).toEqual(M32_EXPECTED_CLAIM_PATH);
      expect(scenario.phase2HandoffId).toBe(
        scenario.procedureCode === "T1017" ? "M22-CLAIM-HANDOFF-0024" : "M23-CLAIM-0002",
      );
      expect(scenario.phase2EncounterId).toBe(
        scenario.procedureCode === "T1017" ? "SYNTH-M22-ENC-001" : "SYNTH-M23-ENC-002",
      );
      expect(scenario.phase2Status).toBe("ready_for_revenue");
      expect(scenario.phase2EpisodeId).toBe("SYNTH-PHASE2-EPISODE-001");
      expect(scenario.paymentVarianceCents).toBeLessThan(0);
      expect(scenario.reconciled).toBe(true);
    }
  });

  it("rejects a reordered, duplicated, or disconnected claim lifecycle", () => {
    const scenario = buildM32SyntheticSnapshot().claimScenarios[0];
    const reorderedEvents = [...scenario.events];
    [reorderedEvents[13], reorderedEvents[14]] = [reorderedEvents[14], reorderedEvents[13]];
    const duplicateEvents = scenario.events.map((event, index) => (
      index === 9 ? { ...event, state: "acknowledged" as const } : event
    ));
    const disconnectedEvents = scenario.events.map((event, index) => (
      index === 10 ? { ...event, claimId: "SYNTH-M32-OTHER-CLAIM" } : event
    ));

    expect(hasCompleteM32Lifecycle({ ...scenario, events: reorderedEvents })).toBe(false);
    expect(hasCompleteM32Lifecycle({ ...scenario, events: duplicateEvents })).toBe(false);
    expect(hasCompleteM32Lifecycle({ ...scenario, events: disconnectedEvents })).toBe(false);
  });

  it("calculates all aging buckets and operational drill-downs", () => {
    const aging = buildM32SyntheticSnapshot().aging;

    expect(aging.buckets).toEqual({ "0_30": 9_600, "31_60": 8_400, "61_90": 0, over_90: 6_200 });
    expect(aging.byPayer).toHaveLength(2);
    expect(aging.byService).toHaveLength(2);
    expect(aging.byDivision).toHaveLength(2);
    expect(aging.workItems.every((item) => item.ownerRole && item.notes.length > 0)).toBe(true);
    expect(aging.workItems.some((item) => item.escalationLevel === "executive")).toBe(true);
    expect(() => buildM32AgingReport(aging.workItems, "2026-01-01T00:00:00.000Z")).toThrow("M32_INVALID_AGING_RANGE");
  });

  it("uses strict reconciled clean-claim and days-in-AR thresholds", () => {
    const metrics = buildM32SyntheticSnapshot().metrics;
    const cleanClaim = metrics.find((metric) => metric.name === "clean_claim_rate");
    const daysAr = metrics.find((metric) => metric.name === "days_in_ar");

    expect(cleanClaim).toMatchObject({ value: 97, operator: ">", target: 95, passed: true, sourceRowCount: 100 });
    expect(daysAr).toMatchObject({ value: 38, operator: "<", target: 40, passed: true, sourceRowCount: 4 });

    const submissionRows: M32SubmissionRow[] = Array.from({ length: 100 }, (_, index) => ({
      id: `SYNTH-M32-BOUNDARY-SUBMISSION-${index + 1}`,
      claimId: `SYNTH-M32-BOUNDARY-CLAIM-${index + 1}`,
      submittedAt: "2026-09-15T12:00:00.000Z",
      initialSubmission: true,
      acceptedOnInitialSubmission: index < 95,
      void: false,
      evidenceClass: "synthetic_demo",
    }));
    const ledgerRows: M32LedgerRow[] = [
      {
        id: "SYNTH-M32-BOUNDARY-GROSS-CHARGES",
        entryType: "gross_charge",
        amountCents: 30_000,
        recordedAt: "2026-09-15T12:00:00.000Z",
        void: false,
        evidenceClass: "synthetic_demo",
      },
      {
        id: "SYNTH-M32-BOUNDARY-ENDING-AR",
        entryType: "ending_gross_ar",
        amountCents: 40_000,
        recordedAt: "2026-09-30T23:59:59.000Z",
        void: false,
        evidenceClass: "synthetic_demo",
      },
    ];

    const boundary = calculateM32RevenueMetrics({
      submissionRows,
      ledgerRows,
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
    });
    expect(boundary.find((metric) => metric.name === "clean_claim_rate")?.passed).toBe(false);
    expect(boundary.find((metric) => metric.name === "days_in_ar")?.passed).toBe(false);
    expect(() => calculateM32RevenueMetrics({
      submissionRows: [],
      ledgerRows: [],
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
    })).toThrow("M32_UNRECONCILED_METRIC_INPUT");
  });

  it("enforces segregation, approval limits, exception closure, and period lock", () => {
    const snapshot = buildM32SyntheticSnapshot();

    expect(() => validateM32Segregation(snapshot.dutyAssignments)).not.toThrow();
    expect(snapshot.dutyAssignments.filter((assignment) => assignment.approvalLimitCents !== null)).toHaveLength(3);
    expect(snapshot.approvalDecisions.map((decision) => decision.outcome)).toEqual([
      "approved_within_limit",
      "approved_by_escalation",
      "denied",
      "approved_within_limit",
    ]);
    expect(snapshot.exceptions.every((exception) => exception.status === "resolved")).toBe(true);
    expect(snapshot.closeControl).toMatchObject({ ledgerReconciled: true, exceptionsResolved: true, locked: true });
    expect(new Set([snapshot.closeControl.reconciledBy, snapshot.closeControl.approvedBy, snapshot.closeControl.closedBy]).size).toBe(3);

    const invalid: readonly M32DutyAssignment[] = snapshot.dutyAssignments.map((assignment) => ({
      ...assignment,
      actorId: assignment.action === "submit" ? "SYNTH-BILLER-001" : assignment.actorId,
    }));
    expect(() => validateM32Segregation(invalid)).toThrow("M32_SEGREGATION_OF_DUTIES_VIOLATION");

    expect(evaluateM32ApprovalLimit(snapshot.dutyAssignments, {
      id: "SYNTH-M32-APPROVAL-AT-LIMIT",
      action: "submit",
      actorId: "SYNTH-REVENUE-MANAGER-001",
      amountCents: 2_500_000,
    }).outcome).toBe("approved_within_limit");
    expect(evaluateM32ApprovalLimit(snapshot.dutyAssignments, {
      id: "SYNTH-M32-APPROVAL-ABOVE-LIMIT",
      action: "submit",
      actorId: "SYNTH-REVENUE-MANAGER-001",
      amountCents: 2_500_001,
    })).toMatchObject({ outcome: "denied", reasonCode: "AMOUNT_EXCEEDS_LIMIT" });
    expect(evaluateM32ApprovalLimit(snapshot.dutyAssignments, {
      id: "SYNTH-M32-APPROVAL-ESCALATED",
      action: "submit",
      actorId: "SYNTH-REVENUE-MANAGER-001",
      amountCents: 2_500_001,
      escalationApproverId: "SYNTH-MANAGING-DIRECTOR-001",
    })).toMatchObject({
      outcome: "approved_by_escalation",
      approvedBy: "SYNTH-MANAGING-DIRECTOR-001",
      reasonCode: "ESCALATION_APPROVED",
    });
  });

  it("freezes the revenue audit ledger and blocks production writes", () => {
    const snapshot = buildM32SyntheticSnapshot();
    const events = buildM32AuditLedger(snapshot.claimScenarios);

    expect(areM32AuditEventsImmutable(events)).toBe(true);
    expect(events.some((event) => event.action === "gate_decision" && event.entityId === "SYNTH-M32-HANDOFF-UNDOCUMENTED")).toBe(true);
    expect(() => {
      (events[0] as { reason: string }).reason = "tampered";
    }).toThrow(TypeError);

    expect(() => assertM32SyntheticWrite({ environment: "evaluation", evidenceClass: "synthetic_demo", entityId: "SYNTH-M32-VALID", operation: "submit" })).not.toThrow();
    expect(() => assertM32SyntheticWrite({ environment: "production", evidenceClass: "synthetic_demo", entityId: "SYNTH-M32-BLOCK", operation: "post" })).toThrow("M32_PRODUCTION_WRITE_BLOCKED");
    expect(() => assertM32SyntheticWrite({ environment: "evaluation", evidenceClass: "production", entityId: "SYNTH-M32-BLOCK", operation: "reconcile" })).toThrow("M32_PRODUCTION_WRITE_BLOCKED");
    expect(() => assertM32SyntheticWrite({ environment: "evaluation", evidenceClass: "synthetic_demo", entityId: "M32-LIVE-ID", operation: "close" })).toThrow("M32_PRODUCTION_WRITE_BLOCKED");
  });

  it("replays deterministically", () => {
    expect(runM32SyntheticSuite()).toEqual(runM32SyntheticSuite());
  });
});
