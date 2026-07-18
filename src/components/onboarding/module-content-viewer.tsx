import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  ChevronRight,
  Lock,
  ArrowLeft,
  ArrowRight,
  Clock,
  FileText,
  HelpCircle,
  MousePointerClick,
  BookOpen,
} from "lucide-react";
import { useOnboarding } from "@/context/onboarding-context";
import {
  getModuleById,
  getTrackById,
  moduleStatusColors,
} from "@/data/onboardingData";
import { IllustratedContentViewer } from "./illustrated-content-viewer";

const contentTypeIcons: Record<string, typeof FileText> = {
  text: FileText,
  quiz: HelpCircle,
  interactive: MousePointerClick,
};

const categoryColors: Record<string, string> = {
  Compliance: "#7C3AED",
  Clinical: "#2563EB",
  Operations: "#D97706",
  Professional: "#059669",
};

interface ModuleContentViewerProps {
  moduleId: string;
}

export function ModuleContentViewer({ moduleId }: ModuleContentViewerProps) {
  const navigate = useNavigate();
  const {
    completeStep,
    markModuleComplete,
    saveQuizResult,
    getStepsForModule,
    getModuleProgress,
  } = useOnboarding();

  const mod = getModuleById(moduleId);
  const moduleSteps = getStepsForModule(moduleId);
  const progress = getModuleProgress(moduleId);

  const [activeStepId, setActiveStepId] = useState(() => {
    // Find first incomplete step, or first step if all complete
    const firstIncomplete = moduleSteps.find((s) => !s.completed);
    return firstIncomplete?.id || moduleSteps[0]?.id || "";
  });

  if (!mod) {
    return (
      <div className="text-center py-12">
        <p className="text-[14px]" style={{ color: "var(--topbar-subtitle)" }}>
          Module not found.
        </p>
      </div>
    );
  }

  const track = getTrackById(mod.trackId);
  const activeStep =
    moduleSteps.find((s) => s.id === activeStepId) || moduleSteps[0];
  const activeIndex = moduleSteps.findIndex((s) => s.id === activeStepId);
  const statusColors = moduleStatusColors[mod.status];

  const completedCount = moduleSteps.filter((s) => s.completed).length;
  const allComplete = completedCount === moduleSteps.length;

  const handleMarkComplete = () => {
    if (activeStep && !activeStep.completed) {
      completeStep(activeStep.id);
      // Auto-advance to next incomplete step
      const nextIncomplete = moduleSteps.find(
        (s, i) => i > activeIndex && !s.completed,
      );
      if (nextIncomplete) {
        setActiveStepId(nextIncomplete.id);
      }
    }
  };

  const handleMarkModuleComplete = () => {
    markModuleComplete(mod.id);
  };

  const handleQuizComplete = (
    score: number,
    totalQuestions: number,
    passed: boolean,
  ) => {
    saveQuizResult({
      moduleId,
      score,
      totalQuestions,
      passed,
      answers: [],
    });
  };

  const goToPrevious = () => {
    if (activeIndex > 0) {
      setActiveStepId(moduleSteps[activeIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (activeIndex < moduleSteps.length - 1) {
      setActiveStepId(moduleSteps[activeIndex + 1].id);
    }
  };

  const catColor = categoryColors[mod.category] || "#64748B";
  const StepIcon = activeStep
    ? contentTypeIcons[activeStep.contentType] || FileText
    : FileText;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate("/onboarding")}
          className="text-[13px] font-medium hover:underline"
          style={{ color: "#245C5A" }}
        >
          Tracks
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <button
          onClick={() => navigate(`/onboarding/track/${mod.trackId}`)}
          className="text-[13px] font-medium hover:underline"
          style={{ color: "#245C5A" }}
        >
          {track?.name || "Track"}
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span
          className="text-[13px]"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {mod.title}
        </span>
      </div>

      {/* Module Header */}
      <div
        className="rounded-lg border p-5 mb-5"
        style={{
          borderColor: "var(--card-border)",
          backgroundColor: "var(--card-bg)",
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: catColor + "15", color: catColor }}
              >
                {mod.category}
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded"
                style={{
                  backgroundColor: statusColors.bg,
                  color: statusColors.text,
                }}
              >
                {statusColors.label}
              </span>
            </div>
            <h2
              className="text-[20px] font-bold mb-1"
              style={{ color: "var(--topbar-title)" }}
            >
              {mod.title}
            </h2>
            <p
              className="text-[13px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {mod.description}
            </p>
          </div>
          <div className="text-right ml-4">
            <span
              className="text-[28px] font-bold"
              style={{ color: "#245C5A" }}
            >
              {progress.percentage}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress.percentage}%`,
                backgroundColor:
                  progress.percentage === 100 ? "#059669" : "#245C5A",
              }}
            />
          </div>
          <span
            className="text-[12px] font-medium flex-shrink-0"
            style={{ color: "var(--topbar-title)" }}
          >
            {progress.completed}/{progress.total} steps
          </span>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Step Navigation Sidebar */}
        <div className="w-72 flex-shrink-0">
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              borderColor: "var(--card-border)",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: "var(--card-border)" }}
            >
              <h4
                className="text-[13px] font-semibold flex items-center gap-2"
                style={{ color: "var(--topbar-title)" }}
              >
                <BookOpen size={15} style={{ color: "#245C5A" }} />
                Module Contents
              </h4>
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {moduleSteps.length} sections •{" "}
                {Math.round(
                  (moduleSteps.reduce((acc, s) => acc + s.durationMinutes, 0) /
                    60) *
                    10,
                ) / 10}
                h total
              </p>
            </div>

            <div
              className="divide-y"
              style={{ borderColor: "var(--card-border)" }}
            >
              {moduleSteps.map((step, index) => {
                const isActive = step.id === activeStepId;
                const isLocked = !step.completed && index > completedCount;
                const StepTypeIcon =
                  contentTypeIcons[step.contentType] || FileText;

                return (
                  <button
                    key={step.id}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100"
                    style={{
                      backgroundColor: isActive ? "#F0FDFA" : "transparent",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      opacity: isLocked ? 0.4 : 1,
                    }}
                    onClick={() => !isLocked && setActiveStepId(step.id)}
                  >
                    {step.completed ? (
                      <CheckCircle
                        size={16}
                        style={{ color: "#059669" }}
                        className="flex-shrink-0"
                      />
                    ) : isLocked ? (
                      <Lock
                        size={16}
                        style={{ color: "#94A3B8" }}
                        className="flex-shrink-0"
                      />
                    ) : (
                      <StepTypeIcon
                        size={16}
                        style={{ color: isActive ? "#245C5A" : "#64748B" }}
                        className="flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-medium truncate"
                        style={{
                          color: isActive ? "#245C5A" : "var(--topbar-title)",
                        }}
                      >
                        {index + 1}. {step.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <Clock
                          size={11}
                          style={{ color: "var(--topbar-subtitle)" }}
                        />
                        <p
                          className="text-[11px]"
                          style={{ color: "var(--topbar-subtitle)" }}
                        >
                          {step.durationMinutes} min
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight
                        size={14}
                        style={{ color: "#245C5A" }}
                        className="flex-shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Complete Button */}
          {allComplete && (
            <div
              className="mt-3 p-3 rounded-lg border text-center"
              style={{ borderColor: "#059669", backgroundColor: "#ECFDF5" }}
            >
              <CheckCircle
                size={20}
                style={{ color: "#059669" }}
                className="mx-auto mb-1"
              />
              <p
                className="text-[12px] font-semibold"
                style={{ color: "#065F46" }}
              >
                Module Complete
              </p>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {activeStep && (
            <div
              className="rounded-lg border"
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              {/* Content Header */}
              <div
                className="p-6 border-b"
                style={{ borderColor: "var(--card-border)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: catColor + "15",
                      color: catColor,
                    }}
                  >
                    {mod.category}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Section {activeIndex + 1} of {moduleSteps.length}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <StepIcon size={18} style={{ color: "#245C5A" }} />
                  <h3
                    className="text-[20px] font-bold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    {activeStep.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className="text-[12px] flex items-center gap-1"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    <Clock size={13} />
                    {activeStep.durationMinutes} minutes
                  </span>
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded capitalize"
                    style={{
                      backgroundColor:
                        activeStep.contentType === "quiz"
                          ? "#FEF3C7"
                          : activeStep.contentType === "interactive"
                            ? "#DBEAFE"
                            : "#F1F5F9",
                      color:
                        activeStep.contentType === "quiz"
                          ? "#92400E"
                          : activeStep.contentType === "interactive"
                            ? "#1E40AF"
                            : "#475569",
                    }}
                  >
                    {activeStep.contentType}
                  </span>
                </div>
              </div>

              {/* Content Body - Illustrated */}
              <div className="p-6">
                <IllustratedContentViewer
                  step={activeStep}
                  moduleId={moduleId}
                  onQuizComplete={handleQuizComplete}
                  sectionNumber={activeIndex + 1}
                  totalSections={moduleSteps.length}
                />
              </div>

              {/* Navigation Footer */}
              <div
                className="p-6 border-t flex items-center justify-between"
                style={{ borderColor: "var(--card-border)" }}
              >
                <button
                  onClick={goToPrevious}
                  disabled={activeIndex === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                >
                  <ArrowLeft size={14} />
                  Previous
                </button>

                {activeStep.completed ? (
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium"
                    style={{ color: "#059669" }}
                  >
                    <CheckCircle size={16} />
                    Completed
                  </div>
                ) : allComplete ? (
                  <button
                    onClick={handleMarkModuleComplete}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all duration-150 hover:shadow-md"
                    style={{ backgroundColor: "#059669" }}
                  >
                    <CheckCircle size={16} />
                    Complete Module
                  </button>
                ) : (
                  <button
                    onClick={handleMarkComplete}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all duration-150 hover:shadow-md"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    Mark Complete & Continue
                    <ArrowRight size={14} />
                  </button>
                )}

                <button
                  onClick={goToNext}
                  disabled={activeIndex === moduleSteps.length - 1}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                >
                  Next
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
