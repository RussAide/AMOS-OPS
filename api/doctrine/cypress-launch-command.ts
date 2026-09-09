import type {
  CypressCapabilityGate,
  CypressCapabilityLevel,
  CypressDoctrineRule,
  CypressLaunchCommandPreviewResult,
  CypressLaunchCommandStatus,
  CypressLaunchException,
  CypressLaunchPreviewScenario,
  CypressLaunchTraceEntry,
} from "../../contracts/doctrine/cypress-launch-command";

const DOCTRINE: readonly CypressDoctrineRule[] = [
  {
    id: "CYP-S4-AUTH-01",
    title: "Reserved launch authority",
    domain: "authority",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "Eghosa retains ultimate decision authority. Production promotion, expanded licensed capacity, or a change to controlling doctrine requires express authorization.",
    controlValue: "EXPRESS_AUTHORIZATION_REQUIRED",
  },
  {
    id: "CYP-S4-CAP-01",
    title: "Licensed capacity",
    domain: "capacity",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "Cypress GRO launch capacity is controlled at 10 beds. Sixteen beds is future expansion only after regulatory approval and express authorization.",
    controlValue: "10_CURRENT_16_FUTURE",
  },
  {
    id: "CYP-S4-RATE-01",
    title: "Rate doctrine",
    domain: "rate",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "Use $450 as the floor, $550 as the target, and $650 as the enhanced rate doctrine. These are operating controls, not a payer guarantee.",
    controlValue: "450_FLOOR_550_TARGET_650_ENHANCED",
  },
  {
    id: "CYP-S4-ACUITY-01",
    title: "High-acuity placement doctrine",
    domain: "acuity",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "High-acuity placement decisions are evidence-gated. Convenience or cherry-picking is not an acceptable basis for decline.",
    controlValue: "EVIDENCE_GATED",
  },
  {
    id: "CYP-S4-STABILITY-01",
    title: "Placement stability doctrine",
    domain: "placement_stability",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "When a youth enters crisis, stabilize, reassess, modify supports, and return when clinically and operationally supportable; otherwise document a justified discharge. Automatic discharge is not acceptable.",
    controlValue: "CRISIS_STABILIZE_REASSESS_MODIFY_RETURN_OR_JUSTIFY",
  },
  {
    id: "CYP-S4-RECORD-01",
    title: "Controlling-record doctrine",
    domain: "records",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "Default governed retrieval is CURRENT / CONTROLLING only. Conflicting current controllers create an authority-conflict exception; AMOS must not guess.",
    controlValue: "CURRENT_CONTROLLING_ONLY",
  },
  {
    id: "CYP-S4-REPO-01",
    title: "Authoritative repository",
    domain: "repository",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "SharePoint is the authoritative enterprise repository. AMOS-DMS supplies governed record identity, authority and access; Ask AMOS is the frontline governed record interface.",
    controlValue: "SHAREPOINT_AUTHORITY_AMOS_DMS_CONTROL",
  },
  {
    id: "CYP-S4-GATE-01",
    title: "Capability-gated launch",
    domain: "launch_gating",
    authorityState: "CURRENT_CONTROLLING",
    statement:
      "L0 through L12 advance only on verified capability and evidence. Calendar age, elapsed time, or a target date cannot advance a level.",
    controlValue: "CAPABILITY_NOT_DATE",
  },
] as const;

const GATE_BLUEPRINT: ReadonlyArray<{
  level: CypressCapabilityLevel;
  title: string;
  evidence: readonly string[];
}> = [
  {
    level: "L0",
    title: "Controlled sprint baseline",
    evidence: ["S0 gap map accepted", "Production main baseline frozen"],
  },
  {
    level: "L1",
    title: "Identity and role control",
    evidence: ["Existing identity/RBAC baseline verified"],
  },
  {
    level: "L2",
    title: "Medical-record authority and access",
    evidence: ["S1 exact-controller and contextual-access controls verified"],
  },
  {
    level: "L3",
    title: "DMS to SharePoint backend control",
    evidence: ["S2 exact-object mapping and fail-closed backend verification verified"],
  },
  {
    level: "L4",
    title: "Ask AMOS governed record bridge",
    evidence: ["S3 authority-first no-PHI preview and governed bridge verified"],
  },
  {
    level: "L5",
    title: "Launch Command and controlling doctrine",
    evidence: ["S4 doctrine registry and capability resolver exercised in synthetic preview"],
  },
  {
    level: "L6",
    title: "Referral control",
    evidence: ["Requires S5 referral implementation and acceptance evidence"],
  },
  {
    level: "L7",
    title: "Acuity and placement decision control",
    evidence: ["Requires S5 high-acuity decision implementation and acceptance evidence"],
  },
  {
    level: "L8",
    title: "Rate control",
    evidence: ["Requires S5 rate-control implementation and acceptance evidence"],
  },
  {
    level: "L9",
    title: "Administrator and workforce control",
    evidence: ["Requires S6 administrator/workforce implementation and acceptance evidence"],
  },
  {
    level: "L10",
    title: "Placement stability and hospitalization continuity",
    evidence: ["Requires S6 placement-stability implementation and acceptance evidence"],
  },
  {
    level: "L11",
    title: "CWOP evidence control",
    evidence: ["Requires S7 source-evidenced CWOP implementation and acceptance evidence"],
  },
  {
    level: "L12",
    title: "Security, audit and acceptance",
    evidence: ["Requires S8 security/audit/acceptance completion and express production authorization"],
  },
] as const;

