import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
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
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

export function mayUseIsolatedFixtures(
  evaluationMode: boolean,
  workspace: string | null,
): boolean {
  return evaluationMode || workspace === "training";
}

export const mayUseOnboardingFixtures = mayUseIsolatedFixtures;

export function resolveOnboardingFixtures<T>(
  fixtures: readonly T[],
  fixturesAllowed: boolean,
): T[] {
  return fixturesAllowed ? [...fixtures] : [];
}

interface OnboardingFixtureSet {
  tracks: readonly Track[];
  modules: readonly Module[];
  steps: readonly Step[];
  employees: readonly Employee[];
  evidence: readonly Evidence[];
}

export interface TrainingProgressSnapshot {
  moduleId: string;
  completedSteps: number;
  status: string;
  quizScore: number | null;
  quizPassed: boolean;
}

interface TrainingProgressUpdate {
  moduleId: string;
  completedSteps?: number;
  status?: "available" | "in-progress" | "completed";
  quizScore?: number;
  quizPassed?: boolean;
}

interface TrainingProgressPersistence {
  rows: TrainingProgressSnapshot[] | undefined;
  isLoading: boolean;
  loadError: string | null;
  save: (update: TrainingProgressUpdate) => Promise<TrainingProgressSnapshot>;
}

interface HydratedTrainingPractice {
  tracks: Track[];
  modules: Module[];
  steps: Step[];
  quizResults: QuizResult[];
}

/**
 * Production Training is a practice workspace, not an authoritative training
 * record. It must never inherit the pre-completed demonstration state used by
 * the evaluation deployment.
 */
export function createTrainingPracticeFixtures(
  fixtures: OnboardingFixtureSet,
): Omit<OnboardingFixtureSet, "employees" | "evidence"> & {
  employees: Employee[];
  evidence: Evidence[];
} {
  const trainingTracks = fixtures.tracks.filter(
    (track) => track.id === "universal-orientation",
  );
  const trainingModules = fixtures.modules.filter(
    (module) => module.trackId === "universal-orientation",
  );
  const trainingModuleIds = new Set(trainingModules.map((module) => module.id));
  return {
    tracks: trainingTracks.map((track) => ({
      ...track,
      completedModules: 0,
      clearanceStatus: "pending",
    })),
    modules: trainingModules.map((module) => ({
      ...module,
      completedSteps: 0,
      status: "available",
    })),
    steps: fixtures.steps
      .filter((step) => trainingModuleIds.has(step.moduleId))
      .map((step) => ({ ...step, completed: false })),
    // Staff-clearance and evidence fixtures look like official records. Keep
    // them out of the live Training workspace until durable, audited storage is
    // implemented and approved.
    employees: [],
    evidence: [],
  };
}

function normalizeSavedModuleStatus(
  module: Module,
  snapshot: TrainingProgressSnapshot,
  completedSteps: number,
): Module["status"] {
  if (snapshot.status === "completed" && completedSteps === module.stepCount) {
    return "completed";
  }
  return completedSteps > 0 ? "in-progress" : "available";
}

/**
 * Applies server-confirmed progress to the synthetic universal-orientation
 * curriculum. Rows for any other track are ignored, and values are clamped to
 * the local approved module contract.
 */
