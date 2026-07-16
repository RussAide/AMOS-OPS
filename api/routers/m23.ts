import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, authedQuery } from "../middleware";
import { clinicalBillingEvaluationSchema } from "./regulatory-schemas";
import {
  M23DomainError,
  M23ProgramEngine,
  runM23SyntheticSuite,
  type CreateM23GoalInput,
  type CreateM23InterventionInput,
  type CreateM23PlanInput,
  type DocumentM23SessionInput,
  type RecordM23NeedInput,
  type RegisterM23CaseInput,
} from "../services/mhrs";
import type { M23Actor, M23Role } from "../../contracts/mhrs/types";

const m23Roles = [
  "therapist",
  "mhrs-supervisor",
  "clinical-supervisor",
  "treatment-director",
  "bhc-director",
  "chart-auditor",
  "revenue-cycle-manager",
  "administrator",
  "managing-director",
  "super-admin",
] as const satisfies readonly M23Role[];

const m23RoleSet = new Set<string>(m23Roles);
const timestamp = z.string().datetime({ offset: true });
const id = z.string().min(1).max(240);
const detail = z.string().min(1).max(2_000);
const category = z.enum([
  "psychosocial_rehabilitation",
  "skills_training",
  "supportive_interventions",
  "community_integration",
]);
const serviceBasis = z.enum(["psychosocial_rehabilitation", "skills_training_and_development"]);
const planInput = z.object({
  effectiveFrom: z.iso.date(),
  effectiveThrough: z.iso.date(),
  typeAmountDurationStatement: detail,
});

function actorFromContext(user: { id: string; role: string; name: string; email: string }): M23Actor {
  if (!m23RoleSet.has(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This role is outside the governed MHRS workflow." });
  }
  return {
    id: user.id,
    role: user.role as M23Role,
    displayName: user.name || user.email,
  };
}

function translateM23Error(error: unknown): never {
  if (error instanceof M23DomainError) {
    const code = error.code === "M23_FORBIDDEN" ? "FORBIDDEN"
      : error.code.endsWith("NOT_FOUND") ? "NOT_FOUND"
      : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
  throw error;
}

function callM23<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    return translateM23Error(error);
  }
}

interface M23SyntheticState {
  engine: M23ProgramEngine;
  suite: ReturnType<typeof runM23SyntheticSuite>;
}

function createSyntheticState(): M23SyntheticState {
  const engine = new M23ProgramEngine();
  return { engine, suite: runM23SyntheticSuite(engine) };
}

let state: M23SyntheticState | undefined;

export function resetM23SyntheticState(): M23SyntheticState {
  state = createSyntheticState();
  return state;
}

export function getM23SyntheticState(): M23SyntheticState {
  return state ?? resetM23SyntheticState();
}

