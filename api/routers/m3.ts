import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import {
  audits as auditsTable, incidents as incidentsTable, correctiveActions as correctiveActionsTable,
  evidenceMatrix as evidenceMatrixTable, complianceMemos as complianceMemosTable, deficiencyTracking as deficiencyTrackingTable,
} from "@db/schema";
import { eq, like, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

const syntheticComplianceFixturesEnabled = (() => {
  try {
    assertSyntheticScenarioRuntime(env);
    return true;
  } catch {
    return false;
  }
})();

// ─── M3: QA & Compliance — AMOS-Sentinel ───────────────────

async function getSentinelMetrics() {
  const db = getDb();
  const [audits, correctiveActions, deficiencies, incidents] = await Promise.all([
    db.select().from(auditsTable).all(),
    db.select().from(correctiveActionsTable).all(),
    db.select().from(deficiencyTrackingTable).all(),
    db.select().from(incidentsTable).all(),
  ]);
  const now = Date.now();
  const scoredAudits = audits.filter((audit) => audit.score !== null);
  const complianceScore = scoredAudits.length > 0
    ? Math.round(scoredAudits.reduce((sum, audit) => sum + (audit.score ?? 0), 0) / scoredAudits.length)
    : 0;
  const overdueCAPs = correctiveActions.filter((action) => {
    if (action.status === "completed") return false;
    if (action.status === "overdue") return true;
    return new Date(action.dueDate).getTime() < now;
  }).length;
  const openFindings = deficiencies.filter((deficiency) => (
    deficiency.status !== "verified" && deficiency.status !== "closed"
  )).length;
  const unresolvedRisks = incidents.filter((incident) => (
    (incident.status === "open" || incident.status === "under_investigation")
    && (incident.severity === "high" || incident.severity === "critical")
  )).length;

  return { score: complianceScore, overdueCAPs, openFindings, unresolvedRisks };
}

export const m3Router = createRouter({
  // ─── Audits ────────────────────────────────────────────────
  listAudits: authedQuery
    .input(z.object({
      status: z.enum(["planned", "in_progress", "pending_review", "completed", "closed"]).optional(),
      type: z.enum(["internal", "external", "regulatory", "peer_review", "random"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(auditsTable.status, input.status));
      if (input?.type) conditions.push(eq(auditsTable.auditType, input.type));
      if (input?.search) {
        conditions.push(or(like(auditsTable.title, `%${input.search}%`), like(auditsTable.auditNumber, `%${input.search}%`)));
      }
      const results = conditions.length > 0
        ? await db.select().from(auditsTable).where(and(...conditions)).orderBy(desc(auditsTable.createdAt)).all()
        : await db.select().from(auditsTable).orderBy(desc(auditsTable.createdAt)).all();
      return results;
    }),

  getAudit: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const audit = await db.select().from(auditsTable).where(eq(auditsTable.id, input.id)).get();
      if (!audit) throw new Error("Audit not found");
      return audit;
    }),

  createAudit: authedQuery
    .input(z.object({
      auditNumber: z.string(),
      title: z.string().min(1),
      auditType: z.enum(["internal", "external", "regulatory", "peer_review", "random"]),
      scope: z.string().min(1),
      department: z.string().optional(),
      assignedAuditorId: z.string().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(auditsTable).values({
        id, auditNumber: input.auditNumber, title: input.title,
        auditType: input.auditType, scope: input.scope,
        department: input.department ?? null,
        assignedAuditorId: input.assignedAuditorId ?? null,
        status: "planned", findingsJson: "[]", score: null,
        startedAt: null, completedAt: null, dueDate: input.dueDate ?? null,
        createdAt: now, updatedAt: now,
      });

      auditLog({ action: "m3:createAudit", actor, resource: `audit:${input.auditNumber}`, details: `Created audit: ${input.title}` });
      return { success: true, id };
    }),

  updateAudit: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      scope: z.string().optional(),
      status: z.enum(["planned", "in_progress", "pending_review", "completed", "closed"]).optional(),
      findingsJson: z.string().optional(),
      score: z.number().optional(),
      assignedAuditorId: z.string().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...updates } = input;
      const updateData: Partial<typeof auditsTable.$inferInsert> = { updatedAt: new Date().toISOString() };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.scope !== undefined) updateData.scope = updates.scope;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === "in_progress") updateData.startedAt = new Date().toISOString();
        if (updates.status === "completed" || updates.status === "closed") updateData.completedAt = new Date().toISOString();
      }
      if (updates.findingsJson !== undefined) updateData.findingsJson = updates.findingsJson;
      if (updates.score !== undefined) updateData.score = updates.score;
      if (updates.assignedAuditorId !== undefined) updateData.assignedAuditorId = updates.assignedAuditorId;
      if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;

      await db.update(auditsTable).set(updateData).where(eq(auditsTable.id, id));
      auditLog({ action: "m3:updateAudit", actor, resource: `audit:${id}`, details: `Updated audit` });
      return { success: true };
    }),

  deleteAudit: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      await db.delete(auditsTable).where(eq(auditsTable.id, input.id));
      auditLog({ action: "m3:deleteAudit", actor, resource: `audit:${input.id}`, details: `Deleted audit` });
      return { success: true };
    }),

  // ─── Incidents ─────────────────────────────────────────────
  listIncidents: authedQuery
    .input(z.object({
      status: z.enum(["open", "under_investigation", "resolved", "closed"]).optional(),
      severity: z.enum(["low", "moderate", "high", "critical"]).optional(),
      type: z.enum(["medication_error", "fall", "behavioral", "clinical_error", "equipment", "environmental", "other"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(incidentsTable.status, input.status));
      if (input?.severity) conditions.push(eq(incidentsTable.severity, input.severity));
      if (input?.type) conditions.push(eq(incidentsTable.incidentType, input.type));
      if (input?.search) conditions.push(or(like(incidentsTable.title, `%${input.search}%`), like(incidentsTable.incidentNumber, `%${input.search}%`)));
      const results = conditions.length > 0
        ? await db.select().from(incidentsTable).where(and(...conditions)).orderBy(desc(incidentsTable.createdAt)).all()
        : await db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt)).all();
      return results;
    }),

  getIncident: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const incident = await db.select().from(incidentsTable).where(eq(incidentsTable.id, input.id)).get();
      if (!incident) throw new Error("Incident not found");
      return incident;
    }),

  createIncident: authedQuery
    .input(z.object({
      incidentNumber: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      incidentType: z.enum(["medication_error", "fall", "behavioral", "clinical_error", "equipment", "environmental", "other"]),
      severity: z.enum(["low", "moderate", "high", "critical"]),
      patientId: z.string().optional(),
      assignedTo: z.string().optional(),
      occurredAt: z.string(),
      followUpRequired: z.boolean().default(false),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(incidentsTable).values({
        id, incidentNumber: input.incidentNumber, title: input.title,
        description: input.description, incidentType: input.incidentType,
        severity: input.severity, status: "open",
        patientId: input.patientId ?? null,
        reportedBy: actor, assignedTo: input.assignedTo ?? null,
        occurredAt: input.occurredAt, resolvedAt: null,
        resolutionNotes: null, followUpRequired: input.followUpRequired,
        followUpDate: input.followUpDate ?? null, createdAt: now, updatedAt: now,
      });

      auditLog({ action: "m3:createIncident", actor, resource: `incident:${input.incidentNumber}`, details: `Created incident: ${input.title}` });
      return { success: true, id };
    }),

  updateIncident: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["open", "under_investigation", "resolved", "closed"]).optional(),
      severity: z.enum(["low", "moderate", "high", "critical"]).optional(),
      resolutionNotes: z.string().optional(),
      assignedTo: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...updates } = input;
      const updateData: Partial<typeof incidentsTable.$inferInsert> = { updatedAt: new Date().toISOString() };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === "resolved" || updates.status === "closed") updateData.resolvedAt = new Date().toISOString();
      }
      if (updates.severity !== undefined) updateData.severity = updates.severity;
      if (updates.resolutionNotes !== undefined) updateData.resolutionNotes = updates.resolutionNotes;
      if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
      if (updates.followUpRequired !== undefined) updateData.followUpRequired = updates.followUpRequired;
      if (updates.followUpDate !== undefined) updateData.followUpDate = updates.followUpDate;

      await db.update(incidentsTable).set(updateData).where(eq(incidentsTable.id, id));
      auditLog({ action: "m3:updateIncident", actor, resource: `incident:${id}`, details: `Updated incident` });
      return { success: true };
    }),

  // ─── Corrective Actions ────────────────────────────────────
  listCorrectiveActions: authedQuery
    .input(z.object({
      status: z.enum(["open", "in_progress", "pending_verification", "completed", "overdue"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(correctiveActionsTable.status, input.status));
      if (input?.priority) conditions.push(eq(correctiveActionsTable.priority, input.priority));
      if (input?.search) conditions.push(or(like(correctiveActionsTable.title, `%${input.search}%`), like(correctiveActionsTable.actionNumber, `%${input.search}%`)));
      const results = conditions.length > 0
        ? await db.select().from(correctiveActionsTable).where(and(...conditions)).orderBy(desc(correctiveActionsTable.createdAt)).all()
        : await db.select().from(correctiveActionsTable).orderBy(desc(correctiveActionsTable.createdAt)).all();
      return results;
    }),

  getCorrectiveAction: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const action = await db.select().from(correctiveActionsTable).where(eq(correctiveActionsTable.id, input.id)).get();
      if (!action) throw new Error("Corrective action not found");
      return action;
    }),

  createCorrectiveAction: authedQuery
    .input(z.object({
      actionNumber: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      relatedAuditId: z.string().optional(),
      relatedIncidentId: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      assignedTo: z.string(),
      dueDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(correctiveActionsTable).values({
        id, actionNumber: input.actionNumber, title: input.title,
        description: input.description,
        relatedAuditId: input.relatedAuditId ?? null,
        relatedIncidentId: input.relatedIncidentId ?? null,
        priority: input.priority, status: "open", assignedTo: input.assignedTo,
        dueDate: input.dueDate, completedAt: null, completionNotes: null,
        verifiedBy: null, verifiedAt: null, createdAt: now, updatedAt: now,
      });

      auditLog({ action: "m3:createCAPA", actor, resource: `capa:${input.actionNumber}`, details: `Created CAPA: ${input.title}` });
      return { success: true, id };
    }),

  updateCorrectiveAction: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["open", "in_progress", "pending_verification", "completed", "overdue"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      completionNotes: z.string().optional(),
      assignedTo: z.string().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...updates } = input;
      const updateData: Partial<typeof correctiveActionsTable.$inferInsert> = { updatedAt: new Date().toISOString() };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === "completed") updateData.completedAt = new Date().toISOString();
      }
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.completionNotes !== undefined) updateData.completionNotes = updates.completionNotes;
      if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
      if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;

      await db.update(correctiveActionsTable).set(updateData).where(eq(correctiveActionsTable.id, id));
      auditLog({ action: "m3:updateCAPA", actor, resource: `capa:${id}`, details: `Updated CAPA` });
      return { success: true };
    }),

  // ─── Dashboard KPIs ────────────────────────────────────────
  dashboardKPIs: publicQuery.query(async () => {
    const db = getDb();
    const allAudits = await db.select().from(auditsTable).all();
    const allIncidents = await db.select().from(incidentsTable).all();
    const allActions = await db.select().from(correctiveActionsTable).all();

    const totalAudits = allAudits.length;
    const openAudits = allAudits.filter((a) => a.status === "in_progress" || a.status === "planned").length;
    const completedAudits = allAudits.filter((a) => a.status === "completed" || a.status === "closed").length;
    const avgScore = totalAudits > 0
      ? Math.round(allAudits.reduce((sum, a) => sum + (a.score ?? 0), 0) / totalAudits)
      : 0;

    const totalIncidents = allIncidents.length;
    const openIncidents = allIncidents.filter((i) => i.status === "open" || i.status === "under_investigation").length;
    const criticalIncidents = allIncidents.filter((i) => i.severity === "critical").length;

    const totalCAPAs = allActions.length;
    const openCAPAs = allActions.filter((a) => a.status === "open" || a.status === "in_progress").length;
    const overdueCAPAs = allActions.filter((a) => {
      if (a.status === "completed" || a.status === "overdue") return false;
      if (!a.dueDate) return false;
      return new Date(a.dueDate) < new Date();
    }).length;
    const highPriorityCAPAs = allActions.filter((a) => a.priority === "high" || a.priority === "urgent").length;

    return {
      totalAudits, openAudits, completedAudits, avgScore,
      totalIncidents, openIncidents, criticalIncidents,
      totalCAPAs, openCAPAs, overdueCAPAs, highPriorityCAPAs,
    };
  }),

  sentinel: authedQuery.query(async () => getSentinelMetrics()),

  complianceScore: authedQuery.query(async () => {
    const metrics = await getSentinelMetrics();
    return metrics.score;
  }),

  // ─── Compliance Scores ─────────────────────────────────────
  complianceScores: publicQuery.query(async () => {
    if (!syntheticComplianceFixturesEnabled) return [];
    // In a real system, these would be calculated from audit findings
    // For now, return structured compliance area data
    return [
      { area: "HIPAA Privacy", score: 98, status: "compliant", lastAudited: "2026-06-15" },
      { area: "HIPAA Security", score: 96, status: "compliant", lastAudited: "2026-06-10" },
      { area: "42 CFR Part 2", score: 100, status: "compliant", lastAudited: "2026-06-20" },
      { area: "State Licensure", score: 92, status: "warning", lastAudited: "2026-05-28" },
      { area: "Staff Credentials", score: 88, status: "warning", lastAudited: "2026-06-01" },
      { area: "Incident Reporting", score: 100, status: "compliant", lastAudited: "2026-06-25" },
      { area: "Medication Management", score: 95, status: "compliant", lastAudited: "2026-06-18" },
      { area: "Youth Rights", score: 97, status: "compliant", lastAudited: "2026-06-12" },
    ];
  }),

  // ════════════════════════════════════════════════════════════
  // FEATURE 1: CAP TRACKER (Corrective Action Plans)
  // ════════════════════════════════════════════════════════════

  capList: authedQuery
    .input(z.object({
      status: z.enum(["open", "in_progress", "pending_verification", "completed", "overdue"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(correctiveActionsTable.status, input.status));
      if (input?.priority) conditions.push(eq(correctiveActionsTable.priority, input.priority));
      if (input?.search) {
        conditions.push(or(
          like(correctiveActionsTable.title, `%${input.search}%`),
          like(correctiveActionsTable.actionNumber, `%${input.search}%`)
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(correctiveActionsTable).where(and(...conditions)).orderBy(desc(correctiveActionsTable.createdAt)).all()
        : await db.select().from(correctiveActionsTable).orderBy(desc(correctiveActionsTable.createdAt)).all();
      return results;
    }),

  capDetail: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const action = await db.select().from(correctiveActionsTable).where(eq(correctiveActionsTable.id, input.id)).get();
      if (!action) throw new Error("CAP not found");
      return action;
    }),

  capCreate: authedQuery
    .input(z.object({
      actionNumber: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      relatedAuditId: z.string().optional(),
      relatedIncidentId: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      assignedTo: z.string(),
      dueDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(correctiveActionsTable).values({
        id, actionNumber: input.actionNumber, title: input.title,
        description: input.description,
        relatedAuditId: input.relatedAuditId ?? null,
        relatedIncidentId: input.relatedIncidentId ?? null,
        priority: input.priority, status: "open", assignedTo: input.assignedTo,
        dueDate: input.dueDate, completedAt: null, completionNotes: null,
        verifiedBy: null, verifiedAt: null, createdAt: now, updatedAt: now,
      });
      auditLog({ action: "m3:capCreate", actor, resource: `cap:${input.actionNumber}`, details: `Created CAP: ${input.title}` });
      return { success: true, id };
    }),

  capUpdateStatus: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "in_progress", "pending_verification", "completed", "overdue"]),
      completionNotes: z.string().optional(),
      verifiedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updateData: Partial<typeof correctiveActionsTable.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (fields.status) {
        updateData.status = fields.status;
        if (fields.status === "completed") updateData.completedAt = new Date().toISOString();
      }
      if (fields.completionNotes !== undefined) updateData.completionNotes = fields.completionNotes;
      if (fields.verifiedBy !== undefined) {
        updateData.verifiedBy = fields.verifiedBy;
        updateData.verifiedAt = new Date().toISOString();
      }
      await db.update(correctiveActionsTable).set(updateData).where(eq(correctiveActionsTable.id, id));
      auditLog({ action: "m3:capUpdate", actor, resource: `cap:${id}`, details: `CAP status: ${fields.status}` });
      return { success: true };
    }),

  capStats: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(correctiveActionsTable).all();
    const open = all.filter((a) => a.status === "open" || a.status === "in_progress").length;
    const overdue = all.filter((a) => a.status === "overdue").length;
    const pendingVerification = all.filter((a) => a.status === "pending_verification").length;
    const completed = all.filter((a) => a.status === "completed").length;
    const byPriority = {
      low: all.filter((a) => a.priority === "low").length,
      medium: all.filter((a) => a.priority === "medium").length,
      high: all.filter((a) => a.priority === "high").length,
      urgent: all.filter((a) => a.priority === "urgent").length,
    };
    return { total: all.length, open, overdue, pendingVerification, completed, byPriority };
  }),

  // ════════════════════════════════════════════════════════════
  // FEATURE 2: AUDIT BINDER
  // ════════════════════════════════════════════════════════════

  auditBinderList: authedQuery
    .input(z.object({
      status: z.enum(["planned", "in_progress", "pending_review", "completed", "closed"]).optional(),
      type: z.enum(["internal", "external", "regulatory", "peer_review", "random"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(auditsTable.status, input.status));
      if (input?.type) conditions.push(eq(auditsTable.auditType, input.type));
      if (input?.search) {
        conditions.push(or(
          like(auditsTable.title, `%${input.search}%`),
          like(auditsTable.auditNumber, `%${input.search}%`)
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(auditsTable).where(and(...conditions)).orderBy(desc(auditsTable.createdAt)).all()
        : await db.select().from(auditsTable).orderBy(desc(auditsTable.createdAt)).all();
      return results;
    }),

  auditBinderDetail: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const audit = await db.select().from(auditsTable).where(eq(auditsTable.id, input.id)).get();
      if (!audit) throw new Error("Audit not found");
      // Get related CAPs
      const caps = await db.select().from(correctiveActionsTable).where(eq(correctiveActionsTable.relatedAuditId, input.id)).all();
      // Get related deficiencies
      const defs = await db.select().from(deficiencyTrackingTable).where(eq(deficiencyTrackingTable.relatedAuditId, input.id)).all();
      return { ...audit, relatedCAPs: caps, relatedDeficiencies: defs };
    }),

  auditBinderCreate: authedQuery
    .input(z.object({
      auditNumber: z.string(),
      title: z.string().min(1),
      auditType: z.enum(["internal", "external", "regulatory", "peer_review", "random"]),
      scope: z.string().min(1),
      department: z.string().optional(),
      assignedAuditorId: z.string().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(auditsTable).values({
        id, auditNumber: input.auditNumber, title: input.title,
        auditType: input.auditType, scope: input.scope,
        department: input.department ?? null,
        assignedAuditorId: input.assignedAuditorId ?? null,
        status: "planned", findingsJson: "[]", score: null,
        startedAt: null, completedAt: null, dueDate: input.dueDate ?? null,
        createdAt: now, updatedAt: now,
      });
      auditLog({ action: "m3:auditBinderCreate", actor, resource: `audit:${input.auditNumber}`, details: `Created audit: ${input.title}` });
      return { success: true, id };
    }),

  auditBinderUpdate: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      status: z.enum(["planned", "in_progress", "pending_review", "completed", "closed"]).optional(),
      findingsJson: z.string().optional(),
      score: z.number().optional(),
      assignedAuditorId: z.string().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updateData: Partial<typeof auditsTable.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.status !== undefined) {
        updateData.status = fields.status;
        if (fields.status === "in_progress") updateData.startedAt = new Date().toISOString();
        if (fields.status === "completed" || fields.status === "closed") updateData.completedAt = new Date().toISOString();
      }
      if (fields.findingsJson !== undefined) updateData.findingsJson = fields.findingsJson;
      if (fields.score !== undefined) updateData.score = fields.score;
      if (fields.assignedAuditorId !== undefined) updateData.assignedAuditorId = fields.assignedAuditorId;
      if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate;
      await db.update(auditsTable).set(updateData).where(eq(auditsTable.id, id));
      auditLog({ action: "m3:auditBinderUpdate", actor, resource: `audit:${id}`, details: `Updated audit` });
      return { success: true };
    }),

  auditBinderStats: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(auditsTable).all();
    const planned = all.filter((a) => a.status === "planned").length;
    const inProgress = all.filter((a) => a.status === "in_progress").length;
    const completed = all.filter((a) => a.status === "completed" || a.status === "closed").length;
    const pendingReview = all.filter((a) => a.status === "pending_review").length;
    const avgScore = all.length > 0
      ? Math.round(all.reduce((sum, a) => sum + (a.score ?? 0), 0) / all.length)
      : 0;
    return { total: all.length, planned, inProgress, completed, pendingReview, avgScore };
  }),

  // ════════════════════════════════════════════════════════════
  // FEATURE 3: EVIDENCE MATRIX
  // ════════════════════════════════════════════════════════════

  evidenceList: authedQuery
    .input(z.object({
      status: z.enum(["active", "under_review", "expired", "superseded", "archived"]).optional(),
      category: z.enum(["policy", "procedure", "training_record", "audit_report", "incident_report", "credential", "risk_assessment", "other"]).optional(),
      complianceArea: z.enum(["hipaa_privacy", "hipaa_security", "cfr42_part2", "state_licensure", "staff_credentials", "incident_reporting", "medication_management", "youth_rights", "other"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(evidenceMatrixTable.status, input.status));
      if (input?.category) conditions.push(eq(evidenceMatrixTable.category, input.category));
      if (input?.complianceArea) conditions.push(eq(evidenceMatrixTable.complianceArea, input.complianceArea));
      if (input?.search) {
        conditions.push(or(
          like(evidenceMatrixTable.title, `%${input.search}%`),
          like(evidenceMatrixTable.evidenceNumber, `%${input.search}%`)
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(evidenceMatrixTable).where(and(...conditions)).orderBy(desc(evidenceMatrixTable.createdAt)).all()
        : await db.select().from(evidenceMatrixTable).orderBy(desc(evidenceMatrixTable.createdAt)).all();
      return results;
    }),

  evidenceDetail: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const item = await db.select().from(evidenceMatrixTable).where(eq(evidenceMatrixTable.id, input.id)).get();
      if (!item) throw new Error("Evidence not found");
      return item;
    }),

  evidenceCreate: authedQuery
    .input(z.object({
      evidenceNumber: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["policy", "procedure", "training_record", "audit_report", "incident_report", "credential", "risk_assessment", "other"]),
      complianceArea: z.enum(["hipaa_privacy", "hipaa_security", "cfr42_part2", "state_licensure", "staff_credentials", "incident_reporting", "medication_management", "youth_rights", "other"]),
      sourceType: z.enum(["document", "system_log", "interview", "observation", "external_report", "photo", "other"]),
      sourceReference: z.string().optional(),
      department: z.string().optional(),
      evidenceDate: z.string(),
      expirationDate: z.string().optional(),
      relatedAuditId: z.string().optional(),
      relatedAuditNumber: z.string().optional(),
      tagsJson: z.string().optional(),
      fileName: z.string().optional(),
      filePath: z.string().optional(),
      fileSize: z.number().optional(),
      fileType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(evidenceMatrixTable).values({
        id, evidenceNumber: input.evidenceNumber, title: input.title,
        description: input.description ?? null,
        category: input.category, complianceArea: input.complianceArea,
        sourceType: input.sourceType, sourceReference: input.sourceReference ?? null,
        department: input.department ?? null,
        evidenceDate: input.evidenceDate,
        expirationDate: input.expirationDate ?? null,
        relatedAuditId: input.relatedAuditId ?? null,
        relatedAuditNumber: input.relatedAuditNumber ?? null,
        tagsJson: input.tagsJson ?? "[]",
        fileName: input.fileName ?? null, filePath: input.filePath ?? null,
        fileSize: input.fileSize ?? null, fileType: input.fileType ?? null,
        status: "active", createdAt: now, updatedAt: now,
        createdBy: actor, createdById: ctx.user?.id ?? null,
      });
      auditLog({ action: "m3:evidenceCreate", actor, resource: `evidence:${input.evidenceNumber}`, details: `Created evidence: ${input.title}` });
      return { success: true, id };
    }),

  evidenceUpdate: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      status: z.enum(["active", "under_review", "expired", "superseded", "archived"]).optional(),
      reviewNotes: z.string().optional(),
      reviewedBy: z.string().optional(),
      reviewedById: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updateData: Partial<typeof evidenceMatrixTable.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.reviewNotes !== undefined) updateData.reviewNotes = fields.reviewNotes;
      if (fields.reviewedBy !== undefined) {
        updateData.reviewedBy = fields.reviewedBy;
        updateData.reviewedById = fields.reviewedById ?? null;
        updateData.reviewDate = new Date().toISOString();
      }
      await db.update(evidenceMatrixTable).set(updateData).where(eq(evidenceMatrixTable.id, id));
      auditLog({ action: "m3:evidenceUpdate", actor, resource: `evidence:${id}`, details: `Updated evidence` });
      return { success: true };
    }),

  evidenceStats: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(evidenceMatrixTable).all();
    const active = all.filter((e) => e.status === "active").length;
    const underReview = all.filter((e) => e.status === "under_review").length;
    const expired = all.filter((e) => e.status === "expired").length;
    const archived = all.filter((e) => e.status === "archived" || e.status === "superseded").length;
    return { total: all.length, active, underReview, expired, archived };
  }),

  // ════════════════════════════════════════════════════════════
  // FEATURE 4: COMPLIANCE MEMO GENERATOR
  // ════════════════════════════════════════════════════════════

  memoList: authedQuery
    .input(z.object({
      status: z.enum(["draft", "pending_review", "approved", "issued", "acknowledged", "superseded"]).optional(),
      priority: z.enum(["routine", "urgent", "emergency"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(complianceMemosTable.status, input.status));
      if (input?.priority) conditions.push(eq(complianceMemosTable.priority, input.priority));
      if (input?.search) {
        conditions.push(or(
          like(complianceMemosTable.title, `%${input.search}%`),
          like(complianceMemosTable.memoNumber, `%${input.search}%`)
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(complianceMemosTable).where(and(...conditions)).orderBy(desc(complianceMemosTable.createdAt)).all()
        : await db.select().from(complianceMemosTable).orderBy(desc(complianceMemosTable.createdAt)).all();
      return results;
    }),

  memoDetail: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const memo = await db.select().from(complianceMemosTable).where(eq(complianceMemosTable.id, input.id)).get();
      if (!memo) throw new Error("Memo not found");
      return memo;
    }),

  memoCreate: authedQuery
    .input(z.object({
      memoNumber: z.string(),
      title: z.string().min(1),
      subject: z.string().min(1),
      toRecipients: z.string(), // JSON string
      ccRecipients: z.string().optional(),
      fromName: z.string(),
      fromId: z.string(),
      fromTitle: z.string().optional(),
      body: z.string().min(1),
      findingsJson: z.string().optional(),
      recommendationsJson: z.string().optional(),
      referencesJson: z.string().optional(),
      relatedAuditId: z.string().optional(),
      relatedAuditNumber: z.string().optional(),
      relatedIncidentId: z.string().optional(),
      relatedIncidentNumber: z.string().optional(),
      relatedCapId: z.string().optional(),
      relatedCapNumber: z.string().optional(),
      memoDate: z.string(),
      priority: z.enum(["routine", "urgent", "emergency"]).optional(),
      classification: z.enum(["internal", "restricted", "confidential"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(complianceMemosTable).values({
        id, memoNumber: input.memoNumber, title: input.title,
        subject: input.subject, toRecipients: input.toRecipients,
        ccRecipients: input.ccRecipients ?? null,
        fromName: input.fromName, fromId: input.fromId,
        fromTitle: input.fromTitle ?? null,
        body: input.body,
        findingsJson: input.findingsJson ?? "[]",
        recommendationsJson: input.recommendationsJson ?? "[]",
        referencesJson: input.referencesJson ?? "[]",
        relatedAuditId: input.relatedAuditId ?? null,
        relatedAuditNumber: input.relatedAuditNumber ?? null,
        relatedIncidentId: input.relatedIncidentId ?? null,
        relatedIncidentNumber: input.relatedIncidentNumber ?? null,
        relatedCapId: input.relatedCapId ?? null,
        relatedCapNumber: input.relatedCapNumber ?? null,
        memoDate: input.memoDate,
        priority: input.priority ?? "routine",
        classification: input.classification ?? "internal",
        status: "draft", createdAt: now, updatedAt: now,
        createdBy: actor, createdById: ctx.user?.id ?? null,
      });
      auditLog({ action: "m3:memoCreate", actor, resource: `memo:${input.memoNumber}`, details: `Created memo: ${input.title}` });
      return { success: true, id };
    }),

  memoUpdate: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
      status: z.enum(["draft", "pending_review", "approved", "issued", "acknowledged", "superseded"]).optional(),
      reviewedBy: z.string().optional(),
      reviewedById: z.string().optional(),
      approvedBy: z.string().optional(),
      approvedById: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updateData: Partial<typeof complianceMemosTable.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.body !== undefined) updateData.body = fields.body;
      if (fields.status !== undefined) {
        updateData.status = fields.status;
        if (fields.status === "approved") {
          updateData.approvedBy = fields.approvedBy ?? actor;
          updateData.approvedById = fields.approvedById ?? ctx.user?.id ?? null;
          updateData.approvedAt = new Date().toISOString();
        }
        if (fields.status === "issued") {
          updateData.issuedAt = new Date().toISOString();
          updateData.issuedBy = actor;
        }
        if (fields.status === "pending_review") {
          updateData.reviewedBy = fields.reviewedBy ?? null;
          updateData.reviewedById = fields.reviewedById ?? null;
          updateData.reviewedAt = new Date().toISOString();
        }
      }
      await db.update(complianceMemosTable).set(updateData).where(eq(complianceMemosTable.id, id));
      auditLog({ action: "m3:memoUpdate", actor, resource: `memo:${id}`, details: `Updated memo status: ${fields.status}` });
      return { success: true };
    }),

  memoStats: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(complianceMemosTable).all();
    const draft = all.filter((m) => m.status === "draft").length;
    const pending = all.filter((m) => m.status === "pending_review").length;
    const approved = all.filter((m) => m.status === "approved").length;
    const issued = all.filter((m) => m.status === "issued" || m.status === "acknowledged").length;
    return { total: all.length, draft, pending, approved, issued };
  }),

  // ════════════════════════════════════════════════════════════
  // FEATURE 5: DEFICIENCY TRACKING
  // ════════════════════════════════════════════════════════════

  deficiencyList: authedQuery
    .input(z.object({
      status: z.enum(["open", "poc_pending", "poc_approved", "in_progress", "corrected", "verified", "closed"]).optional(),
      category: z.enum(["clinical_documentation", "safety", "staffing", "training", "facilities", "medication", "resident_rights", "infection_control", "administrative", "other"]).optional(),
      severity: z.enum(["citation", "standard", "element", "risk_only", "other"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.status) conditions.push(eq(deficiencyTrackingTable.status, input.status));
      if (input?.category) conditions.push(eq(deficiencyTrackingTable.category, input.category));
      if (input?.severity) conditions.push(eq(deficiencyTrackingTable.severity, input.severity));
      if (input?.search) {
        conditions.push(or(
          like(deficiencyTrackingTable.title, `%${input.search}%`),
          like(deficiencyTrackingTable.deficiencyNumber, `%${input.search}%`)
        ));
      }
      const results = conditions.length > 0
        ? await db.select().from(deficiencyTrackingTable).where(and(...conditions)).orderBy(desc(deficiencyTrackingTable.createdAt)).all()
        : await db.select().from(deficiencyTrackingTable).orderBy(desc(deficiencyTrackingTable.createdAt)).all();
      return results;
    }),

  deficiencyDetail: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const def = await db.select().from(deficiencyTrackingTable).where(eq(deficiencyTrackingTable.id, input.id)).get();
      if (!def) throw new Error("Deficiency not found");
      return def;
    }),

  deficiencyCreate: authedQuery
    .input(z.object({
      deficiencyNumber: z.string(),
      title: z.string().min(1),
      description: z.string().min(1),
      category: z.enum(["clinical_documentation", "safety", "staffing", "training", "facilities", "medication", "resident_rights", "infection_control", "administrative", "other"]),
      severity: z.enum(["citation", "standard", "element", "risk_only", "other"]),
      scope: z.enum(["isolated", "widespread", "pattern"]).optional(),
      sourceType: z.enum(["state_survey", "internal_audit", "complaint", "accreditation", "self_identified", "other"]),
      sourceReference: z.string().optional(),
      surveyTag: z.string().optional(),
      regulationCitation: z.string().optional(),
      tagNumber: z.string().optional(),
      department: z.string().optional(),
      facilityId: z.string().optional(),
      assignedTo: z.string().optional(),
      assignedToId: z.string().optional(),
      identifiedDate: z.string(),
      correctionDueDate: z.string(),
      relatedAuditId: z.string().optional(),
      relatedAuditNumber: z.string().optional(),
      pocDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      await db.insert(deficiencyTrackingTable).values({
        id, deficiencyNumber: input.deficiencyNumber, title: input.title,
        description: input.description,
        category: input.category, severity: input.severity,
        scope: input.scope ?? "isolated",
        sourceType: input.sourceType,
        sourceReference: input.sourceReference ?? null,
        surveyTag: input.surveyTag ?? null,
        regulationCitation: input.regulationCitation ?? null,
        tagNumber: input.tagNumber ?? null,
        department: input.department ?? null,
        facilityId: input.facilityId ?? null,
        assignedTo: input.assignedTo ?? null,
        assignedToId: input.assignedToId ?? null,
        identifiedDate: input.identifiedDate,
        correctionDueDate: input.correctionDueDate,
        relatedAuditId: input.relatedAuditId ?? null,
        relatedAuditNumber: input.relatedAuditNumber ?? null,
        pocDescription: input.pocDescription ?? null,
        status: "open", createdAt: now, updatedAt: now,
        createdBy: actor, createdById: ctx.user?.id ?? null,
      });
      auditLog({ action: "m3:deficiencyCreate", actor, resource: `deficiency:${input.deficiencyNumber}`, details: `Created deficiency: ${input.title}` });
      return { success: true, id };
    }),

  deficiencyUpdate: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      status: z.enum(["open", "poc_pending", "poc_approved", "in_progress", "corrected", "verified", "closed"]).optional(),
      pocDescription: z.string().optional(),
      correctionCompletedDate: z.string().optional(),
      verifiedBy: z.string().optional(),
      verifiedById: z.string().optional(),
      verificationMethod: z.enum(["document_review", "interview", "observation", "record_review", "other"]).optional(),
      verificationNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updateData: Partial<typeof deficiencyTrackingTable.$inferInsert> = { updatedAt: new Date().toISOString() };
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.pocDescription !== undefined) {
        updateData.pocDescription = fields.pocDescription;
        updateData.pocSubmittedDate = new Date().toISOString();
      }
      if (fields.correctionCompletedDate !== undefined) updateData.correctionCompletedDate = fields.correctionCompletedDate;
      if (fields.verifiedBy !== undefined) {
        updateData.verifiedBy = fields.verifiedBy;
        updateData.verifiedById = fields.verifiedById ?? null;
        updateData.verifiedDate = new Date().toISOString();
      }
      if (fields.verificationMethod !== undefined) updateData.verificationMethod = fields.verificationMethod;
      if (fields.verificationNotes !== undefined) updateData.verificationNotes = fields.verificationNotes;
      await db.update(deficiencyTrackingTable).set(updateData).where(eq(deficiencyTrackingTable.id, id));
      auditLog({ action: "m3:deficiencyUpdate", actor, resource: `deficiency:${id}`, details: `Updated deficiency status: ${fields.status}` });
      return { success: true };
    }),

  deficiencyStats: authedQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(deficiencyTrackingTable).all();
    const open = all.filter((d) => d.status === "open" || d.status === "poc_pending").length;
    const inProgress = all.filter((d) => d.status === "in_progress" || d.status === "poc_approved").length;
    const corrected = all.filter((d) => d.status === "corrected").length;
    const verified = all.filter((d) => d.status === "verified" || d.status === "closed").length;
    const overdue = all.filter((d) => {
      if (d.status === "verified" || d.status === "closed") return false;
      return d.correctionDueDate && d.correctionDueDate < new Date().toISOString();
    }).length;
    return { total: all.length, open, inProgress, corrected, verified, overdue };
  }),
});
