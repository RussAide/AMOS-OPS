import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  M22DomainError,
  type M22Actor,
  type M22PlanComponents,
} from "@contracts/mhtcm";
import {
  createM22SeededEngine,
  runM22RepresentativeScenario,
} from "../services/mhtcm";
import { createRouter, publicQuery } from "../middleware";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";
import { buildOperationalProgramSummary } from "../services/operational-program-summary";

type M22Engine = ReturnType<typeof createM22SeededEngine>;
let engine: M22Engine | undefined;

function getM22Engine(): M22Engine {
  return (engine ??= createM22SeededEngine());
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime({ offset: true });
const mhtcmFunction = z.enum([
  "intake_screening",
  "eligibility",
  "care_coordination",
  "referral_management",
  "discharge_planning",
  "aftercare_follow_up",
]);

const eligibility = z.object({
  medicaidEligible: z.boolean(),
  texasResident: z.boolean(),
  diagnosisCategory: z.enum([
    "mental_illness",
    "serious_emotional_disturbance",
    "serious_mental_illness",
    "idd_only",
    "substance_use_disorder_only",
  ]),
  diagnosisEstablishedOn: isoDate.nullable(),
  diagnosisLastReviewedOn: isoDate.nullable(),
  diagnosticCriteriaDocumented: z.boolean(),
  functionalEligibilityConfirmed: z.boolean(),
  uniformAssessment: z.enum(["CANS", "ANSA"]).nullable(),
  uniformAssessmentOn: isoDate.nullable(),
  assessorCertificationExpiresOn: isoDate.nullable(),
  medicalNecessityConfirmedByLpha: z.boolean(),
});

const planComponents = z.object({
  goals: z
    .array(
      z.object({
        id: z.string().min(1),
        sourceCansItemCode: z.string().min(1),
        function: mhtcmFunction,
        statement: z.string().min(1),
        measurableOutcome: z.string().min(1),
        status: z.enum(["active", "achieved", "discontinued"]),
      }),
    )
    .min(1),
  providers: z
    .array(
      z.object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        organization: z.string().min(1),
        credential: z.enum([
          "LPHA",
          "QMHP_CS",
          "CSSP",
          "PEER_PROVIDER",
          "FAMILY_PARTNER",
        ]),
        credentialCurrent: z.boolean(),
        requiredTrainingCurrent: z.boolean(),
        competencyDocumented: z.boolean(),
        employeeOfBillingProvider: z.boolean(),
        supervisionActive: z.boolean(),
        supervisorCredential: z.enum(["LPHA", "QMHP_CS"]).nullable(),
        supervisingQmhpHasLphaSupervision: z.boolean(),
      }),
    )
    .min(1),
  referrals: z
    .array(
      z.object({
        id: z.string().min(1),
        providerId: z.string().min(1),
        service: z.string().min(1),
        status: z.enum(["planned", "scheduled", "connected", "closed"]),
        dueOn: isoDate,
      }),
    )
    .min(1),
  contacts: z
    .array(
      z.object({
        id: z.string().min(1),
        contactType: z.enum([
          "youth",
          "guardian",
          "provider",
          "school",
          "other",
        ]),
        displayLabel: z.string().min(1),
        purpose: z.string().min(1),
        nextContactOn: isoDate,
      }),
    )
    .min(1),
  barriers: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string().min(1),
        severity: z.enum(["low", "moderate", "high"]),
        mitigation: z.string().min(1),
        status: z.enum(["open", "monitoring", "resolved"]),
      }),
    )
    .min(1),
  outcomes: z
    .array(
      z.object({
        id: z.string().min(1),
        measure: z.string().min(1),
        baseline: z.string().min(1),
        target: z.string().min(1),
        current: z.string().min(1),
        measuredOn: isoDate,
      }),
    )
    .min(1),
});

const encounterDocumentation = z.object({
  personName: z.string().nullable(),
  diagnosisAndNeed: z.string().nullable(),
  reasonForEncounter: z.string().nullable(),
  contactParticipants: z.string().nullable(),
  collateralContacts: z.string().nullable(),
  planGoal: z.string().nullable(),
  progress: z.string().nullable(),
  serviceAccessTimeline: z.string().nullable(),
  intervention: z.string().nullable(),
  reevaluationTimeline: z.string().nullable(),
  agencyName: z.string().nullable(),
});

