import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  M41C_CLINICAL_GUIDANCE_INTENTS,
  M41C_CONSENT_STATES,
} from "@contracts/m41c";
import { isUserRole, type UserRole } from "@/constants/roles";
import { createRouter, roleQuery } from "../middleware";
import { M41C_AUTHORIZED_ROLES } from "../services/m41c/clinical-access";
import {
  createM41cExperienceSnapshot,
  runM41cSyntheticScenario,
} from "../services/m41c/experience-service";
import {
  askM41cClinicalGuidance,
  buildM41cClinicalWorkplan,
} from "../services/m41c/m41b-adapter";

const syntheticIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(240)
  .regex(/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i, "Synthetic evaluation ID required.");
const sourceIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(240)
  .regex(/^[A-Z0-9][A-Z0-9._:-]*$/i, "Governed source ID required.");
const fieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Z0-9][A-Z0-9._:-]*$/i, "Controlled field name required.");

function uniqueArray<T extends z.ZodTypeAny>(schema: T, maximum: number) {
  return z
    .array(schema)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: "Duplicate controlled values are not permitted.",
    });
}

export const m41cClinicalGuidanceInputSchema = z
  .object({
    requestId: syntheticIdSchema,
    subjectId: syntheticIdSchema,
    prompt: z.string().trim().min(4).max(2_000),
    intent: z.enum(M41C_CLINICAL_GUIDANCE_INTENTS),
    sourceIds: uniqueArray(sourceIdSchema, 20).optional(),
    workplanItemId: syntheticIdSchema.optional(),
    requestedFields: uniqueArray(fieldNameSchema, 32).optional(),
    minimumNecessaryFields: uniqueArray(fieldNameSchema, 32).optional(),
    part2: z.boolean().optional(),
    consentState: z.enum(M41C_CONSENT_STATES).optional(),
  })
  .strict();

export const m41cSyntheticScenarioInputSchema = z
  .object({
    scenarioId: syntheticIdSchema.regex(
      /^SYNTH-M41C-SCENARIO-[A-Z0-9][A-Z0-9-]*$/i,
      "Registered M4.1C synthetic scenario ID required.",
    ),
  })
  .strict();

export interface M41cServerIdentity {
  actorId: string;
  role: UserRole;
}

/** Identity is derived only from authenticated server context, never request input. */
export function deriveM41cServerIdentity(user: {
  id: string;
  role: string;
}): M41cServerIdentity {
  if (!user.id.trim()) throw new Error("M41C_SERVER_ACTOR_ID_REQUIRED");
  if (!isUserRole(user.role) || !M41C_AUTHORIZED_ROLES.includes(user.role))
    throw new Error("M41C_SERVER_ROLE_NOT_AUTHORIZED");
  return Object.freeze({ actorId: user.id, role: user.role });
}

function mapM41cError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("ACCESS_DENIED") ||
    message.includes("ROLE_ACCESS_DENIED") ||
    message.includes("PART2_ACCESS_DENIED") ||
    message.includes("CONSENT_DENIED") ||
    message.includes("MINIMUM_NECESSARY_DENIED") ||
    message.includes("SERVER_ROLE_NOT_AUTHORIZED")
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
  if (message.includes("NOT_FOUND"))
    throw new TRPCError({ code: "NOT_FOUND", message });
  if (
    message.includes("Synthetic milestone scenarios require") ||
    message.startsWith("PHASE3_")
  ) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  if (
    message.startsWith("M41C_") ||
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

function executeM41c<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    return mapM41cError(error);
  }
}

export const m41cRouter = createRouter({
  getExperienceSnapshot: roleQuery([...M41C_AUTHORIZED_ROLES]).query(
    ({ ctx }) => {
      deriveM41cServerIdentity(ctx.user);
      return executeM41c(createM41cExperienceSnapshot);
    },
  ),

  getMyClinicalWorkplan: roleQuery([...M41C_AUTHORIZED_ROLES]).query(
    ({ ctx }) => {
      const identity = deriveM41cServerIdentity(ctx.user);
      return executeM41c(() => buildM41cClinicalWorkplan(identity.role));
    },
  ),

  askClinicalGuidance: roleQuery([...M41C_AUTHORIZED_ROLES])
    .input(m41cClinicalGuidanceInputSchema)
    .mutation(({ ctx, input }) => {
      const identity = deriveM41cServerIdentity(ctx.user);
      return executeM41c(() =>
        askM41cClinicalGuidance({
          ...input,
          role: identity.role,
          actorId: identity.actorId,
        }),
      );
    }),

  runSyntheticScenario: roleQuery([...M41C_AUTHORIZED_ROLES])
    .input(m41cSyntheticScenarioInputSchema)
    .mutation(({ ctx, input }) => {
      deriveM41cServerIdentity(ctx.user);
      return executeM41c(() => runM41cSyntheticScenario(input));
    }),
});
