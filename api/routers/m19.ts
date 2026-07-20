import { z } from "zod";
import {
  createRouter,
  publicQuery,
  authedQuery,
  auditLog,
} from "../middleware";
import { getDb, sqlite } from "../queries/connection";
import {
  facilities,
  rooms,
  facilityPhases,
  bedCensusV2,
  campusStages,
  stageAssignments,
  campusReadinessCriteria,
  censusAlerts,
  censusSnapshots,
} from "@db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

// ─── M19: 48-Bed Facility Architecture Router ────────────────

interface MedicationAdministrationRow {
  id: string;
  youth_id: string;
  youth_name: string;
  mrn: string;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  route: string;
  frequency: string;
  indication: string | null;
  prescribing_provider: string | null;
  prescription_date: string | null;
  scheduled_time: string;
  admin_date: string;
  admin_time: string | null;
  administered_by: string | null;
  witnessed_by: string | null;
  status:
    | "scheduled"
    | "administered"
    | "refused"
    | "held"
    | "missed"
    | "not_available";
  refusal_reason: string | null;
  hold_reason: string | null;
  is_prn: number;
  prn_reason: string | null;
  prn_effectiveness: string | null;
  is_controlled: number;
  controlled_count_before: number | null;
  controlled_count_after: number | null;
  waste_witnessed_by: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function getMedicationAdministration(id: string): MedicationAdministrationRow {
  const medication = sqlite
    .prepare("SELECT * FROM medication_administrations WHERE id = ?")
    .get(id) as MedicationAdministrationRow | undefined;

  if (!medication) {
    throw new Error("Medication administration record not found");
  }
  return medication;
}

export const m19Router = createRouter({
  // ─── Medication Administration Record compatibility ─────
  // These procedures expose the persisted M16 MAR records through the
  // namespace retained by the current residential client.
  listMedications: authedQuery.query(
    async () =>
      sqlite
        .prepare(
          "SELECT * FROM medication_administrations ORDER BY admin_date DESC, scheduled_time ASC, youth_name ASC",
        )
        .all() as MedicationAdministrationRow[],
  ),

  medSummary: authedQuery.query(async () => {
    const medications = sqlite
      .prepare("SELECT status, is_prn FROM medication_administrations")
      .all() as Array<Pick<MedicationAdministrationRow, "status" | "is_prn">>;

    return {
      scheduled: medications.filter((item) => item.status === "scheduled")
        .length,
      administered: medications.filter((item) => item.status === "administered")
        .length,
      refused: medications.filter((item) => item.status === "refused").length,
      missed: medications.filter((item) => item.status === "missed").length,
      prnGiven: medications.filter(
        (item) => item.is_prn === 1 && item.status === "administered",
      ).length,
    };
  }),

  administer: authedQuery
    .input(
      z.object({
        medicationId: z.string().min(1),
        adminTime: z.string().trim().min(1).max(20),
        notes: z.string().trim().max(4000).optional(),
        witnessedBy: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user.email;
      const medication = getMedicationAdministration(input.medicationId);
      if (medication.status !== "scheduled") {
        throw new Error(
          `Medication cannot be administered from status ${medication.status}`,
        );
      }

      sqlite
        .prepare(
          "UPDATE medication_administrations SET status = 'administered', administered_by = ?, admin_time = ?, witnessed_by = ?, notes = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'",
        )
        .run(
          actor,
          input.adminTime,
          input.witnessedBy ?? null,
          input.notes ?? null,
          new Date().toISOString(),
          input.medicationId,
        );

      auditLog({
        action: "m19:administerMedication",
        actor,
        resource: `medication-administration:${input.medicationId}`,
        details: "Administration recorded by authenticated team member",
      });
      return {
        success: true,
        medication: getMedicationAdministration(input.medicationId),
      };
    }),

  recordRefusal: authedQuery
    .input(
      z.object({
        medicationId: z.string().min(1),
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user.email;
      const medication = getMedicationAdministration(input.medicationId);
      if (medication.status !== "scheduled") {
        throw new Error(
          `Medication refusal cannot be recorded from status ${medication.status}`,
        );
      }

      sqlite
        .prepare(
          "UPDATE medication_administrations SET status = 'refused', refusal_reason = ?, administered_by = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'",
        )
        .run(input.reason, actor, new Date().toISOString(), input.medicationId);

      auditLog({
        action: "m19:recordMedicationRefusal",
        actor,
        resource: `medication-administration:${input.medicationId}`,
        details: "Medication refusal recorded by authenticated team member",
      });
      return {
        success: true,
        medication: getMedicationAdministration(input.medicationId),
      };
    }),

  holdMedication: authedQuery
    .input(
      z.object({
        medicationId: z.string().min(1),
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user.email;
      const medication = getMedicationAdministration(input.medicationId);
      if (medication.status !== "scheduled") {
        throw new Error(
          `Medication cannot be held from status ${medication.status}`,
        );
      }

      sqlite
        .prepare(
          "UPDATE medication_administrations SET status = 'held', hold_reason = ?, administered_by = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'",
        )
        .run(input.reason, actor, new Date().toISOString(), input.medicationId);

      auditLog({
        action: "m19:holdMedication",
        actor,
        resource: `medication-administration:${input.medicationId}`,
        details: "Medication hold recorded by authenticated team member",
      });
      return {
        success: true,
        medication: getMedicationAdministration(input.medicationId),
      };
    }),

  // ─── Facilities ──────────────────────────────────────────
  listFacilities: publicQuery.query(async () => {
    return getDb().select().from(facilities).orderBy(facilities.name);
  }),

  getFacility: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(facilities)
        .where(eq(facilities.id, input.id));
      return rows[0] ?? null;
    }),

  createFacility: publicQuery
    .input(
      z.object({
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
        status: z
          .enum(["active", "inactive", "planned", "under_construction"])
          .default("active"),
        activationDate: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb().insert(facilities).values(input);
      return { success: true };
    }),

  updateFacility: publicQuery
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        licensedCapacity: z.number().optional(),
        operationalCapacity: z.number().optional(),
        status: z
          .enum(["active", "inactive", "planned", "under_construction"])
          .optional(),
        notes: z.string().optional(),
      }),
    )
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
        return getDb()
          .select()
          .from(rooms)
          .where(eq(rooms.facilityId, input.facilityId))
          .orderBy(rooms.floor, rooms.roomNumber);
      }
      return getDb()
        .select()
        .from(rooms)
        .orderBy(rooms.facilityId, rooms.floor, rooms.roomNumber);
    }),

  getRoom: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(rooms)
        .where(eq(rooms.id, input.id));
      return rows[0] ?? null;
    }),

  createRoom: publicQuery
    .input(
      z.object({
        id: z.string(),
        facilityId: z.string(),
        roomNumber: z.string(),
        floor: z
          .enum(["ground", "first", "second", "third", "basement"])
          .default("ground"),
        roomType: z
          .enum([
            "standard",
            "observation",
            "quiet",
            "ada_accessible",
            "isolation",
          ])
          .default("standard"),
        maxBeds: z.number().default(2),
        bedLayout: z.enum(["single", "double", "bunk"]).default("double"),
        hasPrivateBath: z.boolean().default(false),
        hasWindow: z.boolean().default(true),
        status: z
          .enum(["active", "inactive", "maintenance", "reserved"])
          .default("active"),
        phaseActivationId: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb().insert(rooms).values(input);
      return { success: true };
    }),

  updateRoomStatus: publicQuery
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["active", "inactive", "maintenance", "reserved"]),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(rooms)
        .set({ status: input.status })
        .where(eq(rooms.id, input.id));
      return { success: true };
    }),

  // ─── Facility Phases ─────────────────────────────────────
  listPhases: publicQuery
    .input(z.object({ facilityId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.facilityId) {
        return getDb()
          .select()
          .from(facilityPhases)
          .where(eq(facilityPhases.facilityId, input.facilityId))
          .orderBy(facilityPhases.phaseNumber);
      }
      return getDb()
        .select()
        .from(facilityPhases)
        .orderBy(facilityPhases.facilityId, facilityPhases.phaseNumber);
    }),

  createPhase: publicQuery
    .input(
      z.object({
        id: z.string(),
        facilityId: z.string(),
        phaseName: z.string(),
        phaseNumber: z.number(),
        bedsActivated: z.number().default(0),
        roomsActivated: z.number().default(0),
        activationDate: z.string().optional(),
        targetDate: z.string().optional(),
        status: z
          .enum(["pending", "active", "completed", "deferred"])
          .default("pending"),
        approvedBy: z.string().optional(),
        approvalDate: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb().insert(facilityPhases).values(input);
      return { success: true };
    }),

  activatePhase: publicQuery
    .input(
      z.object({
        id: z.string(),
        approvedBy: z.string(),
        activationDate: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(facilityPhases)
        .set({
          status: "active",
          approvedBy: input.approvedBy,
          approvalDate: input.activationDate,
          activationDate: input.activationDate,
        })
        .where(eq(facilityPhases.id, input.id));
      return { success: true };
    }),

  // ─── Bed Census v2 ───────────────────────────────────────
  listBeds: publicQuery
    .input(
      z
        .object({
          facilityId: z.string().optional(),
          roomId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      if (input?.facilityId && input?.roomId) {
        return getDb()
          .select()
          .from(bedCensusV2)
          .where(
            and(
              eq(bedCensusV2.facilityId, input.facilityId),
              eq(bedCensusV2.roomId, input.roomId),
            ),
          )
          .orderBy(bedCensusV2.bedLabel);
      }
      if (input?.facilityId) {
        return getDb()
          .select()
          .from(bedCensusV2)
          .where(eq(bedCensusV2.facilityId, input.facilityId))
          .orderBy(bedCensusV2.bedLabel);
      }
      return getDb().select().from(bedCensusV2).orderBy(bedCensusV2.bedLabel);
    }),

  assignBed: publicQuery
    .input(
      z.object({
        bedId: z.string(),
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        assignedDate: z.string(),
        expectedDischargeDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(bedCensusV2)
        .set({
          isOccupied: true,
          youthId: input.youthId,
          youthName: input.youthName,
          mrn: input.mrn,
          assignedDate: input.assignedDate,
          expectedDischargeDate: input.expectedDischargeDate,
        })
        .where(eq(bedCensusV2.id, input.bedId));
      return { success: true };
    }),

  vacateBed: publicQuery
    .input(z.object({ bedId: z.string() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(bedCensusV2)
        .set({
          isOccupied: false,
          youthId: null,
          youthName: null,
          mrn: null,
          assignedDate: null,
          expectedDischargeDate: null,
        })
        .where(eq(bedCensusV2.id, input.bedId));
      return { success: true };
    }),

  // ─── Campus Summary ──────────────────────────────────────
  getCampusSummary: publicQuery.query(async () => {
    const allBeds = await getDb().select().from(bedCensusV2);
    const allFacilities = await getDb().select().from(facilities);
    const occupied = allBeds.filter((b) => b.isOccupied).length;
    const total = allBeds.length;
    const byFacility = allFacilities.map((f) => {
      const facilityBeds = allBeds.filter((b) => b.facilityId === f.id);
      const facilityOccupied = facilityBeds.filter((b) => b.isOccupied).length;
      return {
        facilityId: f.id,
        facilityName: f.name,
        facilityCode: f.code,
        licensedCapacity: f.licensedCapacity,
        operationalCapacity: f.operationalCapacity,
        totalBeds: facilityBeds.length,
        occupiedBeds: facilityOccupied,
        vacantBeds: facilityBeds.length - facilityOccupied,
        occupancyRate:
          facilityBeds.length > 0
            ? Math.round((facilityOccupied / facilityBeds.length) * 100)
            : 0,
      };
    });
    return {
      campusTotalBeds: total,
      campusOccupiedBeds: occupied,
      campusVacantBeds: total - occupied,
      campusOccupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      licensedCapacityTotal: allFacilities.reduce(
        (sum, f) => sum + f.licensedCapacity,
        0,
      ),
      operationalCapacityTotal: allFacilities.reduce(
        (sum, f) => sum + f.operationalCapacity,
        0,
      ),
      byFacility,
    };
  }),

  // ─── Seed Demo Data ──────────────────────────────────────
  seedFacilityData: publicQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    // Seed facilities
    await getDb()
      .insert(facilities)
      .values([
        {
          id: "fac-001",
          name: "Main Residence",
          code: "MR",
          type: "main_residence",
          address: "123 Cypress Lane",
          city: "Cypress",
          state: "TX",
          zipCode: "77429",
          licensedCapacity: 10,
          operationalCapacity: 4,
          totalRooms: 4,
          totalBeds: 4,
          status: "active",
          activationDate: "2024-01-15",
          notes: "Primary residence. 4 rooms, 4 beds. Licensed capacity 10.",
        },
        {
          id: "fac-002",
          name: "New Facility",
          code: "NF",
          type: "emergency_care",
          address: "125 Cypress Lane",
          city: "Cypress",
          state: "TX",
          zipCode: "77429",
          licensedCapacity: 16,
          operationalCapacity: 8,
          totalRooms: 4,
          totalBeds: 16,
          status: "active",
          activationDate: "2026-08-01",
          notes:
            "Phase 1: 2 rooms upstairs (8 beds). Phase 2: 2 rooms downstairs (8 beds).",
        },
        {
          id: "fac-003",
          name: "Emergency Care GRO",
          code: "ECG",
          type: "emergency_care",
          address: "127 Cypress Lane",
          city: "Cypress",
          state: "TX",
          zipCode: "77429",
          licensedCapacity: 16,
          operationalCapacity: 0,
          totalRooms: 8,
          totalBeds: 16,
          status: "planned",
          notes: "Behind primary residence. 16 beds. Planned for Phase 3.",
        },
        {
          id: "fac-004",
          name: "Purpose-Built Residence",
          code: "PBR",
          type: "purpose_built",
          address: "129 Cypress Lane",
          city: "Cypress",
          state: "TX",
          zipCode: "77429",
          licensedCapacity: 16,
          operationalCapacity: 0,
          totalRooms: 8,
          totalBeds: 16,
          status: "planned",
          notes:
            "Adjoins Emergency Care facility. 16 beds. Planned for Phase 4.",
        },
      ])
      .onConflictDoNothing();

    // Seed phases
    await getDb()
      .insert(facilityPhases)
      .values([
        {
          id: "ph-001",
          facilityId: "fac-002",
          phaseName: "Phase 1: Upstairs",
          phaseNumber: 1,
          bedsActivated: 8,
          roomsActivated: 2,
          status: "active",
          activationDate: "2026-08-01",
          targetDate: "2026-08-01",
          notes: "2 rooms upstairs, 8 beds",
        },
        {
          id: "ph-002",
          facilityId: "fac-002",
          phaseName: "Phase 2: Downstairs",
          phaseNumber: 2,
          bedsActivated: 8,
          roomsActivated: 2,
          status: "pending",
          targetDate: "2026-12-01",
          notes: "2 rooms downstairs, 8 beds",
        },
        {
          id: "ph-003",
          facilityId: "fac-003",
          phaseName: "Phase 3: Emergency Care",
          phaseNumber: 3,
          bedsActivated: 16,
          roomsActivated: 8,
          status: "pending",
          targetDate: "2027-06-01",
          notes: "Emergency Care GRO facility, 16 beds",
        },
        {
          id: "ph-004",
          facilityId: "fac-004",
          phaseName: "Phase 4: Purpose-Built",
          phaseNumber: 4,
          bedsActivated: 16,
          roomsActivated: 8,
          status: "pending",
          targetDate: "2027-12-01",
          notes: "Purpose-Built Residence, 16 beds",
        },
      ])
      .onConflictDoNothing();

    // Seed Main Residence rooms (4 rooms, ground floor)
    await getDb()
      .insert(rooms)
      .values([
        {
          id: "rm-001",
          facilityId: "fac-001",
          roomNumber: "101",
          floor: "ground",
          roomType: "standard",
          maxBeds: 1,
          bedLayout: "single",
          hasPrivateBath: true,
          hasWindow: true,
          status: "active",
        },
        {
          id: "rm-002",
          facilityId: "fac-001",
          roomNumber: "102",
          floor: "ground",
          roomType: "quiet",
          maxBeds: 1,
          bedLayout: "single",
          hasPrivateBath: false,
          hasWindow: true,
          status: "active",
        },
        {
          id: "rm-003",
          facilityId: "fac-001",
          roomNumber: "103",
          floor: "ground",
          roomType: "ada_accessible",
          maxBeds: 1,
          bedLayout: "single",
          hasPrivateBath: true,
          hasWindow: true,
          status: "active",
        },
        {
          id: "rm-004",
          facilityId: "fac-001",
          roomNumber: "104",
          floor: "ground",
          roomType: "observation",
          maxBeds: 1,
          bedLayout: "single",
          hasPrivateBath: false,
          hasWindow: true,
          status: "active",
        },
      ])
      .onConflictDoNothing();

    // Seed New Facility Phase 1 rooms (2 rooms upstairs, 4 beds each)
    await getDb()
      .insert(rooms)
      .values([
        {
          id: "rm-201",
          facilityId: "fac-002",
          roomNumber: "201",
          floor: "first",
          roomType: "standard",
          maxBeds: 4,
          bedLayout: "bunk",
          hasPrivateBath: true,
          hasWindow: true,
          status: "active",
          phaseActivationId: "ph-001",
        },
        {
          id: "rm-202",
          facilityId: "fac-002",
          roomNumber: "202",
          floor: "first",
          roomType: "standard",
          maxBeds: 4,
          bedLayout: "bunk",
          hasPrivateBath: true,
          hasWindow: true,
          status: "active",
          phaseActivationId: "ph-001",
        },
        {
          id: "rm-203",
          facilityId: "fac-002",
          roomNumber: "203",
          floor: "ground",
          roomType: "standard",
          maxBeds: 4,
          bedLayout: "bunk",
          hasPrivateBath: true,
          hasWindow: true,
          status: "inactive",
          phaseActivationId: "ph-002",
        },
        {
          id: "rm-204",
          facilityId: "fac-002",
          roomNumber: "204",
          floor: "ground",
          roomType: "standard",
          maxBeds: 4,
          bedLayout: "bunk",
          hasPrivateBath: true,
          hasWindow: true,
          status: "inactive",
          phaseActivationId: "ph-002",
        },
      ])
      .onConflictDoNothing();

    // Seed Main Residence beds (4 beds)
    await getDb()
      .insert(bedCensusV2)
      .values([
        {
          id: "bed-001",
          facilityId: "fac-001",
          roomId: "rm-001",
          bedNumber: "1",
          bedLabel: "MR-101-1",
          isOccupied: true,
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-001",
          assignedDate: "2026-06-15",
        },
        {
          id: "bed-002",
          facilityId: "fac-001",
          roomId: "rm-002",
          bedNumber: "1",
          bedLabel: "MR-102-1",
          isOccupied: true,
          youthId: "youth-002",
          youthName: "Synthetic Youth 005",
          mrn: "SYNTH-REC-002",
          assignedDate: "2026-06-10",
        },
        {
          id: "bed-003",
          facilityId: "fac-001",
          roomId: "rm-003",
          bedNumber: "1",
          bedLabel: "MR-103-1",
          isOccupied: true,
          youthId: "youth-003",
          youthName: "Synthetic Youth 014",
          mrn: "SYNTH-REC-003",
          assignedDate: "2026-06-20",
        },
        {
          id: "bed-004",
          facilityId: "fac-001",
          roomId: "rm-004",
          bedNumber: "1",
          bedLabel: "MR-104-1",
          isOccupied: false,
        },
      ])
      .onConflictDoNothing();

    // Seed New Facility Phase 1 beds (8 beds, 2 rooms x 4)
    const nfBeds = [];
    let bedNum = 5;
    for (const room of [
      { id: "rm-201", num: "201" },
      { id: "rm-202", num: "202" },
    ]) {
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
          youthName: isOcc
            ? bedNum === 5
              ? "Synthetic Youth 017"
              : bedNum === 6
                ? "Synthetic Youth 040"
                : bedNum === 7
                  ? "Synthetic Youth 041"
                  : null
            : null,
          mrn: isOcc ? `SYNTH-REC-00${bedNum - 1}` : null,
          assignedDate: isOcc ? "2026-06-25" : null,
        });
        bedNum++;
      }
    }
    await getDb().insert(bedCensusV2).values(nfBeds).onConflictDoNothing();

    // Seed the canonical CTR-023 campus development pathway. Readiness values
    // are fictional demonstration references, not claims about live facilities.
    const controlledCampusStages = [
      {
        id: "campus-stage-1",
        stageNumber: 1,
        name: "Stage 1 — Main Residential Unit",
        description:
          "Fictional demonstration reference: GRO main facility; 16 controlled beds (2×4 upstairs, 2×4 downstairs).",
        facilityId: "fac-001",
        licensedCapacity: 16,
        operationalCapacity: 16,
        currentCensus: 6,
        capacityAlertThreshold: 90,
        capacityCriticalThreshold: 95,
        status: "operational" as const,
        activationDate: "2024-01-15",
        awakeStaffRatio: "1:8",
        overnightStaffRatio: "1:16",
        requiresLPHAAssessment: false,
        minAssessmentHours: 0,
      },
      {
        id: "campus-stage-2",
        stageNumber: 2,
        name: "Stage 2 — Emergency Care Services",
        description:
          "Fictional demonstration reference: Emergency Care Services crisis stabilization Profit Center; controlled capacity 16 beds.",
        facilityId: "fac-003",
        licensedCapacity: 16,
        operationalCapacity: 0,
        currentCensus: 0,
        capacityAlertThreshold: 90,
        capacityCriticalThreshold: 95,
        status: "licensing_in_progress" as const,
        activationDate: null,
        awakeStaffRatio: "1:8",
        overnightStaffRatio: "1:16",
        requiresLPHAAssessment: false,
        minAssessmentHours: 0,
      },
      {
        id: "campus-stage-3",
        stageNumber: 3,
        name: "Stage 3 — Cypress Campus",
        description:
          "Fictional demonstration reference: 16 residential beds plus BHC, GAD, Executive Office, and Education on 1.7 acres.",
        facilityId: "fac-004",
        licensedCapacity: 16,
        operationalCapacity: 0,
        currentCensus: 0,
        capacityAlertThreshold: 90,
        capacityCriticalThreshold: 95,
        status: "capital_planning" as const,
        activationDate: null,
        awakeStaffRatio: "1:8",
        overnightStaffRatio: "1:16",
        requiresLPHAAssessment: false,
        minAssessmentHours: 0,
      },
    ];
    for (const stage of controlledCampusStages) {
      await getDb().insert(campusStages).values(stage).onConflictDoUpdate({
        target: campusStages.id,
        set: stage,
      });
    }

    await getDb()
      .insert(campusReadinessCriteria)
      .values([
        {
          id: "ready-001",
          stageId: "campus-stage-1",
          criterionNumber: 1,
          criterionName: "Operational capacity control",
          description:
            "Prototype registry records the controlled 16-bed Main Residential Unit capacity and operational readiness reference.",
          requiredForReadiness: true,
          evidenceSource: "CTR-023 / Campus readiness register",
          targetState: "Operational",
        },
        {
          id: "ready-002",
          stageId: "campus-stage-2",
          criterionNumber: 1,
          criterionName: "Licensing readiness",
          description:
            "Prototype registry records Emergency Care Services as licensing in progress; no operational capacity is exposed.",
          requiredForReadiness: true,
          evidenceSource: "CTR-023 / Licensing readiness register",
          targetState: "License approved before activation",
        },
        {
          id: "ready-003",
          stageId: "campus-stage-3",
          criterionNumber: 1,
          criterionName: "Capital readiness",
          description:
            "Prototype registry records Cypress Campus as capital planning; no operational capacity is exposed.",
          requiredForReadiness: true,
          evidenceSource: "CTR-023 / Capital planning register",
          targetState: "Capital and site readiness accepted",
        },
      ])
      .onConflictDoNothing();

    return {
      success: true,
      message: "Fictional 48-bed three-stage campus development pathway seeded",
    };
  }),

  // ══════════════════════════════════════════════════════════════
  // CAMPUS DEVELOPMENT STAGES (CTR-023)
  // ══════════════════════════════════════════════════════════════

  // ─── Campus Stages CRUD ──────────────────────────────────

  listCampusStages: publicQuery
    .input(
      z
        .object({
          facilityId: z.string().optional(),
          status: z
            .enum([
              "operational",
              "licensing_in_progress",
              "capital_planning",
              "paused",
              "closed",
            ])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let query = getDb()
        .select()
        .from(campusStages)
        .orderBy(campusStages.stageNumber);
      if (input?.facilityId) {
        query = query.where(
          eq(campusStages.facilityId, input.facilityId),
        ) as typeof query;
      }
      if (input?.status) {
        query = query.where(
          eq(campusStages.status, input.status),
        ) as typeof query;
      }
      return query;
    }),

  getCampusStage: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(campusStages)
        .where(eq(campusStages.id, input.id));
      return rows[0] ?? null;
    }),

  createCampusStage: publicQuery
    .input(
      z.object({
        id: z.string(),
        stageNumber: z.number().min(1).max(3),
        name: z.string(),
        description: z.string().optional(),
        facilityId: z.string(),
        licensedCapacity: z.number().default(16),
        operationalCapacity: z.number().default(16),
        capacityAlertThreshold: z.number().default(90),
        capacityCriticalThreshold: z.number().default(95),
        status: z
          .enum([
            "operational",
            "licensing_in_progress",
            "capital_planning",
            "paused",
            "closed",
          ])
          .default("capital_planning"),
        activationDate: z.string().optional(),
        awakeStaffRatio: z.string().default("1:8"),
        overnightStaffRatio: z.string().default("1:16"),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .insert(campusStages)
        .values({ ...input, currentCensus: 0 });
      return { success: true };
    }),

  updateCampusStage: publicQuery
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        licensedCapacity: z.number().optional(),
        operationalCapacity: z.number().optional(),
        capacityAlertThreshold: z.number().optional(),
        capacityCriticalThreshold: z.number().optional(),
        status: z
          .enum([
            "operational",
            "licensing_in_progress",
            "capital_planning",
            "paused",
            "closed",
          ])
          .optional(),
        currentCensus: z.number().optional(),
        awakeStaffRatio: z.string().optional(),
        overnightStaffRatio: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await getDb()
        .update(campusStages)
        .set(data)
        .where(eq(campusStages.id, id));
      return { success: true };
    }),

  activateCampusStage: publicQuery
    .input(z.object({ id: z.string(), activatedBy: z.string() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(campusStages)
        .set({
          status: "operational",
          activationDate: new Date().toISOString(),
        })
        .where(eq(campusStages.id, input.id));
      return { success: true };
    }),

  // ─── Stage Census ────────────────────────────────────────

  getStageCensus: publicQuery.query(async () => {
    const stages = await getDb()
      .select()
      .from(campusStages)
      .orderBy(campusStages.stageNumber);
    const alerts = await getDb()
      .select()
      .from(censusAlerts)
      .where(
        and(
          sql`${censusAlerts.resolvedAt} IS NULL`,
          sql`${censusAlerts.autoResolved} = 0`,
        ),
      )
      .orderBy(desc(censusAlerts.triggeredAt));

    const stageData = stages.map((s) => {
      const pctFull =
        s.operationalCapacity > 0
          ? Math.round((s.currentCensus / s.operationalCapacity) * 100)
          : 0;
      const alertLevel =
        pctFull >= s.capacityCriticalThreshold
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
    const totalCapacity = stages.reduce(
      (sum, s) => sum + s.operationalCapacity,
      0,
    );

    return {
      stages: stageData,
      summary: {
        totalCensus,
        totalCapacity,
        totalVacant: totalCapacity - totalCensus,
        overallPercentFull:
          totalCapacity > 0
            ? Math.round((totalCensus / totalCapacity) * 100)
            : 0,
        activeAlerts: alerts.filter((a) => !a.acknowledgedAt).length,
      },
    };
  }),

  recalculateStageCensus: publicQuery.mutation(async () => {
    // Recalculate census from stage assignments
    const stages = await getDb().select().from(campusStages);
    for (const stage of stages) {
      const activeAssignments = await getDb()
        .select()
        .from(stageAssignments)
        .where(
          and(
            eq(stageAssignments.toStageId, stage.id),
            eq(stageAssignments.completionOutcome, "ongoing"),
          ),
        );
      const newCensus = activeAssignments.length;
      await getDb()
        .update(campusStages)
        .set({ currentCensus: newCensus })
        .where(eq(campusStages.id, stage.id));

      // Check alert thresholds
      const pctFull =
        stage.operationalCapacity > 0
          ? Math.round((newCensus / stage.operationalCapacity) * 100)
          : 0;

      if (pctFull >= stage.capacityCriticalThreshold) {
        await getDb()
          .insert(censusAlerts)
          .values({
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
        await getDb()
          .insert(censusAlerts)
          .values({
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

  // ─── Campus Placements ───────────────────────────────────

  listCampusPlacements: publicQuery
    .input(
      z
        .object({
          stageId: z.string().optional(),
          youthId: z.string().optional(),
          status: z
            .enum(["ongoing", "completed", "discharged", "transferred"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let query = getDb()
        .select()
        .from(stageAssignments)
        .orderBy(desc(stageAssignments.createdAt));
      if (input?.stageId) {
        query = query.where(
          eq(stageAssignments.toStageId, input.stageId),
        ) as typeof query;
      }
      if (input?.youthId) {
        query = query.where(
          eq(stageAssignments.youthId, input.youthId),
        ) as typeof query;
      }
      if (input?.status) {
        query = query.where(
          eq(stageAssignments.completionOutcome, input.status),
        ) as typeof query;
      }
      return query;
    }),

  assignCampusPlacement: publicQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        toStageId: z.string(),
        fromStageId: z.string().optional(),
        assignmentType: z
          .enum(["placement", "transfer", "discharge"])
          .default("placement"),
        assignedBy: z.string(),
        assignedById: z.string().optional(),
        assignmentRationale: z.string().optional(),
        projectedDurationDays: z.number().optional(),
        bedAssignment: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = `sa-${Date.now()}`;
      await getDb()
        .insert(stageAssignments)
        .values({
          id,
          ...input,
          completionOutcome: "ongoing",
        });

      // Update stage census
      const stage = await getDb()
        .select()
        .from(campusStages)
        .where(eq(campusStages.id, input.toStageId));
      if (stage[0]) {
        const newCensus = (stage[0].currentCensus ?? 0) + 1;
        await getDb()
          .update(campusStages)
          .set({ currentCensus: newCensus })
          .where(eq(campusStages.id, input.toStageId));
      }

      return { success: true, assignmentId: id };
    }),

  completeCampusPlacement: publicQuery
    .input(
      z.object({
        assignmentId: z.string(),
        completionOutcome: z.enum(["completed", "discharged", "transferred"]),
        completedDate: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(stageAssignments)
        .set({
          completionOutcome: input.completionOutcome,
          completedDate: input.completedDate,
        })
        .where(eq(stageAssignments.id, input.assignmentId));

      // Decrement stage census
      const assignment = await getDb()
        .select()
        .from(stageAssignments)
        .where(eq(stageAssignments.id, input.assignmentId));
      if (assignment[0]) {
        const stage = await getDb()
          .select()
          .from(campusStages)
          .where(eq(campusStages.id, assignment[0].toStageId));
        if (stage[0]) {
          const newCensus = Math.max(0, (stage[0].currentCensus ?? 0) - 1);
          await getDb()
            .update(campusStages)
            .set({ currentCensus: newCensus })
            .where(eq(campusStages.id, assignment[0].toStageId));
        }
      }

      return { success: true };
    }),

  // ─── Campus Development Readiness Criteria ───────────────

  listCampusReadinessCriteria: publicQuery
    .input(z.object({ stageId: z.string() }))
    .query(async ({ input }) => {
      return getDb()
        .select()
        .from(campusReadinessCriteria)
        .where(eq(campusReadinessCriteria.stageId, input.stageId))
        .orderBy(campusReadinessCriteria.criterionNumber);
    }),

  // ─── Census Alerts ───────────────────────────────────────

  listCensusAlerts: publicQuery
    .input(
      z
        .object({
          facilityId: z.string().optional(),
          stageId: z.string().optional(),
          severity: z.enum(["low", "moderate", "high", "critical"]).optional(),
          acknowledged: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let query = getDb()
        .select()
        .from(censusAlerts)
        .orderBy(desc(censusAlerts.triggeredAt));
      if (input?.facilityId) {
        query = query.where(
          eq(censusAlerts.facilityId, input.facilityId),
        ) as typeof query;
      }
      if (input?.stageId) {
        query = query.where(
          eq(censusAlerts.stageId, input.stageId),
        ) as typeof query;
      }
      if (input?.severity) {
        query = query.where(
          eq(censusAlerts.severity, input.severity),
        ) as typeof query;
      }
      return query;
    }),

  acknowledgeAlert: publicQuery
    .input(
      z.object({
        alertId: z.string(),
        acknowledgedBy: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(censusAlerts)
        .set({
          acknowledgedBy: input.acknowledgedBy,
          acknowledgedAt: new Date().toISOString(),
        })
        .where(eq(censusAlerts.id, input.alertId));
      return { success: true };
    }),

  // ─── Census Snapshots ────────────────────────────────────

  createCensusSnapshot: publicQuery
    .input(
      z.object({
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
      }),
    )
    .mutation(async ({ input }) => {
      const s1pct =
        input.stage1Capacity > 0
          ? Math.round((input.stage1Census / input.stage1Capacity) * 100)
          : 0;
      const s2pct =
        input.stage2Capacity > 0
          ? Math.round((input.stage2Census / input.stage2Capacity) * 100)
          : 0;
      const s3pct =
        input.stage3Capacity > 0
          ? Math.round((input.stage3Census / input.stage3Capacity) * 100)
          : 0;
      const overall =
        input.totalCapacity > 0
          ? Math.round((input.totalCensus / input.totalCapacity) * 100)
          : 0;

      await getDb()
        .insert(censusSnapshots)
        .values({
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
        return getDb()
          .select()
          .from(censusSnapshots)
          .where(eq(censusSnapshots.facilityId, input.facilityId))
          .orderBy(desc(censusSnapshots.snapshotDate));
      }
      return getDb()
        .select()
        .from(censusSnapshots)
        .orderBy(desc(censusSnapshots.snapshotDate));
    }),
});
