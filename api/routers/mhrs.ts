import { z } from "zod";
import { createRouter, authedQuery, adminQuery, roleQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  mhrsServicePlans,
  mhrsEncounters,
  mhrsSkillsAssessments,
} from "@db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

const mhrsWrite = roleQuery([
  "super-admin", "managing-director", "administrator", "bhc-director",
  "treatment-director", "clinical-director", "mhrs-supervisor",
  "clinical-supervisor", "qmhp-cs", "therapist", "intake-coordinator",
]);

// ══════════════════════════════════════════════════════════════
// MHRS: Mental Health Rehabilitative Services Router (T-005)
// 4 categories: Psychosocial Rehab, Skills Training,
// Supportive Interventions, Community Integration. H2017 billing.
// ══════════════════════════════════════════════════════════════

export const M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED =
  "M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED" as const;

export function quarantineMhrsLegacyCansInput(): never {
  throw new Error(M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED);
}

export function assertMhrsServicePlanLegacyCansInputsAbsent(input: {
  cansDomainPrimary?: unknown;
  cansDomainSecondary?: unknown;
  cansBaselineScore?: unknown;
  cansTargetScore?: unknown;
}): void {
  if (
    input.cansDomainPrimary !== undefined ||
    input.cansDomainSecondary !== undefined ||
    input.cansBaselineScore !== undefined ||
    input.cansTargetScore !== undefined
  ) {
    quarantineMhrsLegacyCansInput();
  }
}

export function assertMhrsEncounterLegacyCansInputsAbsent(input: {
  cansDomainTargeted?: unknown;
  cansScoreCurrent?: unknown;
}): void {
  if (
    input.cansDomainTargeted !== undefined ||
    input.cansScoreCurrent !== undefined
  ) {
    quarantineMhrsLegacyCansInput();
  }
}

export function assertMhrsSkillsAssessmentLegacyCansInputsAbsent(input: {
  cansDomain?: unknown;
}): void {
  if (input.cansDomain !== undefined) {
    quarantineMhrsLegacyCansInput();
  }
}