export function hydrateTrainingPracticeProgress(
  fixtures: Pick<OnboardingFixtureSet, "tracks" | "modules" | "steps">,
  snapshots: readonly TrainingProgressSnapshot[],
): HydratedTrainingPractice {
  const snapshotByModule = new Map(
    snapshots.map((snapshot) => [snapshot.moduleId, snapshot]),
  );
  const modules = fixtures.modules.map((module) => {
    const snapshot = snapshotByModule.get(module.id);
    if (!snapshot) return { ...module };
    const completedSteps = Math.max(
      0,
      Math.min(module.stepCount, snapshot.completedSteps),
    );
    return {
      ...module,
      completedSteps,
      status: normalizeSavedModuleStatus(module, snapshot, completedSteps),
    };
  });
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const stepsByModule = new Map<string, Step[]>();
  for (const step of fixtures.steps) {
    const moduleSteps = stepsByModule.get(step.moduleId) ?? [];
    moduleSteps.push(step);
    stepsByModule.set(step.moduleId, moduleSteps);
  }
  const steps = fixtures.steps.map((step) => {
    const module = moduleById.get(step.moduleId);
    const moduleSteps = stepsByModule.get(step.moduleId) ?? [];
    const stepIndex = moduleSteps.findIndex(
      (candidate) => candidate.id === step.id,
    );
    return {
      ...step,
      completed:
        module !== undefined &&
        stepIndex >= 0 &&
        stepIndex < module.completedSteps,
    };
  });
  const tracks = fixtures.tracks.map((track) => {
    const trackModules = modules.filter(
      (module) => module.trackId === track.id,
    );
    const completedModules = trackModules.filter(
      (module) => module.status === "completed",
    ).length;
    return {
      ...track,
      completedModules,
      clearanceStatus: getTrackClearance(track, completedModules),
    };
  });
  const quizResults = modules.flatMap((module) => {
    const snapshot = snapshotByModule.get(module.id);
    if (!snapshot || snapshot.quizScore === null) return [];
    return [
      {
        moduleId: module.id,
        score: snapshot.quizScore,
        totalQuestions: 100,
        passed: snapshot.quizPassed,
        answers: [],
      },
    ];
  });

  return { tracks, modules, steps, quizResults };
}

export function createStepProgressUpdate(
  modules: readonly Module[],
  steps: readonly Step[],
  stepId: string,
  completed: boolean,
): TrainingProgressUpdate | null {
  const targetStep = steps.find((step) => step.id === stepId);
  if (!targetStep) return null;
  const module = modules.find(
    (candidate) => candidate.id === targetStep.moduleId,
  );
  if (!module) return null;
  const moduleSteps = steps.filter((step) => step.moduleId === module.id);
  const completedSteps = moduleSteps.filter((step) =>
    step.id === stepId ? completed : step.completed,
  ).length;
  return {
    moduleId: module.id,
    completedSteps,
    status:
      completedSteps === module.stepCount
        ? "completed"
        : completedSteps > 0
          ? "in-progress"
          : "available",
  };
}

interface OnboardingState {
  // Data
  tracks: Track[];
  modules: Module[];
  steps: Step[];
  employees: Employee[];
  evidence: Evidence[];
  quizResults: QuizResult[];
  isUnavailable: boolean;
  progressState:
    "local-practice" | "loading" | "authoritative" | "saving" | "unavailable";
  progressError: string | null;

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
  reviewEvidence: (
    evidenceId: string,
    decision: "approved" | "rejected",
  ) => void;

  // Supervisor actions
  updateEmployeeClearance: (
    employeeId: string,
    status: Employee["clearanceStatus"],
  ) => void;

  // Getters
  getModulesForTrack: (trackId: string) => Module[];
  getStepsForModule: (moduleId: string) => Step[];
  getTrackProgress: (trackId: string) => {
    completed: number;
    total: number;
    percentage: number;
  };
  getModuleProgress: (moduleId: string) => {
    completed: number;
    total: number;
    percentage: number;
  };
}

const OnboardingContext = createContext<OnboardingState | null>(null);

interface OnboardingProviderProps {
  children: ReactNode;
  workspace?: "training" | "operational";
}

export function OnboardingProvider({
  children,
  workspace,
}: OnboardingProviderProps) {
  if (workspace !== undefined) {
    return createElement(OnboardingStateProvider, {
      key: workspace,
      workspace,
      children,
    });
  }
  return createElement(AuthenticatedOnboardingProvider, { children });
}

function AuthenticatedOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { workspace } = useAuth();
  if (workspace === "training" && !runtimeConfig.evaluationMode) {
    return createElement(AuthoritativeTrainingOnboardingProvider, {
      key: workspace,
      children,
    });
  }
  return createElement(OnboardingStateProvider, {
    key: workspace,
    workspace,
    children,
  });
}

function AuthoritativeTrainingOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const progressQuery = trpc.training.listMyProgress.useQuery(undefined, {
    retry: false,
  });
  const progressMutation = trpc.training.updateMyProgress.useMutation();
  const mutateProgress = progressMutation.mutateAsync;
  const save = useCallback(
    async (update: TrainingProgressUpdate) => {
      const saved = await mutateProgress(update);
      if (!saved) {
        throw new Error(
          "The Training progress service returned no saved record.",
        );
      }
      return saved;
    },
    [mutateProgress],
  );
  const progressPersistence = useMemo<TrainingProgressPersistence>(
    () => ({
      rows: progressQuery.data,
      isLoading: progressQuery.isLoading,
      loadError: progressQuery.error?.message ?? null,
      save,
    }),
    [
      progressQuery.data,
      progressQuery.error?.message,
      progressQuery.isLoading,
      save,
    ],
  );

  return createElement(OnboardingStateProvider, {
    key: "training-authoritative",
    workspace: "training",
    progressPersistence,
    children,
  });
}

