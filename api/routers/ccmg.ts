import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  ccmgCareCoordination,
  ccmgReferrals,
  bhcDepartmentMetrics,
  mhtcmServicePlans,
  mhtcmEncounters,
  mhtcmEligibility,
  mhrsServicePlans,
  mhrsEncounters,
} from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";
import { randomUUID } from "crypto";

// ══════════════════════════════════════════════════════════════
// CCMG: Collaborative Care Management Group Router (T-003)
// Central hub for BHC — coordinates CCMG, MHTCM, MHRS, GRO liaison
// ══════════════════════════════════════════════════════════════

export function quarantineCcmgLegacyCansLogic(): never {
  throw new Error("M41C_LEGACY_CANS_LOGIC_QUARANTINED");
}

export const M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED =
  "M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED" as const;

export function assertCcmgLegacyCansInputsAbsent(input: {
  cansCompleted?: unknown;
  cansScore?: unknown;
  cansRiskLevel?: unknown;
}): void {
  if (
    input.cansCompleted !== undefined ||
    input.cansScore !== undefined ||
    input.cansRiskLevel !== undefined
  ) {
    quarantineCcmgLegacyCansLogic();
  }
}

export const ccmgRouter = createRouter({
  // ════════════════════════════════════════════════════════════
  // CARE COORDINATION
  // ════════════════════════════════════════════════════════════

  listCareCoordination: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          status: z
            .enum([
              "intake",
              "active",
              "on_hold",
              "transitioning",
              "discharged",
            ])
            .optional(),
          assignedDepartment: z.enum(["CCMG", "MHTCM", "MHRS"]).optional(),
          caseManagerId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId)
        conditions.push(eq(ccmgCareCoordination.youthId, input.youthId));
      if (input?.status)
        conditions.push(eq(ccmgCareCoordination.status, input.status));
      if (input?.assignedDepartment)
        conditions.push(
          eq(ccmgCareCoordination.assignedDepartment, input.assignedDepartment),
        );
      if (input?.caseManagerId)
        conditions.push(
          eq(ccmgCareCoordination.caseManagerId, input.caseManagerId),
        );

      const results =
        conditions.length > 0
          ? await db
              .select()
              .from(ccmgCareCoordination)
              .where(and(...conditions))
              .orderBy(desc(ccmgCareCoordination.createdAt))
          : await db
              .select()
              .from(ccmgCareCoordination)
              .orderBy(desc(ccmgCareCoordination.createdAt));
      return results;
    }),

  getCareCoordination: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const row = await db
        .select()
        .from(ccmgCareCoordination)
        .where(eq(ccmgCareCoordination.id, input.id))
        .get();
      return row ?? null;
    }),

  createCareCoordination: adminQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        ccmgProgramDirectorId: z.string().optional(),
        ccmgProgramDirectorName: z.string().optional(),
        caseManagerId: z.string().optional(),
        caseManagerName: z.string().optional(),
        assignedDepartment: z.enum(["CCMG", "MHTCM", "MHRS"]).default("CCMG"),
        groLiaisonId: z.string().optional(),
        groLiaisonName: z.string().optional(),
        groFacilityId: z.string().optional(),
        bedAssignment: z.string().optional(),
        projectedDischargeDate: z.string().optional(),
        createdBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(ccmgCareCoordination).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        ccmgProgramDirectorId: input.ccmgProgramDirectorId ?? null,
        ccmgProgramDirectorName: input.ccmgProgramDirectorName ?? null,
        caseManagerId: input.caseManagerId ?? null,
        caseManagerName: input.caseManagerName ?? null,
        assignedDepartment: input.assignedDepartment,
        groLiaisonId: input.groLiaisonId ?? null,
        groLiaisonName: input.groLiaisonName ?? null,
        groFacilityId: input.groFacilityId ?? null,
        bedAssignment: input.bedAssignment ?? null,
        status: "intake",
        admissionDate: now,
        projectedDischargeDate: input.projectedDischargeDate ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy ?? null,
      });

      return { success: true, id };
    }),

  updateCareCoordination: adminQuery
    .input(
      z.object({
        id: z.string(),
        status: z
          .enum(["intake", "active", "on_hold", "transitioning", "discharged"])
          .optional(),
        assignedDepartment: z.enum(["CCMG", "MHTCM", "MHRS"]).optional(),
        caseManagerId: z.string().optional(),
        caseManagerName: z.string().optional(),
        intakeCompleted: z.boolean().optional(),
        assessmentCompleted: z.boolean().optional(),
        cansCompleted: z.boolean().optional(),
        cansScore: z.number().optional(),
        cansRiskLevel: z
          .enum(["low", "moderate", "high", "very_high"])
          .optional(),
        bedAssignment: z.string().optional(),
        projectedDischargeDate: z.string().optional(),
        actualDischargeDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      assertCcmgLegacyCansInputsAbsent(input);
      const db = getDb();
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };

      if (fields.status !== undefined) {
        updateData.status = fields.status;
        if (fields.status === "discharged")
          updateData.actualDischargeDate = now;
      }
      if (fields.assignedDepartment !== undefined)
        updateData.assignedDepartment = fields.assignedDepartment;
      if (fields.caseManagerId !== undefined)
        updateData.caseManagerId = fields.caseManagerId;
      if (fields.caseManagerName !== undefined)
        updateData.caseManagerName = fields.caseManagerName;
      if (fields.intakeCompleted !== undefined) {
        updateData.intakeCompleted = fields.intakeCompleted;
        if (fields.intakeCompleted) updateData.intakeCompletedDate = now;
      }
      if (fields.assessmentCompleted !== undefined) {
        updateData.assessmentCompleted = fields.assessmentCompleted;
        if (fields.assessmentCompleted)
          updateData.assessmentCompletedDate = now;
      }
      if (fields.bedAssignment !== undefined)
        updateData.bedAssignment = fields.bedAssignment;
      if (fields.projectedDischargeDate !== undefined)
        updateData.projectedDischargeDate = fields.projectedDischargeDate;
      if (fields.actualDischargeDate !== undefined)
        updateData.actualDischargeDate = fields.actualDischargeDate;

      await db
        .update(ccmgCareCoordination)
        .set(updateData)
        .where(eq(ccmgCareCoordination.id, id));
      return { success: true };
    }),

  transferDepartment: adminQuery
    .input(
      z.object({
        id: z.string(),
        toDepartment: z.enum(["CCMG", "MHTCM", "MHRS"]),
        transferRationale: z.string(),
        transferredBy: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();

      const current = await db
        .select()
        .from(ccmgCareCoordination)
        .where(eq(ccmgCareCoordination.id, input.id))
        .get();
      if (!current) throw new Error("Care coordination record not found");

      await db
        .update(ccmgCareCoordination)
        .set({
          assignedDepartment: input.toDepartment,
          transferredFrom: current.assignedDepartment,
          departmentTransferDate: now,
          transferRationale: input.transferRationale,
          status: "transitioning",
          updatedAt: now,
        })
        .where(eq(ccmgCareCoordination.id, input.id));

      return {
        success: true,
        fromDepartment: current.assignedDepartment,
        toDepartment: input.toDepartment,
      };
    }),

  // ════════════════════════════════════════════════════════════
  // CROSS-DIVISIONAL REFERRALS
  // ════════════════════════════════════════════════════════════

  listReferrals: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          status: z
            .enum([
              "pending",
              "accepted",
              "scheduled",
              "completed",
              "declined",
              "cancelled",
            ])
            .optional(),
          fromDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]).optional(),
          toDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]).optional(),
          urgency: z.enum(["routine", "urgent", "emergency"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId)
        conditions.push(eq(ccmgReferrals.youthId, input.youthId));
      if (input?.status)
        conditions.push(eq(ccmgReferrals.status, input.status));
      if (input?.fromDepartment)
        conditions.push(eq(ccmgReferrals.fromDepartment, input.fromDepartment));
      if (input?.toDepartment)
        conditions.push(eq(ccmgReferrals.toDepartment, input.toDepartment));
      if (input?.urgency)
        conditions.push(eq(ccmgReferrals.urgency, input.urgency));

      const results =
        conditions.length > 0
          ? await db
              .select()
              .from(ccmgReferrals)
              .where(and(...conditions))
              .orderBy(desc(ccmgReferrals.createdAt))
          : await db
              .select()
              .from(ccmgReferrals)
              .orderBy(desc(ccmgReferrals.createdAt));
      return results;
    }),

  createReferral: adminQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        referralType: z.enum([
          "internal",
          "external",
          "gro_to_bhc",
          "bhc_to_gro",
          "inter_department",
        ]),
        fromDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]),
        toDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]),
        requestedBy: z.string(),
        requestedById: z.string().optional(),
        reasonForReferral: z.string(),
        clinicalJustification: z.string().optional(),
        urgency: z.enum(["routine", "urgent", "emergency"]).default("routine"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(ccmgReferrals).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        referralType: input.referralType,
        fromDepartment: input.fromDepartment,
        toDepartment: input.toDepartment,
        requestedBy: input.requestedBy,
        requestedById: input.requestedById ?? null,
        reasonForReferral: input.reasonForReferral,
        clinicalJustification: input.clinicalJustification ?? null,
        urgency: input.urgency,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id };
    }),

  acceptReferral: adminQuery
    .input(
      z.object({
        id: z.string(),
        acceptedBy: z.string(),
        scheduledDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db
        .update(ccmgReferrals)
        .set({
          status: "accepted",
          acceptedBy: input.acceptedBy,
          acceptedAt: now,
          scheduledDate: input.scheduledDate ?? null,
          updatedAt: now,
        })
        .where(eq(ccmgReferrals.id, input.id));
      return { success: true };
    }),

  completeReferral: adminQuery
    .input(
      z.object({
        id: z.string(),
        outcomeNotes: z.string().optional(),
        followUpRequired: z.boolean().optional(),
        followUpDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db
        .update(ccmgReferrals)
        .set({
          status: "completed",
          completedDate: now,
          outcomeNotes: input.outcomeNotes ?? null,
          followUpRequired: input.followUpRequired ?? false,
          followUpDate: input.followUpDate ?? null,
          updatedAt: now,
        })
        .where(eq(ccmgReferrals.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // BHC DASHBOARD — 3 Department View
  // ════════════════════════════════════════════════════════════

  bhcDashboard: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // ── CCMG: Care Coordination Census ──
    const allCoordination = await db.select().from(ccmgCareCoordination);
    const ccmgActive = allCoordination.filter(
      (c) => c.assignedDepartment === "CCMG" && c.status === "active",
    ).length;
    const ccmgIntake = allCoordination.filter(
      (c) => c.assignedDepartment === "CCMG" && c.status === "intake",
    ).length;
    const ccmgTotal = allCoordination.filter(
      (c) => c.assignedDepartment === "CCMG",
    ).length;

    // ── MHTCM: Case Management Census ──
    const allServicePlans = await db.select().from(mhtcmServicePlans);
    const mhtcmActive = allServicePlans.filter(
      (p) => p.planStatus === "active",
    ).length;
    const mhtcmDraft = allServicePlans.filter(
      (p) => p.planStatus === "draft",
    ).length;
    const mhtcmOverdue = allServicePlans.filter(
      (p) => p.planStatus === "draft" && p.planDueDate && p.planDueDate < now,
    ).length;
    const mhtcmReviewDue = allServicePlans.filter(
      (p) =>
        p.planStatus === "active" && p.nextReviewDue && p.nextReviewDue < now,
    ).length;

    // ── MHTCM Encounters ──
    const allEncounters = await db.select().from(mhtcmEncounters);
    const mhtcmEncountersThisWeek = allEncounters.filter(
      (e) => e.encounterDate >= sevenDaysAgo,
    );
    const mhtcmUnitsThisWeek = mhtcmEncountersThisWeek.reduce(
      (sum, e) => sum + (e.unitsBilled ?? 0),
      0,
    );

    // ── Eligibility ──
    const allEligibility = await db.select().from(mhtcmEligibility);
    const eligibleCount = allEligibility.filter(
      (e) => e.eligibilityStatus === "eligible",
    ).length;
    const pendingEligibility = allEligibility.filter(
      (e) => e.eligibilityStatus === "pending",
    ).length;

    // ── Cross-Divisional Referrals ──
    const allReferrals = await db.select().from(ccmgReferrals);
    const referralsPending = allReferrals.filter(
      (r) => r.status === "pending",
    ).length;
    const referralsThisWeek = allReferrals.filter(
      (r) => r.requestDate !== null && r.requestDate >= sevenDaysAgo,
    ).length;
    const groToBhcReferrals = allReferrals.filter(
      (r) => r.referralType === "gro_to_bhc" && r.status !== "completed",
    ).length;

    // ── Department Metrics (from metrics table if seeded) ──
    const recentMetrics = await db
      .select()
      .from(bhcDepartmentMetrics)
      .where(
        sql`${bhcDepartmentMetrics.metricDate} >= ${thirtyDaysAgo.split("T")[0]}`,
      )
      .orderBy(desc(bhcDepartmentMetrics.metricDate));

    // ── MHRS Department Card ──
    const mhrsPlans = await db.select().from(mhrsServicePlans);
    const mhrsActive = mhrsPlans.filter(
      (p) => p.planStatus === "active",
    ).length;
    const mhrsDraft = mhrsPlans.filter((p) => p.planStatus === "draft").length;
    const mhrsOverdue = mhrsPlans.filter(
      (p) => p.planStatus === "draft" && p.planDueDate && p.planDueDate < now,
    ).length;
    const mhrsReviewDue = mhrsPlans.filter(
      (p) =>
        p.planStatus === "active" && p.nextReviewDue && p.nextReviewDue < now,
    ).length;
    const mhrsEncountersAll = await db.select().from(mhrsEncounters);
    const mhrsEncountersWeek = mhrsEncountersAll.filter(
      (e) => e.encounterDate >= sevenDaysAgo,
    );
    const mhrsUnitsWeek = mhrsEncountersWeek.reduce(
      (sum, e) => sum + (e.unitsBilled ?? 0),
      0,
    );
    const mhrsCategoriesCompleted = [
      mhrsPlans.filter((p) => p.cat1PsychoCompleted).length,
      mhrsPlans.filter((p) => p.cat2SkillsCompleted).length,
      mhrsPlans.filter((p) => p.cat3SupportiveCompleted).length,
      mhrsPlans.filter((p) => p.cat4CommunityCompleted).length,
    ];
    const mhrsTotalCategories = mhrsPlans.length * 4;
    const mhrsCategoriesDone = mhrsCategoriesCompleted.reduce(
      (a, b) => a + b,
      0,
    );

    return {
      // CCMG Department Card
      ccmg: {
        activeCases: ccmgActive,
        intakeCases: ccmgIntake,
        totalCases: ccmgTotal,
        governedAssessmentMode: M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED,
        pendingReferrals: referralsPending,
        groToBhcPending: groToBhcReferrals,
      },
      // MHTCM Department Card
      mhtcm: {
        activePlans: mhtcmActive,
        draftPlans: mhtcmDraft,
        overduePlans: mhtcmOverdue,
        reviewDue: mhtcmReviewDue,
        encountersThisWeek: mhtcmEncountersThisWeek.length,
        unitsThisWeek: mhtcmUnitsThisWeek,
        eligibleYouth: eligibleCount,
        pendingEligibility,
      },
      // ── MHRS Department Card ──
      mhrs: {
        activePrograms: mhrsActive,
        draftPrograms: mhrsDraft,
        overduePlans: mhrsOverdue,
        reviewDue: mhrsReviewDue,
        encountersThisWeek: mhrsEncountersWeek.length,
        unitsThisWeek: mhrsUnitsWeek,
        categoriesCompleted: mhrsCategoriesDone,
        categoriesTotal: mhrsTotalCategories,
        categoryBreakdown: {
          psychosocial: mhrsCategoriesCompleted[0],
          skills: mhrsCategoriesCompleted[1],
          supportive: mhrsCategoriesCompleted[2],
          community: mhrsCategoriesCompleted[3],
        },
      },
      // Cross-divisional summary
      referrals: {
        totalThisWeek: referralsThisWeek,
        pending: referralsPending,
        groToBhcPending: groToBhcReferrals,
      },
      // Recent metrics entries
      recentMetrics: recentMetrics.slice(0, 10),
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedCcmgData: adminQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    // Synthetic demonstration fixtures only. These labels and record identifiers
    // are deliberately non-personal and must never be treated as patient data.
    const db = getDb();
    const now = new Date().toISOString();

    // Seed care coordination records
    await db
      .insert(ccmgCareCoordination)
      .values([
        {
          id: "cc-001",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          ccmgProgramDirectorId: "user-003",
          ccmgProgramDirectorName: "Demo Clinical Director",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          assignedDepartment: "MHTCM",
          groLiaisonId: "user-gro-001",
          groLiaisonName: "Synthetic Staff 08",
          groFacilityId: "fac-001",
          bedAssignment: "MR-101-1",
          intakeCompleted: true,
          intakeCompletedDate: "2026-06-16",
          assessmentCompleted: true,
          assessmentCompletedDate: "2026-06-18",
          status: "active",
          admissionDate: "2026-06-15",
          projectedDischargeDate: "2026-09-15",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "cc-002",
          youthId: "youth-002",
          youthName: "Synthetic Youth 005",
          mrn: "SYNTH-REC-002",
          ccmgProgramDirectorId: "user-003",
          ccmgProgramDirectorName: "Demo Clinical Director",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          assignedDepartment: "CCMG",
          groLiaisonId: "user-gro-001",
          groLiaisonName: "Synthetic Staff 08",
          groFacilityId: "fac-001",
          bedAssignment: "MR-102-1",
          intakeCompleted: true,
          intakeCompletedDate: "2026-07-02",
          assessmentCompleted: false,
          assessmentCompletedDate: null,
          status: "intake",
          admissionDate: "2026-07-01",
          projectedDischargeDate: "2026-10-01",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "cc-003",
          youthId: "youth-003",
          youthName: "Synthetic Youth 014",
          mrn: "SYNTH-REC-003",
          ccmgProgramDirectorId: "user-003",
          ccmgProgramDirectorName: "Demo Clinical Director",
          caseManagerId: "user-cm-002",
          caseManagerName: "Synthetic Case Manager 02",
          assignedDepartment: "CCMG",
          groLiaisonId: "user-gro-002",
          groLiaisonName: "Synthetic Staff 09",
          groFacilityId: "fac-001",
          bedAssignment: "MR-103-1",
          intakeCompleted: false,
          intakeCompletedDate: null,
          assessmentCompleted: false,
          assessmentCompletedDate: null,
          status: "intake",
          admissionDate: "2026-07-03",
          projectedDischargeDate: "2026-10-03",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    // Seed cross-divisional referrals
    await db
      .insert(ccmgReferrals)
      .values([
        {
          id: "ref-001",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          referralType: "gro_to_bhc",
          fromDepartment: "GRO",
          toDepartment: "CCMG",
          requestedBy: "Synthetic Staff 08",
          requestedById: "user-gro-001",
          requestDate: "2026-06-14",
          reasonForReferral:
            "Youth admitted to GRO facility — requires BHC clinical intake and comprehensive assessment",
          clinicalJustification:
            "New admission per court order. History of DMDD and ADHD. Requires comprehensive BHC evaluation.",
          urgency: "urgent",
          status: "completed",
          acceptedBy: "Demo Clinical Director",
          acceptedAt: "2026-06-14",
          scheduledDate: "2026-06-15",
          completedDate: "2026-06-15",
          outcomeNotes:
            "Intake completed. Comprehensive assessment scheduled for 6/18. Assigned to Demo Case Manager for case management.",
          followUpRequired: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ref-002",
          youthId: "youth-002",
          youthName: "Synthetic Youth 005",
          mrn: "SYNTH-REC-002",
          referralType: "gro_to_bhc",
          fromDepartment: "GRO",
          toDepartment: "CCMG",
          requestedBy: "Synthetic Staff 08",
          requestedById: "user-gro-001",
          requestDate: "2026-06-30",
          reasonForReferral:
            "New GRO admission — requires BHC intake assessment",
          clinicalJustification:
            "Youth presents with anxiety and depression symptoms. Guardian reports school refusal.",
          urgency: "routine",
          status: "completed",
          acceptedBy: "Demo Clinical Director",
          acceptedAt: "2026-06-30",
          scheduledDate: "2026-07-01",
          completedDate: "2026-07-01",
          outcomeNotes:
            "Intake completed. Assessment in progress. Eligibility review pending.",
          followUpRequired: true,
          followUpDate: "2026-07-08",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ref-003",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          referralType: "inter_department",
          fromDepartment: "CCMG",
          toDepartment: "MHTCM",
          requestedBy: "Demo Case Manager",
          requestedById: "user-cm-001",
          requestDate: "2026-06-20",
          reasonForReferral:
            "CCMG intake complete — transfer to MHTCM for ongoing case management",
          clinicalJustification:
            "Comprehensive assessment documents functional impairment. A qualified human reviewer approved transfer for MHTCM T1017 services.",
          urgency: "routine",
          status: "completed",
          acceptedBy: "Demo Case Manager",
          acceptedAt: "2026-06-20",
          scheduledDate: "2026-06-20",
          completedDate: "2026-06-20",
          outcomeNotes:
            "Department transfer completed. Service plan SP-001 activated. T1017 billing authorized.",
          followUpRequired: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ref-004",
          youthId: "youth-004",
          youthName: "Synthetic Youth 027",
          mrn: "SYNTH-REC-004",
          referralType: "gro_to_bhc",
          fromDepartment: "GRO",
          toDepartment: "CCMG",
          requestedBy: "Synthetic Staff 09",
          requestedById: "user-gro-002",
          requestDate: "2026-07-04",
          reasonForReferral:
            "Pending GRO admission — pre-admission BHC screening",
          clinicalJustification:
            "Youth on waitlist. Requires pre-admission clinical screening to determine appropriateness.",
          urgency: "urgent",
          status: "pending",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    // Seed department metrics
    await db
      .insert(bhcDepartmentMetrics)
      .values([
        {
          id: "dm-001",
          department: "CCMG",
          metricDate: "2026-07-01",
          activeCases: 3,
          newIntakes: 2,
          discharges: 0,
          transfersIn: 1,
          transfersOut: 1,
          avgLengthOfStayDays: 14,
          plansOverdue: 0,
          encountersThisWeek: 5,
          satisfactionScore: 88,
          staffCount: 4,
          openPositions: 1,
          createdAt: now,
        },
        {
          id: "dm-002",
          department: "MHTCM",
          metricDate: "2026-07-01",
          activeCases: 1,
          newIntakes: 1,
          discharges: 0,
          transfersIn: 1,
          transfersOut: 0,
          avgLengthOfStayDays: 21,
          plansOverdue: 1,
          encountersThisWeek: 4,
          satisfactionScore: 92,
          staffCount: 3,
          openPositions: 0,
          createdAt: now,
        },
        {
          id: "dm-003",
          department: "MHRS",
          metricDate: "2026-07-01",
          activeCases: 0,
          newIntakes: 0,
          discharges: 0,
          transfersIn: 0,
          transfersOut: 0,
          avgLengthOfStayDays: null,
          plansOverdue: 0,
          encountersThisWeek: 0,
          satisfactionScore: null,
          staffCount: 2,
          openPositions: 1,
          createdAt: now,
        },
      ])
      .onConflictDoNothing();

    return {
      success: true,
      message:
        "CCMG seeded: 3 care coordination records, 4 referrals, 3 department metrics",
    };
  }),
});
