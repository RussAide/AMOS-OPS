import { createHash } from "node:crypto";
import { runM31SyntheticSuite } from "../../m31";
import { runM32SyntheticSuite } from "../../m32";
import { runM33SyntheticSuite } from "../../m33";
import { runM41aScenario } from "../../m41a/engine";
import { runM41cIntegratedScenario } from "../../m41c/integrated-scenario";
import {
  createSyntheticM42DocumentRegistry,
  validateM42DocumentRegistry,
} from "../../m42/document-governance";
import { runM22RepresentativeScenario } from "../../mhtcm/scenario";
import { M51BOutlookReferralIntakeService } from "../../m51b/outlook/outlook-referral-intake";
import { createSyntheticM51BOutlookReferral } from "../../m51b/outlook/synthetic-outlook-fixtures";
import {
  DX1_EVALUATED_AT,
  DX1_PILOT_STAGE_IDS,
  DX1_SCENARIO_ID,
  createDx1PrototypeBoundary,
  type Dx1AuditEvent,
  type Dx1PilotStageId,
} from "../contracts";
import { DX1_PILOT_FIXTURE } from "../fixtures";
import {
  DX1_PILOT_ACTORS,
  evaluateDx1PilotAccess,
} from "./authorization";
import type {
  Dx1PilotAccessDecision,
  Dx1PilotAccessRequest,
  Dx1PilotActor,
  Dx1PilotAttemptInput,
  Dx1PilotAttemptResult,
  Dx1PilotStageRecord,
  Dx1SecurityAction,
  Dx1SecurityDomain,
  Dx1SecurityPilotResult,
} from "./types";

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

function stableId(prefix: string, ...parts: readonly string[]): string {
  return `${prefix}-${createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 20)
    .toUpperCase()}`;
}

function stageTime(sequence: number): string {
  const evaluated = Date.parse(DX1_EVALUATED_AT);
  return new Date(evaluated - (9 - sequence) * 5 * 60_000).toISOString();
}

interface StageAccessDefinition {
  readonly domain: Dx1SecurityDomain;
  readonly action: Dx1SecurityAction;
  readonly fields: readonly string[];
  readonly recordId: string;
  readonly subjectId?: string;
}

const STAGE_ACCESS: Readonly<Record<Dx1PilotStageId, StageAccessDefinition>> =
  Object.freeze({
    "referral-received": immutable<StageAccessDefinition>({
      domain: "phi-like-clinical",
      action: "record",
      fields: Object.freeze([
        "referral_status",
        "classification",
        "youth_reference",
        "requested_service",
      ]),
      recordId: DX1_PILOT_FIXTURE.referralId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
    }),
    "intake-review": immutable<StageAccessDefinition>({
      domain: "phi-like-clinical",
      action: "record",
      fields: Object.freeze([
        "eligibility_review_status",
        "evidence_gate_status",
        "escalation_state",
      ]),
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
    }),
    "cans-trr-support": immutable<StageAccessDefinition>({
      domain: "phi-like-clinical",
      action: "view",
      fields: Object.freeze([
        "support_context",
        "authority_boundary",
        "human_gate_status",
      ]),
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
    }),
    "authorization-setup": immutable<StageAccessDefinition>({
      domain: "finance",
      action: "record",
      fields: Object.freeze([
        "authorization_status",
        "authorization_units",
        "lineage_ids",
      ]),
      recordId: DX1_PILOT_FIXTURE.authorizationId,
    }),
    "service-delivery": immutable<StageAccessDefinition>({
      domain: "phi-like-clinical",
      action: "record",
      fields: Object.freeze([
        "service_event_status",
        "note_version",
        "provenance_ids",
      ]),
      recordId: DX1_PILOT_FIXTURE.serviceEventId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
    }),
    "qa-documentation-review": immutable<StageAccessDefinition>({
      domain: "compliance",
      action: "review",
      fields: Object.freeze([
        "qa_status",
        "evidence_gate_status",
        "remediation_state",
        "escalation_state",
        "audit_event_ids",
      ]),
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-QA`,
    }),
    "billing-gate": immutable<StageAccessDefinition>({
      domain: "finance",
      action: "record",
      fields: Object.freeze([
        "billing_gate_status",
        "service_units",
        "projected_amount_cents",
        "lineage_ids",
      ]),
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-BILLING`,
    }),
    "executive-risk-revenue-summary": immutable<StageAccessDefinition>({
      domain: "executive",
      action: "summarize",
      fields: Object.freeze([
        "aggregate_operational_status",
        "aggregate_compliance_risk",
        "aggregate_revenue_status",
        "aggregate_workforce_status",
        "provenance_ids",
      ]),
      recordId: DX1_SCENARIO_ID,
    }),
  });

