import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { IdentityUser } from "../security/identity";
import { establishRecordAuthority } from "../dms/record-authority-store";
import { establishSharePointBackendBinding } from "../dms/sharepoint-backend-store";
import { resolveAuthorizedSharePointBackend } from "../dms/sharepoint-authority-bridge";

const USER: IdentityUser = {
  id: "SYNTH-S2-USER",
  email: "s2@example.invalid",
  firstName: "Synthetic",
  lastName: "S2",
  name: "Synthetic S2",
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

function fixture() {
  const db = new Database(":memory:");
  const authority = establishRecordAuthority(db, {
    documentId: "SYNTH-S2-DOC",
    recordKey: "CYPRESS:SYNTH-S2-CASE:SUPERVISION",
    recordClass: "CLINICAL_RECORD",
    authorityState: "CURRENT_CONTROLLING",
    sourceSystem: "synthetic-test",
    sourceLocator: "dms://SYNTH-S2-DOC",
    youthId: "SYNTH-S2-YOUTH",
    caseId: "SYNTH-S2-CASE",
    operationId: "CYPRESS-GRO",
    division: "gro",
    dataScope: "training",
    rationale: "Synthetic S2 bridge composition fixture.",
    establishedBy: "SYNTH-S2-ADMIN",
  });
  const binding = establishSharePointBackendBinding(db, {
    authorityId: authority.id,
    documentId: authority.documentId,
    recordKey: authority.recordKey,
    bindingState: "ACTIVE",
    tenantHost: "adolbi.sharepoint.com",
    siteId: "site-cypress-gro",
    driveId: "drive-documents",
    itemId: "item-s2",
    name: "Synthetic S2 Supervision Plan.pdf",
    webUrl: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/Synthetic%20S2%20Supervision%20Plan.pdf",
    verificationMethod: "MICROSOFT_GRAPH",
    verifiedBy: "SYNTH-S2-ADMIN",
  });
  return { db, authority, binding };
}

describe("S2 authority to SharePoint backend composition", () => {
  it("returns the exact backend object only after authority and contextual access pass", () => {
    const { db, authority, binding } = fixture();
    const result = resolveAuthorizedSharePointBackend(db, {
      recordKey: authority.recordKey,
      user: USER,
      resource: RESOURCE,
      contextRequirements: {
        requireAssignment: true,
        requireOperationMatch: true,
      },
      assignment: {
        operationIds: ["CYPRESS-GRO"],
        assignedCaseIds: ["SYNTH-S2-CASE"],
        assignedYouthIds: ["SYNTH-S2-YOUTH"],
      },
    });
    expect(result).toMatchObject({
      outcome: "AUTHORIZED_BACKEND",
      authorityId: authority.id,
      documentId: authority.documentId,
      binding: { id: binding.id, address: { itemId: "item-s2" } },
    });
    db.close();
  });

  it("returns no backend locator when contextual access is denied", () => {
    const { db, authority } = fixture();
    const result = resolveAuthorizedSharePointBackend(db, {
      recordKey: authority.recordKey,
      user: USER,
      resource: RESOURCE,
      contextRequirements: {
        requireAssignment: true,
        requireOperationMatch: true,
      },
      assignment: {
        operationIds: ["CYPRESS-GRO"],
        assignedCaseIds: [],
        assignedYouthIds: [],
      },
    });
    expect(result.outcome).toBe("DENIED");
    expect(result.binding).toBeNull();
    db.close();
  });

  it("does not substitute a backend object when no controlling authority exists", () => {
    const db = new Database(":memory:");
    const result = resolveAuthorizedSharePointBackend(db, {
      recordKey: "CYPRESS:NO-CONTROLLER",
      user: USER,
      resource: RESOURCE,
      contextRequirements: {
        requireAssignment: false,
        requireOperationMatch: false,
      },
    });
    expect(result).toEqual({
      outcome: "NO_CONTROLLING_RECORD",
      code: "NO_CONTROLLING_RECORD",
      authorityId: null,
      documentId: null,
      recordKey: "CYPRESS:NO-CONTROLLER",
      binding: null,
    });
    db.close();
  });
});
