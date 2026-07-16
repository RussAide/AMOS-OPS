import type {
  M41cClinicalKnowledgeEntry,
  M41cClinicalKnowledgeRegistryExport,
  M41cClinicalSource,
} from "@contracts/m41c";
import {
  BookOpenCheck,
  CalendarClock,
  CircleAlert,
  ExternalLink,
  Fingerprint,
  LibraryBig,
  Link2,
  ShieldQuestion,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  activationPresentation,
  formatM41cTimestamp,
  prettyM41cToken,
} from "./m41c-experience-model";

function sourceStateClass(state: M41cClinicalSource["state"]): string {
  if (state === "current")
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "stale") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function SourceCard({ source }: { source: M41cClinicalSource }) {
  const missingCount = source.missingEvidence.length;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {prettyM41cToken(source.sourceType)}
          </p>
          <h3 className="mt-1 text-sm font-bold leading-5 text-slate-950">
            {source.title}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {source.publisher} · {source.version}
          </p>
        </div>
        <Badge className={sourceStateClass(source.state)} variant="outline">
          {prettyM41cToken(source.state)}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="font-bold text-slate-500">License state</dt>
          <dd className="mt-0.5 text-slate-900">
            {prettyM41cToken(source.licenseState)}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="font-bold text-slate-500">Evidence grade</dt>
          <dd className="mt-0.5 text-slate-900">
            {prettyM41cToken(source.evidenceGrade)}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="font-bold text-slate-500">Effective</dt>
          <dd className="mt-0.5 text-slate-900">
            {formatM41cTimestamp(source.effectiveAt)}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="font-bold text-slate-500">Review due</dt>
          <dd className="mt-0.5 text-slate-900">
            {formatM41cTimestamp(source.reviewDueAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
          <Fingerprint aria-hidden="true" className="size-3" />
          Content{" "}
          {source.contentBinding.contentAvailable ? "bound" : "not bound"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
          <ShieldQuestion aria-hidden="true" className="size-3" />
          Proprietary content stored: no
        </span>
        {source.canonicalUrl ? (
          <a
            className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-1 font-bold text-teal-800 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            href={source.canonicalUrl}
            rel="noreferrer"
            target="_blank"
          >
            Official source
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        ) : null}
      </div>

      {(source.limitations.length > 0 || missingCount > 0) && (
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-bold text-slate-800">
            Limits and missing evidence (
            {source.limitations.length + missingCount})
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-bold text-slate-600">Applicable limits</p>
              <ul className="mt-1 space-y-1 text-slate-700">
                {source.limitations.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-600">Missing evidence</p>
              {missingCount ? (
                <ul className="mt-1 space-y-1 text-amber-900">
                  {source.missingEvidence.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-emerald-800">None reported.</p>
              )}
            </div>
          </div>
        </details>
      )}
    </article>
  );
}

function EntryRow({ entry }: { entry: M41cClinicalKnowledgeEntry }) {
  const activation = activationPresentation(entry.activationState);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {prettyM41cToken(entry.kind)} · {entry.version}
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-950">
            {entry.title}
          </h3>
        </div>
        <Badge className={activation.className} variant="outline">
          {activation.label}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 text-xs md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="font-bold text-slate-600">Decision boundary</p>
          <p className="mt-1 leading-5 text-slate-800">
            {entry.decisionLogic.scoringOrDecisionSummary}
          </p>
          <p className="mt-2 font-semibold text-rose-800">
            Production execution: unavailable · Human review: required
          </p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-bold text-slate-600">
            <Link2 aria-hidden="true" className="size-3.5" />
            Source lineage
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entry.sourceIds.map((sourceId) => (
              <code
                className="rounded bg-slate-100 px-1.5 py-1 text-[10px] text-slate-700"
                key={sourceId}
              >
                {sourceId}
              </code>
            ))}
          </div>
          <p className="text-slate-600">
            {entry.demoTestIds.length} deterministic test reference(s) ·{" "}
            {entry.workplanEvents.length} cadence binding(s)
          </p>
        </div>
      </div>
    </div>
  );
}

export function M41cSourceRegistryPanel({
  registry,
}: {
  registry: M41cClinicalKnowledgeRegistryExport;
}) {
  const currentCount = registry.sources.filter(
    (source) => source.state === "current",
  ).length;
  const missingCount = registry.sources.reduce(
    (count, source) => count + source.missingEvidence.length,
    0,
  );
  const eligibleEntries = registry.validations.filter(
    (validation) => validation.eligibleForSyntheticDemo,
  ).length;

  return (
    <section aria-labelledby="m41c-source-registry-title" id="sources">
      <Card className="overflow-hidden border-slate-200 bg-slate-50/70">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle
                className="flex items-center gap-2 text-lg"
                id="m41c-source-registry-title"
              >
                <LibraryBig
                  aria-hidden="true"
                  className="size-5 text-teal-700"
                />
                Source-transparent clinical knowledge registry
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl leading-5">
                Every knowledge entry exposes authority, version, freshness,
                license state, limitations, missing evidence, and its human
                gate. Instrument wording and scoring content are deliberately
                absent.
              </CardDescription>
            </div>
            <Badge
              className="border-slate-300 bg-white text-slate-700"
              variant="outline"
            >
              Registry {registry.registryVersion}
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-lg border bg-slate-50 p-2">
              <dt className="text-[10px] font-bold uppercase text-slate-500">
                Sources
              </dt>
              <dd className="text-lg font-black text-slate-950">
                {registry.sourceCount}
              </dd>
            </div>
            <div className="rounded-lg border bg-slate-50 p-2">
              <dt className="text-[10px] font-bold uppercase text-slate-500">
                Current
              </dt>
              <dd className="text-lg font-black text-emerald-700">
                {currentCount}
              </dd>
            </div>
            <div className="rounded-lg border bg-slate-50 p-2">
              <dt className="text-[10px] font-bold uppercase text-slate-500">
                Demo eligible
              </dt>
              <dd className="text-lg font-black text-teal-700">
                {eligibleEntries}
              </dd>
            </div>
            <div className="rounded-lg border bg-slate-50 p-2">
              <dt className="text-[10px] font-bold uppercase text-slate-500">
                Missing evidence
              </dt>
              <dd className="text-lg font-black text-amber-800">
                {missingCount}
              </dd>
            </div>
          </dl>
        </CardHeader>
        <CardContent className="space-y-6 px-4 pb-5 pt-5 md:px-6">
          {missingCount > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>
                Missing authority evidence stays visible and keeps affected
                knowledge in validation-pending or quarantine state.
              </p>
            </div>
          ) : null}

          <div>
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
              <BookOpenCheck aria-hidden="true" className="size-4" />
              Governed sources
            </h3>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {registry.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                <CalendarClock aria-hidden="true" className="size-4" />
                Knowledge activation register
              </h3>
              <span className="text-xs text-slate-500">
                Generated {formatM41cTimestamp(registry.generatedAt)}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {registry.entries.map((entry) => (
                <EntryRow entry={entry} key={entry.entryId} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
