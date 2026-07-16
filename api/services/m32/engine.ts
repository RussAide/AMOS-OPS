import {
  assertPhase3Synthetic,
  changedPhase3Fields,
  type Phase3AuditAction,
  type Phase3AuditEvent,
} from "@contracts/phase3/shared";
import type {
  M32AgingDimension,
  M32AgingReport,
  M32ArItem,
  M32ApprovalDecision,
  M32ApprovalRequest,
  M32ClaimHandoffInput,
  M32ClaimLifecycleEvent,
  M32ClaimScenario,
  M32ClaimState,
  M32CloseControl,
  M32ConfigurationKind,
  M32DutyAssignment,
  M32EffectiveConfiguration,
  M32ExceptionRecord,
  M32HandoffRejectionCode,
  M32HandoffValidation,
  M32LedgerRow,
  M32RevenueMetric,
  M32Snapshot,
  M32SyntheticWriteRequest,
  M32SubmissionRow,
  M32VerifiedPhase2Lineage,
} from "@contracts/phase3/m32";
import { runPhase2IntegratedScenario } from "../phase2/integrated-scenario";

export const M32_FIXED_AS_OF = "2026-10-13T12:00:00.000Z";
export const M32_SCENARIO_CORRELATION_ID = "SYNTH-PHASE3-SUPPORT-001";

export const M32_ACCEPTED_CONFIGURATION_KEYS = Object.freeze({
  payerNaturalKey: "TX-MEDICAID",
  planNaturalKey: "SYNTH-STAR-PLAN",
  memberNaturalKey: "SYNTH-MEMBER-001",
  providerNaturalKey: "SYNTH-PROVIDER-001",
  contractNaturalKey: "BHC-TX-MEDICAID",
  T1017: Object.freeze({
    authorizationNaturalKey: "SYNTH-AUTH-T1017-001",
    feeNaturalKey: "TX-MEDICAID|T1017",
    serviceCodeNaturalKey: "T1017",
  }),
  H2017: Object.freeze({
    authorizationNaturalKey: "SYNTH-AUTH-H2017-001",
    feeNaturalKey: "TX-MEDICAID|H2017",
    serviceCodeNaturalKey: "H2017",
  }),
} as const);

export const M32_PHASE2_LINEAGE_LOCK = Object.freeze({
  T1017: Object.freeze({
    sourceMilestone: "M2.2",
    sourceScenarioId: "SCN-M22-001",
    phase2HandoffId: "M22-CLAIM-HANDOFF-0024",
    phase2EncounterId: "SYNTH-M22-ENC-001",
    phase2Status: "ready_for_revenue",
    phase2CaseId: "SYNTH-M22-CASE-001",
  }),
  H2017: Object.freeze({
    sourceMilestone: "M2.3",
    sourceScenarioId: "M23-SCENARIO-GROUP",
    phase2HandoffId: "M23-CLAIM-0002",
    phase2EncounterId: "SYNTH-M23-ENC-002",
    phase2Status: "ready_for_revenue",
    phase2CaseId: "M23-CASE-0002",
  }),
} as const);

let cachedPhase2Lineage: readonly M32VerifiedPhase2Lineage[] | undefined;

/**
 * Read the two revenue handoffs from the accepted Phase 2 exit run and lock
 * their source identities. Any upstream identity or readiness drift fails the
 * Phase 3 revenue suite instead of silently substituting a prefixed placeholder.
 */
export function deriveM32VerifiedPhase2Lineage(): readonly M32VerifiedPhase2Lineage[] {
  const phase2 = runPhase2IntegratedScenario();
  if (!phase2.exitGate || phase2.scenarioRun.status !== "passed") {
    throw new Error("M32_PHASE2_EXIT_NOT_ACCEPTED");
  }

  const m22 = phase2.milestoneEvidence.m22;
  const m23 = phase2.milestoneEvidence.m23;
  const m23Scenario = m23.scenarios.find(
    (scenario) => scenario.id === M32_PHASE2_LINEAGE_LOCK.H2017.sourceScenarioId,
  );
  const m23Handoff = m23.snapshot.claimHandoffs.find(
    (handoff) => handoff.sessionId === m23Scenario?.sessionId,
  );
  const m23Encounter = m23Handoff?.billingEvaluation.encounter;
  if (
    !m23Scenario
    || m23Scenario.procedureCode !== "H2017"
    || !m23Scenario.billingReady
    || m23Scenario.claimHandoffState !== "ready_for_revenue"
    || !m23Handoff
    || m23Handoff.state !== "ready_for_revenue"
    || !m23Encounter
    || m23Encounter.procedureCode !== "H2017"
    || m23Encounter.calculatedUnits === null
  ) {
    throw new Error("M32_PHASE2_H2017_NOT_READY");
  }

  const lineage = [
    {
      sourceMilestone: "M2.2",
      sourceScenarioId: m22.scenarioId,
      phase2ExitRunId: phase2.scenarioRun.id,
      phase2ExitStatus: phase2.scenarioRun.status,
      phase2EpisodeId: phase2.scenarioRun.episodeId,
      phase2CaseId: m22.claimHandoff.caseId,
      phase2HandoffId: m22.claimHandoff.id,
      phase2EncounterId: m22.claimHandoff.encounterId,
      phase2Status: m22.claimHandoff.status,
      program: "MHTCM",
      procedureCode: m22.claimHandoff.procedureCode,
      serviceDate: m22.claimHandoff.serviceDate,
      units: m22.claimHandoff.units,
      sourceCorrelationId: phase2.scenarioRun.id,
      verifiedFrom: "runPhase2IntegratedScenario",
      evidenceClass: "synthetic_demo",
    },
    {
      sourceMilestone: "M2.3",
      sourceScenarioId: m23Scenario.id,
      phase2ExitRunId: phase2.scenarioRun.id,
      phase2ExitStatus: phase2.scenarioRun.status,
      phase2EpisodeId: phase2.scenarioRun.episodeId,
      phase2CaseId: m23Handoff.caseId,
      phase2HandoffId: m23Handoff.id,
      phase2EncounterId: m23Encounter.encounterId,
      phase2Status: m23Handoff.state,
      program: "MHRS",
      procedureCode: "H2017",
      serviceDate: m23Encounter.serviceDate,
      units: m23Encounter.calculatedUnits,
      sourceCorrelationId: m23Scenario.correlationId,
      verifiedFrom: "runPhase2IntegratedScenario",
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M32VerifiedPhase2Lineage[];

  for (const item of lineage) {
    const expected = M32_PHASE2_LINEAGE_LOCK[item.procedureCode];
    const fields = Object.keys(expected) as (keyof typeof expected)[];
    if (fields.some((field) => item[field] !== expected[field])) {
      throw new Error(`M32_PHASE2_LINEAGE_DRIFT:${item.procedureCode}`);
    }
  }
  return deepFreeze(lineage);
}

function getM32VerifiedPhase2Lineage(): readonly M32VerifiedPhase2Lineage[] {
  cachedPhase2Lineage ??= deriveM32VerifiedPhase2Lineage();
  return cachedPhase2Lineage;
}

const REQUIRED_CONFIGURATION_KINDS: readonly M32ConfigurationKind[] = [
  "payer",
  "plan",
  "provider",
  "contract",
  "eligibility",
  "authorization",
  "fee",
  "service_code",
];

export const M32_REQUIRED_CLAIM_STATES: readonly M32ClaimState[] = [
  "generated",
  "edited",
  "batched",
  "submitted",
  "acknowledged",
  "rejected",
  "denied",
  "corrected",
  "resubmitted",
  "remitted",
  "paid",
  "posted",
  "reconciled",
];

export const M32_EXPECTED_CLAIM_PATH: readonly M32ClaimState[] = [
  "generated",
  "edited",
  "batched",
  "submitted",
  "acknowledged",
  "rejected",
  "corrected",
  "resubmitted",
  "acknowledged",
  "denied",
  "corrected",
  "resubmitted",
  "acknowledged",
  "remitted",
  "paid",
  "posted",
  "reconciled",
];

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error("M32_INVALID_EFFECTIVE_DATE");
  }
  return value;
}

