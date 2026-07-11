import { trpc } from "@/providers/trpc";
import {
  TrendingUp, Users, Handshake, Target, Megaphone, ArrowRight, Plus, X,
  Clock, Shield, Heart, AlertTriangle, ChevronDown, ChevronUp, CheckCircle,
  FileText, MapPin, UserCheck
} from "lucide-react";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  new: "#2563EB", in_review: "#D97706", active: "#059669",
  converted: "#7C3AED", deferred: "#6B7280", closed: "#94A3B8",
};

const TYPE_COLORS: Record<string, string> = {
  intake: "#059669", crisis: "#DC2626", adolescent: "#2563EB",
  mandatory: "#D97706", educational: "#7C3AED", community: "#245C5A",
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "shift", label: "Start Shift", icon: Clock, color: "#245C5A", description: "Begin your work shift" },
  { id: "safety", label: "Log Safety Round", icon: Shield, color: "#2563EB", description: "Record a safety check" },
  { id: "care", label: "Record Youth Care", icon: Heart, color: "#059669", description: "Document care provided" },
  { id: "incident", label: "Report Incident", icon: AlertTriangle, color: "#DC2626", description: "Report a safety incident" },
  { id: "handoff", label: "Complete Shift Handoff", icon: ArrowRight, color: "#7C3AED", description: "Transfer shift to next staff" },
];

