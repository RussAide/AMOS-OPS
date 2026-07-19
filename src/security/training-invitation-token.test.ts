import { describe, expect, it, vi } from "vitest";
import { captureTrainingInvitationToken } from "./training-invitation-token";

describe("Training invitation token capture", () => {
  it("captures the fragment secret and immediately strips the browser location", () => {
    const replaceLocation = vi.fn();

    expect(
      captureTrainingInvitationToken(
        { hash: "#invite=one-time%2Bsecret", pathname: "/login" },
        replaceLocation,
      ),
    ).toBe("one-time+secret");
    expect(replaceLocation).toHaveBeenCalledOnce();
    expect(replaceLocation).toHaveBeenCalledWith("/login");
  });

  it("does not accept or rewrite a server-facing query token", () => {
    const replaceLocation = vi.fn();

    expect(
      captureTrainingInvitationToken(
        { hash: "", pathname: "/login?invite=prohibited" },
        replaceLocation,
      ),
    ).toBeNull();
    expect(replaceLocation).not.toHaveBeenCalled();
  });
});