const LEVEL_ORDER = new Map<CypressCapabilityLevel, number>(
  GATE_BLUEPRINT.map((gate, index) => [gate.level, index]),
);

function gateStateFor(
  level: CypressCapabilityLevel,
  scenario: CypressLaunchPreviewScenario,
): CypressCapabilityGate["state"] {
  const index = LEVEL_ORDER.get(level) ?? Number.MAX_SAFE_INTEGER;

  if (scenario === "authority_conflict") return "BLOCKED";

  if (index <= 4) return "VERIFIED_READY";

  if (level === "L5") {
    if (scenario === "future_capacity_blocked") return "BLOCKED";
    return "VERIFIED_READY";
  }

  return "NOT_AUTHORIZED";
}

function buildGates(
  scenario: CypressLaunchPreviewScenario,
): readonly CypressCapabilityGate[] {
  return GATE_BLUEPRINT.map((gate) => {
    const state = gateStateFor(gate.level, scenario);
    const blockers: string[] = [];

    if (scenario === "authority_conflict") {
      blockers.push("Controlling doctrine authority is ambiguous; launch resolution must fail closed.");
    } else if (gate.level === "L5" && scenario === "future_capacity_blocked") {
      blockers.push("Requested 16-bed expansion is not the controlling licensed launch capacity.");
    } else if (state === "NOT_AUTHORIZED") {
      blockers.push("This capability belongs to a later sprint gate and has not been authorized or accepted yet.");
    }

    return {
      level: gate.level,
      title: gate.title,
      state,
      evidence: gate.evidence,
      blockers,
    };
  });
}

function highestVerifiedLevel(gates: readonly CypressCapabilityGate[]): CypressCapabilityLevel {
  let highest: CypressCapabilityLevel = "L0";
  for (const gate of gates) {
    if (gate.state !== "VERIFIED_READY") break;
    highest = gate.level;
  }
  return highest;
}

function requestedLevelFor(scenario: CypressLaunchPreviewScenario): CypressCapabilityLevel {
  return scenario === "runtime_dependency" || scenario === "calendar_bypass_blocked"
    ? "L12"
    : "L5";
}

function requestedCapacityFor(scenario: CypressLaunchPreviewScenario): 10 | 16 {
  return scenario === "future_capacity_blocked" ? 16 : 10;
}

function buildExceptions(
  scenario: CypressLaunchPreviewScenario,
): readonly CypressLaunchException[] {
  if (scenario === "future_capacity_blocked") {
    return [
      {
        code: "CAPACITY_EXPANSION_NOT_AUTHORIZED",
        severity: "AUTHORITY",
        summary:
          "Sixteen beds remains future expansion; the controlling launch capacity is 10 beds until regulatory approval and express authorization.",
        disposition: "BLOCK",
      },
    ];
  }

  if (scenario === "runtime_dependency") {
    return [
      {
        code: "EXC-S2-01",
        severity: "DEPENDENCY",
        summary:
          "Live AMOS-OPS runtime/Railway Microsoft Graph credentials and an actual SharePoint runtime probe remain unverified.",
        disposition: "BLOCK",
      },
    ];
  }

  if (scenario === "authority_conflict") {
    return [
      {
        code: "DOCTRINE_AUTHORITY_CONFLICT",
        severity: "AUTHORITY",
        summary:
          "More than one current doctrine controller was presented. No doctrine or launch permission may be inferred.",
        disposition: "BLOCK",
      },
    ];
  }

  if (scenario === "calendar_bypass_blocked") {
    return [
      {
        code: "CAPABILITY_GATE_UNMET",
        severity: "CONTROL",
        summary:
          "A request attempted to advance to L12 without verified L6-L11 capabilities. Elapsed time cannot substitute for capability evidence.",
        disposition: "BLOCK",
      },
    ];
  }

  return [];
}

