export const M52_SERVICE_WORKER_URL = "/m52-offline-service-worker.js";
export const M52_SERVICE_WORKER_SCOPE = "/operations-hub/";

export type M52OfflineShellRegistration = Readonly<
  | {
      status: "registered";
      serviceWorkerUrl: typeof M52_SERVICE_WORKER_URL;
      scope: typeof M52_SERVICE_WORKER_SCOPE;
    }
  | {
      status: "unsupported";
      serviceWorkerUrl: typeof M52_SERVICE_WORKER_URL;
    }
  | {
      status: "failed";
      serviceWorkerUrl: typeof M52_SERVICE_WORKER_URL;
      errorCode: "M52_OFFLINE_SHELL_REGISTRATION_FAILED";
    }
>;

export interface M52ServiceWorkerRegistry {
  register(
    scriptUrl: string,
    options: { scope: string },
  ): Promise<unknown>;
}

export async function registerM52OfflineShell(
  registry?: M52ServiceWorkerRegistry,
): Promise<M52OfflineShellRegistration> {
  if (!registry) {
    return Object.freeze({
      status: "unsupported",
      serviceWorkerUrl: M52_SERVICE_WORKER_URL,
    });
  }
  try {
    await registry.register(M52_SERVICE_WORKER_URL, {
      scope: M52_SERVICE_WORKER_SCOPE,
    });
    return Object.freeze({
      status: "registered",
      serviceWorkerUrl: M52_SERVICE_WORKER_URL,
      scope: M52_SERVICE_WORKER_SCOPE,
    });
  } catch {
    return Object.freeze({
      status: "failed",
      serviceWorkerUrl: M52_SERVICE_WORKER_URL,
      errorCode: "M52_OFFLINE_SHELL_REGISTRATION_FAILED",
    });
  }
}
