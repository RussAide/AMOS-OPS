import { MHTCM_FUNCTIONS, type MhtcmFunction } from "../regulatory/clinical";

export const M22_MHTCM_FUNCTIONS = MHTCM_FUNCTIONS;

export const M22_DISCHARGE_PLAN_MINIMUM_LEAD_DAYS = 14;
export const M22_AFTERCARE_MAXIMUM_DAYS = 30;
export const M22_AUTHORIZATION_RENEWAL_DAYS = 180;
export const M22_AUTHORIZATION_ALERT_WINDOW_DAYS = 30;

export const M22_BILLABLE_FUNCTIONS: readonly MhtcmFunction[] = [
  "care_coordination",
  "referral_management",
  "discharge_planning",
  "aftercare_follow_up",
];

const LEGACY_FUNCTION_MAP: Readonly<Record<string, MhtcmFunction>> = {
  intake: "intake_screening",
  intake_screening: "intake_screening",
  eligibility: "eligibility",
  coordination: "care_coordination",
  care_coordination: "care_coordination",
  referral: "referral_management",
  referrals: "referral_management",
  referral_management: "referral_management",
  monitoring: "aftercare_follow_up",
  aftercare: "aftercare_follow_up",
  aftercare_follow_up: "aftercare_follow_up",
  transition: "discharge_planning",
  discharge: "discharge_planning",
  discharge_planning: "discharge_planning",
};

export function normalizeMhtcmFunction(value: string): MhtcmFunction | null {
  return LEGACY_FUNCTION_MAP[value.trim().toLowerCase()] ?? null;
}

export function isoDate(value: string): string {
  const date = value.length >= 10 ? value.slice(0, 10) : value;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00.000Z`))
  ) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return date;
}
