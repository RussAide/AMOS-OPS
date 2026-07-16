import { ALL_ROLES, type UserRole } from "../../../../src/constants/roles";
import { M52_APPROVED_WORKFLOW_IDS } from "../../../../contracts/m52/shared";
import { addReason, deepFreeze, requireSyntheticId } from "./support";
import type {
  M52OfflineAction,
  M52OfflineCapabilityDecision,
  M52OfflineCapabilityRequest,
  M52OfflineWorkflowId,
  M52OfflineWorkflowPolicy,
  M52JsonValue,
} from "./types";

export const M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS = deepFreeze<
  readonly M52OfflineAction[]
>([
  "create-medication-order",
  "modify-medication-schedule",
  "override-allergy-or-hold",
  "finalize-without-verification",
  "record-controlled-substance-waste",
  "activate-crisis-dispatch",
  "calculate-clinical-score",
  "determine-level-of-care",
  "approve-or-esign",
  "submit-external-referral",
  "submit-claim",
  "publish-to-microsoft-365",
  "change-consent",
  "change-user-or-permission",
  "delete-authoritative-record",
  "bulk-export-print-or-share",
  "cross-youth-access",
  "cross-division-access",
]);

export const M52_PROHIBITED_OFFLINE_RECORDS = deepFreeze([
  {
    recordClass: "authoritative-medication-order",
    disposition: "network-required",
    reason: "Orders, schedule changes, allergy/hold overrides, and controlled-substance waste require the authoritative online record and verification chain.",
  },
  {
    recordClass: "clinical-score-or-level-of-care-decision",
    disposition: "network-required",
    reason: "Offline mode may show approved read-only guidance but cannot calculate, recommend, activate, or finalize scoring or level-of-care logic.",
  },
  {
    recordClass: "crisis-dispatch-or-external-care-coordination",
    disposition: "network-required-with-human-safety-procedure",
    reason: "The application cannot represent an offline queue as a completed emergency dispatch or external referral.",
  },
  {
    recordClass: "claim-billing-or-payer-submission",
    disposition: "network-required",
    reason: "No claim, billing, authorization, or payer transaction is submitted from the device cache.",
  },
  {
    recordClass: "consent-signature-or-final-approval",
    disposition: "network-required",
    reason: "Consent changes, signatures, approvals, and finalization require current server state and authoritative identity checks.",
  },
  {
    recordClass: "identity-role-permission-or-system-configuration",
    disposition: "never-cached",
    reason: "Administrative security state is neither changed nor durably exposed through offline mode.",
  },
  {
    recordClass: "microsoft-publication-or-external-disclosure",
    disposition: "network-required",
    reason: "Offline mode cannot publish, email, notify, print, bulk export, share, or disclose content.",
  },
  {
    recordClass: "authoritative-record-deletion",
    disposition: "network-required",
    reason: "Offline records are append/update intents; they cannot delete an authoritative record.",
  },
] as const);

const DIRECT_CARE_ROLES = deepFreeze<readonly UserRole[]>([
  "shift-supervisor",
  "rcs-lead",
  "rcs-day",
  "rcs-night",
  "rcs-prn",
  "youth-care-worker",
  "behavioral-support",
  "crisis-intervention-specialist",
  "medication-aide",
  "nurse",
]);

const CLINICAL_FIELD_ROLES = deepFreeze<readonly UserRole[]>([
  "clinical-supervisor",
  "qmhp-cs",
  "case-manager",
  "therapist",
  "nurse",
  "mhtcm-supervisor",
  "mhrs-supervisor",
]);

const COMMON_RESTRICTIONS = deepFreeze([
  "Minimum-necessary synthetic fixture data only.",
  "Device, installation, user, role, division, and youth scope must match the active session.",
  "All mutations remain visibly pending until server reconciliation succeeds.",
  "No offline action may imply an external notification, authoritative approval, or completed synchronization.",
] as const);

export const M52_OFFLINE_CAPABILITY_MATRIX = deepFreeze<
  readonly M52OfflineWorkflowPolicy[]
