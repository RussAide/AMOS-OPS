import { describe, expect, it } from "vitest";
import {
  isAuthoritativeM41aRequest,
  mayUseAmosEvaluationFallback,
} from "./trpc";

describe("M4.1A authoritative query boundary", () => {
  it("never replaces governed dashboard, drill, alert, or evaluation responses", () => {
    for (const procedure of [
      "m41a.getDashboard",
      "m41a.getDrilldown",
      "m41a.listAlerts",
      "m41a.evaluateComponent",
      "m41a.runDemo",
    ]) {
      const path = `/api/trpc/${procedure}`;
      expect(isAuthoritativeM41aRequest(path)).toBe(true);
      expect(mayUseAmosEvaluationFallback(path, "unavailable")).toBe(false);
      expect(mayUseAmosEvaluationFallback(path, "api-error")).toBe(false);
      expect(mayUseAmosEvaluationFallback(path, "empty")).toBe(false);
    }
  });

  it("keeps only the value-free feature catalog eligible for preview policy", () => {
    expect(
      isAuthoritativeM41aRequest("/api/trpc/m41a.featureCatalog"),
    ).toBe(false);
  });
});
