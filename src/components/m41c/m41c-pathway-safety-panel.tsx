import type {
  M41cClinicalMonitoringResult,
  M41cContinuumEpisodeResult,
  M41cExperienceSnapshot,
  M41cPathwayDefinition,
  M41cYouthPathwayPack,
} from "@contracts/m41c";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Ban,
  Braces,
  Cable,
  CircleDot,
  HeartPulse,
  Network,
  Route,
  ShieldAlert,
  Stethoscope,
  Waypoints,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  activationPresentation,
  formatM41cTimestamp,
  prettyM41cToken,
} from "./m41c-experience-model";

function PathwayCard({ pathway }: { pathway: M41cPathwayDefinition }) {
  const activation = activationPresentation(pathway.activationState);
  const requiredRoles = [
    ...new Set(pathway.steps.flatMap((step) => step.requiredHumanRoles)),
  ];
  const blockedActions = [
    ...new Set(
      pathway.steps.flatMap((step) => step.prohibitedAutonomousActions),
    ),
  ];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {prettyM41cToken(pathway.domain)} · {pathway.version}
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-950">
            {pathway.title}
          </h3>
        </div>
        <Badge className={activation.className} variant="outline">
          {activation.label}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pathway.settings.map((setting) => (
          <span
            className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700"
            key={setting}
          >
            {setting}
          </span>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="font-bold text-slate-500">Stages</dt>
          <dd className="mt-0.5 font-black text-slate-900">
            {pathway.steps.length}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="font-bold text-slate-500">Review cadence</dt>
          <dd className="mt-0.5 font-black text-slate-900">
            {prettyM41cToken(pathway.measurementSchedule.reviewCadence)}
          </dd>
        </div>
      </dl>
      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-bold text-slate-800">
          Orchestrated stage lineage
        </summary>
        <ol className="mt-2 space-y-2">
          {pathway.steps.map((step, index) => (
            <li className="flex items-start gap-2" key={step.id}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  {prettyM41cToken(step.stage)} · {step.title}
                </p>
                <p className="mt-0.5 text-slate-600">
                  {step.stopOnMissingInput
                    ? "Stops on missing input"
                    : "Routes incomplete input"}{" "}
                  · human role:{" "}
                  {step.requiredHumanRoles.map(prettyM41cToken).join(", ")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-teal-100 bg-teal-50 p-2.5 text-teal-950">
          <p className="font-bold">Named human roles</p>
          <p className="mt-1">
            {requiredRoles.map(prettyM41cToken).join(" · ") || "Not returned"}
          </p>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-rose-950">
          <p className="font-bold">Autonomous actions blocked</p>
          <p className="mt-1">
            {blockedActions.map(prettyM41cToken).join(" · ") ||
              "No actions listed"}
          </p>
        </div>
      </div>
    </article>
  );
}

function SafetyBoundary({
  pathway,
  kind,
}: {
  pathway: M41cPathwayDefinition | null;
  kind: "suicide" | "medication";
}) {
  const Icon = kind === "suicide" ? ShieldAlert : HeartPulse;
  const label =
    kind === "suicide"
      ? "Suicide & crisis safety boundary"
      : "Medication & physical-health safety boundary";
  if (!pathway) {
    return (
      <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
        <h3 className="flex items-center gap-2 font-bold">
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </h3>
        <p className="mt-2">
          The governed pathway was not returned. Guidance and execution remain
          unavailable.
        </p>
      </article>
    );
  }

  const stopCount = pathway.steps.filter(
    (step) => step.stopOnMissingInput,
  ).length;
  const roles = [
    ...new Set(pathway.steps.flatMap((step) => step.requiredHumanRoles)),
  ];
  const blockedActions = [
    ...new Set(
      pathway.steps.flatMap((step) => step.prohibitedAutonomousActions),
    ),
  ];
  return (
    <article className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-rose-950">
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </h3>
        <Badge
          className="border-rose-200 bg-white text-rose-800"
          variant="outline"
        >
          Qualified human control
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-rose-900">
        {pathway.title} · {pathway.version}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black text-rose-900">
            {pathway.steps.length}
          </p>
          <p className="text-slate-500">Controlled stages</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black text-rose-900">{stopCount}</p>
          <p className="text-slate-500">Stop rules</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black text-rose-900">{roles.length}</p>
          <p className="text-slate-500">Human roles</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black text-rose-900">
            {blockedActions.length}
          </p>
          <p className="text-slate-500">Blocked actions</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-rose-100 bg-white p-3 text-xs text-slate-700">
        <p className="font-bold text-slate-900">What the assistant cannot do</p>
        <p className="mt-1 leading-5">
          {blockedActions.map(prettyM41cToken).join(" · ")}
        </p>
      </div>
      {pathway.limitations.length ? (
        <ul className="mt-3 space-y-1 text-xs text-rose-900">
          {pathway.limitations.map((limit) => (
            <li key={limit}>• {limit}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function Continuum({ continuum }: { continuum: M41cContinuumEpisodeResult }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
            Synthetic longitudinal episode
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950">
            <Waypoints aria-hidden="true" className="size-4" />
            Youth continuum lineage
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Episode {continuum.episodeId}
          </p>
        </div>
        <Badge
          className="border-teal-200 bg-teal-50 text-teal-800"
          variant="outline"
        >
          {continuum.stagesRepresented.length} stages represented
        </Badge>
      </div>
      <ol
        className="mt-4 flex gap-2 overflow-x-auto pb-2"
        aria-label="Continuum sequence"
      >
        {continuum.events.map((event, index) => (
          <li className="flex min-w-fit items-center gap-2" key={event.id}>
            <div className="min-w-36 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <CircleDot
                  aria-hidden="true"
                  className="size-3 text-teal-700"
                />
                {prettyM41cToken(event.stage)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {formatM41cTimestamp(event.occurredAt)}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                {event.sourceRecordIds.length} source record(s)
              </p>
            </div>
            {index < continuum.events.length - 1 ? (
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 text-slate-400"
              />
            ) : null}
          </li>
        ))}
      </ol>
      {continuum.continuityWarnings.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-bold">Continuity review</p>
          <ul className="mt-1 space-y-1">
            {continuum.continuityWarnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          No continuity warning returned for this deterministic episode.
        </p>
      )}
    </article>
  );
}

function MappingAndMonitoring({
  mapping,
  monitoring,
}: {
  mapping: M41cExperienceSnapshot["mapping"];
  monitoring: M41cClinicalMonitoringResult;
}) {
  const metric = (label: string, value: number) => (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
      key={label}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-black text-slate-950">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Progress
        aria-label={`${label} ${Math.round(value * 100)} percent`}
        className="mt-2 h-1.5"
        value={value * 100}
      />
    </div>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
            <Cable aria-hidden="true" className="size-4" />
            CMBHS / FHIR mapping boundary
          </h3>
          <Badge
            className="border-rose-200 bg-rose-50 text-rose-800"
            variant="outline"
          >
            Writes blocked
          </Badge>
        </div>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">CMBHS mode</dt>
            <dd className="mt-1 text-slate-900">
              {prettyM41cToken(mapping.cmbhsMode)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">Reconciliation</dt>
            <dd className="mt-1 text-slate-900">
              {prettyM41cToken(mapping.cmbhsStatus)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">FHIR-aligned bundle</dt>
            <dd className="mt-1 text-slate-900">
              {mapping.bundleValid ? "Structure valid" : "Review required"}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="font-bold text-slate-500">Conformance claim</dt>
            <dd className="mt-1 font-bold text-rose-800">
              {mapping.conformanceClaimed ? "Claimed" : "Not claimed"}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Braces aria-hidden="true" className="size-3.5" />
            FHIR R4-aligned resource projections
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mapping.resourceTypes.map((resourceType) => (
              <code
                className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700"
                key={resourceType}
              >
                {resourceType}
              </code>
            ))}
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-950">
          <Ban aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          No CMBHS write, external transmission, certification claim, or
          production care update is available.
        </p>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
            <Activity aria-hidden="true" className="size-4" />
            Clinical safety monitoring
          </h3>
          <Badge
            className="border-slate-200 bg-slate-50 text-slate-700"
            variant="outline"
          >
            {monitoring.signals.length} signal(s)
          </Badge>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {metric("Alert precision", monitoring.alertPrecision)}
          {metric("Pathway fidelity", monitoring.pathwayFidelity)}
          {metric(
            "Safety follow-through",
            monitoring.safetyAcknowledgementRate,
          )}
          {metric("Override review", monitoring.overrideReviewRate)}
        </div>
        <div className="mt-3 space-y-2">
          {monitoring.signals.map((signal) => (
            <div
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
              key={signal.id}
            >
              <AlertOctagon
                aria-hidden="true"
                className={`mt-0.5 size-3.5 shrink-0 ${signal.severity === "urgent" ? "text-rose-700" : signal.severity === "review" ? "text-amber-700" : "text-teal-700"}`}
              />
              <div>
                <p className="font-bold text-slate-900">
                  {prettyM41cToken(signal.kind)} ·{" "}
                  {prettyM41cToken(signal.severity)}
                </p>
                <p className="mt-0.5 text-slate-600">{signal.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export function M41cPathwaySafetyPanel({
  continuum,
  mapping,
  monitoring,
  pathways,
  youthPathwayPacks,
}: {
  continuum: M41cContinuumEpisodeResult;
  mapping: M41cExperienceSnapshot["mapping"];
  monitoring: M41cClinicalMonitoringResult;
  pathways: readonly M41cPathwayDefinition[];
  youthPathwayPacks: readonly M41cYouthPathwayPack[];
}) {
  const suicidePathway =
    pathways.find((pathway) => pathway.domain === "suicide_crisis") ?? null;
  const medicationPathway =
    pathways.find(
      (pathway) => pathway.domain === "medication_physical_health",
    ) ?? null;
  return (
    <section aria-labelledby="m41c-pathways-title" id="pathways">
      <Card className="border-slate-200 bg-slate-50/70">
        <CardHeader className="border-b bg-white">
          <CardTitle
            className="flex items-center gap-2 text-lg"
            id="m41c-pathways-title"
          >
            <Route aria-hidden="true" className="size-5 text-teal-700" />
            Pathway orchestration &amp; continuum intelligence
          </CardTitle>
          <CardDescription className="mt-2 max-w-3xl leading-5">
            The fabric links assessment metadata, formulation, goals,
            interventions, outcomes, transition, and aftercare while preserving
            stop rules and named human decisions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-4 pb-5 pt-5 md:px-6">
          <Continuum continuum={continuum} />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                <Network aria-hidden="true" className="size-4" />
                Governed pathway catalog
              </h3>
              <Badge
                className="border-slate-200 bg-white text-slate-700"
                variant="outline"
              >
                {pathways.length} pathways · {youthPathwayPacks.length} youth
                packs
              </Badge>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {pathways.map((pathway) => (
                <PathwayCard key={pathway.id} pathway={pathway} />
              ))}
            </div>
          </div>

          <div id="safety">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-rose-800">
              <Stethoscope aria-hidden="true" className="size-4" />
              Non-negotiable safety boundaries
            </h3>
            <div className="mt-3 grid gap-4 xl:grid-cols-2">
              <SafetyBoundary kind="suicide" pathway={suicidePathway} />
              <SafetyBoundary kind="medication" pathway={medicationPathway} />
            </div>
          </div>

          <MappingAndMonitoring mapping={mapping} monitoring={monitoring} />
        </CardContent>
      </Card>
    </section>
  );
}
