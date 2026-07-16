import type {
  M41bGuidanceIntent,
  M41bGuidanceResponse,
  M41bHumanDecision,
  M41bWorkplanItem,
} from "@contracts/m41b";
import {
  AlertOctagon,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CornerDownRight,
  Loader2,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  M41B_GUIDANCE_INTENT_PRESENTATION,
  formatConfidence,
  prettyToken,
  type M41bDispositionSubmission,
  type M41bGuidanceSubmission,
} from "./m41b-experience-model";
import { M41bGovernanceBadge } from "./m41b-governance-badge";
import { M41bCitationCard } from "./m41b-source-transparency";

const HUMAN_DISPOSITIONS = [
  "approve",
  "modify",
  "reject",
  "override",
] as const satisfies readonly M41bHumanDecision["disposition"][];

function GuidanceOutcome({
  response,
  onRouteSupervisor,
}: {
  response: M41bGuidanceResponse;
  onRouteSupervisor?: (response: M41bGuidanceResponse) => void;
}) {
  return (
    <section
      aria-live="polite"
      className="space-y-3"
      data-guidance-response={response.responseId}
    >
      <div
        className={cn(
          "rounded-xl border p-4",
          response.refused
            ? "border-rose-300 bg-rose-50"
            : "border-teal-200 bg-teal-50/60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
              {response.refused ? (
                <AlertOctagon
                  aria-hidden="true"
                  className="size-4 text-rose-700"
                />
              ) : (
                <BrainCircuit
                  aria-hidden="true"
                  className="size-4 text-teal-700"
                />
              )}
              {response.refused ? "Governed refusal" : "Sourced guidance"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-900">
              {response.answer}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              Confidence {formatConfidence(response.confidence)}
            </Badge>
            {response.refused ? (
              <M41bGovernanceBadge value="refused" />
            ) : (
              <M41bGovernanceBadge value={response.humanGate.disposition} />
            )}
          </div>
        </div>

        {response.refusalCode ? (
          <p className="mt-3 break-all rounded-lg border border-rose-200 bg-white/70 px-3 py-2 font-mono text-[10px] text-rose-800">
            Refusal code {response.refusalCode}
          </p>
        ) : null}

        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <dt className="font-bold text-slate-600">Uncertainty</dt>
            <dd className="mt-1 leading-5 text-slate-800">
              {response.uncertainty ?? "No uncertainty statement returned."}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
            <dt className="font-bold text-slate-600">Recommendation ID</dt>
            <dd className="mt-1 break-all font-mono text-[10px] text-slate-800">
              {response.recommendationId ?? "No recommendation created"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold text-slate-800">
            Next controlled steps
          </p>
          {response.nextSteps.length > 0 ? (
            <ol className="mt-2 space-y-2 text-xs text-slate-700">
              {response.nextSteps.map((step, index) => (
                <li className="flex items-start gap-2" key={`${index}-${step}`}>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-800">
                    {index + 1}
                  </span>
                  <span className="leading-5">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              No next steps returned.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold text-slate-800">
            Limits and missing evidence
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
            {response.applicableLimits.map((limit) => (
              <li className="flex items-start gap-1.5" key={limit}>
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-amber-700"
                />
                {limit}
              </li>
            ))}
            {response.missingEvidence.map((entry) => (
              <li
                className="flex items-start gap-1.5 text-rose-800"
                key={entry}
              >
                <AlertOctagon
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                Missing: {entry}
              </li>
            ))}
            {response.applicableLimits.length === 0 &&
            response.missingEvidence.length === 0 ? (
              <li className="text-slate-500">
                No additional limits or missing evidence returned.
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Human gate · {prettyToken(response.humanGate.materialDomain)}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-amber-900">
              {response.humanGate.required
                ? "An accountable human must approve, modify, or reject this material guidance."
                : "No material human gate was required by the returned guidance."}
            </p>
          </div>
          <M41bGovernanceBadge value={response.humanGate.disposition} />
        </div>
        <p className="mt-2 text-[11px] text-amber-900">
          Accountable roles:{" "}
          {response.humanGate.accountableRoles.map(prettyToken).join(", ") ||
            "None returned"}
        </p>
        <p className="mt-1 break-all font-mono text-[10px] text-amber-800">
          Decision {response.humanGate.decisionId ?? "not recorded"}
        </p>
      </div>

      {response.workflowLaunch ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
          <p className="flex items-center gap-1.5 font-bold">
            <ArrowUpRight aria-hidden="true" className="size-4" />
            Workflow prepared · {response.workflowLaunch.workflowKey}
          </p>
          <p className="mt-1 text-sky-800">
            {response.workflowLaunch.blockedPendingApproval
              ? "Launch is blocked pending the accountable human approval."
              : "The server returned this launch as not blocked by a pending approval."}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-violet-950">
              <Route aria-hidden="true" className="size-4" />
              Escalation and supervisor routing
            </p>
            <p className="mt-1 text-[11px] leading-5 text-violet-800">
              {response.escalation.reason ?? "No escalation reason returned."}
            </p>
            <p className="mt-1 text-[11px] text-violet-900">
              Route to:{" "}
              {response.escalation.routeTo.map(prettyToken).join(", ") ||
                "No route returned"}
            </p>
          </div>
          <Button
            disabled={!response.escalation.required || !onRouteSupervisor}
            onClick={() => onRouteSupervisor?.(response)}
            size="sm"
            type="button"
            variant="outline"
          >
            <CornerDownRight aria-hidden="true" className="size-3.5" />
            Route through server
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-800">
          Cited source snapshots ({response.citations.length})
        </p>
        {response.citations.length > 0 ? (
          response.citations.map((citation) => (
            <M41bCitationCard citation={citation} key={citation.sourceId} />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
            No citation snapshots returned; sourced guidance cannot be inferred.
          </p>
        )}
      </div>
    </section>
  );
}

function HumanDispositionForm({
  response,
  isSubmitting,
  onSubmit,
}: {
  response: M41bGuidanceResponse;
  isSubmitting: boolean;
  onSubmit?: (submission: M41bDispositionSubmission) => void;
}) {
  const [disposition, setDisposition] =
    useState<M41bHumanDecision["disposition"]>("approve");
  const [rationale, setRationale] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [modifiedSummary, setModifiedSummary] = useState("");
  const recommendationId = response.recommendationId;
  const valid =
    Boolean(recommendationId) &&
    rationale.trim().length >= 8 &&
    (disposition !== "override" || overrideReason.trim().length >= 8) &&
    (disposition !== "modify" || modifiedSummary.trim().length >= 8);

  return (
    <form
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || !recommendationId || !onSubmit) return;
        onSubmit({
          recommendationId,
          disposition,
          rationale: rationale.trim(),
          overrideReason:
            disposition === "override" ? overrideReason.trim() : null,
          modifiedSummary:
            disposition === "modify" ? modifiedSummary.trim() : null,
        });
      }}
    >
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Accountable human disposition
        </p>
        <p className="mt-1 text-[11px] leading-5 text-amber-900">
          AMOS cannot select or submit this decision. The authenticated human
          rationale and any override reason are recorded by the server.
        </p>
        {!onSubmit ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 text-[11px] font-semibold text-amber-950">
            Your current role is not listed as an accountable approver for this
            domain. Use the governed supervisor route.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HUMAN_DISPOSITIONS.map((option) => (
          <button
            aria-pressed={disposition === option}
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-semibold",
              disposition === option
                ? "border-amber-500 bg-white text-amber-950 ring-1 ring-amber-300"
                : "border-amber-200 bg-amber-100/50 text-amber-900",
            )}
            key={option}
            onClick={() => setDisposition(option)}
            type="button"
          >
            {prettyToken(option)}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="m41b-human-rationale">Human rationale</Label>
        <Textarea
          id="m41b-human-rationale"
          onChange={(event) => setRationale(event.target.value)}
          placeholder="Record the accountable human reasoning."
          value={rationale}
        />
      </div>
      {disposition === "modify" ? (
        <div>
          <Label htmlFor="m41b-modified-summary">
            Modified recommendation
          </Label>
          <Textarea
            id="m41b-modified-summary"
            onChange={(event) => setModifiedSummary(event.target.value)}
            placeholder="State the exact bounded recommendation that should become the owned task."
            value={modifiedSummary}
          />
        </div>
      ) : null}
      {disposition === "override" ? (
        <div>
          <Label htmlFor="m41b-override-reason">Override reason</Label>
          <Textarea
            id="m41b-override-reason"
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="An explicit override reason is required."
            value={overrideReason}
          />
        </div>
      ) : null}
      <Button disabled={!valid || isSubmitting || !onSubmit} type="submit">
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ShieldCheck aria-hidden="true" className="size-4" />
        )}
        Submit human disposition
      </Button>
    </form>
  );
}

export function M41bAskAmosPanel({
  selectedItem,
  response,
  isSubmittingGuidance,
  isSubmittingDisposition,
  onAsk,
  onDisposition,
  onRouteSupervisor,
}: {
  selectedItem: M41bWorkplanItem | null;
  response: M41bGuidanceResponse | null;
  isSubmittingGuidance: boolean;
  isSubmittingDisposition: boolean;
  onAsk: (submission: M41bGuidanceSubmission) => void;
  onDisposition?: (submission: M41bDispositionSubmission) => void;
  onRouteSupervisor?: (response: M41bGuidanceResponse) => void;
}) {
  const [intent, setIntent] = useState<M41bGuidanceIntent>(
    M41B_GUIDANCE_INTENT_PRESENTATION[0].intent,
  );
  const [prompt, setPrompt] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length < 4 || isSubmittingGuidance) return;
    onAsk({
      prompt: normalizedPrompt,
      intent,
      ...(selectedItem
        ? {
            sourceIds: selectedItem.sourceIds,
            workplanItemId: selectedItem.id,
            requestedDivision: selectedItem.division,
            requestedDomain: selectedItem.materialDomain,
          }
        : {}),
    });
  };

  return (
    <Card className="gap-4 border-teal-200 py-5 lg:sticky lg:top-14">
      <CardHeader className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot aria-hidden="true" className="size-5 text-teal-700" />
              Ask AMOS
            </CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">
              Permission-aware assistance grounded in governed sources, explicit
              limits, and human gates.
            </CardDescription>
          </div>
          <Badge
            className="border-amber-200 bg-amber-50 text-amber-900"
            variant="outline"
          >
            Guidance only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Sparkles aria-hidden="true" className="size-3.5 text-teal-700" />
            Governed context
          </p>
          {selectedItem ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-900">
                {selectedItem.title}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                {selectedItem.id} · {selectedItem.sourceIds.length} source
                reference{selectedItem.sourceIds.length === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-800">
              No workplan item selected. Only the typed prompt and authorized
              role context will be sent.
            </p>
          )}
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <fieldset>
            <legend className="text-xs font-bold text-slate-800">
              Guided intent
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {M41B_GUIDANCE_INTENT_PRESENTATION.map((option) => (
                <button
                  aria-pressed={intent === option.intent}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-colors",
                    intent === option.intent
                      ? "border-teal-400 bg-teal-50 ring-1 ring-teal-200"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                  key={option.intent}
                  onClick={() => setIntent(option.intent)}
                  type="button"
                >
                  <span className="block text-xs font-bold text-slate-900">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="m41b-ask-prompt">
              Your governed question or request
            </Label>
            <Textarea
              aria-describedby="m41b-prompt-help"
              className="mt-1 min-h-28"
              id="m41b-ask-prompt"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask for an explanation, next step, task, workflow, or escalation."
              value={prompt}
            />
            <p
              className="mt-1 text-[10px] leading-4 text-slate-500"
              id="m41b-prompt-help"
            >
              Retrieval outside role, division, caseload, sensitivity, or
              delegated authority must be refused or escalated.
            </p>
          </div>
          <Button
            disabled={prompt.trim().length < 4 || isSubmittingGuidance}
            type="submit"
          >
            {isSubmittingGuidance ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            Request sourced guidance
          </Button>
        </form>

        {response ? (
          <>
            <GuidanceOutcome
              response={response}
              onRouteSupervisor={onRouteSupervisor}
            />
            {response.recommendationId &&
            response.humanGate.required &&
            response.humanGate.disposition === "pending" ? (
              <HumanDispositionForm
                isSubmitting={isSubmittingDisposition}
                onSubmit={onDisposition}
                response={response}
              />
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <Bot aria-hidden="true" className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 text-xs font-semibold text-slate-700">
              No guidance response in this view
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              AMOS will not synthesize an answer while governed retrieval is
              unavailable.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
