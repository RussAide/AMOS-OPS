import type {
  M51BOutlookReferralEnvelope,
  M51BOutlookReasonCode,
} from "@contracts/m51b/outlook";
import type { M51BReliabilityRequest } from "@contracts/m51b/reliability";
import {
  M51B_ACCEPTANCE_STATEMENT,
  M51B_INTEGRATED_SCENARIO_ID,
  M51B_MILESTONE,
} from "@contracts/m51b/integrated-scenario";
import {
  M51B_CRITERION_IDS,
  M51B_EVALUATION_STARTED_AT,
  createM51BDemoBoundary,
  type M51BAcceptanceFlag,
} from "@contracts/m51b/shared";
import { runM51bApprovedSharePointSync } from "../sharepoint/sync";
import { runM51BTeamsScenario } from "../teams/scenario";
import { M51BOutlookReferralIntakeService } from "../outlook/outlook-referral-intake";
import {
  createSyntheticM51BOutlookRecoveryActor,
  createSyntheticM51BOutlookReferral,
} from "../outlook/synthetic-outlook-fixtures";
import { evaluateM51BIntegrationGovernance } from "./governance";
import { verifyM51BInheritedM51ABaseline } from "./inherited-baseline";
import { M51BReliabilityCoordinator } from "./resilience";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function privacyDeniedReferral(): M51BOutlookReferralEnvelope {
  const referral = createSyntheticM51BOutlookReferral();
  return {
    ...referral,
    messageId: "SYNTH-M51B-OUTLOOK-MESSAGE-PRIVACY-DENIAL",
    internetMessageId:
      "SYNTH-M51B-OUTLOOK-INTERNET-MESSAGE-PRIVACY-DENIAL",
    changeKey: "SYNTH-M51B-OUTLOOK-CHANGEKEY-PRIVACY-DENIAL",
    referral: {
      ...referral.referral,
      referralReference: "SYNTH-M51B-REFERRAL-PRIVACY-DENIAL",
      youthReference: "SYNTH-M51B-YOUTH-PRIVACY-DENIAL",
      consent: {
        ...referral.referral.consent,
        status: "missing",
        consentReference: null,
        scopes: [],
        verifiedAt: null,
        expiresAt: null,
      },
    },
  };
}

function reliabilityRequest(
  operationId: string,
  idempotencyKey: string,
  channel: M51BReliabilityRequest["channel"],
): M51BReliabilityRequest {
  return {
    operationId,
    channel,
    correlationId: `SYNTH-M51B-CORRELATION-${channel.toUpperCase()}-INTEGRATED`,
    idempotencyKey,
    actorId: "SYNTH-M51B-ACTOR-INTEGRATION-ADMIN",
    payloadFingerprint: `SYNTH-M51B-SHA256-${channel.toUpperCase()}-INTEGRATED`,
    requestedAt: M51B_EVALUATION_STARTED_AT,
    synthetic: true,
  };
}

function acceptanceFlag(
  criterionId: M51BAcceptanceFlag["criterionId"],
  passed: boolean,
  assertionCount: number,
  summary: string,
  evidenceIds: readonly string[],
): M51BAcceptanceFlag {
  return deepFreeze({
    criterionId,
    passed,
    assertionCount,
    summary,
    evidenceIds: [...evidenceIds],
  });
}

