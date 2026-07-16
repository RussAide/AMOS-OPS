import path from "path";

export interface SeedGuardOptions {
  scriptName: string;
  databasePath?: string;
  environment?: NodeJS.ProcessEnv;
}

/**
 * Destructive or bulk seed scripts are permitted only for an explicitly named
 * synthetic evaluation target. The guard runs before any table or row change.
 */
export function assertSyntheticSeedAllowed(options: SeedGuardOptions): void {
  const environment = options.environment ?? process.env;
  const databasePath = path.resolve(
    options.databasePath ?? environment.DATABASE_PATH ?? "amos-ops.db",
  );
  const isSyntheticMode = environment.AMOS_SEED_MODE === "synthetic";
  const isEvaluationMode =
    environment.APP_ENV === "demo" &&
    environment.AMOS_RUNTIME_MODE === "demo";
  const safeName = /(?:^|[._/-])(demo|eval|evaluation|synthetic|test)(?:[._/-]|$)/i.test(
    databasePath,
  );

  if (environment.NODE_ENV === "production") {
    throw new Error(`[SeedGuard] ${options.scriptName} cannot run in NODE_ENV=production`);
  }
  if (!isSyntheticMode || !isEvaluationMode) {
    throw new Error(
      `[SeedGuard] ${options.scriptName} requires AMOS_SEED_MODE=synthetic with APP_ENV=demo and AMOS_RUNTIME_MODE=demo`,
    );
  }
  if (!safeName) {
    throw new Error(
      `[SeedGuard] Refusing non-evaluation database target: ${databasePath}`,
    );
  }
}
