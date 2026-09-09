import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import {
  dmsDocuments,
  documentAuditLog,
  documentVersions,
} from "@db/schema";
import { auditLog, authedQuery, createRouter } from "../middleware";
import { getDb, sqlite } from "../queries/connection";
import { resolveDocumentAuthorityBinding } from "../dms/record-authority-bindings";
import { resolveAuthorizedRecordAuthority } from "../dms/record-authority-service";
import {
  deriveRecordAssignmentContext,
  governedRecordContextRequirements,
  governedRecordReadResource,
} from "../dms/record-authority-context";

function failClosed(code: "CONFLICT" | "PRECONDITION_FAILED" | "FORBIDDEN", message: string): never {
  throw new TRPCError({ code, message });
}

/**
 * S1 controlled override for the legacy M2 getById procedure.
 *
 * No SharePoint binary is retrieved here. The procedure returns only the
 * already-present DMS metadata after a single controlling authority record and
 * contextual access have both been established. Backend path/permission
 * internals are withheld from the governed response.
 */
export const m2AuthorityRouter = createRouter({
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
          details: "Requested DMS document is not the controlling document for its record lineage.",
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
        ...requested,
        // S2 will resolve backend binaries; S1 does not expose backend paths.
        filePath: null,
        permissionsJson: null,
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
});
