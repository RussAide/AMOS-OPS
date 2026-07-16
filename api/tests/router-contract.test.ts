import { describe, expect, it } from "vitest";
import { appRouter } from "../router";

const REQUIRED_CLIENT_ROOTS = [
  "analytics",
  "auth",
  "bhc",
  "ccmg",
  "credentials",
  "dashboard",
  "documents",
  "email",
  "forms",
  "gad",
  "gro",
  "groCompliance",
  "groResidential",
  "hr",
  "m1",
  "m2",
  "m3",
  "m5",
  "m13",
  "m14",
  "m15",
  "m16",
  "m17",
  "m18",
  "m19",
  "m20",
  "m21",
  "m29",
  "mgma",
  "mhrs",
  "mhtcm",
  "msgraph",
  "nil",
  "notifications",
  "part2",
  "performance",
  "qa",
  "revenue",
  "separation",
  "training",
  "workflow",
] as const;

describe("application router contract", () => {
  it("mounts every namespace consumed by the retained client", () => {
    const mountedRoots = Object.keys(appRouter._def.record);
    for (const root of REQUIRED_CLIENT_ROOTS) {
      expect(mountedRoots, `missing client router root: ${root}`).toContain(root);
    }
  });

  it("retains the workflow methods used by administration and HR", () => {
    const workflowProcedures = Object.keys(appRouter._def.record.workflow);
    expect(workflowProcedures).toEqual(expect.arrayContaining([
      "listRules",
      "getEventTypes",
      "listInstances",
      "listPendingApprovals",
      "dashboardKPIs",
      "auditLog",
      "trigger",
      "respondApproval",
    ]));
  });

  it("retains personnel forms, email, and document lifecycle methods", () => {
    expect(Object.keys(appRouter._def.record.forms)).toEqual(expect.arrayContaining([
      "listTemplates",
      "listInstances",
      "createInstance",
      "updateInstanceStatus",
      "missingFormsReport",
      "autoAssign",
    ]));
    expect(Object.keys(appRouter._def.record.email)).toEqual(expect.arrayContaining([
      "send",
      "sendTemplate",
      "list",
      "templates",
      "stats",
    ]));
    expect(Object.keys(appRouter._def.record.documents)).toEqual(expect.arrayContaining([
      "list",
      "create",
      "updateStatus",
      "listTemplates",
      "createDocumentJob",
    ]));
  });

  it("combines the full clinical router with retained M5 compatibility methods", () => {
    expect(Object.keys(appRouter._def.record.bhc)).toEqual(expect.arrayContaining([
      "acceptReferral",
      "approveTreatmentPlan",
      "completeCansAssessment",
      "completeReferral",
      "createAssessmentDomain",
      "createCansAssessment",
      "createInsurancePlan",
      "createReferral",
      "declineReferral",
      "deleteInsurancePlan",
      "getCansAssessment",
      "getOutcomeTrends",
      "getReferral",
      "getServiceDeliverySummary",
      "getSession",
      "getTreatmentPlan",
      "listAssessmentDomains",
      "listCansAssessments",
      "listOutcomeMeasures",
      "listReferrals",
      "listTreatmentPlans",
      "updateCansAssessment",
      "updateInsurancePlan",
      "listPlans",
      "seedClinicalData",
    ]));
  });

  it("retains work, behavioral observation, medication, authorization, and Sentinel procedures", () => {
    expect(Object.keys(appRouter._def.record.m1)).toEqual(expect.arrayContaining([
      "claimWorkTask",
      "addWorkTaskComment",
    ]));
    expect(Object.keys(appRouter._def.record.m18)).toContain("listBehavioralObservations");
    expect(Object.keys(appRouter._def.record.m19)).toEqual(expect.arrayContaining([
      "listMedications",
      "medSummary",
      "administer",
      "recordRefusal",
      "holdMedication",
    ]));
    expect(Object.keys(appRouter._def.record.m20)).toEqual(expect.arrayContaining([
      "listAuthorizations",
      "authSummary",
    ]));
    expect(Object.keys(appRouter._def.record.m3)).toEqual(expect.arrayContaining([
      "sentinel",
      "complianceScore",
    ]));
  });

  it("keeps restored clinical and operational procedures behind authentication", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/trpc"),
      resHeaders: new Headers(),
    });

    await expect(caller.bhc.listInsurancePlans()).rejects.toThrow("Unauthorized");
    await expect(caller.m1.claimWorkTask({ taskId: "task-1" })).rejects.toThrow("Unauthorized");
    await expect(caller.m18.listBehavioralObservations()).rejects.toThrow("Unauthorized");
    await expect(caller.m19.listMedications()).rejects.toThrow("Unauthorized");
    await expect(caller.m20.listAuthorizations()).rejects.toThrow("Unauthorized");
    await expect(caller.m3.sentinel()).rejects.toThrow("Unauthorized");
  });
});
