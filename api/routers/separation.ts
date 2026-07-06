import { z } from "zod";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { separationChecklists, hrPeople } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  // ─── List all separation records ───────────────────────────
  listAll: publicQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const all = await db.select().from(separationChecklists).orderBy(desc(separationChecklists.createdAt)).all();
      if (input?.status) {
        return all.filter((s) => {
          if (input.status === "completed") return s.completed;
          if (input.status === "pending") return !s.completed;
          return true;
        });
      }
      return all;
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

  // ─── Dashboard / stats ─────────────────────────────────────
  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const allItems = await db.select().from(separationChecklists).all();
    const allPeople = await db.select().from(hrPeople).all();

    // Get unique people with separation records
    const personIds = new Set(allItems.map((i) => i.personId));
    const activeSeparations = Array.from(personIds).filter((pid) => {
      const personItems = allItems.filter((i) => i.personId === pid);
      return !personItems.every((i) => i.completed);
    });

    const completedSeparations = Array.from(personIds).filter((pid) => {
      const personItems = allItems.filter((i) => i.personId === pid);
      return personItems.length > 0 && personItems.every((i) => i.completed);
    });

    // Items by category
    const byCategory: Record<string, { total: number; completed: number }> = {};
    for (const item of allItems) {
      if (!byCategory[item.category]) byCategory[item.category] = { total: 0, completed: 0 };
      byCategory[item.category].total++;
      if (item.completed) byCategory[item.category].completed++;
    }

    return {
      totalItems: allItems.length,
      completedItems: allItems.filter((i) => i.completed).length,
      pendingItems: allItems.filter((i) => !i.completed).length,
      activeSeparations: activeSeparations.length,
      completedSeparations: completedSeparations.length,
      totalPeople: allPeople.length,
      peopleInSeparation: personIds.size,
      byCategory,
    };
  }),

  // ─── Initiate separation for a person ──────────────────────
  initiate: authedQuery
    .input(
      z.object({
        personId: z.string().min(1),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";

      // Create initial checklist items
      const defaultItems = [
        { itemId: "exit-interview", label: "Exit Interview Conducted", category: "HR" },
        { itemId: "equipment", label: "Equipment Returned (laptop, phone, keys)", category: "IT" },
        { itemId: "access-cards", label: "Access Cards / Badges Returned", category: "Security" },
        { itemId: "email-deactivated", label: "Email & System Accounts Deactivated", category: "IT" },
        { itemId: "final-paycheck", label: "Final Paycheck Processed", category: "Payroll" },
        { itemId: "benefits-term", label: "Benefits Termination Submitted", category: "HR" },
        { itemId: "cobra-notice", label: "COBRA Notice Sent", category: "HR" },
        { itemId: "reference-letter", label: "Reference Letter Provided (if eligible)", category: "HR" },
        { itemId: "file-archived", label: "Personnel File Archived", category: "HR" },
        { itemId: "turnover-doc", label: "Turnover Documentation Complete", category: "Supervisor" },
      ];

      const results = [];
      for (const item of defaultItems) {
        const id = randomUUID();
        await db.insert(separationChecklists).values({
          id,
          personId: input.personId,
          itemId: item.itemId,
          label: item.label,
          category: item.category,
          completed: false,
          notes: input.reason ?? null,
        });
        const created = await db.select().from(separationChecklists).where(eq(separationChecklists.id, id)).get();
        if (created) results.push(created);
      }

      auditLog({
        action: "separation:initiate",
        actor,
        resource: `person:${input.personId}`,
        details: `Separation initiated${input.reason ? ` - ${input.reason}` : ""}`,
      });

      return results;
    }),
});
