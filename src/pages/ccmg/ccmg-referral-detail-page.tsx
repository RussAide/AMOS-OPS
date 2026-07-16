import { useState } from "react";
import { useParams } from "react-router-dom";
import type { CcmgCarePathActionRequest } from "@/components/ccmg/ccmg-care-path-actions";
import { normalizeCcmgReferralDetail } from "@/components/ccmg/ccmg-oversight-model";
import { CcmgReferralDetailView } from "@/components/ccmg/ccmg-referral-detail-view";
import {
  CCMG_FIXTURE_FALLBACK_NOTICE,
  isBuiltCcmgFixture,
  mayUseCcmgFixtureForError,
} from "@/components/ccmg/ccmg-query-fallback";
import { getSyntheticCcmgReferralDetail } from "@/components/ccmg/ccmg-synthetic-data";
import type { CcmgWorkflowActionRequest } from "@/components/ccmg/ccmg-workflow-actions";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

export function CcmgReferralDetailPage() {
  const { referralId = "" } = useParams<{ referralId: string }>();
  const { getRoleDef } = useAuth();
  const utils = trpc.useUtils();
  const [actionError, setActionError] = useState<string>();
  const [actionSuccess, setActionSuccess] = useState<string>();
  const [carePathError, setCarePathError] = useState<string>();
  const [carePathSuccess, setCarePathSuccess] = useState<string>();
  const detailQuery = trpc.m21.getReferralDetail.useQuery(
    {
      referralId,
      evidenceClass: runtimeConfig.evaluationMode
        ? "synthetic_demo"
        : "production",
    },
    { enabled: referralId.length > 0 },
  );
  const useFixture =
    detailQuery.isError &&
    mayUseCcmgFixtureForError(detailQuery.error, "m21.getReferralDetail");
  const rawDetail = useFixture
    ? getSyntheticCcmgReferralDetail(referralId)
    : detailQuery.data;
  const model = normalizeCcmgReferralDetail(rawDetail, referralId);
  const queryState = detailQuery.isLoading
    ? "loading"
    : (detailQuery.isError && !useFixture) || referralId.length === 0
      ? "error"
      : "ready";
  const fallbackNotice =
    useFixture || isBuiltCcmgFixture(detailQuery.data)
      ? CCMG_FIXTURE_FALLBACK_NOTICE
      : undefined;
  const transitionMutation = trpc.m21.transitionWorkflow.useMutation();
  const assignMutation = trpc.m21.assignWorkflow.useMutation();
  const approveMutation = trpc.m21.approveWorkflow.useMutation();
  const handoffMutation = trpc.m21.handoffWorkflow.useMutation();
  const escalateMutation = trpc.m21.escalateWorkflow.useMutation();
  const exceptionMutation = trpc.m21.setExceptionDisposition.useMutation();
  const decideHandoffMutation = trpc.m21.decideHandoff.useMutation();
  const gateMutation = trpc.m21.recordReferralGate.useMutation();
  const finalizeCansMutation = trpc.m21.finalizeCansVersion.useMutation();
  const approveTargetMutation = trpc.m21.approveCansTargetRoute.useMutation();
  const medicationAlertMutation =
    trpc.m21.createMedicationOversightAlert.useMutation();
  const workflowSubmitting =
    transitionMutation.isPending ||
    assignMutation.isPending ||
    approveMutation.isPending ||
    handoffMutation.isPending ||
    escalateMutation.isPending ||
    exceptionMutation.isPending ||
    decideHandoffMutation.isPending;
  const carePathSubmitting =
    gateMutation.isPending ||
    finalizeCansMutation.isPending ||
    approveTargetMutation.isPending ||
    medicationAlertMutation.isPending;
  const anyActionSubmitting = workflowSubmitting || carePathSubmitting;
  const workflowIsActionable = [
    "pending",
    "in_progress",
    "blocked",
    "awaiting_approval",
  ].includes(model.workflow.status.toLowerCase());
  const actionsEnabled =
    queryState === "ready" &&
    fallbackNotice === undefined &&
    workflowIsActionable &&
    model.workflow.workItemId !== null &&
    model.workflow.expectedVersion !== null;
  const carePathEnabled =
    queryState === "ready" &&
    fallbackNotice === undefined &&
    model.evidenceMode === "synthetic_demo" &&
    model.referralVersion !== null;

  const refreshCarePathTrace = async () => {
    await detailQuery.refetch();
    await utils.m21.getOversightDashboard.invalidate();
  };

  const submitCarePathAction = async (request: CcmgCarePathActionRequest) => {
    const expectedReferralVersion = model.referralVersion;
    if (expectedReferralVersion === null) {
      setCarePathError(
        "The server did not return an actionable referral version.",
      );
      return;
    }
    setCarePathError(undefined);
    setCarePathSuccess(undefined);
    try {
      if (request.kind === "record_gate") {
        if (request.gate === "intake") {
          await gateMutation.mutateAsync({
            referralId: model.referralId,
            gate: request.gate,
            decision: request.decision,
            reason: request.reason,
            expectedVersion: expectedReferralVersion,
          });
        } else if (request.gate === "eligibility") {
          await gateMutation.mutateAsync({
            referralId: model.referralId,
            gate: request.gate,
            decision: request.decision,
            reason: request.reason,
            expectedVersion: expectedReferralVersion,
          });
        } else if (request.gate === "payer_authorization") {
          await gateMutation.mutateAsync({
            referralId: model.referralId,
            gate: request.gate,
            decision: request.decision,
            reason: request.reason,
            expectedVersion: expectedReferralVersion,
          });
        } else if (request.gate === "consent") {
          await gateMutation.mutateAsync({
            referralId: model.referralId,
            gate: request.gate,
            decision: request.decision,
            reason: request.reason,
            expectedVersion: expectedReferralVersion,
          });
        } else if (request.gate === "cans_schedule") {
          await gateMutation.mutateAsync({
            referralId: model.referralId,
            gate: request.gate,
            decision: request.decision,
            reason: request.reason,
            expectedVersion: expectedReferralVersion,
          });
        } else {
          await gateMutation.mutateAsync({
            referralId: model.referralId,
            gate: request.gate,
            decision: request.decision,
            reason: request.reason,
            expectedVersion: expectedReferralVersion,
          });
        }
        await refreshCarePathTrace();
        setCarePathSuccess(
          "Server-authorized gate decision persisted; readiness and referral disposition were refreshed.",
        );
        return;
      }

      if (request.kind === "finalize_cans") {
        await finalizeCansMutation.mutateAsync({
          referralId: model.referralId,
          instrumentVersion: request.instrumentVersion,
          domainScores: request.domainScores,
          actionableItems: request.actionableItems,
          totalScore: request.totalScore,
          acuity: request.acuity,
          completedAt: request.completedAt,
          reason: request.reason,
          expectedReferralVersion,
        });
        await refreshCarePathTrace();
        setCarePathSuccess(
          "Server-authorized CANS version finalized and lineage refreshed.",
        );
        return;
      }

      if (request.kind === "approve_target_route") {
        await approveTargetMutation.mutateAsync({
          referralId: model.referralId,
          cansAssessmentId: request.cansAssessmentId,
          targetType: request.targetType,
          targetRecordId: request.targetRecordId,
          targetVersion: request.targetVersion,
          reason: request.reason,
          expectedReferralVersion,
        });
        await refreshCarePathTrace();
        setCarePathSuccess(
          `Server-authorized ${request.targetType === "mhtcm_plan" ? "MHTCM" : "MHRS"} target approval, routing, work item, and handoff were refreshed.`,
        );
        return;
      }

      await medicationAlertMutation.mutateAsync({
        referralId: model.referralId,
        title: request.title,
        priority: request.priority,
        dueAt: request.dueAt,
        reason: request.reason,
        expectedReferralVersion,
      });
      await refreshCarePathTrace();
      setCarePathSuccess(
        "Medication-oversight alert persisted. Use the refreshed guided Approval action for clinical-director disposition.",
      );
    } catch (error: unknown) {
      setCarePathError(
        error instanceof Error
          ? error.message
          : "The server rejected this care-path action.",
      );
    }
  };

  const submitWorkflowAction = async (request: CcmgWorkflowActionRequest) => {
    const workItemId = model.workflow.workItemId;
    const expectedVersion = model.workflow.expectedVersion;
    if (!workItemId || expectedVersion === null) {
      setActionError(
        "The server did not return an actionable work item version.",
      );
      return;
    }
    setActionError(undefined);
    setActionSuccess(undefined);
    try {
      switch (request.kind) {
        case "transition":
          await transitionMutation.mutateAsync({
            workItemId,
            toStatus: request.toStatus,
            reason: request.reason,
            expectedVersion,
          });
          break;
        case "assign":
          await assignMutation.mutateAsync({
            workItemId,
            assignedDivision: request.assignedDivision,
            assignedDepartment: request.assignedDepartment,
            assignedRole: request.assignedRole,
            ...(request.assignedTo ? { assignedTo: request.assignedTo } : {}),
            dueAt: request.dueAt,
            reason: request.reason,
            expectedVersion,
          });
          break;
        case "approve":
          await approveMutation.mutateAsync({
            workItemId,
            decision: request.decision,
            rationale: request.rationale,
            expectedVersion,
          });
          break;
        case "handoff":
          await handoffMutation.mutateAsync({
            workItemId,
            toDivision: request.toDivision,
            toDepartment: request.toDepartment,
            dueAt: request.dueAt,
            reason: request.reason,
            expectedVersion,
          });
          break;
        case "escalate":
          await escalateMutation.mutateAsync({
            workItemId,
            level: request.level,
            reason: request.reason,
            expectedVersion,
          });
          break;
        case "exception":
          await exceptionMutation.mutateAsync({
            workItemId,
            disposition: request.disposition,
            ...(request.exceptionCode
              ? { exceptionCode: request.exceptionCode }
              : {}),
            reason: request.reason,
            expectedVersion,
          });
          break;
        case "decide_handoff": {
          const expectedHandoffVersion = model.workflow.handoffVersion;
          if (expectedHandoffVersion === null) {
            throw new Error(
              "The server did not return a current handoff version.",
            );
          }
          await decideHandoffMutation.mutateAsync({
            handoffId: request.handoffId,
            decision: request.decision,
            reason: request.reason,
            expectedHandoffVersion,
            expectedWorkItemVersion: expectedVersion,
          });
          break;
        }
      }
      await detailQuery.refetch();
      await utils.m21.getOversightDashboard.invalidate();
      setActionSuccess(
        "Server-authorized action recorded and trace refreshed.",
      );
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The server rejected this workflow action.",
      );
    }
  };

  return (
    <CcmgReferralDetailView
      model={model}
      authenticatedRoleLabel={getRoleDef().label}
      queryState={queryState}
      isRefreshing={detailQuery.isFetching}
      fallbackNotice={fallbackNotice}
      carePathEnabled={carePathEnabled}
      carePathDisabledReason={
        fallbackNotice
          ? "Built fallback fixtures are read-only. Reconnect to the authenticated M2.1 service to exercise the care path."
          : model.referralVersion === null
            ? "No server referral version is available for a controlled care-path action."
            : undefined
      }
      carePathSubmitting={anyActionSubmitting}
      carePathError={carePathError}
      carePathSuccess={carePathSuccess}
      actionsEnabled={actionsEnabled}
      actionsDisabledReason={
        fallbackNotice
          ? "Built fallback fixtures are read-only. Reconnect to the authenticated M2.1 service to take action."
          : !workflowIsActionable
            ? "The server did not return a nonterminal workflow item for a controlled action."
            : model.workflow.workItemId === null ||
                model.workflow.expectedVersion === null
              ? "No server work item and version are available for a controlled action."
              : undefined
      }
      actionSubmitting={anyActionSubmitting}
      actionError={actionError}
      actionSuccess={actionSuccess}
      onCarePathAction={submitCarePathAction}
      onWorkflowAction={submitWorkflowAction}
      onRefresh={() => {
        void detailQuery.refetch();
      }}
    />
  );
}

export default CcmgReferralDetailPage;
