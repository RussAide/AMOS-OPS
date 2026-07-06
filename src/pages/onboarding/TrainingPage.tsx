import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Search,
  Filter,
  BookOpen,
  Lock,
  Play,
  CheckCircle,
  Clock,
  ArrowRight,
  Layers,
} from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { getProgressPercentage, moduleStatusColors } from "@/data/onboardingData";
import type { Module } from "@/data/onboardingData";

type StatusFilter = "all" | "locked" | "available" | "in-progress" | "completed";
type CategoryFilter = "all" | "Compliance" | "Clinical" | "Operations" | "Professional";

export function TrainingPage() {
  const navigate = useNavigate();
  const { modules, tracks } = useOnboarding();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const filteredModules = modules
    .filter((m) => (statusFilter === "all" ? true : m.status === statusFilter))
    .filter((m) => (categoryFilter === "all" ? true : m.category === categoryFilter))
    .filter((m) =>
      search
        ? m.title.toLowerCase().includes(search.toLowerCase()) ||
          m.description.toLowerCase().includes(search.toLowerCase())
        : true
    );

  const categoryCounts = {
    all: modules.length,
    Compliance: modules.filter((m) => m.category === "Compliance").length,
    Clinical: modules.filter((m) => m.category === "Clinical").length,
    Operations: modules.filter((m) => m.category === "Operations").length,
    Professional: modules.filter((m) => m.category === "Professional").length,
  };

  return (
    <>
      <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#ECFDF5" }}>
            <GraduationCap size={20} style={{ color: "#059669" }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Training Modules
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Browse all available training modules across tracks
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-[13px] outline-none focus:ring-2"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        <Layers size={14} className="mr-1 flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }} />
        {(["all", "Compliance", "Clinical", "Operations", "Professional"] as CategoryFilter[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex-shrink-0"
            style={{
              backgroundColor: categoryFilter === c ? "#245C5A" : "transparent",
              color: categoryFilter === c ? "#fff" : "var(--topbar-subtitle)",
            }}
          >
            {c} ({categoryCounts[c]})
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-1 mb-4">
        <Filter size={14} className="mr-1 flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }} />
        {(["all", "available", "in-progress", "completed", "locked"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all flex-shrink-0"
            style={{
              backgroundColor: statusFilter === s ? "#245C5A" : "transparent",
              color: statusFilter === s ? "#fff" : "var(--topbar-subtitle)",
            }}
          >
            {s.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Results Count */}
      <p className="text-[12px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>
        Showing {filteredModules.length} of {modules.length} modules
      </p>

      {/* Module Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filteredModules.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen size={40} className="mx-auto mb-3" style={{ color: "#CBD5E1" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>
              No modules found
            </p>
          </div>
        ) : (
          filteredModules.map((mod) => <ModuleCard key={mod.id} mod={mod} tracks={tracks} onClick={() => mod.status !== "locked" && navigate(`/onboarding/module/${mod.id}`)} />)
        )}
      </div>
    </div>
  </>
  );
}

function ModuleCard({
  mod,
  tracks,
  onClick,
}: {
  mod: Module;
  tracks: { id: string; name: string }[];
  onClick: () => void;
}) {
  const pct = getProgressPercentage(mod.completedSteps, mod.stepCount);
  const colors = moduleStatusColors[mod.status];
  const isClickable = mod.status !== "locked";
  const track = tracks.find((t) => t.id === mod.trackId);

  const categoryColors: Record<string, string> = {
    Compliance: "#7C3AED",
    Clinical: "#2563EB",
    Operations: "#D97706",
    Professional: "#059669",
  };
  const catColor = categoryColors[mod.category] || "#64748B";

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-4 transition-all duration-200 ${
        isClickable ? "cursor-pointer hover:shadow-md group" : "opacity-60 cursor-not-allowed"
      }`}
      style={{ borderColor: colors.bg.replace("FF", "E2E8F0") || "var(--card-border)", backgroundColor: "var(--card-bg)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
          style={{ backgroundColor: colors.bg }}
        >
          {mod.status === "completed" ? (
            <CheckCircle size={20} style={{ color: colors.text }} />
          ) : mod.status === "locked" ? (
            <Lock size={20} style={{ color: colors.text }} />
          ) : mod.status === "in-progress" ? (
            <Clock size={20} style={{ color: colors.text }} />
          ) : (
            <Play size={20} style={{ color: colors.text }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: catColor + "15", color: catColor }}
            >
              {mod.category}
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {colors.label}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>
              {mod.title}
            </h4>
            {isClickable && (
              <ArrowRight
                size={14}
                className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2"
                style={{ color: "#245C5A" }}
              />
            )}
          </div>

          <p className="text-[12px] mb-2 line-clamp-2" style={{ color: "var(--topbar-subtitle)" }}>
            {mod.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              {track?.name}
            </span>
            {mod.status !== "locked" && (
              <div className="flex items-center gap-2 flex-1 ml-4 max-w-[200px]">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: colors.text }}
                  />
                </div>
                <span className="text-[11px] flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>
                  {mod.completedSteps}/{mod.stepCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrainingPage;
