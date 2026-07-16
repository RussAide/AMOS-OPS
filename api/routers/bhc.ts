import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  patients,
  treatmentPlans,
  clinicalSessions,
  outcomeMeasures,
  insurancePlans,
  hrPeople,
  assessments,
  ccmgReferrals,
  ccmgCareCoordination,
  mhtcmEncounters,
  mhrsEncounters,
} from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Helpers ─────────────────────────────────────────────────

function generateMRN() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 99999).toString().padStart(5, "0");
  return `MRN-${year}-${seq}`;
}

function generatePlanNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `TP-${year}-${seq}`;
}

export function quarantineLegacyCansLogic(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED: Legacy CANS entry, scoring, risk-band, and level-of-care logic is unavailable. Use the governed M4.1C program-specific profile workflow.",
  });
}

export const M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED =
  "M41C_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED" as const;

export function quarantineBhcUngovernedOutcomeInstrument(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      `${M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED}: ` +
      "Legacy outcome-instrument entry, numeric interpretation, and longitudinal output are unavailable. Use the governed M4.1C instrument-profile workflow.",
  });
}

export function buildBhcGovernedOutcomeMeasureReference(subjectId: string) {
  return Object.freeze({
    milestone: "M4.1C" as const,
    subjectId,
    disposition: "legacy_numeric_rows_quarantined" as const,
    mode: "metadata_only_evaluation" as const,
    sourceOfTruth:
      "M4.1C Clinical Intelligence Fabric governed instrument-profile workflow",
    humanReviewRequired: true as const,
    liveWrites: 0 as const,
  });
}

export function buildBhcGovernedAssessmentReference(subjectId: string) {
  return Object.freeze({
    milestone: "M4.1C" as const,
    subjectId,
    disposition: "legacy_assessment_rows_quarantined" as const,
    rawLegacyRowsReturned: false as const,
    governedProfileIds: Object.freeze([
      "M41C-INSTRUMENT-TRR-CANS",
      "M41C-INSTRUMENT-DFPS-CANS-3",
    ]),
    sourceOfTruth:
      "M4.1C Clinical Knowledge Registry and governed program-specific pathway workflow",
    humanReviewRequired: true as const,
    productionRows: 0 as const,
    liveWrites: 0 as const,
    evidenceClass: "synthetic_clinical_demo" as const,
  });
}

// ─── Patient Router ──────────────────────────────────────────

