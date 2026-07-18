import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OnboardingProvider,
  createStepProgressUpdate,
  hydrateTrainingPracticeProgress,
  useOnboarding,
  type TrainingProgressSnapshot,
} from "./onboarding-context";
import type { Module, Step, Track } from "@/data/onboardingData";

const tracks: Track[] = [
  {
    id: "universal-orientation",
    name: "Universal Orientation",
    description: "Synthetic orientation",
    role: "all_staff",
    moduleCount: 2,
    completedModules: 0,
    clearanceStatus: "pending",
  },
];

const modules: Module[] = [
  {
    id: "mod-101",
    trackId: "universal-orientation",
    title: "Module one",
    category: "Orientation",
    description: "Synthetic orientation",
    stepCount: 2,
    completedSteps: 0,
    status: "available",
  },
  {
    id: "mod-102",
    trackId: "universal-orientation",
    title: "Module two",
    category: "Orientation",
    description: "Synthetic orientation",
    stepCount: 2,
    completedSteps: 0,
    status: "available",
  },
];

const steps: Step[] = [
  {
    id: "step-101-a",
    moduleId: "mod-101",
    title: "One A",
    content: "Synthetic",
    contentType: "text",
    durationMinutes: 1,
    completed: false,
  },
  {
    id: "step-101-b",
    moduleId: "mod-101",
    title: "One B",
    content: "Synthetic",
    contentType: "quiz",
    durationMinutes: 1,
    completed: false,
  },
  {
    id: "step-102-a",
    moduleId: "mod-102",
    title: "Two A",
    content: "Synthetic",
    contentType: "text",
    durationMinutes: 1,
    completed: false,
  },
  {
    id: "step-102-b",
    moduleId: "mod-102",
    title: "Two B",
    content: "Synthetic",
    contentType: "quiz",
    durationMinutes: 1,
    completed: false,
  },
];

function ProgressProbe() {
  const onboarding = useOnboarding();
  return (
    <output>
      {JSON.stringify({
        progressState: onboarding.progressState,
        progressError: onboarding.progressError,
        isUnavailable: onboarding.isUnavailable,
      })}
    </output>
  );
}

describe("TA.1 authoritative Training progress context", () => {
  it("hydrates universal-orientation modules, steps, quiz state, and track state from saved rows", () => {
    const snapshots: TrainingProgressSnapshot[] = [
      {
        moduleId: "mod-101",
        completedSteps: 2,
        status: "completed",
        quizScore: 90,
        quizPassed: true,
      },
      {
        moduleId: "mod-102",
        completedSteps: 1,
        status: "in-progress",
        quizScore: null,
        quizPassed: false,
      },
      {
        moduleId: "role-specific-module",
        completedSteps: 99,
        status: "completed",
        quizScore: 100,
        quizPassed: true,
      },
    ];

    const hydrated = hydrateTrainingPracticeProgress(
      { tracks, modules, steps },
      snapshots,
    );

    expect(hydrated.modules).toMatchObject([
      { id: "mod-101", completedSteps: 2, status: "completed" },
      { id: "mod-102", completedSteps: 1, status: "in-progress" },
    ]);
    expect(hydrated.steps.map((step) => step.completed)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(hydrated.tracks[0]).toMatchObject({
      completedModules: 1,
      clearanceStatus: "in-progress",
    });
    expect(hydrated.quizResults).toEqual([
      {
        moduleId: "mod-101",
        score: 90,
        totalQuestions: 100,
        passed: true,
        answers: [],
      },
    ]);
  });

  it("does not report completion when the server row lacks every required step", () => {
    const hydrated = hydrateTrainingPracticeProgress(
      { tracks, modules, steps },
      [
        {
          moduleId: "mod-101",
          completedSteps: 1,
          status: "completed",
          quizScore: null,
          quizPassed: false,
        },
      ],
    );

    expect(hydrated.modules[0]).toMatchObject({
      completedSteps: 1,
      status: "in-progress",
    });
    expect(hydrated.tracks[0]).toMatchObject({
      completedModules: 0,
      clearanceStatus: "pending",
    });
  });

  it("builds a caller-bound step update without accepting or emitting a user id", () => {
    const update = createStepProgressUpdate(
      modules,
      [{ ...steps[0], completed: true }, steps[1]],
      "step-101-b",
      true,
    );

    expect(update).toEqual({
      moduleId: "mod-101",
      completedSteps: 2,
      status: "completed",
    });
    expect(update).not.toHaveProperty("userId");
  });

  it("keeps explicit-workspace SSR hook-free for evaluation and isolation tests", () => {
    const trainingMarkup = renderToStaticMarkup(
      <OnboardingProvider workspace="training">
        <ProgressProbe />
      </OnboardingProvider>,
    );
    const operationalMarkup = renderToStaticMarkup(
      <OnboardingProvider workspace="operational">
        <ProgressProbe />
      </OnboardingProvider>,
    );

    expect(trainingMarkup).toContain(
      "&quot;progressState&quot;:&quot;local-practice&quot;",
    );
    expect(trainingMarkup).toContain("&quot;isUnavailable&quot;:false");
    expect(operationalMarkup).toContain(
      "&quot;progressState&quot;:&quot;unavailable&quot;",
    );
    expect(operationalMarkup).toContain("&quot;isUnavailable&quot;:true");
  });
});
