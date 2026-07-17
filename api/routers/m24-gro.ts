import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { M24Actor } from "../../contracts/gro/m24-model";
import {
  M24DomainError,
  m24GroEngine,
  type M24AdmissionInput,
  type M24IncidentInput,
  type M24MedicationDispositionInput,
  type M24MedicationScheduleInput,
  type M24PlacementTransitionInput,
  type M24ShiftInput,
} from "../lib/m24-gro/engine";
import { runM24AcceptanceSuite } from "../lib/m24-gro/scenarios";
import { authedQuery, createRouter } from "../middleware";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

const id = z.string().trim().min(1).max(240);
const detail = z.string().trim().min(1).max(4_000);
const timestamp = z.string().datetime({ offset: true });
const reason = z.string().trim().min(1).max(2_000);

function actorFromContext(user: {
  id: string;
  role: string;
  name: string;
  email: string;
}): M24Actor {
  return {
    id: user.id,
    role: user.role,
    displayLabel: user.name || user.email,
  };
}

function translateM24Error(error: unknown): never {
  if (error instanceof M24DomainError) {
    const code =
      error.code === "M24_ROLE_FORBIDDEN"
        ? "FORBIDDEN"
        : error.code === "M24_NOT_FOUND"
          ? "NOT_FOUND"
          : error.code === "M24_VERSION_CONFLICT"
            ? "CONFLICT"
            : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
  throw error;
}

function callM24<T>(operation: () => T): T {
  try {
    assertSyntheticScenarioRuntime(env);
  } catch (error) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "GRO prototype operations are unavailable because no durable Production provider is configured.",
      cause: error,
    });
  }
  try {
    return operation();
  } catch (error) {
    return translateM24Error(error);
  }
}

const staffAssignment = z.object({
  staffId: id,
  staffName: detail,
  role: id,
  qualified: z.boolean(),
  workingDirectlyWithGroup: z.boolean(),
  awakeStatus: z.enum(["awake", "sleeping"]),
});

const rightsEvidence = z.object({
  reviewedAt: timestamp,
  writtenCopyProvidedAt: timestamp,
  understandsEnglish: z.boolean(),
  translationOrInterpreterProvided: z.boolean().optional(),
  acknowledgmentSignedAt: timestamp.optional(),
  acknowledgmentConfirmsReadAndUnderstands: z.boolean(),
  acknowledgmentFiledInChildRecord: z.boolean(),
});

const restraintEvidence = z.object({
  restraintKind: id,
  operationPolicyPermits: z.boolean(),
  lessRestrictiveInterventionsAttempted: z.boolean(),
  lessRestrictiveInterventionsIneffective: z.boolean(),
  basis: id,
  purpose: id,
  minimalReasonableForceUsed: z.boolean(),
  privacyProtected: z.boolean(),
  dignityAndWellBeingProtected: z.boolean(),
  monitor: z.object({
    qualifiedInEmergencyBehaviorIntervention: z.boolean(),
    continuouslyMonitoredAppropriatePerformance: z.boolean(),
    continuouslyMonitoredBreathingAndPhysicalDistress: z.boolean(),
    preparedToProtectRespirationCirculationAndWellBeing: z.boolean(),
  }),
  techniques: z.array(id).min(1).max(20),
  position: id,
  proneOrSupineDurationSeconds: z.number().int().nonnegative().optional(),
  proneOrSupineWasLastResort: z.boolean().optional(),
  operationCapacity: z.number().int().positive(),
  independentObserver: z
    .object({
      present: z.boolean(),
      trainedInPositionalCompressionAndRestraintAsphyxiaRisks: z.boolean(),
      trainedInProneAndSupineRisks: z.boolean(),
      notInvolvedInRestraint: z.boolean(),
    })
    .optional(),
  childCondition: id,
  distressPotentiallyLifeThreatening: z.boolean().optional(),
  releasedImmediately: z.boolean().optional(),
  medicalAssistanceSoughtImmediately: z.boolean().optional(),
  healthCareProfessionalEvaluationDocumentedAt: timestamp.optional(),
});