>([
  {
    workflowId: "gro_tablet_medication_pass",
    label: "GRO tablet medication pass",
    offlineFirst: true,
    youthBound: true,
    authorizedRoles: ["medication-aide", "nurse"],
    authorizedDivisions: ["gro"],
    allowedOfflineActions: [
      "view-minimum-necessary",
      "verify-five-rights",
      "record-administration",
      "record-refusal",
      "record-held",
      "capture-required-attestation",
    ],
    prohibitedOfflineActions: [
      "create-medication-order",
      "modify-medication-schedule",
      "override-allergy-or-hold",
      "finalize-without-verification",
      "record-controlled-substance-waste",
    ],
    minimumNecessaryFields: [
      "opaqueYouthLabel",
      "medicationDisplayLabel",
      "doseDisplay",
      "routeDisplay",
      "scheduledWindow",
      "outcome",
      "exceptionReason",
      "allergyHoldIndicators",
      "verificationChecklist",
      "requiredNote",
      "staffAttestation",
    ],
    maxCacheMinutes: 240,
    reconnectDisposition: "clinical-review-before-finalize",
    restrictions: [
      ...COMMON_RESTRICTIONS,
      "A pending administered, refused, or held event is immutable but not final until current order, authorization, allergy/hold, timing, and duplicate status reconcile.",
      "First-dose activation, e-prescribing, pharmacy inventory, emergency/PRN authorization, order change, waste/witness, discrepancy, and override workflows remain online/human governed.",
    ],
    synthetic: true,
  },
  {
    workflowId: "gro_shift_safety_handoff",
    label: "GRO shift safety and handoff",
    offlineFirst: true,
    youthBound: true,
    authorizedRoles: DIRECT_CARE_ROLES,
    authorizedDivisions: ["gro"],
    allowedOfflineActions: [
      "view-minimum-necessary",
      "record-safety-observation",
      "record-escalation-pending",
      "create-own-draft",
      "update-own-draft",
      "queue-handoff",
      "create-incident-draft",
    ],
    prohibitedOfflineActions: [
      "activate-crisis-dispatch",
      "approve-or-esign",
      "delete-authoritative-record",
      "bulk-export-print-or-share",
    ],
    minimumNecessaryFields: [
      "opaqueYouthLabel",
      "shiftWindow",
      "structuredObservationCodes",
      "adlBehaviorCodes",
      "checklistCompletion",
      "draftNarrative",
      "handoffFlags",
      "incidentDraft",
      "safetyProcedureUsed",
    ],
    maxCacheMinutes: 480,
    reconnectDisposition: "supervisor-review-before-finalize",
    restrictions: [
      ...COMMON_RESTRICTIONS,
      "Only the authenticated user's draft may be changed offline; another user's note, signature, or approval cannot be altered.",
      "Required safety, emergency, supervisory, and reportable-event procedures proceed outside the queue; an offline escalation flag is not a dispatch.",
      "Incident content remains a draft and is checked for clock drift, duplication, and authoritative status on reconnect.",
    ],
    synthetic: true,
  },
  {
    workflowId: "bhc_field_case_management_contact",
    label: "BHC field case-management contact",
    offlineFirst: true,
    youthBound: true,
    authorizedRoles: CLINICAL_FIELD_ROLES,
    authorizedDivisions: ["bhc"],
    allowedOfflineActions: [
      "view-minimum-necessary",
      "capture-contact-draft",
      "update-own-draft",
      "queue-task-status",
    ],
    prohibitedOfflineActions: [
      "calculate-clinical-score",
      "determine-level-of-care",
      "submit-external-referral",
      "approve-or-esign",
    ],
    minimumNecessaryFields: [
      "opaqueYouthLabel",
      "assignedContactPurpose",
      "contactStatus",
      "structuredFindings",
      "draftNarrative",
      "serviceTask",
      "careCoordinationUpdate",
      "followupDate",
    ],
    maxCacheMinutes: 480,
    reconnectDisposition: "clinical-review-before-finalize",
    restrictions: [
      ...COMMON_RESTRICTIONS,
      "No offline clinical scoring, level-of-care determination, external referral, crisis dispatch, or treatment authorization is permitted.",
    ],
    synthetic: true,
  },
  {
    workflowId: "enterprise_task_structured_form",
    label: "Assigned enterprise task and structured form",
    offlineFirst: true,
    youthBound: true,
    authorizedRoles: [...DIRECT_CARE_ROLES, ...CLINICAL_FIELD_ROLES],
    authorizedDivisions: ["eo", "gro", "bhc", "gad"],
    allowedOfflineActions: [
      "view-minimum-necessary",
      "queue-task-status",
      "create-own-draft",
      "update-own-draft",
      "complete-structured-form-draft",
    ],
    prohibitedOfflineActions: [
      "approve-or-esign",
      "submit-external-referral",
      "publish-to-microsoft-365",
      "delete-authoritative-record",
    ],
    minimumNecessaryFields: [
      "opaqueYouthLabel",
      "taskDisplayLabel",
      "dueWindow",
      "pendingStatus",
      "checklistOrFormDraft",
      "draftComment",
    ],
    maxCacheMinutes: 480,
    reconnectDisposition: "reconcile-before-finalize",
    restrictions: [
      ...COMMON_RESTRICTIONS,
      "Only assigned task status and the authenticated user's draft comment are queued; routing and completion remain server-authoritative.",
    ],
    synthetic: true,
  },
]);