export function assertM32SyntheticWrite(request: M32SyntheticWriteRequest): void {
  if (
    request.environment !== "evaluation"
    || request.evidenceClass !== "synthetic_demo"
    || !request.entityId.startsWith("SYNTH-")
  ) {
    throw new Error("M32_PRODUCTION_WRITE_BLOCKED");
  }
}

export function validateM32ConfigurationTimeline(configurations: readonly M32EffectiveConfiguration[]): void {
  const byKey = new Map<string, M32EffectiveConfiguration[]>();
  for (const configuration of configurations) {
    assertPhase3Synthetic(configuration);
    dateOnly(configuration.effectiveFrom);
    dateOnly(configuration.effectiveThrough);
    if (configuration.effectiveFrom > configuration.effectiveThrough) throw new Error("M32_INVALID_EFFECTIVE_RANGE");
    const key = `${configuration.kind}|${configuration.naturalKey}`;
    byKey.set(key, [...(byKey.get(key) ?? []), configuration]);
  }
  for (const records of byKey.values()) {
    const ordered = [...records].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
    ordered.forEach((record, index) => {
      const next = ordered[index + 1];
      if (next && next.effectiveFrom <= record.effectiveThrough) throw new Error("M32_CONFIGURATION_OVERLAP");
    });
  }
}

export function selectEffectiveM32Configuration(
  configurations: readonly M32EffectiveConfiguration[],
  kind: M32ConfigurationKind,
  serviceDate: string,
  naturalKey?: string,
): M32EffectiveConfiguration | undefined {
  dateOnly(serviceDate);
  const matches = configurations.filter((configuration) => (
    configuration.kind === kind
    && configuration.active
    && (!naturalKey || configuration.naturalKey === naturalKey)
    && configuration.effectiveFrom <= serviceDate
    && configuration.effectiveThrough >= serviceDate
  ));
  if (matches.length > 1) throw new Error("M32_CONFIGURATION_OVERLAP");
  return matches[0];
}

function buildConfigurations(): readonly M32EffectiveConfiguration[] {
  const configuration = (
    id: string,
    kind: M32ConfigurationKind,
    naturalKey: string,
    version: number,
    effectiveFrom: string,
    effectiveThrough: string,
    values: Readonly<Record<string, string | number | boolean>>,
  ): M32EffectiveConfiguration => ({
    id,
    kind,
    naturalKey,
    version,
    effectiveFrom,
    effectiveThrough,
    active: true,
    values,
    evidenceClass: "synthetic_demo",
  });

  const configurations = deepFreeze([
    configuration("SYNTH-M32-CONFIG-PAYER-001", "payer", "TX-MEDICAID", 1, "2026-01-01", "2026-12-31", { payerName: "Synthetic Texas Medicaid", enabled: true }),
    configuration("SYNTH-M32-CONFIG-PLAN-001", "plan", "SYNTH-STAR-PLAN", 1, "2026-01-01", "2026-12-31", { planName: "Synthetic STAR Behavioral Plan", payerNaturalKey: "TX-MEDICAID", enabled: true }),
    configuration("SYNTH-M32-CONFIG-PROVIDER-001", "provider", "SYNTH-PROVIDER-001", 1, "2026-01-01", "2026-12-31", { credential: "QMHP_CS", division: "BHC", credentialed: true }),
    configuration("SYNTH-M32-CONFIG-PROVIDER-UNCREDENTIALED", "provider", "SYNTH-PROVIDER-UNCREDENTIALED", 1, "2026-01-01", "2026-12-31", { credential: "QMHP_CS", division: "BHC", credentialed: false }),
    configuration("SYNTH-M32-CONFIG-CONTRACT-001", "contract", "BHC-TX-MEDICAID", 1, "2026-01-01", "2026-06-30", { payerNaturalKey: "TX-MEDICAID", planNaturalKey: "SYNTH-STAR-PLAN", division: "BHC", feePercent: 95 }),
    configuration("SYNTH-M32-CONFIG-CONTRACT-002", "contract", "BHC-TX-MEDICAID", 2, "2026-07-01", "2026-12-31", { payerNaturalKey: "TX-MEDICAID", planNaturalKey: "SYNTH-STAR-PLAN", division: "BHC", feePercent: 100 }),
    configuration("SYNTH-M32-CONFIG-ELIGIBILITY-001", "eligibility", "SYNTH-MEMBER-001", 1, "2026-01-01", "2026-12-31", { memberNaturalKey: "SYNTH-MEMBER-001", planNaturalKey: "SYNTH-STAR-PLAN", eligible: true }),
    configuration("SYNTH-M32-CONFIG-ELIGIBILITY-INELIGIBLE", "eligibility", "SYNTH-MEMBER-INELIGIBLE", 1, "2026-01-01", "2026-12-31", { memberNaturalKey: "SYNTH-MEMBER-INELIGIBLE", planNaturalKey: "SYNTH-STAR-PLAN", eligible: false }),
    configuration("SYNTH-M32-CONFIG-AUTH-T1017", "authorization", "SYNTH-AUTH-T1017-001", 1, "2026-07-01", "2026-12-31", { memberNaturalKey: "SYNTH-MEMBER-001", procedureCode: "T1017", authorized: true, authorizedUnits: 240 }),
    configuration("SYNTH-M32-CONFIG-AUTH-H2017", "authorization", "SYNTH-AUTH-H2017-001", 1, "2026-07-01", "2026-12-31", { memberNaturalKey: "SYNTH-MEMBER-001", procedureCode: "H2017", authorized: true, authorizedUnits: 360 }),
    configuration("SYNTH-M32-CONFIG-AUTH-H2017-DENIED", "authorization", "SYNTH-AUTH-H2017-DENIED", 1, "2026-07-01", "2026-12-31", { memberNaturalKey: "SYNTH-MEMBER-001", procedureCode: "H2017", authorized: false, authorizedUnits: 0 }),
    configuration("SYNTH-M32-CONFIG-FEE-T1017", "fee", "TX-MEDICAID|T1017", 1, "2026-07-01", "2026-12-31", { payerNaturalKey: "TX-MEDICAID", procedureCode: "T1017", unitFeeCents: 3200 }),
    configuration("SYNTH-M32-CONFIG-FEE-H2017", "fee", "TX-MEDICAID|H2017", 1, "2026-07-01", "2026-12-31", { payerNaturalKey: "TX-MEDICAID", procedureCode: "H2017", unitFeeCents: 2800 }),
    configuration("SYNTH-M32-CONFIG-CODE-T1017", "service_code", "T1017", 1, "2026-07-01", "2026-12-31", { procedureCode: "T1017", unitMinutes: 15, billable: true }),
    configuration("SYNTH-M32-CONFIG-CODE-H2017", "service_code", "H2017", 1, "2026-07-01", "2026-12-31", { procedureCode: "H2017", unitMinutes: 15, billable: true }),
    configuration("SYNTH-M32-CONFIG-CODE-H2017-NONBILLABLE", "service_code", "H2017-NONBILLABLE", 1, "2026-07-01", "2026-12-31", { procedureCode: "H2017", unitMinutes: 15, billable: false }),
  ] satisfies M32EffectiveConfiguration[]);
  validateM32ConfigurationTimeline(configurations);
  return configurations;
}

