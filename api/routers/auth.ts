import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminQuery,
  anonymousQuery,
  authedQuery,
  createRouter,
  rateLimitedAnonymous,
} from "../middleware";
import {
  bearerTokenFromRequest,
  identityService,
  IdentityError,
} from "../security/identity";
import { env } from "../lib/env";
import {
  PHASE3_DEMO_CONTROL_ROLES,
  type Phase3DemoControlRole,
} from "@contracts/phase3/shared";
import { getRoleDef } from "@/constants/roles";

function requestContext(request: Request) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  };
}

function authError(error: unknown): never {
  if (error instanceof IdentityError) {
    const code =
      error.code === "INVALID_CREDENTIALS"
        ? "UNAUTHORIZED"
        : error.code === "ACCOUNT_LOCKED"
          ? "TOO_MANY_REQUESTS"
          : error.code.endsWith("_INVALID")
            ? "BAD_REQUEST"
            : error.code === "ACCOUNT_UNAVAILABLE"
              ? "FORBIDDEN"
              : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
  throw error;
}

const passwordInput = z.string().min(1).max(256);
const passwordAttempt = rateLimitedAnonymous("identity-password", 10, 60_000);
const registrationAttempt = rateLimitedAnonymous(
  "identity-registration",
  5,
  60 * 60_000,
);
const mfaAttempt = rateLimitedAnonymous("identity-mfa", 10, 5 * 60_000);
const recoveryAttempt = rateLimitedAnonymous(
  "identity-recovery",
  5,
  15 * 60_000,
);
const evaluationSessionAttempt = rateLimitedAnonymous(
  "identity-evaluation-session",
  20,
  60_000,
);

function syntheticEvaluationUser(role: Phase3DemoControlRole) {
  const definition = getRoleDef(role);
  return {
    id: `SYNTH-EVALUATOR-${role.toUpperCase()}`,
    email: `evaluator+${role}@amos-ops.invalid`,
    firstName: "Synthetic",
    lastName: definition.label,
    name: `Synthetic ${definition.label}`,
    role,
    department: definition.department,
    mfaEnabled: false,
    accessStatus: "training" as const,
    identityType: "external_guest" as const,
    trainingAccess: true,
    sponsorName: "AMOS evaluation",
    accessExpiresAt: null,
    dataScope: "training" as const,
  };
}

export const authRouter = createRouter({
  policy: anonymousQuery.query(() => ({
    passwordMinimumLength: identityService.policy.passwordMinimumLength,
    maximumFailedLogins: identityService.policy.maximumFailedLogins,
    lockoutMinutes: identityService.policy.lockoutMinutes,
    sessionIdleMinutes: identityService.policy.sessionIdleMinutes,
    sessionAbsoluteMinutes: identityService.policy.sessionAbsoluteMinutes,
    mfaPolicy: identityService.policy.mfaPolicy,
    accessReviewDays: identityService.policy.accessReviewDays,
  })),

  evaluationSession: evaluationSessionAttempt
    .input(
      z.object({
        role: z.enum(PHASE3_DEMO_CONTROL_ROLES).default("administrator"),
      }),
    )
    .mutation(({ input }) => {
      if (!env.isDemo || !env.evaluationMode) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Synthetic evaluation access is not enabled.",
        });
      }
      return {
        status: "authenticated" as const,
        token: "amos-evaluation-session",
        user: syntheticEvaluationUser(input.role),
      };
    }),

  register: registrationAttempt
    .input(
      z.object({
        email: z.string().email().max(254),
        password: passwordInput,
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        department: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await identityService.register({
          ...input,
          ...requestContext(ctx.req),
        });
      } catch (error) {
        authError(error);
      }
    }),

  login: passwordAttempt
    .input(
      z.object({
        email: z.string().email().max(254),
        password: passwordInput,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await identityService.login({
          ...input,
          ...requestContext(ctx.req),
        });
      } catch (error) {
        authError(error);
      }
    }),

  verifyMfa: mfaAttempt
    .input(
      z.object({
        challengeId: z.string().uuid(),
        code: z
          .string()
          .regex(/^\d{6}$/, "Enter the six-digit verification code."),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await identityService.verifyMfa({
          ...input,
          ...requestContext(ctx.req),
        });
      } catch (error) {
        authError(error);
      }
    }),

  me: anonymousQuery.query(({ ctx }) => {
    const token = bearerTokenFromRequest(ctx.req);
    // Revalidation does not extend the idle timeout. Authenticated domain
    // requests refresh activity through middleware instead.
    return token ? identityService.getSession(token, false) : null;
  }),

  logout: anonymousQuery.mutation(({ ctx }) => {
    const token = bearerTokenFromRequest(ctx.req);
    return { success: token ? identityService.revokeToken(token) : true };
  }),

  requestPasswordReset: recoveryAttempt
    .input(z.object({ email: z.string().email().max(254) }))
    .mutation(({ input, ctx }) =>
      identityService.requestPasswordReset({
        email: input.email,
        ipAddress: requestContext(ctx.req).ipAddress,
      }),
    ),

  resetPassword: recoveryAttempt
    .input(
      z.object({
        token: z.string().min(20).max(256),
        newPassword: passwordInput,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await identityService.resetPassword(input);
      } catch (error) {
        authError(error);
      }
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: passwordInput,
        newPassword: passwordInput,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await identityService.changePassword({
          userId: ctx.user.id,
          ...input,
        });
      } catch (error) {
        authError(error);
      }
    }),

  setMfa: authedQuery
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ input, ctx }) => {
      try {
        return identityService.setMfa(ctx.user.id, input.enabled);
      } catch (error) {
        authError(error);
      }
    }),

  listSessions: authedQuery.query(({ ctx }) =>
    identityService.listSessions(ctx.user.id),
  ),

  listUsers: adminQuery.query(() => identityService.listUsers()),

  createTrainingAccount: adminQuery
    .input(
      z.object({
        email: z.string().email().max(254),
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        role: z.string().trim().min(1).max(80),
        identityType: z.enum(["workforce", "external_guest"]),
        sponsorName: z.string().trim().min(2).max(160),
        accessExpiresAt: z.string().datetime().nullable().optional(),
        rationale: z.string().trim().min(5).max(1_000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await identityService.createTrainingAccount({
          ...input,
          actorId: ctx.user.id,
        });
      } catch (error) {
        authError(error);
      }
    }),

  updateUser: adminQuery
    .input(
      z.object({
        id: z.string().min(1),
        role: z.string().trim().min(1).max(80).optional(),
        department: z.string().trim().max(120).optional(),
        isActive: z.boolean().optional(),
        accessStatus: z
          .enum(["training", "cleared", "suspended", "deactivated"])
          .optional(),
        identityType: z.enum(["workforce", "external_guest"]).optional(),
        trainingAccess: z.boolean().optional(),
        sponsorName: z.string().trim().max(160).nullable().optional(),
        accessExpiresAt: z.string().datetime().nullable().optional(),
        evidenceReference: z.string().trim().max(500).optional(),
        rationale: z.string().trim().min(5).max(1_000).optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      try {
        return identityService.updateUser({ ...input, actorId: ctx.user.id });
      } catch (error) {
        authError(error);
      }
    }),

  deleteUser: adminQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => identityService.deleteUser(input.id)),

  listAccessReviews: adminQuery.query(() =>
    identityService.listAccessReviews(),
  ),

  completeAccessReview: adminQuery
    .input(
      z.object({
        reviewId: z.string().uuid(),
        decision: z.enum(["retain", "modify", "revoke"]),
        rationale: z.string().trim().min(5).max(1_000),
      }),
    )
    .mutation(({ input, ctx }) => {
      try {
        return identityService.completeAccessReview({
          ...input,
          reviewerId: ctx.user.id,
        });
      } catch (error) {
        authError(error);
      }
    }),
});
