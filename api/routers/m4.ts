import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { claims as claimsTable, claimLineItems as lineItemsTable, payers as payersTable, authorizations as authzTable } from "@db/schema";
import { eq, like, and, or, desc, sql, isNull, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── M4: Revenue Cycle — AMOS-Revenue ──────────────────────

export const m4Router = createRouter({
  // ════════════════════════════════════════════════════════════
  // 1. PAYERS
  // ════════════════════════════════════════════════════════════

  listPayers: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(payersTable).orderBy(payersTable.name).all();
  }),

  // ════════════════════════════════════════════════════════════
  // 2. CLAIMS — List / View
  // ════════════════════════════════════════════════════════════

  listClaims: publicQuery
    .input(z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(25),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.status) conditions.push(eq(claimsTable.status, input.status));
      if (input?.search) {
        conditions.push(or(
          like(claimsTable.claimNumber, `%${input.search}%`),
          like(claimsTable.patientId, `%${input.search}%`),
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(claimsTable).where(and(...conditions)).orderBy(desc(claimsTable.createdAt)).all()
        : await db.select().from(claimsTable).orderBy(desc(claimsTable.createdAt)).all();

      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 25;
      const total = results.length;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      // Enrich with payer name
      const payers = await db.select().from(payersTable).all();
      const payerMap = new Map(payers.map((p) => [p.id, p.name]));

      return {
        claims: paginated.map((c) => ({
          ...c,
          payerName: payerMap.get(c.payerId ?? "") ?? "Unknown",
          balance: (c.totalAmount ?? 0) - (c.paidAmount ?? 0),
        })),
        total,
        page,
        pageSize,
      };
    }),

  getClaim: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const claim = await db.select().from(claimsTable).where(eq(claimsTable.id, input.id)).get();
      if (!claim) throw new Error("Claim not found");

      // Get line items
      const lineItems = await db.select().from(lineItemsTable)
        .where(eq(lineItemsTable.claimId, input.id))
        .orderBy(lineItemsTable.serviceDate).all();

      // Get payer
      const payer = claim.payerId
        ? await db.select().from(payersTable).where(eq(payersTable.id, claim.payerId)).get()
        : null;

      return {
        ...claim,
        payerName: payer?.name ?? "Unknown",
        lineItems,
        balance: (claim.totalAmount ?? 0) - (claim.paidAmount ?? 0),
      };
    }),

  createClaim: authedQuery
    .input(z.object({
      claimNumber: z.string(),
      patientId: z.string(),
      payerId: z.string().optional(),
      clinicianId: z.string(),
      serviceDate: z.string(),
      totalAmount: z.number(), // cents
      lineItems: z.array(z.object({
        serviceDate: z.string(),
        procedureCode: z.string(),
        diagnosisCode: z.string().optional(),
        units: z.number().default(1),
        unitPrice: z.number(), // cents
        totalPrice: z.number(), // cents
        description: z.string().optional(),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(claimsTable).values({
        id, claimNumber: input.claimNumber, patientId: input.patientId,
        payerId: input.payerId ?? null, clinicianId: input.clinicianId,
        serviceDate: input.serviceDate, submissionDate: null,
        status: "draft", totalAmount: input.totalAmount,
        allowedAmount: null, paidAmount: null, patientResponsibility: null,
        denialReason: null, denialCode: null, appealDate: null,
        appealStatus: "not_appealed", notes: null,
        createdAt: now, updatedAt: now,
      });

      // Insert line items
      for (const item of input.lineItems) {
        await db.insert(lineItemsTable).values({
          id: randomUUID(), claimId: id,
          serviceDate: item.serviceDate, procedureCode: item.procedureCode,
          diagnosisCode: item.diagnosisCode ?? null,
          units: item.units, unitPrice: item.unitPrice,
          totalPrice: item.totalPrice, description: item.description ?? null,
          createdAt: now,
        });
      }

      auditLog({ action: "m4:createClaim", actor, resource: `claim:${input.claimNumber}`, details: `Created claim for ${input.patientId}` });
      return { success: true, id };
    }),

  updateClaim: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["draft", "pending", "submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid", "write_off"]).optional(),
      totalAmount: z.number().optional(),
      paidAmount: z.number().optional(),
      denialReason: z.string().optional(),
      denialCode: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...updates } = input;
      const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };

      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === "submitted") updateData.submissionDate = new Date().toISOString();
      }
      if (updates.totalAmount !== undefined) updateData.totalAmount = updates.totalAmount;
      if (updates.paidAmount !== undefined) updateData.paidAmount = updates.paidAmount;
      if (updates.denialReason !== undefined) updateData.denialReason = updates.denialReason;
      if (updates.denialCode !== undefined) updateData.denialCode = updates.denialCode;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await db.update(claimsTable).set(updateData).where(eq(claimsTable.id, id));
      auditLog({ action: "m4:updateClaim", actor, resource: `claim:${id}`, details: `Updated claim` });
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 3. CLAIM SUBMISSION — Submit draft claims to payers
  // ════════════════════════════════════════════════════════════

  listSubmittableClaims: authedQuery.query(async () => {
    const db = getDb();
    // Claims in draft or pending status that are ready to submit
    const results = await db.select().from(claimsTable)
      .where(or(eq(claimsTable.status, "draft"), eq(claimsTable.status, "pending")))
      .orderBy(desc(claimsTable.createdAt)).all();

    const payers = await db.select().from(payersTable).all();
    const payerMap = new Map(payers.map((p) => [p.id, p.name]));

    return results.map((c) => ({
      ...c,
      payerName: payerMap.get(c.payerId ?? "") ?? "Unknown",
      balance: (c.totalAmount ?? 0) - (c.paidAmount ?? 0),
    }));
  }),

  submitClaim: authedQuery
    .input(z.object({
      id: z.string(),
      submissionMethod: z.enum(["portal", "fax", "email", "phone"]).default("portal"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();

      const claim = await db.select().from(claimsTable).where(eq(claimsTable.id, input.id)).get();
      if (!claim) throw new Error("Claim not found");
      if (claim.status !== "draft" && claim.status !== "pending") {
        throw new Error(`Cannot submit claim in status: ${claim.status}`);
      }

      await db.update(claimsTable).set({
        status: "submitted",
        submissionDate: now,
        notes: input.notes ?? claim.notes,
        updatedAt: now,
      }).where(eq(claimsTable.id, input.id));

      auditLog({ action: "m4:submitClaim", actor, resource: `claim:${input.id}`, details: `Submitted via ${input.submissionMethod}` });
      return { success: true, submissionDate: now };
    }),

  batchSubmitClaims: authedQuery
    .input(z.object({
      ids: z.array(z.string()),
      submissionMethod: z.enum(["portal", "fax", "email", "phone"]).default("portal"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();
      let submitted = 0;

      for (const id of input.ids) {
        const claim = await db.select().from(claimsTable).where(eq(claimsTable.id, id)).get();
        if (claim && (claim.status === "draft" || claim.status === "pending")) {
          await db.update(claimsTable).set({
            status: "submitted", submissionDate: now, updatedAt: now,
          }).where(eq(claimsTable.id, id));
          submitted++;
        }
      }

      auditLog({ action: "m4:batchSubmitClaims", actor, resource: `claims:${input.ids.join(",")}`, details: `Batch submitted ${submitted} claims via ${input.submissionMethod}` });
      return { success: true, submitted };
    }),

  // ════════════════════════════════════════════════════════════
  // 4. AUTHORIZATION MANAGEMENT
  // ════════════════════════════════════════════════════════════

  listAuthorizations: authedQuery
    .input(z.object({
      status: z.string().optional(),
      stage: z.string().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(25),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.status) conditions.push(eq(authzTable.status, input.status as any));
      if (input?.stage) conditions.push(eq(authzTable.stage, input.stage as any));
      if (input?.search) {
        conditions.push(or(
          like(authzTable.youthName, `%${input.search}%`),
          like(authzTable.mrn, `%${input.search}%`),
          like(authzTable.payerName, `%${input.search}%`),
        ));
      }

      const results = conditions.length > 0
        ? await db.select().from(authzTable).where(and(...conditions)).orderBy(desc(authzTable.createdAt)).all()
        : await db.select().from(authzTable).orderBy(desc(authzTable.createdAt)).all();

      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 25;
      const total = results.length;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      return { authorizations: paginated, total, page, pageSize };
    }),

  getAuthorization: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const authz = await db.select().from(authzTable).where(eq(authzTable.id, input.id)).get();
      if (!authz) throw new Error("Authorization not found");
      return authz;
    }),

  createAuthorization: authedQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      payerName: z.string(),
      policyNumber: z.string().optional(),
      stage: z.enum(["readiness", "submission", "tracking", "reauthorization", "retrospective"]).default("readiness"),
      status: z.enum(["pending", "in_progress", "submitted", "approved", "denied", "appealed", "expired", "closed"]).default("pending"),
      approvedLevelOfCare: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(authzTable).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        payerName: input.payerName,
        policyNumber: input.policyNumber ?? null,
        stage: input.stage,
        status: input.status,
        approvedLevelOfCare: input.approvedLevelOfCare ?? null,
        createdBy: actor,
        createdAt: now,
        updatedAt: now,
      });

      auditLog({ action: "m4:createAuthorization", actor, resource: `authz:${id}`, details: `Auth for ${input.youthName}` });
      return { success: true, id };
    }),

  updateAuthorization: authedQuery
    .input(z.object({
      id: z.string(),
      stage: z.enum(["readiness", "submission", "tracking", "reauthorization", "retrospective"]).optional(),
      status: z.enum(["pending", "in_progress", "submitted", "approved", "denied", "appealed", "expired", "closed"]).optional(),
      // Readiness checkboxes
      readinessClinicalDocs: z.boolean().optional(),
      readinessAssessmentCurrent: z.boolean().optional(),
      readinessLOCSupported: z.boolean().optional(),
      readinessTreatmentPlan: z.boolean().optional(),
      readinessProgressNotes: z.boolean().optional(),
      readinessMedicalNecessity: z.boolean().optional(),
      readinessUtilizationReview: z.boolean().optional(),
      readinessGuardianConsent: z.boolean().optional(),
      readinessUB04Clean: z.boolean().optional(),
      readinessExcludedServices: z.boolean().optional(),
      // Submission fields
      submissionDate: z.string().optional(),
      submissionMethod: z.enum(["portal", "fax", "email", "phone"]).optional(),
      submissionReference: z.string().optional(),
      submittedBy: z.string().optional(),
      // Approval fields
      authorizationNumber: z.string().optional(),
      approvedUnits: z.number().optional(),
      approvedFromDate: z.string().optional(),
      approvedToDate: z.string().optional(),
      approvedLevelOfCare: z.string().optional(),
      // Denial / Appeal
      denialReason: z.string().optional(),
      appealDate: z.string().optional(),
      appealStatus: z.string().optional(),
      // Reauth
      reauthDueDate: z.string().optional(),
      reauthStatus: z.enum(["not_due", "upcoming", "overdue", "submitted", "approved"]).optional(),
      daysUntilExpiration: z.number().optional(),
      // Retrospective
      retrospectiveReviewDate: z.string().optional(),
      retrospectiveFindings: z.string().optional(),
      retrospectiveActions: z.string().optional(),
      billingExcludedServices: z.string().optional(),
      exclusionControlsApplied: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...updates } = input;
      const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };

      // Build update dynamically
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) updateData[key] = value;
      }

      // Auto-calculate readinessMetAt if all readiness fields are true
      const allReadinessFields = [
        "readinessClinicalDocs", "readinessAssessmentCurrent", "readinessLOCSupported",
        "readinessTreatmentPlan", "readinessProgressNotes", "readinessMedicalNecessity",
        "readinessUtilizationReview", "readinessGuardianConsent", "readinessUB04Clean", "readinessExcludedServices",
      ];
      if (allReadinessFields.some((f) => f in updates)) {
        const current = await db.select().from(authzTable).where(eq(authzTable.id, id)).get();
        if (current) {
          const allMet = allReadinessFields.every((f) => updateData[f] ?? (current as any)[f]);
          if (allMet && !current.readinessMetAt) updateData.readinessMetAt = new Date().toISOString();
        }
      }

      if (updates.submissionDate) updateData.submittedBy = actor;

      await db.update(authzTable).set(updateData).where(eq(authzTable.id, id));
      auditLog({ action: "m4:updateAuthorization", actor, resource: `authz:${id}`, details: `Updated authorization` });
      return { success: true };
    }),

  deleteAuthorization: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      await db.delete(authzTable).where(eq(authzTable.id, input.id));
      auditLog({ action: "m4:deleteAuthorization", actor, resource: `authz:${input.id}`, details: `Deleted authorization` });
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 5. PAYER PACKET BUILDER
  // ════════════════════════════════════════════════════════════

  getPayerPacketRequirements: authedQuery
    .input(z.object({ payerId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const payer = await db.select().from(payersTable).where(eq(payersTable.id, input.payerId)).get();
      if (!payer) throw new Error("Payer not found");

      // Return packet requirements based on payer type
      const requirements = [
        { document: "UB-04 Claim Form", required: true, category: "billing" },
        { document: "Itemized Statement", required: true, category: "billing" },
        { document: "Treatment Plan", required: true, category: "clinical" },
        { document: "Initial Assessment", required: true, category: "clinical" },
        { document: "Progress Notes (Current)", required: true, category: "clinical" },
        { document: "Medical Necessity Letter", required: payer.payerType === "medicaid", category: "clinical" },
        { document: "Level of Care Determination", required: payer.payerType === "medicaid", category: "clinical" },
        { document: "Guardian Consent Form", required: true, category: "legal" },
        { document: "Authorization for Release of Info", required: true, category: "legal" },
        { document: "Utilization Review Summary", required: payer.payerType !== "self_pay", category: "review" },
        { document: "Excluded Services Acknowledgment", required: true, category: "billing" },
        { document: "Proof of Service Documentation", required: true, category: "compliance" },
      ];

      return { payer, requirements };
    }),

  buildPayerPacket: authedQuery
    .input(z.object({
      claimId: z.string(),
      documentsIncluded: z.array(z.object({
        documentType: z.string(),
        documentId: z.string().optional(),
        status: z.enum(["included", "missing", "pending", "waived"]),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();

      const claim = await db.select().from(claimsTable).where(eq(claimsTable.id, input.claimId)).get();
      if (!claim) throw new Error("Claim not found");

      const included = input.documentsIncluded.filter((d) => d.status === "included").length;
      const missing = input.documentsIncluded.filter((d) => d.status === "missing").length;

      // Store packet as JSON on the claim notes field for simplicity
      const packetJson = JSON.stringify({
        builtAt: now,
        builtBy: actor,
        documents: input.documentsIncluded,
        summary: { included, missing, total: input.documentsIncluded.length },
      });

      await db.update(claimsTable).set({
        notes: `PACKET:\n${packetJson}`,
        updatedAt: now,
      }).where(eq(claimsTable.id, input.claimId));

      auditLog({ action: "m4:buildPayerPacket", actor, resource: `claim:${input.claimId}`, details: `Packet: ${included} included, ${missing} missing` });
      return { success: true, packetSummary: { included, missing, total: input.documentsIncluded.length } };
    }),

  listPayerPackets: authedQuery.query(async () => {
    const db = getDb();
    const allClaims = await db.select().from(claimsTable)
      .where(sql`${claimsTable.notes} LIKE 'PACKET:%'`)
      .orderBy(desc(claimsTable.updatedAt)).all();

    const payers = await db.select().from(payersTable).all();
    const payerMap = new Map(payers.map((p) => [p.id, p.name]));

    return allClaims.map((c) => {
      let packetData = null;
      try {
        const jsonStr = c.notes?.replace("PACKET:\n", "");
        if (jsonStr) packetData = JSON.parse(jsonStr);
      } catch { /* ignore parse errors */ }

      return {
        claimId: c.id,
        claimNumber: c.claimNumber,
        patientId: c.patientId,
        payerName: payerMap.get(c.payerId ?? "") ?? "Unknown",
        builtAt: packetData?.builtAt ?? c.updatedAt,
        builtBy: packetData?.builtBy ?? "Unknown",
        summary: packetData?.summary ?? { included: 0, missing: 0, total: 0 },
        packetData,
      };
    });
  }),

  // ════════════════════════════════════════════════════════════
  // 6. DENIAL MANAGEMENT
  // ════════════════════════════════════════════════════════════

  listDeniedClaims: authedQuery.query(async () => {
    const db = getDb();
    const results = await db.select().from(claimsTable)
      .where(or(eq(claimsTable.status, "denied"), eq(claimsTable.status, "appealed")))
      .orderBy(desc(claimsTable.updatedAt)).all();

    const payers = await db.select().from(payersTable).all();
    const payerMap = new Map(payers.map((p) => [p.id, p.name]));

    return results.map((c) => ({
      ...c,
      payerName: payerMap.get(c.payerId ?? "") ?? "Unknown",
      balance: (c.totalAmount ?? 0) - (c.paidAmount ?? 0),
    }));
  }),

  appealClaim: authedQuery
    .input(z.object({
      id: z.string(),
      appealReason: z.string(),
      appealDocumentation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();

      const claim = await db.select().from(claimsTable).where(eq(claimsTable.id, input.id)).get();
      if (!claim) throw new Error("Claim not found");
      if (claim.status !== "denied") throw new Error("Only denied claims can be appealed");

      await db.update(claimsTable).set({
        status: "appealed",
        appealDate: now,
        appealStatus: "in_review",
        notes: `${claim.notes ?? ""}\n[APPEAL ${now}] Reason: ${input.appealReason}${input.appealDocumentation ? `\nDocs: ${input.appealDocumentation}` : ""}`,
        updatedAt: now,
      }).where(eq(claimsTable.id, input.id));

      auditLog({ action: "m4:appealClaim", actor, resource: `claim:${input.id}`, details: `Appealed: ${input.appealReason}` });
      return { success: true, appealDate: now };
    }),

  updateAppealStatus: authedQuery
    .input(z.object({
      id: z.string(),
      appealStatus: z.enum(["not_appealed", "in_review", "approved", "denied"]),
      resolution: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();

      await db.update(claimsTable).set({
        appealStatus: input.appealStatus,
        status: input.appealStatus === "approved" ? "approved" : input.appealStatus === "denied" ? "denied" : "appealed",
        notes: input.resolution ?? undefined,
        updatedAt: now,
      }).where(eq(claimsTable.id, input.id));

      auditLog({ action: "m4:updateAppealStatus", actor, resource: `claim:${input.id}`, details: `Appeal status: ${input.appealStatus}` });
      return { success: true };
    }),

  getDenialAnalytics: authedQuery.query(async () => {
    const db = getDb();
    const deniedClaims = await db.select().from(claimsTable)
      .where(or(eq(claimsTable.status, "denied"), eq(claimsTable.status, "appealed")))
      .all();

    // Group by denial code
    const byCode: Record<string, { count: number; totalAmount: number; reason: string }> = {};
    for (const c of deniedClaims) {
      const code = c.denialCode ?? "UNKNOWN";
      if (!byCode[code]) byCode[code] = { count: 0, totalAmount: 0, reason: c.denialReason ?? "Unknown reason" };
      byCode[code].count++;
      byCode[code].totalAmount += c.totalAmount ?? 0;
    }

    // Group by payer
    const payers = await db.select().from(payersTable).all();
    const payerMap = new Map(payers.map((p) => [p.id, p.name]));
    const byPayer: Record<string, { count: number; name: string }> = {};
    for (const c of deniedClaims) {
      const pid = c.payerId ?? "unknown";
      if (!byPayer[pid]) byPayer[pid] = { count: 0, name: payerMap.get(pid) ?? "Unknown" };
      byPayer[pid].count++;
    }

    return {
      totalDenied: deniedClaims.length,
      totalDeniedAmount: deniedClaims.reduce((s, c) => s + (c.totalAmount ?? 0), 0),
      appealedCount: deniedClaims.filter((c) => c.status === "appealed").length,
      byCode: Object.entries(byCode).map(([code, data]) => ({ code, ...data })),
      byPayer: Object.entries(byPayer).map(([_, data]) => data),
    };
  }),

  // ════════════════════════════════════════════════════════════
  // 7. AGING QUEUE
  // ════════════════════════════════════════════════════════════

  agingReport: publicQuery.query(async () => {
    const db = getDb();
    const allClaims = await db.select().from(claimsTable)
      .where(and(
        sql`${claimsTable.status} IN ('submitted', 'acknowledged', 'pending_review', 'denied', 'appealed')`,
      )).all();

    const now = new Date();
    const buckets = {
      current: { label: "0-30 Days", total: 0, count: 0, claims: [] as any[] },
      aging31: { label: "31-60 Days", total: 0, count: 0, claims: [] as any[] },
      aging61: { label: "61-90 Days", total: 0, count: 0, claims: [] as any[] },
      aging91: { label: "91-120 Days", total: 0, count: 0, claims: [] as any[] },
      aging121: { label: "120+ Days", total: 0, count: 0, claims: [] as any[] },
    };

    const payers = await db.select().from(payersTable).all();
    const payerMap = new Map(payers.map((p) => [p.id, p.name]));

    for (const claim of allClaims) {
      const serviceDate = new Date(claim.serviceDate);
      const daysDiff = Math.floor((now.getTime() - serviceDate.getTime()) / (1000 * 60 * 60 * 24));
      const balance = (claim.totalAmount ?? 0) - (claim.paidAmount ?? 0);
      const enriched = { ...claim, payerName: payerMap.get(claim.payerId ?? "") ?? "Unknown", balance, daysDiff };

      if (daysDiff <= 30) { buckets.current.total += balance; buckets.current.count++; buckets.current.claims.push(enriched); }
      else if (daysDiff <= 60) { buckets.aging31.total += balance; buckets.aging31.count++; buckets.aging31.claims.push(enriched); }
      else if (daysDiff <= 90) { buckets.aging61.total += balance; buckets.aging61.count++; buckets.aging61.claims.push(enriched); }
      else if (daysDiff <= 120) { buckets.aging91.total += balance; buckets.aging91.count++; buckets.aging91.claims.push(enriched); }
      else { buckets.aging121.total += balance; buckets.aging121.count++; buckets.aging121.claims.push(enriched); }
    }

    return {
      buckets: Object.values(buckets).map((b) => ({
        label: b.label,
        total: b.total,
        count: b.count,
      })),
      detailClaims: [
        ...buckets.current.claims,
        ...buckets.aging31.claims,
        ...buckets.aging61.claims,
        ...buckets.aging91.claims,
        ...buckets.aging121.claims,
      ],
    };
  }),

  agingQueueByPayer: authedQuery.query(async () => {
    const db = getDb();
    const allClaims = await db.select().from(claimsTable)
      .where(and(
        sql`${claimsTable.status} IN ('submitted', 'acknowledged', 'pending_review', 'denied', 'appealed')`,
      )).all();

    const payers = await db.select().from(payersTable).all();
    const payerMap = new Map(payers.map((p) => [p.id, { name: p.name, type: p.payerType }]));
    const now = new Date();

    const byPayer: Record<string, { payerName: string; payerType: string; total: number; count: number; buckets: Record<string, number> }> = {};

    for (const claim of allClaims) {
      const pid = claim.payerId ?? "unknown";
      const payerInfo = payerMap.get(pid) ?? { name: "Unknown", type: "other" };
      if (!byPayer[pid]) {
        byPayer[pid] = { payerName: payerInfo.name, payerType: payerInfo.type, total: 0, count: 0, buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "120+": 0 } };
      }
      const daysDiff = Math.floor((now.getTime() - new Date(claim.serviceDate).getTime()) / (1000 * 60 * 60 * 24));
      const balance = (claim.totalAmount ?? 0) - (claim.paidAmount ?? 0);
      byPayer[pid].total += balance;
      byPayer[pid].count++;

      if (daysDiff <= 30) byPayer[pid].buckets["0-30"] += balance;
      else if (daysDiff <= 60) byPayer[pid].buckets["31-60"] += balance;
      else if (daysDiff <= 90) byPayer[pid].buckets["61-90"] += balance;
      else if (daysDiff <= 120) byPayer[pid].buckets["91-120"] += balance;
      else byPayer[pid].buckets["120+"] += balance;
    }

    return Object.values(byPayer);
  }),

  // ════════════════════════════════════════════════════════════
  // 8. PROOF-OF-SERVICE GATE
  // ════════════════════════════════════════════════════════════

  getProofOfServiceStatus: authedQuery
    .input(z.object({ claimId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const claim = await db.select().from(claimsTable).where(eq(claimsTable.id, input.claimId)).get();
      if (!claim) throw new Error("Claim not found");

      const lineItems = await db.select().from(lineItemsTable)
        .where(eq(lineItemsTable.claimId, input.claimId)).all();

      // Simulate proof-of-service checks based on line items and claim data
      const checks = [
        { gate: "Service Date Valid", passed: !!claim.serviceDate, required: true, category: "validation" },
        { gate: "Procedure Codes Present", passed: lineItems.length > 0 && lineItems.every((li) => li.procedureCode), required: true, category: "validation" },
        { gate: "Diagnosis Codes Linked", passed: lineItems.every((li) => li.diagnosisCode), required: true, category: "clinical" },
        { gate: "Units Match Duration", passed: lineItems.every((li) => li.units > 0 && li.totalPrice === li.units * li.unitPrice), required: true, category: "validation" },
        { gate: "Clinician Identified", passed: !!claim.clinicianId, required: true, category: "compliance" },
        { gate: "Payer Assigned", passed: !!claim.payerId, required: true, category: "billing" },
        { gate: "Line Items Totals Match", passed: lineItems.reduce((s, li) => s + li.totalPrice, 0) === claim.totalAmount, required: true, category: "validation" },
        { gate: "No Duplicate Procedures", passed: new Set(lineItems.map((li) => li.procedureCode)).size === lineItems.length, required: false, category: "validation" },
        { gate: "UB-04 Data Complete", passed: claim.totalAmount > 0 && !!claim.serviceDate, required: true, category: "billing" },
        { gate: "HIPAA Format Check", passed: lineItems.every((li) => li.procedureCode.length >= 5), required: true, category: "compliance" },
      ];

      const passed = checks.filter((c) => c.passed).length;
      const requiredPassed = checks.filter((c) => c.required && c.passed).length;
      const requiredTotal = checks.filter((c) => c.required).length;
      const allRequiredPassed = requiredPassed === requiredTotal;

      return {
        claimId: input.claimId,
        claimNumber: claim.claimNumber,
        status: allRequiredPassed ? "cleared" : "blocked",
        checks,
        summary: { passed, total: checks.length, requiredPassed, requiredTotal },
        clearedAt: allRequiredPassed ? new Date().toISOString() : null,
      };
    }),

  // ════════════════════════════════════════════════════════════
  // DASHBOARD KPIs
  // ════════════════════════════════════════════════════════════

  dashboardKPIs: publicQuery.query(async () => {
    const db = getDb();
    const allClaims = await db.select().from(claimsTable).all();

    const totalClaims = allClaims.length;
    const totalBilled = allClaims.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
    const totalCollected = allClaims.reduce((sum, c) => sum + (c.paidAmount ?? 0), 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    const byStatus: Record<string, number> = {};
    for (const c of allClaims) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    }

    // Calculate aging
    const now = new Date();
    let aging30 = 0, aging60 = 0, aging90 = 0;
    for (const c of allClaims) {
      if (c.status === "paid" || c.status === "write_off") continue;
      const days = Math.floor((now.getTime() - new Date(c.serviceDate).getTime()) / (1000 * 60 * 60 * 24));
      const balance = (c.totalAmount ?? 0) - (c.paidAmount ?? 0);
      if (days <= 30) aging30 += balance;
      else if (days <= 60) aging60 += balance;
      else aging90 += balance;
    }

    return {
      totalClaims,
      totalBilled,
      totalCollected,
      collectionRate,
      pendingClaims: byStatus.pending ?? 0,
      submittedClaims: byStatus.submitted ?? 0,
      approvedClaims: byStatus.approved ?? 0,
      deniedClaims: byStatus.denied ?? 0,
      paidClaims: byStatus.paid ?? 0,
      appealedClaims: byStatus.appealed ?? 0,
      aging30,
      aging60,
      aging90,
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedRevenueData: publicQuery.mutation(async () => {
    const db = getDb();
    const now = new Date();
    const iso = now.toISOString();

    // Seed payers
    const existingPayers = await db.select().from(payersTable).limit(1);
    if (existingPayers.length > 0) return { success: true, message: "Already seeded" };

    const payerData = [
      { id: "payer-001", name: "Texas Medicaid (HHSC)", payerType: "medicaid" as const, contactPhone: "1-800-925-9126", contactEmail: "provider@hhsc.state.tx.us", claimsAddress: "Texas Medicaid, PO Box 149021, Austin, TX 78714" },
      { id: "payer-002", name: "Superior HealthPlan", payerType: "insurance" as const, contactPhone: "1-800-783-5386", contactEmail: "claims@superiorhealthplan.com", claimsAddress: "Superior HealthPlan, 5900 E. Ben White Blvd, Austin, TX 78741" },
      { id: "payer-003", name: "Blue Cross Blue Shield of Texas", payerType: "insurance" as const, contactPhone: "1-800-451-0287", contactEmail: "claims@bcbstx.com", claimsAddress: "BCBSTX, PO Box 660044, Dallas, TX 75266" },
      { id: "payer-004", name: "Self Pay / Private", payerType: "self_pay" as const },
    ];
    for (const p of payerData) await db.insert(payersTable).values(p);

    // Seed claims with realistic data
    const claimData = [
      { id: "clm-001", claimNumber: "CLM-2026-000001", patientId: "youth-001", payerId: "payer-001", clinicianId: "user-cm-001", serviceDate: "2026-06-20", submissionDate: "2026-06-21", status: "paid" as const, totalAmount: 12500, allowedAmount: 12000, paidAmount: 12000, patientResponsibility: 0 },
      { id: "clm-002", claimNumber: "CLM-2026-000002", patientId: "youth-001", payerId: "payer-001", clinicianId: "user-cm-001", serviceDate: "2026-06-22", submissionDate: "2026-06-23", status: "paid" as const, totalAmount: 12500, allowedAmount: 12000, paidAmount: 12000, patientResponsibility: 0 },
      { id: "clm-003", claimNumber: "CLM-2026-000003", patientId: "youth-002", payerId: "payer-002", clinicianId: "user-cm-002", serviceDate: "2026-06-25", submissionDate: "2026-06-26", status: "submitted" as const, totalAmount: 18750, allowedAmount: null, paidAmount: 0, patientResponsibility: null },
      { id: "clm-004", claimNumber: "CLM-2026-000004", patientId: "youth-001", payerId: "payer-001", clinicianId: "user-cm-001", serviceDate: "2026-06-27", submissionDate: "2026-06-28", status: "pending_review" as const, totalAmount: 12500, allowedAmount: null, paidAmount: 0, patientResponsibility: null },
      { id: "clm-005", claimNumber: "CLM-2026-000005", patientId: "youth-003", payerId: "payer-003", clinicianId: "user-cm-002", serviceDate: "2026-07-01", submissionDate: "2026-07-02", status: "denied" as const, totalAmount: 15000, allowedAmount: 0, paidAmount: 0, patientResponsibility: 1500, denialReason: "Service not prior authorized", denialCode: "PR-27" },
      { id: "clm-006", claimNumber: "CLM-2026-000006", patientId: "youth-002", payerId: "payer-001", clinicianId: "user-cm-001", serviceDate: "2026-07-02", submissionDate: null, status: "draft" as const, totalAmount: 12500, allowedAmount: null, paidAmount: 0, patientResponsibility: null },
      { id: "clm-007", claimNumber: "CLM-2026-000007", patientId: "youth-001", payerId: "payer-002", clinicianId: "user-cm-001", serviceDate: "2026-07-03", submissionDate: "2026-07-03", status: "acknowledged" as const, totalAmount: 8750, allowedAmount: null, paidAmount: 0, patientResponsibility: null },
      { id: "clm-008", claimNumber: "CLM-2026-000008", patientId: "youth-003", payerId: "payer-001", clinicianId: "user-cm-002", serviceDate: "2026-06-15", submissionDate: "2026-06-16", status: "appealed" as const, totalAmount: 20000, allowedAmount: 8000, paidAmount: 8000, patientResponsibility: 0, denialReason: "Downcoded from H2017 to H0038", denialCode: "CO-45", appealStatus: "in_review" as const },
    ];
    for (const c of claimData) {
      await db.insert(claimsTable).values({ ...c, notes: null, appealDate: null, updatedAt: iso, createdAt: iso });
    }

    // Seed line items
    const lineItemData = [
      { id: "li-001", claimId: "clm-001", serviceDate: "2026-06-20", procedureCode: "T1017", diagnosisCode: "F43.25", units: 1, unitPrice: 12500, totalPrice: 12500, description: "MHTCM Targeted Case Management - 1 unit" },
      { id: "li-002", claimId: "clm-002", serviceDate: "2026-06-22", procedureCode: "T1017", diagnosisCode: "F43.25", units: 1, unitPrice: 12500, totalPrice: 12500, description: "MHTCM Targeted Case Management - 1 unit" },
      { id: "li-003", claimId: "clm-003", serviceDate: "2026-06-25", procedureCode: "H2017", diagnosisCode: "F32.9", units: 3, unitPrice: 6250, totalPrice: 18750, description: "MHRS Psychosocial Rehab - 3 units" },
      { id: "li-004", claimId: "clm-004", serviceDate: "2026-06-27", procedureCode: "T1017", diagnosisCode: "F43.25", units: 1, unitPrice: 12500, totalPrice: 12500, description: "MHTCM Targeted Case Management - 1 unit" },
      { id: "li-005", claimId: "clm-005", serviceDate: "2026-07-01", procedureCode: "H2017", diagnosisCode: "F84.0", units: 2, unitPrice: 7500, totalPrice: 15000, description: "MHRS Skills Training - 2 units" },
      { id: "li-006", claimId: "clm-006", serviceDate: "2026-07-02", procedureCode: "T1017", diagnosisCode: "F32.9", units: 1, unitPrice: 12500, totalPrice: 12500, description: "MHTCM Targeted Case Management - 1 unit" },
      { id: "li-007", claimId: "clm-007", serviceDate: "2026-07-03", procedureCode: "H0031", diagnosisCode: "F43.10", units: 1, unitPrice: 8750, totalPrice: 8750, description: "Mental Health Assessment" },
      { id: "li-008", claimId: "clm-008", serviceDate: "2026-06-15", procedureCode: "H2017", diagnosisCode: "F84.0", units: 4, unitPrice: 5000, totalPrice: 20000, description: "MHRS Community Integration - 4 units" },
    ];
    for (const li of lineItemData) {
      await db.insert(lineItemsTable).values({ ...li, createdAt: iso });
    }

    // Seed authorizations
    const authzData = [
      { id: "authz-001", youthId: "youth-001", youthName: "John Martinez", mrn: "MRN-2026-001", payerName: "Texas Medicaid (HHSC)", policyNumber: "TX-MED-778899", stage: "tracking" as const, status: "approved" as const, authorizationNumber: "AUTH-2026-1122", approvedUnits: 30, approvedFromDate: "2026-06-01", approvedToDate: "2026-08-31", approvedLevelOfCare: "Intensive Outpatient", readinessMetAt: iso, submissionDate: "2026-05-28", submittedBy: "billing@amos.org", submissionMethod: "portal" as const, reauthDueDate: "2026-08-15", reauthStatus: "upcoming" as const, daysUntilExpiration: 45 },
      { id: "authz-002", youthId: "youth-002", youthName: "Sarah Chen", mrn: "MRN-2026-002", payerName: "Superior HealthPlan", policyNumber: "SHP-445566", stage: "readiness" as const, status: "in_progress" as const, readinessClinicalDocs: true, readinessAssessmentCurrent: true, readinessLOCSupported: true, readinessTreatmentPlan: true, readinessProgressNotes: true, readinessMedicalNecessity: false, readinessUtilizationReview: true, readinessGuardianConsent: true, readinessUB04Clean: true, readinessExcludedServices: true },
      { id: "authz-003", youthId: "youth-003", youthName: "Marcus Johnson", mrn: "MRN-2026-003", payerName: "Blue Cross Blue Shield of Texas", policyNumber: "BCBS-223344", stage: "submission" as const, status: "submitted" as const, readinessMetAt: iso, submissionDate: "2026-07-01", submittedBy: "billing@amos.org", submissionMethod: "fax" as const, submissionReference: "FAX-REF-998877" },
      { id: "authz-004", youthId: "youth-001", youthName: "John Martinez", mrn: "MRN-2026-001", payerName: "Texas Medicaid (HHSC)", policyNumber: "TX-MED-778899", stage: "reauthorization" as const, status: "in_progress" as const, authorizationNumber: "AUTH-2026-1123", approvedUnits: 15, approvedFromDate: "2026-03-01", approvedToDate: "2026-05-31", approvedLevelOfCare: "Residential", reauthDueDate: "2026-07-20", reauthStatus: "overdue" as const, daysUntilExpiration: -5 },
    ];
    for (const a of authzData) {
      await db.insert(authzTable).values({ ...a, createdAt: iso, updatedAt: iso, createdBy: "system" });
    }

    return { success: true, message: `4 payers + 8 claims + 8 line items + 4 authorizations seeded` };
  }),
});
