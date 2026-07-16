import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { audits, incidents, correctiveActions } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

function generateAuditNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `AUD-${year}-${seq}`;
}

function generateIncidentNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `INC-${year}-${seq}`;
}

function generateActionNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `CA-${year}-${seq}`;
}

export const qaRouter = createRouter({
  // ─── Audits CRUD ───────────────────────────────────────────

  listAudits: publicQuery
    .input(z.object({
      status: z.enum(["planned", "in_progress", "pending_review", "completed", "closed"]).optional(),
      type: z.enum(["internal", "external", "regulatory", "peer_review", "random"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      const query = db.select().from(audits);
      const conditions = [];
      if (params.status) conditions.push(eq(audits.status, params.status));
      if (params.type) conditions.push(eq(audits.auditType, params.type));
      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(audits.createdAt)).all();
      }
      return query.orderBy(desc(audits.createdAt)).all();
    }),

  getAudit: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(audits).where(eq(audits.id, input.id)).get() ?? null;
    }),

  createAudit: publicQuery
    .input(z.object({
      title: z.string().min(1),
      auditType: z.enum(["internal", "external", "regulatory", "peer_review", "random"]),
      scope: z.string().min(1),
      assignedAuditorId: z.string().optional(),
      department: z.string().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      await db.insert(audits).values({
        id,
        auditNumber: generateAuditNumber(),
        title: input.title,
        auditType: input.auditType,
        scope: input.scope,
        assignedAuditorId: input.assignedAuditorId ?? null,
        department: input.department ?? null,
        dueDate: input.dueDate ?? null,
      });
      return db.select().from(audits).where(eq(audits.id, id)).get();
    }),

  updateAudit: publicQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      status: z.enum(["planned", "in_progress", "pending_review", "completed", "closed"]).optional(),
      findingsJson: z.string().optional(),
      score: z.number().int().min(0).max(100).optional(),
      completedAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();
      await db.update(audits).set(setValues).where(eq(audits.id, id));
      return db.select().from(audits).where(eq(audits.id, id)).get();
    }),

  // ─── Incidents CRUD ────────────────────────────────────────

  listIncidents: publicQuery
    .input(z.object({
      status: z.enum(["open", "under_investigation", "resolved", "closed"]).optional(),
      severity: z.enum(["low", "moderate", "high", "critical"]).optional(),
      patientId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      const query = db.select().from(incidents);
      const conditions = [];
      if (params.status) conditions.push(eq(incidents.status, params.status));
      if (params.severity) conditions.push(eq(incidents.severity, params.severity));
      if (params.patientId) conditions.push(eq(incidents.patientId, params.patientId));
      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(incidents.occurredAt)).all();
      }
      return query.orderBy(desc(incidents.occurredAt)).all();
    }),

  getIncident: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(incidents).where(eq(incidents.id, input.id)).get() ?? null;
    }),

  createIncident: publicQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      incidentType: z.enum(["medication_error", "fall", "behavioral", "clinical_error", "equipment", "environmental", "other"]),
      severity: z.enum(["low", "moderate", "high", "critical"]),
      patientId: z.string().optional(),
      reportedBy: z.string(),
      occurredAt: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      await db.insert(incidents).values({
        id,
        incidentNumber: generateIncidentNumber(),
        title: input.title,
        description: input.description,
        incidentType: input.incidentType,
        severity: input.severity,
        patientId: input.patientId ?? null,
        reportedBy: input.reportedBy,
        occurredAt: input.occurredAt,
      });
      return db.select().from(incidents).where(eq(incidents.id, id)).get();
    }),

  updateIncident: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "under_investigation", "resolved", "closed"]).optional(),
      assignedTo: z.string().optional(),
      resolutionNotes: z.string().optional(),
      resolvedAt: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();
      await db.update(incidents).set(setValues).where(eq(incidents.id, id));
      return db.select().from(incidents).where(eq(incidents.id, id)).get();
    }),

  // ─── Corrective Actions CRUD ───────────────────────────────

  listCorrectiveActions: publicQuery
    .input(z.object({
      status: z.enum(["open", "in_progress", "pending_verification", "completed", "overdue"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      assignedTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const params = input ?? {};
      const query = db.select().from(correctiveActions);
      const conditions = [];
      if (params.status) conditions.push(eq(correctiveActions.status, params.status));
      if (params.priority) conditions.push(eq(correctiveActions.priority, params.priority));
      if (params.assignedTo) conditions.push(eq(correctiveActions.assignedTo, params.assignedTo));
      if (conditions.length > 0) {
        const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
        return query.where(condition).orderBy(desc(correctiveActions.createdAt)).all();
      }
      return query.orderBy(desc(correctiveActions.createdAt)).all();
    }),

  createCorrectiveAction: publicQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      relatedAuditId: z.string().optional(),
      relatedIncidentId: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      assignedTo: z.string(),
      dueDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      await db.insert(correctiveActions).values({
        id,
        actionNumber: generateActionNumber(),
        title: input.title,
        description: input.description,
        relatedAuditId: input.relatedAuditId ?? null,
        relatedIncidentId: input.relatedIncidentId ?? null,
        priority: input.priority,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
      });
      return db.select().from(correctiveActions).where(eq(correctiveActions.id, id)).get();
    }),

  updateCorrectiveAction: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "in_progress", "pending_verification", "completed", "overdue"]).optional(),
      completionNotes: z.string().optional(),
      completedAt: z.string().optional(),
      verifiedBy: z.string().optional(),
      verifiedAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }
      setValues.updatedAt = new Date().toISOString();
      await db.update(correctiveActions).set(setValues).where(eq(correctiveActions.id, id));
      return db.select().from(correctiveActions).where(eq(correctiveActions.id, id)).get();
    }),

  // ─── Dashboard ─────────────────────────────────────────────

  dashboardKPIs: publicQuery.query(async () => {
    const db = getDb();
    const allAudits = await db.select().from(audits).all();
    const allIncidents = await db.select().from(incidents).all();
    const allActions = await db.select().from(correctiveActions).all();

    const completedAudits = allAudits.filter((a) => a.status === "completed" || a.status === "closed");
    const avgScore = completedAudits.length > 0
      ? Math.round(completedAudits.reduce((s, a) => s + (a.score ?? 0), 0) / completedAudits.length)
      : 0;

    const openAudits = allAudits.filter((a) => a.status === "planned" || a.status === "in_progress").length;
    const openIncidents = allIncidents.filter((i) => i.status === "open" || i.status === "under_investigation").length;
    const criticalIncidents = allIncidents.filter((i) => i.severity === "critical" && i.status !== "closed").length;
    const openActions = allActions.filter((a) => a.status !== "completed").length;
    const overdueActions = allActions.filter((a) => a.status === "overdue" || (a.dueDate && a.dueDate < new Date().toISOString() && a.status !== "completed")).length;

    return {
      avgAuditScore: avgScore,
      openAudits,
      openIncidents,
      criticalIncidents,
      openCorrectiveActions: openActions,
      overdueActions,
      totalAudits: allAudits.length,
      totalIncidents: allIncidents.length,
    };
  }),
});
