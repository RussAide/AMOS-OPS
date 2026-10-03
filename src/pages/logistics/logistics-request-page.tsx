import { type FormEvent, useMemo, useState } from "react";
import { ClipboardList, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { trpc } from "@/providers/trpc";

const SERVICE_TYPES = [
  ["facilities", "Facilities / maintenance"],
  ["procurement", "Procurement / purchasing"],
  ["inventory", "Inventory / supplies"],
  ["vendor", "Vendor / contract coordination"],
  ["transportation", "Transportation / movement"],
  ["equipment", "Equipment / asset support"],
  ["technology", "Technology logistics"],
  ["workforce_training", "Workforce / training logistics"],
  ["safety_emergency", "Safety / emergency preparedness"],
  ["regulatory_support", "Regulatory-support logistics"],
  ["other", "Other operational support"],
] as const;

const PRIORITIES = [
  ["routine", "Routine"],
  ["priority", "Priority"],
  ["urgent", "Urgent"],
  ["critical", "Critical"],
] as const;

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  triage: "In triage",
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
  if (status === "escalated" || status === "critical")
    return "bg-red-50 text-red-700 border-red-200";
  if (status === "ready_for_verification")
    return "bg-teal-50 text-teal-700 border-teal-200";
  if (status === "pending_dependency" || status === "returned_for_information")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function LogisticsRequestPage() {
  const utils = trpc.useUtils();
  const { data: requests = [], isLoading } =
    trpc.logistics.listMyRequests.useQuery();
  const [serviceType, setServiceType] =
    useState<(typeof SERVICE_TYPES)[number][0]>("facilities");
  const [priority, setPriority] =
    useState<(typeof PRIORITIES)[number][0]>("routine");
  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState("");
  const [location, setLocation] = useState("");
  const [needBy, setNeedBy] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const openCount = useMemo(
    () =>
      requests.filter(
        (request) =>
          !["closed", "declined", "cancelled"].includes(request.status),
      ).length,
    [requests],
  );

  const createRequest = trpc.logistics.createRequest.useMutation({
    onSuccess: async (request) => {
      await utils.logistics.listMyRequests.invalidate();
      setTitle("");
      setRequirement("");
      setLocation("");
      setNeedBy("");
      setPriority("routine");
      setMessage(`${request.request_number} submitted to GAD Logistics.`);
    },
    onError: (error) => setMessage(error.message),
  });

  const verifyRequest = trpc.logistics.recordMyVerification.useMutation({
    onSuccess: async () => {
      await utils.logistics.listMyRequests.invalidate();
      setMessage("Verification recorded.");
    },
    onError: (error) => setMessage(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    createRequest.mutate({
      serviceType,
      priority,
      title,
      requirement,
      location: location.trim() || null,
      needBy: needBy || null,
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f7f7] p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#397C78]">
            General Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#173F3D]">
            Request Logistics Support
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Submit an operational requirement to GAD Logistics and track it
            through triage, assignment, execution, verification and closure.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Do not enter clinical narrative, client identifiers, personnel
              records, credentials or detailed financial information here.
              Reference the governed source record when restricted information
              is required.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_1.4fr]">
          <form
            onSubmit={submit}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-[#E8F3F2] p-2 text-[#245C5A]">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[#173F3D]">New request</h2>
                <p className="text-xs text-slate-500">
                  Your division is derived from your authenticated role.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Service
                </span>
                <select
                  value={serviceType}
                  onChange={(event) =>
                    setServiceType(
                      event.target.value as (typeof SERVICE_TYPES)[number][0],
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {SERVICE_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Priority
                </span>
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value as (typeof PRIORITIES)[number][0],
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {PRIORITIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Requirement
                </span>
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Short operational requirement"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  What is needed?
                </span>
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={5}
                  value={requirement}
                  onChange={(event) => setRequirement(event.target.value)}
                  placeholder="Describe the operational need and completion condition."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Location
                  </span>
                  <input
                    maxLength={240}
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Facility / room / area"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Need by
                  </span>
                  <input
                    type="date"
                    value={needBy}
                    onChange={(event) => setNeedBy(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={createRequest.isPending}
                className="w-full rounded-lg bg-[#245C5A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createRequest.isPending ? "Submitting..." : "Submit to GAD Logistics"}
              </button>
              {message && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {message}
                </p>
              )}
            </div>
          </form>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#E8F3F2] p-2 text-[#245C5A]">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-[#173F3D]">My requests</h2>
                  <p className="text-xs text-slate-500">
                    {openCount} open request{openCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading && (
                <p className="p-5 text-sm text-slate-500">Loading requests...</p>
              )}
              {!isLoading && requests.length === 0 && (
                <p className="p-5 text-sm text-slate-500">
                  No Logistics requests have been submitted.
                </p>
              )}
              {requests.map((request) => (
                <article key={request.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#397C78]">
                        {request.request_number}
                      </p>
                      <h3 className="mt-1 font-semibold text-slate-900">
                        {request.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.requirement}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                        request.status,
                      )}`}
                    >
                      {STATUS_LABELS[request.status] ?? request.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span>Priority: {request.priority}</span>
                    <span>Service: {request.service_type.replaceAll("_", " ")}</span>
                    {request.need_by && <span>Need by: {request.need_by}</span>}
                    <span>
                      Submitted: {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {request.status === "ready_for_verification" && (
                    <div className="flex flex-wrap gap-2 rounded-lg border border-teal-100 bg-teal-50 p-3">
                      <div className="mr-auto flex items-center gap-2 text-sm text-teal-900">
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm whether the requirement was satisfied.
                      </div>
                      <button
                        onClick={() =>
                          verifyRequest.mutate({
                            id: request.id,
                            outcome: "returned",
                            note: "Requester returned the item for follow-up.",
                          })
                        }
                        className="rounded-md border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800"
                      >
                        Needs follow-up
                      </button>
                      <button
                        onClick={() =>
                          verifyRequest.mutate({
                            id: request.id,
                            outcome: "verified",
                            note: "Requester verified completion.",
                          })
                        }
                        className="rounded-md bg-[#245C5A] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Confirm complete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
