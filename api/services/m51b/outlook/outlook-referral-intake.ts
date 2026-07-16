import { createHash } from "node:crypto";
import type {
  M51BOutlookAttemptEvidence,
  M51BOutlookDeadLetterRecord,
  M51BOutlookExceptionQueue,
  M51BOutlookExceptionRecord,
  M51BOutlookIntakeRecord,
  M51BOutlookPolicyDecision,
  M51BOutlookProcessingResult,
  M51BOutlookReasonCode,
  M51BOutlookRecoveryActor,
  M51BOutlookReferralEnvelope,
  M51BOutlookSenderAllowlistEntry,
  M51BOutlookServiceSnapshot,
  M51BOutlookSyntheticAttemptOutcome,
} from "@contracts/m51b/outlook";
import {
  M51B_OUTLOOK_MAX_ATTEMPTS,
  M51B_OUTLOOK_RECOVERY_PERMISSION,
  M51B_OUTLOOK_RETRY_DELAYS_MS,
} from "@contracts/m51b/outlook";
import type { M51BAuditEvent } from "@contracts/m51b/shared";
import { M51B_EVIDENCE_CLASS } from "@contracts/m51b/shared";
import { evaluateM51BOutlookReferralPolicy } from "./outlook-referral-policy";
import { createSyntheticM51BOutlookSenderAllowlist } from "./synthetic-outlook-fixtures";

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

function deterministicId(prefix: string, ...parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  return `${prefix}-${digest}`;
}

