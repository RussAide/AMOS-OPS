/**
 * AMOS-OPS authoritative operating model.
 *
 * M1.1-04 requires the four operating divisions, the three BHC departments,
 * and the three-stage youth campus model to be represented consistently in
 * data and navigation. UI components and authorization policy import this
 * registry instead of maintaining local copies.
 */

export type DivisionCategory = "profit-center" | "corporate-office";
export type DivisionId = "gro" | "bhc" | "eo" | "gad";
export type BhcDepartmentCode = "ccmg" | "mhtcm" | "mhrs";
export type CampusStageId = "campus-stage-1" | "campus-stage-2" | "campus-stage-3";
export type CampusReadinessStatus = "operational" | "licensing-in-progress" | "capital-planning";

export interface DivisionInfo {
  id: DivisionId;
  code: "GRO" | "BHC" | "EO" | "GAD";
  name: string;
  category: DivisionCategory;
  categoryTag: "PC" | "CO";
  purpose: string;
  departmentCodes: readonly BhcDepartmentCode[];
  color: string;
  badgeBg: string;
  badgeText: string;
}

export interface DepartmentInfo {
  code: BhcDepartmentCode;
  shortName: "CCMG" | "MHTCM" | "MHRS";
  name: string;
  division: "bhc";
  category: "profit-center";
  purpose: string;
  color: string;
}

export interface CampusStageInfo {
  id: CampusStageId;
  stageNumber: 1 | 2 | 3;
  shortName: string;
  name: string;
  purpose: string;
  controlledCapacity: string;
  capacityBeds: number;
  readinessStatus: CampusReadinessStatus;
  evaluationContext: "fictional-demonstration-reference";
  color: string;
}

export const DIVISIONS: Record<DivisionId, DivisionInfo> = {
  gro: {
    id: "gro",
    code: "GRO",
    name: "General Residential Operations",
    category: "profit-center",
    categoryTag: "PC",
    purpose: "Provides 24/7 residential care under applicable Texas minimum standards.",
    departmentCodes: [],
    color: "#245C5A",
    badgeBg: "#245C5A",
    badgeText: "#FFFFFF",
  },
  bhc: {
    id: "bhc",
    code: "BHC",
    name: "Behavioral Health Center Division",
    category: "profit-center",
    categoryTag: "PC",
    purpose: "Profit Center Operating Division containing CCMG, MHTCM, and MHRS.",
    departmentCodes: ["ccmg", "mhtcm", "mhrs"],
    color: "#C45C4A",
    badgeBg: "#C45C4A",
    badgeText: "#FFFFFF",
  },
  eo: {
    id: "eo",
    code: "EO",
    name: "Executive Office",
    category: "corporate-office",
    categoryTag: "CO",
    purpose: "Governance, board relations, strategy, risk, finance/revenue oversight, HR, and IT/digital operations.",
    departmentCodes: [],
    color: "#991B1B",
    badgeBg: "#991B1B",
    badgeText: "#FFFFFF",
  },
  gad: {
    id: "gad",
    code: "GAD",
    name: "General Administration",
    category: "corporate-office",
    categoryTag: "CO",
    purpose: "Facilities, procurement/vendors, safety/emergency preparedness, transportation/logistics, and regulatory-compliance support.",
    departmentCodes: [],
    color: "#D97706",
    badgeBg: "#D97706",
    badgeText: "#FFFFFF",
  },
};

export const OPERATING_DIVISIONS = Object.values(DIVISIONS);

export const BHC_DEPARTMENTS: Record<BhcDepartmentCode, DepartmentInfo> = {
  ccmg: {
    code: "ccmg",
    shortName: "CCMG",
    name: "Collaborative Care Management Group",
    division: "bhc",
    category: "profit-center",
    purpose: "Clinical oversight, intake coordination, QA, CANS administration, medication oversight, and cross-divisional liaison.",
    color: "#C2410C",
  },
  mhtcm: {
    code: "mhtcm",
    shortName: "MHTCM",
    name: "Mental Health Targeted Case Management",
    division: "bhc",
    category: "profit-center",
    purpose: "Intake/screening, eligibility, care coordination, referral management, discharge planning, and aftercare follow-up.",
    color: "#9A3412",
  },
  mhrs: {
    code: "mhrs",
    shortName: "MHRS",
    name: "Mental Health Rehabilitative Services",
    division: "bhc",
    category: "profit-center",
    purpose: "Skills training, psychosocial rehabilitation, therapeutic groups, and community integration.",
    color: "#7C2D12",
  },
};

export const CAMPUS_STAGES: readonly CampusStageInfo[] = [
  {
    id: "campus-stage-1",
    stageNumber: 1,
    shortName: "Main Residential Unit",
    name: "Stage 1 — Main Residential Unit",
    purpose: "GRO main facility (Profit Center); two four-bed rooms upstairs and two four-bed rooms downstairs.",
    controlledCapacity: "16 beds (2×4 upstairs, 2×4 downstairs)",
    capacityBeds: 16,
    readinessStatus: "operational",
    evaluationContext: "fictional-demonstration-reference",
    color: "#245C5A",
  },
  {
    id: "campus-stage-2",
    stageNumber: 2,
    shortName: "Emergency Care Services",
    name: "Stage 2 — Emergency Care Services",
    purpose: "Emergency Care Services crisis stabilization Profit Center.",
    controlledCapacity: "16 beds",
    capacityBeds: 16,
    readinessStatus: "licensing-in-progress",
    evaluationContext: "fictional-demonstration-reference",
    color: "#C45C4A",
  },
  {
    id: "campus-stage-3",
    stageNumber: 3,
    shortName: "Cypress Campus",
    name: "Stage 3 — Cypress Campus",
    purpose: "Prefab residential campus plus BHC, GAD, Executive Office, and Education on 1.7 acres.",
    controlledCapacity: "16 beds plus BHC/GAD/Executive Office/Education",
    capacityBeds: 16,
    readinessStatus: "capital-planning",
    evaluationContext: "fictional-demonstration-reference",
    color: "#991B1B",
  },
];

export function isDivisionId(value: unknown): value is DivisionId {
  return typeof value === "string" && value in DIVISIONS;
}

export function isDivisionCategory(value: unknown): value is DivisionCategory {
  return value === "profit-center" || value === "corporate-office";
}

export function isBhcDepartmentCode(value: unknown): value is BhcDepartmentCode {
  return typeof value === "string" && value in BHC_DEPARTMENTS;
}

export function getDivisionByCode(code: string): DivisionInfo | undefined {
  const normalized = code.trim().toUpperCase();
  return OPERATING_DIVISIONS.find((division) => division.code === normalized);
}

export function normalizeBhcDepartment(value: unknown): BhcDepartmentCode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("ccmg")) return "ccmg";
  if (normalized.includes("mhtcm")) return "mhtcm";
  if (normalized.includes("mhrs")) return "mhrs";
  return undefined;
}
