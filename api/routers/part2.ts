import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  sudRecords, part2Consents, qsoaAgreements, part2AuditLog, part2BreachNotifications,
} from "@db/schema";
import { eq, and, desc, sql, type InferInsertModel } from "drizzle-orm";
import { randomUUID } from "crypto";

// ══════════════════════════════════════════════════════════════
// 42 CFR Part 2: SUD Confidentiality Compliance Router (T-007)
// Substance Use Disorder information protection framework
// ══════════════════════════════════════════════════════════════

export const part2Router = createRouter({

  // ════════════════════════════════════════════════════════════
  // SUD RECORDS
  // ════════════════════════════════════════════════════════════

  listSudRecords: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      substanceType: z.string().optional(),
      status: z.string().optional(),
      part2Protected: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.youthId) conditions.push(eq(sudRecords.youthId, input.youthId));
      if (input?.substanceType) conditions.push(eq(sudRecords.substanceType, input.substanceType as InferInsertModel<typeof sudRecords>["substanceType"]));
      if (input?.status) conditions.push(eq(sudRecords.status, input.status as InferInsertModel<typeof sudRecords>["status"]));
      if (input?.part2Protected !== undefined) conditions.push(eq(sudRecords.isPart2Protected, input.part2Protected));

      const results = conditions.length > 0
        ? await db.select().from(sudRecords).where(and(...conditions)).orderBy(desc(sudRecords.createdAt))
        : await db.select().from(sudRecords).orderBy(desc(sudRecords.createdAt));
      return results;
    }),

  getSudRecord: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const record = await db.select().from(sudRecords).where(eq(sudRecords.id, input.id)).get();
      if (!record) return null;
      const consents = await db.select().from(part2Consents).where(eq(part2Consents.sudRecordId, input.id)).orderBy(desc(part2Consents.createdAt));
      return { ...record, consents };
    }),

  createSudRecord: adminQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      substanceType: z.enum(["alcohol", "cannabis", "opioids", "stimulants", "sedatives", "hallucinogens", "polysubstance", "other"]),
      diagnosisCode: z.string().optional(),
      severity: z.enum(["mild", "moderate", "severe"]).optional(),
      isPart2Protected: z.boolean().default(true),
      assessmentDate: z.string(),
      assessingClinicianId: z.string().optional(),
      assessingClinicianName: z.string().optional(),
      treatmentPlanReference: z.string().optional(),
      notes: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(sudRecords).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        substanceType: input.substanceType,
        diagnosisCode: input.diagnosisCode ?? null,
        severity: input.severity ?? null,
        isPart2Protected: input.isPart2Protected,
        assessmentDate: input.assessmentDate,
        assessingClinicianId: input.assessingClinicianId ?? null,
        assessingClinicianName: input.assessingClinicianName ?? null,
        treatmentPlanReference: input.treatmentPlanReference ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy ?? null,
      });
      return { success: true, id };
    }),

  updateSudRecord: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["active", "in_remission", "resolved", "transferred"]).optional(),
      severity: z.enum(["mild", "moderate", "severe"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const updateData: Partial<InferInsertModel<typeof sudRecords>> = { updatedAt: new Date().toISOString() };
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.severity !== undefined) updateData.severity = fields.severity;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      await db.update(sudRecords).set(updateData).where(eq(sudRecords.id, id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // CONSENT MANAGEMENT
  // ════════════════════════════════════════════════════════════

  listConsents: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      sudRecordId: z.string().optional(),
      status: z.string().optional(),
      recipientType: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.youthId) conditions.push(eq(part2Consents.youthId, input.youthId));
      if (input?.sudRecordId) conditions.push(eq(part2Consents.sudRecordId, input.sudRecordId));
      if (input?.status) conditions.push(eq(part2Consents.status, input.status as InferInsertModel<typeof part2Consents>["status"]));
      if (input?.recipientType) conditions.push(eq(part2Consents.recipientType, input.recipientType as InferInsertModel<typeof part2Consents>["recipientType"]));

      const results = conditions.length > 0
        ? await db.select().from(part2Consents).where(and(...conditions)).orderBy(desc(part2Consents.createdAt))
        : await db.select().from(part2Consents).orderBy(desc(part2Consents.createdAt));
      return results;
    }),

  createConsent: adminQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      sudRecordId: z.string(),
      consentType: z.enum(["initial", "renewal", "revocation", "amendment"]).default("initial"),
      recipientName: z.string(),
      recipientOrganization: z.string().optional(),
      recipientType: z.enum(["healthcare_provider", "insurance", "court", "family_member", "school", "employer", "research", "other"]),
      recipientNpi: z.string().optional(),
      informationScope: z.enum(["full_record", "summary_only", "specific_elements"]).default("full_record"),
      specificElements: z.string().optional(),
      purpose: z.string(),
      effectiveDate: z.string(),
      expirationDate: z.string().optional(),
      expirationEvent: z.enum(["fixed_date", "treatment_end", "youth_age_18", "specific_event"]).default("fixed_date"),
      authorizedBy: z.string(),
      guardianName: z.string().optional(),
      guardianRelationship: z.string().optional(),
      isQsoa: z.boolean().default(false),
      qsoaAgreementId: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      // Determine initial status
      const status = input.consentType === "revocation" ? "revoked" : "active";

      await db.insert(part2Consents).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        sudRecordId: input.sudRecordId,
        consentType: input.consentType,
        recipientName: input.recipientName,
        recipientOrganization: input.recipientOrganization ?? null,
        recipientType: input.recipientType,
        recipientNpi: input.recipientNpi ?? null,
        informationScope: input.informationScope,
        specificElements: input.specificElements ?? null,
        purpose: input.purpose,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate ?? null,
        expirationEvent: input.expirationEvent,
        authorizedBy: input.authorizedBy,
        guardianName: input.guardianName ?? null,
        guardianRelationship: input.guardianRelationship ?? null,
        status: status as InferInsertModel<typeof part2Consents>["status"],
        isQsoa: input.isQsoa,
        qsoaAgreementId: input.qsoaAgreementId ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy ?? null,
      });

      return { success: true, id, status };
    }),

  revokeConsent: adminQuery
    .input(z.object({
      id: z.string(),
      revokedBy: z.string(),
      revocationReason: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(part2Consents).set({
        status: "revoked",
        revokedAt: now,
        revokedBy: input.revokedBy,
        revocationReason: input.revocationReason,
        updatedAt: now,
      }).where(eq(part2Consents.id, input.id));
      return { success: true };
    }),

  checkExpiredConsents: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const allConsents = await db.select().from(part2Consents).where(eq(part2Consents.status, "active"));
    const expired = allConsents.filter((c) => c.expirationDate && c.expirationDate < now);

    for (const c of expired) {
      await db.update(part2Consents).set({ status: "expired", updatedAt: now }).where(eq(part2Consents.id, c.id));
    }

    return { expiredCount: expired.length, expiredConsents: expired.map((c) => ({ id: c.id, youthName: c.youthName, expirationDate: c.expirationDate })) };
  }),

  // ════════════════════════════════════════════════════════════
  // QSOA AGREEMENTS
  // ════════════════════════════════════════════════════════════

  listQsoaAgreements: authedQuery
    .input(z.object({
      status: z.string().optional(),
      organizationType: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.status) conditions.push(eq(qsoaAgreements.status, input.status as InferInsertModel<typeof qsoaAgreements>["status"]));
      if (input?.organizationType) conditions.push(eq(qsoaAgreements.organizationType, input.organizationType as InferInsertModel<typeof qsoaAgreements>["organizationType"]));

      const results = conditions.length > 0
        ? await db.select().from(qsoaAgreements).where(and(...conditions)).orderBy(desc(qsoaAgreements.createdAt))
        : await db.select().from(qsoaAgreements).orderBy(desc(qsoaAgreements.createdAt));
      return results;
    }),

  createQsoaAgreement: adminQuery
    .input(z.object({
      organizationName: z.string(),
      organizationType: z.enum(["laboratory", "pharmacy", "billing_service", "quality_assurance", "it_vendor", "other"]),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      agreementDate: z.string(),
      effectiveDate: z.string(),
      expirationDate: z.string().optional(),
      autoRenew: z.boolean().default(false),
      servicesProvided: z.string(),
      dataAccessScope: z.enum(["full", "limited", "de_identified"]).default("limited"),
      dataAccessDescription: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(qsoaAgreements).values({
        id,
        organizationName: input.organizationName,
        organizationType: input.organizationType,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        agreementDate: input.agreementDate,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate ?? null,
        autoRenew: input.autoRenew,
        servicesProvided: input.servicesProvided,
        dataAccessScope: input.dataAccessScope,
        dataAccessDescription: input.dataAccessDescription ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, id };
    }),

  updateQsoaAgreement: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["draft", "active", "expiring_soon", "expired", "terminated"]).optional(),
      baaExecuted: z.boolean().optional(),
      baaDate: z.string().optional(),
      staffTrained: z.boolean().optional(),
      trainingDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const now = new Date().toISOString();
      const updateData: Partial<InferInsertModel<typeof qsoaAgreements>> = { updatedAt: now };
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.baaExecuted !== undefined) updateData.baaExecuted = fields.baaExecuted;
      if (fields.baaDate !== undefined) updateData.baaDate = fields.baaDate;
      if (fields.staffTrained !== undefined) updateData.staffTrained = fields.staffTrained;
      if (fields.trainingDate !== undefined) updateData.trainingDate = fields.trainingDate;
      await db.update(qsoaAgreements).set(updateData).where(eq(qsoaAgreements.id, id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ════════════════════════════════════════════════════════════

  logAccess: adminQuery
    .input(z.object({
      youthId: z.string(),
      mrn: z.string(),
      sudRecordId: z.string(),
      accessType: z.enum(["view", "create", "update", "delete", "disclose", "print", "export"]),
      accessedBy: z.string(),
      accessedById: z.string().optional(),
      accessedByRole: z.string().optional(),
      accessContext: z.enum(["treatment", "payment", "healthcare_operations", "audit", "research", "legal", "other"]),
      consentId: z.string().optional(),
      qsoaId: z.string().optional(),
      recordTypeAccessed: z.string(),
      fieldsAccessed: z.string().optional(),
      ipAddress: z.string().optional(),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Check authorization
      let isUnauthorized = false;
      let flagReason = "";

      if (input.accessType === "disclose" && !input.consentId && !input.qsoaId) {
        isUnauthorized = true;
        flagReason = "Disclosure without valid consent or QSOA";
      }

      const id = randomUUID();
      await db.insert(part2AuditLog).values({
        id,
        youthId: input.youthId,
        mrn: input.mrn,
        sudRecordId: input.sudRecordId,
        accessType: input.accessType,
        accessedBy: input.accessedBy,
        accessedById: input.accessedById ?? null,
        accessedByRole: input.accessedByRole ?? null,
        accessContext: input.accessContext,
        consentId: input.consentId ?? null,
        qsoaId: input.qsoaId ?? null,
        recordTypeAccessed: input.recordTypeAccessed,
        fieldsAccessed: input.fieldsAccessed ?? null,
        unauthorizedFlag: isUnauthorized,
        flagReason: flagReason || null,
        ipAddress: input.ipAddress ?? null,
        sessionId: input.sessionId ?? null,
      });

      return { success: true, id, unauthorizedFlag: isUnauthorized };
    }),

  listAuditLog: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      sudRecordId: z.string().optional(),
      accessedBy: z.string().optional(),
      unauthorizedOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.youthId) conditions.push(eq(part2AuditLog.youthId, input.youthId));
      if (input?.sudRecordId) conditions.push(eq(part2AuditLog.sudRecordId, input.sudRecordId));
      if (input?.accessedBy) conditions.push(eq(part2AuditLog.accessedBy, input.accessedBy));
      if (input?.unauthorizedOnly) conditions.push(eq(part2AuditLog.unauthorizedFlag, true));

      const results = conditions.length > 0
        ? await db.select().from(part2AuditLog).where(and(...conditions)).orderBy(desc(part2AuditLog.accessTimestamp))
        : await db.select().from(part2AuditLog).orderBy(desc(part2AuditLog.accessTimestamp));
      return results;
    }),

  // ════════════════════════════════════════════════════════════
  // BREACH NOTIFICATIONS
  // ════════════════════════════════════════════════════════════

  listBreachNotifications: authedQuery
    .input(z.object({
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.status) {
        return db.select().from(part2BreachNotifications).where(eq(part2BreachNotifications.status, input.status as InferInsertModel<typeof part2BreachNotifications>["status"])).orderBy(desc(part2BreachNotifications.discoveredDate));
      }
      return db.select().from(part2BreachNotifications).orderBy(desc(part2BreachNotifications.discoveredDate));
    }),

  createBreachNotification: adminQuery
    .input(z.object({
      discoveredDate: z.string(),
      breachType: z.enum(["unauthorized_access", "unauthorized_disclosure", "data_loss", "system_intrusion", "physical_theft", "other"]),
      description: z.string(),
      affectedYouthCount: z.number().default(0),
      affectedRecordCount: z.number().default(0),
      affectedYouthJson: z.string().optional(),
      containmentActions: z.string().optional(),
      mitigationActions: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const year = new Date().getFullYear();
      const seq = Math.floor(Math.random() * 999).toString().padStart(3, "0");
      const breachNumber = `BREACH-${year}-${seq}`;
      const now = new Date().toISOString();

      await db.insert(part2BreachNotifications).values({
        id,
        breachNumber,
        discoveredDate: input.discoveredDate,
        breachType: input.breachType,
        description: input.description,
        affectedYouthCount: input.affectedYouthCount,
        affectedRecordCount: input.affectedRecordCount,
        affectedYouthJson: input.affectedYouthJson ?? null,
        containmentActions: input.containmentActions ?? null,
        mitigationActions: input.mitigationActions ?? null,
        status: "open",
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy ?? null,
      });

      return { success: true, id, breachNumber };
    }),

  updateBreachStatus: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "contained", "mitigated", "notified", "closed"]),
      secretaryNotified: z.boolean().optional(),
      patientsNotified: z.boolean().optional(),
      patientsNotifiedBy: z.string().optional(),
      closedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      const updateData: Partial<InferInsertModel<typeof part2BreachNotifications>> = { status: input.status, updatedAt: now };
      if (input.secretaryNotified) { updateData.secretaryNotified = true; updateData.secretaryNotifiedAt = now; }
      if (input.patientsNotified) { updateData.patientsNotified = true; updateData.patientsNotifiedAt = now; updateData.patientsNotifiedBy = input.patientsNotifiedBy; }
      if (input.status === "closed") { updateData.closedAt = now; updateData.closedBy = input.closedBy; }
      await db.update(part2BreachNotifications).set(updateData).where(eq(part2BreachNotifications.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════

  part2Dashboard: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();

    // SUD Records
    const allRecords = await db.select().from(sudRecords);
    const activeRecords = allRecords.filter((r) => r.status === "active").length;
    const part2Protected = allRecords.filter((r) => r.isPart2Protected).length;

    // Consents
    const allConsents = await db.select().from(part2Consents);
    const activeConsents = allConsents.filter((c) => c.status === "active").length;
    const expiredConsents = allConsents.filter((c) => c.status === "expired").length;
    const revokedConsents = allConsents.filter((c) => c.status === "revoked").length;

    // QSOA
    const allQsoa = await db.select().from(qsoaAgreements);
    const activeQsoa = allQsoa.filter((q) => q.status === "active").length;
    const qsoaExpiring = allQsoa.filter((q) => {
      if (!q.expirationDate) return false;
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return q.expirationDate <= thirtyDays && q.status === "active";
    }).length;
    const qsoaNeedingTraining = allQsoa.filter((q) => q.status === "active" && !q.staffTrained).length;

    // Audit
    const allAudit = await db.select().from(part2AuditLog);
    const unauthorizedAccess = allAudit.filter((a) => a.unauthorizedFlag).length;
    const disclosuresThisMonth = allAudit.filter((a) => a.accessType === "disclose" && a.accessTimestamp >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length;

    // Breaches
    const allBreaches = await db.select().from(part2BreachNotifications);
    const openBreaches = allBreaches.filter((b) => b.status === "open" || b.status === "contained").length;

    return {
      sudRecords: { total: allRecords.length, active: activeRecords, part2Protected },
      consents: { total: allConsents.length, active: activeConsents, expired: expiredConsents, revoked: revokedConsents },
      qsoa: { total: allQsoa.length, active: activeQsoa, expiringSoon: qsoaExpiring, needingStaffTraining: qsoaNeedingTraining },
      audit: { totalAccessEvents: allAudit.length, unauthorizedFlags: unauthorizedAccess, disclosuresThisMonth },
      breaches: { total: allBreaches.length, open: openBreaches },
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedPart2Data: adminQuery.mutation(async () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed SUD record
    await db.insert(sudRecords).values([
      {
        id: "sud-001", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001",
        substanceType: "cannabis",
        diagnosisCode: "F12.20",
        severity: "moderate",
        isPart2Protected: true,
        status: "active",
        assessmentDate: "2026-06-16",
        assessingClinicianId: "user-003", assessingClinicianName: "Dr. Hall",
        treatmentPlanReference: "TP-2026-0042",
        notes: "Youth reports daily cannabis use for past 6 months. Uses to manage anxiety and sleep difficulties. CAGE score: 2. MOTIVATIONAL INTERVIEWING recommended.",
        createdAt: now, updatedAt: now,
      },
      {
        id: "sud-002", youthId: "youth-003", youthName: "Ethan Brown", mrn: "MRN-2026-003",
        substanceType: "polysubstance",
        diagnosisCode: "F19.20",
        severity: "severe",
        isPart2Protected: true,
        status: "active",
        assessmentDate: "2026-07-04",
        assessingClinicianId: "user-003", assessingClinicianName: "Dr. Hall",
        treatmentPlanReference: "TP-2026-0045",
        notes: "Polysubstance use: alcohol, cannabis, and reported experimentation with prescription opioids. High-risk behaviors documented. Requires intensive SUD intervention.",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Seed consents
    await db.insert(part2Consents).values([
      {
        id: "cons-001", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001",
        sudRecordId: "sud-001",
        consentType: "initial",
        recipientName: "Dr. Hall", recipientOrganization: "Adolbi Care BHC",
        recipientType: "healthcare_provider", recipientNpi: "1234567890",
        informationScope: "full_record",
        purpose: "Coordination of SUD treatment with primary therapist",
        effectiveDate: "2026-06-16", expirationDate: "2027-06-16",
        expirationEvent: "fixed_date",
        authorizedBy: "youth_and_guardian", guardianName: "Angela Johnson", guardianRelationship: "mother",
        status: "active", isQsoa: false,
        createdAt: now, updatedAt: now,
      },
      {
        id: "cons-002", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001",
        sudRecordId: "sud-001",
        consentType: "initial",
        recipientName: "Superior Health Plan", recipientOrganization: "Superior Health Plan",
        recipientType: "insurance",
        informationScope: "summary_only",
        purpose: "Insurance authorization for SUD treatment services",
        effectiveDate: "2026-06-16", expirationDate: "2026-12-31",
        expirationEvent: "fixed_date",
        authorizedBy: "youth_and_guardian", guardianName: "Angela Johnson", guardianRelationship: "mother",
        status: "active", isQsoa: false,
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Seed QSOA
    await db.insert(qsoaAgreements).values([
      {
        id: "qsoa-001",
        organizationName: "Apex Laboratory Services", organizationType: "laboratory",
        contactName: "Jennifer Walsh", contactPhone: "(512) 555-0142", contactEmail: "jwalsh@apexlabs.com",
        agreementDate: "2026-01-15", effectiveDate: "2026-01-15", expirationDate: "2027-01-15", autoRenew: true,
        servicesProvided: "Toxicology screening for substance use monitoring",
        dataAccessScope: "limited", dataAccessDescription: "Lab results only \u2014 no clinical notes or treatment plans",
        baaExecuted: true, baaDate: "2026-01-15",
        staffTrained: true, trainingDate: "2026-01-10",
        status: "active",
        createdAt: now, updatedAt: now,
      },
      {
        id: "qsoa-002",
        organizationName: "SecureHealth IT", organizationType: "it_vendor",
        contactName: "Robert Chen", contactPhone: "(512) 555-0198", contactEmail: "rchen@securehealthit.com",
        agreementDate: "2026-03-01", effectiveDate: "2026-03-01", expirationDate: "2027-03-01", autoRenew: false,
        servicesProvided: "EHR hosting and data backup services",
        dataAccessScope: "limited", dataAccessDescription: "Encrypted data storage only \u2014 no direct access to patient records",
        baaExecuted: true, baaDate: "2026-03-01",
        staffTrained: false, trainingDate: null,
        status: "active",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Seed audit log entries
    await db.insert(part2AuditLog).values([
      {
        id: "audit-001", youthId: "youth-001", mrn: "MRN-2026-001", sudRecordId: "sud-001",
        accessType: "view", accessedBy: "Dr. Hall", accessedById: "user-003", accessedByRole: "treatment-director",
        accessTimestamp: "2026-06-16T11:00:00Z", accessContext: "treatment",
        recordTypeAccessed: "sud_assessment", fieldsAccessed: JSON.stringify(["diagnosis", "severity", "notes"]),
        unauthorizedFlag: false,
      },
      {
        id: "audit-002", youthId: "youth-001", mrn: "MRN-2026-001", sudRecordId: "sud-001",
        accessType: "disclose", accessedBy: "Jonthan Guidry", accessedById: "user-cm-001", accessedByRole: "case-manager",
        accessTimestamp: "2026-06-20T14:30:00Z", accessContext: "treatment",
        consentId: "cons-001",
        recordTypeAccessed: "sud_summary", fieldsAccessed: JSON.stringify(["substance_type", "severity", "treatment_plan"]),
        unauthorizedFlag: false,
      },
      {
        id: "audit-003", youthId: "youth-001", mrn: "MRN-2026-001", sudRecordId: "sud-001",
        accessType: "view", accessedBy: "Lilian Ike", accessedById: "user-002", accessedByRole: "clinical-director",
        accessTimestamp: "2026-06-25T09:15:00Z", accessContext: "treatment",
        recordTypeAccessed: "sud_assessment", fieldsAccessed: JSON.stringify(["diagnosis", "severity"]),
        unauthorizedFlag: false,
      },
    ]).onConflictDoNothing();

    return { success: true, message: "42CFR2 seeded: 2 SUD records, 2 consents, 2 QSOA agreements, 3 audit log entries" };
  }),
});
