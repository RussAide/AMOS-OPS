import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ASK_AMOS_MEDICAL_RECORD_PREVIEW_SCENARIOS,
} from "../../contracts/dms/ask-amos-medical-record";
import { authedQuery, createRouter } from "../middleware";
import {
  runAskAmosMedicalRecordPreview,
} from "../dms/ask-amos-medical-record";
import { sharePointBridgeStatus } from "../dms/sharepoint-graph-adapter";

export const m2AskAmosMedicalRouter = createRouter({
  medicalRecordBridgeStatus: authedQuery.query(() => {
    try {
      const live = sharePointBridgeStatus();
      return {
        previewAvailable: true,
        previewEnvironment: "SYNTHETIC_PREVIEW" as const,
        live,
        liveUseAuthorized: false,
        message: live.configured
          ? "Microsoft Graph is configured but has not yet been live-probed through this S3 gate. Synthetic preview remains available."
          : "Synthetic S3 preview is available now. Live Microsoft Graph remains fail-closed until runtime credentials are configured and successfully probed.",
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
        message: `Synthetic S3 preview is available. Live bridge configuration is not accepted: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
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
