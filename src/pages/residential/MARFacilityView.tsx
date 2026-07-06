import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import { Pill, CheckCircle2, XCircle, Pause, Clock, Shield, User, Calendar } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  scheduled: { label: "Scheduled", color: "#2563EB", bg: "#EFF6FF", icon: Clock },
  administered: { label: "Administered", color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  refused: { label: "Refused", color: "#DC2626", bg: "#FEF2F2", icon: XCircle },
  held: { label: "Held", color: "#D97706", bg: "#FFFBEB", icon: Pause },
};

interface MARFacilityViewProps {
  facilityId: string;
}

export function MARFacilityView({ facilityId }: MARFacilityViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [administeringMed, setAdministeringMed] = useState<{ youthId: string; medId: string; medName: string; isControlled: boolean } | null>(null);
  const [controlledCountBefore, setControlledCountBefore] = useState<string>("");
  const [controlledCountAfter, setControlledCountAfter] = useState<string>("");
  const [controlledWitness, setControlledWitness] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: medications } = trpc.m20.getFacilityMedications.useQuery({ facilityId });

  const administerMed = trpc.m20.administerMedication.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["m20", "getFacilityMedications"]] });
      setAdministeringMed(null);
      setControlledCountBefore("");
      setControlledCountAfter("");
      setControlledWitness("");
    },
  });

  // Count stats
  const allMeds = medications?.flatMap(y => y.medications.map(m => ({ ...m, youthName: y.youthName, mrn: y.mrn, bedLabel: y.bedLabel }))) ?? [];
  const scheduledCount = allMeds.filter(m => m.status === "scheduled").length;
  const administeredCount = allMeds.filter(m => m.status === "administered").length;
  const refusedCount = allMeds.filter(m => m.status === "refused").length;
  const heldCount = allMeds.filter(m => m.status === "held").length;
  const controlledCount = allMeds.filter(m => m.isControlled).length;

  const handleAdminister = () => {
    if (!administeringMed) return;
    administerMed.mutate({
      medicationId: administeringMed.medId,
      youthId: administeringMed.youthId,
      administeredBy: "Current User",
      timestamp: new Date().toISOString(),
      controlledWitness: administeringMed.isControlled ? controlledWitness : undefined,
      countBefore: administeringMed.isControlled ? parseInt(controlledCountBefore) : undefined,
      countAfter: administeringMed.isControlled ? parseInt(controlledCountAfter) : undefined,
    });
  };

  return (
    <div>
      {/* ─── Summary Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {[
          { label: "Scheduled", count: scheduledCount, color: "#2563EB", bg: "#EFF6FF" },
          { label: "Administered", count: administeredCount, color: "#059669", bg: "#ECFDF5" },
          { label: "Refused", count: refusedCount, color: "#DC2626", bg: "#FEF2F2" },
          { label: "Held", count: heldCount, color: "#D97706", bg: "#FFFBEB" },
          { label: "Controlled", count: controlledCount, color: "#7C3AED", bg: "#F5F3FF" },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-lg border p-2.5 text-center"
            style={{ backgroundColor: stat.bg, borderColor: stat.color + "30" }}
          >
            <div className="text-[16px] font-bold" style={{ color: stat.color }}>{stat.count}</div>
            <div className="text-[9px] font-medium" style={{ color: stat.color + "aa" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Status Filter ───────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {["all", "scheduled", "administered", "refused", "held"].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize"
            style={{
              backgroundColor: statusFilter === status ? (STATUS_CONFIG[status]?.color ?? "#245C5A") : "var(--card-bg)",
              borderColor: statusFilter === status ? (STATUS_CONFIG[status]?.color ?? "#245C5A") : "var(--card-border)",
              color: statusFilter === status ? "#fff" : "var(--topbar-subtitle)",
            }}
          >
            {status === "all" ? "All" : STATUS_CONFIG[status]?.label}
          </button>
        ))}
      </div>

      {/* ─── Youth Medication Cards ──────────────────── */}
      <div className="space-y-3">
        {medications?.map(youth => {
          const filteredMeds = statusFilter === "all"
            ? youth.medications
            : youth.medications.filter(m => m.status === statusFilter);

          if (filteredMeds.length === 0) return null;

          return (
            <div key={youth.youthId} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              {/* Youth Header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: "var(--card-border)", backgroundColor: "#f8fafc" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
                  <User size={14} style={{ color: "#fff" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--topbar-title)" }}>
                    {youth.youthName}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {youth.mrn} • {youth.bedLabel}
                  </div>
                </div>
                <div className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f0f0f0", color: "#666" }}>
                  {filteredMeds.length} meds
                </div>
              </div>

              {/* Medication List */}
              <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                {filteredMeds.map(med => {
                  const status = STATUS_CONFIG[med.status] ?? STATUS_CONFIG.scheduled;
                  const StatusIcon = status.icon;

                  return (
                    <div key={med.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: status.bg }}
                      >
                        {med.isControlled ? (
                          <Shield size={16} style={{ color: "#7C3AED" }} />
                        ) : (
                          <Pill size={16} style={{ color: status.color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>
                            {med.name}
                          </span>
                          {med.isControlled && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}>
                              C-II
                            </span>
                          )}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                          {med.dosage} • {med.frequency} • {med.route}
                        </div>
                        {med.lastAdministered && (
                          <div className="text-[9px]" style={{ color: "#059669" }}>
                            Last: {new Date(med.lastAdministered).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-full font-medium"
                          style={{ backgroundColor: status.bg, color: status.color }}
                        >
                          <StatusIcon size={10} />
                          {status.label}
                        </span>
                        {med.status === "scheduled" && (
                          <button
                            onClick={() => setAdministeringMed({
                              youthId: youth.youthId,
                              medId: med.id,
                              medName: med.name,
                              isControlled: med.isControlled,
                            })}
                            className="text-[10px] px-3 py-1.5 rounded font-medium text-white"
                            style={{ backgroundColor: "#245C5A" }}
                          >
                            {med.isControlled ? "Administer + Count" : "Administer"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {medications?.length === 0 && (
        <div className="text-center py-12">
          <Pill size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            No youth assigned to this facility. Assign youth to beds to see medications.
          </p>
        </div>
      )}

      {/* ─── Administer Modal ────────────────────────── */}
      {administeringMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                {administeringMed.isControlled ? "Controlled Substance Administration" : "Administer Medication"}
              </h3>
              <button
                onClick={() => setAdministeringMed(null)}
                className="text-[18px]" style={{ color: "#94A3B8" }}
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-[13px]" style={{ color: "var(--topbar-title)" }}>
                <strong>{administeringMed.medName}</strong>
              </div>

              {administeringMed.isControlled && (
                <>
                  <div>
                    <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>
                      Count Before Administration
                    </label>
                    <input
                      type="number"
                      value={controlledCountBefore}
                      onChange={e => setControlledCountBefore(e.target.value)}
                      className="w-full px-3 py-2 rounded border text-[13px]"
                      style={{ borderColor: "#E2E8F0" }}
                      placeholder="Enter count"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>
                      Count After Administration
                    </label>
                    <input
                      type="number"
                      value={controlledCountAfter}
                      onChange={e => setControlledCountAfter(e.target.value)}
                      className="w-full px-3 py-2 rounded border text-[13px]"
                      style={{ borderColor: "#E2E8F0" }}
                      placeholder="Enter count"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>
                      Waste Witness (Name/Initials)
                    </label>
                    <input
                      type="text"
                      value={controlledWitness}
                      onChange={e => setControlledWitness(e.target.value)}
                      className="w-full px-3 py-2 rounded border text-[13px]"
                      style={{ borderColor: "#E2E8F0" }}
                      placeholder="Witness name"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setAdministeringMed(null)}
                  className="flex-1 px-4 py-2 rounded border text-[12px] font-medium"
                  style={{ borderColor: "#E2E8F0", color: "var(--topbar-subtitle)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdminister}
                  disabled={administerMed.isPending || (administeringMed.isControlled && (!controlledCountBefore || !controlledCountAfter || !controlledWitness))}
                  className="flex-1 px-4 py-2 rounded text-[12px] font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#245C5A" }}
                >
                  {administerMed.isPending ? "Recording..." : "Confirm Administration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MARFacilityView;