export const m23Router = createRouter({
  dashboard: authedQuery
    .input(z.object({ asOf: timestamp }))
    .query(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.getDashboard(actorFromContext(ctx.user), input.asOf))),

  caseDetail: authedQuery
    .input(z.object({ caseId: id, asOf: timestamp }))
    .query(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.getCaseDetail(actorFromContext(ctx.user), input.caseId, input.asOf))),

  evidence: authedQuery
    .input(z.object({ asOf: timestamp }))
    .query(({ ctx, input }) => callM23(() => {
      const current = getM23SyntheticState();
      current.engine.getDashboard(actorFromContext(ctx.user), input.asOf);
      return { suite: current.suite, snapshot: current.engine.snapshot() };
    })),

  registerCase: authedQuery
    .input(z.object({
      at: timestamp,
      case: z.object({
        subjectId: id,
        subjectLabel: detail,
        ageYears: z.number().int().min(0).max(120),
        assignedSpecialistId: id,
        assignedSupervisorId: id,
        careBridge: z.object({
          ccmg: z.object({
            ownerDepartment: z.literal("CCMG"),
            accessMode: z.literal("read_only"),
            referralId: id,
            caseId: id,
            handoffId: id,
            status: z.literal("active"),
          }),
          cans: z.object({
            ownerDepartment: z.literal("CCMG"),
            accessMode: z.literal("read_only"),
            assessmentId: id,
            version: z.number().int().positive(),
            lineageId: id,
            targetRecordId: id,
            mappedGoalCodes: z.array(id).min(1).max(100),
          }),
          mhtcm: z.object({
            ownerDepartment: z.literal("MHTCM"),
            accessMode: z.literal("read_only"),
            planId: id,
            version: z.number().int().positive(),
            status: z.enum(["approved", "active"]),
            coordinationSummary: detail,
          }),
        }),
      }),
    }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.registerCase(
      actorFromContext(ctx.user), input.case as RegisterM23CaseInput, input.at,
    ))),

  recordNeed: authedQuery
    .input(z.object({
      at: timestamp,
      caseId: id,
      need: z.object({
        sourceDepartment: z.enum(["CCMG", "MHTCM", "MHRS"]),
        sourceType: z.enum(["CANS", "CCMG", "MHTCM", "MHRS"]),
        sourceRecordId: id,
        sourceVersion: z.number().int().positive(),
        code: id,
        statement: detail,
        baseline: z.number().finite(),
        target: z.number().finite(),
      }),
    }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.recordNeed(
      actorFromContext(ctx.user), input.caseId, input.need as RecordM23NeedInput, input.at,
    ))),

  createPlanVersion: authedQuery
    .input(z.object({ at: timestamp, caseId: id, plan: planInput }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.createPlanVersion(
      actorFromContext(ctx.user), input.caseId, input.plan as CreateM23PlanInput, input.at,
    ))),

  addGoal: authedQuery
    .input(z.object({
      at: timestamp,
      planVersionId: id,
      goal: z.object({
        needId: id,
        category,
        statement: detail,
        measure: detail,
        targetValue: z.number().finite(),
      }),
    }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.addGoal(
      actorFromContext(ctx.user), input.planVersionId, input.goal as CreateM23GoalInput, input.at,
    ))),

  addIntervention: authedQuery
    .input(z.object({
      at: timestamp,
      planVersionId: id,
      intervention: z.object({
        goalId: id,
        category,
        serviceBasis,
        description: detail,
        amount: detail,
        duration: detail,
        frequency: detail,
      }),
    }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.addIntervention(
      actorFromContext(ctx.user), input.planVersionId, input.intervention as CreateM23InterventionInput, input.at,
    ))),

  transitionPlan: authedQuery
    .input(z.object({ at: timestamp, planVersionId: id, toState: z.enum(["under_review", "approved", "superseded"]), reason: detail }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.transitionPlan(
      actorFromContext(ctx.user), input.planVersionId, input.toState, input.reason, input.at,
    ))),

  documentSession: authedQuery
    .input(z.object({
      at: timestamp,
      caseId: id,
      session: z.object({
        planVersionId: id,
        goalId: id,
        interventionId: id,
        billingInput: clinicalBillingEvaluationSchema,
        progressValue: z.number().finite(),
        progressNarrative: detail,
        barrier: detail,
        barrierResponse: detail,
        outcome: detail,
        measuredValue: z.number().finite(),
      }),
    }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.documentSession(
      actorFromContext(ctx.user), input.caseId, input.session as DocumentM23SessionInput, input.at,
    ))),

  signSession: authedQuery
    .input(z.object({ at: timestamp, sessionId: id, signature: detail }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.signSession(
      actorFromContext(ctx.user), input.sessionId, input.signature, input.at,
    ))),

  evaluateReviewAlerts: authedQuery
    .input(z.object({ asOf: timestamp }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.evaluateReviewAlerts(actorFromContext(ctx.user), input.asOf))),

  completeReview: authedQuery
    .input(z.object({ at: timestamp, alertId: id, plan: planInput }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.completeReview(
      actorFromContext(ctx.user), input.alertId, input.plan as CreateM23PlanInput, input.at,
    ))),

  requestClaimHandoff: authedQuery
    .input(z.object({ at: timestamp, sessionId: id }))
    .mutation(({ ctx, input }) => callM23(() => getM23SyntheticState().engine.requestClaimHandoff(
      actorFromContext(ctx.user), input.sessionId, input.at,
    ))),
});

