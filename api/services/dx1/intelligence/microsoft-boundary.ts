import {
  createSyntheticM51aConnectorRegistryEntries,
  validateM51aConnectorRegistry,
} from "../../m51a";
import {
  createSyntheticM51BIntegrationContracts,
  createSyntheticM51BPrivacyThreatControls,
  evaluateM51BIntegrationGovernance,
} from "../../m51b";
import type { M51BIntegrationChannel } from "@contracts/m51b/shared";
import { DX1_SCENARIO_ID, type Dx1AuditEvent } from "../contracts";
import {
  assertDx1Intelligence,
  createDx1IntelligenceAuditEvent,
  dx1IntelligenceId,
  immutable,
} from "./support";

export const DX1_MICROSOFT_SUPPORT_CAPABILITIES = Object.freeze({
  teams: "deliver_minimum_necessary_notification",
  outlook: "validate_referral_envelope",
  sharepoint: "synchronize_approved_copy",
} as const);

export const DX1_MICROSOFT_PROHIBITED_OWNERSHIP = Object.freeze([
  "own_enterprise_workflow",
  "approve_enterprise_decision",
  "mutate_enterprise_logic",
  "become_system_of_record",
] as const);

export interface Dx1MicrosoftSupportDecision {
  readonly decisionId: string;
  readonly channel: M51BIntegrationChannel;
  readonly requestedCapability: string;
  readonly allowed: boolean;
  readonly decision: "support_only" | "denied_enterprise_ownership";
  readonly amosRetainsAuthority: true;
  readonly enterpriseLogicOwnershipTransferred: false;
  readonly reason: string;
  readonly contractId: string;
  readonly liveCallPerformed: false;
  readonly liveReadPerformed: false;
  readonly liveWritePerformed: false;
  readonly synthetic: true;
}

export interface Dx1MicrosoftBoundaryResult {
  readonly accepted: boolean;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly sourceMilestones: readonly ["M5.1A", "M5.1B"];
  readonly supportDecisions: readonly Dx1MicrosoftSupportDecision[];
  readonly ownershipDenialDecisions: readonly Dx1MicrosoftSupportDecision[];
  readonly connectorRegistryEntries: number;
  readonly integrationContracts: number;
  readonly privacyThreatControls: number;
  readonly amosAuthorityDomains: readonly string[];
  readonly auditEvents: readonly Dx1AuditEvent[];
  readonly enterpriseLogicOwnershipTransfers: 0;
  readonly productionRows: 0;
  readonly liveMicrosoftReads: 0;
  readonly liveMicrosoftWrites: 0;
  readonly realNotificationsSent: 0;
  readonly synthetic: true;
}

export function evaluateDx1MicrosoftSupportRequest(input: {
  readonly channel: M51BIntegrationChannel;
  readonly requestedCapability: string;
}): Readonly<Dx1MicrosoftSupportDecision> {
  const contracts = createSyntheticM51BIntegrationContracts();
  const contract = contracts.find(
    (candidate) => candidate.channel === input.channel,
  );
  assertDx1Intelligence(contract, "DX1_MICROSOFT_CHANNEL_CONTRACT_REQUIRED");
  const prohibited = DX1_MICROSOFT_PROHIBITED_OWNERSHIP.includes(
    input.requestedCapability as (typeof DX1_MICROSOFT_PROHIBITED_OWNERSHIP)[number],
  );
  const allowedCapability =
    DX1_MICROSOFT_SUPPORT_CAPABILITIES[input.channel] ===
    input.requestedCapability;
  assertDx1Intelligence(
    prohibited || allowedCapability,
    "DX1_MICROSOFT_CAPABILITY_NOT_REGISTERED",
  );
  return immutable({
    decisionId: dx1IntelligenceId(
      "SYNTH-DX1-MICROSOFT-BOUNDARY",
      input.channel,
      input.requestedCapability,
    ),
    channel: input.channel,
    requestedCapability: input.requestedCapability,
    allowed: allowedCapability,
    decision: allowedCapability
      ? ("support_only" as const)
      : ("denied_enterprise_ownership" as const),
    amosRetainsAuthority: true as const,
    enterpriseLogicOwnershipTransferred: false as const,
    reason: allowedCapability
      ? `${input.channel} may support the governed action under ${contract.contractId}; AMOS remains authoritative.`
      : `${input.channel} cannot own, approve, mutate, or become the system of record for AMOS enterprise logic.`,
    contractId: contract.contractId,
    liveCallPerformed: false as const,
    liveReadPerformed: false as const,
    liveWritePerformed: false as const,
    synthetic: true as const,
  });
}

