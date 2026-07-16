import { KPI_DEFINITIONS } from "../mgma/baseline";
import type {
  M41aMetricCategory,
  M41aMetricDefinition,
  M41aMetricUnit,
  M41aOwner,
  M41aScopeId,
  M41aSensitivity,
} from "./model";

const OWNERS = {
  executive: {
    roleId: "managing-director",
    roleLabel: "Managing Director",
    division: "EO",
  },
  revenue: {
    roleId: "revenue-cycle-manager",
    roleLabel: "Revenue Cycle Manager",
    division: "EO",
  },
  compliance: {
    roleId: "hr-compliance-officer",
    roleLabel: "HR / Compliance Officer",
    division: "EO",
  },
  workforce: {
    roleId: "hr-director",
    roleLabel: "HR Director",
    division: "EO",
  },
  facilities: {
    roleId: "facilities-manager",
    roleLabel: "Facilities Manager",
    division: "GAD",
  },
  bhc: {
    roleId: "bhc-director",
    roleLabel: "BHC Director",
    division: "BHC",
  },
  gro: {
    roleId: "gro-administrator",
    roleLabel: "GRO Administrator",
    division: "GRO",
  },
} as const satisfies Readonly<Record<string, M41aOwner>>;

interface DefinitionInput {
  id: string;
  name: string;
  category: M41aMetricCategory;
  scopes: readonly M41aScopeId[];
  description: string;
  formula: string;
  unit: M41aMetricUnit;
  target: number;
  comparison: "gte" | "lte";
  threshold: number;
  owner: M41aOwner;
  sourceSystem: string;
  sourceFields: readonly string[];
  sensitivity?: M41aSensitivity;
  cadence?: "daily" | "weekly" | "monthly" | "quarterly";
  staleAfterHours?: number;
  precision?: number;
  mgmaKpiId?: string;
}

function definition(input: DefinitionInput): M41aMetricDefinition {
  return Object.freeze({
    id: input.id,
    name: input.name,
    category: input.category,
    scopeIds: input.scopes,
    description: input.description,
    formula: input.formula,
    unit: input.unit,
    precision: input.precision ?? (input.unit === "currency" ? 0 : 1),
    sourceSystem: input.sourceSystem,
    sourceFields: input.sourceFields,
    owner: input.owner,
    refreshCadence: input.cadence ?? "daily",
    staleAfterHours: input.staleAfterHours ?? 30,
    target: {
      value: input.target,
      comparison: input.comparison,
      label: `${input.comparison === "gte" ? "At least" : "No more than"} ${input.target}`,
    },
    alertThreshold: input.threshold,
    drillDownLabel: `${input.name} supporting evidence`,
    maximumDrillDepth: 3,
    sensitivity: input.sensitivity ?? "aggregate",
    ...(input.mgmaKpiId ? { mgmaKpiId: input.mgmaKpiId } : {}),
  });
}

function mgmaDefinition(
  id: string,
  category: M41aMetricCategory,
  scopes: readonly M41aScopeId[],
): M41aMetricDefinition {
  const source = KPI_DEFINITIONS.find((item) => item.id === id);
  if (!source) throw new Error(`M41A_MGMA_DEFINITION_MISSING:${id}`);
  return definition({
    id: `${scopes[0]}-MGMA-${id}`,
    name: source.name,
    category,
    scopes,
    description: source.description,
    formula: source.formula,
    unit: source.unit,
    target: source.target,
    comparison: source.comparison,
    threshold: source.threshold.value,
    owner: {
      roleId: source.owner.roleId as M41aOwner["roleId"],
      roleLabel: source.owner.roleLabel,
      division: source.owner.division,
    },
    sourceSystem: source.sourceSystem,
    sourceFields: source.sourceFields,
    cadence: source.refreshCadence,
    staleAfterHours: source.staleAfterHours,
    precision: source.precision,
    mgmaKpiId: source.id,
  });
}

const PC_SCOPES = ["BHC", "GRO"] as const;
const CO_SCOPES = ["EO", "GAD"] as const;

