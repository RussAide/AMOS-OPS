import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { credentials } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const credentialsRouter = createRouter({
  // ─── List credentials ──────────────────────────────────────
  list: publicQuery
    .input(z.object({ personId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.personId) {
        return db
          .select()
          .from(credentials)
          .where(eq(credentials.personId, input.personId))
          .orderBy(desc(credentials.createdAt))
          .all();
      }
      return db.select().from(credentials).orderBy(desc(credentials.createdAt)).all();
    }),

  // ─── Create credential ─────────────────────────────────────
  create: publicQuery
    .input(
      z.object({
        personId: z.string().min(1),
        credentialType: z.string().min(1),
        licenseNumber: z.string().optional(),
        issuingBody: z.string().optional(),
        issueDate: z.string().optional(),
        expiryDate: z.string().optional(),
        status: z.enum(["valid", "expiring", "expired", "pending"]).default("pending"),
        documentId: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(credentials).values({
        id,
        personId: input.personId,
        credentialType: input.credentialType,
        licenseNumber: input.licenseNumber ?? null,
        issuingBody: input.issuingBody ?? null,
        issueDate: input.issueDate ?? null,
        expiryDate: input.expiryDate ?? null,
        status: input.status,
        documentId: input.documentId ?? null,
        notes: input.notes ?? null,
      });

      return db.select().from(credentials).where(eq(credentials.id, id)).get();
    }),

  // ─── Update credential ─────────────────────────────────────
  update: publicQuery
    .input(
      z.object({
        id: z.string(),
        credentialType: z.string().optional(),
        licenseNumber: z.string().optional(),
        issuingBody: z.string().optional(),
        issueDate: z.string().optional(),
        expiryDate: z.string().optional(),
        status: z.enum(["valid", "expiring", "expired", "pending"]).optional(),
        notes: z.string().optional(),
        verifiedBy: z.string().optional(),
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
      if (updates.verifiedBy) {
        setData.verifiedAt = new Date().toISOString();
      }

      await db.update(credentials).set(setData).where(eq(credentials.id, id));
      return db.select().from(credentials).where(eq(credentials.id, id)).get();
    }),

  // ─── Delete credential ─────────────────────────────────────
  delete: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(credentials).where(eq(credentials.id, input.id));
      return { success: true };
    }),

  // ─── Dashboard summary ─────────────────────────────────────
  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(credentials).all();

    const expired = all.filter((c) => c.status === "expired");
    const critical = all.filter((c) => c.status === "expiring");
    const expiring = all.filter((c) => {
      if (!c.expiryDate) return false;
      const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
      return c.status === "valid" && days <= 90;
    });
    const valid = all.filter((c) => c.status === "valid");

    return {
      total: all.length,
      expired: expired.length,
      critical: critical.length,
      expiringSoon: expiring.length,
      valid: valid.length,
      items: all,
    };
  }),
});