export const mhrsRouter = createRouter({

  // ════════════════════════════════════════════════════════════
  // SERVICE PLANS
  // ════════════════════════════════════════════════════════════

  listServicePlans: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      status: z.enum(["draft", "active", "under_review", "approved", "superseded", "closed"]).optional(),
      therapistId: z.string().optional(),
      overdueReview: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId) conditions.push(eq(mhrsServicePlans.youthId, input.youthId));
      if (input?.status) conditions.push(eq(mhrsServicePlans.planStatus, input.status));
      if (input?.therapistId) conditions.push(eq(mhrsServicePlans.therapistId, input.therapistId));

      let results = conditions.length > 0
        ? await db.select().from(mhrsServicePlans).where(and(...conditions)).orderBy(desc(mhrsServicePlans.createdAt))
        : await db.select().from(mhrsServicePlans).orderBy(desc(mhrsServicePlans.createdAt));

      if (input?.overdueReview) {
        const now = new Date().toISOString();
        results = results.filter((r) => r.nextReviewDue && r.nextReviewDue < now && r.planStatus === "active");
      }
      return results;
    }),

  getServicePlan: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plan = await db.select().from(mhrsServicePlans).where(eq(mhrsServicePlans.id, input.id)).get();
      if (!plan) return null;

      const encounters = await db.select().from(mhrsEncounters)
        .where(eq(mhrsEncounters.servicePlanId, input.id))
        .orderBy(desc(mhrsEncounters.encounterDate));

      const assessments = await db.select().from(mhrsSkillsAssessments)
        .where(eq(mhrsSkillsAssessments.servicePlanId, input.id))
        .orderBy(desc(mhrsSkillsAssessments.assessmentDate));

      const categoriesCompleted = [
        plan.cat1PsychoCompleted, plan.cat2SkillsCompleted,
        plan.cat3SupportiveCompleted, plan.cat4CommunityCompleted,
      ].filter(Boolean).length;

      return { ...plan, encounters, assessments, categoriesCompleted, categoriesTotal: 4 };
    }),

  createServicePlan: mhrsWrite
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      mhrsSupervisorId: z.string().optional(),
      mhrsSupervisorName: z.string().optional(),
      therapistId: z.string().optional(),
      therapistName: z.string().optional(),
      intakeDate: z.string(),
      cansDomainPrimary: z.enum(["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"]).optional(),
      cansDomainSecondary: z.enum(["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"]).optional(),
      cansBaselineScore: z.number().optional(),
      cansTargetScore: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      assertMhrsServicePlanLegacyCansInputsAbsent(input);
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      const intake = new Date(input.intakeDate);
      const planDue = new Date(intake.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

      await db.insert(mhrsServicePlans).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        mhrsSupervisorId: input.mhrsSupervisorId ?? null,
        mhrsSupervisorName: input.mhrsSupervisorName ?? null,
        therapistId: input.therapistId ?? null,
        therapistName: input.therapistName ?? null,
        planStatus: "draft",
        version: 1,
        intakeDate: input.intakeDate,
        planDueDate: planDue,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id, planDueDate: planDue };
    }),

  updateServicePlan: mhrsWrite
    .input(z.object({
      id: z.string(),
      planStatus: z.enum(["draft", "active", "under_review", "approved", "superseded", "closed"]).optional(),
      cat1PsychoGoal: z.string().optional(),
      cat1PsychoObjectives: z.string().optional(),
      cat1PsychoCompleted: z.boolean().optional(),
      cat2SkillsGoal: z.string().optional(),
      cat2SkillsObjectives: z.string().optional(),
      cat2SkillsCompleted: z.boolean().optional(),
      cat3SupportiveGoal: z.string().optional(),
      cat3SupportiveObjectives: z.string().optional(),
      cat3SupportiveCompleted: z.boolean().optional(),
      cat4CommunityGoal: z.string().optional(),
      cat4CommunityObjectives: z.string().optional(),
      cat4CommunityCompleted: z.boolean().optional(),
      preparedBy: z.string().optional(),
      reviewedBy: z.string().optional(),
      approvedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const updateData: Record<string, string | boolean | null> = { updatedAt: now };

      if (fields.planStatus !== undefined) {
        updateData.planStatus = fields.planStatus;
        if (fields.planStatus === "approved") {
          updateData.approvedAt = now;
          updateData.nextReviewDue = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
      if (fields.cat1PsychoGoal !== undefined) updateData.cat1PsychoGoal = fields.cat1PsychoGoal;
      if (fields.cat1PsychoObjectives !== undefined) updateData.cat1PsychoObjectives = fields.cat1PsychoObjectives;
      if (fields.cat1PsychoCompleted !== undefined) updateData.cat1PsychoCompleted = fields.cat1PsychoCompleted;
      if (fields.cat2SkillsGoal !== undefined) updateData.cat2SkillsGoal = fields.cat2SkillsGoal;
      if (fields.cat2SkillsObjectives !== undefined) updateData.cat2SkillsObjectives = fields.cat2SkillsObjectives;
      if (fields.cat2SkillsCompleted !== undefined) updateData.cat2SkillsCompleted = fields.cat2SkillsCompleted;
      if (fields.cat3SupportiveGoal !== undefined) updateData.cat3SupportiveGoal = fields.cat3SupportiveGoal;
      if (fields.cat3SupportiveObjectives !== undefined) updateData.cat3SupportiveObjectives = fields.cat3SupportiveObjectives;
      if (fields.cat3SupportiveCompleted !== undefined) updateData.cat3SupportiveCompleted = fields.cat3SupportiveCompleted;
      if (fields.cat4CommunityGoal !== undefined) updateData.cat4CommunityGoal = fields.cat4CommunityGoal;
      if (fields.cat4CommunityObjectives !== undefined) updateData.cat4CommunityObjectives = fields.cat4CommunityObjectives;
      if (fields.cat4CommunityCompleted !== undefined) updateData.cat4CommunityCompleted = fields.cat4CommunityCompleted;
      if (fields.preparedBy !== undefined) { updateData.preparedBy = fields.preparedBy; updateData.preparedAt = now; }
      if (fields.reviewedBy !== undefined) { updateData.reviewedBy = fields.reviewedBy; updateData.reviewedAt = now; }
      if (fields.approvedBy !== undefined) { updateData.approvedBy = fields.approvedBy; updateData.approvedAt = now; }

      await db.update(mhrsServicePlans).set(updateData).where(eq(mhrsServicePlans.id, id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // ENCOUNTERS (H2017 Billing)
  // ════════════════════════════════════════════════════════════

  listEncounters: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      servicePlanId: z.string().optional(),
      therapistId: z.string().optional(),
      mhrsCategory: z.enum(["psychosocial_rehabilitation", "skills_training", "supportive_interventions", "community_integration"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId) conditions.push(eq(mhrsEncounters.youthId, input.youthId));
      if (input?.servicePlanId) conditions.push(eq(mhrsEncounters.servicePlanId, input.servicePlanId));
      if (input?.therapistId) conditions.push(eq(mhrsEncounters.therapistId, input.therapistId));
      if (input?.mhrsCategory) conditions.push(eq(mhrsEncounters.mhrsCategory, input.mhrsCategory));
      if (input?.dateFrom) conditions.push(gte(mhrsEncounters.encounterDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(mhrsEncounters.encounterDate, input.dateTo));

      const results = conditions.length > 0
        ? await db.select().from(mhrsEncounters).where(and(...conditions)).orderBy(desc(mhrsEncounters.encounterDate))
        : await db.select().from(mhrsEncounters).orderBy(desc(mhrsEncounters.encounterDate));
      return results;
    }),

  createEncounter: mhrsWrite
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      servicePlanId: z.string(),
      therapistId: z.string(),
      therapistName: z.string(),
      encounterDate: z.string(),
      encounterType: z.enum(["individual_skills", "group_skills", "psychoeducational", "community_integration", "family_session", "crisis_intervention"]),
      mhrsCategory: z.enum(["psychosocial_rehabilitation", "skills_training", "supportive_interventions", "community_integration"]),
      unitsBilled: z.number().default(1),
      minutesDelivered: z.number().default(15),
      cansDomainTargeted: z.enum(["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"]).optional(),
      serviceDescription: z.string(),
      skillsTaught: z.string().optional(),
      youthProgress: z.string().optional(),
      barriersIdentified: z.string().optional(),
      homeworkAssignment: z.string().optional(),
      nextSteps: z.string().optional(),
      goalProgress: z.enum(["no_change", "minimal_progress", "moderate_progress", "significant_progress", "goal_achieved"]).optional(),
      cansScoreCurrent: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      assertMhrsEncounterLegacyCansInputsAbsent(input);
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(mhrsEncounters).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        servicePlanId: input.servicePlanId,
        therapistId: input.therapistId,
        therapistName: input.therapistName,
        encounterDate: input.encounterDate,
        encounterType: input.encounterType,
        billingCode: "H2017",
        unitsBilled: input.unitsBilled,
        minutesDelivered: input.minutesDelivered,
        mhrsCategory: input.mhrsCategory,
        serviceDescription: input.serviceDescription,
        skillsTaught: input.skillsTaught ?? null,
        youthProgress: input.youthProgress ?? null,
        barriersIdentified: input.barriersIdentified ?? null,
        homeworkAssignment: input.homeworkAssignment ?? null,
        nextSteps: input.nextSteps ?? null,
        goalProgress: input.goalProgress ?? "no_change",
        documentationStatus: "draft",
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id, billingCode: "H2017", unitsBilled: input.unitsBilled };
    }),

  signEncounter: mhrsWrite
    .input(z.object({ id: z.string(), signedBy: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(mhrsEncounters).set({
        documentationStatus: "signed", signedBy: input.signedBy, signedAt: now, updatedAt: now,
      }).where(eq(mhrsEncounters.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // SKILLS ASSESSMENTS
  // ════════════════════════════════════════════════════════════

  listSkillsAssessments: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      servicePlanId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId) conditions.push(eq(mhrsSkillsAssessments.youthId, input.youthId));
      if (input?.servicePlanId) conditions.push(eq(mhrsSkillsAssessments.servicePlanId, input.servicePlanId));

      const results = conditions.length > 0
        ? await db.select().from(mhrsSkillsAssessments).where(and(...conditions)).orderBy(desc(mhrsSkillsAssessments.assessmentDate))
        : await db.select().from(mhrsSkillsAssessments).orderBy(desc(mhrsSkillsAssessments.assessmentDate));
      return results;
    }),

  createSkillsAssessment: mhrsWrite
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      servicePlanId: z.string(),
      assessedBy: z.string(),
      assessedById: z.string().optional(),
      assessmentDate: z.string(),
      cansDomain: z.enum(["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"]).optional(),
      skillAreasJson: z.string(), // [{area, baselineScore, currentScore, targetScore}]
      overallBaseline: z.number().optional(),
      overallCurrent: z.number().optional(),
      overallTarget: z.number().optional(),
      progressPercentage: z.number().optional(),
      readinessForTransition: z.enum(["not_ready", "approaching", "ready", "transitioned"]).optional(),
    }))
    .mutation(async ({ input }) => {
      assertMhrsSkillsAssessmentLegacyCansInputsAbsent(input);
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(mhrsSkillsAssessments).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        servicePlanId: input.servicePlanId,
        assessedBy: input.assessedBy,
        assessedById: input.assessedById ?? null,
        assessmentDate: input.assessmentDate,
        // Compatibility value for the inherited non-null storage column only.
        // It is fixed, not client-derived, and is never interpreted or scored.
        cansDomain: "functioning",
        skillAreasJson: input.skillAreasJson,
        overallBaseline: input.overallBaseline ?? null,
        overallCurrent: input.overallCurrent ?? null,
        overallTarget: input.overallTarget ?? null,
        progressPercentage: input.progressPercentage ?? null,
        readinessForTransition: input.readinessForTransition ?? "not_ready",
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id };
    }),

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════

  mhrsDashboard: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Plans
    const allPlans = await db.select().from(mhrsServicePlans);
    const activePlans = allPlans.filter((p) => p.planStatus === "active");
    const draftPlans = allPlans.filter((p) => p.planStatus === "draft");
    const overduePlans = draftPlans.filter((p) => p.planDueDate && p.planDueDate < now);
    const plansNeedingReview = activePlans.filter((p) => p.nextReviewDue && p.nextReviewDue < now);

    // Category completion
    const psychoCompleted = allPlans.filter((p) => p.cat1PsychoCompleted).length;
    const skillsCompleted = allPlans.filter((p) => p.cat2SkillsCompleted).length;
    const supportiveCompleted = allPlans.filter((p) => p.cat3SupportiveCompleted).length;
    const communityCompleted = allPlans.filter((p) => p.cat4CommunityCompleted).length;

    // Encounters
    const allEncounters = await db.select().from(mhrsEncounters);
    const encountersThisMonth = allEncounters.filter((e) => e.encounterDate >= thirtyDaysAgo);
    const totalUnitsThisMonth = encountersThisMonth.reduce((sum, e) => sum + (e.unitsBilled ?? 0), 0);

    // By category
    const byCategory: Record<string, number> = {};
    for (const e of encountersThisMonth) {
      byCategory[e.mhrsCategory] = (byCategory[e.mhrsCategory] ?? 0) + (e.unitsBilled ?? 0);
    }

    // By CANS domain
    const byCansDomain: Record<string, number> = {};
    for (const e of encountersThisMonth) {
      if (e.cansDomainTargeted) {
        byCansDomain[e.cansDomainTargeted] = (byCansDomain[e.cansDomainTargeted] ?? 0) + 1;
      }
    }

    // Documentation status
    const draftDoc = allEncounters.filter((e) => e.documentationStatus === "draft").length;
    const signedDoc = allEncounters.filter((e) => e.documentationStatus === "signed").length;
    const submittedDoc = allEncounters.filter((e) => e.documentationStatus === "submitted").length;

    // Skills assessments
    const allAssessments = await db.select().from(mhrsSkillsAssessments);
    const avgProgress = allAssessments.length > 0
      ? Math.round(allAssessments.reduce((sum, a) => sum + (a.progressPercentage ?? 0), 0) / allAssessments.length)
      : 0;

    return {
      plans: {
        total: allPlans.length,
        active: activePlans.length,
        draft: draftPlans.length,
        overdue: overduePlans.length,
        needingReview: plansNeedingReview.length,
      },
      categories: {
        psychoCompleted,
        skillsCompleted,
        supportiveCompleted,
        communityCompleted,
        total: allPlans.length * 4,
      },
      encounters: {
        total: allEncounters.length,
        thisMonth: encountersThisMonth.length,
        unitsThisMonth: totalUnitsThisMonth,
        byCategory,
        byCansDomain,
      },
      documentation: { draft: draftDoc, signed: signedDoc, submitted: submittedDoc },
      skills: {
        totalAssessments: allAssessments.length,
        avgProgressPercentage: avgProgress,
      },
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedMhrsData: adminQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    const db = getDb();
    const now = new Date().toISOString();

    // Seed service plan
    await db.insert(mhrsServicePlans).values([
      {
        id: "mhrs-sp-001", youthId: "youth-001", youthName: "Synthetic Youth 001", mrn: "SYNTH-REC-001",
        mhrsSupervisorId: "user-mhrs-001", mhrsSupervisorName: "Dr. Rebecca Torres",
        therapistId: "user-tx-001", therapistName: "Synthetic-Person-004 Mendez",
        planStatus: "active", version: 1,
        intakeDate: "2026-06-15", planDueDate: "2026-06-29", planCompletedDate: "2026-06-27",
        nextReviewDue: "2026-09-27", lastReviewDate: null,
        cat1PsychoGoal: "Develop emotional regulation skills to reduce outburst frequency from 3x/week to <1x/week",
        cat1PsychoObjectives: JSON.stringify([
          { objective: "Identify personal triggers using feelings thermometer", targetDate: "2026-07-15" },
          { objective: "Practice deep breathing technique during 80% of escalating situations", targetDate: "2026-08-01" },
        ]),
        cat1PsychoCompleted: false,
        cat2SkillsGoal: "Build social skills for peer interaction and conflict resolution",
        cat2SkillsObjectives: JSON.stringify([
          { objective: "Participate in 3 group skills sessions with active engagement", targetDate: "2026-07-30" },
          { objective: "Use 'I-statements' in 5 peer conflicts with staff observation", targetDate: "2026-08-15" },
        ]),
        cat2SkillsCompleted: false,
        cat3SupportiveGoal: "Strengthen coping strategies for school transition anxiety",
        cat3SupportiveObjectives: JSON.stringify([
          { objective: "Complete daily coping skills log with 70% adherence", targetDate: "2026-07-30" },
          { objective: "Develop personalized calm-down kit with therapist", targetDate: "2026-07-20" },
        ]),
        cat3SupportiveCompleted: false,
        cat4CommunityGoal: "Successfully participate in community recreational activities",
        cat4CommunityObjectives: JSON.stringify([
          { objective: "Attend 2 community outings with positive behavioral report", targetDate: "2026-08-15" },
          { objective: "Engage with community peers for 15+ minutes without prompting", targetDate: "2026-08-30" },
        ]),
        cat4CommunityCompleted: false,
        preparedBy: "Synthetic-Person-004 Mendez", preparedAt: "2026-06-27",
        reviewedBy: "Dr. Rebecca Torres", reviewedAt: "2026-06-28",
        approvedBy: "Demo Clinical Director", approvedAt: "2026-06-28",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Seed encounters
    await db.insert(mhrsEncounters).values([
      {
        id: "mhrs-enc-001", youthId: "youth-001", youthName: "Synthetic Youth 001", mrn: "SYNTH-REC-001",
        servicePlanId: "mhrs-sp-001", therapistId: "user-tx-001", therapistName: "Synthetic-Person-004 Mendez",
        encounterDate: "2026-06-20", encounterType: "individual_skills", mhrsCategory: "skills_training",
        billingCode: "H2017", unitsBilled: 4, minutesDelivered: 60,
        serviceDescription: "Individual skills training session focused on emotional regulation techniques.",
        skillsTaught: "Feelings thermometer, deep breathing (4-7-8 technique), grounding using 5 senses",
        youthProgress: "Youth was able to identify 3 personal triggers and practiced breathing technique twice.",
        homeworkAssignment: "Practice breathing technique daily — mark on coping skills log",
        goalProgress: "minimal_progress",
        documentationStatus: "submitted",
        createdAt: now, updatedAt: now,
      },
      {
        id: "mhrs-enc-002", youthId: "youth-001", youthName: "Synthetic Youth 001", mrn: "SYNTH-REC-001",
        servicePlanId: "mhrs-sp-001", therapistId: "user-tx-001", therapistName: "Synthetic-Person-004 Mendez",
        encounterDate: "2026-06-27", encounterType: "group_skills", mhrsCategory: "psychosocial_rehabilitation",
        billingCode: "H2017", unitsBilled: 2, minutesDelivered: 90,
        serviceDescription: "Group psychoeducational session on peer communication and active listening.",
        skillsTaught: "Active listening (reflective paraphrasing), turn-taking in conversation, recognizing non-verbal cues",
        youthProgress: "Participated actively in group. Used 'I-statements' during role-play exercise.",
        goalProgress: "moderate_progress",
        documentationStatus: "signed", signedBy: "Synthetic-Person-004 Mendez", signedAt: "2026-06-27",
        createdAt: now, updatedAt: now,
      },
      {
        id: "mhrs-enc-003", youthId: "youth-001", youthName: "Synthetic Youth 001", mrn: "SYNTH-REC-001",
        servicePlanId: "mhrs-sp-001", therapistId: "user-tx-001", therapistName: "Synthetic-Person-004 Mendez",
        encounterDate: "2026-07-04", encounterType: "community_integration", mhrsCategory: "community_integration",
        billingCode: "H2017", unitsBilled: 3, minutesDelivered: 120,
        serviceDescription: "Supervised community outing to local recreation center. Focus on social engagement with community peers.",
        skillsTaught: "Initiating conversation with unfamiliar peers, appropriate social boundaries, community safety awareness",
        youthProgress: "Engaged with 2 community peers for 20-minute basketball game. Required one verbal prompt to initiate.",
        goalProgress: "significant_progress",
        documentationStatus: "draft",
        createdAt: now, updatedAt: now,
      },
    ]).onConflictDoNothing();

    // Governed-assessment records are intentionally not seeded. They must
    // originate from a validated pathway and a named human review workflow.
    return {
      success: true,
      message:
        "MHRS seeded: 1 service plan and 3 encounters (9 H2017 units); governed-assessment records remain unseeded",
    };
  }),
});