function stringPart(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function virtualTime(base: string, offsetMs: number): string {
  const parsed = Date.parse(base);
  const safeBase = Number.isFinite(parsed)
    ? parsed
    : Date.parse("2026-07-15T12:00:00.000Z");
  return new Date(safeBase + offsetMs).toISOString();
}

interface ProcessingIdentity {
  messageId: string;
  referralReference: string | null;
  payloadFingerprint: string;
  idempotencyKey: string;
  correlationId: string;
  operationId: string;
}

function deriveIdentity(
  envelope: M51BOutlookReferralEnvelope,
): ProcessingIdentity {
  const messageId = stringPart(envelope?.messageId, "SYNTH-M51B-MISSING-MESSAGE");
  const internetMessageId = stringPart(
    envelope?.internetMessageId,
    "SYNTH-M51B-MISSING-INTERNET-MESSAGE",
  );
  const referralReference =
    typeof envelope?.referral?.referralReference === "string"
      ? envelope.referral.referralReference
      : null;
  const payloadFingerprint = fingerprint(envelope);
  const idempotencyKey = deterministicId(
    "SYNTH-M51B-OUTLOOK-IDEMPOTENCY",
    messageId,
    internetMessageId,
    stringPart(envelope?.context?.workflowId, "MISSING-WORKFLOW"),
  );
  const correlationId = deterministicId(
    "SYNTH-M51B-OUTLOOK-CORRELATION",
    messageId,
    internetMessageId,
    referralReference ?? "MISSING-REFERRAL",
  );
  return {
    messageId,
    referralReference,
    payloadFingerprint,
    idempotencyKey,
    correlationId,
    operationId: deterministicId(
      "SYNTH-M51B-OUTLOOK-OPERATION",
      idempotencyKey,
      payloadFingerprint,
    ),
  };
}

function queueForReasons(
  reasons: readonly M51BOutlookReasonCode[],
): M51BOutlookExceptionQueue {
  if (
    reasons.some((reason) =>
      [
        "M51B_OUTLOOK_IDEMPOTENCY_PAYLOAD_MISMATCH",
        "M51B_OUTLOOK_RECOVERY_ACTOR_DENIED",
        "M51B_OUTLOOK_DEAD_LETTER_PAYLOAD_MISMATCH",
      ].includes(reason),
    )
  ) {
    return "integration_security";
  }
  if (
    reasons.some((reason) =>
      [
        "M51B_OUTLOOK_RETRY_EXHAUSTED",
        "M51B_OUTLOOK_ADAPTER_PERMANENT_FAILURE",
      ].includes(reason),
    )
  ) {
    return "outlook_dead_letter";
  }
  if (
    reasons.some((reason) =>
      [
        "M51B_OUTLOOK_SENDER_NOT_ALLOWLISTED",
        "M51B_OUTLOOK_SENDER_CONTEXT_MISMATCH",
        "M51B_OUTLOOK_TENANT_BOUNDARY_DENIED",
        "M51B_OUTLOOK_MAILBOX_CONTEXT_DENIED",
        "M51B_OUTLOOK_WORKFLOW_CONTEXT_DENIED",
        "M51B_OUTLOOK_PURPOSE_DENIED",
        "M51B_OUTLOOK_PROCESSOR_ROLE_DENIED",
        "M51B_OUTLOOK_PROCESSOR_PERMISSION_DENIED",
      ].includes(reason),
    )
  ) {
    return "sender_verification";
  }
  if (
    reasons.some((reason) =>
      [
        "M51B_OUTLOOK_SYNTHETIC_BOUNDARY_DENIED",
        "M51B_OUTLOOK_SENSITIVITY_SCOPE_DENIED",
        "M51B_OUTLOOK_CONSENT_REQUIRED",
        "M51B_OUTLOOK_CONSENT_INVALID",
        "M51B_OUTLOOK_CONSENT_EXPIRED",
        "M51B_OUTLOOK_PAYLOAD_NOT_MINIMIZED",
        "M51B_OUTLOOK_SYNTHETIC_IDENTIFIER_REQUIRED",
      ].includes(reason),
    )
  ) {
    return "privacy_review";
  }
  return "intake_exception";
}

function failureReason(
  outcome: M51BOutlookSyntheticAttemptOutcome,
): M51BOutlookReasonCode | null {
  switch (outcome) {
    case "transient_outage":
      return "M51B_OUTLOOK_ADAPTER_UNAVAILABLE";
    case "throttled":
      return "M51B_OUTLOOK_ADAPTER_THROTTLED";
    case "permanent_failure":
      return "M51B_OUTLOOK_ADAPTER_PERMANENT_FAILURE";
    case "success":
      return null;
  }
}

interface LedgerEntry {
  payloadFingerprint: string;
  result: Readonly<M51BOutlookProcessingResult>;
}

interface AttemptRun {
  attempts: readonly M51BOutlookAttemptEvidence[];
  succeeded: boolean;
  completedAt: string;
  terminalReason: M51BOutlookReasonCode | null;
}

export interface M51BOutlookProcessOptions {
  failurePlan?: readonly M51BOutlookSyntheticAttemptOutcome[];
}

export interface M51BOutlookDeadLetterRecoveryInput {
  deadLetterId: string;
  envelope: M51BOutlookReferralEnvelope;
  actor: M51BOutlookRecoveryActor;
  failurePlan?: readonly M51BOutlookSyntheticAttemptOutcome[];
  recoveredAt?: string;
}

const RECOVERY_ROLES = new Set([
  "super-admin",
  "administrator",
  "ccmg-program-director",
  "clinical-supervisor",
]);

export class M51BOutlookReferralIntakeService {
  readonly adapterKind = "deterministic_synthetic_outlook_event" as const;
  readonly maximumAttempts = M51B_OUTLOOK_MAX_ATTEMPTS;
  readonly actualSleepCalls = 0 as const;
  readonly mailboxReads = 0 as const;
  readonly liveGraphCalls = 0 as const;
  readonly liveMicrosoftWrites = 0 as const;
  readonly liveWrites = 0 as const;
  readonly realRecords = 0 as const;

  private readonly allowlist: readonly M51BOutlookSenderAllowlistEntry[];
  private readonly ledger = new Map<string, LedgerEntry>();
  private readonly intakesByReferral = new Map<
    string,
    Readonly<M51BOutlookIntakeRecord>
  >();
  private readonly exceptions = new Map<
    string,
    Readonly<M51BOutlookExceptionRecord>
  >();
  private readonly deadLetters = new Map<
    string,
    Readonly<M51BOutlookDeadLetterRecord>
  >();
  private readonly auditTrail: M51BAuditEvent[] = [];
  private replayPreventedCount = 0;
  private duplicatePreventedCount = 0;
  private retryScheduledCount = 0;

  constructor(
    allowlist: readonly M51BOutlookSenderAllowlistEntry[] =
      createSyntheticM51BOutlookSenderAllowlist(),
  ) {
    this.allowlist = immutable([...allowlist]);
  }

  private audit(input: {
    eventType: string;
    envelope: M51BOutlookReferralEnvelope;
    identity: ProcessingIdentity;
    outcome: M51BAuditEvent["outcome"];
    reasons: readonly string[];
    occurredAt: string;
    actorId?: string;
  }): M51BAuditEvent {
    const actorId =
      input.actorId ??
      stringPart(
        input.envelope?.context?.processingActor?.actorId,
        "SYNTH-M51B-OUTLOOK-SYSTEM-ACTOR",
      );
    const event = immutable({
      eventId: deterministicId(
        "SYNTH-M51B-OUTLOOK-AUDIT",
        input.eventType,
        input.identity.correlationId,
        input.occurredAt,
        String(this.auditTrail.length + 1),
      ),
      eventType: input.eventType,
      channel: "outlook" as const,
      occurredAt: input.occurredAt,
      actorId,
      correlationId: input.identity.correlationId,
      idempotencyKey: input.identity.idempotencyKey,
      outcome: input.outcome,
      reasonCodes: immutable([...input.reasons]),
      immutable: true as const,
      evidenceClass: M51B_EVIDENCE_CLASS,
      synthetic: true as const,
    });
    this.auditTrail.push(event);
    return event;
  }

  private createException(
    identity: ProcessingIdentity,
    reasons: readonly M51BOutlookReasonCode[],
    createdAt: string,
  ): Readonly<M51BOutlookExceptionRecord> {
    const queue = queueForReasons(reasons);
    const record = immutable({
      exceptionId: deterministicId(
        "SYNTH-M51B-OUTLOOK-EXCEPTION",
        identity.operationId,
        queue,
        ...reasons,
      ),
      messageId: identity.messageId,
      correlationId: identity.correlationId,
      idempotencyKey: identity.idempotencyKey,
      referralReference: identity.referralReference,
      queue,
      reasonCodes: immutable([...reasons]),
      status: "open" as const,
      createdAt,
      resolvedAt: null,
      resolvedBy: null,
      synthetic: true as const,
      realRecord: false as const,
    });
    this.exceptions.set(record.exceptionId, record);
    return record;
  }

  private result(input: {
    identity: ProcessingIdentity;
    disposition: M51BOutlookProcessingResult["disposition"];
    policyDecision: M51BOutlookPolicyDecision;
    intake?: Readonly<M51BOutlookIntakeRecord> | null;
    exception?: Readonly<M51BOutlookExceptionRecord> | null;
    deadLetter?: Readonly<M51BOutlookDeadLetterRecord> | null;
    attempts?: readonly M51BOutlookAttemptEvidence[];
    reasons?: readonly M51BOutlookReasonCode[];
    auditEvents?: readonly M51BAuditEvent[];
    createdIntakeCount?: 0 | 1;
    replayed?: boolean;
    duplicatePrevented?: boolean;
    completedAt: string;
  }): Readonly<M51BOutlookProcessingResult> {
    return immutable({
      operationId: input.identity.operationId,
      messageId: input.identity.messageId,
      correlationId: input.identity.correlationId,
      idempotencyKey: input.identity.idempotencyKey,
      payloadFingerprint: input.identity.payloadFingerprint,
      disposition: input.disposition,
      policyDecision: input.policyDecision,
      intake: input.intake ?? null,
      exception: input.exception ?? null,
      deadLetter: input.deadLetter ?? null,
      attempts: immutable([...(input.attempts ?? [])]),
      reasonCodes: immutable([...(input.reasons ?? [])]),
      auditEvents: immutable([...(input.auditEvents ?? [])]),
      createdIntakeCount: input.createdIntakeCount ?? 0,
      replayed: input.replayed ?? false,
      duplicatePrevented: input.duplicatePrevented ?? false,
      completedAt: input.completedAt,
      synthetic: true as const,
      realRecordsCreated: 0 as const,
      mailboxReads: 0 as const,
      liveGraphCalls: 0 as const,
      liveMicrosoftWrites: 0 as const,
      liveWrites: 0 as const,
    });
  }

  private routeException(
    envelope: M51BOutlookReferralEnvelope,
    identity: ProcessingIdentity,
    policyDecision: M51BOutlookPolicyDecision,
    reasons: readonly M51BOutlookReasonCode[],
    completedAt: string,
  ): Readonly<M51BOutlookProcessingResult> {
    const exception = this.createException(identity, reasons, completedAt);
    const event = this.audit({
      eventType: "outlook_referral_exception_routed",
      envelope,
      identity,
      outcome: "queued",
      reasons,
      occurredAt: completedAt,
    });
    return this.result({
      identity,
      disposition: "exception_routed",
      policyDecision,
      exception,
      reasons,
      auditEvents: [event],
      completedAt,
    });
  }

  private replayResult(
    envelope: M51BOutlookReferralEnvelope,
    identity: ProcessingIdentity,
    existing: Readonly<M51BOutlookProcessingResult>,
    completedAt: string,
  ): Readonly<M51BOutlookProcessingResult> {
    this.replayPreventedCount += 1;
    const reasons = immutable<M51BOutlookReasonCode[]>([
      "M51B_OUTLOOK_REPLAY_SUPPRESSED",
    ]);
    const event = this.audit({
      eventType: "outlook_referral_replay_suppressed",
      envelope,
      identity,
      outcome: "denied",
      reasons,
      occurredAt: completedAt,
    });
    return this.result({
      identity: { ...identity, operationId: existing.operationId },
      disposition: "duplicate_prevented",
      policyDecision: existing.policyDecision,
      intake: existing.intake,
      exception: existing.exception,
      deadLetter: existing.deadLetter,
      reasons,
      auditEvents: [event],
      replayed: true,
      duplicatePrevented: true,
      completedAt,
    });
  }

  private runAttempts(
    baseTime: string,
    failurePlan: readonly M51BOutlookSyntheticAttemptOutcome[],
  ): AttemptRun {
    const attempts: M51BOutlookAttemptEvidence[] = [];
    let virtualOffsetMs = 0;
    let terminalReason: M51BOutlookReasonCode | null = null;

    for (let attempt = 1; attempt <= M51B_OUTLOOK_MAX_ATTEMPTS; attempt += 1) {
      const plannedOutcome = failurePlan[attempt - 1] ?? "success";
      const startedAt = virtualTime(baseTime, virtualOffsetMs);
      const completedAt = virtualTime(baseTime, virtualOffsetMs + 100);
      const reason = failureReason(plannedOutcome);

      if (plannedOutcome === "success") {
        attempts.push(
          immutable({
            attempt,
            startedAt,
            completedAt,
            outcome: "succeeded" as const,
            reasonCode: null,
            scheduledDelayMs: null,
            actualSleepPerformed: false as const,
            mailboxReadPerformed: false as const,
            liveGraphCallPerformed: false as const,
            liveWritePerformed: false as const,
            synthetic: true as const,
          }),
        );
        return {
          attempts: immutable(attempts),
          succeeded: true,
          completedAt,
          terminalReason: null,
        };
      }

      terminalReason = reason;
      const retryable =
        plannedOutcome === "transient_outage" || plannedOutcome === "throttled";
      if (retryable && attempt < M51B_OUTLOOK_MAX_ATTEMPTS) {
        const delay = M51B_OUTLOOK_RETRY_DELAYS_MS[attempt - 1] ?? 2_000;
        attempts.push(
          immutable({
            attempt,
            startedAt,
            completedAt,
            outcome: "retry_scheduled" as const,
            reasonCode: reason,
            scheduledDelayMs: delay,
            actualSleepPerformed: false as const,
            mailboxReadPerformed: false as const,
            liveGraphCallPerformed: false as const,
            liveWritePerformed: false as const,
            synthetic: true as const,
          }),
        );
        this.retryScheduledCount += 1;
        virtualOffsetMs += 100 + delay;
        continue;
      }

      attempts.push(
        immutable({
          attempt,
          startedAt,
          completedAt,
          outcome: "failed" as const,
          reasonCode: reason,
          scheduledDelayMs: null,
          actualSleepPerformed: false as const,
          mailboxReadPerformed: false as const,
          liveGraphCallPerformed: false as const,
          liveWritePerformed: false as const,
          synthetic: true as const,
        }),
      );
      return {
        attempts: immutable(attempts),
        succeeded: false,
        completedAt,
        terminalReason,
      };
    }

    throw new Error("M51B_OUTLOOK_ATTEMPT_LOOP_UNREACHABLE");
  }

  private createIntake(
    envelope: M51BOutlookReferralEnvelope,
    identity: ProcessingIdentity,
    createdAt: string,
  ): Readonly<M51BOutlookIntakeRecord> {
    const projection = envelope.referral;
    const record = immutable({
      intakeId: deterministicId(
        "SYNTH-M51B-INTAKE",
        projection.referralReference,
      ),
      caseId: deterministicId(
        "SYNTH-M51B-CASE",
        projection.youthReference,
        projection.referralReference,
      ),
      referralId: projection.referralReference,
      youthId: projection.youthReference,
      referralSourceDivision: projection.sourceDivision,
      requestedService: projection.requestedService,
      referralReasonCode: projection.referralReasonCode,
      urgency: projection.urgency,
      sensitivity: projection.sensitivity,
      status: "received" as const,
      queueId: "intake" as const,
      sourceChannel: "outlook" as const,
      sourceMessageId: identity.messageId,
      correlationId: identity.correlationId,
      idempotencyKey: identity.idempotencyKey,
      consentReference: projection.consent.consentReference,
      createdAt,
      version: 1 as const,
      evidenceClass: M51B_EVIDENCE_CLASS,
      synthetic: true as const,
      realRecord: false as const,
      liveWritePerformed: false as const,
    });
    this.intakesByReferral.set(projection.referralReference, record);
    return record;
  }

  private createDeadLetter(
    identity: ProcessingIdentity,
    attempts: readonly M51BOutlookAttemptEvidence[],
    reasons: readonly M51BOutlookReasonCode[],
    createdAt: string,
  ): Readonly<M51BOutlookDeadLetterRecord> {
    const deadLetter = immutable({
      deadLetterId: deterministicId(
        "SYNTH-M51B-OUTLOOK-DEAD-LETTER",
        identity.operationId,
      ),
      operationId: identity.operationId,
      messageId: identity.messageId,
      correlationId: identity.correlationId,
      idempotencyKey: identity.idempotencyKey,
      payloadFingerprint: identity.payloadFingerprint,
      referralReference: identity.referralReference,
      reasonCodes: immutable([...reasons]),
      attempts: immutable([...attempts]),
      alertId: deterministicId(
        "SYNTH-M51B-OUTLOOK-ALERT",
        identity.operationId,
      ),
      status: "open" as const,
      createdAt,
      recoveredAt: null,
      recoveredBy: null,
      recoveryAttempts: 0,
      synthetic: true as const,
      realRecord: false as const,
    });
    this.deadLetters.set(deadLetter.deadLetterId, deadLetter);
    return deadLetter;
  }

  process(
    envelope: M51BOutlookReferralEnvelope,
    options: M51BOutlookProcessOptions = {},
  ): Readonly<M51BOutlookProcessingResult> {
    const identity = deriveIdentity(envelope);
    const completedAt = virtualTime(envelope?.receivedAt, 1);
    const policyDecision = evaluateM51BOutlookReferralPolicy(
      envelope,
      this.allowlist,
    );
    const existing = this.ledger.get(identity.idempotencyKey);

    if (existing) {
      if (existing.payloadFingerprint !== identity.payloadFingerprint) {
        return this.routeException(
          envelope,
          identity,
          policyDecision,
          ["M51B_OUTLOOK_IDEMPOTENCY_PAYLOAD_MISMATCH"],
          completedAt,
        );
      }
      return this.replayResult(envelope, identity, existing.result, completedAt);
    }

    if (policyDecision.decision !== "approved") {
      const rejected = this.routeException(
        envelope,
        identity,
        policyDecision,
        policyDecision.reasonCodes,
        completedAt,
      );
      this.ledger.set(identity.idempotencyKey, {
        payloadFingerprint: identity.payloadFingerprint,
        result: rejected,
      });
      return rejected;
    }

    const existingIntake = identity.referralReference
      ? this.intakesByReferral.get(identity.referralReference)
      : undefined;
    if (existingIntake) {
      this.duplicatePreventedCount += 1;
      const reasons = immutable<M51BOutlookReasonCode[]>([
        "M51B_OUTLOOK_DUPLICATE_REFERRAL_PREVENTED",
      ]);
      const event = this.audit({
        eventType: "outlook_duplicate_referral_prevented",
        envelope,
        identity,
        outcome: "denied",
        reasons,
        occurredAt: completedAt,
      });
      const duplicate = this.result({
        identity,
        disposition: "duplicate_prevented",
        policyDecision,
        intake: existingIntake,
        reasons,
        auditEvents: [event],
        duplicatePrevented: true,
        completedAt,
      });
      this.ledger.set(identity.idempotencyKey, {
        payloadFingerprint: identity.payloadFingerprint,
        result: duplicate,
      });
      return duplicate;
    }

    const attemptRun = this.runAttempts(
      envelope.receivedAt,
      options.failurePlan ?? ["success"],
    );
    if (!attemptRun.succeeded) {
      const reasons: M51BOutlookReasonCode[] = [];
      if (attemptRun.terminalReason) reasons.push(attemptRun.terminalReason);
      if (attemptRun.attempts.length === M51B_OUTLOOK_MAX_ATTEMPTS) {
        reasons.push("M51B_OUTLOOK_RETRY_EXHAUSTED");
      }
      const deadLetter = this.createDeadLetter(
        identity,
        attemptRun.attempts,
        reasons,
        attemptRun.completedAt,
      );
      const exception = this.createException(
        identity,
        reasons,
        attemptRun.completedAt,
      );
      const failureEvent = this.audit({
        eventType: "outlook_referral_dead_lettered",
        envelope,
        identity,
        outcome: "failed",
        reasons,
        occurredAt: attemptRun.completedAt,
      });
      const alertEvent = this.audit({
        eventType: "outlook_dead_letter_alert_queued",
        envelope,
        identity,
        outcome: "queued",
        reasons,
        occurredAt: virtualTime(attemptRun.completedAt, 1),
      });
      const failed = this.result({
        identity,
        disposition: "dead_lettered",
        policyDecision,
        exception,
        deadLetter,
        attempts: attemptRun.attempts,
        reasons,
        auditEvents: [failureEvent, alertEvent],
        completedAt: attemptRun.completedAt,
      });
      this.ledger.set(identity.idempotencyKey, {
        payloadFingerprint: identity.payloadFingerprint,
        result: failed,
      });
      return failed;
    }

    const intake = this.createIntake(
      envelope,
      identity,
      attemptRun.completedAt,
    );
    const event = this.audit({
      eventType: "outlook_referral_intake_created",
      envelope,
      identity,
      outcome: "accepted",
      reasons: [],
      occurredAt: attemptRun.completedAt,
    });
    const accepted = this.result({
      identity,
      disposition: "intake_created",
      policyDecision,
      intake,
      attempts: attemptRun.attempts,
      auditEvents: [event],
      createdIntakeCount: 1,
      completedAt: attemptRun.completedAt,
    });
    this.ledger.set(identity.idempotencyKey, {
      payloadFingerprint: identity.payloadFingerprint,
      result: accepted,
    });
    return accepted;
  }

  recoverDeadLetter(
    input: M51BOutlookDeadLetterRecoveryInput,
  ): Readonly<M51BOutlookProcessingResult> {
    const deadLetter = this.deadLetters.get(input.deadLetterId);
    if (!deadLetter) throw new Error("M51B_OUTLOOK_DEAD_LETTER_NOT_FOUND");

    const identity = deriveIdentity(input.envelope);
    const recoveredAt = input.recoveredAt ?? "2026-07-15T13:00:00.000Z";
    if (!Number.isFinite(Date.parse(recoveredAt))) {
      throw new Error("M51B_OUTLOOK_RECOVERY_TIME_INVALID");
    }
    const policyDecision = evaluateM51BOutlookReferralPolicy(
      input.envelope,
      this.allowlist,
    );

    if (
      input.actor.synthetic !== true ||
      !RECOVERY_ROLES.has(input.actor.role) ||
      !input.actor.permissions.includes(M51B_OUTLOOK_RECOVERY_PERMISSION)
    ) {
      return this.routeException(
        input.envelope,
        identity,
        policyDecision,
        ["M51B_OUTLOOK_RECOVERY_ACTOR_DENIED"],
        recoveredAt,
      );
    }

    if (
      deadLetter.messageId !== identity.messageId ||
      deadLetter.idempotencyKey !== identity.idempotencyKey ||
      deadLetter.payloadFingerprint !== identity.payloadFingerprint
    ) {
      return this.routeException(
        input.envelope,
        identity,
        policyDecision,
        ["M51B_OUTLOOK_DEAD_LETTER_PAYLOAD_MISMATCH"],
        recoveredAt,
      );
    }

    if (deadLetter.status === "recovered") {
      this.replayPreventedCount += 1;
      const reasons = immutable<M51BOutlookReasonCode[]>([
        "M51B_OUTLOOK_DEAD_LETTER_ALREADY_RECOVERED",
      ]);
      const event = this.audit({
        eventType: "outlook_dead_letter_replay_suppressed",
        envelope: input.envelope,
        identity,
        actorId: input.actor.actorId,
        outcome: "denied",
        reasons,
        occurredAt: recoveredAt,
      });
      return this.result({
        identity,
        disposition: "duplicate_prevented",
        policyDecision,
        intake:
          identity.referralReference === null
            ? null
            : this.intakesByReferral.get(identity.referralReference) ?? null,
        deadLetter,
        reasons,
        auditEvents: [event],
        replayed: true,
        duplicatePrevented: true,
        completedAt: recoveredAt,
      });
    }

    if (policyDecision.decision !== "approved") {
      return this.routeException(
        input.envelope,
        identity,
        policyDecision,
        policyDecision.reasonCodes,
        recoveredAt,
      );
    }

    const attemptRun = this.runAttempts(
      recoveredAt,
      input.failurePlan ?? ["success"],
    );
    if (!attemptRun.succeeded) {
      const reasons: M51BOutlookReasonCode[] = [];
      if (attemptRun.terminalReason) reasons.push(attemptRun.terminalReason);
      if (attemptRun.attempts.length === M51B_OUTLOOK_MAX_ATTEMPTS) {
        reasons.push("M51B_OUTLOOK_RETRY_EXHAUSTED");
      }
      const updated = immutable({
        ...deadLetter,
        reasonCodes: immutable(reasons),
        attempts: immutable([...deadLetter.attempts, ...attemptRun.attempts]),
        recoveryAttempts: deadLetter.recoveryAttempts + 1,
      });
      this.deadLetters.set(deadLetter.deadLetterId, updated);
      const event = this.audit({
        eventType: "outlook_dead_letter_recovery_failed",
        envelope: input.envelope,
        identity,
        actorId: input.actor.actorId,
        outcome: "failed",
        reasons,
        occurredAt: attemptRun.completedAt,
      });
      const failed = this.result({
        identity,
        disposition: "dead_lettered",
        policyDecision,
        deadLetter: updated,
        attempts: attemptRun.attempts,
        reasons,
        auditEvents: [event],
        completedAt: attemptRun.completedAt,
      });
      this.ledger.set(identity.idempotencyKey, {
        payloadFingerprint: identity.payloadFingerprint,
        result: failed,
      });
      return failed;
    }

    const existingIntake = identity.referralReference
      ? this.intakesByReferral.get(identity.referralReference)
      : undefined;
    const intake =
      existingIntake ??
      this.createIntake(input.envelope, identity, attemptRun.completedAt);
    const createdIntakeCount: 0 | 1 = existingIntake ? 0 : 1;
    const updatedDeadLetter = immutable({
      ...deadLetter,
      status: "recovered" as const,
      recoveredAt: attemptRun.completedAt,
      recoveredBy: input.actor.actorId,
      recoveryAttempts: deadLetter.recoveryAttempts + 1,
    });
    this.deadLetters.set(deadLetter.deadLetterId, updatedDeadLetter);

    const openException = [...this.exceptions.values()].find(
      (candidate) =>
        candidate.idempotencyKey === identity.idempotencyKey &&
        candidate.queue === "outlook_dead_letter" &&
        candidate.status === "open",
    );
    let resolvedException: Readonly<M51BOutlookExceptionRecord> | null = null;
    if (openException) {
      resolvedException = immutable({
        ...openException,
        status: "resolved" as const,
        resolvedAt: attemptRun.completedAt,
        resolvedBy: input.actor.actorId,
      });
      this.exceptions.set(openException.exceptionId, resolvedException);
    }

    const replayEvent = this.audit({
      eventType: "outlook_dead_letter_replayed",
      envelope: input.envelope,
      identity,
      actorId: input.actor.actorId,
      outcome: "queued",
      reasons: [],
      occurredAt: recoveredAt,
    });
    const recoveryEvent = this.audit({
      eventType: "outlook_referral_recovered",
      envelope: input.envelope,
      identity,
      actorId: input.actor.actorId,
      outcome: "recovered",
      reasons: [],
      occurredAt: attemptRun.completedAt,
    });
    const recovered = this.result({
      identity,
      disposition: "recovered",
      policyDecision,
      intake,
      exception: resolvedException,
      deadLetter: updatedDeadLetter,
      attempts: attemptRun.attempts,
      auditEvents: [replayEvent, recoveryEvent],
      createdIntakeCount,
      duplicatePrevented: Boolean(existingIntake),
      completedAt: attemptRun.completedAt,
    });
    this.ledger.set(identity.idempotencyKey, {
      payloadFingerprint: identity.payloadFingerprint,
      result: recovered,
    });
    return recovered;
  }

  snapshot(): Readonly<M51BOutlookServiceSnapshot> {
    const intakes = immutable(
      [...this.intakesByReferral.values()].sort((left, right) =>
        left.intakeId.localeCompare(right.intakeId),
      ),
    );
    const exceptions = immutable(
      [...this.exceptions.values()].sort((left, right) =>
        left.exceptionId.localeCompare(right.exceptionId),
      ),
    );
    const deadLetters = immutable(
      [...this.deadLetters.values()].sort((left, right) =>
        left.deadLetterId.localeCompare(right.deadLetterId),
      ),
    );
    return immutable({
      intakes,
      exceptions,
      deadLetters,
      auditEvents: immutable([...this.auditTrail]),
      metrics: immutable({
        intakeCount: intakes.length,
        exceptionCount: exceptions.length,
        openDeadLetterCount: deadLetters.filter(
          (deadLetter) => deadLetter.status === "open",
        ).length,
        recoveredDeadLetterCount: deadLetters.filter(
          (deadLetter) => deadLetter.status === "recovered",
        ).length,
        replayPreventedCount: this.replayPreventedCount,
        duplicatePreventedCount: this.duplicatePreventedCount,
        retryScheduledCount: this.retryScheduledCount,
        actualSleepCalls: 0 as const,
        mailboxReads: 0 as const,
        liveGraphCalls: 0 as const,
        liveMicrosoftWrites: 0 as const,
        liveWrites: 0 as const,
        realRecords: 0 as const,
      }),
      synthetic: true as const,
    });
  }
}