/* ───────── Modal: Start Shift ───────── */
function StartShiftModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    staffName: "", shiftType: "day", unit: "", notes: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-md"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock size={20} style={{ color: "#245C5A" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Start Shift</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Staff Name *</label>
            <input
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.staffName}
              onChange={(e) => setForm((p) => ({ ...p, staffName: e.target.value }))}
              placeholder="Enter your name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Shift Type *</label>
              <div className="grid grid-cols-1 gap-2">
                {(["day", "evening", "night"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm((p) => ({ ...p, shiftType: type }))}
                    className="px-3 py-2 rounded-lg border text-[12px] font-medium capitalize min-h-[40px] transition-all"
                    style={{
                      borderColor: form.shiftType === type ? "#245C5A" : "var(--card-border)",
                      backgroundColor: form.shiftType === type ? "#F0FDFA" : "transparent",
                      color: form.shiftType === type ? "#245C5A" : "var(--topbar-subtitle)",
                    }}
                  >
                    {type} Shift
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Unit *</label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              >
                <option value="">Select unit</option>
                <option value="north">North Unit</option>
                <option value="south">South Unit</option>
                <option value="east">East Unit</option>
                <option value="intake">Intake Unit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Shift Notes</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 resize-none min-h-[80px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any notes for this shift..."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px] transition-all hover:bg-gray-50"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
          >
            Cancel
          </button>
          <button
            disabled={!form.staffName || !form.unit}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
            onClick={() => { onClose(); }}
          >
            Start Shift
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Modal: Log Safety Round ───────── */
function SafetyRoundModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    unit: "", roomChecks: "", youthCount: "", hazards: "", observations: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-md"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield size={20} style={{ color: "#2563EB" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Log Safety Round</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Unit *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            >
              <option value="">Select unit</option>
              <option value="north">North Unit</option>
              <option value="south">South Unit</option>
              <option value="east">East Unit</option>
              <option value="intake">Intake Unit</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Rooms Checked *</label>
              <input
                type="number"
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.roomChecks}
                onChange={(e) => setForm((p) => ({ ...p, roomChecks: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth Count *</label>
              <input
                type="number"
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.youthCount}
                onChange={(e) => setForm((p) => ({ ...p, youthCount: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Hazards or Concerns</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none min-h-[60px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.hazards}
              onChange={(e) => setForm((p) => ({ ...p, hazards: e.target.value }))}
              placeholder="Describe any hazards or safety concerns..."
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>General Observations</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none min-h-[60px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.observations}
              onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))}
              placeholder="Any observations about youth behavior or environment..."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px] transition-all hover:bg-gray-50"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
          >
            Cancel
          </button>
          <button
            disabled={!form.unit || !form.roomChecks || !form.youthCount}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#2563EB" }}
            onClick={() => { onClose(); }}
          >
            Log Safety Round
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Modal: Record Youth Care ───────── */
function YouthCareModal({ onClose }: { onClose: () => void }) {
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    youthName: "", careType: "", careDescription: "", mood: "", behavior: "",
    medicationsGiven: "", activities: "", concerns: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Heart size={20} style={{ color: "#059669" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Record Youth Care</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth Name *</label>
            <input
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.youthName}
              onChange={(e) => update("youthName", e.target.value)}
              placeholder="Enter youth name"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Care Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "physical", label: "Physical Care" },
                { id: "emotional", label: "Emotional Support" },
                { id: "medical", label: "Medical Care" },
                { id: "educational", label: "Educational" },
                { id: "recreational", label: "Recreational" },
                { id: "behavioral", label: "Behavioral" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => update("careType", t.id)}
                  className="px-3 py-2 rounded-lg border text-[11px] font-medium min-h-[40px] transition-all"
                  style={{
                    borderColor: form.careType === t.id ? "#059669" : "var(--card-border)",
                    backgroundColor: form.careType === t.id ? "#ECFDF5" : "transparent",
                    color: form.careType === t.id ? "#059669" : "var(--topbar-subtitle)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Care Description *</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[80px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.careDescription}
              onChange={(e) => update("careDescription", e.target.value)}
              placeholder="Describe the care provided..."
            />
          </div>

          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[12px] font-medium py-2 hover:underline transition-all"
            style={{ color: "#059669" }}
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? "Less options" : "More options"}
          </button>

          {showMore && (
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Mood / Affect</label>
                <input
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.mood}
                  onChange={(e) => update("mood", e.target.value)}
                  placeholder="e.g., Calm, Anxious, Withdrawn"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Behavior</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.behavior}
                  onChange={(e) => update("behavior", e.target.value)}
                  placeholder="Describe observed behavior..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Medications Given</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.medicationsGiven}
                  onChange={(e) => update("medicationsGiven", e.target.value)}
                  placeholder="List any medications administered..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Activities</label>
                <input
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.activities}
                  onChange={(e) => update("activities", e.target.value)}
                  placeholder="e.g., Art therapy, Group discussion"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Concerns / Follow-up</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.concerns}
                  onChange={(e) => update("concerns", e.target.value)}
                  placeholder="Any concerns requiring follow-up..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px] transition-all hover:bg-gray-50"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
          >
            Cancel
          </button>
          <button
            disabled={!form.youthName || !form.careType || !form.careDescription}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#059669" }}
            onClick={() => { onClose(); }}
          >
            Save Care Record
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Modal: Report Incident ───────── */
function ReportIncidentModal({ onClose }: { onClose: () => void }) {
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    incidentType: "", severity: "", description: "", youthInvolved: "",
    staffWitnesses: "", immediateAction: "", injuries: "", notifications: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: "#DC2626" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Report Incident</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        {/* Compliance notice */}
        <div className="rounded-lg border p-3 mb-4 flex items-start gap-2" style={{ borderColor: "#DC262630", backgroundColor: "#FEF2F2" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
          <p className="text-[11px]" style={{ color: "#DC2626" }}>
            This report will be routed to the QA Officer for review. All incidents require documentation within 24 hours.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Incident Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "behavioral", label: "Behavioral" },
                { id: "medical", label: "Medical" },
                { id: "safety", label: "Safety" },
                { id: "property", label: "Property Damage" },
                { id: "runaway", label: "Runaway" },
                { id: "other", label: "Other" },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => update("incidentType", t.id)}
                  className="px-3 py-2 rounded-lg border text-[11px] font-medium min-h-[40px] transition-all"
                  style={{
                    borderColor: form.incidentType === t.id ? "#DC2626" : "var(--card-border)",
                    backgroundColor: form.incidentType === t.id ? "#FEF2F2" : "transparent",
                    color: form.incidentType === t.id ? "#DC2626" : "var(--topbar-subtitle)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Severity *</label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "critical"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => update("severity", s)}
                  className="flex-1 px-3 py-2 rounded-lg border text-[11px] font-medium capitalize min-h-[40px] transition-all"
                  style={{
                    borderColor: form.severity === s ? "#DC2626" : "var(--card-border)",
                    backgroundColor: form.severity === s ? "#FEF2F2" : "transparent",
                    color: form.severity === s ? "#DC2626" : "var(--topbar-subtitle)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Description *</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#DC2626]/20 resize-none min-h-[100px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Describe what happened in detail..."
            />
          </div>

          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[12px] font-medium py-2 hover:underline transition-all"
            style={{ color: "#DC2626" }}
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? "Less options" : "More options"}
          </button>

          {showMore && (
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth Involved</label>
                <input
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#DC2626]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.youthInvolved}
                  onChange={(e) => update("youthInvolved", e.target.value)}
                  placeholder="Names of youth involved"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Staff Witnesses</label>
                <input
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#DC2626]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.staffWitnesses}
                  onChange={(e) => update("staffWitnesses", e.target.value)}
                  placeholder="Names of staff who witnessed"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Immediate Action Taken</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#DC2626]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.immediateAction}
                  onChange={(e) => update("immediateAction", e.target.value)}
                  placeholder="What action was taken immediately..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Injuries</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#DC2626]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.injuries}
                  onChange={(e) => update("injuries", e.target.value)}
                  placeholder="Describe any injuries..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Notifications Made</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#DC2626]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.notifications}
                  onChange={(e) => update("notifications", e.target.value)}
                  placeholder="Who was notified (supervisor, parents, etc.)..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px] transition-all hover:bg-gray-50"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
          >
            Cancel
          </button>
          <button
            disabled={!form.incidentType || !form.severity || !form.description}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#DC2626" }}
            onClick={() => { onClose(); }}
          >
            Submit Report
          </button>
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--topbar-subtitle)" }}>
          This report will be routed to the QA Officer
        </p>
      </div>
    </div>
  );
}

/* ───────── Modal: Complete Shift Handoff ───────── */
function ShiftHandoffModal({ onClose }: { onClose: () => void }) {
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    outgoingStaff: "", incomingStaff: "", unit: "",
    youthSummary: "", pendingItems: "", concerns: "",
    medicationsReviewed: "", appointments: "", notes: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ArrowRight size={20} style={{ color: "#7C3AED" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Complete Shift Handoff</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Outgoing Staff *</label>
              <input
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.outgoingStaff}
                onChange={(e) => update("outgoingStaff", e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Incoming Staff *</label>
              <input
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.incomingStaff}
                onChange={(e) => update("incomingStaff", e.target.value)}
                placeholder="Next shift staff name"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Unit *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
            >
              <option value="">Select unit</option>
              <option value="north">North Unit</option>
              <option value="south">South Unit</option>
              <option value="east">East Unit</option>
              <option value="intake">Intake Unit</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Youth Summary *</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-none min-h-[80px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.youthSummary}
              onChange={(e) => update("youthSummary", e.target.value)}
              placeholder="Summary of youth status during shift..."
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Pending Items *</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-none min-h-[60px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.pendingItems}
              onChange={(e) => update("pendingItems", e.target.value)}
              placeholder="Tasks or follow-ups for next shift..."
            />
          </div>

          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[12px] font-medium py-2 hover:underline transition-all"
            style={{ color: "#7C3AED" }}
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? "Less options" : "More options"}
          </button>

          {showMore && (
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Concerns / Warnings</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.concerns}
                  onChange={(e) => update("concerns", e.target.value)}
                  placeholder="Any concerns for next shift..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Medications Reviewed</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.medicationsReviewed}
                  onChange={(e) => update("medicationsReviewed", e.target.value)}
                  placeholder="Medications given or reviewed..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Upcoming Appointments</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.appointments}
                  onChange={(e) => update("appointments", e.target.value)}
                  placeholder="Appointments or meetings coming up..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px] transition-all hover:bg-gray-50"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
          >
            Cancel
          </button>
          <button
            disabled={!form.outgoingStaff || !form.incomingStaff || !form.unit || !form.youthSummary || !form.pendingItems}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#7C3AED" }}
            onClick={() => { onClose(); }}
          >
            Complete Handoff
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════ */
export function GRODashboardPage() {
  const { data: kpis } = trpc.gro.dashboardKPIs.useQuery();
  const { data: referrals } = trpc.gro.listReferrals.useQuery();
  const { data: partnerships } = trpc.gro.listPartnerships.useQuery();
  const { data: campaigns } = trpc.gro.listCampaigns.useQuery();
  const utils = trpc.useUtils();
  const createRef = trpc.gro.createReferral.useMutation({
    onSuccess: () => {
      utils.gro.listReferrals.invalidate();
      utils.gro.dashboardKPIs.invalidate();
      setShowNew(false);
    }
  });

  const [showNew, setShowNew] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showMoreReferral, setShowMoreReferral] = useState(false);
  const [form, setForm] = useState({
    patientName: "", contactPhone: "", contactEmail: "",
    referralSource: "", sourceDetail: "", referralType: "",
    assignedTo: "", notes: "",
  });

  const kpiCards = [
    { label: "Active Referrals", value: kpis?.activeReferrals ?? 0, icon: Users, color: "#2563EB" },
    { label: "Partnerships", value: kpis?.activePartnerships ?? 0, icon: Handshake, color: "#059669" },
    { label: "Conversion Rate", value: `${kpis?.conversionRate ?? 0}%`, icon: Target, color: "#D97706" },
    { label: "New This Month", value: kpis?.newThisMonth ?? 0, icon: TrendingUp, color: "#245C5A" },
  ];

  const handleQuickAction = (actionId: string) => {
    setActiveModal(actionId);
  };

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Growth & Outreach</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Referral Management, Partnerships & Community Engagement</p>
          </div>
        </div>

        {/* ══════ QUICK ACTIONS ══════
            Rule 1: Primary actions visible in 1 second — placed ABOVE the fold
            Rule 2: No navigation for core tasks — all open modals
            Rule 3: Plain language labels
            Rule 5: 1 col mobile → 2 tablet → 3 desktop, min 44px touch target
        */}
        <div className="mb-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.5px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all hover:shadow-md min-h-[56px]"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: action.color + "15" }}
                >
                  <action.icon size={20} style={{ color: action.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--topbar-title)" }}>
                    {action.label}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--topbar-subtitle)" }}>
                    {action.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ──
            Rule 5: 2 cols mobile, 4 desktop
        */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((c) => (
            <div key={c.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
                <c.icon size={16} style={{ color: c.color }} />
              </div>
              <p className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Referrals ── */}
          <div className="lg:col-span-2 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold mb-0 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Users size={18} style={{ color: "#2563EB" }} /> Referrals ({referrals?.length ?? 0})
              </h2>
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white min-h-[44px] transition-all hover:opacity-90"
                style={{ backgroundColor: "#245C5A" }}
              >
                <Plus size={16} /> New Referral
              </button>
            </div>
            <div className="space-y-3">
              {(!referrals || referrals.length === 0) && <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>No referrals found</p>}
              {Array.isArray(referrals) ? referrals.map((ref: any) => (
                <div key={ref.id} className="flex items-start justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{ref.referral_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: (STATUS_COLORS[ref.status] ?? "#6B7280") + "15", color: STATUS_COLORS[ref.status] ?? "#6B7280" }}>{ref.status}</span>
                      {ref.referral_type && <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: (TYPE_COLORS[ref.referral_type] ?? "#6B7280") + "10", color: TYPE_COLORS[ref.referral_type] ?? "#6B7280" }}>{ref.referral_type}</span>}
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{ref.patient_name}</p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{ref.referral_source} {ref.source_detail ? `— ${ref.source_detail}` : ""}</p>
                    {ref.notes && <p className="text-[11px] mt-1 italic" style={{ color: "var(--topbar-subtitle)" }}>{ref.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {ref.assigned_to && <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{ref.assigned_to}</p>}
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{new Date(ref.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              )) : []}
            </div>
          </div>

          {/* ── Partnerships ── */}
          <div>
            <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Handshake size={18} style={{ color: "#059669" }} /> Partnerships
              </h2>
              <div className="space-y-3">
                {(!partnerships || partnerships.length === 0) && <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No partnerships</p>}
                {Array.isArray(partnerships) ? partnerships.map((p: any) => (
                  <div key={p.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{p.organization_name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: p.status === "active" ? "#D1FAE5" : "#FEF3C7", color: p.status === "active" ? "#059669" : "#D97706" }}>{p.status}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{p.partnership_type}</p>
                    {p.contact_name && <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{p.contact_name}</p>}
                  </div>
                )) : []}
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Megaphone size={18} style={{ color: "#245C5A" }} /> Active Campaigns
              </h2>
              <div className="space-y-3">
                {(!campaigns || campaigns.length === 0) && <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No campaigns</p>}
                {Array.isArray(campaigns) ? campaigns.map((c: any) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{c.campaign_name}</p>
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{c.leads_generated} leads</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((c.conversions / Math.max(c.leads_generated, 1)) * 100, 100)}%`, backgroundColor: "#245C5A" }} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{c.conversions} conversions</span>
                      <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{Math.round((c.conversions / Math.max(c.leads_generated, 1)) * 100)}% rate</span>
                    </div>
                  </div>
                )) : []}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ New Referral Modal (Progressive Disclosure) ══════ */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div
            className="rounded-xl border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Plus size={20} style={{ color: "#245C5A" }} />
                <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>New Referral</h2>
              </div>
              <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
                <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
              </button>
            </div>

            {/* Required fields first */}
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Patient Name *</label>
                <input
                  placeholder="Enter full name"
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.patientName}
                  onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Referral Source *</label>
                <input
                  placeholder="e.g., Hospital, School, Self"
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.referralSource}
                  onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Phone</label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                    style={{ borderColor: "var(--card-border)" }}
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                    style={{ borderColor: "var(--card-border)" }}
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              {/* Progressive disclosure: More options */}
              <button
                onClick={() => setShowMoreReferral(!showMoreReferral)}
                className="flex items-center gap-1 text-[12px] font-medium py-2 hover:underline transition-all"
                style={{ color: "#245C5A" }}
              >
                {showMoreReferral ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showMoreReferral ? "Less options" : "More options"}
              </button>

              {showMoreReferral && (
                <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
                  <div>
                    <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Source Detail</label>
                    <input
                      placeholder="Additional source information"
                      className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                      style={{ borderColor: "var(--card-border)" }}
                      value={form.sourceDetail}
                      onChange={(e) => setForm({ ...form, sourceDetail: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Referral Type</label>
                      <select
                        className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                        style={{ borderColor: "var(--card-border)" }}
                        value={form.referralType}
                        onChange={(e) => setForm({ ...form, referralType: e.target.value })}
                      >
                        <option value="">Select type</option>
                        <option value="intake">Intake</option>
                        <option value="crisis">Crisis</option>
                        <option value="adolescent">Adolescent</option>
                        <option value="mandatory">Mandatory</option>
                        <option value="educational">Educational</option>
                        <option value="community">Community</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Assigned To</label>
                      <input
                        placeholder="Staff member name"
                        className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                        style={{ borderColor: "var(--card-border)" }}
                        value={form.assignedTo}
                        onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Notes</label>
                    <textarea
                      placeholder="Additional notes or context..."
                      className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 resize-none min-h-[80px]"
                      style={{ borderColor: "var(--card-border)" }}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
              <button
                onClick={() => setShowNew(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px] transition-all hover:bg-gray-50"
                style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { if (!form.patientName || !form.referralSource) return; createRef.mutate(form); }}
                disabled={createRef.isPending || !form.patientName || !form.referralSource}
                className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
                style={{ backgroundColor: "#245C5A" }}
              >
                {createRef.isPending ? "Saving..." : "Save Referral"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Action Modals ── */}
      {activeModal === "shift" && <StartShiftModal onClose={() => setActiveModal(null)} />}
      {activeModal === "safety" && <SafetyRoundModal onClose={() => setActiveModal(null)} />}
      {activeModal === "care" && <YouthCareModal onClose={() => setActiveModal(null)} />}
      {activeModal === "incident" && <ReportIncidentModal onClose={() => setActiveModal(null)} />}
      {activeModal === "handoff" && <ShiftHandoffModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

export default GRODashboardPage;
