import { describe, expect, it } from "vitest";
import type { M51BOutlookReferralEnvelope } from "@contracts/m51b/outlook";
import { M51BOutlookReferralIntakeService } from "../services/m51b/outlook/outlook-referral-intake";
import {
  createSyntheticM51BOutlookRecoveryActor,
  createSyntheticM51BOutlookReferral,
} from "../services/m51b/outlook/synthetic-outlook-fixtures";

describe("M5.1B Outlook idempotency, retry, dead-letter, and recovery", () => {
  it("suppresses an identical message replay and keeps exactly one intake", () => {
    const service = new M51BOutlookReferralIntakeService();
    const envelope = createSyntheticM51BOutlookReferral();
    const first = service.process(envelope);
    const replay = service.process(envelope);

    expect(first.disposition).toBe("intake_created");
    expect(replay).toMatchObject({
      disposition: "duplicate_prevented",
      createdIntakeCount: 0,
      replayed: true,
      duplicatePrevented: true,
      reasonCodes: ["M51B_OUTLOOK_REPLAY_SUPPRESSED"],
    });
    expect(replay.operationId).toBe(first.operationId);
    expect(replay.correlationId).toBe(first.correlationId);
    expect(replay.idempotencyKey).toBe(first.idempotencyKey);
    expect(replay.intake?.intakeId).toBe(first.intake?.intakeId);
    expect(service.snapshot().metrics).toMatchObject({
      intakeCount: 1,
      replayPreventedCount: 1,
    });
  });

  it("detects the same referral in a different message as a logical duplicate", () => {
    const service = new M51BOutlookReferralIntakeService();
    const firstEnvelope = createSyntheticM51BOutlookReferral();
    const secondEnvelope: M51BOutlookReferralEnvelope = {
      ...firstEnvelope,
      messageId: "SYNTH-M51B-OUTLOOK-MESSAGE-002",
      internetMessageId: "SYNTH-M51B-OUTLOOK-INTERNET-MESSAGE-002",
      changeKey: "SYNTH-M51B-OUTLOOK-CHANGEKEY-002",
      sentAt: "2026-07-15T12:01:00.000Z",
      receivedAt: "2026-07-15T12:01:05.000Z",
    };

    const first = service.process(firstEnvelope);
    const duplicate = service.process(secondEnvelope);

    expect(duplicate).toMatchObject({
      disposition: "duplicate_prevented",
      replayed: false,
      duplicatePrevented: true,
      createdIntakeCount: 0,
      reasonCodes: ["M51B_OUTLOOK_DUPLICATE_REFERRAL_PREVENTED"],
    });
    expect(duplicate.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(duplicate.correlationId).not.toBe(first.correlationId);
    expect(duplicate.intake?.intakeId).toBe(first.intake?.intakeId);
    expect(service.snapshot().metrics).toMatchObject({
      intakeCount: 1,
      duplicatePreventedCount: 1,
    });
  });

  it("routes an idempotency-key payload mismatch as a security exception", () => {
    const service = new M51BOutlookReferralIntakeService();
    const envelope = createSyntheticM51BOutlookReferral();
    service.process(envelope);
    const tampered: M51BOutlookReferralEnvelope = {
      ...envelope,
      referral: {
        ...envelope.referral,
        urgency: "urgent",
      },
    };

    const result = service.process(tampered);

    expect(result.disposition).toBe("exception_routed");
    expect(result.reasonCodes).toContain("M51B_OUTLOOK_IDEMPOTENCY_PAYLOAD_MISMATCH");
    expect(result.exception?.queue).toBe("integration_security");
    expect(result.createdIntakeCount).toBe(0);
    expect(service.snapshot().metrics.intakeCount).toBe(1);
  });

  it("uses bounded virtual retries and succeeds once without sleeping", () => {
    const service = new M51BOutlookReferralIntakeService();
    const result = service.process(createSyntheticM51BOutlookReferral(), {
      failurePlan: ["transient_outage", "throttled", "success"],
    });

    expect(result.disposition).toBe("intake_created");
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts.map((attempt) => attempt.outcome)).toEqual([
      "retry_scheduled",
      "retry_scheduled",
      "succeeded",
    ]);
    expect(result.attempts.map((attempt) => attempt.scheduledDelayMs)).toEqual([
      1_000,
      2_000,
      null,
    ]);
    expect(result.attempts.map((attempt) => attempt.reasonCode)).toEqual([
      "M51B_OUTLOOK_ADAPTER_UNAVAILABLE",
      "M51B_OUTLOOK_ADAPTER_THROTTLED",
      null,
    ]);
    expect(service.actualSleepCalls).toBe(0);
    expect(service.snapshot().metrics).toMatchObject({
      intakeCount: 1,
      retryScheduledCount: 2,
      actualSleepCalls: 0,
      mailboxReads: 0,
      liveGraphCalls: 0,
      liveWrites: 0,
    });
  });

  it("dead-letters an exhausted outage, alerts, and recovers exactly once", () => {
    const service = new M51BOutlookReferralIntakeService();
    const envelope = createSyntheticM51BOutlookReferral();
    const failed = service.process(envelope, {
      failurePlan: [
        "transient_outage",
        "transient_outage",
        "transient_outage",
      ],
    });

    expect(failed).toMatchObject({
      disposition: "dead_lettered",
      createdIntakeCount: 0,
      reasonCodes: [
        "M51B_OUTLOOK_ADAPTER_UNAVAILABLE",
        "M51B_OUTLOOK_RETRY_EXHAUSTED",
      ],
      exception: { queue: "outlook_dead_letter", status: "open" },
      deadLetter: { status: "open", recoveryAttempts: 0 },
    });
    expect(failed.attempts).toHaveLength(3);
    expect(failed.auditEvents.map((event) => event.eventType)).toEqual([
      "outlook_referral_dead_lettered",
      "outlook_dead_letter_alert_queued",
    ]);
    expect(service.snapshot().metrics).toMatchObject({
      intakeCount: 0,
      openDeadLetterCount: 1,
    });

    const recovered = service.recoverDeadLetter({
      deadLetterId: failed.deadLetter!.deadLetterId,
      envelope,
      actor: createSyntheticM51BOutlookRecoveryActor(),
      failurePlan: ["success"],
    });

    expect(recovered).toMatchObject({
      disposition: "recovered",
      createdIntakeCount: 1,
      replayed: false,
      intake: { referralId: "SYNTH-M51B-REFERRAL-001" },
      exception: { status: "resolved" },
      deadLetter: { status: "recovered", recoveryAttempts: 1 },
    });
    expect(recovered.auditEvents.map((event) => event.eventType)).toEqual([
      "outlook_dead_letter_replayed",
      "outlook_referral_recovered",
    ]);
    expect(service.snapshot().metrics).toMatchObject({
      intakeCount: 1,
      openDeadLetterCount: 0,
      recoveredDeadLetterCount: 1,
      realRecords: 0,
      mailboxReads: 0,
      liveGraphCalls: 0,
      liveWrites: 0,
    });

    const replay = service.recoverDeadLetter({
      deadLetterId: failed.deadLetter!.deadLetterId,
      envelope,
      actor: createSyntheticM51BOutlookRecoveryActor(),
    });
    expect(replay).toMatchObject({
      disposition: "duplicate_prevented",
      createdIntakeCount: 0,
      replayed: true,
      duplicatePrevented: true,
      reasonCodes: ["M51B_OUTLOOK_DEAD_LETTER_ALREADY_RECOVERED"],
    });
    expect(service.snapshot().metrics.intakeCount).toBe(1);
  });

  it("keeps a dead letter open when recovery fails, then supports accountable recovery", () => {
    const service = new M51BOutlookReferralIntakeService();
    const envelope = createSyntheticM51BOutlookReferral();
    const failed = service.process(envelope, {
      failurePlan: [
        "transient_outage",
        "transient_outage",
        "transient_outage",
      ],
    });
    const failedRecovery = service.recoverDeadLetter({
      deadLetterId: failed.deadLetter!.deadLetterId,
      envelope,
      actor: createSyntheticM51BOutlookRecoveryActor(),
      failurePlan: ["permanent_failure"],
    });

    expect(failedRecovery).toMatchObject({
      disposition: "dead_lettered",
      createdIntakeCount: 0,
      reasonCodes: ["M51B_OUTLOOK_ADAPTER_PERMANENT_FAILURE"],
      deadLetter: { status: "open", recoveryAttempts: 1 },
    });
    expect(service.snapshot().metrics.intakeCount).toBe(0);

    const recovered = service.recoverDeadLetter({
      deadLetterId: failed.deadLetter!.deadLetterId,
      envelope,
      actor: createSyntheticM51BOutlookRecoveryActor(),
    });
    expect(recovered.disposition).toBe("recovered");
    expect(recovered.deadLetter?.recoveryAttempts).toBe(2);
    expect(service.snapshot().metrics.intakeCount).toBe(1);
  });

  it("denies unauthorized or payload-mismatched dead-letter recovery", () => {
    const service = new M51BOutlookReferralIntakeService();
    const envelope = createSyntheticM51BOutlookReferral();
    const failed = service.process(envelope, {
      failurePlan: [
        "transient_outage",
        "transient_outage",
        "transient_outage",
      ],
    });
    const unauthorized = service.recoverDeadLetter({
      deadLetterId: failed.deadLetter!.deadLetterId,
      envelope,
      actor: {
        actorId: "SYNTH-M51B-ACTOR-UNAUTHORIZED-RECOVERY",
        role: "therapist",
        permissions: ["m51b:outlook:dead-letter:recover"],
        synthetic: true,
      },
    });
    expect(unauthorized.reasonCodes).toContain("M51B_OUTLOOK_RECOVERY_ACTOR_DENIED");
    expect(unauthorized.exception?.queue).toBe("integration_security");

    const tamperedEnvelope = {
      ...envelope,
      referral: { ...envelope.referral, urgency: "urgent" },
    } as M51BOutlookReferralEnvelope;
    const tampered = service.recoverDeadLetter({
      deadLetterId: failed.deadLetter!.deadLetterId,
      envelope: tamperedEnvelope,
      actor: createSyntheticM51BOutlookRecoveryActor(),
    });
    expect(tampered.reasonCodes).toContain(
      "M51B_OUTLOOK_DEAD_LETTER_PAYLOAD_MISMATCH",
    );
    expect(tampered.exception?.queue).toBe("integration_security");
    expect(service.snapshot().metrics).toMatchObject({
      intakeCount: 0,
      openDeadLetterCount: 1,
    });
  });

  it("dead-letters a permanent adapter failure after one attempt", () => {
    const service = new M51BOutlookReferralIntakeService();
    const result = service.process(createSyntheticM51BOutlookReferral(), {
      failurePlan: ["permanent_failure"],
    });

    expect(result.disposition).toBe("dead_lettered");
    expect(result.attempts).toHaveLength(1);
    expect(result.reasonCodes).toEqual([
      "M51B_OUTLOOK_ADAPTER_PERMANENT_FAILURE",
    ]);
    expect(result.deadLetter?.status).toBe("open");
    expect(result.intake).toBeNull();
  });
});
