import {
  M41B_CADENCES,
  type M41bGovernedSource,
  type M41bWorkplan,
  type M41bWorkplanItem,
} from "@contracts/m41b";
import {
  CalendarCheck2,
  CheckSquare2,
  CircleDotDashed,
  Clock3,
  FileCheck2,
  FilePlus2,
  GitBranch,
  Link2,
  ListChecks,
  Loader2,
  Route,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatTimestamp,
  prettyToken,
  resolveItemSources,
} from "./m41b-experience-model";
import { M41bGovernanceBadge } from "./m41b-governance-badge";
import {
  M41bGovernedSourceCard,
  M41bNoSourcesNotice,
  M41bSourceTransparencyLegend,
  M41bUnresolvedSources,
} from "./m41b-source-transparency";

function IdentifierList({
  label,
  values,
  emptyLabel,
}: {
  label: string;
  values: readonly string[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      {values.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {values.map((value) => (
            <li
              className="break-all rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-700"
              key={value}
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

export function M41bWorkplanItemCard({
  item,
  sources,
  selected,
  onSelect,
  onAddEvidence,
  onCompleteTask,
  onEscalateTask,
  isMutating,
}: {
  item: M41bWorkplanItem;
  sources: readonly M41bGovernedSource[];
  selected: boolean;
  onSelect: (itemId: string) => void;
  onAddEvidence?: (taskId: string, summary: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onEscalateTask?: (taskId: string) => void;
  isMutating?: boolean;
}) {
  const sourceResolution = resolveItemSources(item, sources);
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const canAddEvidence =
    Boolean(item.recommendationId) &&
    ["approved", "in_progress", "evidence_pending", "escalated"].includes(
      item.status,
    );
  const canComplete =
    item.status === "evidence_pending" && item.completionEvidenceIds.length > 0;
  const canEscalate = !["completed", "refused"].includes(item.status);
  const submitEvidence = (event: FormEvent) => {
    event.preventDefault();
    const summary = evidenceSummary.trim();
    if (summary.length < 8 || !onAddEvidence || isMutating) return;
    onAddEvidence(item.id, summary);
    setEvidenceSummary("");
  };

  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-4 transition-shadow",
        selected
          ? "border-teal-400 shadow-md ring-2 ring-teal-100"
          : "border-slate-200 shadow-sm",
      )}
      data-workplan-item={item.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <M41bGovernanceBadge
              value={item.priority}
              label={`${prettyToken(item.priority)} priority`}
            />
            <M41bGovernanceBadge value={item.status} />
            <Badge className="text-[10px]" variant="outline">
              {prettyToken(item.materialDomain)}
            </Badge>
          </div>
          <h4 className="mt-2 text-base font-bold leading-6 text-slate-950">
            {item.title}
          </h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {item.objective}
          </p>
        </div>
        <Button
          aria-pressed={selected}
          className={cn(selected && "bg-teal-700 text-white hover:bg-teal-800")}
          onClick={() => onSelect(item.id)}
          size="sm"
          type="button"
          variant={selected ? "default" : "outline"}
        >
          <Sparkles aria-hidden="true" className="size-3.5" />
          {selected ? "Ask context selected" : "Use with Ask AMOS"}
        </Button>
      </div>

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
            <UserRoundCheck aria-hidden="true" className="size-3.5" />
            Accountable owner
          </dt>
          <dd className="mt-1 font-bold text-slate-900">
            {prettyToken(item.ownerRole)}
          </dd>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
            {item.ownerId}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Due
          </dt>
          <dd className="mt-1 font-bold text-slate-900">
            {formatTimestamp(item.dueAt)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
            <GitBranch aria-hidden="true" className="size-3.5" />
            Workflow
          </dt>
          <dd className="mt-1 break-all font-mono text-[10px] font-semibold text-slate-800">
            {item.workflowKey}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
            <Link2 aria-hidden="true" className="size-3.5" />
            Recommendation
          </dt>
          <dd className="mt-1 break-all font-mono text-[10px] font-semibold text-slate-800">
            {item.recommendationId ?? "Not linked"}
          </dd>
        </div>
      </dl>

      <div
        className={cn(
          "mt-3 rounded-xl border p-3",
          item.humanApprovalRequired
            ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-slate-50",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <ShieldCheck
                aria-hidden="true"
                className={cn(
                  "size-4",
                  item.humanApprovalRequired
                    ? "text-amber-700"
                    : "text-slate-500",
                )}
              />
              Human approval{" "}
              {item.humanApprovalRequired ? "required" : "not required by task"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {item.humanApprovalRequired
                ? "AMOS may explain or prepare the action, but the accountable human disposition remains controlling."
                : "This returned task does not carry a human-gate requirement; delegated authority still controls execution."}
            </p>
          </div>
          <Badge className="font-mono text-[10px]" variant="outline">
            {item.approvalId ?? "No decision ID"}
          </Badge>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-teal-950">
              Governed task controls
            </p>
            <p className="mt-1 text-[11px] text-teal-800">
              Escalation, evidence, and closure are persisted by the server; no
              client action silently changes status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canEscalate || !onEscalateTask || isMutating}
              onClick={() => onEscalateTask?.(item.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              {isMutating ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Route aria-hidden="true" className="size-3.5" />
              )}
              Escalate
            </Button>
            <Button
              disabled={!canComplete || !onCompleteTask || isMutating}
              onClick={() => onCompleteTask?.(item.id)}
              size="sm"
              type="button"
            >
              {isMutating ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <CheckSquare2 aria-hidden="true" className="size-3.5" />
              )}
              Complete with evidence
            </Button>
          </div>
        </div>
        {canAddEvidence ? (
          <form className="mt-3 space-y-2" onSubmit={submitEvidence}>
            <Label htmlFor={`m41b-evidence-${item.id}`}>
              Synthetic completion evidence summary
            </Label>
            <Textarea
              id={`m41b-evidence-${item.id}`}
              onChange={(event) => setEvidenceSummary(event.target.value)}
              placeholder="Describe the synthetic evaluation evidence only; do not enter real client or workforce data."
              value={evidenceSummary}
            />
            <Button
              disabled={
                evidenceSummary.trim().length < 8 ||
                !onAddEvidence ||
                isMutating
              }
              size="sm"
              type="submit"
              variant="outline"
            >
              {isMutating ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <FilePlus2 aria-hidden="true" className="size-3.5" />
              )}
              Add synthetic evidence
            </Button>
          </form>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <IdentifierList
          emptyLabel="No dependency references returned."
          label="Dependencies"
          values={item.dependencyIds}
        />
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            <ListChecks aria-hidden="true" className="size-3.5" />
            Evidence requirements
          </p>
          {item.evidenceRequirements.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
              {item.evidenceRequirements.map((requirement) => (
                <li className="flex items-start gap-1.5" key={requirement}>
                  <CircleDotDashed
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-teal-700"
                  />
                  {requirement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-rose-700">
              No evidence requirements returned; silent closure is not inferred.
            </p>
          )}
        </div>
        <IdentifierList
          emptyLabel="No completion evidence recorded."
          label="Completion evidence IDs"
          values={item.completionEvidenceIds}
        />
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <summary className="cursor-pointer text-xs font-bold text-slate-800">
          Inspect governed sources ({item.sourceIds.length})
        </summary>
        <div className="mt-3 space-y-3">
          <M41bSourceTransparencyLegend />
          {item.sourceIds.length === 0 ? <M41bNoSourcesNotice /> : null}
          {sourceResolution.resolved.map((source) => (
            <M41bGovernedSourceCard key={source.id} source={source} />
          ))}
          <M41bUnresolvedSources sourceIds={sourceResolution.unresolvedIds} />
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[10px] text-slate-500">
        <span className="break-all font-mono">Task {item.id}</span>
        <span className="break-all font-mono">
          Natural key {item.naturalKey}
        </span>
        <span>
          Closed{" "}
          {item.closedAt ? formatTimestamp(item.closedAt) : "not recorded"}
        </span>
      </div>
    </article>
  );
}

export function M41bWorkplanPanel({
  workplan,
  sources,
  selectedItemId,
  onSelectItem,
  onAddEvidence,
  onCompleteTask,
  onEscalateTask,
  mutatingTaskId,
}: {
  workplan: M41bWorkplan;
  sources: readonly M41bGovernedSource[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onAddEvidence?: (taskId: string, summary: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onEscalateTask?: (taskId: string) => void;
  mutatingTaskId?: string | null;
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2
                aria-hidden="true"
                className="size-5 text-teal-700"
              />
              Authoritative five-cadence workplan
            </CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">
              Every brief and returned workplan item remains visible,
              source-linked, owned, dated, and evidence-aware.
            </CardDescription>
          </div>
          <Badge
            className="border-teal-200 bg-teal-50 text-teal-900"
            variant="outline"
          >
            Generated {formatTimestamp(workplan.generatedAt)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-5">
        <nav
          aria-label="Workplan cadence briefs"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
        >
          {M41B_CADENCES.map((cadence) => {
            const brief = workplan.briefs[cadence];
            return (
              <a
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:border-teal-300 hover:bg-teal-50"
                href={`#m41b-${cadence}-brief`}
                key={cadence}
              >
                <span className="block text-xs font-bold text-slate-900">
                  {prettyToken(cadence)}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {brief.items.length} item{brief.items.length === 1 ? "" : "s"}
                </span>
              </a>
            );
          })}
        </nav>

        {M41B_CADENCES.map((cadence, index) => {
          const brief = workplan.briefs[cadence];
          return (
            <section
              aria-labelledby={`m41b-${cadence}-heading`}
              className="scroll-mt-28 space-y-3"
              id={`m41b-${cadence}-brief`}
              key={cadence}
            >
              <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
                      Cadence {index + 1} of {M41B_CADENCES.length}
                    </p>
                    <h3
                      className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950"
                      id={`m41b-${cadence}-heading`}
                    >
                      <CheckSquare2
                        aria-hidden="true"
                        className="size-4 text-teal-700"
                      />
                      {brief.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {brief.purpose}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.sourceStates.map((state) => (
                      <M41bGovernanceBadge key={state} value={state} />
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500">
                  <span>Generated {formatTimestamp(brief.generatedAt)}</span>
                  <span>
                    {brief.items.length} governed item
                    {brief.items.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    {brief.limitations.length} limitation
                    {brief.limitations.length === 1 ? "" : "s"}
                  </span>
                </div>
                {brief.limitations.length > 0 ? (
                  <ul className="mt-3 grid gap-1 text-[11px] text-amber-900 sm:grid-cols-2">
                    {brief.limitations.map((limitation) => (
                      <li className="flex items-start gap-1.5" key={limitation}>
                        <FileCheck2
                          aria-hidden="true"
                          className="mt-0.5 size-3.5 shrink-0"
                        />
                        {limitation}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {brief.items.length > 0 ? (
                <div className="space-y-3">
                  {brief.items.map((item) => (
                    <M41bWorkplanItemCard
                      isMutating={mutatingTaskId === item.id}
                      item={item}
                      key={item.id}
                      onAddEvidence={onAddEvidence}
                      onCompleteTask={onCompleteTask}
                      onEscalateTask={onEscalateTask}
                      onSelect={onSelectItem}
                      selected={selectedItemId === item.id}
                      sources={sources}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No governed workplan items returned for this cadence
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    The experience does not fabricate a placeholder commitment.
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
