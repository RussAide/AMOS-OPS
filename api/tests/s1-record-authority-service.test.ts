import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import type { IdentityUser } from "../security/identity";
import { establishRecordAuthority } from "../dms/record-authority-store";
import { resolveAuthorizedRecordAuthority } from "../dms/record-authority-service";

const USER: IdentityUser = {
  id: "SYNTH-USER-SVC",
  email: "svc@example.invalid",
  firstName: "Synthetic",
  lastName: "Service",
  name: "Synthetic Service",
  role: "gro-administrator",
  department: null,
  mfaEnabled: true,
  accessStatus: "cleared",
  identityType: "workforce",
  trainingAccess: true,
  sponsorName: null,
  accessExpiresAt: null,
  dataScope: "training",
};

const RESOURCE = {
  domain: "gro" as const,
  action: "read" as const,
  division: "gro" as const,
  divisionCategory: "profit-center" as const,
};

function registerCurrent(db: Database.Database, suffix: string) {
  return establishRecordAuthority(db, {
    documentId: `SYNTH-DOC-${suffix}`,
    recordKey: "CYPRESS:SYNTH-CASE-SVC:PLACEMENT-PACKET",
    recordClass: "PLACEMENT_RECORD",
    authorityState: "CURRENT_CONTROLLING",
    sourceSystem: "synthetic-test",
    sourceLocator: `/synthetic/service/${suffix}`,
    backendObjectId: `SYNTH-BACKEND-${suffix}`,
    youthId: "SYNTH-YOUTH-SVC",
    caseId: "SYNTH-CASE-SVC",
    operationId: "CYPRESS-GRO",
    division: "gro",
    dataScope: "training",
    rationale: "Controlled service composition test.",
    establishedBy: "SYNTH-ADMIN",
  });
}

describe("S1 canonical authority + access retrieval service", () => {
  it("returns record content only after authority and contextual access both pass", () => {
    const db = new Database(":memory:");
    const current = registerCurrent(db, "A");
    const result = resolveAuthorizedRecordAuthority(db, {
      recordKey: current.recordKey,
      user: USER,
      resource: RESOURCE,
      requireAssignment: true,
      requireOperationMatch: true,
      assignment: {
        operationIds: ["CYPRESS-GRO"],
        assignedCaseIds: ["SYNTH-CASE-SVC"],
        assignedYouthIds: ["SYNTH-YOUTH-SVC"],
      },
    });
    expect(result).toMatchObject({
      outcome: "AUTHORIZED",
      code: "CONTROLLING_RECORD_AUTHORIZED",
      record: { id: current.id },
    });

    const accessAudit = db.prepare(
      "SELECT decision_code FROM dms_record_authority_audit WHERE event_type = 'ACCESS_DECISION' ORDER BY occurred_at DESC LIMIT 1",
    ).get() as { decision_code: string };
    expect(accessAudit.decision_code).toBe("ALLOW_CONTEXTUAL");
    db.close();
  });

  it("returns no record payload when contextual access is denied", () => {
    const db = new Database(":memory:");
    const current = registerCurrent(db, "B");
    const result = resolveAuthorizedRecordAuthority(db, {
      recordKey: current.recordKey,
      user: USER,
      resource: RESOURCE,
      requireAssignment: true,
      requireOperationMatch: true,
      assignment: {
        operationIds: ["CYPRESS-GRO"],
        assignedCaseIds: [],
        assignedYouthIds: [],
      },
    });
    expect(result).toMatchObject({
      outcome: "DENIED",
      code: "DENY_CASE_ASSIGNMENT",
      record: null,
    });
    db.close();
  });

  it("stops at authority conflict before any access decision can expose a record", () => {
    const db = new Database(":memory:");
    const first = registerCurrent(db, "C1");
    registerCurrent(db, "C2");
    const result = resolveAuthorizedRecordAuthority(db, {
      recordKey: first.recordKey,
      user: USER,
      resource: RESOURCE,
      requireAssignment: false,
      requireOperationMatch: false,
    });
    expect(result).toEqual({
      outcome: "AUTHORITY_CONFLICT",
      code: "AUTHORITY_CONFLICT",
      record: null,
    });
    const accessAuditCount = db.prepare(
      "SELECT COUNT(*) AS count FROM dms_record_authority_audit WHERE event_type = 'ACCESS_DECISION'",
    ).get() as { count: number };
    expect(accessAuditCount.count).toBe(0);
    db.close();
  });
});
