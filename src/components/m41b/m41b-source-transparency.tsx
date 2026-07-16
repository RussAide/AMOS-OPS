import type { M41bGovernedSource, M41bSourceCitation } from "@contracts/m41b";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  Database,
  FileWarning,
  ShieldQuestion,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatConfidence,
  formatTimestamp,
  prettyToken,
} from "./m41b-experience-model";
import { M41bGovernanceBadge } from "./m41b-governance-badge";

function ListField({
  label,
  values,
  emptyLabel,
  warning = false,
}: {
  label: string;
  values: readonly string[];
  emptyLabel: string;
  warning?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
        {label}
      </p>
      {values.length > 0 ? (
        <ul
          className={
            warning
              ? "mt-1.5 space-y-1 text-xs text-rose-800"
              : "mt-1.5 space-y-1 text-xs text-slate-700"
          }
        >
          {values.map((value) => (
            <li className="flex items-start gap-1.5" key={value}>
              <span
                aria-hidden="true"
                className="mt-1.5 size-1 shrink-0 rounded-full bg-current"
              />
              <span className="break-words">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function SourceMetadataGrid({
  owner,
  effectiveAt,
  refreshedAt,
  confidence,
}: {
  owner: string;
  effectiveAt: string;
  refreshedAt: string | null;
  confidence: number | null;
}) {
  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg bg-slate-50 p-2.5">
        <dt className="font-semibold text-slate-500">Owner</dt>
        <dd className="mt-0.5 font-medium text-slate-900">
          {prettyToken(owner)}
        </dd>
      </div>
      <div className="rounded-lg bg-slate-50 p-2.5">
        <dt className="font-semibold text-slate-500">Effective</dt>
        <dd className="mt-0.5 font-medium text-slate-900">
          {formatTimestamp(effectiveAt)}
        </dd>
      </div>
      <div className="rounded-lg bg-slate-50 p-2.5">
        <dt className="font-semibold text-slate-500">Freshness / refreshed</dt>
        <dd className="mt-0.5 font-medium text-slate-900">
          {formatTimestamp(refreshedAt)}
        </dd>
      </div>
      <div className="rounded-lg bg-slate-50 p-2.5">
        <dt className="font-semibold text-slate-500">Confidence</dt>
        <dd className="mt-0.5 font-medium text-slate-900">
          {formatConfidence(confidence)}
        </dd>
      </div>
    </dl>
  );
}

export function M41bGovernedSourceCard({
  source,
}: {
  source: M41bGovernedSource;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
            <Database aria-hidden="true" className="size-3.5" />
            {source.sourceSystem}
          </p>
          <h4 className="mt-1 text-sm font-bold text-slate-950">
            {source.title}
          </h4>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
            {source.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <M41bGovernanceBadge value={source.state} />
          <Badge className="text-[10px]" variant="outline">
            Version {source.version}
          </Badge>
        </div>
      </div>

      <div className="mt-3">
        <SourceMetadataGrid
          confidence={source.confidence}
          effectiveAt={source.effectiveAt}
          owner={source.ownerRole}
          refreshedAt={source.refreshedAt}
        />
      </div>

      <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-3">
        <ListField
          emptyLabel="No additional limits returned."
          label="Applicable limits"
          values={source.applicableLimits}
        />
        <ListField
          emptyLabel="No missing evidence reported."
          label="Missing evidence"
          values={source.missingEvidence}
          warning
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
            Uncertainty
          </p>
          <p className="mt-1.5 text-xs leading-5 text-slate-700">
            {source.uncertainty ?? "No uncertainty statement returned."}
          </p>
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700">
          Source governance and record references
        </summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="font-semibold text-slate-500">Type</dt>
            <dd>{prettyToken(source.sourceType)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Domain</dt>
            <dd>{prettyToken(source.materialDomain)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Sensitivity</dt>
            <dd>{prettyToken(source.sensitivity)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Minimum tier</dt>
            <dd>{source.minimumTier}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Reviewed</dt>
            <dd>{formatTimestamp(source.reviewedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Expires</dt>
            <dd>{formatTimestamp(source.expiresAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Divisions</dt>
            <dd>{source.divisions.map(prettyToken).join(", ")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Cadences</dt>
            <dd>{source.cadences.map(prettyToken).join(", ")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Record IDs</dt>
            <dd className="break-all font-mono text-[10px]">
              {source.recordIds.length > 0
                ? source.recordIds.join(", ")
                : "No record IDs returned"}
            </dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

export function M41bCitationCard({
  citation,
}: {
  citation: M41bSourceCitation;
}) {
  return (
    <article className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-950">{citation.title}</p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
            {citation.sourceId}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <M41bGovernanceBadge value={citation.state} />
          <Badge className="text-[10px]" variant="outline">
            Version {citation.version}
          </Badge>
        </div>
      </div>
      <div className="mt-2">
        <SourceMetadataGrid
          confidence={citation.confidence}
          effectiveAt={citation.effectiveAt}
          owner={citation.ownerRole}
          refreshedAt={citation.refreshedAt}
        />
      </div>
      <div className="mt-2 grid gap-2 border-t border-teal-200 pt-2 md:grid-cols-3">
        <ListField
          emptyLabel="No additional limits returned."
          label="Limits"
          values={citation.applicableLimits}
        />
        <ListField
          emptyLabel="No missing evidence reported."
          label="Missing evidence"
          values={citation.missingEvidence}
          warning
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
            Uncertainty
          </p>
          <p className="mt-1.5 text-xs text-slate-700">
            {citation.uncertainty ?? "No uncertainty statement returned."}
          </p>
        </div>
      </div>
    </article>
  );
}

export function M41bUnresolvedSources({
  sourceIds,
}: {
  sourceIds: readonly string[];
}) {
  if (sourceIds.length === 0) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-900">
      <p className="flex items-center gap-2 text-xs font-bold">
        <FileWarning aria-hidden="true" className="size-4" />
        Source metadata unavailable — do not infer guidance
      </p>
      <p className="mt-1 text-[11px] leading-5 text-rose-800">
        The following governed references were returned by the task but were not
        present in the supplied source register.
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[10px]">
        {sourceIds.map((sourceId) => (
          <li className="break-all" key={sourceId}>
            {sourceId}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function M41bSourceTransparencyLegend() {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 sm:grid-cols-3">
      <span className="flex items-center gap-1.5">
        <CalendarClock aria-hidden="true" className="size-3.5 text-teal-700" />
        Freshness is source-reported, never inferred.
      </span>
      <span className="flex items-center gap-1.5">
        <ShieldQuestion aria-hidden="true" className="size-3.5 text-teal-700" />
        Confidence does not replace human approval.
      </span>
      <span className="flex items-center gap-1.5">
        <BookOpenCheck aria-hidden="true" className="size-3.5 text-teal-700" />
        Record IDs preserve audit traceability.
      </span>
    </div>
  );
}

export function M41bNoSourcesNotice() {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle aria-hidden="true" className="size-4" />
        No governed source references returned
      </p>
      <p className="mt-1 leading-5">
        Source transparency and material guidance cannot be inferred from an
        empty source set.
      </p>
    </div>
  );
}
