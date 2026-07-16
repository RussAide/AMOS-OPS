import { z } from "zod";
import { createRouter, publicQuery, roleQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { Phase3ControlStore } from "../services/phase3/control-store";
import {
  evaluatePhase3Component,
  runPhase3IntegratedScenario,
} from "../services/phase3/integrated-scenario";
import {
  assertPhase3DemoControlActive,
  assertPhase3DemoResetAllowed,
  getPhase3DemoControlState,
  recordPhase3AccessReview,
  recordPhase3DemoAction,
  resetPhase3ControlScenario,
  setPhase3KillSwitch,
} from "../services/phase3/runtime-schema";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";
import {
  PHASE3_CRITERIA,
  PHASE3_DEMO_CONTROL_ROLES,
} from "@contracts/phase3/shared";
import type { UserRole } from "@/constants/roles";

const DEMO_CONTROL_ROLES = [...PHASE3_DEMO_CONTROL_ROLES];

function store() {
  return new Phase3ControlStore(sqlite);
}

function assertEvaluationRuntime(): void {
  assertSyntheticScenarioRuntime(env);
}

function requestTime(): string {
  return new Date().toISOString();
}

function safeControlStatus() {
  const control = getPhase3DemoControlState(sqlite);
  return {
    id: control.id,
    environmentId: control.environmentId,
    environmentLabel: control.environmentLabel,
    dataStoreLabel: control.dataStoreLabel,
    killSwitchEnabled: control.killSwitchEnabled,
    productionWritesBlocked: control.productionWritesBlocked,
    dataExpiresAt: control.dataExpiresAt,
    accessReviewedAt: control.accessReviewedAt,
    accessReviewedBy: control.accessReviewedBy,
    lastResetAt: control.lastResetAt,
    updatedAt: control.updatedAt,
  };
}

export const phase3Router = createRouter({
  overview: publicQuery.query(() => {
    assertEvaluationRuntime();
    return store().overview();
  }),

  controlStatus: publicQuery.query(() => {
    assertEvaluationRuntime();
    return safeControlStatus();
  }),

  featureCatalog: publicQuery.query(() => {
    assertEvaluationRuntime();
    return runPhase3IntegratedScenario().dx1.featureScenarios;
  }),

  runDemo: roleQuery([...DEMO_CONTROL_ROLES]).mutation(({ ctx }) => {
    assertEvaluationRuntime();
    const occurredAt = requestTime();
    assertPhase3DemoControlActive(sqlite, occurredAt);
    const result = runPhase3IntegratedScenario();
    const controlStore = store();
    controlStore.persistIntegratedResult(result);
    recordPhase3DemoAction(
      "integrated_run",
      result.scenarioRun.id,
      ctx.user.id,
      ctx.user.role as UserRole,
      sqlite,
      occurredAt,
    );
    return { result, overview: controlStore.overview(result.supportCaseId) };
  }),

  evaluateComponent: roleQuery([...DEMO_CONTROL_ROLES])
    .input(z.object({ criterionId: z.enum(PHASE3_CRITERIA) }))
    .mutation(({ ctx, input }) => {
      assertEvaluationRuntime();
      const occurredAt = requestTime();
      assertPhase3DemoControlActive(sqlite, occurredAt);
      const evaluation = evaluatePhase3Component(input.criterionId);
      recordPhase3DemoAction(
        "component_evaluation",
        evaluation.feature.scenarioId,
        ctx.user.id,
        ctx.user.role as UserRole,
        sqlite,
        occurredAt,
      );
      return evaluation;
    }),

  resetDemo: roleQuery([...DEMO_CONTROL_ROLES])
    .input(
      z.object({
        confirmation: z.literal("RESET_PHASE3_SYNTHETIC_DATA"),
      }),
    )
    .mutation(({ ctx }) => {
      assertEvaluationRuntime();
      const occurredAt = requestTime();
      assertPhase3DemoResetAllowed(sqlite, occurredAt);
      resetPhase3ControlScenario(
        sqlite,
        ctx.user.id,
        ctx.user.role as UserRole,
        occurredAt,
      );
      return store().overview();
    }),

  setKillSwitch: roleQuery([...DEMO_CONTROL_ROLES])
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ ctx, input }) => {
      assertEvaluationRuntime();
      const occurredAt = requestTime();
      return setPhase3KillSwitch(
        input.enabled,
        ctx.user.id,
        ctx.user.role as UserRole,
        sqlite,
        occurredAt,
      );
    }),

  recordAccessReview: roleQuery([...DEMO_CONTROL_ROLES]).mutation(({ ctx }) => {
    assertEvaluationRuntime();
    const occurredAt = requestTime();
    return recordPhase3AccessReview(
      ctx.user.id,
      ctx.user.role as UserRole,
      sqlite,
      occurredAt,
    );
  }),
});
