import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@db/schema";
import { applyPendingMigrations, createDatabaseBackup, restoreDatabaseBackup } from "../data-lifecycle";

const fixture = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../queries/connection", () => ({
  getDb: () => drizzle(requireDatabase(), { schema }),
  sqlite: new Proxy({}, {
    get(_target, key) {
      const db = requireDatabase();
      const value: unknown = Reflect.get(db, key);
      return typeof value === "function" ? value.bind(db) : value;
    },
  }),
  currentDataScope: () => "training",
  runWithDataScope: (_scope: string, run: () => unknown) => run(),
}));

vi.mock("../security/identity", () => ({
  resolveIdentityUser(request: Request) {
    const role = request.headers.get("x-synthetic-role");
    return role ? { id: role, role, email: `${role}@example.invalid` } : null;
  },
  resolveRequestedDataScope: () => "training",
}));

function requireDatabase() {
  if (!fixture.db) throw new Error("Set up the synthetic database before calling the router.");
  return fixture.db;
}

const migration = fs.readFileSync("db/migrations/0013_hr_requisitions.sql", "utf8");
const applicationMigration = fs.readFileSync("db/migrations/0014_hr_applications.sql", "utf8");
const offerMigration = fs.readFileSync("db/migrations/0015_hr_offers.sql", "utf8");
const originalSchema = fs.readFileSync("db/migrations/0000_concerned_kronos.sql", "utf8");
const auditSchema = originalSchema.match(/CREATE TABLE `audit_logs` \([\s\S]*?\n\);/)?.[0] ?? "";
const currentSchema = fs.readFileSync("db/current-schema.sql", "utf8");
const personnelSchema = [...currentSchema.matchAll(/CREATE TABLE `(?:hr_people|module_statuses|status_transitions)` \([\s\S]*?\n\);/g)]
  .map(match => match[0]).join("\n");
const reference = "CYP-QA-REQ-01";
const fields = {
  position: "QA Youth Care Worker",
  department: "GRO",
  supervisor: "QA Supervisor",
  hiringOwner: "QA Hiring Owner",
  approvedHeadcount: 2,
};
let appRouter: typeof import("../router").appRouter;

function setUpDatabase() {
  fixture.db = new Database(":memory:");
  fixture.db.pragma("foreign_keys = ON");
  fixture.db.exec(auditSchema + personnelSchema + migration + applicationMigration + offerMigration);
}

function closeDatabase() {
  fixture.db?.close();
  fixture.db = null;
}

function caller(role = "hr-director") {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { "x-synthetic-role": role } }),
    resHeaders: new Headers(),
  }).hr;
}

const offer = { applicationReference: "CYP-QA-APP-OFFER", offerReference: "OFFER-01", selectionReference: "SELECT-01" };
const accepted = { status: "accepted" as const, evidence: "SIGNED-01", firstName: "Synthetic", lastName: "Applicant" };
const declined = { status: "declined" as const, evidence: "DECLINED-01" };
const packet = {
  applicationReference: offer.applicationReference, revision: 2, packetReference: "PACKET-01",
  fileChecklistReference: "CHECKLIST-01", packetStatus: "ready_for_review" as const,
};

async function createOfferApplication(hr: ReturnType<typeof caller>) {
  await hr.createRequisition({ reference, fields });
  return hr.createApplication({
    reference: offer.applicationReference, requisitionReference: reference, sourceReference: "POSTING-01",
  });
}

async function recommendOfferApplication(hr: ReturnType<typeof caller>) {
  const application = await createOfferApplication(hr);
  await hr.updateApplicationReview({
    reference: application.reference, revision: application.revision,
    review: {
      qualificationOutcome: "met", qualificationReference: "QUAL-01", screeningReference: "SCREEN-01",
      interviewReference: "INTERVIEW-01", referencesReference: "REFERENCES-01", disposition: "recommended",
    },
  });
}

