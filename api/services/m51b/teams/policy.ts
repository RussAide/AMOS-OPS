import { ROLE_TIER_BY_ROLE } from "../../../../src/constants/access-control";
import {
  ALL_ROLES,
  type UserRole,
} from "../../../../src/constants/roles";
import { M51B_APPROVED_TENANT_BOUNDARY } from "../../../../contracts/m51b/shared";
import {
  M51B_TEAMS_MAX_BODY_LENGTH,
  M51B_TEAMS_MAX_MENTIONS,
  type M51BTeamsDestination,
  type M51BTeamsDispatchRequest,
  type M51BTeamsIdentity,
  type M51BTeamsMention,
  type M51BTeamsMinimizedPayload,
} from "../../../../contracts/m51b/teams";
import { M51BTeamsRegistry } from "./registry";
import {
  deepFreeze,
  parseTeamsTimestamp,
  requireTeamsSyntheticId,
  teamsDigest,
} from "./support";

export interface M51BTeamsDispatchPolicyDecision {
  allowed: boolean;
  denialCodes: readonly string[];
  destination: M51BTeamsDestination | null;
  recipients: readonly M51BTeamsIdentity[];
  payload: M51BTeamsMinimizedPayload | null;
}

const TEMPLATE_BY_EVENT = deepFreeze({
  workplan_assignment_approved: {
    subject: "Approved workplan assignment",
    body: "An approved governed work item is ready for action in AMOS-OPS.",
    actionLabel: "Open governed work item",
  },
  compliance_action_approved: {
    subject: "Approved compliance action",
    body: "An approved compliance work item is ready for action in AMOS-OPS.",
    actionLabel: "Review compliance action",
  },
  incident_followup_approved: {
    subject: "Approved follow-up action",
    body: "An approved follow-up work item is ready for action in AMOS-OPS.",
    actionLabel: "Open follow-up work item",
  },
  clinical_review_approved: {
    subject: "Approved clinical review task",
    body: "An approved review task is ready for action in the governed AMOS-OPS workspace.",
    actionLabel: "Open governed review task",
  },
  training_due_approved: {
    subject: "Approved workforce learning task",
    body: "An approved learning work item is ready for action in AMOS-OPS.",
    actionLabel: "Open learning task",
  },
  executive_decision_approved: {
    subject: "Approved executive decision action",
    body: "An approved decision work item is ready for action in AMOS-OPS.",
    actionLabel: "Open decision work item",
  },
} as const);

