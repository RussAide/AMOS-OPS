import { describe, expect, it } from "vitest";
import { enforceDatabaseStartupPolicy } from "../startup-policy";

describe("M1.1 controlled database startup policy", () => {
  const initializationFailure = new Error("synthetic initialization failure");

  it("stops staging and production startup", () => {
    expect(() =>
      enforceDatabaseStartupPolicy(
        { isStaging: true, isProduction: false },
        initializationFailure,
      ),
    ).toThrow("Controlled environment startup stopped");
    expect(() =>
      enforceDatabaseStartupPolicy(
        { isStaging: false, isProduction: true },
        initializationFailure,
      ),
    ).toThrow("Controlled environment startup stopped");
  });

  it("allows development and demo to expose degraded readiness diagnostics", () => {
    expect(() =>
      enforceDatabaseStartupPolicy(
        { isStaging: false, isProduction: false },
        initializationFailure,
      ),
    ).not.toThrow();
  });
});
