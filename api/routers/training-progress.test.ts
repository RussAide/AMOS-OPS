import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "@db/schema";

vi.mock("../security/identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security/identity")>();
  return {
    ...actual,
    resolveIdentityUser(request: Request) {
      const actor = request.headers.get("x-training-test-actor");
      if (!actor) return null;
      const training = actor.startsWith("training-");
      const coordinator = actor === "training-coordinator";
      const administrator = actor === "operational-administrator";
      return {
        id: `SYNTH-TA1-${actor.toUpperCase()}`,
        email: `${actor}@training-test.amos-ops.invalid`,
        firstName: "Synthetic",
        lastName: "Trainee",
        name: "Synthetic Trainee",
        role: coordinator
          ? "training-coordinator"
          : administrator
            ? "administrator"
            : "rcs-day",
        department:
          coordinator || administrator
            ? "Executive Office"
            : "Residential Services",
        mfaEnabled: true,
        accessStatus: training ? "training" : "cleared",
        identityType: "workforce",
        trainingAccess: true,
        sponsorName: "Synthetic TA.1 test",
        accessExpiresAt: null,
        dataScope: training ? "training" : "operational",
      };
    },
  };
});

import { appRouter } from "../router";
import { operationalSqlite, trainingSqlite } from "../queries/connection";
import {
  ensureUniversalOrientationCurriculum,
  persistOwnProgress,
} from "./training";
import type { IdentityUser } from "../security/identity";

const MODULE_ID = "mod-116";
const USER_A = "SYNTH-TA1-TRAINING-USER-A";
const USER_B = "SYNTH-TA1-TRAINING-USER-B";
const OTHER_PROGRESS_ID = "SYNTH-TA1-PROGRESS-OTHER-001";
const ASSIGNMENT_USER_ID = "SYNTH-TA1-OPERATIONAL-ASSIGNMENT-001";
let trainingModuleExisted = false;

function caller(actor: string, workspace: "training" | "operational") {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: {
        authorization: "Bearer synthetic-ta1-session",
        "x-training-test-actor": actor,
        "x-amos-workspace": workspace,
      },
    }),
    resHeaders: new Headers(),
  });
}

