import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ASK_AMOS_MEDICAL_RECORD_PREVIEW_SCENARIOS,
} from "../../contracts/dms/ask-amos-medical-record";
import { auditLog, authedQuery, createRouter } from "../middleware";
import { sqlite } from "../queries/connection";
import {
  retrieveAskAmosMedicalRecord,
  runAskAmosMedicalRecordPreview,
} from "../dms/ask-amos-medical-record";
import {
  loadSharePointGraphConfig,
  sharePointBridgeStatus,
  SharePointGraphAdapter,
} from "../dms/sharepoint-graph-adapter";

function liveRetrievalMessage(outcome: string): string {
  switch (outcome) {
    case "DENIED":
      return "Access was denied before any SharePoint record or backend locator was disclosed.";
    case "AUTHORITY_CONFLICT":
      return "More than one current controller exists. Ask AMOS failed closed and returned no record.";
    case "NO_CONTROLLING_RECORD":
      return "No current controlling record is available for this governed record key.";
    case "BACKEND_CONFLICT":
      return "The controlling record has conflicting SharePoint backend bindings. No record was returned.";
    case "NO_BACKEND_BINDING":
      return "The controlling record does not yet have a verified SharePoint backend binding.";
    case "BACKEND_STALE":
      return "The bound SharePoint object no longer matches its verified identity or integrity controls. Content was withheld.";
    default:
      return "The governed record could not be retrieved.";
  }
}

export const m2AskAmosMedicalRouter = createRouter({
  medicalRecordBridgeStatus: authedQuery.query(() => {
    try {
      const live = sharePointBridgeStatus();
      return {
        previewAvailable: true,
        previewEnvironment: "SYNTHETIC_PREVIEW" as const,
        live,
        liveUseAuthorized: live.configured && !live.writesEnabled,
        message: live.configured
          ? "Microsoft Graph is configured read-only. Live Ask AMOS retrieval is available only through governed record authority, role/scope checks, assignment controls, exact SharePoint object re-verification, and audit logging."
          : "Synthetic S3 preview is available. Live Microsoft Graph remains fail-closed until runtime credentials are configured.",
      };
    } catch (error) {
      return {
        previewAvailable: true,
        previewEnvironment: "SYNTHETIC_PREVIEW" as const,
        live: {
          configured: false,
          connected: false as const,
          verification: "NOT_CONFIGURED" as const,
          tenantHost: null,
          siteId: null,
          allowedDriveCount: 0,
          writesEnabled: false,
        },
        liveUseAuthorized: false,
        message: `Live SharePoint retrieval is not accepted: ${
          error instanceof Error ? error.message : String(error)
        }. Synthetic S3 preview remains available.`,
      };
    }
  }),

  askAmosMedicalRecordLive: authedQuery
    .input(
      z.object({
        recordKey: z.string().trim().min(1).max(500),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.dataScope === "training") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Live SharePoint retrieval is unavailable in Training.",
        });
      }

      let config;
      try {
        config = loadSharePointGraphConfig();
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "SHAREPOINT_GRAPH_CONFIGURATION_ERROR",
        });
      }
      if (!config.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SHAREPOINT_GRAPH_NOT_CONFIGURED",
        });
      }
      if (config.writesEnabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SHAREPOINT_GRAPH_WRITES_NOT_AUTHORIZED",
        });
      }

      try {
        const result = await retrieveAskAmosMedicalRecord(sqlite, {
          recordKey: input.recordKey,
          user: ctx.user,
          reader: new SharePointGraphAdapter(config),
        });

        if (result.outcome !== "AUTHORIZED_BINARY") {
          auditLog({
            action: "m2:ask-amos:live-record-blocked",
            actor: ctx.user.email,
            resource: `record:${input.recordKey}`,
            details: result.code,
          });
          return {
            environment: "LIVE_SHAREPOINT" as const,
            outcome: result.outcome,
            code: result.code,
            recordKey: input.recordKey,
            record: null,
            message: liveRetrievalMessage(result.outcome),
          };
        }

        auditLog({
          action: "m2:ask-amos:live-record-retrieved",
          actor: ctx.user.email,
          resource: `record:${input.recordKey}`,
          details: `${result.documentId} | ${result.content.byteLength} bytes | read-only`,
        });

        return {
          environment: "LIVE_SHAREPOINT" as const,
          outcome: "AUTHORIZED" as const,
          code: result.code,
          recordKey: result.recordKey,
          record: {
            documentId: result.documentId,
            name: result.metadata.name,
            webUrl: result.metadata.webUrl,
            sizeBytes: result.content.byteLength,
            lastModifiedAt: result.metadata.lastModifiedAt,
            integrityVerified: true as const,
            accessMode: "READ_ONLY" as const,
          },
          message:
            "Ask AMOS resolved the current controlling record, verified the authorized user context, re-verified the exact SharePoint object, downloaded and integrity-checked the content, and recorded the read-only retrieval audit event.",
        };
      } catch (error) {
        auditLog({
          action: "m2:ask-amos:live-record-error",
          actor: ctx.user.email,
          resource: `record:${input.recordKey}`,
          details: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "LIVE_SHAREPOINT_RETRIEVAL_FAILED",
        });
      }
    }),

  askAmosMedicalRecordPreview: authedQuery
    .input(
      z.object({
        scenario: z.enum(ASK_AMOS_MEDICAL_RECORD_PREVIEW_SCENARIOS),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await runAskAmosMedicalRecordPreview(input.scenario);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `S3 synthetic medical-record preview failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }),
});