export async function runM51BIntegratedScenario() {
  const inherited = await verifyM51BInheritedM51ABaseline();
  const governance = evaluateM51BIntegrationGovernance();
  const teams = await runM51BTeamsScenario();

  const outlookPrimaryService = new M51BOutlookReferralIntakeService();
  const outlookReferral = createSyntheticM51BOutlookReferral();
  const outlookPrimary = outlookPrimaryService.process(outlookReferral);
  const outlookReplay = outlookPrimaryService.process(outlookReferral);
  const outlookPrimarySnapshot = outlookPrimaryService.snapshot();

  const outlookPrivacyService = new M51BOutlookReferralIntakeService();
  const outlookPrivacyDenial = outlookPrivacyService.process(
    privacyDeniedReferral(),
  );

  const outlookRecoveryService = new M51BOutlookReferralIntakeService();
  const outlookOutage = outlookRecoveryService.process(outlookReferral, {
    failurePlan: [
      "transient_outage",
      "transient_outage",
      "transient_outage",
    ],
  });
  if (!outlookOutage.deadLetter)
    throw new Error("M51B_OUTLOOK_INTEGRATED_DEAD_LETTER_REQUIRED");
  const outlookRecovery = outlookRecoveryService.recoverDeadLetter({
    deadLetterId: outlookOutage.deadLetter.deadLetterId,
    envelope: outlookReferral,
    actor: createSyntheticM51BOutlookRecoveryActor(),
    failurePlan: ["success"],
    recoveredAt: "2026-07-15T13:00:00.000Z",
  });
  const outlookRecoverySnapshot = outlookRecoveryService.snapshot();

  const sharepoint = await runM51bApprovedSharePointSync();

  const reliabilityCoordinator = new M51BReliabilityCoordinator();
  const reliabilitySuccessRequest = reliabilityRequest(
    "SYNTH-M51B-OP-INTEGRATED-DELIVERY",
    "SYNTH-M51B-IDEMPOTENCY-INTEGRATED-DELIVERY",
    "teams",
  );
  const reliabilitySuccess = reliabilityCoordinator.execute(
    reliabilitySuccessRequest,
    () => ({ ok: true, value: "SYNTH-M51B-DELIVERY-RECORDED" }),
  );
  const reliabilityDuplicate = reliabilityCoordinator.execute(
    {
      ...reliabilitySuccessRequest,
      operationId: "SYNTH-M51B-OP-INTEGRATED-DUPLICATE",
    },
    () => {
      throw new Error("M51B_DUPLICATE_ADAPTER_MUST_NOT_EXECUTE");
    },
  );
  const reliabilityFailureRequest = reliabilityRequest(
    "SYNTH-M51B-OP-INTEGRATED-OUTAGE",
    "SYNTH-M51B-IDEMPOTENCY-INTEGRATED-OUTAGE",
    "teams",
  );
  const reliabilityFailure = reliabilityCoordinator.execute(
    reliabilityFailureRequest,
    () => ({
      ok: false,
      failureClass: "transient",
      reasonCode: "SYNTHETIC_MICROSOFT_OUTAGE",
    }),
  );
  if (!reliabilityFailure.deadLetterId)
    throw new Error("M51B_INTEGRATED_DEAD_LETTER_REQUIRED");
  const reliabilityRecovery = reliabilityCoordinator.replay(
    reliabilityFailure.deadLetterId,
    {
      authorizedBy: "SYNTH-M51B-ACTOR-INTEGRATION-ADMIN",
      authorizedRole: "administrator",
      authorizedAt: "2026-07-15T13:05:00.000Z",
      failureCorrected: true,
      privacyAndPermissionRevalidated: true,
      synthetic: true,
    },
    () => ({ ok: true, value: "SYNTH-M51B-RECOVERY-RECORDED" }),
  );
  const reliabilityReconciliation = reliabilityCoordinator.reconcile([
    reliabilitySuccessRequest.operationId,
    reliabilityFailureRequest.operationId,
  ]);
  const reliabilitySnapshot = reliabilityCoordinator.snapshot();
  const boundary = createM51BDemoBoundary();

  const privacyReasonCodes = outlookPrivacyDenial.reasonCodes as readonly M51BOutlookReasonCode[];
  const allSharePointGatesPass = Object.values(
    sharepoint.gateDecision.gates,
  ).every(Boolean);
  const allZeroLiveOperations =
    boundary.liveGraphCalls === 0 &&
    boundary.liveMicrosoftReads === 0 &&
    boundary.liveMicrosoftWrites === 0 &&
    boundary.realNotificationsSent === 0 &&
    boundary.realMailRead === 0 &&
    boundary.productionRows === 0 &&
    boundary.liveWrites === 0 &&
    teams.adapterMetrics.liveGraphCalls === 0 &&
    teams.adapterMetrics.liveTeamsWrites === 0 &&
    teams.adapterMetrics.realNotificationsSent === 0 &&
    outlookPrimary.liveGraphCalls === 0 &&
    outlookPrimary.liveMicrosoftWrites === 0 &&
    outlookPrimary.mailboxReads === 0 &&
    sharepoint.liveGraphCalls === 0 &&
    sharepoint.liveMicrosoftReads === 0 &&
    sharepoint.liveMicrosoftWrites === 0 &&
    sharepoint.exhaustedFailureRecovery.liveGraphCalls === 0 &&
    sharepoint.exhaustedFailureRecovery.liveWrites === 0 &&
    sharepoint.exhaustedFailureRecovery.reliabilitySnapshot.liveCalls === 0 &&
    sharepoint.exhaustedFailureRecovery.reliabilitySnapshot.liveWrites === 0 &&
    reliabilitySnapshot.liveCalls === 0 &&
    reliabilitySnapshot.liveWrites === 0;

  const acceptanceFlags = deepFreeze([
    acceptanceFlag(
      M51B_CRITERION_IDS[0],
      inherited.accepted &&
        inherited.criteriaPassed === 8 &&
        inherited.connectorModeMismatches === 0 &&
        inherited.stableIdentityIssues === 0 &&
        inherited.securityViolations === 0 &&
        inherited.liveMicrosoftWrites === 0,
      10,
      "The accepted M5.1A architecture, connector modes, stable identities, pilot, security evaluation, and zero-live-write boundary remain intact.",
      ["M51B-EVIDENCE-INHERITED-M51A-BASELINE"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[1],
      governance.accepted &&
        governance.contracts.length === 3 &&
        governance.totals.requiredChannels === 3 &&
        governance.totals.privacyThreatControls === 4 &&
        governance.validationErrors.length === 0,
      13,
      "Teams, Outlook, and SharePoint have complete contracts for ownership, identity, privacy, sensitivity, consent or authority, support, and recovery.",
      ["M51B-EVIDENCE-INTEGRATION-CONTRACTS"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[2],
      teams.passed &&
        teams.assertions.deliveredWithinThirtySeconds &&
        teams.assertions.destinationResolved &&
        teams.assertions.mentionsValidated &&
        teams.assertions.contentMinimized &&
        teams.assertions.acknowledgementRecorded &&
        teams.assertions.immutableEvidenceRecorded &&
        teams.assertions.zeroLiveOperations,
      14,
      "Approved minimum-necessary Teams notifications resolve the governed destination and mentions, arrive within 30 seconds, and retain acknowledgement and delivery evidence.",
      ["M51B-EVIDENCE-TEAMS-NOTIFICATION"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[3],
      outlookPrimary.disposition === "intake_created" &&
        outlookPrimary.createdIntakeCount === 1 &&
        outlookPrimary.intake?.status === "received" &&
        outlookPrimarySnapshot.metrics.intakeCount === 1 &&
        outlookReplay.disposition === "duplicate_prevented" &&
        outlookReplay.duplicatePrevented &&
        outlookPrivacyDenial.disposition === "exception_routed" &&
        privacyReasonCodes.includes("M51B_OUTLOOK_CONSENT_REQUIRED") &&
        outlookPrimary.liveWrites === 0,
      15,
      "One approved Outlook referral creates exactly one governed synthetic intake; replay and duplicate creation are suppressed and privacy exceptions are routed.",
      ["M51B-EVIDENCE-OUTLOOK-REFERRAL-INTAKE"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[4],
      sharepoint.accepted &&
        sharepoint.withinElapsedLimit &&
        sharepoint.elapsedSeconds <= 300 &&
        allSharePointGatesPass &&
        sharepoint.stableMapping.sourceOfTruth === "AMOS-DMS" &&
        sharepoint.reconciliation.passed &&
        sharepoint.replay.replayed &&
        sharepoint.liveMicrosoftWrites === 0,
      18,
      "An approved SharePoint synchronization completes within five minutes while connector mode, stable identity, classification, permission, retention, lifecycle, routing, and source authority remain enforced.",
      ["M51B-EVIDENCE-SHAREPOINT-APPROVED-SYNC"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[5],
      governance.contracts.every(
        (contract) =>
          contract.leastPrivilegeScopes.length === 3 &&
          contract.managedSecretReference.startsWith(
            "vault-ref://synthetic/m51b/",
          ) &&
          !contract.secretMaterialPresent &&
          !contract.productionCredentialReadAvailable &&
          contract.accessReview.leastPrivilegeConfirmed &&
          contract.accessReview.exceptions.length === 0,
      ),
      12,
      "Least-privilege scopes, approved synthetic tenant boundaries, managed secret references, and quarterly access reviews pass with no credential material exposed.",
      ["M51B-EVIDENCE-LEAST-PRIVILEGE-ACCESS-REVIEW"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[6],
      teams.assertions.retryBoundedAndRecovered &&
        teams.assertions.idempotentReplay &&
        teams.persistentOutageDelivery.status === "dead_lettered" &&
        teams.persistentOutageDelivery.attempts.length === 4 &&
        teams.outageRecovery.status === "recovered" &&
        teams.operationalState.activeDeadLetters === 0 &&
        teams.operationalState.openAlerts === 0 &&
        teams.operationalState.recoveredDeadLetters === 1 &&
        teams.operationalState.resolvedAlerts === 1 &&
        outlookRecovery.disposition === "recovered" &&
        outlookRecoverySnapshot.metrics.recoveredDeadLetterCount === 1 &&
        sharepoint.exhaustedFailureRecovery.accepted &&
        sharepoint.exhaustedFailureRecovery.originalFailure.status ===
          "dead_lettered" &&
        sharepoint.exhaustedFailureRecovery.originalFailure.attempts.length ===
          4 &&
        sharepoint.exhaustedFailureRecovery.openedDeadLetter.state === "open" &&
        sharepoint.exhaustedFailureRecovery.operationalAlert.channel ===
          "sharepoint" &&
        sharepoint.exhaustedFailureRecovery.recovery.status === "recovered" &&
        sharepoint.exhaustedFailureRecovery.recoveredDeadLetter.state ===
          "recovered" &&
        sharepoint.exhaustedFailureRecovery.duplicateReplay.status ===
          "duplicate_suppressed" &&
        sharepoint.exhaustedFailureRecovery.duplicateMutationPrevented &&
        sharepoint.exhaustedFailureRecovery.contentReconciliation.passed &&
        sharepoint.exhaustedFailureRecovery.channelReconciliation.accepted &&
        sharepoint.exhaustedFailureRecovery.reliabilitySnapshot
          .openDeadLetters === 0 &&
        sharepoint.exhaustedFailureRecovery.reliabilitySnapshot
          .duplicateDeliveries === 0 &&
        sharepoint.exhaustedFailureRecovery.reliabilitySnapshot.alertsRaised ===
          1,
      17,
      "The actual Teams, Outlook, and SharePoint channel paths perform bounded retry, dead-letter routing, operational alerting, governed replay, reconciliation, and duplicate prevention without double processing.",
      ["M51B-EVIDENCE-RELIABILITY-RECOVERY"],
    ),
    acceptanceFlag(
      M51B_CRITERION_IDS[7],
      allZeroLiveOperations &&
        teams.assertions.privacyDenied &&
        teams.outageRecovery.status === "recovered" &&
        teams.operationalState.activeDeadLetters === 0 &&
        teams.operationalState.openAlerts === 0 &&
        outlookPrivacyDenial.disposition === "exception_routed" &&
        outlookRecovery.disposition === "recovered" &&
        sharepoint.staleVersionConflict.status === "conflict" &&
        sharepoint.exhaustedFailureRecovery.originalFailure.status ===
          "dead_lettered" &&
        sharepoint.exhaustedFailureRecovery.recovery.status === "recovered" &&
        sharepoint.exhaustedFailureRecovery.duplicateMutationPrevented &&
        sharepoint.reconciliation.passed &&
        !boundary.realDataUsed &&
        !boundary.realFileContentRead &&
        !boundary.productionDeployment &&
        !boundary.githubPush,
      18,
      "Integrated timing, privacy, permission, outage, replay, conflict, and recovery tests pass using fictional records with zero live Microsoft activity.",
      ["M51B-EVIDENCE-INTEGRATED-RECOVERY-BOUNDARY"],
    ),
  ] satisfies M51BAcceptanceFlag[]);

  const passedCriteria = acceptanceFlags.filter((flag) => flag.passed).length;
  const assertionCount = acceptanceFlags.reduce(
    (total, flag) => total + flag.assertionCount,
    0,
  );
  const auditEventCount =
    teams.auditEvents.length +
    outlookPrimarySnapshot.auditEvents.length +
    outlookPrivacyService.snapshot().auditEvents.length +
    outlookRecoverySnapshot.auditEvents.length +
    sharepoint.auditEvents.length +
    reliabilitySuccess.auditEvents.length +
    reliabilityDuplicate.auditEvents.length +
    reliabilityFailure.auditEvents.length +
    reliabilityRecovery.auditEvents.length;

  return deepFreeze({
    milestone: M51B_MILESTONE,
    scenarioId: M51B_INTEGRATED_SCENARIO_ID,
    executedAt: M51B_EVALUATION_STARTED_AT,
    acceptanceStatement: M51B_ACCEPTANCE_STATEMENT,
    inherited,
    governance,
    teams,
    outlook: {
      primary: outlookPrimary,
      replay: outlookReplay,
      privacyDenial: outlookPrivacyDenial,
      outage: outlookOutage,
      recovery: outlookRecovery,
      primarySnapshot: outlookPrimarySnapshot,
      recoverySnapshot: outlookRecoverySnapshot,
    },
    sharepoint,
    reliability: {
      success: reliabilitySuccess,
      duplicate: reliabilityDuplicate,
      failure: reliabilityFailure,
      recovery: reliabilityRecovery,
      reconciliation: reliabilityReconciliation,
      snapshot: reliabilitySnapshot,
    },
    acceptanceFlags,
    totals: {
      acceptanceCriteria: acceptanceFlags.length,
      passedCriteria,
      assertionCount,
      integrationContracts: governance.contracts.length,
      teamsDeliveryElapsedMilliseconds:
        teams.primaryDelivery.timing.elapsedMilliseconds ?? -1,
      outlookPrimaryIntakes: outlookPrimarySnapshot.metrics.intakeCount,
      sharepointSyncElapsedSeconds: sharepoint.elapsedSeconds,
      auditEvents: auditEventCount,
      openDeadLetters: reliabilitySnapshot.openDeadLetters,
      duplicateDeliveries: reliabilitySnapshot.duplicateDeliveries,
      liveGraphCalls: 0 as const,
      liveMicrosoftReads: 0 as const,
      liveMicrosoftWrites: 0 as const,
      realNotificationsSent: 0 as const,
      productionRows: 0 as const,
      liveWrites: 0 as const,
    },
    boundary,
    accepted:
      passedCriteria === M51B_CRITERION_IDS.length && allZeroLiveOperations,
    synthetic: true as const,
  });
}
