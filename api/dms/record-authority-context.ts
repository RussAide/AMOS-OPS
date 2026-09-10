import type Database from "better-sqlite3";
import type { AccessResource } from "../../src/constants/access-control";
import type { IdentityUser } from "../security/identity";
import type { RecordAuthorityCandidate } from "../../contracts/dms/record-authority";
import type { RecordAssignmentContext } from "./record-authority-access";

const BROAD_GOVERNED_RECORD_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "gro-administrator",
  "program-director",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "clinical-supervisor",
  "chart-auditor",
  "ccmg-program-director",
]);

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName) as { present: number } | undefined;
  return Boolean(row?.present);
}

/**
 * Build assignment context only from persisted server-side CCMG work ownership.
 * Request payloads never supply case/youth membership.
 */
export function deriveRecordAssignmentContext(
  db: Database.Database,
  user: IdentityUser,
): RecordAssignmentContext {
  if (
    !tableExists(db, "m21_ccmg_work_items") ||
    !tableExists(db, "m21_ccmg_referrals")
  ) {
    return { assignedCaseIds: [], assignedYouthIds: [], operationIds: [] };
  }

  const rows = db
    .prepare(
      `SELECT DISTINCT wi.case_id AS case_id,
              r.youth_id AS youth_id,
              wi.assigned_division AS assigned_division
       FROM m21_ccmg_work_items wi
       LEFT JOIN m21_ccmg_referrals r ON r.id = wi.referral_id
       WHERE wi.assigned_to = ?`,
    )
    .all(user.id) as Array<{
      case_id: string | null;
      youth_id: string | null;
      assigned_division: string | null;
    }>;

  const caseIds = new Set<string>();
  const youthIds = new Set<string>();
  const operationIds = new Set<string>();
  for (const row of rows) {
    if (row.case_id) caseIds.add(row.case_id);
    if (row.youth_id) youthIds.add(row.youth_id);
    if (row.assigned_division === "GRO") operationIds.add("CYPRESS-GRO");
    if (row.assigned_division === "BHC") operationIds.add("CYPRESS-BHC");
  }

  return {
    assignedCaseIds: [...caseIds].sort(),
    assignedYouthIds: [...youthIds].sort(),
    operationIds: [...operationIds].sort(),
  };
}

function recordDivision(record: RecordAuthorityCandidate) {
  if (record.division === "gro") return "gro" as const;
  if (record.division === "bhc") return "bhc" as const;
  if (record.division === "eo") return "eo" as const;
  if (record.division === "gad") return "gad" as const;
  return undefined;
}

/** Server-owned mapping from governed record class to the canonical RBAC domain. */
export function governedRecordReadResource(
  record: RecordAuthorityCandidate,
): AccessResource {
  const division = recordDivision(record);
  switch (record.recordClass) {
    case "MEDICAL_RECORD":
    case "CLINICAL_RECORD":
      return {
        domain: division === "gro" ? "gro" : "clinical",
        action: "read",
        division: division ?? "bhc",
        divisionCategory:
          division === "eo" || division === "gad"
            ? "corporate-office"
            : "profit-center",
      };
    case "PLACEMENT_RECORD":
      return {
        domain: "gro",
        action: "read",
        division: "gro",
        divisionCategory: "profit-center",
      };
    case "LICENSING_RECORD":
      return { domain: "compliance", action: "read" };
    case "GOVERNANCE_RECORD":
      return { domain: "executive", action: "read" };
    case "OPERATIONAL_RECORD":
      return division === "gro"
        ? {
            domain: "gro",
            action: "read",
            division: "gro",
            divisionCategory: "profit-center",
          }
        : { domain: "operations", action: "read" };
    case "FINANCIAL_RECORD":
      return { domain: "revenue", action: "read" };
    case "PERSONNEL_RECORD":
      return { domain: "hr", action: "read" };
    default:
      return { domain: "documents", action: "read" };
  }
}

export function governedRecordContextRequirements(
  record: RecordAuthorityCandidate,
  user: IdentityUser,
): { requireAssignment: boolean; requireOperationMatch: boolean } {
  const broad = BROAD_GOVERNED_RECORD_ROLES.has(user.role);
  const linkedToPerson = Boolean(record.caseId || record.youthId);
  return {
    requireAssignment: linkedToPerson && !broad,
    requireOperationMatch: Boolean(record.operationId) && !broad,
  };
}
