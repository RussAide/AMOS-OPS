import {
  assertSyntheticScenarioRuntime,
  env,
  type EnvironmentConfig,
} from "../../lib/env";
import { sqlite } from "../../queries/connection";
import {
  assertM41bRuntimeActive,
  assertM41bRuntimeResetAllowed,
  type M41bRuntimeControlContext,
} from "../m41b/runtime-control";
import type { M41cRuntimeDatabase } from "./runtime-schema";

export interface M41cRuntimeControlContext {
  environment: EnvironmentConfig;
  asOf?: string;
}

const contexts = new WeakMap<object, M41cRuntimeControlContext>();

function contextFor(
  db: M41cRuntimeDatabase,
  supplied?: M41cRuntimeControlContext,
): M41cRuntimeControlContext {
  return supplied ?? contexts.get(db as object) ?? { environment: env };
}

function prepare(
  db: M41cRuntimeDatabase,
  context: M41cRuntimeControlContext,
): M41bRuntimeControlContext {
  assertSyntheticScenarioRuntime(context.environment);
  contexts.set(db as object, context);
  return { environment: context.environment, asOf: context.asOf };
}

export function assertM41cRuntimeActive(
  db: M41cRuntimeDatabase = sqlite,
  supplied?: M41cRuntimeControlContext,
) {
  const context = contextFor(db, supplied);
  return assertM41bRuntimeActive(db, prepare(db, context));
}

export function assertM41cRuntimeResetAllowed(
  db: M41cRuntimeDatabase = sqlite,
  supplied?: M41cRuntimeControlContext,
) {
  const context = contextFor(db, supplied);
  return assertM41bRuntimeResetAllowed(db, prepare(db, context));
}
