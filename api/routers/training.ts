import { z } from "zod";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { trainingModules, trainingProgress, hrPeople } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const trainingRouter = createRouter({
  // ─── Training Modules ──────────────────────────────────────

  listModules: publicQuery
    .input(z.object({ trackId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.trackId) {
        return db
          .select()
          .from(trainingModules)
          .where(eq(trainingModules.trackId, input.trackId))
          .all();
      }
      return db.select().from(trainingModules).all();
    }),

  getModule: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const mod = await db.select().from(trainingModules).where(eq(trainingModules.id, input.id)).get();
      if (!mod) throw new Error("Module not found");
      return mod;
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
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const id = randomUUID();
      const actor = ctx.user?.email ?? "unknown";

      await db.insert(trainingModules).values({
        id,
        trackId: input.trackId,
        title: input.title,
        category: input.category,
        description: input.description ?? null,
        stepCount: input.stepCount,
      });

      auditLog({
        action: "training:createModule",
        actor,
        resource: `training-module:${id}`,
        details: `Created training module "${input.title}" (${input.category})`,
      });

      return db.select().from(trainingModules).where(eq(trainingModules.id, id)).get();
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
      const db = getDb();
      const { id, ...updates } = input;
      const actor = ctx.user?.email ?? "unknown";

      const setData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setData[key] = value;
      }

      await db.update(trainingModules).set(setData).where(eq(trainingModules.id, id));

      auditLog({
        action: "training:updateModule",
        actor,
        resource: `training-module:${id}`,
        details: `Updated training module`,
      });

      return db.select().from(trainingModules).where(eq(trainingModules.id, id)).get();
    }),

  deleteModule: authedQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";

      // Delete associated progress first
      await db.delete(trainingProgress).where(eq(trainingProgress.moduleId, input.id));
      await db.delete(trainingModules).where(eq(trainingModules.id, input.id));

      auditLog({
        action: "training:deleteModule",
        actor,
        resource: `training-module:${input.id}`,
        details: `Deleted training module`,
      });

      return { success: true };
    }),

  // ─── Training Progress ─────────────────────────────────────

  getProgress: publicQuery
    .input(z.object({ userId: z.string(), moduleId: z.string() }))
    .query(async ({ input }) => {
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
    .input(z.object({ userId: z.string().optional(), moduleId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
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
          .where(eq(trainingProgress.userId, input.userId))
          .all();
      }
      if (input?.moduleId) {
        return db
          .select()
          .from(trainingProgress)
          .where(eq(trainingProgress.moduleId, input.moduleId))
          .all();
      }
      return db.select().from(trainingProgress).orderBy(desc(trainingProgress.startedAt)).all();
    }),

  updateProgress: publicQuery
    .input(
      z.object({
        userId: z.string(),
        moduleId: z.string(),
        completedSteps: z.number().optional(),
        status: z.enum(["available", "in-progress", "completed"]).optional(),
        quizScore: z.number().optional(),
        quizPassed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { userId, moduleId, ...updates } = input;

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
        const updateData: Record<string, unknown> = {};
        if (updates.completedSteps !== undefined) updateData.completedSteps = updates.completedSteps;
        if (updates.status !== undefined) {
          updateData.status = updates.status;
          if (updates.status === "in-progress" && !existing.startedAt) {
            updateData.startedAt = new Date().toISOString();
          }
          if (updates.status === "completed") {
            updateData.completedAt = new Date().toISOString();
          }
        }
        if (updates.quizScore !== undefined) updateData.quizScore = updates.quizScore;
        if (updates.quizPassed !== undefined) updateData.quizPassed = updates.quizPassed;

        await db.update(trainingProgress).set(updateData).where(eq(trainingProgress.id, existing.id));
        return db.select().from(trainingProgress).where(eq(trainingProgress.id, existing.id)).get();
      } else {
        const id = randomUUID();
        await db.insert(trainingProgress).values({
          id,
          userId,
          moduleId,
          completedSteps: updates.completedSteps ?? 0,
          status: updates.status ?? "available",
          quizScore: updates.quizScore ?? null,
          quizPassed: updates.quizPassed ?? false,
          startedAt: updates.status === "in-progress" ? new Date().toISOString() : null,
          completedAt: updates.status === "completed" ? new Date().toISOString() : null,
        });
        return db.select().from(trainingProgress).where(eq(trainingProgress.id, id)).get();
      }
    }),

  // ─── Training Dashboard ────────────────────────────────────

  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const allModules = await db.select().from(trainingModules).all();
    const allProgress = await db.select().from(trainingProgress).all();
    const allPeople = await db.select().from(hrPeople).all();

    const totalAssignments = allProgress.length;
    const completed = allProgress.filter((p) => p.status === "completed").length;
    const inProgress = allProgress.filter((p) => p.status === "in-progress").length;
    const notStarted = allProgress.filter((p) => p.status === "available").length;

    // Per-person stats
    const personStats = allPeople.map((person) => {
      const personProgress = allProgress.filter((p) => p.userId === person.id);
      const completedCount = personProgress.filter((p) => p.status === "completed").length;
      return {
        personId: person.id,
        name: `${person.firstName} ${person.lastName}`,
        role: person.role,
        totalModules: personProgress.length,
        completed: completedCount,
        completionRate: personProgress.length > 0 ? Math.round((completedCount / personProgress.length) * 100) : 0,
      };
    });

    // Per-module stats
    const moduleStats = allModules.map((mod) => {
      const modProgress = allProgress.filter((p) => p.moduleId === mod.id);
      const completedCount = modProgress.filter((p) => p.status === "completed").length;
      return {
        moduleId: mod.id,
        title: mod.title,
        category: mod.category,
        totalAssigned: modProgress.length,
        completed: completedCount,
        completionRate: modProgress.length > 0 ? Math.round((completedCount / modProgress.length) * 100) : 0,
      };
    });

    return {
      totalModules: allModules.length,
      totalAssignments,
      completed,
      inProgress,
      notStarted,
      completionRate: totalAssignments > 0 ? Math.round((completed / totalAssignments) * 100) : 0,
      personStats,
      moduleStats,
    };
  }),
});
