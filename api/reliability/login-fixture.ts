import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { ROLE_DEFINITIONS, type UserRole } from "../../src/constants/roles";
import type { EnvironmentConfig } from "../lib/env";
import { createIdentityService } from "../security/identity";
import type { SyntheticLoginScenario } from "./login-load";

export const SYNTHETIC_LOGIN_PASSWORD = "Synthetic!Pass-2026";

export const SYNTHETIC_ROLE_DIVISION_MATRIX = [
  { role: "super-admin", division: "EO", department: "Executive Office" },
  // CTR-017: EO owns HR and finance/revenue oversight.
  { role: "hr-director", division: "EO", department: "Human Resources" },
  { role: "facilities-manager", division: "GAD", department: "Facilities" },
  {
    role: "revenue-cycle-manager",
    division: "EO",
    department: "Revenue Operations",
  },
  { role: "gro-administrator", division: "GRO", department: "GRO Residential" },
  { role: "rcs-day", division: "GRO", department: "GRO Residential" },
  { role: "bhc-director", division: "BHC", department: "BHC Division-wide" },
  { role: "ccmg-program-director", division: "BHC", department: "CCMG" },
  { role: "mhtcm-supervisor", division: "BHC", department: "MHTCM" },
  { role: "mhrs-supervisor", division: "BHC", department: "MHRS" },
] as const satisfies ReadonlyArray<{
  role: UserRole;
  division: SyntheticLoginScenario["division"];
  department: string;
}>;

function evaluationEnvironment(): EnvironmentConfig {
  return {
    appEnvironment: "demo",
    runtimeMode: "demo",
    environmentId: "amos-ops-demo-load-test",
    credentialNamespace: "amos-ops/demo/load-test",
    nodeEnvironment: "test",
    port: 3000,
    appId: "amos-ops-load-test",
    appSecret: "synthetic-app-secret-for-m1.1-load-test-only-0000000000000000",
    jwtSecret: "synthetic-jwt-secret-for-m1.1-load-test-only-0000000000000000",
    databasePath: ":memory:",
    trainingDatabasePath: "data/demo/training/load-test.db",
    persistentRoot: "data/demo",
    uploadPath: "uploads/demo",
    trainingUploadPath: "uploads/demo/training",
    backupPath: "backups/demo",
    evaluationMode: true,
    allowSelfRegistration: false,
    mfaPolicy: "required-privileged",
    deploymentApprovalId: "synthetic-test",
    deploymentChangeReference: "synthetic-test",
    productionReleaseAuthorized: false,
    productionReleaseId: null,
    reviewDeployment: false,
    finalGateOwnerEmail: null,
    finalGateCandidateId: null,
    buildId: "amos-ops-demo-load-test",
    sourceDigest: null,
    reviewOwnerPasswordHash: null,
    reviewOwnerMfaCode: null,
    initialAdminEmail: null,
    initialAdminFirstName: null,
    initialAdminLastName: null,
    initialAdminInvitationTokenHash: null,
    initialAdminInvitationExpiresAt: null,
    allowedOrigins: Object.freeze(["http://localhost:3000"]),
    isDevelopment: false,
    isDemo: true,
    isStaging: false,
    isProduction: false,
  };
}

export function validateSyntheticRoleDivisionMatrix(): void {
  for (const profile of SYNTHETIC_ROLE_DIVISION_MATRIX) {
    const definition = ROLE_DEFINITIONS.find(
      (role) => role.id === profile.role,
    );
    if (!definition) throw new Error(`Unknown canonical role: ${profile.role}`);
    if (definition.division.toUpperCase() !== profile.division) {
      throw new Error(
        `Role/division mismatch: ${profile.role} is ${definition.division}, not ${profile.division}`,
      );
    }
    if (definition.department !== profile.department) {
      throw new Error(
        `Role/department mismatch: ${profile.role} is ${definition.department}, not ${profile.department}`,
      );
    }
  }
}

export async function createSyntheticLoginFixture(): Promise<{
  db: Database.Database;
  service: ReturnType<typeof createIdentityService>;
  scenarios: SyntheticLoginScenario[];
}> {
  validateSyntheticRoleDivisionMatrix();
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  const service = createIdentityService(db, {
    environment: evaluationEnvironment(),
    policy: { passwordHashRounds: 4, mfaPolicy: "required-privileged" },
  });
  const passwordHash = await bcrypt.hash(SYNTHETIC_LOGIN_PASSWORD, 4);
  const scenarios = Array.from(
    { length: 50 },
    (_, index): SyntheticLoginScenario => {
      const profile =
        SYNTHETIC_ROLE_DIVISION_MATRIX[
          index % SYNTHETIC_ROLE_DIVISION_MATRIX.length
        ];
      return {
        userId: `synthetic-user-${String(index + 1).padStart(2, "0")}`,
        email: `load-user-${String(index + 1).padStart(2, "0")}@amos-ops.invalid`,
        password: SYNTHETIC_LOGIN_PASSWORD,
        role: profile.role,
        division: profile.division,
        department: profile.department,
      };
    },
  );
  const insert = db.prepare(
    `INSERT INTO users
       (id, email, password_hash, first_name, last_name, role, department,
        is_active, created_at, updated_at)
     VALUES (?, ?, ?, 'Synthetic', ?, ?, ?, 1, ?, ?)`,
  );
  const createdAt = new Date("2026-07-13T00:00:00.000Z").toISOString();
  for (const scenario of scenarios) {
    insert.run(
      scenario.userId,
      scenario.email,
      passwordHash,
      scenario.userId,
      scenario.role,
      scenario.department,
      createdAt,
      createdAt,
    );
  }
  return { db, service, scenarios };
}