function relevantConfiguration(
  configurations: readonly M32EffectiveConfiguration[],
  kind: M32ConfigurationKind,
  handoff: M32ClaimHandoffInput,
): M32EffectiveConfiguration | undefined {
  const naturalKeyByKind: Record<M32ConfigurationKind, string> = {
    payer: handoff.payerNaturalKey,
    plan: handoff.planNaturalKey,
    provider: handoff.providerNaturalKey,
    contract: handoff.contractNaturalKey,
    eligibility: handoff.memberNaturalKey,
    authorization: handoff.authorizationNaturalKey,
    fee: handoff.feeNaturalKey,
    service_code: handoff.serviceCodeNaturalKey,
  };
  return selectEffectiveM32Configuration(
    configurations,
    kind,
    handoff.serviceDate,
    naturalKeyByKind[kind],
  );
}

export function validateM32ClaimHandoff(
  handoff: M32ClaimHandoffInput,
  configurations: readonly M32EffectiveConfiguration[],
  acceptedDuplicateKeys: ReadonlySet<string>,
): M32HandoffValidation {
  assertPhase3Synthetic(handoff);
  const rejectionCodes: M32HandoffRejectionCode[] = [];
  if (handoff.phase2Status !== "ready_for_revenue") rejectionCodes.push("PHASE2_HANDOFF_NOT_READY");
  if (acceptedDuplicateKeys.has(handoff.duplicateKey)) rejectionCodes.push("DUPLICATE_HANDOFF");
  if (!handoff.documented) rejectionCodes.push("DOCUMENTATION_INCOMPLETE");

  const selected = Object.fromEntries(
    REQUIRED_CONFIGURATION_KINDS.map((kind) => [
      kind,
      relevantConfiguration(configurations, kind, handoff),
    ]),
  ) as Partial<Record<M32ConfigurationKind, M32EffectiveConfiguration>>;
  const configurationIds = REQUIRED_CONFIGURATION_KINDS
    .map((kind) => selected[kind]?.id)
    .filter((id): id is string => Boolean(id));
  const eligible = selected.eligibility?.values.eligible === true;
  const authorized = selected.authorization?.values.authorized === true
    && selected.authorization.values.procedureCode === handoff.procedureCode
    && selected.authorization.values.memberNaturalKey === handoff.memberNaturalKey
    && Number(selected.authorization.values.authorizedUnits) >= handoff.units;
  const credentialed = selected.provider?.values.credentialed === true
    && selected.provider.values.division === handoff.division;
  const billable = selected.service_code?.values.billable === true
    && selected.service_code.values.procedureCode === handoff.procedureCode;
  const unitFeeCents = Number(selected.fee?.values.unitFeeCents);
  const chargeMatches = Number.isInteger(handoff.units)
    && handoff.units > 0
    && Number.isFinite(unitFeeCents)
    && unitFeeCents > 0
    && handoff.chargeCents === handoff.units * unitFeeCents;
  if (!eligible) rejectionCodes.push("ELIGIBILITY_MISSING");
  if (!authorized) rejectionCodes.push("AUTHORIZATION_MISSING");
  if (!credentialed) rejectionCodes.push("PROVIDER_NOT_CREDENTIALED");
  if (!billable) rejectionCodes.push("SERVICE_NOT_BILLABLE");
  if (!chargeMatches) rejectionCodes.push("CHARGE_MISMATCH");

  const relationshipsConsistent =
    selected.payer?.values.enabled === true
    && selected.plan?.values.enabled === true
    && selected.plan.values.payerNaturalKey === handoff.payerNaturalKey
    && selected.contract?.values.payerNaturalKey === handoff.payerNaturalKey
    && selected.contract.values.planNaturalKey === handoff.planNaturalKey
    && selected.contract.values.division === handoff.division
    && selected.eligibility?.values.memberNaturalKey === handoff.memberNaturalKey
    && selected.eligibility.values.planNaturalKey === handoff.planNaturalKey
    && selected.fee?.values.payerNaturalKey === handoff.payerNaturalKey
    && selected.fee.values.procedureCode === handoff.procedureCode;
  if (
    configurationIds.length !== REQUIRED_CONFIGURATION_KINDS.length
    || !relationshipsConsistent
  ) {
    rejectionCodes.push("CONFIGURATION_NOT_EFFECTIVE");
  }

  return deepFreeze({
    handoffId: handoff.id,
    accepted: rejectionCodes.length === 0,
    rejectionCodes: [...new Set(rejectionCodes)],
    configurationIds,
    decidedAt: "2026-07-14T14:00:00.000Z",
    evidenceClass: "synthetic_demo",
  });
}

