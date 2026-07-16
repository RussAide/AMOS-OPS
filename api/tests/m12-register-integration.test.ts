import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { regulatoryFrameworkRouter } from "../routers/regulatory-framework";
import {
  REGULATORY_EXCEPTIONS,
  REGULATORY_RULE_REVIEWS,
  REGULATORY_RULES,
  REGULATORY_SCENARIOS,
  REGULATORY_SOURCE_VALIDATIONS,
  regulatoryRegisterSummary,
  validateRegulatoryRegister,
} from "@contracts/regulatory/register";

describe("M1.2 controlled regulatory register", () => {
  it("contains the sealed prototype inventory", () => {
    expect(regulatoryRegisterSummary()).toEqual({
      sources: 4,
      rules: 30,
      operational: 29,
      conditional: 1,
      reviews: 60,
      exceptions: 3,
      scenarios: 6,
    });
  });

  it("has no structural validation errors", () => {
    expect(validateRegulatoryRegister()).toEqual([]);
  });

  it("maps every rule across UI, API, database, audit, exception, and test controls", () => {
    for (const rule of REGULATORY_RULES) {
      expect(rule.uiControl).toBeTruthy();
      expect(rule.apiControl).toBeTruthy();
      expect(rule.databaseControl).toContain("0003_m12_regulatory_framework.sql");
      expect(rule.auditEvent).toMatch(/^regulatory\./);
      expect(rule.exceptionWorkflow).toContain("Fail closed");
      expect(rule.automatedTest).toMatch(/m12-/);
    }
  });

  it("represents exactly six MHTCM functions", () => {
    expect(REGULATORY_RULES.filter((rule) => rule.id.startsWith("M12-CL-00") && rule.domain === "MHTCM").map((rule) => rule.title)).toEqual([
      "Intake screening function",
      "Eligibility function",
      "Care coordination function",
      "Referral management function",
      "Discharge planning function",
      "Aftercare follow-up function",
    ]);
  });

  it("represents exactly four MHRS categories", () => {
    expect(REGULATORY_RULES.filter((rule) => rule.domain === "MHRS").map((rule) => rule.title)).toEqual([
      "Psychosocial rehabilitation category",
      "Skills training category",
      "Supportive interventions category",
      "Community integration category",
    ]);
  });

  it("keeps H2014-HO conditional and tied to a safe exception", () => {
    const rule = REGULATORY_RULES.find((item) => item.id === "M12-BL-004");
    const exception = REGULATORY_EXCEPTIONS.find((item) => item.ruleId === rule?.id);
    expect(rule?.state).toBe("conditional");
    expect(exception?.safeDisposition).toContain("deny billing");
  });

  it("retains two clearly synthetic prototype reviews per rule", () => {
    for (const rule of REGULATORY_RULES) {
      const reviews = REGULATORY_RULE_REVIEWS.filter((review) => review.ruleId === rule.id);
      expect(reviews).toHaveLength(2);
      expect(reviews.map((review) => review.reviewLane).sort()).toEqual(["compliance", "operations"]);
      expect(reviews.every((review) => review.reviewer.startsWith("Synthetic"))).toBe(true);
    }
  });

  it("uses only current-source validation records", () => {
    expect(REGULATORY_SOURCE_VALIDATIONS.every((source) => source.validationStatus === "current-source-validated")).toBe(true);
    expect(REGULATORY_SOURCE_VALIDATIONS.every((source) => source.url.startsWith("https://"))).toBe(true);
  });

  it("provides allow, deny, and review synthetic scenarios", () => {
    expect(new Set(REGULATORY_SCENARIOS.map((scenario) => scenario.expectedOutcome))).toEqual(new Set(["allow", "deny", "review"]));
  });

  it("publishes the command-center route and navigation entry", () => {
    const routes = fs.readFileSync(path.resolve("src/components/shell/app-shell-routes.tsx"), "utf8");
    const navigation = fs.readFileSync(path.resolve("src/data/navData.ts"), "utf8");
    const page = fs.readFileSync(path.resolve("src/pages/compliance/regulatory-framework-page.tsx"), "utf8");
    const apiRouter = fs.readFileSync(path.resolve("api/router.ts"), "utf8");
    const regulatoryApi = fs.readFileSync(path.resolve("api/routers/regulatory-framework.ts"), "utf8");
    const accessControl = fs.readFileSync(path.resolve("src/constants/access-control.ts"), "utf8");
    expect(routes).toContain("/compliance/regulatory-framework");
    expect(navigation).toContain('label: "Regulatory Framework"');
    expect(page).toContain("Regulatory Framework Command Center");
    expect(apiRouter).toContain("regulatoryFramework: regulatoryFrameworkRouter");
    expect(regulatoryApi).toContain("evaluateClinicalBilling: authedQuery");
    expect(regulatoryApi).toContain("evaluateGroCompliance: authedQuery");
    expect(regulatoryApi).toContain("evaluatePart2Disclosure: authedQuery");
    expect(accessControl).toContain('regulatoryFramework: { domain: "compliance" }');
  });

  it("mounts authenticated evaluation procedures for all three policy engines", () => {
    expect(Object.keys(regulatoryFrameworkRouter._def.record)).toEqual(expect.arrayContaining([
      "evaluateClinicalBilling",
      "evaluateGroCompliance",
      "classifyPart2Record",
      "evaluatePart2Access",
      "evaluatePart2Disclosure",
    ]));
  });
});

describe("M1.2 regulatory migration", () => {
  it("applies to a clean database with the expected controlled rows", () => {
    const migrationPath = path.resolve("db/migrations/0003_m12_regulatory_framework.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");

    try {
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
        db.exec(statement);
      }

      expect((db.prepare("SELECT COUNT(*) AS count FROM regulatory_sources").get() as { count: number }).count).toBe(4);
      expect((db.prepare("SELECT COUNT(*) AS count FROM regulatory_rules").get() as { count: number }).count).toBe(30);
      expect((db.prepare("SELECT COUNT(*) AS count FROM regulatory_rule_reviews").get() as { count: number }).count).toBe(60);
      expect((db.prepare("SELECT COUNT(*) AS count FROM regulatory_exceptions").get() as { count: number }).count).toBe(3);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    } finally {
      db.close();
    }
  });
});
