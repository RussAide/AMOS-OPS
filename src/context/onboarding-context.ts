import { createContext, createElement, useContext, useState, useCallback, type ReactNode } from "react";
import {
  tracks as initialTracks,
  modules as initialModules,
  steps as initialSteps,
  employees as initialEmployees,
  evidenceList as initialEvidence,
  type Track,
  type Module,
  type Step,
  type Employee,
  type Evidence,
  type QuizResult,
} from "@/data/onboardingData";

interface OnboardingState {
  // Data
  tracks: Track[];
  modules: Module[];
  steps: Step[];
  employees: Employee[];
  evidence: Evidence[];
  quizResults: QuizResult[];

  // Navigation
  selectTrack: (trackId: string | null) => void;
  selectModule: (moduleId: string | null) => void;
  selectedTrackId: string | null;
  selectedModuleId: string | null;

  // Progress actions
  completeStep: (stepId: string) => void;
  uncompleteStep: (stepId: string) => void;
  markModuleComplete: (moduleId: string) => void;

  // Quiz actions
  saveQuizResult: (result: QuizResult) => void;
  getQuizResultForModule: (moduleId: string) => QuizResult | undefined;

  // Evidence actions (with file support)
  submitEvidence: (evidence: Omit<Evidence, "id" | "submittedAt">) => void;
  reviewEvidence: (evidenceId: string, decision: "approved" | "rejected") => void;

  // Supervisor actions
  updateEmployeeClearance: (employeeId: string, status: Employee["clearanceStatus"]) => void;