function handoff(
  id: string,
  phase2Lineage: M32VerifiedPhase2Lineage,
  overrides: Partial<M32ClaimHandoffInput> = {},
): M32ClaimHandoffInput {
  const unitFeeCents = phase2Lineage.procedureCode === "T1017" ? 3_200 : 2_800;
  const codeKeys = M32_ACCEPTED_CONFIGURATION_KEYS[phase2Lineage.procedureCode];
  return {
    id,
    phase2HandoffId: phase2Lineage.phase2HandoffId,
    phase2EpisodeId: phase2Lineage.phase2EpisodeId,
    phase2EncounterId: phase2Lineage.phase2EncounterId,
    correlationId: M32_SCENARIO_CORRELATION_ID,
    division: "BHC",
    program: phase2Lineage.program,
    procedureCode: phase2Lineage.procedureCode,
    serviceDate: phase2Lineage.serviceDate,
    units: phase2Lineage.units,
    chargeCents: phase2Lineage.units * unitFeeCents,
    payerNaturalKey: M32_ACCEPTED_CONFIGURATION_KEYS.payerNaturalKey,
    planNaturalKey: M32_ACCEPTED_CONFIGURATION_KEYS.planNaturalKey,
    memberNaturalKey: M32_ACCEPTED_CONFIGURATION_KEYS.memberNaturalKey,
    providerNaturalKey: M32_ACCEPTED_CONFIGURATION_KEYS.providerNaturalKey,
    contractNaturalKey: M32_ACCEPTED_CONFIGURATION_KEYS.contractNaturalKey,
    authorizationNaturalKey: codeKeys.authorizationNaturalKey,
    feeNaturalKey: codeKeys.feeNaturalKey,
    serviceCodeNaturalKey: codeKeys.serviceCodeNaturalKey,
    phase2Status: phase2Lineage.phase2Status,
    phase2Lineage,
    documented: true,
    duplicateKey: `SYNTH-MEMBER-001|${phase2Lineage.procedureCode}|${phase2Lineage.serviceDate}|09:00`,
    evidenceClass: "synthetic_demo",
    ...overrides,
  };
}

function buildHandoffs(
  configurations: readonly M32EffectiveConfiguration[],
  phase2Lineage: readonly M32VerifiedPhase2Lineage[],
): {
  handoffs: readonly M32ClaimHandoffInput[];
  validations: readonly M32HandoffValidation[];
} {
  const t1017 = phase2Lineage.find((item) => item.procedureCode === "T1017");
  const h2017 = phase2Lineage.find((item) => item.procedureCode === "H2017");
  if (!t1017 || !h2017) throw new Error("M32_PHASE2_LINEAGE_INCOMPLETE");
  const handoffs = deepFreeze([
    handoff("SYNTH-M32-HANDOFF-T1017-READY", t1017),
    handoff("SYNTH-M32-HANDOFF-H2017-READY", h2017, { duplicateKey: "SYNTH-MEMBER-001|H2017|2026-07-10|11:00" }),
    handoff("SYNTH-M32-HANDOFF-BLOCKED", t1017, { phase2Status: "blocked", duplicateKey: "BLOCKED-001" }),
    handoff("SYNTH-M32-HANDOFF-DUPLICATE", t1017, { duplicateKey: "SYNTH-MEMBER-001|T1017|2026-07-10|09:00" }),
    handoff("SYNTH-M32-HANDOFF-INELIGIBLE", t1017, { memberNaturalKey: "SYNTH-MEMBER-INELIGIBLE", duplicateKey: "INELIGIBLE-001" }),
    handoff("SYNTH-M32-HANDOFF-UNAUTHORIZED", h2017, { authorizationNaturalKey: "SYNTH-AUTH-H2017-DENIED", duplicateKey: "UNAUTHORIZED-001" }),
    handoff("SYNTH-M32-HANDOFF-UNDOCUMENTED", t1017, { documented: false, duplicateKey: "UNDOCUMENTED-001" }),
    handoff("SYNTH-M32-HANDOFF-UNCREDENTIALED", h2017, { providerNaturalKey: "SYNTH-PROVIDER-UNCREDENTIALED", duplicateKey: "UNCREDENTIALED-001" }),
    handoff("SYNTH-M32-HANDOFF-NONBILLABLE", h2017, { serviceCodeNaturalKey: "H2017-NONBILLABLE", duplicateKey: "NONBILLABLE-001" }),
    handoff("SYNTH-M32-HANDOFF-CHARGE-MISMATCH", h2017, { chargeCents: 1, duplicateKey: "CHARGE-MISMATCH-001" }),
    handoff("SYNTH-M32-HANDOFF-NOCONFIG", t1017, { serviceDate: "2028-01-01", duplicateKey: "NOCONFIG-001" }),
  ] satisfies M32ClaimHandoffInput[]);
  const acceptedDuplicateKeys = new Set<string>();
  const validations = handoffs.map((item) => {
    const validation = validateM32ClaimHandoff(item, configurations, acceptedDuplicateKeys);
    if (validation.accepted) acceptedDuplicateKeys.add(item.duplicateKey);
    return validation;
  });
  return { handoffs, validations: deepFreeze(validations) };
}

function lifecycleEvent(
  claimId: string,
  sequence: number,
  state: M32ClaimState,
  occurredAt: string,
  reasonCode: string,
  actorId: string,
  actorRole: M32ClaimLifecycleEvent["actorRole"],
  amountCents?: number,
): M32ClaimLifecycleEvent {
  return {
    id: `SYNTH-M32-EVENT-${claimId.replace("SYNTH-M32-CLAIM-", "")}-${String(sequence).padStart(2, "0")}`,
    claimId,
    sequence,
    state,
    actorId,
    actorRole,
    occurredAt,
    reasonCode,
    ...(amountCents === undefined ? {} : { amountCents }),
    evidenceClass: "synthetic_demo",
  };
}