export const M52_APPROVED_OFFLINE_CORE_WORKFLOWS = deepFreeze(
  [...M52_APPROVED_WORKFLOW_IDS],
);

export interface M52OfflinePayloadSchema {
  readonly workflowId: M52OfflineWorkflowId;
  readonly requiredFields: readonly string[];
  readonly allowedFields: readonly string[];
  readonly maximumSerializedBytes: number;
  readonly synthetic: true;
}

export const M52_OFFLINE_PAYLOAD_SCHEMAS = deepFreeze<
  Readonly<Record<M52OfflineWorkflowId, M52OfflinePayloadSchema>>
>({
  gro_tablet_medication_pass: {
    workflowId: "gro_tablet_medication_pass",
    requiredFields: [
      "opaqueYouthLabel",
      "medicationDisplayLabel",
      "doseDisplay",
      "routeDisplay",
      "scheduledWindow",
      "outcome",
      "exceptionReason",
      "allergyHoldIndicators",
      "verificationChecklist",
      "requiredNote",
      "staffAttestation",
    ],
    allowedFields: [
      "opaqueYouthLabel",
      "medicationDisplayLabel",
      "doseDisplay",
      "routeDisplay",
      "scheduledWindow",
      "outcome",
      "exceptionReason",
      "allergyHoldIndicators",
      "verificationChecklist",
      "requiredNote",
      "staffAttestation",
    ],
    maximumSerializedBytes: 8_192,
    synthetic: true,
  },
  gro_shift_safety_handoff: {
    workflowId: "gro_shift_safety_handoff",
    requiredFields: [
      "opaqueYouthLabel",
      "shiftWindow",
      "structuredObservationCodes",
      "adlBehaviorCodes",
      "checklistCompletion",
      "draftNarrative",
      "handoffFlags",
    ],
    allowedFields: [
      "opaqueYouthLabel",
      "shiftWindow",
      "structuredObservationCodes",
      "adlBehaviorCodes",
      "checklistCompletion",
      "draftNarrative",
      "handoffFlags",
      "incidentDraft",
      "safetyProcedureUsed",
    ],
    maximumSerializedBytes: 16_384,
    synthetic: true,
  },
  bhc_field_case_management_contact: {
    workflowId: "bhc_field_case_management_contact",
    requiredFields: [
      "opaqueYouthLabel",
      "assignedContactPurpose",
      "contactStatus",
      "structuredFindings",
      "draftNarrative",
      "serviceTask",
      "careCoordinationUpdate",
      "followupDate",
    ],
    allowedFields: [
      "opaqueYouthLabel",
      "assignedContactPurpose",
      "contactStatus",
      "structuredFindings",
      "draftNarrative",
      "serviceTask",
      "careCoordinationUpdate",
      "followupDate",
    ],
    maximumSerializedBytes: 16_384,
    synthetic: true,
  },
  enterprise_task_structured_form: {
    workflowId: "enterprise_task_structured_form",
    requiredFields: [
      "opaqueYouthLabel",
      "taskDisplayLabel",
      "dueWindow",
      "pendingStatus",
      "checklistOrFormDraft",
      "draftComment",
    ],
    allowedFields: [
      "opaqueYouthLabel",
      "taskDisplayLabel",
      "dueWindow",
      "pendingStatus",
      "checklistOrFormDraft",
      "draftComment",
    ],
    maximumSerializedBytes: 16_384,
    synthetic: true,
  },
});

