import { z } from "zod";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { credentials, hrPeople } from "@db/schema";
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

  // ─── Get single credential ─────────────────────────────────
  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const cred = await db.select().from(credentials).where(eq(credentials.id, input.id)).get();
      if (!cred) throw new Error("Credential not found");
      return cred;
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

  // ─── Verify credential ─────────────────────────────────────
  verify: authedQuery
    .input(
      z.object({
        id: z.string(),
        verifiedBy: z.string().min(1),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";

      await db
        .update(credentials)
        .set({
          verifiedBy: input.verifiedBy,
          verifiedAt: new Date().toISOString(),
          status: "valid",
          notes: input.notes ?? null,
        })
        .where(eq(credentials.id, input.id));

      auditLog({
        action: "credentials:verify",
        actor,
        resource: `credential:${input.id}`,
        details: `Credential verified by ${input.verifiedBy}`,
      });

      return db.select().from(credentials).where(eq(credentials.id, input.id)).get();
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
    const pending = all.filter((c) => c.status === "pending");

    return {
      total: all.length,
      expired: expired.length,
      critical: critical.length,
      expiringSoon: expiring.length,
      valid: valid.length,
      pending: pending.length,
      items: all,
    };
  }),

  // ─── People with credential issues ─────────────────────────
  peopleWithIssues: publicQuery.query(async () => {
    const db = getDb();
    const allCreds = await db.select().from(credentials).all();
    const allPeople = await db.select().from(hrPeople).all();

    const expiredOrExpiring = allCreds.filter(
      (c) => c.status === "expired" || c.status === "expiring"
    );

    const personIds = new Set(expiredOrExpiring.map((c) => c.personId));
    const affectedPeople = allPeople
      .filter((p) => personIds.has(p.id))
      .map((p) => ({
        personId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        role: p.role,
        issues: expiredOrExpiring
          .filter((c) => c.personId === p.id)
          .map((c) => ({
            credentialId: c.id,
            credentialType: c.credentialType,
            status: c.status,
            expiryDate: c.expiryDate,
          })),
      }));

    return affectedPeople;
  }),
});
