import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  M41C_ACTIVATION_STATES,
  M41C_DEMO_BOUNDARY,
  M41C_PROHIBITED_ACTIONS,
} from "@contracts/m41c/shared";
import { ALL_ROLES } from "@/constants/roles";
import { buildEnvironmentConfig } from "../lib/env";
import {
  M41C_AUTHORIZED_ROLES,
  M41C_CLINICAL_VIEW_ROLES,
  assertM41cActionPermitted,
  assertM41cRuntimeActive,
  ensureM41cRuntimeSchema,
  evaluateM41cClinicalAccess,
  type M41cRuntimeControlContext,
} from "../services/m41c";
import { seedPhase3ControlScenario } from "../services/phase3/runtime-schema";

const DEMO_ENVIRONMENT = buildEnvironmentConfig({
  NODE_ENV: "test",
  APP_ENV: "demo",
  AMOS_RUNTIME_MODE: "demo",
  AMOS_ENVIRONMENT_ID: "amos-ops-demo-m41c-test",
  CREDENTIAL_NAMESPACE: "amos-ops/demo/m41c-test",
  DATABASE_PATH: "data/demo/m41c-test.db",
  UPLOAD_PATH: "uploads/demo/m41c-test",
});
const CONTROL = {
  environment: DEMO_ENVIRONMENT,
  asOf: "2026-07-14T22:00:00.000Z",
} as const satisfies M41cRuntimeControlContext;

describe("M4.1C shared clinical intelligence foundation", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    seedPhase3ControlScenario(db);
  });

  afterEach(() => db.close());

  it("admits all canonical roles to the governed shell without granting clinical detail", () => {
    expect(M41C_AUTHORIZED_ROLES).toEqual(ALL_ROLES);
    expect(M41C_CLINICAL_VIEW_ROLES.length).toBeGreaterThan(0);
    expect(M41C_CLINICAL_VIEW_ROLES.length).toBeLessThan(ALL_ROLES.length);
    expect(
      evaluateM41cClinicalAccess({
        role: "rcs-day",
        subjectId: "SYNTH-YOUTH-001",
        purpose: "direct_care",
        part2: false,
        requestedFields: ["safety_status"],
        minimumNecessaryFields: ["safety_status"],
      }),
    ).toMatchObject({
      allowed: false,
      code: "M41C_ROLE_ACCESS_DENIED",
      permittedFields: [],
    });
  });

  it("enforces synthetic identity, minimum necessary, consent, and Part 2 independently", () => {
    const base = {
      role: "therapist" as const,
      subjectId: "SYNTH-YOUTH-001",
      purpose: "direct_care" as const,
      part2: false,
      requestedFields: ["safety_status"],
      minimumNecessaryFields: ["safety_status"],
    };
    const allowed = evaluateM41cClinicalAccess(base);
    expect(allowed.allowed).toBe(true);
    expect(allowed.auditEvent).toMatchObject({
      eventType: "access_evaluated",
      immutable: true,
    });
    expect(
      evaluateM41cClinicalAccess({ ...base, subjectId: "REAL-YOUTH-001" }).code,
    ).toBe("M41C_REAL_SUBJECT_DENIED");
    expect(
      evaluateM41cClinicalAccess({
        ...base,
        requestedFields: ["safety_status", "part2_notes"],
        minimumNecessaryFields: ["safety_status", "part2_notes"],
      }).code,
    ).toBe("M41C_MINIMUM_NECESSARY_DENIED");
    expect(
      evaluateM41cClinicalAccess({ ...base, consentState: "revoked" }).code,
    ).toBe("M41C_CONSENT_DENIED");
    expect(
      evaluateM41cClinicalAccess({
        ...base,
        role: "behavioral-support",
        part2: true,
      }).code,
    ).toBe("M41C_PART2_ACCESS_DENIED");
    expect(
      evaluateM41cClinicalAccess({
        ...base,
        actorId: "REAL-HUMAN-THERAPIST",
      }).code,
    ).toBe("M41C_REAL_ACTOR_DENIED");
  });

  it("makes production activation and every prohibited action unavailable", () => {
    expect(M41C_ACTIVATION_STATES).not.toContain("production_approved");
    expect(M41C_DEMO_BOUNDARY).toMatchObject({
      syntheticDataOnly: true,
      productionActivationAvailable: false,
      liveClinicalDecisionAvailable: false,
      externalWritesAvailable: false,
    });
    for (const action of M41C_PROHIBITED_ACTIONS)
      expect(() => assertM41cActionPermitted(action)).toThrow(
        `M41C_PROHIBITED_ACTION:${action}`,
      );
  });

  it("creates the 12-table synthetic persistence boundary only after demo control", () => {
    assertM41cRuntimeActive(db, CONTROL);
    ensureM41cRuntimeSchema(db);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'm41c_%' ORDER BY name",
      )
      .all();
    expect(tables).toHaveLength(12);
    expect(() =>
      db
        .prepare(
          `INSERT INTO m41c_scenario_runs
           (id,scenario_id,status,started_at,evidence_class,production_rows,live_writes,created_at)
           VALUES ('BAD','BAD','failed','2026-11-15','synthetic_clinical_demo',1,0,'2026-11-15')`,
        )
        .run(),
    ).toThrow();
    expect(() =>
      db
        .prepare(
          `INSERT INTO m41c_pathway_definitions
           (id,run_id,pathway_key,pathway_version,activation_state,steps_json,evidence_class,created_at)
           VALUES ('BAD', 'MISSING', 'BAD', '1', 'production_approved', '[]',
             'synthetic_clinical_demo', '2026-11-15')`,
        )
        .run(),
    ).toThrow();
  });
});
