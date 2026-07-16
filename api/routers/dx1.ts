import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isUserRole, type UserRole } from "@/constants/roles";
import {
  DX1_SCENARIO_ID,
  runDx1IntegratedScenario,
  type Dx1CriterionResult,
} from "../services/dx1";
import type { Dx1ExperienceGovernanceResult } from "../services/dx1/experience";
import {
  M51A_AUTHORIZED_ROLES,
  M51A_REVIEWER_ROLES,
  resolveM51aIntranetRoute,
} from "../services/m51a";
import { createRouter, roleQuery } from "../middleware";

export const dx1ScenarioInputSchema = z
  .object({ scenarioId: z.literal(DX1_SCENARIO_ID) })
  .strict();

export interface Dx1ServerIdentity {
  readonly actorId: string;
  readonly role: UserRole;
}

/** Client payloads cannot supply or widen the acting identity. */
export function deriveDx1ServerIdentity(user: {
  readonly id: string;
  readonly role: string;
}): Readonly<Dx1ServerIdentity> {
  if (!user.id.trim()) throw new Error("DX1_SERVER_ACTOR_ID_REQUIRED");
  if (!isUserRole(user.role) || !M51A_AUTHORIZED_ROLES.includes(user.role))
    throw new Error("DX1_SERVER_ROLE_NOT_AUTHORIZED");
  return Object.freeze({ actorId: user.id, role: user.role });
}

function mapDx1Error(error: unknown): never {
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
    message.startsWith("DX1_") ||
    message.includes("REQUIRED") ||
    message.includes("INVALID") ||
    message.includes("DENIED") ||
    message.includes("MISMATCH")
  )
    throw new TRPCError({ code: "BAD_REQUEST", message });
  throw error;
}

function executeDx1<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    return mapDx1Error(error);
  }
}

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      immutable(child);
    Object.freeze(value);
  }
  return value;
}

function projectCriterion(
  criterion: Readonly<Dx1CriterionResult>,
): Readonly<Dx1CriterionResult> {
  return Object.freeze({
    criterionId: criterion.criterionId,
    status: criterion.status,
    assertionIds: Object.freeze(
      criterion.assertionIds.map(
        (_, index) =>
          `${criterion.criterionId}-VERIFIED-${String(index + 1).padStart(2, "0")}`,
      ),
    ),
    evidenceIds: Object.freeze([]),
    summary: `${criterion.criterionId} is complete in the governed synthetic evaluation.`,
  });
}

function buildMinimumNecessaryExperience(
  experience: Readonly<Dx1ExperienceGovernanceResult>,
  role: UserRole,
) {
  const workflows = experience.workflows
    .filter(
      (workflow) =>
        workflow.ownerRole === role || workflow.escalation.targetRole === role,
    )
    .map((workflow) => ({
      ...workflow,
      workflowId: `DX1-VISIBLE-WORKFLOW-${workflow.sequence}`,
      evidenceGateId: `DX1-GOVERNED-GATE-${workflow.sequence}`,
    }));
  const visibleStages = new Set(workflows.map((workflow) => workflow.stageId));
  const personaAssignments = experience.personaAssignments
    .filter((assignment) => assignment.canonicalRole === role)
    .map((assignment) => ({
      ...assignment,
      actorId: "DX1-CURRENT-VIEWER",
      displayLabel: "Your assigned work",
      fixtureRole: "current-viewer",
      routeDecisionId: "DX1-PERMISSION-TRIMMED-ROUTE",
    }));
  const frontlineWalkthroughs = experience.frontlineWalkthroughs
    .filter((walkthrough) => walkthrough.canonicalRole === role)
    .map((walkthrough) => ({
      ...walkthrough,
      walkthroughId: "DX1-CURRENT-VIEWER-WALKTHROUGH",
      actorId: "DX1-CURRENT-VIEWER",
      personaLabel: "Your role",
      evidenceId: "DX1-PERMISSION-TRIMMED-EVIDENCE",
    }));
  return immutable({
    streamId: experience.streamId,
    scenarioId: experience.scenarioId,
    evaluatedAt: experience.evaluatedAt,
    passed: experience.passed,
    assertionCount: experience.assertionCount,
    criteria: experience.criteria.map(projectCriterion),
    auditEvents: [],
    boundary: experience.boundary,
    acceptedModules: {
      ...experience.acceptedModules,
      evidenceIds: [],
    },
    workspaces: experience.workspaces.filter(
      (workspace) =>
        resolveM51aIntranetRoute(role, workspace.routeCode).allowed,
    ),
    personaAssignments,
    workflows,
    frontlineWalkthroughs,
    guidanceAtWork: experience.guidanceAtWork.filter((guidance) =>
      visibleStages.has(guidance.stageId),
    ),
    issueSupport: {
      ...experience.issueSupport,
      queueId: "DX1-PERMISSION-TRIMMED-SUPPORT",
    },
    validationErrors: [],
  });
}

/**
 * Reviewers receive the complete deterministic verification record. Every
 * other authorized role receives only permission-trimmed experience content;
 * cross-domain pilot, intelligence, raw evidence identifiers, and audit
 * history never cross the response boundary.
 */
export function buildDx1Presentation(identity: Readonly<Dx1ServerIdentity>) {
  const result = runDx1IntegratedScenario();
  const isReviewer = M51A_REVIEWER_ROLES.includes(identity.role);
  if (isReviewer)
    return immutable({
      ...result,
      dataProjection: "integrated-review" as const,
      viewer: {
        actorId: identity.actorId,
        role: identity.role,
        serverDerivedIdentity: true as const,
        canRunIntegratedEvaluation: true as const,
      },
    });

  const experience = result.streams
    .experience as Readonly<Dx1ExperienceGovernanceResult>;
  return immutable({
    schemaVersion: result.schemaVersion,
    milestone: result.milestone,
    scenarioId: result.scenarioId,
    evaluatedAt: result.evaluatedAt,
    acceptance: result.acceptance,
    accepted: result.accepted,
    passed: result.passed,
    assertionCount: result.assertionCount,
    integrationAssertionCount: result.integrationAssertionCount,
    criteria: result.criteria.map(projectCriterion),
    streams: {
      experience: buildMinimumNecessaryExperience(experience, identity.role),
    },
    boundary: result.boundary,
    dataProjection: "minimum-necessary" as const,
    viewer: {
      role: identity.role,
      serverDerivedIdentity: true as const,
      canRunIntegratedEvaluation: false as const,
    },
  });
}

export const dx1Router = createRouter({
  getExperienceSnapshot: roleQuery([...M51A_AUTHORIZED_ROLES]).query(({ ctx }) => {
    const identity = deriveDx1ServerIdentity(ctx.user);
    return executeDx1(() => buildDx1Presentation(identity));
  }),

  getAcceptanceStatus: roleQuery([...M51A_AUTHORIZED_ROLES]).query(({ ctx }) => {
    const identity = deriveDx1ServerIdentity(ctx.user);
    return executeDx1(() => buildDx1Presentation(identity));
  }),

  runIntegratedScenario: roleQuery([...M51A_REVIEWER_ROLES])
    .input(dx1ScenarioInputSchema)
    .mutation(({ ctx }) => {
      const identity = deriveDx1ServerIdentity(ctx.user);
      return executeDx1(() => buildDx1Presentation(identity));
    }),
});