const STAGE_ACTORS: Readonly<Record<Dx1PilotStageId, Dx1PilotActor>> =
  Object.freeze({
    "referral-received": DX1_PILOT_ACTORS.intake,
    "intake-review": DX1_PILOT_ACTORS.intake,
    "cans-trr-support": DX1_PILOT_ACTORS.clinician,
    "authorization-setup": DX1_PILOT_ACTORS.revenue,
    "service-delivery": DX1_PILOT_ACTORS.clinician,
    "qa-documentation-review": DX1_PILOT_ACTORS.qa,
    "billing-gate": DX1_PILOT_ACTORS.revenue,
    "executive-risk-revenue-summary": DX1_PILOT_ACTORS.executive,
  });

interface StageArtifactResult {
  readonly artifactId: string;
  readonly evidenceIds: readonly string[];
  readonly sourceModules: readonly string[];
  readonly artifact: Readonly<Record<string, unknown>>;
  readonly escalationState: "none" | "resolved";
}

function workflowAudit(input: {
  stageId: Dx1PilotStageId;
  actor: Dx1PilotActor;
  action: string;
  outcome: Dx1AuditEvent["outcome"];
  reason: string;
  evidenceIds: readonly string[];
  sequence: number;
}): Dx1AuditEvent {
  return immutable({
    eventId: stableId(
      "SYNTH-DX1-PILOT-AUDIT",
      input.stageId,
      input.actor.actorId,
      input.action,
      input.outcome,
      String(input.sequence),
    ),
    scenarioId: DX1_SCENARIO_ID,
    stageId: input.stageId,
    actorId: input.actor.actorId.startsWith("SYNTH-")
      ? input.actor.actorId
      : "SYNTH-DX1-REJECTED-ACTOR",
    actorRole: input.actor.role,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason,
    evidenceIds: Object.freeze([...input.evidenceIds]),
    occurredAt: stageTime(Math.max(1, Math.min(8, input.sequence))),
    synthetic: true,
  });
}

function assertPrevious(
  stages: readonly Dx1PilotStageRecord[],
  expected: Dx1PilotStageId,
): Dx1PilotStageRecord {
  const record = stages[stages.length - 1];
  if (!record || record.stageId !== expected || record.evidenceGate !== "passed")
    throw new Error(`DX1_PREVIOUS_STAGE_GATE_REQUIRED:${expected}`);
  return record;
}

export class Dx1PilotCoordinator {
  private readonly stages: Dx1PilotStageRecord[] = [];
  private readonly attempts: Dx1PilotAttemptResult[] = [];
  private readonly accessDecisions: Dx1PilotAccessDecision[] = [];
  private readonly auditEvents: Dx1AuditEvent[] = [];
  private m22: ReturnType<typeof runM22RepresentativeScenario> | null = null;

  businessFingerprint(): string {
    return fingerprint(
      this.stages.map((stage) => ({
        stageId: stage.stageId,
        artifactId: stage.artifactId,
        outputFingerprint: stage.outputFingerprint,
      })),
    );
  }

  completedStages(): readonly Dx1PilotStageRecord[] {
    return Object.freeze([...this.stages]);
  }

  allAttempts(): readonly Dx1PilotAttemptResult[] {
    return Object.freeze([...this.attempts]);
  }

  allAccessDecisions(): readonly Dx1PilotAccessDecision[] {
    return Object.freeze([...this.accessDecisions]);
  }

  allAuditEvents(): readonly Dx1AuditEvent[] {
    return Object.freeze([...this.auditEvents]);
  }

  private m22Scenario(): ReturnType<typeof runM22RepresentativeScenario> {
    this.m22 ??= runM22RepresentativeScenario();
    if (!this.m22.acceptanceGate || this.m22.dataMode !== "synthetic_demo")
      throw new Error("DX1_M22_INHERITED_GATE_FAILED");
    return this.m22;
  }

  private buildReferralArtifact(): StageArtifactResult {
    const base = createSyntheticM51BOutlookReferral();
    const envelope = immutable({
      ...base,
      messageId: "SYNTH-DX1-OUTLOOK-MESSAGE-001",
      internetMessageId: "SYNTH-DX1-OUTLOOK-INTERNET-MESSAGE-001",
      changeKey: "SYNTH-DX1-OUTLOOK-CHANGEKEY-001",
      context: immutable({
        ...base.context,
        processingActor: immutable({
          ...base.context.processingActor,
          actorId: DX1_PILOT_ACTORS.intake.actorId,
        }),
      }),
      referral: immutable({
        ...base.referral,
        referralReference: DX1_PILOT_FIXTURE.referralId,
        youthReference: DX1_PILOT_FIXTURE.youthId,
      }),
    });
    const service = new M51BOutlookReferralIntakeService();
    const result = service.process(envelope);
    if (
      result.disposition !== "intake_created" ||
      result.createdIntakeCount !== 1 ||
      result.intake?.referralId !== DX1_PILOT_FIXTURE.referralId ||
      result.liveGraphCalls !== 0 ||
      result.liveMicrosoftWrites !== 0 ||
      result.liveWrites !== 0
    )
      throw new Error("DX1_REFERRAL_ADAPTER_FAILED");
    const evidenceIds = Object.freeze([
      result.operationId,
      result.intake.intakeId,
      ...result.auditEvents.map((event) => event.eventId),
    ]);
    return immutable({
      artifactId: `${DX1_PILOT_FIXTURE.referralId}-PACKET`,
      evidenceIds,
      sourceModules: Object.freeze(["M5.1B Outlook referral intake"]),
      artifact: immutable({
        packetId: `${DX1_PILOT_FIXTURE.referralId}-PACKET`,
        referralId: DX1_PILOT_FIXTURE.referralId,
        youthId: DX1_PILOT_FIXTURE.youthId,
        classification: "restricted_synthetic_referral",
        ownerId: DX1_PILOT_ACTORS.intake.actorId,
        status: result.intake.status,
        sourceChannel: result.intake.sourceChannel,
        auditEventIds: Object.freeze(
          result.auditEvents.map((event) => event.eventId),
        ),
        liveSideEffects: 0,
      }),
      escalationState: "none",
    });
  }

