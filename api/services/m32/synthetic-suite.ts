import { M32_CRITERIA, type M32HandoffRejectionCode, type M32ModuleResult } from "@contracts/phase3/m32";
import {
  M32_PHASE2_LINEAGE_LOCK,
  areM32AuditEventsImmutable,
  buildM32AuditLedger,
  buildM32SyntheticSnapshot,
  hasCompleteM32Lifecycle,
  validateM32ConfigurationTimeline,
  validateM32Segregation,
} from "./engine";

const REQUIRED_REJECTIONS: readonly M32HandoffRejectionCode[] = [
  "PHASE2_HANDOFF_NOT_READY",
  "DUPLICATE_HANDOFF",
  "ELIGIBILITY_MISSING",
  "AUTHORIZATION_MISSING",
  "DOCUMENTATION_INCOMPLETE",
  "PROVIDER_NOT_CREDENTIALED",
  "SERVICE_NOT_BILLABLE",
  "CHARGE_MISMATCH",
  "CONFIGURATION_NOT_EFFECTIVE",
];

export function runM32SyntheticSuite(): M32ModuleResult {
  const snapshot = buildM32SyntheticSnapshot();
  const auditEvents = buildM32AuditLedger(snapshot.claimScenarios);
  const configurationKinds = new Set(snapshot.configurations.map((item) => item.kind));
  const accepted = snapshot.handoffValidations.filter((item) => item.accepted);
  const rejectedCodes = new Set(snapshot.handoffValidations.flatMap((item) => item.rejectionCodes));
  const cleanClaim = snapshot.metrics.find((metric) => metric.name === "clean_claim_rate");
  const daysAr = snapshot.metrics.find((metric) => metric.name === "days_in_ar");

  let timelineValid = true;
  let dutiesValid = true;
  try {
    validateM32ConfigurationTimeline(snapshot.configurations);
    validateM32Segregation(snapshot.dutyAssignments);
  } catch {
    timelineValid = false;
    dutiesValid = false;
  }

  const criteria = [
    {
      criterionId: "M3.2-01" as const,
      passed: timelineValid
        && ["payer", "plan", "provider", "contract", "eligibility", "authorization", "fee", "service_code"].every((kind) => configurationKinds.has(kind as never))
        && snapshot.configurations.every((item) => item.effectiveFrom <= item.effectiveThrough && item.version >= 1),
      summary: "Effective-dated, non-overlapping configuration covers every payer-to-service-code control layer.",
      evidence: { configurationIds: snapshot.configurations.map((item) => item.id), kinds: [...configurationKinds] },
    },
    {
      criterionId: "M3.2-02" as const,
      passed: accepted.length === 2
        && accepted.every((item) => item.configurationIds.length === 8)
        && snapshot.handoffs.slice(0, 2).every((item) => (
          item.payerNaturalKey === "TX-MEDICAID"
          && item.planNaturalKey === "SYNTH-STAR-PLAN"
          && item.memberNaturalKey === "SYNTH-MEMBER-001"
          && item.providerNaturalKey === "SYNTH-PROVIDER-001"
          && item.contractNaturalKey === "BHC-TX-MEDICAID"
          && item.authorizationNaturalKey.startsWith("SYNTH-AUTH-")
          && item.feeNaturalKey === `TX-MEDICAID|${item.procedureCode}`
          && item.serviceCodeNaturalKey === item.procedureCode
        ))
        && snapshot.phase2Lineage.length === 2
        && snapshot.phase2Lineage.every((item) => (
          item.phase2Status === "ready_for_revenue"
          && item.phase2ExitStatus === "passed"
          && item.verifiedFrom === "runPhase2IntegratedScenario"
        ))
        && snapshot.handoffs.some((item) => item.program === "MHTCM" && item.procedureCode === "T1017" && item.documented)
        && snapshot.handoffs.some((item) => item.program === "MHRS" && item.procedureCode === "H2017" && item.documented),
      summary: "MHTCM T1017 and MHRS H2017 documentation are validated before charge generation against all effective controls.",
      evidence: {
        acceptedHandoffIds: accepted.map((item) => item.handoffId),
        verifiedPhase2Lineage: snapshot.phase2Lineage,
      },
    },
    {
      criterionId: "M3.2-03" as const,
      passed: snapshot.claimScenarios.length === 2 && snapshot.claimScenarios.every(hasCompleteM32Lifecycle),
      summary: "Both representative claims execute generation, edit, batch, submit, acknowledgement, exceptions, remit, payment, posting, and reconciliation.",
      evidence: { claims: snapshot.claimScenarios.map((scenario) => ({ claimId: scenario.claimId, states: scenario.events.map((event) => event.state) })) },
    },
    {
      criterionId: "M3.2-04" as const,
      passed: Object.values(snapshot.aging.buckets).every(Number.isFinite)
        && snapshot.aging.byPayer.length >= 2
        && snapshot.aging.byService.length === 2
        && snapshot.aging.byDivision.length === 2
        && snapshot.aging.workItems.every((item) => item.ownerRole && item.queue && item.notes.length)
        && snapshot.aging.workItems.some((item) => item.escalationLevel === "executive"),
      summary: "AR aging supports payer, service, and division drill-down with queues, notes, owners, and escalation.",
      evidence: { asOf: snapshot.aging.asOf, buckets: snapshot.aging.buckets, workItemIds: snapshot.aging.workItems.map((item) => item.id) },
    },
    {
      criterionId: "M3.2-05" as const,
      passed: REQUIRED_REJECTIONS.every((code) => rejectedCodes.has(code))
        && snapshot.handoffValidations.filter((item) => !item.accepted).every((item) => item.rejectionCodes.length > 0),
      summary: "Fail-closed gates prevent blocked, duplicate, ineligible, unauthorized, undocumented, uncredentialed, non-billable, and unconfigured handoffs.",
      evidence: { rejectionCodes: [...rejectedCodes], rejectedHandoffIds: snapshot.handoffValidations.filter((item) => !item.accepted).map((item) => item.handoffId) },
    },
    {
      criterionId: "M3.2-06" as const,
      passed: Boolean(
        cleanClaim
        && daysAr
        && cleanClaim.value > 95
        && cleanClaim.operator === ">"
        && daysAr.value < 40
        && daysAr.operator === "<"
        && cleanClaim.sourceRowCount === 100
        && cleanClaim.sourceRecordIds.every((id) =>
          snapshot.submissionRows.some((row) => row.id === id && !row.void),
        )
        && daysAr.sourceRowCount === 4
        && daysAr.sourceRecordIds.every((id) =>
          snapshot.ledgerRows.some((row) => row.id === id && !row.void),
        )
        && snapshot.metrics.every((metric) => (
          metric.sourceRecordIds.length === metric.sourceRowCount
          && metric.definition.length > 20
        ))
      ),
      summary: "Reconciled definitions produce clean claim above 95% and days in AR below 40 using strict operators.",
      evidence: { metrics: snapshot.metrics },
    },
    {
      criterionId: "M3.2-07" as const,
      passed: dutiesValid
        && snapshot.dutyAssignments.some((item) => item.approvalLimitCents !== null)
        && snapshot.approvalDecisions.some((item) => item.outcome === "approved_within_limit")
        && snapshot.approvalDecisions.some((item) => item.outcome === "approved_by_escalation")
        && snapshot.approvalDecisions.some((item) => (
          item.outcome === "denied" && item.reasonCode === "AMOUNT_EXCEEDS_LIMIT"
        ))
        && snapshot.approvalDecisions
          .filter((item) => item.outcome === "approved_by_escalation")
          .every((item) => item.approvedBy !== item.requestedBy)
        && snapshot.exceptions.length === 4
        && snapshot.exceptions.every((item) => item.status === "resolved")
        && snapshot.closeControl.ledgerReconciled
        && snapshot.closeControl.exceptionsResolved
        && snapshot.closeControl.locked
        && new Set([snapshot.closeControl.reconciledBy, snapshot.closeControl.approvedBy, snapshot.closeControl.closedBy]).size === 3
        && areM32AuditEventsImmutable(auditEvents),
      summary: "Distinct actors, approval limits, immutable audit, resolved exceptions, reconciliation, and period lock enforce revenue governance.",
      evidence: {
        dutyAssignments: snapshot.dutyAssignments,
        approvalDecisions: snapshot.approvalDecisions,
        exceptionIds: snapshot.exceptions.map((item) => item.id),
        closeControl: snapshot.closeControl,
      },
    },
    {
      criterionId: "M3.2-08" as const,
      passed: snapshot.claimScenarios.length === 2
        && new Set(snapshot.claimScenarios.map((scenario) => scenario.procedureCode)).size === 2
        && snapshot.claimScenarios.every((scenario) => {
          const states = new Set(scenario.events.map((event) => event.state));
          const expected = M32_PHASE2_LINEAGE_LOCK[scenario.procedureCode];
          return scenario.phase2HandoffId === expected.phase2HandoffId
            && scenario.phase2EncounterId === expected.phase2EncounterId
            && scenario.phase2Status === expected.phase2Status
            && scenario.phase2Lineage.sourceScenarioId === expected.sourceScenarioId
            && scenario.phase2Lineage.phase2CaseId === expected.phase2CaseId
            && scenario.phase2Lineage.verifiedFrom === "runPhase2IntegratedScenario"
            && states.has("rejected")
            && states.has("denied")
            && states.has("corrected")
            && states.has("resubmitted")
            && states.has("paid")
            && scenario.paymentVarianceCents !== 0
            && scenario.reconciled;
        }),
      summary: "T1017 and H2017 each retain Phase 2 identity through rejection, denial, correction, resubmission, paid variance, and reconciliation.",
      evidence: {
        scenarios: snapshot.claimScenarios.map((scenario) => ({
          id: scenario.id,
          code: scenario.procedureCode,
          phase2HandoffId: scenario.phase2HandoffId,
          phase2EncounterId: scenario.phase2EncounterId,
          phase2Status: scenario.phase2Status,
          phase2Lineage: scenario.phase2Lineage,
          varianceCents: scenario.paymentVarianceCents,
        })),
      },
    },
  ];

  const exactCriteria = criteria.map((criterion) => criterion.criterionId);
  const passed = criteria.every((criterion) => criterion.passed)
    && exactCriteria.length === M32_CRITERIA.length
    && exactCriteria.every((criterion, index) => criterion === M32_CRITERIA[index]);

  return Object.freeze({
    milestone: "M3.2",
    domain: "REVENUE",
    evidenceClass: "synthetic_demo",
    passed,
    criteria: Object.freeze(criteria.map((criterion) => Object.freeze(criterion))),
    snapshot,
    auditEvents,
  });
}
