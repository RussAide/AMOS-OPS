import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  facilities, rooms, facilityPhases, bedCensusV2,
  campusStages, stageAssignments, stageProgressionCriteria,
  censusAlerts, censusSnapshots,
} from "@db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ─── M19: 48-Bed Facility Architecture Router ────────────────

export const m19Router = createRouter({
  // ─── Facilities ──────────────────────────────────────────
  listFacilities: publicQuery.query(async () => {
    return getDb().select().from(facilities).orderBy(facilities.name);
  }),

  getFacility: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb().select().from(facilities).where(eq(facilities.id, input.id));
      return rows[0] ?? null;
    }),

  createFacility: publicQuery
    .input(z.object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      type: z.enum(["main_residence", "emergency_care", "purpose_built"]),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      licensedCapacity: z.number().default(0),
      operationalCapacity: z.number().default(0),
      totalRooms: z.number().default(0),
      totalBeds: z.number().default(0),
      status: z.enum(["active", "inactive", "planned", "under_construction"]).default("active"),
      activationDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await getDb().insert(facilities).values(input);
      return { success: true };
    }),

  updateFacility: publicQuery
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      licensedCapacity: z.number().optional(),
      operationalCapacity: z.number().optional(),
      status: z.enum(["active", "inactive", "planned", "under_construction"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await getDb().update(facilities).set(data).where(eq(facilities.id, id));
      return { success: true };
    }),

  // ─── Rooms ───────────────────────────────────────────────
  listRooms: publicQuery
    .input(z.object({ facilityId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.facilityId) {
        return getDb().select().from(rooms).where(eq(rooms.facilityId, input.facilityId)).orderBy(rooms.floor, rooms.roomNumber);
      }
      return getDb().select().from(rooms).orderBy(rooms.facilityId, rooms.floor, rooms.roomNumber);
    }),

  getRoom: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb().select().from(rooms).where(eq(rooms.id, input.id));
      return rows[0] ?? null;
    }),

  createRoom: publicQuery
    .input(z.object({
      id: z.string(),
      facilityId: z.string(),
      roomNumber: z.string(),
      floor: z.enum(["ground", "first", "second", "third", "basement"]).default("ground"),
      roomType: z.enum(["standard", "observation", "quiet", "ada_accessible", "isolation"]).default("standard"),
      maxBeds: z.number().default(2),
      bedLayout: z.enum(["single", "double", "bunk"]).default("double"),
      hasPrivateBath: z.boolean().default(false),
      hasWindow: z.boolean().default(true),
      status: z.enum(["active", "inactive", "maintenance", "reserved"]).default("active"),
      phaseActivationId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await getDb().insert(rooms).values(input);
      return { success: true };
    }),

  updateRoomStatus: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["active", "inactive", "maintenance", "reserved"]),
    }))
    .mutation(async ({ input }) => {
      await getDb().update(rooms).set({ status: input.status }).where(eq(rooms.id, input.id));
      return { success: true };
    }),

  // ─── Facility Phases ─────────────────────────────────────
  listPhases: publicQuery
    .input(z.object({ facilityId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.facilityId) {
        return getDb().select().from(facilityPhases).where(eq(facilityPhases.facilityId, input.facilityId)).orderBy(facilityPhases.phaseNumber);
      }
      return getDb().select().from(facilityPhases).orderBy(facilityPhases.facilityId, facilityPhases.phaseNumber);
    }),

  createPhase: publicQuery
    .input(z.object({
      id: z.string(),
      facilityId: z.string(),
      phaseName: z.string(),
      phaseNumber: z.number(),
      bedsActivated: z.number().default(0),
      roomsActivated: z.number().default(0),
      activationDate: z.string().optional(),
      targetDate: z.string().optional(),
      status: z.enum(["pending", "active", "completed", "deferred"]).default("pending"),
      approvedBy: z.string().optional(),
      approvalDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await getDb().insert(facilityPhases).values(input);
      return { success: true };
    }),

  activatePhase: publicQuery
    .input(z.object({
      id: z.string(),
      approvedBy: z.string(),
      activationDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      await getDb().update(facilityPhases).set({
        status: "active",
        approvedBy: input.approvedBy,
        approvalDate: input.activationDate,
        activationDate: input.activationDate,
      }).where(eq(facilityPhases.id, input.id));
      return { success: true };
    }),

  // ─── Bed Census v2 ───────────────────────────────────────
  listBeds: publicQuery
    .input(z.object({
      facilityId: z.string().optional(),
      roomId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      if (input?.facilityId && input?.roomId) {
        return getDb().select().from(bedCensusV2)
          .where(and(eq(bedCensusV2.facilityId, input.facilityId), eq(bedCensusV2.roomId, input.roomId)))
          .orderBy(bedCensusV2.bedLabel);
      }
      if (input?.facilityId) {
        return getDb().select().from(bedCensusV2).where(eq(bedCensusV2.facilityId, input.facilityId)).orderBy(bedCensusV2.bedLabel);
      }
      return getDb().select().from(bedCensusV2).orderBy(bedCensusV2.bedLabel);
    }),

  assignBed: publicQuery
    .input(z.object({
      bedId: z.string(),
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      assignedDate: z.string(),
      expectedDischargeDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await getDb().update(bedCensusV2).set({
        isOccupied: true,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        assignedDate: input.assignedDate,
        expectedDischargeDate: input.expectedDischargeDate,
      }).where(eq(bedCensusV2.id, input.bedId));
      return { success: true };
    }),

  vacateBed: publicQuery
    .input(z.object({ bedId: z.string() }))
    .mutation(async ({ input }) => {
      await getDb().update(bedCensusV2).set({
        isOccupied: false,
        youthId: null,
        youthName: null,
        mrn: null,
        assignedDate: null,
        expectedDischargeDate: null,
      }).where(eq(bedCensusV2.id, input.bedId));
      return { success: true };
    }),

  // ─── Campus Summary ──────────────────────────────────────
  getCampusSummary: publicQuery.query(async () => {
    const allBeds = await getDb().select().from(bedCensusV2);
    const allFacilities = await getDb().select().from(facilities);
    const occupied = allBeds.filter(b => b.isOccupied).length;
    const total = allBeds.length;
    const byFacility = allFacilities.map(f => {
      const facilityBeds = allBeds.filter(b => b.facilityId === f.id);
      const facilityOccupied = facilityBeds.filter(b => b.isOccupied).length;
      return {
        facilityId: f.id,
        facilityName: f.name,
        facilityCode: f.code,
        licensedCapacity: f.licensedCapacity,
        operationalCapacity: f.operationalCapacity,
        totalBeds: facilityBeds.length,
        occupiedBeds: facilityOccupied,
        vacantBeds: facilityBeds.length - facilityOccupied,
        occupancyRate: facilityBeds.length > 0 ? Math.round((facilityOccupied / facilityBeds.length) * 100) : 0,
      };
    });
    return {
      campusTotalBeds: total,
      campusOccupiedBeds: occupied,
      campusVacantBeds: total - occupied,
      campusOccupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      licensedCapacityTotal: allFacilities.reduce((sum, f) => sum + f.licensedCapacity, 0),
      operationalCapacityTotal: allFacilities.reduce((sum, f) => sum + f.operationalCapacity, 0),
      byFacility,
    };
  }),

  // ─── Seed Demo Data ──────────────────────────────────────
  seedFacilityData: publicQuery.mutation(async () => {
    // Seed facilities
    await getDb().insert(facilities).values([
      { id: "fac-001", name: "Main Residence", code: "MR", type: "main_residence", address: "123 Cypress Lane", city: "Cypress", state: "TX", zipCode: "77429", licensedCapacity: 10, operationalCapacity: 4, totalRooms: 4, totalBeds: 4, status: "active", activationDate: "2024-01-15", notes: "Primary residence. 4 rooms, 4 beds. Licensed capacity 10." },
      { id: "fac-002", name: "New Facility", code: "NF", type: "emergency_care", address: "125 Cypress Lane", city: "Cypress", state: "TX", zipCode: "77429", licensedCapacity: 16, operationalCapacity: 8, totalRooms: 4, totalBeds: 16, status: "active", activationDate: "2026-08-01", notes: "Phase 1: 2 rooms upstairs (8 beds). Phase 2: 2 rooms downstairs (8 beds)." },
      { id: "fac-003", name: "Emergency Care GRO", code: "ECG", type: "emergency_care", address: "127 Cypress Lane", city: "Cypress", state: "TX", zipCode: "77429", licensedCapacity: 16, operationalCapacity: 0, totalRooms: 8, totalBeds: 16, status: "planned", notes: "Behind primary residence. 16 beds. Planned for Phase 3." },
      { id: "fac-004", name: "Purpose-Built Residence", code: "PBR", type: "purpose_built", address: "129 Cypress Lane", city: "Cypress", state: "TX", zipCode: "77429", licensedCapacity: 16, operationalCapacity: 0, totalRooms: 8, totalBeds: 16, status: "planned", notes: "Adjoins Emergency Care facility. 16 beds. Planned for Phase 4." },
    ]).onConflictDoNothing();

    // Seed phases
    await getDb().insert(facilityPhases).values([
      { id: "ph-001", facilityId: "fac-002", phaseName: "Phase 1: Upstairs", phaseNumber: 1, bedsActivated: 8, roomsActivated: 2, status: "active", activationDate: "2026-08-01", targetDate: "2026-08-01", notes: "2 rooms upstairs, 8 beds" },
      { id: "ph-002", facilityId: "fac-002", phaseName: "Phase 2: Downstairs", phaseNumber: 2, bedsActivated: 8, roomsActivated: 2, status: "pending", targetDate: "2026-12-01", notes: "2 rooms downstairs, 8 beds" },
      { id: "ph-003", facilityId: "fac-003", phaseName: "Phase 3: Emergency Care", phaseNumber: 3, bedsActivated: 16, roomsActivated: 8, status: "pending", targetDate: "2027-06-01", notes: "Emergency Care GRO facility, 16 beds" },
      { id: "ph-004", facilityId: "fac-004", phaseName: "Phase 4: Purpose-Built", phaseNumber: 4, bedsActivated: 16, roomsActivated: 8, status: "pending", targetDate: "2027-12-01", notes: "Purpose-Built Residence, 16 beds" },
    ]).onConflictDoNothing();

    // Seed Main Residence rooms (4 rooms, ground floor)
    await getDb().insert(rooms).values([
      { id: "rm-001", facilityId: "fac-001", roomNumber: "101", floor: "ground", roomType: "standard", maxBeds: 1, bedLayout: "single", hasPrivateBath: true, hasWindow: true, status: "active" },
      { id: "rm-002", facilityId: "fac-001", roomNumber: "102", floor: "ground", roomType: "quiet", maxBeds: 1, bedLayout: "single", hasPrivateBath: false, hasWindow: true, status: "active" },
      { id: "rm-003", facilityId: "fac-001", roomNumber: "103", floor: "ground", roomType: "ada_accessible", maxBeds: 1, bedLayout: "single", hasPrivateBath: true, hasWindow: true, status: "active" },
      { id: "rm-004", facilityId: "fac-001", roomNumber: "104", floor: "ground", roomType: "observation", maxBeds: 1, bedLayout: "single", hasPrivateBath: false, hasWindow: true, status: "active" },
    ]).onConflictDoNothing();

    // Seed New Facility Phase 1 rooms (2 rooms upstairs, 4 beds each)
    await getDb().insert(rooms).values([
      { id: "rm-201", facilityId: "fac-002", roomNumber: "201", floor: "first", roomType: "standard", maxBeds: 4, bedLayout: "bunk", hasPrivateBath: true, hasWindow: true, status: "active", phaseActivationId: "ph-001" },
      { id: "rm-202", facilityId: "fac-002", roomNumber: "202", floor: "first", roomType: "standard", maxBeds: 4, bedLayout: "bunk", hasPrivateBath: true, hasWindow: true, status: "active", phaseActivationId: "ph-001" },
      { id: "rm-203", facilityId: "fac-002", roomNumber: "203", floor: "ground", roomType: "standard", maxBeds: 4, bedLayout: "bunk", hasPrivateBath: true, hasWindow: true, status: "inactive", phaseActivationId: "ph-002" },
      { id: "rm-204", facilityId: "fac-002", roomNumber: "204", floor: "ground", roomType: "standard", maxBeds: 4, bedLayout: "bunk", hasPrivateBath: true, hasWindow: true, status: "inactive", phaseActivationId: "ph-002" },
    ]).onConflictDoNothing();

    // Seed Main Residence beds (4 beds)
    await getDb().insert(bedCensusV2).values([
      { id: "bed-001", facilityId: "fac-001", roomId: "rm-001", bedNumber: "1", bedLabel: "MR-101-1", isOccupied: true, youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001", assignedDate: "2026-06-15" },
      { id: "bed-002", facilityId: "fac-001", roomId: "rm-002", bedNumber: "1", bedLabel: "MR-102-1", isOccupied: true, youthId: "youth-002", youthName: "Aaliyah Williams", mrn: "MRN-2026-002", assignedDate: "2026-06-10" },
      { id: "bed-003", facilityId: "fac-001", roomId: "rm-003", bedNumber: "1", bedLabel: "MR-103-1", isOccupied: true, youthId: "youth-003", youthName: "Ethan Brown", mrn: "MRN-2026-003", assignedDate: "2026-06-20" },
      { id: "bed-004", facilityId: "fac-001", roomId: "rm-004", bedNumber: "1", bedLabel: "MR-104-1", isOccupied: false },
    ]).onConflictDoNothing();

    // Seed New Facility Phase 1 beds (8 beds, 2 rooms x 4)
    const nfBeds = [];
    let bedNum = 5;
    for (const room of [{ id: "rm-201", num: "201" }, { id: "rm-202", num: "202" }]) {
      for (let b = 1; b <= 4; b++) {
        const isOcc = bedNum <= 7;
        nfBeds.push({
          id: `bed-00${bedNum}`,
          facilityId: "fac-002",
          roomId: room.id,
          bedNumber: String(b),
          bedLabel: `NF-${room.num}-${b}`,
          isOccupied: isOcc,
          youthId: isOcc ? `youth-00${bedNum - 1}` : null,
          youthName: isOcc ? (bedNum === 5 ? "Sophia Davis" : bedNum === 6 ? "Liam Martinez" : bedNum === 7 ? "Isabella Garcia" : null) : null,
          mrn: isOcc ? `MRN-2026-00${bedNum - 1}` : null,
          assignedDate: isOcc ? "2026-06-25" : null,
        });
        bedNum++;
      }
    }
    await getDb().insert(bedCensusV2).values(nfBeds).onConflictDoNothing();

    // Seed campus stages (3 stages linked to facilities)
    await getDb().insert(campusStages).values([
      { id: "stage-001", stageNumber: 1, name: "Stage 1 — Assessment & Stabilization", description: "Intake, comprehensive assessment, CANS scoring, safety planning. Average LOS: 14-30 days.", facilityId: "fac-001", licensedCapacity: 6, operationalCapacity: 4, currentCensus: 3, capacityAlertThreshold: 85, capacityCriticalThreshold: 95, status: "active", activationDate: "2024-01-15", awakeStaffRatio: "1:6", overnightStaffRatio: "1:12", requiresLPHAAssessment: true, minAssessmentHours: 24 },
      { id: "stage-002", stageNumber: 2, name: "Stage 2 — Active Treatment", description: "Individual therapy, group sessions, skills training, family engagement. Average LOS: 60-90 days.", facilityId: "fac-001", licensedCapacity: 6, operationalCapacity: 4, currentCensus: 2, capacityAlertThreshold: 85, capacityCriticalThreshold: 95, status: "active", activationDate: "2024-01-15", awakeStaffRatio: "1:8", overnightStaffRatio: "1:16", requiresLPHAAssessment: false, minAssessmentHours: 0 },
      { id: "stage-003", stageNumber: 3, name: "Stage 3 — Transition & Discharge Planning", description: "Discharge readiness, aftercare coordination, family conferencing, community reintegration. Average LOS: 14-21 days.", facilityId: "fac-002", licensedCapacity: 8, operationalCapacity: 8, currentCensus: 0, capacityAlertThreshold: 90, capacityCriticalThreshold: 95, status: "planned", activationDate: "2026-10-01", awakeStaffRatio: "1:8", overnightStaffRatio: "1:16", requiresLPHAAssessment: false, minAssessmentHours: 0 },
    ]).onConflictDoNothing();

    // Seed progression criteria for Stage 1
    await getDb().insert(stageProgressionCriteria).values([
      { id: "crit-001", stageId: "stage-001", criterionNumber: 1, criterionName: "CANS Assessment Complete", description: "Full CANS assessment completed within 14 days of admission", requiredForProgression: true, assessmentTool: "CANS", targetScore: "All domains scored" },
      { id: "crit-002", stageId: "stage-001", criterionNumber: 2, criterionName: "Safety Plan Established", description: "Individualized safety plan developed, documented, and reviewed with youth and guardian", requiredForProgression: true, assessmentTool: "Clinical Judgment", targetScore: "Plan approved by LPHA" },
      { id: "crit-003", stageId: "stage-001", criterionNumber: 3, criterionName: "Risk Stabilization", description: "Suicide/self-harm risk reduced to low or manageable level per clinical assessment", requiredForProgression: true, assessmentTool: "CANS Risk Domain", targetScore: "Score <= 2" },
      { id: "crit-004", stageId: "stage-001", criterionNumber: 4, criterionName: "Guardian Engagement", description: "Guardian has participated in at least 1 family session or care planning meeting", requiredForProgression: true, assessmentTool: "Clinical Documentation", targetScore: "Documented contact" },
      { id: "crit-005", stageId: "stage-001", criterionNumber: 5, criterionName: "Treatment Plan Drafted", description: "Initial treatment plan with measurable goals drafted and reviewed by treatment team", requiredForProgression: true, assessmentTool: "Treatment Plan", targetScore: "Goals SMART-formatted" },
      { id: "crit-006", stageId: "stage-001", criterionNumber: 6, criterionName: "Medication Stabilization", description: "If on psychotropic medication, regimen stabilized with no PRN events in 72 hours", requiredForProgression: false, assessmentTool: "MAR Review", targetScore: "72-hour stability" },
    ]).onConflictDoNothing();

    // Seed progression criteria for Stage 2
    await getDb().insert(stageProgressionCriteria).values([
      { id: "crit-007", stageId: "stage-002", criterionNumber: 1, criterionName: "Therapy Engagement", description: "Youth actively participating in individual and group therapy sessions", requiredForProgression: true, assessmentTool: "Session Attendance", targetScore: ">= 80% attendance" },
      { id: "crit-008", stageId: "stage-002", criterionNumber: 2, criterionName: "Skills Acquisition", description: "Measurable progress on at least 2 treatment plan goals as documented in progress notes", requiredForProgression: true, assessmentTool: "Goal Attainment Scale", targetScore: "Score >= 3" },
      { id: "crit-009", stageId: "stage-002", criterionNumber: 3, criterionName: "Behavioral Stability", description: "No restrictive interventions in past 14 days; behavioral observations show consistent progress", requiredForProgression: true, assessmentTool: "Behavioral Tracking", targetScore: "14-day clean period" },
      { id: "crit-010", stageId: "stage-002", criterionNumber: 4, criterionName: "Family Engagement", description: "Family has participated in at least 2 family therapy sessions or care conferences", requiredForProgression: true, assessmentTool: "Family Contact Log", targetScore: "2+ documented contacts" },
      { id: "crit-011", stageId: "stage-002", criterionNumber: 5, criterionName: "Discharge Readiness Assessment", description: "LPHA has completed discharge readiness assessment with positive recommendation", requiredForProgression: true, assessmentTool: "LPHA Assessment", targetScore: "Ready for transition" },
    ]).onConflictDoNothing();

    // Seed progression criteria for Stage 3
    await getDb().insert(stageProgressionCriteria).values([
      { id: "crit-012", stageId: "stage-003", criterionNumber: 1, criterionName: "Aftercare Plan Finalized", description: "Comprehensive aftercare plan with outpatient appointments, school reintegration, and community supports", requiredForProgression: true, assessmentTool: "Aftercare Plan", targetScore: "All appointments scheduled" },
      { id: "crit-013", stageId: "stage-003", criterionNumber: 2, criterionName: "Guardian Capacity", description: "Guardian demonstrates ability to manage youth's needs post-discharge with safety plan understanding", requiredForProgression: true, assessmentTool: "Guardian Assessment", targetScore: "Competency verified" },
      { id: "crit-014", stageId: "stage-003", criterionNumber: 3, criterionName: "Community Linkages", description: "All community services (outpatient therapy, school, medical) confirmed active with first appointments within 7 days", requiredForProgression: true, assessmentTool: "Referral Tracking", targetScore: "Appointments within 7 days" },
      { id: "crit-015", stageId: "stage-003", criterionNumber: 4, criterionName: "Youth Self-Management", description: "Youth demonstrates coping skills, medication management understanding, and help-seeking behaviors", requiredForProgression: true, assessmentTool: "Youth Interview", targetScore: "Competency demonstrated" },
    ]).onConflictDoNothing();

    // Seed stage assignments for current residents
    await getDb().insert(stageAssignments).values([
      { id: "sa-001", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-001", toStageId: "stage-001", assignmentType: "initial", assignedBy: "Dr. Hall", assignedById: "user-001", assignmentRationale: "New admission — requires comprehensive assessment and stabilization", projectedDurationDays: 21, bedAssignment: "MR-101-1", completionOutcome: "ongoing" },
      { id: "sa-002", youthId: "youth-002", youthName: "Aaliyah Williams", mrn: "MRN-2026-002", toStageId: "stage-002", assignmentType: "progression", assignedBy: "Lilian Ike", assignedById: "user-002", assignmentRationale: "Completed Stage 1 criteria — CANS complete, safety plan established, risk stabilized", projectedDurationDays: 75, bedAssignment: "MR-102-1", completionOutcome: "ongoing" },
      { id: "sa-003", youthId: "youth-003", youthName: "Ethan Brown", mrn: "MRN-2026-003", toStageId: "stage-001", assignmentType: "initial", assignedBy: "Dr. Hall", assignedById: "user-001", assignmentRationale: "New admission — acute behavioral concerns, requires close monitoring", projectedDurationDays: 30, bedAssignment: "MR-103-1", completionOutcome: "ongoing" },
    ]).onConflictDoNothing();

    return { success: true, message: "48-bed facility + 3-stage campus model seeded" };
  }),

  // ══════════════════════════════════════════════════════════════
  // CAMPUS STAGES (T-002)
  // ══════════════════════════════════════════════════════════════

  // ─── Campus Stages CRUD ──────────────────────────────────

  listCampusStages: publicQuery
    .input(z.object({ facilityId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let query = getDb().select().from(campusStages).orderBy(campusStages.stageNumber);
      if (input?.facilityId) {
        query = query.where(eq(campusStages.facilityId, input.facilityId)) as typeof query;
      }
      if (input?.status) {
        query = query.where(eq(campusStages.status, input.status as any)) as typeof query;
      }
      return query;
    }),

  getCampusStage: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb().select().from(campusStages).where(eq(campusStages.id, input.id));
      return rows[0] ?? null;
    }),

  createCampusStage: publicQuery
    .input(z.object({
      id: z.string(),
      stageNumber: z.number().min(1).max(3),
      name: z.string(),
      description: z.string().optional(),
      facilityId: z.string(),
      licensedCapacity: z.number().default(16),
      operationalCapacity: z.number().default(16),
      capacityAlertThreshold: z.number().default(90),
      capacityCriticalThreshold: z.number().default(95),
      status: z.enum(["planned", "active", "paused", "closed"]).default("planned"),
      activationDate: z.string().optional(),
      awakeStaffRatio: z.string().default("1:8"),
      overnightStaffRatio: z.string().default("1:16"),
      requiresLPHAAssessment: z.boolean().default(false),
      minAssessmentHours: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      await getDb().insert(campusStages).values({ ...input, currentCensus: 0 });
      return { success: true };
    }),

  updateCampusStage: publicQuery
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      licensedCapacity: z.number().optional(),
      operationalCapacity: z.number().optional(),
      capacityAlertThreshold: z.number().optional(),
      capacityCriticalThreshold: z.number().optional(),
      status: z.enum(["planned", "active", "paused", "closed"]).optional(),
      currentCensus: z.number().optional(),
      awakeStaffRatio: z.string().optional(),
      overnightStaffRatio: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await getDb().update(campusStages).set(data).where(eq(campusStages.id, id));
      return { success: true };
    }),

  activateCampusStage: publicQuery
    .input(z.object({ id: z.string(), activatedBy: z.string() }))
    .mutation(async ({ input }) => {
      await getDb().update(campusStages).set({
        status: "active",
        activationDate: new Date().toISOString(),
      }).where(eq(campusStages.id, input.id));
      return { success: true };
    }),

  // ─── Stage Census ────────────────────────────────────────

  getStageCensus: publicQuery.query(async () => {
    const stages = await getDb().select().from(campusStages).orderBy(campusStages.stageNumber);
    const alerts = await getDb().select().from(censusAlerts)
      .where(
        and(
          sql`${censusAlerts.resolvedAt} IS NULL`,
          sql`${censusAlerts.autoResolved} = 0`
        )
      )
      .orderBy(desc(censusAlerts.triggeredAt));

    const stageData = stages.map((s) => {
      const pctFull = s.operationalCapacity > 0
        ? Math.round((s.currentCensus / s.operationalCapacity) * 100)
        : 0;
      const alertLevel = pctFull >= s.capacityCriticalThreshold
        ? "critical"
        : pctFull >= s.capacityAlertThreshold
          ? "warning"
          : "normal";
      return {
        ...s,
        percentFull: pctFull,
        alertLevel,
        vacantBeds: s.operationalCapacity - s.currentCensus,
        alerts: alerts.filter((a) => a.stageId === s.id),
      };
    });

    const totalCensus = stages.reduce((sum, s) => sum + s.currentCensus, 0);
    const totalCapacity = stages.reduce((sum, s) => sum + s.operationalCapacity, 0);

    return {
      stages: stageData,
      summary: {
        totalCensus,
        totalCapacity,
        totalVacant: totalCapacity - totalCensus,
        overallPercentFull: totalCapacity > 0 ? Math.round((totalCensus / totalCapacity) * 100) : 0,
        activeAlerts: alerts.filter((a) => !a.acknowledgedAt).length,
      },
    };
  }),

  recalculateStageCensus: publicQuery.mutation(async () => {
    // Recalculate census from stage assignments
    const stages = await getDb().select().from(campusStages);
    for (const stage of stages) {
      const activeAssignments = await getDb().select().from(stageAssignments)
        .where(and(
          eq(stageAssignments.toStageId, stage.id),
          eq(stageAssignments.completionOutcome as any, "ongoing" as any)
        ));
      const newCensus = activeAssignments.length;
      await getDb().update(campusStages).set({ currentCensus: newCensus }).where(eq(campusStages.id, stage.id));

      // Check alert thresholds
      const pctFull = stage.operationalCapacity > 0
        ? Math.round((newCensus / stage.operationalCapacity) * 100)
        : 0;

      if (pctFull >= stage.capacityCriticalThreshold) {
        await getDb().insert(censusAlerts).values({
          id: `alert-${Date.now()}-${stage.id}`,
          facilityId: stage.facilityId,
          stageId: stage.id,
          alertType: "capacity_critical",
          severity: "critical",
          message: `Stage ${stage.stageNumber} (${stage.name}) is at ${pctFull}% capacity (${newCensus}/${stage.operationalCapacity} beds). Critical threshold: ${stage.capacityCriticalThreshold}%`,
          currentCensus: newCensus,
          capacityLimit: stage.operationalCapacity,
          percentFull: pctFull,
        });
      } else if (pctFull >= stage.capacityAlertThreshold) {
        await getDb().insert(censusAlerts).values({
          id: `alert-${Date.now()}-${stage.id}`,
          facilityId: stage.facilityId,
          stageId: stage.id,
          alertType: "capacity_warning",
          severity: "high",
          message: `Stage ${stage.stageNumber} (${stage.name}) is at ${pctFull}% capacity (${newCensus}/${stage.operationalCapacity} beds). Alert threshold: ${stage.capacityAlertThreshold}%`,
          currentCensus: newCensus,
          capacityLimit: stage.operationalCapacity,
          percentFull: pctFull,
        });
      }
    }
    return { success: true };
  }),

  // ─── Stage Assignments ───────────────────────────────────

  listStageAssignments: publicQuery
    .input(z.object({
      stageId: z.string().optional(),
      youthId: z.string().optional(),
      status: z.enum(["ongoing", "progressed", "regressed", "discharged", "transferred"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      let query = getDb().select().from(stageAssignments).orderBy(desc(stageAssignments.createdAt));
      if (input?.stageId) {
        query = query.where(eq(stageAssignments.toStageId, input.stageId)) as typeof query;
      }
      if (input?.youthId) {
        query = query.where(eq(stageAssignments.youthId, input.youthId)) as typeof query;
      }
      if (input?.status) {
        query = query.where(eq(stageAssignments.completionOutcome as any, input.status as any)) as typeof query;
      }
      return query;
    }),

  assignToStage: publicQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      toStageId: z.string(),
      fromStageId: z.string().optional(),
      assignmentType: z.enum(["initial", "progression", "regression", "transfer", "discharge"]).default("initial"),
      assignedBy: z.string(),
      assignedById: z.string().optional(),
      assignmentRationale: z.string().optional(),
      projectedDurationDays: z.number().optional(),
      bedAssignment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = `sa-${Date.now()}`;
      await getDb().insert(stageAssignments).values({
        id,
        ...input,
        completionOutcome: "ongoing",
      });

      // Update stage census
      const stage = await getDb().select().from(campusStages).where(eq(campusStages.id, input.toStageId));
      if (stage[0]) {
        const newCensus = (stage[0].currentCensus ?? 0) + 1;
        await getDb().update(campusStages).set({ currentCensus: newCensus }).where(eq(campusStages.id, input.toStageId));
      }

      return { success: true, assignmentId: id };
    }),

  completeStageAssignment: publicQuery
    .input(z.object({
      assignmentId: z.string(),
      completionOutcome: z.enum(["progressed", "regressed", "discharged", "transferred"]),
      completedDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      await getDb().update(stageAssignments).set({
        completionOutcome: input.completionOutcome,
        completedDate: input.completedDate,
      }).where(eq(stageAssignments.id, input.assignmentId));

      // Decrement stage census
      const assignment = await getDb().select().from(stageAssignments).where(eq(stageAssignments.id, input.assignmentId));
      if (assignment[0]) {
        const stage = await getDb().select().from(campusStages).where(eq(campusStages.id, assignment[0].toStageId));
        if (stage[0]) {
          const newCensus = Math.max(0, (stage[0].currentCensus ?? 0) - 1);
          await getDb().update(campusStages).set({ currentCensus: newCensus }).where(eq(campusStages.id, assignment[0].toStageId));
        }
      }

      return { success: true };
    }),

  // ─── Progression Criteria ────────────────────────────────

  listProgressionCriteria: publicQuery
    .input(z.object({ stageId: z.string() }))
    .query(async ({ input }) => {
      return getDb().select().from(stageProgressionCriteria)
        .where(eq(stageProgressionCriteria.stageId, input.stageId))
        .orderBy(stageProgressionCriteria.criterionNumber);
    }),

  // ─── Census Alerts ───────────────────────────────────────

  listCensusAlerts: publicQuery
    .input(z.object({
      facilityId: z.string().optional(),
      stageId: z.string().optional(),
      severity: z.string().optional(),
      acknowledged: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      let query = getDb().select().from(censusAlerts).orderBy(desc(censusAlerts.triggeredAt));
      if (input?.facilityId) {
        query = query.where(eq(censusAlerts.facilityId, input.facilityId)) as typeof query;
      }
      if (input?.stageId) {
        query = query.where(eq(censusAlerts.stageId, input.stageId)) as typeof query;
      }
      if (input?.severity) {
        query = query.where(eq(censusAlerts.severity, input.severity as any)) as typeof query;
      }
      return query;
    }),

  acknowledgeAlert: publicQuery
    .input(z.object({
      alertId: z.string(),
      acknowledgedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      await getDb().update(censusAlerts).set({
        acknowledgedBy: input.acknowledgedBy,
        acknowledgedAt: new Date().toISOString(),
      }).where(eq(censusAlerts.id, input.alertId));
      return { success: true };
    }),

  // ─── Census Snapshots ────────────────────────────────────

  createCensusSnapshot: publicQuery
    .input(z.object({
      facilityId: z.string(),
      snapshotDate: z.string(),
      snapshotTime: z.string().default("23:59:59"),
      stage1Census: z.number().default(0),
      stage2Census: z.number().default(0),
      stage3Census: z.number().default(0),
      totalCensus: z.number().default(0),
      stage1Capacity: z.number().default(16),
      stage2Capacity: z.number().default(16),
      stage3Capacity: z.number().default(16),
      totalCapacity: z.number().default(48),
      alertsTriggered: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const s1pct = input.stage1Capacity > 0 ? Math.round((input.stage1Census / input.stage1Capacity) * 100) : 0;
      const s2pct = input.stage2Capacity > 0 ? Math.round((input.stage2Census / input.stage2Capacity) * 100) : 0;
      const s3pct = input.stage3Capacity > 0 ? Math.round((input.stage3Census / input.stage3Capacity) * 100) : 0;
      const overall = input.totalCapacity > 0 ? Math.round((input.totalCensus / input.totalCapacity) * 100) : 0;

      await getDb().insert(censusSnapshots).values({
        ...input,
        id: `snap-${Date.now()}`,
        stage1Percent: s1pct,
        stage2Percent: s2pct,
        stage3Percent: s3pct,
        overallPercent: overall,
      });
      return { success: true };
    }),

  listCensusSnapshots: publicQuery
    .input(z.object({ facilityId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.facilityId) {
        return getDb().select().from(censusSnapshots)
          .where(eq(censusSnapshots.facilityId, input.facilityId))
          .orderBy(desc(censusSnapshots.snapshotDate));
      }
      return getDb().select().from(censusSnapshots).orderBy(desc(censusSnapshots.snapshotDate));
    }),
});