  private buildStageArtifact(
    stageId: Dx1PilotStageId,
    access: Dx1PilotAccessDecision,
  ): StageArtifactResult {
    if (stageId === "referral-received") return this.buildReferralArtifact();

    if (stageId === "intake-review") {
      const referral = assertPrevious(this.stages, "referral-received");
      return immutable({
        artifactId: `${DX1_PILOT_FIXTURE.episodeId}-INTAKE-DECISION`,
        evidenceIds: Object.freeze([
          referral.artifactId,
          "SYNTH-DX1-INTAKE-EVIDENCE-GATE-001",
          "SYNTH-DX1-INTAKE-ESCALATION-ROUTE-001",
        ]),
        sourceModules: Object.freeze(["M5.1B referral intake", "DX.1 gate adapter"]),
        artifact: immutable({
          decisionId: `${DX1_PILOT_FIXTURE.episodeId}-INTAKE-DECISION`,
          referralId: DX1_PILOT_FIXTURE.referralId,
          episodeId: DX1_PILOT_FIXTURE.episodeId,
          disposition: "eligible_for_governed_synthetic_review",
          evidenceGate: "passed",
          escalationState: "none",
          escalationRouteId: "SYNTH-DX1-INTAKE-ESCALATION-ROUTE-001",
          ownerId: DX1_PILOT_ACTORS.intake.actorId,
        }),
        escalationState: "none",
      });
    }

    if (stageId === "cans-trr-support") {
      const intake = assertPrevious(this.stages, "intake-review");
      const clinical = runM41cIntegratedScenario();
      const trr = clinical.criteria.find(
        (criterion) => criterion.criterionId === "M4.1C-07",
      );
      if (
        !clinical.exitGate ||
        !trr?.passed ||
        clinical.productionRows !== 0 ||
        clinical.liveWrites !== 0 ||
        access.canonicalClinicalDecisionCode !== "M41C_ACCESS_ALLOWED"
      )
        throw new Error("DX1_TRR_SUPPORT_ADAPTER_FAILED");
      return immutable({
        artifactId: `${DX1_PILOT_FIXTURE.episodeId}-TRR-SUPPORT`,
        evidenceIds: Object.freeze([intake.artifactId, ...trr.evidenceIds]),
        sourceModules: Object.freeze(["M4.1C clinical access", "M4.1C TRR package"]),
        artifact: immutable({
          supportId: `${DX1_PILOT_FIXTURE.episodeId}-TRR-SUPPORT`,
          episodeId: DX1_PILOT_FIXTURE.episodeId,
          subjectId: DX1_PILOT_FIXTURE.youthId,
          supportContext: "CANS/TRR metadata and evidence completeness support",
          authorityBoundary: immutable({
            autonomousScoring: false,
            liveLevelOfCareActivation: false,
            treatmentDirection: false,
            qualifiedHumanReviewRequired: true,
          }),
          humanGateStatus: "qualified_human_review_required",
          clinicalAccessDecision: access.canonicalClinicalDecisionCode,
          sourceCriterion: trr.criterionId,
        }),
        escalationState: "none",
      });
    }

    if (stageId === "authorization-setup") {
      const support = assertPrevious(this.stages, "cans-trr-support");
      const m22 = this.m22Scenario();
      const authorization = m22.snapshot.authorization;
      const registry = createSyntheticM42DocumentRegistry();
      const registryErrors = validateM42DocumentRegistry(registry);
      const clinicalReference = registry.documents.find(
        (document) => document.documentType === "clinical_reference",
      );
      if (
        !authorization ||
        authorization.status !== "authorized" ||
        registryErrors.length !== 0 ||
        registry.productionRepositoryConnected !== false ||
        !clinicalReference
      )
        throw new Error("DX1_AUTHORIZATION_PACKET_ADAPTER_FAILED");
      return immutable({
        artifactId: DX1_PILOT_FIXTURE.documentPacketId,
        evidenceIds: Object.freeze([
          support.artifactId,
          authorization.id,
          clinicalReference.documentId,
          clinicalReference.currentVersionId,
        ]),
        sourceModules: Object.freeze(["M2.2 authorization", "M4.2 AMOS-DMS governance"]),
        artifact: immutable({
          packetId: DX1_PILOT_FIXTURE.documentPacketId,
          authorizationId: DX1_PILOT_FIXTURE.authorizationId,
          sourceAuthorizationId: authorization.id,
          episodeId: DX1_PILOT_FIXTURE.episodeId,
          manifest: Object.freeze([
            DX1_PILOT_FIXTURE.referralId,
            support.artifactId,
            clinicalReference.documentId,
          ]),
          version: "1.0",
          approvalState: "approved_synthetic",
          approvedUnits: authorization.approvedUnits,
          ownerId: DX1_PILOT_ACTORS.revenue.actorId,
          productionRepositoryConnected: false,
        }),
        escalationState: "none",
      });
    }

    if (stageId === "service-delivery") {
      const authorization = assertPrevious(this.stages, "authorization-setup");
      const m22 = this.m22Scenario();
      const encounter = m22.snapshot.encounters[0];
      if (!encounter || encounter.currentRevision < 1)
        throw new Error("DX1_SERVICE_EVENT_ADAPTER_FAILED");
      return immutable({
        artifactId: DX1_PILOT_FIXTURE.serviceEventId,
        evidenceIds: Object.freeze([
          authorization.artifactId,
          encounter.id,
          ...m22.snapshot.auditEvents
            .filter((event) => event.entityId === encounter.id)
            .map((event) => event.id),
        ]),
        sourceModules: Object.freeze(["M2.2 service documentation"]),
        artifact: immutable({
          serviceEventId: DX1_PILOT_FIXTURE.serviceEventId,
          sourceEncounterId: encounter.id,
          authorizationId: DX1_PILOT_FIXTURE.authorizationId,
          episodeId: DX1_PILOT_FIXTURE.episodeId,
          status: "documented_synthetic_service",
          noteVersion: encounter.currentRevision,
          providerId: DX1_PILOT_ACTORS.clinician.actorId,
          provenanceIds: Object.freeze([
            authorization.artifactId,
            encounter.id,
          ]),
          liveServiceDelivered: false,
        }),
        escalationState: "none",
      });
    }

    if (stageId === "qa-documentation-review") {
      const service = assertPrevious(this.stages, "service-delivery");
      const m22 = this.m22Scenario();
      const billing = m22.billingDecision;
      if (!billing.result.billingReady || billing.result.decision !== "READY")
        throw new Error("DX1_QA_GATE_ADAPTER_FAILED");
      return immutable({
        artifactId: `${DX1_PILOT_FIXTURE.serviceEventId}-QA`,
        evidenceIds: Object.freeze([
          service.artifactId,
          billing.id,
          ...billing.result.policy.sourceIds,
        ]),
        sourceModules: Object.freeze(["M2.2 quality review", "M1.2 billing policy"]),
        artifact: immutable({
          qaReviewId: `${DX1_PILOT_FIXTURE.serviceEventId}-QA`,
          serviceEventId: DX1_PILOT_FIXTURE.serviceEventId,
          qaResult: "cleared",
          evidenceGate: "passed",
          remediationState: "not_required",
          escalationState: "none",
          reasonCodes: Object.freeze([...billing.result.reasonCodes]),
          reviewerId: DX1_PILOT_ACTORS.qa.actorId,
        }),
        escalationState: "none",
      });
    }

    if (stageId === "billing-gate") {
      const qa = assertPrevious(this.stages, "qa-documentation-review");
      if (qa.artifact.qaResult !== "cleared")
        throw new Error("DX1_QA_CLEARANCE_REQUIRED");
      const m22 = this.m22Scenario();
      if (
        !m22.billingDecision.result.billingReady ||
        m22.claimHandoff.status !== "ready_for_revenue"
      )
        throw new Error("DX1_BILLING_GATE_ADAPTER_FAILED");
      return immutable({
        artifactId: `${DX1_PILOT_FIXTURE.serviceEventId}-BILLING`,
        evidenceIds: Object.freeze([
          qa.artifactId,
          m22.billingDecision.id,
          m22.claimHandoff.id,
          DX1_PILOT_FIXTURE.authorizationId,
        ]),
        sourceModules: Object.freeze(["M2.2 billing readiness and claim handoff"]),
        artifact: immutable({
          gateId: `${DX1_PILOT_FIXTURE.serviceEventId}-BILLING`,
          serviceEventId: DX1_PILOT_FIXTURE.serviceEventId,
          authorizationId: DX1_PILOT_FIXTURE.authorizationId,
          qaReviewId: qa.artifactId,
          decision: "READY",
          status: "ready_for_revenue",
          serviceUnits: m22.claimHandoff.units,
          projectedAmountCents: 22_500,
          amountNature: "synthetic_projection_only",
          lineageIds: Object.freeze([
            m22.billingDecision.id,
            m22.claimHandoff.id,
          ]),
          liveClaimSubmitted: false,
        }),
        escalationState: "none",
      });
    }

    const billing = assertPrevious(this.stages, "billing-gate");
    const operations = runM41aScenario();
    const compliance = runM31SyntheticSuite();
    const revenue = runM32SyntheticSuite();
    const workforce = runM33SyntheticSuite();
    if (
      !operations.exitGate ||
      !compliance.passed ||
      !revenue.passed ||
      !workforce.passed
    )
      throw new Error("DX1_EXECUTIVE_SUMMARY_SOURCE_FAILED");
    const provenanceIds = Object.freeze([
      billing.artifactId,
      operations.scenarioId,
      ...compliance.criteria.flatMap((criterion) =>
        Object.values(criterion.evidence)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter((value): value is string => typeof value === "string")
          .slice(0, 1),
      ),
      ...revenue.criteria.slice(0, 2).map((criterion) => criterion.criterionId),
      ...workforce.criteria.slice(0, 2).map((criterion) => criterion.criterionId),
    ]);
    return immutable({
      artifactId: `${DX1_SCENARIO_ID}-EXECUTIVE-SUMMARY`,
      evidenceIds: provenanceIds,
      sourceModules: Object.freeze([
        "M4.1A executive analytics",
        "M3.1 compliance and risk",
        "M3.2 revenue cycle",
        "M3.3 workforce",
      ]),
      artifact: immutable({
        summaryId: `${DX1_SCENARIO_ID}-EXECUTIVE-SUMMARY`,
        scenarioId: DX1_SCENARIO_ID,
        operationalStatus: "pilot_completed",
        complianceRisk: "governed_synthetic_controls_passed",
        revenueStatus: "qa_cleared_ready_for_revenue",
        workforceStatus: "qualified_synthetic_workforce_evidence_current",
        stageCount: 8,
        sourceStageId: billing.stageId,
        provenanceIds,
        narrative:
          "The fictional referral completed all eight governed stages; QA-cleared, authorized service evidence reached billing readiness and reconciled executive operating, compliance, revenue, and workforce views.",
        liveExecutiveDistribution: false,
      }),
      escalationState: "resolved",
    });
  }

