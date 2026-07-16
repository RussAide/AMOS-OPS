import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSyntheticLoginFixture,
  SYNTHETIC_ROLE_DIVISION_MATRIX,
  validateSyntheticRoleDivisionMatrix,
} from "../reliability/login-fixture";
import {
  executeLoginConcurrencyTest,
  executePasswordRecoveryTest,
} from "../reliability/login-load";

const databases: Database.Database[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("M1.1 50-login concurrency and recovery gate", () => {
  it("uses only canonical role/division/department combinations", () => {
    expect(validateSyntheticRoleDivisionMatrix).not.toThrow();
  });

  it("authenticates 50 concurrent synthetic users across roles and all four divisions", async () => {
    const { db, service, scenarios } = await createSyntheticLoginFixture();
    databases.push(db);
    const report = await executeLoginConcurrencyTest(service, scenarios);

    expect(report).toMatchObject({
      requested: 50,
      authenticated: 50,
      failed: 0,
      maximumConcurrency: 50,
      unrecoverableCrashes: 0,
      representedDivisions: ["BHC", "EO", "GAD", "GRO"],
    });
    expect(report.representedRoles).toHaveLength(SYNTHETIC_ROLE_DIVISION_MATRIX.length);
    expect(report.mfaVerified).toBeGreaterThan(0);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM identity_sessions").get() as { count: number }).count,
    ).toBe(50);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM identity_login_attempts").get() as { count: number }).count,
    ).toBeGreaterThanOrEqual(50);
  }, 30_000);

  it("recovers an account, revokes its prior session, and validates a new session", async () => {
    const { db, service, scenarios } = await createSyntheticLoginFixture();
    databases.push(db);
    const recoveryScenario = scenarios.find((scenario) => scenario.role === "rcs-day");
    expect(recoveryScenario).toBeDefined();
    const result = await executePasswordRecoveryTest(
      service,
      recoveryScenario!,
      "Recovered!Synthetic-2026",
    );
    expect(result).toEqual({
      recovered: true,
      priorSessionRevoked: true,
      newSessionValid: true,
    });
  }, 30_000);
});
