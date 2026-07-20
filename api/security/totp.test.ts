import { describe, expect, it } from "vitest";
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  matchTotpCounter,
  totpCodeForTest,
} from "./totp";

describe("TOTP security", () => {
  it("encrypts the secret at rest and accepts a current code only once", () => {
    const key = "test-encryption-key-material";
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret, key);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted, key)).toBe(secret);

    const now = new Date("2026-07-16T18:00:00.000Z");
    const code = totpCodeForTest(secret, now);
    const counter = matchTotpCounter(secret, code, now, null);
    expect(counter).not.toBeNull();
    expect(matchTotpCounter(secret, code, now, counter)).toBeNull();
  });

  it("builds a standards-based authenticator URI", () => {
    const uri = buildTotpUri(
      "JBSWY3DPEHPK3PXP",
      "original.admin@amos-ops.invalid",
    );
    expect(uri).toContain(
      "otpauth://totp/AMOS-OPS%3Aoriginal.admin%40amos-ops.invalid",
    );
    expect(uri).toContain("issuer=AMOS-OPS");
    expect(uri).toContain("digits=6&period=30");
  });
});
