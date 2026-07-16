import { describe, expect, it, vi } from "vitest";
import {
  M52_SERVICE_WORKER_SCOPE,
  M52_SERVICE_WORKER_URL,
  registerM52OfflineShell,
  type M52ServiceWorkerRegistry,
} from "./m52-offline-shell";

describe("M5.2 offline shell registration", () => {
  it("registers the controlled offline shell only for the Operations Hub scope", async () => {
    const register = vi.fn().mockResolvedValue({ active: true });
    const result = await registerM52OfflineShell({
      register,
    } as M52ServiceWorkerRegistry);

    expect(register).toHaveBeenCalledWith(M52_SERVICE_WORKER_URL, {
      scope: M52_SERVICE_WORKER_SCOPE,
    });
    expect(result).toEqual({
      status: "registered",
      serviceWorkerUrl: M52_SERVICE_WORKER_URL,
      scope: M52_SERVICE_WORKER_SCOPE,
    });
  });

  it("reports unsupported clients without pretending offline readiness", async () => {
    await expect(registerM52OfflineShell()).resolves.toEqual({
      status: "unsupported",
      serviceWorkerUrl: M52_SERVICE_WORKER_URL,
    });
  });

  it("fails closed without throwing into application startup", async () => {
    const register = vi.fn().mockRejectedValue(new Error("synthetic failure"));
    await expect(
      registerM52OfflineShell({ register } as M52ServiceWorkerRegistry),
    ).resolves.toEqual({
      status: "failed",
      serviceWorkerUrl: M52_SERVICE_WORKER_URL,
      errorCode: "M52_OFFLINE_SHELL_REGISTRATION_FAILED",
    });
  });
});
