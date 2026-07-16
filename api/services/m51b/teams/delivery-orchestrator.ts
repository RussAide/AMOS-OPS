import {
  M51B_EVIDENCE_CLASS,
  M51B_EVALUATION_STARTED_AT,
  type M51BAuditEvent,
} from "../../../../contracts/m51b/shared";
import {
  M51B_TEAMS_ACKNOWLEDGEMENT_SLO_MS,
  M51B_TEAMS_DELIVERY_SLO_MS,
  M51B_TEAMS_MAX_ATTEMPTS,
  type M51BTeamsAcknowledgementRequest,
  type M51BTeamsAcknowledgementResult,
  type M51BTeamsDeadLetter,
  type M51BTeamsDeadLetterResolution,
  type M51BTeamsDeadLetterSnapshot,
  type M51BTeamsDeliveryAttempt,
  type M51BTeamsDeliveryResult,
  type M51BTeamsDeliveryTiming,
  type M51BTeamsDispatchRequest,
  type M51BTeamsOperationalAlert,
  type M51BTeamsOperationalAlertResolution,
  type M51BTeamsOperationalAlertSnapshot,
  type M51BTeamsOperationalStateSnapshot,
  type M51BTeamsRecoveryRequest,
  type M51BTeamsRecoveryResult,
} from "../../../../contracts/m51b/teams";
import { M51B_APPROVED_TENANT_BOUNDARY } from "../../../../contracts/m51b/shared";
import { evaluateM51BTeamsDispatchPolicy } from "./policy";
import { M51BTeamsRegistry } from "./registry";
import {
  classifyM51BTeamsFailure,
  type M51BTeamsFailureDecision,
  SyntheticM51BTeamsAdapter,
} from "./synthetic-teams-adapter";
import {
  deepFreeze,
  isoAt,
  parseTeamsTimestamp,
  requireTeamsSyntheticId,
  teamsDigest,
} from "./support";

interface DeliveryLedgerEntry {
  requestFingerprint: string;
  request: M51BTeamsDispatchRequest;
  result: M51BTeamsDeliveryResult;
}

interface AcknowledgementLedgerEntry {
  requestFingerprint: string;
  result: M51BTeamsAcknowledgementResult;
}

interface RecoveryLedgerEntry {
  requestFingerprint: string;
  result: M51BTeamsRecoveryResult;
}

function requestFingerprint(request: M51BTeamsDispatchRequest): string {
  return teamsDigest({
    submittedAt: request.submittedAt,
    actor: {
      actorId: request.actor.actorId,
      role: request.actor.role,
      tier: request.actor.tier,
      divisionIds: request.actor.divisionIds,
      permissions: request.actor.permissions,
      synthetic: request.actor.synthetic,
    },
    event: request.event,
  });
}

function acknowledgementFingerprint(
  request: M51BTeamsAcknowledgementRequest,
): string {
  return teamsDigest({
    deliveryId: request.deliveryId,
    messageId: request.messageId,
    acknowledgedAt: request.acknowledgedAt,
    actorId: request.actor.actorId,
    role: request.actor.role,
    tier: request.actor.tier,
  });
}

function recoveryFingerprint(request: M51BTeamsRecoveryRequest): string {
  return teamsDigest({
    deadLetterId: request.deadLetterId,
    replayedAt: request.replayedAt,
    actorId: request.actor.actorId,
    role: request.actor.role,
    tier: request.actor.tier,
  });
}

function timingForDenial(request: M51BTeamsDispatchRequest): M51BTeamsDeliveryTiming {
  return deepFreeze({
    approvedAt: request.event.approvedAt ?? request.event.occurredAt,
    submittedAt: request.submittedAt,
    deliveredAt: null,
    elapsedMilliseconds: null,
    thresholdMilliseconds: M51B_TEAMS_DELIVERY_SLO_MS,
    withinThirtySeconds: false,
    measuredFromTimestamps: true,
  });
}

export class M51BTeamsDeliveryOrchestrator {
  readonly actualSleepCalls = 0 as const;

