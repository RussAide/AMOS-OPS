export interface ControlledEnvironmentFlags {
  isStaging: boolean;
  isProduction: boolean;
}

/**
 * Staging and production must never serve application routes after database
 * initialization fails. Development and demo may start in degraded mode so a
 * fictional evaluation build can expose diagnostics through readiness.
 */
export function enforceDatabaseStartupPolicy(
  environment: ControlledEnvironmentFlags,
  initializationError: unknown,
): void {
  if (!environment.isStaging && !environment.isProduction) return;
  throw new Error("Controlled environment startup stopped: database initialization failed", {
    cause: initializationError,
  });
}