function buildClaimScenario(
  suffix: "T1017" | "H2017",
  handoff: M32ClaimHandoffInput,
  allowedAmountCents: number,
  paidAmountCents: number,
): M32ClaimScenario {
  const claimId = `SYNTH-M32-CLAIM-${suffix}-001`;
  const events = deepFreeze([
    lifecycleEvent(claimId, 1, "generated", "2026-07-14T15:00:00.000Z", "READY_HANDOFF_INGESTED", "SYNTH-BILLER-001", "billing-specialist"),
    lifecycleEvent(claimId, 2, "edited", "2026-07-14T15:10:00.000Z", "CONTROLLED_CLAIM_EDIT", "SYNTH-BILLER-001", "billing-specialist"),
    lifecycleEvent(claimId, 3, "batched", "2026-07-14T16:00:00.000Z", "BATCH_VALIDATED", "SYNTH-REVENUE-MANAGER-001", "revenue-cycle-manager"),
    lifecycleEvent(claimId, 4, "submitted", "2026-07-14T16:05:00.000Z", "INITIAL_SUBMISSION", "SYNTH-REVENUE-MANAGER-001", "revenue-cycle-manager"),
    lifecycleEvent(claimId, 5, "acknowledged", "2026-07-14T16:06:00.000Z", "CLEARINGHOUSE_RECEIVED", "SYNTH-CLEARINGHOUSE-001", "system"),
    lifecycleEvent(claimId, 6, "rejected", "2026-07-14T16:07:00.000Z", "SYNTHETIC_FORMAT_REJECTION", "SYNTH-CLEARINGHOUSE-001", "system"),
    lifecycleEvent(claimId, 7, "corrected", "2026-07-14T16:30:00.000Z", "FORMAT_CORRECTED", "SYNTH-BILLER-001", "billing-specialist"),
    lifecycleEvent(claimId, 8, "resubmitted", "2026-07-14T16:35:00.000Z", "CORRECTED_RESUBMISSION", "SYNTH-REVENUE-MANAGER-001", "revenue-cycle-manager"),
    lifecycleEvent(claimId, 9, "acknowledged", "2026-07-14T16:36:00.000Z", "PAYER_ACCEPTED", "SYNTH-PAYER-001", "system"),
    lifecycleEvent(claimId, 10, "denied", "2026-07-16T10:00:00.000Z", "SYNTHETIC_AUTH_MATCH_DENIAL", "SYNTH-PAYER-001", "system"),
    lifecycleEvent(claimId, 11, "corrected", "2026-07-16T11:00:00.000Z", "AUTH_REFERENCE_CORRECTED", "SYNTH-BILLER-001", "billing-specialist"),
    lifecycleEvent(claimId, 12, "resubmitted", "2026-07-16T11:05:00.000Z", "DENIAL_CORRECTION_RESUBMITTED", "SYNTH-REVENUE-MANAGER-001", "revenue-cycle-manager"),
    lifecycleEvent(claimId, 13, "acknowledged", "2026-07-16T11:06:00.000Z", "PAYER_ACCEPTED_CORRECTION", "SYNTH-PAYER-001", "system"),
    lifecycleEvent(claimId, 14, "remitted", "2026-07-25T10:00:00.000Z", "REMIT_RECEIVED", "SYNTH-PAYER-001", "system", allowedAmountCents),
    lifecycleEvent(claimId, 15, "paid", "2026-07-25T10:01:00.000Z", "PAYMENT_WITH_VARIANCE", "SYNTH-PAYER-001", "system", paidAmountCents),
    lifecycleEvent(claimId, 16, "posted", "2026-07-25T11:00:00.000Z", "PAYMENT_POSTED", "SYNTH-PAYMENT-POSTER-001", "billing-specialist", paidAmountCents),
    lifecycleEvent(claimId, 17, "reconciled", "2026-07-31T16:00:00.000Z", "LEDGER_RECONCILED", "SYNTH-CONTROLLER-001", "revenue-cycle-manager", paidAmountCents),
  ]);
  return deepFreeze({
    id: `SYNTH-M32-SCENARIO-${suffix}-001`,
    claimId,
    handoffId: handoff.id,
    phase2HandoffId: handoff.phase2HandoffId,
    phase2EpisodeId: handoff.phase2EpisodeId,
    phase2EncounterId: handoff.phase2EncounterId,
    phase2Status: "ready_for_revenue",
    phase2Lineage: handoff.phase2Lineage,
    program: suffix === "T1017" ? "MHTCM" : "MHRS",
    procedureCode: suffix,
    billedAmountCents: handoff.chargeCents,
    allowedAmountCents,
    paidAmountCents,
    paymentVarianceCents: paidAmountCents - allowedAmountCents,
    events,
    reconciled: true,
    evidenceClass: "synthetic_demo",
  });
}

function ageDays(serviceDate: string, asOf: string): number {
  const start = Date.parse(`${serviceDate}T00:00:00.000Z`);
  const end = Date.parse(asOf);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("M32_INVALID_AGING_RANGE");
  return Math.floor((end - start) / 86_400_000);
}

function dimensions(items: readonly M32ArItem[], key: (item: M32ArItem) => string): readonly M32AgingDimension[] {
  const totals = new Map<string, { count: number; balanceCents: number }>();
  for (const item of items) {
    const dimension = key(item);
    const current = totals.get(dimension) ?? { count: 0, balanceCents: 0 };
    totals.set(dimension, { count: current.count + 1, balanceCents: current.balanceCents + item.outstandingBalanceCents });
  }
  return [...totals].sort(([left], [right]) => left.localeCompare(right)).map(([dimension, value]) => ({ key: dimension, ...value }));
}

export function buildM32AgingReport(items: readonly M32ArItem[], asOf: string): M32AgingReport {
  const buckets = { "0_30": 0, "31_60": 0, "61_90": 0, over_90: 0 };
  for (const item of items) {
    const age = ageDays(item.serviceDate, asOf);
    const bucket = age <= 30 ? "0_30" : age <= 60 ? "31_60" : age <= 90 ? "61_90" : "over_90";
    buckets[bucket] += item.outstandingBalanceCents;
  }
  return deepFreeze({
    asOf,
    buckets,
    byPayer: dimensions(items, (item) => item.payerId),
    byService: dimensions(items, (item) => item.procedureCode),
    byDivision: dimensions(items, (item) => item.division),
    workItems: items,
  });
}

