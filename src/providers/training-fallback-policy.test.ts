import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeConfig } from "@/config/runtime";
import { mayUseAmosEvaluationFallback } from "./trpc";

const originalEvaluationMode = runtimeConfig.evaluationMode;

describe("Training fallback policy", () => {
  beforeEach(() => {
    runtimeConfig.evaluationMode = false;
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => entries.clear(),
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => entries.delete(key),
      setItem: (key: string, value: string) => entries.set(key, value),
    });
  });

  afterEach(() => {
    runtimeConfig.evaluationMode = originalEvaluationMode;
    vi.unstubAllGlobals();
  });

  it("fails closed on service unavailability and API errors", () => {
    localStorage.setItem("amos-workspace", "training");

    expect(
      mayUseAmosEvaluationFallback("training.listModules", "unavailable"),
    ).toBe(false);
    expect(
      mayUseAmosEvaluationFallback("training.listModules", "api-error"),
    ).toBe(false);
  });

  it("does not enable even an empty fallback from browser-local Training state", () => {
    localStorage.setItem("amos-workspace", "training");

    expect(mayUseAmosEvaluationFallback("training.listModules", "empty")).toBe(
      false,
    );
    expect(mayUseAmosEvaluationFallback("phase3.runDemo", "empty")).toBe(false);
  });

  it("does not enable fallback from an operational workspace", () => {
    localStorage.setItem("amos-workspace", "operational");

    expect(mayUseAmosEvaluationFallback("training.listModules", "empty")).toBe(
      false,
    );
  });
});
