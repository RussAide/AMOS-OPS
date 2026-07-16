import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BatteryMedium,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  CloudOff,
  CloudUpload,
  FileCheck2,
  Fingerprint,
  Gauge,
  HandHeart,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Pill,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Signal,
  Tablet,
  Timer,
  UserRoundCheck,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge-view";
import { Button } from "@/components/ui/button-view";
import {
  M52_APPROVED_OFFLINE_WORKFLOWS,
  M52_CONNECTION_PRESENTATION,
  M52_DOCUMENTED_OFFLINE_RESTRICTIONS,
  M52_MEDICATION_PASS_STEPS,
  M52_MEDICATION_PASS_TARGET_SECONDS,
  M52_SYNTHETIC_BOUNDARY,
  advanceM52MedicationPass,
  buildM52ExperienceModel,
  captureM52MedicationAttestation,
  completeM52Reconnect,
  createM52MedicationPassScenario,
  currentM52MedicationPassStep,
  formatM52Elapsed,
  m52CurrentStepPrerequisitesMet,
  m52CurrentStepIsVerified,
  m52MedicationPassCompletedUnderTarget,
  m52MedicationPassHasNoBypassedControls,
  m52ScriptedMedicationPassUnderTarget,
  requestM52ConflictReview,
  setM52ConnectionMode,
  updateM52MedicationOutcome,
  verifyM52MedicationPassControl,
  type M52ConnectionMode,
  type M52ExperienceModel,
  type M52MedicationOutcomeUpdate,
  type M52MedicationPassScenario,
} from "./m52-mobile-offline-model";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50";
const eyebrowClass =
  "text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500";
const touchClass =
  "h-12 min-w-12 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2";

const CONNECTION_ICON: Record<M52ConnectionMode, ComponentType<{ className?: string }>> = {
  online: Wifi,
  offline: WifiOff,
  reconnecting: RefreshCw,
  conflict: AlertTriangle,
  restricted: LockKeyhole,
};

const CONNECTION_TONE: Record<M52ConnectionMode, string> = {
  online: "border-emerald-300 bg-emerald-50 text-emerald-900",
  offline: "border-amber-300 bg-amber-50 text-amber-950",
  reconnecting: "border-blue-300 bg-blue-50 text-blue-950",
  conflict: "border-rose-300 bg-rose-50 text-rose-950",
  restricted: "border-slate-300 bg-slate-100 text-slate-900",
};

export interface M52MobileOfflineViewProps {
  scenario: M52MedicationPassScenario;
  batteryPercent: number;
  installAvailable: boolean;
  evidenceModel?: M52ExperienceModel;
  onVerifyControl: (controlId: string) => void;
  onAdvance: () => void;
  onReset: () => void;
  onConnectionChange: (mode: M52ConnectionMode) => void;
  onCompleteReconnect: () => void;
  onRequestConflictReview: () => void;
  onUpdateOutcome: (update: M52MedicationOutcomeUpdate) => void;
  onCaptureAttestation: () => void;
  onInstall: () => void;
}

function SyntheticBoundaryStrip() {
  return (
    <div
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-teal-800 bg-teal-950 px-4 py-2.5 text-teal-50 shadow-sm"
      data-testid="m52-synthetic-boundary"
      role="status"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-2 font-bold uppercase tracking-wider">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          {M52_SYNTHETIC_BOUNDARY.label}
        </span>
        <span>Fictional records only</span>
        <span>Real data: No</span>
        <span>Live writes: {M52_SYNTHETIC_BOUNDARY.liveWrites}</span>
        <span>
          Real notifications: {M52_SYNTHETIC_BOUNDARY.liveNotifications}
        </span>
      </div>
    </div>
  );
}