  private accessRequest(
    stageId: Dx1PilotStageId,
    actor: Dx1PilotActor,
  ): Dx1PilotAccessRequest {
    const definition = STAGE_ACCESS[stageId];
    return {
      requestId: `SYNTH-DX1-ACCESS-REQUEST-${stageId}-${String(this.attempts.length + 1).padStart(2, "0")}`,
      scenarioId: DX1_SCENARIO_ID,
      stageId,
      actor,
      domain: definition.domain,
      action: definition.action,
      recordId: definition.recordId,
      subjectId: definition.subjectId,
      requestedFields: definition.fields,
    };
  }

  private recordAttempt(result: Dx1PilotAttemptResult): Dx1PilotAttemptResult {
    this.attempts.push(result);
    return result;
  }

  attemptStage(input: Dx1PilotAttemptInput): Dx1PilotAttemptResult {
    const before = this.businessFingerprint();
    const beforeCount = this.stages.length;
    const expected = DX1_PILOT_STAGE_IDS[this.stages.length];
    if (expected !== input.stageId) {
      const event = workflowAudit({
        stageId: input.stageId,
        actor: input.actor,
        action: "stage_sequence_check",
        outcome: "denied",
        reason: `Expected ${expected ?? "no further stage"}; received ${input.stageId}.`,
        evidenceIds: Object.freeze(["DX1-10-SEQUENCE-DENIAL"]),
        sequence: Math.max(1, this.stages.length + 1),
      });
      this.auditEvents.push(event);
      return this.recordAttempt(
        immutable({
          accepted: false,
          stageId: input.stageId,
          code: "DX1_STAGE_SEQUENCE_DENIED",
          reason: event.reason,
          stage: null,
          accessDecision: null,
          businessFingerprintBefore: before,
          businessFingerprintAfter: this.businessFingerprint(),
          businessStageCountBefore: beforeCount,
          businessStageCountAfter: this.stages.length,
          partialBusinessSideEffects: 0,
          auditEventIds: Object.freeze([event.eventId]),
        }),
      );
    }

    const access = evaluateDx1PilotAccess(
      this.accessRequest(input.stageId, input.actor),
    );
    this.accessDecisions.push(access);
    if (!access.allowed) {
      this.auditEvents.push(access.auditEvent);
      return this.recordAttempt(
        immutable({
          accepted: false,
          stageId: input.stageId,
          code: "DX1_STAGE_ACCESS_DENIED",
          reason: access.reason,
          stage: null,
          accessDecision: access,
          businessFingerprintBefore: before,
          businessFingerprintAfter: this.businessFingerprint(),
          businessStageCountBefore: beforeCount,
          businessStageCountAfter: this.stages.length,
          partialBusinessSideEffects: 0,
          auditEventIds: Object.freeze([access.auditEvent.eventId]),
        }),
      );
    }

    if (input.evidenceAvailable === false) {
      const held = workflowAudit({
        stageId: input.stageId,
        actor: input.actor,
        action: "evidence_gate",
        outcome: "held",
        reason: "Required synthetic evidence is absent; route to the named remediation path.",
        evidenceIds: Object.freeze([
          "DX1-10-MISSING-EVIDENCE-HOLD",
          "SYNTH-DX1-QA-REMEDIATION-ROUTE-001",
        ]),
        sequence: this.stages.length + 1,
      });
      this.auditEvents.push(access.auditEvent, held);
      return this.recordAttempt(
        immutable({
          accepted: false,
          stageId: input.stageId,
          code: "DX1_STAGE_EVIDENCE_HELD",
          reason: held.reason,
          stage: null,
          accessDecision: access,
          businessFingerprintBefore: before,
          businessFingerprintAfter: this.businessFingerprint(),
          businessStageCountBefore: beforeCount,
          businessStageCountAfter: this.stages.length,
          partialBusinessSideEffects: 0,
          auditEventIds: Object.freeze([
            access.auditEvent.eventId,
            held.eventId,
          ]),
        }),
      );
    }

    const sequence = this.stages.length + 1;
    const artifact = this.buildStageArtifact(input.stageId, access);
    const inputFingerprint = fingerprint({
      scenarioId: DX1_SCENARIO_ID,
      stageId: input.stageId,
      previousOutputFingerprint:
        this.stages[this.stages.length - 1]?.outputFingerprint ?? null,
      actorId: input.actor.actorId,
      evidenceIds: artifact.evidenceIds,
    });
    const outputFingerprint = fingerprint(artifact.artifact);
    const completed = workflowAudit({
      stageId: input.stageId,
      actor: input.actor,
      action: "pilot_stage_completed",
      outcome: "completed",
      reason: `Stage ${sequence} completed after permission and evidence gates passed.`,
      evidenceIds: artifact.evidenceIds,
      sequence,
    });
    const stage: Dx1PilotStageRecord = immutable({
      sequence,
      stageId: input.stageId,
      scenarioId: DX1_SCENARIO_ID,
      ownerId: input.actor.actorId,
      ownerRole: input.actor.role,
      status: "completed",
      evidenceGate: "passed",
      escalationState: artifact.escalationState,
      artifactId: artifact.artifactId,
      evidenceIds: Object.freeze([...artifact.evidenceIds]),
      sourceModules: Object.freeze([...artifact.sourceModules]),
      artifact: artifact.artifact,
      inputFingerprint,
      outputFingerprint,
      auditEventId: completed.eventId,
      completedAt: stageTime(sequence),
      synthetic: true,
    });
    this.stages.push(stage);
    this.auditEvents.push(access.auditEvent, completed);
    return this.recordAttempt(
      immutable({
        accepted: true,
        stageId: input.stageId,
        code: "DX1_STAGE_COMPLETED",
        reason: completed.reason,
        stage,
        accessDecision: access,
        businessFingerprintBefore: before,
        businessFingerprintAfter: this.businessFingerprint(),
        businessStageCountBefore: beforeCount,
        businessStageCountAfter: this.stages.length,
        partialBusinessSideEffects: 0,
        auditEventIds: Object.freeze([
          access.auditEvent.eventId,
          completed.eventId,
        ]),
      }),
    );
  }

