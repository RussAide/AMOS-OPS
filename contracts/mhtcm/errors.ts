export type M22ErrorCode =
  | "INVALID_INPUT"
  | "CASE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "LIFECYCLE_OUT_OF_ORDER"
  | "PLAN_NOT_FOUND"
  | "PLAN_VERSION_CONFLICT"
  | "PLAN_COMPONENTS_INCOMPLETE"
  | "INDEPENDENT_REVIEW_REQUIRED"
  | "DISCHARGE_PLAN_LEAD_TIME"
  | "DISCHARGE_NOT_RECORDED"
  | "AFTERCARE_WINDOW"
  | "AUTHORIZATION_NOT_FOUND"
  | "ENCOUNTER_NOT_FOUND"
  | "NOTE_REVISION_CONFLICT"
  | "BILLING_GATE_FAILED";

export class M22DomainError extends Error {
  readonly code: M22ErrorCode;

  constructor(code: M22ErrorCode, message: string) {
    super(message);
    this.name = "M22DomainError";
    this.code = code;
  }
}
