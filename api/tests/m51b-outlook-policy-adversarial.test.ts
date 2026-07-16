import { describe, expect, it } from "vitest";
import type { M51BOutlookReferralEnvelope } from "@contracts/m51b/outlook";
import { M51BOutlookReferralIntakeService } from "../services/m51b/outlook/outlook-referral-intake";
import { createSyntheticM51BOutlookReferral } from "../services/m51b/outlook/synthetic-outlook-fixtures";

function route(envelope: M51BOutlookReferralEnvelope) {
  return new M51BOutlookReferralIntakeService().process(envelope);
}

describe("M5.1B Outlook fail-closed referral policy", () => {
  it("routes a non-allowlisted sender without creating an intake", () => {
    const base = createSyntheticM51BOutlookReferral();
    const result = route({
      ...base,
      sender: {
        ...base.sender,
        senderAddress: "unapproved@unknown-partner.invalid",
        senderDirectoryObjectId: "SYNTH-M51B-SENDER-UNKNOWN-001",
      },
    });

    expect(result.disposition).toBe("exception_routed");
    expect(result.reasonCodes).toContain("M51B_OUTLOOK_SENDER_NOT_ALLOWLISTED");
    expect(result.exception?.queue).toBe("sender_verification");
    expect(result.intake).toBeNull();
    expect(result.createdIntakeCount).toBe(0);
  });

  it("denies a tenant, mailbox, workflow, or purpose context mismatch", () => {
    const base = createSyntheticM51BOutlookReferral();
    const variants = [
      {
        ...base,
        context: {
          ...base.context,
          tenantBoundary: "SYNTHETIC-UNAPPROVED-TENANT",
        },
      },
      {
        ...base,
        context: { ...base.context, mailboxId: "SYNTH-M51B-MAILBOX-OTHER" },
      },
      {
        ...base,
        context: { ...base.context, workflowId: "SYNTH-M51B-WORKFLOW-OTHER" },
      },
      {
        ...base,
        context: { ...base.context, purpose: "unrelated_marketing" },
      },
    ] as unknown as readonly M51BOutlookReferralEnvelope[];

    const results = variants.map(route);
    expect(results.every((result) => result.disposition === "exception_routed")).toBe(true);
    expect(results.every((result) => result.exception?.queue === "sender_verification")).toBe(true);
    expect(results.flatMap((result) => result.reasonCodes)).toEqual(
      expect.arrayContaining([
        "M51B_OUTLOOK_TENANT_BOUNDARY_DENIED",
        "M51B_OUTLOOK_MAILBOX_CONTEXT_DENIED",
        "M51B_OUTLOOK_WORKFLOW_CONTEXT_DENIED",
        "M51B_OUTLOOK_PURPOSE_DENIED",
      ]),
    );
  });

  it("rejects a sender identity mismatch even when the address is allowlisted", () => {
    const base = createSyntheticM51BOutlookReferral();
    const result = route({
      ...base,
      sender: {
        ...base.sender,
        senderDirectoryObjectId: "SYNTH-M51B-SENDER-IMPOSTOR-001",
      },
    });

    expect(result.reasonCodes).toContain("M51B_OUTLOOK_SENDER_CONTEXT_MISMATCH");
    expect(result.exception?.queue).toBe("sender_verification");
    expect(result.intake).toBeNull();
  });

  it("denies an intake-invisible role despite spoofed processing permissions", () => {
    const base = createSyntheticM51BOutlookReferral();
    const result = route({
      ...base,
      context: {
        ...base.context,
        processingActor: {
          ...base.context.processingActor,
          actorId: "SYNTH-M51B-ACTOR-CHART-AUDITOR",
          role: "chart-auditor",
          permissions: [
            "m51b:outlook:referral:ingest",
            "m51b:intake:create",
          ],
        },
      },
    });

    expect(result.reasonCodes).toContain("M51B_OUTLOOK_PROCESSOR_ROLE_DENIED");
    expect(result.intake).toBeNull();
  });

  it("denies missing permissions even for an intake-authorized role", () => {
    const base = createSyntheticM51BOutlookReferral();
    const result = route({
      ...base,
      context: {
        ...base.context,
        processingActor: {
          ...base.context.processingActor,
          permissions: ["m51b:outlook:referral:ingest"],
        },
      },
    });

    expect(result.reasonCodes).toContain("M51B_OUTLOOK_PROCESSOR_PERMISSION_DENIED");
    expect(result.intake).toBeNull();
  });

  it("requires current scoped consent for restricted and Part 2 referrals", () => {
    const base = createSyntheticM51BOutlookReferral();
    const missing = route({
      ...base,
      referral: {
        ...base.referral,
        sensitivity: "part2",
        consent: {
          required: true,
          status: "missing",
          consentReference: null,
          scopes: [],
          verifiedAt: null,
          expiresAt: null,
        },
      },
    });
    const expired = route({
      ...base,
      messageId: "SYNTH-M51B-OUTLOOK-MESSAGE-EXPIRED",
      internetMessageId: "SYNTH-M51B-OUTLOOK-INTERNET-MESSAGE-EXPIRED",
      referral: {
        ...base.referral,
        consent: {
          ...base.referral.consent,
          status: "expired",
          expiresAt: "2026-07-14T00:00:00.000Z",
        },
      },
    });

    expect(missing.reasonCodes).toContain("M51B_OUTLOOK_CONSENT_REQUIRED");
    expect(expired.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51B_OUTLOOK_CONSENT_REQUIRED",
        "M51B_OUTLOOK_CONSENT_EXPIRED",
      ]),
    );
    expect(missing.exception?.queue).toBe("privacy_review");
    expect(expired.exception?.queue).toBe("privacy_review");
  });

  it("detects extra personal fields instead of trusting a declared minimized payload", () => {
    const base = createSyntheticM51BOutlookReferral();
    const referralWithPii = {
      ...base.referral,
      youthName: "Fictional but prohibited free text",
      dateOfBirth: "2012-01-01",
    };
    const result = route({
      ...base,
      referral: referralWithPii,
    } as M51BOutlookReferralEnvelope);

    expect(result.reasonCodes).toContain("M51B_OUTLOOK_PAYLOAD_NOT_MINIMIZED");
    expect(result.exception?.queue).toBe("privacy_review");
    expect(result.intake).toBeNull();
  });

  it("fails closed if raw content, a live mailbox read, or a non-synthetic identifier is asserted", () => {
    const base = createSyntheticM51BOutlookReferral();
    const result = route({
      ...base,
      messageId: "real-message-001",
      rawBodyRead: true,
      liveMailboxRead: true,
    } as unknown as M51BOutlookReferralEnvelope);

    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51B_OUTLOOK_SYNTHETIC_BOUNDARY_DENIED",
        "M51B_OUTLOOK_SYNTHETIC_IDENTIFIER_REQUIRED",
      ]),
    );
    expect(result.exception?.queue).toBe("privacy_review");
    expect(result).toMatchObject({
      mailboxReads: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      realRecordsCreated: 0,
    });
  });

  it("rejects inverted or invalid message time without relying on wall-clock time", () => {
    const base = createSyntheticM51BOutlookReferral();
    const result = route({
      ...base,
      sentAt: "2026-07-15T13:00:00.000Z",
      receivedAt: "2026-07-15T12:00:00.000Z",
    });

    expect(result.reasonCodes).toContain("M51B_OUTLOOK_TIMESTAMP_INVALID");
    expect(result.intake).toBeNull();
  });
});