describe("Cypress requisition workflow", () => {
  beforeAll(async () => {
    setUpDatabase();
    try {
      ({ appRouter } = await import("../router"));
    } finally {
      closeDatabase();
    }
  }, 30_000);
  beforeEach(setUpDatabase);
  afterEach(closeDatabase);

  it("saves and reopens six fields across callers and keeps audit revisions", async () => {
    const created = await caller().createRequisition({ reference, fields });
    expect(created).toEqual({ reference, ...fields, revision: 1 });
    const freshCaller = caller();
    expect(await freshCaller.listRequisitions()).toEqual([created]);
    const updated = await freshCaller.updateRequisition({
      reference, revision: created.revision, fields: { ...fields, approvedHeadcount: 3 },
    });
    expect(await freshCaller.listRequisitions()).toEqual([updated]);
    expect(updated).toEqual({ reference, ...fields, approvedHeadcount: 3, revision: 2 });
    expect(requireDatabase().prepare(
      "SELECT entity_id, action, performed_by FROM audit_logs ORDER BY rowid",
    ).all()).toEqual([
      { entity_id: reference, action: "create", performed_by: "hr-director" },
      { entity_id: reference, action: "update", performed_by: "hr-director" },
    ]);
  });

  it("rejects duplicate references and stale edits without changing the saved row", async () => {
    const hr = caller();
    await hr.createRequisition({ reference, fields });
    await expect(hr.createRequisition({ reference: reference.toLowerCase(), fields }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await hr.updateRequisition({ reference, revision: 1, fields: { ...fields, approvedHeadcount: 4 } });
    await expect(hr.updateRequisition({ reference, revision: 1, fields }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(await hr.listRequisitions()).toEqual([{ reference, ...fields, approvedHeadcount: 4, revision: 2 }]);
  });

  it("rejects incomplete fields, invalid headcount, and a role without HR access", async () => {
    const hr = caller();
    await expect(hr.createRequisition({ reference, fields: { ...fields, supervisor: "  " } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(hr.createRequisition({ reference, fields: { ...fields, approvedHeadcount: 1.5 } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    const excluded = caller("youth-care-worker");
    await expect(excluded.listRequisitions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.createRequisition({ reference, fields })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await hr.listRequisitions()).toEqual([]);
  });

  it("rolls back requisition writes when the audit write fails", async () => {
    const hr = caller();
    const db = requireDatabase();
    await hr.createRequisition({ reference, fields });
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'QA audit failure'); END");
    await expect(hr.createRequisition({ reference: "CYP-QA-REQ-02", fields })).rejects.toThrow();
    await expect(hr.updateRequisition({
      reference, revision: 1, fields: { ...fields, approvedHeadcount: 5 },
    })).rejects.toThrow();
    expect(await hr.listRequisitions()).toEqual([{ reference, ...fields, revision: 1 }]);
  });

  it("links a single application to an approved requisition and reopens its screening evidence", async () => {
    const hr = caller();
    const application = { reference: "CYP-QA-APP-01", requisitionReference: reference, sourceReference: "POSTING-QA-01" };
    await expect(hr.createApplication(application)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await hr.createRequisition({ reference, fields });
    const created = await hr.createApplication({ ...application, requisitionReference: reference.toLowerCase() });
    expect(created).toMatchObject({ ...application, disposition: "pending", revision: 1 });
    await expect(hr.createApplication({ ...application, reference: application.reference.toLowerCase() }))
      .rejects.toMatchObject({ code: "CONFLICT" });

    const review = {
      qualificationOutcome: "met" as const, qualificationReference: "QUAL-01",
      screeningReference: "SCREEN-01", interviewReference: "INTERVIEW-01",
      referencesReference: "REFERENCES-01", disposition: "recommended" as const,
    };
    const change = { reference: application.reference, revision: created.revision, review };
    await expect(hr.updateApplicationReview({ ...change, review: { ...review, interviewReference: null } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    const saved = await hr.updateApplicationReview(change);
    expect(saved).toMatchObject({ ...application, ...review, revision: 2 });
    expect(await caller().listApplications()).toEqual([saved]);
    await expect(hr.updateApplicationReview(change)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(requireDatabase().prepare(
      "SELECT action, performed_by FROM audit_logs WHERE entity_type = 'hr_application' ORDER BY rowid",
    ).all()).toEqual([{ action: "create", performed_by: "hr-director" }, { action: "update", performed_by: "hr-director" }]);
    expect(requireDatabase().prepare("SELECT COUNT(*) AS count FROM hr_applications").get()).toEqual({ count: 1 });
    expect(requireDatabase().pragma("foreign_key_check")).toEqual([]);
  });

  it("keeps screening references restricted and rolls application writes back if audit fails", async () => {
    const hr = caller();
    await hr.createRequisition({ reference, fields });
    const excluded = caller("youth-care-worker");
    const input = { reference: "CYP-QA-APP-02", requisitionReference: reference, sourceReference: "POSTING-QA-01" };
    const review = {
      qualificationOutcome: "not_met" as const, qualificationReference: "QUAL-02",
      screeningReference: null, interviewReference: null, referencesReference: null,
      disposition: "not_recommended" as const,
    };
    await expect(excluded.listApplications()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.createApplication(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.updateApplicationReview({ reference: input.reference, revision: 1, review }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await hr.createApplication(input);
    requireDatabase().exec(
      "CREATE TRIGGER fail_application_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='hr_application' BEGIN SELECT RAISE(ABORT, 'QA audit failure'); END",
    );
    await expect(hr.createApplication({ ...input, reference: "CYP-QA-APP-03" })).rejects.toThrow();
    await expect(hr.updateApplicationReview({ reference: created.reference, revision: created.revision, review })).rejects.toThrow();
    expect(await hr.listApplications()).toEqual([created]);
  });

  it("records a single accepted offer, its linked personnel record and the returned packet", async () => {
    const hr = caller();
    await recommendOfferApplication(hr);
    await expect(hr.createOffer({ ...offer, selectionReference: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await hr.createOffer(offer)).toMatchObject({ ...offer, status: "pending", revision: 1, personId: null });
    await expect(hr.createOffer({ ...offer, applicationReference: offer.applicationReference.toLowerCase() }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await expect(hr.updateOfferPacket(packet)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const response = { applicationReference: offer.applicationReference, revision: 1, response: accepted };
    const acceptedOffer = await hr.recordOfferResponse(response);
    expect(acceptedOffer).toMatchObject({ status: "accepted", responseReference: accepted.evidence, revision: 2 });
    const fresh = caller();
    expect(await fresh.recordOfferResponse(response)).toEqual(acceptedOffer);
    await expect(fresh.recordOfferResponse({ ...response, response: declined })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await fresh.listPeople()).toMatchObject([{
      id: acceptedOffer.personId, firstName: accepted.firstName, lastName: accepted.lastName,
      role: fields.position, department: fields.department, supervisor: fields.supervisor,
      lane: "activation", isEmployee: false, employeeId: null,
    }]);
    expect(await fresh.updateOfferPacket(packet)).toMatchObject({ ...packet, revision: 3 });
    await expect(fresh.updateOfferPacket(packet)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await caller().listOffers()).toMatchObject([{ ...offer, ...packet, revision: 3, personId: acceptedOffer.personId }]);
    expect(requireDatabase().prepare(
      "SELECT action FROM audit_logs WHERE entity_type = 'hr_offer' ORDER BY rowid",
    ).all()).toEqual([{ action: "create" }, { action: "accepted" }, { action: "update_packet" }]);
    expect(requireDatabase().pragma("foreign_key_check")).toEqual([]);

    const { personId } = acceptedOffer;
    if (!personId) throw new Error("Expected an accepted offer to link a personnel record.");
    requireDatabase().prepare("INSERT INTO module_statuses (id, person_id, module_id, status_id) VALUES ('qa', ?, 'hr', 'pending')")
      .run(personId);
    await expect(hr.deletePerson({ id: personId })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await hr.getPerson({ id: personId })).toMatchObject({ id: personId });
    expect(requireDatabase().prepare("SELECT person_id FROM module_statuses").get()).toEqual({ person_id: personId });
  });

  it("confines offers to authorized HR and rejects an application without a recommendation", async () => {
    const hr = caller();
    const excluded = caller("youth-care-worker");
    const response = { applicationReference: offer.applicationReference, revision: 1, response: declined };
    await expect(hr.createOffer(offer)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await createOfferApplication(hr);
    await expect(hr.createOffer(offer)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(excluded.listOffers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.createOffer(offer)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.recordOfferResponse(response)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.updateOfferPacket(packet)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await hr.listOffers()).toEqual([]);
  });

  it("rolls back personnel creation on failed audit and leaves a declined offer without a person", async () => {
    const hr = caller();
    await recommendOfferApplication(hr);
    const saved = await hr.createOffer(offer);
    const response = { applicationReference: offer.applicationReference, revision: saved.revision, response: accepted };
    const db = requireDatabase();
    db.exec("CREATE TRIGGER fail_offer_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='hr_offer' BEGIN SELECT RAISE(ABORT, 'QA audit failure'); END");
    await expect(hr.recordOfferResponse(response)).rejects.toThrow();
    expect(await hr.listOffers()).toEqual([saved]);
    expect(await hr.listPeople()).toEqual([]);
    db.exec("DROP TRIGGER fail_offer_audit");
    expect(await hr.recordOfferResponse({ ...response, response: declined })).toMatchObject({
      status: "declined", personId: null, responseReference: declined.evidence,
    });
    await expect(hr.updateOfferPacket(packet)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await hr.listPeople()).toEqual([]);
  });

  it("applies the migration once and restores the pre-migration data to a separate database", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amos-requisition-"));
    const source = path.join(directory, "before.db");
    const backup = path.join(directory, "checkpoint.db");
    const restored = path.join(directory, "restored.db");
    const migrationDir = path.join(directory, "migrations");
    fs.mkdirSync(migrationDir);
    fs.writeFileSync(path.join(migrationDir, "0013_hr_requisitions.sql"), migration);
    try {
      const db = new Database(source);
      try {
        db.exec(auditSchema);
        db.exec("INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by) VALUES ('existing-audit', 'qa', 'fixture', 'seed', 'QA')");
        await createDatabaseBackup(source, backup);
        expect(applyPendingMigrations(db, migrationDir)).toHaveLength(1);
        expect(applyPendingMigrations(db, migrationDir)).toEqual([]);
        expect(db.prepare("SELECT COUNT(*) AS count FROM hr_requisitions").get()).toEqual({ count: 0 });
        expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
      } finally {
        db.close();
      }
      restoreDatabaseBackup(backup, restored);
      const restoredDb = new Database(restored, { readonly: true });
      try {
        expect(restoredDb.pragma("integrity_check", { simple: true })).toBe("ok");
        expect(restoredDb.prepare("SELECT id FROM audit_logs").get()).toEqual({ id: "existing-audit" });
        expect(restoredDb.prepare("SELECT name FROM sqlite_master WHERE name = 'hr_requisitions'").get()).toBeUndefined();
      } finally {
        restoredDb.close();
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