const PROHIBITED_PAYLOAD_KEY_PATTERN =
  /(?:socialsecurity|dateofbirth|fullname|email|phone|diagnosis|clinicalscore|levelofcare|medicationorder|prescription|consentsignature|claim|billing|payment|permission|rolechange|externalrecipient|attachmentbytes|base64|photo)/i;
const PROHIBITED_SHORT_PAYLOAD_KEY_PATTERN =
  /^(?:(?:patient|youth|client|member)?(?:ssn|dob))$/i;

export interface M52PayloadMinimumNecessaryDecision {
  readonly allowed: boolean;
  readonly workflowId: M52OfflineWorkflowId;
  readonly reasonCodes: readonly string[];
  readonly serializedBytes: number;
  readonly synthetic: true;
}

export type M52MedicationOutcome = "administered" | "refused" | "held";

export interface M52MedicationStaffAttestation {
  readonly actorId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly installationId: string;
  readonly attestedAt: string;
  readonly synthetic: true;
}

function jsonObject(
  value: M52JsonValue | undefined,
): Readonly<Record<string, M52JsonValue>> | null {
  if (value === null || value === undefined || Array.isArray(value)) return null;
  return typeof value === "object"
    ? (value as Readonly<Record<string, M52JsonValue>>)
    : null;
}

