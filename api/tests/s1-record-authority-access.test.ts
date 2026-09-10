import { describe, expect, it } from "vitest";
import { authorizeRecordContext } from "../dms/record-authority-access";
import type { IdentityUser } from "../security/identity";

const USER: IdentityUser = {
  id: "SYNTH-USER-1",
  email: "synthetic@example.invalid",
  firstName: "Synthetic",
  lastName: "User",
  name: "Synthetic User",
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

const RECORD = {
  caseId: "SYNTH-CASE-1",
  youthId: "SYNTH-YOUTH-1",
  operationId: "CYPRESS-GRO",
  dataScope: "training" as const,
};

const RESOURCE = {
  domain: "gro" as const,
  action: "read" as const,
  division: "gro" as const,
  divisionCategory: "profit-center" as const,
};

describe("S1 governed record contextual access", () => {
  it("allows only after existing RBAC plus operation, case and youth context pass", () => {
    expect(authorizeRecordContext({
      user: USER,
      resource: RESOURCE,
      record: RECORD,
      requireAssignment: true,
      requireOperationMatch: true,
      assignment: {
        operationIds: ["CYPRESS-GRO"],
        assignedCaseIds: ["SYNTH-CASE-1"],
        assignedYouthIds: ["SYNTH-YOUTH-1"],
      },
    })).toMatchObject({ allowed: true, code: "ALLOW_CONTEXTUAL" });
  });

  it("denies without leaking record content when assignment context is missing", () => {
    const denied = authorizeRecordContext({
      user: USER,
      resource: RESOURCE,
      record: RECORD,
      requireAssignment: true,
      requireOperationMatch: true,
      assignment: {
        operationIds: ["CYPRESS-GRO"],
        assignedCaseIds: [],
        assignedYouthIds: [],
      },
    });
    expect(denied).toMatchObject({ allowed: false, code: "DENY_CASE_ASSIGNMENT" });
    expect(denied).not.toHaveProperty("record");
  });

  it("fails operational access for a non-cleared identity before record access", () => {
    const denied = authorizeRecordContext({
      user: { ...USER, dataScope: "operational", accessStatus: "training" },
      resource: RESOURCE,
      record: { ...RECORD, dataScope: "operational" },
      requireAssignment: false,
      requireOperationMatch: false,
    });
    expect(denied).toMatchObject({ allowed: false, code: "DENY_ACCESS_STATUS" });
  });
});