export const bhcRouter = createRouter({
  // ════════════════════════════════════════════════════════════
  // 1. INSURANCE PLANS — Full CRUD
  // ════════════════════════════════════════════════════════════

  listInsurancePlans: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(insurancePlans).orderBy(desc(insurancePlans.createdAt)).all();
  }),

  getInsurancePlan: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plan = await db.select().from(insurancePlans).where(eq(insurancePlans.id, input.id)).get();
      if (!plan) throw new Error("Insurance plan not found");
      return plan;
    }),

  createInsurancePlan: adminQuery
    .input(z.object({
      payerName: z.string().min(1),
      planName: z.string().min(1),
      policyNumberPattern: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(insurancePlans).values({
        id, payerName: input.payerName, planName: input.planName,
        policyNumberPattern: input.policyNumberPattern ?? null,
        isActive: true, createdAt: now,
      });
      return db.select().from(insurancePlans).where(eq(insurancePlans.id, id)).get();
    }),

  updateInsurancePlan: adminQuery
    .input(z.object({
      id: z.string(),
      payerName: z.string().optional(),
      planName: z.string().optional(),
      policyNumberPattern: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      await db.update(insurancePlans).set(setValues).where(eq(insurancePlans.id, id));
      return db.select().from(insurancePlans).where(eq(insurancePlans.id, id)).get();
    }),

  deleteInsurancePlan: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(insurancePlans).where(eq(insurancePlans.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 2. PATIENTS CRUD
  // ════════════════════════════════════════════════════════════

  listPatients: authedQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["intake", "active", "hold", "discharged", "transferred"]).optional(),
        clinicianId: z.string().optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().default(25),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const params: {
        search?: string;
        status?: "intake" | "active" | "hold" | "discharged" | "transferred";
        clinicianId?: string;
        page?: number;
        pageSize?: number;
      } = input ?? {};

      const query = db.select().from(patients);
      const conditions = [];

      if (params.status) conditions.push(eq(patients.status, params.status));
      if (params.clinicianId) conditions.push(eq(patients.assignedClinicianId, params.clinicianId));

      let results;
      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        results = await query.where(condition).orderBy(desc(patients.createdAt)).all();
      } else {
        results = await query.orderBy(desc(patients.createdAt)).all();
      }

      if (params.search) {
        const s = params.search.toLowerCase();
        results = results.filter(
          (p) =>
            p.firstName.toLowerCase().includes(s) ||
            p.lastName.toLowerCase().includes(s) ||
            p.mrn.toLowerCase().includes(s) ||
            (p.email && p.email.toLowerCase().includes(s))
        );
      }

      const total = results.length;
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 25;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      return { patients: paginated, total, page, pageSize };
    }),

  getPatient: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const patient = await db.select().from(patients).where(eq(patients.id, input.id)).get();
      if (!patient) throw new Error("Patient not found");

      const plans = await db
        .select().from(treatmentPlans)
        .where(eq(treatmentPlans.patientId, input.id))
        .orderBy(desc(treatmentPlans.createdAt)).all();

      const sessions = await db
        .select().from(clinicalSessions)
        .where(eq(clinicalSessions.patientId, input.id))
        .orderBy(desc(clinicalSessions.sessionDate)).limit(10).all();

      // Get care coordination
      const careCoordination = await db
        .select().from(ccmgCareCoordination)
        .where(eq(ccmgCareCoordination.youthId, input.id))
        .orderBy(desc(ccmgCareCoordination.createdAt)).all();

      return {
        patient,
        treatmentPlans: plans,
        recentSessions: sessions,
        outcomeMeasures: [] as Array<typeof outcomeMeasures.$inferSelect>,
        governedOutcomeMeasureReference:
          buildBhcGovernedOutcomeMeasureReference(input.id),
        governedAssessmentReference: buildBhcGovernedAssessmentReference(
          input.id,
        ),
        careCoordination,
      };
    }),

  createPatient: authedQuery
    .input(
      z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        dateOfBirth: z.string(),
        gender: z.enum(["male", "female", "non_binary", "prefer_not_say"]).optional(),
        phone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        insuranceId: z.string().optional(),
        emergencyName: z.string().optional(),
        emergencyPhone: z.string().optional(),
        referralSource: z.string().optional(),
        assignedClinicianId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const mrn = generateMRN();

      await db.insert(patients).values({
        id, mrn,
        firstName: input.firstName, lastName: input.lastName,
        dateOfBirth: input.dateOfBirth, gender: input.gender ?? null,
        phone: input.phone ?? null, email: input.email ?? null,
        address: input.address ?? null, insuranceId: input.insuranceId ?? null,
        emergencyName: input.emergencyName ?? null, emergencyPhone: input.emergencyPhone ?? null,
        referralSource: input.referralSource ?? null,
        assignedClinicianId: input.assignedClinicianId,
      });

      return db.select().from(patients).where(eq(patients.id, id)).get();
    }),

  updatePatient: authedQuery
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        dateOfBirth: z.string().optional(),
        gender: z.enum(["male", "female", "non_binary", "prefer_not_say"]).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        insuranceId: z.string().optional(),
        emergencyName: z.string().optional(),
        emergencyPhone: z.string().optional(),
        referralSource: z.string().optional(),
        assignedClinicianId: z.string().optional(),
        status: z.enum(["intake", "active", "hold", "discharged", "transferred"]).optional(),
        dischargeDate: z.string().optional(),
        dischargeReason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();

      await db.update(patients).set(setValues).where(eq(patients.id, id));
      return db.select().from(patients).where(eq(patients.id, id)).get();
    }),

  dischargePatient: authedQuery
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1),
        dischargeDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(patients)
        .set({
          status: "discharged",
          dischargeDate: input.dischargeDate ?? new Date().toISOString(),
          dischargeReason: input.reason,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(patients.id, input.id));

      return db.select().from(patients).where(eq(patients.id, input.id)).get();
    }),

  // ════════════════════════════════════════════════════════════
  // 3. TREATMENT PLANS — Full CRUD
  // ════════════════════════════════════════════════════════════

  listTreatmentPlans: authedQuery
    .input(z.object({
      patientId: z.string().optional(),
      clinicianId: z.string().optional(),
      status: z.enum(["draft", "active", "under_review", "completed", "discontinued"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      const query = db.select().from(treatmentPlans);

      const conditions = [];
      if (params.patientId) conditions.push(eq(treatmentPlans.patientId, params.patientId));
      if (params.clinicianId) conditions.push(eq(treatmentPlans.assignedClinicianId, params.clinicianId));
      if (params.status) conditions.push(eq(treatmentPlans.status, params.status));

      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(treatmentPlans.createdAt)).all();
      }
      return query.orderBy(desc(treatmentPlans.createdAt)).all();
    }),

  getTreatmentPlan: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plan = await db.select().from(treatmentPlans).where(eq(treatmentPlans.id, input.id)).get();
      if (!plan) throw new Error("Treatment plan not found");

      const sessions = await db
        .select().from(clinicalSessions)
        .where(eq(clinicalSessions.treatmentPlanId, input.id))
        .orderBy(desc(clinicalSessions.sessionDate)).all();

      return { ...plan, sessions };
    }),

  createTreatmentPlan: authedQuery
    .input(
      z.object({
        patientId: z.string(),
        primaryDiagnosis: z.string().min(1),
        secondaryDiagnosis: z.string().optional(),
        presentingProblem: z.string().min(1),
        goals: z.array(z.object({ description: z.string(), targetDate: z.string().optional() })).min(1),
        interventions: z.array(z.object({ type: z.string(), description: z.string(), frequency: z.string() })).min(1),
        estimatedDurationWeeks: z.number().int().positive().optional(),
        startDate: z.string(),
        reviewDate: z.string(),
        assignedClinicianId: z.string(),
        supervisorId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(treatmentPlans).values({
        id,
        patientId: input.patientId,
        planNumber: generatePlanNumber(),
        primaryDiagnosis: input.primaryDiagnosis,
        secondaryDiagnosis: input.secondaryDiagnosis ?? null,
        presentingProblem: input.presentingProblem,
        goalsJson: JSON.stringify(input.goals),
        interventionsJson: JSON.stringify(input.interventions),
        estimatedDurationWeeks: input.estimatedDurationWeeks ?? null,
        startDate: input.startDate,
        reviewDate: input.reviewDate,
        assignedClinicianId: input.assignedClinicianId,
        supervisorId: input.supervisorId ?? null,
      });

      return db.select().from(treatmentPlans).where(eq(treatmentPlans.id, id)).get();
    }),

  updateTreatmentPlan: authedQuery
    .input(
      z.object({
        id: z.string(),
        primaryDiagnosis: z.string().optional(),
        secondaryDiagnosis: z.string().optional(),
        presentingProblem: z.string().optional(),
        goalsJson: z.string().optional(),
        interventionsJson: z.string().optional(),
        estimatedDurationWeeks: z.number().int().positive().optional(),
        startDate: z.string().optional(),
        reviewDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(["draft", "active", "under_review", "completed", "discontinued"]).optional(),
        assignedClinicianId: z.string().optional(),
        supervisorId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();

      await db.update(treatmentPlans).set(setValues).where(eq(treatmentPlans.id, id));
      return db.select().from(treatmentPlans).where(eq(treatmentPlans.id, id)).get();
    }),

  approveTreatmentPlan: adminQuery
    .input(z.object({ id: z.string(), approvedBy: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(treatmentPlans)
        .set({ status: "active", approvedBy: input.approvedBy, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(treatmentPlans.id, input.id));
      return db.select().from(treatmentPlans).where(eq(treatmentPlans.id, input.id)).get();
    }),

  // ════════════════════════════════════════════════════════════
  // 4. CLINICAL SESSIONS — Full CRUD
  // ════════════════════════════════════════════════════════════

  listSessions: authedQuery
    .input(
      z.object({
        patientId: z.string().optional(),
        clinicianId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      const query = db.select().from(clinicalSessions);

      const conditions = [];
      if (params.patientId) conditions.push(eq(clinicalSessions.patientId, params.patientId));
      if (params.clinicianId) conditions.push(eq(clinicalSessions.clinicianId, params.clinicianId));
      if (params.status) conditions.push(eq(clinicalSessions.status, params.status));

      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(clinicalSessions.sessionDate)).all();
      }
      return query.orderBy(desc(clinicalSessions.sessionDate)).all();
    }),

  getSession: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const session = await db.select().from(clinicalSessions).where(eq(clinicalSessions.id, input.id)).get();
      if (!session) throw new Error("Session not found");
      return session;
    }),

  createSession: authedQuery
    .input(
      z.object({
        patientId: z.string(),
        treatmentPlanId: z.string().optional(),
        clinicianId: z.string(),
        sessionDate: z.string(),
        sessionType: z.enum(["individual", "group", "family", "couples", "intake", "crisis", "telehealth"]).optional(),
        durationMinutes: z.number().int().positive().default(60),
        chiefComplaint: z.string().optional(),
        sessionNotes: z.string().optional(),
        interventionsUsed: z.array(z.string()).optional(),
        clientResponse: z.string().optional(),
        planModifications: z.string().optional(),
        riskAssessment: z.object({
          suicideRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
          homocideRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
          elopementRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
        }).optional(),
        nextSessionDate: z.string().optional(),
        nextSessionGoals: z.string().optional(),
        billingCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(clinicalSessions).values({
        id,
        patientId: input.patientId,
        treatmentPlanId: input.treatmentPlanId ?? null,
        clinicianId: input.clinicianId,
        sessionDate: input.sessionDate,
        sessionType: input.sessionType ?? null,
        durationMinutes: input.durationMinutes,
        chiefComplaint: input.chiefComplaint ?? null,
        sessionNotes: input.sessionNotes ?? null,
        interventionsUsedJson: input.interventionsUsed ? JSON.stringify(input.interventionsUsed) : "[]",
        clientResponse: input.clientResponse ?? null,
        planModifications: input.planModifications ?? null,
        riskAssessmentJson: input.riskAssessment ? JSON.stringify(input.riskAssessment) : null,
        nextSessionDate: input.nextSessionDate ?? null,
        nextSessionGoals: input.nextSessionGoals ?? null,
        billingCode: input.billingCode ?? null,
      });

      return db.select().from(clinicalSessions).where(eq(clinicalSessions.id, id)).get();
    }),

  updateSession: authedQuery
    .input(
      z.object({
        id: z.string(),
        sessionDate: z.string().optional(),
        sessionType: z.enum(["individual", "group", "family", "couples", "intake", "crisis", "telehealth"]).optional(),
        durationMinutes: z.number().int().positive().optional(),
        chiefComplaint: z.string().optional(),
        sessionNotes: z.string().optional(),
        interventionsUsedJson: z.string().optional(),
        clientResponse: z.string().optional(),
        planModifications: z.string().optional(),
        riskAssessmentJson: z.string().optional(),
        nextSessionDate: z.string().optional(),
        nextSessionGoals: z.string().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]).optional(),
        billingCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();

      await db.update(clinicalSessions).set(setValues).where(eq(clinicalSessions.id, id));
      return db.select().from(clinicalSessions).where(eq(clinicalSessions.id, id)).get();
    }),

  cancelSession: authedQuery
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(clinicalSessions)
        .set({ status: "cancelled", updatedAt: new Date().toISOString() })
        .where(eq(clinicalSessions.id, input.id));
      return db.select().from(clinicalSessions).where(eq(clinicalSessions.id, input.id)).get();
    }),

  // ════════════════════════════════════════════════════════════
  // 5. OUTCOME MEASURES — Quarantined legacy surface
  // ════════════════════════════════════════════════════════════

  listOutcomeMeasures: authedQuery
    .input(
      z.object({
        patientId: z.string().optional(),
        measureType: z.enum(["PHQ-9", "GAD-7", "PSS-10", "WHO-5", "DASS-21", "PCL-5", "CGI-S"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional()
    )
    .query(() => quarantineBhcUngovernedOutcomeInstrument()),

  getOutcomeMeasure: authedQuery
    .input(z.object({ id: z.string() }))
    .query(() => quarantineBhcUngovernedOutcomeInstrument()),

  createOutcomeMeasure: authedQuery
    .input(
      z.object({
        patientId: z.string(),
        sessionId: z.string().optional(),
        measureType: z.enum(["PHQ-9", "GAD-7", "PSS-10", "WHO-5", "DASS-21", "PCL-5", "CGI-S"]),
        score: z.number().int().nonnegative(),
        maxScore: z.number().int().positive(),
        severityLevel: z.enum(["none", "minimal", "mild", "moderate", "moderately_severe", "severe"]).optional(),
        administeredBy: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(() => quarantineBhcUngovernedOutcomeInstrument()),

  getOutcomeTrends: authedQuery
    .input(z.object({
      patientId: z.string(),
      measureType: z.enum(["PHQ-9", "GAD-7", "PSS-10", "WHO-5", "DASS-21", "PCL-5", "CGI-S"]).optional(),
    }))
    .query(() => quarantineBhcUngovernedOutcomeInstrument()),

  // ════════════════════════════════════════════════════════════
  // 6. CANS / TRR ASSESSMENT TOOLS
  // ════════════════════════════════════════════════════════════

  listCansAssessments: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      status: z.enum(["draft", "in_progress", "pending_review", "completed", "superseded"]).optional(),
    }).optional())
    .query(() => quarantineLegacyCansLogic()),

  getCansAssessment: authedQuery
    .input(z.object({ id: z.string() }))
    .query(() => quarantineLegacyCansLogic()),

  createCansAssessment: authedQuery
    .input(
      z.object({
        youthId: z.string(),
        mrn: z.string(),
        youthName: z.string(),
        assessmentType: z.enum(["intake", "quarterly", "annual", "discharge", "incident_driven"]).default("intake"),
        assessmentDate: z.string(),
        completedBy: z.string(),
        completedById: z.string().optional(),
        presentingProblems: z.string().optional(),
        psychiatricHistory: z.string().optional(),
        substanceUseHistory: z.string().optional(),
        traumaHistory: z.string().optional(),
        medicalHistory: z.string().optional(),
        familyHistory: z.string().optional(),
        educationalHistory: z.string().optional(),
        // Risk assessments
        riskSuicide: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskSelfHarm: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskAggression: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskElopement: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskSubstanceUse: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskVulnerability: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        safetyPlanRequired: z.boolean().optional(),
      })
    )
    .mutation(() => quarantineLegacyCansLogic()),

  updateCansAssessment: authedQuery
    .input(
      z.object({
        id: z.string(),
        presentingProblems: z.string().optional(),
        psychiatricHistory: z.string().optional(),
        substanceUseHistory: z.string().optional(),
        traumaHistory: z.string().optional(),
        medicalHistory: z.string().optional(),
        familyHistory: z.string().optional(),
        educationalHistory: z.string().optional(),
        cansCompleted: z.boolean().optional(),
        cansTotalScore: z.number().optional(),
        cansRiskLevel: z.enum(["low", "moderate", "high", "very_high"]).optional(),
        locDetermined: z.boolean().optional(),
        locLevel: z.enum(["loc_1_high_acuity", "loc_2_moderate_acuity", "loc_3_low_acuity", "not_determined"]).optional(),
        locClinicalRationale: z.string().optional(),
        riskSuicide: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskSelfHarm: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskAggression: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskElopement: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskSubstanceUse: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        riskVulnerability: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
        overallRiskLevel: z.enum(["low", "moderate", "high", "critical"]).optional(),
        safetyPlanRequired: z.boolean().optional(),
        safetyPlanCompleted: z.boolean().optional(),
        status: z.enum(["draft", "in_progress", "pending_review", "completed", "superseded"]).optional(),
      })
    )
    .mutation(() => quarantineLegacyCansLogic()),

  completeCansAssessment: adminQuery
    .input(z.object({ id: z.string(), reviewedBy: z.string().optional(), approvedBy: z.string().optional() }))
    .mutation(() => quarantineLegacyCansLogic()),

  // ─── CANS Domain Scoring ───────────────────────────────────

  listAssessmentDomains: authedQuery
    .input(z.object({ assessmentId: z.string() }))
    .query(() => quarantineLegacyCansLogic()),

  createAssessmentDomain: authedQuery
    .input(
      z.object({
        assessmentId: z.string(),
        domainNumber: z.number().int().positive(),
        domainName: z.string().min(1),
        score: z.number().int().optional(),
        scoreLabel: z.enum(["no_evidence", "mild", "moderate", "severe"]).optional(),
        strengths: z.string().optional(),
        needs: z.string().optional(),
        observations: z.string().optional(),
        clinicalNotes: z.string().optional(),
        interventionNeeded: z.boolean().optional(),
        interventionDescription: z.string().optional(),
      })
    )
    .mutation(() => quarantineLegacyCansLogic()),

  updateAssessmentDomain: authedQuery
    .input(
      z.object({
        id: z.string(),
        score: z.number().int().optional(),
        scoreLabel: z.enum(["no_evidence", "mild", "moderate", "severe"]).optional(),
        strengths: z.string().optional(),
        needs: z.string().optional(),
        observations: z.string().optional(),
        clinicalNotes: z.string().optional(),
        interventionNeeded: z.boolean().optional(),
        interventionDescription: z.string().optional(),
      })
    )
    .mutation(() => quarantineLegacyCansLogic()),

  // ════════════════════════════════════════════════════════════
  // 7. REFERRAL INTAKE WORKFLOW
  // ════════════════════════════════════════════════════════════

  listReferrals: authedQuery
    .input(
      z.object({
        youthId: z.string().optional(),
        status: z.enum(["pending", "accepted", "scheduled", "completed", "declined", "cancelled"]).optional(),
        fromDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]).optional(),
        toDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]).optional(),
        urgency: z.enum(["routine", "urgent", "emergency"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      const query = db.select().from(ccmgReferrals);

      const conditions = [];
      if (params.youthId) conditions.push(eq(ccmgReferrals.youthId, params.youthId));
      if (params.status) conditions.push(eq(ccmgReferrals.status, params.status));
      if (params.fromDepartment) conditions.push(eq(ccmgReferrals.fromDepartment, params.fromDepartment));
      if (params.toDepartment) conditions.push(eq(ccmgReferrals.toDepartment, params.toDepartment));
      if (params.urgency) conditions.push(eq(ccmgReferrals.urgency, params.urgency));

      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(ccmgReferrals.createdAt)).all();
      }
      return query.orderBy(desc(ccmgReferrals.createdAt)).all();
    }),

  getReferral: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const referral = await db.select().from(ccmgReferrals).where(eq(ccmgReferrals.id, input.id)).get();
      if (!referral) throw new Error("Referral not found");
      return referral;
    }),

  createReferral: authedQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        referralType: z.enum(["internal", "external", "gro_to_bhc", "bhc_to_gro", "inter_department"]),
        fromDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]),
        toDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]),
        requestedBy: z.string(),
        requestedById: z.string().optional(),
        reasonForReferral: z.string(),
        clinicalJustification: z.string().optional(),
        urgency: z.enum(["routine", "urgent", "emergency"]).default("routine"),
      })
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
    .input(z.object({ id: z.string(), acceptedBy: z.string(), scheduledDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(ccmgReferrals).set({
        status: "accepted",
        acceptedBy: input.acceptedBy,
        acceptedAt: now,
        scheduledDate: input.scheduledDate ?? null,
        updatedAt: now,
      }).where(eq(ccmgReferrals.id, input.id));
      return { success: true };
    }),

  completeReferral: adminQuery
    .input(z.object({
      id: z.string(),
      outcomeNotes: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString();
      await db.update(ccmgReferrals).set({
        status: "completed",
        completedDate: now,
        outcomeNotes: input.outcomeNotes ?? null,
        followUpRequired: input.followUpRequired ?? false,
        followUpDate: input.followUpDate ?? null,
        updatedAt: now,
      }).where(eq(ccmgReferrals.id, input.id));
      return { success: true };
    }),

  declineReferral: adminQuery
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(ccmgReferrals).set({
        status: "declined",
        outcomeNotes: input.reason,
        updatedAt: new Date().toISOString(),
      }).where(eq(ccmgReferrals.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 8. SERVICE DELIVERY DOCUMENTATION (Aggregated)
  // ════════════════════════════════════════════════════════════

  getServiceDeliverySummary: authedQuery
    .input(z.object({ youthId: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};

      // Get MHTCM encounters
      const mhtcmQuery = db.select().from(mhtcmEncounters);
      const mhtcmConditions = [];
      if (params.youthId) mhtcmConditions.push(eq(mhtcmEncounters.youthId, params.youthId));
      if (params.dateFrom) mhtcmConditions.push(sql`${mhtcmEncounters.encounterDate} >= ${params.dateFrom}`);
      if (params.dateTo) mhtcmConditions.push(sql`${mhtcmEncounters.encounterDate} <= ${params.dateTo}`);

      const mhtcmResults = mhtcmConditions.length > 0
        ? await mhtcmQuery.where(and(...mhtcmConditions)).orderBy(desc(mhtcmEncounters.encounterDate)).all()
        : await mhtcmQuery.orderBy(desc(mhtcmEncounters.encounterDate)).all();

      // Get MHRS encounters
      const mhrsQuery = db.select().from(mhrsEncounters);
      const mhrsConditions = [];
      if (params.youthId) mhrsConditions.push(eq(mhrsEncounters.youthId, params.youthId));
      if (params.dateFrom) mhrsConditions.push(sql`${mhrsEncounters.encounterDate} >= ${params.dateFrom}`);
      if (params.dateTo) mhrsConditions.push(sql`${mhrsEncounters.encounterDate} <= ${params.dateTo}`);

      const mhrsResults = mhrsConditions.length > 0
        ? await mhrsQuery.where(and(...mhrsConditions)).orderBy(desc(mhrsEncounters.encounterDate)).all()
        : await mhrsQuery.orderBy(desc(mhrsEncounters.encounterDate)).all();

      // Get clinical sessions
      const clinicalQuery = db.select().from(clinicalSessions);
      const clinicalConditions = [];
      if (params.youthId) clinicalConditions.push(eq(clinicalSessions.patientId, params.youthId));
      if (params.dateFrom) clinicalConditions.push(sql`${clinicalSessions.sessionDate} >= ${params.dateFrom}`);
      if (params.dateTo) clinicalConditions.push(sql`${clinicalSessions.sessionDate} <= ${params.dateTo}`);

      const clinicalResults = clinicalConditions.length > 0
        ? await clinicalQuery.where(and(...clinicalConditions)).orderBy(desc(clinicalSessions.sessionDate)).all()
        : await clinicalQuery.orderBy(desc(clinicalSessions.sessionDate)).all();

      // Summary stats
      const totalMhtcmUnits = mhtcmResults.reduce((sum, e) => sum + (e.unitsBilled ?? 0), 0);
      const totalMhrsUnits = mhrsResults.reduce((sum, e) => sum + (e.unitsBilled ?? 0), 0);
      const totalClinicalMinutes = clinicalResults.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

      // Documentation status breakdown
      const mhtcmByStatus = { draft: 0, signed: 0, submitted: 0 };
      for (const e of mhtcmResults) {
        if (e.documentationStatus === "draft") mhtcmByStatus.draft++;
        else if (e.documentationStatus === "signed") mhtcmByStatus.signed++;
        else if (e.documentationStatus === "submitted") mhtcmByStatus.submitted++;
      }

      const mhrsByStatus = { draft: 0, signed: 0, submitted: 0 };
      for (const e of mhrsResults) {
        if (e.documentationStatus === "draft") mhrsByStatus.draft++;
        else if (e.documentationStatus === "signed") mhrsByStatus.signed++;
        else if (e.documentationStatus === "submitted") mhrsByStatus.submitted++;
      }

      return {
        mhtcmEncounters: mhtcmResults,
        mhrsEncounters: mhrsResults,
        clinicalSessions: clinicalResults,
        summary: {
          mhtcmCount: mhtcmResults.length,
          mhrsCount: mhrsResults.length,
          clinicalCount: clinicalResults.length,
          totalMhtcmUnits,
          totalMhrsUnits,
          totalClinicalMinutes,
          mhtcmDocumentation: mhtcmByStatus,
          mhrsDocumentation: mhrsByStatus,
        },
      };
    }),

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════

  dashboardKPIs: authedQuery.query(async () => {
    const db = getDb();
    const allPatients = await db.select().from(patients).all();
    const activePatients = allPatients.filter((p) => p.status === "active").length;
    const intakePatients = allPatients.filter((p) => p.status === "intake").length;

    const today = new Date().toISOString().split("T")[0];
    const allSessions = await db.select().from(clinicalSessions).all();
    const sessionsToday = allSessions.filter((s) => s.sessionDate.startsWith(today) && s.status === "scheduled").length;

    const pendingApprovals = await db
      .select().from(treatmentPlans)
      .where(eq(treatmentPlans.status, "under_review")).all();

    // High risk count
    const highRiskSessions = allSessions.filter((s) => {
      if (!s.riskAssessmentJson) return false;
      try {
        const risk = JSON.parse(s.riskAssessmentJson);
        return risk.suicideRisk === "high" || risk.homocideRisk === "high" || risk.elopementRisk === "high";
      } catch {
        return false;
      }
    });

    // Sessions this week
    const now = new Date();
    const weekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString();
    const sessionsThisWeek = allSessions.filter((s) => s.sessionDate >= weekStart && (s.status === "completed" || s.status === "scheduled")).length;

    // Pending referrals
    const allReferrals = await db.select().from(ccmgReferrals).all();
    const pendingReferrals = allReferrals.filter((r) => r.status === "pending").length;

    // Assessment stats
    const allAssessments = await db.select().from(assessments).all();
    const pendingAssessments = allAssessments.filter((a) => a.status === "draft" || a.status === "in_progress").length;

    return {
      totalPatients: allPatients.length,
      activePatients,
      intakePatients,
      sessionsToday,
      sessionsThisWeek,
      pendingApprovals: pendingApprovals.length,
      highRiskCount: highRiskSessions.length,
      pendingReferrals,
      pendingAssessments,
    };
  }),

  clinicianWorkload: authedQuery.query(async () => {
    const db = getDb();
    const allSessions = await db.select().from(clinicalSessions).all();
    const allPeople = await db.select().from(hrPeople).all();

    const now = new Date();
    const weekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString();

    const workload: Record<string, { clinicianId: string; name: string; patientCount: number; sessionCountThisWeek: number }> = {};

    for (const s of allSessions) {
      if (!workload[s.clinicianId]) {
        const person = allPeople.find((p) => p.id === s.clinicianId);
        workload[s.clinicianId] = {
          clinicianId: s.clinicianId,
          name: person ? `${person.firstName} ${person.lastName}` : "Unknown",
          patientCount: 0,
          sessionCountThisWeek: 0,
        };
      }
      if (s.sessionDate >= weekStart) {
        workload[s.clinicianId].sessionCountThisWeek++;
      }
    }

    // Patient counts
    const allPatients = await db.select().from(patients).all();
    for (const p of allPatients) {
      if (p.assignedClinicianId && workload[p.assignedClinicianId]) {
        workload[p.assignedClinicianId].patientCount++;
      }
    }

    return Object.values(workload);
  }),
});