function buildTrace(
  scenario: CypressLaunchPreviewScenario,
  gates: readonly CypressCapabilityGate[],
): readonly CypressLaunchTraceEntry[] {
  const requestedCapacity = requestedCapacityFor(scenario);
  const requestedLevel = requestedLevelFor(scenario);
  const requestedIndex = LEVEL_ORDER.get(requestedLevel) ?? 12;
  const prereqsReady = gates
    .slice(0, requestedIndex + 1)
    .every((gate) => gate.state === "VERIFIED_READY");

  if (scenario === "authority_conflict") {
    return [
      {
        step: "Resolve controlling doctrine",
        status: "BLOCKED",
        detail: "Authority conflict detected. Resolver stopped before applying doctrine values.",
      },
      {
        step: "Check capacity and capability gates",
        status: "NOT_REACHED",
        detail: "No downstream launch decision is permitted after an authority conflict.",
      },
      {
        step: "Issue launch posture",
        status: "NOT_REACHED",
        detail: "No launch permission was issued.",
      },
    ];
  }

  const capacityPass = requestedCapacity === 10;
  const runtimePass = scenario !== "runtime_dependency";

  return [
    {
      step: "Resolve controlling doctrine",
      status: "PASS",
      detail: "Exactly one controlled doctrine set was selected for this synthetic preview.",
    },
    {
      step: "Check licensed capacity",
      status: capacityPass ? "PASS" : "BLOCKED",
      detail: capacityPass
        ? "Requested capacity matches the controlling 10-bed launch capacity."
        : "Requested capacity is 16 beds; expansion is not yet authorized.",
    },
    {
      step: "Check capability chain",
      status: prereqsReady ? "PASS" : "BLOCKED",
      detail: prereqsReady
        ? `All capability gates through ${requestedLevel} are verified for this synthetic scenario.`
        : `One or more prerequisite gates through ${requestedLevel} are not verified and cannot be bypassed by date.`,
    },
    {
      step: "Check live-runtime dependency",
      status: runtimePass ? "PASS" : "BLOCKED",
      detail: runtimePass
        ? "No live-runtime claim is required for this bounded synthetic doctrine preview."
        : "Live SharePoint runtime proof remains unverified; production readiness must not be declared.",
    },
  ];
}

export function getCypressLaunchCommandStatus(): CypressLaunchCommandStatus {
  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S4",
    capability: "Launch Command / Doctrine",
    previewAvailable: true,
    previewEnvironment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    liveProductionAuthorized: false,
    productionPromotion: "NOT_AUTHORIZED",
    message:
      "S4 exposes a bounded synthetic Launch Command preview. It does not merge to main, authorize production, change SharePoint governance, or claim live Microsoft Graph connectivity.",
  };
}

export function buildCypressLaunchCommandPreview(
  scenario: CypressLaunchPreviewScenario,
): CypressLaunchCommandPreviewResult {
  const gates = buildGates(scenario);
  const exceptions = buildExceptions(scenario);
  const trace = buildTrace(scenario, gates);
  const requestedLevel = requestedLevelFor(scenario);
  const requestedCapacity = requestedCapacityFor(scenario);
  const highestVerified = highestVerifiedLevel(gates);

  const authorityConflict = scenario === "authority_conflict";
  const blocked =
    authorityConflict ||
    exceptions.some((exception) => exception.disposition === "BLOCK") ||
    trace.some((entry) => entry.status === "BLOCKED");

  const outcome = authorityConflict
    ? "AUTHORITY_CONFLICT"
    : blocked
      ? "BLOCKED"
      : "READY_FOR_AUTHORIZED_LEVEL";

  const exactNextAction =
    scenario === "controlled_baseline"
      ? "Preserve S4 as a bounded doctrine checkpoint and require express authorization before S5 or any production promotion."
      : scenario === "future_capacity_blocked"
        ? "Retain 10 beds as the controlling launch capacity; do not activate 16 beds without regulatory approval and express authorization."
        : scenario === "runtime_dependency"
          ? "Close EXC-S2-01 with an authorized live AMOS-OPS runtime SharePoint probe before declaring live record connectivity or production readiness."
          : scenario === "authority_conflict"
            ? "Reconcile the competing doctrine controllers and identify exactly one CURRENT / CONTROLLING authority before any launch decision."
            : "Complete and accept the intervening capability gates; do not use dates or elapsed time to advance to L12.";

  return {
    scenario,
    environment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    outcome,
    requestedLevel,
    highestVerifiedLevel: highestVerified,
    licensedCapacity: 10,
    requestedCapacity,
    futureCapacity: 16,
    productionPromotion: "NOT_AUTHORIZED",
    rateDoctrine: {
      floor: 450,
      target: 550,
      enhanced: 650,
      currency: "USD",
      qualifier: "CONTROLLED_DOCTRINE_NOT_PAYER_GUARANTEE",
    },
    doctrine: authorityConflict ? [] : DOCTRINE,
    gates,
    exceptions,
    trace,
    title:
      outcome === "READY_FOR_AUTHORIZED_LEVEL"
        ? "Controlled launch posture resolved"
        : outcome === "AUTHORITY_CONFLICT"
          ? "Doctrine authority conflict"
          : "Launch posture blocked by control gate",
    summary:
      outcome === "READY_FOR_AUTHORIZED_LEVEL"
        ? `Synthetic evidence supports the bounded command chain through ${requestedLevel}. Production promotion remains explicitly unauthorized.`
        : outcome === "AUTHORITY_CONFLICT"
          ? "AMOS refused to select between competing current doctrine controllers and withheld a launch posture."
          : "The requested launch posture cannot advance because at least one controlling authority, capacity, dependency, or capability gate is unmet.",
    exactNextAction,
  };
}

export const CYPRESS_CONTROLLING_DOCTRINE = DOCTRINE;
