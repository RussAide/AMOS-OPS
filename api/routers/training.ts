import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { trainingModules, trainingProgress } from "@db/schema";
import { eq, and } from "drizzle-orm";
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
});
