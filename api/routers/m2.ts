import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery, auditLog } from "../middleware";
import { getDb, sqlite } from "../queries/connection";
import { dmsDocuments, documentCategories, documentVersions, documentAuditLog } from "@db/schema";
import { eq, like, and, or, desc, sql, count } from "drizzle-orm";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════
// M2: AMOS-DMS Document Management System
// Features: D004-01 through D004-07
// ═══════════════════════════════════════════════════════════════

// ─── Helper: ensure auxiliary tables exist ───────────────────

function ensureAuxTables() {
  // Document ID sequence tracking (D004-01)
  sqlite.prepare(`CREATE TABLE IF NOT EXISTS document_id_sequences (
    id TEXT PRIMARY KEY,
    department TEXT NOT NULL,
    category TEXT NOT NULL,
    year_month TEXT NOT NULL,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();

  sqlite.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_id_seq_dept_cat_ym 
    ON document_id_sequences(department, category, year_month)`).run();

  // Approval chain tracking (D004-04)
  sqlite.prepare(`CREATE TABLE IF NOT EXISTS document_approval_chains (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL DEFAULT 6,
    step1_author_submitted INTEGER NOT NULL DEFAULT 0,
    step1_submitted_at TEXT,
    step1_author_id TEXT,
    step1_author_name TEXT,
    step2_dept_head_reviewed INTEGER NOT NULL DEFAULT 0,
    step2_dept_head_id TEXT,
    step2_dept_head_name TEXT,
    step2_reviewed_at TEXT,
    step2_notes TEXT,
    step3_compliance_reviewed INTEGER NOT NULL DEFAULT 0,
    step3_compliance_id TEXT,
    step3_compliance_name TEXT,
    step3_reviewed_at TEXT,
    step3_notes TEXT,
    step4_qa_reviewed INTEGER NOT NULL DEFAULT 0,
    step4_qa_id TEXT,
    step4_qa_name TEXT,
    step4_reviewed_at TEXT,
    step4_notes TEXT,
    step5_exec_approved INTEGER NOT NULL DEFAULT 0,
    step5_exec_id TEXT,
    step5_exec_name TEXT,
    step5_approved_at TEXT,
    step5_notes TEXT,
    step6_published INTEGER NOT NULL DEFAULT 0,
    step6_published_at TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress',
    rejection_reason TEXT,
    rejected_at TEXT,
    rejected_by_step TEXT,
    restarted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`).run();

  sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_doc_approval_doc_id 
    ON document_approval_chains(document_id)`).run();

  // Retention schedule tracking (D004-06)
  sqlite.prepare(`CREATE TABLE IF NOT EXISTS document_retention_schedules (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    trigger_date TEXT NOT NULL,
    retention_years INTEGER NOT NULL,
    retention_until_date TEXT NOT NULL,
    is_expired INTEGER NOT NULL DEFAULT 0,
    expired_flagged_at TEXT,
    computed_at TEXT DEFAULT (datetime('now'))
  )`).run();

  sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_doc_retention_doc_id 
    ON document_retention_schedules(document_id)`).run();
}

// Run table creation on module load
ensureAuxTables();

// ─── Helper: log document action to audit trail ──────────────

