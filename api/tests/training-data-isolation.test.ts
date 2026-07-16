import { afterEach, describe, expect, it } from "vitest";
import {
  operationalSqlite,
  runWithDataScope,
  sqlite,
  trainingSqlite,
} from "../queries/connection";

const TABLE = "dms_training_isolation_probe";

function dropProbeTables(): void {
  operationalSqlite.exec(`DROP TABLE IF EXISTS ${TABLE}`);
  trainingSqlite.exec(`DROP TABLE IF EXISTS ${TABLE}`);
}

afterEach(dropProbeTables);

describe("account-level Training data isolation", () => {
  it("routes raw SQL writes to separate physical databases", () => {
    dropProbeTables();
    sqlite.exec(`CREATE TABLE ${TABLE} (value TEXT NOT NULL)`);
    sqlite
      .prepare(`INSERT INTO ${TABLE} (value) VALUES (?)`)
      .run("operational-only");

    runWithDataScope("training", () => {
      sqlite.exec(`CREATE TABLE ${TABLE} (value TEXT NOT NULL)`);
      sqlite
        .prepare(`INSERT INTO ${TABLE} (value) VALUES (?)`)
        .run("training-only");
      expect(sqlite.prepare(`SELECT value FROM ${TABLE}`).all()).toEqual([
        { value: "training-only" },
      ]);
    });

    expect(sqlite.prepare(`SELECT value FROM ${TABLE}`).all()).toEqual([
      { value: "operational-only" },
    ]);
  });

  it("preserves scope across asynchronous request work", async () => {
    dropProbeTables();
    operationalSqlite.exec(`CREATE TABLE ${TABLE} (value TEXT NOT NULL)`);
    trainingSqlite.exec(`CREATE TABLE ${TABLE} (value TEXT NOT NULL)`);

    await Promise.all([
      runWithDataScope("training", async () => {
        await Promise.resolve();
        sqlite
          .prepare(`INSERT INTO ${TABLE} (value) VALUES (?)`)
          .run("training");
      }),
      runWithDataScope("operational", async () => {
        await Promise.resolve();
        sqlite
          .prepare(`INSERT INTO ${TABLE} (value) VALUES (?)`)
          .run("operational");
      }),
    ]);

    expect(
      operationalSqlite.prepare(`SELECT value FROM ${TABLE}`).pluck().all(),
    ).toEqual(["operational"]);
    expect(
      trainingSqlite.prepare(`SELECT value FROM ${TABLE}`).pluck().all(),
    ).toEqual(["training"]);
  });
});
