import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  ClipboardList,
  Link2,
  PackageCheck,
  Truck,
  UserRoundCog,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";

const MANAGER_ROLES = new Set([
  "logistics-manager",
  "super-admin",
  "managing-director",
  "administrator",
]);

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  triage: "Triage",
  assigned: "Assigned",
  in_progress: "In progress",
  ready_for_verification: "Ready for verification",
  closed: "Closed",
  returned_for_information: "Information requested",
  pending_dependency: "Pending dependency",
  escalated: "Escalated",
  declined: "Declined",
  cancelled: "Cancelled",
};

function statusClass(status: string) {
  if (status === "closed")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "escalated")
    return "bg-red-50 text-red-700 border-red-200";
  if (status === "ready_for_verification")
    return "bg-teal-50 text-teal-700 border-teal-200";
  if (status === "pending_dependency" || status === "returned_for_information")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function GadLogisticsPage() {
  const { currentRole, user } = useAuth();
  const utils = trpc.useUtils();
  const isManager = MANAGER_ROLES.has(currentRole);
  const isCoordinator = currentRole === "logistics-coordinator";
  const [queue, setQueue] = useState<
    "all" | "untriaged" | "mine" | "attention" | "verification"
  >(isCoordinator ? "mine" : "attention");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [dependencyType, setDependencyType] = useState("");
  const [dependencyOwner, setDependencyOwner] = useState("");
  const [note, setNote] = useState("");
  const [closureSummary, setClosureSummary] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [queueEvaluationTime] = useState(() => Date.now());

  const { data: requests = [], isLoading } =
    trpc.gad.listLogisticsRequests.useQuery();
  const { data: kpis } = trpc.gad.logisticsKPIs.useQuery();
  const { data: staff = [] } = trpc.gad.listAssignableLogisticsStaff.useQuery();
  const { data: detail } = trpc.gad.getLogisticsRequest.useQuery(
    { id: selectedId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(selectedId) },
  );

  const refresh = async () => {
    await Promise.all([
      utils.gad.listLogisticsRequests.invalidate(),
      utils.gad.logisticsKPIs.invalidate(),
      utils.gad.listAssignableLogisticsStaff.invalidate(),
      selectedId
        ? utils.gad.getLogisticsRequest.invalidate({ id: selectedId })
        : Promise.resolve(),
    ]);
  };

  const updateRequest = trpc.gad.updateLogisticsRequest.useMutation({
    onSuccess: async () => {
      await refresh();
      setMessage("Logistics request updated.");
    },
    onError: (error) => setMessage(error.message),
  });

  const disposition = trpc.gad.approveLogisticsDisposition.useMutation({
    onSuccess: async () => {
      await refresh();
      setMessage("Manager disposition recorded.");
    },
    onError: (error) => setMessage(error.message),
  });

  const coordinatorOptions = staff.filter(
    (member) => member.role === "logistics-coordinator",
  );
  const managerOptions = staff.filter(
    (member) => member.role === "logistics-manager",
  );

  const visibleRequests = useMemo(() => {
    if (queue === "untriaged")
      return requests.filter((request) =>
        ["submitted", "triage", "returned_for_information"].includes(
          request.status,
        ),
      );
    if (queue === "mine")
      return requests.filter(
        (request) =>
          request.logistics_manager_id === user?.id ||
          request.logistics_coordinator_id === user?.id,
      );
    if (queue === "attention")
      return requests.filter(
        (request) =>
          ["critical", "urgent"].includes(request.priority) ||
          ["escalated", "pending_dependency"].includes(request.status) ||
          (request.need_by &&
            Date.parse(request.need_by) < queueEvaluationTime &&
            !["closed", "cancelled", "declined"].includes(request.status)),
      );
    if (queue === "verification")
      return requests.filter(
        (request) => request.status === "ready_for_verification",
      );
    return requests;
  }, [queue, queueEvaluationTime, requests, user?.id]);

  const selected =
    (detail && selectedId === detail.id ? detail : undefined) ??
    requests.find((request) => request.id === selectedId);

  const runDisposition = (
    action:
      | "triage"
      | "assign"
      | "escalate"
      | "return_for_information"
      | "close"
      | "decline"
      | "cancel",
  ) => {
    if (!selected) return;
    disposition.mutate({
      id: selected.id,
      action,
      coordinatorId: coordinatorId || null,
      managerId: managerId || null,
      dependencyType: dependencyType || null,
      dependencyOwner: dependencyOwner || null,
      closureSummary: closureSummary || null,
      note: note || null,
      evidenceReference: evidenceReference || null,
    });
  };

  const coordinatorUpdate = (
    status: "in_progress" | "pending_dependency" | "ready_for_verification",
  ) => {
    if (!selected) return;
    updateRequest.mutate({
      id: selected.id,
      status,
      dependencyType: dependencyType || null,
      dependencyOwner: dependencyOwner || null,
      evidenceReference: evidenceReference || null,
      note: note || null,
    });
  };

  const kpiCards = [
    {
      label: "Open",
      value: kpis?.open ?? 0,
      icon: ClipboardList,
    },
    {
      label: "Urgent / critical",
      value: kpis?.urgentCritical ?? 0,
      icon: AlertTriangle,
    },
    { label: "Overdue", value: kpis?.overdue ?? 0, icon: Clock3 },
    {
      label: "Ready for verification",
      value: kpis?.readyForVerification ?? 0,
      icon: PackageCheck,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7f7] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#397C78]">
              General Administration
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#173F3D]">
              Logistics Management & Coordination
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              GAD queue for triage, assignment, execution, dependency control,
              requester verification and accountable closure.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            Role: <span className="font-semibold">{currentRole.replace(/-/g, " ")}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <item.icon className="h-4 w-4 text-[#397C78]" />
                {item.label}
              </div>
              <p className="mt-2 text-2xl font-bold text-[#173F3D]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["attention", "Attention"],
            ["untriaged", "Untriaged"],
            ["mine", "My queue"],
            ["verification", "Verification"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setQueue(value as typeof queue)}
              className={
                queue === value
                  ? "rounded-full bg-[#245C5A] px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {message && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-[#173F3D]">Request queue</h2>
              <p className="text-xs text-slate-500">
                {visibleRequests.length} request{visibleRequests.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {isLoading && (
                <p className="p-5 text-sm text-slate-500">Loading queue...</p>
              )}
              {!isLoading && visibleRequests.length === 0 && (
                <p className="p-5 text-sm text-slate-500">
                  No requests match this queue.
                </p>
              )}
              {visibleRequests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => {
                    setSelectedId(request.id);
                    setCoordinatorId(request.logistics_coordinator_id ?? "");
                    setManagerId(request.logistics_manager_id ?? "");
                    setEvidenceReference("");
                    setDependencyType(request.dependency_type ?? "");
                    setDependencyOwner(request.dependency_owner ?? "");
                    setNote("");
                    setClosureSummary(request.closure_summary ?? "");
                    setMessage(null);
                  }}
                  className={
                    selectedId === request.id
                      ? "w-full bg-[#F0F7F6] p-4 text-left"
                      : "w-full p-4 text-left hover:bg-slate-50"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#397C78]">
                          {request.request_number}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          {request.origin_division}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {request.priority}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold text-slate-900">
                        {request.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {request.requirement}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusClass(
                        request.status,
                      )}`}
                    >
                      {STATUS_LABELS[request.status] ?? request.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selected && (
              <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500">
                <Truck className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm">
                  Select a request to manage its execution and evidence.
                </p>
              </div>
            )}

            {selected && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-[#397C78]">
                    {selected.request_number}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[#173F3D]">
                    {selected.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {selected.requirement}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>Origin: {selected.origin_division.toUpperCase()}</span>
                    <span>Service: {selected.service_type.replace(/_/g, " ")}</span>
                    <span>Priority: {selected.priority}</span>
                    <span>Verification: {selected.verification_status}</span>
                    {selected.location && (
                      <span className="col-span-2">Location: {selected.location}</span>
                    )}
                  </div>
                </div>

                {isManager && (
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2">
                      <UserRoundCog className="h-4 w-4 text-[#397C78]" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        Manager controls
                      </h3>
                    </div>
                    <select
                      value={managerId}
                      onChange={(event) => setManagerId(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select Logistics Manager</option>
                      {managerOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={coordinatorId}
                      onChange={(event) => setCoordinatorId(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select Logistics Coordinator</option>
                      {coordinatorOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Manager note / reason"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "submitted" && (
                        <button
                          onClick={() => runDisposition("triage")}
                          className="rounded-md bg-[#245C5A] px-3 py-2 text-xs font-semibold text-white"
                        >
                          Triage
                        </button>
                      )}
                      {!["closed", "cancelled", "declined"].includes(
                        selected.status,
                      ) && (
                        <button
                          onClick={() => runDisposition("assign")}
                          disabled={!coordinatorId}
                          className="rounded-md border border-[#397C78] px-3 py-2 text-xs font-semibold text-[#245C5A] disabled:opacity-40"
                        >
                          Assign
                        </button>
                      )}
                      {!["closed", "cancelled", "declined"].includes(
                        selected.status,
                      ) && (
                        <button
                          onClick={() => runDisposition("escalate")}
                          className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                        >
                          Escalate
                        </button>
                      )}
                      <button
                        onClick={() => runDisposition("return_for_information")}
                        disabled={!note}
                        className="rounded-md border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-40"
                      >
                        Request information
                      </button>
                    </div>
                    {selected.status === "ready_for_verification" && (
                      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-600">
                          Requester verification:{" "}
                          <strong>{selected.verification_status}</strong>
                        </p>
                        <textarea
                          rows={2}
                          value={closureSummary}
                          onChange={(event) =>
                            setClosureSummary(event.target.value)
                          }
                          placeholder="Closure summary"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => runDisposition("close")}
                          disabled={
                            selected.verification_status !== "verified" ||
                            !closureSummary
                          }
                          className="w-full rounded-md bg-[#245C5A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Close verified request
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(isCoordinator || isManager) && (
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-[#397C78]" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        Execution update
                      </h3>
                    </div>
                    <input
                      value={dependencyType}
                      onChange={(event) => setDependencyType(event.target.value)}
                      placeholder="Dependency type"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={dependencyOwner}
                      onChange={(event) => setDependencyOwner(event.target.value)}
                      placeholder="Dependency owner"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={evidenceReference}
                      onChange={(event) =>
                        setEvidenceReference(event.target.value)
                      }
                      placeholder="Evidence / governed record reference"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      <button
                        onClick={() => coordinatorUpdate("in_progress")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        In progress
                      </button>
                      <button
                        onClick={() => coordinatorUpdate("pending_dependency")}
                        className="rounded-md border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700"
                      >
                        Pending dependency
                      </button>
                      <button
                        onClick={() =>
                          coordinatorUpdate("ready_for_verification")
                        }
                        disabled={!evidenceReference}
                        className="rounded-md bg-[#245C5A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Ready to verify
                      </button>
                    </div>
                  </div>
                )}

                {"events" in selected && Array.isArray(selected.events) && (
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Activity
                    </h3>
                    <div className="mt-2 space-y-2">
                      {selected.events
                        .slice()
                        .reverse()
                        .slice(0, 8)
                        .map((event) => (
                          <div
                            key={event.id}
                            className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"
                          >
                            <span className="font-semibold">
                              {event.event_type.replaceAll("_", " ")}
                            </span>
                            {event.note ? ` — ${event.note}` : ""}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-[#F0F7F6] px-3 py-2 text-xs text-[#245C5A]">
                  Logistics coordinates the work. Clinical, residential, HR,
                  finance, compliance and IT authorities retain their
                  professional decision rights.
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          Average open-request aging: {kpis?.averageAgingDays ?? 0} days ·
          Pending dependency: {kpis?.pendingDependency ?? 0} · Closed:{" "}
          {kpis?.closed ?? 0}
        </div>
      </div>
    </div>
  );
}
