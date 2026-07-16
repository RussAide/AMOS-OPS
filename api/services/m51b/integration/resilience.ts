import { isUserRole } from "@/constants/roles";
import type {
  M51BAdapterAttempt,
  M51BAttemptEvidence,
  M51BDeadLetterRecord,
  M51BFailureClass,
  M51BOperationalAlert,
  M51BReconciliationResult,
  M51BReliabilityRequest,
  M51BReliabilityResult,
  M51BReliabilitySnapshot,
  M51BReplayAuthorization,
} from "@contracts/m51b/reliability";
import {
  M51B_EVALUATION_STARTED_AT,
  M51B_EVIDENCE_CLASS,
  type M51BAuditEvent,
} from "@contracts/m51b/shared";

const RETRYABLE_FAILURES = new Set<M51BFailureClass>([
  "throttle",
  "transient",
]);
const MAXIMUM_ATTEMPTS = 4 as const;
const REPLAY_ROLES = new Set([
  "administrator",
  "managing-director",
  "hr-compliance-officer",
]);

function requireSyntheticIdentifier(value: string, label: string): void {
  if (!value.startsWith("SYNTH-") || value.trim().length < 10)
    throw new Error(`M51B_${label.toUpperCase()}_MUST_BE_SYNTHETIC`);
}

function audit(
  request: M51BReliabilityRequest,
  suffix: string,
  outcome: M51BAuditEvent["outcome"],
  reasonCodes: readonly string[],
): M51BAuditEvent {
  return Object.freeze({
    eventId: `SYNTH-M51B-AUDIT-${request.operationId}-${suffix}`,
    eventType: `m51b.integration.${suffix.toLowerCase()}`,
    channel: request.channel,
    occurredAt: M51B_EVALUATION_STARTED_AT,
    actorId: request.actorId,
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    outcome,
    reasonCodes: Object.freeze([...reasonCodes]),
    immutable: true,
    evidenceClass: M51B_EVIDENCE_CLASS,
    synthetic: true,
  });
}

function immutableResult<T>(
  value: M51BReliabilityResult<T>,
): Readonly<M51BReliabilityResult<T>> {
  Object.freeze(value.attempts);
  Object.freeze(value.auditEvents);
  return Object.freeze(value);
}

export class M51BReliabilityCoordinator {
  private readonly deliveryLedger = new Map<
    string,
    Readonly<{
      payloadFingerprint: string;
      result: Readonly<M51BReliabilityResult<unknown>>;
    }>
  >();
  private readonly deadLetters = new Map<string, M51BDeadLetterRecord>();
  private readonly alerts = new Map<string, M51BOperationalAlert>();

  execute<T>(
    request: M51BReliabilityRequest,
    adapter: (attempt: number) => M51BAdapterAttempt<T>,
  ): Readonly<M51BReliabilityResult<T>> {
    this.validateRequest(request);
    const ledgerEntry = this.deliveryLedger.get(request.idempotencyKey);
    if (ledgerEntry) {
      const existing = ledgerEntry.result;
      if (existing.channel !== request.channel)
        throw new Error("M51B_IDEMPOTENCY_CHANNEL_MISMATCH");
      if (ledgerEntry.payloadFingerprint !== request.payloadFingerprint)
        return this.deadLetter(
          request,
          [],
          "conflict",
          "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
        );
      return immutableResult({
        operationId: existing.operationId,
        channel: request.channel,
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey,
        status: "duplicate_suppressed",
        value: existing.value as T | null,
        attempts: [],
        duplicateSuppressed: true,
        replayed: true,
        deadLetterId: null,
        alertId: null,
        auditEvents: [
          audit(request, "DUPLICATE_SUPPRESSED", "accepted", [
            "M51B_IDEMPOTENT_RESULT_REUSED",
          ]),
        ],
        liveCalls: 0,
        liveWrites: 0,
        synthetic: true,
      });
    }

    const attempts: M51BAttemptEvidence[] = [];
    let latestFailure: M51BFailureClass = "validation";
    let latestReason = "M51B_ADAPTER_INVALID_RESULT";

    for (let attempt = 1; attempt <= MAXIMUM_ATTEMPTS; attempt += 1) {
      const response = adapter(attempt);
      if (response.ok) {
        const result = immutableResult({
          operationId: request.operationId,
          channel: request.channel,
          correlationId: request.correlationId,
          idempotencyKey: request.idempotencyKey,
          status: "delivered",
          value: response.value ?? null,
          attempts: [
            ...attempts,
            {
              attempt,
              failureClass: null,
              reasonCode: "M51B_ADAPTER_DELIVERED",
              retryScheduled: false,
              synthetic: true,
            },
          ],
          duplicateSuppressed: false,
          replayed: false,
          deadLetterId: null,
          alertId: null,
          auditEvents: [
            audit(request, "DELIVERED", "delivered", [
              "M51B_IDEMPOTENT_DELIVERY_RECORDED",
            ]),
          ],
          liveCalls: 0,
          liveWrites: 0,
          synthetic: true,
        });
        this.deliveryLedger.set(
          request.idempotencyKey,
          Object.freeze({
            payloadFingerprint: request.payloadFingerprint,
            result,
          }),
        );
        return result;
      }

      latestFailure = response.failureClass ?? "validation";
      latestReason = response.reasonCode ?? "M51B_ADAPTER_FAILURE_UNCLASSIFIED";
      const retryScheduled =
        RETRYABLE_FAILURES.has(latestFailure) && attempt < MAXIMUM_ATTEMPTS;
      attempts.push({
        attempt,
        failureClass: latestFailure,
        reasonCode: latestReason,
        retryScheduled,
        synthetic: true,
      });
      if (!retryScheduled) break;
    }

    return this.deadLetter(request, attempts, latestFailure, latestReason);
  }

