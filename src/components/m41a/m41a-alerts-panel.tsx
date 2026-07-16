import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Route,
  UserRoundCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  formatTimestamp,
  prettyToken,
  type M41aAlertAction,
  type M41aAlertView,
  type M41aQueryState,
} from "./m41a-model";
import { M41aStatusPill } from "./m41a-status-pill";

export interface M41aAlertActionPayloads {
  acknowledge: { alertId: string };
  assign: { alertId: string; assigneeId: string };
  recordDecision: {
    alertId: string;
    disposition: string;
    rationale: string;
  };
  addEvidence: {
    alertId: string;
    evidenceRef: string;
    summary: string;
  };
  resolve: { alertId: string };
}

interface AlertDraft {
  assigneeId: string;
  disposition: string;
  rationale: string;
  evidenceRef: string;
  evidenceSummary: string;
}

const EMPTY_DRAFT: AlertDraft = {
  assigneeId: "",
  disposition: "",
  rationale: "",
  evidenceRef: "",
  evidenceSummary: "",
};

function actionAvailable(alert: M41aAlertView, action: M41aAlertAction) {
  return alert.allowedActions.includes(action);
}

function AlertListItem({
  alert,
  active,
  onSelect,
}: {
  alert: M41aAlertView;
  active: boolean;
  onSelect: (alert: M41aAlertView) => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/10"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
      )}
      onClick={() => onSelect(alert)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900">
            {alert.title}
          </p>
          <p className="mt-1 truncate text-[10px] text-slate-500">
            {alert.metricLabel}
          </p>
        </div>
        <M41aStatusPill value={alert.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>{prettyToken(alert.severity)} priority</span>
        <span>{formatTimestamp(alert.updatedAt)}</span>
      </div>
    </button>
  );
}

function EmptyAlerts() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-slate-50 p-6 text-center">
      <div className="max-w-sm">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-7 text-emerald-600" />
        <p className="mt-2 text-sm font-semibold text-slate-800">No alerts in this scope</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          The governed query returned no threshold alerts for the selected dashboard.
        </p>
      </div>
    </div>
  );
}