export function runDx1MicrosoftBoundaryVerification(): Readonly<Dx1MicrosoftBoundaryResult> {
  const connectorRegistry = createSyntheticM51aConnectorRegistryEntries();
  const connectorIssues = validateM51aConnectorRegistry(connectorRegistry);
  const contracts = createSyntheticM51BIntegrationContracts();
  const privacyThreatControls = createSyntheticM51BPrivacyThreatControls();
  const governance = evaluateM51BIntegrationGovernance(
    contracts,
    privacyThreatControls,
  );
  assertDx1Intelligence(
    connectorIssues.length === 0 &&
      connectorRegistry.every(
        (entry) =>
          entry.retentionPolicy.dispositionAuthority === "AMOS-DMS" &&
          !entry.retentionPolicy.livePolicyActivation,
      ) &&
      governance.accepted &&
      governance.totals.liveWrites === 0,
    "DX1_MICROSOFT_INHERITED_GOVERNANCE_FAILED",
  );
  const supportDecisions = immutable(
    (
      Object.entries(DX1_MICROSOFT_SUPPORT_CAPABILITIES) as Array<
        [M51BIntegrationChannel, string]
      >
    ).map(([channel, requestedCapability]) =>
      evaluateDx1MicrosoftSupportRequest({ channel, requestedCapability }),
    ),
  );
  const ownershipDenialDecisions = immutable(
    DX1_MICROSOFT_PROHIBITED_OWNERSHIP.map((requestedCapability, index) =>
      evaluateDx1MicrosoftSupportRequest({
        channel: (["teams", "outlook", "sharepoint"] as const)[index % 3]!,
        requestedCapability,
      }),
    ),
  );
  assertDx1Intelligence(
    supportDecisions.length === 3 &&
      supportDecisions.every(
        (decision) =>
          decision.allowed &&
          decision.decision === "support_only" &&
          decision.amosRetainsAuthority &&
          !decision.liveCallPerformed,
      ) &&
      ownershipDenialDecisions.every(
        (decision) =>
          !decision.allowed &&
          decision.decision === "denied_enterprise_ownership" &&
          !decision.enterpriseLogicOwnershipTransferred,
      ),
    "DX1_MICROSOFT_SUPPORT_BOUNDARY_FAILED",
  );
  const auditEvents = immutable([
    ...supportDecisions.map((decision) =>
      createDx1IntelligenceAuditEvent({
        action: `microsoft-${decision.channel}-support-verified`,
        actorId: "SYNTH-DX1-ACTOR-INTEGRATION-REVIEWER",
        actorRole: "administrator",
        outcome: "completed",
        reason: decision.reason,
        evidenceIds: [decision.decisionId, decision.contractId],
      }),
    ),
    createDx1IntelligenceAuditEvent({
      action: "microsoft-enterprise-ownership-denied",
      actorId: "SYNTH-DX1-ACTOR-INTEGRATION-REVIEWER",
      actorRole: "administrator",
      outcome: "denied",
      reason:
        "All attempts to transfer enterprise workflow, approval, logic, or source authority to Microsoft were denied.",
      evidenceIds: ownershipDenialDecisions.map(
        (decision) => decision.decisionId,
      ),
    }),
  ]);
  return immutable({
    accepted: true,
    scenarioId: DX1_SCENARIO_ID,
    sourceMilestones: ["M5.1A", "M5.1B"] as const,
    supportDecisions,
    ownershipDenialDecisions,
    connectorRegistryEntries: connectorRegistry.length,
    integrationContracts: contracts.length,
    privacyThreatControls: privacyThreatControls.length,
    amosAuthorityDomains: [
      "workflow status",
      "document state and retention",
      "human approvals and attestations",
      "evidence gates",
      "clinical support limits",
      "billing readiness",
      "enterprise dashboard reconciliation",
    ],
    auditEvents,
    enterpriseLogicOwnershipTransfers: 0 as const,
    productionRows: 0 as const,
    liveMicrosoftReads: 0 as const,
    liveMicrosoftWrites: 0 as const,
    realNotificationsSent: 0 as const,
    synthetic: true as const,
  });
}