  private readonly deliveryLedger = new Map<string, DeliveryLedgerEntry>();
  private readonly deliveriesById = new Map<string, M51BTeamsDeliveryResult>();
  private readonly deadLetterRequests = new Map<string, M51BTeamsDispatchRequest>();
  private readonly acknowledgementLedger = new Map<
    string,
    AcknowledgementLedgerEntry
  >();
  private readonly acknowledgementByDeliveryActor = new Map<
    string,
    M51BTeamsAcknowledgementResult
  >();
  private readonly recoveryLedger = new Map<string, RecoveryLedgerEntry>();
  private readonly recoveryByDeadLetter = new Map<string, M51BTeamsRecoveryResult>();
  private readonly deadLetterResolutions = new Map<
    string,
    M51BTeamsDeadLetterResolution
  >();
  private readonly operationalAlertResolutions = new Map<
    string,
    M51BTeamsOperationalAlertResolution
  >();
  private readonly auditLedger: M51BAuditEvent[] = [];

  constructor(
    readonly registry: M51BTeamsRegistry,
    readonly adapter: SyntheticM51BTeamsAdapter,
  ) {}

  private audit(input: {
    eventType: string;
    occurredAt: string;
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    outcome: M51BAuditEvent["outcome"];
    reasonCodes: readonly string[];
  }): M51BAuditEvent {
    const event = deepFreeze({
      eventId: `SYNTH-M51B-TEAMS-AUDIT-${teamsDigest(
        input.eventType,
        input.occurredAt,
        input.actorId,
        input.correlationId,
        input.idempotencyKey,
        input.outcome,
        input.reasonCodes,
        this.auditLedger.length,
      )
        .slice(-20)
        .toUpperCase()}`,
      eventType: input.eventType,
      channel: "teams" as const,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      outcome: input.outcome,
      reasonCodes: [...input.reasonCodes],
      immutable: true as const,
      evidenceClass: M51B_EVIDENCE_CLASS,
      synthetic: true as const,
    });
    this.auditLedger.push(event);
    return event;
  }

  private denialResult(
    request: M51BTeamsDispatchRequest,
    fingerprint: string,
    denialCodes: readonly string[],
    deliveryId: string,
    replayOfDeliveryId: string | null,
  ): M51BTeamsDeliveryResult {
    const audit = this.audit({
      eventType: "teams_delivery_denied",
      occurredAt: request.submittedAt,
      actorId: request.actor.actorId,
      correlationId: deliveryId,
      idempotencyKey: request.idempotencyKey,
      outcome: "denied",
      reasonCodes: denialCodes,
    });
    return deepFreeze({
      deliveryId,
      status: "denied" as const,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: fingerprint,
      replayed: false,
      replayOfDeliveryId,
      destination: null,
      payload: null,
      attempts: [],
      timing: timingForDenial(request),
      denialCodes: [...denialCodes],
      evidence: null,
      deadLetter: null,
      operationalAlert: null,
      auditEvents: [audit],
      synthetic: true as const,
      liveGraphCalls: 0 as const,
      liveTeamsWrites: 0 as const,
      realNotificationsSent: 0 as const,
    });
  }

  async deliver(request: M51BTeamsDispatchRequest): Promise<M51BTeamsDeliveryResult> {
    return this.deliverInternal(request, null);
  }

  private async deliverInternal(
    request: M51BTeamsDispatchRequest,
    replayOfDeliveryId: string | null,
  ): Promise<M51BTeamsDeliveryResult> {
    const fingerprint = requestFingerprint(request);
    const deliveryId = `SYNTH-M51B-TEAMS-DELIVERY-${teamsDigest(
      request.idempotencyKey,
      fingerprint,
    )
      .slice(-20)
      .toUpperCase()}`;
    const existing = this.deliveryLedger.get(request.idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return this.denialResult(
          request,
          fingerprint,
          ["M51B_TEAMS_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"],
          deliveryId,
          replayOfDeliveryId,
        );
      }
      this.audit({
        eventType: "teams_delivery_idempotent_replay",
        occurredAt: request.submittedAt,
        actorId: request.actor.actorId,
        correlationId: existing.result.deliveryId,
        idempotencyKey: request.idempotencyKey,
        outcome: "accepted",
        reasonCodes: ["M51B_TEAMS_EXISTING_LOGICAL_RESULT_RETURNED"],
      });
      return deepFreeze({ ...existing.result, replayed: true });
    }

    const policy = evaluateM51BTeamsDispatchPolicy(request, this.registry);
    if (!policy.allowed || !policy.destination || !policy.payload) {
      const denied = this.denialResult(
        request,
        fingerprint,
        policy.denialCodes,
        deliveryId,
        replayOfDeliveryId,
      );
      this.deliveryLedger.set(request.idempotencyKey, {
        requestFingerprint: fingerprint,
        request,
        result: denied,
      });
      this.deliveriesById.set(deliveryId, denied);
      return denied;
    }

