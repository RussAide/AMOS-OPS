import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import type { IdentityUser } from "../security/identity";
import { establishRecordAuthority } from "../dms/record-authority-store";
import { resolveDocumentAuthorityBinding } from "../dms/record-authority-bindings";
import {
  deriveRecordAssignmentContext,
  governedRecordContextRequirements,
  governedRecordReadResource,
} from "../dms/record-authority-context";

function user(role: string, id = "SYNTH-USER") : IdentityUser {
  return {
    id,
    email: `${id.toLowerCase()}@example.invalid`,
    firstName: "Synthetic",
    lastName: "User",
    name: "Synthetic User",
    role,
    department: null,
    mfaEnabled: true,
    accessStatus: "cleared",
    identityType: "workforce",
    trainingAccess: true,
    sponsorName: null,
    accessExpiresAt: null,
    dataScope: "training",
  };
}

function authority(db: Database.Database, recordKey: string, documentId = "SYNTH-DOC") {
  return establishRecordAuthority(db, {
    documentId,
    recordKey,
    recordClass: "PLACEMENT_RECORD",
    authorityState: "CURRENT_CONTROLLING",
    sourceSystem: "synthetic-test",
    sourceLocator: "/synthetic/placement",
    youthId: "SYNTH-YOUTH",
    caseId: "SYNTH-CASE",
    operationId: "CYPRESS-GRO",
    division: "gro",
    dataScope: "training",
    rationale: "Controlled boundary test.",
    establishedBy: "SYNTH-ADMIN",
  });
}

describe("S1 M2 authority boundary helpers", () => {
  it("fails closed when a DMS document is unregistered or bound to more than one record lineage", () => {
    const db = new Database(":memory:");
    expect(resolveDocumentAuthorityBinding(db, "SYNTH-MISSING")).toEqual({
      outcome: "UNREGISTERED",
      code: "DOCUMENT_AUTHORITY_UNREGISTERED",
      documentId: "SYNTH-MISSING",
      recordKey: null,
    });

    authority(db, "CYPRESS:CASE-A:PLACEMENT", "SYNTH-DOC-CONFLICT");
    authority(db, "CYPRESS:CASE-B:PLACEMENT", "SYNTH-DOC-CONFLICT");
    const conflict = resolveDocumentAuthorityBinding(db, "SYNTH-DOC-CONFLICT");
    expect(conflict).toMatchObject({
      outcome: "CONFLICT",
      code: "DOCUMENT_AUTHORITY_BINDING_CONFLICT",
      documentId: "SYNTH-DOC-CONFLICT",
      recordKey: null,
    });
    if (conflict.outcome === "CONFLICT") {
      expect(conflict.recordKeys).toEqual([
        "CYPRESS:CASE-A:PLACEMENT",
        "CYPRESS:CASE-B:PLACEMENT",
      ]);
    }
    db.close();
  });

  it("resolves exactly one document-to-lineage binding", () => {
    const db = new Database(":memory:");
    authority(db, "CYPRESS:SYNTH-CASE:PLACEMENT");
    expect(resolveDocumentAuthorityBinding(db, "SYNTH-DOC")).toEqual({
      outcome: "BOUND",
      code: "DOCUMENT_AUTHORITY_BOUND",
      documentId: "SYNTH-DOC",
      recordKey: "CYPRESS:SYNTH-CASE:PLACEMENT",
    });
    db.close();
  });

  it("derives case, youth and Cypress operation assignment from server-side CCMG work ownership only", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE m21_ccmg_referrals (
        id TEXT PRIMARY KEY,
        youth_id TEXT NOT NULL
      );
      CREATE TABLE m21_ccmg_work_items (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        referral_id TEXT NOT NULL,
        assigned_division TEXT NOT NULL,
        assigned_to TEXT
      );
      INSERT INTO m21_ccmg_referrals (id, youth_id)
      VALUES ('SYNTH-REF-1', 'SYNTH-YOUTH-1'), ('SYNTH-REF-2', 'SYNTH-YOUTH-2');
      INSERT INTO m21_ccmg_work_items
        (id, case_id, referral_id, assigned_division, assigned_to)
      VALUES
        ('SYNTH-WORK-1', 'SYNTH-CASE-1', 'SYNTH-REF-1', 'GRO', 'SYNTH-USER'),
        ('SYNTH-WORK-2', 'SYNTH-CASE-2', 'SYNTH-REF-2', 'BHC', 'OTHER-USER');
    `);

    expect(deriveRecordAssignmentContext(db, user("youth-care-worker"))).toEqual({
      assignedCaseIds: ["SYNTH-CASE-1"],
      assignedYouthIds: ["SYNTH-YOUTH-1"],
      operationIds: ["CYPRESS-GRO"],
    });
    db.close();
  });

  it("maps placement records to GRO read policy and requires assignment for frontline roles only", () => {
    const db = new Database(":memory:");
    const record = authority(db, "CYPRESS:SYNTH-CASE:PLACEMENT");
    expect(governedRecordReadResource(record)).toEqual({
      domain: "gro",
      action: "read",
      division: "gro",
      divisionCategory: "profit-center",
    });
    expect(governedRecordContextRequirements(record, user("youth-care-worker"))).toEqual({
      requireAssignment: true,
      requireOperationMatch: true,
    });
    expect(governedRecordContextRequirements(record, user("gro-administrator"))).toEqual({
      requireAssignment: false,
      requireOperationMatch: false,
    });
    db.close();
  });
});
