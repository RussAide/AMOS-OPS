import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { separationChecklists } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const separationRouter = createRouter({
  // ─── Get checklist for a person ────────────────────────────
  getByPerson: publicQuery
    .input(z.object({ personId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(separationChecklists)
        .where(eq(separationChecklists.personId, input.personId))
        .all();
    }),

  // ─── Upsert a checklist item ───────────────────────────────
  upsertItem: publicQuery
    .input(
      z.object({
        personId: z.string().min(1),
        itemId: z.string().min(1),
        label: z.string().min(1),
        category: z.string().min(1),
        completed: z.boolean().default(false),
        completedBy: z.string().optional(),
        completedAt: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if item already exists
      const existing = await db
        .select()
        .from(separationChecklists)
        .where(
          and(
            eq(separationChecklists.personId, input.personId),
            eq(separationChecklists.itemId, input.itemId),
          ),
        )
        .get();

      if (existing) {
        await db
          .update(separationChecklists)
          .set({
            completed: input.completed,
            completedBy: input.completedBy ?? null,
            completedAt: input.completedAt ?? null,
            notes: input.notes ?? null,
          })
          .where(eq(separationChecklists.id, existing.id));
        return db.select().from(separationChecklists).where(eq(separationChecklists.id, existing.id)).get();
      }

      const id = randomUUID();
      await db.insert(separationChecklists).values({
        id,
        personId: input.personId,
        itemId: input.itemId,
        label: input.label,
        category: input.category,
        completed: input.completed,
        completedBy: input.completedBy ?? null,
        completedAt: input.completedAt ?? null,
        notes: input.notes ?? null,
      });
      return db.select().from(separationChecklists).where(eq(separationChecklists.id, id)).get();
    }),

  // ─── Bulk upsert all items ─────────────────────────────────
  bulkUpsert: publicQuery
    .input(
      z.array(
        z.object({
          personId: z.string().min(1),
          itemId: z.string().min(1),
          label: z.string().min(1),
          category: z.string().min(1),
          completed: z.boolean().default(false),
          completedBy: z.string().optional(),
          completedAt: z.string().optional(),
          notes: z.string().optional(),
        }),
      ),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const results = [];

      for (const item of input) {
        const existing = await db
          .select()
          .from(separationChecklists)
          .where(
            and(
              eq(separationChecklists.personId, item.personId),
              eq(separationChecklists.itemId, item.itemId),
            ),
          )
          .get();

        if (existing) {
          await db
            .update(separationChecklists)
            .set({
              completed: item.completed,
              completedBy: item.completedBy ?? null,
              completedAt: item.completedAt ?? null,
              notes: item.notes ?? null,
            })
            .where(eq(separationChecklists.id, existing.id));
          const updated = await db.select().from(separationChecklists).where(eq(separationChecklists.id, existing.id)).get();
          if (updated) results.push(updated);
        } else {
          const id = randomUUID();
          await db.insert(separationChecklists).values({
            id,
            personId: item.personId,
            itemId: item.itemId,
            label: item.label,
            category: item.category,
            completed: item.completed,
            completedBy: item.completedBy ?? null,
            completedAt: item.completedAt ?? null,
            notes: item.notes ?? null,
          });
          const created = await db.select().from(separationChecklists).where(eq(separationChecklists.id, id)).get();
          if (created) results.push(created);
        }
      }

      return results;
    }),

  // ─── Delete all items for a person ─────────────────────────
  clearByPerson: publicQuery
    .input(z.object({ personId: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .delete(separationChecklists)
        .where(eq(separationChecklists.personId, input.personId));
      return { success: true };
    }),
});
