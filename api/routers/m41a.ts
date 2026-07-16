import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  M41A_AUTHORIZED_ROLES,
  M41A_ENTERPRISE_CONTROL_ROLES,
  M41A_SCOPE_IDS,
  authorizedM41aScopes,
  type M41aDecisionDisposition,
  type M41aScopeId,
} from "@contracts/m41a";
import type { UserRole } from "@/constants/roles";
import { createRouter, roleQuery } from "../middleware";
import {
  M41A_FEATURE_CATALOG,
  acknowledgeM41aAlert,
  addM41aFollowUpEvidence,
  assignM41aAlert,
  evaluateM41aControlledComponent,
  getM41aDashboard,
  getM41aDrilldown,
  initializeM41aRuntime,
  listM41aAlerts,
  recordM41aDecision,
  resetM41aEvaluation,
  resolveM41aAlert,
  runM41aControlledScenario,
} from "../services/m41a";

const scopeSchema = z.enum(M41A_SCOPE_IDS);
const drillDepthSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const dispositionSchema = z.enum([
  "approve_action",
  "modify_action",
  "defer",
  "reject",
  "delegate",
]);
const criterionSchema = z.enum([
  "M4.1A-01",
  "M4.1A-02",
  "M4.1A-03",
  "M4.1A-04",
  "M4.1A-05",
  "M4.1A-06",
  "M4.1A-07",
  "M4.1A-08",
]);

function roleOf(user: { role: string }): UserRole {
  return user.role as UserRole;
}

function mapM41aError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("ACCESS_DENIED") ||
    message.includes("T4_ACCESS_DENIED") ||
    message.includes("DRILL_DEPTH_DENIED")
  )
    throw new TRPCError({ code: "FORBIDDEN", message });
  if (
    message.includes("Synthetic milestone scenarios require") ||
    message.startsWith("PHASE3_")
  )
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  if (
    message.includes("UNKNOWN_") ||
    message.includes("INVALID_") ||
    message.includes("REQUIRES_") ||
    message.includes("SEQUENCE") ||
    message.includes("EVIDENCE_REQUIRED")
  )
    throw new TRPCError({ code: "BAD_REQUEST", message });
  throw error;
}

function executeM41a<T>(operation: () => T): T {
  try {
    initializeM41aRuntime();
    return operation();
  } catch (error) {
    return mapM41aError(error);
  }
}

function alertArray(value: unknown): readonly { id: string; scope?: string }[] {
  if (Array.isArray(value)) return value as readonly { id: string; scope?: string }[];
  if (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as { alerts?: unknown }).alerts)
  )
    return (value as { alerts: readonly { id: string; scope?: string }[] }).alerts;
  return [];
}

function scopeForAlert(role: UserRole, alertId: string): M41aScopeId {
  for (const scope of authorizedM41aScopes(role)) {
    const alerts = alertArray(listM41aAlerts(role, scope));
    if (alerts.some((alert) => alert.id === alertId)) return scope;
  }
  throw new Error(`M41A_UNKNOWN_OR_UNAUTHORIZED_ALERT:${alertId}`);
}

function actor(user: { id: string; role: string }) {
  return { actorId: user.id, role: roleOf(user) };
}

export const m41aRouter = createRouter({
  featureCatalog: roleQuery([...M41A_AUTHORIZED_ROLES]).query(
    () => M41A_FEATURE_CATALOG,
  ),

  runDemo: roleQuery([...M41A_ENTERPRISE_CONTROL_ROLES]).mutation(({ ctx }) =>
    executeM41a(() => runM41aControlledScenario(roleOf(ctx.user))),
  ),

  evaluateComponent: roleQuery([...M41A_ENTERPRISE_CONTROL_ROLES])
    .input(z.object({ criterionId: criterionSchema }))
    .query(({ ctx, input }) =>
      executeM41a(() =>
        evaluateM41aControlledComponent(
          roleOf(ctx.user),
          input.criterionId,
        ),
      ),
    ),

  getDashboard: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(z.object({ scope: scopeSchema }))
    .query(({ ctx, input }) =>
      executeM41a(() => getM41aDashboard(roleOf(ctx.user), input.scope)),
    ),

  getDrilldown: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(
      z.object({
        scope: scopeSchema,
        metricId: z.string().min(1),
        depth: drillDepthSchema,
        parentId: z.string().min(1).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      executeM41a(() =>
        getM41aDrilldown(
          roleOf(ctx.user),
          input.scope,
          input.metricId,
          input.depth,
          input.parentId,
        ),
      ),
    ),

  listAlerts: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(z.object({ scope: scopeSchema }))
    .query(({ ctx, input }) =>
      executeM41a(() => listM41aAlerts(roleOf(ctx.user), input.scope)),
    ),

  acknowledgeAlert: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(z.object({ alertId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      executeM41a(() => {
        const identity = actor(ctx.user);
        return acknowledgeM41aAlert({
          ...identity,
          scope: scopeForAlert(identity.role, input.alertId),
          alertId: input.alertId,
        });
      }),
    ),

  assignAlert: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(
      z.object({ alertId: z.string().min(1), assigneeId: z.string().min(1) }),
    )
    .mutation(({ ctx, input }) =>
      executeM41a(() => {
        const identity = actor(ctx.user);
        return assignM41aAlert({
          ...identity,
          scope: scopeForAlert(identity.role, input.alertId),
          alertId: input.alertId,
          assignedTo: input.assigneeId,
        });
      }),
    ),

  recordDecision: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(
      z.object({
        alertId: z.string().min(1),
        disposition: dispositionSchema,
        rationale: z.string().trim().min(8).max(2_000),
      }),
    )
    .mutation(({ ctx, input }) =>
      executeM41a(() => {
        const identity = actor(ctx.user);
        return recordM41aDecision({
          ...identity,
          scope: scopeForAlert(identity.role, input.alertId),
          alertId: input.alertId,
          disposition: input.disposition as M41aDecisionDisposition,
          rationale: input.rationale,
        });
      }),
    ),

  addFollowUpEvidence: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(
      z.object({
        alertId: z.string().min(1),
        evidenceRef: z.string().trim().min(3).max(500),
        summary: z.string().trim().min(8).max(2_000),
      }),
    )
    .mutation(({ ctx, input }) =>
      executeM41a(() => {
        const identity = actor(ctx.user);
        return addM41aFollowUpEvidence({
          ...identity,
          scope: scopeForAlert(identity.role, input.alertId),
          alertId: input.alertId,
          evidenceRef: input.evidenceRef,
          summary: input.summary,
        });
      }),
    ),

  resolveAlert: roleQuery([...M41A_AUTHORIZED_ROLES])
    .input(z.object({ alertId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      executeM41a(() => {
        const identity = actor(ctx.user);
        return resolveM41aAlert({
          ...identity,
          scope: scopeForAlert(identity.role, input.alertId),
          alertId: input.alertId,
        });
      }),
    ),

  resetEvaluation: roleQuery([...M41A_AUTHORIZED_ROLES]).mutation(({ ctx }) => {
    try {
      return resetM41aEvaluation(actor(ctx.user));
    } catch (error) {
      return mapM41aError(error);
    }
  }),
});
