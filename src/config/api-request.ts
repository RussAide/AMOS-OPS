import {
  apiEndpoint,
  EVALUATION_SESSION_TOKEN,
  runtimeConfig,
} from "./runtime";

type IdentityStorage = Pick<Storage, "getItem">;

export type ApiFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function browserStorage(): IdentityStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function identityRequestHeaders(
  storage: IdentityStorage | null = browserStorage(),
): Record<string, string> {
  const token = storage?.getItem("amos_token");
  if (!token) return {};

  const role = storage?.getItem("amos-role") ?? "rcs-day";
  const workspace =
    storage?.getItem("amos-workspace") === "training"
      ? "training"
      : "operational";

  return {
    Authorization: `Bearer ${token}`,
    "X-AMOS-Workspace": workspace,
    ...(token === EVALUATION_SESSION_TOKEN && runtimeConfig.evaluationMode
      ? { "X-AMOS-Evaluation-Role": role }
      : {}),
  };
}

export function authenticatedApiFetch(
  path: string,
  init: RequestInit = {},
  options: {
    fetcher?: ApiFetcher;
    storage?: IdentityStorage | null;
  } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(
    identityRequestHeaders(options.storage),
  )) {
    headers.set(name, value);
  }

  return (options.fetcher ?? fetch)(apiEndpoint(path), {
    ...init,
    headers,
  });
}
