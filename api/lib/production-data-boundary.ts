export const PRODUCTION_SYNTHETIC_ONLY_TRPC_NAMESPACES = Object.freeze([
  "phase2",
  "m41c",
  "m42",
  "m51a",
  "m51b",
  "m52",
  "dx1",
  "regulatoryFramework",
] as const);

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function trpcProceduresFromPath(pathname: string): string[] {
  const marker = "/api/trpc/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return [];
  const procedurePath = decodePath(
    pathname.slice(markerIndex + marker.length).split("?", 1)[0],
  );
  return procedurePath
    .split(",")
    .map((procedure) => procedure.trim())
    .filter(Boolean);
}

export function blockedProductionSyntheticProcedures(
  pathname: string,
  isProduction: boolean,
): string[] {
  if (!isProduction) return [];
  return trpcProceduresFromPath(pathname).filter((procedure) =>
    PRODUCTION_SYNTHETIC_ONLY_TRPC_NAMESPACES.some(
      (namespace) =>
        procedure === namespace || procedure.startsWith(`${namespace}.`),
    ),
  );
}
