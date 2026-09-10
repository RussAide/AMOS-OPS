import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { ensureRecordAuthoritySchema, establishRecordAuthority } from "../dms/record-authority-store";
import {
  ensureSharePointBackendSchema,
  establishSharePointBackendBinding,
  resolvePersistedSharePointBackendBinding,
} from "../dms/sharepoint-backend-store";

function db(): Database.Database {
  const database = new Database(":memory:");
  ensureRecordAuthoritySchema(database);
  ensureSharePointBackendSchema(database);
  return database;
}

function authority(database: Database.Database, documentId = "DMS-001") {
  return establishRecordAuthority(database, {
    documentId,
    recordKey: "TEST:YOUTH-001:SUPERVISION",
    recordClass: "CLINICAL_RECORD",
    authorityState: "CURRENT_CONTROLLING",
    sourceSystem: "amos-dms",
    sourceLocator: `dms://${documentId}`,
    dataScope: "operational",
    rationale: "Synthetic S2 authority fixture for backend mapping verification.",
    establishedBy: "TEST-ADMIN",
  });
}

const backend = {
  tenantHost: "adolbi.sharepoint.com",
  siteId: "site-cypress-gro",
  driveId: "drive-documents",
  itemId: "item-001",
  name: "Synthetic Supervision Plan.pdf",
  webUrl: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/Synthetic%20Supervision%20Plan.pdf",
  verificationMethod: "MICROSOFT_GRAPH" as const,
  verifiedBy: "TEST-ADMIN",
};

describe("S2 SharePoint backend mapping", () => {
  it("resolves exactly one immutable ACTIVE binding for the controlling authority row", () => {
    const database = db();
    const a = authority(database);
    const binding = establishSharePointBackendBinding(database, {
      authorityId: a.id,
      documentId: a.documentId,
      recordKey: a.recordKey,
      bindingState: "ACTIVE",
      ...backend,
    });
    const resolved = resolvePersistedSharePointBackendBinding(database, {
      authorityId: a.id,
      documentId: a.documentId,
      actorId: "TEST-USER",
    });
    expect(resolved.outcome).toBe("RESOLVED");
    expect(resolved.binding?.id).toBe(binding.id);
    expect(resolved.binding?.stableObjectId).toBe("AMOS-DMS:DMS-001");
  });

  it("requires explicit supersession before replacing an active backend binding", () => {
    const database = db();
    const a = authority(database);
    const first = establishSharePointBackendBinding(database, {
      authorityId: a.id,
      documentId: a.documentId,
      recordKey: a.recordKey,
      bindingState: "ACTIVE",
      ...backend,
    });
    expect(() =>
      establishSharePointBackendBinding(database, {
        authorityId: a.id,
        documentId: a.documentId,
        recordKey: a.recordKey,
        bindingState: "ACTIVE",
        ...backend,
        itemId: "item-002",
      }),
    ).toThrow("SHAREPOINT_BACKEND_REPLACEMENT_REQUIRES_SUPERSESSION");

    const second = establishSharePointBackendBinding(database, {
      authorityId: a.id,
      documentId: a.documentId,
      recordKey: a.recordKey,
      bindingState: "ACTIVE",
      ...backend,
      itemId: "item-002",
      supersedesBindingId: first.id,
    });
    const resolved = resolvePersistedSharePointBackendBinding(database, {
      authorityId: a.id,
      documentId: a.documentId,
      actorId: "TEST-USER",
    });
    expect(resolved.outcome).toBe("RESOLVED");
    expect(resolved.binding?.id).toBe(second.id);
  });

  it("rejects mapping an authority row to a different DMS document identity", () => {
    const database = db();
    const a = authority(database);
    expect(() =>
      establishSharePointBackendBinding(database, {
        authorityId: a.id,
        documentId: "DMS-WRONG",
        recordKey: a.recordKey,
        bindingState: "ACTIVE",
        ...backend,
      }),
    ).toThrow("SHAREPOINT_BACKEND_DOCUMENT_AUTHORITY_MISMATCH");
  });

  it("prevents the same active SharePoint object from being silently bound to two DMS identities", () => {
    const database = db();
    const firstAuthority = authority(database, "DMS-001");
    establishSharePointBackendBinding(database, {
      authorityId: firstAuthority.id,
      documentId: firstAuthority.documentId,
      recordKey: firstAuthority.recordKey,
      bindingState: "ACTIVE",
      ...backend,
    });
    const secondAuthority = establishRecordAuthority(database, {
      documentId: "DMS-002",
      recordKey: "TEST:YOUTH-002:SUPERVISION",
      recordClass: "CLINICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "amos-dms",
      sourceLocator: "dms://DMS-002",
      dataScope: "operational",
      rationale: "Second synthetic S2 authority fixture for object collision testing.",
      establishedBy: "TEST-ADMIN",
    });
    expect(() =>
      establishSharePointBackendBinding(database, {
        authorityId: secondAuthority.id,
        documentId: secondAuthority.documentId,
        recordKey: secondAuthority.recordKey,
        bindingState: "ACTIVE",
        ...backend,
      }),
    ).toThrow("SHAREPOINT_BACKEND_OBJECT_ALREADY_BOUND");
  });

  it("allows a later DMS identity to bind an object only after the prior immutable active binding is explicitly retired", () => {
    const database = db();
    const firstAuthority = authority(database);
    const first = establishSharePointBackendBinding(database, {
      authorityId: firstAuthority.id,
      documentId: firstAuthority.documentId,
      recordKey: firstAuthority.recordKey,
      bindingState: "ACTIVE",
      ...backend,
    });
    establishSharePointBackendBinding(database, {
      authorityId: firstAuthority.id,
      documentId: firstAuthority.documentId,
      recordKey: firstAuthority.recordKey,
      bindingState: "RETIRED",
      ...backend,
      supersedesBindingId: first.id,
    });
    const secondAuthority = establishRecordAuthority(database, {
      documentId: "DMS-003",
      recordKey: "CYPRESS:S2:003",
      recordClass: "CLINICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "amos-dms",
      sourceLocator: "dms://DMS-003",
      dataScope: "operational",
      rationale: "Synthetic S2 authority after explicit backend retirement.",
      establishedBy: "TEST-ADMIN",
    });
    expect(() =>
      establishSharePointBackendBinding(database, {
        authorityId: secondAuthority.id,
        documentId: secondAuthority.documentId,
        recordKey: secondAuthority.recordKey,
        bindingState: "ACTIVE",
        ...backend,
      }),
    ).not.toThrow();
  });

  it("keeps binding and audit rows immutable", () => {
    const database = db();
    const a = authority(database);
    const binding = establishSharePointBackendBinding(database, {
      authorityId: a.id,
      documentId: a.documentId,
      recordKey: a.recordKey,
      bindingState: "ACTIVE",
      ...backend,
    });
    expect(() =>
      database.prepare("UPDATE dms_sharepoint_backend_binding SET name = 'Changed' WHERE id = ?").run(binding.id),
    ).toThrow("IMMUTABLE_SHAREPOINT_BACKEND_BINDING");
    expect(() =>
      database.prepare("DELETE FROM dms_sharepoint_backend_audit").run(),
    ).toThrow("IMMUTABLE_SHAREPOINT_BACKEND_AUDIT");
  });
});
