import { useState, type FormEvent } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  GitPullRequestArrow,
  Loader2,
  Send,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import type { CcmgWorkflowViewModel } from "./ccmg-oversight-model";

export type CcmgWorkflowStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "awaiting_approval"
  | "completed"
  | "cancelled";

export type CcmgWorkflowDepartment = "CCMG" | "MHTCM" | "MHRS" | "GRO";

export type CcmgWorkflowActionRequest =
  | { kind: "transition"; toStatus: CcmgWorkflowStatus; reason: string }
  | {
      kind: "assign";
      assignedDivision: "BHC" | "GRO";
      assignedDepartment: CcmgWorkflowDepartment;
      assignedRole: string;
      assignedTo?: string;
      dueAt: string;
      reason: string;
    }
  | {
      kind: "approve";
      decision: "approved" | "rejected";
      rationale: string;
    }
  | {
      kind: "handoff";
      toDivision: "BHC" | "GRO";
      toDepartment: CcmgWorkflowDepartment;
      dueAt: string;
      reason: string;
    }
  | {
      kind: "escalate";
      level: "supervisor" | "director" | "executive";
      reason: string;
    }
  | {
      kind: "exception";
      disposition: "open" | "resolved" | "waived";
      exceptionCode?: string;
      reason: string;
    }
  | {
      kind: "decide_handoff";
      handoffId: string;
      decision: "accepted" | "rejected" | "returned";
      reason: string;
    };

const COLORS = {
  teal: "#245C5A",
  amber: "#D97706",
  green: "#047857",
  red: "#B91C1C",
  slate: "#64748B",
} as const;

