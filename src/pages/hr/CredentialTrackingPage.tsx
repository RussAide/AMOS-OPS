import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  ShieldCheck, AlertTriangle, CheckCircle, Plus, Search,
  ArrowLeft, Clock, X, Filter, Award, AlertOctagon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  valid: { bg: "#ECFDF5", color: "#059669" },
  expiring: { bg: "#FFFBEB", color: "#D97706" },
  expired: { bg: "#FEF2F2", color: "#DC2626" },
  pending: { bg: "#F3F4F6", color: "#6B7280" },
};

const CREDENTIAL_TYPES = [
  "Professional License", "Certification", "Training Certificate",
  "Background Check", "CPR/First Aid", "CPI Certification",
  "HIPAA Training", "Driver's License", "NPI Number",
  "DEA Registration", "State Clearance", "Federal Clearance",
  "Other",
];

export function CredentialTrackingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [personSearch, setPersonSearch] = useState("");

  const { data: dashboard } = trpc.credentials.dashboard.useQuery();
  const { data: allCredentials = [] } = trpc.credentials.list.useQuery({});
  const { data: peopleWithIssues = [] } = trpc.credentials.peopleWithIssues.useQuery();
  const { data: people = [] } = trpc.hr.listPeople.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.credentials.create.useMutation({
    onSuccess: () => {
      utils.credentials.dashboard.invalidate();
      utils.credentials.list.invalidate();
      utils.credentials.peopleWithIssues.invalidate();
      setShowCreate(false);
      setFormData({
        personId: "", credentialType: "", licenseNumber: "", issuingBody: "",
        issueDate: "", expiryDate: "", status: "pending" as const, notes: "",
      });
    },
  });
  const verifyMutation = trpc.credentials.verify.useMutation({
    onSuccess: () => {
      utils.credentials.dashboard.invalidate();
      utils.credentials.list.invalidate();
      utils.credentials.peopleWithIssues.invalidate();
    },
  });
  const deleteMutation = trpc.credentials.delete.useMutation({
    onSuccess: () => {
      utils.credentials.dashboard.invalidate();
      utils.credentials.list.invalidate();
      utils.credentials.peopleWithIssues.invalidate();
    },
  });

  const [formData, setFormData] = useState({
    personId: "", credentialType: "", licenseNumber: "", issuingBody: "",
    issueDate: "", expiryDate: "", status: "pending" as "valid" | "expiring" | "expired" | "pending", notes: "",
  });

  const filteredCredentials = allCredentials.filter((c) => {
    const matchesSearch = !search ||
      c.credentialType.toLowerCase().includes(search.toLowerCase()) ||
      c.licenseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      c.issuingBody?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPeople = personSearch
    ? people.filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase()) ||
        p.role.toLowerCase().includes(personSearch.toLowerCase())
      )
    : people;

  const handleCreate = () => {
    if (!formData.personId || !formData.credentialType) return;
    createMutation.mutate(formData);
  };

  const getPersonName = (personId: string) => {
    const p = people.find((person) => person.id === personId);
    return p ? `${p.firstName} ${p.lastName}` : personId;
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/hr")} className="flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Credential Tracking</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <ShieldCheck size={22} style={{ color: "#245C5A" }} />
            Credential Tracking
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            License verification, expiration monitoring, compliance alerts
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-xs" style={{ backgroundColor: "#245C5A" }}>
              <Plus size={13} /> Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm" style={{ color: "#245C5A" }}>Add New Credential</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px]">Person *</Label>
                <Input placeholder="Search people..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="h-8 text-xs mb-1" />
                <Select value={formData.personId} onValueChange={(v) => setFormData({ ...formData, personId: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {filteredPeople.slice(0, 10).map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.firstName} {p.lastName} — {p.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Credential Type *</Label>
                <Select value={formData.credentialType} onValueChange={(v) => setFormData({ ...formData, credentialType: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">License Number</Label><Input className="h-8 text-xs" value={formData.licenseNumber} onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })} /></div>
                <div><Label className="text-[10px]">Issuing Body</Label><Input className="h-8 text-xs" value={formData.issuingBody} onChange={(e) => setFormData({ ...formData, issuingBody: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Issue Date</Label><Input type="date" className="h-8 text-xs" value={formData.issueDate} onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })} /></div>
                <div><Label className="text-[10px]">Expiry Date</Label><Input type="date" className="h-8 text-xs" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} /></div>
              </div>
              <div>
                <Label className="text-[10px]">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valid" className="text-xs">Valid</SelectItem>
                    <SelectItem value="expiring" className="text-xs">Expiring</SelectItem>
                    <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                    <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px]">Notes</Label><Input className="h-8 text-xs" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              <Button size="sm" className="w-full text-xs" style={{ backgroundColor: "#245C5A" }} onClick={handleCreate} disabled={createMutation.isPending || !formData.personId || !formData.credentialType}>
                {createMutation.isPending ? "Saving..." : "Save Credential"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total", value: dashboard.total, color: "#245C5A", bg: "#F0FDFA" },
            { label: "Valid", value: dashboard.valid, color: "#059669", bg: "#ECFDF5" },
            { label: "Pending", value: dashboard.pending, color: "#6B7280", bg: "#F3F4F6" },
            { label: "Expiring Soon", value: dashboard.expiringSoon, color: "#D97706", bg: "#FFFBEB" },
            { label: "Expired", value: dashboard.expired, color: "#DC2626", bg: "#FEF2F2" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border p-3 text-center" style={{ backgroundColor: c.bg, borderColor: c.color + "30" }}>
              <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
              <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* People with Issues */}
      {peopleWithIssues.length > 0 && (
        <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: "#FEF2F2", borderColor: "#fca5a5" }}>
          <h3 className="text-[13px] font-bold mb-2 flex items-center gap-2" style={{ color: "#DC2626" }}>
            <AlertOctagon size={14} /> People with Credential Issues ({peopleWithIssues.length})
          </h3>
          <div className="space-y-2">
            {peopleWithIssues.slice(0, 5).map((person) => (
              <div key={person.personId} className="flex items-center gap-3 p-2 rounded bg-white/50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: "#DC2626" }}>
                  {person.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium">{person.name} <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{person.role}</span></div>
                  <div className="flex gap-2 flex-wrap">
                    {person.issues.map((issue) => (
                      <span key={issue.credentialId} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: issue.status === "expired" ? "#fee2e2" : "#fef3c7", color: issue.status === "expired" ? "#DC2626" : "#D97706" }}>
                        {issue.credentialType} {issue.expiryDate ? `(exp: ${new Date(issue.expiryDate).toLocaleDateString()})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate(`/hr/person/${person.personId}`)}>View</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <Input placeholder="Search credentials by type, license, or issuing body..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={14} className="mr-1" style={{ color: "var(--topbar-subtitle)" }} />
          {["all", "valid", "expiring", "expired", "pending"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize"
              style={{ backgroundColor: statusFilter === s ? STATUS_COLORS[s]?.color || "#245C5A" : "transparent", color: statusFilter === s ? "#fff" : "var(--topbar-subtitle)" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Credential List */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th className="text-left px-4 py-3 font-semibold">Person</th>
              <th className="text-left px-4 py-3 font-semibold">Credential</th>
              <th className="text-left px-4 py-3 font-semibold">License</th>
              <th className="text-left px-4 py-3 font-semibold">Expiry</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {filteredCredentials.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12">
                <ShieldCheck size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p style={{ color: "var(--topbar-subtitle)" }}>No credentials found</p>
              </td></tr>
            ) : (
              filteredCredentials.map((cred) => {
                const sc = STATUS_COLORS[cred.status] || STATUS_COLORS.pending;
                const daysUntilExpiry = cred.expiryDate
                  ? Math.ceil((new Date(cred.expiryDate).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <tr key={cred.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/hr/person/${cred.personId}`)} className="text-[12px] font-medium hover:underline" style={{ color: "#245C5A" }}>
                        {getPersonName(cred.personId)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{cred.credentialType}</span>
                      {cred.issuingBody && <span className="text-[10px] block" style={{ color: "var(--topbar-subtitle)" }}>{cred.issuingBody}</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>{cred.licenseNumber || "—"}</td>
                    <td className="px-4 py-3">
                      {cred.expiryDate ? (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(cred.expiryDate).toLocaleDateString()}
                          {daysUntilExpiry !== null && daysUntilExpiry <= 90 && (
                            <span className="text-[9px] font-medium" style={{ color: daysUntilExpiry < 0 ? "#DC2626" : "#D97706" }}>
                              ({daysUntilExpiry < 0 ? `${Math.abs(daysUntilExpiry)}d overdue` : `${daysUntilExpiry}d left`})
                            </span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {cred.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {cred.status !== "valid" && (
                          <button onClick={() => verifyMutation.mutate({ id: cred.id, verifiedBy: "Current User" })} className="text-[10px] px-2 py-1 rounded border hover:bg-green-50 transition-colors" style={{ borderColor: "#059669", color: "#059669" }}>
                            <CheckCircle size={10} className="inline mr-1" />Verify
                          </button>
                        )}
                        <button onClick={() => { if (confirm("Delete this credential?")) deleteMutation.mutate({ id: cred.id }); }} className="text-[10px] px-2 py-1 rounded border hover:bg-red-50 transition-colors" style={{ borderColor: "#DC2626", color: "#DC2626" }}>
                          <X size={10} className="inline" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CredentialTrackingPage;
