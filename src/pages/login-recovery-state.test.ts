import { describe, expect, it } from "vitest";
import {
  recoveryPasswordsMatch,
  retainAcceptedRecoveryPassword,
} from "./login-recovery-state";

describe("retainAcceptedRecoveryPassword", () => {
  it("retains the exact accepted password when recovery also enrolls TOTP", () => {
    const result = retainAcceptedRecoveryPassword(
      {
        email: "",
        password: "stale-browser-password",
        firstName: "Synthetic",
      },
      "Accepted!Recovery2026",
      "synthetic.owner@example.invalid",
    );

    expect(result).toEqual({
      email: "synthetic.owner@example.invalid",
      password: "Accepted!Recovery2026",
      firstName: "Synthetic",
    });
  });

  it("retains the exact accepted password when no TOTP setup is returned", () => {
    expect(
      retainAcceptedRecoveryPassword(
        { email: "synthetic.team@example.invalid", password: "old" },
        "Accepted!Team2026",
      ),
    ).toEqual({
      email: "synthetic.team@example.invalid",
      password: "Accepted!Team2026",
    });
  });

  it("requires exact non-empty recovery password confirmation", () => {
    expect(recoveryPasswordsMatch("Accepted!Team2026", "Accepted!Team2026")).toBe(
      true,
    );
    expect(recoveryPasswordsMatch("Accepted!Team2026", "accepted!Team2026")).toBe(
      false,
    );
    expect(recoveryPasswordsMatch("", "")).toBe(false);
  });
});