function OnboardingStateProvider({
  children,
  workspace,
  progressPersistence,
}: {
  children: ReactNode;
  workspace: "training" | "operational";
  progressPersistence?: TrainingProgressPersistence;
}) {
  const fixturesAllowed = mayUseOnboardingFixtures(
    runtimeConfig.evaluationMode,
    workspace,
  );
  const trainingPracticeFixtures = useMemo(
    () =>
      workspace === "training" && !runtimeConfig.evaluationMode
        ? createTrainingPracticeFixtures({
            tracks: initialTracks,
            modules: initialModules,
            steps: initialSteps,
            employees: initialEmployees,
            evidence: initialEvidence,
          })
        : null,
    [workspace],
  );
  const [tracks, setTracks] = useState<Track[]>(() =>
    trainingPracticeFixtures
      ? [...trainingPracticeFixtures.tracks]
      : resolveOnboardingFixtures(initialTracks, fixturesAllowed),
  );
  const [modules, setModules] = useState<Module[]>(() =>
    trainingPracticeFixtures
      ? [...trainingPracticeFixtures.modules]
      : resolveOnboardingFixtures(initialModules, fixturesAllowed),
  );
  const [steps, setSteps] = useState<Step[]>(() =>
    trainingPracticeFixtures
      ? [...trainingPracticeFixtures.steps]
      : resolveOnboardingFixtures(initialSteps, fixturesAllowed),
  );
  const [employees, setEmployees] = useState<Employee[]>(() =>
    trainingPracticeFixtures
      ? trainingPracticeFixtures.employees
      : resolveOnboardingFixtures(initialEmployees, fixturesAllowed),
  );
  const [evidence, setEvidence] = useState<Evidence[]>(() =>
    trainingPracticeFixtures
      ? trainingPracticeFixtures.evidence
      : resolveOnboardingFixtures(initialEvidence, fixturesAllowed),
  );
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [authoritativeProgressRows, setAuthoritativeProgressRows] = useState<
    TrainingProgressSnapshot[]
  >([]);
  const [progressSaveError, setProgressSaveError] = useState<string | null>(
    null,
  );
  const [isProgressSaving, setIsProgressSaving] = useState(false);
  const progressSaveInFlight = useRef(false);

  useEffect(() => {
    if (
      !progressPersistence ||
      progressPersistence.isLoading ||
      progressPersistence.loadError ||
      !progressPersistence.rows
    ) {
      return;
    }
    // Hydrate only after the authoritative query has settled; this state is a
    // deliberate mirror of an external query cache.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthoritativeProgressRows(progressPersistence.rows);
    setProgressSaveError(null);
  }, [progressPersistence]);

  useEffect(() => {
    if (!trainingPracticeFixtures || !progressPersistence) return;
    const hydrated = hydrateTrainingPracticeProgress(
      trainingPracticeFixtures,
      authoritativeProgressRows,
    );
    // Apply one consistent server-confirmed snapshot across the related view
    // models. The effect is the synchronization boundary with remote state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTracks(hydrated.tracks);
    setModules(hydrated.modules);
    setSteps(hydrated.steps);
    setQuizResults(hydrated.quizResults);
  }, [
    authoritativeProgressRows,
    progressPersistence,
    trainingPracticeFixtures,
  ]);

  const persistAuthoritativeProgress = useCallback(
    async (update: TrainingProgressUpdate) => {
      if (!progressPersistence) return false;
      if (
        progressPersistence.isLoading ||
        progressPersistence.loadError ||
        progressSaveInFlight.current
      ) {
        setProgressSaveError(
          progressPersistence.loadError ??
            "Training progress is not ready to save. Wait for the current operation and try again.",
        );
        return false;
      }

      progressSaveInFlight.current = true;
      setIsProgressSaving(true);
      setProgressSaveError(null);
      try {
        const saved = await progressPersistence.save(update);
        setAuthoritativeProgressRows((current) => [
          ...current.filter((row) => row.moduleId !== saved.moduleId),
          saved,
        ]);
        return true;
      } catch (error) {
        setProgressSaveError(
          error instanceof Error
            ? error.message
            : "Training progress could not be saved. No completion was recorded.",
        );
        return false;
      } finally {
        progressSaveInFlight.current = false;
        setIsProgressSaving(false);
      }
    },
    [progressPersistence],
  );

  const selectTrack = useCallback((trackId: string | null) => {
    setSelectedTrackId(trackId);
    setSelectedModuleId(null);
  }, []);

  const selectModule = useCallback((moduleId: string | null) => {
    setSelectedModuleId(moduleId);
  }, []);

  const completeStep = useCallback(
    (stepId: string) => {
      if (!fixturesAllowed) return;
      if (progressPersistence) {
        const update = createStepProgressUpdate(modules, steps, stepId, true);
        if (update) void persistAuthoritativeProgress(update);
        return;
      }
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, completed: true } : s)),
      );
      setSteps((currentSteps) => {
        const step = currentSteps.find((s) => s.id === stepId);
        if (!step) return currentSteps;
        const moduleSteps = currentSteps.filter(
          (s) => s.moduleId === step.moduleId,
        );
        const completedCount = moduleSteps.filter((s) => s.completed).length;
        setModules((prev) =>
          prev.map((m) =>
            m.id === step.moduleId
              ? {
                  ...m,
                  completedSteps: completedCount,
                  status: getModuleStatus(m, completedCount),
                }
              : m,
          ),
        );
        return currentSteps;
      });
    },
    [
      fixturesAllowed,
      modules,
      persistAuthoritativeProgress,
      progressPersistence,
      steps,
    ],
  );

  const uncompleteStep = useCallback(
    (stepId: string) => {
      if (!fixturesAllowed) return;
      if (progressPersistence) {
        const update = createStepProgressUpdate(modules, steps, stepId, false);
        if (update) void persistAuthoritativeProgress(update);
        return;
      }
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, completed: false } : s)),
      );
      setSteps((currentSteps) => {
        const step = currentSteps.find((s) => s.id === stepId);
        if (!step) return currentSteps;
        const moduleSteps = currentSteps.filter(
          (s) => s.moduleId === step.moduleId,
        );
        const completedCount = moduleSteps.filter((s) => s.completed).length;
        setModules((prev) =>
          prev.map((m) =>
            m.id === step.moduleId
              ? {
                  ...m,
                  completedSteps: completedCount,
                  status: getModuleStatus(m, completedCount),
                }
              : m,
          ),
        );
        return currentSteps;
      });
    },
    [
      fixturesAllowed,
      modules,
      persistAuthoritativeProgress,
      progressPersistence,
      steps,
    ],
  );

  const markModuleComplete = useCallback(
    (moduleId: string) => {
      if (!fixturesAllowed) return;
      if (progressPersistence) {
        const module = modules.find((candidate) => candidate.id === moduleId);
        if (module) {
          void persistAuthoritativeProgress({
            moduleId,
            completedSteps: module.stepCount,
            status: "completed",
          });
        }
        return;
      }
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                completedSteps: m.stepCount,
                status: "completed" as const,
              }
            : m,
        ),
      );
      setSteps((prev) =>
        prev.map((s) =>
          s.moduleId === moduleId ? { ...s, completed: true } : s,
        ),
      );
      setModules((currentModules) => {
        const mod = currentModules.find((m) => m.id === moduleId);
        if (!mod) return currentModules;
        const trackModules = currentModules.filter(
          (m) => m.trackId === mod.trackId,
        );
        const completedCount = trackModules.filter(
          (m) => m.status === "completed",
        ).length;
        setTracks((prev) =>
          prev.map((t) =>
            t.id === mod.trackId
              ? {
                  ...t,
                  completedModules: completedCount,
                  clearanceStatus: getTrackClearance(t, completedCount),
                }
              : t,
          ),
        );
        return currentModules;
      });
    },
    [
      fixturesAllowed,
      modules,
      persistAuthoritativeProgress,
      progressPersistence,
    ],
  );

  // Quiz actions
  const saveQuizResult = useCallback(
    (result: QuizResult) => {
      if (!fixturesAllowed) return;
      if (progressPersistence) {
        const module = modules.find(
          (candidate) => candidate.id === result.moduleId,
        );
        if (!module) return;
        const quizScore =
          result.totalQuestions > 0
            ? Math.round((result.score / result.totalQuestions) * 100)
            : 0;
        void persistAuthoritativeProgress({
          moduleId: result.moduleId,
          completedSteps: result.passed
            ? module.stepCount
            : module.completedSteps,
          status: result.passed
            ? "completed"
            : module.completedSteps > 0
              ? "in-progress"
              : "available",
          quizScore,
          quizPassed: result.passed,
        });
        return;
      }
      setQuizResults((prev) => {
        const filtered = prev.filter((r) => r.moduleId !== result.moduleId);
        return [...filtered, result];
      });
      // If passed, complete all remaining steps and mark module complete
      if (result.passed) {
        setSteps((prev) =>
          prev.map((s) =>
            s.moduleId === result.moduleId ? { ...s, completed: true } : s,
          ),
        );
        setModules((prev) =>
          prev.map((m) =>
            m.id === result.moduleId
              ? {
                  ...m,
                  completedSteps: m.stepCount,
                  status: "completed" as const,
                }
              : m,
          ),
        );
        // Update track counts
        setModules((currentModules) => {
          const mod = currentModules.find((m) => m.id === result.moduleId);
          if (!mod) return currentModules;
          const trackModules = currentModules.filter(
            (m) => m.trackId === mod.trackId,
          );
          const completedCount = trackModules.filter(
            (m) => m.status === "completed",
          ).length;
          setTracks((prev) =>
            prev.map((t) =>
              t.id === mod.trackId
                ? {
                    ...t,
                    completedModules: completedCount,
                    clearanceStatus: getTrackClearance(t, completedCount),
                  }
                : t,
            ),
          );
          return currentModules;
        });
      }
    },
    [
      fixturesAllowed,
      modules,
      persistAuthoritativeProgress,
      progressPersistence,
    ],
  );

  const getQuizResultForModule = useCallback(
    (moduleId: string) => quizResults.find((r) => r.moduleId === moduleId),
    [quizResults],
  );

  // Evidence with file support
  const submitEvidence = useCallback(
    (ev: Omit<Evidence, "id" | "submittedAt">) => {
      if (!fixturesAllowed) return;
      const newEvidence: Evidence = {
        ...ev,
        id: `ev-${Date.now()}`,
        submittedAt: new Date().toISOString().split("T")[0],
      };
      setEvidence((prev) => [newEvidence, ...prev]);
    },
    [fixturesAllowed],
  );

  const reviewEvidence = useCallback(
    (evidenceId: string, decision: "approved" | "rejected") => {
      if (!fixturesAllowed) return;
      setEvidence((prev) =>
        prev.map((e) => (e.id === evidenceId ? { ...e, status: decision } : e)),
      );
    },
    [fixturesAllowed],
  );

  const updateEmployeeClearance = useCallback(
    (employeeId: string, status: Employee["clearanceStatus"]) => {
      if (!fixturesAllowed) return;
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId ? { ...e, clearanceStatus: status } : e,
        ),
      );
    },
    [fixturesAllowed],
  );

  const getModulesForTrack = useCallback(
    (trackId: string) => modules.filter((m) => m.trackId === trackId),
    [modules],
  );

  const getStepsForModule = useCallback(
    (moduleId: string) => steps.filter((s) => s.moduleId === moduleId),
    [steps],
  );

  const getTrackProgress = useCallback(
    (trackId: string) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return { completed: 0, total: 0, percentage: 0 };
      return {
        completed: track.completedModules,
        total: track.moduleCount,
        percentage: Math.round(
          (track.completedModules / track.moduleCount) * 100,
        ),
      };
    },
    [tracks],
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
    [modules],
  );

  const progressError =
    progressPersistence?.loadError ?? progressSaveError ?? null;
  const progressState: OnboardingState["progressState"] = !fixturesAllowed
    ? "unavailable"
    : !progressPersistence
      ? "local-practice"
      : progressError
        ? "unavailable"
        : progressPersistence.isLoading
          ? "loading"
          : isProgressSaving
            ? "saving"
            : "authoritative";
  const isUnavailable =
    !fixturesAllowed ||
    Boolean(
      progressPersistence &&
      (progressPersistence.isLoading || progressError !== null),
    );

  /* eslint-disable react-hooks/refs -- Context consumers receive callbacks that
   * read the in-flight ref only when invoked; createElement does not invoke them
   * during render. This avoids duplicate authoritative writes on rapid input. */
  const provider = createElement(
    OnboardingContext.Provider,
    {
      value: {
        tracks,
        modules,
        steps,
        employees,
        evidence,
        quizResults,
        isUnavailable,
        progressState,
        progressError,
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
  /* eslint-enable react-hooks/refs */

  if (
    !progressPersistence ||
    (!progressPersistence.isLoading && !progressError)
  ) {
    return provider;
  }

  const notice = progressError
    ? createElement(
        "div",
        {
          role: "alert",
          className:
            "border-b border-red-300 bg-red-50 px-4 py-2 text-center text-xs font-semibold text-red-800",
        },
        `Training progress unavailable: ${progressError} No completion has been recorded.`,
      )
    : createElement(
        "div",
        {
          role: "status",
          className:
            "border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900",
        },
        "Verifying your saved Training progress. Completion controls remain unavailable until this check finishes.",
      );

  return createElement(Fragment, null, notice, provider);
}

function getModuleStatus(m: Module, completedCount: number): Module["status"] {
  if (completedCount === 0 && m.status === "locked") return "locked";
  if (completedCount === m.stepCount) return "completed";
  if (completedCount > 0) return "in-progress";
  return "available";
}

function getTrackClearance(
  t: Track,
  completedCount: number,
): Track["clearanceStatus"] {
  if (completedCount === t.moduleCount) return "cleared";
  if (completedCount > 0) return "in-progress";
  return "pending";
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
