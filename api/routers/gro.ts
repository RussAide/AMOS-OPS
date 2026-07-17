import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { randomUUID } from "crypto";
import {
  shiftLogs,
  safetyRounds,
  youthCareLogs,
  incidentReports,
  supervisionNotes,
  shiftHandoffs,
} from "@db/schema";
import { eq, desc, and, gte, lte, type InferInsertModel } from "drizzle-orm";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

// ═══════════════════════════════════════════════════════════════
// GRO Residential Operations Router (D008-02)
// 6 Features: Shift Log, Safety Round Checklist, Youth Care Log,
// Incident Report, Supervision Documentation, Shift Handoff
// ═══════════════════════════════════════════════════════════════

function generateIncidentNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `INC-GRO-${year}-${seq}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ═══════════════════════════════════════════════════════════════
// 1. SHIFT LOG
// ═══════════════════════════════════════════════════════════════

export const groRouter = createRouter({

  // ─── Shift Logs ────────────────────────────────────────────

  listShiftLogs: authedQuery
    .input(z.object({
      shiftType: z.enum(["day", "evening", "night", "overnight"]).optional(),
      status: z.enum(["active", "completed", "no_show", "absent"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.shiftType) conditions.push(eq(shiftLogs.shiftType, input.shiftType));
      if (input?.status) conditions.push(eq(shiftLogs.status, input.status));
      if (input?.dateFrom) conditions.push(gte(shiftLogs.shiftDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(shiftLogs.shiftDate, input.dateTo));

      const results = conditions.length > 0
        ? await db.select().from(shiftLogs).where(and(...conditions)).orderBy(desc(shiftLogs.createdAt))
        : await db.select().from(shiftLogs).orderBy(desc(shiftLogs.createdAt));
      return results;
    }),

  getShiftLog: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const log = await db.select().from(shiftLogs).where(eq(shiftLogs.id, input.id)).get();
      if (!log) return null;

      // Get related safety rounds
      const rounds = await db.select().from(safetyRounds).where(eq(safetyRounds.shiftId, input.id)).orderBy(safetyRounds.areaOrder);
      // Get related care logs
      const care = await db.select().from(youthCareLogs).where(eq(youthCareLogs.shiftId, input.id)).orderBy(desc(youthCareLogs.createdAt));

      return { ...log, safetyRounds: rounds, careLogs: care };
    }),

  createShiftLog: adminQuery
    .input(z.object({
      shiftDate: z.string(),
      shiftType: z.enum(["day", "evening", "night", "overnight"]),
      staffName: z.string(),
      staffId: z.string().optional(),
      supervisorName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = nowIso();
      await db.insert(shiftLogs).values({
        id,
        shiftDate: input.shiftDate,
        shiftType: input.shiftType,
        staffName: input.staffName,
        staffId: input.staffId ?? null,
        supervisorName: input.supervisorName ?? null,
        clockInAt: now,
        clockOutAt: null,
        entriesJson: "[]",
        safetyRoundsCompleted: 0,
        careLogsCompleted: 0,
        incidentsReported: 0,
        medicationsAdministered: 0,
        status: "active",
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, id };
    }),

  clockOutShiftLog: adminQuery
    .input(z.object({
      id: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = nowIso();
      await db.update(shiftLogs).set({
        clockOutAt: now,
        status: "completed",
        notes: input.notes ?? null,
        updatedAt: now,
      }).where(eq(shiftLogs.id, input.id));
      return { success: true };
    }),

  addShiftLogEntry: adminQuery
    .input(z.object({
      id: z.string(),
      category: z.string(),
      note: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const log = await db.select({ entriesJson: shiftLogs.entriesJson }).from(shiftLogs).where(eq(shiftLogs.id, input.id)).get();
      const entries = JSON.parse(log?.entriesJson ?? "[]");
      entries.push({ time: nowIso(), category: input.category, note: input.note });
      await db.update(shiftLogs).set({
        entriesJson: JSON.stringify(entries),
        updatedAt: nowIso(),
      }).where(eq(shiftLogs.id, input.id));
      return { success: true };
    }),

  updateShiftLog: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["active", "completed", "no_show", "absent"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const updateData: Partial<InferInsertModel<typeof shiftLogs>> = { updatedAt: nowIso() };
      if (updates.status) updateData.status = updates.status;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      await db.update(shiftLogs).set(updateData).where(eq(shiftLogs.id, id));
      return { success: true };
    }),

  deleteShiftLog: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(shiftLogs).where(eq(shiftLogs.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 2. SAFETY ROUND CHECKLIST
  // ════════════════════════════════════════════════════════════

  listSafetyRounds: authedQuery
    .input(z.object({
      area: z.string().optional(),
      shiftType: z.enum(["day", "evening", "night", "overnight"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      requiresFollowUp: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.area) conditions.push(eq(safetyRounds.area, input.area));
      if (input?.shiftType) conditions.push(eq(safetyRounds.shiftType, input.shiftType));
      if (input?.dateFrom) conditions.push(gte(safetyRounds.shiftDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(safetyRounds.shiftDate, input.dateTo));

      let results = conditions.length > 0
        ? await db.select().from(safetyRounds).where(and(...conditions)).orderBy(desc(safetyRounds.createdAt))
        : await db.select().from(safetyRounds).orderBy(desc(safetyRounds.createdAt));

      if (input?.requiresFollowUp) {
        results = results.filter((r) => r.requiresFollowUp);
      }
      return results;
    }),

  getSafetyRound: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(safetyRounds).where(eq(safetyRounds.id, input.id)).get() ?? null;
    }),

  createSafetyRound: adminQuery
    .input(z.object({
      shiftId: z.string().optional(),
      shiftDate: z.string(),
      shiftType: z.enum(["day", "evening", "night", "overnight"]),
      area: z.string(),
      areaOrder: z.number().default(0),
      item1NoHazards: z.boolean().optional(),
      item2LightingWorking: z.boolean().optional(),
      item3EmergencyExitsClear: z.boolean().optional(),
      item4FireExtinguishersOk: z.boolean().optional(),
      item5NoContraband: z.boolean().optional(),
      item6CleanSanitary: z.boolean().optional(),
      item7EquipmentSecure: z.boolean().optional(),
      item8YouthAreasSafe: z.boolean().optional(),
      hazardsFound: z.string().optional(),
      correctiveAction: z.string().optional(),
      requiresFollowUp: z.boolean().optional(),
      followUpNotes: z.string().optional(),
      completedBy: z.string(),
      completedById: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = nowIso();

      // Count passed items
      const items = [
        input.item1NoHazards,
        input.item2LightingWorking,
        input.item3EmergencyExitsClear,
        input.item4FireExtinguishersOk,
        input.item5NoContraband,
        input.item6CleanSanitary,
        input.item7EquipmentSecure,
        input.item8YouthAreasSafe,
      ];
      const passed = items.filter(Boolean).length;
      const allPassed = passed === 8;

      await db.insert(safetyRounds).values({
        id,
        shiftId: input.shiftId ?? null,
        shiftDate: input.shiftDate,
        shiftType: input.shiftType,
        area: input.area,
        areaOrder: input.areaOrder,
        item1NoHazards: input.item1NoHazards ?? false,
        item2LightingWorking: input.item2LightingWorking ?? false,
        item3EmergencyExitsClear: input.item3EmergencyExitsClear ?? false,
        item4FireExtinguishersOk: input.item4FireExtinguishersOk ?? false,
        item5NoContraband: input.item5NoContraband ?? false,
        item6CleanSanitary: input.item6CleanSanitary ?? false,
        item7EquipmentSecure: input.item7EquipmentSecure ?? false,
        item8YouthAreasSafe: input.item8YouthAreasSafe ?? false,
        allItemsPassed: allPassed,
        itemsPassed: passed,
        itemsTotal: 8,
        hazardsFound: input.hazardsFound ?? null,
        correctiveAction: input.correctiveAction ?? null,
        requiresFollowUp: input.requiresFollowUp ?? false,
        followUpNotes: input.followUpNotes ?? null,
        completedBy: input.completedBy,
        completedById: input.completedById ?? null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Update shift log safety round count if shiftId provided
      if (input.shiftId) {
        const existing = await db.select().from(safetyRounds).where(eq(safetyRounds.shiftId, input.shiftId)).all();
        await db.update(shiftLogs).set({
          safetyRoundsCompleted: existing.length,
          updatedAt: now,
        }).where(eq(shiftLogs.id, input.shiftId));
      }

      return { success: true, id, allItemsPassed: allPassed, itemsPassed: passed };
    }),

  updateSafetyRound: adminQuery
    .input(z.object({
      id: z.string(),
      item1NoHazards: z.boolean().optional(),
      item2LightingWorking: z.boolean().optional(),
      item3EmergencyExitsClear: z.boolean().optional(),
      item4FireExtinguishersOk: z.boolean().optional(),
      item5NoContraband: z.boolean().optional(),
      item6CleanSanitary: z.boolean().optional(),
      item7EquipmentSecure: z.boolean().optional(),
      item8YouthAreasSafe: z.boolean().optional(),
      hazardsFound: z.string().optional(),
      correctiveAction: z.string().optional(),
      requiresFollowUp: z.boolean().optional(),
      followUpNotes: z.string().optional(),
      reviewedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const existing = await db.select().from(safetyRounds).where(eq(safetyRounds.id, id)).get();
      if (!existing) throw new Error("Safety round not found");

      // Recalculate passed items
      const items = [
        updates.item1NoHazards ?? existing.item1NoHazards,
        updates.item2LightingWorking ?? existing.item2LightingWorking,
        updates.item3EmergencyExitsClear ?? existing.item3EmergencyExitsClear,
        updates.item4FireExtinguishersOk ?? existing.item4FireExtinguishersOk,
        updates.item5NoContraband ?? existing.item5NoContraband,
        updates.item6CleanSanitary ?? existing.item6CleanSanitary,
        updates.item7EquipmentSecure ?? existing.item7EquipmentSecure,
        updates.item8YouthAreasSafe ?? existing.item8YouthAreasSafe,
      ];
      const passed = items.filter(Boolean).length;

      const updateData: Partial<InferInsertModel<typeof safetyRounds>> = {
        updatedAt: nowIso(),
        itemsPassed: passed,
        allItemsPassed: passed === 8,
      };
      if (updates.item1NoHazards !== undefined) updateData.item1NoHazards = updates.item1NoHazards;
      if (updates.item2LightingWorking !== undefined) updateData.item2LightingWorking = updates.item2LightingWorking;
      if (updates.item3EmergencyExitsClear !== undefined) updateData.item3EmergencyExitsClear = updates.item3EmergencyExitsClear;
      if (updates.item4FireExtinguishersOk !== undefined) updateData.item4FireExtinguishersOk = updates.item4FireExtinguishersOk;
      if (updates.item5NoContraband !== undefined) updateData.item5NoContraband = updates.item5NoContraband;
      if (updates.item6CleanSanitary !== undefined) updateData.item6CleanSanitary = updates.item6CleanSanitary;
      if (updates.item7EquipmentSecure !== undefined) updateData.item7EquipmentSecure = updates.item7EquipmentSecure;
      if (updates.item8YouthAreasSafe !== undefined) updateData.item8YouthAreasSafe = updates.item8YouthAreasSafe;
      if (updates.hazardsFound !== undefined) updateData.hazardsFound = updates.hazardsFound;
      if (updates.correctiveAction !== undefined) updateData.correctiveAction = updates.correctiveAction;
      if (updates.requiresFollowUp !== undefined) updateData.requiresFollowUp = updates.requiresFollowUp;
      if (updates.followUpNotes !== undefined) updateData.followUpNotes = updates.followUpNotes;
      if (updates.reviewedBy !== undefined) { updateData.reviewedBy = updates.reviewedBy; updateData.reviewedAt = nowIso(); }

      await db.update(safetyRounds).set(updateData).where(eq(safetyRounds.id, id));
      return { success: true, itemsPassed: passed, allItemsPassed: passed === 8 };
    }),

  deleteSafetyRound: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(safetyRounds).where(eq(safetyRounds.id, input.id));
      return { success: true };
    }),

  safetyRoundDashboard: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(safetyRounds);
    const today = new Date().toISOString().split("T")[0];
    const todayRounds = all.filter((r) => r.shiftDate === today);
    const totalCompleted = all.filter((r) => r.allItemsPassed).length;
    const followUpNeeded = all.filter((r) => r.requiresFollowUp && !r.reviewedAt).length;

    // Group by area
    const byArea: Record<string, { total: number; passed: number }> = {};
    for (const r of all) {
      if (!byArea[r.area]) byArea[r.area] = { total: 0, passed: 0 };
      byArea[r.area].total++;
      if (r.allItemsPassed) byArea[r.area].passed++;
    }

    return {
      totalRounds: all.length,
      todayRounds: todayRounds.length,
      totalCompleted,
      followUpNeeded,
      completionRate: all.length > 0 ? Math.round((totalCompleted / all.length) * 100) : 0,
      byArea,
    };
  }),

  // ════════════════════════════════════════════════════════════
  // 3. YOUTH CARE LOG
  // ════════════════════════════════════════════════════════════

  listYouthCareLogs: authedQuery
    .input(z.object({
      youthId: z.string().optional(),
      careType: z.enum(["daily_living", "behavioral", "medical", "educational", "recreational", "emotional_support", "crisis_intervention"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      followUpNeeded: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.youthId) conditions.push(eq(youthCareLogs.youthId, input.youthId));
      if (input?.careType) conditions.push(eq(youthCareLogs.careType, input.careType));
      if (input?.dateFrom) conditions.push(gte(youthCareLogs.logDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(youthCareLogs.logDate, input.dateTo));

      let results = conditions.length > 0
        ? await db.select().from(youthCareLogs).where(and(...conditions)).orderBy(desc(youthCareLogs.createdAt))
        : await db.select().from(youthCareLogs).orderBy(desc(youthCareLogs.createdAt));

      if (input?.followUpNeeded) {
        results = results.filter((r) => r.followUpNeeded && !r.reviewedBy);
      }
      return results;
    }),

  getYouthCareLog: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(youthCareLogs).where(eq(youthCareLogs.id, input.id)).get() ?? null;
    }),

  createYouthCareLog: adminQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      shiftId: z.string().optional(),
      logDate: z.string(),
      shiftType: z.enum(["day", "evening", "night", "overnight"]),
      careType: z.enum(["daily_living", "behavioral", "medical", "educational", "recreational", "emotional_support", "crisis_intervention"]),
      description: z.string(),
      observations: z.string().optional(),
      youthResponse: z.string().optional(),
      outcome: z.string().optional(),
      followUpNeeded: z.boolean().optional(),
      followUpActions: z.string().optional(),
      goalsAddressedJson: z.string().optional(),
      recordedBy: z.string(),
      recordedById: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = nowIso();
      await db.insert(youthCareLogs).values({
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        shiftId: input.shiftId ?? null,
        logDate: input.logDate,
        shiftType: input.shiftType,
        careType: input.careType,
        description: input.description,
        observations: input.observations ?? null,
        youthResponse: input.youthResponse ?? null,
        outcome: input.outcome ?? null,
        followUpNeeded: input.followUpNeeded ?? false,
        followUpActions: input.followUpActions ?? null,
        goalsAddressedJson: input.goalsAddressedJson ?? null,
        recordedBy: input.recordedBy,
        recordedById: input.recordedById ?? null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Update shift log care log count if shiftId provided
      if (input.shiftId) {
        const existing = await db.select().from(youthCareLogs).where(eq(youthCareLogs.shiftId, input.shiftId)).all();
        await db.update(shiftLogs).set({
          careLogsCompleted: existing.length,
          updatedAt: now,
        }).where(eq(shiftLogs.id, input.shiftId));
      }

      return { success: true, id };
    }),

  updateYouthCareLog: adminQuery
    .input(z.object({
      id: z.string(),
      description: z.string().optional(),
      observations: z.string().optional(),
      youthResponse: z.string().optional(),
      outcome: z.string().optional(),
      followUpNeeded: z.boolean().optional(),
      followUpActions: z.string().optional(),
      reviewedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const updateData: Partial<InferInsertModel<typeof youthCareLogs>> = { updatedAt: nowIso() };
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.observations !== undefined) updateData.observations = updates.observations;
      if (updates.youthResponse !== undefined) updateData.youthResponse = updates.youthResponse;
      if (updates.outcome !== undefined) updateData.outcome = updates.outcome;
      if (updates.followUpNeeded !== undefined) updateData.followUpNeeded = updates.followUpNeeded;
      if (updates.followUpActions !== undefined) updateData.followUpActions = updates.followUpActions;
      if (updates.reviewedBy !== undefined) { updateData.reviewedBy = updates.reviewedBy; updateData.reviewedAt = nowIso(); }

      await db.update(youthCareLogs).set(updateData).where(eq(youthCareLogs.id, id));
      return { success: true };
    }),

  deleteYouthCareLog: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(youthCareLogs).where(eq(youthCareLogs.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 4. INCIDENT REPORT
  // ════════════════════════════════════════════════════════════

  listIncidentReports: authedQuery
    .input(z.object({
      status: z.enum(["open", "under_review", "pending_supervisor", "resolved", "closed"]).optional(),
      incidentType: z.enum(["behavioral", "safety", "medication", "injury", "elopement", "self_harm", "aggression", "property_damage", "seclusion", "restraint", "other"]).optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      youthId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(incidentReports.status, input.status));
      if (input?.incidentType) conditions.push(eq(incidentReports.incidentType, input.incidentType));
      if (input?.severity) conditions.push(eq(incidentReports.severity, input.severity));
      if (input?.youthId) conditions.push(eq(incidentReports.youthId, input.youthId));
      if (input?.dateFrom) conditions.push(gte(incidentReports.occurredAt, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(incidentReports.occurredAt, input.dateTo));

      const results = conditions.length > 0
        ? await db.select().from(incidentReports).where(and(...conditions)).orderBy(desc(incidentReports.createdAt))
        : await db.select().from(incidentReports).orderBy(desc(incidentReports.createdAt));
      return results;
    }),

  getIncidentReport: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const report = await db.select().from(incidentReports).where(eq(incidentReports.id, input.id)).get();
      if (!report) return null;

      // Get related supervision notes
      const supervision = await db.select().from(supervisionNotes).where(eq(supervisionNotes.relatedIncidentId, input.id)).all();
      return { ...report, supervisionNotes: supervision };
    }),

  createIncidentReport: adminQuery
    .input(z.object({
      incidentType: z.enum(["behavioral", "safety", "medication", "injury", "elopement", "self_harm", "aggression", "property_damage", "seclusion", "restraint", "other"]),
      severity: z.enum(["low", "medium", "high", "critical"]),
      youthId: z.string().optional(),
      youthName: z.string().optional(),
      mrn: z.string().optional(),
      otherYouthInvolved: z.string().optional(),
      occurredAt: z.string(),
      occurredLocation: z.string(),
      description: z.string(),
      immediateAction: z.string().optional(),
      factors: z.string().optional(),
      youthInjuries: z.string().optional(),
      staffInjuries: z.string().optional(),
      propertyDamage: z.string().optional(),
      medicalAttentionRequired: z.boolean().optional(),
      medicalAttentionProvided: z.string().optional(),
      reportedBy: z.string(),
      reportedById: z.string().optional(),
      witnesses: z.string().optional(),
      staffInvolved: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = nowIso();
      const incidentNumber = generateIncidentNumber();

      await db.insert(incidentReports).values({
        id,
        incidentNumber,
        incidentType: input.incidentType,
        severity: input.severity,
        status: "open",
        youthId: input.youthId ?? null,
        youthName: input.youthName ?? null,
        mrn: input.mrn ?? null,
        otherYouthInvolved: input.otherYouthInvolved ?? null,
        occurredAt: input.occurredAt,
        occurredLocation: input.occurredLocation,
        description: input.description,
        immediateAction: input.immediateAction ?? null,
        factors: input.factors ?? null,
        youthInjuries: input.youthInjuries ?? null,
        staffInjuries: input.staffInjuries ?? null,
        propertyDamage: input.propertyDamage ?? null,
        medicalAttentionRequired: input.medicalAttentionRequired ?? false,
        medicalAttentionProvided: input.medicalAttentionProvided ?? null,
        guardianNotified: false,
        supervisorNotified: false,
        reportedBy: input.reportedBy,
        reportedById: input.reportedById ?? null,
        witnesses: input.witnesses ?? null,
        staffInvolved: input.staffInvolved ?? null,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id, incidentNumber };
    }),

  updateIncidentReport: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "under_review", "pending_supervisor", "resolved", "closed"]).optional(),
      description: z.string().optional(),
      immediateAction: z.string().optional(),
      factors: z.string().optional(),
      youthInjuries: z.string().optional(),
      staffInjuries: z.string().optional(),
      medicalAttentionRequired: z.boolean().optional(),
      medicalAttentionProvided: z.string().optional(),
      guardianNotified: z.boolean().optional(),
      guardianNotifiedAt: z.string().optional(),
      guardianNotifiedBy: z.string().optional(),
      supervisorNotified: z.boolean().optional(),
      supervisorNotifiedAt: z.string().optional(),
      supervisorNotifiedBy: z.string().optional(),
      investigatorAssigned: z.string().optional(),
      investigationNotes: z.string().optional(),
      rootCause: z.string().optional(),
      correctiveActions: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const updateData: Partial<InferInsertModel<typeof incidentReports>> = { updatedAt: nowIso() };

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.immediateAction !== undefined) updateData.immediateAction = updates.immediateAction;
      if (updates.factors !== undefined) updateData.factors = updates.factors;
      if (updates.youthInjuries !== undefined) updateData.youthInjuries = updates.youthInjuries;
      if (updates.staffInjuries !== undefined) updateData.staffInjuries = updates.staffInjuries;
      if (updates.medicalAttentionRequired !== undefined) updateData.medicalAttentionRequired = updates.medicalAttentionRequired;
      if (updates.medicalAttentionProvided !== undefined) updateData.medicalAttentionProvided = updates.medicalAttentionProvided;
      if (updates.guardianNotified !== undefined) { updateData.guardianNotified = updates.guardianNotified; if (updates.guardianNotified) updateData.guardianNotifiedAt = nowIso(); }
      if (updates.guardianNotifiedBy !== undefined) updateData.guardianNotifiedBy = updates.guardianNotifiedBy;
      if (updates.supervisorNotified !== undefined) { updateData.supervisorNotified = updates.supervisorNotified; if (updates.supervisorNotified) updateData.supervisorNotifiedAt = nowIso(); }
      if (updates.supervisorNotifiedBy !== undefined) updateData.supervisorNotifiedBy = updates.supervisorNotifiedBy;
      if (updates.investigatorAssigned !== undefined) updateData.investigatorAssigned = updates.investigatorAssigned;
      if (updates.investigationNotes !== undefined) updateData.investigationNotes = updates.investigationNotes;
      if (updates.rootCause !== undefined) updateData.rootCause = updates.rootCause;
      if (updates.correctiveActions !== undefined) updateData.correctiveActions = updates.correctiveActions;
      if (updates.status === "resolved" || updates.status === "closed") {
        updateData.resolvedAt = nowIso();
      }

      await db.update(incidentReports).set(updateData).where(eq(incidentReports.id, id));
      return { success: true };
    }),

  resolveIncidentReport: adminQuery
    .input(z.object({
      id: z.string(),
      resolutionNotes: z.string().optional(),
      resolvedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = nowIso();
      await db.update(incidentReports).set({
        status: "resolved",
        resolvedAt: now,
        resolvedBy: input.resolvedBy,
        resolutionNotes: input.resolutionNotes ?? null,
        updatedAt: now,
      }).where(eq(incidentReports.id, input.id));
      return { success: true };
    }),

  closeIncidentReport: adminQuery
    .input(z.object({
      id: z.string(),
      resolutionNotes: z.string().optional(),
      resolvedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = nowIso();
      await db.update(incidentReports).set({
        status: "closed",
        resolvedAt: now,
        resolvedBy: input.resolvedBy,
        resolutionNotes: input.resolutionNotes ?? null,
        updatedAt: now,
      }).where(eq(incidentReports.id, input.id));
      return { success: true };
    }),

  deleteIncidentReport: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(incidentReports).where(eq(incidentReports.id, input.id));
      return { success: true };
    }),

  incidentDashboard: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(incidentReports);
    const now = nowIso();
    const today = now.split("T")[0];

    const open = all.filter((r) => r.status === "open").length;
    const underReview = all.filter((r) => r.status === "under_review").length;
    const pendingSupervisor = all.filter((r) => r.status === "pending_supervisor").length;
    const resolved = all.filter((r) => r.status === "resolved").length;
    const closed = all.filter((r) => r.status === "closed").length;
    const critical = all.filter((r) => r.severity === "critical" && r.status !== "closed").length;
    const high = all.filter((r) => r.severity === "high" && r.status !== "closed").length;

    // By type
    const byType: Record<string, number> = {};
    for (const r of all) { byType[r.incidentType] = (byType[r.incidentType] ?? 0) + 1; }

    // By severity
    const bySeverity: Record<string, number> = {};
    for (const r of all) { bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1; }

    return {
      total: all.length,
      open,
      underReview,
      pendingSupervisor,
      resolved,
      closed,
      critical,
      high,
      todayCount: all.filter((r) => r.createdAt?.startsWith(today)).length,
      byType,
      bySeverity,
      guardianNotifiedCount: all.filter((r) => r.guardianNotified).length,
      supervisorNotifiedCount: all.filter((r) => r.supervisorNotified).length,
    };
  }),

  // ════════════════════════════════════════════════════════════
  // 5. SUPERVISION DOCUMENTATION
  // ════════════════════════════════════════════════════════════

  listSupervisionNotes: authedQuery
    .input(z.object({
      superviseeId: z.string().optional(),
      supervisionType: z.enum(["individual", "group", "crisis_debrief", "incident_review", "training", "observation"]).optional(),
      followUpRequired: z.boolean().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.superviseeId) conditions.push(eq(supervisionNotes.superviseeId, input.superviseeId));
      if (input?.supervisionType) conditions.push(eq(supervisionNotes.supervisionType, input.supervisionType));
      if (input?.dateFrom) conditions.push(gte(supervisionNotes.supervisionDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(supervisionNotes.supervisionDate, input.dateTo));

      let results = conditions.length > 0
        ? await db.select().from(supervisionNotes).where(and(...conditions)).orderBy(desc(supervisionNotes.createdAt))
        : await db.select().from(supervisionNotes).orderBy(desc(supervisionNotes.createdAt));

      if (input?.followUpRequired) {
        results = results.filter((r) => r.followUpRequired && !r.superviseeAcknowledged);
      }
      return results;
    }),

  getSupervisionNote: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(supervisionNotes).where(eq(supervisionNotes.id, input.id)).get() ?? null;
    }),

  createSupervisionNote: adminQuery
    .input(z.object({
      supervisionDate: z.string(),
      supervisionType: z.enum(["individual", "group", "crisis_debrief", "incident_review", "training", "observation"]),
      supervisorName: z.string(),
      supervisorId: z.string().optional(),
      superviseeName: z.string(),
      superviseeId: z.string().optional(),
      topicsDiscussed: z.string(),
      staffConcerns: z.string().optional(),
      performanceObservations: z.string().optional(),
      trainingNeeds: z.string().optional(),
      goalsSet: z.string().optional(),
      actionItems: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpDate: z.string().optional(),
      followUpTopics: z.string().optional(),
      relatedIncidentId: z.string().optional(),
      relatedCareLogIds: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = nowIso();
      await db.insert(supervisionNotes).values({
        id,
        supervisionDate: input.supervisionDate,
        supervisionType: input.supervisionType,
        supervisorName: input.supervisorName,
        supervisorId: input.supervisorId ?? null,
        superviseeName: input.superviseeName,
        superviseeId: input.superviseeId ?? null,
        topicsDiscussed: input.topicsDiscussed,
        staffConcerns: input.staffConcerns ?? null,
        performanceObservations: input.performanceObservations ?? null,
        trainingNeeds: input.trainingNeeds ?? null,
        goalsSet: input.goalsSet ?? null,
        actionItems: input.actionItems ?? null,
        followUpRequired: input.followUpRequired ?? false,
        followUpDate: input.followUpDate ?? null,
        followUpTopics: input.followUpTopics ?? null,
        superviseeAcknowledged: false,
        superviseeAcknowledgedAt: null,
        relatedIncidentId: input.relatedIncidentId ?? null,
        relatedCareLogIds: input.relatedCareLogIds ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy ?? null,
      });
      return { success: true, id };
    }),

  updateSupervisionNote: adminQuery
    .input(z.object({
      id: z.string(),
      topicsDiscussed: z.string().optional(),
      staffConcerns: z.string().optional(),
      performanceObservations: z.string().optional(),
      trainingNeeds: z.string().optional(),
      goalsSet: z.string().optional(),
      actionItems: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpDate: z.string().optional(),
      followUpTopics: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const updateData: Partial<InferInsertModel<typeof supervisionNotes>> = { updatedAt: nowIso() };
      if (updates.topicsDiscussed !== undefined) updateData.topicsDiscussed = updates.topicsDiscussed;
      if (updates.staffConcerns !== undefined) updateData.staffConcerns = updates.staffConcerns;
      if (updates.performanceObservations !== undefined) updateData.performanceObservations = updates.performanceObservations;
      if (updates.trainingNeeds !== undefined) updateData.trainingNeeds = updates.trainingNeeds;
      if (updates.goalsSet !== undefined) updateData.goalsSet = updates.goalsSet;
      if (updates.actionItems !== undefined) updateData.actionItems = updates.actionItems;
      if (updates.followUpRequired !== undefined) updateData.followUpRequired = updates.followUpRequired;
      if (updates.followUpDate !== undefined) updateData.followUpDate = updates.followUpDate;
      if (updates.followUpTopics !== undefined) updateData.followUpTopics = updates.followUpTopics;

      await db.update(supervisionNotes).set(updateData).where(eq(supervisionNotes.id, id));
      return { success: true };
    }),

  acknowledgeSupervisionNote: adminQuery
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(supervisionNotes).set({
        superviseeAcknowledged: true,
        superviseeAcknowledgedAt: nowIso(),
        updatedAt: nowIso(),
      }).where(eq(supervisionNotes.id, input.id));
      return { success: true };
    }),

  deleteSupervisionNote: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(supervisionNotes).where(eq(supervisionNotes.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 6. SHIFT HANDOFF
  // ════════════════════════════════════════════════════════════

  listShiftHandoffs: authedQuery
    .input(z.object({
      status: z.enum(["pending", "in_progress", "completed"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(shiftHandoffs.status, input.status));
      if (input?.dateFrom) conditions.push(gte(shiftHandoffs.handoffDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(shiftHandoffs.handoffDate, input.dateTo));

      const results = conditions.length > 0
        ? await db.select().from(shiftHandoffs).where(and(...conditions)).orderBy(desc(shiftHandoffs.createdAt))
        : await db.select().from(shiftHandoffs).orderBy(desc(shiftHandoffs.createdAt));
      return results;
    }),

  getShiftHandoff: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(shiftHandoffs).where(eq(shiftHandoffs.id, input.id)).get() ?? null;
    }),

  createShiftHandoff: adminQuery
    .input(z.object({
      fromShiftId: z.string(),
      toShiftId: z.string().optional(),
      handoffDate: z.string(),
      fromStaffName: z.string(),
      toStaffName: z.string().optional(),
      youthStatusJson: z.string().optional(),
      pendingItems: z.string().optional(),
      medicationUpdates: z.string().optional(),
      appointmentReminders: z.string().optional(),
      highPriorityAlerts: z.string().optional(),
      safetyAlerts: z.string().optional(),
      generalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = nowIso();
      await db.insert(shiftHandoffs).values({
        id,
        fromShiftId: input.fromShiftId,
        toShiftId: input.toShiftId ?? null,
        handoffDate: input.handoffDate,
        fromStaffName: input.fromStaffName,
        toStaffName: input.toStaffName ?? null,
        youthStatusJson: input.youthStatusJson ?? null,
        pendingItems: input.pendingItems ?? null,
        medicationUpdates: input.medicationUpdates ?? null,
        appointmentReminders: input.appointmentReminders ?? null,
        highPriorityAlerts: input.highPriorityAlerts ?? null,
        safetyAlerts: input.safetyAlerts ?? null,
        generalNotes: input.generalNotes ?? null,
        status: "pending",
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, id };
    }),

  completeShiftHandoff: adminQuery
    .input(z.object({
      id: z.string(),
      toStaffName: z.string(),
      generalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = nowIso();
      await db.update(shiftHandoffs).set({
        toStaffName: input.toStaffName,
        generalNotes: input.generalNotes ?? null,
        status: "completed",
        completedAt: now,
        updatedAt: now,
      }).where(eq(shiftHandoffs.id, input.id));
      return { success: true };
    }),

  updateShiftHandoff: adminQuery
    .input(z.object({
      id: z.string(),
      youthStatusJson: z.string().optional(),
      pendingItems: z.string().optional(),
      medicationUpdates: z.string().optional(),
      appointmentReminders: z.string().optional(),
      highPriorityAlerts: z.string().optional(),
      safetyAlerts: z.string().optional(),
      generalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const updateData: Partial<InferInsertModel<typeof shiftHandoffs>> = { updatedAt: nowIso() };
      if (updates.youthStatusJson !== undefined) updateData.youthStatusJson = updates.youthStatusJson;
      if (updates.pendingItems !== undefined) updateData.pendingItems = updates.pendingItems;
      if (updates.medicationUpdates !== undefined) updateData.medicationUpdates = updates.medicationUpdates;
      if (updates.appointmentReminders !== undefined) updateData.appointmentReminders = updates.appointmentReminders;
      if (updates.highPriorityAlerts !== undefined) updateData.highPriorityAlerts = updates.highPriorityAlerts;
      if (updates.safetyAlerts !== undefined) updateData.safetyAlerts = updates.safetyAlerts;
      if (updates.generalNotes !== undefined) updateData.generalNotes = updates.generalNotes;

      await db.update(shiftHandoffs).set(updateData).where(eq(shiftHandoffs.id, id));
      return { success: true };
    }),

  deleteShiftHandoff: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(shiftHandoffs).where(eq(shiftHandoffs.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // GRO RESIDENTIAL DASHBOARD
  // ════════════════════════════════════════════════════════════

  residentialDashboard: authedQuery.query(async () => {
    const db = getDb();
    const now = nowIso();
    const today = now.split("T")[0];

    // Shift logs
    const allShifts = await db.select().from(shiftLogs);
    const activeShifts = allShifts.filter((s) => s.status === "active").length;
    const todayShifts = allShifts.filter((s) => s.shiftDate === today).length;

    // Safety rounds
    const allSafety = await db.select().from(safetyRounds);
    const todaySafety = allSafety.filter((s) => s.shiftDate === today).length;
    const safetyFollowUp = allSafety.filter((s) => s.requiresFollowUp && !s.reviewedAt).length;

    // Care logs
    const allCare = await db.select().from(youthCareLogs);
    const todayCare = allCare.filter((c) => c.logDate === today).length;
    const careFollowUp = allCare.filter((c) => c.followUpNeeded && !c.reviewedBy).length;

    // Incidents
    const allIncidents = await db.select().from(incidentReports);
    const openIncidents = allIncidents.filter((i) => i.status === "open" || i.status === "under_review").length;
    const criticalIncidents = allIncidents.filter((i) => i.severity === "critical" && i.status !== "closed").length;

    // Supervision
    const allSupervision = await db.select().from(supervisionNotes);
    const pendingAck = allSupervision.filter((s) => !s.superviseeAcknowledged).length;

    // Handoffs
    const allHandoffs = await db.select().from(shiftHandoffs);
    const pendingHandoffs = allHandoffs.filter((h) => h.status === "pending").length;

    return {
      shiftLogs: { total: allShifts.length, active: activeShifts, today: todayShifts },
      safetyRounds: { total: allSafety.length, today: todaySafety, followUpNeeded: safetyFollowUp },
      youthCareLogs: { total: allCare.length, today: todayCare, followUpNeeded: careFollowUp },
      incidents: { total: allIncidents.length, open: openIncidents, critical: criticalIncidents },
      supervisionNotes: { total: allSupervision.length, pendingAcknowledgment: pendingAck },
      shiftHandoffs: { total: allHandoffs.length, pending: pendingHandoffs },
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedResidentialData: adminQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    const db = getDb();
    const now = nowIso();
    const today = now.split("T")[0];

    // Seed shift log
    const shiftId = randomUUID();
    await db.insert(shiftLogs).values({
      id: shiftId,
      shiftDate: today,
      shiftType: "day",
      staffName: "Synthetic Staff 01",
      staffId: "user-rcs-001",
      supervisorName: "Michael Roberts",
      clockInAt: `${today}T07:00:00Z`,
      clockOutAt: null,
      entriesJson: JSON.stringify([
        { time: `${today}T07:00:00Z`, category: "shift_start", note: "Shift started. Full coverage." },
        { time: `${today}T08:30:00Z`, category: "medication", note: "Morning med pass completed." },
        { time: `${today}T10:00:00Z`, category: "safety_round", note: "Morning safety round completed." },
      ]),
      safetyRoundsCompleted: 2,
      careLogsCompleted: 3,
      incidentsReported: 0,
      medicationsAdministered: 12,
      status: "active",
      notes: "Normal operations day.",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Seed safety rounds
    const areas = ["Common Area", "Kitchen / Dining", "Hallways", "Bedrooms", "Bathrooms", "Outdoor Yard", "Medication Room", "Laundry Room"];
    for (let i = 0; i < areas.length; i++) {
      await db.insert(safetyRounds).values({
        id: randomUUID(),
        shiftId,
        shiftDate: today,
        shiftType: "day",
        area: areas[i],
        areaOrder: i,
        item1NoHazards: true,
        item2LightingWorking: true,
        item3EmergencyExitsClear: true,
        item4FireExtinguishersOk: true,
        item5NoContraband: true,
        item6CleanSanitary: true,
        item7EquipmentSecure: true,
        item8YouthAreasSafe: true,
        allItemsPassed: true,
        itemsPassed: 8,
        itemsTotal: 8,
        hazardsFound: null,
        correctiveAction: null,
        requiresFollowUp: false,
        completedBy: "Synthetic Staff 01",
        completedById: "user-rcs-001",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }

    // Seed youth care logs
    const careLogsData = [
      { youthId: "youth-001", youthName: "Synthetic Youth 001", mrn: "SYNTH-REC-001", careType: "daily_living" as const, description: "Assisted with morning hygiene routine. Youth cooperative and in good mood." },
      { youthId: "youth-002", youthName: "Synthetic Youth 005", mrn: "SYNTH-REC-002", careType: "educational" as const, description: "Completed math homework with tutoring support. Engaged well with material." },
      { youthId: "youth-003", youthName: "Synthetic Youth 014", mrn: "SYNTH-REC-003", careType: "behavioral" as const, description: "Participated in coping skills group. Practiced breathing exercises." },
    ];
    for (const cl of careLogsData) {
      await db.insert(youthCareLogs).values({
        id: randomUUID(),
        youthId: cl.youthId,
        youthName: cl.youthName,
        mrn: cl.mrn,
        shiftId,
        logDate: today,
        shiftType: "day",
        careType: cl.careType,
        description: cl.description,
        observations: null,
        youthResponse: "Positive engagement",
        outcome: "Goal progress noted",
        followUpNeeded: false,
        recordedBy: "Synthetic Staff 01",
        recordedById: "user-rcs-001",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }

    // Seed incident report
    const incidentId = randomUUID();
    await db.insert(incidentReports).values({
      id: incidentId,
      incidentNumber: "INC-GRO-2026-0001",
      incidentType: "behavioral",
      severity: "medium",
      status: "open",
      youthId: "youth-003",
      youthName: "Synthetic Youth 014",
      mrn: "SYNTH-REC-003",
      occurredAt: `${today}T14:30:00Z`,
      occurredLocation: "Common Area - East Wing",
      description: "Youth became frustrated during group activity and knocked over a chair. De-escalated within 5 minutes using verbal redirection. No injuries.",
      immediateAction: "Removed youth to quiet room. Provided space and time. Checked in after 10 minutes.",
      factors: "Transition from high-energy activity to seated group time.",
      reportedBy: "Synthetic Staff 04",
      reportedById: "user-rcs-002",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Seed supervision note
    await db.insert(supervisionNotes).values({
      id: randomUUID(),
      supervisionDate: today,
      supervisionType: "individual",
      supervisorName: "Michael Roberts",
      supervisorId: "user-super-001",
      superviseeName: "Synthetic Staff 01",
      superviseeId: "user-rcs-001",
      topicsDiscussed: "Reviewed crisis intervention techniques. Discussed strategies for supporting youth with trauma history.",
      staffConcerns: "Feeling overwhelmed with new youth admissions.",
      performanceObservations: "Consistently demonstrates empathy and patience. Documentation is thorough.",
      trainingNeeds: "Advanced de-escalation training recommended.",
      goalsSet: "Complete trauma-informed care certification by end of Q3.",
      actionItems: JSON.stringify([{ task: "Enroll in TIC training", due: "2026-07-15" }, { task: "Shadow senior RCS on intake", due: "2026-07-10" }]),
      followUpRequired: true,
      followUpDate: `${today.split("-")[0]}-${today.split("-")[1]}-15`,
      followUpTopics: "Check progress on TIC training enrollment. Review intake shadow experience.",
      relatedIncidentId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: "user-super-001",
    }).onConflictDoNothing();

    // Seed shift handoff
    await db.insert(shiftHandoffs).values({
      id: randomUUID(),
      fromShiftId: shiftId,
      handoffDate: today,
      fromStaffName: "Synthetic Staff 01",
      toStaffName: "Synthetic Staff 04",
      youthStatusJson: JSON.stringify([
        { youthId: "youth-001", name: "Synthetic Youth 001", status: "stable", concerns: "None" },
        { youthId: "youth-002", name: "Synthetic Youth 005", status: "stable", concerns: "Guardian visit scheduled tomorrow" },
        { youthId: "youth-003", name: "Synthetic Youth 014", status: "monitoring", concerns: "Behavioral incident at 14:30 - follow up recommended" },
      ]),
      pendingItems: "Guardian visit for Synthetic-Person-005 tomorrow 10am; Synthetic-Person-014 behavioral follow-up; Med pass log review",
      medicationUpdates: "All meds administered on time. No issues.",
      appointmentReminders: "Synthetic-Person-005 guardian visit 7/6 at 10am",
      highPriorityAlerts: "Synthetic Youth 014 - behavioral incident requires follow-up in evening shift",
      safetyAlerts: "None",
      generalNotes: "Quiet day overall. All safety rounds completed. 3 care logs entered.",
      status: "completed",
      completedAt: `${today}T15:00:00Z`,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    return { success: true, message: "GRO residential data seeded: 1 shift log, 8 safety rounds, 3 care logs, 1 incident, 1 supervision note, 1 handoff" };
  }),
});
