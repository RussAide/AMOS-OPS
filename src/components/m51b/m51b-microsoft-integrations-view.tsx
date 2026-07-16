import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  CloudCog,
  FileInput,
  Fingerprint,
  Gauge,
  Inbox,
  KeyRound,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  MailCheck,
  MessagesSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldCheck,
  Siren,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge-view";
import { Button } from "@/components/ui/button-view";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  M51BAcceptancePresentation,
  M51BSnapshot,
} from "./m51b-experience-model";
import {
  m51bAcceptanceCounts,
  m51bChannelReadiness,
  m51bHasZeroLiveOperations,
  m51bSharePointGateReadiness,
} from "./m51b-experience-model";

type ViewState = "loading" | "error" | "ready";

export interface M51BMicrosoftIntegrationsViewProps {
  snapshot: M51BSnapshot | null;
  acceptance: M51BAcceptancePresentation | null;
  scenarioResult: M51BAcceptancePresentation | null;
  state: ViewState;
  errorMessage?: string;
  isRefreshing: boolean;
  isRunningScenario: boolean;
  onRefresh: () => void;
  onRunScenario: () => void;
}

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40";
const labelClass =
  "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500";

function MetricCard(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail: string;
  tone?: "navy" | "teal" | "blue" | "violet";
}) {
  const Icon = props.icon;
  const tone = {
    navy: "border-slate-950 bg-slate-950 text-white",
    teal: "border-teal-100 bg-teal-50 text-teal-950",
    blue: "border-blue-100 bg-blue-50 text-blue-950",
    violet: "border-violet-100 bg-violet-50 text-violet-950",
  }[props.tone ?? "teal"];
  return (
    <article className={`${cardClass} flex min-h-32 flex-col justify-between p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
          {props.label}
        </p>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <div>
        <p className="mt-5 text-3xl font-semibold tracking-tight">
          {props.value}
        </p>
        <p className="mt-1 text-xs opacity-70">{props.detail}</p>
      </div>
    </article>
  );
}

function BoundaryStrip({ snapshot }: { snapshot: M51BSnapshot }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-teal-800/40 bg-teal-950 px-5 py-3 text-xs text-teal-50">
      <span className="inline-flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-4 w-4" /> Synthetic integration evaluation
      </span>
      <span>Real data: {snapshot.boundary.realDataUsed ? "Yes" : "No"}</span>
      <span>Live Graph calls: {snapshot.boundary.liveGraphCalls}</span>
      <span>Microsoft reads: {snapshot.boundary.liveMicrosoftReads}</span>
      <span>Microsoft writes: {snapshot.boundary.liveMicrosoftWrites}</span>
      <span>Real notifications: {snapshot.boundary.realNotificationsSent}</span>
    </div>
  );
}

function StatusCheck(props: {
  label: string;
  passed: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
      {props.passed ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      )}
      <div>
        <p className="text-xs font-semibold text-slate-800">{props.label}</p>
        {props.detail ? (
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {props.detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AcceptancePanel({
  result,
}: {
  result: M51BAcceptancePresentation | null;
}) {
  const counts = m51bAcceptanceCounts(result);
  if (!result)
    return (
      <div className={`${cardClass} p-5`}>
        <p className={labelClass}>Milestone control set</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Eight integrated acceptance criteria
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The synthetic evaluation joins inherited M5.1A controls, channel
          outcomes, governance, resilience, and the zero-live-operation
          boundary into one evidence set.
        </p>
      </div>
    );

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className={labelClass}>Integrated acceptance</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {counts.passed}/{counts.total} controls passed
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {counts.assertions} executable assertions
          </p>
        </div>
        <Badge
          className={
            result.accepted
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }
          variant="outline"
        >
          {result.accepted ? "Accepted" : "Review required"}
        </Badge>
      </div>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
        {result.acceptanceFlags.map((criterion) => (
          <article className="bg-white p-4" key={criterion.criterionId}>
            <div className="flex gap-3">
              {criterion.passed ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-950">
                  {criterion.criterionId}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {criterion.summary}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {criterion.assertionCount} assertions
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function OverviewTab(
  props: M51BMicrosoftIntegrationsViewProps & { snapshot: M51BSnapshot },
) {
  const result = props.scenarioResult ?? props.acceptance;
  const counts = m51bAcceptanceCounts(result);
  const channelReadiness = m51bChannelReadiness(props.snapshot);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${counts.assertions} executable assertions`}
          icon={CheckCircle2}
          label="Acceptance"
          tone="navy"
          value={`${counts.passed}/${counts.total}`}
        />
        <MetricCard
          detail="Teams delivery evidence"
          icon={MessagesSquare}
          label="Notification"
          value={`${(props.snapshot.channels.teams.deliveryElapsedMilliseconds / 1_000).toFixed(2)}s`}
        />
        <MetricCard
          detail="exactly-once synthetic outcome"
          icon={MailCheck}
          label="Referral intake"
          tone="blue"
          value={props.snapshot.channels.outlook.intakeCount}
        />
        <MetricCard
          detail={`${props.snapshot.channels.sharepoint.governanceGatesPassed}/${props.snapshot.channels.sharepoint.governanceGatesTotal} gates passed`}
          icon={CloudCog}
          label="Content sync"
          tone="violet"
          value={`${props.snapshot.channels.sharepoint.elapsedSeconds}s`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <AcceptancePanel result={result} />
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Channel readiness</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            One governed workflow fabric
          </h2>
          <div className="mt-5 space-y-3">
            {channelReadiness.map((channel) => (
              <div
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                key={channel.channel}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {channel.channel}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {channel.detail}
                    </p>
                  </div>
                  <span
                    aria-label={`${channel.channel} channel ${channel.passed ? "passed" : "failed"}`}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                      channel.passed ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {channel.passed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {channel.passed ? "Pass" : "Fail"} · {channel.measure}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`${cardClass} p-4`}>
          <p className={labelClass}>Signed-in projection</p>
          <p className="mt-2 text-base font-semibold capitalize text-slate-900">
            {props.snapshot.viewer.role.replace(/-/g, " ")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {props.snapshot.viewer.tier} · server-derived identity
          </p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={labelClass}>Governance posture</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {props.snapshot.governance.contracts} contracts
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {props.snapshot.governance.leastPrivilegeScopes} least-privilege
            scopes · {props.snapshot.governance.accessReviews} reviews
          </p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={labelClass}>Evidence boundary</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {m51bHasZeroLiveOperations(props.snapshot) ? "Zero live" : "Review"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            no real data or file reads; no live calls, writes, connector
            mutation, tenant provisioning, secrets, deployment, GitHub push,
            or notifications
          </p>
        </div>
      </div>
    </div>
  );
}

export function M51BTeamsEvidencePanel({
  snapshot,
}: {
  snapshot: M51BSnapshot;
}) {
  const teams = snapshot.channels.teams;
  const percent = Math.min(
    100,
    (teams.deliveryElapsedMilliseconds / teams.thresholdMilliseconds) * 100,
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <div className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <MessagesSquare className="h-8 w-8 text-teal-300" />
              <Badge className="border-teal-700 bg-teal-900 text-teal-100" variant="outline">
                {teams.status}
              </Badge>
            </div>
            <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Synthetic delivery evidence
            </p>
            <p className="mt-2 text-4xl font-semibold">
              {(teams.deliveryElapsedMilliseconds / 1_000).toFixed(2)} seconds
            </p>
            <p className="mt-2 text-sm text-slate-300">
              measured against the 30-second acceptance threshold
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-teal-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <div className="border-t border-slate-800 bg-slate-900 px-6 py-4 text-xs leading-5 text-slate-300">
            Evidence-only adapter: no Microsoft message was sent and no live
            Teams destination was contacted.
          </div>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Notification assurance chain</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Minimum necessary from destination through acknowledgement
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatusCheck label="Governed destination resolved" passed={teams.destinationResolved} />
            <StatusCheck label="Mentions validated" passed={teams.mentionsValidated} />
            <StatusCheck label="Content minimized" passed={teams.contentMinimized} />
            <StatusCheck label="Acknowledgement recorded" passed={teams.acknowledgementRecorded} />
            <StatusCheck label="Bounded retry recovered" passed={teams.retryRecovered} />
            <StatusCheck label="Privacy denial enforced" passed={teams.privacyDenied} />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          [Route, "Destination", "allowlisted registry target"],
          [UserCheck, "Mentions", "authorized recipients only"],
          [ShieldCheck, "Privacy", "restricted detail excluded"],
          [BellRing, "Evidence", "delivery and acknowledgement retained"],
        ].map(([Icon, title, detail]) => {
          const ItemIcon = Icon as ComponentType<{ className?: string }>;
          return (
            <article className={`${cardClass} p-4`} key={String(title)}>
              <ItemIcon className="h-5 w-5 text-teal-700" />
              <p className="mt-4 text-sm font-semibold text-slate-900">
                {String(title)}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {String(detail)}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function M51BOutlookEvidencePanel({
  snapshot,
}: {
  snapshot: M51BSnapshot;
}) {
  const outlook = snapshot.channels.outlook;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="approved fictional referral" icon={FileInput} label="Intakes created" tone="navy" value={outlook.intakeCount} />
        <MetricCard detail="idempotent intake outcome" icon={Fingerprint} label="Exactly once" value={outlook.exactlyOneIntake ? "Passed" : "Review"} />
        <MetricCard detail="replay suppressed" icon={RotateCcw} label="Duplicate control" tone="blue" value={outlook.duplicatePrevented ? "Passed" : "Review"} />
        <MetricCard detail="authorized recovery proof" icon={Inbox} label="Dead letter" tone="violet" value={outlook.deadLetterRecovered ? "Recovered" : "Open"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4">
            <p className={labelClass}>Referral processing journey</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Validated envelope to one governed intake
            </h2>
          </div>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-4">
            {[
              ["1", "Validate", "sender, context, consent, attachment manifest"],
              ["2", "Deduplicate", "message and referral idempotency keys"],
              ["3", "Register", "one synthetic received intake"],
              ["4", "Recover", "exception route and authorized replay"],
            ].map(([step, title, detail]) => (
              <article className="bg-white p-4" key={step}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-950 text-xs font-bold text-white">
                  {step}
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </article>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs text-slate-600">
              Synthetic intake reference: <span className="font-mono text-[11px] font-semibold text-slate-800">{outlook.intakeId ?? "Not created"}</span>
            </p>
          </div>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Privacy and recovery</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Invalid conditions fail into governed handling
          </h2>
          <div className="mt-5 space-y-3">
            <StatusCheck label="Exactly one intake recorded" passed={outlook.exactlyOneIntake} detail="A duplicate referral cannot create a second record." />
            <StatusCheck label="Duplicate prevented" passed={outlook.duplicatePrevented} detail="Replay returns the existing governed outcome." />
            <StatusCheck label="Privacy exception routed" passed={outlook.privacyExceptionRouted} detail="Missing consent follows the exception path." />
            <StatusCheck label="Dead letter recovered" passed={outlook.deadLetterRecovered} detail="Authorized replay succeeds after a synthetic outage." />
          </div>
        </div>
      </div>
    </div>
  );
}

export function M51BSharePointEvidencePanel({
  snapshot,
}: {
  snapshot: M51BSnapshot;
}) {
  const sharepoint = snapshot.channels.sharepoint;
  const gates = m51bSharePointGateReadiness(snapshot);
  const gatesPassed = gates.filter((gate) => gate.passed).length;
  const allGatesPassed = gatesPassed === gates.length;
  const percent = Math.min(
    100,
    (sharepoint.elapsedSeconds / sharepoint.thresholdSeconds) * 100,
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <CloudCog className="h-8 w-8 text-violet-700" />
            <Badge
              className={
                allGatesPassed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }
              variant="outline"
            >
              {allGatesPassed ? sharepoint.status : "review_required"}
            </Badge>
          </div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Synthetic synchronization evidence
          </p>
          <p className="mt-2 text-4xl font-semibold text-slate-950">
            {sharepoint.elapsedSeconds} seconds
          </p>
          <p className="mt-2 text-sm text-slate-600">
            within the {sharepoint.thresholdSeconds / 60}-minute threshold
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-5 break-all font-mono text-[10px] leading-5 text-slate-500">
            {sharepoint.stableObjectId}
          </p>
        </div>
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className={labelClass}>Eleven non-bypassable gates</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                {gatesPassed}/{gates.length} governance gates passed
              </h2>
            </div>
            {allGatesPassed ? (
              <ShieldCheck className="h-7 w-7 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            )}
          </div>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
            {gates.map((gate, index) => (
              <div
                aria-label={`${gate.label} gate ${gate.passed ? "passed" : "failed"}`}
                className="flex items-center gap-2 bg-white px-4 py-3"
                key={gate.code}
              >
                {gate.passed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                  {String(index + 1).padStart(2, "0")} · {gate.label}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    gate.passed ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {gate.passed ? "Pass" : "Fail"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatusCheck label="AMOS-DMS source authority" passed={sharepoint.sourceOfTruth === "AMOS-DMS"} detail={sharepoint.sourceOfTruth} />
        <StatusCheck label="Stale-version conflict detected" passed={sharepoint.conflictDetected} />
        <StatusCheck label="Bounded retry recovered" passed={sharepoint.retryRecovered} />
        <StatusCheck label="Duplicate mutation prevented" passed={sharepoint.duplicateMutationPrevented} />
        <StatusCheck label="Reconciliation passed" passed={sharepoint.reconciliationPassed} />
      </div>
    </div>
  );
}

export function M51BGovernanceEvidencePanel({
  snapshot,
}: {
  snapshot: M51BSnapshot;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Teams, Outlook, SharePoint" icon={CloudCog} label="Integration contracts" tone="navy" value={snapshot.governance.contracts} />
        <MetricCard detail="channel-specific permission set" icon={KeyRound} label="Least privilege scopes" value={snapshot.governance.leastPrivilegeScopes} />
        <MetricCard detail="quarterly control evidence" icon={UserCheck} label="Access reviews" tone="blue" value={snapshot.governance.accessReviews} />
        <MetricCard detail="validated mitigations" icon={ShieldCheck} label="Privacy threat controls" tone="violet" value={snapshot.governance.privacyThreatControls} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className={`${cardClass} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={labelClass}>Governance posture</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Identity, tenant, secret, access, and privacy controls
              </h2>
            </div>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
              {snapshot.governance.accepted ? "Accepted" : "Review required"}
            </Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatusCheck label="Server-derived identity" passed={snapshot.viewer.serverDerivedIdentity} detail="Caller-supplied authority is not accepted." />
            <StatusCheck label="Least privilege verified" passed={snapshot.governance.leastPrivilegeScopes === 9} detail="Three scoped permissions per channel." />
            <StatusCheck label="Access reviews complete" passed={snapshot.governance.accessReviews === 3} detail="One evidence-backed review per contract." />
            <StatusCheck label="Privacy threats controlled" passed={snapshot.governance.privacyThreatControls === 4} detail="Overdisclosure, trust, authority, and tenant drift." />
            <StatusCheck label="Contract validation clear" passed={snapshot.governance.validationErrors.length === 0} detail={`${snapshot.governance.validationErrors.length} validation errors`} />
            <StatusCheck label="Synthetic tenant boundary" passed={snapshot.boundary.syntheticOnly && !snapshot.boundary.tenantProvisioning} detail="No tenant provisioning or production secret access." />
          </div>
        </div>
        <div className={`${cardClass} overflow-hidden`}>
          <div className="bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">
                  Reliability control room
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Recovery without double processing
                </h2>
              </div>
              <Activity className="h-7 w-7 text-teal-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            {[
              ["Max attempts", snapshot.reliability.maximumAttempts],
              ["Open dead letters", snapshot.reliability.openDeadLetters],
              ["Recovered", snapshot.reliability.recoveredDeadLetters],
              ["Alerts raised", snapshot.reliability.alertsRaised],
              ["Duplicate deliveries", snapshot.reliability.duplicateDeliveries],
              ["Reconciliation", snapshot.reliability.reconciliationAccepted ? "Passed" : "Review"],
            ].map(([label, value]) => (
              <div className="bg-white p-4" key={String(label)}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {String(label)}
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          [RotateCcw, "Bounded retry", `up to ${snapshot.reliability.maximumAttempts} attempts`],
          [Inbox, "Dead-letter queue", `${snapshot.reliability.openDeadLetters} open records`],
          [Siren, "Operational alert", `${snapshot.reliability.alertsRaised} synthetic alert evidenced`],
          [Gauge, "Reconciliation", snapshot.reliability.reconciliationAccepted ? "accepted with zero duplicates" : "review required"],
        ].map(([Icon, title, detail]) => {
          const ItemIcon = Icon as ComponentType<{ className?: string }>;
          return (
            <article className={`${cardClass} p-4`} key={String(title)}>
              <ItemIcon className="h-5 w-5 text-violet-700" />
              <p className="mt-4 text-sm font-semibold text-slate-900">{String(title)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{String(detail)}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function M51BMicrosoftIntegrationsView(
  props: M51BMicrosoftIntegrationsViewProps,
) {
  if (props.state === "error")
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-700" />
        <h2 className="mt-3 font-semibold text-rose-950">
          The Microsoft 365 integration evidence could not load
        </h2>
        <p className="mt-2 text-sm text-rose-800">
          {props.errorMessage ?? "Unknown M5.1B evaluation error."}
        </p>
        <Button className="mt-5" onClick={props.onRefresh} variant="outline">
          <RefreshCw className="h-4 w-4" /> Retry evidence load
        </Button>
      </div>
    );

  if (props.state === "loading" || !props.snapshot)
    return (
      <div className="flex min-h-[440px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-700" />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Loading M5.1B Microsoft 365 integration evidence
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Building the signed-in projection and synthetic channel outcomes.
          </p>
        </div>
      </div>
    );

  const snapshot = props.snapshot;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <BoundaryStrip snapshot={snapshot} />
      <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline">
                M5.1B synthetic prototype
              </Badge>
              <Badge variant="outline">{snapshot.viewer.tier} projection</Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
                {snapshot.accepted ? "8/8 accepted" : "Review required"}
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Microsoft 365 Integration Control Center
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              One governed Operations Hub experience for synthetic Teams
              notification, Outlook referral intake, SharePoint content flow,
              privacy, and recovery evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={props.isRefreshing} onClick={props.onRefresh} variant="outline">
              {props.isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}{" "}
              Refresh evidence
            </Button>
            <Button
              disabled={
                props.isRunningScenario ||
                !snapshot.viewer.canRunIntegratedEvaluation
              }
              onClick={props.onRunScenario}
              title={
                snapshot.viewer.canRunIntegratedEvaluation
                  ? "Run the deterministic synthetic evidence scenario"
                  : "This role can review evidence but cannot run the integrated evaluation"
              }
            >
              {props.isRunningScenario ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}{" "}
              Run synthetic evaluation
            </Button>
          </div>
        </div>
      </div>

      <Tabs className="gap-0" defaultValue="overview">
        <div className="overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6">
          <TabsList className="h-12 w-max bg-transparent p-0">
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="overview">
              <LayoutGrid /> Control center
            </TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="teams">
              <MessagesSquare /> Teams
            </TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="outlook">
              <MailCheck /> Outlook intake
            </TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="sharepoint">
              <CloudCog /> SharePoint
            </TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="governance">
              <LockKeyhole /> Governance &amp; recovery
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="p-4 sm:p-6">
          <TabsContent value="overview">
            <OverviewTab {...props} snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="teams">
            <M51BTeamsEvidencePanel snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="outlook">
            <M51BOutlookEvidencePanel snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="sharepoint">
            <M51BSharePointEvidencePanel snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="governance">
            <M51BGovernanceEvidencePanel snapshot={snapshot} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
