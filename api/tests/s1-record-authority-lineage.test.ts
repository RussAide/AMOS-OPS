import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { establishRecordAuthority } from "../dms/record-authority-store";

function establishBase(db: Database.Database) {
  return establishRecordAuthority(db, {
    documentId: "SYNTH-DOC-LINEAGE-1",
    recordKey: "CYPRESS:SYNTH-CASE-LINEAGE:PLACEMENT",
    recordClass: "PLACEMENT_RECORD",
    authorityState: "PENDING",
    sourceSystem: "synthetic-test",
    sourceLocator: "/synthetic/lineage/1",
    youthId: "SYNTH-YOUTH-LINEAGE",
    caseId: "SYNTH-CASE-LINEAGE",
    operationId: "CYPRESS-GRO",
    division: "gro",
    dataScope: "training",
    rationale: "Controlled stable-lineage baseline.",
    establishedBy: "SYNTH-ADMIN",
  });
}

describe("S1 authority lineage invariants", () => {
  it("preserves record class and case/youth/operation context across immutable authority rows", () => {
    const db = new Database(":memory:");
    const base = establishBase(db);

    expect(() =>
      establishRecordAuthority(db, {
        documentId: "SYNTH-DOC-LINEAGE-2",
        recordKey: base.recordKey,
        recordClass: "MEDICAL_RECORD",
        authorityState: "CURRENT_CONTROLLING",
        sourceSystem: "synthetic-test",
        sourceLocator: "/synthetic/lineage/2",
        youthId: "SYNTH-YOUTH-LINEAGE",
        caseId: "SYNTH-CASE-LINEAGE",
        operationId: "CYPRESS-GRO",
        division: "gro",
        dataScope: "training",
        rationale: "Attempted class reclassification.",
        establishedBy: "SYNTH-ADMIN",
      }),
    ).toThrow(/AUTHORITY_LINEAGE_RECORD_CLASS_MISMATCH/);

    expect(() =>
      establishRecordAuthority(db, {
        documentId: "SYNTH-DOC-LINEAGE-2",
        recordKey: base.recordKey,
        recordClass: "PLACEMENT_RECORD",
        authorityState: "CURRENT_CONTROLLING",
        sourceSystem: "synthetic-test",
        sourceLocator: "/synthetic/lineage/2",
        youthId: null,
        caseId: null,
        operationId: null,
        division: "gro",
        dataScope: "training",
        rationale: "Attempted context removal.",
        establishedBy: "SYNTH-ADMIN",
      }),
    ).toThrow(/AUTHORITY_LINEAGE_CASEID_MISMATCH|AUTHORITY_LINEAGE_YOUTHID_MISMATCH|AUTHORITY_LINEAGE_OPERATIONID_MISMATCH/);

    db.close();
  });

  it("allows an append-only state transition when the stable lineage context is preserved", () => {
    const db = new Database(":memory:");
    const base = establishBase(db);
    const current = establishRecordAuthority(db, {
      documentId: "SYNTH-DOC-LINEAGE-1",
      recordKey: base.recordKey,
      recordClass: "PLACEMENT_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-test",
      sourceLocator: "/synthetic/lineage/1",
      supersedesAuthorityId: base.id,
      youthId: "SYNTH-YOUTH-LINEAGE",
      caseId: "SYNTH-CASE-LINEAGE",
      operationId: "CYPRESS-GRO",
      division: "gro",
      dataScope: "training",
      rationale: "Controlled transition to current authority.",
      establishedBy: "SYNTH-ADMIN",
    });

    expect(current).toMatchObject({
      authorityState: "CURRENT_CONTROLLING",
      supersedesAuthorityId: base.id,
      caseId: "SYNTH-CASE-LINEAGE",
      youthId: "SYNTH-YOUTH-LINEAGE",
      operationId: "CYPRESS-GRO",
    });
    db.close();
  });
});
