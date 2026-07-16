import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { isUserRole, type UserRole } from "@/constants/roles";
import { M51A_INTRANET_DESTINATION_CODES } from "@contracts/m51a/operations-hub";
import { createRouter, roleQuery } from "../middleware";
import {
  M51A_AUTHORIZED_ROLES,
  M51A_INTEGRATED_SCENARIO_ID,
  M51A_REVIEWER_ROLES,
  buildM51AActorContext,
  createM51AExperienceSnapshot,
  createSyntheticM51aHubTopology,
  createSyntheticM51aIntranetMap,
  resolveM51aIntranetRoute,
  runM51AIntegratedScenario,
} from "../services/m51a";

export const m51aRouteInputSchema = z
  .object({
    routeCode: z.enum(M51A_INTRANET_DESTINATION_CODES),
  })
  .strict();

export const m51aScenarioInputSchema = z
  .object({
    scenarioId: z.literal(M51A_INTEGRATED_SCENARIO_ID),
  })
  .strict();

export interface M51AServerIdentity {
  actorId: string;
  role: UserRole;
}

/** The role and actor ID always come from authenticated server context. */
export function deriveM51AServerIdentity(user: {
  id: string;
  role: string;
}): M51AServerIdentity {
  if (!user.id.trim()) throw new Error("M51A_SERVER_ACTOR_ID_REQUIRED");
  if (!isUserRole(user.role) || !M51A_AUTHORIZED_ROLES.includes(user.role))
    throw new Error("M51A_SERVER_ROLE_NOT_AUTHORIZED");
  return Object.freeze({ actorId: user.id, role: user.role });
}

export function buildM51AActorFromServerIdentity(
  identity: M51AServerIdentity,
) {
  const token = createHash("sha256")
    .update(identity.actorId)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return buildM51AActorContext(
    identity.role,
    `SYNTH-M51A-SESSION-${token}`,
  );
}

function mapM51AError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("ACCESS_DENIED") ||
    message.includes("ROLE_NOT_AUTHORIZED") ||
    message.includes("PERMISSION_REQUIRED")
  )
    throw new TRPCError({ code: "FORBIDDEN", message });
  if (message.includes("NOT_FOUND") || message.includes("UNKNOWN"))
    throw new TRPCError({ code: "NOT_FOUND", message });
  if (
    message.startsWith("M51A_") ||
    message.includes("REQUIRED") ||
    message.includes("INVALID") ||
    message.includes("DENIED") ||
    message.includes("BLOCKED") ||
    message.includes("UNAVAILABLE")
  )
    throw new TRPCError({ code: "BAD_REQUEST", message });
  throw error;
}

function executeM51A<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    return mapM51AError(error);
  }
}

async function executeM51AAsync<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return mapM51AError(error);
  }
}

function presentIntegratedResult(
  result: Awaited<ReturnType<typeof runM51AIntegratedScenario>>,
) {
  return Object.freeze({
    milestone: result.milestone,
    scenarioId: result.scenarioId,
    executedAt: result.executedAt,
    acceptanceStatement: result.acceptanceStatement,
    accepted: result.accepted,
    acceptanceFlags: result.acceptanceFlags,
    totals: result.totals,
    boundary: result.boundary,
    operationalProof: Object.freeze({
      inventoryAccepted: result.inventory.accepted,
      connectorModeMismatches:
        result.connectorRegistry.modeOperations.modeMismatches,
      stableIdentityIssues: result.stableIdentity.validationErrors.length,
      pilotAccepted: result.pilot.accepted,
      securityAccepted: result.security.accepted,
      retryRecovered: result.reliability.retry.status === "succeeded",
      idempotentReplayPreventedDuplicate:
        result.reliability.duplicateExecutionPrevented,
      expiredDeltaRequiredResync:
        result.reliability.expiredDelta.status === "resync_required",
      controlledResyncRecovered:
        result.reliability.recoveryResync.status === "succeeded",
    }),
  });
}

export const m51aRouter = createRouter({
  getExperienceSnapshot: roleQuery([...M51A_AUTHORIZED_ROLES]).query(
    ({ ctx }) => {
      const identity = deriveM51AServerIdentity(ctx.user);
      return executeM51A(() =>
        createM51AExperienceSnapshot(
          buildM51AActorFromServerIdentity(identity),
        ),
      );
    },
  ),

  getAcceptanceStatus: roleQuery([...M51A_AUTHORIZED_ROLES]).query(
    async ({ ctx }) => {
      const identity = deriveM51AServerIdentity(ctx.user);
      const viewer = buildM51AActorFromServerIdentity(identity);
      const result = await executeM51AAsync(() =>
        runM51AIntegratedScenario(buildM51AActorContext("managing-director")),
      );
      return Object.freeze({
        ...presentIntegratedResult(result),
        viewer: Object.freeze({ role: viewer.role, tier: viewer.tier }),
      });
    },
  ),

  runIntegratedScenario: roleQuery([...M51A_REVIEWER_ROLES])
    .input(m51aScenarioInputSchema)
    .mutation(async ({ ctx }) => {
      const identity = deriveM51AServerIdentity(ctx.user);
      const actor = buildM51AActorFromServerIdentity(identity);
      const result = await executeM51AAsync(() =>
        runM51AIntegratedScenario(actor),
      );
      return presentIntegratedResult(result);
    }),

  resolveIntranetRoute: roleQuery([...M51A_AUTHORIZED_ROLES])
    .input(m51aRouteInputSchema)
    .query(({ ctx, input }) => {
      const identity = deriveM51AServerIdentity(ctx.user);
      const actor = buildM51AActorFromServerIdentity(identity);
      return executeM51A(() =>
        resolveM51aIntranetRoute(
          actor.role,
          input.routeCode,
          createSyntheticM51aIntranetMap(),
          createSyntheticM51aHubTopology(),
        ),
      );
    }),
});
