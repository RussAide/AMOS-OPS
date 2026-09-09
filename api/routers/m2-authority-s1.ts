import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import {
  dmsDocuments,
  documentAuditLog,
  documentVersions,
} from "@db/schema";
import { adminQuery, auditLog, authedQuery, createRouter } from "../middleware";
import { getDb, sqlite } from "../queries/connection";
import { resolveDocumentAuthorityBinding } from "../dms/record-authority-bindings";
import { resolveAuthorizedRecordAuthority } from "../dms/record-authority-service";
import {
  deriveRecordAssignmentContext,
  governedRecordContextRequirements,
  governedRecordReadResource,
} from "../dms/record-authority-context";
import {
  establishRecordAuthority,
  listRecordAuthorityCandidates,
  resolvePersistedRecordAuthority,
} from "../dms/record-authority-store";
import {
  GOVERNED_RECORD_CLASSES,
  RECORD_AUTHORITY_STATES,
  type RecordAuthorityCandidate,
} from "../../contracts/dms/record-authority";

function failClosed(
  code: "CONFLICT" | "PRECONDITION_FAILED" | "FORBIDDEN",
  message: string,
): never {
  throw new TRPCError({ code, message });
}

function safeDocumentMetadata<T extends { filePath?: unknown; permissionsJson?: unknown }>(
  document: T,
): Omit<T, "filePath" | "permissionsJson"> & {
  filePath: null;
  permissionsJson: null;
} {
  return {
    ...document,
    filePath: null,
    permissionsJson: null,
  };
}

function authorizedControllingRecordForDocument(
  documentId: string,
  user: Parameters<typeof deriveRecordAssignmentContext>[1],
  assignment: ReturnType<typeof deriveRecordAssignmentContext>,
): RecordAuthorityCandidate | null {
  const binding = resolveDocumentAuthorityBinding(sqlite, documentId);
  if (binding.outcome !== "BOUND") return null;

  const authorized = resolveAuthorizedRecordAuthority(sqlite, {
    recordKey: binding.recordKey,
    user,
    resource: governedRecordReadResource,
    assignment,
    contextRequirements: (record) =>
      governedRecordContextRequirements(record, user),
  });

  if (authorized.outcome !== "AUTHORIZED") return null;
  return authorized.record.documentId === documentId ? authorized.record : null;
}

const listInput = z
  .object({
    categoryId: z.string().optional(),
    status: z
      .enum(["draft", "in-review", "approved", "published", "archived", "superseded"])
      .optional(),
    department: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  })
  .optional();

const nullableId = z.string().trim().min(1).max(500).nullable().optional();

/**
 * S1 controlled overrides for AMOS-DMS record discovery and retrieval plus a
 * bounded authority-intake administration surface.
 *
 * No SharePoint binary is retrieved here. Governed responses expose DMS
 * metadata only after authority and contextual access pass, with backend path
 * and permission internals withheld pending S2.
 */
