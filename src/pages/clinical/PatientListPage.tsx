import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  Users, Search, Plus, Filter, ChevronLeft, ChevronRight,
  HeartPulse, X
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  intake: "#2563EB",
  active: "#059669",
  hold: "#D97706",
  discharged: "#6B7280",
  transferred: "#7C3AED",
};

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  active: "Active",
  hold: "On Hold",
  discharged: "Discharged",
  transferred: "Transferred",
};

export function PatientListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = trpc.bhc.listPatients.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize,
  });

  const { data: plansData } = trpc.bhc.listInsurancePlans.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "" as string,
    phone: "",
    email: "",
    address: "",
    insuranceId: "",
    emergencyName: "",
    emergencyPhone: "",
    referralSource: "",
    assignedClinicianId: "",
  });

  const createPatient = trpc.bhc.createPatient.useMutation({
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm({ firstName: "", lastName: "", dateOfBirth: "", gender: "", phone: "", email: "", address: "", insuranceId: "", emergencyName: "", emergencyPhone: "", referralSource: "", assignedClinicianId: "" });
      window.location.reload();
    },
  });

  const statuses = ["all", "intake", "active", "hold", "discharged", "transferred"];
  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Patient Registry
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              {data?.total ?? 0} patients in system
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
          >
            <Plus size={16} />
            New Patient
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] rounded-lg border px-3 py-2" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <Search size={16} style={{ color: "var(--topbar-subtitle)" }} />
            <input
              type="text"
              placeholder="Search by name, MRN, or email..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: "var(--topbar-title)" }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && <X size={14} className="cursor-pointer" onClick={() => { setSearch(""); setPage(1); }} style={{ color: "var(--topbar-subtitle)" }} />}
          </div>
          <div className="flex items-center gap-1">
            <Filter size={14} style={{ color: "var(--topbar-subtitle)" }} />
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
                style={{
                  backgroundColor: statusFilter === s ? "#245C5A" : "var(--card-bg)",
                  color: statusFilter === s ? "#fff" : "var(--topbar-subtitle)",
                  border: `1px solid ${statusFilter === s ? "#245C5A" : "var(--card-border)"}`,
                }}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: "var(--card-bg)", borderBottom: `1px solid var(--card-border)` }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>MRN</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Name</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>DOB</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Status</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Phone</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Clinician</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Intake</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>
                    Loading patients...
                  </td>
                </tr>
              )}
              {!isLoading && data?.patients.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>
                    No patients found
                  </td>
                </tr>
              )}
              {data?.patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderBottom: `1px solid var(--card-border)` }}
                  onClick={() => navigate(`/clinical/patients/${patient.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {patient.mrn}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: "var(--topbar-title)" }}>
                      {patient.lastName}, {patient.firstName}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>
                    {new Date(patient.dateOfBirth).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: (STATUS_COLORS[patient.status] ?? "#6B7280") + "15",
                        color: STATUS_COLORS[patient.status] ?? "#6B7280",
                      }}
                    >
                      {STATUS_LABELS[patient.status] ?? patient.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>
                    {patient.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>
                    {patient.assignedClinicianId ? patient.assignedClinicianId.slice(0, 8) + "..." : "Unassigned"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>
                    {new Date(patient.intakeDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
              Page {page} of {totalPages} ({data?.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border disabled:opacity-30"
                style={{ borderColor: "var(--card-border)" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border disabled:opacity-30"
                style={{ borderColor: "var(--card-border)" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Patient Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <HeartPulse size={18} style={{ color: "#245C5A" }} />
                New Patient Intake
              </h2>
              <X size={18} className="cursor-pointer" onClick={() => setShowCreate(false)} style={{ color: "var(--topbar-subtitle)" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>First Name *</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Last Name *</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Date of Birth *</label>
                <input type="date" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.dateOfBirth} onChange={(e) => setCreateForm({ ...createForm, dateOfBirth: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Gender</label>
                <select className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-Binary</option>
                  <option value="prefer_not_say">Prefer Not to Say</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Phone</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Email</label>
                <input type="email" className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Address</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Assigned Clinician ID *</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.assignedClinicianId} onChange={(e) => setCreateForm({ ...createForm, assignedClinicianId: e.target.value })} placeholder="Person UUID from HR" />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Referral Source</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.referralSource} onChange={(e) => setCreateForm({ ...createForm, referralSource: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Emergency Contact</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.emergencyName} onChange={(e) => setCreateForm({ ...createForm, emergencyName: e.target.value })} placeholder="Name" />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Emergency Phone</label>
                <input className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} value={createForm.emergencyPhone} onChange={(e) => setCreateForm({ ...createForm, emergencyPhone: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border"
                style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!createForm.firstName || !createForm.lastName || !createForm.dateOfBirth || !createForm.assignedClinicianId) return;
                  createPatient.mutate(createForm);
                }}
                disabled={createPatient.isPending || !createForm.firstName || !createForm.lastName || !createForm.dateOfBirth || !createForm.assignedClinicianId}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#245C5A" }}
              >
                {createPatient.isPending ? "Creating..." : "Create Patient"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
