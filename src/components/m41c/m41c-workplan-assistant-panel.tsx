import type {
  M41cClinicalGuidanceResponse,
  M41cClinicalWorkplan,
  M41cClinicalWorkplanItem,
  M41cCompetencyRegistry,
} from "@contracts/m41c";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileWarning,
  GraduationCap,
  Link2,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  M41C_CADENCES,
  M41C_GUIDANCE_INTENTS,
  allClinicalWorkplanItems,
  formatM41cTimestamp,
  prettyM41cToken,
  type M41cGuidanceSubmission,
} from "./m41c-experience-model";

function workplanStatusClass(
  status: M41cClinicalWorkplanItem["status"],
): string {
  if (status === "ready_human_review")
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "blocked_source_validation")
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "operational_route_only")
    return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function CadenceCard({
  item,
  onSelect,
  selected,
}: {
  item: M41cClinicalWorkplanItem;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
        selected
          ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
          : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
            {prettyM41cToken(item.cadence)} workplan
          </p>
          <h3 className="mt-1 text-sm font-bold leading-5 text-slate-950">
            {item.title}
          </h3>
        </div>
        <Badge className={workplanStatusClass(item.status)} variant="outline">
          {prettyM41cToken(item.status)}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{item.purpose}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-1">
          Due {formatM41cTimestamp(item.dueAt)}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {prettyM41cToken(item.accessMode)}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1">
          {item.sourceIds.length} source(s)
        </span>
      </div>
      {item.missingEvidence.length ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] leading-4 text-amber-950">
          <FileWarning aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {item.missingEvidence.length} evidence condition(s) keep this work
          controlled.
        </p>
      ) : null}
    </button>
  );
}

