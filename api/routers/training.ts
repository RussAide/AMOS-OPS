import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  publicQuery,
  authedQuery,
  anonymousQuery,
  auditLog,
} from "../middleware";
import { getDb } from "../queries/connection";
import { runWithDataScope } from "../queries/connection";
import { trainingModules, trainingProgress, hrPeople } from "@db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  resolveIdentityUser,
  resolveRequestedDataScope,
  type IdentityUser,
} from "../security/identity";

const TRAINING_COHORT_READ_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
  "hr-compliance-officer",
  "training-coordinator",
]);

const TRAINING_COHORT_ASSIGN_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
  "training-coordinator",
]);

const UNIVERSAL_ORIENTATION_MODULES = [
  ["mod-101", "Welcome, Mission & Organizational Identity", "Operations"],
  ["mod-102", "Regulatory & Program Overview", "Compliance"],
  ["mod-103", "Organizational Structure & Chain of Command", "Operations"],
  ["mod-104", "Services & Characteristics of Persons Served", "Clinical"],
  ["mod-105", "Client/Resident Rights & Dignity", "Compliance"],
  ["mod-106", "Confidentiality, HIPAA & Privacy", "Compliance"],
  ["mod-107", "Code of Conduct & Professional Boundaries", "Compliance"],
  [
    "mod-108",
    "Abuse, Neglect, Exploitation & Mandatory Reporting",
    "Compliance",
  ],
  ["mod-109", "Incident Reporting & Escalation", "Compliance"],
  ["mod-110", "Emergency Preparedness & Safety", "Operations"],
  [
    "mod-111",
    "Infection Control & Communicable Disease Awareness",
    "Compliance",
  ],
  ["mod-112", "Documentation & Record Integrity", "Compliance"],
  ["mod-113", "Trauma-Informed Care Overview", "Clinical"],
  ["mod-114", "De-escalation & Crisis Awareness", "Clinical"],
  ["mod-115", "HR Clearance & Operations Boundary", "Professional"],
  ["mod-116", "Systems Access & Security", "Compliance"],
] as const;

interface UniversalOrientationModuleSeed {
  id: string;
  trackId: string;
  title: string;
  category: string;
  description: string;
  stepCount: number;
}

const UNIVERSAL_ORIENTATION_BY_ID: ReadonlyMap<
  string,
  UniversalOrientationModuleSeed
> = new Map(
  UNIVERSAL_ORIENTATION_MODULES.map(([id, title, category]) => [
    id,
    {
      id,
      trackId: "universal-orientation",
      title,
      category,
      description:
        "TA.1 synthetic-only orientation practice. Completion is not release-to-duty certification.",
      stepCount: 5,
    },
  ]),
);
const UNIVERSAL_ORIENTATION_IDS = [...UNIVERSAL_ORIENTATION_BY_ID.keys()];

function requireTrainingCohortAccess(
  user: IdentityUser,
  allowedRoles: ReadonlySet<string>,
): void {
  if (
    user.dataScope !== "training" ||
    user.accessStatus !== "cleared" ||
    !allowedRoles.has(user.role)
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Training cohort records require a cleared trainer role in the Training workspace.",
    });
  }
}

/**
 * Training self-service intentionally has its own narrow authentication gate.
 * The central `training.*` authorization profile represents EO/HR cohort
 * administration, which must not grant a trainee access to another person's
 * record. These procedures accept no caller-supplied user identifier and run
 * only against the isolated Training database selected from the session.
 */
const trainingSelfServiceQuery = anonymousQuery.use(async ({ ctx, next }) => {
  const user = resolveIdentityUser(ctx.req);
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unauthorized: invalid or expired session",
    });
  }
  const dataScope = resolveRequestedDataScope(user, ctx.req);
  if (dataScope !== "training") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Training self-service requires the Training workspace.",
    });
  }

  return runWithDataScope("training", () =>
    next({ ctx: { ...ctx, user: { ...user, dataScope } } }),
  );
});

const progressUpdateInput = z
  .object({
    moduleId: z.string().min(1),
    completedSteps: z.number().int().min(0).optional(),
    status: z.enum(["available", "in-progress", "completed"]).optional(),
    quizScore: z.number().int().min(0).max(100).optional(),
    quizPassed: z.boolean().optional(),
  })
  .strict();

