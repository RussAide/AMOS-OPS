import type { M41bCadence } from "@contracts/m41b";
import type {
  M41cInstrumentProfile,
  M41cInstrumentProfileRegistry,
} from "@contracts/m41c/instruments";
import type {
  M41cActivationState,
  M41cClinicalGuidanceIntent,
  M41cClinicalWorkplan,
  M41cClinicalWorkplanItem,
  M41cExperienceSnapshot,
  M41cSyntheticScenario,
  M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";

export type {
  M41cClinicalGuidanceInput,
  M41cClinicalGuidanceIntent,
  M41cClinicalGuidanceResponse,
  M41cClinicalWorkplan,
  M41cClinicalWorkplanItem,
  M41cExperienceSnapshot,
  M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";

export type M41cQueryState = "loading" | "error" | "ready";

export interface M41cGuidanceSubmission {
  subjectId: string;
  prompt: string;
  intent: M41cClinicalGuidanceIntent;
  sourceIds?: readonly string[];
  workplanItemId?: string;
}

export const M41C_CADENCES = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
] as const satisfies readonly M41bCadence[]);

export const M41C_GUIDANCE_INTENTS = Object.freeze([
  "what_requires_attention",
  "why_flag_fired",
  "which_source_governs",
  "what_evidence_is_missing",
  "start_approved_workflow",
  "route_human_review",
] as const satisfies readonly M41cClinicalGuidanceIntent[]);

export const M41C_REQUIRED_SCENARIO_KINDS = Object.freeze([
  "routine",
  "incomplete",
  "positive_safety",
  "escalating",
  "conflict",
  "reassessment",
  "loc_review",
  "transition",
  "outage",
  "override",
  "recovery",
] as const satisfies readonly M41cSyntheticScenario["kind"][]);

export function prettyM41cToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatM41cTimestamp(value: string | null): string {
  if (!value) return "Not recorded";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function activationPresentation(state: M41cActivationState): {
  label: string;
  className: string;
} {
  switch (state) {
    case "demo_approved":
      return {
        label: "Demo approved",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };
    case "validation_pending":
      return {
        label: "Validation pending",
        className: "border-amber-200 bg-amber-50 text-amber-900",
      };
    case "quarantined":
      return {
        label: "Quarantined",
        className: "border-rose-200 bg-rose-50 text-rose-800",
      };
    case "draft":
      return {
        label: "Draft",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
  }
}

export function findInstrumentProfile(
  registry: M41cInstrumentProfileRegistry,
  family: M41cInstrumentProfile["family"],
): M41cInstrumentProfile | null {
  return registry.profiles.find((profile) => profile.family === family) ?? null;
}

export function verifyProfileSeparation(
  registry: M41cInstrumentProfileRegistry,
): {
  distinct: boolean;
  reasons: readonly string[];
} {
  const trr = findInstrumentProfile(registry, "trr_cans");
  const dfps = findInstrumentProfile(registry, "dfps_cans_3_0");
  if (!trr || !dfps) {
    return {
      distinct: false,
      reasons: ["Both governed profile records were not returned."],
    };
  }

  const reasons = [
    trr.profileId !== dfps.profileId ? "Distinct profile identifiers" : null,
    trr.family !== dfps.family ? "Distinct instrument families" : null,
    trr.programAuthority !== dfps.programAuthority
      ? "Distinct program authorities"
      : null,
    trr.governanceArtifactId !== dfps.governanceArtifactId
      ? "Distinct governance artifacts"
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  return { distinct: reasons.length === 4, reasons };
}

export function snapshotMetrics(snapshot: M41cExperienceSnapshot) {
  const activeSources = snapshot.registry.sources.filter(
    (source) => source.state === "current",
  ).length;
  const signedValidations = snapshot.signedValidationRecords.filter(
    (record) => record.approvedForSyntheticDemo,
  ).length;
  const pathwayReady = snapshot.pathwayCatalog.filter(
    (pathway) => pathway.activationState === "demo_approved",
  ).length;
  const actionableSignals = snapshot.monitoring.signals.filter(
    (signal) => signal.humanReviewRequired,
  ).length;

  return Object.freeze({
    sources: snapshot.registry.sources.length,
    activeSources,
    signedValidations,
    profiles: snapshot.instrumentRegistry.profiles.length,
    pathwayReady,
    pathways: snapshot.pathwayCatalog.length,
    quarantineCount: snapshot.instrumentRegistry.quarantines.length,
    actionableSignals,
  });
}

export function allClinicalWorkplanItems(
  workplan: M41cClinicalWorkplan,
): readonly M41cClinicalWorkplanItem[] {
  return M41C_CADENCES.flatMap((cadence) => workplan.briefs[cadence].items);
}

export function scenarioCoverage(scenarios: readonly M41cSyntheticScenario[]): {
  covered: readonly M41cSyntheticScenario["kind"][];
  missing: readonly M41cSyntheticScenario["kind"][];
} {
  const present = new Set(scenarios.map((scenario) => scenario.kind));
  return {
    covered: M41C_REQUIRED_SCENARIO_KINDS.filter((kind) => present.has(kind)),
    missing: M41C_REQUIRED_SCENARIO_KINDS.filter((kind) => !present.has(kind)),
  };
}

export function sourceById(snapshot: M41cExperienceSnapshot, id: string) {
  return snapshot.registry.sources.find((source) => source.id === id) ?? null;
}

export function scenarioRunIsBounded(
  result: M41cSyntheticScenarioRunResponse,
): boolean {
  return (
    result.status === "passed" &&
    result.humanGateRequired &&
    result.productionRows === 0 &&
    result.liveWrites === 0
  );
}
