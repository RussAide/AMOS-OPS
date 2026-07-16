import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  M41B_AUTHORIZED_ROLES,
  M41B_CADENCES,
  M41B_ENTERPRISE_CONTROL_ROLES,
  M41B_GUIDANCE_INTENTS,
  M41B_MATERIAL_DOMAINS,
  type M41bHumanDecision,
} from "@contracts/m41b";
import type { UserRole } from "@/constants/roles";
import { createRouter, roleQuery } from "../middleware";
import {
  addM41bCompletionEvidence,
  askM41b,
  completeM41bTask,
  escalateM41bTask,
  getM41bAuditLineage,
  getM41bCadenceBrief,
  getM41bWorkplan,
  initializeM41bRuntime,
  recordM41bHumanDisposition,
  resetM41bEvaluation,
} from "../services/m41b";

const cadenceSchema = z.enum(M41B_CADENCES);
const intentSchema = z.enum(M41B_GUIDANCE_INTENTS);
const domainSchema = z.enum(M41B_MATERIAL_DOMAINS);
const divisionSchema = z.enum(["eo", "gad", "bhc", "gro"]);
const dispositionSchema = z.enum(["approve", "modify", "reject", "override"]);
const syntheticIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(240)
  .regex(/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i, "Synthetic evaluation ID required.");

function roleOf(user: { role: string }): UserRole {
  return user.role as UserRole;
}

function mapM41bError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("ACCESS_DENIED") ||
    message.includes("CROSS_DIVISION") ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("RESET_ACCESS_DENIED") ||
    message.includes("TASK_ACCESS_DENIED") ||
    message.includes("HUMAN_APPROVAL_ACCESS_DENIED")
  )
    throw new TRPCError({ code: "FORBIDDEN", message });
  if (message.includes("NOT_FOUND") || message.includes("NOT_INITIALIZED"))
    throw new TRPCError({ code: "NOT_FOUND", message });
  if (
    message.startsWith("PHASE3_") ||
    message.includes("Synthetic milestone scenarios require")
  )
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  if (
    message.startsWith("M41B_") ||
    message.includes("REQUIRED") ||
    message.includes("DENIED") ||
    message.includes("MISMATCH") ||
    message.includes("TERMINAL")
  )
    throw new TRPCError({ code: "BAD_REQUEST", message });
  throw error;
}

function executeM41b<T>(operation: () => T): T {
  try {
    initializeM41bRuntime();
    return operation();
  } catch (error) {
    return mapM41bError(error);
  }
}

function actor(user: { id: string; role: string }) {
  return { actorId: user.id, role: roleOf(user) };
}

export const m41bRouter = createRouter({
  getMyWorkplan: roleQuery([...M41B_AUTHORIZED_ROLES]).query(({ ctx }) =>
    executeM41b(() => getM41bWorkplan(roleOf(ctx.user))),
  ),

  getCadenceBrief: roleQuery([...M41B_AUTHORIZED_ROLES])
    .input(z.object({ cadence: cadenceSchema }))
    .query(({ ctx, input }) =>
      executeM41b(() => getM41bCadenceBrief(roleOf(ctx.user), input.cadence)),
    ),

  askAmos: roleQuery([...M41B_AUTHORIZED_ROLES])
    .input(
      z.object({
        requestId: syntheticIdSchema,
        prompt: z.string().trim().min(4).max(2_000),
        intent: intentSchema,
        sourceIds: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
        workplanItemId: z.string().trim().min(1).max(500).optional(),
        requestedDivision: divisionSchema.optional(),
        requestedDomain: domainSchema.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      executeM41b(() => askM41b({ ...actor(ctx.user), ...input })),
    ),

  recordHumanDisposition: roleQuery([...M41B_AUTHORIZED_ROLES])
    .input(
      z.object({
        recommendationId: z.string().trim().min(1).max(500),
        disposition: dispositionSchema,
        rationale: z.string().trim().min(8).max(2_000),
        overrideReason: z.string().trim().min(8).max(2_000).nullable().optional(),
        modifiedSummary: z
          .string()
          .trim()
          .min(8)
          .max(2_000)
          .nullable()
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      executeM41b(() =>
        recordM41bHumanDisposition({
          ...actor(ctx.user),
          ...input,
          disposition: input.disposition as M41bHumanDecision["disposition"],
        }),
      ),
    ),

  addCompletionEvidence: roleQuery([...M41B_AUTHORIZED_ROLES])
    .input(
      z.object({
        taskId: z.string().trim().min(1).max(500),
        evidenceRef: syntheticIdSchema,
        summary: z.string().trim().min(8).max(2_000),
      }),
    )
    .mutation(({ ctx, input }) =>
      executeM41b(() =>
        addM41bCompletionEvidence({ ...actor(ctx.user), ...input }),
      ),
    ),

  completeTask: roleQuery([...M41B_AUTHORIZED_ROLES])
    .input(z.object({ taskId: z.string().trim().min(1).max(500) }))
    .mutation(({ ctx, input }) =>
      executeM41b(() => completeM41bTask({ ...actor(ctx.user), ...input })),
    ),

  escalateTask: roleQuery([...M41B_AUTHORIZED_ROLES])
    .input(z.object({ taskId: z.string().trim().min(1).max(500) }))
    .mutation(({ ctx, input }) =>
      executeM41b(() => escalateM41bTask({ ...actor(ctx.user), ...input })),
    ),

  getAuditLineage: roleQuery([...M41B_AUTHORIZED_ROLES]).query(({ ctx }) =>
    executeM41b(() => getM41bAuditLineage(roleOf(ctx.user))),
  ),

  resetEvaluation: roleQuery([...M41B_ENTERPRISE_CONTROL_ROLES]).mutation(
    ({ ctx }) => {
      try {
        return resetM41bEvaluation(roleOf(ctx.user));
      } catch (error) {
        return mapM41bError(error);
      }
    },
  ),
});
