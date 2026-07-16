import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { isUserRole, type UserRole } from "@/constants/roles";
import type { M42SearchMetadataField } from "@contracts/m42/search";
import { createRouter, roleQuery } from "../middleware";
import {
  M42_AUTHORIZED_ROLES,
  M42_INTEGRATED_SCENARIO_ID,
  M42_REVIEWER_ROLES,
  buildM42ActorContext,
  buildM42SearchActorContext,
  createApprovedM42SearchPerformanceCorpus,
  createFrozenM42NilCorpus,
  createM42ExperienceSnapshot,
  evaluateM42GovernedDocumentAction,
  listM42ConfigurationSchemas,
  listM42GovernedDocuments,
  listM42ReportFields,
  runM42ConfigurationDemo,
  runM42IntegratedScenario,
  runM42ReportBuilderDemo,
  runM42VersionControlDemo,
  searchM42Documents,
  searchM42Nil,
} from "../services/m42";

const metadataFieldSchema = z.enum([
  "documentType",
  "division",
  "lifecycle",
  "ownerRole",
  "tags",
  "sensitivityLabel",
  "syntheticMatterCode",
  "syntheticProgramCode",
] satisfies readonly M42SearchMetadataField[]);

export const m42SearchInputSchema = z
  .object({
    text: z.string().trim().min(2).max(240),
    metadataFilters: z
      .record(metadataFieldSchema, z.array(z.string().trim().min(1).max(80)).max(8))
      .optional(),
    limit: z.number().int().min(1).max(25).default(10),
  })
  .strict();

export const m42NilSearchInputSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export const m42ScenarioInputSchema = z
  .object({
    scenarioId: z.literal(M42_INTEGRATED_SCENARIO_ID),
    searchIterations: z.number().int().min(1).max(5).default(3),
  })
  .strict();

export const m42DocumentActionInputSchema = z
  .object({
    documentId: z
      .string()
      .trim()
      .regex(/^SYNTH-DOCUMENT-[A-Z0-9-]+$/),
    action: z.enum([
      "metadata_read",
      "content_read",
      "download",
      "export",
      "disclose",
      "checkout",
      "approve",
      "legal_hold",
    ]),
  })
  .strict();

export const m42ConfigurationDemoInputSchema = z
  .object({ configKey: z.string().trim().min(3).max(120).optional() })
  .strict();

export interface M42ServerIdentity {
  actorId: string;
  role: UserRole;
}

/** Authenticated identity is derived from server context and never from input. */
export function deriveM42ServerIdentity(user: {
  id: string;
  role: string;
}): M42ServerIdentity {
  if (!user.id.trim()) throw new Error("M42_SERVER_ACTOR_ID_REQUIRED");
  if (!isUserRole(user.role) || !M42_AUTHORIZED_ROLES.includes(user.role))
    throw new Error("M42_SERVER_ROLE_NOT_AUTHORIZED");
  return Object.freeze({ actorId: user.id, role: user.role });
}

export function buildM42ActorFromServerIdentity(
  identity: M42ServerIdentity,
) {
  const token = createHash("sha256")
    .update(identity.actorId)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return buildM42ActorContext(identity.role, `SYNTH-M42-SESSION-${token}`);
}

function mapM42Error(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("ACCESS_DENIED") ||
    message.includes("PERMISSION_REQUIRED") ||
    message.includes("ROLE_NOT_AUTHORIZED") ||
    message.includes("TIER_ACCESS_DENIED")
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
  if (message.includes("NOT_FOUND") || message.includes("UNKNOWN"))
    throw new TRPCError({ code: "NOT_FOUND", message });
  if (
    message.startsWith("M42_") ||
    message.includes("REQUIRED") ||
    message.includes("INVALID") ||
    message.includes("DENIED") ||
    message.includes("BLOCKED") ||
    message.includes("UNAVAILABLE")
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  throw error;
}

function executeM42<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    return mapM42Error(error);
  }
}

