import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  resolveControllingRecord,
  type RecordAuthorityCandidate,
} from "../../contracts/dms/record-authority";
import {
  ensureRecordAuthoritySchema,
  establishRecordAuthority,
  resolvePersistedRecordAuthority,
} from "../dms/record-authority-store";

const NOW = "2026-09-09T09:00:00.000Z";

function candidate(
  id: string,
  authorityState: RecordAuthorityCandidate["authorityState"],
  supersedesAuthorityId: string | null = null,
): RecordAuthorityCandidate {
  return {
    id,
    documentId: `DOC-${id}`,
    recordKey: "CYPRESS:SYNTH-CASE-1:PLACEMENT-PACKET",
    recordClass: "PLACEMENT_RECORD",
    authorityState,
    sourceSystem: "synthetic-test",
    sourceLocator: `/synthetic/${id}`,
    backendObjectId: id,
    governingDocumentId: null,
    governingVersion: null,
    supersedesAuthorityId,
    youthId: "SYNTH-YOUTH-1",
    caseId: "SYNTH-CASE-1",
    operationId: "CYPRESS-GRO",
    division: "gro",
    dataScope: "training",
    rationale: "Controlled synthetic S1 authority test.",
    establishedBy: "SYNTH-ADMIN",
    establishedAt: NOW,
    effectiveAt: NOW,
  };
}

describe("S1 governed record authority", () => {
  it("returns the single CURRENT_CONTROLLING record and never substitutes reference copies", () => {
    const resolved = resolveControllingRecord("CYPRESS:SYNTH-CASE-1:PLACEMENT-PACKET", [
      candidate("REF", "REFERENCE_COPY"),
      candidate("CURRENT", "CURRENT_CONTROLLING"),
      candidate("SUB", "SUBMISSION_COPY"),
    ]);
    expect(resolved.outcome).toBe("RESOLVED");
    expect(resolved.record?.id).toBe("CURRENT");
  });

  it("fails closed when two effective records both claim CURRENT_CONTROLLING authority", () => {
    const resolution = resolveControllingRecord("CYPRESS:SYNTH-CASE-1:PLACEMENT-PACKET", [
      candidate("CURRENT-A", "CURRENT_CONTROLLING"),
      candidate("CURRENT-B", "CURRENT_CONTROLLING"),
    ]);
    expect(resolution).toMatchObject({
      outcome: "CONFLICT",
      code: "AUTHORITY_CONFLICT",
      record: null,
      candidateIds: ["CURRENT-A", "CURRENT-B"],
    });
  });

  it("retires an immutable prior authority row when a later row explicitly supersedes it", () => {
    const resolution = resolveControllingRecord("CYPRESS:SYNTH-CASE-1:PLACEMENT-PACKET", [
      candidate("CURRENT-A", "CURRENT_CONTROLLING"),
      candidate("CURRENT-B", "CURRENT_CONTROLLING", "CURRENT-A"),
    ]);
    expect(resolution).toMatchObject({
      outcome: "RESOLVED",
      code: "CONTROLLING_RECORD_RESOLVED",
      record: { id: "CURRENT-B" },
      candidateIds: ["CURRENT-B"],
    });
  });

  it("can retire a controlling record into a non-controlling state without mutating history", () => {
    const resolution = resolveControllingRecord("CYPRESS:SYNTH-CASE-1:PLACEMENT-PACKET", [
      candidate("CURRENT-A", "CURRENT_CONTROLLING"),
      candidate("SUPERSEDE-A", "SUPERSEDED", "CURRENT-A"),
    ]);
    expect(resolution).toMatchObject({
      outcome: "UNAVAILABLE",
      code: "NO_CONTROLLING_RECORD",
      record: null,
      candidateIds: ["SUPERSEDE-A"],
    });
  });

  it("returns unavailable rather than falling back when no controlling record exists", () => {
    const resolution = resolveControllingRecord("CYPRESS:SYNTH-CASE-1:PLACEMENT-PACKET", [
      candidate("REF", "REFERENCE_COPY"),
      candidate("PENDING", "PENDING"),
    ]);
    expect(resolution).toMatchObject({
      outcome: "UNAVAILABLE",
      code: "NO_CONTROLLING_RECORD",
      record: null,
    });
  });

  it("persists append-only authority records, audits resolutions, and blocks audit mutation", () => {
    const db = new Database(":memory:");
    ensureRecordAuthoritySchema(db);
    const recordKey = "CYPRESS:SYNTH-CASE-2:MEDICAL-SUMMARY";

    const current = establishRecordAuthority(db, {
      documentId: "SYNTH-DOC-1",
      recordKey,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-test",
      sourceLocator: "/synthetic/medical/1",
      backendObjectId: "SYNTH-BACKEND-1",
      youthId: "SYNTH-YOUTH-2",
      caseId: "SYNTH-CASE-2",
      operationId: "CYPRESS-GRO",
      division: "gro",
      dataScope: "training",
      rationale: "Controlled current authority.",
      establishedBy: "SYNTH-ADMIN",
      establishedAt: NOW,
      effectiveAt: NOW,
    });

    expect(resolvePersistedRecordAuthority(db, {
      recordKey,
      actorId: "SYNTH-READER",
      actorRole: "gro-administrator",
    })).toMatchObject({
      outcome: "RESOLVED",
      record: { id: current.id, documentId: "SYNTH-DOC-1" },
    });

    establishRecordAuthority(db, {
      documentId: "SYNTH-DOC-2",
      recordKey,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-test",
      sourceLocator: "/synthetic/medical/2",
      backendObjectId: "SYNTH-BACKEND-2",
      youthId: "SYNTH-YOUTH-2",
      caseId: "SYNTH-CASE-2",
      operationId: "CYPRESS-GRO",
      division: "gro",
      dataScope: "training",
      rationale: "Synthetic conflict to prove fail-closed behavior.",
      establishedBy: "SYNTH-ADMIN",
      establishedAt: "2026-09-09T09:01:00.000Z",
      effectiveAt: "2026-09-09T09:01:00.000Z",
    });

    expect(resolvePersistedRecordAuthority(db, {
      recordKey,
      actorId: "SYNTH-READER",
      actorRole: "gro-administrator",
    })).toMatchObject({
      outcome: "CONFLICT",
      code: "AUTHORITY_CONFLICT",
      record: null,
    });

    const auditCount = db.prepare(
      "SELECT COUNT(*) AS count FROM dms_record_authority_audit WHERE record_key = ?",
    ).get(recordKey) as { count: number };
    expect(auditCount.count).toBe(4);

    expect(() =>
      db.prepare("UPDATE dms_record_authority_registry SET rationale = 'tampered'").run(),
    ).toThrow(/IMMUTABLE_AUTHORITY_RECORD/);
    expect(() =>
      db.prepare("DELETE FROM dms_record_authority_registry").run(),
    ).toThrow(/IMMUTABLE_AUTHORITY_RECORD/);

    expect(() =>
      db.prepare("UPDATE dms_record_authority_audit SET decision_code = 'tampered'").run(),
    ).toThrow(/IMMUTABLE_AUTHORITY_AUDIT/);
    expect(() => db.prepare("DELETE FROM dms_record_authority_audit").run()).toThrow(
      /IMMUTABLE_AUTHORITY_AUDIT/,
    );

    db.close();
  });
});
