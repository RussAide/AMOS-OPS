import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { notifications } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const notificationsRouter = createRouter({
  list: publicQuery
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, input.userId))
        .orderBy(desc(notifications.createdAt))
        .all();
    }),

  create: publicQuery
    .input(
      z.object({
        userId: z.string(),
        type: z.enum(["status-change", "alert", "document", "training", "system"]),
        title: z.string().min(1),
        message: z.string().min(1),
        personName: z.string().optional(),
        moduleName: z.string().optional(),
        actionHref: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(notifications).values({
        id,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        personName: input.personName ?? null,
        moduleName: input.moduleName ?? null,
        actionHref: input.actionHref ?? null,
      });

      return db.select().from(notifications).where(eq(notifications.id, id)).get();
    }),

  markAsRead: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, input.id));
      return { success: true };
    }),

  markAllAsRead: publicQuery
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, input.userId));
      return { success: true };
    }),
});
