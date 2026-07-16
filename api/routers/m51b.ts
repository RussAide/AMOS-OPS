import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isUserRole, type UserRole } from "@/constants/roles";
import { M51B_INTEGRATED_SCENARIO_ID } from "@contracts/m51b/integrated-scenario";
import { createRouter, roleQuery } from "../middleware";
import {
  M51A_AUTHORIZED_ROLES,
  M51A_REVIEWER_ROLES,
  buildM51AActorContext,
} from "../services/m51a";
import { runM51BIntegratedScenario } from "../services/m51b";

export const m51bScenarioInputSchema = z
  .object({
    scenarioId: z.literal(M51B_INTEGRATED_SCENARIO_ID),
  })
  .strict();

export interface M51BServerIdentity {
  actorId: string;
  role: UserRole;
}

/** Identity and role are accepted only from authenticated server context. */
export function deriveM51BServerIdentity(user: {
  id: string;
  role: string;
}): M51BServerIdentity {
  if (!user.id.trim()) throw new Error("M51B_SERVER_ACTOR_ID_REQUIRED");
  if (!isUserRole(user.role) || !M51A_AUTHORIZED_ROLES.includes(user.role))
    throw new Error("M51B_SERVER_ROLE_NOT_AUTHORIZED");
  return Object.freeze({ actorId: user.id, role: user.role });
}

export function buildM51BActorFromServerIdentity(
  identity: M51BServerIdentity,
) {
  const token = createHash("sha256")
    .update(identity.actorId)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return buildM51AActorContext(
    identity.role,
    `SYNTH-M51B-SESSION-${token}`,
  );
}

function mapM51BError(error: unknown): never {
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
    message.startsWith("M51B_") ||
    message.includes("REQUIRED") ||
    message.includes("INVALID") ||
    message.includes("DENIED") ||
    message.includes("MISMATCH")
  )
    throw new TRPCError({ code: "BAD_REQUEST", message });
  throw error;
}

async function executeM51B<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return mapM51BError(error);
  }
}

export function presentM51BIntegratedResult(
  result: Awaited<ReturnType<typeof runM51BIntegratedScenario>>,
) {
  return Object.freeze({
    milestone: result.milestone,
    scenarioId: result.scenarioId,
    executedAt: result.executedAt,
    acceptanceStatement: result.acceptanceStatement,
    accepted: result.accepted,
    acceptanceFlags: result.acceptanceFlags,
    totals: result.totals,
    governance: Object.freeze({
      accepted: result.governance.accepted,
      contracts: result.governance.totals.contracts,
      leastPrivilegeScopes: result.governance.totals.leastPrivilegeScopes,
      accessReviews: result.governance.totals.accessReviews,
      privacyThreatControls:
        result.governance.totals.privacyThreatControls,
      validationErrors: result.governance.validationErrors,
    }),
    channels: Object.freeze({
      teams: Object.freeze({
        status: result.teams.primaryDelivery.status,
        deliveryElapsedMilliseconds:
          result.teams.primaryDelivery.timing.elapsedMilliseconds ?? -1,
        thresholdMilliseconds:
          result.teams.primaryDelivery.timing.thresholdMilliseconds,
        withinThreshold:
          result.teams.primaryDelivery.timing.withinThirtySeconds,
        destinationResolved:
          result.teams.primaryDelivery.evidence?.destinationResolved ?? false,
        mentionsValidated:
          result.teams.primaryDelivery.evidence?.mentionsValidated ?? false,
        contentMinimized:
          result.teams.primaryDelivery.evidence?.contentMinimized ?? false,
        acknowledgementRecorded:
          result.teams.primaryAcknowledgement.status === "acknowledged",
        retryRecovered: result.teams.assertions.retryBoundedAndRecovered,
        privacyDenied: result.teams.assertions.privacyDenied,
      }),
      outlook: Object.freeze({
        status: result.outlook.primary.disposition,
        intakeId: result.outlook.primary.intake?.intakeId ?? null,
        intakeCount: result.outlook.primarySnapshot.metrics.intakeCount,
        exactlyOneIntake:
          result.outlook.primary.createdIntakeCount === 1 &&
          result.outlook.primarySnapshot.metrics.intakeCount === 1,
        duplicatePrevented: result.outlook.replay.duplicatePrevented,
        privacyExceptionRouted:
          result.outlook.privacyDenial.disposition === "exception_routed",
        deadLetterRecovered:
          result.outlook.recovery.disposition === "recovered",
      }),
      sharepoint: Object.freeze({
        status: result.sharepoint.accepted ? "synchronized" : "review_required",
        elapsedSeconds: result.sharepoint.elapsedSeconds,
        thresholdSeconds: result.sharepoint.maximumElapsedSeconds,
        withinThreshold: result.sharepoint.withinElapsedLimit,
        governanceGatesPassed: Object.values(
          result.sharepoint.gateDecision.gates,
        ).filter(Boolean).length,
        governanceGatesTotal: Object.values(
          result.sharepoint.gateDecision.gates,
        ).length,
        governanceGates: Object.freeze({
          ...result.sharepoint.gateDecision.gates,
        }),
        stableObjectId: result.sharepoint.stableObjectId,
        sourceOfTruth: result.sharepoint.stableMapping.sourceOfTruth,
        conflictDetected:
          result.sharepoint.staleVersionConflict.status === "conflict",
        retryRecovered: result.sharepoint.delivery.retriesScheduled > 0,
        duplicateMutationPrevented: result.sharepoint.replay.replayed,
        reconciliationPassed: result.sharepoint.reconciliation.passed,
      }),
    }),
    reliability: Object.freeze({
      maximumAttempts: result.reliability.snapshot.maximumAttempts,
      openDeadLetters: result.reliability.snapshot.openDeadLetters,
      recoveredDeadLetters:
        result.reliability.snapshot.recoveredDeadLetters,
      alertsRaised: result.reliability.snapshot.alertsRaised,
      duplicateDeliveries: result.reliability.snapshot.duplicateDeliveries,
      reconciliationAccepted:
        result.reliability.reconciliation.accepted,
    }),
    boundary: result.boundary,
  });
}

async function buildM51BPresentation(identity: M51BServerIdentity) {
  const viewer = buildM51BActorFromServerIdentity(identity);
  const result = await runM51BIntegratedScenario();
  return Object.freeze({
    ...presentM51BIntegratedResult(result),
    viewer: Object.freeze({
      role: viewer.role,
      tier: viewer.tier,
      canRunIntegratedEvaluation: M51A_REVIEWER_ROLES.includes(viewer.role),
      serverDerivedIdentity: true as const,
    }),
  });
}

export const m51bRouter = createRouter({
  getExperienceSnapshot: roleQuery([...M51A_AUTHORIZED_ROLES]).query(
    async ({ ctx }) => {
      const identity = deriveM51BServerIdentity(ctx.user);
      return executeM51B(() => buildM51BPresentation(identity));
    },
  ),

  getAcceptanceStatus: roleQuery([...M51A_AUTHORIZED_ROLES]).query(
    async ({ ctx }) => {
      const identity = deriveM51BServerIdentity(ctx.user);
      return executeM51B(() => buildM51BPresentation(identity));
    },
  ),

  runIntegratedScenario: roleQuery([...M51A_REVIEWER_ROLES])
    .input(m51bScenarioInputSchema)
    .mutation(async ({ ctx }) => {
      const identity = deriveM51BServerIdentity(ctx.user);
      return executeM51B(() => buildM51BPresentation(identity));
    }),
});