export const M41A_METRIC_CATALOG: readonly M41aMetricDefinition[] = [
  definition({
    id: "EXEC-CENSUS-3STAGE",
    name: "Three-Stage Census",
    category: "census",
    scopes: ["ENTERPRISE"],
    description: "Total youth census across the three controlled campus stages.",
    formula: "stage 1 census + stage 2 census + stage 3 census",
    unit: "count",
    target: 7,
    comparison: "gte",
    threshold: 5,
    owner: OWNERS.executive,
    sourceSystem: "AMOS-OPS Phase 2 GRO Residential",
    sourceFields: ["placements.stage_id", "placements.status", "placements.youth_id"],
    sensitivity: "youth",
  }),
  definition({
    id: "EXEC-REVENUE-VARIANCE",
    name: "Revenue vs Budget",
    category: "revenue",
    scopes: ["ENTERPRISE"],
    description: "Recognized revenue as a percentage of the controlled period budget.",
    formula: "recognized revenue / approved budget * 100",
    unit: "percent",
    target: 100,
    comparison: "gte",
    threshold: 95,
    owner: OWNERS.revenue,
    sourceSystem: "AMOS-OPS Revenue Cycle and M4.1A Budget Register",
    sourceFields: ["revenue.actual", "budget.approved_amount", "period.id"],
    sensitivity: "finance",
    cadence: "monthly",
    staleAfterHours: 768,
  }),
  definition({
    id: "EXEC-PC-PERFORMANCE",
    name: "Profit Center Performance",
    category: "profit_center_performance",
    scopes: ["ENTERPRISE"],
    description: "Share of BHC and GRO controlled scorecard measures meeting target.",
    formula: "profit center measures on target / profit center measures measured * 100",
    unit: "percent",
    target: 85,
    comparison: "gte",
    threshold: 75,
    owner: OWNERS.executive,
    sourceSystem: "AMOS-OPS M1.3 MGMA Scorecard",
    sourceFields: ["scorecard.scope_id", "scorecard.target_status"],
  }),
  mgmaDefinition("007", "compliance", ["ENTERPRISE"]),
  mgmaDefinition("013", "strategic_initiatives", ["ENTERPRISE"]),

  ...PC_SCOPES.flatMap((scope) => {
    const owner = scope === "BHC" ? OWNERS.bhc : OWNERS.gro;
    return [
      definition({
        id: `${scope}-REVENUE`,
        name: `${scope} Recognized Revenue`,
        category: "revenue",
        scopes: [scope],
        description: `Recognized synthetic period revenue attributable to ${scope}.`,
        formula: "sum reconciled posted payments attributed to scope",
        unit: "currency",
        target: scope === "BHC" ? 110000 : 65000,
        comparison: "gte",
        threshold: scope === "BHC" ? 95000 : 55000,
        owner: OWNERS.revenue,
        sourceSystem: "AMOS-OPS Phase 3 Revenue Cycle",
        sourceFields: ["payments.scope", "payments.amount", "payments.posted_at"],
        sensitivity: "finance",
        cadence: "monthly",
        staleAfterHours: 768,
      }),
      definition({
        id: `${scope}-CENSUS`,
        name: `${scope} Census`,
        category: "census",
        scopes: [scope],
        description: `Active synthetic youth census attributed to ${scope}.`,
        formula: "count distinct active synthetic youth in scope",
        unit: "count",
        target: scope === "BHC" ? 4 : 7,
        comparison: "gte",
        threshold: scope === "BHC" ? 3 : 5,
        owner,
        sourceSystem: scope === "BHC" ? "AMOS-OPS Phase 2 Care Episodes" : "AMOS-OPS Phase 2 GRO Residential",
        sourceFields: ["episode.scope", "episode.status", "episode.synthetic_youth_id"],
        sensitivity: "youth",
      }),
      definition({
        id: `${scope}-UTILIZATION`,
        name: `${scope} Utilization`,
        category: "utilization",
        scopes: [scope],
        description: `${scope} utilized capacity divided by available controlled capacity.`,
        formula: "utilized capacity / available capacity * 100",
        unit: "percent",
        target: 75,
        comparison: "gte",
        threshold: 60,
        owner,
        sourceSystem: scope === "BHC" ? "AMOS-OPS Service Delivery" : "AMOS-OPS GRO Residential",
        sourceFields: ["capacity.available", "capacity.utilized"],
      }),
      mgmaDefinition("009", "outcomes", [scope]),
      mgmaDefinition("010", "service_timeliness", [scope]),
      definition({
        id: `${scope}-OPERATIONAL-RISK`,
        name: `${scope} Controlled Risk Closure`,
        category: "operational_risk",
        scopes: [scope],
        description: `Share of due ${scope} operational risks closed with evidence.`,
        formula: "risks closed with evidence / risks due * 100",
        unit: "percent",
        target: 95,
        comparison: "gte",
        threshold: 85,
        owner,
        sourceSystem: "AMOS-OPS Phase 3 Compliance",
        sourceFields: ["findings.scope", "findings.due_at", "findings.closed_at", "findings.evidence_id"],
      }),
    ];
  }),

  ...CO_SCOPES.flatMap((scope) => {
    const owner = scope === "EO" ? OWNERS.executive : OWNERS.facilities;
    return [
      mgmaDefinition("007", "compliance", [scope]),
      definition({
        id: `${scope}-COST-VARIANCE`,
        name: `${scope} Cost vs Budget`,
        category: "cost",
        scopes: [scope],
        description: `${scope} controlled operating cost as a percentage of approved period budget.`,
        formula: "actual controlled operating cost / approved cost budget * 100",
        unit: "percent",
        target: 100,
        comparison: "lte",
        threshold: 105,
        owner,
        sourceSystem: "AMOS-OPS GAD/Finance and M4.1A Budget Register",
        sourceFields: ["cost.actual", "budget.approved_amount", "period.id"],
        sensitivity: "finance",
        cadence: "monthly",
        staleAfterHours: 768,
      }),
      mgmaDefinition("005", "workforce", [scope]),
      mgmaDefinition("008", "facilities", [scope]),
      definition({
        id: `${scope}-PROCUREMENT`,
        name: `${scope} Procurement Match Rate`,
        category: "procurement",
        scopes: [scope],
        description: `${scope} purchase orders matched to receipt and invoice without unresolved exception.`,
        formula: "fully matched purchase orders / purchase orders due for match * 100",
        unit: "percent",
        target: 98,
        comparison: "gte",
        threshold: 95,
        owner: OWNERS.facilities,
        sourceSystem: "AMOS-OPS Phase 3 GAD Procurement",
        sourceFields: ["purchase_order.id", "receipt.id", "invoice.id", "match.exception_status"],
        sensitivity: "finance",
      }),
      mgmaDefinition("014", "support_performance", [scope]),
    ];
  }),
] as const;

export function m41aDefinitionsForScope(
  scope: M41aScopeId,
): readonly M41aMetricDefinition[] {
  return M41A_METRIC_CATALOG.filter((item) => item.scopeIds.includes(scope));
}

export function getM41aMetricDefinition(id: string): M41aMetricDefinition {
  const item = M41A_METRIC_CATALOG.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`M41A_UNKNOWN_METRIC:${id}`);
  return item;
}
