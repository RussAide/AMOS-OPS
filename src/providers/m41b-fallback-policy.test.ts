import { describe, expect, it } from "vitest";
import {
  isAuthoritativeM41bRequest,
  mayUseAmosEvaluationFallback,
} from "./trpc";

describe("M4.1B authoritative interaction boundary", () => {
  it("never replaces governed workplan, guidance, disposition, task, evidence, or audit responses", () => {
    for (const procedure of [
      "m41b.getMyWorkplan",
      "m41b.getCadenceBrief",
      "m41b.askAmos",
      "m41b.recordHumanDisposition",
      "m41b.addCompletionEvidence",
      "m41b.completeTask",
      "m41b.escalateTask",
      "m41b.getAuditLineage",
      "m41b.resetEvaluation",
    ]) {
      const path = `/api/trpc/${procedure}`;
      expect(isAuthoritativeM41bRequest(path)).toBe(true);
      expect(mayUseAmosEvaluationFallback(path, "unavailable")).toBe(false);
      expect(mayUseAmosEvaluationFallback(path, "api-error")).toBe(false);
      expect(mayUseAmosEvaluationFallback(path, "empty")).toBe(false);
    }
  });

  it("does not classify unrelated procedures as M4.1B authority", () => {
    expect(isAuthoritativeM41bRequest("/api/trpc/m41a.featureCatalog")).toBe(
      false,
    );
  });
});