export function M41aAlertsPanel({
  alerts,
  queryState,
  isFetching,
  isMutating,
  errorMessage,
  decisionDispositions,
  onAcknowledge,
  onAssign,
  onRecordDecision,
  onAddEvidence,
  onResolve,
  onRefresh,
}: {
  alerts: readonly M41aAlertView[];
  queryState: M41aQueryState;
  isFetching: boolean;
  isMutating: boolean;
  errorMessage?: string;
  decisionDispositions: readonly string[];
  onAcknowledge: (payload: M41aAlertActionPayloads["acknowledge"]) => void;
  onAssign: (payload: M41aAlertActionPayloads["assign"]) => void;
  onRecordDecision: (
    payload: M41aAlertActionPayloads["recordDecision"],
  ) => void;
  onAddEvidence: (payload: M41aAlertActionPayloads["addEvidence"]) => void;
  onResolve: (payload: M41aAlertActionPayloads["resolve"]) => void;
  onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AlertDraft>>({});

  const selectedAlert = useMemo(
    () =>
      alerts.find((alert) => alert.id === selectedId) ?? alerts[0] ?? null,
    [alerts, selectedId],
  );
  const draft = selectedAlert
    ? (drafts[selectedAlert.id] ?? {
        ...EMPTY_DRAFT,
        assigneeId: selectedAlert.assignedTo ?? "",
        disposition: selectedAlert.decisionDisposition ?? "",
        rationale: selectedAlert.decisionRationale ?? "",
      })
    : EMPTY_DRAFT;
  const updateDraft = (field: keyof AlertDraft, value: string) => {
    if (!selectedAlert) return;
    setDrafts((current) => ({
      ...current,
      [selectedAlert.id]: { ...draft, [field]: value },
    }));
  };

  if (queryState === "loading") {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed">
        <div className="text-center">
          <Loader2 aria-hidden="true" className="mx-auto size-6 animate-spin text-teal-700" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Loading governed alerts</p>
        </div>
      </div>
    );
  }

  if (queryState === "error") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto size-6 text-rose-700" />
        <p className="mt-2 text-sm font-semibold text-rose-900">Alerts could not be loaded</p>
        <p className="mt-1 text-xs text-rose-700">
          {errorMessage ?? "The alert lifecycle remains unchanged."}
        </p>
        <Button className="mt-3" onClick={onRefresh} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (alerts.length === 0) return <EmptyAlerts />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.65fr)]">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Threshold alerts</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Select an alert to continue its accountable lifecycle.
              </CardDescription>
            </div>
            <Button
              aria-label="Refresh alerts"
              disabled={isFetching || isMutating}
              onClick={onRefresh}
              size="icon"
              variant="ghost"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[720px] space-y-2 overflow-y-auto px-4">
          {alerts.map((alert) => (
            <AlertListItem
              key={alert.id}
              active={alert.id === selectedAlert?.id}
              alert={alert}
              onSelect={(selected) => setSelectedId(selected.id)}
            />
          ))}
        </CardContent>
      </Card>

      {selectedAlert ? (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <M41aStatusPill value={selectedAlert.status} />
                  <M41aStatusPill
                    label={`${prettyToken(selectedAlert.severity)} priority`}
                    value={selectedAlert.severity}
                  />
                </div>
                <CardTitle className="text-base leading-6">
                  {selectedAlert.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {selectedAlert.metricLabel} · Updated {formatTimestamp(selectedAlert.updatedAt)}
                </CardDescription>
              </div>
              <span className="rounded-lg border bg-slate-50 px-2.5 py-1.5 font-mono text-[10px] text-slate-600">
                {selectedAlert.id}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5">
            <section className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Current</p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {selectedAlert.currentValueLabel}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Threshold</p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {selectedAlert.thresholdLabel}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Owner</p>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  {selectedAlert.ownerLabel}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Assignment</p>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  {selectedAlert.assignedTo ?? "Unassigned"}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Route aria-hidden="true" className="size-4 text-teal-700" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Accountable lifecycle
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <ClipboardCheck aria-hidden="true" className="mt-0.5 size-5 text-teal-700" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">1. Acknowledge</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        Records the authenticated actor and acknowledgement time.
                      </p>
                      <p className="mt-2 text-[10px] text-slate-600">
                        {selectedAlert.acknowledgedBy
                          ? `${selectedAlert.acknowledgedBy} · ${formatTimestamp(selectedAlert.acknowledgedAt)}`
                          : "Awaiting acknowledgement"}
                      </p>
                      <Button
                        className="mt-3 w-full"
                        disabled={
                          !actionAvailable(selectedAlert, "acknowledge") || isMutating
                        }
                        onClick={() => onAcknowledge({ alertId: selectedAlert.id })}
                        size="sm"
                      >
                        Acknowledge alert
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <UserRoundCheck aria-hidden="true" className="mt-0.5 size-5 text-teal-700" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">2. Assign</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        Routes follow-up to a synthetic authorized assignee.
                      </p>
                      <Label className="mt-3 text-[10px]" htmlFor="m41a-assignee">
                        Assignee identifier
                      </Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        id="m41a-assignee"
                        onChange={(event) =>
                          updateDraft("assigneeId", event.target.value)
                        }
                        placeholder="Synthetic assignee ID"
                        value={draft.assigneeId}
                      />
                      <Button
                        className="mt-3 w-full"
                        disabled={
                          !actionAvailable(selectedAlert, "assign") ||
                          draft.assigneeId.trim().length === 0 ||
                          isMutating
                        }
                        onClick={() =>
                          onAssign({
                            alertId: selectedAlert.id,
                            assigneeId: draft.assigneeId.trim(),
                          })
                        }
                        size="sm"
                        variant="outline"
                      >
                        Assign follow-up
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <MessageSquareText aria-hidden="true" className="mt-0.5 size-5 text-teal-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">3. Record decision</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Captures the human disposition and rationale; no automated decision is applied.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                    <div>
                      <Label className="text-[10px]" htmlFor="m41a-disposition">
                        Disposition
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          updateDraft("disposition", value)
                        }
                        value={draft.disposition}
                      >
                        <SelectTrigger className="mt-1 w-full" id="m41a-disposition">
                          <SelectValue placeholder="Choose disposition" />
                        </SelectTrigger>
                        <SelectContent>
                          {decisionDispositions.map((value) => (
                            <SelectItem key={value} value={value}>
                              {prettyToken(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]" htmlFor="m41a-rationale">
                        Rationale
                      </Label>
                      <Textarea
                        className="mt-1 min-h-20 text-xs"
                        id="m41a-rationale"
                        onChange={(event) =>
                          updateDraft("rationale", event.target.value)
                        }
                        placeholder="State the governed decision rationale"
                        value={draft.rationale}
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-3"
                    disabled={
                      !actionAvailable(selectedAlert, "record_decision") ||
                      draft.disposition.length === 0 ||
                      draft.rationale.trim().length === 0 ||
                      isMutating
                    }
                    onClick={() =>
                      onRecordDecision({
                        alertId: selectedAlert.id,
                        disposition: draft.disposition,
                        rationale: draft.rationale.trim(),
                      })
                    }
                    size="sm"
                  >
                    Record human decision
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <FilePlus2 aria-hidden="true" className="mt-0.5 size-5 text-teal-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">4. Add follow-up evidence</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Links a synthetic evidence reference and completion summary to the alert.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                    <div>
                      <Label className="text-[10px]" htmlFor="m41a-evidence-ref">
                        Evidence reference
                      </Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        id="m41a-evidence-ref"
                        onChange={(event) =>
                          updateDraft("evidenceRef", event.target.value)
                        }
                        placeholder="SYN-EVIDENCE-..."
                        value={draft.evidenceRef}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]" htmlFor="m41a-evidence-summary">
                        Follow-up summary
                      </Label>
                      <Textarea
                        className="mt-1 min-h-20 text-xs"
                        id="m41a-evidence-summary"
                        onChange={(event) =>
                          updateDraft("evidenceSummary", event.target.value)
                        }
                        placeholder="Describe the completed follow-up"
                        value={draft.evidenceSummary}
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-3"
                    disabled={
                      !actionAvailable(selectedAlert, "add_follow_up_evidence") ||
                      draft.evidenceRef.trim().length === 0 ||
                      draft.evidenceSummary.trim().length === 0 ||
                      isMutating
                    }
                    onClick={() =>
                      onAddEvidence({
                        alertId: selectedAlert.id,
                        evidenceRef: draft.evidenceRef.trim(),
                        summary: draft.evidenceSummary.trim(),
                      })
                    }
                    size="sm"
                    variant="outline"
                  >
                    Attach follow-up evidence
                  </Button>
                </div>
              </div>

              {selectedAlert.evidence.length > 0 ? (
                <div className="mt-4 space-y-2 border-t pt-4">
                  {selectedAlert.evidence.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-slate-50 p-3 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-700">
                          {item.reference}
                        </span>
                        <span className="text-slate-500">{formatTimestamp(item.addedAt)}</span>
                      </div>
                      <p className="mt-1 leading-4 text-slate-600">{item.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <Archive aria-hidden="true" className="mt-0.5 size-5 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-emerald-950">5. Resolve with evidence</p>
                  <p className="mt-1 text-[11px] text-emerald-800">
                    Resolution is server-gated by acknowledgement, assignment, decision, and evidence.
                  </p>
                </div>
              </div>
              <Button
                disabled={
                  !actionAvailable(selectedAlert, "resolve") || isMutating
                }
                onClick={() => onResolve({ alertId: selectedAlert.id })}
                size="sm"
              >
                Resolve alert
              </Button>
            </section>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