function ensureTrainingTables() {
  for (const sqlite of [trainingSqlite, operationalSqlite]) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS training_modules (
        id text PRIMARY KEY NOT NULL,
        track_id text NOT NULL,
        title text NOT NULL,
        category text NOT NULL,
        description text,
        step_count integer DEFAULT 5 NOT NULL,
        created_at text
      );
      CREATE TABLE IF NOT EXISTS training_progress (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        module_id text NOT NULL,
        completed_steps integer DEFAULT 0 NOT NULL,
        status text DEFAULT 'available' NOT NULL,
        quiz_score integer,
        quiz_passed integer DEFAULT false,
        started_at text,
        completed_at text
      );
    `);
  }
}

function deleteFixtureRows() {
  for (const sqlite of [trainingSqlite, operationalSqlite]) {
    sqlite
      .prepare(
        "DELETE FROM training_progress WHERE id = ? OR user_id IN (?, ?, ?)",
      )
      .run(OTHER_PROGRESS_ID, USER_A, USER_B, ASSIGNMENT_USER_ID);
  }
}

beforeAll(() => {
  ensureTrainingTables();
  deleteFixtureRows();
  trainingModuleExisted = Boolean(
    trainingSqlite
      .prepare("SELECT 1 FROM training_modules WHERE id = ?")
      .get(MODULE_ID),
  );
  trainingSqlite
    .prepare(
      `INSERT INTO training_progress
        (id, user_id, module_id, completed_steps, status, quiz_score, quiz_passed)
       VALUES (?, ?, ?, 1, 'in-progress', 40, 0)`,
    )
    .run(OTHER_PROGRESS_ID, USER_B, MODULE_ID);
});

afterAll(() => {
  deleteFixtureRows();
  if (!trainingModuleExisted) {
    trainingSqlite
      .prepare("DELETE FROM training_modules WHERE id = ?")
      .run(MODULE_ID);
  }
});

describe("TA.1 server-authoritative training progress", () => {
  it("registers the approved orientation allowlist and persists mod-101 in a fresh Training database", async () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(`
        CREATE TABLE training_modules (
          id text PRIMARY KEY NOT NULL,
          track_id text NOT NULL,
          title text NOT NULL,
          category text NOT NULL,
          description text,
          step_count integer DEFAULT 5 NOT NULL,
          created_at text
        );
        CREATE TABLE training_progress (
          id text PRIMARY KEY NOT NULL,
          user_id text NOT NULL,
          module_id text NOT NULL,
          completed_steps integer DEFAULT 0 NOT NULL,
          status text DEFAULT 'available' NOT NULL,
          quiz_score integer,
          quiz_passed integer DEFAULT false,
          started_at text,
          completed_at text
        );
      `);
      const db = drizzleSqlite(sqlite, { schema });
      const modules = await ensureUniversalOrientationCurriculum(db);
      expect(modules).toHaveLength(16);
      expect(modules.map((module) => module.id).sort()).toEqual(
        Array.from({ length: 16 }, (_, index) => `mod-${101 + index}`),
      );

      const trainee: IdentityUser = {
        id: "SYNTH-TA1-FRESH-DATABASE-USER",
        email: "fresh-database@training-test.amos-ops.invalid",
        firstName: "Synthetic",
        lastName: "Fresh Database",
        name: "Synthetic Fresh Database",
        role: "rcs-day",
        department: "Residential Services",
        mfaEnabled: true,
        accessStatus: "training",
        identityType: "workforce",
        trainingAccess: true,
        sponsorName: "Synthetic TA.1 test",
        accessExpiresAt: null,
        dataScope: "training",
      };
      const saved = await persistOwnProgress(
        trainee,
        {
          moduleId: "mod-101",
          completedSteps: 1,
          status: "in-progress",
          quizScore: 75,
          quizPassed: false,
        },
        db,
      );
      expect(saved).toMatchObject({
        userId: trainee.id,
        moduleId: "mod-101",
        completedSteps: 1,
        quizScore: 75,
      });

      sqlite
        .prepare(
          "UPDATE training_modules SET track_id = ?, title = ?, category = ?, description = ?, step_count = ? WHERE id = ?",
        )
        .run(
          "tampered-track",
          "Tampered title",
          "Tampered category",
          "Tampered description",
          99,
          "mod-101",
        );
      sqlite
        .prepare(
          `INSERT INTO training_modules
            (id, track_id, title, category, description, step_count)
           VALUES (?, 'universal-orientation', 'Legacy module', 'Legacy', 'Not approved', 1)`,
        )
        .run("mod-999");

      const reconciled = await ensureUniversalOrientationCurriculum(db);
      expect(reconciled).toHaveLength(16);
      expect(reconciled.some((module) => module.id === "mod-999")).toBe(false);
      expect(
        reconciled.find((module) => module.id === "mod-101"),
      ).toMatchObject({
        trackId: "universal-orientation",
        title: "Welcome, Mission & Organizational Identity",
        category: "Operations",
        description:
          "TA.1 synthetic-only orientation practice. Completion is not release-to-duty certification.",
        stepCount: 5,
      });
      expect(
        sqlite.prepare("SELECT COUNT(*) AS count FROM training_modules").get(),
      ).toEqual({ count: 17 });
    } finally {
      sqlite.close();
    }
  });

  it("derives the trainee identity from the session and persists progress and quiz state", async () => {
    const trainee = caller("training-user-a", "training");

    const started = await trainee.training.updateMyProgress({
      moduleId: MODULE_ID,
      completedSteps: 2,
      status: "in-progress",
      quizScore: 60,
      quizPassed: false,
    });
    expect(started).toMatchObject({
      userId: USER_A,
      moduleId: MODULE_ID,
      completedSteps: 2,
      status: "in-progress",
      quizScore: 60,
      quizPassed: false,
    });

    await expect(
      trainee.training.updateMyProgress({
        moduleId: MODULE_ID,
        completedSteps: 5,
        status: "completed",
        quizScore: 79,
        quizPassed: true,
      }),
    ).rejects.toThrow(/at least 80/);

    const completed = await trainee.training.updateMyProgress({
      moduleId: MODULE_ID,
      completedSteps: 5,
      status: "completed",
      quizScore: 92,
      quizPassed: true,
    });
    expect(completed).toMatchObject({
      userId: USER_A,
      completedSteps: 5,
      status: "completed",
      quizScore: 92,
      quizPassed: true,
    });
    expect(completed?.startedAt).toBe(started?.startedAt);
    expect(completed?.completedAt).toBeTruthy();

    const reloaded = await caller(
      "training-user-a",
      "training",
    ).training.getMyProgress({ moduleId: MODULE_ID });
    expect(reloaded).toMatchObject({
      id: completed?.id,
      userId: USER_A,
      quizScore: 92,
      quizPassed: true,
    });
    expect(
      operationalSqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM training_progress WHERE user_id = ? AND module_id = ?",
        )
        .get(USER_A, MODULE_ID),
    ).toEqual({ count: 0 });
    expect(
      operationalSqlite
        .prepare("SELECT COUNT(*) AS count FROM training_modules WHERE id = ?")
        .get(MODULE_ID),
    ).toEqual({ count: 0 });
  });

  it("does not expose or accept another trainee's user identifier", async () => {
    const trainee = caller("training-user-a", "training");
    const ownRows = await trainee.training.listMyProgress();
    expect(ownRows.every((row) => row.userId === USER_A)).toBe(true);
    expect(ownRows.some((row) => row.userId === USER_B)).toBe(false);

    const spoofedRead = trainee.training.getMyProgress as (
      input: unknown,
    ) => Promise<unknown>;
    await expect(
      spoofedRead({ moduleId: MODULE_ID, userId: USER_B }),
    ).rejects.toThrow(/Unrecognized key|userId/i);

    const spoofedWrite = trainee.training.updateMyProgress as (
      input: unknown,
    ) => Promise<unknown>;
    await expect(
      spoofedWrite({
        moduleId: MODULE_ID,
        userId: USER_B,
        completedSteps: 3,
        status: "completed",
        quizScore: 100,
        quizPassed: true,
      }),
    ).rejects.toThrow(/Unrecognized key|userId/i);

    const other = trainingSqlite
      .prepare(
        "SELECT completed_steps AS completedSteps, status, quiz_score AS quizScore FROM training_progress WHERE id = ?",
      )
      .get(OTHER_PROGRESS_ID) as {
      completedSteps: number;
      status: string;
      quizScore: number;
    };
    expect(other).toEqual({
      completedSteps: 1,
      status: "in-progress",
      quizScore: 40,
    });
  });

  it("denies Training-workspace cohort reads even to a coordinator", async () => {
    await expect(
      caller("training-coordinator", "training").training.getProgress({
        userId: USER_B,
        moduleId: MODULE_ID,
      }),
    ).rejects.toThrow(/cleared trainer role/);
  });

  it("denies Operational spoofing of completion fields while allowing bounded assignment", async () => {
    const administrator = caller("operational-administrator", "training");
    const spoofedCohortUpdate = administrator.training.updateProgress as (
      input: unknown,
    ) => Promise<unknown>;
    await expect(
      spoofedCohortUpdate({
        userId: USER_B,
        moduleId: MODULE_ID,
        completedSteps: 3,
        status: "completed",
        quizScore: 100,
        quizPassed: true,
      }),
    ).rejects.toThrow(/Invalid input|Unrecognized key|status/i);

    const assigned = await administrator.training.updateProgress({
      userId: ASSIGNMENT_USER_ID,
      moduleId: MODULE_ID,
      status: "available",
    });
    expect(assigned).toMatchObject({
      userId: ASSIGNMENT_USER_ID,
      moduleId: MODULE_ID,
      completedSteps: 0,
      status: "available",
      quizScore: null,
      quizPassed: false,
    });
  });

  it("rejects Operational sessions from Training self-service", async () => {
    await expect(
      caller(
        "operational-administrator",
        "operational",
      ).training.listMyProgress(),
    ).rejects.toThrow(/Training workspace/);
  });

  it("keeps the TA.1 orientation allowlist immutable and rejects non-allowlisted assignments", async () => {
    const administrator = caller("operational-administrator", "training");
    await expect(
      administrator.training.updateModule({
        id: MODULE_ID,
        title: "Tampered module",
      }),
    ).rejects.toThrow(/immutable/);
    await expect(
      administrator.training.deleteModule({ id: MODULE_ID }),
    ).rejects.toThrow(/immutable/);
    await expect(
      administrator.training.createModule({
        trackId: "universal-orientation",
        title: "Unapproved module",
        category: "Operations",
        stepCount: 1,
      }),
    ).rejects.toThrow(/immutable/);
    await expect(
      administrator.training.updateProgress({
        userId: ASSIGNMENT_USER_ID,
        moduleId: "SYNTH-UNAPPROVED-MODULE",
        status: "available",
      }),
    ).rejects.toThrow(/approved universal-orientation modules/);
  });
});