function DeviceStatusBar({
  batteryPercent,
  scenario,
}: {
  batteryPercent: number;
  scenario: M52MedicationPassScenario;
}) {
  const NetworkIcon = CONNECTION_ICON[scenario.connectionMode];
  const connection = M52_CONNECTION_PRESENTATION[scenario.connectionMode];
  const batteryLow = batteryPercent <= 20;
  return (
    <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      <span
        aria-label={`Network ${connection.label}. ${connection.detail}`}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${CONNECTION_TONE[scenario.connectionMode]}`}
      >
        <NetworkIcon
          aria-hidden="true"
          className={`h-4 w-4 ${scenario.connectionMode === "reconnecting" ? "animate-spin" : ""}`}
        />
        {connection.label}
      </span>
      <span
        aria-label={`Battery ${batteryPercent} percent${batteryLow ? ", low battery" : ""}`}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
          batteryLow
            ? "border-rose-300 bg-rose-50 text-rose-900"
            : "border-slate-300 bg-white text-slate-700"
        }`}
      >
        <BatteryMedium aria-hidden="true" className="h-4 w-4" />
        {batteryPercent}%{batteryLow ? " · charge soon" : ""}
      </span>
      <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
        <LockKeyhole aria-hidden="true" className="h-4 w-4" />
        Encrypted demo cache
      </span>
    </div>
  );
}

