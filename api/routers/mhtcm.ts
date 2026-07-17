import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  mhtcmServicePlans,
  mhtcmEncounters,
  mhtcmEligibility,
} from "@db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

// ══════════════════════════════════════════════════════════════
// MHTCM: Mental Health Targeted Case Management Router (T-004)
// 6 core functions per HHSC. T1017 billing. 14-day service plan.
// ══════════════════════════════════════════════════════════════

export const M41C_LEGACY_CANS_LOGIC_QUARANTINED =
  "M41C_LEGACY_CANS_LOGIC_QUARANTINED" as const;
export const M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED =
  "M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED" as const;

export function quarantineMhtcmLegacyCansLogic(): never {
  throw new Error(M41C_LEGACY_CANS_LOGIC_QUARANTINED);
}

export function assertMhtcmServicePlanLegacyCansInputsAbsent(input: {
  cansScoreAtIntake?: unknown;
  cansRiskLevel?: unknown;
  locLevel?: unknown;
}): void {
  if (
    input.cansScoreAtIntake !== undefined ||
    input.cansRiskLevel !== undefined ||
    input.locLevel !== undefined
  ) {
    quarantineMhtcmLegacyCansLogic();
  }
}

export function assertMhtcmEligibilityLegacyCansInputsAbsent(input: {
  cansAssessmentId?: unknown;
  cansTotalScore?: unknown;
}): void {
  if (
    input.cansAssessmentId !== undefined ||
    input.cansTotalScore !== undefined
  ) {
    quarantineMhtcmLegacyCansLogic();
  }
}

export function quarantineMhtcmUngovernedEligibilityDecision(): never {
  throw new Error(M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED);
}

export function assertMhtcmEligibilityDecisionNotActivated(input: {
  eligibilityStatus?: unknown;
}): void {
  if (
    input.eligibilityStatus === "eligible" ||
    input.eligibilityStatus === "ineligible"
  ) {
    quarantineMhtcmUngovernedEligibilityDecision();
  }
}

export function mhtcmEligibilityReviewStatus(input: {
  ageQualified?: boolean;
  diagnosisQualified?: boolean;
  functionalImpairment?: boolean;
  medicaidEligible?: boolean;
}): "pending" | "under_review" {
  const criteriaDocumentationComplete =
    (input.ageQualified ?? false) &&
    (input.diagnosisQualified ?? false) &&
    (input.functionalImpairment ?? false) &&
    (input.medicaidEligible ?? false);
  return criteriaDocumentationComplete ? "under_review" : "pending";
}