export const m42Router = createRouter({
  getExperienceSnapshot: roleQuery([...M42_AUTHORIZED_ROLES]).query(
    ({ ctx }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      const actor = buildM42ActorFromServerIdentity(identity);
      return executeM42(() => createM42ExperienceSnapshot(actor));
    },
  ),

  getAcceptanceStatus: roleQuery([...M42_AUTHORIZED_ROLES]).query(
    ({ ctx }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      const viewer = buildM42ActorFromServerIdentity(identity);
      const result = executeM42(() =>
        runM42IntegratedScenario(
          undefined,
          1,
          buildM42ActorContext("managing-director"),
        ),
      );
      return Object.freeze({
        milestone: result.milestone,
        scenarioId: result.scenarioId,
        accepted: result.accepted,
        acceptanceFlags: result.acceptanceFlags,
        totals: result.totals,
        boundary: result.boundary,
        viewer: Object.freeze({ role: viewer.role, tier: viewer.tier }),
      });
    },
  ),

  runIntegratedScenario: roleQuery([...M42_REVIEWER_ROLES])
    .input(m42ScenarioInputSchema)
    .mutation(({ ctx, input }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      const actor = buildM42ActorFromServerIdentity(identity);
      return executeM42(() =>
        runM42IntegratedScenario(
          input.scenarioId,
          input.searchIterations,
          actor,
        ),
      );
    }),

  searchDocuments: roleQuery([...M42_AUTHORIZED_ROLES])
    .input(m42SearchInputSchema)
    .query(({ ctx, input }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      const actor = buildM42SearchActorContext(
        buildM42ActorFromServerIdentity(identity),
      );
      return executeM42(() =>
        searchM42Documents(
          createApprovedM42SearchPerformanceCorpus(),
          actor,
          input,
        ),
      );
    }),

  searchNil: roleQuery([...M42_AUTHORIZED_ROLES])
    .input(m42NilSearchInputSchema)
    .query(({ ctx, input }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      const actor = buildM42SearchActorContext(
        buildM42ActorFromServerIdentity(identity),
      );
      return executeM42(() =>
        searchM42Nil(
          createFrozenM42NilCorpus(),
          actor,
          input.query,
          input.limit,
        ),
      );
    }),

  listGovernedDocuments: roleQuery([...M42_AUTHORIZED_ROLES]).query(
    ({ ctx }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      return executeM42(() =>
        listM42GovernedDocuments(buildM42ActorFromServerIdentity(identity)),
      );
    },
  ),

  evaluateDocumentAction: roleQuery([...M42_AUTHORIZED_ROLES])
    .input(m42DocumentActionInputSchema)
    .mutation(({ ctx, input }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      return executeM42(() =>
        evaluateM42GovernedDocumentAction(
          buildM42ActorFromServerIdentity(identity),
          input.documentId,
          input.action,
        ),
      );
    }),

  runVersionControlDemo: roleQuery([...M42_REVIEWER_ROLES]).mutation(
    ({ ctx }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      return executeM42(() =>
        runM42VersionControlDemo(buildM42ActorFromServerIdentity(identity)),
      );
    },
  ),

  listReportFields: roleQuery([...M42_REVIEWER_ROLES]).query(({ ctx }) => {
    const identity = deriveM42ServerIdentity(ctx.user);
    return executeM42(() =>
      listM42ReportFields(buildM42ActorFromServerIdentity(identity)),
    );
  }),

  runReportBuilderDemo: roleQuery([...M42_REVIEWER_ROLES]).mutation(
    ({ ctx }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      return executeM42(() =>
        runM42ReportBuilderDemo(buildM42ActorFromServerIdentity(identity)),
      );
    },
  ),

  listConfigurationSchemas: roleQuery([...M42_REVIEWER_ROLES]).query(
    ({ ctx }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      return executeM42(() =>
        listM42ConfigurationSchemas(
          buildM42ActorFromServerIdentity(identity),
        ),
      );
    },
  ),

  runConfigurationDemo: roleQuery([...M42_REVIEWER_ROLES])
    .input(m42ConfigurationDemoInputSchema)
    .mutation(({ ctx, input }) => {
      const identity = deriveM42ServerIdentity(ctx.user);
      return executeM42(() =>
        runM42ConfigurationDemo(
          buildM42ActorFromServerIdentity(identity),
          input.configKey,
        ),
      );
    }),
});
