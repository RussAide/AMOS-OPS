import { trpc } from "@/providers/trpc";
import {
  HeartPulse, Calendar, Users, AlertTriangle, ClipboardCheck,
  Activity, Clock, ShieldAlert, ArrowRight, UserPlus, Play,
  FileText, BarChart3, ChevronDown, ChevronUp, X, Stethoscope
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  intake: "#2563EB",
  active: "#059669",
  hold: "#D97706",
  discharged: "#6B7280",
  transferred: "#7C3AED",
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "admit", label: "Admit New Patient", icon: UserPlus, color: "#245C5A", description: "Create a new patient record" },
  { id: "session", label: "Start Session", icon: Play, color: "#2563EB", description: "Begin a clinical session" },
  { id: "note", label: "Complete Service Note", icon: FileText, color: "#059669", description: "Document a completed session" },
  { id: "outcome", label: "Run Outcome Measure", icon: BarChart3, color: "#D97706", description: "Assess patient progress" },
  { id: "plan", label: "View Treatment Plan", icon: Stethoscope, color: "#7C3AED", description: "Review or update care plan" },
];

/* ───────── Modal: Admit New Patient ───────── */
function AdmitPatientModal({ onClose }: { onClose: () => void }) {
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", gender: "",
    phone: "", email: "", emergencyContact: "", emergencyPhone: "",
    insuranceProvider: "", insuranceId: "", referringProvider: "",
    admissionReason: "", allergies: "", medications: "",
  });

  const handleChange = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus size={20} style={{ color: "#245C5A" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Admit New Patient</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        {/* Required fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>First Name *</label>
              <input
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Last Name *</label>
              <input
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Date of Birth *</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Gender</label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Phone *</label>
            <input
              type="tel"
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Admission Reason *</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 resize-none min-h-[80px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.admissionReason}
              onChange={(e) => handleChange("admissionReason", e.target.value)}
              placeholder="Brief description of presenting concerns"
            />
          </div>

          {/* Progressive disclosure: More options */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[12px] font-medium py-2 hover:underline transition-all"
            style={{ color: "#245C5A" }}
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? "Less options" : "More options"}
          </button>

          {showMore && (
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="patient@example.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Emergency Contact</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                    style={{ borderColor: "var(--card-border)" }}
                    value={form.emergencyContact}
                    onChange={(e) => handleChange("emergencyContact", e.target.value)}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Emergency Phone</label>
                  <input
                    type="tel"
                    className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                    style={{ borderColor: "var(--card-border)" }}
                    value={form.emergencyPhone}
                    onChange={(e) => handleChange("emergencyPhone", e.target.value)}
                    placeholder="(555) 987-6543"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Insurance Provider</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                    style={{ borderColor: "var(--card-border)" }}
                    value={form.insuranceProvider}
                    onChange={(e) => handleChange("insuranceProvider", e.target.value)}
                    placeholder="Insurance company"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Insurance ID</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                    style={{ borderColor: "var(--card-border)" }}
                    value={form.insuranceId}
                    onChange={(e) => handleChange("insuranceId", e.target.value)}
                    placeholder="Policy number"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Referring Provider</label>
                <input
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 min-h-[44px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.referringProvider}
                  onChange={(e) => handleChange("referringProvider", e.target.value)}
                  placeholder="Name of referring clinician or agency"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Allergies</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                  placeholder="List known allergies"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Current Medications</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#245C5A]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.medications}
                  onChange={(e) => handleChange("medications", e.target.value)}
                  placeholder="List current medications"
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
            disabled={!form.firstName || !form.lastName || !form.dateOfBirth || !form.phone || !form.admissionReason}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
            onClick={() => { /* TODO: wire to tRPC mutation */ onClose(); }}
          >
            Admit Patient
          </button>
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--topbar-subtitle)" }}>
          This action requires clinician review
        </p>
      </div>
    </div>
  );
}

/* ───────── Modal: Start Session ───────── */
function StartSessionModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    patientId: "", sessionType: "individual", notes: "",
  });
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-md"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Play size={20} style={{ color: "#2563EB" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Start Session</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Select Patient *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.patientId}
              onChange={(e) => setForm((prev) => ({ ...prev, patientId: e.target.value }))}
            >
              <option value="">Choose a patient</option>
              {(patientsData?.patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} ({p.mrn})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Session Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["individual", "group", "family", "crisis"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setForm((prev) => ({ ...prev, sessionType: type }))}
                  className="px-3 py-2.5 rounded-lg border text-[12px] font-medium capitalize min-h-[44px] transition-all"
                  style={{
                    borderColor: form.sessionType === type ? "#2563EB" : "var(--card-border)",
                    backgroundColor: form.sessionType === type ? "#EFF6FF" : "transparent",
                    color: form.sessionType === type ? "#2563EB" : "var(--topbar-subtitle)",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Session Notes</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none min-h-[80px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any notes before starting..."
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
            disabled={!form.patientId}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#2563EB" }}
            onClick={() => { /* TODO: wire to tRPC mutation */ onClose(); }}
          >
            Start Session
          </button>
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--topbar-subtitle)" }}>
          This action requires clinician review
        </p>
      </div>
    </div>
  );
}

/* ───────── Modal: Complete Service Note ───────── */
function ServiceNoteModal({ onClose }: { onClose: () => void }) {
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    patientId: "", sessionDate: new Date().toISOString().split("T")[0],
    durationMinutes: "50", noteType: "progress", content: "",
    interventions: "", responseToIntervention: "", planForNextSession: "",
  });
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });

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
            <FileText size={20} style={{ color: "#059669" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Complete Service Note</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Select Patient *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.patientId}
              onChange={(e) => update("patientId", e.target.value)}
            >
              <option value="">Choose a patient</option>
              {(patientsData?.patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Session Date *</label>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.sessionDate}
                onChange={(e) => update("sessionDate", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Duration (min) *</label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={form.durationMinutes}
                onChange={(e) => update("durationMinutes", e.target.value)}
              >
                <option value="30">30 min</option>
                <option value="50">50 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Note Type</label>
            <div className="flex flex-wrap gap-2">
              {(["progress", "intake", "discharge", "crisis"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update("noteType", t)}
                  className="px-3 py-2 rounded-lg border text-[11px] font-medium capitalize min-h-[36px] transition-all"
                  style={{
                    borderColor: form.noteType === t ? "#059669" : "var(--card-border)",
                    backgroundColor: form.noteType === t ? "#ECFDF5" : "transparent",
                    color: form.noteType === t ? "#059669" : "var(--topbar-subtitle)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Session Summary *</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[100px]"
              style={{ borderColor: "var(--card-border)" }}
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              placeholder="Describe the session content, observations, and clinical impressions..."
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
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Interventions Used</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.interventions}
                  onChange={(e) => update("interventions", e.target.value)}
                  placeholder="Describe therapeutic interventions..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Response to Intervention</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.responseToIntervention}
                  onChange={(e) => update("responseToIntervention", e.target.value)}
                  placeholder="Patient's response..."
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Plan for Next Session</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none min-h-[60px]"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.planForNextSession}
                  onChange={(e) => update("planForNextSession", e.target.value)}
                  placeholder="Goals and focus for next session..."
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
            disabled={!form.patientId || !form.sessionDate || !form.content}
            className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
            style={{ backgroundColor: "#059669" }}
            onClick={() => { onClose(); }}
          >
            Save Note
          </button>
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--topbar-subtitle)" }}>
          This action requires clinician review
        </p>
      </div>
    </div>
  );
}

/* ───────── Modal: Run Outcome Measure ───────── */
function OutcomeMeasureModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"select" | "score">("select");
  const [measure, setMeasure] = useState("");
  const [patientId, setPatientId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });

  const measures = [
    { id: "phq9", name: "PHQ-9 (Depression)", questions: 9 },
    { id: "gad7", name: "GAD-7 (Anxiety)", questions: 7 },
    { id: "pcss", name: "PCSS (PTSD)", questions: 17 },
    { id: "crs", name: "CRS (Crisis Risk)", questions: 6 },
  ];

  const selectedMeasure = measures.find((m) => m.id === measure);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} style={{ color: "#D97706" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>Run Outcome Measure</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        {step === "select" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Select Patient *</label>
              <select
                className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#D97706]/20 min-h-[44px]"
                style={{ borderColor: "var(--card-border)" }}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Choose a patient</option>
                {(patientsData?.patients ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Select Measure *</label>
              <div className="grid grid-cols-1 gap-2">
                {measures.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMeasure(m.id)}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border text-left min-h-[44px] transition-all"
                    style={{
                      borderColor: measure === m.id ? "#D97706" : "var(--card-border)",
                      backgroundColor: measure === m.id ? "#FFFBEB" : "transparent",
                    }}
                  >
                    <span className="text-[13px] font-medium" style={{ color: measure === m.id ? "#D97706" : "var(--topbar-title)" }}>
                      {m.name}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{m.questions} items</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              disabled={!patientId || !measure}
              onClick={() => setStep("score")}
              className="w-full px-5 py-3 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 min-h-[44px] transition-all hover:opacity-90"
              style={{ backgroundColor: "#D97706" }}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setStep("select")}
              className="text-[12px] font-medium flex items-center gap-1 hover:underline"
              style={{ color: "#D97706" }}
            >
              <ArrowRight size={12} className="rotate-180" /> Back to selection
            </button>
            <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
              {selectedMeasure?.name}
            </p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Score each item 0 (not at all) to 3 (nearly every day)
            </p>
            {Array.from({ length: selectedMeasure?.questions ?? 0 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: "var(--topbar-title)" }}>Item {i + 1}</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScores((prev) => ({ ...prev, [`q${i}`]: s }))}
                      className="w-10 h-10 rounded-lg border text-[12px] font-medium transition-all min-h-[40px]"
                      style={{
                        borderColor: scores[`q${i}`] === s ? "#D97706" : "var(--card-border)",
                        backgroundColor: scores[`q${i}`] === s ? "#FFFBEB" : "transparent",
                        color: scores[`q${i}`] === s ? "#D97706" : "var(--topbar-subtitle)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>
              <button
                onClick={() => setStep("select")}
                className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium border min-h-[44px]"
                style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
              >
                Back
              </button>
              <button
                className="w-full sm:w-auto px-5 py-3 rounded-lg text-[13px] font-medium text-white min-h-[44px] transition-all hover:opacity-90"
                style={{ backgroundColor: "#D97706" }}
                onClick={() => { onClose(); }}
              >
                Save Scores
              </button>
            </div>
          </div>
        )}
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--topbar-subtitle)" }}>
          This action requires clinician review
        </p>
      </div>
    </div>
  );
}

/* ───────── Modal: View Treatment Plan ───────── */
function TreatmentPlanModal({ onClose }: { onClose: () => void }) {
  const [patientId, setPatientId] = useState("");
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 100 });

  const selectedPatient = patientsData?.patients.find((p) => p.id === patientId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Stethoscope size={20} style={{ color: "#7C3AED" }} />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--topbar-title)" }}>View Treatment Plan</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} style={{ color: "var(--topbar-subtitle)" }} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Select Patient *</label>
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#7C3AED]/20 min-h-[44px]"
              style={{ borderColor: "var(--card-border)" }}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Choose a patient</option>
              {(patientsData?.patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
              ))}
            </select>
          </div>

          {selectedPatient && (
            <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[selectedPatient.status] ?? "#6B7280" }}
                >
                  {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                </div>
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    {selectedPatient.lastName}, {selectedPatient.firstName}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {selectedPatient.mrn} &bull; <span style={{ color: STATUS_COLORS[selectedPatient.status] }}>{selectedPatient.status}</span>
                  </p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-3" style={{ borderColor: "var(--card-border)" }}>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--topbar-subtitle)" }}>Diagnosis</p>
                  <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>F32.1 Major Depressive Disorder, Moderate</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--topbar-subtitle)" }}>Treatment Goals</p>
                  <ul className="space-y-1">
                    {["Reduce depressive symptoms by 50% in 8 weeks", "Improve sleep hygiene and daily routine", "Develop coping skills for anxiety triggers"].map((goal, i) => (
                      <li key={i} className="text-[12px] flex items-start gap-2" style={{ color: "var(--topbar-title)" }}>
                        <Target size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#7C3AED" }} />
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--topbar-subtitle)" }}>Interventions</p>
                  <ul className="space-y-1">
                    {["Weekly individual CBT sessions", "Family therapy bi-weekly", "Medication management with psychiatrist"].map((item, i) => (
                      <li key={i} className="text-[12px] flex items-start gap-2" style={{ color: "var(--topbar-title)" }}>
                        <Activity size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#059669" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--topbar-subtitle)" }}>Next Review</p>
                  <p className="text-[13px]" style={{ color: "var(--topbar-title)" }}>July 15, 2026</p>
                </div>
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
            Close
          </button>
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--topbar-subtitle)" }}>
          This action requires clinician review
        </p>
      </div>
    </div>
  );
}

// Need to import Target for the treatment plan modal
function Target(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 24, ...rest } = props;
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}

/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════ */
export function ClinicalDashboardPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { data: kpis } = trpc.bhc.dashboardKPIs.useQuery();
  const { data: workload } = trpc.bhc.clinicianWorkload.useQuery();
  const { data: sessionsData } = trpc.bhc.listSessions.useQuery({ status: "scheduled" });
  const { data: patientsData } = trpc.bhc.listPatients.useQuery({ pageSize: 5 });

  const kpiCards = [
    { label: "Total Patients", value: kpis?.totalPatients ?? 0, icon: Users, color: "#2563EB" },
    { label: "Active Cases", value: kpis?.activePatients ?? 0, icon: HeartPulse, color: "#059669" },
    { label: "Sessions Today", value: kpis?.sessionsToday ?? 0, icon: Calendar, color: "#D97706" },
    { label: "Pending Approvals", value: kpis?.pendingApprovals ?? 0, icon: ClipboardCheck, color: "#7C3AED" },
    { label: "High Risk Flags", value: kpis?.highRiskCount ?? 0, icon: ShieldAlert, color: "#DC2626" },
    { label: "Sessions This Week", value: kpis?.sessionsThisWeek ?? 0, icon: Activity, color: "#245C5A" },
  ];

  const upcomingSessions = (sessionsData ?? []).slice(0, 8);

  const handleQuickAction = (actionId: string) => {
    if (actionId === "plan") {
      setActiveModal("plan");
    } else if (actionId === "admit") {
      setActiveModal("admit");
    } else if (actionId === "session") {
      setActiveModal("session");
    } else if (actionId === "note") {
      setActiveModal("note");
    } else if (actionId === "outcome") {
      setActiveModal("outcome");
    }
  };

  return (
    <>
      <div className="px-4 md:px-6 pt-4">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Clinical Dashboard
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Behavioral Health Clinical Operations Overview
            </p>
          </div>
        </div>

        {/* ══════ QUICK ACTIONS ══════
            Rule 1: Primary actions visible in 1 second — placed ABOVE the fold
            Rule 2: No navigation for core tasks — all open modals
            Rule 3: Plain language labels
            Rule 5: 3 cols desktop → 2 tablet → 1 mobile, min 44px touch target
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
                className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all hover:shadow-md hover:border-[var(--accent)] min-h-[56px]"
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
            Rule 5: Responsive grid — 2 cols mobile, 3 tablet, 6 desktop
        */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {card.label}
                </span>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <p className="text-[24px] font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Upcoming Sessions ── */}
          <div className="lg:col-span-2 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Calendar size={18} style={{ color: "#245C5A" }} />
                Upcoming Sessions
              </h2>
              <span className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                {upcomingSessions.length} scheduled
              </span>
            </div>
            <div className="space-y-2">
              {upcomingSessions.length === 0 && (
                <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>
                  No upcoming sessions
                </p>
              )}
              {upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                  onClick={() => navigate(`/clinical/patients/${session.patientId}`)}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F0FDFA" }}>
                    <Clock size={16} style={{ color: "#245C5A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                      {new Date(session.sessionDate).toLocaleString()}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {session.sessionType} &bull; {session.durationMinutes} min &bull; {session.billingCode ?? "No billing code"}
                    </p>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Clinician Workload ── */}
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[15px] font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--topbar-title)" }}>
              <Activity size={18} style={{ color: "#2563EB" }} />
              Clinician Workload
            </h2>
            <div className="space-y-3">
              {(!workload || workload.length === 0) && (
                <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>
                  No workload data
                </p>
              )}
              {workload?.map((w) => (
                <div key={w.clinicianId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                      {w.name}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {w.sessionCountThisWeek} this week
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((w.sessionCountThisWeek / 20) * 100, 100)}%`,
                          backgroundColor: w.sessionCountThisWeek > 15 ? "#DC2626" : w.sessionCountThisWeek > 10 ? "#D97706" : "#059669",
                        }}
                      />
                    </div>
                    <span className="text-[11px] w-8 text-right flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>
                      {w.patientCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Patients ──
            Rule 5: Cards on mobile (already card layout), 2 cols tablet, 3 desktop
        */}
        <div className="mt-6 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={18} style={{ color: "#7C3AED" }} />
              Recent Patients
            </h2>
            <button
              onClick={() => navigate("/clinical/patients")}
              className="text-[12px] font-medium flex items-center gap-1 hover:underline px-3 py-2 rounded-lg min-h-[36px]"
              style={{ color: "#245C5A" }}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(patientsData?.patients ?? []).map((patient) => (
              <div
                key={patient.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                style={{ borderColor: "var(--card-border)" }}
                onClick={() => navigate(`/clinical/patients/${patient.id}`)}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[patient.status] ?? "#6B7280" }}
                >
                  {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                    {patient.lastName}, {patient.firstName}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {patient.mrn} &bull; <span style={{ color: STATUS_COLORS[patient.status] }}>{patient.status}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modals (Rule 2: No navigation for core tasks) ── */}
      {activeModal === "admit" && <AdmitPatientModal onClose={() => setActiveModal(null)} />}
      {activeModal === "session" && <StartSessionModal onClose={() => setActiveModal(null)} />}
      {activeModal === "note" && <ServiceNoteModal onClose={() => setActiveModal(null)} />}
      {activeModal === "outcome" && <OutcomeMeasureModal onClose={() => setActiveModal(null)} />}
      {activeModal === "plan" && <TreatmentPlanModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

export default ClinicalDashboardPage;
