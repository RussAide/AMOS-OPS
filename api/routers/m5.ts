import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { patients, clinicalSessions, treatmentPlans, outcomeMeasures, insurancePlans } from "@db/schema";
import { eq, like, and, or, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── M5: Clinical — AMOS-Clinical ──────────────────────────

export const m5Router = createRouter({
  // ─── Patients ──────────────────────────────────────────────
  listPatients: authedQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(25),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
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

      const outcomeMeasuresList = await db.select().from(outcomeMeasures)
        .where(eq(outcomeMeasures.patientId, input.id))
        .orderBy(desc(outcomeMeasures.administeredAt)).all();

      return { patient, treatmentPlans: treatmentPlansList, recentSessions: recentSessionsList, outcomeMeasures: outcomeMeasuresList };
    }),

  createPatient: authedQuery
    .input(z.object({
      firstName: z.string().min(1), lastName: z.string().min(1),
      dateOfBirth: z.string(), gender: z.string().optional(),
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
    .input(z.object({ patientId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
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
    .input(z.object({ patientId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
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

  // ─── Outcome Measures ──────────────────────────────────────
  createOutcomeMeasure: authedQuery
    .input(z.object({
      patientId: z.string(), measureType: z.string().min(1),
      score: z.number(), maxScore: z.number(),
      severityLevel: z.string().optional(), administeredBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(outcomeMeasures).values({
        id, patientId: input.patientId, measureType: input.measureType,
        score: input.score, maxScore: input.maxScore,
        severityLevel: input.severityLevel ?? null,
        administeredBy: input.administeredBy, administeredAt: now,
      });

      auditLog({ action: "m5:createOutcome", actor, resource: `outcome:${id}`, details: `Recorded ${input.measureType}: ${input.score}/${input.maxScore}` });
      return { success: true, id };
    }),

  // ─── Insurance Plans ───────────────────────────────────────
  listInsurancePlans: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(insurancePlans).all();
  }),

  // ─── Clinician Workload ────────────────────────────────────
  clinicianWorkload: publicQuery.query(async () => {
    const db = getDb();
    const sessions = await db.select().from(clinicalSessions).all();
    const allPatients = await db.select().from(patients).all();

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
      { id: "pt-001", mrn: "BHC-2026-001", firstName: "Marcus", lastName: "Johnson", dateOfBirth: "2009-03-15", gender: "male" as const, phone: "(713) 555-0101", email: null, address: "1234 Oak Street, Houston, TX 77001", insuranceId: "ip-001", emergencyName: "Tanya Johnson", emergencyPhone: "(713) 555-0102", referralSource: "HISD School Counselor", status: "active" as const, assignedClinicianId: "user-003", intakeDate: "2026-04-01T09:00:00Z" },
      { id: "pt-002", mrn: "BHC-2026-002", firstName: "Aaliyah", lastName: "Williams", dateOfBirth: "2010-07-22", gender: "female" as const, phone: "(713) 555-0201", email: null, address: "5678 Pine Avenue, Houston, TX 77002", insuranceId: "ip-002", emergencyName: "Denise Williams", emergencyPhone: "(713) 555-0202", referralSource: "Pediatrician", status: "active" as const, assignedClinicianId: "user-003", intakeDate: "2026-04-15T10:00:00Z" },
      { id: "pt-003", mrn: "BHC-2026-003", firstName: "Carlos", lastName: "Martinez", dateOfBirth: "2008-11-08", gender: "male" as const, phone: "(713) 555-0301", email: null, address: "9012 Elm Drive, Houston, TX 77003", insuranceId: "ip-001", emergencyName: "Maria Martinez", emergencyPhone: "(713) 555-0302", referralSource: "Juvenile Court Probation", status: "active" as const, assignedClinicianId: "user-cm-001", intakeDate: "2026-06-28T14:00:00Z" },
      { id: "pt-004", mrn: "BHC-2026-004", firstName: "Jada", lastName: "Thompson", dateOfBirth: "2011-01-30", gender: "female" as const, phone: "(713) 555-0401", email: null, address: "3456 Maple Lane, Houston, TX 77004", insuranceId: "ip-003", emergencyName: "Robert Thompson", emergencyPhone: "(713) 555-0402", referralSource: "DCF Caseworker", status: "active" as const, assignedClinicianId: "user-cm-002", intakeDate: "2026-05-20T08:00:00Z" },
      { id: "pt-005", mrn: "BHC-2026-005", firstName: "Ethan", lastName: "Davis", dateOfBirth: "2009-09-12", gender: "male" as const, phone: "(713) 555-0501", email: null, address: "7890 Birch Blvd, Houston, TX 77005", insuranceId: "ip-002", emergencyName: "Angela Davis", emergencyPhone: "(713) 555-0502", referralSource: "Family Self-Referral", status: "intake" as const, assignedClinicianId: null, intakeDate: "2026-07-02T11:00:00Z" },
    ];
    for (const p of patientData) {
      await db.insert(patients).values({ ...p, dischargeDate: null, dischargeReason: null, createdAt: now, updatedAt: now });
    }

    // Seed treatment plans
    const planData = [
      { id: "tp-001", patientId: "pt-001", planNumber: "TP-2026-1001", status: "active" as const, primaryDiagnosis: "F43.25 — Post-Traumatic Stress Disorder", secondaryDiagnosis: "F32.9 — Major Depressive Disorder, unspecified", presentingProblem: "Chronic trauma exposure from domestic violence, school refusal, sleep disturbance, reactive aggression toward peers", goalsJson: JSON.stringify([{ goal: "Reduce PTSD symptom severity by 40%", targetDate: "2026-08-01" }, { goal: "Achieve 80% school attendance", targetDate: "2026-07-15" }, { goal: "Develop 3 coping skills for emotional regulation", targetDate: "2026-07-01" }]), interventionsJson: JSON.stringify(["TF-CBT", "EMDR", "DBT Skills Training", "Trauma-Focused Group Therapy"]), estimatedDurationWeeks: 24, startDate: "2026-04-01", reviewDate: "2026-07-15", assignedClinicianId: "user-003", supervisorId: "admin-001" },
      { id: "tp-002", patientId: "pt-002", planNumber: "TP-2026-1002", status: "active" as const, primaryDiagnosis: "F32.9 — Major Depressive Disorder", secondaryDiagnosis: "F41.1 — Generalized Anxiety Disorder", presentingProblem: "Persistent sadness, social withdrawal, academic decline, somatic complaints, passive suicidal ideation", goalsJson: JSON.stringify([{ goal: "Reduce depression score (PHQ-A) from 18 to <10", targetDate: "2026-08-01" }, { goal: "Increase social engagement to 2+ activities/week", targetDate: "2026-07-20" }, { goal: "Eliminate passive suicidal ideation", targetDate: "2026-07-01" }]), interventionsJson: JSON.stringify(["CBT", "Interpersonal Therapy", "Behavioral Activation", "Family Psychoeducation"]), estimatedDurationWeeks: 20, startDate: "2026-04-15", reviewDate: "2026-07-20", assignedClinicianId: "user-003", supervisorId: "admin-001" },
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
      { id: "cs-001", patientId: "pt-001", treatmentPlanId: "tp-001", clinicianId: "user-003", sessionDate: "2026-06-20T10:00:00Z", sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Nightmares and school anxiety", sessionNotes: "Marcus reported 3 nightmares this week. Used grounding techniques. Completed trauma narrative exercise. Discussed safety planning.", interventionsUsedJson: JSON.stringify(["Grounding Techniques", "Trauma Narrative", "Safety Planning"]), clientResponse: "Engaged well, able to identify 2 triggers", planModifications: "Increase grounding practice to daily", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-06-27T10:00:00Z", nextSessionGoals: "Continue trauma narrative, introduce cognitive coping" },
      { id: "cs-002", patientId: "pt-001", treatmentPlanId: "tp-001", clinicianId: "user-003", sessionDate: twoDaysAgo, sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Peer conflict at school", sessionNotes: "Marcus had altercation with peer. Used de-escalation skills taught in session. Practiced 'stop and think' technique. Role-played apology conversation.", interventionsUsedJson: JSON.stringify(["Role Play", "De-escalation Training", "Social Skills"]), clientResponse: "Initially resistant, became engaged during role play", planModifications: "Add social skills module to plan", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-08T10:00:00Z", nextSessionGoals: "Process peer conflict outcome, practice assertive communication" },
      { id: "cs-003", patientId: "pt-002", treatmentPlanId: "tp-002", clinicianId: "user-003", sessionDate: "2026-06-22T14:00:00Z", sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Increased social withdrawal", sessionNotes: "Aaliyah has missed 3 group sessions. Discussed barriers to attendance. Identified anxiety about group setting. Developed gradual exposure plan.", interventionsUsedJson: JSON.stringify(["Behavioral Activation", "Graduated Exposure", "Cognitive Restructuring"]), clientResponse: "Agreed to attend 15 minutes of next group", planModifications: "Create graduated exposure hierarchy for social situations", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-06-29T14:00:00Z", nextSessionGoals: "Review group attendance, process experience" },
      { id: "cs-004", patientId: "pt-002", treatmentPlanId: "tp-002", clinicianId: "user-003", sessionDate: yesterday, sessionType: "family" as const, durationMinutes: 90, chiefComplaint: "Family conflict regarding boundaries", sessionNotes: "Family session with mother. Discussed consistent limit-setting. Mother expressed guilt about placement. Addressed co-dependency patterns. Developed family communication plan.", interventionsUsedJson: JSON.stringify(["Family Systems Therapy", "Communication Skills", "Boundary Setting"]), clientResponse: "Mother receptive, Aaliyah participated after initial resistance", planModifications: "Schedule bi-weekly family sessions", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-09T14:00:00Z", nextSessionGoals: "Review family communication plan implementation" },
      { id: "cs-005", patientId: "pt-003", treatmentPlanId: "tp-003", clinicianId: "user-cm-001", sessionDate: "2026-06-29T09:00:00Z", sessionType: "individual" as const, durationMinutes: 45, chiefComplaint: "Property destruction during transition", sessionNotes: "Carlos broke window during room change. Used crisis de-escalation. Identified transition as trigger. Developed visual schedule. Practiced coping skills for transitions.", interventionsUsedJson: JSON.stringify(["Crisis De-escalation", "Visual Schedule", "Coping Skills Training"]), clientResponse: "Calmed after 20 minutes, participated in schedule creation", planModifications: "Implement visual schedule for all transitions", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "medium" }), nextSessionDate: "2026-07-01T09:00:00Z", nextSessionGoals: "Review transition coping, assess elopement risk factors" },
      { id: "cs-006", patientId: "pt-004", treatmentPlanId: null, clinicianId: "user-cm-002", sessionDate: weekAgo, sessionType: "intake" as const, durationMinutes: 90, chiefComplaint: "New admission — behavioral concerns", sessionNotes: "Initial intake assessment. Jada presents with aggression, defiance, history of 3 residential placements. Guardianship confirmed with father. Risk assessment completed. Safety plan developed.", interventionsUsedJson: JSON.stringify(["Intake Assessment", "Risk Assessment", "Safety Planning"]), clientResponse: "Cooperative during assessment, engaged in safety planning", planModifications: "Complete CANS assessment within 30 days", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "high" }), nextSessionDate: "2026-07-03T11:00:00Z", nextSessionGoals: "Complete CANS, begin treatment plan development" },
      { id: "cs-007", patientId: "pt-004", treatmentPlanId: null, clinicianId: "user-cm-002", sessionDate: yesterday, sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Difficulty adjusting to unit rules", sessionNotes: "Jada testing boundaries with staff. Used motivational interviewing. Identified personal goals (return home, finish school year). Connected rules to goals. Developed token economy system.", interventionsUsedJson: JSON.stringify(["Motivational Interviewing", "Token Economy", "Goal Setting"]), clientResponse: "Engaged when connected to personal goals", planModifications: "Implement token economy on unit", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "medium" }), nextSessionDate: "2026-07-06T11:00:00Z", nextSessionGoals: "Review token economy progress, address elopement risk" },
      { id: "cs-008", patientId: "pt-001", treatmentPlanId: "tp-001", clinicianId: "user-003", sessionDate: "2026-06-27T10:00:00Z", sessionType: "group" as const, durationMinutes: 90, chiefComplaint: "Group therapy — trauma processing", sessionNotes: "Trauma-focused group session. 4 participants. Marcus shared trauma narrative with group. Received peer support. Practiced grounding in group setting.", interventionsUsedJson: JSON.stringify(["TF-CBT Group", "Peer Support", "Grounding Techniques"]), clientResponse: "Active participant, supported others", planModifications: "Continue weekly group attendance", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-04T10:00:00Z", nextSessionGoals: "Continue trauma narrative in group setting" },
      { id: "cs-009", patientId: "pt-003", treatmentPlanId: "tp-003", clinicianId: "user-cm-001", sessionDate: yesterday, sessionType: "individual" as const, durationMinutes: 60, chiefComplaint: "Functional behavior assessment follow-up", sessionNotes: "Reviewed ABC data from staff. Identified attention-seeking function for property destruction. Developed replacement behaviors. Trained staff on planned ignoring + differential reinforcement.", interventionsUsedJson: JSON.stringify(["Functional Behavior Assessment", "Differential Reinforcement", "Staff Training"]), clientResponse: "Responded well to structured approach", planModifications: "Implement FBA-based behavior plan across all shifts", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-04T09:00:00Z", nextSessionGoals: "Review behavior data, adjust reinforcement schedule" },
      { id: "cs-010", patientId: "pt-005", treatmentPlanId: null, clinicianId: "user-003", sessionDate: "2026-07-02T13:00:00Z", sessionType: "intake" as const, durationMinutes: 60, chiefComplaint: "Initial intake — adjustment concerns", sessionNotes: "Ethan admitted yesterday. Presenting with anxiety, homesickness, difficulty sleeping. Mother reports history of anxiety. Guardian consent obtained. Assessment initiated.", interventionsUsedJson: JSON.stringify(["Intake Assessment", "Anxiety Screening", "Sleep Hygiene Education"]), clientResponse: "Cooperative but anxious", planModifications: "Complete full assessment battery", riskAssessmentJson: JSON.stringify({ suicideRisk: "low", homocideRisk: "low", elopementRisk: "low" }), nextSessionDate: "2026-07-05T13:00:00Z", nextSessionGoals: "Complete CANS, develop initial safety plan" },
    ];
    for (const s of sessionData) {
      await db.insert(clinicalSessions).values({ ...s, status: "completed" as const, billingCode: null, billedAmount: null, createdAt: now, updatedAt: now });
    }

    // Seed outcome measures
    const omData = [
      { id: "om-001", patientId: "pt-001", measureType: "PCL-5" as const, score: 62, maxScore: 80, severityLevel: "moderate" as const, administeredBy: "user-003" },
      { id: "om-002", patientId: "pt-002", measureType: "PHQ-9" as const, score: 18, maxScore: 27, severityLevel: "moderately_severe" as const, administeredBy: "user-003" },
      { id: "om-003", patientId: "pt-003", measureType: "DASS-21" as const, score: 42, maxScore: 63, severityLevel: "severe" as const, administeredBy: "user-cm-001" },
      { id: "om-004", patientId: "pt-004", measureType: "CGI-S" as const, score: 5, maxScore: 7, severityLevel: "moderate" as const, administeredBy: "user-cm-002" },
    ];
    for (const o of omData) {
      await db.insert(outcomeMeasures).values({ ...o, sessionId: null, notes: null, createdAt: now });
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
