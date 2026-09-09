import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLog, adminQuery, createRouter } from "../middleware";
import { sqlite } from "../queries/connection";
import { resolveDocumentAuthorityBinding } from "../dms/record-authority-bindings";
import { resolvePersistedRecordAuthority } from "../dms/record-authority-store";
import {
  establishSharePointBackendBinding,
  listSharePointBackendBindings,
  resolvePersistedSharePointBackendBinding,
} from "../dms/sharepoint-backend-store";
import {
  loadSharePointGraphConfig,
  sharePointBridgeStatus,
  SharePointGraphAdapter,
} from "../dms/sharepoint-graph-adapter";

function conflict(message: string): never {
  throw new TRPCError({ code: "CONFLICT", message });
}

function precondition(message: string): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

function currentAuthorityForDocument(
  documentId: string,
  actorId: string,
  actorRole: string,
) {
  const documentBinding = resolveDocumentAuthorityBinding(sqlite, documentId);
  if (documentBinding.outcome === "UNREGISTERED")
    return precondition(
      "Document must have a governed DMS authority lineage before SharePoint backend mapping.",
    );
  if (documentBinding.outcome === "CONFLICT")
    return conflict(
      "Document has conflicting DMS authority lineage bindings and cannot be mapped to SharePoint.",
    );

  const authority = resolvePersistedRecordAuthority(sqlite, {
    recordKey: documentBinding.recordKey,
    actorId,
    actorRole,
  });
  if (authority.outcome === "CONFLICT")
    return conflict(
      "Record authority conflict must be resolved before SharePoint backend mapping.",
    );
  if (authority.outcome === "UNAVAILABLE")
    return precondition(
      "No CURRENT_CONTROLLING DMS authority record is available for SharePoint backend mapping.",
    );
  if (authority.record.documentId !== documentId)
    return precondition(
      "Only the CURRENT_CONTROLLING DMS document can receive the active SharePoint backend binding.",
    );
  return authority.record;
}

/**
 * S2 administration surface. It verifies exact Graph object identity and then
 * appends an immutable DMS-to-SharePoint binding. It does not expose binary
 * content or SharePoint navigation to frontline users.
 */
export const m2SharePointRouter = createRouter({
  sharePointBridgeStatus: adminQuery.query(() => {
    try {
      return {
        ...sharePointBridgeStatus(),
        status: "OK" as const,
        errorCode: null,
      };
    } catch (error) {
      return {
        configured: false,
        connected: false as const,
        verification: "MISCONFIGURED" as const,
        tenantHost: null,
        siteId: null,
        allowedDriveCount: 0,
        writesEnabled: false,
        status: "ERROR" as const,
        errorCode:
          error instanceof Error
            ? error.message
            : "SHAREPOINT_GRAPH_CONFIGURATION_ERROR",
      };
    }
  }),

  getSharePointBackendMapping: adminQuery
    .input(z.object({ documentId: z.string().trim().min(1).max(500) }))
    .query(({ ctx, input }) => {
      const authority = currentAuthorityForDocument(
        input.documentId,
        ctx.user.id,
        ctx.user.role,
      );
      const resolution = resolvePersistedSharePointBackendBinding(sqlite, {
        authorityId: authority.id,
        documentId: authority.documentId,
        actorId: ctx.user.id,
      });
      return {
        documentId: authority.documentId,
        recordKey: authority.recordKey,
        authorityId: authority.id,
        authorityState: authority.authorityState,
        backend: resolution.binding
          ? {
              outcome: resolution.outcome,
              code: resolution.code,
              bindingId: resolution.binding.id,
              stableObjectId: resolution.binding.stableObjectId,
              tenantHost: resolution.binding.address.tenantHost,
              siteId: resolution.binding.address.siteId,
              driveId: resolution.binding.address.driveId,
              itemId: resolution.binding.address.itemId,
              name: resolution.binding.name,
              versionId: resolution.binding.versionId,
              eTag: resolution.binding.eTag,
              verifiedAt: resolution.binding.verifiedAt,
              verificationMethod: resolution.binding.verificationMethod,
            }
          : {
              outcome: resolution.outcome,
              code: resolution.code,
              bindingId: null,
              stableObjectId: null,
              tenantHost: null,
              siteId: null,
              driveId: null,
              itemId: null,
              name: null,
              versionId: null,
              eTag: null,
              verifiedAt: null,
              verificationMethod: null,
            },
      };
    }),

  verifyAndBindSharePointBackend: adminQuery
    .input(
      z.object({
        documentId: z.string().trim().min(1).max(500),
        driveId: z.string().trim().min(1).max(500),
        itemId: z.string().trim().min(1).max(500),
        supersedesBindingId: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authority = currentAuthorityForDocument(
        input.documentId,
        ctx.user.id,
        ctx.user.role,
      );
      const existing = listSharePointBackendBindings(sqlite, authority.id);
      if (input.supersedesBindingId) {
        const prior = existing.find(
          (binding) => binding.id === input.supersedesBindingId,
        );
        if (!prior)
          return precondition(
            "supersedesBindingId must reference an existing binding for this exact authority row.",
          );
      }

      const config = loadSharePointGraphConfig();
      if (!config.enabled)
        return precondition(
          "Live SharePoint Graph verification is not configured in this runtime.",
        );
      const adapter = new SharePointGraphAdapter(config);
      let item;
      try {
        item = await adapter.getItemMetadata(input.driveId, input.itemId);
      } catch (error) {
        auditLog({
          action: "m2:sharepoint:verification-failed",
          actor: ctx.user.email,
          resource: `document:${authority.documentId}`,
          details: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "SharePoint object verification failed.",
        });
      }

      const binding = establishSharePointBackendBinding(sqlite, {
        authorityId: authority.id,
        documentId: authority.documentId,
        recordKey: authority.recordKey,
        bindingState: "ACTIVE",
        tenantHost: item.tenantHost,
        siteId: item.siteId,
        driveId: item.driveId,
        itemId: item.itemId,
        name: item.name,
        webUrl: item.webUrl,
        parentItemId: item.parentItemId,
        relativePath: item.relativePath,
        versionId: item.versionId,
        eTag: item.eTag,
        cTag: item.cTag,
        sizeBytes: item.sizeBytes,
        contentHash: item.contentHash,
        verificationMethod: "MICROSOFT_GRAPH",
        verifiedBy: ctx.user.id,
        supersedesBindingId: input.supersedesBindingId ?? null,
      });

      auditLog({
        action: "m2:sharepoint:backend-bound",
        actor: ctx.user.email,
        resource: `document:${authority.documentId}`,
        details: `${binding.stableObjectId} | ${binding.address.driveId}/${binding.address.itemId}`,
      });

      return {
        success: true,
        authority: {
          id: authority.id,
          documentId: authority.documentId,
          recordKey: authority.recordKey,
          authorityState: authority.authorityState,
        },
        backend: {
          bindingId: binding.id,
          stableObjectId: binding.stableObjectId,
          tenantHost: binding.address.tenantHost,
          siteId: binding.address.siteId,
          driveId: binding.address.driveId,
          itemId: binding.address.itemId,
          name: binding.name,
          versionId: binding.versionId,
          eTag: binding.eTag,
          metadataHash: binding.metadataHash,
          verifiedAt: binding.verifiedAt,
          verificationMethod: binding.verificationMethod,
        },
      };
    }),
});