  replay<T>(
    deadLetterId: string,
    authorization: M51BReplayAuthorization,
    adapter: (attempt: number) => M51BAdapterAttempt<T>,
  ): Readonly<M51BReliabilityResult<T>> {
    const record = this.deadLetters.get(deadLetterId);
    if (!record) throw new Error("M51B_DEAD_LETTER_NOT_FOUND");
    if (record.state !== "open")
      throw new Error("M51B_DEAD_LETTER_ALREADY_RESOLVED");
    if (!record.replayEligible)
      throw new Error("M51B_DEAD_LETTER_NOT_REPLAY_ELIGIBLE");
    if (
      !authorization.synthetic ||
      !authorization.failureCorrected ||
      !authorization.privacyAndPermissionRevalidated ||
      !isUserRole(authorization.authorizedRole) ||
      !REPLAY_ROLES.has(authorization.authorizedRole)
    )
      throw new Error("M51B_REPLAY_AUTHORIZATION_DENIED");
    requireSyntheticIdentifier(authorization.authorizedBy, "replay_actor");

    const replayRequest: M51BReliabilityRequest = {
      ...record.request,
      operationId: `${record.request.operationId}-REPLAY`,
      actorId: authorization.authorizedBy,
      requestedAt: authorization.authorizedAt,
    };
    const result = this.execute(replayRequest, adapter);
    if (result.status !== "delivered") return result;

    record.state = "recovered";
    record.recoveredAt = authorization.authorizedAt;
    record.recoveryOperationId = result.operationId;
    const recovered = immutableResult({
      ...result,
      status: "recovered",
      replayed: true,
      deadLetterId,
      alertId: this.alertId(deadLetterId),
      auditEvents: [
        ...result.auditEvents,
        audit(replayRequest, "DEAD_LETTER_RECOVERED", "recovered", [
          "M51B_AUTHORIZED_REPLAY_SUCCEEDED",
        ]),
      ],
    });
    this.deliveryLedger.set(
      record.request.idempotencyKey,
      Object.freeze({
        payloadFingerprint: record.request.payloadFingerprint,
        result: recovered,
      }),
    );
    return recovered;
  }

  reconcile(
    expectedOperationIds: readonly string[],
  ): Readonly<M51BReconciliationResult> {
    const delivered = [...this.deliveryLedger.values()].map(
      ({ result }) => result.operationId,
    );
    const deadLetterRecords = [...this.deadLetters.values()];
    const open = deadLetterRecords
      .filter((record) => record.state === "open")
      .map((record) => record.request.operationId);
    const observed = new Set([
      ...delivered,
      ...deadLetterRecords.map((record) => record.request.operationId),
    ]);
    const missing = expectedOperationIds.filter((id) => !observed.has(id));
    const result: M51BReconciliationResult = {
      expectedOperationIds: Object.freeze([...expectedOperationIds]),
      deliveredOperationIds: Object.freeze(delivered),
      openDeadLetterOperationIds: Object.freeze(open),
      missingOperationIds: Object.freeze(missing),
      duplicateDeliveries: Object.freeze([]),
      alertsRaised: this.alerts.size,
      accepted: missing.length === 0,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    };
    return Object.freeze(result);
  }

