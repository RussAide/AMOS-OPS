import type { DivisionId } from "../../../../src/constants/organization";
import type { UserRole } from "../../../../src/constants/roles";
import type { M52ApprovedWorkflowId } from "../../../../contracts/m52/shared";

export const M52_SYNTHETIC_BOUNDARY =
  "AMOS-OPS-M5.2-SYNTHETIC-PROTOTYPE" as const;
export const M52_CACHE_ALGORITHM = "AES-256-GCM" as const;
export const M52_CACHE_SCHEMA_VERSION = 1 as const;

export type M52JsonPrimitive = string | number | boolean | null;
export type M52JsonValue =
  | M52JsonPrimitive
  | readonly M52JsonValue[]
  | { readonly [key: string]: M52JsonValue };

export type M52OfflineWorkflowId = M52ApprovedWorkflowId;

export type M52OfflineAction =
  | "view-minimum-necessary"
  | "verify-five-rights"
  | "record-administration"
  | "record-refusal"
  | "record-held"
  | "capture-required-attestation"
  | "record-safety-observation"
  | "record-escalation-pending"
  | "create-own-draft"
  | "update-own-draft"
  | "queue-handoff"
  | "create-incident-draft"
  | "capture-contact-draft"
  | "queue-task-status"
  | "complete-structured-form-draft"
  | "create-medication-order"
  | "modify-medication-schedule"
  | "override-allergy-or-hold"
  | "finalize-without-verification"
  | "record-controlled-substance-waste"
  | "activate-crisis-dispatch"
  | "calculate-clinical-score"
  | "determine-level-of-care"
  | "approve-or-esign"
  | "submit-external-referral"
  | "submit-claim"
  | "publish-to-microsoft-365"
  | "change-consent"
  | "change-user-or-permission"
  | "delete-authoritative-record"
  | "bulk-export-print-or-share"
  | "cross-youth-access"
  | "cross-division-access";

export interface M52OfflineWorkflowPolicy {
  readonly workflowId: M52OfflineWorkflowId;
  readonly label: string;
  readonly offlineFirst: true;
  readonly youthBound: true;
  readonly authorizedRoles: readonly UserRole[];
  readonly authorizedDivisions: readonly DivisionId[];
  readonly allowedOfflineActions: readonly M52OfflineAction[];
  readonly prohibitedOfflineActions: readonly M52OfflineAction[];
  readonly minimumNecessaryFields: readonly string[];
  readonly maxCacheMinutes: number;
  readonly reconnectDisposition:
    | "reconcile-before-finalize"
    | "supervisor-review-before-finalize"
    | "clinical-review-before-finalize";
  readonly restrictions: readonly string[];
  readonly synthetic: true;
}

export interface M52OfflineCapabilityRequest {
  readonly workflowId: M52OfflineWorkflowId | string;
  readonly action: M52OfflineAction | string;
  readonly role: UserRole | string;
  readonly divisionId: DivisionId | string;
  readonly youthId: string | null;
  readonly online: boolean;
  readonly deviceCompliant: boolean;
  readonly sessionActive: boolean;
  readonly synthetic: boolean;
}

export interface M52OfflineCapabilityDecision {
  readonly allowed: boolean;
  readonly workflowId: string;
  readonly action: string;
  readonly reasonCodes: readonly string[];
  readonly maxCacheMinutes: number | null;
  readonly reconnectDisposition: M52OfflineWorkflowPolicy["reconnectDisposition"] | null;
  readonly restrictions: readonly string[];
  readonly synthetic: true;
}

export type M52DevicePlatform = "ios" | "ipados" | "android" | "windows";
export type M52DeviceFormFactor = "phone" | "tablet";

export interface M52DeviceAttestation {
  readonly deviceId: string;
  readonly installationId: string;
  readonly hardwareKeyId: string;
  readonly platform: M52DevicePlatform;
  readonly platformVersion: string;
  readonly formFactor: M52DeviceFormFactor;
  readonly managed: boolean;
  readonly encryptionAtRest: boolean;
  readonly hardwareBackedKey: boolean;
  readonly screenLockEnabled: boolean;
  readonly autoLockMinutes: number;
  readonly rootedOrJailbroken: boolean;
  readonly applicationIntegrityPassed: boolean;
  readonly remoteWipeCapable: boolean;
  readonly osPatchAgeDays: number;
  readonly clockDriftSeconds: number;
  readonly attestedAt: string;
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly synthetic: true;
}