export const m24GroRouter = createRouter({
  dashboard: authedQuery
    .input(z.object({ asOf: timestamp.optional() }).optional())
    .query(({ input }) => callM24(() => m24GroEngine.dashboard(input?.asOf))),

  state: authedQuery.query(() => callM24(() => m24GroEngine.getState())),

  acceptanceEvidence: authedQuery.query(() =>
    callM24(() => runM24AcceptanceSuite()),
  ),

  resetSyntheticPrototype: authedQuery.mutation(({ ctx }) =>
    callM24(() => {
      const actor = actorFromContext(ctx.user);
      if (
        !["super-admin", "administrator", "gro-administrator"].includes(
          actor.role,
        )
      ) {
        throw new M24DomainError(
          "M24_ROLE_FORBIDDEN",
          "Only an authorized administrator may reset M2.4 synthetic state.",
        );
      }
      return m24GroEngine.reset();
    }),
  ),

  admitYouth: authedQuery
    .input(
      z.object({
        caseId: id,
        youthId: id,
        youthLabel: detail,
        ageYears: z.number().int().min(0).max(21),
        requiresTreatmentServices: z.boolean(),
        requiresConstantSupervision: z.boolean().optional(),
        parentConsentRequired: z.boolean().optional(),
        bedId: id,
        admittedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.admitYouth(
          actorFromContext(ctx.user),
          input as M24AdmissionInput,
        ),
      ),
    ),

  transitionPlacement: authedQuery
    .input(
      z.object({
        placementId: id,
        transitionType: z.enum(["transfer", "leave", "return", "discharge"]),
        occurredAt: timestamp,
        reason,
        toBedId: id.optional(),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.transitionPlacement(
          actorFromContext(ctx.user),
          input as M24PlacementTransitionInput,
        ),
      ),
    ),

  acknowledgeCensusAlert: authedQuery
    .input(z.object({ alertId: id, reason }))
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.acknowledgeCensusAlert(
          actorFromContext(ctx.user),
          input.alertId,
          input.reason,
        ),
      ),
    ),

  createShift: authedQuery
    .input(
      z.object({
        stageId: id,
        shiftDate: z.string().date(),
        shiftType: z.enum(["day", "evening", "overnight"]),
        startsAt: timestamp,
        endsAt: timestamp,
        staff: z.array(staffAssignment).min(1).max(100),
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.createShift(
          actorFromContext(ctx.user),
          input as M24ShiftInput,
        ),
      ),
    ),

  recordAttendance: authedQuery
    .input(
      z.object({
        shiftId: id,
        staffId: id,
        status: z.enum(["present", "late", "absent", "no_show"]),
        occurredAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordAttendance(actorFromContext(ctx.user), input),
      ),
    ),

  evaluateStaffing: authedQuery
    .input(
      z.object({
        shiftId: id,
        period: z.enum(["children-awake", "night-sleeping"]).optional(),
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.evaluateStaffing(
          actorFromContext(ctx.user),
          input.shiftId,
          input.period,
          input.reason,
        ),
      ),
    ),

  recordSafetyRound: authedQuery
    .input(
      z.object({
        shiftId: id,
        area: detail,
        passed: z.boolean(),
        findings: detail.optional(),
        completedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordSafetyRound(actorFromContext(ctx.user), input),
      ),
    ),

  recordYouthCareLog: authedQuery
    .input(
      z.object({
        shiftId: id,
        youthId: id,
        category: z.enum([
          "daily_living",
          "behavioral",
          "medical",
          "educational",
          "recreational",
          "emotional_support",
          "crisis_intervention",
        ]),
        narrative: detail,
        followUpRequired: z.boolean().optional(),
        recordedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordYouthCareLog(actorFromContext(ctx.user), input),
      ),
    ),

  createTask: authedQuery
    .input(
      z.object({
        caseId: id,
        title: detail,
        sourceType: id,
        sourceId: id,
        assignedRole: id,
        dueAt: timestamp,
        priority: z.enum(["routine", "urgent", "critical"]).optional(),
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() => m24GroEngine.createTask(actorFromContext(ctx.user), input)),
    ),

  completeTask: authedQuery
    .input(
      z.object({
        taskId: id,
        completedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.completeTask(actorFromContext(ctx.user), input),
      ),
    ),

  createShiftHandoff: authedQuery
    .input(
      z.object({
        caseId: id,
        fromShiftId: id,
        toShiftId: id,
        summary: detail,
        taskIds: z.array(id).optional(),
        medicationRecordIds: z.array(id).optional(),
        initiatedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.createShiftHandoff(actorFromContext(ctx.user), input),
      ),
    ),

  acceptShiftHandoff: authedQuery
    .input(
      z.object({
        handoffId: id,
        acceptedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.acceptShiftHandoff(actorFromContext(ctx.user), input),
      ),
    ),

  completeShiftHandoff: authedQuery
    .input(
      z.object({
        handoffId: id,
        completedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.completeShiftHandoff(actorFromContext(ctx.user), input),
      ),
    ),

  sweepOverdueTasks: authedQuery
    .input(z.object({ asOf: timestamp, reason }))
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.sweepOverdueTasks(
          actorFromContext(ctx.user),
          input.asOf,
          input.reason,
        ),
      ),
    ),

  scheduleMedication: authedQuery
    .input(
      z.object({
        caseId: id,
        youthId: id,
        medicationName: detail,
        dose: detail,
        route: id,
        scheduledAt: timestamp,
        isPrn: z.boolean().optional(),
        isControlled: z.boolean().optional(),
        expectedControlledCount: z.number().int().positive().optional(),
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.scheduleMedication(
          actorFromContext(ctx.user),
          input as M24MedicationScheduleInput,
        ),
      ),
    ),

  recordMedicationDisposition: authedQuery
    .input(
      z.object({
        medicationRecordId: id,
        action: z.enum(["administer", "refuse", "omit", "hold"]),
        occurredAt: timestamp,
        reason: reason.optional(),
        prnReason: detail.optional(),
        countBefore: z.number().int().nonnegative().optional(),
        countAfter: z.number().int().nonnegative().optional(),
        witnessedBy: id.optional(),
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordMedicationDisposition(
          actorFromContext(ctx.user),
          input as M24MedicationDispositionInput,
        ),
      ),
    ),

  recordPrnEffectiveness: authedQuery
    .input(
      z.object({
        medicationRecordId: id,
        effectiveness: z.enum(["effective", "partial", "ineffective"]),
        recordedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordPrnEffectiveness(actorFromContext(ctx.user), input),
      ),
    ),

  resolveMedicationDiscrepancy: authedQuery
    .input(
      z.object({
        discrepancyId: id,
        resolution: detail,
        resolvedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.resolveMedicationDiscrepancy(
          actorFromContext(ctx.user),
          input,
        ),
      ),
    ),

  createMedicationHandoff: authedQuery
    .input(
      z.object({
        caseId: id,
        fromShiftId: id,
        toShiftId: id,
        medicationRecordIds: z.array(id).min(1),
        initiatedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.createMedicationHandoff(actorFromContext(ctx.user), input),
      ),
    ),

  acceptMedicationHandoff: authedQuery
    .input(z.object({ handoffId: id, acceptedAt: timestamp, reason }))
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.acceptMedicationHandoff(actorFromContext(ctx.user), input),
      ),
    ),

  evaluatePractice: authedQuery
    .input(z.object({ caseId: id, practiceCode: id, reason }))
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.evaluatePractice(actorFromContext(ctx.user), input),
      ),
    ),

  captureIncident: authedQuery
    .input(
      z.object({
        caseId: id,
        youthId: id,
        level: z.enum(["L1", "L2", "L3", "L4", "L5"]),
        incidentType: z.enum([
          "behavioral",
          "safety",
          "medication",
          "injury",
          "elopement",
          "self_harm",
          "aggression",
          "restraint",
          "other",
        ]),
        summary: detail,
        occurredAt: timestamp,
        practiceCodes: z.array(id).optional(),
        interventionEndedAt: timestamp.optional(),
        stabilizedAt: timestamp.optional(),
        restraintEvidence: restraintEvidence.optional(),
        medicalEvaluationRequired: z.boolean().optional(),
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.captureIncident(
          actorFromContext(ctx.user),
          input as M24IncidentInput,
        ),
      ),
    ),

  documentIncident: authedQuery
    .input(
      z.object({
        incidentId: id,
        documentedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.documentIncident(actorFromContext(ctx.user), input),
      ),
    ),

  completeIncidentDebrief: authedQuery
    .input(
      z.object({
        incidentId: id,
        debriefAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.completeIncidentDebrief(actorFromContext(ctx.user), input),
      ),
    ),

  recordIncidentMedicalEvaluation: authedQuery
    .input(
      z.object({
        incidentId: id,
        completedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordIncidentMedicalEvaluation(
          actorFromContext(ctx.user),
          input,
        ),
      ),
    ),

  notifyIncidentParent: authedQuery
    .input(
      z.object({
        incidentId: id,
        notifiedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.notifyIncidentParent(actorFromContext(ctx.user), input),
      ),
    ),

  completeCorrectiveAction: authedQuery
    .input(
      z.object({
        correctiveActionId: id,
        completedAt: timestamp,
        evidence: detail,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.completeCorrectiveAction(
          actorFromContext(ctx.user),
          input,
        ),
      ),
    ),

  closeIncident: authedQuery
    .input(
      z.object({
        incidentId: id,
        closedAt: timestamp,
        reason,
        expectedVersion: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.closeIncident(actorFromContext(ctx.user), input),
      ),
    ),

  postRightsVersion: authedQuery
    .input(
      z.object({
        version: id,
        documentUrl: z.string().trim().min(1).max(2_000),
        postedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.postRightsVersion(actorFromContext(ctx.user), input),
      ),
    ),

  recordRightsAcknowledgment: authedQuery
    .input(
      z.object({
        placementId: id,
        child: rightsEvidence,
        parent: rightsEvidence.optional(),
        rightsDocumentUsesSimpleNonTechnicalTerms: z.boolean(),
        acknowledgedAt: timestamp,
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordRightsAcknowledgment(
          actorFromContext(ctx.user),
          input,
        ),
      ),
    ),

  recordEngagement: authedQuery
    .input(
      z.object({
        caseId: id,
        youthId: id,
        eventType: z.enum([
          "family_contact",
          "activity",
          "transport",
          "crisis",
          "discharge_coordination",
        ]),
        occurredAt: timestamp,
        summary: detail,
        details: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .optional(),
        status: z.enum(["open", "completed"]).optional(),
        reason,
      }),
    )
    .mutation(({ ctx, input }) =>
      callM24(() =>
        m24GroEngine.recordEngagement(actorFromContext(ctx.user), input),
      ),
    ),
});