function buildArItems(): readonly M32ArItem[] {
  return deepFreeze([
    {
      id: "SYNTH-M32-AR-001", claimId: "SYNTH-M32-CLAIM-T1017-AR-001", payerId: "SYNTH-PAYER-001", procedureCode: "T1017", division: "BHC", serviceDate: "2026-09-20", outstandingBalanceCents: 9_600, ownerRole: "billing-specialist", queue: "routine_follow_up", escalationLevel: "none",
      notes: [{ id: "SYNTH-M32-AR-NOTE-001", authorRole: "billing-specialist", text: "Synthetic payer acknowledgement received; follow-up scheduled.", createdAt: "2026-10-01T10:00:00.000Z" }], evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M32-AR-002", claimId: "SYNTH-M32-CLAIM-H2017-AR-002", payerId: "SYNTH-PAYER-001", procedureCode: "H2017", division: "BHC", serviceDate: "2026-08-20", outstandingBalanceCents: 8_400, ownerRole: "billing-specialist", queue: "denial_resolution", escalationLevel: "manager",
      notes: [{ id: "SYNTH-M32-AR-NOTE-002", authorRole: "billing-specialist", text: "Synthetic denial correction submitted with authorization reference.", createdAt: "2026-10-02T10:00:00.000Z" }], evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M32-AR-003", claimId: "SYNTH-M32-CLAIM-T1017-AR-003", payerId: "SYNTH-PAYER-002", procedureCode: "T1017", division: "GRO", serviceDate: "2026-07-01", outstandingBalanceCents: 6_200, ownerRole: "revenue-cycle-manager", queue: "escalated_variance", escalationLevel: "executive",
      notes: [{ id: "SYNTH-M32-AR-NOTE-003", authorRole: "revenue-cycle-manager", text: "Synthetic payment variance escalated for contract review.", createdAt: "2026-10-10T10:00:00.000Z" }], evidenceClass: "synthetic_demo",
    },
  ] satisfies M32ArItem[]);
}

export interface M32MetricInputs {
  submissionRows: readonly M32SubmissionRow[];
  ledgerRows: readonly M32LedgerRow[];
  periodStart: string;
  periodEnd: string;
}

