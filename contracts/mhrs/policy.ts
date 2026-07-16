import {
  MHRS_CATEGORIES,
  MHRS_CATEGORY_RULES,
  type MhrsCategory,
  type MhrsServiceBasis,
} from "../regulatory/clinical";
import type { M23PlanState, M23Role, M23SessionState } from "./types";

export { MHRS_CATEGORIES };

export const M23_SPECIALIST_ROLES = ["therapist"] as const satisfies readonly M23Role[];
export const M23_SUPERVISOR_ROLES = [
  "mhrs-supervisor",
  "clinical-supervisor",
  "treatment-director",
  "bhc-director",
  "administrator",
  "managing-director",
  "super-admin",
] as const satisfies readonly M23Role[];
export const M23_READ_ROLES = [
  ...M23_SPECIALIST_ROLES,
  ...M23_SUPERVISOR_ROLES,
  "chart-auditor",
  "revenue-cycle-manager",
] as const satisfies readonly M23Role[];

export const M23_PLAN_TRANSITIONS: Readonly<Record<M23PlanState, readonly M23PlanState[]>> = {
  draft: ["under_review"],
  under_review: ["approved"],
  approved: ["superseded"],
  superseded: [],
};

export const M23_SESSION_TRANSITIONS: Readonly<Record<M23SessionState, readonly M23SessionState[]>> = {
  draft: ["signed"],
  signed: [],
};

export function isAllowedM23PlanTransition(from: M23PlanState, to: M23PlanState): boolean {
  return M23_PLAN_TRANSITIONS[from].includes(to);
}

export function isAllowedM23SessionTransition(from: M23SessionState, to: M23SessionState): boolean {
  return M23_SESSION_TRANSITIONS[from].includes(to);
}

export function isAllowedM23CategoryBasis(category: MhrsCategory, basis: MhrsServiceBasis): boolean {
  return MHRS_CATEGORY_RULES[category].allowedServiceBases.includes(basis);
}

export function procedureForM23Basis(basis: MhrsServiceBasis): "H2014" | "H2017" {
  return basis === "psychosocial_rehabilitation" ? "H2017" : "H2014";
}

export function assertAllM23Categories(values: readonly MhrsCategory[]): boolean {
  return MHRS_CATEGORIES.every((category) => values.includes(category));
}

