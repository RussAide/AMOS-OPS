export * from "./errors";

// ─── Shared Role Types ───────────────────────────────────────

export type { UserRole } from "@/constants/roles";
export { ALL_ROLES as USER_ROLES } from "@/constants/roles";

// ─── HR Lane Types ───────────────────────────────────────────

export type HRLane = "activation" | "management";

// ─── Document Status ─────────────────────────────────────────

export type DocumentStatus = "uploaded" | "verified" | "rejected" | "expired";

// ─── Notification Types ──────────────────────────────────────

export type NotificationType = "status-change" | "alert" | "document" | "training" | "system";

// ─── Training Status ─────────────────────────────────────────

export type TrainingStatus = "available" | "in-progress" | "completed";
