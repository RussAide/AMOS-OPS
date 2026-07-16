import { useEffect, useMemo, useState } from "react";
import { M52MobileOfflineExperience } from "@/components/m52/m52-mobile-offline-view";
import {
  applyM52MedicationTimingEvidence,
  applyM52ReconciliationEvidence,
  completeM52Reconnect,
  runM52MedicationPassScenario,
  setM52ConnectionMode,
  type M52MedicationPassScenario,
} from "@/components/m52/m52-mobile-offline-model";
import { trpc } from "@/providers/trpc";

interface M52InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function M52MobileOfflinePage() {
  const [installPrompt, setInstallPrompt] =
    useState<M52InstallPromptEvent | null>(null);
  const snapshotQuery = trpc.m52.getExperienceSnapshot.useQuery(undefined, {
    retry: false,
  });

  const reconciledScenario = useMemo<M52MedicationPassScenario | undefined>(() => {
    const snapshot = snapshotQuery.data;
    if (!snapshot?.accepted) return undefined;
    let scenario = runM52MedicationPassScenario();
    scenario = applyM52MedicationTimingEvidence(
      scenario,
      snapshot.medicationTiming.evidence,
    );
    scenario = completeM52Reconnect(
      setM52ConnectionMode(scenario, "reconnecting"),
    );
    const medicationRuntime = snapshot.workflows.find(
      (workflow) => workflow.workflowId === "gro_tablet_medication_pass",
    );
    if (!medicationRuntime) return undefined;
    return applyM52ReconciliationEvidence(scenario, {
      evidenceId: snapshot.experience.reconnect.evidenceId ?? "",
      source: "api-receipt",
      verified: true,
      zeroDataLoss: medicationRuntime.reconciliation.zeroDataLoss,
      dataLossCount:
        medicationRuntime.reconciliation.unaccountedRecordIds.length,
      duplicateCount:
        medicationRuntime.reconciliation.duplicateSuppressionCount,
      queueRemaining:
        medicationRuntime.reconciliation.unresolvedIntentCount,
      auditChainValid: medicationRuntime.reconciliation.auditChainValid,
    });
  }, [snapshotQuery.data]);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as M52InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <M52MobileOfflineExperience
      evidenceModel={snapshotQuery.data?.experience}
      initialScenario={reconciledScenario}
      installAvailable={installPrompt !== null}
      key={snapshotQuery.data?.executedAt ?? "m52-evidence-pending"}
      onInstall={() => void install()}
    />
  );
}

export default M52MobileOfflinePage;
