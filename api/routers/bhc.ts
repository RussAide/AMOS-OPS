import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  patients,
  treatmentPlans,
  clinicalSessions,
  outcomeMeasures,
  insurancePlans,
  hrPeople,
} from "@db/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
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

// ─── Patient Router ──────────────────────────────────────────

export const bhcRouter = createRouter({
  // ─── Insurance Plans ───────────────────────────────────────

  listInsurancePlans: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(insurancePlans).where(eq(insurancePlans.isActive, true)).all();
  }),

  // ─── Patients CRUD ─────────────────────────────────────────

  listPatients: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        clinicianId: z.string().optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().default(25),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};

      let query = db.select().from(patients);
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

  getPatient: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const patient = await db.select().from(patients).where(eq(patients.id, input.id)).get();
      if (!patient) throw new Error("Patient not found");

      const plans = await db
        .select()
        .from(treatmentPlans)
        .where(eq(treatmentPlans.patientId, input.id))
        .orderBy(desc(treatmentPlans.createdAt))
        .all();

      const sessions = await db
        .select()
        .from(clinicalSessions)
        .where(eq(clinicalSessions.patientId, input.id))
        .orderBy(desc(clinicalSessions.sessionDate))
        .limit(10)
        .all();

      const outcomes = await db
        .select()
        .from(outcomeMeasures)
        .where(eq(outcomeMeasures.patientId, input.id))
        .orderBy(desc(outcomeMeasures.administeredAt))
        .all();

      return { patient, treatmentPlans: plans, recentSessions: sessions, outcomeMeasures: outcomes };
    }),

  createPatient: publicQuery
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
        id,
        mrn,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        insuranceId: input.insuranceId ?? null,
        emergencyName: input.emergencyName ?? null,
        emergencyPhone: input.emergencyPhone ?? null,
        referralSource: input.referralSource ?? null,
        assignedClinicianId: input.assignedClinicianId,
      });

      return db.select().from(patients).where(eq(patients.id, id)).get();
    }),

  updatePatient: publicQuery
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

  dischargePatient: publicQuery
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

  // ─── Treatment Plans ───────────────────────────────────────

  listTreatmentPlans: publicQuery
    .input(z.object({ patientId: z.string().optional(), clinicianId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      let query = db.select().from(treatmentPlans);

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

  getTreatmentPlan: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plan = await db.select().from(treatmentPlans).where(eq(treatmentPlans.id, input.id)).get();
      if (!plan) throw new Error("Treatment plan not found");

      const sessions = await db
        .select()
        .from(clinicalSessions)
        .where(eq(clinicalSessions.treatmentPlanId, input.id))
        .orderBy(desc(clinicalSessions.sessionDate))
        .all();

      return { ...plan, sessions };
    }),

  createTreatmentPlan: publicQuery
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

  updateTreatmentPlan: publicQuery
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

  approveTreatmentPlan: publicQuery
    .input(z.object({ id: z.string(), approvedBy: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(treatmentPlans)
        .set({ status: "active", approvedBy: input.approvedBy, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(treatmentPlans.id, input.id));
      return db.select().from(treatmentPlans).where(eq(treatmentPlans.id, input.id)).get();
    }),

  // ─── Clinical Sessions ─────────────────────────────────────

  listSessions: publicQuery
    .input(
      z.object({
        patientId: z.string().optional(),
        clinicianId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        status: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      let query = db.select().from(clinicalSessions);

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

  getSession: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const session = await db.select().from(clinicalSessions).where(eq(clinicalSessions.id, input.id)).get();
      if (!session) throw new Error("Session not found");
      return session;
    }),

  createSession: publicQuery
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

  updateSession: publicQuery
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

  cancelSession: publicQuery
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(clinicalSessions)
        .set({ status: "cancelled", updatedAt: new Date().toISOString() })
        .where(eq(clinicalSessions.id, input.id));
      return db.select().from(clinicalSessions).where(eq(clinicalSessions.id, input.id)).get();
    }),

  // ─── Outcome Measures ──────────────────────────────────────

  listOutcomeMeasures: publicQuery
    .input(
      z.object({
        patientId: z.string().optional(),
        measureType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      let query = db.select().from(outcomeMeasures);

      const conditions = [];
      if (params.patientId) conditions.push(eq(outcomeMeasures.patientId, params.patientId));
      if (params.measureType) conditions.push(eq(outcomeMeasures.measureType, params.measureType));

      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(outcomeMeasures.administeredAt)).all();
      }
      return query.orderBy(desc(outcomeMeasures.administeredAt)).all();
    }),

  createOutcomeMeasure: publicQuery
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(outcomeMeasures).values({
        id,
        patientId: input.patientId,
        sessionId: input.sessionId ?? null,
        measureType: input.measureType,
        score: input.score,
        maxScore: input.maxScore,
        severityLevel: input.severityLevel ?? null,
        administeredBy: input.administeredBy,
        notes: input.notes ?? null,
      });

      return db.select().from(outcomeMeasures).where(eq(outcomeMeasures.id, id)).get();
    }),

  getOutcomeTrends: publicQuery
    .input(z.object({ patientId: z.string(), measureType: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      let query = db
        .select()
        .from(outcomeMeasures)
        .where(eq(outcomeMeasures.patientId, input.patientId))
        .orderBy(outcomeMeasures.administeredAt);

      if (input.measureType) {
        query = query.where(eq(outcomeMeasures.measureType, input.measureType)) as typeof query;
      }

      const results = await query.all();

      // Group by measure type
      const grouped: Record<string, typeof results> = {};
      for (const r of results) {
        if (!grouped[r.measureType]) grouped[r.measureType] = [];
        grouped[r.measureType].push(r);
      }

      return grouped;
    }),

  // ─── Dashboard ─────────────────────────────────────────────

  dashboardKPIs: publicQuery.query(async () => {
    const db = getDb();
    const allPatients = await db.select().from(patients).all();
    const activePatients = allPatients.filter((p) => p.status === "active").length;
    const intakePatients = allPatients.filter((p) => p.status === "intake").length;

    const today = new Date().toISOString().split("T")[0];
    const allSessions = await db.select().from(clinicalSessions).all();
    const sessionsToday = allSessions.filter((s) => s.sessionDate.startsWith(today) && s.status === "scheduled").length;

    const pendingApprovals = await db
      .select()
      .from(treatmentPlans)
      .where(eq(treatmentPlans.status, "under_review"))
      .all();

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

    return {
      totalPatients: allPatients.length,
      activePatients,
      intakePatients,
      sessionsToday,
      sessionsThisWeek,
      pendingApprovals: pendingApprovals.length,
      highRiskCount: highRiskSessions.length,
    };
  }),

  clinicianWorkload: publicQuery.query(async () => {
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