function hasExactKeys(
  value: Readonly<Record<string, M52JsonValue>>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function validateMedicationPayloadStructure(
  payload: Readonly<Record<string, M52JsonValue>>,
  reasons: string[],
): void {
  const outcome = payload.outcome;
  const validOutcome =
    outcome === "administered" || outcome === "refused" || outcome === "held";
  addReason(reasons, !validOutcome, "M52_MEDICATION_OUTCOME_INVALID");
  const exceptionReason = payload.exceptionReason;
  addReason(
    reasons,
    (outcome === "refused" || outcome === "held") &&
      (typeof exceptionReason !== "string" || exceptionReason.trim().length === 0),
    "M52_MEDICATION_EXCEPTION_REASON_REQUIRED",
  );
  addReason(
    reasons,
    outcome === "administered" && exceptionReason !== null,
    "M52_MEDICATION_EXCEPTION_REASON_NOT_APPLICABLE",
  );

  const checklist = jsonObject(payload.verificationChecklist);
  const checklistKeys = [
    "youthVerified",
    "medicationVerified",
    "doseVerified",
    "routeVerified",
    "scheduledTimeVerified",
  ] as const;
  addReason(
    reasons,
    checklist === null ||
      !hasExactKeys(checklist, checklistKeys) ||
      checklistKeys.some((key) => checklist[key] !== true),
    "M52_MEDICATION_FIVE_RIGHTS_INCOMPLETE",
  );

  const allergyHold = jsonObject(payload.allergyHoldIndicators);
  const allergyHoldKeys = [
    "allergyReviewed",
    "holdReviewed",
    "activeAllergyConflict",
    "activeHold",
  ] as const;
  addReason(
    reasons,
    allergyHold === null ||
      !hasExactKeys(allergyHold, allergyHoldKeys) ||
      allergyHoldKeys.some((key) => typeof allergyHold[key] !== "boolean") ||
      allergyHold?.allergyReviewed !== true ||
      allergyHold?.holdReviewed !== true,
    "M52_MEDICATION_ALLERGY_HOLD_REVIEW_INCOMPLETE",
  );

  addReason(
    reasons,
    typeof payload.requiredNote !== "string" ||
      payload.requiredNote.trim().length === 0 ||
      payload.requiredNote.length > 2_000,
    "M52_MEDICATION_REQUIRED_NOTE_INVALID",
  );

  const attestation = jsonObject(payload.staffAttestation);
  const attestationKeys = [
    "actorId",
    "sessionId",
    "deviceId",
    "installationId",
    "attestedAt",
    "synthetic",
  ] as const;
  const attestationShapeValid =
    attestation !== null &&
    hasExactKeys(attestation, attestationKeys) &&
    typeof attestation.actorId === "string" &&
    typeof attestation.sessionId === "string" &&
    typeof attestation.deviceId === "string" &&
    typeof attestation.installationId === "string" &&
    typeof attestation.attestedAt === "string" &&
    attestation.synthetic === true;
  addReason(
    reasons,
    !attestationShapeValid,
    "M52_MEDICATION_STAFF_ATTESTATION_INVALID",
  );
  if (attestationShapeValid) {
    try {
      requireSyntheticId(attestation.actorId as string, "attestation_actor_id");
      requireSyntheticId(attestation.sessionId as string, "attestation_session_id");
      requireSyntheticId(attestation.deviceId as string, "attestation_device_id");
      requireSyntheticId(
        attestation.installationId as string,
        "attestation_installation_id",
      );
      if (!Number.isFinite(Date.parse(attestation.attestedAt as string))) {
        throw new Error("invalid timestamp");
      }
    } catch {
      addReason(
        reasons,
        true,
        "M52_MEDICATION_STAFF_ATTESTATION_INVALID",
      );
    }
  }
}

export function extractM52MedicationStaffAttestation(
  payload: M52JsonValue,
): Readonly<M52MedicationStaffAttestation> {
  const object = jsonObject(payload);
  const attestation = object ? jsonObject(object.staffAttestation) : null;
  if (!attestation) throw new Error("M52_MEDICATION_STAFF_ATTESTATION_INVALID");
  return deepFreeze({
    actorId: String(attestation.actorId ?? ""),
    sessionId: String(attestation.sessionId ?? ""),
    deviceId: String(attestation.deviceId ?? ""),
    installationId: String(attestation.installationId ?? ""),
    attestedAt: String(attestation.attestedAt ?? ""),
    synthetic: true,
  });
}

function scanPayloadKeys(value: M52JsonValue, reasons: string[]): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) scanPayloadKeys(item, reasons);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9]/gi, "");
    addReason(
      reasons,
      PROHIBITED_PAYLOAD_KEY_PATTERN.test(normalized) ||
        PROHIBITED_SHORT_PAYLOAD_KEY_PATTERN.test(normalized),
      "M52_PAYLOAD_PROHIBITED_FIELD",
    );
    scanPayloadKeys(item, reasons);
  }
}

