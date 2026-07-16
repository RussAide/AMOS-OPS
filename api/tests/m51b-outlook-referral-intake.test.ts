import { describe, expect, it } from "vitest";
import { M51B_EVIDENCE_CLASS } from "@contracts/m51b/shared";
import { M51BOutlookReferralIntakeService } from "../services/m51b/outlook/outlook-referral-intake";
import { evaluateM51BOutlookReferralPolicy } from "../services/m51b/outlook/outlook-referral-policy";
import {
  createSyntheticM51BOutlookReferral,
  createSyntheticM51BOutlookSenderAllowlist,
} from "../services/m51b/outlook/synthetic-outlook-fixtures";

describe("M5.1B synthetic Outlook referral intake", () => {
  it("approves an allowlisted, minimized referral under the controlled context", () => {
    const envelope = createSyntheticM51BOutlookReferral();
    const decision = evaluateM51BOutlookReferralPolicy(
      envelope,
      createSyntheticM51BOutlookSenderAllowlist(),
    );

    expect(decision).toMatchObject({
      decision: "approved",
      reasonCodes: [],
      allowlistEntryId: "SYNTH-M51B-OUTLOOK-ALLOWLIST-001",
      senderValidated: true,
      contextValidated: true,
      processorAuthorized: true,
      sensitivityValidated: true,
      consentValidated: true,
      minimizationValidated: true,
      synthetic: true,
    });
    expect(decision.minimizedProjection).toEqual({
      referralReference: "SYNTH-M51B-REFERRAL-001",
      youthReference: "SYNTH-M51B-YOUTH-001",
      sourceOrganizationReference: "SYNTH-M51B-ORGANIZATION-PARTNER-001",
      sourceDivision: "external",
      requestedService: "CCMG",
      urgency: "routine",
      referralReasonCode: "behavioral_health_assessment",
      sensitivity: "restricted",
      consentReference: "SYNTH-M51B-CONSENT-001",
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.minimizedProjection)).toBe(true);
  });

  it("creates exactly one received intake without reading Outlook or writing a real record", () => {
    const service = new M51BOutlookReferralIntakeService();
    const envelope = createSyntheticM51BOutlookReferral();
    const sourceBefore = JSON.stringify(envelope);
    const result = service.process(envelope);
    const snapshot = service.snapshot();

    expect(result).toMatchObject({
      disposition: "intake_created",
      createdIntakeCount: 1,
      replayed: false,
      duplicatePrevented: false,
      synthetic: true,
      realRecordsCreated: 0,
      mailboxReads: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      liveWrites: 0,
      intake: {
        referralId: "SYNTH-M51B-REFERRAL-001",
        youthId: "SYNTH-M51B-YOUTH-001",
        referralSourceDivision: "external",
        requestedService: "CCMG",
        status: "received",
        queueId: "intake",
        sourceChannel: "outlook",
        version: 1,
        evidenceClass: M51B_EVIDENCE_CLASS,
        synthetic: true,
        realRecord: false,
        liveWritePerformed: false,
      },
    });
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      attempt: 1,
      outcome: "succeeded",
      actualSleepPerformed: false,
      mailboxReadPerformed: false,
      liveGraphCallPerformed: false,
      liveWritePerformed: false,
    });
    expect(snapshot.intakes).toHaveLength(1);
    expect(snapshot.metrics.intakeCount).toBe(1);
    expect(snapshot.metrics).toMatchObject({
      actualSleepCalls: 0,
      mailboxReads: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      liveWrites: 0,
      realRecords: 0,
    });
    expect(JSON.stringify(envelope)).toBe(sourceBefore);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.intake)).toBe(true);
  });

  it("derives stable operation, correlation, idempotency, intake, and case identities", () => {
    const envelope = createSyntheticM51BOutlookReferral();
    const left = new M51BOutlookReferralIntakeService().process(envelope);
    const right = new M51BOutlookReferralIntakeService().process(envelope);

    expect(left.operationId).toBe(right.operationId);
    expect(left.correlationId).toBe(right.correlationId);
    expect(left.idempotencyKey).toBe(right.idempotencyKey);
    expect(left.payloadFingerprint).toBe(right.payloadFingerprint);
    expect(left.intake?.intakeId).toBe(right.intake?.intakeId);
    expect(left.intake?.caseId).toBe(right.intake?.caseId);
    expect(left.operationId).toMatch(/^SYNTH-M51B-OUTLOOK-OPERATION-/);
    expect(left.correlationId).toMatch(/^SYNTH-M51B-OUTLOOK-CORRELATION-/);
    expect(left.idempotencyKey).toMatch(/^SYNTH-M51B-OUTLOOK-IDEMPOTENCY-/);
  });

  it("retains only coded, minimized referral fields in the created intake", () => {
    const result = new M51BOutlookReferralIntakeService().process(
      createSyntheticM51BOutlookReferral(),
    );
    const serialized = JSON.stringify(result.intake);

    expect(Object.keys(result.intake ?? {}).sort()).toEqual(
      [
        "caseId",
        "consentReference",
        "correlationId",
        "createdAt",
        "evidenceClass",
        "idempotencyKey",
        "intakeId",
        "liveWritePerformed",
        "queueId",
        "realRecord",
        "referralId",
        "referralReasonCode",
        "referralSourceDivision",
        "requestedService",
        "sensitivity",
        "sourceChannel",
        "sourceMessageId",
        "status",
        "synthetic",
        "urgency",
        "version",
        "youthId",
      ].sort(),
    );
    expect(serialized).not.toContain("body");
    expect(serialized).not.toContain("attachment");
    expect(serialized).not.toContain("subject");
  });
});
