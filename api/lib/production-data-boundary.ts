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

/**
 * Production-safe governance reads exposed by an otherwise synthetic-only
 * namespace. These procedures return authority/control metadata and the
 * authenticated user's governed workplan; they do not execute scenarios,
 * generate clinical guidance, or write records.
 */
export const PRODUCTION_GOVERNANCE_READ_TRPC_PROCEDURES = Object.freeze([
  "m41c.getExperienceSnapshot",
  "m41c.getMyClinicalWorkplan",
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
  return trpcProceduresFromPath(pathname).filter((procedure) => {
    if (
      PRODUCTION_GOVERNANCE_READ_TRPC_PROCEDURES.some(
        (allowedProcedure) => procedure === allowedProcedure,
      )
    ) {
      return false;
    }

    return PRODUCTION_SYNTHETIC_ONLY_TRPC_NAMESPACES.some(
      (namespace) =>
        procedure === namespace || procedure.startsWith(`${namespace}.`),
    );
  });
}