    const auditEvents: M51BAuditEvent[] = [
      this.audit({
        eventType: "teams_delivery_queued",
        occurredAt: request.submittedAt,
        actorId: request.actor.actorId,
        correlationId: deliveryId,
        idempotencyKey: request.idempotencyKey,
        outcome: "queued",
        reasonCodes: [
          "M51B_TEAMS_APPROVED_EVENT",
          "M51B_TEAMS_DESTINATION_RESOLVED",
          "M51B_TEAMS_MENTIONS_VALIDATED",
          "M51B_TEAMS_CONTENT_MINIMIZED",
        ],
      }),
    ];
    const submittedMs = parseTeamsTimestamp(request.submittedAt)!;
    const approvedMs = parseTeamsTimestamp(request.event.approvedAt!)!;
    let virtualClockMs = submittedMs;
    let receipt:
      | ReturnType<SyntheticM51BTeamsAdapter["sendSynthetic"]>
      | null = null;
    let finalFailure: M51BTeamsFailureDecision | null = null;
    const attempts: M51BTeamsDeliveryAttempt[] = [];

    for (let attempt = 1; attempt <= M51B_TEAMS_MAX_ATTEMPTS; attempt += 1) {
      const startedAt = isoAt(virtualClockMs);
      try {
        receipt = this.adapter.sendSynthetic({
          idempotencyKey: request.idempotencyKey,
          requestFingerprint: fingerprint,
          eventId: request.event.eventId,
          destination: policy.destination,
          payload: policy.payload,
          attempt,
          attemptedAt: startedAt,
        });
        attempts.push(
          deepFreeze({
            attempt,
            startedAt,
            completedAt: receipt.deliveredAt,
            outcome: "delivered" as const,
            statusCode: 202,
            errorCode: null,
            scheduledDelayMs: 0,
            retryAfterHonored: false,
            synthetic: true as const,
          }),
        );
        break;
      } catch (error) {
        const failure = classifyM51BTeamsFailure(error, attempt);
        finalFailure = failure;
        const retryable =
          failure.disposition === "retry" && attempt < M51B_TEAMS_MAX_ATTEMPTS;
        attempts.push(
          deepFreeze({
            attempt,
            startedAt,
            completedAt: startedAt,
            outcome: retryable
              ? ("retry_scheduled" as const)
              : failure.disposition === "retry"
                ? ("retry_exhausted" as const)
                : ("hard_failed" as const),
            statusCode: failure.statusCode,
            errorCode: failure.code,
            scheduledDelayMs: retryable ? failure.delayMs : 0,
            retryAfterHonored: retryable && failure.retryAfterHonored,
            synthetic: true as const,
          }),
        );
        if (!retryable) break;
        virtualClockMs += failure.delayMs;
      }
    }

    if (!receipt) {
      const failedAt =
        attempts[attempts.length - 1]?.completedAt ?? request.submittedAt;
      const finalCode =
        finalFailure?.disposition === "retry"
          ? `M51B_TEAMS_RETRY_EXHAUSTED:${finalFailure.code}`
          : finalFailure?.code ?? "M51B_TEAMS_DELIVERY_FAILED";
      const deadLetter: M51BTeamsDeadLetter = deepFreeze({
        deadLetterId: `SYNTH-M51B-TEAMS-DEAD-LETTER-${teamsDigest(
          deliveryId,
          finalCode,
        )
          .slice(-20)
          .toUpperCase()}`,
        deliveryId,
        eventId: request.event.eventId,
        idempotencyKey: request.idempotencyKey,
        requestFingerprint: fingerprint,
        destinationId: policy.destination.destinationId,
        failedAt,
        attempts: attempts.length,
        finalErrorCode: finalCode,
        replayEligible: true,
        immutable: true,
        synthetic: true,
      });
      const alert: M51BTeamsOperationalAlert = deepFreeze({
        alertId: `SYNTH-M51B-TEAMS-ALERT-${teamsDigest(
          deadLetter.deadLetterId,
          finalCode,
        )
          .slice(-20)
          .toUpperCase()}`,
        deliveryId,
        alertType: "delivery_failed",
        openedAt: failedAt,
        reasonCode: finalCode,
        status: "open",
        ownerRole: "administrator",
        immutable: true,
        synthetic: true,
      });
      auditEvents.push(
        this.audit({
          eventType: "teams_delivery_dead_lettered",
          occurredAt: failedAt,
          actorId: request.actor.actorId,
          correlationId: deliveryId,
          idempotencyKey: request.idempotencyKey,
          outcome: "failed",
          reasonCodes: [finalCode, "M51B_TEAMS_OPERATIONAL_ALERT_OPENED"],
        }),
      );
      const result: M51BTeamsDeliveryResult = deepFreeze({
        deliveryId,
        status: "dead_lettered",
        idempotencyKey: request.idempotencyKey,
        requestFingerprint: fingerprint,
        replayed: false,
        replayOfDeliveryId,
        destination: policy.destination,
        payload: policy.payload,
        attempts,
        timing: {
          approvedAt: request.event.approvedAt!,
          submittedAt: request.submittedAt,
          deliveredAt: null,
          elapsedMilliseconds: null,
          thresholdMilliseconds: M51B_TEAMS_DELIVERY_SLO_MS,
          withinThirtySeconds: false,
          measuredFromTimestamps: true,
        },
        denialCodes: [],
        evidence: null,
        deadLetter,
        operationalAlert: alert,
        auditEvents,
        synthetic: true,
        liveGraphCalls: 0,
        liveTeamsWrites: 0,
        realNotificationsSent: 0,
      });
      this.deadLetterRequests.set(deadLetter.deadLetterId, request);
      this.deliveryLedger.set(request.idempotencyKey, {
        requestFingerprint: fingerprint,
        request,
        result,
      });
      this.deliveriesById.set(deliveryId, result);
      return result;
    }