  snapshot(): Readonly<M51BReliabilitySnapshot> {
    const records = [...this.deadLetters.values()];
    return Object.freeze({
      delivered: this.deliveryLedger.size,
      openDeadLetters: records.filter((record) => record.state === "open").length,
      recoveredDeadLetters: records.filter((record) => record.state === "recovered")
        .length,
      alertsRaised: this.alerts.size,
      duplicateDeliveries: 0,
      maximumAttempts: MAXIMUM_ATTEMPTS,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  listDeadLetters(): readonly Readonly<M51BDeadLetterRecord>[] {
    return Object.freeze(
      [...this.deadLetters.values()].map((record) =>
        Object.freeze({ ...record, request: Object.freeze({ ...record.request }) }),
      ),
    );
  }

  listAlerts(): readonly Readonly<M51BOperationalAlert>[] {
    return Object.freeze([...this.alerts.values()]);
  }

  private validateRequest(request: M51BReliabilityRequest): void {
    if (!request.synthetic) throw new Error("M51B_REAL_OPERATION_DENIED");
    requireSyntheticIdentifier(request.operationId, "operation_id");
    requireSyntheticIdentifier(request.correlationId, "correlation_id");
    requireSyntheticIdentifier(request.idempotencyKey, "idempotency_key");
    requireSyntheticIdentifier(request.actorId, "actor_id");
    requireSyntheticIdentifier(request.payloadFingerprint, "payload_fingerprint");
  }

  private deadLetter<T>(
    request: M51BReliabilityRequest,
    attempts: readonly M51BAttemptEvidence[],
    failureClass: M51BFailureClass,
    reasonCode: string,
  ): Readonly<M51BReliabilityResult<T>> {
    const existing = [...this.deadLetters.values()].find(
      (record) =>
        record.state === "open" &&
        record.request.operationId === request.operationId &&
        record.request.channel === request.channel &&
        record.request.idempotencyKey === request.idempotencyKey &&
        record.request.payloadFingerprint === request.payloadFingerprint &&
        record.failureClass === failureClass &&
        record.reasonCode === reasonCode,
    );
    if (existing) {
      const existingAlertId = this.alertId(existing.deadLetterId);
      return immutableResult({
        operationId: existing.request.operationId,
        channel: existing.request.channel,
        correlationId: existing.request.correlationId,
        idempotencyKey: existing.request.idempotencyKey,
        status: "dead_lettered",
        value: null,
        attempts: [...attempts],
        duplicateSuppressed: true,
        replayed: false,
        deadLetterId: existing.deadLetterId,
        alertId: existingAlertId,
        auditEvents: [
          audit(existing.request, "DEAD_LETTER_DUPLICATE_SUPPRESSED", "failed", [
            existing.reasonCode,
            "M51B_DEAD_LETTER_COLLISION_SUPPRESSED",
          ]),
        ],
        liveCalls: 0,
        liveWrites: 0,
        synthetic: true,
      });
    }

    const deadLetterId = this.nextDeadLetterId(request.operationId);
    const alertId = this.alertId(deadLetterId);
    const record: M51BDeadLetterRecord = {
      deadLetterId,
      request: Object.freeze({ ...request }),
      failedAt: M51B_EVALUATION_STARTED_AT,
      failureClass,
      reasonCode,
      attempts: attempts.length,
      replayEligible: reasonCode !== "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
      state: "open",
      recoveredAt: null,
      recoveryOperationId: null,
      immutableOriginalFailure: true,
      synthetic: true,
    };
    this.deadLetters.set(deadLetterId, record);
    this.alerts.set(
      alertId,
      Object.freeze({
        alertId,
        channel: request.channel,
        correlationId: request.correlationId,
        deadLetterId,
        severity: "high",
        escalationQueue: `SYNTH-QUEUE-M51B-${request.channel.toUpperCase()}-SUPPORT`,
        reasonCode,
        acknowledged: false,
        synthetic: true,
      }),
    );
    return immutableResult({
      operationId: request.operationId,
      channel: request.channel,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      status: "dead_lettered",
      value: null,
      attempts: [...attempts],
      duplicateSuppressed: false,
      replayed: false,
      deadLetterId,
      alertId,
      auditEvents: [
        audit(request, "DEAD_LETTERED", "failed", [
          reasonCode,
          "M51B_OPERATIONAL_ALERT_RAISED",
        ]),
      ],
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  private alertId(deadLetterId: string): string {
    return `${deadLetterId}-ALERT`;
  }

  private nextDeadLetterId(operationId: string): string {
    const baseId = `SYNTH-M51B-DLQ-${operationId}`;
    if (!this.deadLetters.has(baseId)) return baseId;
    let collision = 2;
    while (this.deadLetters.has(`${baseId}-COLLISION-${collision}`))
      collision += 1;
    return `${baseId}-COLLISION-${collision}`;
  }
}
