import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { performanceReviews } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const performanceRouter = createRouter({
  // ─── List reviews ──────────────────────────────────────────
  list: publicQuery
    .input(z.object({ personId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.personId) {
        return db
          .select()
          .from(performanceReviews)
          .where(eq(performanceReviews.personId, input.personId))
          .orderBy(desc(performanceReviews.createdAt))
          .all();
      }
      return db.select().from(performanceReviews).orderBy(desc(performanceReviews.createdAt)).all();
    }),

  // ─── Create review ─────────────────────────────────────────
  create: publicQuery
    .input(
      z.object({
        personId: z.string().min(1),
        reviewType: z.enum(["30-day", "90-day", "annual", "corrective"]),
        reviewDate: z.string().min(1),
        competencies: z.string().optional(),
        goals: z.string().optional(),
        supervisorComments: z.string().optional(),
        actionItems: z.string().optional(),
        overallRating: z.enum(["exceeds", "meets", "needs-improvement", "unsatisfactory"]).optional(),
        reviewedBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(performanceReviews).values({
        id,
        personId: input.personId,
        reviewType: input.reviewType,
        reviewDate: input.reviewDate,
        competencies: input.competencies ?? null,
        goals: input.goals ?? null,
        supervisorComments: input.supervisorComments ?? null,
        actionItems: input.actionItems ?? null,
        overallRating: input.overallRating ?? null,
        reviewedBy: input.reviewedBy ?? null,
        reviewedAt: new Date().toISOString(),
      });

      return db.select().from(performanceReviews).where(eq(performanceReviews.id, id)).get();
    }),

  // ─── Update review ─────────────────────────────────────────
  update: publicQuery
    .input(
      z.object({
        id: z.string(),
        competencies: z.string().optional(),
        goals: z.string().optional(),
        supervisorComments: z.string().optional(),
        actionItems: z.string().optional(),
        overallRating: z.enum(["exceeds", "meets", "needs-improvement", "unsatisfactory"]).optional(),
        signedOffBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const setData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setData[key] = value;
        }
      }
      if (updates.signedOffBy) {
        setData.signedOffAt = new Date().toISOString();
      }

      await db.update(performanceReviews).set(setData).where(eq(performanceReviews.id, id));
      return db.select().from(performanceReviews).where(eq(performanceReviews.id, id)).get();
    }),

  // ─── Delete review ─────────────────────────────────────────
  delete: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(performanceReviews).where(eq(performanceReviews.id, input.id));
      return { success: true };
    }),
});
