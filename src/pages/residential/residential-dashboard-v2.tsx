import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import {
  Building2, Bed, Users, TrendingUp, AlertTriangle, ChevronDown,
  DoorOpen, Layers, Eye, VolumeX, Accessibility, CheckCircle2,
  CircleDot, Clock, ArrowRightLeft, Pill, Phone, FileText,
  BarChart3,
} from "lucide-react";
import { PredictiveAnalytics } from "./predictive-analytics";
import { MARFacilityView } from "./mar-facility-view";

const FACILITY_COLORS: Record<string, string> = {
  "fac-001": "#245C5A",
  "fac-002": "#2563EB",
  "fac-003": "#7C3AED",
  "fac-004": "#059669",
};

const ROOM_TYPE_ICON: Record<string, { icon: typeof Eye; color: string; label: string }> = {
  standard: { icon: Bed, color: "#245C5A", label: "Standard" },
  observation: { icon: Eye, color: "#D97706", label: "Observation" },
  quiet: { icon: VolumeX, color: "#2563EB", label: "Quiet" },
  ada_accessible: { icon: Accessibility, color: "#059669", label: "ADA" },
  isolation: { icon: AlertTriangle, color: "#DC2626", label: "Isolation" },
};

export function ResidentialDashboardV2() {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("fac-001");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("census");
  const queryClient = useQueryClient();

  const { data: facilities } = trpc.m19.listFacilities.useQuery();
  const { data: rooms } = trpc.m19.listRooms.useQuery(
    selectedFacilityId ? { facilityId: selectedFacilityId } : undefined
  );
  const { data: beds } = trpc.m19.listBeds.useQuery(
    selectedFacilityId ? { facilityId: selectedFacilityId } : undefined
  );
  const { data: phases } = trpc.m19.listPhases.useQuery(
    selectedFacilityId ? { facilityId: selectedFacilityId } : undefined
  );
  const { data: campusSummary } = trpc.m19.getCampusSummary.useQuery();

  const selectedFacility = facilities?.find(f => f.id === selectedFacilityId);

  // Filter rooms by floor
  const filteredRooms = selectedFloor === "all"
    ? rooms
    : rooms?.filter(r => r.floor === selectedFloor);

  // Get beds for a room
  const getRoomBeds = (roomId: string) => beds?.filter(b => b.roomId === roomId) ?? [];

  // Floor tabs
  const floors = [...new Set(rooms?.map(r => r.floor) ?? [])].sort();
  const floorLabels: Record<string, string> = {
    ground: "Ground Floor",
    first: "First Floor",
    second: "Second Floor",
    third: "Third Floor",
    basement: "Basement",
  };

  // Campus metrics
  const campusMetrics = campusSummary ?? {
    campusTotalBeds: 0, campusOccupiedBeds: 0, campusVacantBeds: 0,
    campusOccupancyRate: 0, licensedCapacityTotal: 0, operationalCapacityTotal: 0,
    byFacility: [],
  };

  const vacateBed = trpc.m19.vacateBed.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["m19", "listBeds"]] });
      queryClient.invalidateQueries({ queryKey: [["m19", "getCampusSummary"]] });
    },
  });

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            Residential Operations
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
            48-bed campus across 4 facilities — phased activation
          </p>
        </div>
      </div>

      {/* ─── Facility Selector ─────────────────────────── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {facilities?.map(f => (
          <button
            key={f.id}
            onClick={() => { setSelectedFacilityId(f.id); setSelectedFloor("all"); }}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-all"
            style={{
              backgroundColor: selectedFacilityId === f.id ? (FACILITY_COLORS[f.id] || "#245C5A") : "var(--card-bg, #fff)",
              borderColor: selectedFacilityId === f.id ? (FACILITY_COLORS[f.id] || "#245C5A") : "var(--card-border, #E2E8F0)",
              color: selectedFacilityId === f.id ? "#fff" : "var(--topbar-title)",
            }}
          >
            <Building2 size={15} />
            <span className="hidden sm:inline">{f.name}</span>
            <span className="sm:hidden">{f.code}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: selectedFacilityId === f.id ? "rgba(255,255,255,0.25)" : (f.status === "active" ? "#ECFDF5" : "#F3F4F6"),
                color: selectedFacilityId === f.id ? "#fff" : (f.status === "active" ? "#059669" : "#6B7280"),
              }}
            >
              {f.status}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Campus Summary Cards ──────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Bed size={14} style={{ color: "#245C5A" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Campus Beds</span>
          </div>
          <div className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
            {campusMetrics.campusOccupiedBeds}<span className="text-[13px] font-normal" style={{ color: "var(--topbar-subtitle)" }}>/{campusMetrics.campusTotalBeds}</span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: "#059669" }}>
            {campusMetrics.campusOccupancyRate}% occupancy
          </div>
        </div>
        <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} style={{ color: "#059669" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Licensed Capacity</span>
          </div>
          <div className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
            {campusMetrics.licensedCapacityTotal}
          </div>
          <div className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
            Total licensed beds
          </div>
        </div>
        <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} style={{ color: "#2563EB" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Operational</span>
          </div>
          <div className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
            {campusMetrics.operationalCapacityTotal}
          </div>
          <div className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
            Beds currently active
          </div>
        </div>
        <div className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} style={{ color: "#7C3AED" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Vacant Beds</span>
          </div>
          <div className="text-[20px] font-bold" style={{ color: campusMetrics.campusVacantBeds < 5 ? "#DC2626" : "var(--topbar-title)" }}>
            {campusMetrics.campusVacantBeds}
          </div>
          <div className="text-[10px] mt-1" style={{ color: campusMetrics.campusVacantBeds < 5 ? "#DC2626" : "var(--topbar-subtitle)" }}>
            {campusMetrics.campusVacantBeds < 5 ? "Low availability" : "Available for intake"}
          </div>
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        {[
          { key: "census", label: "Census", icon: Bed },
          { key: "phases", label: "Phases", icon: TrendingUp },
          { key: "analytics", label: "Analytics", icon: BarChart3 },
          { key: "shifts", label: "Shifts", icon: Clock },
          { key: "medications", label: "Medications", icon: Pill },
          { key: "contacts", label: "Family", icon: Phone },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeTab === tab.key ? "#245C5A" : "transparent",
              color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)",
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Census Tab ────────────────────────────────── */}
      {activeTab === "census" && (
        <div>
          {/* Facility detail bar */}
          {selectedFacility && (
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 rounded-lg" style={{ backgroundColor: "#f0f6f6" }}>
              <div className="flex items-center gap-2">
                <Building2 size={16} style={{ color: FACILITY_COLORS[selectedFacility.id] || "#245C5A" }} />
                <span className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                  {selectedFacility.name}
                </span>
              </div>
              <div className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                Licensed: <strong style={{ color: "var(--topbar-title)" }}>{selectedFacility.licensedCapacity}</strong>
                {" | "}Operational: <strong style={{ color: "var(--topbar-title)" }}>{selectedFacility.operationalCapacity}</strong>
                {" | "}Occupied: <strong style={{ color: "var(--topbar-title)" }}>{beds?.filter(b => b.isOccupied).length ?? 0}</strong>
                {" | "}Vacant: <strong style={{ color: "var(--topbar-title)" }}>{(beds?.length ?? 0) - (beds?.filter(b => b.isOccupied).length ?? 0)}</strong>
              </div>
            </div>
          )}

          {/* Floor filter */}
          {floors.length > 1 && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedFloor("all")}
                className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors"
                style={{
                  backgroundColor: selectedFloor === "all" ? "#245C5A" : "var(--card-bg)",
                  borderColor: selectedFloor === "all" ? "#245C5A" : "var(--card-border)",
                  color: selectedFloor === "all" ? "#fff" : "var(--topbar-subtitle)",
                }}
              >
                All Floors
              </button>
              {floors.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFloor(f)}
                  className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: selectedFloor === f ? "#245C5A" : "var(--card-bg)",
                    borderColor: selectedFloor === f ? "#245C5A" : "var(--card-border)",
                    color: selectedFloor === f ? "#fff" : "var(--topbar-subtitle)",
                  }}
                >
                  <Layers size={11} />
                  {floorLabels[f] || f}
                </button>
              ))}
            </div>
          )}

          {/* Room Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRooms?.map(room => {
              const roomBeds = getRoomBeds(room.id);
              const occupiedCount = roomBeds.filter(b => b.isOccupied).length;
              const typeInfo = ROOM_TYPE_ICON[room.roomType] || ROOM_TYPE_ICON.standard;
              const TypeIcon = typeInfo.icon;

              return (
                <div
                  key={room.id}
                  className="rounded-lg border overflow-hidden"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: room.status === "active" ? "var(--card-border)" : "#E5E7EB",
                    opacity: room.status === "active" ? 1 : 0.6,
                  }}
                >
                  {/* Room Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--card-border)", backgroundColor: room.status === "active" ? "#f8fafc" : "#f3f4f6" }}>
                    <div className="flex items-center gap-2">
                      <DoorOpen size={15} style={{ color: FACILITY_COLORS[selectedFacilityId] || "#245C5A" }} />
                      <span className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                        Room {room.roomNumber}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: typeInfo.color + "15", color: typeInfo.color }}
                      >
                        <TypeIcon size={10} />
                        {typeInfo.label}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium" style={{ color: occupiedCount === room.maxBeds ? "#DC2626" : "#059669" }}>
                      {occupiedCount}/{room.maxBeds} beds
                    </div>
                  </div>

                  {/* Beds Grid */}
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {roomBeds.map(bed => (
                      <div
                        key={bed.id}
                        className="flex items-center gap-2 p-2.5 rounded-md border"
                        style={{
                          backgroundColor: bed.isOccupied ? "#f0fdf4" : "#f8fafc",
                          borderColor: bed.isOccupied ? "#bbf7d0" : "#e2e8f0",
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: bed.isOccupied ? "#059669" : "#e2e8f0",
                          }}
                        >
                          <Bed size={14} style={{ color: bed.isOccupied ? "#fff" : "#94a3b8" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                            {bed.isOccupied ? bed.youthName : `Bed ${bed.bedNumber}`}
                          </div>
                          <div className="text-[9px] truncate" style={{ color: "var(--topbar-subtitle)" }}>
                            {bed.isOccupied ? bed.mrn : "Vacant"}
                          </div>
                        </div>
                        {bed.isOccupied && (
                          <button
                            onClick={() => vacateBed.mutate({ bedId: bed.id })}
                            className="text-[9px] px-2 py-1 rounded border flex-shrink-0"
                            style={{ borderColor: "#fca5a5", color: "#dc2626", backgroundColor: "#fef2f2" }}
                          >
                            Vacate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRooms?.length === 0 && (
            <div className="text-center py-12">
              <Building2 size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
              <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                No rooms found for this floor
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Phases Tab ────────────────────────────────── */}
      {activeTab === "phases" && (
        <div>
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>
            Phase Activation Timeline
          </h3>
          <div className="space-y-3">
            {phases?.map(phase => (
              <div
                key={phase.id}
                className="flex items-center gap-4 p-3 rounded-lg border"
                style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-bold"
                  style={{
                    backgroundColor: phase.status === "active" ? "#059669" : phase.status === "pending" ? "#f59e0b" : "#6b7280",
                    color: "#fff",
                  }}
                >
                  {phase.phaseNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    {phase.phaseName}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {phase.bedsActivated} beds • {phase.roomsActivated} rooms
                    {phase.activationDate && ` • Activated ${phase.activationDate}`}
                    {phase.targetDate && !phase.activationDate && ` • Target: ${phase.targetDate}`}
                  </div>
                </div>
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                  style={{
                    backgroundColor: phase.status === "active" ? "#ECFDF5" : phase.status === "pending" ? "#FEF3C7" : "#F3F4F6",
                    color: phase.status === "active" ? "#059669" : phase.status === "pending" ? "#D97706" : "#6B7280",
                  }}
                >
                  {phase.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Analytics Tab ─────────────────────────────── */}
      {activeTab === "analytics" && <PredictiveAnalytics />}

      {/* ─── Placeholder Tabs ──────────────────────────── */}
      {activeTab === "shifts" && (
        <div className="text-center py-12">
          <Clock size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Shift management — connect to existing shift data (M18)
          </p>
        </div>
      )}
      {activeTab === "medications" && <MARFacilityView facilityId={selectedFacilityId} />}
      {activeTab === "contacts" && (
        <div className="text-center py-12">
          <Phone size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Family contacts — connect to contact log (M18)
          </p>
        </div>
      )}
    </div>
  );
}

export default ResidentialDashboardV2;
