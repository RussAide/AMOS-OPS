import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  youthRightsAcknowledgments,
  restraintIncidents,
  prohibitedPractices,
  recordRetention,
  campusStages,
} from "@db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

// ══════════════════════════════════════════════════════════════
// GRO Compliance: Title 26 TAC Chapter 748 (T-006)
// Staffing ratios, youth rights, restraint reporting,
// prohibited practices, record retention
// ══════════════════════════════════════════════════════════════

export const groComplianceRouter = createRouter({

  // ════════════════════════════════════════════════════════════
  // YOUTH RIGHTS ACKNOWLEDGMENT
  // ════════════════════════════════════════════════════════════

  listYouthRights: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      acknowledged: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.youthId) conditions.push(eq(youthRightsAcknowledgments.youthId, input.youthId));
      if (input?.acknowledged !== undefined) {
        conditions.push(
          input.acknowledged
            ? and(
                eq(youthRightsAcknowledgments.acknowledgedByYouth, true),
                eq(youthRightsAcknowledgments.acknowledgedByGuardian, true)
              )
            : sql`${youthRightsAcknowledgments.acknowledgedByYouth} = 0 OR ${youthRightsAcknowledgments.acknowledgedByGuardian} = 0`
        );
      }
      const results = conditions.length > 0
        ? await db.select().from(youthRightsAcknowledgments).where(and(...conditions)).orderBy(desc(youthRightsAcknowledgments.createdAt))
        : await db.select().from(youthRightsAcknowledgments).orderBy(desc(youthRightsAcknowledgments.createdAt));
      return results;
    }),

  createYouthRights: adminQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      rightsVersion: z.string().default("2024-01"),
      deliveredBy: z.string(),
      deliveredById: z.string().optional(),
      deliveryMethod: z.enum(["in_person", "video", "written", "interpreter"]).default("in_person"),
      language: z.string().default("English"),
      interpreterUsed: z.boolean().optional(),
      interpreterName: z.string().optional(),
      notes: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(youthRightsAcknowledgments).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        rightsVersion: input.rightsVersion,
        deliveredBy: input.deliveredBy,
        deliveredById: input.deliveredById ?? null,
        deliveryMethod: input.deliveryMethod,
        language: input.language,
        interpreterUsed: input.interpreterUsed ?? false,
        interpreterName: input.interpreterName ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, id };
    }),

  acknowledgeYouthRights: adminQuery
    .input(z.object({
      id: z.string(),
      acknowledgedBy: z.enum(["youth", "guardian"]),
      guardianName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      if (input.acknowledgedBy === "youth") {
        await db.update(youthRightsAcknowledgments).set({
          acknowledgedByYouth: true,
          youthAcknowledgedAt: now,
          updatedAt: now,
        }).where(eq(youthRightsAcknowledgments.id, input.id));
      } else {
        await db.update(youthRightsAcknowledgments).set({
          acknowledgedByGuardian: true,
          guardianAcknowledgedAt: now,
          guardianName: input.guardianName ?? null,
          updatedAt: now,
        }).where(eq(youthRightsAcknowledgments.id, input.id));
      }
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // RESTRAINT / SECLUSION INCIDENT REPORTS
  // ════════════════════════════════════════════════════════════

  listRestraintIncidents: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      status: z.string().optional(),
      overdueDocumentation: z.boolean().optional(),
      overdueMedical: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.youthId) conditions.push(eq(restraintIncidents.youthId, input.youthId));
      if (input?.status) conditions.push(eq(restraintIncidents.status, input.status));

      let results = conditions.length > 0
        ? await db.select().from(restraintIncidents).where(and(...conditions)).orderBy(desc(restraintIncidents.incidentDate))
        : await db.select().from(restraintIncidents).orderBy(desc(restraintIncidents.incidentDate));

      const now = new Date().toISOString();

      if (input?.overdueDocumentation) {
        results = results.filter((r) =>
          !r.initialDocumentationCompleted && r.initialDocumentationDue && r.initialDocumentationDue < now
        );
      }
      if (input?.overdueMedical) {
        results = results.filter((r) =>
          r.medicalAttentionRequired && !r.medicalEvaluationCompleted && r.followUpReviewDue && r.followUpReviewDue < now
        );
      }

      return results;
    }),

  getRestraintIncident: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const incident = await db.select().from(restraintIncidents).where(eq(restraintIncidents.id, input.id)).get();
      if (!incident) return null;

      const checklist = await db.select().from(prohibitedPractices).where(eq(prohibitedPractices.incidentId, input.id)).get();
      return { ...incident, prohibitedPracticesChecklist: checklist ?? null };
    }),

  createRestraintIncident: adminQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      incidentDate: z.string(),
      incidentTime: z.string(),
      incidentLocation: z.string(),
      incidentType: z.enum(["physical_restraint", "mechanical_restraint", "seclusion", "chemical_restraint", "time_out", "emergency_safety_intervention"]),
      primaryStaffId: z.string(),
      primaryStaffName: z.string(),
      secondaryStaffId: z.string().optional(),
      secondaryStaffName: z.string().optional(),
      precipitatingFactors: z.string(),
      youthBehavior: z.string(),
      deescalationAttempts: z.string(),
      lessRestrictiveAlternatives: z.string().optional(),
      interventionStartedAt: z.string(),
      youthInjuries: z.string().optional(),
      staffInjuries: z.string().optional(),
      medicalAttentionRequired: z.boolean().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      // Generate incident number
      const year = new Date().getFullYear();
      const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
      const incidentNumber = `ESI-${year}-${seq}`;

      // Calculate deadlines
      const incidentDateTime = new Date(`${input.incidentDate}T${input.incidentTime}`);
      const docDue = new Date(incidentDateTime.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour
      const medicalDue = new Date(incidentDateTime.getTime() + 24 * 60 * 60 * 1000).toISOString(); // +24 hours

      await db.insert(restraintIncidents).values({
        id,
        incidentNumber,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        incidentDate: input.incidentDate,
        incidentTime: input.incidentTime,
        incidentLocation: input.incidentLocation,
        incidentType: input.incidentType,
        primaryStaffId: input.primaryStaffId,
        primaryStaffName: input.primaryStaffName,
        secondaryStaffId: input.secondaryStaffId ?? null,
        secondaryStaffName: input.secondaryStaffName ?? null,
        precipitatingFactors: input.precipitatingFactors,
        youthBehavior: input.youthBehavior,
        deescalationAttempts: input.deescalationAttempts,
        lessRestrictiveAlternatives: input.lessRestrictiveAlternatives ?? null,
        interventionStartedAt: input.interventionStartedAt,
        medicalAttentionRequired: input.medicalAttentionRequired ?? false,
        initialDocumentationDue: docDue,
        followUpReviewDue: medicalDue,
        status: "open",
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy ?? null,
      });

      // Auto-create prohibited practices checklist
      await db.insert(prohibitedPractices).values({
        id: randomUUID(),
        incidentId: id,
        incidentNumber,
        youthId: input.youthId,
        createdAt: now,
      });

      return { success: true, id, incidentNumber, documentationDue: docDue, medicalDue };
    }),

  endIntervention: adminQuery
    .input(z.object({
      id: z.string(),
      interventionEndedAt: z.string(),
      youthInjuries: z.string().optional(),
      staffInjuries: z.string().optional(),
      medicalAttentionRequired: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const started = await db.select({ startedAt: restraintIncidents.interventionStartedAt }).from(restraintIncidents).where(eq(restraintIncidents.id, input.id)).get();
      let duration: number | null = null;
      if (started) {
        const startMs = new Date(started.startedAt).getTime();
        const endMs = new Date(input.interventionEndedAt).getTime();
        duration = Math.max(0, Math.round((endMs - startMs) / 60000));
      }

      await db.update(restraintIncidents).set({
        interventionEndedAt: input.interventionEndedAt,
        durationMinutes: duration,
        youthInjuries: input.youthInjuries ?? null,
        staffInjuries: input.staffInjuries ?? null,
        medicalAttentionRequired: input.medicalAttentionRequired ?? false,
        updatedAt: new Date().toISOString(),
      }).where(eq(restraintIncidents.id, input.id));

      return { success: true, durationMinutes: duration };
    }),

  completeDocumentation: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(restraintIncidents).set({
        initialDocumentationCompleted: true,
        initialDocumentationCompletedAt: now,
        status: "documented",
        updatedAt: now,
      }).where(eq(restraintIncidents.id, input.id));
      return { success: true };
    }),

  completeMedicalEvaluation: adminQuery
    .input(z.object({
      id: z.string(),
      evaluatedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(restraintIncidents).set({
        medicalEvaluationCompleted: true,
        medicalEvaluationCompletedAt: now,
        medicalEvaluationBy: input.evaluatedBy,
        status: "under_review",
        updatedAt: now,
      }).where(eq(restraintIncidents.id, input.id));
      return { success: true };
    }),

  completeFollowUp: adminQuery
    .input(z.object({
      id: z.string(),
      followUpActions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(restraintIncidents).set({
        followUpReviewCompleted: true,
        followUpReviewCompletedAt: now,
        followUpActions: input.followUpActions ?? null,
        status: "closed",
        updatedAt: now,
      }).where(eq(restraintIncidents.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // PROHIBITED PRACTICES CHECKLIST
  // ════════════════════════════════════════════════════════════

  getProhibitedPractices: authedQuery
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(prohibitedPractices).where(eq(prohibitedPractices.incidentId, input.incidentId)).get();
    }),

  certifyProhibitedPractices: adminQuery
    .input(z.object({
      incidentId: z.string(),
      certifiedBy: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(prohibitedPractices).set({
        certified: true,
        certifiedBy: input.certifiedBy,
        certifiedAt: now,
        notes: input.notes ?? null,
      }).where(eq(prohibitedPractices.incidentId, input.incidentId));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // RECORD RETENTION
  // ════════════════════════════════════════════════════════════

  listRecordRetention: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      status: z.string().optional(),
      expiringSoon: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.youthId) conditions.push(eq(recordRetention.youthId, input.youthId));
      if (input?.status) conditions.push(eq(recordRetention.status, input.status));

      let results = conditions.length > 0
        ? await db.select().from(recordRetention).where(and(...conditions)).orderBy(desc(recordRetention.createdAt))
        : await db.select().from(recordRetention).orderBy(desc(recordRetention.createdAt));

      if (input?.expiringSoon) {
        const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        results = results.filter((r) =>
          r.expirationDate <= ninetyDaysFromNow && r.status === "active"
        );
      }

      return results;
    }),

  createRecordRetention: adminQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      recordType: z.enum(["admission_intake", "medical", "behavioral", "incident", "treatment_plan", "discharge_summary", "guardian_communication", "education", "medication_administration"]),
      createdDate: z.string(),
      retentionYears: z.number().default(5),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const created = new Date(input.createdDate);
      const expiration = new Date(created.getTime() + input.retentionYears * 365 * 24 * 60 * 60 * 1000).toISOString();

      await db.insert(recordRetention).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        recordType: input.recordType,
        createdDate: input.createdDate,
        retentionYears: input.retentionYears,
        expirationDate: expiration,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { success: true, id, expirationDate: expiration };
    }),

  updateRecordRetentionStatus: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["active", "expiring_soon", "expired", "archived", "destroyed"]),
      destroyedBy: z.string().optional(),
      destructionAuthorization: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      const updateData: Partial<typeof recordRetention.$inferInsert> = { status: input.status, updatedAt: now };
      if (input.destroyedBy) {
        updateData.destroyedBy = input.destroyedBy;
        updateData.destroyedAt = now;
      }
      if (input.destructionAuthorization) updateData.destructionAuthorization = input.destructionAuthorization;

      await db.update(recordRetention).set(updateData).where(eq(recordRetention.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // STAFFING RATIO COMPLIANCE
  // ════════════════════════════════════════════════════════════

  staffingRatioCheck: authedQuery
    .input(z.object({ stageId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const stage = await db.select().from(campusStages).where(eq(campusStages.id, input.stageId)).get();
      if (!stage) return null;

      // Parse ratios (e.g. "1:8" → 1 staff per 8 youth)
      const parseRatio = (r: string) => {
        const parts = r.split(":");
        return parts.length === 2 ? { staff: parseInt(parts[0]), youth: parseInt(parts[1]) } : null;
      };

      const awakeRatio = parseRatio(stage.awakeStaffRatio);
      const overnightRatio = parseRatio(stage.overnightStaffRatio);

      const requiredAwakeStaff = awakeRatio ? Math.ceil(stage.currentCensus / awakeRatio.youth) * awakeRatio.staff : 0;
      const requiredOvernightStaff = overnightRatio ? Math.ceil(stage.currentCensus / overnightRatio.youth) * overnightRatio.staff : 0;

      return {
        stageId: stage.id,
        stageName: stage.name,
        currentCensus: stage.currentCensus,
        awakeStaffRatio: stage.awakeStaffRatio,
        requiredAwakeStaff,
        overnightStaffRatio: stage.overnightStaffRatio,
        requiredOvernightStaff,
        isCompliant: true, // placeholder — actual staff counts would come from scheduling system
      };
    }),

  // ════════════════════════════════════════════════════════════
  // COMPLIANCE DASHBOARD
  // ════════════════════════════════════════════════════════════

  groComplianceDashboard: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Youth rights
    const allRights = await db.select().from(youthRightsAcknowledgments);
    const rightsFullyAcked = allRights.filter((r) => r.acknowledgedByYouth && r.acknowledgedByGuardian).length;
    const rightsPartial = allRights.filter((r) =>
      (r.acknowledgedByYouth && !r.acknowledgedByGuardian) || (!r.acknowledgedByYouth && r.acknowledgedByGuardian)
    ).length;
    const rightsPending = allRights.filter((r) => !r.acknowledgedByYouth && !r.acknowledgedByGuardian).length;

    // Restraint incidents
    const allIncidents = await db.select().from(restraintIncidents);
    const openIncidents = allIncidents.filter((i) => i.status === "open" || i.status === "medical_pending").length;
    const overdueDoc = allIncidents.filter((i) =>
      !i.initialDocumentationCompleted && i.initialDocumentationDue && i.initialDocumentationDue < now
    ).length;
    const overdueMedical = allIncidents.filter((i) =>
      i.medicalAttentionRequired && !i.medicalEvaluationCompleted && i.followUpReviewDue && i.followUpReviewDue < now
    ).length;
    const incidents24h = allIncidents.filter((i) => i.createdAt >= twentyFourHoursAgo).length;

    // Record retention
    const allRecords = await db.select().from(recordRetention);
    const expiringSoon = allRecords.filter((r) => {
      const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      return r.expirationDate <= ninetyDays && r.status === "active";
    }).length;
    const expiredRecords = allRecords.filter((r) => r.status === "expired").length;

    return {
      youthRights: {
        total: allRights.length,
        fullyAcknowledged: rightsFullyAcked,
        partial: rightsPartial,
        pending: rightsPending,
      },
      restraintIncidents: {
        total: allIncidents.length,
        open: openIncidents,
        overdueDocumentation: overdueDoc,
        overdueMedical: overdueMedical,
        last24Hours: incidents24h,
      },
      recordRetention: {
        total: allRecords.length,
        expiringSoon,
        expired: expiredRecords,
      },
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedGroComplianceData: adminQuery.mutation(async () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed youth rights
    await db.insert(youthRightsAcknowledgments).values([
      {
        id: "yr-001", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001",
        rightsVersion: "2024-01",
        acknowledgedByYouth: true, youthAcknowledgedAt: "2026-06-16T10:00:00Z",
        acknowledgedByGuardian: true, guardianAcknowledgedAt: "2026-06-16T10:30:00Z",
        guardianName: "Angela Johnson",
        deliveredBy: "Sarah Martinez", deliveredById: "user-gro-001",
        deliveryMethod: "in_person", language: "English",
        interpreterUsed: false,
        notes: "Youth and guardian both present. Rights explained in detail. Questions answered.",
        createdAt: now, updatedAt: now,
      },
      {
        id: "yr-002", youthId: "youth-002", youthName: "Aaliyah Williams", mrn: "MRN-2026-002",
        rightsVersion: "2024-01",
        acknowledgedByYouth: true, youthAcknowledgedAt: "2026-07-02T09:00:00Z",
        acknowledgedByGuardian: false, guardianAcknowledgedAt: null,
        guardianName: null,
        deliveredBy: "Sarah Martinez", deliveredById: "user-gro-001",
        deliveryMethod: "in_person", language: "English",
        interpreterUsed: false,
        notes: "Youth acknowledged. Guardian visit scheduled for 7/5.",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Seed restraint incident
    await db.insert(restraintIncidents).values([
      {
        id: "esi-001", incidentNumber: "ESI-2026-0042",
        youthId: "youth-003", youthName: "Ethan Brown", mrn: "MRN-2026-003",
        incidentDate: "2026-07-03", incidentTime: "14:30:00",
        incidentLocation: "Common Area - East Wing",
        incidentType: "physical_restraint",
        primaryStaffId: "user-rcs-001", primaryStaffName: "David Thompson",
        secondaryStaffId: "user-rcs-002", secondaryStaffName: "Lisa Garcia",
        supervisorNotifiedAt: "2026-07-03T14:35:00Z",
        precipitatingFactors: "Youth became agitated after being told recreational activity was cancelled due to weather.",
        youthBehavior: "Youth threw chair, punched wall, threatened peers. escalated quickly despite verbal redirection.",
        deescalationAttempts: "Verbal redirection, offering alternative activity, space and time. Youth did not respond.",
        lessRestrictiveAlternatives: "Time-out offered; youth refused. Peer separation attempted; youth pursued peers.",
        interventionStartedAt: "2026-07-03T14:32:00Z",
        interventionEndedAt: "2026-07-03T14:38:00Z",
        durationMinutes: 6,
        youthInjuries: "Minor abrasion to right wrist. No other injuries.",
        staffInjuries: "None.",
        medicalAttentionRequired: true,
        medicalEvaluationCompleted: true,
        medicalEvaluationCompletedAt: "2026-07-03T15:15:00Z",
        medicalEvaluationBy: "Nurse Jennifer Adams",
        initialDocumentationCompleted: true,
        initialDocumentationDue: "2026-07-03T15:32:00Z",
        initialDocumentationCompletedAt: "2026-07-03T15:00:00Z",
        followUpReviewCompleted: true,
        followUpReviewDue: "2026-07-04T14:32:00Z",
        followUpReviewCompletedAt: "2026-07-04T10:00:00Z",
        followUpActions: "Behavioral plan reviewed with treatment team. Trigger identification protocol implemented. Staff debrief completed.",
        status: "closed",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Seed prohibited practices for the incident
    await db.insert(prohibitedPractices).values([
      {
        id: "pp-001", incidentId: "esi-001", incidentNumber: "ESI-2026-0042", youthId: "youth-003",
        proneRestraintUsed: false,
        supineRestraintUsed: false,
        mechanicalRestraintUsed: false,
        chemicalRestraintUsed: false,
        denialOfMeals: false,
        denialOfSleep: false,
        corporalPunishment: false,
        humiliationDegradation: false,
        certified: true,
        certifiedBy: "Program Director Michael Roberts",
        certifiedAt: "2026-07-04T10:30:00Z",
        notes: "All prohibited practices confirmed NOT used. Intervention was proportional and necessary.",
        createdAt: now,
      },
    ]).onConflictDoNothing();

    // Seed record retention
    await db.insert(recordRetention).values([
      {
        id: "rr-001", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001",
        recordType: "admission_intake", createdDate: "2026-06-15", retentionYears: 5,
        expirationDate: "2031-06-15", status: "active",
        createdAt: now, updatedAt: now,
      },
      {
        id: "rr-002", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001",
        recordType: "incident", createdDate: "2025-06-15", retentionYears: 5,
        expirationDate: "2030-06-15", status: "active",
        createdAt: now, updatedAt: now,
      },
      {
        id: "rr-003", youthId: "youth-004", youthName: "Olivia Chen", mrn: "MRN-2026-004",
        recordType: "discharge_summary", createdDate: "2020-06-01", retentionYears: 5,
        expirationDate: "2025-06-01", status: "expired",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    return { success: true, message: "GRO compliance seeded: 2 youth rights, 1 restraint incident, 1 prohibited practices checklist, 3 record retention entries" };
  }),
});
