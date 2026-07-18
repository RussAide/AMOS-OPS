import { describe, expect, it } from "vitest";
import { isTrainingProcedureFamilyAllowed } from "./middleware";

describe("TA.1 Training procedure boundary", () => {
  it.each([
    "auth.me",
    "auth.listSessions",
    "auth.logout",
    "training.listOrientationModules",
    "training.listMyProgress",
    "training.updateMyProgress",
  ])("allows the identity or orientation family %s", (path) => {
    expect(isTrainingProcedureFamilyAllowed(path)).toBe(true);
  });

  it.each([
    "bhc.listPatients",
    "hr.listPeople",
    "m2.list",
    "documents.create",
    "workflow.update",
    "msgraph.syncUsers",
    "email.send",
    "revenue.exportClaims",
  ])("denies the operational procedure family %s", (path) => {
    expect(isTrainingProcedureFamilyAllowed(path)).toBe(false);
  });
});
