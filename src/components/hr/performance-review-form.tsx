import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, ClipboardCheck, Plus, Trash2 } from "lucide-react";

const COMPETENCIES = [
  "Job Knowledge & Technical Skills",
  "Quality of Work",
  "Productivity & Efficiency",
  "Communication Skills",
  "Teamwork & Collaboration",
  "Problem Solving & Initiative",
  "Reliability & Attendance",
  "Professional Conduct",
  "Youth Interaction Skills",
  "Safety Awareness",
];

const RATING_LABELS: Record<number, string> = {
  1: "Unsatisfactory",
  2: "Needs Improvement",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

interface ReviewData {
  reviewType: "30-day" | "90-day" | "annual" | "corrective";
  reviewDate: string;
  competencies: Record<string, number>;
  goals: Array<{ description: string; status: "achieved" | "partial" | "not-achieved" }>;
  supervisorComments: string;
  actionItems: Array<{ description: string; dueDate: string }>;
  overallRating: string;
  reviewedBy: string;
}

interface Props {
  personId: string;
  personName: string;
}

function createInitialReview(): ReviewData {
  return {
    reviewType: "90-day",
    reviewDate: new Date().toISOString().slice(0, 10),
    competencies: Object.fromEntries(COMPETENCIES.map((competency) => [competency, 3])),
    goals: [{ description: "", status: "achieved" }],
    supervisorComments: "",
    actionItems: [],
    overallRating: "",
    reviewedBy: "",
  };
}

export function PerformanceReviewForm({ personId: _personId, personName }: Props) {
  const personId = _personId;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: pastReviews = [] } = trpc.performance.list.useQuery(
    { personId },
    { enabled: open && showHistory }
  );
  const createReviewMutation = trpc.performance.create.useMutation();
  const utils = trpc.useUtils();

  const [review, setReview] = useState<ReviewData>(createInitialReview);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setReview(createInitialReview());
      setStep(0);
      setSaved(false);
      setShowHistory(false);
    }
    setOpen(nextOpen);
  };

  const avgScore = Object.values(review.competencies).reduce((a, b) => a + b, 0) / COMPETENCIES.length;

  const updateCompetency = (name: string, value: number) => {
    setReview((prev) => ({ ...prev, competencies: { ...prev.competencies, [name]: value } }));
  };

  const addGoal = () => setReview((prev) => ({ ...prev, goals: [...prev.goals, { description: "", status: "achieved" }] }));
  const removeGoal = (i: number) => setReview((prev) => ({ ...prev, goals: prev.goals.filter((_, idx) => idx !== i) }));
  const updateGoal = (i: number, field: "description" | "status", value: string) => {
    setReview((prev) => ({
      ...prev,
      goals: prev.goals.map((goal, index) => {
        if (index !== i) return goal;
        if (field === "description") return { ...goal, description: value };
        return {
          ...goal,
          status: value as ReviewData["goals"][number]["status"],
        };
      }),
    }));
  };

  const addAction = () => setReview((prev) => ({ ...prev, actionItems: [...prev.actionItems, { description: "", dueDate: "" }] }));
  const removeAction = (i: number) => setReview((prev) => ({ ...prev, actionItems: prev.actionItems.filter((_, idx) => idx !== i) }));
  const updateAction = (i: number, field: "description" | "dueDate", value: string) => {
    setReview((prev) => ({
      ...prev,
      actionItems: prev.actionItems.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));
  };

  const handleSave = async () => {
    try {
      await createReviewMutation.mutateAsync({
        personId,
        reviewType: review.reviewType as "30-day" | "90-day" | "annual" | "corrective",
        reviewDate: review.reviewDate,
        competencies: JSON.stringify(review.competencies),
        goals: JSON.stringify(review.goals),
        supervisorComments: review.supervisorComments,
        actionItems: JSON.stringify(review.actionItems),
        overallRating: review.overallRating as "exceeds" | "meets" | "needs-improvement" | "unsatisfactory",
        reviewedBy: review.reviewedBy,
      });
      utils.performance.list.invalidate();
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
        setStep(0);
      }, 1200);
    } catch (err) {
      console.error("Failed to save review:", err);
    }
  };

  const canSubmit = review.overallRating && review.reviewedBy && review.supervisorComments.length >= 20;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-xs">
          <ClipboardCheck size={13} />
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <Star size={16} />
            Performance Review: {personName}
          </DialogTitle>
        </DialogHeader>

        {/* Past Reviews Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-[11px] font-medium mb-1 transition-colors hover:opacity-70"
          style={{ color: "#245C5A" }}
        >
          {showHistory ? "Hide" : "View"} Past Reviews ({pastReviews.length})
        </button>

        {showHistory && pastReviews.length > 0 && (
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto mb-3 pr-1">
            {pastReviews.map((r: Record<string, unknown>) => (
              <div key={String(r.id)} className="flex items-center gap-2 p-2 rounded bg-gray-50 text-[11px]">
                <span className="font-medium" style={{ color: "var(--topbar-title)" }}>
                  {String(r.reviewType)} — {String(r.reviewDate)}
                </span>
                <span className="text-muted-foreground ml-auto">
                  {r.overallRating ? String(r.overallRating) : "No rating"} · {String(r.reviewedBy || "Unknown")}
                </span>
              </div>
            ))}
          </div>
        )}

        {saved ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <ClipboardCheck size={24} style={{ color: "#059669" }} />
            </div>
            <p className="font-semibold text-green-700">Review Saved</p>
            <p className="text-xs text-muted-foreground mt-1">Performance review recorded successfully.</p>
          </div>
        ) : (
          <>
            {/* Review meta */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Type</Label>
                <Select value={review.reviewType} onValueChange={(v) => setReview((p) => ({ ...p, reviewType: v as ReviewData["reviewType"] }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30-day">30-Day</SelectItem>
                    <SelectItem value="90-day">90-Day</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="corrective">Corrective Action</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Date</Label>
                <Input type="date" className="h-8 text-xs" value={review.reviewDate}
                  onChange={(e) => setReview((p) => ({ ...p, reviewDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Avg Score</Label>
                <div className="h-8 flex items-center px-2 rounded-md border bg-gray-50 text-sm font-semibold" style={{ color: avgScore >= 4 ? "#059669" : avgScore >= 3 ? "#D97706" : "#DC2626" }}>
                  {avgScore.toFixed(1)} / 5.0
                </div>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex gap-1 mb-3 border-b pb-2">
              {["Competencies", "Goals", "Comments", "Sign-Off"].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setStep(i)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                    step === i ? "bg-[#245C5A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Step 0: Competencies */}
            {step === 0 && (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {COMPETENCIES.map((comp) => (
                  <div key={comp} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50">
                    <span className="text-[11px] font-medium flex-1">{comp}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateCompetency(comp, star)}
                          className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                          style={{
                            backgroundColor: star <= review.competencies[comp] ? "#FFFBEB" : "transparent",
                          }}
                        >
                          <Star
                            size={14}
                            fill={star <= review.competencies[comp] ? "#D97706" : "none"}
                            color={star <= review.competencies[comp] ? "#D97706" : "#CBD5E1"}
                          />
                        </button>
                      ))}
                      <span className="text-[9px] text-muted-foreground w-20 text-right ml-1">
                        {RATING_LABELS[review.competencies[comp]]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 1: Goals */}
            {step === 1 && (
              <div className="space-y-3">
                {review.goals.map((goal, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-gray-50">
                    <div className="flex-1 space-y-1.5">
                      <Input
                        placeholder="Goal description"
                        value={goal.description}
                        onChange={(e) => updateGoal(i, "description", e.target.value)}
                        className="h-7 text-xs"
                      />
                      <div className="flex gap-2">
                        {(["achieved", "partial", "not-achieved"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateGoal(i, "status", s)}
                            className={`px-2 py-0.5 rounded text-[9px] font-medium border ${
                              goal.status === s
                                ? s === "achieved" ? "bg-green-50 border-green-300 text-green-700"
                                : s === "partial" ? "bg-amber-50 border-amber-300 text-amber-700"
                                : "bg-red-50 border-red-300 text-red-700"
                                : "bg-white border-gray-200 text-gray-500"
                            }`}
                          >
                            {s === "achieved" ? "Achieved" : s === "partial" ? "Partial" : "Not Achieved"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => removeGoal(i)} className="text-gray-400 hover:text-red-500 mt-1"><Trash2 size={13} /></button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addGoal}>
                  <Plus size={12} /> Add Goal
                </Button>
              </div>
            )}

            {/* Step 2: Comments + Actions */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Supervisor Comments *</Label>
                  <Textarea
                    value={review.supervisorComments}
                    onChange={(e) => setReview((p) => ({ ...p, supervisorComments: e.target.value }))}
                    placeholder="Detailed assessment of performance, strengths, areas for improvement... (min 20 chars)"
                    className="text-xs min-h-[80px]"
                  />
                  <p className="text-[9px] text-muted-foreground">{review.supervisorComments.length} characters (min 20)</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px]">Action Items</Label>
                  {review.actionItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input placeholder="Action item" value={item.description} onChange={(e) => updateAction(i, "description", e.target.value)} className="h-7 text-xs flex-1" />
                      <Input type="date" value={item.dueDate} onChange={(e) => updateAction(i, "dueDate", e.target.value)} className="h-7 text-xs w-[110px]" />
                      <button onClick={() => removeAction(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addAction}>
                    <Plus size={11} /> Action
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Sign-Off */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-gray-50 border text-[11px] space-y-1">
                  <p><strong>Employee:</strong> {personName}</p>
                  <p><strong>Review Type:</strong> {review.reviewType === "90-day" ? "90-Day Review" : review.reviewType === "30-day" ? "30-Day Review" : review.reviewType === "annual" ? "Annual Review" : "Corrective Action"}</p>
                  <p><strong>Date:</strong> {review.reviewDate}</p>
                  <p><strong>Avg Competency:</strong> {avgScore.toFixed(1)} / 5.0</p>
                  <p><strong>Goals Reviewed:</strong> {review.goals.length}</p>
                  <p><strong>Action Items:</strong> {review.actionItems.length}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px]">Overall Rating *</Label>
                  <Select value={review.overallRating} onValueChange={(v) => setReview((p) => ({ ...p, overallRating: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select overall rating" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exceeds">Exceeds Expectations</SelectItem>
                      <SelectItem value="meets">Meets Expectations</SelectItem>
                      <SelectItem value="needs-improvement">Needs Improvement</SelectItem>
                      <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px]">Reviewed By *</Label>
                  <Input value={review.reviewedBy} onChange={(e) => setReview((p) => ({ ...p, reviewedBy: e.target.value }))} placeholder="Supervisor name" className="h-8 text-xs" />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 mt-2">
              {step > 0 && (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep(step - 1)}>Previous</Button>
              )}
              {step < 3 ? (
                <Button size="sm" className="text-xs" style={{ backgroundColor: "#245C5A" }} onClick={() => setStep(step + 1)}>Next</Button>
              ) : (
                <Button size="sm" className="text-xs" style={{ backgroundColor: "#059669" }} onClick={handleSave} disabled={!canSubmit}>
                  Save Review
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
