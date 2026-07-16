import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  TrendingUp, ArrowLeft, Star, ClipboardCheck, Search,
  CheckCircle2, AlertTriangle, X, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const RATING_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  exceeds: { color: "#059669", bg: "#ECFDF5", label: "Exceeds" },
  meets: { color: "#2563EB", bg: "#EFF6FF", label: "Meets" },
  "needs-improvement": { color: "#D97706", bg: "#FFFBEB", label: "Needs Improvement" },
  unsatisfactory: { color: "#DC2626", bg: "#FEF2F2", label: "Unsatisfactory" },
};

const COMPETENCIES = [
  "Job Knowledge & Technical Skills", "Quality of Work", "Productivity & Efficiency",
  "Communication Skills", "Teamwork & Collaboration", "Problem Solving & Initiative",
  "Reliability & Attendance", "Professional Conduct", "Youth Interaction Skills", "Safety Awareness",
];

export function PerformanceReviewPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [personSearch, setPersonSearch] = useState("");

  const { data: dashboard } = trpc.performance.dashboard.useQuery();
  const { data: allReviews = [] } = trpc.performance.list.useQuery({});
  const { data: people = [] } = trpc.hr.listPeople.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.performance.create.useMutation({
    onSuccess: () => {
      utils.performance.list.invalidate();
      utils.performance.dashboard.invalidate();
      setShowCreate(false);
      resetForm();
    },
  });
  const signOffMutation = trpc.performance.signOff.useMutation({
    onSuccess: () => {
      utils.performance.list.invalidate();
      utils.performance.dashboard.invalidate();
    },
  });
  const deleteMutation = trpc.performance.delete.useMutation({
    onSuccess: () => {
      utils.performance.list.invalidate();
      utils.performance.dashboard.invalidate();
    },
  });

  const [formData, setFormData] = useState({
    reviewType: "90-day" as "30-day" | "90-day" | "annual" | "corrective",
    reviewDate: new Date().toISOString().slice(0, 10),
    competencies: Object.fromEntries(COMPETENCIES.map((c) => [c, 3])),
    supervisorComments: "",
    overallRating: "" as "exceeds" | "meets" | "needs-improvement" | "unsatisfactory" | "",
    reviewedBy: "",
  });

  const resetForm = () => {
    setFormData({
      reviewType: "90-day",
      reviewDate: new Date().toISOString().slice(0, 10),
      competencies: Object.fromEntries(COMPETENCIES.map((c) => [c, 3])),
      supervisorComments: "",
      overallRating: "",
      reviewedBy: "",
    });
  };

  const filteredReviews = allReviews.filter((r) => {
    const person = people.find((p) => p.id === r.personId);
    const matchesSearch = !search ||
      (person && `${person.firstName} ${person.lastName}`.toLowerCase().includes(search.toLowerCase())) ||
      r.reviewType.toLowerCase().includes(search.toLowerCase()) ||
      r.reviewedBy?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || r.reviewType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getPersonName = (personId: string) => {
    const p = people.find((person) => person.id === personId);
    return p ? `${p.firstName} ${p.lastName}` : personId;
  };

  const getPersonRole = (personId: string) => {
    const p = people.find((person) => person.id === personId);
    return p?.role || "";
  };

  const avgScore = Object.values(formData.competencies).reduce((a, b) => a + b, 0) / COMPETENCIES.length;

  const filteredPeople = personSearch
    ? people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase()))
    : people;

  const handleCreate = () => {
    if (!selectedPerson || !formData.overallRating || !formData.reviewedBy) return;
    createMutation.mutate({
      personId: selectedPerson,
      reviewType: formData.reviewType,
      reviewDate: formData.reviewDate,
      competencies: JSON.stringify(formData.competencies),
      supervisorComments: formData.supervisorComments,
      overallRating: formData.overallRating as "exceeds" | "meets" | "needs-improvement" | "unsatisfactory",
      reviewedBy: formData.reviewedBy,
    });
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/hr")} className="flex items-center gap-1 text-[13px] font-medium hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Performance Reviews</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <TrendingUp size={22} style={{ color: "#245C5A" }} />
            Performance Reviews
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Performance documentation, coaching records, corrective action tracking
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-xs" style={{ backgroundColor: "#245C5A" }}>
              <ClipboardCheck size={13} /> New Review
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm" style={{ color: "#245C5A" }}>Create Performance Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px]">Person *</Label>
                <Input placeholder="Search..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="h-8 text-xs mb-1" />
                <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {filteredPeople.slice(0, 10).map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.firstName} {p.lastName} — {p.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Type</Label>
                    <Select value={formData.reviewType} onValueChange={(v) => setFormData({ ...formData, reviewType: v as typeof formData.reviewType })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30-day" className="text-xs">30-Day</SelectItem>
                      <SelectItem value="90-day" className="text-xs">90-Day</SelectItem>
                      <SelectItem value="annual" className="text-xs">Annual</SelectItem>
                      <SelectItem value="corrective" className="text-xs">Corrective Action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Date</Label>
                  <Input type="date" className="h-8 text-xs" value={formData.reviewDate} onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })} />
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Competencies (Avg: {avgScore.toFixed(1)}/5)</Label>
                <div className="space-y-1 mt-1 max-h-[150px] overflow-y-auto">
                  {COMPETENCIES.map((comp) => (
                    <div key={comp} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] flex-1">{comp}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setFormData({ ...formData, competencies: { ...formData.competencies, [comp]: star } })} className="w-5 h-5 flex items-center justify-center">
                            <Star size={12} fill={star <= formData.competencies[comp] ? "#D97706" : "none"} color={star <= formData.competencies[comp] ? "#D97706" : "#CBD5E1"} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-[10px]">Supervisor Comments *</Label>
                <Textarea className="text-xs min-h-[60px]" value={formData.supervisorComments} onChange={(e) => setFormData({ ...formData, supervisorComments: e.target.value })} placeholder="Detailed assessment..." />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Overall Rating *</Label>
                  <Select value={formData.overallRating} onValueChange={(v) => setFormData({ ...formData, overallRating: v as typeof formData.overallRating })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATING_COLORS).map(([key, val]) => (
                        <SelectItem key={key} value={key} className="text-xs">{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Reviewed By *</Label>
                  <Input className="h-8 text-xs" value={formData.reviewedBy} onChange={(e) => setFormData({ ...formData, reviewedBy: e.target.value })} placeholder="Supervisor name" />
                </div>
              </div>

              <Button size="sm" className="w-full text-xs" style={{ backgroundColor: "#245C5A" }} onClick={handleCreate} disabled={createMutation.isPending || !selectedPerson || !formData.overallRating || !formData.reviewedBy}>
                {createMutation.isPending ? "Saving..." : "Save Review"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Reviews", value: dashboard.totalReviews, color: "#245C5A", bg: "#F0FDFA" },
            { label: "Pending Sign-Off", value: dashboard.pendingSignOff, color: "#D97706", bg: "#FFFBEB" },
            { label: "Without Reviews", value: dashboard.peopleWithoutReviews, color: "#DC2626", bg: "#FEF2F2" },
            { label: "People Covered", value: `${dashboard.peopleWithReviews}/${dashboard.totalPeople}`, color: "#059669", bg: "#ECFDF5" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border p-3 text-center" style={{ backgroundColor: c.bg, borderColor: c.color + "30" }}>
              <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
              <div className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* By Type Breakdown */}
      {dashboard && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {Object.entries(dashboard.byType).map(([type, count]) => (
            <div key={type} className="px-3 py-1.5 rounded-lg border text-[11px] font-medium" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <span style={{ color: "var(--topbar-subtitle)" }}>{type}:</span>{" "}
              <span className="font-bold" style={{ color: "#245C5A" }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={14} className="mr-1" style={{ color: "var(--topbar-subtitle)" }} />
          {["all", "30-day", "90-day", "annual", "corrective"].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{ backgroundColor: typeFilter === t ? "#245C5A" : "transparent", color: typeFilter === t ? "#fff" : "var(--topbar-subtitle)" }}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ backgroundColor: "#f9fafb" }}>
              <th className="text-left px-4 py-3 font-semibold">Person</th>
              <th className="text-left px-4 py-3 font-semibold">Type</th>
              <th className="text-left px-4 py-3 font-semibold">Date</th>
              <th className="text-left px-4 py-3 font-semibold">Rating</th>
              <th className="text-left px-4 py-3 font-semibold">Reviewer</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {filteredReviews.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12">
                <ClipboardCheck size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p style={{ color: "var(--topbar-subtitle)" }}>No reviews found</p>
              </td></tr>
            ) : (
              filteredReviews.map((review) => {
                const rc = review.overallRating ? (RATING_COLORS[review.overallRating] || RATING_COLORS.meets) : null;
                const needsSignOff = review.reviewedBy && !review.signedOffBy;
                return (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/hr/person/${review.personId}`)} className="font-medium hover:underline text-left" style={{ color: "#245C5A" }}>
                        {getPersonName(review.personId)}
                      </button>
                      <span className="text-[10px] block" style={{ color: "var(--topbar-subtitle)" }}>{getPersonRole(review.personId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium">{review.reviewType}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>{new Date(review.reviewDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {rc ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: rc.bg, color: rc.color }}>
                          {rc.label}
                        </span>
                      ) : <span className="text-[10px]" style={{ color: "#9CA3AF" }}>—</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>{review.reviewedBy || "—"}</td>
                    <td className="px-4 py-3">
                      {needsSignOff ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 inline-flex" style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
                          <AlertTriangle size={9} /> Pending Sign-Off
                        </span>
                      ) : review.signedOffBy ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 inline-flex" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                          <CheckCircle2 size={9} /> Signed
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>In Progress</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {needsSignOff && (
                          <button onClick={() => signOffMutation.mutate({ id: review.id, signedOffBy: "Current User" })} className="text-[10px] px-2 py-1 rounded border hover:bg-green-50 transition-colors" style={{ borderColor: "#059669", color: "#059669" }}>
                            Sign Off
                          </button>
                        )}
                        <button onClick={() => { if (confirm("Delete this review?")) deleteMutation.mutate({ id: review.id }); }} className="text-gray-400 hover:text-red-500 p-1">
                          <X size={12} />
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

export default PerformanceReviewPage;