function actorFromContext(user: {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
}): M22Actor {
  return {
    id: user.id,
    role: user.role,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
  };
}

function execute<T>(operation: () => T): T {
  try {
    assertSyntheticScenarioRuntime(env);
  } catch (error) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "MHTCM prototype operations are unavailable because no durable Production provider is configured.",
      cause: error,
    });
  }
  try {
    return operation();
  } catch (error) {
    if (!(error instanceof M22DomainError)) throw error;
    const code =
      error.code === "PERMISSION_DENIED"
        ? "FORBIDDEN"
        : error.code.endsWith("NOT_FOUND")
          ? "NOT_FOUND"
          : error.code.includes("CONFLICT")
            ? "CONFLICT"
            : "PRECONDITION_FAILED";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
}

export const m22Router = createRouter({
  operationalSummary: publicQuery
    .input(z.object({ asOf: isoTimestamp }))
    .query(({ ctx, input }) => {
      if (ctx.user.dataScope !== "operational") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "MHTCM operational records are available only in the Operational workspace.",
        });
      }
      return buildOperationalProgramSummary("MHTCM", input.asOf);
    }),

  representativeScenario: publicQuery.query(() =>
    execute(() => runM22RepresentativeScenario()),
  ),

  getCaseSnapshot: publicQuery
    .input(z.object({ caseId: z.string().min(1), accessedAt: isoTimestamp }))
    .query(({ ctx, input }) =>
      execute(() =>
        getM22Engine().getSnapshot(
          actorFromContext(ctx.user),
          input.caseId,
          input.accessedAt,
        ),
      ),
    ),

  getBillingProjection: publicQuery
    .input(z.object({ caseId: z.string().min(1), accessedAt: isoTimestamp }))
    .query(({ ctx, input }) =>
      execute(() =>
        getM22Engine().getBillingProjection(
          actorFromContext(ctx.user),
          input.caseId,
          input.accessedAt,
        ),
      ),
    ),

  openCase: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        referralId: z.string().min(1),
        youthId: z.string().min(1),
        youthDisplayLabel: z.string().min(1),
        ageYears: z.number().int().min(3).max(21),
        assignedCaseManagerId: z.string().min(1),
        sourceCansAssessmentId: z.string().min(1),
        sourceCansVersion: z.number().int().positive(),
        sourceLineageId: z.string().min(1),
        targetPlanId: z.string().min(1),
        targetPlanVersion: z.number().int().positive(),
        eligibility,
        openedAt: isoTimestamp,
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() => getM22Engine().openCase(actorFromContext(ctx.user), input)),
    ),

  createPlanVersion: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        planId: z.string().min(1),
        expectedCurrentVersion: z.number().int().positive().nullable(),
        activeFrom: isoDate,
        activeThrough: isoDate,
        serviceIncluded: z.boolean(),
        typeAmountDurationDocumented: z.boolean(),
        telehealthApproved: z.boolean(),
        components: planComponents,
        preparedAt: isoTimestamp,
        reason: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().createPlanVersion(actorFromContext(ctx.user), {
          ...input,
          components: input.components as M22PlanComponents,
        }),
      ),
    ),

  approvePlan: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        reviewedAt: isoTimestamp,
        rationale: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().approveCurrentPlan(
          actorFromContext(ctx.user),
          input.caseId,
          input.expectedVersion,
          input.reviewedAt,
          input.rationale,
        ),
      ),
    ),

  completeLifecycleFunction: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        function: mhtcmFunction,
        completedAt: isoTimestamp,
        note: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().completeLifecycleFunction(
          actorFromContext(ctx.user),
          input.caseId,
          input.function,
          input.completedAt,
          input.note,
        ),
      ),
    ),

  planDischarge: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        applies: z.boolean(),
        projectedDischargeOn: isoDate,
        completedOn: isoDate,
        disposition: z.string().min(1),
        aftercareNeeds: z.array(z.string().min(1)),
        reason: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().planDischarge(actorFromContext(ctx.user), input),
      ),
    ),

  recordDischarge: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        dischargedOn: isoDate,
        disposition: z.string().min(1),
        recordedAt: isoTimestamp,
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().recordDischarge(
          actorFromContext(ctx.user),
          input.caseId,
          input.dischargedOn,
          input.disposition,
          input.recordedAt,
        ),
      ),
    ),

  scheduleAftercare: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        scheduledFor: isoDate,
        scheduledAt: isoTimestamp,
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().scheduleAftercare(
          actorFromContext(ctx.user),
          input.caseId,
          input.scheduledFor,
          input.scheduledAt,
        ),
      ),
    ),

  completeAftercare: publicQuery
    .input(
      z.object({
        caseId: z.string().min(1),
        completedAt: isoTimestamp,
        method: z.enum(["phone", "video", "in_person"]),
        outcome: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().completeAftercare(
          actorFromContext(ctx.user),
          input.caseId,
          input.completedAt,
          input.method,
          input.outcome,
        ),
      ),
    ),

  recordAuthorization: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        caseId: z.string().min(1),
        payerLabel: z.string().min(1),
        status: z.enum([
          "authorized",
          "mco_waived",
          "pending",
          "denied",
          "expired",
        ]),
        payerModel: z.enum(["managed_care", "fee_for_service"]),
        waiverDocumentationReference: z.string().nullable(),
        authorizationReference: z.string().nullable(),
        effectiveFrom: isoDate,
        validThrough: isoDate,
        approvedUnits: z.number().int().nonnegative(),
        createdAt: isoTimestamp,
        reason: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().recordAuthorization(actorFromContext(ctx.user), input),
      ),
    ),

  generateAuthorizationAlerts: publicQuery
    .input(z.object({ asOf: isoDate }))
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().generateAuthorizationAlerts(
          actorFromContext(ctx.user),
          input.asOf,
        ),
      ),
    ),

  createEncounter: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        caseId: z.string().min(1),
        providerId: z.string().min(1),
        function: mhtcmFunction,
        level: z.enum(["routine", "intensive"]),
        modifiers: z.array(z.string()),
        serviceDate: isoDate,
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        declaredUnits: z.number().int().positive(),
        deliveryMode: z.enum([
          "in_person",
          "synchronous_audiovisual",
          "synchronous_audio_only",
        ]),
        setting: z.enum(["individual", "group"]),
        continuousContact: z.boolean(),
        personPresentAwakeParticipating: z.boolean(),
        collateralContact: z.boolean(),
        personOrLarPresentForCollateral: z.boolean(),
        emergentTreatment: z.boolean(),
        duplicatesAnotherServiceOrDischargeActivity: z.boolean(),
        documentation: encounterDocumentation,
        authoredAt: isoTimestamp,
        reason: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().createEncounter(actorFromContext(ctx.user), input),
      ),
    ),

  signEncounter: publicQuery
    .input(
      z.object({
        encounterId: z.string().min(1),
        expectedRevision: z.number().int().positive(),
        signedAt: isoTimestamp,
        reason: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().signEncounter(
          actorFromContext(ctx.user),
          input.encounterId,
          input.expectedRevision,
          input.signedAt,
          input.reason,
        ),
      ),
    ),

  reviseEncounter: publicQuery
    .input(
      z.object({
        encounterId: z.string().min(1),
        expectedRevision: z.number().int().positive(),
        kind: z.enum(["late_entry", "amendment"]),
        documentationPatch: encounterDocumentation.partial(),
        authoredAt: isoTimestamp,
        reason: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().reviseEncounter(actorFromContext(ctx.user), input),
      ),
    ),

  evaluateEncounter: publicQuery
    .input(
      z.object({ encounterId: z.string().min(1), evaluatedAt: isoTimestamp }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().evaluateEncounter(
          actorFromContext(ctx.user),
          input.encounterId,
          input.evaluatedAt,
        ),
      ),
    ),

  createClaimHandoff: publicQuery
    .input(
      z.object({ encounterId: z.string().min(1), handedOffAt: isoTimestamp }),
    )
    .mutation(({ ctx, input }) =>
      execute(() =>
        getM22Engine().createClaimHandoff(
          actorFromContext(ctx.user),
          input.encounterId,
          input.handedOffAt,
        ),
      ),
    ),
});
