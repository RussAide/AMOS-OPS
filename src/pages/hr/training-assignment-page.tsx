import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  GraduationCap, ArrowLeft, BookOpen, Plus, Search,
  CheckCircle2, Clock, Users, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TRACK_OPTIONS = [
  { id: "all-staff", label: "All Staff Core" },
  { id: "clinical", label: "Clinical Track" },
  { id: "residential", label: "Residential Track" },
  { id: "supervisor", label: "Supervisor Track" },
  { id: "compliance", label: "Compliance Track" },
  { id: "leadership", label: "Leadership Track" },
];

export function TrainingAssignmentPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [personSearch, setPersonSearch] = useState("");

  const { data: dashboard } = trpc.training.dashboard.useQuery();
  const { data: modules = [] } = trpc.training.listModules.useQuery({});
  const { data: allProgress = [] } = trpc.training.listProgress.useQuery({});
  const { data: people = [] } = trpc.hr.listPeople.useQuery();
  const utils = trpc.useUtils();

  const createModuleMutation = trpc.training.createModule.useMutation({
    onSuccess: () => {
      utils.training.listModules.invalidate();
      utils.training.dashboard.invalidate();
      setShowCreate(false);
      setFormData({ trackId: "", title: "", category: "", description: "", stepCount: 5 });
    },
  });
  const deleteModuleMutation = trpc.training.deleteModule.useMutation({
    onSuccess: () => {
      utils.training.listModules.invalidate();
      utils.training.dashboard.invalidate();
    },
  });
  const assignMutation = trpc.training.updateProgress.useMutation({
    onSuccess: () => {
      utils.training.listProgress.invalidate();
      utils.training.dashboard.invalidate();
    },
  });

  const [formData, setFormData] = useState({ trackId: "", title: "", category: "", description: "", stepCount: 5 });

  const filteredModules = modules.filter((m) => {
    const matchesSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.category.toLowerCase().includes(search.toLowerCase());
    const matchesTrack = trackFilter === "all" || m.trackId === trackFilter;
    return matchesSearch && matchesTrack;
  });

  const getModuleProgress = (moduleId: string) => {
    const progress = allProgress.filter((p) => p.moduleId === moduleId);
    const completed = progress.filter((p) => p.status === "completed").length;
    const inProgress = progress.filter((p) => p.status === "in-progress").length;
    const total = progress.length;
    return { completed, inProgress, total, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getPersonProgress = (personId: string) => {
    const progress = allProgress.filter((p) => p.userId === personId);
    const completed = progress.filter((p) => p.status === "completed").length;
    const total = progress.length;
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const filteredPeople = personSearch
    ? people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase()))
    : people;

  const handleAssign = () => {
    if (!selectedPerson || !selectedModule) return;
    assignMutation.mutate({ userId: selectedPerson, moduleId: selectedModule, status: "available" });
    setSelectedPerson("");
    setSelectedModule("");
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/hr")} className="flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Training Assignment</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <GraduationCap size={22} style={{ color: "#245C5A" }} />
            Training Assignment
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Create training modules, assign to staff, track completion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 text-xs" style={{ backgroundColor: "#245C5A" }}>
                <Plus size={13} /> Create Module
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm" style={{ color: "#245C5A" }}>Create Training Module</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-[10px]">Track *</Label>
                  <Select value={formData.trackId} onValueChange={(v) => setFormData({ ...formData, trackId: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select track" /></SelectTrigger>
                    <SelectContent>
                      {TRACK_OPTIONS.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-[10px]">Title *</Label><Input className="h-8 text-xs" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., HIPAA Privacy & Security" /></div>
                <div>
                  <Label className="text-[10px]">Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {["Compliance", "Clinical", "Safety", "Professional", "Revenue"].map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-[10px]">Description</Label><Input className="h-8 text-xs" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                <div><Label className="text-[10px]">Steps</Label><Input type="number" className="h-8 text-xs" value={formData.stepCount} onChange={(e) => setFormData({ ...formData, stepCount: parseInt(e.target.value) || 5 })} min={1} max={20} /></div>
                <Button size="sm" className="w-full text-xs" style={{ backgroundColor: "#245C5A" }} onClick={() => createModuleMutation.mutate(formData)} disabled={createModuleMutation.isPending || !formData.trackId || !formData.title || !formData.category}>
                  {createModuleMutation.isPending ? "Creating..." : "Create Module"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Modules", value: dashboard.totalModules, color: "#245C5A", bg: "#F0FDFA" },
            { label: "Completed", value: dashboard.completed, color: "#059669", bg: "#ECFDF5" },
            { label: "In Progress", value: dashboard.inProgress, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Completion Rate", value: `${dashboard.completionRate}%`, color: "#D97706", bg: "#FFFBEB" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border p-3 text-center" style={{ backgroundColor: c.bg, borderColor: c.color + "30" }}>
              <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
              <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Module Section */}
      <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <Users size={14} style={{ color: "#245C5A" }} /> Quick Assign
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input placeholder="Search people..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="h-8 text-xs mb-1" />
            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {filteredPeople.slice(0, 10).map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.firstName} {p.lastName} — {p.role} ({getPersonProgress(p.id).rate}% done)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select module" /></SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.title} ({m.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-8 text-xs" style={{ backgroundColor: "#245C5A" }} onClick={handleAssign} disabled={!selectedPerson || !selectedModule || assignMutation.isPending}>
            {assignMutation.isPending ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <Input placeholder="Search modules..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", ...TRACK_OPTIONS.map((t) => t.id)].map((t) => (
            <button key={t} onClick={() => setTrackFilter(t)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{ backgroundColor: trackFilter === t ? "#245C5A" : "transparent", color: trackFilter === t ? "#fff" : "var(--topbar-subtitle)" }}>
              {t === "all" ? "All" : TRACK_OPTIONS.find((o) => o.id === t)?.label || t}
            </button>
          ))}
        </div>
      </div>

      {/* Module List */}
      <div className="space-y-2">
        {filteredModules.length === 0 ? (
          <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <BookOpen size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No training modules found</p>
          </div>
        ) : (
          filteredModules.map((mod) => {
            const stats = getModuleProgress(mod.id);
            return (
              <div key={mod.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F0FDFA" }}>
                    <BookOpen size={14} style={{ color: "#245C5A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold">{mod.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{mod.category}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
                        {TRACK_OPTIONS.find((t) => t.id === mod.trackId)?.label || mod.trackId}
                      </span>
                    </div>
                    {mod.description && <p className="text-[11px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{mod.description}</p>}
                  </div>
                  <button onClick={() => { if (confirm("Delete this module and all progress?")) deleteModuleMutation.mutate({ id: mod.id }); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${stats.completionRate}%`, backgroundColor: stats.completionRate >= 80 ? "#059669" : stats.completionRate >= 50 ? "#D97706" : "#DC2626" }} />
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-[10px]">
                    <span className="flex items-center gap-1" style={{ color: "#059669" }}><CheckCircle2 size={10} /> {stats.completed}</span>
                    <span className="flex items-center gap-1" style={{ color: "#2563EB" }}><Clock size={10} /> {stats.inProgress}</span>
                    <span className="flex items-center gap-1" style={{ color: "#6B7280" }}><Users size={10} /> {stats.total}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Staff Progress Table */}
      {dashboard && dashboard.personStats && dashboard.personStats.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Staff Progress</h3>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <table className="w-full text-[11px]">
              <thead><tr style={{ backgroundColor: "#f9fafb" }}>
                <th className="text-left px-3 py-2 font-semibold">Staff</th>
                <th className="text-left px-3 py-2 font-semibold">Role</th>
                <th className="text-left px-3 py-2 font-semibold">Progress</th>
                <th className="text-right px-3 py-2 font-semibold">Rate</th>
              </tr></thead>
              <tbody className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                {dashboard.personStats.sort((a, b) => b.completionRate - a.completionRate).map((s) => (
                  <tr key={s.personId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2" style={{ color: "var(--topbar-subtitle)" }}>{s.role}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9", maxWidth: 80 }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${s.completionRate}%`, backgroundColor: s.completionRate >= 80 ? "#059669" : s.completionRate >= 50 ? "#D97706" : "#DC2626" }} />
                        </div>
                        <span className="text-[9px]">{s.completed}/{s.totalModules}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: s.completionRate >= 80 ? "#059669" : s.completionRate >= 50 ? "#D97706" : "#DC2626" }}>
                      {s.completionRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainingAssignmentPage;