export function calculateM32RevenueMetrics(input: M32MetricInputs): readonly M32RevenueMetric[] {
  const start = Date.parse(`${dateOnly(input.periodStart)}T00:00:00.000Z`);
  const end = Date.parse(`${dateOnly(input.periodEnd)}T00:00:00.000Z`);
  if (end < start) throw new Error("M32_INVALID_METRIC_PERIOD");
  const endExclusive = end + 86_400_000;
  const periodDays = Math.floor((end - start) / 86_400_000) + 1;
  const inPeriod = (value: string) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < endExclusive;
  };
  for (const row of [...input.submissionRows, ...input.ledgerRows]) {
    assertPhase3Synthetic(row);
  }
  const submissions = input.submissionRows.filter(
    (row) => row.initialSubmission && !row.void && inPeriod(row.submittedAt),
  );
  const accepted = submissions.filter((row) => row.acceptedOnInitialSubmission);
  const grossChargeRows = input.ledgerRows.filter(
    (row) => row.entryType === "gross_charge" && !row.void && inPeriod(row.recordedAt),
  );
  const endingArRows = input.ledgerRows.filter(
    (row) => row.entryType === "ending_gross_ar"
      && !row.void
      && row.recordedAt.startsWith(input.periodEnd),
  );
  const grossChargesCents = grossChargeRows.reduce((total, row) => total + row.amountCents, 0);
  if (
    submissions.length === 0
    || grossChargesCents <= 0
    || endingArRows.length !== 1
    || endingArRows[0].amountCents < 0
  ) {
    throw new Error("M32_UNRECONCILED_METRIC_INPUT");
  }
  const endingGrossArCents = endingArRows[0].amountCents;
  const cleanClaimRate = (accepted.length / submissions.length) * 100;
  const averageDailyGrossCharges = grossChargesCents / periodDays;
  const daysInAr = endingGrossArCents / averageDailyGrossCharges;
  return deepFreeze([
    {
      id: "SYNTH-M32-METRIC-CLEAN-CLAIM-001",
      name: "clean_claim_rate",
      numerator: accepted.length,
      denominator: submissions.length,
      value: cleanClaimRate,
      operator: ">",
      target: 95,
      passed: cleanClaimRate > 95,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      definition: "Initial claims accepted without correction or rejection divided by non-void initial submissions, multiplied by 100.",
      sourceRecordIds: submissions.map((row) => row.id),
      sourceRowCount: submissions.length,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M32-METRIC-DAYS-AR-001",
      name: "days_in_ar",
      numerator: endingGrossArCents,
      denominator: averageDailyGrossCharges,
      value: daysInAr,
      operator: "<",
      target: 40,
      passed: daysInAr < 40,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      definition: "Ending gross accounts receivable divided by average daily gross charges for the fixed period.",
      sourceRecordIds: [...grossChargeRows.map((row) => row.id), endingArRows[0].id],
      sourceRowCount: grossChargeRows.length + 1,
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M32RevenueMetric[]);
}

export function buildM32MetricRows(): {
  submissionRows: readonly M32SubmissionRow[];
  ledgerRows: readonly M32LedgerRow[];
} {
  const submissionRows = [
    ...Array.from({ length: 100 }, (_, index): M32SubmissionRow => ({
      id: `SYNTH-M32-SUBMISSION-${String(index + 1).padStart(3, "0")}`,
      claimId: `SYNTH-M32-METRIC-CLAIM-${String(index + 1).padStart(3, "0")}`,
      submittedAt: "2026-09-15T12:00:00.000Z",
      initialSubmission: true,
      acceptedOnInitialSubmission: index < 97,
      void: false,
      evidenceClass: "synthetic_demo",
    })),
    {
      id: "SYNTH-M32-SUBMISSION-VOID",
      claimId: "SYNTH-M32-METRIC-CLAIM-VOID",
      submittedAt: "2026-09-15T12:00:00.000Z",
      initialSubmission: true,
      acceptedOnInitialSubmission: true,
      void: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M32-SUBMISSION-OUTSIDE-PERIOD",
      claimId: "SYNTH-M32-METRIC-CLAIM-OUTSIDE",
      submittedAt: "2026-08-31T12:00:00.000Z",
      initialSubmission: true,
      acceptedOnInitialSubmission: true,
      void: false,
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M32SubmissionRow[];
  const ledgerRows = [
    ...[1, 2, 3].map((sequence): M32LedgerRow => ({
      id: `SYNTH-M32-LEDGER-GROSS-CHARGE-${sequence}`,
      entryType: "gross_charge",
      amountCents: 10_000_000,
      recordedAt: `2026-09-${String(sequence * 7).padStart(2, "0")}T12:00:00.000Z`,
      void: false,
      evidenceClass: "synthetic_demo",
    })),
    {
      id: "SYNTH-M32-LEDGER-ENDING-AR-2026-09",
      entryType: "ending_gross_ar",
      amountCents: 38_000_000,
      recordedAt: "2026-09-30T23:59:59.000Z",
      void: false,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M32-LEDGER-VOID-CHARGE",
      entryType: "gross_charge",
      amountCents: 100_000_000,
      recordedAt: "2026-09-20T12:00:00.000Z",
      void: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M32-LEDGER-OUTSIDE-PERIOD",
      entryType: "gross_charge",
      amountCents: 100_000_000,
      recordedAt: "2026-08-31T12:00:00.000Z",
      void: false,
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M32LedgerRow[];
  return deepFreeze({ submissionRows, ledgerRows });
}

export function validateM32Segregation(assignments: readonly M32DutyAssignment[]): void {
  const required = ["generate", "submit", "post", "reconcile", "close"];
  if (!required.every((action) => assignments.some((assignment) => assignment.action === action))) throw new Error("M32_DUTY_MISSING");
  if (new Set(assignments.map((assignment) => assignment.actorId)).size !== assignments.length) throw new Error("M32_SEGREGATION_OF_DUTIES_VIOLATION");
}

export function evaluateM32ApprovalLimit(
  assignments: readonly M32DutyAssignment[],
  request: M32ApprovalRequest,
): M32ApprovalDecision {
  const assignment = assignments.find(
    (candidate) => candidate.action === request.action && candidate.actorId === request.actorId,
  );
  const base = {
    id: `SYNTH-M32-APPROVAL-${request.id.replace(/^SYNTH-/, "")}`,
    requestId: request.id,
    action: request.action,
    amountCents: request.amountCents,
    requestedBy: request.actorId,
    requestedByRole: assignment?.actorRole ?? null,
    approvalLimitCents: assignment?.approvalLimitCents ?? null,
    evidenceClass: "synthetic_demo" as const,
  };
  if (!Number.isFinite(request.amountCents) || request.amountCents <= 0) {
    return deepFreeze({
      ...base,
      outcome: "denied",
      approvedBy: null,
      approvedByRole: null,
      reasonCode: "INVALID_AMOUNT",
    });
  }
  if (!assignment) {
    return deepFreeze({
      ...base,
      outcome: "denied",
      approvedBy: null,
      approvedByRole: null,
      reasonCode: "ACTOR_NOT_ASSIGNED",
    });
  }
  if (
    assignment.approvalLimitCents === null
    || request.amountCents <= assignment.approvalLimitCents
  ) {
    return deepFreeze({
      ...base,
      outcome: "approved_within_limit",
      approvedBy: assignment.actorId,
      approvedByRole: assignment.actorRole,
      reasonCode: "WITHIN_ASSIGNED_LIMIT",
    });
  }
  const escalation = assignments.find(
    (candidate) => candidate.actorId === request.escalationApproverId
      && candidate.actorId !== assignment.actorId
      && candidate.action === "close"
      && candidate.actorRole === "managing-director"
      && (
        candidate.approvalLimitCents === null
        || candidate.approvalLimitCents >= request.amountCents
      ),
  );
  if (escalation) {
    return deepFreeze({
      ...base,
      outcome: "approved_by_escalation",
      approvedBy: escalation.actorId,
      approvedByRole: escalation.actorRole,
      reasonCode: "ESCALATION_APPROVED",
    });
  }
  return deepFreeze({
    ...base,
    outcome: "denied",
    approvedBy: null,
    approvedByRole: null,
    reasonCode: "AMOUNT_EXCEEDS_LIMIT",
  });
}

function buildGovernance(): {
  dutyAssignments: readonly M32DutyAssignment[];
  approvalDecisions: readonly M32ApprovalDecision[];
  exceptions: readonly M32ExceptionRecord[];
  closeControl: M32CloseControl;
} {
  const dutyAssignments = deepFreeze([
    { action: "generate", actorId: "SYNTH-BILLER-001", actorRole: "billing-specialist", approvalLimitCents: 100_000 },
    { action: "submit", actorId: "SYNTH-REVENUE-MANAGER-001", actorRole: "revenue-cycle-manager", approvalLimitCents: 2_500_000 },
    { action: "post", actorId: "SYNTH-PAYMENT-POSTER-001", actorRole: "billing-specialist", approvalLimitCents: 500_000 },
    { action: "reconcile", actorId: "SYNTH-CONTROLLER-001", actorRole: "revenue-cycle-manager", approvalLimitCents: null },
    { action: "close", actorId: "SYNTH-MANAGING-DIRECTOR-001", actorRole: "managing-director", approvalLimitCents: null },
  ] satisfies M32DutyAssignment[]);
  validateM32Segregation(dutyAssignments);
  const approvalDecisions = deepFreeze([
    evaluateM32ApprovalLimit(dutyAssignments, {
      id: "SYNTH-M32-REQUEST-SUBMIT-WITHIN",
      action: "submit",
      actorId: "SYNTH-REVENUE-MANAGER-001",
      amountCents: 1_000_000,
    }),
    evaluateM32ApprovalLimit(dutyAssignments, {
      id: "SYNTH-M32-REQUEST-SUBMIT-ESCALATED",
      action: "submit",
      actorId: "SYNTH-REVENUE-MANAGER-001",
      amountCents: 3_000_000,
      escalationApproverId: "SYNTH-MANAGING-DIRECTOR-001",
    }),
    evaluateM32ApprovalLimit(dutyAssignments, {
      id: "SYNTH-M32-REQUEST-SUBMIT-DENIED",
      action: "submit",
      actorId: "SYNTH-REVENUE-MANAGER-001",
      amountCents: 3_000_000,
    }),
    evaluateM32ApprovalLimit(dutyAssignments, {
      id: "SYNTH-M32-REQUEST-POST-WITHIN",
      action: "post",
      actorId: "SYNTH-PAYMENT-POSTER-001",
      amountCents: 400_000,
    }),
  ]);
  const exceptions = deepFreeze([
    { id: "SYNTH-M32-EXCEPTION-REJECTION", claimId: "SYNTH-M32-CLAIM-T1017-001", type: "submission_rejection", ownerRole: "billing-specialist", status: "resolved", resolution: "Corrected controlled format and resubmitted.", resolvedAt: "2026-07-14T16:35:00.000Z" },
    { id: "SYNTH-M32-EXCEPTION-DENIAL", claimId: "SYNTH-M32-CLAIM-H2017-001", type: "payer_denial", ownerRole: "billing-specialist", status: "resolved", resolution: "Matched authorization reference and resubmitted.", resolvedAt: "2026-07-16T11:05:00.000Z" },
    { id: "SYNTH-M32-EXCEPTION-VARIANCE", claimId: "SYNTH-M32-CLAIM-T1017-001", type: "payment_variance", ownerRole: "revenue-cycle-manager", status: "resolved", resolution: "Contractual variance documented and approved.", resolvedAt: "2026-07-31T15:00:00.000Z" },
    { id: "SYNTH-M32-EXCEPTION-LIMIT", claimId: "SYNTH-M32-CLAIM-H2017-001", type: "approval_limit", ownerRole: "revenue-cycle-manager", status: "resolved", resolution: "Escalated above submitter limit and independently approved.", resolvedAt: "2026-07-31T15:30:00.000Z" },
  ] satisfies M32ExceptionRecord[]);
  const closeControl = deepFreeze({
    id: "SYNTH-M32-CLOSE-2026-07",
    period: "2026-07",
    ledgerReconciled: true,
    exceptionsResolved: true,
    locked: true,
    reconciledBy: "SYNTH-CONTROLLER-001",
    approvedBy: "SYNTH-REVENUE-MANAGER-001",
    closedBy: "SYNTH-MANAGING-DIRECTOR-001",
    closedAt: "2026-07-31T17:00:00.000Z",
  } satisfies M32CloseControl);
  return { dutyAssignments, approvalDecisions, exceptions, closeControl };
}

function auditEvent(
  id: string,
  action: Phase3AuditAction,
  entityType: string,
  entityId: string,
  actorId: string,
  actorRole: Phase3AuditEvent["actorRole"],
  reason: string,
  occurredAt: string,
  before?: Readonly<Record<string, unknown>>,
  after?: Readonly<Record<string, unknown>>,
): Phase3AuditEvent {
  return deepFreeze({
    id,
    domain: "REVENUE",
    action,
    entityType,
    entityId,
    actorId,
    actorRole,
    reason,
    correlationId: M32_SCENARIO_CORRELATION_ID,
    before,
    after,
    changedFields: changedPhase3Fields(before, after),
    evidenceClass: "synthetic_demo",
    occurredAt,
  });
}

export function buildM32AuditLedger(scenarios: readonly M32ClaimScenario[]): readonly Phase3AuditEvent[] {
  const lifecycle = scenarios.flatMap((scenario) => scenario.events.map((event) => auditEvent(
    `SYNTH-M32-AUDIT-${scenario.procedureCode}-${String(event.sequence).padStart(2, "0")}`,
    event.state === "submitted" || event.state === "resubmitted" ? "gate_decision" : event.state === "reconciled" ? "approval" : "change",
    "claim",
    scenario.claimId,
    event.actorId,
    event.actorRole,
    event.reasonCode,
    event.occurredAt,
    event.sequence === 1 ? undefined : { priorSequence: event.sequence - 1 },
    { sequence: event.sequence, state: event.state, amountCents: event.amountCents },
  )));
  return deepFreeze([
    ...lifecycle,
    auditEvent("SYNTH-M32-AUDIT-GATE-BLOCK", "gate_decision", "claim_handoff", "SYNTH-M32-HANDOFF-UNDOCUMENTED", "SYNTH-SYSTEM-BILLING-GATE", "system", "DOCUMENTATION_INCOMPLETE prevented claim generation.", "2026-07-14T14:00:00.000Z"),
    auditEvent("SYNTH-M32-AUDIT-CLOSE", "approval", "revenue_period", "SYNTH-M32-CLOSE-2026-07", "SYNTH-MANAGING-DIRECTOR-001", "managing-director", "Closed reconciled synthetic revenue period after exception resolution.", "2026-07-31T17:00:00.000Z", { locked: false }, { locked: true }),
    auditEvent("SYNTH-M32-AUDIT-SCENARIO", "scenario", "m32_synthetic_suite", "SYNTH-M32-SUITE-001", "SYNTH-SYSTEM-SCENARIO", "system", "Executed deterministic M3.2 acceptance scenario.", M32_FIXED_AS_OF),
  ]);
}

export function areM32AuditEventsImmutable(events: readonly Phase3AuditEvent[]): boolean {
  return Object.isFrozen(events) && events.length > 0 && events.every((event) => Object.isFrozen(event));
}

export function buildM32SyntheticSnapshot(): M32Snapshot {
  const phase2Lineage = getM32VerifiedPhase2Lineage();
  const configurations = buildConfigurations();
  const { handoffs, validations: handoffValidations } = buildHandoffs(configurations, phase2Lineage);
  const t1017Handoff = handoffs.find((item) => item.id === "SYNTH-M32-HANDOFF-T1017-READY");
  const h2017Handoff = handoffs.find((item) => item.id === "SYNTH-M32-HANDOFF-H2017-READY");
  if (!t1017Handoff || !h2017Handoff) throw new Error("M32_ACCEPTED_HANDOFF_MISSING");
  const claimScenarios = deepFreeze([
    buildClaimScenario("T1017", t1017Handoff, 6_000, 5_800),
    buildClaimScenario("H2017", h2017Handoff, 5_200, 5_000),
  ]);
  const aging = buildM32AgingReport(buildArItems(), M32_FIXED_AS_OF);
  const { submissionRows, ledgerRows } = buildM32MetricRows();
  const metrics = calculateM32RevenueMetrics({
    submissionRows,
    ledgerRows,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
  });
  const { dutyAssignments, approvalDecisions, exceptions, closeControl } = buildGovernance();

  for (const item of [...configurations, ...handoffs, ...claimScenarios, ...aging.workItems, ...metrics]) {
    assertPhase3Synthetic(item);
  }
  for (const validation of handoffValidations) {
    assertPhase3Synthetic({ id: validation.handoffId, evidenceClass: validation.evidenceClass });
  }
  assertM32SyntheticWrite({ environment: "evaluation", evidenceClass: "synthetic_demo", entityId: "SYNTH-M32-SUITE-001", operation: "create" });

  return deepFreeze({
    fixedAsOf: M32_FIXED_AS_OF,
    phase2Lineage,
    configurations,
    handoffs,
    handoffValidations,
    claimScenarios,
    aging,
    metrics,
    submissionRows,
    ledgerRows,
    dutyAssignments,
    approvalDecisions,
    exceptions,
    closeControl,
    productionWritesBlocked: ["M32_PRODUCTION_WRITE_BLOCKED"],
  });
}

export function hasCompleteM32Lifecycle(scenario: M32ClaimScenario): boolean {
  return scenario.events.length === M32_EXPECTED_CLAIM_PATH.length
    && scenario.events.every((event, index) => (
      event.sequence === index + 1
      && event.claimId === scenario.claimId
      && event.state === M32_EXPECTED_CLAIM_PATH[index]
      && (index === 0 || event.occurredAt > scenario.events[index - 1].occurredAt)
    ));
}
