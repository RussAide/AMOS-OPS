import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileArchive,
  FileSearch,
  GitCommitHorizontal,
  History,
  Link2,
  MessageSquareText,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { M41bLineage } from "./m41b-experience-model";
import { formatTimestamp, prettyToken } from "./m41b-experience-model";
import { M41bGovernanceBadge } from "./m41b-governance-badge";

function LineageStage({
  icon: Icon,
  label,
  state,
  children,
}: {
  icon: typeof Bot;
  label: string;
  state: "recorded" | "pending" | "missing";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-3",
        state === "recorded" && "border-teal-200 bg-teal-50/50",
        state === "pending" && "border-amber-200 bg-amber-50/60",
        state === "missing" && "border-rose-200 bg-rose-50/60",
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3.5",
            state === "recorded" && "text-teal-700",
            state === "pending" && "text-amber-700",
            state === "missing" && "text-rose-700",
          )}
        />
        {label}
      </p>
      <div className="mt-2 text-xs text-slate-800">{children}</div>
    </div>
  );
}

function AuditTrail({ lineage }: { lineage: M41bLineage }) {
  if (lineage.auditEvents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
        No matching audit events were supplied for this lineage.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {lineage.auditEvents.map((event) => (
        <li
          className="rounded-lg border border-slate-200 bg-white p-2.5"
          key={event.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <GitCommitHorizontal
                aria-hidden="true"
                className="size-3.5 text-teal-700"
              />
              {prettyToken(event.eventType)}
            </span>
            <span className="text-[10px] text-slate-500">
              {formatTimestamp(event.occurredAt)}
            </span>
          </div>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
            {event.id} · correlation {event.correlationId}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">
            {prettyToken(event.actorRole)} · {prettyToken(event.entityType)}{" "}
            {event.entityId}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function M41bLineageCard({ lineage }: { lineage: M41bLineage }) {
  const task = lineage.task;
  const decision = lineage.decision;
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
            Recommendation lineage
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-950">
            {lineage.recommendation.summary}
          </h3>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
            {lineage.recommendation.id}
          </p>
        </div>
        <M41bGovernanceBadge value={lineage.recommendation.status} />
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-6">
        <LineageStage icon={MessageSquareText} label="Prompt" state="recorded">
          <p className="font-semibold">
            {lineage.request?.prompt ?? "Request content unavailable"}
          </p>
          {lineage.request ? (
            <p className="mt-1 text-[10px] text-slate-600">
              {prettyToken(lineage.request.intent)} ·{" "}
              {prettyToken(lineage.request.roleContext.role)} ·{" "}
              {prettyToken(lineage.request.roleContext.division)} ·{" "}
              {lineage.request.roleContext.tier} ·{" "}
              {formatTimestamp(lineage.request.createdAt)}
            </p>
          ) : null}
          <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
            {lineage.recommendation.requestId}
          </p>
          {lineage.guidance ? (
            <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
              Response {lineage.guidance.responseId}
            </p>
          ) : (
            <p className="mt-1 text-amber-800">Response record not supplied</p>
          )}
        </LineageStage>

        <LineageStage
          icon={FileSearch}
          label="Sources"
          state={
            lineage.unresolvedSourceIds.length > 0 ? "missing" : "recorded"
          }
        >
          {lineage.sources.length > 0 ? (
            <ul className="space-y-1">
              {lineage.sources.map((source) => (
                <li key={source.id}>
                  <span className="font-semibold">{source.title}</span>
                  <span className="block font-mono text-[10px] text-slate-500">
                    {source.id} · v{source.version}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-rose-800">No resolved sources supplied</p>
          )}
          {lineage.unresolvedSourceIds.map((sourceId) => (
            <p
              className="mt-1 break-all font-mono text-[10px] text-rose-800"
              key={sourceId}
            >
              Missing {sourceId}
            </p>
          ))}
        </LineageStage>

        <LineageStage icon={Bot} label="Recommendation" state="recorded">
          <p className="font-semibold">
            {prettyToken(lineage.recommendation.materialDomain)}
          </p>
          <p className="mt-1">
            Created by {prettyToken(lineage.recommendation.createdByRole)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {formatTimestamp(lineage.recommendation.createdAt)}
          </p>
        </LineageStage>

        <LineageStage
          icon={UserCheck}
          label="Human disposition"
          state={decision ? "recorded" : "pending"}
        >
          {decision ? (
            <>
              <p className="font-semibold">
                {prettyToken(decision.disposition)}
              </p>
              <p className="mt-1 leading-5">{decision.rationale}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {prettyToken(decision.decidedByRole)} ·{" "}
                {formatTimestamp(decision.decidedAt)}
              </p>
              {decision.overrideReason ? (
                <p className="mt-1 text-rose-800">
                  Override: {decision.overrideReason}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-amber-800">
              Accountable human decision not recorded
            </p>
          )}
        </LineageStage>

        <LineageStage
          icon={ClipboardCheck}
          label="Owned task"
          state={task ? "recorded" : "pending"}
        >
          {task ? (
            <>
              <p className="font-semibold">{task.title}</p>
              <p className="mt-1">
                {prettyToken(task.ownerRole)} · {prettyToken(task.status)}
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
                {task.id}
              </p>
            </>
          ) : (
            <p className="text-amber-800">Downstream task not recorded</p>
          )}
        </LineageStage>

        <LineageStage
          icon={FileArchive}
          label="Completion evidence"
          state={lineage.evidence.length > 0 ? "recorded" : "pending"}
        >
          {lineage.evidence.length > 0 ? (
            <ul className="space-y-1.5">
              {lineage.evidence.map((evidence) => (
                <li key={evidence.id}>
                  <p className="font-semibold">{evidence.summary}</p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
                    {evidence.id} · {evidence.evidenceRef}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-amber-800">
              Completion evidence not recorded; silent closure is not assumed
            </p>
          )}
        </LineageStage>
      </div>

      {lineage.integrityNotes.length > 0 ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
            <ShieldAlert aria-hidden="true" className="size-4" />
            Lineage integrity review required
          </p>
          <ul className="mt-2 space-y-1 text-xs text-rose-800">
            {lineage.integrityNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Supplied lineage references are internally consistent.
        </div>
      )}

      <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-800">
          <History aria-hidden="true" className="size-4 text-teal-700" />
          Prompt-to-evidence audit events ({lineage.auditEvents.length})
        </summary>
        <div className="mt-3">
          <AuditTrail lineage={lineage} />
        </div>
      </details>
    </article>
  );
}

export function M41bLineagePanel({
  lineages,
}: {
  lineages: readonly M41bLineage[];
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 aria-hidden="true" className="size-5 text-teal-700" />
              Recommendation-to-evidence lineage
            </CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">
              Prompt, retrieved sources, guidance, human disposition, owned
              task, completion evidence, and audit correlation remain
              inspectable.
            </CardDescription>
          </div>
          <Badge variant="outline">
            {lineages.length} recommendation{lineages.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {lineages.length > 0 ? (
          lineages.map((lineage) => (
            <M41bLineageCard
              key={lineage.recommendation.id}
              lineage={lineage}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <FileArchive
              aria-hidden="true"
              className="mx-auto size-7 text-slate-400"
            />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              No recommendation lineage returned
            </p>
            <p className="mt-1 text-xs text-slate-500">
              No task, disposition, evidence, or audit relationship is inferred.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
