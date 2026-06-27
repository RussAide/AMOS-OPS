import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { auditLogs } from "@db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

export const auditRouter = createRouter({
  // ─── List audit logs ───────────────────────────────────────
  list: publicQuery
    .input(
      z.object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        action: z.string().optional(),
        fromDate: z.string().optional(),
        limit: z.number().min(1).max(500).optional().default(100),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(auditLogs);

      const conditions = [];
      if (input?.entityType) {
        conditions.push(eq(auditLogs.entityType, input.entityType));
      }
      if (input?.entityId) {
        conditions.push(eq(auditLogs.entityId, input.entityId));
      }
      if (input?.action) {
        conditions.push(eq(auditLogs.action, input.action));
      }
      if (input?.fromDate) {
        conditions.push(gte(auditLogs.performedAt, input.fromDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      return query.orderBy(desc(auditLogs.performedAt)).limit(input?.limit ?? 100).all();
    }),

  // ─── Create audit entry ────────────────────────────────────
  create: publicQuery
    .input(
      z.object({
        entityType: z.string().min(1),
        entityId: z.string().min(1),
        action: z.string().min(1),
        performedBy: z.string().min(1),
        oldValues: z.string().optional(),
        newValues: z.string().optional(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(auditLogs).values({
        id,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        performedBy: input.performedBy,
        oldValues: input.oldValues ?? null,
        newValues: input.newValues ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });

      return db.select().from(auditLogs).where(eq(auditLogs.id, id)).get();
    }),

  // ─── Stats summary ─────────────────────────────────────────
  stats: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(auditLogs).all();

    const byEntity: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const log of all) {
      byEntity[log.entityType] = (byEntity[log.entityType] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      const day = log.performedAt?.slice(0, 10) || "unknown";
      byDay[day] = (byDay[day] || 0) + 1;
    }

    return {
      total: all.length,
      byEntity,
      byAction,
      byDay,
      recent: all.slice(0, 10),
    };
  }),
});
