import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, Users, ShieldCheck,
  AlertTriangle, CheckCircle, UserPlus,
  FileText, Calendar, Ban
} from "lucide-react";
import { useState } from "react";
import { useHR } from "@/context/HRContext";
import { getHRModule, getModuleStatusOptions } from "@/data/hrLifecycleData";
import { DocumentUpload } from "@/components/hr/DocumentUpload";

export function HRModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { people, updatePersonStatus, getDocumentCompleteness, getDocumentsForPersonAndModule } = useHR();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [expandedDocRow, setExpandedDocRow] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState({
    firstName: "", lastName: "", employeeId: "", role: "Clinical Staff",
    department: "Behavioral Health", supervisor: "", isEmployee: false,
  });

  const mod = moduleId ? getHRModule(moduleId) : undefined;
  const statuses = moduleId ? getModuleStatusOptions(moduleId) : [];

  if (!mod) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-[18px] font-bold mb-2" style={{ color: "var(--topbar-title)" }}>Module Not Found</h2>
        <button onClick={() => navigate("/hr")} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>
          Back to Command Center
        </button>
      </div>
    );
  }

  const modulePeople = people.filter((p) => moduleId && moduleId in p.moduleStatuses);
  const filteredPeople = modulePeople
    .filter((p) => (statusFilter === "all" ? true : p.moduleStatuses[moduleId!] === statusFilter))
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.employeeId.toLowerCase().includes(q) ||
        p.supervisor.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q);
    });

  const statusCounts: Record<string, number> = { all: modulePeople.length };
  statuses.forEach((s) => { statusCounts[s.id] = modulePeople.filter((p) => p.moduleStatuses[moduleId!] === s.id).length; });

  const handleStatusChange = (personId: string, newStatusId: string) => {
    setGateError(null);
    // Check gate rules
    const gate = mod.gateRules.find((g) => g.blocksAdvancementTo.includes(newStatusId));
    if (gate) {
      const person = people.find((p) => p.id === personId);
      const hasRequired = gate.requiredStatusIds.some((req) =>
        Object.entries(person?.moduleStatuses || {}).some(([_, v]) => v === req)
      );
      if (!hasRequired) {
        setGateError(`${gate.id}: ${gate.description}`);
        return;
      }
    }
    updatePersonStatus(personId, moduleId!, newStatusId);
  };

  const handleAddPerson = () => {
    if (!newPerson.firstName || !newPerson.lastName) return;
    // In real implementation, this would add to the context
    setShowAddForm(false);
    setNewPerson({ firstName: "", lastName: "", employeeId: "", role: "Clinical Staff", department: "Behavioral Health", supervisor: "", isEmployee: false });
  };

  // Module-specific actions
  const getActions = () => {
    const base = [
      { label: "Add Candidate", icon: UserPlus, onClick: () => setShowAddForm(true) },
    ];
    const specific: Record<string, Array<{ label: string; icon: typeof FileText; onClick?: () => void }>> = {
      recruitment: [{ label: "Create Position", icon: FileText }, { label: "Post Job", icon: FileText }],
      screening: [{ label: "Schedule Interview", icon: Calendar }, { label: "Record Scorecard", icon: FileText }],
      offers: [{ label: "Generate Offer", icon: FileText }, { label: "Send Packet", icon: FileText }],
      orientation: [{ label: "Assign Orientation", icon: Calendar }, { label: "Record Attendance", icon: FileText }],
      onboarding: [{ label: "Assign Training", icon: FileText }, { label: "Record Quiz", icon: FileText }],
      clearance: [{ label: "Initiate Review", icon: ShieldCheck }, { label: "Record Decision", icon: FileText }],
      "personnel-files": [{ label: "Upload Document", icon: FileText }, { label: "Run Audit", icon: FileText }],
      credentials: [{ label: "Add Credential", icon: FileText }, { label: "Verify License", icon: ShieldCheck }],
      performance: [{ label: "Document Issue", icon: FileText }, { label: "Action Plan", icon: FileText }],
      compliance: [{ label: "Schedule Audit", icon: Calendar }, { label: "Record Deficiency", icon: AlertTriangle }],
      separation: [{ label: "Initiate Separation", icon: Ban }, { label: "Offboarding Checklist", icon: FileText }],
    };
    return [...base, ...(specific[moduleId || ""] || [])];
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/hr")} className="flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{mod.name}</span>
      </div>

      {/* Module Header */}
      <div className="rounded-lg border p-5 mb-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
              <Users size={20} style={{ color: "#245C5A" }} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>{mod.name}</h1>
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>{mod.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {getActions().map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:shadow-sm"
            style={{ backgroundColor: i === 0 ? "#245C5A" : "#F0FDFA", color: i === 0 ? "#fff" : "#245C5A", border: i === 0 ? "none" : "1px solid #245C5A" }}
          >
            <action.icon size={14} />
            {action.label}
          </button>
        ))}
      </div>

      {/* Add Person Form */}
      {showAddForm && (
        <div className="rounded-lg border p-4 mb-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Add New Person</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input placeholder="First Name *" value={newPerson.firstName} onChange={(e) => setNewPerson({ ...newPerson, firstName: e.target.value })} className="px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} />
            <input placeholder="Last Name *" value={newPerson.lastName} onChange={(e) => setNewPerson({ ...newPerson, lastName: e.target.value })} className="px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} />
            <input placeholder="Employee ID (optional)" value={newPerson.employeeId} onChange={(e) => setNewPerson({ ...newPerson, employeeId: e.target.value })} className="px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} />
            <input placeholder="Role" value={newPerson.role} onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })} className="px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} />
            <input placeholder="Department" value={newPerson.department} onChange={(e) => setNewPerson({ ...newPerson, department: e.target.value })} className="px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} />
            <input placeholder="Supervisor" value={newPerson.supervisor} onChange={(e) => setNewPerson({ ...newPerson, supervisor: e.target.value })} className="px-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)" }} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddPerson} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>Add Person</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Gate Error */}
      {gateError && (
        <div className="rounded-lg border p-3 mb-4 flex items-center gap-2" style={{ borderColor: "#FECACA", backgroundColor: "#FEE2E2" }}>
          <AlertTriangle size={16} style={{ color: "#DC2626" }} />
          <p className="text-[12px] font-medium" style={{ color: "#991B1B" }}>{gateError}</p>
          <button onClick={() => setGateError(null)} className="ml-auto text-[11px]" style={{ color: "#991B1B" }}>Dismiss</button>
        </div>
      )}

      {/* Required Records & Gates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {mod.requiredRecords.length > 0 && (
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[13px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>Required Records ({mod.requiredRecords.length})</h3>
            <div className="flex flex-wrap gap-2">
              {mod.requiredRecords.map((rec) => (
                <span key={rec} className="text-[11px] font-medium px-2.5 py-1 rounded flex items-center gap-1" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                  <FileText size={10} /> {rec}
                </span>
              ))}
            </div>
          </div>
        )}
        {mod.gateRules.length > 0 && (
          <div className="rounded-lg border p-4" style={{ borderColor: "#FEF3C7", backgroundColor: "#FFFBEB" }}>
            <h3 className="text-[13px] font-semibold mb-2 flex items-center gap-2" style={{ color: "#92400E" }}>
              <AlertTriangle size={14} /> Gate Rules
            </h3>
            {mod.gateRules.map((gate) => (
              <p key={gate.id} className="text-[12px]" style={{ color: "#78350F" }}>
                <strong>{gate.id}:</strong> {gate.description}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, supervisor, or role..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }} />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <Filter size={14} className="mr-1 flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }} />
          <button onClick={() => setStatusFilter("all")} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex-shrink-0"
            style={{ backgroundColor: statusFilter === "all" ? "#245C5A" : "transparent", color: statusFilter === "all" ? "#fff" : "var(--topbar-subtitle)" }}>
            All ({statusCounts.all || 0})
          </button>
          {statuses.map((s) => (
            <button key={s.id} onClick={() => setStatusFilter(s.id)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex-shrink-0"
              style={{ backgroundColor: statusFilter === s.id ? s.color : "transparent", color: statusFilter === s.id ? "#fff" : s.color }}>
              {s.label} ({statusCounts[s.id] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* People Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Person</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Role</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Status</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Docs</th>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Supervisor</th>
              <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--topbar-title)" }}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {filteredPeople.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8" style={{ color: "var(--topbar-subtitle)" }}>
                <CheckCircle size={24} style={{ color: "#CBD5E1" }} className="mx-auto mb-2" />No people in this status
              </td></tr>
            ) : (
              filteredPeople.map((p) => {
                const currentStatus = statuses.find((s) => s.id === p.moduleStatuses[moduleId!]);
                const docComp = moduleId ? getDocumentCompleteness(p.id, moduleId) : { percent: 0, missing: [] as string[], uploaded: [] as string[] };
                const docsOpen = expandedDocRow === p.id;
                return (
                  <>
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 cursor-pointer"
                            style={{ backgroundColor: "#245C5A", border: p.isEmployee ? "none" : "2px dashed #D97706" }}
                            onClick={() => navigate(`/hr/person/${p.id}`)}>
                            {p.firstName[0]}{p.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium cursor-pointer hover:underline" style={{ color: "#245C5A" }} onClick={() => navigate(`/hr/person/${p.id}`)}>
                              {p.firstName} {p.lastName}
                            </p>
                            <div className="flex items-center gap-1">
                              {p.employeeId && <span style={{ color: "var(--topbar-subtitle)" }}>{p.employeeId}</span>}
                              {!p.isEmployee && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>Candidate</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>{p.role}</td>
                      <td className="px-4 py-3">
                        {currentStatus ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: currentStatus.bgColor, color: currentStatus.color }}>
                            {currentStatus.label}
                          </span>
                        ) : (<span style={{ color: "var(--topbar-subtitle)" }}>--</span>)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedDocRow(docsOpen ? null : p.id)}
                          className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded transition-all"
                          style={{
                            backgroundColor: docComp.percent === 100 ? "#ECFDF5" : docComp.percent > 0 ? "#FEF3C7" : "#F3F4F6",
                            color: docComp.percent === 100 ? "#065F46" : docComp.percent > 0 ? "#92400E" : "#6B7280",
                          }}
                        >
                          {docComp.percent === 100 ? <CheckCircle size={11} /> : <FileText size={11} />}
                          {docComp.percent}%
                        </button>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>{p.supervisor || "--"}</td>
                      <td className="px-4 py-3 text-right">
                        <select value={p.moduleStatuses[moduleId!] || ""} onChange={(e) => handleStatusChange(p.id, e.target.value)}
                          className="text-[11px] rounded border px-2 py-1 outline-none cursor-pointer"
                          style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>
                          <option value="">Set Status...</option>
                          {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </td>
                    </tr>
                    {docsOpen && moduleId && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3" style={{ backgroundColor: "#FAFBFC" }}>
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>
                              Required Documents for {mod.name}
                            </p>
                            {mod.requiredRecords.map((rr) => {
                              const personDocs = getDocumentsForPersonAndModule(p.id, moduleId);
                              const doc = personDocs.find((d) => d.recordName === rr);
                              return (
                                <div key={rr} className="flex items-center gap-3 py-1">
                                  {doc ? (
                                    <CheckCircle size={13} style={{ color: "#059669" }} className="flex-shrink-0" />
                                  ) : (
                                    <AlertTriangle size={13} style={{ color: "#DC2626" }} className="flex-shrink-0" />
                                  )}
                                  <span className="text-[12px] flex-1" style={{ color: doc ? "var(--topbar-title)" : "#DC2626" }}>{rr}</span>
                                  {!doc && (
                                    <DocumentUpload personId={p.id} moduleId={moduleId} recordName={rr} />
                                  )}
                                  {doc && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                                      {doc.fileName.length > 25 ? doc.fileName.slice(0, 25) + "..." : doc.fileName}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
