import { z } from "zod";
import { adminQuery, authedQuery, createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { documentTemplates, generatedDocuments, documents as personnelDocuments } from "@db/schema";
import { eq, and, desc, type InferInsertModel } from "drizzle-orm";
import { randomUUID } from "crypto";

// ══════════════════════════════════════════════════════════════
// Document Generation Pipeline Router (T-010)
// Template registry + document job management
// ══════════════════════════════════════════════════════════════

export const documentsRouter = createRouter({

  // ════════════════════════════════════════════════════════════
  // PERSONNEL DOCUMENTS
  // Backward-compatible HR lifecycle document surface.
  // ════════════════════════════════════════════════════════════

  list: authedQuery
    .input(z.object({
      personId: z.string().optional(),
      moduleId: z.string().optional(),
      status: z.enum(["uploaded", "verified", "rejected", "expired"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.personId) conditions.push(eq(personnelDocuments.personId, input.personId));
      if (input?.moduleId) conditions.push(eq(personnelDocuments.moduleId, input.moduleId));
      if (input?.status) conditions.push(eq(personnelDocuments.status, input.status));

      return conditions.length > 0
        ? db.select().from(personnelDocuments).where(and(...conditions)).orderBy(desc(personnelDocuments.uploadedAt)).all()
        : db.select().from(personnelDocuments).orderBy(desc(personnelDocuments.uploadedAt)).all();
    }),

  create: adminQuery
    .input(z.object({
      personId: z.string().min(1),
      moduleId: z.string().min(1),
      recordName: z.string().min(1),
      fileName: z.string().min(1),
      fileType: z.string().optional(),
      fileSize: z.number().int().nonnegative().optional(),
      filePath: z.string().optional(),
      uploadedBy: z.string().optional(),
      status: z.enum(["uploaded", "verified", "rejected", "expired"]).default("uploaded"),
      expiryDate: z.string().optional(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      await db.insert(personnelDocuments).values({
        id,
        personId: input.personId,
        moduleId: input.moduleId,
        recordName: input.recordName,
        fileName: input.fileName,
        fileType: input.fileType ?? null,
        fileSize: input.fileSize ?? null,
        filePath: input.filePath ?? null,
        uploadedBy: input.uploadedBy ?? null,
        status: input.status,
        expiryDate: input.expiryDate ?? null,
        note: input.note ?? null,
      }).run();
      return db.select().from(personnelDocuments).where(eq(personnelDocuments.id, id)).get();
    }),

  updateStatus: adminQuery
    .input(z.object({
      id: z.string().min(1),
      status: z.enum(["uploaded", "verified", "rejected", "expired"]),
      verifiedBy: z.string().optional(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Partial<InferInsertModel<typeof personnelDocuments>> = {
        status: input.status,
      };
      if (input.verifiedBy !== undefined) updateData.verifiedBy = input.verifiedBy;
      if (input.note !== undefined) updateData.note = input.note;
      if (input.status === "verified") updateData.verifiedAt = new Date().toISOString();

      await db.update(personnelDocuments).set(updateData).where(eq(personnelDocuments.id, input.id)).run();
      return db.select().from(personnelDocuments).where(eq(personnelDocuments.id, input.id)).get();
    }),

  // ════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════

  listTemplates: publicQuery
    .input(z.object({
      documentType: z.enum(["clinical", "compliance", "administrative", "financial", "hr", "executive"]).optional(),
      division: z.string().optional(),
      status: z.enum(["draft", "active", "deprecated"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.documentType) conditions.push(eq(documentTemplates.documentType, input.documentType));
      if (input?.status) conditions.push(eq(documentTemplates.status, input.status));

      let results = conditions.length > 0
        ? await db.select().from(documentTemplates).where(and(...conditions)).orderBy(documentTemplates.templateName)
        : await db.select().from(documentTemplates).orderBy(documentTemplates.templateName);

      // Filter by division if specified
      if (input?.division) {
        results = results.filter((t) => {
          if (t.applicableDivisions === "all") return true;
          try { const divs = JSON.parse(t.applicableDivisions); return divs.includes(input.division); } catch { return false; }
        });
      }

      return results;
    }),

  getTemplate: publicQuery
    .input(z.object({ id: z.string().optional(), code: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.id) return db.select().from(documentTemplates).where(eq(documentTemplates.id, input.id)).get();
      if (input?.code) return db.select().from(documentTemplates).where(eq(documentTemplates.templateCode, input.code)).get();
      return null;
    }),

  // ════════════════════════════════════════════════════════════
  // DOCUMENT GENERATION JOBS
  // ════════════════════════════════════════════════════════════

  listGeneratedDocuments: publicQuery
    .input(z.object({
      templateId: z.string().optional(),
      youthId: z.string().optional(),
      status: z.enum(["queued", "generating", "completed", "failed"]).optional(),
      generatedBy: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input?.templateId) conditions.push(eq(generatedDocuments.templateId, input.templateId));
      if (input?.youthId) conditions.push(eq(generatedDocuments.youthId, input.youthId));
      if (input?.status) conditions.push(eq(generatedDocuments.status, input.status));
      if (input?.generatedBy) conditions.push(eq(generatedDocuments.generatedBy, input.generatedBy));

      const results = conditions.length > 0
        ? await db.select().from(generatedDocuments).where(and(...conditions)).orderBy(desc(generatedDocuments.createdAt))
        : await db.select().from(generatedDocuments).orderBy(desc(generatedDocuments.createdAt));
      return results;
    }),

  createDocumentJob: publicQuery
    .input(z.object({
      templateId: z.string(),
      templateCode: z.string(),
      documentTitle: z.string(),
      youthId: z.string().optional(),
      youthName: z.string().optional(),
      mrn: z.string().optional(),
      generatedBy: z.string(),
      generatedById: z.string().optional(),
      division: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const id = randomUUID();
      const now = new Date().toISOString();

      await db.insert(generatedDocuments).values({
        id,
        templateId: input.templateId,
        templateCode: input.templateCode,
        documentTitle: input.documentTitle,
        youthId: input.youthId ?? null,
        youthName: input.youthName ?? null,
        mrn: input.mrn ?? null,
        generatedBy: input.generatedBy,
        generatedById: input.generatedById ?? null,
        division: input.division ?? null,
        status: "queued",
        createdAt: now,
      });

      return { success: true, id, status: "queued" };
    }),

  updateDocumentStatus: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["queued", "generating", "completed", "failed"]),
      filePath: z.string().optional(),
      fileSize: z.number().optional(),
      pageCount: z.number().optional(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const updateData: Partial<InferInsertModel<typeof generatedDocuments>> = {};
      if (fields.status !== undefined) updateData.status = fields.status;
      if (fields.filePath !== undefined) updateData.filePath = fields.filePath;
      if (fields.fileSize !== undefined) updateData.fileSize = fields.fileSize;
      if (fields.pageCount !== undefined) updateData.pageCount = fields.pageCount;
      if (fields.errorMessage !== undefined) updateData.errorMessage = fields.errorMessage;
      if (fields.status === "completed" || fields.status === "failed") {
        updateData.completedAt = new Date().toISOString();
      }

      await db.update(generatedDocuments).set(updateData).where(eq(generatedDocuments.id, id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // DOCUMENT TYPE REGISTRY
  // ════════════════════════════════════════════════════════════

  getDocumentTypes: publicQuery.query(() => {
    return {
      clinical: [
        { code: "treatment-plan", name: "Treatment Plan", description: "Individualized treatment plan with measurable goals" },
        { code: "progress-note", name: "Progress Note", description: "Clinical session progress documentation" },
        { code: "discharge-summary", name: "Discharge Summary", description: "Youth discharge summary with aftercare plan" },
        { code: "cans-assessment", name: "CANS Assessment", description: "Child and Adolescent Needs and Strengths assessment" },
        { code: "psychiatric-eval", name: "Psychiatric Evaluation", description: "LPHA psychiatric evaluation report" },
      ],
      compliance: [
        { code: "incident-report", name: "Incident Report", description: "Restraint/seclusion incident documentation per T-748" },
        { code: "rights-acknowledgment", name: "Youth Rights Acknowledgment", description: "Youth rights delivery and acknowledgment record" },
        { code: "part2-consent", name: "42 CFR Part 2 Consent", description: "SUD information disclosure consent form" },
        { code: "chart-audit-report", name: "Chart Audit Report", description: "Clinical documentation audit findings" },
      ],
      administrative: [
        { code: "service-plan-mhtcm", name: "MHTCM Service Plan", description: "Mental Health Targeted Case Management 6-function plan" },
        { code: "service-plan-mhrs", name: "MHRS Service Plan", description: "Mental Health Rehabilitative Services 4-category plan" },
        { code: "eligibility-determination", name: "Eligibility Determination", description: "MHTCM/MHRS eligibility documentation" },
      ],
      financial: [
        { code: "encounter-form-t1017", name: "T1017 Encounter Form", description: "MHTCM encounter with billing documentation" },
        { code: "encounter-form-h2017", name: "H2017 Encounter Form", description: "MHRS encounter with billing documentation" },
      ],
      hr: [
        { code: "credentialing-packet", name: "Credentialing Packet", description: "Staff credentialing and privileging documentation" },
        { code: "training-record", name: "Training Record", description: "Staff training completion and competency record" },
      ],
      executive: [
        { code: "mgma-scorecard", name: "MGMA Scorecard", description: "7-domain practice management scorecard" },
        { code: "census-report", name: "Census Report", description: "Three-stage campus census summary" },
        { code: "compliance-dashboard", name: "Compliance Dashboard", description: "Multi-domain compliance status report" },
      ],
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedDocumentTemplates: publicQuery.mutation(async () => {
    const db = getDb();
    const now = new Date().toISOString();

    await db.insert(documentTemplates).values([
      { id: "tpl-001", templateName: "Treatment Plan", templateCode: "treatment-plan", description: "Individualized treatment plan with measurable goals per HHSC standards", documentType: "clinical", applicableDivisions: JSON.stringify(["BHC"]), coverPageRequired: true, tocRequired: false, signatureBlocks: 2, primaryColor: "#C45C4A", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-002", templateName: "Incident Report", templateCode: "incident-report", description: "Restraint/seclusion incident documentation per Title 26 TAC Chapter 748", documentType: "compliance", applicableDivisions: JSON.stringify(["GRO"]), coverPageRequired: false, tocRequired: false, signatureBlocks: 3, primaryColor: "#245C5A", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-003", templateName: "MHTCM Service Plan", templateCode: "service-plan-mhtcm", description: "Mental Health Targeted Case Management 6-function service plan with T1017 billing", documentType: "administrative", applicableDivisions: JSON.stringify(["BHC"]), coverPageRequired: true, tocRequired: true, signatureBlocks: 2, primaryColor: "#C45C4A", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-004", templateName: "MHRS Service Plan", templateCode: "service-plan-mhrs", description: "Mental Health Rehabilitative Services 4-category service plan with H2017 billing", documentType: "administrative", applicableDivisions: JSON.stringify(["BHC"]), coverPageRequired: true, tocRequired: true, signatureBlocks: 2, primaryColor: "#C45C4A", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-005", templateName: "T1017 Encounter Form", templateCode: "encounter-form-t1017", description: "MHTCM encounter documentation with T1017 billing codes", documentType: "financial", applicableDivisions: JSON.stringify(["BHC"]), coverPageRequired: false, tocRequired: false, signatureBlocks: 1, primaryColor: "#D97706", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-006", templateName: "H2017 Encounter Form", templateCode: "encounter-form-h2017", description: "MHRS encounter documentation with H2017 billing codes", documentType: "financial", applicableDivisions: JSON.stringify(["BHC"]), coverPageRequired: false, tocRequired: false, signatureBlocks: 1, primaryColor: "#D97706", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-007", templateName: "Youth Rights Acknowledgment", templateCode: "rights-acknowledgment", description: "Youth rights delivery, explanation, and acknowledgment record per T-748", documentType: "compliance", applicableDivisions: JSON.stringify(["GRO"]), coverPageRequired: false, tocRequired: false, signatureBlocks: 3, primaryColor: "#245C5A", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-008", templateName: "42 CFR Part 2 Consent", templateCode: "part2-consent", description: "SUD information disclosure consent form per 42 CFR Part 2", documentType: "compliance", applicableDivisions: JSON.stringify(["BHC", "GRO"]), coverPageRequired: false, tocRequired: false, signatureBlocks: 4, primaryColor: "#991B1B", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-009", templateName: "MGMA Scorecard", templateCode: "mgma-scorecard", description: "7-domain practice management scorecard with KPI tracking", documentType: "executive", applicableDivisions: "all", coverPageRequired: true, tocRequired: true, signatureBlocks: 1, primaryColor: "#991B1B", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-010", templateName: "Census Report", templateCode: "census-report", description: "Three-stage campus census summary with alert status", documentType: "executive", applicableDivisions: JSON.stringify(["GRO"]), coverPageRequired: true, tocRequired: false, signatureBlocks: 1, primaryColor: "#245C5A", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-011", templateName: "Credentialing Packet", templateCode: "credentialing-packet", description: "Staff credentialing, privileging, and competency documentation", documentType: "hr", applicableDivisions: JSON.stringify(["GAD"]), coverPageRequired: true, tocRequired: true, signatureBlocks: 2, primaryColor: "#D97706", status: "active", createdAt: now, updatedAt: now },
      { id: "tpl-012", templateName: "Chart Audit Report", templateCode: "chart-audit-report", description: "Clinical documentation audit findings with compliance scoring", documentType: "compliance", applicableDivisions: JSON.stringify(["BHC"]), coverPageRequired: true, tocRequired: false, signatureBlocks: 1, primaryColor: "#C45C4A", status: "draft", createdAt: now, updatedAt: now },
    ]).onConflictDoNothing();

    return { success: true, message: "Document templates seeded: 12 templates across 6 document types" };
  }),
});
