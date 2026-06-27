export * from "./errors";

// ─── Shared Role Types ───────────────────────────────────────

export type UserRole =
  | "administrator"
  | "hr-director"
  | "supervisor"
  | "clinical-director"
  | "gro-staff"
  | "qa-officer"
  | "training-coordinator"
  | "operations-manager";

export const USER_ROLES: UserRole[] = [
  "administrator",
  "hr-director",
  "supervisor",
  "clinical-director",
  "gro-staff",
  "qa-officer",
  "training-coordinator",
  "operations-manager",
];

// ─── HR Lane Types ───────────────────────────────────────────

export type HRLane = "activation" | "management";

// ─── Document Status ─────────────────────────────────────────

export type DocumentStatus = "uploaded" | "verified" | "rejected" | "expired";

// ─── Notification Types ──────────────────────────────────────

export type NotificationType = "status-change" | "alert" | "document" | "training" | "system";

// ─── Training Status ─────────────────────────────────────────

export type TrainingStatus = "available" | "in-progress" | "completed";
