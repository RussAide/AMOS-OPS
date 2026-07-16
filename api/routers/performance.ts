import { z } from "zod";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { performanceReviews, hrPeople } from "@db/schema";
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

  // ─── Get single review ─────────────────────────────────────
  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const review = await db.select().from(performanceReviews).where(eq(performanceReviews.id, input.id)).get();
      if (!review) throw new Error("Review not found");
      return review;
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

  // ─── Sign off review ───────────────────────────────────────
  signOff: authedQuery
    .input(
      z.object({
        id: z.string(),
        signedOffBy: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";

      await db
        .update(performanceReviews)
        .set({
          signedOffBy: input.signedOffBy,
          signedOffAt: new Date().toISOString(),
        })
        .where(eq(performanceReviews.id, input.id));

      auditLog({
        action: "performance:signOff",
        actor,
        resource: `review:${input.id}`,
        details: `Review signed off by ${input.signedOffBy}`,
      });

      return db.select().from(performanceReviews).where(eq(performanceReviews.id, input.id)).get();
    }),

  // ─── Delete review ─────────────────────────────────────────
  delete: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(performanceReviews).where(eq(performanceReviews.id, input.id));
      return { success: true };
    }),

  // ─── Dashboard stats ───────────────────────────────────────
  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const allReviews = await db.select().from(performanceReviews).all();
    const allPeople = await db.select().from(hrPeople).all();

    const byType = {
      "30-day": allReviews.filter((r) => r.reviewType === "30-day").length,
      "90-day": allReviews.filter((r) => r.reviewType === "90-day").length,
      annual: allReviews.filter((r) => r.reviewType === "annual").length,
      corrective: allReviews.filter((r) => r.reviewType === "corrective").length,
    };

    const byRating = {
      exceeds: allReviews.filter((r) => r.overallRating === "exceeds").length,
      meets: allReviews.filter((r) => r.overallRating === "meets").length,
      "needs-improvement": allReviews.filter((r) => r.overallRating === "needs-improvement").length,
      unsatisfactory: allReviews.filter((r) => r.overallRating === "unsatisfactory").length,
      unset: allReviews.filter((r) => !r.overallRating).length,
    };

    const pendingSignOff = allReviews.filter((r) => r.reviewedBy && !r.signedOffBy).length;

    // People without recent reviews
    const peopleWithReviews = new Set(allReviews.map((r) => r.personId));

    return {
      totalReviews: allReviews.length,
      byType,
      byRating,
      pendingSignOff,
      peopleWithReviews: peopleWithReviews.size,
      totalPeople: allPeople.length,
      peopleWithoutReviews: allPeople.length - peopleWithReviews.size,
    };
  }),
});