export const m2AuthorityRouter = createRouter({
  /**
   * Ordinary discovery is fail-closed: only the single controlling DMS copy
   * that the authenticated user is contextually authorized to read is listed.
   * Unregistered, conflicted, stale, pending, reference, submission,
   * superseded and archived authority copies do not appear here.
   */
  list: authedQuery.input(listInput).query(async ({ ctx, input }) => {
    const db = getDb();
    const assignment = deriveRecordAssignmentContext(sqlite, ctx.user);
    const search = input?.search?.trim().toLowerCase();
    const allDocuments = await db
      .select()
      .from(dmsDocuments)
      .orderBy(desc(dmsDocuments.createdAt))
      .all();

    const filteredByMetadata = allDocuments.filter((document) => {
      if (input?.categoryId && document.categoryId !== input.categoryId) return false;
      if (input?.status && document.status !== input.status) return false;
      if (input?.department && document.department !== input.department) return false;
      if (!search) return true;
      return [document.title, document.documentId, document.description ?? ""]
        .some((value) => value.toLowerCase().includes(search));
    });

    const authorizedDocuments = [];
    for (const document of filteredByMetadata) {
      const authority = authorizedControllingRecordForDocument(
        document.documentId,
        ctx.user,
        assignment,
      );
      if (!authority) continue;
      authorizedDocuments.push({
        ...safeDocumentMetadata(document),
        authority: {
          recordKey: authority.recordKey,
          recordClass: authority.recordClass,
          authorityState: authority.authorityState,
          controlling: true as const,
        },
      });
    }

    const total = authorizedDocuments.length;
    const pageSize = input?.pageSize ?? 20;
    const page = input?.page ?? 1;
    const documents = authorizedDocuments.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    auditLog({
      action: "m2:list:governed",
      actor: ctx.user.email,
      resource: "document-authority:list",
      details: `Authorized ${total} controlling documents from ${filteredByMetadata.length} metadata matches`,
    });

    return { documents, total, page, pageSize };
  }),

  getById: authedQuery
    .input(z.object({ id: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const actor = ctx.user.email;
      const actorName = ctx.user.name || actor;

      // Internal lookup only. No document fields leave this boundary yet.
      const requested = await db
        .select()
        .from(dmsDocuments)
        .where(eq(dmsDocuments.id, input.id))
        .get();
      if (!requested) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }

      const binding = resolveDocumentAuthorityBinding(sqlite, requested.documentId);
      if (binding.outcome === "UNREGISTERED") {
        auditLog({
          action: "m2:getById:authority-unregistered",
          actor,
          resource: `document:${requested.documentId}`,
          details: binding.code,
        });
        return failClosed(
          "PRECONDITION_FAILED",
          "Document is not registered in the governed record-authority registry.",
        );
      }
      if (binding.outcome === "CONFLICT") {
        auditLog({
          action: "m2:getById:authority-binding-conflict",
          actor,
          resource: `document:${requested.documentId}`,
          details: binding.code,
        });
        return failClosed(
          "CONFLICT",
          "Document is bound to conflicting governed record lineages.",
        );
      }

      const assignment = deriveRecordAssignmentContext(sqlite, ctx.user);
      const authorized = resolveAuthorizedRecordAuthority(sqlite, {
        recordKey: binding.recordKey,
        user: ctx.user,
        resource: governedRecordReadResource,
        assignment,
        contextRequirements: (record) =>
          governedRecordContextRequirements(record, ctx.user),
      });

      if (authorized.outcome === "AUTHORITY_CONFLICT") {
        return failClosed(
          "CONFLICT",
          "More than one current/controlling authority record exists for this governed record.",
        );
      }
      if (authorized.outcome === "NO_CONTROLLING_RECORD") {
        return failClosed(
          "PRECONDITION_FAILED",
          "No current/controlling authority record is available for this governed record.",
        );
      }
      if (authorized.outcome === "DENIED") {
        return failClosed("FORBIDDEN", authorized.reason);
      }

      // A stale/reference copy must never be returned merely because its id was requested.
      if (authorized.record.documentId !== requested.documentId) {
        auditLog({
          action: "m2:getById:noncontrolling-copy",
          actor,
          resource: `document:${requested.documentId}`,
          details:
            "Requested DMS document is not the controlling document for its record lineage.",
        });
        return failClosed(
          "PRECONDITION_FAILED",
          "Requested document is not the controlling authority record.",
        );
      }

      const versions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, requested.documentId))
        .orderBy(desc(documentVersions.versionNumber))
        .all();
      const audit = await db
        .select()
        .from(documentAuditLog)
        .where(eq(documentAuditLog.documentId, requested.documentId))
        .orderBy(desc(documentAuditLog.createdAt))
        .all();

      await db.insert(documentAuditLog).values({
        id: randomUUID(),
        documentId: requested.documentId,
        action: "viewed",
        actorId: ctx.user.id,
        actorName,
        details: "Document retrieved through S1 governed authority boundary",
        createdAt: new Date().toISOString(),
      });

      auditLog({
        action: "m2:getById:governed-authorized",
        actor,
        resource: `document:${requested.documentId}`,
        details: `${authorized.record.recordClass} | ${authorized.record.authorityState}`,
      });

      return {
        ...safeDocumentMetadata(requested),
        versions: versions.map((version) => ({ ...version, filePath: null })),
        audit,
        authority: {
          recordKey: authorized.record.recordKey,
          recordClass: authorized.record.recordClass,
          authorityState: authorized.record.authorityState,
          governingVersion: authorized.record.governingVersion,
          controlling: true,
        },
      };
    }),

  /**
   * Separate administrative intake view. This is the only S1 discovery path
   * that surfaces unregistered or conflicted document identities so authority
   * can be established without exposing backend paths or permission payloads.
   */
  listAuthorityIntake: adminQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(25),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const search = input?.search?.trim().toLowerCase();
      const allDocuments = await db
        .select()
        .from(dmsDocuments)
        .orderBy(desc(dmsDocuments.createdAt))
        .all();
      const metadataMatches = allDocuments.filter((document) =>
        !search ||
        [document.title, document.documentId, document.description ?? ""]
          .some((value) => value.toLowerCase().includes(search)),
      );

      const intake = metadataMatches.map((document) => {
        const binding = resolveDocumentAuthorityBinding(sqlite, document.documentId);
        if (binding.outcome === "UNREGISTERED") {
          return {
            ...safeDocumentMetadata(document),
            authorityIntake: {
              binding: "UNREGISTERED" as const,
              resolution: "NOT_EVALUATED" as const,
              recordKey: null,
              controllingDocumentId: null,
              candidateIds: [] as string[],
            },
          };
        }
        if (binding.outcome === "CONFLICT") {
          return {
            ...safeDocumentMetadata(document),
            authorityIntake: {
              binding: "BINDING_CONFLICT" as const,
              resolution: "CONFLICT" as const,
              recordKey: null,
              controllingDocumentId: null,
              candidateIds: [] as string[],
              recordKeys: binding.recordKeys,
            },
          };
        }

        const resolution = resolvePersistedRecordAuthority(sqlite, {
          recordKey: binding.recordKey,
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
        });
        return {
          ...safeDocumentMetadata(document),
          authorityIntake: {
            binding: "BOUND" as const,
            resolution: resolution.outcome,
            recordKey: binding.recordKey,
            controllingDocumentId: resolution.record?.documentId ?? null,
            candidateIds: resolution.candidateIds,
          },
        };
      });

      const total = intake.length;
      const pageSize = input?.pageSize ?? 25;
      const page = input?.page ?? 1;
      return {
        documents: intake.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
      };
    }),

  /**
   * Establish an immutable authority row for an existing DMS document.
   * Source identity is server-derived (`amos-dms` / `dms://...`); S1 does not
   * accept or claim a SharePoint locator. Replacing a current controller must
   * explicitly supersede the existing controlling authority row.
   */
  registerAuthority: adminQuery
    .input(
      z.object({
        documentId: z.string().trim().min(1).max(500),
        recordKey: z.string().trim().min(3).max(500),
        recordClass: z.enum(GOVERNED_RECORD_CLASSES),
        authorityState: z.enum(RECORD_AUTHORITY_STATES),
        governingDocumentId: nullableId,
        governingVersion: nullableId,
        supersedesAuthorityId: nullableId,
        youthId: nullableId,
        caseId: nullableId,
        operationId: nullableId,
        division: z.enum(["gro", "bhc", "eo", "gad"]).nullable().optional(),
        rationale: z.string().trim().min(10).max(2_000),
        effectiveAt: z.string().datetime({ offset: true }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const document = await db
        .select()
        .from(dmsDocuments)
        .where(eq(dmsDocuments.documentId, input.documentId))
        .get();
      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "AMOS-DMS document identity was not found.",
        });
      }

      const binding = resolveDocumentAuthorityBinding(sqlite, input.documentId);
      if (binding.outcome === "CONFLICT") {
        return failClosed(
          "CONFLICT",
          "Document already has conflicting record-lineage bindings that must be reconciled first.",
        );
      }
      if (binding.outcome === "BOUND" && binding.recordKey !== input.recordKey) {
        return failClosed(
          "CONFLICT",
          "Document is already bound to a different governed record lineage.",
        );
      }

      const candidates = listRecordAuthorityCandidates(sqlite, input.recordKey);
      if (input.supersedesAuthorityId) {
        const superseded = candidates.find(
          (candidate) => candidate.id === input.supersedesAuthorityId,
        );
        if (!superseded) {
          return failClosed(
            "PRECONDITION_FAILED",
            "supersedesAuthorityId must reference an authority row in the same record lineage.",
          );
        }
        if (
          candidates.some(
            (candidate) =>
              candidate.supersedesAuthorityId === input.supersedesAuthorityId,
          )
        ) {
          return failClosed(
            "PRECONDITION_FAILED",
            "The referenced authority row has already been retired by a later immutable authority row.",
          );
        }
      }

      if (input.authorityState === "SUPERSEDED" && !input.supersedesAuthorityId) {
        return failClosed(
          "PRECONDITION_FAILED",
          "SUPERSEDED authority requires the immutable authority row being superseded.",
        );
      }

      const currentResolution = resolvePersistedRecordAuthority(sqlite, {
        recordKey: input.recordKey,
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
      });
      if (input.authorityState === "CURRENT_CONTROLLING") {
        if (currentResolution.outcome === "CONFLICT") {
          return failClosed(
            "CONFLICT",
            "Existing authority conflict must be retired before a new controlling record can be established.",
          );
        }
        if (
          currentResolution.outcome === "RESOLVED" &&
          input.supersedesAuthorityId !== currentResolution.record.id
        ) {
          return failClosed(
            "CONFLICT",
            "Replacing the current controller requires explicit supersession of the existing controlling authority row.",
          );
        }
      }

      const authority = establishRecordAuthority(sqlite, {
        documentId: input.documentId,
        recordKey: input.recordKey,
        recordClass: input.recordClass,
        authorityState: input.authorityState,
        sourceSystem: "amos-dms",
        sourceLocator: `dms://${encodeURIComponent(input.documentId)}`,
        backendObjectId: null,
        governingDocumentId: input.governingDocumentId ?? null,
        governingVersion: input.governingVersion ?? null,
        supersedesAuthorityId: input.supersedesAuthorityId ?? null,
        youthId: input.youthId ?? null,
        caseId: input.caseId ?? null,
        operationId: input.operationId ?? null,
        division: input.division ?? null,
        dataScope: ctx.user.dataScope,
        rationale: input.rationale,
        establishedBy: ctx.user.id,
        effectiveAt: input.effectiveAt,
      });

      auditLog({
        action: "m2:registerAuthority",
        actor: ctx.user.email,
        resource: `document:${input.documentId}`,
        details: `${input.recordClass} | ${input.authorityState} | ${input.recordKey}`,
      });

      return {
        success: true,
        authority: {
          id: authority.id,
          documentId: authority.documentId,
          recordKey: authority.recordKey,
          recordClass: authority.recordClass,
          authorityState: authority.authorityState,
          supersedesAuthorityId: authority.supersedesAuthorityId,
          dataScope: authority.dataScope,
          establishedAt: authority.establishedAt,
          effectiveAt: authority.effectiveAt,
        },
      };
    }),
});
