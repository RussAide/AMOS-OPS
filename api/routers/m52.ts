import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isUserRole, type UserRole } from "@/constants/roles";
import { M52_INTEGRATED_SCENARIO_ID } from "@contracts/m52/integrated-scenario";
import { createRouter, roleQuery } from "../middleware";
import {
  M51A_AUTHORIZED_ROLES,
  M51A_REVIEWER_ROLES,
} from "../services/m51a";
import { runM52IntegratedScenario } from "../services/m52";

export const m52ScenarioInputSchema = z
  .object({
    scenarioId: z.literal(M52_INTEGRATED_SCENARIO_ID),
  })
  .strict();

export interface M52ServerIdentity {
  readonly actorId: string;
  readonly role: UserRole;
}

/** Client payloads never supply the acting identity or authorization scope. */
export function deriveM52ServerIdentity(user: {
  readonly id: string;
  readonly role: string;
}): Readonly<M52ServerIdentity> {
  if (!user.id.trim()) throw new Error("M52_SERVER_ACTOR_ID_REQUIRED");
  if (!isUserRole(user.role) || !M51A_AUTHORIZED_ROLES.includes(user.role))
    throw new Error("M52_SERVER_ROLE_NOT_AUTHORIZED");
  return Object.freeze({ actorId: user.id, role: user.role });
}

function mapM52Error(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("ACCESS_DENIED") ||
    message.includes("ROLE_NOT_AUTHORIZED") ||
    message.includes("PERMISSION")
  )
    throw new TRPCError({ code: "FORBIDDEN", message });
  if (message.includes("NOT_FOUND"))
    throw new TRPCError({ code: "NOT_FOUND", message });
  if (
    message.startsWith("M52_") ||
    message.includes("REQUIRED") ||
    message.includes("INVALID") ||
    message.includes("DENIED") ||
    message.includes("MISMATCH")
  )
    throw new TRPCError({ code: "BAD_REQUEST", message });
  throw error;
}

async function executeM52<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return mapM52Error(error);
  }
}

async function buildM52Presentation(identity: Readonly<M52ServerIdentity>) {
  const result = await runM52IntegratedScenario();
  return Object.freeze({
    ...result,
    viewer: Object.freeze({
      role: identity.role,
      serverDerivedIdentity: true as const,
      canRunIntegratedEvaluation: M51A_REVIEWER_ROLES.includes(identity.role),
    }),
  });
}

export const m52Router = createRouter({
  getExperienceSnapshot: roleQuery([...M51A_AUTHORIZED_ROLES]).query(
    async ({ ctx }) => {
      const identity = deriveM52ServerIdentity(ctx.user);
      return executeM52(() => buildM52Presentation(identity));
    },
  ),

  getAcceptanceStatus: roleQuery([...M51A_AUTHORIZED_ROLES]).query(
    async ({ ctx }) => {
      const identity = deriveM52ServerIdentity(ctx.user);
      return executeM52(() => buildM52Presentation(identity));
    },
  ),

  runIntegratedScenario: roleQuery([...M51A_REVIEWER_ROLES])
    .input(m52ScenarioInputSchema)
    .mutation(async ({ ctx }) => {
      const identity = deriveM52ServerIdentity(ctx.user);
      return executeM52(() => buildM52Presentation(identity));
    }),
});
