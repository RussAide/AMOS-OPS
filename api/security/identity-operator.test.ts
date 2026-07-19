import { describe, expect, it } from "vitest";
import { operatorSignature, verifyOperatorRequest } from "./identity-operator";

describe("protected identity operator request", () => {
  const timestamp = "2026-07-19T17:00:00.000Z";
  const input = {
    secret: `operator-test-${"s".repeat(48)}`,
    timestamp,
    operationId: "operation-123",
    method: "POST",
    path: "/api/operator/identity/recovery",
    body: '{"operationId":"operation-123"}',
  };

  it("accepts only the exact signed request inside the replay window", () => {
    const signature = operatorSignature(input);
    expect(verifyOperatorRequest({ ...input, signature, now: new Date(timestamp) })).toBe(true);
    expect(verifyOperatorRequest({ ...input, signature, body: "{}", now: new Date(timestamp) })).toBe(false);
    expect(verifyOperatorRequest({ ...input, signature, operationId: "replayed", now: new Date(timestamp) })).toBe(false);
    expect(verifyOperatorRequest({ ...input, signature, now: new Date("2026-07-19T17:06:00.000Z") })).toBe(false);
  });
});
