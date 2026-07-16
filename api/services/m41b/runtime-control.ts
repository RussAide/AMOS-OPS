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
import type { M41bRuntimeDatabase } from "./runtime-schema";

export interface M41bRuntimeControlContext {
  environment: EnvironmentConfig;
  asOf?: string;
}

const contexts = new WeakMap<object, M41bRuntimeControlContext>();

function contextFor(db: M41bRuntimeDatabase, supplied?: M41bRuntimeControlContext): M41bRuntimeControlContext {
  return supplied ?? contexts.get(db as object) ?? { environment: env };
}

function prepare(db: M41bRuntimeDatabase, context: M41bRuntimeControlContext): void {
  assertSyntheticScenarioRuntime(context.environment);
  contexts.set(db as object, context);
}

export function assertM41bRuntimeActive(
  db: M41bRuntimeDatabase = sqlite,
  supplied?: M41bRuntimeControlContext,
): Phase3DemoControlState {
  const context = contextFor(db, supplied);
  prepare(db, context);
  return assertPhase3DemoControlActive(db, context.asOf ?? new Date().toISOString());
}

export function assertM41bRuntimeResetAllowed(
  db: M41bRuntimeDatabase = sqlite,
  supplied?: M41bRuntimeControlContext,
): Phase3DemoControlState {
  const context = contextFor(db, supplied);
  prepare(db, context);
  return assertPhase3DemoResetAllowed(db, context.asOf ?? new Date().toISOString());
}
