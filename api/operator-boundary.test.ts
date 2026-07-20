import { describe, expect, it } from "vitest";
import { isReadOnlyOperatorDiagnosisRequest } from "./operator-boundary";

describe("protected operator request boundary", () => {
  it.each([
    "/api/operator/identity/diagnosis",
    "/api/operator/operational-alerts/diagnosis",
  ])("classifies signed GET diagnosis %s as end-to-end read-only", (path) => {
    expect(isReadOnlyOperatorDiagnosisRequest("GET", path)).toBe(true);
  });

  it("never classifies a mutation or unrelated health request as read-only diagnosis", () => {
    expect(
      isReadOnlyOperatorDiagnosisRequest(
        "POST",
        "/api/operator/operational-alerts/reconciliation",
      ),
    ).toBe(false);
    expect(
      isReadOnlyOperatorDiagnosisRequest(
        "POST",
        "/api/operator/identity/recovery",
      ),
    ).toBe(false);
    expect(isReadOnlyOperatorDiagnosisRequest("GET", "/api/health")).toBe(
      false,
    );
  });
});