export function evaluateM52PayloadMinimumNecessary(
  workflowId: M52OfflineWorkflowId,
  payload: M52JsonValue,
): Readonly<M52PayloadMinimumNecessaryDecision> {
  const schema = M52_OFFLINE_PAYLOAD_SCHEMAS[workflowId];
  const reasons: string[] = [];
  let serializedBytes = 0;
  if (payload === null || Array.isArray(payload) || typeof payload !== "object") {
    reasons.push("M52_PAYLOAD_OBJECT_REQUIRED");
  } else {
    const keys = Object.keys(payload);
    addReason(
      reasons,
      schema.requiredFields.some((field) => !keys.includes(field)),
      "M52_PAYLOAD_REQUIRED_FIELD_MISSING",
    );
    addReason(
      reasons,
      keys.some((field) => !schema.allowedFields.includes(field)),
      "M52_PAYLOAD_EXCESS_FIELD_DENIED",
    );
    scanPayloadKeys(payload, reasons);
    if (workflowId === "gro_tablet_medication_pass") {
      validateMedicationPayloadStructure(
        payload as Readonly<Record<string, M52JsonValue>>,
        reasons,
      );
    }
  }
  try {
    serializedBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    reasons.push("M52_PAYLOAD_SERIALIZATION_FAILED");
  }
  addReason(
    reasons,
    serializedBytes <= 0 || serializedBytes > schema.maximumSerializedBytes,
    "M52_PAYLOAD_SIZE_DENIED",
  );
  return deepFreeze({
    allowed: reasons.length === 0,
    workflowId,
    reasonCodes: reasons.length === 0 ? ["M52_PAYLOAD_MINIMUM_NECESSARY"] : reasons,
    serializedBytes,
    synthetic: true,
  });
}

const CANONICAL_ROLES = new Set<string>(ALL_ROLES);
const GLOBAL_PROHIBITIONS = new Set<string>(
  M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS,
);
const POLICY_BY_WORKFLOW = new Map<M52OfflineWorkflowId, M52OfflineWorkflowPolicy>(
  M52_OFFLINE_CAPABILITY_MATRIX.map((policy) => [policy.workflowId, policy]),
);

export function evaluateM52OfflineCapability(
  request: M52OfflineCapabilityRequest,
): Readonly<M52OfflineCapabilityDecision> {
  const reasons: string[] = [];
  addReason(reasons, !request.synthetic, "M52_SYNTHETIC_REQUEST_REQUIRED");
  const policy = POLICY_BY_WORKFLOW.get(request.workflowId as M52OfflineWorkflowId);
  addReason(reasons, !policy, "M52_WORKFLOW_NOT_APPROVED_OFFLINE");
  addReason(reasons, !CANONICAL_ROLES.has(request.role), "M52_ROLE_NOT_CANONICAL");
  addReason(reasons, !request.deviceCompliant, "M52_DEVICE_NOT_COMPLIANT");
  addReason(reasons, !request.sessionActive, "M52_SESSION_NOT_ACTIVE");
  addReason(
    reasons,
    GLOBAL_PROHIBITIONS.has(request.action),
    "M52_ACTION_GLOBALLY_PROHIBITED_OFFLINE",
  );

  if (policy) {
    addReason(
      reasons,
      !policy.authorizedRoles.includes(request.role as UserRole),
      "M52_ROLE_NOT_AUTHORIZED_FOR_WORKFLOW",
    );
    addReason(
      reasons,
      !policy.authorizedDivisions.includes(
        request.divisionId as (typeof policy.authorizedDivisions)[number],
      ),
      "M52_DIVISION_NOT_AUTHORIZED_FOR_WORKFLOW",
    );
    addReason(
      reasons,
      !policy.allowedOfflineActions.includes(request.action as M52OfflineAction),
      "M52_ACTION_NOT_APPROVED_OFFLINE",
    );
    addReason(
      reasons,
      policy.youthBound && request.youthId === null,
      "M52_YOUTH_SCOPE_REQUIRED",
    );
    if (request.youthId !== null) {
      try {
        requireSyntheticId(request.youthId, "youth_id");
      } catch {
        addReason(reasons, true, "M52_SYNTHETIC_YOUTH_SCOPE_REQUIRED");
      }
    }
  }

  // This matrix governs the offline path. Online operations continue through
  // their authoritative server policies and do not gain permission here.
  addReason(reasons, request.online, "M52_OFFLINE_POLICY_NOT_AN_ONLINE_GRANT");

  return deepFreeze({
    allowed: reasons.length === 0,
    workflowId: request.workflowId,
    action: request.action,
    reasonCodes: reasons.length === 0 ? ["M52_OFFLINE_ACTION_APPROVED"] : reasons,
    maxCacheMinutes: policy?.maxCacheMinutes ?? null,
    reconnectDisposition: policy?.reconnectDisposition ?? null,
    restrictions: policy?.restrictions ?? [],
    synthetic: true,
  });
}

