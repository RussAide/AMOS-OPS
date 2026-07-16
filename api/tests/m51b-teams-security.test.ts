import { describe, expect, it } from "vitest";
import type {
  M51BTeamsDestination,
  M51BTeamsEventCandidate,
  M51BTeamsIdentity,
} from "@contracts/m51b/teams";
import { M51BTeamsDeliveryOrchestrator } from "../services/m51b/teams/delivery-orchestrator";
import {
  createSyntheticM51BTeamsActor,
  createSyntheticM51BTeamsDestinations,
  createSyntheticM51BTeamsEvent,
  createSyntheticM51BTeamsIdentities,
  M51B_TEAMS_DESTINATION_IDS,
  m51bTeamsActorId,
} from "../services/m51b/teams/fixtures";
import { M51BTeamsRegistry } from "../services/m51b/teams/registry";
import { SyntheticM51BTeamsAdapter } from "../services/m51b/teams/synthetic-teams-adapter";

function foundation(input?: {
  destinations?: readonly M51BTeamsDestination[];
  identities?: readonly M51BTeamsIdentity[];
}) {
  const adapter = new SyntheticM51BTeamsAdapter();
  const registry = new M51BTeamsRegistry(
    input?.destinations ?? createSyntheticM51BTeamsDestinations(),
    input?.identities ?? createSyntheticM51BTeamsIdentities(),
  );
  return {
    adapter,
    orchestrator: new M51BTeamsDeliveryOrchestrator(registry, adapter),
  };
}

function request(
  id: string,
  eventOverrides: Partial<M51BTeamsEventCandidate> = {},
) {
  return {
    idempotencyKey: `SYNTH-M51B-TEAMS-SECURITY-${id}`,
    submittedAt: "2026-07-15T12:00:03.000Z",
    actor: createSyntheticM51BTeamsActor("super-admin"),
    event: createSyntheticM51BTeamsEvent({
      eventId: `SYNTH-M51B-TEAMS-SECURITY-EVENT-${id}`,
      sourceReference: `SYNTH-M51B-TEAMS-WORK-${id}`,
      ...eventOverrides,
    }),
  };
}

