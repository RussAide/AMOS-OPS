import {
  assertSyntheticScenarioRuntime,
  env,
  type EnvironmentConfig,
} from "../../lib/env";
import { sqlite } from "../../queries/connection";
import {
  assertPhase3DemoControlActive,
  assertPhase3DemoResetAllowed,
  type Phase3DemoControlState,
} from "../phase3/runtime-schema";
import type { M41aRuntimeDatabase } from "./runtime-schema";

export interface M41aRuntimeControlContext {
  environment: EnvironmentConfig;
  asOf?: string;
}

const contexts = new WeakMap<object, M41aRuntimeControlContext>();

function databaseKey(db: M41aRuntimeDatabase): object {
  return db as object;
}

function contextFor(
  db: M41aRuntimeDatabase,
  supplied?: M41aRuntimeControlContext,
): M41aRuntimeControlContext {
  return supplied ?? contexts.get(databaseKey(db)) ?? { environment: env };
}

function asOf(context: M41aRuntimeControlContext): string {
  return context.asOf ?? new Date().toISOString();
}

function prepareControlledDatabase(
  db: M41aRuntimeDatabase,
  context: M41aRuntimeControlContext,
): void {
  assertSyntheticScenarioRuntime(context.environment);
  contexts.set(databaseKey(db), context);
}

export function assertM41aRuntimeActive(
  db: M41aRuntimeDatabase = sqlite,
  supplied?: M41aRuntimeControlContext,
): Phase3DemoControlState {
  const context = contextFor(db, supplied);
  prepareControlledDatabase(db, context);
  return assertPhase3DemoControlActive(db, asOf(context));
}

export function assertM41aRuntimeResetAllowed(
  db: M41aRuntimeDatabase = sqlite,
  supplied?: M41aRuntimeControlContext,
): Phase3DemoControlState {
  const context = contextFor(db, supplied);
  prepareControlledDatabase(db, context);
  return assertPhase3DemoResetAllowed(db, asOf(context));
}