export interface M52CapabilityMatrixIntegrity {
  readonly accepted: boolean;
  readonly contractWorkflowSetMatch: boolean;
  readonly approvedWorkflowCount: number;
  readonly offlineFirstWorkflowCount: number;
  readonly duplicateWorkflowIds: readonly string[];
  readonly missingRequiredControls: readonly string[];
  readonly globallyProhibitedActionCount: number;
  readonly prohibitedRecordClassCount: number;
  readonly synthetic: true;
}

export function inspectM52CapabilityMatrix(): Readonly<M52CapabilityMatrixIntegrity> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const missing: string[] = [];
  for (const policy of M52_OFFLINE_CAPABILITY_MATRIX) {
    if (seen.has(policy.workflowId)) duplicates.add(policy.workflowId);
    seen.add(policy.workflowId);
    if (!policy.offlineFirst) missing.push(`${policy.workflowId}:offline-first`);
    if (policy.authorizedRoles.length === 0) missing.push(`${policy.workflowId}:roles`);
    if (policy.authorizedDivisions.length === 0)
      missing.push(`${policy.workflowId}:divisions`);
    if (policy.allowedOfflineActions.length === 0)
      missing.push(`${policy.workflowId}:allowed-actions`);
    if (policy.prohibitedOfflineActions.length === 0)
      missing.push(`${policy.workflowId}:prohibited-actions`);
    if (policy.minimumNecessaryFields.length === 0)
      missing.push(`${policy.workflowId}:minimum-necessary`);
    const payloadSchema = M52_OFFLINE_PAYLOAD_SCHEMAS[policy.workflowId];
    if (
      JSON.stringify([...policy.minimumNecessaryFields].sort()) !==
      JSON.stringify([...payloadSchema.allowedFields].sort())
    ) {
      missing.push(`${policy.workflowId}:payload-schema-drift`);
    }
    if (policy.restrictions.length < COMMON_RESTRICTIONS.length)
      missing.push(`${policy.workflowId}:restrictions`);
    if (policy.maxCacheMinutes <= 0 || policy.maxCacheMinutes > 480)
      missing.push(`${policy.workflowId}:cache-ttl`);
    const overlap = policy.allowedOfflineActions.filter((action) =>
      policy.prohibitedOfflineActions.includes(action),
    );
    if (overlap.length > 0) missing.push(`${policy.workflowId}:action-overlap`);
  }
  const actualSet = [...seen].sort();
  const contractSet = [...M52_APPROVED_WORKFLOW_IDS].sort();
  const contractWorkflowSetMatch =
    JSON.stringify(actualSet) === JSON.stringify(contractSet);
  if (!contractWorkflowSetMatch) missing.push("canonical-workflow-set:exact-match");
  return deepFreeze({
    accepted:
      duplicates.size === 0 &&
      missing.length === 0 &&
      contractWorkflowSetMatch,
    contractWorkflowSetMatch,
    approvedWorkflowCount: M52_OFFLINE_CAPABILITY_MATRIX.length,
    offlineFirstWorkflowCount: M52_OFFLINE_CAPABILITY_MATRIX.filter(
      (policy) => policy.offlineFirst,
    ).length,
    duplicateWorkflowIds: [...duplicates].sort(),
    missingRequiredControls: missing.sort(),
    globallyProhibitedActionCount: M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS.length,
    prohibitedRecordClassCount: M52_PROHIBITED_OFFLINE_RECORDS.length,
    synthetic: true,
  });
}

export function getM52OfflineWorkflowPolicy(
  workflowId: M52OfflineWorkflowId,
): M52OfflineWorkflowPolicy {
  const policy = POLICY_BY_WORKFLOW.get(workflowId);
  if (!policy) throw new Error("M52_WORKFLOW_NOT_APPROVED_OFFLINE");
  return policy;
}