function GuidanceResponse({
  response,
}: {
  response: M41cClinicalGuidanceResponse;
}) {
  return (
    <div className="mt-4 space-y-3" aria-live="polite">
      <div
        className={`rounded-xl border p-4 ${
          response.refused
            ? "border-amber-200 bg-amber-50"
            : "border-teal-200 bg-teal-50"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-950">
            {response.refused ? (
              <CircleAlert
                aria-hidden="true"
                className="size-4 text-amber-700"
              />
            ) : (
              <Bot aria-hidden="true" className="size-4 text-teal-700" />
            )}
            {response.refused
              ? "Governed refusal"
              : "Sourced clinical guidance"}
          </p>
          <Badge
            className="border-rose-200 bg-white text-rose-800"
            variant="outline"
          >
            <LockKeyhole aria-hidden="true" className="mr-1 size-3" />
            Production blocked
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-900">
          {response.answer}
        </p>
        {response.refusalCode ? (
          <code className="mt-2 inline-block rounded bg-white px-2 py-1 text-[10px] text-amber-900">
            {response.refusalCode}
          </code>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <p className="font-bold text-slate-900">Controlled next steps</p>
          <ol className="mt-2 space-y-2 text-slate-700">
            {response.nextSteps.map((step, index) => (
              <li className="flex items-start gap-2" key={step}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <p className="flex items-center gap-1.5 font-bold text-slate-900">
            <UserRoundCheck aria-hidden="true" className="size-3.5" />
            Named human gate
          </p>
          <p className="mt-2 text-slate-700">
            Status: {prettyM41cToken(response.humanGate.status)}
          </p>
          <p className="mt-1 text-slate-700">
            Accountable:{" "}
            {response.humanGate.accountableRoles
              .map(prettyM41cToken)
              .join(" · ")}
          </p>
          <p className="mt-1 text-slate-700">Qualified role required: yes</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <p className="flex items-center gap-1.5 font-bold text-slate-900">
          <Link2 aria-hidden="true" className="size-3.5" />
          Complete citation set
        </p>
        <div className="mt-2 space-y-2">
          {response.citations.map((citation) => (
            <div className="rounded-lg bg-slate-50 p-3" key={citation.sourceId}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{citation.title}</p>
                  <p className="mt-0.5 text-slate-600">
                    {citation.publisher} · {citation.version}
                  </p>
                </div>
                <Badge
                  className="border-slate-200 bg-white text-slate-700"
                  variant="outline"
                >
                  {prettyM41cToken(citation.sourceState)}
                </Badge>
              </div>
              <p className="mt-2 text-slate-600">
                License: {prettyM41cToken(citation.licenseState)} · reviewed{" "}
                {formatM41cTimestamp(citation.reviewedAt)}
              </p>
              {citation.canonicalUrl?.startsWith("https://") ? (
                <a
                  className="mt-2 inline-flex items-center gap-1 font-bold text-teal-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  href={citation.canonicalUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open official source{" "}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {response.missingEvidence.length ||
      response.limitations.length ||
      response.uncertainty ? (
        <details
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
          open
        >
          <summary className="cursor-pointer font-bold">
            Limits, uncertainty, and missing evidence
          </summary>
          {response.uncertainty ? (
            <p className="mt-2">Uncertainty: {response.uncertainty}</p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {response.limitations.map((limit) => (
              <li key={limit}>• {limit}</li>
            ))}
            {response.missingEvidence.map((item) => (
              <li key={item}>• Missing: {item}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function AskAmos({
  isSubmitting,
  onAsk,
  response,
  selectedItem,
}: {
  isSubmitting: boolean;
  onAsk: (submission: M41cGuidanceSubmission) => void;
  response: M41cClinicalGuidanceResponse | null;
  selectedItem: M41cClinicalWorkplanItem | null;
}) {
  const [intent, setIntent] = useState<M41cGuidanceSubmission["intent"]>(
    "what_requires_attention",
  );
  const [prompt, setPrompt] = useState("");
  const [subjectId, setSubjectId] = useState(selectedItem?.subjectIds[0] ?? "");

  const canSubmit = Boolean(prompt.trim() && subjectId.trim() && !isSubmitting);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
            Guided, cited, permission-aware
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950">
            <MessageSquareText aria-hidden="true" className="size-4" />
            Ask AMOS clinical guidance
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            AMOS may explain and route. It cannot diagnose, prescribe, assign
            level of care, discharge, submit claims, or write externally.
          </p>
        </div>
        <Badge
          className="border-teal-200 bg-teal-50 text-teal-800"
          variant="outline"
        >
          Human review required
        </Badge>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          onAsk({
            subjectId: subjectId.trim(),
            prompt: prompt.trim(),
            intent,
            sourceIds: selectedItem?.sourceIds,
            workplanItemId: selectedItem?.id,
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            Guidance intent
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              onChange={(event) =>
                setIntent(
                  event.target.value as M41cGuidanceSubmission["intent"],
                )
              }
              value={intent}
            >
              {M41C_GUIDANCE_INTENTS.map((value) => (
                <option key={value} value={value}>
                  {prettyM41cToken(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            Synthetic subject reference
            <Input
              aria-describedby="m41c-subject-help"
              className="mt-1 bg-white font-mono text-xs"
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder="Select a server workplan item"
              value={subjectId}
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-500" id="m41c-subject-help">
          Synthetic identifiers only. Never enter a real name, record number, or
          patient detail.
        </p>
        <label className="block text-xs font-bold text-slate-700">
          Question
          <Textarea
            className="mt-1 min-h-24 bg-white font-normal"
            maxLength={800}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask what requires attention, why a flag fired, which source governs, or what evidence is missing…"
            value={prompt}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-slate-500">
            {selectedItem
              ? `${prettyM41cToken(selectedItem.cadence)} item · ${selectedItem.sourceIds.length} governed source(s)`
              : "Select a server workplan item for contextual guidance."}
          </p>
          <Button disabled={!canSubmit} type="submit">
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Checking governed sources" : "Ask with sources"}
          </Button>
        </div>
      </form>
      {response ? <GuidanceResponse response={response} /> : null}
    </article>
  );
}

function Competency({ registry }: { registry: M41cCompetencyRegistry }) {
  const now = Date.parse(registry.asOf);
  const currentAttestations = registry.attestations.filter(
    (attestation) =>
      !attestation.revokedAt && Date.parse(attestation.expiresAt) >= now,
  );
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
            Qualification before access
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950">
            <GraduationCap aria-hidden="true" className="size-4" />
            Competency &amp; certification monitor
          </h3>
        </div>
        <Badge
          className="border-rose-200 bg-rose-50 text-rose-800"
          variant="outline"
        >
          Production credentialing unavailable
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-slate-500">Requirements</dt>
          <dd className="text-lg font-black text-slate-950">
            {registry.requirements.length}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-slate-500">Attestations</dt>
          <dd className="text-lg font-black text-slate-950">
            {registry.attestations.length}
          </dd>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="text-emerald-700">Current demo</dt>
          <dd className="text-lg font-black text-emerald-800">
            {currentAttestations.length}
          </dd>
        </div>
      </dl>
      <div className="mt-3 space-y-2">
        {registry.requirements.map((requirement) => {
          const matches = currentAttestations.filter(
            (attestation) =>
              attestation.requirementId === requirement.requirementId,
          ).length;
          return (
            <details
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              key={requirement.requirementId}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">
                      {requirement.title}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {prettyM41cToken(requirement.scope)} · renew every{" "}
                      {requirement.renewalDays} days
                    </p>
                  </div>
                  <Badge
                    className={
                      matches
                        ? "border-emerald-200 bg-white text-emerald-800"
                        : "border-amber-200 bg-white text-amber-900"
                    }
                    variant="outline"
                  >
                    {matches} current
                  </Badge>
                </div>
              </summary>
              <div className="mt-2 border-t border-slate-200 pt-2 text-slate-700">
                <p>
                  Permitted roles:{" "}
                  {requirement.permittedRoles.map(prettyM41cToken).join(" · ")}
                </p>
                <p className="mt-1">
                  External certification:{" "}
                  {requirement.requiresExternalCertification
                    ? (requirement.certificationType ?? "required")
                    : "not required"}
                </p>
                <p className="mt-1">
                  Supervised use:{" "}
                  {requirement.supervisedUseRequired
                    ? "required"
                    : "not required"}
                </p>
              </div>
            </details>
          );
        })}
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />A
        synthetic attestation proves only that the prototype gate works; it does
        not credential a real staff member.
      </p>
    </article>
  );
}

export function M41cWorkplanAssistantPanel({
  competencyRegistry,
  guidance,
  isSubmittingGuidance,
  onAsk,
  workplan,
}: {
  competencyRegistry: M41cCompetencyRegistry;
  guidance: M41cClinicalGuidanceResponse | null;
  isSubmittingGuidance: boolean;
  onAsk: (submission: M41cGuidanceSubmission) => void;
  workplan: M41cClinicalWorkplan;
}) {
  const items = useMemo(() => allClinicalWorkplanItems(workplan), [workplan]);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  return (
    <section aria-labelledby="m41c-workplan-title" id="workplan">
      <Card className="border-slate-200 bg-slate-50/70">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle
                className="flex items-center gap-2 text-lg"
                id="m41c-workplan-title"
              >
                <CalendarDays
                  aria-hidden="true"
                  className="size-5 text-teal-700"
                />
                Clinical workplan &amp; Ask AMOS
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl leading-5">
                Every cadence turns governed source and safety conditions into
                role-aware human work. The assistant explains, cites, and
                routes; it does not make the clinical decision.
              </CardDescription>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-bold text-slate-800">
                {prettyM41cToken(workplan.role)}
              </p>
              <p>Generated {formatM41cTimestamp(workplan.generatedAt)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-4 pb-5 pt-5 md:px-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                <ClipboardCheck aria-hidden="true" className="size-4" />
                Five-cadence governed workplan
              </h3>
              <Badge
                className="border-emerald-200 bg-emerald-50 text-emerald-800"
                variant="outline"
              >
                <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
                Daily through annual
              </Badge>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
              {M41C_CADENCES.map((cadence) => {
                const item = workplan.briefs[cadence].items[0];
                return item ? (
                  <CadenceCard
                    item={item}
                    key={item.id}
                    onSelect={() => setSelectedItemId(item.id)}
                    selected={selectedItem?.id === item.id}
                  />
                ) : null;
              })}
            </div>
          </div>
          <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <AskAmos
              isSubmitting={isSubmittingGuidance}
              key={selectedItem?.id ?? "no-workplan-item"}
              onAsk={onAsk}
              response={guidance}
              selectedItem={selectedItem}
            />
            <Competency registry={competencyRegistry} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
