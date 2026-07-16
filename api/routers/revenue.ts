import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { claims, claimLineItems, payers } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

function generateClaimNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 999999).toString().padStart(6, "0");
  return `CLM-${year}-${seq}`;
}

export const revenueRouter = createRouter({
  // ─── Payers ────────────────────────────────────────────────

  listPayers: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(payers).where(eq(payers.isActive, true)).orderBy(payers.name).all();
  }),

  createPayer: publicQuery
    .input(z.object({
      name: z.string().min(1),
      payerType: z.enum(["insurance", "medicaid", "medicare", "self_pay", "other"]).default("insurance"),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      claimsAddress: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      await db.insert(payers).values({ id, ...input });
      return db.select().from(payers).where(eq(payers.id, id)).get();
    }),

  // ─── Claims CRUD ───────────────────────────────────────────

  listClaims: publicQuery
    .input(z.object({
      status: z.enum(["draft", "pending", "submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid", "write_off"]).optional(),
      patientId: z.string().optional(),
      payerId: z.string().optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(25),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params: {
        status?: "draft" | "pending" | "submitted" | "acknowledged" | "pending_review" | "approved" | "denied" | "appealed" | "paid" | "write_off";
        patientId?: string;
        payerId?: string;
        page?: number;
        pageSize?: number;
      } = input ?? {};
      const query = db.select().from(claims);

      const conditions = [];
      if (params.status) conditions.push(eq(claims.status, params.status));
      if (params.patientId) conditions.push(eq(claims.patientId, params.patientId));
      if (params.payerId) conditions.push(eq(claims.payerId, params.payerId));

      let results;
      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        results = await query.where(condition).orderBy(desc(claims.createdAt)).all();
      } else {
        results = await query.orderBy(desc(claims.createdAt)).all();
      }

      const total = results.length;
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 25;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      return { claims: paginated, total, page, pageSize };
    }),

  getClaim: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const claim = await db.select().from(claims).where(eq(claims.id, input.id)).get();
      if (!claim) return null;
      const lineItems = await db.select().from(claimLineItems).where(eq(claimLineItems.claimId, input.id)).all();
      return { ...claim, lineItems };
    }),

  createClaim: publicQuery
    .input(z.object({
      patientId: z.string(),
      payerId: z.string().optional(),
      clinicianId: z.string(),
      serviceDate: z.string(),
      totalAmount: z.number(), // cents
      notes: z.string().optional(),
      lineItems: z.array(z.object({
        serviceDate: z.string(),
        procedureCode: z.string(),
        diagnosisCode: z.string().optional(),
        units: z.number().int().positive().default(1),
        unitPrice: z.number(), // cents
        description: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const claimNumber = generateClaimNumber();

      await db.insert(claims).values({
        id,
        claimNumber,
        patientId: input.patientId,
        payerId: input.payerId ?? null,
        clinicianId: input.clinicianId,
        serviceDate: input.serviceDate,
        totalAmount: input.totalAmount,
        notes: input.notes ?? null,
      });

      if (input.lineItems) {
        for (const item of input.lineItems) {
          await db.insert(claimLineItems).values({
            id: randomUUID(),
            claimId: id,
            serviceDate: item.serviceDate,
            procedureCode: item.procedureCode,
            diagnosisCode: item.diagnosisCode ?? null,
            units: item.units,
            unitPrice: item.unitPrice,
            totalPrice: item.units * item.unitPrice,
            description: item.description ?? null,
          });
        }
      }

      return db.select().from(claims).where(eq(claims.id, id)).get();
    }),

  updateClaimStatus: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["draft", "pending", "submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid", "write_off"]),
      paidAmount: z.number().optional(),
      denialReason: z.string().optional(),
      denialCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();
      if (input.status === "submitted") setValues.submissionDate = new Date().toISOString();
      await db.update(claims).set(setValues).where(eq(claims.id, id));
      return db.select().from(claims).where(eq(claims.id, id)).get();
    }),

  // ─── Dashboard ─────────────────────────────────────────────

  dashboardKPIs: publicQuery.query(async () => {
    const db = getDb();
    const allClaims = await db.select().from(claims).all();

    const totalClaims = allClaims.length;
    const pendingClaims = allClaims.filter((c) => ["draft", "pending", "submitted", "acknowledged", "pending_review"].includes(c.status)).length;
    const approvedClaims = allClaims.filter((c) => c.status === "approved" || c.status === "paid").length;
    const deniedClaims = allClaims.filter((c) => c.status === "denied" || c.status === "appealed").length;
    const totalBilled = allClaims.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalCollected = allClaims.reduce((sum, c) => sum + (c.paidAmount ?? 0), 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    // Aging buckets (by submission date or creation date)
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
    const aging30 = allClaims.filter((c) => c.createdAt !== null && c.createdAt > d30 && ["submitted", "pending_review", "approved"].includes(c.status)).reduce((s, c) => s + c.totalAmount, 0);
    const aging60 = allClaims.filter((c) => c.createdAt !== null && c.createdAt <= d30 && c.createdAt > d60 && ["submitted", "pending_review", "approved"].includes(c.status)).reduce((s, c) => s + c.totalAmount, 0);
    const aging90 = allClaims.filter((c) => c.createdAt !== null && c.createdAt <= d60 && ["submitted", "pending_review", "approved"].includes(c.status)).reduce((s, c) => s + c.totalAmount, 0);

    return {
      totalClaims,
      pendingClaims,
      approvedClaims,
      deniedClaims,
      totalBilled,
      totalCollected,
      collectionRate,
      aging30,
      aging60,
      aging90,
    };
  }),
});