export const mhtcmRouter = createRouter({
  // ════════════════════════════════════════════════════════════
  // SERVICE PLANS
  // ════════════════════════════════════════════════════════════

  listServicePlans: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          caseManagerId: z.string().optional(),
          status: z
            .enum([
              "draft",
              "active",
              "under_review",
              "approved",
              "superseded",
              "closed",
            ])
            .optional(),
          overdueReview: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId)
        conditions.push(eq(mhtcmServicePlans.youthId, input.youthId));
      if (input?.caseManagerId)
        conditions.push(
          eq(mhtcmServicePlans.caseManagerId, input.caseManagerId),
        );
      if (input?.status)
        conditions.push(eq(mhtcmServicePlans.planStatus, input.status));

      const results =
        conditions.length > 0
          ? await db
              .select()
              .from(mhtcmServicePlans)
              .where(and(...conditions))
              .orderBy(desc(mhtcmServicePlans.createdAt))
          : await db
              .select()
              .from(mhtcmServicePlans)
              .orderBy(desc(mhtcmServicePlans.createdAt));

      // Filter overdue reviews in memory if requested
      if (input?.overdueReview) {
        const now = new Date().toISOString();
        return results.filter(
          (r) =>
            r.nextReviewDue &&
            r.nextReviewDue < now &&
            r.planStatus === "active",
        );
      }
      return results;
    }),

  getServicePlan: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plan = await db
        .select()
        .from(mhtcmServicePlans)
        .where(eq(mhtcmServicePlans.id, input.id))
        .get();
      if (!plan) return null;

      // Get associated encounters
      const encounters = await db
        .select()
        .from(mhtcmEncounters)
        .where(eq(mhtcmEncounters.servicePlanId, input.id))
        .orderBy(desc(mhtcmEncounters.encounterDate));

      // Get function completion status
      const functionsCompleted = [
        plan.function1IntakeCompleted,
        plan.function2EligibilityCompleted,
        plan.function3CoordinationCompleted,
        plan.function4ReferralCompleted,
        plan.function5MonitoringCompleted,
        plan.function6TransitionCompleted,
      ].filter(Boolean).length;

      return { ...plan, encounters, functionsCompleted, functionsTotal: 6 };
    }),

  createServicePlan: adminQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        caseManagerId: z.string(),
        caseManagerName: z.string(),
        intakeDate: z.string(),
        cansScoreAtIntake: z.number().optional(),
        cansRiskLevel: z
          .enum(["low", "moderate", "high", "very_high"])
          .optional(),
        locLevel: z
          .enum([
            "loc_1_high_acuity",
            "loc_2_moderate_acuity",
            "loc_3_low_acuity",
            "not_determined",
          ])
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      assertMhtcmServicePlanLegacyCansInputsAbsent(input);
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      // Plan due date = intake + 14 days
      const intake = new Date(input.intakeDate);
      const planDue = new Date(
        intake.getTime() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await db.insert(mhtcmServicePlans).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        caseManagerId: input.caseManagerId,
        caseManagerName: input.caseManagerName,
        planStatus: "draft",
        version: 1,
        intakeDate: input.intakeDate,
        planDueDate: planDue,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id, planDueDate: planDue };
    }),

  updateServicePlan: adminQuery
    .input(
      z.object({
        id: z.string(),
        planStatus: z
          .enum([
            "draft",
            "active",
            "under_review",
            "approved",
            "superseded",
            "closed",
          ])
          .optional(),
        // Function goals
        function1IntakeGoal: z.string().optional(),
        function1IntakeCompleted: z.boolean().optional(),
        function2EligibilityGoal: z.string().optional(),
        function2EligibilityCompleted: z.boolean().optional(),
        function3CoordinationGoal: z.string().optional(),
        function3CoordinationCompleted: z.boolean().optional(),
        function4ReferralGoal: z.string().optional(),
        function4ReferralCompleted: z.boolean().optional(),
        function5MonitoringGoal: z.string().optional(),
        function5MonitoringCompleted: z.boolean().optional(),
        function6TransitionGoal: z.string().optional(),
        function6TransitionCompleted: z.boolean().optional(),
        // Approval
        preparedBy: z.string().optional(),
        reviewedBy: z.string().optional(),
        approvedBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };

      if (fields.planStatus !== undefined) {
        updateData.planStatus = fields.planStatus;
        if (fields.planStatus === "approved") {
          updateData.approvedAt = now;
          // Next review = approval + 90 days
          updateData.nextReviewDue = new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000,
          ).toISOString();
        }
      }
      if (fields.function1IntakeGoal !== undefined)
        updateData.function1IntakeGoal = fields.function1IntakeGoal;
      if (fields.function1IntakeCompleted !== undefined)
        updateData.function1IntakeCompleted = fields.function1IntakeCompleted;
      if (fields.function2EligibilityGoal !== undefined)
        updateData.function2EligibilityGoal = fields.function2EligibilityGoal;
      if (fields.function2EligibilityCompleted !== undefined)
        updateData.function2EligibilityCompleted =
          fields.function2EligibilityCompleted;
      if (fields.function3CoordinationGoal !== undefined)
        updateData.function3CoordinationGoal = fields.function3CoordinationGoal;
      if (fields.function3CoordinationCompleted !== undefined)
        updateData.function3CoordinationCompleted =
          fields.function3CoordinationCompleted;
      if (fields.function4ReferralGoal !== undefined)
        updateData.function4ReferralGoal = fields.function4ReferralGoal;
      if (fields.function4ReferralCompleted !== undefined)
        updateData.function4ReferralCompleted =
          fields.function4ReferralCompleted;
      if (fields.function5MonitoringGoal !== undefined)
        updateData.function5MonitoringGoal = fields.function5MonitoringGoal;
      if (fields.function5MonitoringCompleted !== undefined)
        updateData.function5MonitoringCompleted =
          fields.function5MonitoringCompleted;
      if (fields.function6TransitionGoal !== undefined)
        updateData.function6TransitionGoal = fields.function6TransitionGoal;
      if (fields.function6TransitionCompleted !== undefined)
        updateData.function6TransitionCompleted =
          fields.function6TransitionCompleted;
      if (fields.preparedBy !== undefined) {
        updateData.preparedBy = fields.preparedBy;
        updateData.preparedAt = now;
      }
      if (fields.reviewedBy !== undefined) {
        updateData.reviewedBy = fields.reviewedBy;
        updateData.reviewedAt = now;
      }
      if (fields.approvedBy !== undefined) {
        updateData.approvedBy = fields.approvedBy;
        updateData.approvedAt = now;
      }

      await db
        .update(mhtcmServicePlans)
        .set(updateData)
        .where(eq(mhtcmServicePlans.id, id));
      return { success: true };
    }),

  completePlanDueCheck: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const allPlans = await db.select().from(mhtcmServicePlans);

    const overduePlans = allPlans.filter(
      (p) => p.planStatus === "draft" && p.planDueDate && p.planDueDate < now,
    );

    const upcomingReviews = allPlans.filter(
      (p) =>
        p.planStatus === "active" && p.nextReviewDue && p.nextReviewDue < now,
    );

    return {
      overduePlanCount: overduePlans.length,
      overduePlans: overduePlans.map((p) => ({
        id: p.id,
        youthName: p.youthName,
        planDueDate: p.planDueDate,
        daysOverdue: Math.floor(
          (Date.now() - new Date(p.planDueDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      })),
      upcomingReviewCount: upcomingReviews.length,
      upcomingReviews: upcomingReviews.map((p) => ({
        id: p.id,
        youthName: p.youthName,
        nextReviewDue: p.nextReviewDue,
      })),
    };
  }),

  // ════════════════════════════════════════════════════════════
  // ENCOUNTERS (T1017 Billing)
  // ════════════════════════════════════════════════════════════

  listEncounters: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          servicePlanId: z.string().optional(),
          caseManagerId: z.string().optional(),
          encounterType: z
            .enum([
              "intake_assessment",
              "care_coordination",
              "collateral_contact",
              "referral_linkage",
              "monitoring_visit",
              "crisis_response",
              "discharge_planning",
              "telehealth",
            ])
            .optional(),
          mhtcmFunction: z
            .enum([
              "intake",
              "eligibility",
              "coordination",
              "referral",
              "monitoring",
              "transition",
            ])
            .optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId)
        conditions.push(eq(mhtcmEncounters.youthId, input.youthId));
      if (input?.servicePlanId)
        conditions.push(eq(mhtcmEncounters.servicePlanId, input.servicePlanId));
      if (input?.caseManagerId)
        conditions.push(eq(mhtcmEncounters.caseManagerId, input.caseManagerId));
      if (input?.encounterType)
        conditions.push(eq(mhtcmEncounters.encounterType, input.encounterType));
      if (input?.mhtcmFunction)
        conditions.push(eq(mhtcmEncounters.mhtcmFunction, input.mhtcmFunction));
      if (input?.dateFrom)
        conditions.push(gte(mhtcmEncounters.encounterDate, input.dateFrom));
      if (input?.dateTo)
        conditions.push(lte(mhtcmEncounters.encounterDate, input.dateTo));

      const results =
        conditions.length > 0
          ? await db
              .select()
              .from(mhtcmEncounters)
              .where(and(...conditions))
              .orderBy(desc(mhtcmEncounters.encounterDate))
          : await db
              .select()
              .from(mhtcmEncounters)
              .orderBy(desc(mhtcmEncounters.encounterDate));
      return results;
    }),

  getEncounter: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const row = await db
        .select()
        .from(mhtcmEncounters)
        .where(eq(mhtcmEncounters.id, input.id))
        .get();
      return row ?? null;
    }),

  createEncounter: adminQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        servicePlanId: z.string(),
        caseManagerId: z.string(),
        caseManagerName: z.string(),
        encounterDate: z.string(),
        encounterType: z.enum([
          "intake_assessment",
          "care_coordination",
          "collateral_contact",
          "referral_linkage",
          "monitoring_visit",
          "crisis_response",
          "discharge_planning",
          "telehealth",
        ]),
        mhtcmFunction: z.enum([
          "intake",
          "eligibility",
          "coordination",
          "referral",
          "monitoring",
          "transition",
        ]),
        unitsBilled: z.number().default(1),
        minutesDelivered: z.number().default(15),
        serviceDescription: z.string(),
        barriersIdentified: z.string().optional(),
        interventionsProvided: z.string().optional(),
        youthResponse: z.string().optional(),
        planModifications: z.string().optional(),
        nextSteps: z.string().optional(),
        collateralContactsJson: z.string().optional(),
        goalProgress: z
          .enum([
            "no_change",
            "minimal_progress",
            "moderate_progress",
            "significant_progress",
            "goal_achieved",
          ])
          .optional(),
        followUpRequired: z.boolean().optional(),
        followUpDate: z.string().optional(),
        followUpActions: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(mhtcmEncounters).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        servicePlanId: input.servicePlanId,
        caseManagerId: input.caseManagerId,
        caseManagerName: input.caseManagerName,
        encounterDate: input.encounterDate,
        encounterType: input.encounterType,
        billingCode: "T1017",
        unitsBilled: input.unitsBilled,
        minutesDelivered: input.minutesDelivered,
        mhtcmFunction: input.mhtcmFunction,
        serviceDescription: input.serviceDescription,
        barriersIdentified: input.barriersIdentified ?? null,
        interventionsProvided: input.interventionsProvided ?? null,
        youthResponse: input.youthResponse ?? null,
        planModifications: input.planModifications ?? null,
        nextSteps: input.nextSteps ?? null,
        collateralContactsJson: input.collateralContactsJson ?? null,
        goalProgress: input.goalProgress ?? "no_change",
        followUpRequired: input.followUpRequired ?? false,
        followUpDate: input.followUpDate ?? null,
        followUpActions: input.followUpActions ?? null,
        documentationStatus: "draft",
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        id,
        billingCode: "T1017",
        unitsBilled: input.unitsBilled,
      };
    }),

  signEncounter: adminQuery
    .input(
      z.object({
        id: z.string(),
        signedBy: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db
        .update(mhtcmEncounters)
        .set({
          documentationStatus: "signed",
          signedBy: input.signedBy,
          signedAt: now,
          updatedAt: now,
        })
        .where(eq(mhtcmEncounters.id, input.id));
      return { success: true };
    }),

  submitEncounter: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(mhtcmEncounters)
        .set({
          documentationStatus: "submitted",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(mhtcmEncounters.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // ELIGIBILITY
  // ════════════════════════════════════════════════════════════

  listEligibility: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          status: z
            .enum([
              "pending",
              "eligible",
              "ineligible",
              "under_review",
              "expired",
            ])
            .optional(),
          overdueReauth: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId)
        conditions.push(eq(mhtcmEligibility.youthId, input.youthId));
      if (input?.status)
        conditions.push(eq(mhtcmEligibility.eligibilityStatus, input.status));

      const results =
        conditions.length > 0
          ? await db
              .select()
              .from(mhtcmEligibility)
              .where(and(...conditions))
              .orderBy(desc(mhtcmEligibility.createdAt))
          : await db
              .select()
              .from(mhtcmEligibility)
              .orderBy(desc(mhtcmEligibility.createdAt));

      if (input?.overdueReauth) {
        const now = new Date().toISOString();
        return results.filter(
          (r) => r.reauthorizationDue && r.reauthorizationDue < now,
        );
      }
      return results;
    }),

  getEligibility: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const row = await db
        .select()
        .from(mhtcmEligibility)
        .where(eq(mhtcmEligibility.id, input.id))
        .get();
      return row ?? null;
    }),

  createEligibility: adminQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        ageQualified: z.boolean().optional(),
        diagnosisQualified: z.boolean().optional(),
        functionalImpairment: z.boolean().optional(),
        medicaidEligible: z.boolean().optional(),
        primaryDiagnosis: z.string().optional(),
        primaryDiagnosisCode: z.string().optional(),
        secondaryDiagnosis: z.string().optional(),
        secondaryDiagnosisCode: z.string().optional(),
        cansAssessmentId: z.string().optional(),
        cansTotalScore: z.number().optional(),
        determinedBy: z.string().optional(),
        determinationRationale: z.string().optional(),
        effectiveDate: z.string().optional(),
        expirationDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      assertMhtcmEligibilityLegacyCansInputsAbsent(input);
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      const status = mhtcmEligibilityReviewStatus(input);

      await db.insert(mhtcmEligibility).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        ageQualified: input.ageQualified ?? false,
        diagnosisQualified: input.diagnosisQualified ?? false,
        functionalImpairment: input.functionalImpairment ?? false,
        medicaidEligible: input.medicaidEligible ?? false,
        primaryDiagnosis: input.primaryDiagnosis ?? null,
        primaryDiagnosisCode: input.primaryDiagnosisCode ?? null,
        secondaryDiagnosis: input.secondaryDiagnosis ?? null,
        secondaryDiagnosisCode: input.secondaryDiagnosisCode ?? null,
        eligibilityStatus: status,
        determinedBy: null,
        determinedAt: null,
        determinationRationale: input.determinationRationale ?? null,
        effectiveDate: null,
        expirationDate: null,
        reauthorizationDue: null,
        reauthorizationStatus: null,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id, eligibilityStatus: status };
    }),

  updateEligibility: adminQuery
    .input(
      z.object({
        id: z.string(),
        ageQualified: z.boolean().optional(),
        diagnosisQualified: z.boolean().optional(),
        functionalImpairment: z.boolean().optional(),
        medicaidEligible: z.boolean().optional(),
        eligibilityStatus: z
          .enum([
            "pending",
            "eligible",
            "ineligible",
            "under_review",
            "expired",
          ])
          .optional(),
        reauthorizationStatus: z
          .enum(["not_due", "upcoming", "overdue", "submitted", "approved"])
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      assertMhtcmEligibilityDecisionNotActivated(input);
      const db = getDb();
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (fields.ageQualified !== undefined)
        updateData.ageQualified = fields.ageQualified;
      if (fields.diagnosisQualified !== undefined)
        updateData.diagnosisQualified = fields.diagnosisQualified;
      if (fields.functionalImpairment !== undefined)
        updateData.functionalImpairment = fields.functionalImpairment;
      if (fields.medicaidEligible !== undefined)
        updateData.medicaidEligible = fields.medicaidEligible;
      if (fields.eligibilityStatus !== undefined)
        updateData.eligibilityStatus = fields.eligibilityStatus;
      if (fields.reauthorizationStatus !== undefined)
        updateData.reauthorizationStatus = fields.reauthorizationStatus;

      await db
        .update(mhtcmEligibility)
        .set(updateData)
        .where(eq(mhtcmEligibility.id, id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // DASHBOARD / REPORTING
  // ════════════════════════════════════════════════════════════

  mhtcmDashboard: authedQuery.query(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Active service plans
    const allPlans = await db.select().from(mhtcmServicePlans);
    const activePlans = allPlans.filter((p) => p.planStatus === "active");
    const draftPlans = allPlans.filter((p) => p.planStatus === "draft");
    const overduePlans = draftPlans.filter(
      (p) => p.planDueDate && p.planDueDate < now,
    );

    // Plans needing 90-day review
    const plansNeedingReview = activePlans.filter(
      (p) => p.nextReviewDue && p.nextReviewDue < now,
    );

    // Encounters
    const allEncounters = await db.select().from(mhtcmEncounters);
    const encountersThisMonth = allEncounters.filter(
      (e) => e.encounterDate >= thirtyDaysAgo,
    );

    // T1017 units billed this month
    const totalUnitsThisMonth = encountersThisMonth.reduce(
      (sum, e) => sum + (e.unitsBilled ?? 0),
      0,
    );

    // By function
    const byFunction: Record<string, number> = {};
    for (const e of encountersThisMonth) {
      byFunction[e.mhtcmFunction] =
        (byFunction[e.mhtcmFunction] ?? 0) + (e.unitsBilled ?? 0);
    }

    // Eligibility
    const allEligibility = await db.select().from(mhtcmEligibility);
    const eligibleCount = allEligibility.filter(
      (e) => e.eligibilityStatus === "eligible",
    ).length;
    const pendingEligibility = allEligibility.filter(
      (e) => e.eligibilityStatus === "pending",
    ).length;
    const expiredEligibility = allEligibility.filter(
      (e) => e.eligibilityStatus === "expired",
    ).length;
    const overdueReauth = allEligibility.filter(
      (e) =>
        e.reauthorizationDue &&
        e.reauthorizationDue < now &&
        e.eligibilityStatus === "eligible",
    ).length;

    // Documentation status
    const draftEncounters = allEncounters.filter(
      (e) => e.documentationStatus === "draft",
    ).length;
    const signedEncounters = allEncounters.filter(
      (e) => e.documentationStatus === "signed",
    ).length;
    const submittedEncounters = allEncounters.filter(
      (e) => e.documentationStatus === "submitted",
    ).length;

    return {
      // Plans
      totalPlans: allPlans.length,
      activePlans: activePlans.length,
      draftPlans: draftPlans.length,
      overduePlans: overduePlans.length,
      plansNeedingReview: plansNeedingReview.length,
      // Encounters
      totalEncounters: allEncounters.length,
      encountersThisMonth: encountersThisMonth.length,
      totalUnitsThisMonth,
      unitsByFunction: byFunction,
      // Eligibility
      totalEligibilityRecords: allEligibility.length,
      eligibleYouth: eligibleCount,
      pendingEligibility,
      expiredEligibility,
      overdueReauthorizations: overdueReauth,
      // Documentation
      documentationStatus: {
        draft: draftEncounters,
        signed: signedEncounters,
        submitted: submittedEncounters,
      },
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedMhtcmData: adminQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    const db = getDb();
    const now = new Date().toISOString();

    // Seed service plans
    await db
      .insert(mhtcmServicePlans)
      .values([
        {
          id: "sp-001",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          planStatus: "active",
          version: 1,
          intakeDate: "2026-06-15",
          planDueDate: "2026-06-29",
          planCompletedDate: "2026-06-28",
          nextReviewDue: "2026-09-28",
          lastReviewDate: null,
          function1IntakeGoal:
            "Complete comprehensive intake assessment within 14 days",
          function1IntakeCompleted: true,
          function2EligibilityGoal:
            "Confirm Medicaid eligibility and functional impairment criteria",
          function2EligibilityCompleted: true,
          function3CoordinationGoal:
            "Coordinate with school, guardian, and prescribing provider for integrated care",
          function3CoordinationCompleted: true,
          function4ReferralGoal:
            "Link to outpatient therapy and family support services",
          function4ReferralCompleted: true,
          function5MonitoringGoal:
            "Weekly monitoring of behavioral goals and medication compliance",
          function5MonitoringCompleted: false,
          function6TransitionGoal:
            "Develop discharge plan with aftercare appointments scheduled",
          function6TransitionCompleted: false,
          preparedBy: "Demo Case Manager",
          preparedAt: "2026-06-28",
          reviewedBy: "Demo Clinical Lead",
          reviewedAt: "2026-06-29",
          approvedBy: "Demo Clinical Director",
          approvedAt: "2026-06-29",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "sp-002",
          youthId: "youth-002",
          youthName: "Synthetic Youth 005",
          mrn: "SYNTH-REC-002",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          planStatus: "draft",
          version: 1,
          intakeDate: "2026-07-01",
          planDueDate: "2026-07-15",
          planCompletedDate: null,
          nextReviewDue: null,
          lastReviewDate: null,
          function1IntakeGoal: "Complete intake and functional assessment",
          function1IntakeCompleted: false,
          function2EligibilityGoal: "Verify Medicaid eligibility",
          function2EligibilityCompleted: false,
          function3CoordinationGoal:
            "Initial care coordination with guardian and school",
          function3CoordinationCompleted: false,
          function4ReferralGoal: "Pending assessment completion",
          function4ReferralCompleted: false,
          function5MonitoringGoal: "Establish baseline monitoring plan",
          function5MonitoringCompleted: false,
          function6TransitionGoal: "Not yet applicable",
          function6TransitionCompleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    // Seed encounters
    await db
      .insert(mhtcmEncounters)
      .values([
        {
          id: "enc-001",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          servicePlanId: "sp-001",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          encounterDate: "2026-06-15",
          encounterType: "intake_assessment",
          mhtcmFunction: "intake",
          billingCode: "T1017",
          unitsBilled: 4,
          minutesDelivered: 60,
          serviceDescription:
            "Initial comprehensive intake assessment. Youth presented with behavioral concerns. Guardian present.",
          barriersIdentified:
            "Guardian work schedule limits availability for family sessions",
          interventionsProvided:
            "Structured intake, safety screening, and safety planning discussion",
          youthResponse: "Cooperative, engaged in assessment process",
          goalProgress: "minimal_progress",
          followUpRequired: true,
          followUpDate: "2026-06-16",
          followUpActions:
            "Complete remaining intake documentation and schedule family session",
          documentationStatus: "submitted",
          signedBy: "Demo Case Manager",
          signedAt: "2026-06-15",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "enc-002",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          servicePlanId: "sp-001",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          encounterDate: "2026-06-20",
          encounterType: "care_coordination",
          mhtcmFunction: "coordination",
          billingCode: "T1017",
          unitsBilled: 2,
          minutesDelivered: 30,
          serviceDescription:
            "Care coordination with prescribing provider (Demo Clinical Lead) regarding medication regimen. Guardian conference call.",
          interventionsProvided:
            "Medication reconciliation, guardian education on side effects",
          collateralContactsJson: JSON.stringify([
            {
              name: "Demo Clinical Lead",
              role: "PMHNP",
              contactType: "phone",
              notes: "Medication stable, no changes needed",
            },
          ]),
          goalProgress: "moderate_progress",
          followUpRequired: true,
          followUpDate: "2026-06-27",
          followUpActions: "Schedule 2-week medication check",
          documentationStatus: "submitted",
          signedBy: "Demo Case Manager",
          signedAt: "2026-06-20",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "enc-003",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          servicePlanId: "sp-001",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          encounterDate: "2026-06-27",
          encounterType: "referral_linkage",
          mhtcmFunction: "referral",
          billingCode: "T1017",
          unitsBilled: 2,
          minutesDelivered: 30,
          serviceDescription:
            "Linked youth to outpatient CBT program and family support group. Appointment confirmations obtained.",
          interventionsProvided:
            "Referral processing, appointment scheduling, transportation coordination",
          collateralContactsJson: JSON.stringify([
            {
              name: "Cypress Behavioral Health",
              role: "Outpatient Provider",
              contactType: "phone",
              notes: "CBT intake scheduled for 7/5/2026",
            },
            {
              name: "Family Support Center",
              role: "Support Group",
              contactType: "email",
              notes: "Orientation scheduled for 7/8/2026",
            },
          ]),
          goalProgress: "significant_progress",
          followUpRequired: true,
          followUpDate: "2026-07-05",
          followUpActions: "Confirm youth attended CBT intake",
          documentationStatus: "signed",
          signedBy: "Demo Case Manager",
          signedAt: "2026-06-27",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "enc-004",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          servicePlanId: "sp-001",
          caseManagerId: "user-cm-001",
          caseManagerName: "Demo Case Manager",
          encounterDate: "2026-07-03",
          encounterType: "monitoring_visit",
          mhtcmFunction: "monitoring",
          billingCode: "T1017",
          unitsBilled: 1,
          minutesDelivered: 15,
          serviceDescription:
            "Weekly check-in. Youth reports attending CBT session. Guardian reports improved behavior at home.",
          goalProgress: "moderate_progress",
          followUpRequired: true,
          followUpDate: "2026-07-10",
          followUpActions: "Continue weekly monitoring",
          documentationStatus: "draft",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    // Seed eligibility
    await db
      .insert(mhtcmEligibility)
      .values([
        {
          id: "elig-001",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          ageQualified: true,
          diagnosisQualified: true,
          functionalImpairment: true,
          medicaidEligible: true,
          primaryDiagnosis: "Disruptive Mood Dysregulation Disorder",
          primaryDiagnosisCode: "F34.8",
          secondaryDiagnosis: "ADHD, Combined Type",
          secondaryDiagnosisCode: "F90.2",
          eligibilityStatus: "under_review",
          determinedBy: null,
          determinedAt: null,
          determinationRationale:
            "Synthetic criteria documentation is complete and awaits a governed human eligibility decision.",
          effectiveDate: null,
          expirationDate: null,
          reauthorizationDue: null,
          reauthorizationStatus: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "elig-002",
          youthId: "youth-002",
          youthName: "Synthetic Youth 005",
          mrn: "SYNTH-REC-002",
          ageQualified: true,
          diagnosisQualified: false,
          functionalImpairment: false,
          medicaidEligible: true,
          primaryDiagnosis: null,
          primaryDiagnosisCode: null,
          eligibilityStatus: "pending",
          determinationRationale:
            "Awaiting comprehensive assessment and eligibility review",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    return {
      success: true,
      message:
        "MHTCM seed data: 2 service plans, 4 encounters, 2 eligibility records",
    };
  }),
});