function StatusNotice({ scenario }: { scenario: M52MedicationPassScenario }) {
  if (scenario.connectionMode === "conflict")
    return (
      <div
        className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Version conflict held for review</p>
            <p className="mt-1 text-sm leading-6">
              A newer source version was detected. Both versions and their
              timestamps are preserved; silent overwrite and automatic clinical
              resolution are blocked.
            </p>
            {scenario.conflictResolution === "governed-review-requested" ? (
              <p className="mt-2 text-xs font-semibold">
                Synthetic review request staged locally · resolution still pending
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  if (scenario.connectionMode === "restricted")
    return (
      <div
        className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-slate-950"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Workflow restricted by role scope</p>
            <p className="mt-1 text-sm leading-6">
              Offline capability never expands online authorization. This demo
              projection can see status but cannot open or change the medication
              record.
            </p>
          </div>
        </div>
      </div>
    );
  if (scenario.connectionMode === "reconnecting")
    return (
      <div
        className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950"
        role="status"
      >
        <div className="flex items-start gap-3">
          <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold">Reconnect validation in progress</p>
            <p className="mt-1 text-sm leading-6">
              Stable identity, source version, idempotency key, attestation, and
              role scope are checked before the queued event can sync.
            </p>
          </div>
        </div>
      </div>
    );
  if (scenario.syncState === "synced")
    return (
      <div
        className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950"
        role="status"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Reconciled with zero data loss</p>
            <p className="mt-1 text-sm leading-6">
              One immutable queued event matched its stable source record; no
              duplicate event or discarded field was detected.
            </p>
          </div>
        </div>
      </div>
    );
  return null;
}

function MedicationProgress({
  scenario,
}: {
  scenario: M52MedicationPassScenario;
}) {
  const progress = Math.round(
    (scenario.completedStepIds.length / M52_MEDICATION_PASS_STEPS.length) * 100,
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold text-slate-600">
        <span>
          Step {Math.min(scenario.stageIndex + 1, M52_MEDICATION_PASS_STEPS.length)} of{" "}
          {M52_MEDICATION_PASS_STEPS.length}
        </span>
        <span>{progress}% complete</span>
      </div>
      <div
        aria-label={`${progress} percent complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-teal-700 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function MedicationTimeline({
  scenario,
}: {
  scenario: M52MedicationPassScenario;
}) {
  return (
    <ol aria-label="Medication-pass verification sequence" className="grid gap-2 sm:grid-cols-5">
      {M52_MEDICATION_PASS_STEPS.map((step, index) => {
        const complete = scenario.completedStepIds.includes(step.id);
        const current = !scenario.complete && index === scenario.stageIndex;
        return (
          <li
            aria-current={current ? "step" : undefined}
            className={`rounded-xl border p-3 ${
              complete
                ? "border-emerald-200 bg-emerald-50"
                : current
                  ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                  : "border-slate-200 bg-slate-50"
            }`}
            key={step.id}
          >
            <div className="flex items-center gap-2">
              {complete ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    current ? "bg-teal-800 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {index + 1}
                </span>
              )}
              <span className="text-xs font-semibold text-slate-900">{step.label}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              +{formatM52Elapsed(step.simulatedSeconds)} simulated
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function StructuredOutcomeEntry({
  scenario,
  blocked,
  onUpdateOutcome,
}: {
  scenario: M52MedicationPassScenario;
  blocked: boolean;
  onUpdateOutcome: (update: M52MedicationOutcomeUpdate) => void;
}) {
  const outcomes = ["administered", "refused", "held"] as const;
  return (
    <fieldset className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-950">
        Structured administration outcome · required
      </legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {outcomes.map((outcome) => (
          <button
            aria-pressed={scenario.outcome === outcome}
            className={`${touchClass} border px-2 text-xs font-semibold capitalize ${
              scenario.outcome === outcome
                ? "border-blue-800 bg-blue-800 text-white"
                : "border-blue-200 bg-white text-slate-700 hover:bg-blue-50"
            }`}
            data-touch-target="48"
            disabled={blocked}
            key={outcome}
            onClick={() => onUpdateOutcome({ outcome })}
            type="button"
          >
            {outcome}
          </button>
        ))}
      </div>
      {(scenario.outcome === "refused" || scenario.outcome === "held") && (
        <label className="mt-3 block text-xs font-semibold text-slate-700">
          Exception reason · required
          <input
            className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            data-touch-target="48"
            disabled={blocked}
            onChange={(event) =>
              onUpdateOutcome({ exceptionReason: event.currentTarget.value })
            }
            placeholder="Enter the fictional refusal or hold reason"
            type="text"
            value={scenario.exceptionReason ?? ""}
          />
        </label>
      )}
      <label className="mt-3 block text-xs font-semibold text-slate-700">
        Administration note · required
        <textarea
          className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          data-touch-target="48"
          disabled={blocked}
          onChange={(event) =>
            onUpdateOutcome({ administrationNote: event.currentTarget.value })
          }
          placeholder="Record the fictional observation; do not enter real data"
          value={scenario.administrationNote ?? ""}
        />
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Refused and held outcomes cannot verify without both an exception reason
        and note. No selection changes the underlying fictional order.
      </p>
    </fieldset>
  );
}

function AttestationEntry({
  scenario,
  blocked,
  onCaptureAttestation,
}: {
  scenario: M52MedicationPassScenario;
  blocked: boolean;
  onCaptureAttestation: () => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <p className="text-sm font-semibold text-slate-950">
        Local synthetic attestation · required
      </p>
      {scenario.attestation ? (
        <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-700">Signer role</dt>
            <dd className="mt-1">{scenario.attestation.signerRole}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Device sequence</dt>
            <dd className="mt-1">{scenario.attestation.deviceSequence}</dd>
          </div>
        </dl>
      ) : (
        <Button
          className={`${touchClass} mt-3 w-full border-violet-300 bg-white text-violet-900 hover:bg-violet-50`}
          data-touch-target="48"
          disabled={blocked}
          onClick={onCaptureAttestation}
          type="button"
          variant="outline"
        >
          <Fingerprint aria-hidden="true" className="h-5 w-5" />
          Capture fictional device attestation
        </Button>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-500">
        This binds the synthetic signer role, device sequence, and original
        device timestamp; it is not a legal signature or live system write.
      </p>
    </div>
  );
}

function MedicationPassPanel(props: M52MobileOfflineViewProps) {
  const step = currentM52MedicationPassStep(props.scenario);
  const stepVerified = m52CurrentStepIsVerified(props.scenario);
  const stepPrerequisitesMet = m52CurrentStepPrerequisitesMet(props.scenario);
  const interactionBlocked = ["restricted", "conflict", "reconnecting"].includes(
    props.scenario.connectionMode,
  );
  const completedUnderTarget = m52MedicationPassCompletedUnderTarget(
    props.scenario,
  );
  const scriptedUnderTarget = m52ScriptedMedicationPassUnderTarget(
    props.scenario,
  );
  return (
    <section aria-labelledby="med-pass-heading" className={`${cardClass} overflow-hidden`}>
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-teal-950 to-teal-900 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">
              M5.2-05 · guided tablet scenario
            </p>
            <h2 id="med-pass-heading" className="mt-1 text-xl font-semibold">
              Medication pass without skipped controls
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-100">
              Complete the approved fictional scenario offline in under five
              simulated minutes. Every step requires visible verification before
              the next action unlocks.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-teal-200">Scripted</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {formatM52Elapsed(props.scenario.scriptedElapsedSeconds)}
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-teal-200">Target</p>
              <p className="mt-1 font-mono text-lg font-bold">
                &lt; {formatM52Elapsed(M52_MEDICATION_PASS_TARGET_SECONDS)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <MedicationProgress scenario={props.scenario} />
        <MedicationTimeline scenario={props.scenario} />
        <StatusNotice scenario={props.scenario} />

        <div className="grid gap-4 lg:grid-cols-[.72fr_1.28fr]">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className={eyebrowClass}>Fictional record</p>
              <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline">
                Demo only
              </Badge>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-900 text-white">
                <UserRoundCheck aria-hidden="true" className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-slate-950">
                  {props.scenario.syntheticYouthLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">Token DEMO-WB-204 · two identifiers</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                <Pill aria-hidden="true" className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-slate-950">
                  {props.scenario.syntheticMedicationLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">Package DEMO-MED-A · due now</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            {props.scenario.complete ? (
              <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <CheckCircle2 aria-hidden="true" className="h-8 w-8" />
                </span>
                <h3 className="mt-4 text-xl font-semibold text-slate-950">
                  Medication pass queued safely
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  The scripted flow reached its queue point in{" "}
                  {formatM52Elapsed(props.scenario.scriptedElapsedSeconds)} with{" "}
                  {m52MedicationPassHasNoBypassedControls(props.scenario)
                    ? "every verification control preserved"
                    : "verification review required"}
                  . The event remains visibly queued until canonical
                  reconciliation evidence is supplied.
                </p>
                <Badge
                  className={`mt-4 ${
                    completedUnderTarget
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : scriptedUnderTarget
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-rose-300 bg-rose-50 text-rose-800"
                  }`}
                  variant="outline"
                >
                  {completedUnderTarget
                    ? `Verified · ${formatM52Elapsed(props.scenario.measuredElapsedSeconds ?? 0)}`
                    : scriptedUnderTarget
                      ? "Scripted under 5:00 · timing evidence pending"
                      : "Scripted target not met"}
                </Badge>
              </div>
            ) : step ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={eyebrowClass}>Current verification gate</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">{step.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.instruction}</p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                    {step.id === "identity" ? (
                      <Fingerprint aria-hidden="true" className="h-6 w-6" />
                    ) : step.id === "medication" ? (
                      <ScanLine aria-hidden="true" className="h-6 w-6" />
                    ) : (
                      <ClipboardCheck aria-hidden="true" className="h-6 w-6" />
                    )}
                  </span>
                </div>
                <ul aria-label={`${step.label} controls`} className="mt-4 space-y-2">
                  {step.controls.map((control) => {
                    const verified = props.scenario.verifiedControlIds.includes(control.id);
                    return (
                      <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" key={control.id}>
                        {verified ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                        ) : (
                          <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{control.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{control.evidence}</p>
                        </div>
                        {!verified ? (
                          <Button
                            aria-label={`Verify ${control.label}`}
                            className={`${touchClass} shrink-0 border-teal-300 bg-white px-3 text-teal-900 hover:bg-teal-50`}
                            data-touch-target="48"
                            disabled={
                              interactionBlocked || !stepPrerequisitesMet
                            }
                            onClick={() => props.onVerifyControl(control.id)}
                            type="button"
                            variant="outline"
                          >
                            Verify
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {step.id === "outcome" ? (
                  <StructuredOutcomeEntry
                    blocked={interactionBlocked}
                    onUpdateOutcome={props.onUpdateOutcome}
                    scenario={props.scenario}
                  />
                ) : null}
                {step.id === "attestation" ? (
                  <AttestationEntry
                    blocked={interactionBlocked}
                    onCaptureAttestation={props.onCaptureAttestation}
                    scenario={props.scenario}
                  />
                ) : null}
                <div className="mt-5">
                  <Button
                    aria-describedby="advance-help"
                    className={`${touchClass} w-full bg-teal-900 text-white hover:bg-teal-800`}
                    data-touch-target="48"
                    disabled={interactionBlocked || !stepVerified}
                    onClick={props.onAdvance}
                    type="button"
                  >
                    {props.scenario.stageIndex === M52_MEDICATION_PASS_STEPS.length - 1
                      ? "Attest and queue"
                      : "Complete step"}
                    <ChevronRight aria-hidden="true" className="h-5 w-5" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500" id="advance-help">
                  Verify each current-step control independently. Structured
                  inputs must be complete before those controls unlock, and the
                  completion action remains locked until every check passes.
                </p>
              </>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}

function OfflineQueuePanel(props: M52MobileOfflineViewProps) {
  const syncLabel = {
    current: "Current",
    queued: "Queued locally",
    syncing: "Validating",
    synced: "Reconciled",
    conflict: "Conflict held",
    restricted: "Restricted",
  }[props.scenario.syncState];
  return (
    <section aria-labelledby="queue-heading" className={`${cardClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={eyebrowClass}>Offline queue and reconnect</p>
          <h2 id="queue-heading" className="mt-1 text-lg font-semibold text-slate-950">
            Visible state, never silent sync
          </h2>
        </div>
        <Badge className="border-slate-300 bg-slate-50 text-slate-800" variant="outline">
          {syncLabel}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-semibold text-slate-950">{props.scenario.queuedRecordCount}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Queued</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-semibold text-slate-950">
            {props.scenario.syncState === "conflict" ? 1 : 0}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Conflicts</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-2xl font-semibold text-emerald-700">
            {props.scenario.syncState === "synced" ? 0 : "—"}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Data lost</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {props.scenario.complete ? (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <FileCheck2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Immutable medication event</p>
              <p className="mt-1 text-xs text-slate-500">
                SYNTH-M52-MEDPASS-001 · stable source ID · sequence 0001
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Complete the fictional medication pass to create one governed queue event.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {props.scenario.connectionMode === "reconnecting" ? (
          <Button
            className={`${touchClass} bg-blue-800 text-white hover:bg-blue-700 sm:col-span-2`}
            data-touch-target="48"
            onClick={props.onCompleteReconnect}
            type="button"
          >
            <CloudUpload aria-hidden="true" className="h-5 w-5" />
            Complete local reconnect checks
          </Button>
        ) : props.scenario.connectionMode === "conflict" ? (
          <Button
            className={`${touchClass} bg-rose-800 text-white hover:bg-rose-700 sm:col-span-2`}
            data-touch-target="48"
            disabled={
              props.scenario.conflictResolution === "governed-review-requested"
            }
            onClick={props.onRequestConflictReview}
            type="button"
          >
            <ListChecks aria-hidden="true" className="h-5 w-5" />
            {props.scenario.conflictResolution === "governed-review-requested"
              ? "Conflict review request pending"
              : "Stage governed conflict review request"}
          </Button>
        ) : (
          <Button
            className={`${touchClass} sm:col-span-2`}
            data-touch-target="48"
            disabled={props.scenario.queuedRecordCount === 0}
            onClick={() => props.onConnectionChange("reconnecting")}
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="h-5 w-5" />
            Begin governed reconnect
          </Button>
        )}
      </div>
    </section>
  );
}

function ConnectionStateLab(props: M52MobileOfflineViewProps) {
  const modes: M52ConnectionMode[] = [
    "online",
    "offline",
    "reconnecting",
    "conflict",
    "restricted",
  ];
  return (
    <section aria-labelledby="state-lab-heading" className={`${cardClass} p-5`}>
      <p className={eyebrowClass}>Field-state evaluator</p>
      <h2 id="state-lab-heading" className="mt-1 text-lg font-semibold text-slate-950">
        Exercise every visible state
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Switch the fictional device state to verify the interface never hides
        offline, queued, reconnecting, conflict, or restriction conditions.
      </p>
      <div aria-label="Simulated network and access state" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group">
        {modes.map((mode) => {
          const Icon = CONNECTION_ICON[mode];
          const selected = props.scenario.connectionMode === mode;
          return (
            <button
              aria-pressed={selected}
              className={`${touchClass} flex h-auto min-h-12 flex-col items-center justify-center gap-1 border px-2 py-2 text-xs font-semibold transition-colors ${
                selected
                  ? CONNECTION_TONE[mode]
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              data-touch-target="48"
              key={mode}
              onClick={() => props.onConnectionChange(mode)}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {M52_CONNECTION_PRESENTATION[mode].label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Conflict simulation preserves both versions. Restricted simulation
        removes mutation controls. No state sends a real alert or performs a live write.
      </p>
    </section>
  );
}

function ApprovedWorkflowSet() {
  const icons = [Pill, HandHeart, Signal, ClipboardCheck] as const;
  return (
    <section aria-labelledby="workflow-set-heading" className={`${cardClass} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={eyebrowClass}>Frozen capability baseline</p>
          <h2 id="workflow-set-heading" className="mt-1 text-lg font-semibold text-slate-950">
            Four approved offline-first core workflows
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Only this exact set is presented as offline-capable. Safety rounds
            remain part of GRO shift safety and handoff, not a separate workflow.
          </p>
        </div>
        <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800" variant="outline">
          Exact set · 4/4
        </Badge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {M52_APPROVED_OFFLINE_WORKFLOWS.map((workflow, index) => {
          const Icon = icons[index];
          return (
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={workflow.id}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-900 text-white">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">{workflow.label}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{workflow.description}</p>
                  <p className="mt-2 text-xs font-semibold text-teal-800">{workflow.mode}</p>
                  <p className="mt-2 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-slate-500">
                    <span className="font-semibold text-slate-700">Offline restriction:</span>{" "}
                    {workflow.restrictions}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FieldUsabilityEvidence({
  batteryPercent,
  evidenceModel,
}: {
  batteryPercent: number;
  evidenceModel?: M52ExperienceModel;
}) {
  const evidence = evidenceModel ?? buildM52ExperienceModel();
  const metrics = [
    {
      icon: Timer,
      label: "Scripted medication pass",
      value: evidence.medicationPass.scriptedFormattedElapsed,
      detail: evidence.medicationPass.completedUnderFiveMinutes
        ? "integrated event-trail receipt verified"
        : "all controls; measured evidence pending",
    },
    {
      icon: Tablet,
      label: "Touch targets",
      value: `${evidence.fieldUsability.minimumTouchTargetPixels}px`,
      detail: "minimum primary control size",
    },
    {
      icon: Signal,
      label: "Network behavior",
      value: "5 states",
      detail: "online through restricted",
    },
    {
      icon: BatteryMedium,
      label: "Battery visibility",
      value: `${batteryPercent}%`,
      detail: "warning at 20% or below",
    },
  ];
  return (
    <section aria-labelledby="field-evidence-heading" className={`${cardClass} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={eyebrowClass}>M5.2-08 · field validation presentation</p>
        <Badge
          className={
            evidence.fieldUsability.passed
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }
          variant="outline"
        >
          {evidence.fieldUsability.passed
            ? "Integrated evidence verified"
            : "Evidence pending"}
        </Badge>
      </div>
      <h2 id="field-evidence-heading" className="mt-1 text-lg font-semibold text-slate-950">
        Field usability and accessible-operation readiness
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={metric.label}>
            <metric.icon aria-hidden="true" className="h-5 w-5 text-teal-800" />
            <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">{metric.label}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Accessible by design</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {[
              "Keyboard-operable controls with visible focus treatment",
              "Semantic landmarks, ordered headings, labels, and live status",
              "Status is conveyed by icon and text, never color alone",
              "Responsive 768px portrait and 1024px landscape tablet layouts",
            ].map((item) => (
              <li className="flex items-start gap-2" key={item}>
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Synthetic authorized-role walkthrough profiles</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {evidence.fieldUsability.representativeAuthorizedRoleProfiles.map((role) => (
              <li className="flex items-start gap-2" key={role}>
                <UserRoundCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" />
                {role}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-amber-800">
            {evidence.fieldUsability.passed
              ? "The canonical synthetic evaluation receipt covers each representative profile; live field certification remains outside this prototype boundary."
              : "These are representative fictional profiles, not a claim of completed field validation. Canonical evaluation evidence must be supplied before M5.2-08 is marked passed."}
          </p>
        </div>
      </div>
    </section>
  );
}

function PwaInstallPanel({
  installAvailable,
  onInstall,
}: Pick<M52MobileOfflineViewProps, "installAvailable" | "onInstall">) {
  return (
    <section aria-labelledby="pwa-heading" className={`${cardClass} p-5`}>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
          <Tablet aria-hidden="true" className="h-6 w-6" />
        </span>
        <div>
          <p className={eyebrowClass}>Installable field shell</p>
          <h2 id="pwa-heading" className="mt-1 text-lg font-semibold text-slate-950">
            AMOS-OPS Mobile Workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The scoped manifest and service worker preserve only the M5.2 route,
            user-neutral shell, and controlled build assets. API requests,
            authentication, documents, exports, and non-GET actions remain
            network-only and are never fabricated as successful writes.
          </p>
        </div>
      </div>
      <Button
        className={`${touchClass} mt-4 w-full`}
        data-touch-target="48"
        disabled={!installAvailable}
        onClick={onInstall}
        type="button"
        variant="outline"
      >
        <Cloud aria-hidden="true" className="h-5 w-5" />
        {installAvailable ? "Install tablet workspace" : "Install available from browser menu"}
      </Button>
    </section>
  );
}

function RestrictionPanel() {
  return (
    <section aria-labelledby="restrictions-heading" className={`${cardClass} p-5`}>
      <div className="flex items-start gap-3">
        <CloudOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className={eyebrowClass}>Documented offline restrictions</p>
          <h2 id="restrictions-heading" className="mt-1 text-lg font-semibold text-slate-950">
            Offline does not mean unrestricted
          </h2>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
        {M52_DOCUMENTED_OFFLINE_RESTRICTIONS.map((restriction) => (
          <li className="flex items-start gap-2" key={restriction}>
            <XCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-rose-700" />
            {restriction}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function M52MobileOfflineView(props: M52MobileOfflineViewProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <a
        className="sr-only z-[60] rounded bg-white px-4 py-3 text-teal-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        href="#m52-main-content"
      >
        Skip to mobile workflow
      </a>
      <SyntheticBoundaryStrip />
      <main className="mx-auto max-w-[1440px] space-y-5 px-3 py-4 sm:px-5 sm:py-6" id="m52-main-content">
        <header className={`${cardClass} overflow-hidden`}>
          <div className="grid gap-5 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.22),_transparent_38%),linear-gradient(135deg,#0f172a,#123f3d_62%,#155e5a)] px-5 py-6 text-white sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <img
                  alt="AMOS-OPS"
                  className="h-8 w-auto object-contain"
                  src="/assets/AMOS-OPS_Logo_Horizontal_Light.png"
                />
                <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                  M5.2
                </Badge>
              </div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-200">
                Operations Hub · mobile and offline deployment
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Work safely in the field—even when the network cannot
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
                A tablet-first, offline-first experience with persistent queue
                truth, governed reconnect, explicit restrictions, and no loss of
                verification evidence.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Gauge aria-hidden="true" className="h-6 w-6 text-teal-200" />
                <div>
                  <p className="text-xs text-slate-300">Approved med-pass scenario</p>
                  <p className="mt-1 text-xl font-semibold">4:13 scripted · all gates</p>
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 sm:px-7">
            <DeviceStatusBar batteryPercent={props.batteryPercent} scenario={props.scenario} />
          </div>
        </header>

        <MedicationPassPanel {...props} />

        <div className="grid gap-5 xl:grid-cols-2">
          <OfflineQueuePanel {...props} />
          <ConnectionStateLab {...props} />
        </div>

        <ApprovedWorkflowSet />
        <FieldUsabilityEvidence
          batteryPercent={props.batteryPercent}
          evidenceModel={props.evidenceModel}
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <PwaInstallPanel installAvailable={props.installAvailable} onInstall={props.onInstall} />
          <RestrictionPanel />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-900/20 bg-teal-950 px-5 py-4 text-xs text-teal-50">
          <span className="inline-flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Synthetic boundary remains active throughout this experience
          </span>
          <span>No real records · no live writes · no external alerts</span>
        </footer>

        <div className="fixed bottom-4 right-4 z-40">
          <Button
            aria-label="Reset synthetic medication-pass scenario"
            className={`${touchClass} rounded-full border-slate-300 bg-white text-slate-700 shadow-lg hover:bg-slate-50`}
            data-touch-target="48"
            onClick={props.onReset}
            size="icon"
            title="Reset synthetic scenario"
            type="button"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" className="h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}

export interface M52MobileOfflineExperienceProps {
  initialScenario?: M52MedicationPassScenario;
  batteryPercent?: number;
  installAvailable?: boolean;
  evidenceModel?: M52ExperienceModel;
  onInstall?: () => void;
}

export function M52MobileOfflineExperience({
  initialScenario,
  batteryPercent = 76,
  installAvailable = false,
  evidenceModel,
  onInstall = () => undefined,
}: M52MobileOfflineExperienceProps) {
  const [scenario, setScenario] = useState<M52MedicationPassScenario>(
    () => initialScenario ?? createM52MedicationPassScenario(),
  );

  return (
    <M52MobileOfflineView
      batteryPercent={batteryPercent}
      evidenceModel={evidenceModel}
      installAvailable={installAvailable}
      onAdvance={() => setScenario((current) => advanceM52MedicationPass(current))}
      onCaptureAttestation={() =>
        setScenario((current) => captureM52MedicationAttestation(current))
      }
      onCompleteReconnect={() => setScenario((current) => completeM52Reconnect(current))}
      onConnectionChange={(mode) =>
        setScenario((current) => setM52ConnectionMode(current, mode))
      }
      onInstall={onInstall}
      onReset={() => setScenario(createM52MedicationPassScenario())}
      onRequestConflictReview={() =>
        setScenario((current) => requestM52ConflictReview(current))
      }
      onUpdateOutcome={(update) =>
        setScenario((current) => updateM52MedicationOutcome(current, update))
      }
      onVerifyControl={(controlId) =>
        setScenario((current) =>
          verifyM52MedicationPassControl(current, controlId),
        )
      }
      scenario={scenario}
    />
  );
}

export default M52MobileOfflineExperience;
