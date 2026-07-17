import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { patients, clinicalSessions, treatmentPlans, outcomeMeasures, insurancePlans } from "@db/schema";
import { eq, like, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

// ─── M5: Clinical — AMOS-Clinical ──────────────────────────

export const M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED =
  "M41C_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED" as const;

export function quarantineM5UngovernedOutcomeInstrument(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      `${M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED}: ` +
      "Legacy outcome-instrument entry and raw numeric output are unavailable. Use the governed M4.1C instrument-profile workflow.",
  });
}

export const m5Router = createRouter({
  // ─── Patients ──────────────────────────────────────────────
  listPatients: authedQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["intake", "active", "hold", "discharged", "transferred"]).optional(),
      page: z.number().default(1),
      pageSize: z.number().default(25),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(patients.status, input.status));
      if (input?.search) {
        conditions.push(or(
          like(patients.firstName, `%${input.search}%`),
          like(patients.lastName, `%${input.search}%`),
          like(patients.mrn, `%${input.search}%`),
          like(patients.email, `%${input.search}%`),
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(patients).where(and(...conditions)).orderBy(desc(patients.createdAt)).all()
        : await db.select().from(patients).orderBy(desc(patients.createdAt)).all();

      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 25;
      return { patients: results.slice((page - 1) * pageSize, page * pageSize), total: results.length };
    }),

  getPatient: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const patient = await db.select().from(patients).where(eq(patients.id, input.id)).get();
      if (!patient) throw new Error("Patient not found");

      const treatmentPlansList = await db.select().from(treatmentPlans)
        .where(eq(treatmentPlans.patientId, input.id))
        .orderBy(desc(treatmentPlans.createdAt)).all();

      const recentSessionsList = await db.select().from(clinicalSessions)
        .where(eq(clinicalSessions.patientId, input.id))
        .orderBy(desc(clinicalSessions.sessionDate)).all();

      return {
        patient,
        treatmentPlans: treatmentPlansList,
        recentSessions: recentSessionsList,
        outcomeMeasures: [] as Array<typeof outcomeMeasures.$inferSelect>,
        governedOutcomeMeasureReference: {
          milestone: "M4.1C" as const,
          disposition: "legacy_numeric_rows_quarantined" as const,
          mode: "metadata_only_evaluation" as const,
          humanReviewRequired: true as const,
          liveWrites: 0 as const,
        },
      };
    }),

  createPatient: authedQuery
    .input(z.object({
      firstName: z.string().min(1), lastName: z.string().min(1),
      dateOfBirth: z.string(), gender: z.enum(["male", "female", "non_binary", "prefer_not_say"]).optional(),
      phone: z.string().optional(), email: z.string().optional(),
      address: z.string().optional(), insuranceId: z.string().optional(),
      emergencyName: z.string().optional(), emergencyPhone: z.string().optional(),
      referralSource: z.string().optional(), assignedClinicianId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const mrn = `MRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      await db.insert(patients).values({
        id, mrn, firstName: input.firstName, lastName: input.lastName,
        dateOfBirth: input.dateOfBirth, gender: input.gender ?? null,
        phone: input.phone ?? null, email: input.email ?? null,
        address: input.address ?? null, insuranceId: input.insuranceId ?? null,
        emergencyName: input.emergencyName ?? null, emergencyPhone: input.emergencyPhone ?? null,
        referralSource: input.referralSource ?? null, status: "intake",
        assignedClinicianId: input.assignedClinicianId,
        intakeDate: now, dischargeDate: null, dischargeReason: null,
        createdAt: now, updatedAt: now,
      });

      auditLog({ action: "m5:createPatient", actor, resource: `patient:${mrn}`, details: `Created patient: ${input.lastName}, ${input.firstName}` });
      return { success: true, id, mrn };
    }),

  dischargePatient: authedQuery
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();

      await db.update(patients).set({
        status: "discharged", dischargeReason: input.reason,
        dischargeDate: now, updatedAt: now,
      }).where(eq(patients.id, input.id));

      auditLog({ action: "m5:dischargePatient", actor, resource: `patient:${input.id}`, details: `Discharged: ${input.reason}` });
      return { success: true };
    }),

  // ─── Treatment Plans ───────────────────────────────────────
  listPlans: authedQuery
    .input(z.object({
      patientId: z.string().optional(),
      status: z.enum(["draft", "active", "under_review", "completed", "discontinued"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.patientId) conditions.push(eq(treatmentPlans.patientId, input.patientId));
      if (input?.status) conditions.push(eq(treatmentPlans.status, input.status));
      const results = conditions.length > 0
        ? await db.select().from(treatmentPlans).where(and(...conditions)).orderBy(desc(treatmentPlans.createdAt)).all()
        : await db.select().from(treatmentPlans).orderBy(desc(treatmentPlans.createdAt)).all();
      return results;
    }),

  createTreatmentPlan: authedQuery
    .input(z.object({
      patientId: z.string(), primaryDiagnosis: z.string().min(1),
      secondaryDiagnosis: z.string().optional(), presentingProblem: z.string().min(1),
      goals: z.array(z.object({ description: z.string(), targetDate: z.string().optional() })).default([]),
      interventions: z.array(z.object({ type: z.string(), description: z.string(), frequency: z.string() })).default([]),
      estimatedDurationWeeks: z.number().optional(),
      startDate: z.string(), reviewDate: z.string(),
      assignedClinicianId: z.string(), supervisorId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const planNumber = `TP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      await db.insert(treatmentPlans).values({
        id, planNumber, patientId: input.patientId,
        primaryDiagnosis: input.primaryDiagnosis,
        secondaryDiagnosis: input.secondaryDiagnosis ?? null,
        presentingProblem: input.presentingProblem,
        goalsJson: JSON.stringify(input.goals),
        interventionsJson: JSON.stringify(input.interventions),
        estimatedDurationWeeks: input.estimatedDurationWeeks ?? null,
        startDate: input.startDate, reviewDate: input.reviewDate,
        status: "draft", assignedClinicianId: input.assignedClinicianId,
        supervisorId: input.supervisorId ?? null,
        approvedBy: null, approvedAt: null, createdAt: now, updatedAt: now,
      });

      auditLog({ action: "m5:createPlan", actor, resource: `plan:${planNumber}`, details: `Created treatment plan for ${input.patientId}` });
      return { success: true, id, planNumber };
    }),

  // ─── Clinical Sessions ─────────────────────────────────────
  listSessions: authedQuery
    .input(z.object({
      patientId: z.string().optional(),
      status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.patientId) conditions.push(eq(clinicalSessions.patientId, input.patientId));
      if (input?.status) conditions.push(eq(clinicalSessions.status, input.status));
      const results = conditions.length > 0
        ? await db.select().from(clinicalSessions).where(and(...conditions)).orderBy(desc(clinicalSessions.sessionDate)).all()
        : await db.select().from(clinicalSessions).orderBy(desc(clinicalSessions.sessionDate)).all();
      return results;
    }),

  createSession: authedQuery
    .input(z.object({
      patientId: z.string(), sessionDate: z.string(),
      sessionType: z.enum(["individual", "group", "family", "couples", "intake", "crisis", "telehealth"]).optional(),
      durationMinutes: z.number(), chiefComplaint: z.string().optional(),
      sessionNotes: z.string().optional(), clinicianId: z.string(),
      billingCode: z.string().optional(), riskAssessment: z.object({
        suicideRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
        homocideRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
        elopementRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(clinicalSessions).values({
        id, patientId: input.patientId, sessionDate: input.sessionDate,
        sessionType: input.sessionType ?? "individual",
        durationMinutes: input.durationMinutes,
        chiefComplaint: input.chiefComplaint ?? null,
        sessionNotes: input.sessionNotes ?? null,
        clinicianId: input.clinicianId,
        billingCode: input.billingCode ?? null,
        riskAssessmentJson: input.riskAssessment ? JSON.stringify(input.riskAssessment) : null,
        nextSessionDate: null, nextSessionGoals: null,
        status: "completed", createdAt: now,
      });

      auditLog({ action: "m5:createSession", actor, resource: `session:${id}`, details: `Created session for ${input.patientId}` });
      return { success: true, id };
    }),

  // ─── Outcome Measures — Quarantined legacy surface ─────────
  createOutcomeMeasure: authedQuery
    .input(z.object({
      patientId: z.string(),
      measureType: z.enum(["PHQ-9", "GAD-7", "PSS-10", "WHO-5", "DASS-21", "PCL-5", "CGI-S"]),
      score: z.number(), maxScore: z.number(),
      severityLevel: z.enum(["none", "minimal", "mild", "moderate", "moderately_severe", "severe"]).optional(),
      administeredBy: z.string(),
    }))
    .mutation(() => quarantineM5UngovernedOutcomeInstrument()),

  // ─── Insurance Plans ───────────────────────────────────────
  listInsurancePlans: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(insurancePlans).all();
  }),

  // ─── Clinician Workload ────────────────────────────────────
  clinicianWorkload: publicQuery.query(async () => {
    const db = getDb();
    const sessions = await db.select().from(clinicalSessions).all();
    // Group sessions by clinician (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const clinicianNames: Record<string, string> = {};
    const clinicianSessionCounts: Record<string, number> = {};
    const clinicianPatientSets: Record<string, string[]> = {};

    for (const s of sessions) {
      const cid = s.clinicianId;
      if (!clinicianSessionCounts[cid]) {
        clinicianNames[cid] = cid.slice(0, 8);
        clinicianSessionCounts[cid] = 0;
        clinicianPatientSets[cid] = [];
      }
      if (!clinicianPatientSets[cid].includes(s.patientId)) {
        clinicianPatientSets[cid].push(s.patientId);
      }
      if (s.sessionDate >= weekAgo) clinicianSessionCounts[cid]++;
    }

    return Object.keys(clinicianSessionCounts).map((clinicianId) => ({
      clinicianId,
      name: clinicianNames[clinicianId] ?? clinicianId.slice(0, 8),
      sessionCountThisWeek: clinicianSessionCounts[clinicianId] ?? 0,
      patientCount: (clinicianPatientSets[clinicianId] ?? []).length,
    }));
  }),

  // ─── Seed Data ─────────────────────────────────────────────
  seedClinicalData: publicQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    const db = getDb();
    const now = new Date().toISOString();

    // Check if already seeded
    const existing = await db.select().from(patients).limit(1);
    if (existing.length > 0) return { success: true, message: "Already seeded" };

    // Seed insurance plans
    const plans = [
      { id: "ip-001", planName: "Texas Medicaid", payerName: "HHSC", planType: "medicaid", isActive: true },
      { id: "ip-002", planName: "Superior HealthPlan STAR", payerName: "Superior HealthPlan", planType: "managed_care", isActive: true },
      { id: "ip-003", planName: "Blue Cross Blue Shield TX", payerName: "BCBS TX", planType: "commercial", isActive: true },
    ];
    for (const p of plans) await db.insert(insurancePlans).values(p);

    // Seed patients (5 youth matching NIL graph)
    const patientData = [
      { id: "pt-001", mrn: "SYNTH-BHC-001", firstName: "Synthetic", lastName: "Youth-001", dateOfBirth: "2010-01-01", gender: "male" as const, phone: "+1-555-0101", email: null, address: "Synthetic Address 001", insuranceId: "ip-001", emergencyName: "Synthetic Guardian 01", emergencyPhone: "+1-555-0111", referralSource: "Synthetic School Referral", status: "active" as const, assignedClinicianId: "user-003", intakeDate: "2026-04-01T09:00:00Z" },
      { id: "pt-002", mrn: "SYNTH-BHC-002", firstName: "Synthetic", lastName: "Youth-002", dateOfBirth: "2010-01-02", gender: "female" as const, phone: "+1-555-0102", email: null, address: "Synthetic Address 002", insuranceId: "ip-002", emergencyName: "Synthetic Guardian 12", emergencyPhone: "+1-555-0112", referralSource: "Synthetic Provider Referral", status: "active" as const, assignedClinicianId: "user-003", intakeDate: "2026-04-15T10:00:00Z" },
      { id: "pt-003", mrn: "SYNTH-BHC-003", firstName: "Synthetic", lastName: "Youth-003", dateOfBirth: "2010-01-03", gender: "male" as const, phone: "+1-555-0103", email: null, address: "Synthetic Address 003", insuranceId: "ip-001", emergencyName: "Synthetic Guardian 02", emergencyPhone: "+1-555-0113", referralSource: "Synthetic Court Referral", status: "active" as const, assignedClinicianId: "user-cm-001", intakeDate: "2026-06-28T14:00:00Z" },
      { id: "pt-004", mrn: "SYNTH-BHC-004", firstName: "Synthetic", lastName: "Youth-004", dateOfBirth: "2010-01-04", gender: "female" as const, phone: "+1-555-0104", email: null, address: "Synthetic Address 004", insuranceId: "ip-003", emergencyName: "Synthetic Guardian 07", emergencyPhone: "+1-555-0114", referralSource: "Synthetic Agency Referral", status: "active" as const, assignedClinicianId: "user-cm-002", intakeDate: "2026-05-20T08:00:00Z" },
      { id: "pt-005", mrn: "SYNTH-BHC-005", firstName: "Synthetic", lastName: "Youth-005", dateOfBirth: "2010-01-05", gender: "male" as const, phone: "+1-555-0105", email: null, address: "Synthetic Address 005", insuranceId: "ip-002", emergencyName: "Synthetic Guardian 04", emergencyPhone: "+1-555-0115", referralSource: "Synthetic Family Referral", status: "intake" as const, assignedClinicianId: null, intakeDate: "2026-07-02T11:00:00Z" },
    ];
    for (const p of patientData) {
      await db.insert(patients).values({ ...p, dischargeDate: null, dischargeReason: null, createdAt: now, updatedAt: now });
    }

    // Seed treatment plans
    const planData = [
      { id: "tp-001", patientId: "pt-001", planNumber: "TP-2026-1001", status: "active" as const, primaryDiagnosis: "F43.25 — Post-Traumatic Stress Disorder", secondaryDiagnosis: "F32.9 — Major Depressive Disorder, unspecified", presentingProblem: "Chronic trauma exposure from domestic violence, school refusal, sleep disturbance, reactive aggression toward peers", goalsJson: JSON.stringify([{ goal: "Reduce PTSD symptom severity by 40%", targetDate: "2026-08-01" }, { goal: "Achieve 80% school attendance", targetDate: "2026-07-15" }, { goal: "Develop 3 coping skills for emotional regulation", targetDate: "2026-07-01" }]), interventionsJson: JSON.stringify(["TF-CBT", "EMDR", "DBT Skills Training", "Trauma-Focused Group Therapy"]), estimatedDurationWeeks: 24, startDate: "2026-04-01", reviewDate: "2026-07-15", assignedClinicianId: "user-003", supervisorId: "admin-001" },
      { id: "tp-002", patientId: "pt-002", planNumber: "TP-2026-1002", status: "active" as const, primaryDiagnosis: "F32.9 — Major Depressive Disorder", secondaryDiagnosis: "F41.1 — Generalized Anxiety Disorder", presentingProblem: "Persistent sadness, social withdrawal, academic decline, somatic complaints, passive suicidal ideation", goalsJson: JSON.stringify([{ goal: "Improve documented depression symptoms through qualified human review", targetDate: "2026-08-01" }, { goal: "Increase social engagement to 2+ activities/week", targetDate: "2026-07-20" }, { goal: "Eliminate passive suicidal ideation", targetDate: "2026-07-01" }]), interventionsJson: JSON.stringify(["CBT", "Interpersonal Therapy", "Behavioral Activation", "Family Psychoeducation"]), estimatedDurationWeeks: 20, startDate: "2026-04-15", reviewDate: "2026-07-20", assignedClinicianId: "user-003", supervisorId: "admin-001" },
      { id: "tp-003", patientId: "pt-003", planNumber: "TP-2026-1003", status: "under_review" as const, primaryDiagnosis: "F91.3 — Oppositional Defiant Disorder", secondaryDiagnosis: "F84.0 — Autism Spectrum Disorder", presentingProblem: "Frequent defiance toward authority, property destruction, running away, difficulty with transitions and routine changes", goalsJson: JSON.stringify([{ goal: "Reduce aggressive incidents by 60%", targetDate: "2026-09-01" }, { goal: "Complete functional behavior assessment", targetDate: "2026-07-10" }, { goal: "Establish consistent daily routine", targetDate: "2026-07-15" }]), interventionsJson: JSON.stringify(["PCIT", "Applied Behavior Analysis", "Social Skills Training", "Parent Management Training"]), estimatedDurationWeeks: 32, startDate: "2026-06-28", reviewDate: "2026-07-10", assignedClinicianId: "user-cm-001", supervisorId: "admin-001" },
    ];
    for (const p of planData) {
      await db.insert(treatmentPlans).values({ ...p, endDate: null, approvedBy: null, approvedAt: null, createdAt: now, updatedAt: now });
    }

    // Seed clinical sessions (10 sessions across patients)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const sessionData = [
      { id: "cs-001", patientId: "pt-001", treatmentPlanId: "tp-001", clinicianId: "user-003", sessionDate: "2026-06-20T10:00:00Z", sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Nightmares and school anxiety", sessionNotes: "Synthetic-Person-001 reported 3 nightmares this week. Used grounding techniques. Completed trauma narrative exercise. Discussed safety planning.", interventionsUsedJson: JSON.stringify(["Grounding Techniques", "Trauma Narrative", "Safety Planning"]), clientResponse: "Engaged well, able to identify 2 triggers", planModifications: "Increase grounding practice to daily", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-06-27T10:00:00Z", nextSessionGoals: "Continue trauma narrative, introduce cognitive coping" },
      { id: "cs-002", patientId: "pt-001", treatmentPlanId: "tp-001", clinicianId: "user-003", sessionDate: twoDaysAgo, sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Peer conflict at school", sessionNotes: "Synthetic-Person-001 had altercation with peer. Used de-escalation skills taught in session. Practiced 'stop and think' technique. Role-played apology conversation.", interventionsUsedJson: JSON.stringify(["Role Play", "De-escalation Training", "Social Skills"]), clientResponse: "Initially resistant, became engaged during role play", planModifications: "Add social skills module to plan", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-08T10:00:00Z", nextSessionGoals: "Process peer conflict outcome, practice assertive communication" },
      { id: "cs-003", patientId: "pt-002", treatmentPlanId: "tp-002", clinicianId: "user-003", sessionDate: "2026-06-22T14:00:00Z", sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Increased social withdrawal", sessionNotes: "Synthetic-Person-005 has missed 3 group sessions. Discussed barriers to attendance. Identified anxiety about group setting. Developed gradual exposure plan.", interventionsUsedJson: JSON.stringify(["Behavioral Activation", "Graduated Exposure", "Cognitive Restructuring"]), clientResponse: "Agreed to attend 15 minutes of next group", planModifications: "Create graduated exposure hierarchy for social situations", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-06-29T14:00:00Z", nextSessionGoals: "Review group attendance, process experience" },
      { id: "cs-004", patientId: "pt-002", treatmentPlanId: "tp-002", clinicianId: "user-003", sessionDate: yesterday, sessionType: "family" as const, durationMinutes: 90, chiefComplaint: "Family conflict regarding boundaries", sessionNotes: "Family session with mother. Discussed consistent limit-setting. Mother expressed guilt about placement. Addressed co-dependency patterns. Developed family communication plan.", interventionsUsedJson: JSON.stringify(["Family Systems Therapy", "Communication Skills", "Boundary Setting"]), clientResponse: "Mother receptive, Synthetic-Person-005 participated after initial resistance", planModifications: "Schedule bi-weekly family sessions", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-09T14:00:00Z", nextSessionGoals: "Review family communication plan implementation" },
      { id: "cs-005", patientId: "pt-003", treatmentPlanId: "tp-003", clinicianId: "user-cm-001", sessionDate: "2026-06-29T09:00:00Z", sessionType: "individual" as const, durationMinutes: 45, chiefComplaint: "Property destruction during transition", sessionNotes: "Synthetic-Person-004 broke window during room change. Used crisis de-escalation. Identified transition as trigger. Developed visual schedule. Practiced coping skills for transitions.", interventionsUsedJson: JSON.stringify(["Crisis De-escalation", "Visual Schedule", "Coping Skills Training"]), clientResponse: "Calmed after 20 minutes, participated in schedule creation", planModifications: "Implement visual schedule for all transitions", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "medium" }), nextSessionDate: "2026-07-01T09:00:00Z", nextSessionGoals: "Review transition coping, assess elopement risk factors" },
      { id: "cs-006", patientId: "pt-004", treatmentPlanId: null, clinicianId: "user-cm-002", sessionDate: weekAgo, sessionType: "intake" as const, durationMinutes: 90, chiefComplaint: "New admission — behavioral concerns", sessionNotes: "Initial intake assessment. Synthetic-Person-002 presents with aggression, defiance, history of 3 residential placements. Guardianship confirmed with father. Risk assessment completed. Safety plan developed.", interventionsUsedJson: JSON.stringify(["Intake Assessment", "Risk Assessment", "Safety Planning"]), clientResponse: "Cooperative during assessment, engaged in safety planning", planModifications: "Complete the governed clinical assessment workflow", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "high" }), nextSessionDate: "2026-07-03T11:00:00Z", nextSessionGoals: "Complete governed assessment review and begin treatment plan development" },
      { id: "cs-007", patientId: "pt-004", treatmentPlanId: null, clinicianId: "user-cm-002", sessionDate: yesterday, sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Difficulty adjusting to unit rules", sessionNotes: "Synthetic-Person-002 testing boundaries with staff. Used motivational interviewing. Identified personal goals (return home, finish school year). Connected rules to goals. Developed token economy system.", interventionsUsedJson: JSON.stringify(["Motivational Interviewing", "Token Economy", "Goal Setting"]), clientResponse: "Engaged when connected to personal goals", planModifications: "Implement token economy on unit", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "medium" }), nextSessionDate: "2026-07-06T11:00:00Z", nextSessionGoals: "Review token economy progress, address elopement risk" },
      { id: "cs-008", patientId: "pt-001", treatmentPlanId: "tp-001", clinicianId: "user-003", sessionDate: "2026-06-27T10:00:00Z", sessionType: "group" as const, durationMinutes: 90, chiefComplaint: "Group therapy — trauma processing", sessionNotes: "Trauma-focused group session. 4 participants. Synthetic-Person-001 shared trauma narrative with group. Received peer support. Practiced grounding in group setting.", interventionsUsedJson: JSON.stringify(["TF-CBT Group", "Peer Support", "Grounding Techniques"]), clientResponse: "Active participant, supported others", planModifications: "Continue weekly group attendance", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-04T10:00:00Z", nextSessionGoals: "Continue trauma narrative in group setting" },
      { id: "cs-009", patientId: "pt-003", treatmentPlanId: "tp-003", clinicianId: "user-cm-001", sessionDate: yesterday, sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Functional behavior assessment follow-up", sessionNotes: "Reviewed ABC data from staff. Identified attention-seeking function for property destruction. Developed replacement behaviors. Trained staff on planned ignoring + differential reinforcement.", interventionsUsedJson: JSON.stringify(["Functional Behavior Assessment", "Differential Reinforcement", "Staff Training"]), clientResponse: "Responded well to structured approach", planModifications: "Implement FBA-based behavior plan across all shifts", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-04T09:00:00Z", nextSessionGoals: "Review behavior data, adjust reinforcement schedule" },
      { id: "cs-010", patientId: "pt-005", treatmentPlanId: null, clinicianId: "user-003", sessionDate: "2026-07-02T13:00:00Z", sessionType: "intake" as const, durationMinutes: 60, chiefComplaint: "Initial intake — adjustment concerns", sessionNotes: "Synthetic-Person-014 admitted yesterday. Presenting with anxiety, homesickness, difficulty sleeping. Mother reports history of anxiety. Guardian consent obtained. Assessment initiated.", interventionsUsedJson: JSON.stringify(["Intake Assessment", "Anxiety Screening", "Sleep Hygiene Education"]), clientResponse: "Cooperative but anxious", planModifications: "Complete full assessment battery", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-05T13:00:00Z", nextSessionGoals: "Complete governed assessment review and develop the initial safety plan" },
    ];
    for (const s of sessionData) {
      await db.insert(clinicalSessions).values({ ...s, status: "completed" as const, billingCode: null, createdAt: now, updatedAt: now });
    }

    return { success: true, message: `${patientData.length} patients + ${planData.length} plans + ${sessionData.length} sessions + ${plans.length} insurance plans seeded` };
  }),

  // ─── Dashboard KPIs ────────────────────────────────────────
  dashboardKPIs: publicQuery.query(async () => {
    const db = getDb();
    const allPatients = await db.select().from(patients).all();
    const allSessions = await db.select().from(clinicalSessions).all();

    const activePatients = allPatients.filter((p) => p.status === "active").length;
    const totalPatients = allPatients.length;

    // Sessions this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sessionsThisWeek = allSessions.filter((s) => s.sessionDate >= weekAgo).length;

    // Sessions today
    const today = new Date().toISOString().split("T")[0];
    const sessionsToday = allSessions.filter((s) => s.sessionDate.startsWith(today)).length;

    // High risk from latest session risk assessment
    let highRiskCount = 0;
    for (const s of allSessions) {
      if (!s.riskAssessmentJson) continue;
      try {
        const risk = JSON.parse(s.riskAssessmentJson);
        if (risk.suicideRisk === "high" || risk.homocideRisk === "high" || risk.elopementRisk === "high") highRiskCount++;
      } catch { /* ignore */ }
    }

    // Pending approvals = plans under review
    const allPlans = await db.select().from(treatmentPlans).all();
    const pendingApprovals = allPlans.filter((p) => p.status === "under_review").length;

    return {
      activePatients, totalPatients, sessionsThisWeek,
      sessionsToday, highRiskCount, pendingApprovals,
    };
  }),
});