type TrainingDatabase = ReturnType<typeof getDb>;
type TrainingProgressRow = typeof trainingProgress.$inferSelect;

function normalizeTrainingProgress<T extends TrainingProgressRow>(
  row: T,
): T & {
  quizPassed: boolean;
} {
  return { ...row, quizPassed: row.quizPassed ?? false };
}

async function requireTrainingModule(
  moduleId: string,
  db: TrainingDatabase = getDb(),
) {
  const approvedOrientationModule = UNIVERSAL_ORIENTATION_BY_ID.get(moduleId);
  if (!approvedOrientationModule) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "TA.1 permits only the approved universal-orientation modules.",
    });
  }
  await db
    .insert(trainingModules)
    .values(approvedOrientationModule)
    .onConflictDoUpdate({
      target: trainingModules.id,
      set: {
        trackId: approvedOrientationModule.trackId,
        title: approvedOrientationModule.title,
        category: approvedOrientationModule.category,
        description: approvedOrientationModule.description,
        stepCount: approvedOrientationModule.stepCount,
      },
    });
  const module = await db
    .select()
    .from(trainingModules)
    .where(eq(trainingModules.id, moduleId))
    .get();
  if (!module) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });
  }
  return module;
}

export async function ensureUniversalOrientationCurriculum(
  db: TrainingDatabase = getDb(),
) {
  for (const approvedModule of UNIVERSAL_ORIENTATION_BY_ID.values()) {
    await db
      .insert(trainingModules)
      .values(approvedModule)
      .onConflictDoUpdate({
        target: trainingModules.id,
        set: {
          trackId: approvedModule.trackId,
          title: approvedModule.title,
          category: approvedModule.category,
          description: approvedModule.description,
          stepCount: approvedModule.stepCount,
        },
      });
  }
  return db
    .select()
    .from(trainingModules)
    .where(inArray(trainingModules.id, UNIVERSAL_ORIENTATION_IDS))
    .all();
}

export async function persistOwnProgress(
  user: IdentityUser,
  input: z.infer<typeof progressUpdateInput>,
  db: TrainingDatabase = getDb(),
) {
  const module = await requireTrainingModule(input.moduleId, db);
  const existing = await db
    .select()
    .from(trainingProgress)
    .where(
      and(
        eq(trainingProgress.userId, user.id),
        eq(trainingProgress.moduleId, input.moduleId),
      ),
    )
    .get();

  const completedSteps = input.completedSteps ?? existing?.completedSteps ?? 0;
  const status = input.status ?? existing?.status ?? "available";
  const quizScore = input.quizScore ?? existing?.quizScore ?? null;
  const quizPassed = input.quizPassed ?? existing?.quizPassed ?? false;

  if (completedSteps > module.stepCount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Completed steps cannot exceed the module step count.",
    });
  }
  if (status === "completed" && completedSteps !== module.stepCount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Every module step must be completed before completion.",
    });
  }
  if (quizPassed && quizScore === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A quiz score is required before recording a passing result.",
    });
  }
  if (quizPassed && quizScore !== null && quizScore < 80) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A quiz score of at least 80 is required for a passing result.",
    });
  }
  if (status === "completed" && !quizPassed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A passing quiz result is required before module completion.",
    });
  }

  const now = new Date().toISOString();
  if (existing) {
    await db
      .update(trainingProgress)
      .set({
        completedSteps,
        status,
        quizScore,
        quizPassed,
        startedAt:
          status === "available"
            ? existing.startedAt
            : (existing.startedAt ?? now),
        completedAt:
          status === "completed" ? (existing.completedAt ?? now) : null,
      })
      .where(eq(trainingProgress.id, existing.id));
    const saved = await db
      .select()
      .from(trainingProgress)
      .where(eq(trainingProgress.id, existing.id))
      .get();
    if (!saved) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Training progress could not be reloaded.",
      });
    }
    return normalizeTrainingProgress(saved);
  }

  const id = randomUUID();
  await db.insert(trainingProgress).values({
    id,
    userId: user.id,
    moduleId: input.moduleId,
    completedSteps,
    status,
    quizScore,
    quizPassed,
    startedAt: status === "available" ? null : now,
    completedAt: status === "completed" ? now : null,
  });
  const saved = await db
    .select()
    .from(trainingProgress)
    .where(eq(trainingProgress.id, id))
    .get();
  if (!saved) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Training progress could not be reloaded.",
    });
  }
  return normalizeTrainingProgress(saved);
}