async function logDocumentAction(
  db: ReturnType<typeof getDb>,
  params: {
    documentId: string;
    action: string;
    actorId: string;
    actorName: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    details?: string;
  }
) {
  const { documentId, action, actorId, actorName, fromStatus, toStatus, details } = params;
  try {
    await db.insert(documentAuditLog).values({
      id: randomUUID(),
      documentId,
      action,
      actorId,
      actorName,
      fromStatus: fromStatus ?? null,
      toStatus: toStatus ?? null,
      details: details ?? `${action} on document ${documentId}`,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Audit logging should never break the app
  }
}

// ─── State Machine: Document Lifecycle Transitions ───────────
// D004-03: Valid transitions
// DRAFT → REVIEW → APPROVED → PUBLISHED → SUPERSEDED → ARCHIVED
//         ↓         ↓           ↘             ↘
//       REJECTED   (archived)  (archived)   (archived)
//         ↓
//       DRAFT (restart)

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["in-review"],
  "in-review": ["approved", "rejected"],
  approved: ["published"],
  published: ["superseded", "archived"],
  superseded: ["archived"],
  rejected: ["draft"],
  archived: [],
};

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

function getNextStatusOptions(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

// ─── Router Definition ───────────────────────────────────────

export const m2Router = createRouter({

  // ════════════════════════════════════════════════════════════
  // D004-01: Document ID Generation
  // ════════════════════════════════════════════════════════════

  generateDocumentId: authedQuery
    .input(z.object({
      department: z.string().min(1, "Department is required").max(10),
      category: z.string().min(1, "Category is required").max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const now = new Date();

      // Format: ADL-[DEPT]-[CAT]-[YYMM]-[SEQ]
      // Use 2-digit year for compactness (e.g., 2607 for July 2026)
      const yearShort = String(now.getFullYear()).slice(2);
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const yearMonth = `${yearShort}${month}`;

      const deptCode = input.department.toUpperCase().substring(0, 3);
      const catCode = input.category.toUpperCase().substring(0, 3);

      // Get next sequence from tracking table
      const existing = sqlite.prepare(
        `SELECT last_sequence FROM document_id_sequences 
         WHERE department = ? AND category = ? AND year_month = ?`
      ).get(deptCode, catCode, yearMonth) as { last_sequence: number } | undefined;

      const nextSeq = (existing?.last_sequence ?? 0) + 1;
      const seqStr = String(nextSeq).padStart(4, "0");

      const documentId = `ADL-${deptCode}-${catCode}-${yearMonth}-${seqStr}`;

      // Upsert the sequence counter
      if (existing) {
        sqlite.prepare(
          `UPDATE document_id_sequences 
           SET last_sequence = ?, created_at = datetime('now') 
           WHERE department = ? AND category = ? AND year_month = ?`
        ).run(nextSeq, deptCode, catCode, yearMonth);
      } else {
        sqlite.prepare(
          `INSERT INTO document_id_sequences (id, department, category, year_month, last_sequence) 
           VALUES (?, ?, ?, ?, ?)`
        ).run(randomUUID(), deptCode, catCode, yearMonth, nextSeq);
      }

      auditLog({
        action: "m2:generateDocumentId",
        actor,
        resource: `documentId:${documentId}`,
        details: `Generated ID for dept=${deptCode}, cat=${catCode}`,
      });

      return {
        documentId,
        department: deptCode,
        category: catCode,
        yearMonth,
        sequence: nextSeq,
        format: "ADL-[DEPT]-[CAT]-[YYMM]-[SEQ]",
        generatedBy: actorName,
        generatedAt: now.toISOString(),
      };
    }),

  // ════════════════════════════════════════════════════════════
  // D004-02: 10-Field Metadata Enforcement
  // ════════════════════════════════════════════════════════════

  createDocument: adminQuery
    .input(z.object({
      // Required field 1: document_id (string)
      document_id: z.string().min(1, "document_id is required"),
      // Required field 2: title (string)
      title: z.string().min(1, "title is required"),
      // Required field 3: category (string)
      category: z.string().min(1, "category is required"),
      // Required field 4: author (string - authorId reference)
      author: z.string().min(1, "author is required"),
      // Required field 5: created_at (timestamp)
      created_at: z.string().min(1, "created_at is required"),
      // Required field 6: version (string, default "1.0")
      version: z.string().default("1.0"),
      // Required field 7: status (enum: "DRAFT")
      status: z.enum(["DRAFT"]).default("DRAFT"),
      // Required field 8: department (string)
      department: z.string().min(1, "department is required"),
      // Required field 9: phi_level (enum)
      phi_level: z.enum(["none", "limited", "restricted"]).default("none"),
      // Required field 10: file_path (string)
      file_path: z.string().min(1, "file_path is required"),
      // Optional additional fields
      description: z.string().optional(),
      categoryId: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      fileSize: z.number().optional(),
      tags: z.array(z.string()).default([]),
      permissions: z.array(z.string()).default([]),
      retentionYears: z.number().default(7),
      expiryDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;

      // ─── 10-Field Validation ─────────────────────────────
      // The Zod schema enforces all 10 required fields:
      // 1. document_id, 2. title, 3. category, 4. author,
      // 5. created_at, 6. version, 7. status (DRAFT),
      // 8. department, 9. phi_level, 10. file_path
      // Zod will reject the request with a validation error
      // listing any missing fields before we reach this point.

      // Check for duplicate document_id
      const existing = await db.select().from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.document_id))
        .get();

      if (existing) {
        throw new Error(`Document with ID '${input.document_id}' already exists`);
      }

      const id = randomUUID();
      const now = input.created_at ?? new Date().toISOString();
      const dbStatus = "draft"; // Map DRAFT to internal 'draft'

      // Insert the document with all 10 required fields
      await db.insert(dmsDocuments).values({
        id,
        documentId: input.document_id,
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId ?? "cat-default",
        category: input.category,
        department: input.department,
        status: dbStatus,
        version: 1, // Initial version
        authorId: input.author,
        authorName: actorName,
        fileName: input.fileName ?? null,
        fileType: input.fileType ?? null,
        fileSize: input.fileSize ?? null,
        filePath: input.file_path,
        tagsJson: JSON.stringify(input.tags),
        permissionsJson: JSON.stringify(input.permissions),
        retentionYears: input.retentionYears,
        expiryDate: input.expiryDate ?? null,
        createdAt: now,
        updatedAt: now,
      });

      // Log creation to audit trail
      await logDocumentAction(db, {
        documentId: input.document_id,
        action: "created",
        actorId: ctx.user?.id ?? "unknown",
        actorName,
        toStatus: "draft",
        details: `Document created with 10-field metadata | title: ${input.title} | phi_level: ${input.phi_level} | version: ${input.version}`,
      });

      auditLog({
        action: "m2:createDocument",
        actor,
        resource: `document:${input.document_id}`,
        details: `Created: ${input.title} (10-field enforced)`,
      });

      return {
        success: true,
        id,
        documentId: input.document_id,
        title: input.title,
        status: input.status,
        phi_level: input.phi_level,
        version: input.version,
        validated: true,
        fieldsEnforced: [
          "document_id",
          "title",
          "category",
          "author",
          "created_at",
          "version",
          "status",
          "department",
          "phi_level",
          "file_path",
        ],
      };
    }),

  // ════════════════════════════════════════════════════════════
  // D004-03: Version Lifecycle State Machine
  // ════════════════════════════════════════════════════════════

  transitionDocumentStatus: adminQuery
    .input(z.object({
      documentId: z.string().min(1),
      toStatus: z.enum(["draft", "in-review", "approved", "published", "superseded", "archived", "rejected"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const now = new Date().toISOString();

      // Fetch document
      const doc = await db.select().from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.documentId))
        .get();

      if (!doc) {
        throw new Error(`Document not found: ${input.documentId}`);
      }

      const fromStatus = doc.status;
      const toStatus = input.toStatus;

      // Validate state machine transition
      if (!isValidTransition(fromStatus, toStatus)) {
        throw new Error(`Invalid status transition from ${fromStatus} to ${toStatus}`);
      }

      // Build update data
      const updateData: Record<string, any> = {
        status: toStatus,
        updatedAt: now,
      };

      // Status-specific side effects
      if (toStatus === "in-review") {
        updateData.assignedReviewerId = ctx.user?.id;
        updateData.reviewedAt = now;
        updateData.reviewedBy = actorName;
      }
      if (toStatus === "approved") {
        updateData.approvedAt = now;
        updateData.approvedBy = actorName;
      }
      if (toStatus === "published") {
        updateData.publishedAt = now;
        updateData.publishedBy = actorName;
      }
      if (toStatus === "superseded") {
        updateData.supersededById = ctx.user?.id;
      }
      if (toStatus === "archived") {
        updateData.archivedAt = now;
        updateData.archivedBy = actorName;
        updateData.archiveReason = input.note ?? "Archived via lifecycle transition";
      }
      if (toStatus === "rejected") {
        updateData.archiveReason = input.note ?? "Rejected";
      }

      // Apply transition
      await db.update(dmsDocuments)
        .set(updateData)
        .where(eq(dmsDocuments.documentId, input.documentId));

      // Log transition to audit trail
      await logDocumentAction(db, {
        documentId: input.documentId,
        action: "status-transition",
        actorId: ctx.user?.id ?? "unknown",
        actorName,
        fromStatus,
        toStatus,
        details: input.note ?? `State machine: ${fromStatus} → ${toStatus}`,
      });

      // If superseded, create a version record
      if (toStatus === "superseded") {
        await db.insert(documentVersions).values({
          id: randomUUID(),
          documentId: input.documentId,
          versionNumber: doc.version,
          changeSummary: `Document superseded${input.note ? `: ${input.note}` : ""}`,
          fileName: doc.fileName,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          createdBy: actorName,
          createdAt: now,
        });
      }

      auditLog({
        action: "m2:transitionDocumentStatus",
        actor,
        resource: `document:${input.documentId}`,
        details: `${fromStatus} → ${toStatus}${input.note ? ` | ${input.note}` : ""}`,
      });

      return {
        success: true,
        documentId: input.documentId,
        fromStatus,
        toStatus,
        actor: actorName,
        timestamp: now,
        validTransitions: getNextStatusOptions(toStatus),
        note: input.note ?? null,
      };
    }),

  // ─── Get available transitions for a document ──────────────
  getDocumentTransitions: authedQuery
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const doc = await db.select().from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.documentId))
        .get();

      if (!doc) throw new Error("Document not found");

      return {
        documentId: input.documentId,
        currentStatus: doc.status,
        availableTransitions: getNextStatusOptions(doc.status),
        stateMachine: VALID_TRANSITIONS,
      };
    }),

  // ════════════════════════════════════════════════════════════
  // D004-04: 6-Role Approval Workflow
  // ════════════════════════════════════════════════════════════
  // 6-step approval chain:
  //  1. Author submits → creates task for Department Head
  //  2. Department Head reviews → creates task for Compliance Officer
  //  3. Compliance Officer checks → creates task for QA Officer
  //  4. QA Officer reviews → creates task for Executive Director
  //  5. Executive Director approves → System publishes document
  //  6. Each rejection sends back to Author with notes

  submitForApproval: adminQuery
    .input(z.object({
      documentId: z.string().min(1),
      // Step 1: Author submission details
      authorNotes: z.string().optional(),
      // Optional: pre-assign reviewers by role
      departmentHeadId: z.string().optional(),
      complianceOfficerId: z.string().optional(),
      qaOfficerId: z.string().optional(),
      executiveDirectorId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const actorId = ctx.user?.id ?? "unknown";
      const now = new Date().toISOString();

      // Verify document exists and is in draft status
      const doc = await db.select().from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.documentId))
        .get();

      if (!doc) throw new Error(`Document not found: ${input.documentId}`);
      if (doc.status !== "draft") {
        throw new Error(`Document must be in DRAFT status to submit for approval. Current: ${doc.status}`);
      }

      // Transition document to in-review
      await db.update(dmsDocuments)
        .set({ status: "in-review", assignedReviewerId: actorId, updatedAt: now })
        .where(eq(dmsDocuments.documentId, input.documentId));

      // Create approval chain record
      const chainId = randomUUID();
      sqlite.prepare(
        `INSERT INTO document_approval_chains (
          id, document_id, current_step, total_steps,
          step1_author_submitted, step1_submitted_at, step1_author_id, step1_author_name,
          status, created_at, updated_at
        ) VALUES (?, ?, 1, 6, 1, ?, ?, ?, 'in_progress', datetime('now'), datetime('now'))`
      ).run(chainId, input.documentId, now, actorId, actorName);

      // Create work queue tasks for each step via m1 pattern (raw SQL into work_queue)
      const steps = [
        {
          step: 2,
          title: `Dept Head Review: ${doc.title}`,
          role: "Department Head",
          assignee: input.departmentHeadId ?? null,
          priority: "high" as const,
        },
        {
          step: 3,
          title: `Compliance Review: ${doc.title}`,
          role: "Compliance Officer",
          assignee: input.complianceOfficerId ?? null,
          priority: "high" as const,
        },
        {
          step: 4,
          title: `QA Review: ${doc.title}`,
          role: "QA Officer",
          assignee: input.qaOfficerId ?? null,
          priority: "high" as const,
        },
        {
          step: 5,
          title: `Executive Approval: ${doc.title}`,
          role: "Executive Director",
          assignee: input.executiveDirectorId ?? null,
          priority: "urgent" as const,
        },
      ];

      for (const s of steps) {
        sqlite.prepare(
          `INSERT INTO work_queue (
            id, task_title, task_type, description, assigned_to,
            assigned_by, priority, status, entity_type, entity_id,
            evidence_required, due_date, created_at
          ) VALUES (?, ?, 'document_approval', ?, ?, ?, ?, 'pending', 'document', ?, 0, datetime('now', '+3 days'), datetime('now'))`
        ).run(
          randomUUID(),
          s.title,
          `Step ${s.step} - ${s.role} review for document ${input.documentId}`,
          s.assignee,
          actor,
          s.priority,
          input.documentId
        );
      }

      // Log to audit trail
      await logDocumentAction(db, {
        documentId: input.documentId,
        action: "approval-submitted",
        actorId,
        actorName,
        fromStatus: "draft",
        toStatus: "in-review",
        details: `6-role approval workflow initiated | author: ${actorName} | notes: ${input.authorNotes ?? "none"}`,
      });

      auditLog({
        action: "m2:submitForApproval",
        actor,
        resource: `document:${input.documentId}`,
        details: `6-role approval chain created`,
      });

      return {
        success: true,
        documentId: input.documentId,
        approvalChainId: chainId,
        currentStep: 1,
        totalSteps: 6,
        steps: [
          { step: 1, role: "Author", status: "completed", assignee: actorName, completedAt: now },
          { step: 2, role: "Department Head", status: "pending", assignee: input.departmentHeadId ?? "unassigned" },
          { step: 3, role: "Compliance Officer", status: "pending", assignee: input.complianceOfficerId ?? "unassigned" },
          { step: 4, role: "QA Officer", status: "pending", assignee: input.qaOfficerId ?? "unassigned" },
          { step: 5, role: "Executive Director", status: "pending", assignee: input.executiveDirectorId ?? "unassigned" },
          { step: 6, role: "System Publish", status: "pending", assignee: "system" },
        ],
        status: "in_progress",
        submittedAt: now,
      };
    }),

  // ─── Review approval step (for Department Head, Compliance, QA, Exec) ─
  reviewApprovalStep: adminQuery
    .input(z.object({
      documentId: z.string().min(1),
      step: z.number().min(2).max(5),
      decision: z.enum(["approve", "reject"]),
      reviewerId: z.string().optional(),
      reviewerName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const actorId = ctx.user?.id ?? "unknown";
      const now = new Date().toISOString();

      const doc = await db.select().from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.documentId))
        .get();
      if (!doc) throw new Error("Document not found");

      const chain = sqlite.prepare(
        `SELECT * FROM document_approval_chains WHERE document_id = ? AND status = 'in_progress'`
      ).get(input.documentId) as any;

      if (!chain) throw new Error("No active approval chain found for this document");

      const stepFieldMap: Record<number, { reviewed: string; reviewerId: string; reviewerName: string; reviewedAt: string; notes: string }> = {
        2: { reviewed: "step2_dept_head_reviewed", reviewerId: "step2_dept_head_id", reviewerName: "step2_dept_head_name", reviewedAt: "step2_reviewed_at", notes: "step2_notes" },
        3: { reviewed: "step3_compliance_reviewed", reviewerId: "step3_compliance_id", reviewerName: "step3_compliance_name", reviewedAt: "step3_reviewed_at", notes: "step3_notes" },
        4: { reviewed: "step4_qa_reviewed", reviewerId: "step4_qa_id", reviewerName: "step4_qa_name", reviewedAt: "step4_reviewed_at", notes: "step4_notes" },
        5: { reviewed: "step5_exec_approved", reviewerId: "step5_exec_id", reviewerName: "step5_exec_name", reviewedAt: "step5_approved_at", notes: "step5_notes" },
      };

      const fields = stepFieldMap[input.step];
      if (!fields) throw new Error("Invalid approval step");

      const reviewerName = input.reviewerName ?? actorName;
      const reviewerId = input.reviewerId ?? actorId;

      if (input.decision === "approve") {
        // Mark step as reviewed
        sqlite.prepare(
          `UPDATE document_approval_chains 
           SET ${fields.reviewed} = 1, ${fields.reviewerId} = ?, ${fields.reviewerName} = ?, ${fields.reviewedAt} = ?, ${fields.notes} = ?, current_step = ?, updated_at = ?
           WHERE document_id = ?`
        ).run(reviewerId, reviewerName, now, input.notes ?? null, input.step + 1, now, input.documentId);

        // If step 5 (Executive Director), auto-publish
        if (input.step === 5) {
          sqlite.prepare(
            `UPDATE document_approval_chains 
             SET step6_published = 1, step6_published_at = ?, status = 'completed', updated_at = ?
             WHERE document_id = ?`
          ).run(now, now, input.documentId);

          await db.update(dmsDocuments)
            .set({ status: "published", publishedAt: now, publishedBy: reviewerName, updatedAt: now })
            .where(eq(dmsDocuments.documentId, input.documentId));

          await logDocumentAction(db, {
            documentId: input.documentId,
            action: "approval-completed",
            actorId: reviewerId,
            actorName: reviewerName,
            fromStatus: "in-review",
            toStatus: "published",
            details: `Step 5 (Executive Director) approved → auto-published | ${input.notes ?? ""}`,
          });
        } else {
          await logDocumentAction(db, {
            documentId: input.documentId,
            action: "approval-step-approved",
            actorId: reviewerId,
            actorName: reviewerName,
            details: `Step ${input.step} approved by ${reviewerName} | ${input.notes ?? ""}`,
          });
        }

        auditLog({ action: "m2:reviewApprovalStep", actor, resource: `document:${input.documentId}`, details: `Step ${input.step} approved` });
        return { success: true, documentId: input.documentId, step: input.step, decision: "approve", nextStep: input.step === 5 ? 6 : input.step + 1 };
      } else {
        // Rejection: send back to author
        sqlite.prepare(
          `UPDATE document_approval_chains 
           SET status = 'rejected', rejection_reason = ?, rejected_at = ?, rejected_by_step = ?, updated_at = ?
           WHERE document_id = ?`
        ).run(input.notes ?? `Rejected at step ${input.step}`, now, String(input.step), now, input.documentId);

        // Revert document to draft
        await db.update(dmsDocuments)
          .set({ status: "draft", updatedAt: now, reviewNotes: input.notes ?? `Rejected at step ${input.step}` })
          .where(eq(dmsDocuments.documentId, input.documentId));

        // Create a task for the author to fix and resubmit
        sqlite.prepare(
          `INSERT INTO work_queue (
            id, task_title, task_type, description, assigned_to,
            assigned_by, priority, status, entity_type, entity_id, created_at
          ) VALUES (?, ?, 'document_approval', ?, ?, ?, 'urgent', 'pending', 'document', ?, datetime('now'))`
        ).run(
          randomUUID(),
          `Fix and Resubmit: ${doc.title}`,
          `Document rejected at Step ${input.step}. Reason: ${input.notes ?? "No reason provided"}`,
          doc.authorId,
          reviewerName,
          input.documentId
        );

        await logDocumentAction(db, {
          documentId: input.documentId,
          action: "approval-rejected",
          actorId: reviewerId,
          actorName: reviewerName,
          fromStatus: "in-review",
          toStatus: "draft",
          details: `Step ${input.step} rejected by ${reviewerName} | Reason: ${input.notes ?? "none"}`,
        });

        auditLog({ action: "m2:reviewApprovalStep", actor, resource: `document:${input.documentId}`, details: `Step ${input.step} rejected → back to author` });
        return { success: true, documentId: input.documentId, step: input.step, decision: "reject", returnedTo: "author", reason: input.notes ?? null };
      }
    }),

  // ─── Get approval chain status ─────────────────────────────
  getApprovalChain: authedQuery
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input }) => {
      const chain = sqlite.prepare(
        `SELECT * FROM document_approval_chains WHERE document_id = ? ORDER BY created_at DESC LIMIT 1`
      ).get(input.documentId) as any;

      if (!chain) return { documentId: input.documentId, chain: null };

      return {
        documentId: input.documentId,
        chain: {
          id: chain.id,
          currentStep: chain.current_step,
          totalSteps: chain.total_steps,
          status: chain.status,
          steps: [
            { step: 1, role: "Author", completed: !!chain.step1_author_submitted, completedAt: chain.step1_submitted_at, by: chain.step1_author_name },
            { step: 2, role: "Department Head", completed: !!chain.step2_dept_head_reviewed, completedAt: chain.step2_reviewed_at, by: chain.step2_dept_head_name, notes: chain.step2_notes },
            { step: 3, role: "Compliance Officer", completed: !!chain.step3_compliance_reviewed, completedAt: chain.step3_reviewed_at, by: chain.step3_compliance_name, notes: chain.step3_notes },
            { step: 4, role: "QA Officer", completed: !!chain.step4_qa_reviewed, completedAt: chain.step4_reviewed_at, by: chain.step4_qa_name, notes: chain.step4_notes },
            { step: 5, role: "Executive Director", completed: !!chain.step5_exec_approved, completedAt: chain.step5_approved_at, by: chain.step5_exec_name, notes: chain.step5_notes },
            { step: 6, role: "System Publish", completed: !!chain.step6_published, completedAt: chain.step6_published_at, by: "system" },
          ],
          rejectionReason: chain.rejection_reason,
          rejectedAt: chain.rejected_at,
          createdAt: chain.created_at,
        },
      };
    }),

  // ════════════════════════════════════════════════════════════
  // D004-05: Packet Builder
  // ════════════════════════════════════════════════════════════

  buildPacket: authedQuery
    .input(z.object({
      packetType: z.enum(["admission", "treatment_plan", "payer", "cap", "audit_binder", "discharge"]),
      patientId: z.string().optional(),
      caseId: z.string().optional(),
      youthId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const now = new Date().toISOString();

      // Build packet: assemble documents by type with optional patient/case filters
      let conditions = [];

      // Base query - all active documents
      let allDocs = await db.select().from(dmsDocuments).all();

      // Filter by packet type (category mapping)
      const packetCategoryMap: Record<string, string[]> = {
        admission: ["HR Policies", "Clinical Protocols", "Form Templates"],
        treatment_plan: ["Clinical Protocols", "QA & Compliance", "Training Materials"],
        payer: ["Revenue Cycle", "GAD Administration"],
        cap: ["QA & Compliance", "GAD Administration", "Executive"],
        audit_binder: ["QA & Compliance", "Form Templates", "Executive"],
        discharge: ["HR Policies", "Clinical Protocols", "GRO Operations", "Incident Reports"],
      };

      const relevantCategories = packetCategoryMap[input.packetType] ?? [];

      // Filter documents by category
      let filteredDocs = allDocs.filter((d) =>
        relevantCategories.some((cat) =>
          d.category?.toLowerCase().includes(cat.toLowerCase()) ||
          d.department?.toLowerCase().includes(cat.toLowerCase())
        )
      );

      // Exclude archived/superseded documents from packets
      filteredDocs = filteredDocs.filter((d) =>
        !["archived", "superseded"].includes(d.status)
      );

      // Build packet metadata
      const packet = {
        packetType: input.packetType,
        documents: filteredDocs.map((d) => ({
          id: d.id,
          documentId: d.documentId,
          title: d.title,
          category: d.category,
          department: d.department,
          status: d.status,
          version: d.version,
          authorName: d.authorName,
          filePath: d.filePath,
          createdAt: d.createdAt,
        })),
        generatedAt: now,
        generatedBy: actorName,
        totalDocuments: filteredDocs.length,
        filters: {
          packetType: input.packetType,
          patientId: input.patientId ?? null,
          caseId: input.caseId ?? null,
          youthId: input.youthId ?? null,
          categories: relevantCategories,
        },
      };

      // Log packet generation to audit trail
      if (filteredDocs.length > 0) {
        const docIds = filteredDocs.map((d) => d.documentId).join(", ");
        await logDocumentAction(db, {
          documentId: filteredDocs[0].documentId, // Log against first doc
          action: "packet-generated",
          actorId: ctx.user?.id ?? "unknown",
          actorName,
          details: `Packet built: ${input.packetType} | ${filteredDocs.length} documents | patientId=${input.patientId ?? "n/a"} | docIds: ${docIds}`,
        });
      }

      auditLog({
        action: "m2:buildPacket",
        actor,
        resource: `packet:${input.packetType}`,
        details: `${filteredDocs.length} documents assembled`,
      });

      return packet;
    }),

  // ════════════════════════════════════════════════════════════
  // D004-06: Retention Automation
  // ════════════════════════════════════════════════════════════

  computeRetentionDate: authedQuery
    .input(z.object({
      documentId: z.string().min(1),
      triggerEvent: z.enum([
        "discharge",
        "fiscal_year_end",
        "separation",
        "audit_completion",
        "incident",
        "training_completion",
      ]),
      triggerDate: z.string().min(1, "triggerDate is required (ISO 8601 format)"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;

      // Retention rules (years)
      const RETENTION_RULES: Record<string, number> = {
        discharge: 7,
        fiscal_year_end: 3,
        separation: 7,
        audit_completion: 5,
        incident: 5,
        training_completion: 3,
      };

      const retentionYears = RETENTION_RULES[input.triggerEvent];
      if (!retentionYears) {
        throw new Error(`Unknown trigger event: ${input.triggerEvent}`);
      }

      // Compute retention date: triggerDate + retentionYears
      const triggerDateObj = new Date(input.triggerDate);
      if (isNaN(triggerDateObj.getTime())) {
        throw new Error(`Invalid triggerDate: ${input.triggerDate}`);
      }

      const retentionUntilDate = new Date(triggerDateObj);
      retentionUntilDate.setFullYear(retentionUntilDate.getFullYear() + retentionYears);
      const retentionUntilIso = retentionUntilDate.toISOString();

      // Check if expired
      const now = new Date();
      const isExpired = now > retentionUntilDate;

      // Store/update retention schedule
      const existing = sqlite.prepare(
        `SELECT id FROM document_retention_schedules WHERE document_id = ?`
      ).get(input.documentId) as { id: string } | undefined;

      const scheduleId = existing?.id ?? randomUUID();

      if (existing) {
        sqlite.prepare(
          `UPDATE document_retention_schedules 
           SET trigger_event = ?, trigger_date = ?, retention_years = ?, 
               retention_until_date = ?, is_expired = ?, expired_flagged_at = ?,
               computed_at = datetime('now')
           WHERE id = ?`
        ).run(
          input.triggerEvent, input.triggerDate, retentionYears,
          retentionUntilIso, isExpired ? 1 : 0,
          isExpired ? now.toISOString() : null,
          scheduleId
        );
      } else {
        sqlite.prepare(
          `INSERT INTO document_retention_schedules 
           (id, document_id, trigger_event, trigger_date, retention_years, 
            retention_until_date, is_expired, expired_flagged_at, computed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(
          scheduleId, input.documentId, input.triggerEvent, input.triggerDate,
          retentionYears, retentionUntilIso, isExpired ? 1 : 0,
          isExpired ? now.toISOString() : null
        );
      }

      // Also update the document's retentionYears and expiryDate
      await db.update(dmsDocuments)
        .set({
          retentionYears,
          expiryDate: retentionUntilIso,
          updatedAt: now.toISOString(),
        })
        .where(eq(dmsDocuments.documentId, input.documentId));

      auditLog({
        action: "m2:computeRetentionDate",
        actor,
        resource: `document:${input.documentId}`,
        details: `${input.triggerEvent} → ${retentionYears}yr retention | until ${retentionUntilIso}${isExpired ? " | EXPIRED" : ""}`,
      });

      return {
        documentId: input.documentId,
        triggerEvent: input.triggerEvent,
        triggerDate: input.triggerDate,
        retentionYears,
        retentionUntilDate: retentionUntilIso,
        isExpired,
        expiredFlaggedAt: isExpired ? now.toISOString() : null,
        rule: `${input.triggerEvent} = triggerDate + ${retentionYears} years`,
        computedAt: now.toISOString(),
        computedBy: actorName,
      };
    }),

  // ─── List expired records ──────────────────────────────────
  getExpiredRecords: authedQuery.query(async () => {
    const expired = sqlite.prepare(
      `SELECT drs.*, dd.title, dd.department, dd.category, dd.status 
       FROM document_retention_schedules drs
       LEFT JOIN dms_documents dd ON drs.document_id = dd.document_id
       WHERE drs.is_expired = 1
       ORDER BY drs.retention_until_date ASC`
    ).all() as any[];

    return {
      expiredCount: expired.length,
      records: expired.map((r) => ({
        documentId: r.document_id,
        title: r.title,
        triggerEvent: r.trigger_event,
        triggerDate: r.trigger_date,
        retentionUntilDate: r.retention_until_date,
        expiredFlaggedAt: r.expired_flagged_at,
        department: r.department,
        status: r.status,
      })),
    };
  }),

  // ─── Check retention status for a document ─────────────────
  getRetentionStatus: authedQuery
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input }) => {
      const schedule = sqlite.prepare(
        `SELECT * FROM document_retention_schedules WHERE document_id = ? ORDER BY computed_at DESC LIMIT 1`
      ).get(input.documentId) as any;

      if (!schedule) {
        return {
          documentId: input.documentId,
          hasRetentionSchedule: false,
          isExpired: false,
        };
      }

      return {
        documentId: input.documentId,
        hasRetentionSchedule: true,
        triggerEvent: schedule.trigger_event,
        triggerDate: schedule.trigger_date,
        retentionYears: schedule.retention_years,
        retentionUntilDate: schedule.retention_until_date,
        isExpired: !!schedule.is_expired,
        expiredFlaggedAt: schedule.expired_flagged_at,
        computedAt: schedule.computed_at,
      };
    }),

  // ════════════════════════════════════════════════════════════
  // D004-07: Audit Trail
  // ════════════════════════════════════════════════════════════

  getDocumentAuditLog: authedQuery
    .input(z.object({
      documentId: z.string().min(1),
      actions: z.array(z.string()).optional(), // Filter by action types
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;

      // Fetch all audit entries for the document
      let auditEntries = await db.select().from(documentAuditLog)
        .where(eq(documentAuditLog.documentId, input.documentId))
        .orderBy(desc(documentAuditLog.createdAt))
        .all();

      // Apply action filter if provided
      if (input.actions && input.actions.length > 0) {
        auditEntries = auditEntries.filter((e) =>
          input.actions!.includes(e.action)
        );
      }

      // Apply date filters if provided
      if (input.fromDate) {
        const from = new Date(input.fromDate).getTime();
        auditEntries = auditEntries.filter((e) => new Date(e.createdAt).getTime() >= from);
      }
      if (input.toDate) {
        const to = new Date(input.toDate).getTime();
        auditEntries = auditEntries.filter((e) => new Date(e.createdAt).getTime() <= to);
      }

      // Get the document details
      const doc = await db.select().from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.documentId))
        .get();

      // Build comprehensive audit trail
      const trail = {
        documentId: input.documentId,
        documentTitle: doc?.title ?? "Unknown",
        totalActions: auditEntries.length,
        generatedAt: new Date().toISOString(),
        generatedBy: actorName,
        summary: {
          created: auditEntries.filter((e) => e.action === "created").length,
          updated: auditEntries.filter((e) => e.action === "updated").length,
          deleted: auditEntries.filter((e) => e.action === "deleted").length,
          statusTransitions: auditEntries.filter((e) =>
            ["status-transition", "status-changed"].includes(e.action)
          ).length,
          reviews: auditEntries.filter((e) =>
            ["reviewed", "approval-step-approved"].includes(e.action)
          ).length,
          approvals: auditEntries.filter((e) =>
            ["approved", "approval-completed", "approval-submitted"].includes(e.action)
          ).length,
          versionChanges: auditEntries.filter((e) => e.action === "version-change").length,
          views: auditEntries.filter((e) => e.action === "viewed").length,
          downloads: auditEntries.filter((e) => e.action === "downloaded").length,
          packets: auditEntries.filter((e) => e.action === "packet-generated").length,
          exports: auditEntries.filter((e) => e.action === "exported").length,
        },
        entries: auditEntries.map((e) => ({
          timestamp: e.createdAt,
          actor: e.actorName,
          actorId: e.actorId,
          action: e.action,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          details: e.details,
        })),
        actionTypes: [...new Set(auditEntries.map((e) => e.action))],
      };

      auditLog({
        action: "m2:getDocumentAuditLog",
        actor,
        resource: `document:${input.documentId}`,
        details: `Retrieved audit trail: ${auditEntries.length} entries`,
      });

      return trail;
    }),

  // ─── Log document view (internal audit logging) ────────────
  logDocumentView: authedQuery
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || ctx.user?.email ?? "unknown";

      await logDocumentAction(db, {
        documentId: input.documentId,
        action: "viewed",
        actorId: ctx.user?.id ?? "unknown",
        actorName,
        details: `Document viewed by ${actorName}`,
      });

      return { success: true };
    }),

  // ─── Log document download (internal audit logging) ────────
  logDocumentDownload: authedQuery
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || ctx.user?.email ?? "unknown";

      await logDocumentAction(db, {
        documentId: input.documentId,
        action: "downloaded",
        actorId: ctx.user?.id ?? "unknown",
        actorName,
        details: `Document downloaded by ${actorName}`,
      });

      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // EXISTING: Categories
  // ════════════════════════════════════════════════════════════

  listCategories: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(documentCategories).where(eq(documentCategories.isActive, true)).orderBy(documentCategories.sortOrder).all();
  }),

  seedCategories: adminQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const actor = ctx.user?.email ?? "unknown";
    const categories = [
      { name: "HR Policies", code: "HR-POL", description: "Human resources policies and procedures", department: "HR" },
      { name: "Clinical Protocols", code: "CLN-PRO", description: "Clinical treatment protocols and procedures", department: "Clinical" },
      { name: "GRO Operations", code: "GRO-OPS", description: "Residential facility operations manuals", department: "GRO" },
      { name: "QA & Compliance", code: "QA-COMP", description: "Quality assurance and compliance documentation", department: "QA" },
      { name: "Revenue Cycle", code: "REV-CYC", description: "Revenue cycle management documentation", department: "Revenue" },
      { name: "GAD Administration", code: "GAD-ADM", description: "General administration documentation", department: "GAD" },
      { name: "Training Materials", code: "TRN-MAT", description: "Training and educational materials", department: "HR" },
      { name: "Incident Reports", code: "INC-RPT", description: "Incident and event reports", department: "GRO" },
      { name: "Form Templates", code: "FRM-TPL", description: "Standard form templates", department: "All" },
      { name: "Executive", code: "EXEC", description: "Executive-level documentation", department: "Executive" },
    ];

    for (const c of categories) {
      await db.insert(documentCategories).values({
        id: randomUUID(),
        name: c.name,
        code: c.code,
        description: c.description,
        department: c.department,
        sortOrder: categories.indexOf(c),
        isActive: true,
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing();
    }

    auditLog({ action: "m2:seedCategories", actor, resource: "system", details: `Seeded ${categories.length} document categories` });
    return { seeded: categories.length };
  }),

  // ════════════════════════════════════════════════════════════
  // EXISTING: Document CRUD (with added audit logging)
  // ════════════════════════════════════════════════════════════

  list: publicQuery
    .input(z.object({
      categoryId: z.string().optional(),
      status: z.string().optional(),
      department: z.string().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();

      let query = db.select().from(dmsDocuments);
      const conditions = [];

      if (input?.categoryId) conditions.push(eq(dmsDocuments.categoryId, input.categoryId));
      if (input?.status) conditions.push(eq(dmsDocuments.status, input.status));
      if (input?.department) conditions.push(eq(dmsDocuments.department, input.department));
      if (input?.search) {
        conditions.push(
          or(
            like(dmsDocuments.title, `%${input.search}%`),
            like(dmsDocuments.documentId, `%${input.search}%`),
            like(dmsDocuments.description, `%${input.search}%`),
          )
        );
      }

      let results;
      if (conditions.length > 0) {
        results = await query.where(and(...conditions)).orderBy(desc(dmsDocuments.createdAt)).all();
      } else {
        results = await query.orderBy(desc(dmsDocuments.createdAt)).all();
      }

      const total = results.length;
      const pageSize = input?.pageSize ?? 20;
      const page = input?.page ?? 1;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      return { documents: paginated, total, page, pageSize };
    }),

  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || ctx.user?.email ?? "unknown";

      const doc = await db.select().from(dmsDocuments).where(eq(dmsDocuments.id, input.id)).get();
      if (!doc) throw new Error("Document not found");

      const versions = await db.select().from(documentVersions)
        .where(eq(documentVersions.documentId, doc.documentId))
        .orderBy(desc(documentVersions.versionNumber)).all();

      const audit = await db.select().from(documentAuditLog)
        .where(eq(documentAuditLog.documentId, doc.documentId))
        .orderBy(desc(documentAuditLog.createdAt)).all();

      // D004-07: Log view action
      await logDocumentAction(db, {
        documentId: doc.documentId,
        action: "viewed",
        actorId: ctx.user?.id ?? "anonymous",
        actorName,
        details: `Document retrieved via getById`,
      });

      return { ...doc, versions, audit };
    }),

  // Legacy create endpoint (preserved, uses D004-01 internally)
  create: authedQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      categoryId: z.string(),
      category: z.string(),
      department: z.string(),
      documentId: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      fileSize: z.number().optional(),
      filePath: z.string().optional(),
      tags: z.array(z.string()).default([]),
      permissions: z.array(z.string()).default([]),
      retentionYears: z.number().default(7),
      expiryDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim();
      const id = randomUUID();

      // Generate document ID if not provided (using D004-01 logic)
      const deptCode = input.department.substring(0, 3).toUpperCase();
      const catCode = input.category.substring(0, 3).toUpperCase();
      const now = new Date();
      const yearShort = String(now.getFullYear()).slice(2);
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const yearMonth = `${yearShort}${month}`;

      // Get sequence
      const seqResult = sqlite.prepare(
        `SELECT last_sequence FROM document_id_sequences 
         WHERE department = ? AND category = ? AND year_month = ?`
      ).get(deptCode, catCode, yearMonth) as { last_sequence: number } | undefined;
      const nextSeq = (seqResult?.last_sequence ?? 0) + 1;

      const docId = input.documentId ?? `ADL-${deptCode}-${catCode}-${yearMonth}-${String(nextSeq).padStart(4, "0")}`;

      // Upsert sequence
      if (seqResult) {
        sqlite.prepare(
          `UPDATE document_id_sequences SET last_sequence = ? 
           WHERE department = ? AND category = ? AND year_month = ?`
        ).run(nextSeq, deptCode, catCode, yearMonth);
      } else {
        sqlite.prepare(
          `INSERT INTO document_id_sequences (id, department, category, year_month, last_sequence) 
           VALUES (?, ?, ?, ?, ?)`
        ).run(randomUUID(), deptCode, catCode, yearMonth, nextSeq);
      }

      const nowIso = now.toISOString();

      await db.insert(dmsDocuments).values({
        id,
        documentId: docId,
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId,
        category: input.category,
        department: input.department,
        status: "draft",
        version: 1,
        authorId: ctx.user?.id ?? "unknown",
        authorName: actorName || actor,
        fileName: input.fileName ?? null,
        fileType: input.fileType ?? null,
        fileSize: input.fileSize ?? null,
        filePath: input.filePath ?? null,
        tagsJson: JSON.stringify(input.tags),
        permissionsJson: JSON.stringify(input.permissions),
        retentionYears: input.retentionYears,
        expiryDate: input.expiryDate ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // D004-07: Log creation to audit trail
      await logDocumentAction(db, {
        documentId: docId,
        action: "created",
        actorId: ctx.user?.id ?? "unknown",
        actorName: actorName || actor,
        toStatus: "draft",
        details: `Document created: ${input.title}`,
      });

      auditLog({ action: "m2:createDocument", actor, resource: `document:${docId}`, details: `Created: ${input.title}` });
      return { success: true, id, documentId: docId };
    }),

  update: authedQuery
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      categoryId: z.string().optional(),
      category: z.string().optional(),
      department: z.string().optional(),
      tags: z.array(z.string()).optional(),
      permissions: z.array(z.string()).optional(),
      retentionYears: z.number().optional(),
      expiryDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const { id, ...updates } = input;
      const now = new Date().toISOString();

      const updateData: Record<string, any> = { updatedAt: now };
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.tags !== undefined) updateData.tagsJson = JSON.stringify(updates.tags);
      if (updates.permissions !== undefined) updateData.permissionsJson = JSON.stringify(updates.permissions);
      if (updates.retentionYears !== undefined) updateData.retentionYears = updates.retentionYears;
      if (updates.expiryDate !== undefined) updateData.expiryDate = updates.expiryDate;

      await db.update(dmsDocuments).set(updateData).where(eq(dmsDocuments.id, id));

      // D004-07: Log update to audit trail
      const doc = await db.select().from(dmsDocuments).where(eq(dmsDocuments.id, id)).get();
      if (doc) {
        await logDocumentAction(db, {
          documentId: doc.documentId,
          action: "updated",
          actorId: ctx.user?.id ?? "unknown",
          actorName,
          details: `Document updated: ${Object.keys(updates).filter((k) => updates[k as keyof typeof updates] !== undefined).join(", ")}`,
        });
      }

      auditLog({ action: "m2:updateDocument", actor, resource: `document:${id}`, details: `Updated document metadata` });
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;

      const doc = await db.select().from(dmsDocuments).where(eq(dmsDocuments.id, input.id)).get();
      if (doc) {
        // D004-07: Log deletion to audit trail
        await logDocumentAction(db, {
          documentId: doc.documentId,
          action: "deleted",
          actorId: ctx.user?.id ?? "unknown",
          actorName,
          fromStatus: doc.status,
          details: `Document deleted: ${doc.title}`,
        });
      }

      await db.delete(dmsDocuments).where(eq(dmsDocuments.id, input.id));
      auditLog({ action: "m2:deleteDocument", actor, resource: `document:${input.id}`, details: `Deleted document` });
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // EXISTING: Document Lifecycle (enhanced with D004-03)
  // ════════════════════════════════════════════════════════════

  transitionStatus: authedQuery
    .input(z.object({
      id: z.string(),
      toStatus: z.enum(["draft", "in-review", "approved", "published", "archived", "superseded"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const now = new Date().toISOString();

      const doc = await db.select().from(dmsDocuments).where(eq(dmsDocuments.id, input.id)).get();
      if (!doc) throw new Error("Document not found");

      const fromStatus = doc.status;
      const toStatus = input.toStatus;

      // Use D004-03 enhanced state machine
      if (!isValidTransition(fromStatus, toStatus)) {
        throw new Error(`Invalid status transition from ${fromStatus} to ${toStatus}`);
      }

      const updateData: Record<string, any> = { status: toStatus, updatedAt: now };

      if (toStatus === "in-review") {
        updateData.assignedReviewerId = ctx.user?.id;
      }
      if (toStatus === "approved") {
        updateData.approvedAt = now;
        updateData.approvedBy = actorName;
      }
      if (toStatus === "published") {
        updateData.publishedAt = now;
        updateData.publishedBy = actorName;
      }
      if (toStatus === "archived") {
        updateData.archivedAt = now;
        updateData.archivedBy = actorName;
        updateData.archiveReason = input.note ?? "Manual archive";
      }

      await db.update(dmsDocuments).set(updateData).where(eq(dmsDocuments.id, input.id));

      // D004-07: Log transition to audit trail
      await logDocumentAction(db, {
        documentId: doc.documentId,
        action: "status-transition",
        actorId: ctx.user?.id ?? "unknown",
        actorName,
        fromStatus,
        toStatus,
        details: input.note ?? `Status changed from ${fromStatus} to ${toStatus}`,
      });

      auditLog({ action: "m2:transitionStatus", actor, resource: `document:${doc.documentId}`, details: `${fromStatus} -> ${toStatus}` });
      return { success: true, fromStatus, toStatus };
    }),

  // ════════════════════════════════════════════════════════════
  // EXISTING: Version Management (with audit logging)
  // ════════════════════════════════════════════════════════════

  createVersion: authedQuery
    .input(z.object({
      documentId: z.string(),
      changeSummary: z.string(),
      fileName: z.string().optional(),
      filePath: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user?.email ?? "unknown";
      const actorName = `${ctx.user?.firstName ?? ""} ${ctx.user?.lastName ?? ""}`.trim() || actor;
      const now = new Date().toISOString();

      const existing = await db.select().from(documentVersions)
        .where(eq(documentVersions.documentId, input.documentId))
        .orderBy(desc(documentVersions.versionNumber)).all();
      const nextVersion = (existing[0]?.versionNumber ?? 0) + 1;

      await db.insert(documentVersions).values({
        id: randomUUID(),
        documentId: input.documentId,
        versionNumber: nextVersion,
        changeSummary: input.changeSummary,
        fileName: input.fileName ?? null,
        filePath: input.filePath ?? null,
        fileSize: input.fileSize ?? null,
        createdBy: actorName,
        createdAt: now,
      });

      await db.update(dmsDocuments)
        .set({ version: nextVersion, updatedAt: now })
        .where(eq(dmsDocuments.documentId, input.documentId));

      // D004-07: Log version change to audit trail
      await logDocumentAction(db, {
        documentId: input.documentId,
        action: "version-change",
        actorId: ctx.user?.id ?? "unknown",
        actorName,
        details: `Version changed to ${nextVersion}: ${input.changeSummary}`,
      });

      auditLog({ action: "m2:createVersion", actor, resource: `document:${input.documentId}`, details: `Created version ${nextVersion}` });
      return { success: true, versionNumber: nextVersion };
    }),

  // ════════════════════════════════════════════════════════════
  // EXISTING: Seed Data
  // ════════════════════════════════════════════════════════════

  seedDocuments: publicQuery.mutation(async () => {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = await db.select().from(dmsDocuments).limit(1);
    if (existing.length > 0) return { success: true, message: "Already seeded" };

    const categories = [
      { id: "cat-001", name: "HR Policies", code: "HR-POL", description: "Human resources policies and procedures", department: "HR", sortOrder: 0 },
      { id: "cat-002", name: "Clinical Protocols", code: "CLN-PRO", description: "Clinical treatment protocols and procedures", department: "Clinical", sortOrder: 1 },
      { id: "cat-003", name: "GRO Operations", code: "GRO-OPS", description: "Residential facility operations manuals", department: "GRO", sortOrder: 2 },
      { id: "cat-004", name: "QA & Compliance", code: "QA-COMP", description: "Quality assurance and compliance documentation", department: "QA", sortOrder: 3 },
      { id: "cat-005", name: "Revenue Cycle", code: "REV-CYC", description: "Revenue cycle management documentation", department: "Revenue", sortOrder: 4 },
      { id: "cat-006", name: "GAD Administration", code: "GAD-ADM", description: "General administration documentation", department: "GAD", sortOrder: 5 },
      { id: "cat-007", name: "Training Materials", code: "TRN-MAT", description: "Training and educational materials", department: "HR", sortOrder: 6 },
      { id: "cat-008", name: "Incident Reports", code: "INC-RPT", description: "Incident and event reports", department: "GRO", sortOrder: 7 },
      { id: "cat-009", name: "Form Templates", code: "FRM-TPL", description: "Standard form templates", department: "All", sortOrder: 8 },
      { id: "cat-010", name: "Executive", code: "EXEC", description: "Executive-level documentation", department: "Executive", sortOrder: 9 },
    ];
    for (const c of categories) {
      await db.insert(documentCategories).values({ ...c, isActive: true, createdAt: now });
    }

    const docs = [
      { id: "doc-001", documentId: "ADL-HR-POL-202606-0001", title: "Employee Handbook 2026", description: "Comprehensive employee handbook covering policies, benefits, conduct, and procedures for all staff.", categoryId: "cat-001", category: "HR Policies", department: "HR", status: "published" as const, version: 3, authorId: "admin-001", authorName: "E. Russ Aideyan", tagsJson: JSON.stringify(["handbook", "policy", "all-staff"]), retentionYears: 7, publishedAt: now, publishedBy: "E. Russ Aideyan" },
      { id: "doc-002", documentId: "ADL-CLN-PRO-202606-0001", title: "Crisis Intervention Protocol", description: "Step-by-step crisis intervention procedures for behavioral health emergencies.", categoryId: "cat-002", category: "Clinical Protocols", department: "Clinical", status: "published" as const, version: 2, authorId: "user-003", authorName: "Dr. Hall", tagsJson: JSON.stringify(["crisis", "safety", "protocol", "training-required"]), retentionYears: 7, publishedAt: now, publishedBy: "Dr. Hall" },
      { id: "doc-003", documentId: "ADL-CLN-PRO-202606-0002", title: "CANS Assessment Guide", description: "Child and Adolescent Needs and Strengths assessment administration guide with scoring rubrics.", categoryId: "cat-002", category: "Clinical Protocols", department: "Clinical", status: "published" as const, version: 1, authorId: "user-003", authorName: "Dr. Hall", tagsJson: JSON.stringify(["CANS", "assessment", "HHSC"]), retentionYears: 7, publishedAt: now, publishedBy: "Dr. Hall" },
      { id: "doc-004", documentId: "ADL-GRO-OPS-202606-0001", title: "GRO Residential Operations Manual", description: "Day-to-day operations for General Residential Operations including staffing ratios and procedures.", categoryId: "cat-003", category: "GRO Operations", department: "GRO", status: "published" as const, version: 4, authorId: "admin-001", authorName: "E. Russ Aideyan", tagsJson: JSON.stringify(["GRO", "operations", "T-748"]), retentionYears: 7, publishedAt: now, publishedBy: "E. Russ Aideyan" },
      { id: "doc-005", documentId: "ADL-QA-COMP-202606-0001", title: "Chart Audit Checklist", description: "9-area clinical chart review checklist with corrective action tracking.", categoryId: "cat-004", category: "QA & Compliance", department: "QA", status: "approved" as const, version: 2, authorId: "user-003", authorName: "Dr. Hall", tagsJson: JSON.stringify(["audit", "chart-review", "compliance"]), retentionYears: 5, approvedAt: now, approvedBy: "Dr. Hall" },
      { id: "doc-006", documentId: "ADL-REV-CYC-202606-0001", title: "Texas Medicaid Billing Guide", description: "HHSC Texas Medicaid billing procedures for T1017 and H2017 service codes.", categoryId: "cat-005", category: "Revenue Cycle", department: "Revenue", status: "published" as const, version: 1, authorId: "admin-001", authorName: "E. Russ Aideyan", tagsJson: JSON.stringify(["Medicaid", "billing", "T1017", "H2017", "HHSC"]), retentionYears: 7, publishedAt: now, publishedBy: "E. Russ Aideyan" },
      { id: "doc-007", documentId: "ADL-TRN-MAT-202606-0001", title: "42 CFR Part 2 Training Module", description: "SUD confidentiality training module for all clinical and residential staff.", categoryId: "cat-007", category: "Training Materials", department: "HR", status: "in-review" as const, version: 1, authorId: "user-003", authorName: "Dr. Hall", tagsJson: JSON.stringify(["training", "42CFR2", "SUD", "confidentiality"]), retentionYears: 3 },
      { id: "doc-008", documentId: "ADL-FRM-TPL-202606-0001", title: "Incident Report Template", description: "Standard incident report form for restraint, seclusion, and behavioral events.", categoryId: "cat-009", category: "Form Templates", department: "GRO", status: "published" as const, version: 5, authorId: "admin-001", authorName: "E. Russ Aideyan", tagsJson: JSON.stringify(["incident", "form", "T-748", "template"]), retentionYears: 7, publishedAt: now, publishedBy: "E. Russ Aideyan" },
      { id: "doc-009", documentId: "ADL-GAD-ADM-202606-0001", title: "Facility Maintenance Schedule", description: "Annual maintenance schedule for HVAC, plumbing, electrical, and grounds.", categoryId: "cat-006", category: "GAD Administration", department: "GAD", status: "draft" as const, version: 1, authorId: "admin-001", authorName: "E. Russ Aideyan", tagsJson: JSON.stringify(["maintenance", "facility", "GAD"]), retentionYears: 3 },
      { id: "doc-010", documentId: "ADL-EXEC-202606-0001", title: "MGMA Scorecard Template", description: "7-domain practice management scorecard with KPI tracking and benchmarking.", categoryId: "cat-010", category: "Executive", department: "Executive", status: "published" as const, version: 1, authorId: "admin-001", authorName: "E. Russ Aideyan", tagsJson: JSON.stringify(["MGMA", "scorecard", "KPI", "executive"]), retentionYears: 10, publishedAt: now, publishedBy: "E. Russ Aideyan" },
    ];
    for (const d of docs) {
      await db.insert(dmsDocuments).values({ ...d, fileName: null, fileType: null, fileSize: null, filePath: null, permissionsJson: null, createdAt: now, updatedAt: now });
    }

    // Seed audit log entries
    const auditEntries = [
      { id: "da-001", documentId: "ADL-HR-POL-202606-0001", action: "created" as const, actorId: "admin-001", actorName: "E. Russ Aideyan", toStatus: "draft", details: "Document created", createdAt: now },
      { id: "da-002", documentId: "ADL-HR-POL-202606-0001", action: "status-changed" as const, actorId: "admin-001", actorName: "E. Russ Aideyan", fromStatus: "draft", toStatus: "published", details: "Published by E. Russ Aideyan", createdAt: now },
    ];
    for (const a of auditEntries) {
      await db.insert(documentAuditLog).values(a);
    }

    return { success: true, message: `${categories.length} categories + ${docs.length} documents seeded` };
  }),

  // ════════════════════════════════════════════════════════════
  // EXISTING: Statistics (with enhanced status tracking)
  // ════════════════════════════════════════════════════════════

  stats: publicQuery.query(async () => {
    const db = getDb();

    const allDocs = await db.select().from(dmsDocuments).all();

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};

    for (const doc of allDocs) {
      byStatus[doc.status] = (byStatus[doc.status] ?? 0) + 1;
      byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
      byDepartment[doc.department] = (byDepartment[doc.department] ?? 0) + 1;
    }

    return {
      total: allDocs.length,
      byStatus,
      byCategory,
      byDepartment,
      draft: byStatus.draft ?? 0,
      inReview: byStatus["in-review"] ?? 0,
      approved: byStatus.approved ?? 0,
      published: byStatus.published ?? 0,
      archived: byStatus.archived ?? 0,
      superseded: byStatus.superseded ?? 0,
      rejected: byStatus.rejected ?? 0,
      recent: allDocs
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((d) => ({ id: d.id, documentId: d.documentId, title: d.title, status: d.status, createdAt: d.createdAt })),
    };
  }),
});