    const deliveredMs = parseTeamsTimestamp(receipt.deliveredAt)!;
    const elapsedMilliseconds = deliveredMs - approvedMs;
    const withinThirtySeconds =
      elapsedMilliseconds >= 0 &&
      elapsedMilliseconds <= M51B_TEAMS_DELIVERY_SLO_MS;
    const timing: M51BTeamsDeliveryTiming = deepFreeze({
      approvedAt: request.event.approvedAt!,
      submittedAt: request.submittedAt,
      deliveredAt: receipt.deliveredAt,
      elapsedMilliseconds,
      thresholdMilliseconds: M51B_TEAMS_DELIVERY_SLO_MS,
      withinThirtySeconds,
      measuredFromTimestamps: true,
    });
    const evidence = deepFreeze({
      evidenceId: `SYNTH-M51B-TEAMS-EVIDENCE-${teamsDigest(
        deliveryId,
        receipt.messageId,
        receipt.contentHash,
      )
        .slice(-20)
        .toUpperCase()}`,
      deliveryId,
      eventId: request.event.eventId,
      messageId: receipt.messageId,
      requestFingerprint: fingerprint,
      tenantId: M51B_APPROVED_TENANT_BOUNDARY,
      destinationId: policy.destination.destinationId,
      teamId: policy.destination.teamId,
      channelId: policy.destination.channelId,
      contentHash: receipt.contentHash,
      recipientActorIds: policy.payload.mentions.map((mention) => mention.actorId),
      mentionIds: policy.payload.mentions.map((mention) => mention.mentionId),
      requestedAt: request.submittedAt,
      deliveredAt: receipt.deliveredAt,
      elapsedMilliseconds,
      attempts: attempts.length,
      acknowledgementRequired: true as const,
      contentMinimized: true as const,
      mentionsValidated: true as const,
      destinationResolved: true as const,
      immutable: true as const,
      synthetic: true as const,
      liveGraphCalls: 0 as const,
      liveTeamsWrites: 0 as const,
      realNotificationsSent: 0 as const,
    });
    const alert: M51BTeamsOperationalAlert | null = withinThirtySeconds
      ? null
      : deepFreeze({
          alertId: `SYNTH-M51B-TEAMS-ALERT-${teamsDigest(
            deliveryId,
            "SLO",
          )
            .slice(-20)
            .toUpperCase()}`,
          deliveryId,
          alertType: "delivery_slo_breached",
          openedAt: receipt.deliveredAt,
          reasonCode: "M51B_TEAMS_DELIVERY_SLO_BREACHED",
          status: "open",
          ownerRole: "administrator",
          immutable: true,
          synthetic: true,
        });
    auditEvents.push(
      this.audit({
        eventType: withinThirtySeconds
          ? "teams_delivery_completed"
          : "teams_delivery_slo_breached",
        occurredAt: receipt.deliveredAt,
        actorId: request.actor.actorId,
        correlationId: deliveryId,
        idempotencyKey: request.idempotencyKey,
        outcome: withinThirtySeconds ? "delivered" : "failed",
        reasonCodes: withinThirtySeconds
          ? ["M51B_TEAMS_DELIVERED_WITHIN_30_SECONDS"]
          : ["M51B_TEAMS_DELIVERY_SLO_BREACHED"],
      }),
    );
    const result: M51BTeamsDeliveryResult = deepFreeze({
      deliveryId,
      status: withinThirtySeconds ? "delivered" : "delivered_late",
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: fingerprint,
      replayed: false,
      replayOfDeliveryId,
      destination: policy.destination,
      payload: policy.payload,
      attempts,
      timing,
      denialCodes: [],
      evidence,
      deadLetter: null,
      operationalAlert: alert,
      auditEvents,
      synthetic: true,
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
    });
    this.deliveryLedger.set(request.idempotencyKey, {
      requestFingerprint: fingerprint,
      request,
      result,
    });
    this.deliveriesById.set(deliveryId, result);
    return result;
  }

  async acknowledge(
    request: M51BTeamsAcknowledgementRequest,
  ): Promise<M51BTeamsAcknowledgementResult> {
    const fingerprint = acknowledgementFingerprint(request);
    const existing = this.acknowledgementLedger.get(request.idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return this.acknowledgementDenial(request, [
          "M51B_TEAMS_ACK_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
        ]);
      }
      return deepFreeze({ ...existing.result, replayed: true });
    }

    const codes: string[] = [];
    try {
      requireTeamsSyntheticId(request.idempotencyKey, "ack_idempotency_key");
      requireTeamsSyntheticId(request.deliveryId, "ack_delivery");
      requireTeamsSyntheticId(request.messageId, "ack_message");
    } catch (error) {
      codes.push(error instanceof Error ? error.message : "M51B_TEAMS_ACK_ID_INVALID");
    }
    const delivery = this.deliveriesById.get(request.deliveryId);
    if (!delivery?.evidence) codes.push("M51B_TEAMS_ACK_DELIVERY_NOT_FOUND");
    const identity = this.registry.resolveIdentityByActor(request.actor.actorId);
    if (
      !identity ||
      identity.status !== "active" ||
      identity.identityKind !== "member" ||
      identity.tenantId !== M51B_APPROVED_TENANT_BOUNDARY ||
      identity.role !== request.actor.role ||
      identity.tier !== request.actor.tier ||
      !request.actor.divisionIds.includes(identity.divisionId)
    ) {
      codes.push("M51B_TEAMS_ACK_ACTOR_IDENTITY_DENIED");
    }
    if (delivery?.evidence) {
      if (delivery.evidence.messageId !== request.messageId) {
        codes.push("M51B_TEAMS_ACK_MESSAGE_MISMATCH");
      }
      if (!delivery.evidence.recipientActorIds.includes(request.actor.actorId)) {
        codes.push("M51B_TEAMS_ACK_NON_RECIPIENT_DENIED");
      }
    }
    const acknowledgedMs = parseTeamsTimestamp(request.acknowledgedAt);
    const deliveredMs = delivery?.evidence
      ? parseTeamsTimestamp(delivery.evidence.deliveredAt)
      : null;
    if (acknowledgedMs === null || deliveredMs === null) {
      codes.push("M51B_TEAMS_ACK_TIMESTAMP_INVALID");
    } else if (
      acknowledgedMs < deliveredMs ||
      acknowledgedMs - deliveredMs > M51B_TEAMS_ACKNOWLEDGEMENT_SLO_MS
    ) {
      codes.push("M51B_TEAMS_ACK_WINDOW_DENIED");
    }
    const uniqueCodes = [...new Set(codes)].sort();
    if (uniqueCodes.length > 0 || !delivery?.evidence || !identity) {
      const denied = this.acknowledgementDenial(request, uniqueCodes);
      this.acknowledgementLedger.set(request.idempotencyKey, {
        requestFingerprint: fingerprint,
        result: denied,
      });
      return denied;
    }

    const duplicateKey = `${request.deliveryId}|${request.actor.actorId}`;
    const duplicate = this.acknowledgementByDeliveryActor.get(duplicateKey);
    if (duplicate) {
      const replay = deepFreeze({ ...duplicate, replayed: true });
      this.acknowledgementLedger.set(request.idempotencyKey, {
        requestFingerprint: fingerprint,
        result: replay,
      });
      return replay;
    }
    const elapsed = parseTeamsTimestamp(request.acknowledgedAt)! -
      parseTeamsTimestamp(delivery.evidence.deliveredAt)!;
    const evidence = deepFreeze({
      acknowledgementId: `SYNTH-M51B-TEAMS-ACK-${teamsDigest(
        request.deliveryId,
        request.actor.actorId,
        request.acknowledgedAt,
      )
        .slice(-20)
        .toUpperCase()}`,
      deliveryId: request.deliveryId,
      messageId: request.messageId,
      actorId: request.actor.actorId,
      acknowledgedAt: request.acknowledgedAt,
      elapsedFromDeliveryMilliseconds: elapsed,
      withinAcknowledgementWindow: true,
      immutable: true as const,
      synthetic: true as const,
      liveGraphCalls: 0 as const,
      liveTeamsWrites: 0 as const,
      realNotificationsSent: 0 as const,
    });
    const audit = this.audit({
      eventType: "teams_delivery_acknowledged",
      occurredAt: request.acknowledgedAt,
      actorId: request.actor.actorId,
      correlationId: request.deliveryId,
      idempotencyKey: request.idempotencyKey,
      outcome: "accepted",
      reasonCodes: ["M51B_TEAMS_INTENDED_RECIPIENT_ACKNOWLEDGED"],
    });
    const result: M51BTeamsAcknowledgementResult = deepFreeze({
      status: "acknowledged",
      replayed: false,
      denialCodes: [],
      evidence,
      auditEvents: [audit],
      synthetic: true,
    });
    this.acknowledgementLedger.set(request.idempotencyKey, {
      requestFingerprint: fingerprint,
      result,
    });
    this.acknowledgementByDeliveryActor.set(duplicateKey, result);
    return result;
  }

  private acknowledgementDenial(
    request: M51BTeamsAcknowledgementRequest,
    denialCodes: readonly string[],
  ): M51BTeamsAcknowledgementResult {
    const audit = this.audit({
      eventType: "teams_acknowledgement_denied",
      occurredAt: request.acknowledgedAt,
      actorId: request.actor.actorId,
      correlationId: request.deliveryId,
      idempotencyKey: request.idempotencyKey,
      outcome: "denied",
      reasonCodes: denialCodes,
    });
    return deepFreeze({
      status: "denied",
      replayed: false,
      denialCodes: [...denialCodes],
      evidence: null,
      auditEvents: [audit],
      synthetic: true,
    });
  }

  async recoverDeadLetter(
    request: M51BTeamsRecoveryRequest,
  ): Promise<M51BTeamsRecoveryResult> {
    const fingerprint = recoveryFingerprint(request);
    const existing = this.recoveryLedger.get(request.recoveryIdempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return deepFreeze({
          status: "denied",
          replayed: false,
          denialCodes: ["M51B_TEAMS_RECOVERY_IDEMPOTENCY_PAYLOAD_MISMATCH"],
          delivery: null,
          evidence: null,
          synthetic: true,
        });
      }
      return deepFreeze({ ...existing.result, replayed: true });
    }
    const priorRecovery = this.recoveryByDeadLetter.get(request.deadLetterId);
    if (priorRecovery) {
      const replay = deepFreeze({ ...priorRecovery, replayed: true });
      this.recoveryLedger.set(request.recoveryIdempotencyKey, {
        requestFingerprint: fingerprint,
        result: replay,
      });
      return replay;
    }

    const denialCodes: string[] = [];
    try {
      requireTeamsSyntheticId(request.deadLetterId, "recovery_dead_letter");
      requireTeamsSyntheticId(
        request.recoveryIdempotencyKey,
        "recovery_idempotency_key",
      );
    } catch (error) {
      denialCodes.push(
        error instanceof Error ? error.message : "M51B_TEAMS_RECOVERY_ID_INVALID",
      );
    }
    const original = this.deadLetterRequests.get(request.deadLetterId);
    if (!original) denialCodes.push("M51B_TEAMS_DEAD_LETTER_NOT_FOUND");
    const replayedAt = parseTeamsTimestamp(request.replayedAt);
    if (replayedAt === null) denialCodes.push("M51B_TEAMS_RECOVERY_TIME_INVALID");
    const identity = this.registry.resolveIdentityByActor(request.actor.actorId);
    if (
      !identity ||
      identity.status !== "active" ||
      identity.identityKind !== "member" ||
      identity.tenantId !== M51B_APPROVED_TENANT_BOUNDARY ||
      identity.role !== request.actor.role ||
      identity.tier !== request.actor.tier ||
      !["T1", "T2"].includes(request.actor.tier) ||
      !request.actor.permissions.includes("m51a:pilot:review")
    ) {
      denialCodes.push("M51B_TEAMS_RECOVERY_OPERATOR_DENIED");
    }
    const uniqueCodes = [...new Set(denialCodes)].sort();
    if (uniqueCodes.length > 0 || !original || replayedAt === null) {
      const denied: M51BTeamsRecoveryResult = deepFreeze({
        status: "denied",
        replayed: false,
        denialCodes: uniqueCodes,
        delivery: null,
        evidence: null,
        synthetic: true,
      });
      this.recoveryLedger.set(request.recoveryIdempotencyKey, {
        requestFingerprint: fingerprint,
        result: denied,
      });
      return denied;
    }

    const recoveredDelivery = await this.deliverInternal(
      deepFreeze({
        ...original,
        idempotencyKey: request.recoveryIdempotencyKey,
        submittedAt: request.replayedAt,
      }),
      this.deliveryLedger.get(original.idempotencyKey)!.result.deliveryId,
    );
    const recovered =
      recoveredDelivery.status === "delivered" ||
      recoveredDelivery.status === "delivered_late";
    const originalDeliveryId = recoveredDelivery.replayOfDeliveryId;
    const originalDelivery = originalDeliveryId
      ? this.deliveriesById.get(originalDeliveryId)
      : null;
    const originalAlert = originalDelivery?.operationalAlert ?? null;
    const recoveryEvidenceId = `SYNTH-M51B-TEAMS-RECOVERY-${teamsDigest(
      request.deadLetterId,
      recoveredDelivery.deliveryId,
    )
      .slice(-20)
      .toUpperCase()}`;
    const deadLetterResolutionId = `SYNTH-M51B-TEAMS-DLQ-RESOLUTION-${teamsDigest(
      request.deadLetterId,
      recoveredDelivery.deliveryId,
    )
      .slice(-20)
      .toUpperCase()}`;
    const operationalAlertResolutionId = `SYNTH-M51B-TEAMS-ALERT-RESOLUTION-${teamsDigest(
      originalAlert?.alertId ?? request.deadLetterId,
      recoveredDelivery.deliveryId,
    )
      .slice(-20)
      .toUpperCase()}`;
    const evidence = recovered && originalDeliveryId && originalAlert
      ? deepFreeze({
          recoveryEvidenceId,
          deadLetterId: request.deadLetterId,
          originalDeliveryId,
          recoveredDeliveryId: recoveredDelivery.deliveryId,
          recoveredAt: recoveredDelivery.evidence!.deliveredAt,
          recoveredByActorId: request.actor.actorId,
          deadLetterResolutionId,
          operationalAlertResolutionId,
          resolvedOperationalAlertId: originalAlert.alertId,
          duplicateNotificationCreated: false as const,
          immutable: true as const,
          synthetic: true as const,
        })
      : null;
    if (recovered && evidence && originalAlert) {
      const deadLetterResolution: M51BTeamsDeadLetterResolution = deepFreeze({
        resolutionId: evidence.deadLetterResolutionId,
        deadLetterId: request.deadLetterId,
        originalDeliveryId: evidence.originalDeliveryId,
        recoveredDeliveryId: evidence.recoveredDeliveryId,
        recoveryEvidenceId: evidence.recoveryEvidenceId,
        resolvedAt: evidence.recoveredAt,
        resolvedByActorId: evidence.recoveredByActorId,
        status: "recovered",
        immutable: true,
        synthetic: true,
      });
      const alertResolution: M51BTeamsOperationalAlertResolution = deepFreeze({
        resolutionId: evidence.operationalAlertResolutionId,
        alertId: originalAlert.alertId,
        deadLetterId: request.deadLetterId,
        originalDeliveryId: evidence.originalDeliveryId,
        recoveredDeliveryId: evidence.recoveredDeliveryId,
        recoveryEvidenceId: evidence.recoveryEvidenceId,
        acknowledgedAt: evidence.recoveredAt,
        acknowledgedByActorId: evidence.recoveredByActorId,
        resolvedAt: evidence.recoveredAt,
        resolvedByActorId: evidence.recoveredByActorId,
        status: "resolved",
        immutable: true,
        synthetic: true,
      });
      this.deadLetterResolutions.set(request.deadLetterId, deadLetterResolution);
      this.operationalAlertResolutions.set(originalAlert.alertId, alertResolution);
      this.audit({
        eventType: "teams_dead_letter_recovered",
        occurredAt: evidence.recoveredAt,
        actorId: request.actor.actorId,
        correlationId: recoveredDelivery.deliveryId,
        idempotencyKey: request.recoveryIdempotencyKey,
        outcome: "recovered",
        reasonCodes: [
          "M51B_TEAMS_ACCOUNTABLE_REPLAY_RECOVERED",
          "M51B_TEAMS_DEAD_LETTER_RESOLVED",
          "M51B_TEAMS_OPERATIONAL_ALERT_ACKNOWLEDGED_AND_RESOLVED",
        ],
      });
    }
    const result: M51BTeamsRecoveryResult = deepFreeze({
      status: recovered ? "recovered" : "denied",
      replayed: false,
      denialCodes: recovered
        ? []
        : ["M51B_TEAMS_RECOVERY_DELIVERY_FAILED"],
      delivery: recoveredDelivery,
      evidence,
      synthetic: true,
    });
    this.recoveryLedger.set(request.recoveryIdempotencyKey, {
      requestFingerprint: fingerprint,
      result,
    });
    if (recovered) this.recoveryByDeadLetter.set(request.deadLetterId, result);
    return result;
  }

  getDelivery(deliveryId: string): M51BTeamsDeliveryResult | null {
    return this.deliveriesById.get(deliveryId) ?? null;
  }

  listDeadLetters(): readonly M51BTeamsDeadLetterSnapshot[] {
    return deepFreeze(
      [...this.deliveriesById.values()]
        .map((delivery) => delivery.deadLetter)
        .filter((item): item is M51BTeamsDeadLetter => item !== null)
        .map((deadLetter) => {
          const resolution =
            this.deadLetterResolutions.get(deadLetter.deadLetterId) ?? null;
          return deepFreeze({
            ...deadLetter,
            operationalStatus: resolution ? "recovered" as const : "open" as const,
            active: resolution === null,
            resolution,
          });
        })
        .sort((left, right) => left.deadLetterId.localeCompare(right.deadLetterId)),
    );
  }

  listActiveDeadLetters(): readonly M51BTeamsDeadLetterSnapshot[] {
    return deepFreeze(this.listDeadLetters().filter((item) => item.active));
  }

  listOperationalAlerts(): readonly M51BTeamsOperationalAlertSnapshot[] {
    return deepFreeze(
      [...this.deliveriesById.values()]
        .map((delivery) => delivery.operationalAlert)
        .filter((item): item is M51BTeamsOperationalAlert => item !== null)
        .map((alert) => {
          const resolution =
            this.operationalAlertResolutions.get(alert.alertId) ?? null;
          return deepFreeze({
            alertId: alert.alertId,
            deliveryId: alert.deliveryId,
            alertType: alert.alertType,
            openedAt: alert.openedAt,
            reasonCode: alert.reasonCode,
            ownerRole: alert.ownerRole,
            immutable: alert.immutable,
            synthetic: alert.synthetic,
            originalStatus: alert.status,
            status: resolution ? "resolved" as const : "open" as const,
            active: resolution === null,
            acknowledgedAt: resolution?.acknowledgedAt ?? null,
            acknowledgedByActorId: resolution?.acknowledgedByActorId ?? null,
            resolvedAt: resolution?.resolvedAt ?? null,
            resolvedByActorId: resolution?.resolvedByActorId ?? null,
            resolution,
          });
        })
        .sort((left, right) => left.alertId.localeCompare(right.alertId)),
    );
  }

  listOpenOperationalAlerts(): readonly M51BTeamsOperationalAlertSnapshot[] {
    return deepFreeze(this.listOperationalAlerts().filter((item) => item.active));
  }

  getOperationalStateSnapshot(): M51BTeamsOperationalStateSnapshot {
    const deadLetters = this.listDeadLetters();
    const alerts = this.listOperationalAlerts();
    const activeDeadLetters = deadLetters.filter((item) => item.active).length;
    const openAlerts = alerts.filter((item) => item.active).length;
    return deepFreeze({
      deadLetters,
      alerts,
      totalDeadLetters: deadLetters.length,
      activeDeadLetters,
      recoveredDeadLetters: deadLetters.length - activeDeadLetters,
      totalAlerts: alerts.length,
      openAlerts,
      resolvedAlerts: alerts.length - openAlerts,
      generatedAt:
        this.auditLedger[this.auditLedger.length - 1]?.occurredAt ??
        M51B_EVALUATION_STARTED_AT,
      immutable: true,
      synthetic: true,
    });
  }

  listAuditEvents(): readonly M51BAuditEvent[] {
    return deepFreeze([...this.auditLedger]);
  }
}