const PROHIBITED_PAYLOAD_PATTERNS = [
  /https?:\/\//i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}[-. ]?\d{2}[-. ]?\d{4}\b/,
  /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/,
  /\b(?:patient|youth|client|guardian|diagnosis|medication|claim)\s*(?:id|#|number|name)?\s*[:=]/i,
  /<at\b|<\/at>/i,
] as const;

function addCode(codes: string[], condition: boolean, code: string): void {
  if (condition && !codes.includes(code)) codes.push(code);
}

function validCanonicalRole(role: string): role is UserRole {
  return ALL_ROLES.includes(role as UserRole);
}

function validateTimestampOrder(
  request: M51BTeamsDispatchRequest,
  codes: string[],
): void {
  const occurred = parseTeamsTimestamp(request.event.occurredAt);
  const approved = request.event.approvedAt
    ? parseTeamsTimestamp(request.event.approvedAt)
    : null;
  const expires = request.event.approvalExpiresAt
    ? parseTeamsTimestamp(request.event.approvalExpiresAt)
    : null;
  const submitted = parseTeamsTimestamp(request.submittedAt);
  addCode(
    codes,
    occurred === null || approved === null || expires === null || submitted === null,
    "M51B_TEAMS_TIMESTAMP_INVALID",
  );
  if (
    occurred !== null &&
    approved !== null &&
    expires !== null &&
    submitted !== null
  ) {
    addCode(
      codes,
      occurred > approved || approved > submitted,
      "M51B_TEAMS_APPROVAL_TIME_SEQUENCE_INVALID",
    );
    addCode(
      codes,
      submitted > expires,
      "M51B_TEAMS_APPROVAL_EXPIRED",
    );
  }
  if (request.event.dueAt !== null) {
    addCode(
      codes,
      parseTeamsTimestamp(request.event.dueAt) === null,
      "M51B_TEAMS_DUE_TIME_INVALID",
    );
  }
}

function validateActor(
  request: M51BTeamsDispatchRequest,
  registry: M51BTeamsRegistry,
  destination: M51BTeamsDestination | null,
  codes: string[],
): M51BTeamsIdentity | null {
  const actor = request.actor;
  const identity = registry.resolveIdentityByActor(actor.actorId);
  addCode(codes, !actor.synthetic, "M51B_TEAMS_SYNTHETIC_ACTOR_REQUIRED");
  addCode(
    codes,
    !validCanonicalRole(actor.role),
    "M51B_TEAMS_CANONICAL_ROLE_REQUIRED",
  );
  addCode(codes, identity === null, "M51B_TEAMS_ACTOR_IDENTITY_NOT_MAPPED");
  if (identity) {
    addCode(codes, identity.status !== "active", "M51B_TEAMS_ACTOR_DISABLED");
    addCode(codes, identity.identityKind !== "member", "M51B_TEAMS_ACTOR_MEMBER_REQUIRED");
    addCode(
      codes,
      identity.tenantId !== M51B_APPROVED_TENANT_BOUNDARY,
      "M51B_TEAMS_ACTOR_TENANT_DENIED",
    );
    addCode(
      codes,
      identity.role !== actor.role ||
        identity.tier !== actor.tier ||
        !actor.divisionIds.includes(identity.divisionId),
      "M51B_TEAMS_ACTOR_CLAIM_MISMATCH",
    );
    addCode(
      codes,
      actor.tier !== ROLE_TIER_BY_ROLE[actor.role],
      "M51B_TEAMS_ACTOR_TIER_MISMATCH",
    );
  }
  addCode(
    codes,
    !actor.permissions.includes("m51a:route:resolve") ||
      !actor.permissions.includes("m51a:published-guidance:read"),
    "M51B_TEAMS_ACTOR_LEAST_PRIVILEGE_DENIED",
  );
  if (destination) {
    addCode(
      codes,
      !destination.allowedSenderRoles.includes(actor.role),
      "M51B_TEAMS_SENDER_ROLE_DENIED",
    );
  }
  return identity;
}

function resolveRecipients(
  request: M51BTeamsDispatchRequest,
  registry: M51BTeamsRegistry,
  destination: M51BTeamsDestination | null,
  codes: string[],
): readonly M51BTeamsIdentity[] {
  const intended = request.event.intendedRecipientActorIds;
  addCode(codes, intended.length === 0, "M51B_TEAMS_RECIPIENT_REQUIRED");
  addCode(
    codes,
    intended.length > M51B_TEAMS_MAX_MENTIONS,
    "M51B_TEAMS_MENTION_LIMIT_EXCEEDED",
  );
  addCode(
    codes,
    new Set(intended).size !== intended.length,
    "M51B_TEAMS_RECIPIENT_DUPLICATE",
  );
  const recipients: M51BTeamsIdentity[] = [];
  for (const actorId of intended) {
    const identity = registry.resolveIdentityByActor(actorId);
    if (!identity) {
      addCode(codes, true, "M51B_TEAMS_RECIPIENT_IDENTITY_NOT_MAPPED");
      continue;
    }
    recipients.push(identity);
    addCode(codes, identity.status !== "active", "M51B_TEAMS_RECIPIENT_DISABLED");
    addCode(
      codes,
      identity.identityKind !== "member",
      "M51B_TEAMS_GUEST_OR_SERVICE_MENTION_DENIED",
    );
    addCode(
      codes,
      identity.tenantId !== M51B_APPROVED_TENANT_BOUNDARY,
      "M51B_TEAMS_RECIPIENT_TENANT_DENIED",
    );
    if (destination) {
      addCode(
        codes,
        !destination.allowedRecipientRoles.includes(identity.role),
        "M51B_TEAMS_RECIPIENT_ROLE_DENIED",
      );
      addCode(
        codes,
        !destination.memberTeamsUserIds.includes(identity.teamsUserId),
        "M51B_TEAMS_RECIPIENT_NOT_DESTINATION_MEMBER",
      );
    }
  }
  addCode(
    codes,
    recipients.length > 0 &&
      !recipients.some((recipient) => recipient.role === request.event.ownerRole),
    "M51B_TEAMS_ACCOUNTABLE_OWNER_NOT_RECIPIENT",
  );
  return deepFreeze(recipients);
}

function buildPayload(
  request: M51BTeamsDispatchRequest,
  recipients: readonly M51BTeamsIdentity[],
  codes: string[],
): M51BTeamsMinimizedPayload | null {
  if (codes.length > 0) return null;
  const template = TEMPLATE_BY_EVENT[request.event.eventType];
  const mentions: readonly M51BTeamsMention[] = deepFreeze(
    recipients.map((recipient) => ({
      mentionId: `SYNTH-M51B-MENTION-${teamsDigest(
        request.event.eventId,
        recipient.teamsUserId,
      ).slice(-16).toUpperCase()}`,
      actorId: recipient.actorId,
      teamsUserId: recipient.teamsUserId,
      role: recipient.role,
      displayLabel: recipient.displayLabel,
      renderedText: `@${recipient.displayLabel}`,
      validated: true as const,
      synthetic: true as const,
    })),
  );
  const mentionPrefix = mentions.map((mention) => mention.renderedText).join(", ");
  const payload: M51BTeamsMinimizedPayload = deepFreeze({
    subject: template.subject,
    body: `${mentionPrefix} — ${template.body}`,
    actionLabel: template.actionLabel,
    routeReference: request.event.sourceReference,
    priority: request.event.priority,
    dueAt: request.event.dueAt,
    mentions,
    notificationSensitivity: "internal",
    minimized: true,
    freeTextIncluded: false,
    protectedRecordIdentifierIncluded: false,
    physicalMicrosoftUrlIncluded: false,
    fieldCount: 7,
    synthetic: true,
  });
  addCode(
    codes,
    payload.body.length > M51B_TEAMS_MAX_BODY_LENGTH,
    "M51B_TEAMS_MINIMIZED_BODY_LIMIT_EXCEEDED",
  );
  addCode(
    codes,
    PROHIBITED_PAYLOAD_PATTERNS.some((pattern) =>
      pattern.test(
        [payload.subject, payload.body, payload.actionLabel, payload.routeReference].join(
          " | ",
        ),
      ),
    ),
    "M51B_TEAMS_PROHIBITED_CONTENT_DETECTED",
  );
  return codes.length === 0 ? payload : null;
}

export function evaluateM51BTeamsDispatchPolicy(
  request: M51BTeamsDispatchRequest,
  registry: M51BTeamsRegistry,
): M51BTeamsDispatchPolicyDecision {
  const codes: string[] = [];
  try {
    requireTeamsSyntheticId(request.idempotencyKey, "idempotency_key");
    requireTeamsSyntheticId(request.event.eventId, "event");
    requireTeamsSyntheticId(request.event.sourceReference, "source_reference");
  } catch (error) {
    codes.push(error instanceof Error ? error.message : "M51B_TEAMS_ID_INVALID");
  }
  addCode(codes, !request.event.synthetic, "M51B_TEAMS_SYNTHETIC_EVENT_REQUIRED");
  addCode(
    codes,
    request.event.sourceSystem !== "amos-ops",
    "M51B_TEAMS_SOURCE_SYSTEM_DENIED",
  );
  addCode(
    codes,
    request.event.approvalStatus !== "approved",
    "M51B_TEAMS_EVENT_NOT_APPROVED",
  );
  addCode(
    codes,
    request.event.approvedByActorId === null ||
      request.event.approvedByActorId !== request.actor.actorId,
    "M51B_TEAMS_APPROVER_ACTOR_MISMATCH",
  );
  addCode(
    codes,
    request.event.consentStatus === "required_not_verified",
    "M51B_TEAMS_REQUIRED_CONSENT_NOT_VERIFIED",
  );
  addCode(
    codes,
    request.event.sourceSensitivity === "restricted" ||
      request.event.sourceSensitivity === "part2",
    "M51B_TEAMS_RESTRICTED_SOURCE_NOTIFICATION_DENIED",
  );
  addCode(
    codes,
    Boolean(request.event.untrustedFreeText?.trim()),
    "M51B_TEAMS_UNTRUSTED_FREE_TEXT_DENIED",
  );
  validateTimestampOrder(request, codes);

  const destination = registry.resolveDestination(request.event.destinationId);
  addCode(codes, destination === null, "M51B_TEAMS_DESTINATION_NOT_FOUND");
  if (destination) {
    addCode(codes, !destination.active, "M51B_TEAMS_DESTINATION_INACTIVE");
    addCode(
      codes,
      destination.tenantId !== M51B_APPROVED_TENANT_BOUNDARY,
      "M51B_TEAMS_DESTINATION_TENANT_DENIED",
    );
    addCode(
      codes,
      !destination.allowedEventTypes.includes(request.event.eventType),
      "M51B_TEAMS_EVENT_DESTINATION_MAPPING_DENIED",
    );
    addCode(
      codes,
      !destination.allowedDivisions.includes(request.event.divisionId),
      "M51B_TEAMS_DESTINATION_DIVISION_DENIED",
    );
    addCode(
      codes,
      destination.physicalUrlExposed,
      "M51B_TEAMS_PHYSICAL_URL_EXPOSURE_DENIED",
    );
  }

  validateActor(request, registry, destination, codes);
  const recipients = resolveRecipients(request, registry, destination, codes);
  const payload = buildPayload(request, recipients, codes);
  return deepFreeze({
    allowed: codes.length === 0,
    denialCodes: [...codes].sort(),
    destination: codes.length === 0 ? destination : null,
    recipients,
    payload,
  });
}
