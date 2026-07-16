import { z } from "zod";
import { adminQuery, authedQuery, createRouter } from "../middleware";
import { getDb } from "../queries/connection";
import {
  formTemplates,
  formTemplateFields,
  formRoleBindings,
  formInstances,
  formPackets,
} from "@db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Router ──────────────────────────────────────────────────

export const formsRouter = createRouter({
  // ─── Templates ─────────────────────────────────────────────

  listTemplates: authedQuery
    .input(
      z.object({
        binderArea: z.string().optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(formTemplates);

      const conditions = [];
      if (input?.binderArea) {
        conditions.push(eq(formTemplates.binderArea, input.binderArea));
      }
      if (input?.isActive !== undefined) {
        conditions.push(eq(formTemplates.isActive, input.isActive));
      }
      if (input?.search) {
        // Simple OR-based search on name/code
        // Note: SQLite doesn't have full-text search by default
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      return query.orderBy(asc(formTemplates.sortOrder)).all();
    }),

  getTemplate: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const template = await db.select().from(formTemplates).where(eq(formTemplates.id, input.id)).get();
      if (!template) return null;

      const fields = await db
        .select()
        .from(formTemplateFields)
        .where(eq(formTemplateFields.templateId, input.id))
        .orderBy(asc(formTemplateFields.sortOrder))
        .all();

      const bindings = await db
        .select()
        .from(formRoleBindings)
        .where(eq(formRoleBindings.templateId, input.id))
        .all();

      return { ...template, fields, bindings };
    }),

  createTemplate: adminQuery
    .input(
      z.object({
        formCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        binderArea: z.string().min(1),
        binderAreaIndex: z.number().default(0),
        lifecycleModule: z.string().optional(),
        requiredForGate: z.boolean().default(false),
        signatureRequired: z.boolean().default(false),
        reviewerRequired: z.boolean().default(false),
        outputFormat: z.enum(["pdf", "docx"]).default("pdf"),
        sourcePdfPath: z.string().optional(),
        retentionCategory: z.string().optional(),
        renewalRule: z.string().optional(),
        roleApplicabilityJson: z.string().optional(),
        triggeringStatus: z.string().optional(),
        sortOrder: z.number().default(0),
        fields: z.array(
          z.object({
            name: z.string().min(1),
            label: z.string().min(1),
            fieldType: z.enum(["text", "textarea", "date", "checkbox", "select", "multiselect", "number", "email", "phone", "signature", "initials", "file"]),
            required: z.boolean().default(false),
            optionsJson: z.string().optional(),
            placeholder: z.string().optional(),
            helpText: z.string().optional(),
            section: z.string().optional(),
            sortOrder: z.number().default(0),
          }),
        ).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(formTemplates).values({
        id,
        formCode: input.formCode,
        name: input.name,
        description: input.description ?? null,
        binderArea: input.binderArea,
        binderAreaIndex: input.binderAreaIndex,
        lifecycleModule: input.lifecycleModule ?? null,
        requiredForGate: input.requiredForGate,
        signatureRequired: input.signatureRequired,
        reviewerRequired: input.reviewerRequired,
        outputFormat: input.outputFormat,
        sourcePdfPath: input.sourcePdfPath ?? null,
        retentionCategory: input.retentionCategory ?? null,
        renewalRule: input.renewalRule ?? null,
        roleApplicabilityJson: input.roleApplicabilityJson ?? null,
        triggeringStatus: input.triggeringStatus ?? null,
        sortOrder: input.sortOrder,
      });

      // Insert fields if provided
      if (input.fields && input.fields.length > 0) {
        for (const f of input.fields) {
          await db.insert(formTemplateFields).values({
            id: randomUUID(),
            templateId: id,
            name: f.name,
            label: f.label,
            fieldType: f.fieldType,
            required: f.required,
            optionsJson: f.optionsJson ?? null,
            placeholder: f.placeholder ?? null,
            helpText: f.helpText ?? null,
            section: f.section ?? null,
            sortOrder: f.sortOrder,
          });
        }
      }

      return db.select().from(formTemplates).where(eq(formTemplates.id, id)).get();
    }),

  updateTemplate: adminQuery
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        requiredForGate: z.boolean().optional(),
        signatureRequired: z.boolean().optional(),
        reviewerRequired: z.boolean().optional(),
        triggeringStatus: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;

      const setData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setData[key] = value;
      }
      if (Object.keys(setData).length > 0) {
        await db.update(formTemplates).set(setData).where(eq(formTemplates.id, id));
      }

      return db.select().from(formTemplates).where(eq(formTemplates.id, id)).get();
    }),

  deleteTemplate: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Check if instances exist
      const instances = await db.select().from(formInstances).where(eq(formInstances.templateId, input.id)).all();
      if (instances.length > 0) {
        // Soft delete instead
        await db.update(formTemplates).set({ isActive: false }).where(eq(formTemplates.id, input.id));
        return { softDeleted: true, instanceCount: instances.length };
      }
      await db.delete(formTemplates).where(eq(formTemplates.id, input.id));
      return { deleted: true };
    }),

  // ─── Role Bindings ─────────────────────────────────────────

  listRoleBindings: authedQuery
    .input(z.object({ templateId: z.string().optional(), role: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(formRoleBindings);
      const conditions = [];
      if (input?.templateId) conditions.push(eq(formRoleBindings.templateId, input.templateId));
      if (input?.role) conditions.push(eq(formRoleBindings.role, input.role));
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      return query.all();
    }),

  setRoleBinding: adminQuery
    .input(
      z.object({
        templateId: z.string(),
        role: z.string(),
        isRequired: z.boolean(),
        isAutoAssigned: z.boolean().default(true),
        assignmentTrigger: z.string().default("on-create"),
        dueDays: z.number().default(7),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Upsert: check existing
      const existing = await db
        .select()
        .from(formRoleBindings)
        .where(and(eq(formRoleBindings.templateId, input.templateId), eq(formRoleBindings.role, input.role)))
        .get();

      if (existing) {
        await db
          .update(formRoleBindings)
          .set({
            isRequired: input.isRequired,
            isAutoAssigned: input.isAutoAssigned,
            assignmentTrigger: input.assignmentTrigger,
            dueDays: input.dueDays,
          })
          .where(eq(formRoleBindings.id, existing.id));
        return db.select().from(formRoleBindings).where(eq(formRoleBindings.id, existing.id)).get();
      }

      const id = randomUUID();
      await db.insert(formRoleBindings).values({
        id,
        templateId: input.templateId,
        role: input.role,
        isRequired: input.isRequired,
        isAutoAssigned: input.isAutoAssigned,
        assignmentTrigger: input.assignmentTrigger,
        dueDays: input.dueDays,
      });
      return db.select().from(formRoleBindings).where(eq(formRoleBindings.id, id)).get();
    }),

  // ─── Instances ─────────────────────────────────────────────

  listInstances: authedQuery
    .input(
      z.object({
        personId: z.string().optional(),
        templateId: z.string().optional(),
        status: z.enum([
          "draft", "assigned", "in-progress", "submitted", "under-review",
          "returned-for-correction", "approved", "locked", "filed-to-dms",
          "expired", "waived", "superseded",
        ]).optional(),
        moduleId: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(formInstances);
      const conditions = [];
      if (input?.personId) conditions.push(eq(formInstances.personId, input.personId));
      if (input?.templateId) conditions.push(eq(formInstances.templateId, input.templateId));
      if (input?.status) conditions.push(eq(formInstances.status, input.status));
      if (input?.moduleId) conditions.push(eq(formInstances.moduleId, input.moduleId));
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      return query.orderBy(desc(formInstances.createdAt)).all();
    }),

  getInstance: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(formInstances).where(eq(formInstances.id, input.id)).get();
    }),

  createInstance: adminQuery
    .input(
      z.object({
        templateId: z.string(),
        personId: z.string(),
        moduleId: z.string().optional(),
        packetId: z.string().optional(),
        assignedToUserId: z.string().optional(),
        assignedByUserId: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(formInstances).values({
        id,
        templateId: input.templateId,
        personId: input.personId,
        moduleId: input.moduleId ?? null,
        packetId: input.packetId ?? null,
        assignedToUserId: input.assignedToUserId ?? null,
        assignedByUserId: input.assignedByUserId ?? null,
        dueDate: input.dueDate ?? null,
        status: "assigned",
      });

      return db.select().from(formInstances).where(eq(formInstances.id, id)).get();
    }),

  updateInstanceStatus: adminQuery
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "draft", "assigned", "in-progress", "submitted",
          "under-review", "returned-for-correction", "approved",
          "locked", "filed-to-dms", "expired", "waived", "superseded",
        ]),
        submittedByUserId: z.string().optional(),
        reviewedByUserId: z.string().optional(),
        returnedReason: z.string().optional(),
        fieldValuesJson: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, status, ...rest } = input;

      const setData: Record<string, unknown> = { status };
      if (status === "submitted") setData.submittedAt = new Date().toISOString();
      if (status === "approved") setData.approvedAt = new Date().toISOString();
      if (status === "locked") setData.lockedAt = new Date().toISOString();
      if (rest.submittedByUserId) setData.submittedByUserId = rest.submittedByUserId;
      if (rest.reviewedByUserId) setData.reviewedByUserId = rest.reviewedByUserId;
      if (rest.returnedReason) setData.returnedReason = rest.returnedReason;
      if (rest.fieldValuesJson) setData.fieldValuesJson = rest.fieldValuesJson;
      setData.updatedAt = new Date().toISOString();

      await db.update(formInstances).set(setData).where(eq(formInstances.id, id));
      return db.select().from(formInstances).where(eq(formInstances.id, id)).get();
    }),

  // ─── Packets ───────────────────────────────────────────────

  listPackets: authedQuery
    .input(z.object({
      personId: z.string().optional(),
      status: z.enum([
        "packet-not-started", "packet-building", "packet-incomplete",
        "packet-ready-for-review", "packet-approved", "packet-locked", "packet-filed",
      ]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(formPackets);
      const conditions = [];
      if (input?.personId) conditions.push(eq(formPackets.personId, input.personId));
      if (input?.status) conditions.push(eq(formPackets.status, input.status));
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      return query.orderBy(desc(formPackets.createdAt)).all();
    }),

  createPacket: adminQuery
    .input(
      z.object({
        personId: z.string(),
        packetType: z.enum([
          "candidate-intake", "conditional-offer", "pre-employment",
          "screening", "final-agreement", "orientation", "training",
          "clearance", "personnel-file", "audit",
        ]),
        requiredFormIdsJson: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();

      await db.insert(formPackets).values({
        id,
        personId: input.personId,
        packetType: input.packetType,
        requiredFormIdsJson: input.requiredFormIdsJson ?? null,
        status: "packet-not-started",
      });

      return db.select().from(formPackets).where(eq(formPackets.id, id)).get();
    }),

  updatePacket: adminQuery
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "packet-not-started", "packet-building", "packet-incomplete",
          "packet-ready-for-review", "packet-approved", "packet-locked", "packet-filed",
        ]),
        completedFormIdsJson: z.string().optional(),
        missingFormIdsJson: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      const setData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setData[key] = value;
      }
      if (Object.keys(setData).length > 0) {
        await db.update(formPackets).set(setData).where(eq(formPackets.id, id));
      }
      return db.select().from(formPackets).where(eq(formPackets.id, id)).get();
    }),

  // ─── Dashboard / Summary ───────────────────────────────────

  dashboard: authedQuery.query(async () => {
    const db = getDb();
    const templates = await db.select().from(formTemplates).all();
    const instances = await db.select().from(formInstances).all();
    const packets = await db.select().from(formPackets).all();

    // Status counts
    const byStatus: Record<string, number> = {};
    for (const i of instances) {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    }

    // Overdue instances
    const now = new Date().toISOString();
    const overdue = instances.filter((i) => i.dueDate && i.dueDate < now && !["approved", "locked", "filed-to-dms"].includes(i.status));

    // Packet status counts
    const byPacketStatus: Record<string, number> = {};
    for (const p of packets) {
      byPacketStatus[p.status] = (byPacketStatus[p.status] || 0) + 1;
    }

    return {
      totalTemplates: templates.filter((t) => t.isActive).length,
      totalInactiveTemplates: templates.filter((t) => !t.isActive).length,
      totalInstances: instances.length,
      byStatus,
      overdueCount: overdue.length,
      totalPackets: packets.length,
      byPacketStatus,
    };
  }),

  missingFormsReport: authedQuery.query(async () => {
    const db = getDb();
    const templates = await db.select().from(formTemplates).all();
    const packets = await db.select().from(formPackets).all();

    // Find packets that are missing forms
    const missing: Array<{
      packetId: string;
      packetType: string;
      personId: string;
      missingFormCount: number;
      missingFormNames: string[];
    }> = [];

    for (const pkt of packets) {
      if (!pkt.requiredFormIdsJson) continue;
      const required = JSON.parse(pkt.requiredFormIdsJson) as string[];
      const completed = pkt.completedFormIdsJson ? JSON.parse(pkt.completedFormIdsJson) as string[] : [];
      const missingIds = required.filter((r) => !completed.includes(r));

      if (missingIds.length > 0) {
        const missingNames = missingIds
          .map((id) => templates.find((t) => t.id === id)?.name || id)
          .filter(Boolean);
        missing.push({
          packetId: pkt.id,
          packetType: pkt.packetType,
          personId: pkt.personId,
          missingFormCount: missingIds.length,
          missingFormNames: missingNames,
        });
      }
    }

    return missing;
  }),

  // ─── Auto-assign forms to person ───────────────────────────

  autoAssign: adminQuery
    .input(
      z.object({
        personId: z.string(),
        role: z.string(),
        triggeredBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get all active templates with role bindings for this role
      const bindings = await db
        .select()
        .from(formRoleBindings)
        .where(eq(formRoleBindings.role, input.role))
        .all();

      if (bindings.length === 0) return { assigned: 0, bindings: 0 };

      const templateIds = bindings.map((b) => b.templateId);
      const templates = await db
        .select()
        .from(formTemplates)
        .where(inArray(formTemplates.id, templateIds))
        .all();

      // Filter active templates and matching trigger
      const activeTemplates = templates.filter((t) => t.isActive);
      let assigned = 0;

      for (const tmpl of activeTemplates) {
        const binding = bindings.find((b) => b.templateId === tmpl.id);
        if (!binding || !binding.isAutoAssigned) continue;

        // Check trigger match
        if (input.triggeredBy && binding.assignmentTrigger !== "on-create" && binding.assignmentTrigger !== input.triggeredBy) {
          continue;
        }

        // Check if instance already exists
        const existing = await db
          .select()
          .from(formInstances)
          .where(and(eq(formInstances.templateId, tmpl.id), eq(formInstances.personId, input.personId)))
          .get();

        if (existing) continue;

        // Calculate due date
        const dueDate = binding.dueDays
          ? new Date(Date.now() + binding.dueDays * 86400000).toISOString().slice(0, 10)
          : null;

        await db.insert(formInstances).values({
          id: randomUUID(),
          templateId: tmpl.id,
          personId: input.personId,
          moduleId: tmpl.lifecycleModule ?? null,
          dueDate,
          status: "assigned",
        });

        assigned++;
      }

      return { assigned, bindings: bindings.length };
    }),
});