export const trainingRouter = createRouter({
  // ─── Training Modules ──────────────────────────────────────

  listModules: publicQuery
    .input(z.object({ trackId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_READ_ROLES);
      if (input?.trackId && input.trackId !== "universal-orientation") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "TA.1 permits only the universal-orientation track.",
        });
      }
      return ensureUniversalOrientationCurriculum();
    }),

  getModule: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_READ_ROLES);
      return requireTrainingModule(input.id);
    }),

  createModule: authedQuery
    .input(
      z.object({
        trackId: z.string().min(1),
        title: z.string().min(1),
        category: z.string().min(1),
        description: z.string().optional(),
        stepCount: z.number().min(1).default(5),
      }),
    )
    .mutation(async ({ ctx }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_ASSIGN_ROLES);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "TA.1 universal-orientation modules are immutable.",
      });
    }),

  updateModule: authedQuery
    .input(
      z.object({
        id: z.string(),
        trackId: z.string().optional(),
        title: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        stepCount: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_ASSIGN_ROLES);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `TA.1 universal-orientation module ${input.id} is immutable.`,
      });
    }),

  deleteModule: authedQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_ASSIGN_ROLES);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `TA.1 universal-orientation module ${input.id} is immutable.`,
      });
    }),

  // ─── Training Progress ─────────────────────────────────────

  listOrientationModules: trainingSelfServiceQuery.query(async () => {
    return ensureUniversalOrientationCurriculum();
  }),

  getMyProgress: trainingSelfServiceQuery
    .input(z.object({ moduleId: z.string().min(1) }).strict())
    .query(async ({ ctx, input }) => {
      await requireTrainingModule(input.moduleId);
      const progress = await getDb()
        .select()
        .from(trainingProgress)
        .where(
          and(
            eq(trainingProgress.userId, ctx.user.id),
            eq(trainingProgress.moduleId, input.moduleId),
          ),
        )
        .get();
      return progress ? normalizeTrainingProgress(progress) : undefined;
    }),

  listMyProgress: trainingSelfServiceQuery.query(async ({ ctx }) => {
    const progress = await getDb()
      .select()
      .from(trainingProgress)
      .where(
        and(
          eq(trainingProgress.userId, ctx.user.id),
          inArray(trainingProgress.moduleId, UNIVERSAL_ORIENTATION_IDS),
        ),
      )
      .orderBy(desc(trainingProgress.startedAt))
      .all();
    return progress.map(normalizeTrainingProgress);
  }),

  updateMyProgress: trainingSelfServiceQuery
    .input(progressUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const progress = await persistOwnProgress(ctx.user, input);
      auditLog({
        action: "training:updateMyProgress",
        actor: ctx.user.email,
        resource: `training-progress:${ctx.user.id}:${input.moduleId}`,
        details: "Updated synthetic Training-workspace progress.",
      });
      return progress;
    }),

  getProgress: publicQuery
    .input(z.object({ userId: z.string(), moduleId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_READ_ROLES);
      await requireTrainingModule(input.moduleId);
      const db = getDb();
      return db
        .select()
        .from(trainingProgress)
        .where(
          and(
            eq(trainingProgress.userId, input.userId),
            eq(trainingProgress.moduleId, input.moduleId),
          ),
        )
        .get();
    }),

  listProgress: publicQuery
    .input(
      z
        .object({
          userId: z.string().optional(),
          moduleId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_READ_ROLES);
      const db = getDb();
      if (input?.moduleId) {
        await requireTrainingModule(input.moduleId, db);
      }
      if (input?.userId && input?.moduleId) {
        return db
          .select()
          .from(trainingProgress)
          .where(
            and(
              eq(trainingProgress.userId, input.userId),
              eq(trainingProgress.moduleId, input.moduleId),
            ),
          )
          .all();
      }
      if (input?.userId) {
        return db
          .select()
          .from(trainingProgress)
          .where(
            and(
              eq(trainingProgress.userId, input.userId),
              inArray(trainingProgress.moduleId, UNIVERSAL_ORIENTATION_IDS),
            ),
          )
          .all();
      }
      if (input?.moduleId) {
        return db
          .select()
          .from(trainingProgress)
          .where(eq(trainingProgress.moduleId, input.moduleId))
          .all();
      }
      return db
        .select()
        .from(trainingProgress)
        .where(inArray(trainingProgress.moduleId, UNIVERSAL_ORIENTATION_IDS))
        .orderBy(desc(trainingProgress.startedAt))
        .all();
    }),

  updateProgress: publicQuery
    .input(
      z
        .object({
          userId: z.string().min(1),
          moduleId: z.string().min(1),
          status: z.literal("available").optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_ASSIGN_ROLES);
      const db = getDb();
      const { userId, moduleId } = input;
      await requireTrainingModule(moduleId);

      const existing = await db
        .select()
        .from(trainingProgress)
        .where(
          and(
            eq(trainingProgress.userId, userId),
            eq(trainingProgress.moduleId, moduleId),
          ),
        )
        .get();

      if (existing) {
        return existing;
      }

      const id = randomUUID();
      await db.insert(trainingProgress).values({
        id,
        userId,
        moduleId,
        completedSteps: 0,
        status: "available",
        quizScore: null,
        quizPassed: false,
        startedAt: null,
        completedAt: null,
      });
      auditLog({
        action: "training:assignProgress",
        actor: ctx.user.email,
        resource: `training-progress:${userId}:${moduleId}`,
        details: "Assigned a synthetic Training-workspace module.",
      });
      return db
        .select()
        .from(trainingProgress)
        .where(eq(trainingProgress.id, id))
        .get();
    }),

  // ─── Training Dashboard ────────────────────────────────────

  dashboard: publicQuery.query(async ({ ctx }) => {
    requireTrainingCohortAccess(ctx.user, TRAINING_COHORT_READ_ROLES);
    const db = getDb();
    const allModules = await ensureUniversalOrientationCurriculum(db);
    const allProgress = await db
      .select()
      .from(trainingProgress)
      .where(inArray(trainingProgress.moduleId, UNIVERSAL_ORIENTATION_IDS))
      .all();
    const allPeople = await db.select().from(hrPeople).all();

    const totalAssignments = allProgress.length;
    const completed = allProgress.filter(
      (p) => p.status === "completed",
    ).length;
    const inProgress = allProgress.filter(
      (p) => p.status === "in-progress",
    ).length;
    const notStarted = allProgress.filter(
      (p) => p.status === "available",
    ).length;

    // Per-person stats
    const personStats = allPeople.map((person) => {
      const personProgress = allProgress.filter((p) => p.userId === person.id);
      const completedCount = personProgress.filter(
        (p) => p.status === "completed",
      ).length;
      return {
        personId: person.id,
        name: `${person.firstName} ${person.lastName}`,
        role: person.role,
        totalModules: personProgress.length,
        completed: completedCount,
        completionRate:
          personProgress.length > 0
            ? Math.round((completedCount / personProgress.length) * 100)
            : 0,
      };
    });

    // Per-module stats
    const moduleStats = allModules.map((mod) => {
      const modProgress = allProgress.filter((p) => p.moduleId === mod.id);
      const completedCount = modProgress.filter(
        (p) => p.status === "completed",
      ).length;
      return {
        moduleId: mod.id,
        title: mod.title,
        category: mod.category,
        totalAssigned: modProgress.length,
        completed: completedCount,
        completionRate:
          modProgress.length > 0
            ? Math.round((completedCount / modProgress.length) * 100)
            : 0,
      };
    });

    return {
      totalModules: allModules.length,
      totalAssignments,
      completed,
      inProgress,
      notStarted,
      completionRate:
        totalAssignments > 0
          ? Math.round((completed / totalAssignments) * 100)
          : 0,
      personStats,
      moduleStats,
    };
  }),
});
