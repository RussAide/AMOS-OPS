import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Link2,
  ListTodo,
  PackageCheck,
  Route,
  Users,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";
import { appRoutePath } from "@/data/app-route-registry";

export type LogisticsWorkspaceView =
  | "command"
  | "manager"
  | "coordinator"
  | "coordination"
  | "workplans"
  | "verification";

const MANAGER_ROLES = new Set([
  "logistics-manager",
  "super-admin",
  "managing-director",
  "administrator",
]);

const TERMINAL = new Set(["closed", "cancelled", "declined"]);

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

const WORKFLOW = [
  ["Intake", "submitted"],
  ["Triage", "triage"],
  ["Plan & Assign", "assigned"],
  ["Execute", "in_progress"],
  ["Dependency Follow-up", "pending_dependency"],
  ["Verify", "ready_for_verification"],
  ["Close", "closed"],
] as const;

const VIEW_TITLES: Record<LogisticsWorkspaceView, [string, string]> = {
  command: [
    "Logistics Management & Coordination",
    "One governed operating record for shared-service planning, assignment, execution, dependencies, verification and closure.",
  ],
  manager: [
    "Logistics Manager Workspace",
    "Triage demand, set priorities, balance coordinator workload, resolve dependencies and control accountable closure.",
  ],
  coordinator: [
    "Logistics Coordinator Workspace",
    "Run today’s assigned work, schedule follow-ups, manage dependencies, handoffs and completion evidence.",
  ],
  coordination: [
    "Service Coordination Board",
    "See how BHC, GRO, GAD and Executive Office requirements move through shared logistics support.",
  ],
  workplans: [
    "Workplans & Schedule",
    "Persistent Logistics Manager and Logistics Coordinator actions tied directly to governed request records.",
  ],
  verification: [
    "Verification & Closeout",
    "Return completed work to the requesting operation, capture verification and complete accountable closure.",
  ],
};

function statusClass(status: string) {
  if (status === "closed")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "escalated")
    return "border-red-200 bg-red-50 text-red-700";
  if (status === "ready_for_verification")
    return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "pending_dependency" || status === "returned_for_information")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value.slice(0, 10)
    : parsed.toLocaleDateString();
}

function requestClass(selected: boolean) {
  return (
    "w-full rounded-xl border p-3 text-left transition " +
    (selected
      ? "border-[#245C5A] bg-teal-50"
      : "border-slate-200 bg-white hover:border-teal-300")
  );
}