export interface M52DevicePolicyDecision {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly minimumVersion: string | null;
  readonly evaluatedAt: string;
  readonly liveMdmCalls: 0;
  readonly liveDeviceCalls: 0;
  readonly synthetic: true;
}

export type M52DeviceState =
  | "active"
  | "revoked"
  | "wipe-pending"
  | "wiped"
  | "superseded-by-reinstall";

export interface M52DeviceBinding {
  readonly deviceId: string;
  readonly installationId: string;
  readonly hardwareKeyId: string;
  readonly enrolledAt: string;
  readonly state: M52DeviceState;
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly synthetic: true;
}

export interface M52CachePrincipal {
  readonly userId: string;
  readonly role: UserRole;
  readonly divisionId: DivisionId;
  readonly youthScopeIds: readonly string[];
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly synthetic: true;
}

export interface M52CachePartition {
  readonly userId: string;
  readonly role: UserRole;
  readonly divisionId: DivisionId;
  readonly youthId: string;
}

export interface M52CacheWriteRequest {
  readonly entryId: string;
  readonly recordId: string;
  readonly workflowId: M52OfflineWorkflowId;
  readonly youthId: string;
  readonly payload: M52JsonValue;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly synthetic: true;
}

export interface M52CachedRecord {
  readonly entryId: string;
  readonly recordId: string;
  readonly workflowId: M52OfflineWorkflowId;
  readonly youthId: string;
  readonly payload: M52JsonValue;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly synthetic: true;
}

/**
 * The only durable shape accepted by the cache store. All identity, scope,
 * youth, record, workflow, and payload values are either encrypted or reduced
 * to one-way digests before this structure reaches persistence.
 */
export interface M52CiphertextEnvelope {
  readonly schemaVersion: typeof M52_CACHE_SCHEMA_VERSION;
  readonly algorithm: typeof M52_CACHE_ALGORITHM;
  readonly keyVersion: 1;
  readonly entryId: string;
  readonly deviceDigest: string;
  readonly bindingDigest: string;
  readonly userDigest: string;
  readonly partitionDigest: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly authTag: string;
  readonly synthetic: true;
}

export interface M52CacheWriteResult {
  readonly entryId: string;
  readonly replaced: boolean;
  readonly ciphertextBytes: number;
  readonly persistedPlaintextBytes: 0;
  readonly algorithm: typeof M52_CACHE_ALGORITHM;
  readonly synthetic: true;
}

export type M52SessionState =
  | "active"
  | "logged-out"
  | "idle-timeout"
  | "absolute-timeout"
  | "device-revoked";

export interface M52OfflineSession {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly installationId: string;
  readonly principal: M52CachePrincipal;
  readonly startedAt: string;
  readonly lastActivityAt: string;
  readonly absoluteExpiresAt: string;
  readonly state: M52SessionState;
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly synthetic: true;
}

export interface M52SecurityAuditEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly deviceDigest: string;
  readonly outcome: "accepted" | "denied" | "expired" | "revoked" | "wiped";
  readonly reasonCodes: readonly string[];
  readonly immutable: true;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export interface M52RemoteWipeResult {
  readonly deviceId: string;
  readonly revokedSessions: number;
  readonly deletedCiphertextEnvelopes: number;
  readonly remainingDeviceEnvelopes: 0;
  readonly finalState: "wiped";
  readonly auditEvents: readonly M52SecurityAuditEvent[];
  readonly liveMdmCalls: 0;
  readonly liveDeviceCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export interface M52SecurityBoundarySnapshot {
  readonly boundary: typeof M52_SYNTHETIC_BOUNDARY;
  readonly syntheticOnly: true;
  readonly realDataUsed: false;
  readonly productionRows: 0;
  readonly plaintextPayloadsPersisted: 0;
  readonly liveMdmCalls: 0;
  readonly liveDeviceCalls: 0;
  readonly liveWrites: 0;
  readonly liveNotifications: 0;
  readonly productionDeployment: false;
  readonly githubPush: false;
}