const STATUS_TRANSITIONS: Record<CcmgWorkflowStatus, CcmgWorkflowStatus[]> = {
  pending: ["in_progress", "blocked", "cancelled"],
  in_progress: ["blocked", "awaiting_approval", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  awaiting_approval: ["in_progress", "completed", "blocked"],
  completed: [],
  cancelled: [],
};

const DEPARTMENT_ROLE: Record<CcmgWorkflowDepartment, string> = {
  CCMG: "ccmg-program-director",
  MHTCM: "mhtcm-supervisor",
  MHRS: "mhrs-supervisor",
  GRO: "program-director",
};

function workflowStatus(value: string): CcmgWorkflowStatus {
  return value in STATUS_TRANSITIONS
    ? (value as CcmgWorkflowStatus)
    : "pending";
}

function department(value: string | null): CcmgWorkflowDepartment {
  const normalized = value?.toUpperCase();
  return normalized === "MHTCM" || normalized === "MHRS" || normalized === "GRO"
    ? normalized
    : "CCMG";
}

function toLocalDateTime(value: string | null): string {
  const parsed = value
    ? new Date(value)
    : new Date(Date.now() + 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(parsed.getTime())) return "";
  const local = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type ActionKind = CcmgWorkflowActionRequest["kind"];

const ACTIONS: ReadonlyArray<{
  kind: ActionKind;
  label: string;
  icon: typeof ArrowRightLeft;
}> = [
  { kind: "transition", label: "Status", icon: GitPullRequestArrow },
  { kind: "assign", label: "Assign", icon: UserRoundCog },
  { kind: "approve", label: "Approval", icon: ShieldCheck },
  { kind: "handoff", label: "Handoff", icon: ArrowRightLeft },
  { kind: "escalate", label: "Escalate", icon: GitPullRequestArrow },
  { kind: "exception", label: "Exception", icon: ShieldCheck },
  { kind: "decide_handoff", label: "Handoff decision", icon: CheckCircle2 },
];

const inputClass =
  "min-h-10 w-full rounded-lg border bg-transparent px-3 text-[11px] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

export function CcmgWorkflowActions({
  workflow,
  authenticatedRoleLabel,
  enabled,
  disabledReason,
  submitting,
  error,
  success,
  onAction,
}: {
  workflow: CcmgWorkflowViewModel;
  authenticatedRoleLabel: string;
  enabled: boolean;
  disabledReason?: string;
  submitting: boolean;
  error?: string;
  success?: string;
  onAction: (request: CcmgWorkflowActionRequest) => Promise<void>;
}) {
  const currentStatus = workflowStatus(workflow.status);
  const availableTransitions = STATUS_TRANSITIONS[currentStatus];
  const [kind, setKind] = useState<ActionKind>("transition");
  const [toStatus, setToStatus] = useState<CcmgWorkflowStatus>(
    availableTransitions[0] ?? currentStatus,
  );
  const initialDepartment = department(workflow.assignedDepartment);
  const [destination, setDestination] =
    useState<CcmgWorkflowDepartment>(initialDepartment);
  const [assignedRole, setAssignedRole] = useState(
    workflow.assignedRole ?? DEPARTMENT_ROLE[initialDepartment],
  );
  const [assignedTo, setAssignedTo] = useState(workflow.assignedTo ?? "");
  const [dueAt, setDueAt] = useState(toLocalDateTime(workflow.dueAt));
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [escalationLevel, setEscalationLevel] = useState<
    "supervisor" | "director" | "executive"
  >("supervisor");
  const [exceptionDisposition, setExceptionDisposition] = useState<
    "open" | "resolved" | "waived"
  >(workflow.exceptionStatus === "open" ? "resolved" : "open");
  const [exceptionCode, setExceptionCode] = useState(
    workflow.exceptionCode ?? "",
  );
  const [handoffDecision, setHandoffDecision] = useState<
    "accepted" | "rejected" | "returned"
  >("accepted");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const approvalAvailable = workflow.approvalStatus === "pending";
  const handoffDecisionAvailable =
    workflow.handoffId !== null && workflow.handoffVersion !== null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rationale = reason.trim();
    if (!rationale) {
      setValidationError(
        "A reason or rationale is required for the audit trail.",
      );
      return;
    }
    if (!enabled || submitting) return;
    setValidationError(null);

    if (kind === "transition") {
      if (!availableTransitions.includes(toStatus)) {
        setValidationError(
          "Select a valid next status for this workflow state.",
        );
        return;
      }
      await onAction({ kind, toStatus, reason: rationale });
      return;
    }
    if (kind === "approve") {
      if (!approvalAvailable) {
        setValidationError("This work item is not awaiting approval.");
        return;
      }
      await onAction({ kind, decision, rationale });
      return;
    }
    if (kind === "escalate") {
      await onAction({ kind, level: escalationLevel, reason: rationale });
      return;
    }
    if (kind === "exception") {
      await onAction({
        kind,
        disposition: exceptionDisposition,
        ...(exceptionCode.trim()
          ? { exceptionCode: exceptionCode.trim() }
          : {}),
        reason: rationale,
      });
      return;
    }
    if (kind === "decide_handoff") {
      if (!workflow.handoffId || workflow.handoffVersion === null) {
        setValidationError("No current handoff is available for a decision.");
        return;
      }
      await onAction({
        kind,
        handoffId: workflow.handoffId,
        decision: handoffDecision,
        reason: rationale,
      });
      return;
    }

    const dueAtIso = toIso(dueAt);
    if (!dueAtIso) {
      setValidationError("Enter a valid due date and time.");
      return;
    }
    const division = destination === "GRO" ? "GRO" : "BHC";
    if (kind === "assign") {
      if (!assignedRole.trim()) {
        setValidationError("An assigned role is required.");
        return;
      }
      await onAction({
        kind,
        assignedDivision: division,
        assignedDepartment: destination,
        assignedRole: assignedRole.trim(),
        ...(assignedTo.trim() ? { assignedTo: assignedTo.trim() } : {}),
        dueAt: dueAtIso,
        reason: rationale,
      });
      return;
    }
    await onAction({
      kind,
      toDivision: division,
      toDepartment: destination,
      dueAt: dueAtIso,
      reason: rationale,
    });
  };

  return (
    <section
      className="mt-4 rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      aria-labelledby="workflow-actions-heading"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2
            id="workflow-actions-heading"
            className="text-[13px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            Guided workflow actions
          </h2>
          <p
            className="mt-1 max-w-3xl text-[10px] leading-4"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            The server validates the authenticated session role, queue scope,
            operation permission, and version before every change. This panel
            does not grant authority and applies no optimistic update.
          </p>
        </div>
        <span
          className="w-fit rounded-full border px-2 py-1 text-[9px] font-semibold"
          style={{ color: COLORS.teal, borderColor: `${COLORS.teal}44` }}
        >
          {authenticatedRoleLabel}
        </span>
      </div>

      {!enabled && (
        <p
          className="mt-3 rounded-lg border px-3 py-2 text-[10px] leading-4"
          style={{
            color: "#92400E",
            borderColor: "#F59E0B66",
            background: "#FFFBEB",
          }}
        >
          {disabledReason ?? "Workflow actions are unavailable for this trace."}
        </p>
      )}

      <div
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        role="tablist"
        aria-label="Workflow action type"
      >
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const selected = kind === action.kind;
          const unavailable = action.kind === "approve" && !approvalAvailable;
          const actionUnavailable =
            unavailable ||
            (action.kind === "decide_handoff" && !handoffDecisionAvailable);
          return (
            <button
              key={action.kind}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={!enabled || submitting || actionUnavailable}
              onClick={() => {
                setKind(action.kind);
                setValidationError(null);
              }}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                color: selected ? "#FFFFFF" : "var(--topbar-title)",
                borderColor: selected ? COLORS.teal : "var(--card-border)",
                backgroundColor: selected ? COLORS.teal : "transparent",
              }}
            >
              <Icon size={13} aria-hidden="true" />
              {action.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-4">
        <fieldset
          disabled={!enabled || submitting}
          className="grid gap-3 lg:grid-cols-2"
        >
          {kind === "transition" && (
            <label className="block">
              <span
                className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Next status
              </span>
              <select
                value={toStatus}
                onChange={(event) =>
                  setToStatus(event.target.value as CcmgWorkflowStatus)
                }
                className={inputClass}
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--topbar-title)",
                }}
              >
                {availableTransitions.length > 0 ? (
                  availableTransitions.map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))
                ) : (
                  <option value={currentStatus}>No transition available</option>
                )}
              </select>
            </label>
          )}

          {(kind === "assign" || kind === "handoff") && (
            <>
              <label className="block">
                <span
                  className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Destination
                </span>
                <select
                  value={destination}
                  onChange={(event) => {
                    const value = event.target.value as CcmgWorkflowDepartment;
                    setDestination(value);
                    if (kind === "assign")
                      setAssignedRole(DEPARTMENT_ROLE[value]);
                  }}
                  className={inputClass}
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                >
                  {Object.keys(DEPARTMENT_ROLE).map((value) => (
                    <option key={value} value={value}>
                      {value === "GRO" ? "GRO capacity" : value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span
                  className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Due date
                </span>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className={inputClass}
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                />
              </label>
            </>
          )}

          {kind === "assign" && (
            <>
              <label className="block">
                <span
                  className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Assigned role
                </span>
                <input
                  value={assignedRole}
                  onChange={(event) => setAssignedRole(event.target.value)}
                  className={inputClass}
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                />
              </label>
              <label className="block">
                <span
                  className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Assignee ID (optional)
                </span>
                <input
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  className={inputClass}
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                />
              </label>
            </>
          )}

          {kind === "approve" && (
            <label className="block">
              <span
                className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Decision
              </span>
              <select
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as "approved" | "rejected")
                }
                className={inputClass}
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--topbar-title)",
                }}
              >
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
          )}

          {kind === "escalate" && (
            <label className="block">
              <span
                className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Escalation level
              </span>
              <select
                value={escalationLevel}
                onChange={(event) =>
                  setEscalationLevel(
                    event.target.value as
                      "supervisor" | "director" | "executive",
                  )
                }
                className={inputClass}
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--topbar-title)",
                }}
              >
                <option value="supervisor">Supervisor</option>
                <option value="director">Director</option>
                <option value="executive">Executive</option>
              </select>
            </label>
          )}

          {kind === "exception" && (
            <>
              <label className="block">
                <span
                  className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Disposition
                </span>
                <select
                  value={exceptionDisposition}
                  onChange={(event) =>
                    setExceptionDisposition(
                      event.target.value as "open" | "resolved" | "waived",
                    )
                  }
                  className={inputClass}
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="waived">Waived</option>
                </select>
              </label>
              <label className="block">
                <span
                  className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Exception code (optional)
                </span>
                <input
                  value={exceptionCode}
                  onChange={(event) => setExceptionCode(event.target.value)}
                  className={inputClass}
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                />
              </label>
            </>
          )}

          {kind === "decide_handoff" && (
            <label className="block">
              <span
                className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Handoff decision
              </span>
              <select
                value={handoffDecision}
                onChange={(event) =>
                  setHandoffDecision(
                    event.target.value as "accepted" | "rejected" | "returned",
                  )
                }
                className={inputClass}
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--topbar-title)",
                }}
              >
                <option value="accepted">Accept</option>
                <option value="rejected">Reject</option>
                <option value="returned">Return</option>
              </select>
            </label>
          )}

          <label
            className={
              kind === "assign" || kind === "handoff" || kind === "exception"
                ? "block lg:col-span-2"
                : "block lg:col-span-1"
            }
          >
            <span
              className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.7px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {kind === "approve" ? "Rationale" : "Audit reason"}
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Required for the material-change audit trail"
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-[11px] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: "var(--card-border)",
                color: "var(--topbar-title)",
              }}
            />
          </label>
        </fieldset>

        {(validationError || error) && (
          <p
            className="mt-3 text-[10px] font-semibold"
            role="alert"
            style={{ color: COLORS.red }}
          >
            {validationError ?? error}
          </p>
        )}
        {success && !error && (
          <p
            className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold"
            role="status"
            style={{ color: COLORS.green }}
          >
            <CheckCircle2 size={13} aria-hidden="true" /> {success}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[9px]" style={{ color: COLORS.slate }}>
            Version {workflow.expectedVersion ?? "—"} · refreshes from server
            after success
          </p>
          <button
            type="submit"
            disabled={
              !enabled ||
              submitting ||
              (kind === "transition" && availableTransitions.length === 0)
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-[10px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: COLORS.teal }}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={13} aria-hidden="true" />
            )}
            {submitting
              ? "Submitting…"
              : `Submit ${ACTIONS.find((action) => action.kind === kind)?.label.toLowerCase()}`}
          </button>
        </div>
      </form>
    </section>
  );
}