export default function LogisticsManagementWorkspace({
  view = "command",
}: {
  view?: LogisticsWorkspaceView;
}) {
  const navigate = useNavigate();
  const { currentRole, user } = useAuth();
  const utils = trpc.useUtils();
  const isManager = MANAGER_ROLES.has(currentRole);
  const isCoordinator = currentRole === "logistics-coordinator";
  const isOperator = isManager || isCoordinator;

  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("");
  const [dependencyOwner, setDependencyOwner] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [closureSummary, setClosureSummary] = useState("");
  const [workplanOwnerId, setWorkplanOwnerId] = useState("");
  const [workplanTitle, setWorkplanTitle] = useState("");
  const [workplanAction, setWorkplanAction] = useState<
    | "plan"
    | "schedule"
    | "follow_up"
    | "dependency"
    | "handoff"
    | "evidence"
    | "verification"
    | "coordination"
  >("coordination");
  const [plannedFor, setPlannedFor] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueAt, setDueAt] = useState("");
  const [workplanNote, setWorkplanNote] = useState("");
  const [message, setMessage] = useState("");

  const { data: requests = [], isLoading } =
    trpc.gad.listLogisticsRequests.useQuery();
  const { data: kpis } = trpc.gad.logisticsKPIs.useQuery();
  const { data: staff = [] } = trpc.gad.listAssignableLogisticsStaff.useQuery(
    undefined,
    { enabled: isOperator },
  );
  const { data: workplan = [] } =
    trpc.gad.listLogisticsWorkplanItems.useQuery(undefined, {
      enabled: isOperator,
    });

  const selected = requests.find((request) => request.id === selectedRequestId);

  const staffName = (id: string | null | undefined) => {
    if (!id) return "Unassigned";
    const member = staff.find((item) => item.id === id);
    return member
      ? member.firstName + " " + member.lastName
      : id;
  };

  const refresh = async () => {
    await Promise.all([
      utils.gad.listLogisticsRequests.invalidate(),
      utils.gad.logisticsKPIs.invalidate(),
      utils.gad.listAssignableLogisticsStaff.invalidate(),
      utils.gad.listLogisticsWorkplanItems.invalidate(),
    ]);
  };

  const disposition = trpc.gad.approveLogisticsDisposition.useMutation({
    onSuccess: async () => {
      await refresh();
      setMessage("Manager action recorded.");
    },
    onError: (error) => setMessage(error.message),
  });

  const updateRequest = trpc.gad.updateLogisticsRequest.useMutation({
    onSuccess: async () => {
      await refresh();
      setMessage("Coordinator action recorded.");
    },
    onError: (error) => setMessage(error.message),
  });

  const createWorkplan = trpc.gad.createLogisticsWorkplanItem.useMutation({
    onSuccess: async () => {
      await refresh();
      setWorkplanTitle("");
      setWorkplanNote("");
      setDueAt("");
      setMessage("Workplan action created.");
    },
    onError: (error) => setMessage(error.message),
  });

  const updateWorkplan = trpc.gad.updateLogisticsWorkplanItem.useMutation({
    onSuccess: async () => {
      await refresh();
      setMessage("Workplan action updated.");
    },
    onError: (error) => setMessage(error.message),
  });

  const openRequests = requests.filter(
    (request) => !TERMINAL.has(request.status),
  );

  const managerQueue = requests.filter(
    (request) =>
      !TERMINAL.has(request.status) &&
      ([
        "submitted",
        "triage",
        "returned_for_information",
        "escalated",
        "pending_dependency",
        "ready_for_verification",
      ].includes(request.status) ||
        !request.logistics_coordinator_id),
  );

  const coordinatorQueue = requests.filter(
    (request) =>
      !TERMINAL.has(request.status) &&
      (isCoordinator
        ? request.logistics_coordinator_id === user?.id
        : Boolean(request.logistics_coordinator_id)),
  );

  const verificationQueue = requests.filter(
    (request) => request.status === "ready_for_verification",
  );

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);

  const visibleWorkplan = isCoordinator
    ? workplan.filter((item) => item.owner_user_id === user?.id)
    : workplan;

  const todayPlan = visibleWorkplan.filter(
    (item) =>
      item.planned_for.slice(0, 10) === today &&
      item.status !== "cancelled",
  );

  const weekPlan = visibleWorkplan.filter((item) => {
    const key = item.planned_for.slice(0, 10);
    return (
      key >= today &&
      key <= weekEndKey &&
      item.status !== "cancelled"
    );
  });

  const coordinatorLoad = useMemo(
    () =>
      staff
        .filter((member) => member.role === "logistics-coordinator")
        .map((member) => ({
          ...member,
          open: openRequests.filter(
            (request) => request.logistics_coordinator_id === member.id,
          ).length,
          blockers: openRequests.filter(
            (request) =>
              request.logistics_coordinator_id === member.id &&
              ["pending_dependency", "escalated"].includes(request.status),
          ).length,
        })),
    [openRequests, staff],
  );

  const divisionBoard = ["bhc", "gro", "gad", "eo"].map((division) => ({
    division,
    open: openRequests.filter(
      (request) => request.origin_division === division,
    ),
  }));

  const defaultOwnerId =
    workplanOwnerId ||
    ((currentRole === "logistics-manager" || isCoordinator) && user?.id
      ? user.id
      : "");

  const createPlan = () => {
    if (!selectedRequestId || !defaultOwnerId || !workplanTitle.trim()) {
      setMessage("Select a request, operational owner and workplan action.");
      return;
    }
    const request = requests.find((item) => item.id === selectedRequestId);
    createWorkplan.mutate({
      requestId: selectedRequestId,
      ownerUserId: defaultOwnerId,
      title: workplanTitle.trim(),
      actionType: workplanAction,
      priority: request?.priority ?? "routine",
      plannedFor,
      dueAt: dueAt || null,
      dependencyOwner: dependencyOwner || null,
      handoffTo: null,
      notes: workplanNote || null,
    });
  };

  const actAsManager = (
    action:
      | "triage"
      | "assign"
      | "escalate"
      | "return_for_information"
      | "close",
  ) => {
    if (!selected) return;
    disposition.mutate({
      id: selected.id,
      action,
      coordinatorId:
        selectedCoordinatorId ||
        selected.logistics_coordinator_id ||
        null,
      managerId: selected.logistics_manager_id || null,
      dependencyType: selected.dependency_type || null,
      dependencyOwner:
        dependencyOwner || selected.dependency_owner || null,
      closureSummary: closureSummary || null,
      note: null,
      evidenceReference: evidenceReference || null,
    });
  };

  const actAsCoordinator = (
    status:
      | "in_progress"
      | "pending_dependency"
      | "ready_for_verification",
  ) => {
    if (!selected) return;
    updateRequest.mutate({
      id: selected.id,
      status,
      dependencyType: selected.dependency_type || null,
      dependencyOwner:
        dependencyOwner || selected.dependency_owner || null,
      evidenceReference: evidenceReference || null,
      note: null,
    });
  };

  const navigation = [
    ["Command Center", "logistics-workspace"],
    ["Manager", "logistics-manager"],
    ["Coordinator", "logistics-coordinator"],
    ["Coordination", "logistics-service-coordination"],
    ["Workplans", "logistics-workplans"],
    ["Verification", "logistics-verification"],
  ] as const;

  const requestCard = (request: (typeof requests)[number]) => (
    <button
      key={request.id}
      type="button"
      onClick={() => {
        setSelectedRequestId(request.id);
        setSelectedCoordinatorId(
          request.logistics_coordinator_id ?? "",
        );
        setDependencyOwner(request.dependency_owner ?? "");
      }}
      className={requestClass(selectedRequestId === request.id)}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>{request.request_number}</span>
        <span>{request.origin_division.toUpperCase()}</span>
        <span>{request.service_type.replace(/_/g, " ")}</span>
        <span
          className={
            "rounded-full border px-2 py-0.5 normal-case " +
            statusClass(request.status)
          }
        >
          {STATUS_LABELS[request.status] ?? request.status}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">
        {request.title}
      </p>
      <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
        <span>
          Coordinator: {staffName(request.logistics_coordinator_id)}
        </span>
        <span>Need by: {shortDate(request.need_by)}</span>
        <span>
          Dependency: {request.dependency_owner || "None recorded"}
        </span>
      </div>
    </button>
  );

  const renderSelectionControls = () => {
    if (!selected) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Select a governed Logistics request to expose its next
          operational actions.
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              {selected.request_number} ·{" "}
              {selected.origin_division.toUpperCase()}
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">
              {selected.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {selected.requirement}
            </p>
          </div>
          <span
            className={
              "rounded-full border px-2 py-1 text-xs font-medium " +
              statusClass(selected.status)
            }
          >
            {STATUS_LABELS[selected.status] ?? selected.status}
          </span>
        </div>

        {isManager && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Logistics Manager controls
            </p>
            <select
              value={selectedCoordinatorId}
              onChange={(event) =>
                setSelectedCoordinatorId(event.target.value)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Logistics Coordinator</option>
              {staff
                .filter(
                  (member) =>
                    member.role === "logistics-coordinator",
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => actAsManager("triage")}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
              >
                Triage
              </button>
              <button
                type="button"
                onClick={() => actAsManager("assign")}
                disabled={!selectedCoordinatorId}
                className="rounded-lg bg-[#245C5A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                Assign
              </button>
              <button
                type="button"
                onClick={() => actAsManager("escalate")}
                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700"
              >
                Escalate
              </button>
            </div>
            {selected.status === "ready_for_verification" && (
              <>
                <textarea
                  value={closureSummary}
                  onChange={(event) =>
                    setClosureSummary(event.target.value)
                  }
                  placeholder="Closure summary after requester verification"
                  className="min-h-20 rounded-lg border border-slate-300 p-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => actAsManager("close")}
                  disabled={
                    selected.verification_status !== "verified" ||
                    !closureSummary
                  }
                  className="w-fit rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Close verified request
                </button>
              </>
            )}
          </div>
        )}

        {isCoordinator &&
          selected.logistics_coordinator_id === user?.id && (
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Logistics Coordinator execution
              </p>
              <input
                value={dependencyOwner}
                onChange={(event) =>
                  setDependencyOwner(event.target.value)
                }
                placeholder="Dependency owner / service contact"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={evidenceReference}
                onChange={(event) =>
                  setEvidenceReference(event.target.value)
                }
                placeholder="Completion evidence reference"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => actAsCoordinator("in_progress")}
                  className="rounded-lg bg-[#245C5A] px-3 py-2 text-xs font-semibold text-white"
                >
                  Start / continue
                </button>
                <button
                  type="button"
                  onClick={() =>
                    actAsCoordinator("pending_dependency")
                  }
                  className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800"
                >
                  Waiting on dependency
                </button>
                <button
                  type="button"
                  onClick={() =>
                    actAsCoordinator("ready_for_verification")
                  }
                  disabled={!evidenceReference}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Ready for verification
                </button>
              </div>
            </div>
          )}
      </div>
    );
  };

  const renderWorkplans = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-teal-700" />
          <h2 className="font-semibold text-slate-900">
            Create workplan action
          </h2>
        </div>
        {!isOperator ? (
          <p className="mt-3 text-sm text-slate-600">
            Workplan authoring is limited to authorized Logistics
            roles.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            <select
              value={selectedRequestId}
              onChange={(event) =>
                setSelectedRequestId(event.target.value)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select governed request</option>
              {openRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.request_number} · {request.title}
                </option>
              ))}
            </select>
            <select
              value={defaultOwnerId}
              onChange={(event) =>
                setWorkplanOwnerId(event.target.value)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select operational owner</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} ·{" "}
                  {member.role.replace(/-/g, " ")}
                </option>
              ))}
            </select>
            <input
              value={workplanTitle}
              onChange={(event) =>
                setWorkplanTitle(event.target.value)
              }
              placeholder="Action / next step"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={workplanAction}
                onChange={(event) =>
                  setWorkplanAction(
                    event.target.value as typeof workplanAction,
                  )
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="coordination">Coordination</option>
                <option value="plan">Plan</option>
                <option value="schedule">Schedule</option>
                <option value="follow_up">Follow-up</option>
                <option value="dependency">Dependency</option>
                <option value="handoff">Handoff</option>
                <option value="evidence">Evidence</option>
                <option value="verification">Verification</option>
              </select>
              <input
                type="date"
                value={plannedFor}
                onChange={(event) =>
                  setPlannedFor(event.target.value)
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <input
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              value={workplanNote}
              onChange={(event) =>
                setWorkplanNote(event.target.value)
              }
              placeholder="Dependencies, handoff context or execution notes"
              className="min-h-20 rounded-lg border border-slate-300 p-3 text-sm"
            />
            <button
              type="button"
              onClick={createPlan}
              className="w-fit rounded-lg bg-[#245C5A] px-4 py-2 text-sm font-semibold text-white"
            >
              Add to workplan
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">My Today</h2>
          <div className="mt-3 grid gap-2">
            {todayPlan.length === 0 ? (
              <p className="text-sm text-slate-500">
                No actions planned for today.
              </p>
            ) : (
              todayPlan.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.action_type.replace(/_/g, " ")} ·{" "}
                        {staffName(item.owner_user_id)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {item.status !== "completed" &&
                    item.status !== "cancelled" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkplan.mutate({
                              id: item.id,
                              status: "in_progress",
                            })
                          }
                          className="text-xs font-semibold text-teal-700"
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkplan.mutate({
                              id: item.id,
                              status: "waiting",
                            })
                          }
                          className="text-xs font-semibold text-amber-700"
                        >
                          Waiting
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateWorkplan.mutate({
                              id: item.id,
                              status: "completed",
                            })
                          }
                          className="text-xs font-semibold text-emerald-700"
                        >
                          Complete
                        </button>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">
            Next 7 days
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {weekPlan.length} planned action
            {weekPlan.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 grid gap-2">
            {weekPlan.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {item.title}
                </span>
                <span className="text-xs text-slate-500">
                  {shortDate(item.planned_for)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const [title, subtitle] = VIEW_TITLES[view];

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">
              Shared Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173F3D] md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Signed in as{" "}
            <span className="font-semibold">
              {currentRole.replace(/-/g, " ")}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {navigation.map(([label, id]) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(appRoutePath(id))}
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(appRoutePath("logistics"))}
            className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
          >
            Requests & Intake
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-800">
          {message}
        </div>
      )}

      {view === "command" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <AlertTriangle className="h-4 w-4 text-teal-700" />
                Needs manager action
              </p>
              <p className="mt-2 text-2xl font-bold text-[#173F3D]">
                {managerQueue.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ClipboardList className="h-4 w-4 text-teal-700" />
                Coordinator work
              </p>
              <p className="mt-2 text-2xl font-bold text-[#173F3D]">
                {coordinatorQueue.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Link2 className="h-4 w-4 text-teal-700" />
                Dependencies
              </p>
              <p className="mt-2 text-2xl font-bold text-[#173F3D]">
                {kpis?.pendingDependency ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <PackageCheck className="h-4 w-4 text-teal-700" />
                Ready to verify
              </p>
              <p className="mt-2 text-2xl font-bold text-[#173F3D]">
                {kpis?.readyForVerification ?? 0}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-teal-700" />
              <h2 className="font-semibold text-slate-900">
                One accountable operating path
              </h2>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-7">
              {WORKFLOW.map(([label, status], index) => (
                <div
                  key={status}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {index + 1}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {
                      requests.filter(
                        (request) => request.status === status,
                      ).length
                    }{" "}
                    current
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                navigate(appRoutePath("logistics-manager"))
              }
              className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-teal-300"
            >
              <div className="flex items-center gap-2 text-teal-800">
                <Users className="h-5 w-5" />
                <h2 className="font-semibold">
                  Logistics Manager Workspace
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Triage, assignment, workload balancing, escalations,
                verification and closeout.
              </p>
              <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-700">
                Open manager workspace{" "}
                <ArrowRight className="h-3 w-3" />
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(appRoutePath("logistics-coordinator"))
              }
              className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-teal-300"
            >
              <div className="flex items-center gap-2 text-teal-800">
                <CalendarDays className="h-5 w-5" />
                <h2 className="font-semibold">
                  Logistics Coordinator Workspace
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Today, this week, assigned requests, follow-ups,
                dependencies, handoffs and evidence.
              </p>
              <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-700">
                Open coordinator workspace{" "}
                <ArrowRight className="h-3 w-3" />
              </p>
            </button>
          </section>
        </>
      )}

      {view === "manager" && (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">
                Manager action queue
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Triage → prioritize → assign → monitor → resolve /
                escalate → verify → close.
              </p>
            </div>
            {isLoading ? (
              <p className="text-sm text-slate-500">
                Loading Logistics work...
              </p>
            ) : managerQueue.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No requests require manager action.
              </p>
            ) : (
              managerQueue.map(requestCard)
            )}
          </section>

          <section className="space-y-4">
            {renderSelectionControls()}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">
                Coordinator workload
              </h2>
              <div className="mt-3 grid gap-2">
                {coordinatorLoad.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member.open} open · {member.blockers} blockers
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWorkplanOwnerId(member.id)}
                      className="text-xs font-semibold text-teal-700"
                    >
                      Plan work
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {view === "coordinator" && (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">
                My execution queue
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Assigned work → schedule → follow-up → dependency /
                handoff → evidence → ready for verification.
              </p>
            </div>
            {coordinatorQueue.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No assigned coordinator work.
              </p>
            ) : (
              coordinatorQueue.map(requestCard)
            )}
          </section>

          <section className="space-y-4">
            {renderSelectionControls()}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900">
                My Today / My Week
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-teal-50 p-3">
                  <p className="text-xs text-teal-700">Today</p>
                  <p className="mt-1 text-2xl font-bold text-teal-900">
                    {todayPlan.length}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">
                    Next 7 days
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {weekPlan.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(appRoutePath("logistics-workplans"))
                }
                className="mt-3 text-xs font-semibold text-teal-700"
              >
                Open workplans & schedule →
              </button>
            </div>
          </section>
        </div>
      )}

      {view === "coordination" && (
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {divisionBoard.map(({ division, open }) => (
              <div
                key={division}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {division}
                </p>
                <p className="mt-2 text-2xl font-bold text-[#173F3D]">
                  {open.length}
                </p>
                <p className="text-xs text-slate-500">
                  open service requests
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">
              Requesting operation ↔ Logistics interaction
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Requester submits → Manager triages → Coordinator
              executes → dependencies and handoffs remain on the same
              record → requester verifies → Manager closes.
            </p>
            <div className="mt-4 grid gap-3">
              {openRequests.map(requestCard)}
            </div>
          </section>
        </div>
      )}

      {view === "workplans" && renderWorkplans()}

      {view === "verification" && (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <h2 className="font-semibold text-slate-900">
                  Awaiting requester verification
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                The requesting operation remains part of the workflow
                until it verifies or returns completed work.
              </p>
            </div>
            {verificationQueue.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Nothing is awaiting verification.
              </p>
            ) : (
              verificationQueue.map(requestCard)
            )}
          </section>
          <section>{renderSelectionControls()}</section>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <span className="font-semibold text-slate-800">
          Operating record:
        </span>{" "}
        AMOS-OPS is the permanent governed Logistics operating
        environment. Startup messaging, including WhatsApp, may
        support coordination but does not replace the request,
        workplan, dependency, evidence, verification or closure
        record.
      </section>
    </div>
  );
}