  probeAccess(request: Dx1PilotAccessRequest): Dx1PilotAccessDecision {
    const before = this.businessFingerprint();
    const count = this.stages.length;
    const result = evaluateDx1PilotAccess(request);
    this.accessDecisions.push(result);
    this.auditEvents.push(result.auditEvent);
    if (before !== this.businessFingerprint() || count !== this.stages.length)
      throw new Error("DX1_SECURITY_PROBE_MUTATED_BUSINESS_STATE");
    return result;
  }
}

function securityProbe(input: {
  actor: Dx1PilotActor;
  domain: Dx1SecurityDomain;
  action: Dx1SecurityAction;
  recordId: string;
  fields: readonly string[];
  subjectId?: string;
}): Dx1PilotAccessRequest {
  return {
    requestId: `SYNTH-DX1-PROBE-${input.domain.toUpperCase().replace(/[^A-Z]+/g, "-")}-${input.actor.actorId}`,
    scenarioId: DX1_SCENARIO_ID,
    stageId: "cross-enterprise",
    actor: input.actor,
    domain: input.domain,
    action: input.action,
    recordId: input.recordId,
    subjectId: input.subjectId,
    requestedFields: input.fields,
  };
}

export function runDx1SecurityPilotStream(): Dx1SecurityPilotResult {
  const coordinator = new Dx1PilotCoordinator();

  coordinator.attemptStage({
    stageId: "referral-received",
    actor: DX1_PILOT_ACTORS.executive,
  });
  coordinator.attemptStage({
    stageId: "billing-gate",
    actor: DX1_PILOT_ACTORS.revenue,
  });

  for (const stageId of DX1_PILOT_STAGE_IDS.slice(0, 5))
    coordinator.attemptStage({ stageId, actor: STAGE_ACTORS[stageId] });
  coordinator.attemptStage({
    stageId: "qa-documentation-review",
    actor: DX1_PILOT_ACTORS.qa,
    evidenceAvailable: false,
  });
  for (const stageId of DX1_PILOT_STAGE_IDS.slice(5))
    coordinator.attemptStage({ stageId, actor: STAGE_ACTORS[stageId] });

  const probes = [
    securityProbe({
      actor: DX1_PILOT_ACTORS.clinician,
      domain: "phi-like-clinical",
      action: "view",
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
      fields: ["support_context", "human_gate_status"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.hr,
      domain: "hr",
      action: "view",
      recordId: "SYNTH-DX1-WORKFORCE-001",
      fields: ["workforce_status", "credential_status"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.revenue,
      domain: "finance",
      action: "view",
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-BILLING`,
      fields: ["billing_gate_status", "service_units"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.executive,
      domain: "executive",
      action: "summarize",
      recordId: DX1_SCENARIO_ID,
      fields: [
        "aggregate_operational_status",
        "aggregate_compliance_risk",
        "aggregate_revenue_status",
        "aggregate_workforce_status",
        "provenance_ids",
      ],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.compliance,
      domain: "compliance",
      action: "review",
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-QA`,
      fields: ["qa_status", "evidence_gate_status", "audit_event_ids"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.executive,
      domain: "phi-like-clinical",
      action: "view",
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
      fields: ["youth_reference"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.revenue,
      domain: "hr",
      action: "view",
      recordId: "SYNTH-DX1-WORKFORCE-001",
      fields: ["workforce_status"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.intake,
      domain: "finance",
      action: "view",
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-BILLING`,
      fields: ["billing_gate_status"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.clinician,
      domain: "executive",
      action: "summarize",
      recordId: DX1_SCENARIO_ID,
      fields: ["aggregate_operational_status"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.revenue,
      domain: "compliance",
      action: "review",
      recordId: `${DX1_PILOT_FIXTURE.serviceEventId}-QA`,
      fields: ["qa_status"],
    }),
    securityProbe({
      actor: DX1_PILOT_ACTORS.clinician,
      domain: "phi-like-clinical",
      action: "view",
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
      fields: ["support_context", "diagnosis_text"],
    }),
    securityProbe({
      actor: Object.freeze({
        ...DX1_PILOT_ACTORS.intake,
        actorId: "REAL-DX1-ACTOR-NOT-ALLOWED",
      }),
      domain: "phi-like-clinical",
      action: "view",
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
      fields: ["support_context"],
    }),
  ] as const;
  probes.forEach((probe) => coordinator.probeAccess(probe));

  const stages = coordinator.completedStages();
  const attempts = coordinator.allAttempts();
  const accessDecisions = coordinator.allAccessDecisions();
  const auditEvents = coordinator.allAuditEvents();
  const deniedAttempts = attempts.filter((attempt) => !attempt.accepted);
  const deniedAccessDecisions = accessDecisions.filter(
    (decision) => !decision.allowed,
  );
  const allowedDomains = new Set(
    accessDecisions
      .filter((decision) => decision.allowed)
      .map((decision) => decision.domain),
  );
  const deniedDomains = new Set(
    deniedAccessDecisions.map((decision) => decision.domain),
  );
  const noPartialSideEffects = deniedAttempts.every(
    (attempt) =>
      attempt.partialBusinessSideEffects === 0 &&
      attempt.businessStageCountBefore === attempt.businessStageCountAfter &&
      attempt.businessFingerprintBefore === attempt.businessFingerprintAfter,
  );
  const exactStageOrder =
    stages.length === DX1_PILOT_STAGE_IDS.length &&
    stages.every(
      (stage, index) =>
        stage.stageId === DX1_PILOT_STAGE_IDS[index] &&
        stage.sequence === index + 1,
    );
  const everyStageTraceable = stages.every(
    (stage) =>
      stage.scenarioId === DX1_SCENARIO_ID &&
      stage.evidenceIds.length > 0 &&
      stage.sourceModules.length > 0 &&
      stage.inputFingerprint.startsWith("sha256:") &&
      stage.outputFingerprint.startsWith("sha256:") &&
      auditEvents.some((event) => event.eventId === stage.auditEventId),
  );
  const executive = stages[stages.length - 1]?.artifact;
  const executiveConsistent =
    executive?.scenarioId === DX1_SCENARIO_ID &&
    executive?.stageCount === 8 &&
    executive?.sourceStageId === "billing-gate";

  const dx108Assertions = Object.freeze([
    "DX1-08-CANONICAL-PERMISSION-INTERSECTION",
    "DX1-08-PHI-LIKE-LEAST-PRIVILEGE",
    "DX1-08-HR-LEAST-PRIVILEGE",
    "DX1-08-FINANCE-LEAST-PRIVILEGE",
    "DX1-08-EXECUTIVE-AGGREGATE-ONLY",
    "DX1-08-COMPLIANCE-LEAST-PRIVILEGE",
    "DX1-08-MINIMUM-NECESSARY-DENIAL",
    "DX1-08-SYNTHETIC-IDENTITY-BOUNDARY",
    "DX1-08-DENIALS-AUDITED",
    "DX1-08-NO-PARTIAL-BUSINESS-SIDE-EFFECTS",
  ]);
  const dx110Assertions = Object.freeze([
    "DX1-10-EXACT-EIGHT-STAGE-ORDER",
    "DX1-10-SINGLE-SCENARIO-IDENTITY",
    "DX1-10-REFERRAL-INTAKE-LINEAGE",
    "DX1-10-CANS-TRR-HUMAN-BOUNDARY",
    "DX1-10-AUTHORIZATION-DMS-PACKET",
    "DX1-10-SERVICE-NOTE-PROVENANCE",
    "DX1-10-QA-BEFORE-BILLING",
    "DX1-10-MISSING-EVIDENCE-HOLD-AND-RECOVERY",
    "DX1-10-EXECUTIVE-CROSS-DOMAIN-PROVENANCE",
    "DX1-10-IMMUTABLE-CORRELATED-AUDIT",
    "DX1-10-ZERO-LIVE-SIDE-EFFECTS",
  ]);

  const dx108Passed =
    allowedDomains.size === 5 &&
    deniedDomains.size === 5 &&
    deniedAccessDecisions.some(
      (decision) => decision.code === "DX1_MINIMUM_NECESSARY_DENIED",
    ) &&
    deniedAccessDecisions.some(
      (decision) => decision.code === "DX1_SYNTHETIC_ACTOR_REQUIRED",
    ) &&
    deniedAccessDecisions.every(
      (decision) => decision.auditEvent.outcome === "denied",
    ) &&
    noPartialSideEffects;
  const dx110Passed =
    exactStageOrder &&
    everyStageTraceable &&
    executiveConsistent &&
    deniedAttempts.some(
      (attempt) => attempt.code === "DX1_STAGE_EVIDENCE_HELD",
    ) &&
    stages.every((stage) => stage.evidenceGate === "passed");
  const boundary = createDx1PrototypeBoundary();
  const criteria = Object.freeze([
    immutable({
      criterionId: "DX.1-08" as const,
      status: dx108Passed ? ("Complete" as const) : ("Partial — action remains" as const),
      assertionIds: dx108Assertions,
      evidenceIds: Object.freeze([
        ...accessDecisions.map((decision) => decision.auditEvent.eventId),
        ...deniedAttempts.flatMap((attempt) => attempt.auditEventIds),
      ]),
      summary:
        "Canonical permission intersection, minimum-necessary access, five-domain least privilege, audited denials, and zero partial business side effects are exercised.",
    }),
    immutable({
      criterionId: "DX.1-10" as const,
      status: dx110Passed ? ("Complete" as const) : ("Partial — action remains" as const),
      assertionIds: dx110Assertions,
      evidenceIds: Object.freeze([
        ...stages.flatMap((stage) => [stage.artifactId, stage.auditEventId]),
        ...deniedAttempts.flatMap((attempt) => attempt.auditEventIds),
      ]),
      summary:
        "The correlated referral-to-executive pilot completes all eight governed stages with inherited service evidence, explicit gates, and synthetic-only effects.",
    }),
  ]);
  const passed = dx108Passed && dx110Passed;

  if (!passed) throw new Error("DX1_SECURITY_PILOT_ACCEPTANCE_FAILED");

  return immutable({
    streamId: "security-pilot",
    passed,
    assertionCount: dx108Assertions.length + dx110Assertions.length,
    criteria,
    auditEvents,
    boundary,
    scenarioId: DX1_SCENARIO_ID,
    status: "completed",
    stages,
    attempts,
    accessDecisions,
    deniedAttempts: Object.freeze(deniedAttempts),
    deniedAccessDecisions: Object.freeze(deniedAccessDecisions),
    completedStageCount: 8,
    skippedStageCount: 0,
    orphanedArtifactCount: 0,
    inconsistentSummaryCount: 0,
    partialSideEffectCount: 0,
    traceFingerprint: fingerprint(
      stages.map((stage) => ({
        stageId: stage.stageId,
        artifactId: stage.artifactId,
        outputFingerprint: stage.outputFingerprint,
      })),
    ),
  });
}
