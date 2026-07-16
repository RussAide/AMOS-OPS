import { describe, expect, it } from "vitest";
import { createSyntheticLoginFixture } from "../reliability/login-fixture";
import {
  executeLoginConcurrencyTest,
  executePasswordRecoveryTest,
} from "../reliability/login-load";

describe("M1.1 retained synthetic login evidence", () => {
  it("emits a sanitized JSON acceptance report", async () => {
    const { db, service, scenarios } = await createSyntheticLoginFixture();
    try {
      const concurrency = await executeLoginConcurrencyTest(service, scenarios);
      const recoveryScenario = scenarios.find((scenario) => scenario.role === "rcs-day");
      if (!recoveryScenario) throw new Error("Recovery scenario missing");
      const recovery = await executePasswordRecoveryTest(
        service,
        recoveryScenario,
        "Recovered!Synthetic-2026",
      );
      const evidence = {
        evidenceType: "M1.1-08 synthetic concurrency and recovery",
        dataClassification: "fictional evaluation identities only",
        generatedAt: new Date().toISOString(),
        concurrency: {
          requested: concurrency.requested,
          authenticated: concurrency.authenticated,
          failed: concurrency.failed,
          mfaVerified: concurrency.mfaVerified,
          maximumConcurrency: concurrency.maximumConcurrency,
          unrecoverableCrashes: concurrency.unrecoverableCrashes,
          durationMs: concurrency.durationMs,
          p95DurationMs: concurrency.p95DurationMs,
          representedRoles: concurrency.representedRoles,
          representedDivisions: concurrency.representedDivisions,
        },
        recovery,
      };
      console.log(`M1_1_LOGIN_EVIDENCE=${JSON.stringify(evidence)}`);
      expect(evidence.concurrency).toMatchObject({
        requested: 50,
        authenticated: 50,
        failed: 0,
        maximumConcurrency: 50,
        unrecoverableCrashes: 0,
      });
      expect(recovery.recovered).toBe(true);
    } finally {
      db.close();
    }
  }, 30_000);
});
