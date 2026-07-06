import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  LogOut, ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  Search, Plus, Ban, Users, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHECKLIST_DEF = [
  { id: "exit-interview", label: "Exit Interview Conducted", category: "HR" },
  { id: "equipment", label: "Equipment Returned (laptop, phone, keys)", category: "IT" },
  { id: "access-cards", label: "Access Cards / Badges Returned", category: "Security" },
  { id: "email-deactivated", label: "Email & System Accounts Deactivated", category: "IT" },
  { id: "final-paycheck", label: "Final Paycheck Processed", category: "Payroll" },
  { id: "benefits-term", label: "Benefits Termination Submitted", category: "HR" },
  { id: "cobra-notice", label: "COBRA Notice Sent", category: "HR" },
  { id: "reference-letter", label: "Reference Letter Provided (if eligible)", category: "HR" },
  { id: "file-archived", label: "Personnel File Archived", category: "HR" },
  { id: "turnover-doc", label: "Turnover Documentation Complete", category: "Supervisor" },
];

const CATEGORY_COLORS: Record<string, string> = {
  HR: "#245C5A", IT: "#2563EB", Security: "#D97706", Payroll: "#059669", Supervisor: "#7C3AED",
};

export function SeparationManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showInitiate, setShowInitiate] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [reason, setReason] = useState("");
  const [personSearch, setPersonSearch] = useState("");

  const { data: dashboard } = trpc.separation.dashboard.useQuery();
  const { data: allItems = [] } = trpc.separation.listAll.useQuery({});
  const { data: people = [] } = trpc.hr.listPeople.useQuery();
  const utils = trpc.useUtils();

  const initiateMutation = trpc.separation.initiate.useMutation({
    onSuccess: () => {
      utils.separation.dashboard.invalidate();
      utils.separation.listAll.invalidate();
      setShowInitiate(false);
      setSelectedPersonId("");
      setReason("");
    },
  });
  const upsertMutation = trpc.separation.upsertItem.useMutation({
    onSuccess: () => {
      utils.separation.dashboard.invalidate();
      utils.separation.listAll.invalidate();
    },
  });

  // Group items by person
  const byPerson: Record<string, typeof allItems> = {};
  for (const item of allItems) {
    if (!byPerson[item.personId]) byPerson[item.personId] = [];
    byPerson[item.personId].push(item);
  }

  // Build person rows
  const personRows = Object.entries(byPerson).map(([personId, items]) => {
    const person = people.find((p) => p.id === personId);
    const completed = items.filter((i) => i.completed).length;
    const percent = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
    return {
      personId,
      name: person ? `${person.firstName} ${person.lastName}` : personId,
      role: person?.role || "",
      isActive: person?.isActive ?? false,
      totalItems: items.length,
      completed,
      percent,
      isComplete: percent === 100 && items.length > 0,
      items,
    };
  }).filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return row.name.toLowerCase().includes(q) || row.role.toLowerCase().includes(q);
  });

  const activeSeparations = personRows.filter((r) => !r.isComplete);
  const completedSeparations = personRows.filter((r) => r.isComplete);

  const handleToggle = async (personId: string, itemId: string, label: string, category: string, currentCompleted: boolean) => {
    await upsertMutation.mutateAsync({
      personId,
      itemId,
      label,
      category,
      completed: !currentCompleted,
      completedAt: !currentCompleted ? new Date().toISOString().slice(0, 10) : undefined,
      completedBy: !currentCompleted ? "Current User" : undefined,
    });
  };

  const filteredPeople = personSearch
    ? people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase()) && !byPerson[p.id])
    : people.filter((p) => !byPerson[p.id]);

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/hr")} className="flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Separation Management</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <LogOut size={22} style={{ color: "#245C5A" }} />
            Separation & Offboarding
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Offboarding checklists, access revocation, file closure tracking
          </p>
        </div>
        <Dialog open={showInitiate} onOpenChange={setShowInitiate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-xs" style={{ backgroundColor: "#DC2626" }}>
              <Ban size={13} /> Initiate Separation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2" style={{ color: "#DC2626" }}>
                <Ban size={14} /> Initiate Separation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px]">Select Person *</Label>
                <Input placeholder="Search people..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="h-8 text-xs mb-1" />
                <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {filteredPeople.slice(0, 10).map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.firstName} {p.lastName} — {p.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Reason (optional)</Label>
                <Input className="h-8 text-xs" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Voluntary, involuntary, retirement..." />
              </div>
              <Button size="sm" className="w-full text-xs" style={{ backgroundColor: "#DC2626" }} onClick={() => selectedPersonId && initiateMutation.mutate({ personId: selectedPersonId, reason })} disabled={initiateMutation.isPending || !selectedPersonId}>
                {initiateMutation.isPending ? "Initiating..." : "Initiate Separation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active Separations", value: dashboard.activeSeparations, color: "#D97706", bg: "#FFFBEB", icon: Clock },
            { label: "Completed", value: dashboard.completedSeparations, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
            { label: "Pending Items", value: dashboard.pendingItems, color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
            { label: "People in Process", value: dashboard.peopleInSeparation, color: "#245C5A", bg: "#F0FDFA", icon: Users },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: c.bg, borderColor: c.color + "30" }}>
              <div className="flex items-center gap-2 mb-1">
                <c.icon size={14} style={{ color: c.color }} />
                <span className="text-[10px] font-medium" style={{ color: c.color }}>{c.label}</span>
              </div>
              <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
        <Input placeholder="Search by name or role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
      </div>

      {/* Active Separations */}
      {activeSeparations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Clock size={14} style={{ color: "#D97706" }} /> Active Separations ({activeSeparations.length})
          </h2>
          <div className="space-y-3">
            {activeSeparations.map((row) => (
              <div key={row.personId} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: row.isComplete ? "#059669" : "#D97706" }}>
                      {row.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <button onClick={() => navigate(`/hr/person/${row.personId}`)} className="text-[13px] font-semibold hover:underline" style={{ color: "#245C5A" }}>
                        {row.name}
                      </button>
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{row.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold" style={{ color: row.percent >= 80 ? "#059669" : row.percent >= 50 ? "#D97706" : "#DC2626" }}>
                      {row.percent}%
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{row.completed}/{row.totalItems} complete</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${row.percent}%`, backgroundColor: row.percent >= 80 ? "#059669" : row.percent >= 50 ? "#D97706" : "#DC2626" }} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {row.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleToggle(row.personId, item.itemId, item.label, item.category, item.completed)}
                      className={`flex items-center gap-2 p-2 rounded border text-left transition-all ${item.completed ? "bg-green-50/50 border-green-200" : "bg-white border-gray-200 hover:border-[#245C5A]"}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.completed ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                        {item.completed && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] flex-1 ${item.completed ? "line-through text-gray-400" : "font-medium"}`}>{item.label}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: (CATEGORY_COLORS[item.category] || "#6B7280") + "15", color: CATEGORY_COLORS[item.category] || "#6B7280" }}>
                        {item.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Separations */}
      {completedSeparations.length > 0 && (
        <div>
          <h2 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <CheckCircle2 size={14} style={{ color: "#059669" }} /> Completed Separations ({completedSeparations.length})
          </h2>
          <div className="space-y-2">
            {completedSeparations.map((row) => (
              <div key={row.personId} className="rounded-lg border p-3 flex items-center gap-3 opacity-70" style={{ borderColor: "#D1FAE5", backgroundColor: "#ECFDF5" }}>
                <CheckCircle2 size={16} style={{ color: "#059669" }} />
                <div className="flex-1">
                  <span className="text-[12px] font-medium">{row.name}</span>
                  <span className="text-[10px] ml-2" style={{ color: "var(--topbar-subtitle)" }}>{row.role}</span>
                </div>
                <span className="text-[10px] font-medium" style={{ color: "#059669" }}>All items complete</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {personRows.length === 0 && (
        <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <Users size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No active separations</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Initiate a separation to begin the offboarding process</p>
        </div>
      )}
    </div>
  );
}

export default SeparationManagementPage;
