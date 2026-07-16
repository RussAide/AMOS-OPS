import { useState, useEffect, useMemo } from "react";
import {  useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import {
  Pill, CheckCircle2, XCircle, Pause, Shield,
  ChevronLeft, ChevronRight, User, RotateCcw, Timer,
  TabletSmartphone,
} from "lucide-react";

const STATUS_ACTIONS = [
  { key: "administered", label: "Given", color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  { key: "refused", label: "Refused", color: "#DC2626", bg: "#FEF2F2", icon: XCircle },
  { key: "held", label: "Held", color: "#D97706", bg: "#FFFBEB", icon: Pause },
];

interface MedRoundState {
  [medId: string]: { status: string; timestamp?: string; notes?: string };
}

export function MobileMARPage() {
  const queryClient = useQueryClient();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("fac-001");
  const [youthIndex, setYouthIndex] = useState(0);
  const [roundState, setRoundState] = useState<MedRoundState>({});
  const [roundStart, setRoundStart] = useState<Date>(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [confirmingAction, setConfirmingAction] = useState<{ medId: string; action: string } | null>(null);
  const [controlledModal, setControlledModal] = useState<{ medId: string; medName: string; action: string } | null>(null);
  const [countBefore, setCountBefore] = useState("");
  const [countAfter, setCountAfter] = useState("");
  const [witness, setWitness] = useState("");

  const { data: facilities } = trpc.m19.listFacilities.useQuery();
  const { data: medications } = trpc.m20.getFacilityMedications.useQuery({ facilityId: selectedFacilityId });

  const administerMed = trpc.m20.administerMedication.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["m20", "getFacilityMedications"]] });
      setControlledModal(null);
      setCountBefore("");
      setCountAfter("");
      setWitness("");
    },
  });

  // Timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - roundStart.getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [roundStart]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Youth list
  const youthList = useMemo(() => medications ?? [], [medications]);
  const currentYouth = youthList[youthIndex];

  // Progress
  const totalMeds = useMemo(() => youthList.reduce((s, y) => s + y.medications.length, 0), [youthList]);
  const completedMeds = useMemo(() => Object.values(roundState).filter(r => r.status === "administered" || r.status === "refused" || r.status === "held").length, [roundState]);
  const progressPct = totalMeds > 0 ? (completedMeds / totalMeds) * 100 : 0;

  const handleAction = (medId: string, medName: string, isControlled: boolean, action: string) => {
    if (isControlled && action === "administered") {
      setControlledModal({ medId, medName, action });
      return;
    }
    setRoundState(prev => ({ ...prev, [medId]: { status: action, timestamp: new Date().toISOString() } }));
    setConfirmingAction(null);
  };

  const handleControlledConfirm = () => {
    if (!controlledModal) return;
    setRoundState(prev => ({ ...prev, [controlledModal.medId]: { status: controlledModal.action, timestamp: new Date().toISOString() } }));
    administerMed.mutate({
      medicationId: controlledModal.medId,
      youthId: currentYouth?.youthId ?? "",
      administeredBy: "Mobile User",
      timestamp: new Date().toISOString(),
      countBefore: countBefore ? parseInt(countBefore) : undefined,
      countAfter: countAfter ? parseInt(countAfter) : undefined,
      controlledWitness: witness || undefined,
    });
  };

  const resetRound = () => {
    setRoundState({});
    setRoundStart(new Date());
    setElapsed(0);
    setYouthIndex(0);
  };

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "#f8fafc" }}>
      {/* ─── Sticky Header ─────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3">
          {/* Top row: title + facility + timer */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TabletSmartphone size={16} style={{ color: "#245C5A" }} />
              <h1 className="text-[15px] font-bold" style={{ color: "var(--topbar-title)" }}>Med Pass</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[12px] font-mono" style={{ color: "#245C5A" }}>
                <Timer size={12} /> {fmtTime(elapsed)}
              </div>
              <button onClick={resetRound} className="p-1.5 rounded" style={{ backgroundColor: "#f1f5f9" }} title="Reset round">
                <RotateCcw size={12} style={{ color: "#64748b" }} />
              </button>
            </div>
          </div>

          {/* Facility selector */}
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {facilities?.map(f => (
              <button
                key={f.id}
                onClick={() => { setSelectedFacilityId(f.id); setYouthIndex(0); }}
                className="px-2.5 py-1 rounded text-[10px] font-medium border flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: selectedFacilityId === f.id ? "#245C5A" : "#f1f5f9",
                  borderColor: selectedFacilityId === f.id ? "#245C5A" : "#e2e8f0",
                  color: selectedFacilityId === f.id ? "#fff" : "#64748b",
                }}
              >
                {f.code}
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "#e2e8f0" }}>
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? "#059669" : "#245C5A" }}
              />
            </div>
            <span className="text-[10px] font-medium flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>
              {completedMeds}/{totalMeds} ({Math.round(progressPct)}%)
            </span>
          </div>
        </div>
      </div>

      {/* ─── Youth Navigation ──────────────────────────── */}
      {currentYouth && (
        <div className="px-4 py-3 border-b flex items-center gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <button
            onClick={() => setYouthIndex(Math.max(0, youthIndex - 1))}
            disabled={youthIndex === 0}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30"
            style={{ backgroundColor: "#f1f5f9" }}
          >
            <ChevronLeft size={16} style={{ color: "#245C5A" }} />
          </button>

          <div className="flex-1 text-center min-w-0">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
                <User size={14} style={{ color: "#fff" }} />
              </div>
              <div>
                <div className="text-[14px] font-bold truncate" style={{ color: "var(--topbar-title)" }}>
                  {currentYouth.youthName}
                </div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {currentYouth.bedLabel} • {currentYouth.mrn}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setYouthIndex(Math.min(youthList.length - 1, youthIndex + 1))}
            disabled={youthIndex >= youthList.length - 1}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30"
            style={{ backgroundColor: "#f1f5f9" }}
          >
            <ChevronRight size={16} style={{ color: "#245C5A" }} />
          </button>
        </div>
      )}

      {/* ─── Youth dots indicator ──────────────────────── */}
      <div className="flex justify-center gap-1 py-2">
        {youthList.map((y, i) => {
          const allDone = y.medications.every(m => roundState[m.id]?.status);
          return (
            <button
              key={y.youthId}
              onClick={() => setYouthIndex(i)}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: i === youthIndex ? "#245C5A" : allDone ? "#059669" : "#cbd5e1",
              }}
              title={y.youthName}
            />
          );
        })}
      </div>

      {/* ─── Medication Cards ──────────────────────────── */}
      <div className="px-4 space-y-3">
        {currentYouth?.medications.map((med) => {
          const roundEntry = roundState[med.id];
          const isDone = !!roundEntry?.status;
          const actionConfig = STATUS_ACTIONS.find(a => a.key === roundEntry?.status);

          return (
            <div
              key={med.id}
              className="rounded-xl border overflow-hidden transition-all"
              style={{
                backgroundColor: isDone ? "#fff" : "var(--card-bg)",
                borderColor: isDone ? (actionConfig?.color ?? "#e2e8f0") + "40" : med.isControlled ? "#fca5a5" : "var(--card-border)",
                opacity: isDone ? 0.85 : 1,
              }}
            >
              {/* Med Header */}
              <div className="px-4 py-3 flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: med.isControlled ? "#FEF2F2" : isDone ? (actionConfig?.bg ?? "#f1f5f9") : "#f0f6f6" }}
                >
                  {med.isControlled ? (
                    <Shield size={20} style={{ color: "#DC2626" }} />
                  ) : (
                    <Pill size={20} style={{ color: isDone ? (actionConfig?.color ?? "#245C5A") : "#245C5A" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>{med.name}</span>
                    {med.isControlled && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>C-II</span>
                    )}
                  </div>
                  <div className="text-[12px] font-medium mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                    {med.dosage} • {med.frequency}
                  </div>
                  {isDone && actionConfig && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <actionConfig.icon size={12} style={{ color: actionConfig.color }} />
                      <span className="text-[11px] font-medium" style={{ color: actionConfig.color }}>
                        {actionConfig.label} — {new Date(roundEntry.timestamp!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons — LARGE touch targets */}
              {!isDone && (
                <div className="px-4 pb-3">
                  {confirmingAction?.medId === med.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(med.id, med.name, med.isControlled, confirmingAction.action)}
                        className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white"
                        style={{ backgroundColor: STATUS_ACTIONS.find(a => a.key === confirmingAction.action)?.color ?? "#245C5A" }}
                      >
                        Confirm {STATUS_ACTIONS.find(a => a.key === confirmingAction.action)?.label}
                      </button>
                      <button
                        onClick={() => setConfirmingAction(null)}
                        className="px-4 py-3 rounded-xl text-[12px] font-medium border"
                        style={{ borderColor: "#e2e8f0", color: "var(--topbar-subtitle)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {STATUS_ACTIONS.map(action => (
                        <button
                          key={action.key}
                          onClick={() => setConfirmingAction({ medId: med.id, action: action.key })}
                          className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all active:scale-95"
                          style={{
                            borderColor: action.color + "40",
                            backgroundColor: action.bg,
                          }}
                        >
                          <action.icon size={20} style={{ color: action.color }} />
                          <span className="text-[11px] font-bold" style={{ color: action.color }}>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Undo */}
              {isDone && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => setRoundState(prev => { const n = { ...prev }; delete n[med.id]; return n; })}
                    className="text-[10px] font-medium underline"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Round Complete Banner ─────────────────────── */}
      {progressPct === 100 && totalMeds > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-xl border text-center" style={{ backgroundColor: "#ECFDF5", borderColor: "#86efac" }}>
          <CheckCircle2 size={32} style={{ color: "#059669" }} className="mx-auto mb-2" />
          <div className="text-[15px] font-bold" style={{ color: "#059669" }}>Round Complete!</div>
          <div className="text-[12px] mt-1" style={{ color: "#059669" }}>
            {totalMeds} medications processed in {fmtTime(elapsed)}
          </div>
          <button
            onClick={resetRound}
            className="mt-3 px-4 py-2 rounded-lg text-[12px] font-medium text-white"
            style={{ backgroundColor: "#059669" }}
          >
            Start New Round
          </button>
        </div>
      )}

      {/* ─── No youth message ──────────────────────────── */}
      {youthList.length === 0 && (
        <div className="text-center py-12">
          <TabletSmartphone size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            No youth assigned to this facility
          </p>
        </div>
      )}

      {/* ─── Controlled Substance Modal ────────────────── */}
      {controlledModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0", backgroundColor: "#FEF2F2" }}>
              <div className="flex items-center gap-2">
                <Shield size={16} style={{ color: "#DC2626" }} />
                <h3 className="text-[13px] font-bold" style={{ color: "#DC2626" }}>C-II Count</h3>
              </div>
              <button onClick={() => setControlledModal(null)} className="text-[18px]" style={{ color: "#94A3B8" }}>×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-[13px] font-medium text-center" style={{ color: "var(--topbar-title)" }}>
                {controlledModal.medName}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Count Before</label>
                  <input
                    type="number"
                    value={countBefore}
                    onChange={e => setCountBefore(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-[16px] font-bold text-center"
                    style={{ borderColor: "#E2E8F0", minHeight: 44 }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Count After</label>
                  <input
                    type="number"
                    value={countAfter}
                    onChange={e => setCountAfter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-[16px] font-bold text-center"
                    style={{ borderColor: "#E2E8F0", minHeight: 44 }}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Witness</label>
                <input
                  type="text"
                  value={witness}
                  onChange={e => setWitness(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border text-[13px]"
                  style={{ borderColor: "#E2E8F0", minHeight: 44 }}
                  placeholder="Initials or name"
                />
              </div>
              <button
                onClick={handleControlledConfirm}
                disabled={!countBefore || !countAfter || administerMed.isPending}
                className="w-full py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: "#DC2626", minHeight: 48 }}
              >
                {administerMed.isPending ? "Recording..." : "Confirm C-II Administration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileMARPage;
