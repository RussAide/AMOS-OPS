import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M16: Residential Operations Router ──────────────────────

export const m18Router = createRouter({
  // ─── Bed Census ────────────────────────────────────────────
  getBedCensus: authedQuery.query(async () => {
    const rows = sqlite.prepare("SELECT * FROM bed_census ORDER BY room_number, bed_letter").all() ?? [];
    return rows;
  }),

  assignBed: authedQuery
    .input(z.object({ bedId: z.string(), youthId: z.string(), youthName: z.string(), mrn: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();
      // Clear any existing bed assignment for this youth
      sqlite.prepare("UPDATE bed_census SET is_occupied = 0, youth_id = NULL, youth_name = NULL, mrn = NULL, assigned_date = NULL WHERE youth_id = ?").run(input.youthId);
      sqlite.prepare("UPDATE bed_census SET is_occupied = 1, youth_id = ?, youth_name = ?, mrn = ?, assigned_date = ?, updated_at = ? WHERE id = ?")
        .run(input.youthId, input.youthName, input.mrn, now, now, input.bedId);
      // Update youth profile
      sqlite.prepare("UPDATE youth_profiles SET bed_assignment = (SELECT bed_name FROM bed_census WHERE id = ?), updated_at = ? WHERE id = ?")
        .run(input.bedId, now, input.youthId);
      auditLog({ action: "m16:assignBed", actor, resource: `bed:${input.bedId}`, details: `Assigned ${input.youthName} to bed` });
      return { success: true };
    }),

  // ─── Shifts ────────────────────────────────────────────────
  listShifts: authedQuery
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM shifts WHERE 1=1";
      const params: any[] = [];
      if (input?.date) { sql += " AND shift_date = ?"; params.push(input.date); }
      sql += " ORDER BY shift_date DESC, start_time DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  createShift: authedQuery
    .input(z.object({ shiftDate: z.string(), shiftType: z.enum(["day", "evening", "night", "overnight"]), startTime: z.string(), endTime: z.string(), rcsLeadName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO shifts (id, shift_date, shift_type, start_time, end_time, rcs_lead_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.shiftDate, input.shiftType, input.startTime, input.endTime, input.rcsLeadName ?? null, "scheduled", now, now);
      auditLog({ action: "m16:createShift", actor, resource: `shift:${id}` });
      return { id, ...input, createdAt: now };
    }),

  // ─── Shift Handoffs ────────────────────────────────────────
  getHandoff: authedQuery
    .input(z.object({ shiftDate: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite.prepare("SELECT * FROM shift_handoffs WHERE handoff_date = ? ORDER BY created_at DESC LIMIT 1").get(input.shiftDate);
      return row ?? null;
    }),

  createHandoff: authedQuery
    .input(z.object({ fromShiftId: z.string(), handoffDate: z.string(), fromStaffName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO shift_handoffs (id, from_shift_id, handoff_date, from_staff_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.fromShiftId, input.handoffDate, input.fromStaffName, "pending", now, now);
      auditLog({ action: "m16:createHandoff", actor, resource: `handoff:${id}` });
      return { id, ...input, createdAt: now };
    }),

  // ─── Behavioral Observations ───────────────────────────────
  listBehavioralObs: authedQuery
    .input(z.object({ youthId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM behavioral_observations WHERE 1=1";
      const params: any[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      sql += " ORDER BY observation_date DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  createBehavioralObs: authedQuery
    .input(z.object({
      youthId: z.string(), youthName: z.string(), mrn: z.string(),
      observationDate: z.string(), observedBy: z.string(),
      behaviorType: z.string(), frequency: z.enum(["single", "intermittent", "continuous"]).optional(),
      intensity: z.enum(["mild", "moderate", "severe"]).optional(), duration: z.string().optional(),
      triggers: z.string().optional(), interventionUsed: z.string().optional(),
      outcome: z.string().optional(), followUpNeeded: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO behavioral_observations (id, youth_id, youth_name, mrn, observation_date, observed_by, behavior_type, frequency, intensity, duration, triggers, intervention_used, outcome, follow_up_needed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.youthId, input.youthName, input.mrn, input.observationDate, input.observedBy ?? actor, input.behaviorType, input.frequency ?? null, input.intensity ?? null, input.duration ?? null, input.triggers ?? null, input.interventionUsed ?? null, input.outcome ?? null, input.followUpNeeded ? 1 : 0, now, now);
      auditLog({ action: "m16:createBehavioralObs", actor, resource: `behobs:${id}` });
      return { id, ...input, createdAt: now };
    }),

  // ─── Milieu Notes ──────────────────────────────────────────
  listMilieuNotes: authedQuery
    .input(z.object({ youthId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM milieu_notes WHERE 1=1";
      const params: any[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      sql += " ORDER BY note_date DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  // ─── Family Contacts ───────────────────────────────────────
  listFamilyContacts: authedQuery
    .input(z.object({ youthId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM family_contacts WHERE 1=1";
      const params: any[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      sql += " ORDER BY contact_date DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  createFamilyContact: authedQuery
    .input(z.object({
      youthId: z.string(), youthName: z.string(), mrn: z.string(),
      contactDate: z.string(), contactType: z.enum(["phone_call", "video_call", "in_person_visit", "letter", "email", "family_therapy", "education_session"]),
      contactedPerson: z.string(), relationship: z.string().optional(), topicsDiscussed: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO family_contacts (id, youth_id, youth_name, mrn, contact_date, contact_type, contacted_person, relationship, topics_discussed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.youthId, input.youthName, input.mrn, input.contactDate, input.contactType, input.contactedPerson, input.relationship ?? null, input.topicsDiscussed ?? null, now, now);
      auditLog({ action: "m16:createFamilyContact", actor, resource: `family:${id}` });
      return { id, ...input, createdAt: now };
    }),

  // ─── Restrictive Interventions ─────────────────────────────
  listRestrictiveInt: authedQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM restrictive_interventions ORDER BY incident_date DESC").all() ?? [];
  }),

  // ─── Residential Dashboard Summary ─────────────────────────
  residentialSummary: authedQuery.query(async () => {
    const totalBeds = sqlite.prepare("SELECT COUNT(*) as c FROM bed_census").get() as any;
    const occupiedBeds = sqlite.prepare("SELECT COUNT(*) as c FROM bed_census WHERE is_occupied = 1").get() as any;
    const todaysShifts = sqlite.prepare("SELECT COUNT(*) as c FROM shifts WHERE shift_date = date('now')").get() as any;
    const pendingHandoffs = sqlite.prepare("SELECT COUNT(*) as c FROM shift_handoffs WHERE status = 'pending'").get() as any;
    const todaysBehavioral = sqlite.prepare("SELECT COUNT(*) as c FROM behavioral_observations WHERE observation_date = date('now')").get() as any;
    const openFamilyContacts = sqlite.prepare("SELECT COUNT(*) as c FROM family_contacts WHERE follow_up_needed = 1").get() as any;
    const pendingDebriefs = sqlite.prepare("SELECT COUNT(*) as c FROM restrictive_interventions WHERE debrief_completed = 0").get() as any;

    return {
      totalBeds: totalBeds?.c ?? 0,
      occupiedBeds: occupiedBeds?.c ?? 0,
      availableBeds: (totalBeds?.c ?? 0) - (occupiedBeds?.c ?? 0),
      occupancyRate: totalBeds?.c > 0 ? Math.round((occupiedBeds?.c / totalBeds?.c) * 100) : 0,
      todaysShifts: todaysShifts?.c ?? 0,
      pendingHandoffs: pendingHandoffs?.c ?? 0,
      todaysBehavioral: todaysBehavioral?.c ?? 0,
      openFamilyContacts: openFamilyContacts?.c ?? 0,
      pendingDebriefs: pendingDebriefs?.c ?? 0,
    };
  }),
});