  // Getters
  getModulesForTrack: (trackId: string) => Module[];
  getStepsForModule: (moduleId: string) => Step[];
  getTrackProgress: (trackId: string) => { completed: number; total: number; percentage: number };
  getModuleProgress: (moduleId: string) => { completed: number; total: number; percentage: number };
}

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [evidence, setEvidence] = useState<Evidence[]>(initialEvidence);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const selectTrack = useCallback((trackId: string | null) => {
    setSelectedTrackId(trackId);
    setSelectedModuleId(null);
  }, []);

  const selectModule = useCallback((moduleId: string | null) => {
    setSelectedModuleId(moduleId);
  }, []);

  const completeStep = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, completed: true } : s))
    );
    setSteps((currentSteps) => {
      const step = currentSteps.find((s) => s.id === stepId);
      if (!step) return currentSteps;
      const moduleSteps = currentSteps.filter((s) => s.moduleId === step.moduleId);
      const completedCount = moduleSteps.filter((s) => s.completed).length;
      setModules((prev) =>
        prev.map((m) =>
          m.id === step.moduleId
            ? { ...m, completedSteps: completedCount, status: getModuleStatus(m, completedCount) }
            : m
        )
      );
      return currentSteps;
    });
  }, []);

  const uncompleteStep = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, completed: false } : s))
    );
    setSteps((currentSteps) => {
      const step = currentSteps.find((s) => s.id === stepId);
      if (!step) return currentSteps;
      const moduleSteps = currentSteps.filter((s) => s.moduleId === step.moduleId);
      const completedCount = moduleSteps.filter((s) => s.completed).length;
      setModules((prev) =>
        prev.map((m) =>
          m.id === step.moduleId
            ? { ...m, completedSteps: completedCount, status: getModuleStatus(m, completedCount) }
            : m
        )
      );
      return currentSteps;
    });
  }, []);

  const markModuleComplete = useCallback((moduleId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, completedSteps: m.stepCount, status: "completed" as const } : m
      )
    );
    setSteps((prev) =>
      prev.map((s) => (s.moduleId === moduleId ? { ...s, completed: true } : s))
    );
    setModules((currentModules) => {
      const mod = currentModules.find((m) => m.id === moduleId);
      if (!mod) return currentModules;
      const trackModules = currentModules.filter((m) => m.trackId === mod.trackId);
      const completedCount = trackModules.filter((m) => m.status === "completed").length;
      setTracks((prev) =>
        prev.map((t) =>
          t.id === mod.trackId
            ? { ...t, completedModules: completedCount, clearanceStatus: getTrackClearance(t, completedCount) }
            : t
        )
      );
      return currentModules;
    });
  }, []);

  // Quiz actions
  const saveQuizResult = useCallback((result: QuizResult) => {
    setQuizResults((prev) => {
      const filtered = prev.filter((r) => r.moduleId !== result.moduleId);
      return [...filtered, result];
    });
    // If passed, complete all remaining steps and mark module complete
    if (result.passed) {
      setSteps((prev) =>
        prev.map((s) => (s.moduleId === result.moduleId ? { ...s, completed: true } : s))
      );
      setModules((prev) =>
        prev.map((m) =>
          m.id === result.moduleId
            ? { ...m, completedSteps: m.stepCount, status: "completed" as const }
            : m
        )
      );
      // Update track counts
      setModules((currentModules) => {
        const mod = currentModules.find((m) => m.id === result.moduleId);
        if (!mod) return currentModules;
        const trackModules = currentModules.filter((m) => m.trackId === mod.trackId);
        const completedCount = trackModules.filter((m) => m.status === "completed").length;
        setTracks((prev) =>
          prev.map((t) =>
            t.id === mod.trackId
              ? { ...t, completedModules: completedCount, clearanceStatus: getTrackClearance(t, completedCount) }
              : t
          )
        );
        return currentModules;
      });
    }
  }, []);

  const getQuizResultForModule = useCallback(
    (moduleId: string) => quizResults.find((r) => r.moduleId === moduleId),
    [quizResults]
  );

  // Evidence with file support
  const submitEvidence = useCallback(
    (ev: Omit<Evidence, "id" | "submittedAt">) => {
      const newEvidence: Evidence = {
        ...ev,
        id: `ev-${Date.now()}`,
        submittedAt: new Date().toISOString().split("T")[0],
      };
      setEvidence((prev) => [newEvidence, ...prev]);
    },
    []
  );

  const reviewEvidence = useCallback((evidenceId: string, decision: "approved" | "rejected") => {
    setEvidence((prev) =>
      prev.map((e) => (e.id === evidenceId ? { ...e, status: decision } : e))
    );
  }, []);

  const updateEmployeeClearance = useCallback((employeeId: string, status: Employee["clearanceStatus"]) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, clearanceStatus: status } : e))
    );
  }, []);

  const getModulesForTrack = useCallback(
    (trackId: string) => modules.filter((m) => m.trackId === trackId),
    [modules]
  );

  const getStepsForModule = useCallback(
    (moduleId: string) => steps.filter((s) => s.moduleId === moduleId),
    [steps]
  );

  const getTrackProgress = useCallback(
    (trackId: string) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return { completed: 0, total: 0, percentage: 0 };
      return {
        completed: track.completedModules,
        total: track.moduleCount,
        percentage: Math.round((track.completedModules / track.moduleCount) * 100),
      };
    },
    [tracks]
  );

  const getModuleProgress = useCallback(
    (moduleId: string) => {
      const mod = modules.find((m) => m.id === moduleId);
      if (!mod) return { completed: 0, total: 0, percentage: 0 };
      return {
        completed: mod.completedSteps,
        total: mod.stepCount,
        percentage: Math.round((mod.completedSteps / mod.stepCount) * 100),
      };
    },
    [modules]
  );

  return createElement(
    OnboardingContext.Provider,
    {
      value: {
        tracks,
        modules,
        steps,
        employees,
        evidence,
        quizResults,
        selectedTrackId,
        selectedModuleId,
        selectTrack,
        selectModule,
        completeStep,
        uncompleteStep,
        markModuleComplete,
        saveQuizResult,
        getQuizResultForModule,
        submitEvidence,
        reviewEvidence,
        updateEmployeeClearance,
        getModulesForTrack,
        getStepsForModule,
        getTrackProgress,
        getModuleProgress,
      },
    },
    children,
  );
}

function getModuleStatus(m: Module, completedCount: number): Module["status"] {
  if (completedCount === 0 && m.status === "locked") return "locked";
  if (completedCount === m.stepCount) return "completed";
  if (completedCount > 0) return "in-progress";
  return "available";
}

function getTrackClearance(t: Track, completedCount: number): Track["clearanceStatus"] {
  if (completedCount === t.moduleCount) return "cleared";
  if (completedCount > 0) return "in-progress";
  return "pending";
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