describe("M5.1B Teams fail-closed privacy, identity, and destination policy", () => {
  it.each([
    [
      "DRAFT",
      { approvalStatus: "draft", approvedAt: null } as Partial<M51BTeamsEventCandidate>,
      "M51B_TEAMS_EVENT_NOT_APPROVED",
    ],
    [
      "WITHDRAWN",
      { approvalStatus: "withdrawn" } as Partial<M51BTeamsEventCandidate>,
      "M51B_TEAMS_EVENT_NOT_APPROVED",
    ],
    [
      "EXPIRED",
      { approvalExpiresAt: "2026-07-15T12:00:02.999Z" },
      "M51B_TEAMS_APPROVAL_EXPIRED",
    ],
    [
      "CONSENT",
      { consentStatus: "required_not_verified" },
      "M51B_TEAMS_REQUIRED_CONSENT_NOT_VERIFIED",
    ],
    [
      "RESTRICTED",
      { sourceSensitivity: "restricted" },
      "M51B_TEAMS_RESTRICTED_SOURCE_NOTIFICATION_DENIED",
    ],
    [
      "PART2",
      { sourceSensitivity: "part2" },
      "M51B_TEAMS_RESTRICTED_SOURCE_NOTIFICATION_DENIED",
    ],
    [
      "FREETEXT",
      { untrustedFreeText: `patient id: ${["123", "45", "6789"].join("-")}` },
      "M51B_TEAMS_UNTRUSTED_FREE_TEXT_DENIED",
    ],
    [
      "UNKNOWNDEST",
      { destinationId: "SYNTH-M51B-DEST-UNKNOWN" },
      "M51B_TEAMS_DESTINATION_NOT_FOUND",
    ],
    [
      "WRONGEVENTMAP",
      { eventType: "clinical_review_approved" },
      "M51B_TEAMS_EVENT_DESTINATION_MAPPING_DENIED",
    ],
    [
      "WRONGDIVISION",
      {
        eventType: "clinical_review_approved",
        destinationId: M51B_TEAMS_DESTINATION_IDS.bhcCareCoordination,
      },
      "M51B_TEAMS_DESTINATION_DIVISION_DENIED",
    ],
    [
      "DUPLICATE",
      {
        intendedRecipientActorIds: [
          m51bTeamsActorId("managing-director"),
          m51bTeamsActorId("managing-director"),
        ],
      },
      "M51B_TEAMS_RECIPIENT_DUPLICATE",
    ],
    [
      "NOOWNER",
      { ownerRole: "administrator" },
      "M51B_TEAMS_ACCOUNTABLE_OWNER_NOT_RECIPIENT",
    ],
  ])("denies %s before any adapter attempt", async (id, overrides, expectedCode) => {
    const { adapter, orchestrator } = foundation();
    const result = await orchestrator.deliver(
      request(id, overrides as Partial<M51BTeamsEventCandidate>),
    );

    expect(result.status).toBe("denied");
    expect(result.denialCodes).toContain(expectedCode);
    expect(result.destination).toBeNull();
    expect(result.payload).toBeNull();
    expect(result.evidence).toBeNull();
    expect(result.attempts).toHaveLength(0);
    expect(adapter.metrics().syntheticSendAttempts).toBe(0);
  });

  it("denies a guest, disabled member, foreign-tenant identity, and unmapped recipient", async () => {
    const cases: readonly [string, Partial<M51BTeamsIdentity>, string][] = [
      [
        "GUEST",
        { identityKind: "guest" },
        "M51B_TEAMS_GUEST_OR_SERVICE_MENTION_DENIED",
      ],
      [
        "DISABLED",
        { status: "disabled" },
        "M51B_TEAMS_RECIPIENT_DISABLED",
      ],
      [
        "TENANT",
        { tenantId: "SYNTH-FOREIGN-TENANT" },
        "M51B_TEAMS_RECIPIENT_TENANT_DENIED",
      ],
    ];
    for (const [id, identityOverride, expected] of cases) {
      const identities = createSyntheticM51BTeamsIdentities().map((identity) =>
        identity.actorId === m51bTeamsActorId("managing-director")
          ? { ...identity, ...identityOverride }
          : identity,
      );
      const { adapter, orchestrator } = foundation({ identities });
      const result = await orchestrator.deliver(request(id));
      expect(result.status).toBe("denied");
      expect(result.denialCodes).toContain(expected);
      expect(adapter.metrics().syntheticSendAttempts).toBe(0);
    }

    const identities = createSyntheticM51BTeamsIdentities().filter(
      (identity) => identity.role !== "managing-director",
    );
    const { adapter, orchestrator } = foundation({ identities });
    const result = await orchestrator.deliver(request("UNMAPPED"));
    expect(result.denialCodes).toContain(
      "M51B_TEAMS_RECIPIENT_IDENTITY_NOT_MAPPED",
    );
    expect(adapter.metrics().syntheticSendAttempts).toBe(0);
  });

  it("denies a recipient absent from the resolved destination membership", async () => {
    const destinations = createSyntheticM51BTeamsDestinations().map((destination) =>
      destination.destinationId === M51B_TEAMS_DESTINATION_IDS.enterpriseLeadership
        ? { ...destination, memberTeamsUserIds: [] }
        : destination,
    );
    const { adapter, orchestrator } = foundation({ destinations });
    const result = await orchestrator.deliver(request("NONMEMBER"));

    expect(result.status).toBe("denied");
    expect(result.denialCodes).toContain(
      "M51B_TEAMS_RECIPIENT_NOT_DESTINATION_MEMBER",
    );
    expect(adapter.metrics().syntheticSendAttempts).toBe(0);
  });

  it("denies a T4 sender, mismatched approval actor, and forged actor claim", async () => {
    const t4 = createSyntheticM51BTeamsActor("billing-specialist");
    const { adapter, orchestrator } = foundation();
    const t4Result = await orchestrator.deliver({
      idempotencyKey: "SYNTH-M51B-TEAMS-SECURITY-T4",
      submittedAt: "2026-07-15T12:00:03.000Z",
      actor: t4,
      event: createSyntheticM51BTeamsEvent({
        eventId: "SYNTH-M51B-TEAMS-SECURITY-EVENT-T4",
        eventType: "training_due_approved",
        approvedByActorId: t4.actorId,
        sourceReference: "SYNTH-M51B-TEAMS-WORK-T4",
        ownerRole: "billing-specialist",
        destinationId: M51B_TEAMS_DESTINATION_IDS.workforceLearning,
        intendedRecipientActorIds: [t4.actorId],
      }),
    });
    expect(t4Result.denialCodes).toContain("M51B_TEAMS_SENDER_ROLE_DENIED");

    const mismatch = await orchestrator.deliver(
      request("APPROVER", {
        approvedByActorId: m51bTeamsActorId("administrator"),
      }),
    );
    expect(mismatch.denialCodes).toContain("M51B_TEAMS_APPROVER_ACTOR_MISMATCH");

    const canonical = createSyntheticM51BTeamsActor("super-admin");
    const forged = await orchestrator.deliver({
      ...request("FORGED"),
      actor: { ...canonical, divisionIds: ["bhc"] },
    });
    expect(forged.denialCodes).toContain("M51B_TEAMS_ACTOR_CLAIM_MISMATCH");
    expect(adapter.metrics().syntheticSendAttempts).toBe(0);
  });

  it("never converts a privacy denial into message, retry, dead-letter, or evidence state", async () => {
    const { orchestrator } = foundation();
    const result = await orchestrator.deliver(
      request("PRIVACY-BOUNDARY", {
        sourceSensitivity: "part2",
        consentStatus: "required_not_verified",
        untrustedFreeText: "guardian@example.invalid <at>all</at>",
      }),
    );

    expect(result.status).toBe("denied");
    expect(result.attempts).toEqual([]);
    expect(result.deadLetter).toBeNull();
    expect(result.operationalAlert).toBeNull();
    expect(result.evidence).toBeNull();
    expect(result.auditEvents[0]).toMatchObject({
      outcome: "denied",
      channel: "teams",
      immutable: true,
    });
  });
});
