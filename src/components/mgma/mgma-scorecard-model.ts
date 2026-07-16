export type MgmaViewMode = "production_baseline" | "synthetic_demo";

export type MgmaMetricStatus =
  "on_target" | "at_risk" | "off_target" | "not_measured";

export type MgmaQualityStatus = "pass" | "warning" | "fail" | "not_measured";

export interface MgmaKpiViewModel {
  id: string;
  name: string;
  description: string | null;
  target: string | number | null;
  current: string | number | null;
  unit: string | null;
  status: MgmaMetricStatus;
  formula: string | null;
  owner: string | null;
  cadence: string | null;
  source: string | null;
  drillDown: string | null;
}

export interface MgmaDomainViewModel {
  id: string;
  number: number;
  name: string;
  description: string | null;
  module: string;
  responsibleScope: string;
  owner: string | null;
  drillDown: string | null;
  mappingStatus: string | null;
  score: number | null;
  onTarget: number;
  atRisk: number;
  offTarget: number;
  notMeasured: number;
  kpis: MgmaKpiViewModel[];
}

export interface MgmaScopeViewModel {
  code: "BHC" | "GRO" | "EO" | "GAD";
  label: string;
  kind: "profit_center" | "corporate_office";
  score: number | null;
  domainCount: number | null;
  totalKpis: number | null;
  onTarget: number | null;
  atRisk: number | null;
  offTarget: number | null;
  notMeasured: number | null;
  evidenceLabel: string | null;
}

export interface MgmaDataQualityViewModel {
  id:
    | "completeness"
    | "timeliness"
    | "duplication"
    | "denominator_validity"
    | "stale_data";
  label: string;
  status: MgmaQualityStatus;
  value: string | number | null;
  detail: string | null;
}

export interface MgmaApprovalItemViewModel {
  id: string;
  label: string;
  status: string;
  owner: string | null;
  decidedAt: string | null;
}

export interface MgmaScorecardViewModel {
  viewMode: MgmaViewMode;
  evidenceLabel: string;
  baselinePeriod: {
    start: string | null;
    end: string | null;
    status: string;
    approvalStatus: string;
  };
  overallScore: number | null;
  domains: MgmaDomainViewModel[];
  profitCenters: MgmaScopeViewModel[];
  corporateOffices: MgmaScopeViewModel[];
  overallKpis: {
    total: number | null;
    onTarget: number | null;
    atRisk: number | null;
    offTarget: number | null;
    notMeasured: number | null;
  };
  dataQuality: MgmaDataQualityViewModel[];
  dataQualityStatus: string;
  approvals: {
    status: string;
    required: number | null;
    approved: number | null;
    pending: number | null;
    rejected: number | null;
    approvedBy: string | null;
    lastApprovedAt: string | null;
    nextReviewAt: string | null;
    items: MgmaApprovalItemViewModel[];
  };
}

type UnknownRecord = Record<string, unknown>;

const CANONICAL_DOMAINS = [
  { number: 1, name: "Operations Management" },
  { number: 2, name: "Financial Management" },
  { number: 3, name: "Human Resources Management" },
  { number: 4, name: "Compliance & Risk Management" },
  { number: 5, name: "Patient Care & Clinical Quality" },
  { number: 6, name: "Information Management" },
  { number: 7, name: "Transformation & Strategy" },
] as const;

const SCOPE_DEFINITIONS = [
  { code: "BHC", label: "Behavioral Health Center", kind: "profit_center" },
  {
    code: "GRO",
    label: "General Residential Operation",
    kind: "profit_center",
  },
  { code: "EO", label: "Executive Office", kind: "corporate_office" },
  { code: "GAD", label: "General Administration", kind: "corporate_office" },
] as const;

const QUALITY_DEFINITIONS: ReadonlyArray<{
  id: MgmaDataQualityViewModel["id"];
  label: string;
  aliases: readonly string[];
}> = [
  { id: "completeness", label: "Completeness", aliases: ["completeness"] },
  { id: "timeliness", label: "Timeliness", aliases: ["timeliness"] },
  {
    id: "duplication",
    label: "Duplication",
    aliases: ["duplication", "duplicates"],
  },
  {
    id: "denominator_validity",
    label: "Denominator validity",
    aliases: ["denominatorValidity", "denominator_validity", "denominator"],
  },
  {
    id: "stale_data",
    label: "Stale data",
    aliases: ["staleData", "stale_data", "staleness"],
  },
];

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstValue(source: UnknownRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return null;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function descriptorValue(value: unknown): string | null {
  const primitive = textValue(value);
  if (primitive) return primitive;
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => descriptorValue(entry))
      .filter((entry): entry is string => entry !== null);
    return entries.length > 0 ? entries.join(" · ") : null;
  }
  const source = record(value);
  return source
    ? textValue(
        firstValue(source, [
          "label",
          "name",
          "description",
          "path",
          "route",
          "code",
        ]),
      )
    : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metricValue(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return textValue(value);
}

function integerValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.max(0, Math.trunc(parsed));
}

function normalizeMetricStatus(value: unknown): MgmaMetricStatus {
  const normalized = textValue(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    normalized === "on_target" ||
    normalized === "pass" ||
    normalized === "met"
  ) {
    return "on_target";
  }
  if (
    normalized === "at_risk" ||
    normalized === "warning" ||
    normalized === "watch"
  ) {
    return "at_risk";
  }
  if (
    normalized === "off_target" ||
    normalized === "fail" ||
    normalized === "missed"
  ) {
    return "off_target";
  }
  return "not_measured";
}

function normalizeQualityStatus(value: unknown): MgmaQualityStatus {
  const normalized = textValue(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    normalized === "pass" ||
    normalized === "valid" ||
    normalized === "complete"
  ) {
    return "pass";
  }
  if (
    normalized === "warning" ||
    normalized === "at_risk" ||
    normalized === "review"
  ) {
    return "warning";
  }
  if (
    normalized === "fail" ||
    normalized === "invalid" ||
    normalized === "off_target"
  ) {
    return "fail";
  }
  return "not_measured";
}

function normalizeKpi(value: unknown, index: number): MgmaKpiViewModel {
  const source = record(value) ?? {};
  const metadata =
    record(firstValue(source, ["metadata", "measurementMetadata"])) ?? {};
  const formulaSource = firstValue(source, [
    "formula",
    "calculation",
    "formulaDescription",
  ]);
  const formulaRecord = record(formulaSource);
  const current = metricValue(
    firstValue(source, ["current", "currentValue", "value"]),
  );

  return {
    id:
      textValue(firstValue(source, ["id", "kpiId", "code"])) ??
      `kpi-${index + 1}`,
    name:
      textValue(firstValue(source, ["name", "kpiName", "label"])) ??
      `KPI ${index + 1}`,
    description: textValue(
      firstValue(source, ["description", "kpiDescription"]),
    ),
    target: metricValue(firstValue(source, ["target", "targetValue", "goal"])),
    current,
    unit: textValue(
      firstValue(source, ["unit", "targetUnit", "measurementUnit"]),
    ),
    status:
      current === null
        ? "not_measured"
        : normalizeMetricStatus(
            firstValue(source, ["status", "measurementStatus"]),
          ),
    formula:
      textValue(formulaSource) ??
      (formulaRecord
        ? textValue(
            firstValue(formulaRecord, ["expression", "description", "label"]),
          )
        : null) ??
      textValue(firstValue(metadata, ["formula", "calculation"])),
    owner:
      descriptorValue(
        firstValue(source, [
          "owner",
          "ownerRole",
          "metricOwner",
          "responsibleOwner",
        ]),
      ) ??
      descriptorValue(
        firstValue(metadata, ["owner", "ownerRole", "metricOwner"]),
      ),
    cadence:
      textValue(
        firstValue(source, ["cadence", "measurementFrequency", "frequency"]),
      ) ??
      textValue(
        firstValue(metadata, ["cadence", "measurementFrequency", "frequency"]),
      ),
    source:
      descriptorValue(
        firstValue(source, [
          "source",
          "sourceSystem",
          "benchmarkSource",
          "dataSource",
        ]),
      ) ??
      descriptorValue(
        firstValue(metadata, [
          "source",
          "sourceSystem",
          "benchmarkSource",
          "dataSource",
        ]),
      ),
    drillDown:
      descriptorValue(
        firstValue(source, [
          "drillDown",
          "drillDownPath",
          "drillDownRoute",
          "drilldown",
          "route",
        ]),
      ) ??
      descriptorValue(
        firstValue(metadata, [
          "drillDown",
          "drillDownPath",
          "drillDownRoute",
          "route",
        ]),
      ),
  };
}

function scoreWithEvidence(
  rawScore: unknown,
  mode: MgmaViewMode,
  onTarget: number,
  atRisk: number,
  offTarget: number,
): number | null {
  const score = numberValue(rawScore);
  const measured = onTarget + atRisk + offTarget;
  if (score === null) return null;
  if (mode === "production_baseline" && measured === 0) return null;
  return Math.max(0, Math.min(100, score));
}

function normalizeDomain(
  value: unknown,
  index: number,
  mode: MgmaViewMode,
): MgmaDomainViewModel {
  const source = record(value) ?? {};
  const mapping =
    record(firstValue(source, ["mapping", "mappingMetadata", "amosMapping"])) ??
    {};
  const kpis = list(firstValue(source, ["kpis", "metrics", "measures"])).map(
    normalizeKpi,
  );
  const canonicalNumber = CANONICAL_DOMAINS[index]?.number ?? index + 1;
  const domainNumber = integerValue(
    firstValue(source, ["domainNumber", "number", "sequence"]),
  );
  const number =
    domainNumber && domainNumber >= 1 && domainNumber <= 7
      ? domainNumber
      : canonicalNumber;
  const derivedOnTarget = kpis.filter(
    (kpi) => kpi.status === "on_target",
  ).length;
  const derivedAtRisk = kpis.filter((kpi) => kpi.status === "at_risk").length;
  const derivedOffTarget = kpis.filter(
    (kpi) => kpi.status === "off_target",
  ).length;
  const derivedNotMeasured = kpis.filter(
    (kpi) => kpi.status === "not_measured",
  ).length;
  const onTarget =
    integerValue(firstValue(source, ["onTarget", "kpisOnTarget"])) ??
    derivedOnTarget;
  const atRisk =
    integerValue(firstValue(source, ["atRisk", "kpisAtRisk"])) ?? derivedAtRisk;
  const offTarget =
    integerValue(firstValue(source, ["offTarget", "kpisOffTarget"])) ??
    derivedOffTarget;
  const notMeasured =
    integerValue(firstValue(source, ["notMeasured", "kpisNotMeasured"])) ??
    derivedNotMeasured;
  const responsibleScope =
    textValue(
      firstValue(mapping, [
        "responsibleScope",
        "responsibleDivision",
        "scope",
        "division",
      ]),
    ) ??
    textValue(
      firstValue(source, [
        "responsibleScope",
        "responsibleDivision",
        "division",
      ]),
    ) ??
    "Awaiting governed mapping";

  return {
    id:
      textValue(firstValue(source, ["id", "domainId", "code"])) ??
      `mgma-domain-${number}`,
    number,
    name:
      textValue(firstValue(source, ["domainName", "name", "label"])) ??
      CANONICAL_DOMAINS[number - 1]?.name ??
      `Domain ${number}`,
    description: textValue(
      firstValue(source, ["domainDescription", "description"]),
    ),
    module:
      descriptorValue(
        firstValue(mapping, [
          "amosOpsModule",
          "amosOpsSurface",
          "amosOpsModules",
          "module",
          "surface",
        ]),
      ) ??
      descriptorValue(
        firstValue(source, [
          "amosOpsModule",
          "amosOpsSurface",
          "amosOpsModules",
          "module",
          "surface",
        ]),
      ) ??
      "Mapping unavailable",
    responsibleScope,
    owner:
      descriptorValue(
        firstValue(mapping, ["owner", "ownerRole", "accountableOwner"]),
      ) ??
      descriptorValue(
        firstValue(source, ["owner", "ownerRole", "accountableOwner"]),
      ),
    drillDown:
      descriptorValue(
        firstValue(mapping, [
          "drillDown",
          "drillDownPath",
          "drillDownRoute",
          "moduleRoute",
          "route",
        ]),
      ) ??
      descriptorValue(
        firstValue(source, [
          "drillDown",
          "drillDownPath",
          "drillDownRoute",
          "moduleRoute",
          "route",
        ]),
      ),
    mappingStatus:
      textValue(firstValue(mapping, ["status", "mappingStatus"])) ??
      textValue(firstValue(source, ["mappingStatus", "status"])),
    score: scoreWithEvidence(
      firstValue(source, ["score", "overallScore"]),
      mode,
      onTarget,
      atRisk,
      offTarget,
    ),
    onTarget,
    atRisk,
    offTarget,
    notMeasured,
    kpis,
  };
}

function ensureSevenDomains(
  rawDomains: unknown[],
  mode: MgmaViewMode,
): MgmaDomainViewModel[] {
  const normalized = rawDomains.map((domain, index) =>
    normalizeDomain(domain, index, mode),
  );
  return CANONICAL_DOMAINS.map((canonical, index) => {
    const existing = normalized.find(
      (domain) => domain.number === canonical.number,
    );
    return (
      existing ??
      normalizeDomain(
        {
          id: `mgma-domain-${canonical.number}`,
          domainNumber: canonical.number,
          domainName: canonical.name,
        },
        index,
        mode,
      )
    );
  });
}

function collectionRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value))
    return value
      .map(record)
      .filter((item): item is UnknownRecord => item !== null);
  const source = record(value);
  if (!source) return [];
  return Object.entries(source).flatMap(([key, entry]) => {
    const entryRecord = record(entry);
    return entryRecord ? [{ code: key, ...entryRecord }] : [];
  });
}

function rawScopeRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return collectionRecords(value);
  const source = record(value);
  if (!source) return [];

  const grouped = [
    ...collectionRecords(
      firstValue(source, ["profitCenters", "profit_centers"]),
    ),
    ...collectionRecords(
      firstValue(source, ["corporateOffices", "corporate_offices"]),
    ),
  ];
  if (grouped.length > 0) return grouped;
  return collectionRecords(source);
}

function normalizeScope(
  source: UnknownRecord | undefined,
  definition: (typeof SCOPE_DEFINITIONS)[number],
  mode: MgmaViewMode,
): MgmaScopeViewModel {
  const value = source ?? {};
  const onTarget = integerValue(
    firstValue(value, ["onTarget", "kpisOnTarget"]),
  );
  const atRisk = integerValue(firstValue(value, ["atRisk", "kpisAtRisk"]));
  const offTarget = integerValue(
    firstValue(value, ["offTarget", "kpisOffTarget"]),
  );
  const measured = (onTarget ?? 0) + (atRisk ?? 0) + (offTarget ?? 0);
  const rawScore = numberValue(firstValue(value, ["score", "overallScore"]));
  const score =
    rawScore === null || (mode === "production_baseline" && measured === 0)
      ? null
      : Math.max(0, Math.min(100, rawScore));

  return {
    code: definition.code,
    label:
      textValue(firstValue(value, ["label", "name", "scopeName"])) ??
      definition.label,
    kind: definition.kind,
    score,
    domainCount: integerValue(firstValue(value, ["domainCount", "domains"])),
    totalKpis: integerValue(
      firstValue(value, ["totalKpis", "kpiCount", "total"]),
    ),
    onTarget,
    atRisk,
    offTarget,
    notMeasured: integerValue(
      firstValue(value, ["notMeasured", "kpisNotMeasured"]),
    ),
    evidenceLabel: textValue(firstValue(value, ["evidenceLabel", "evidence"])),
  };
}

function normalizeScopes(
  value: unknown,
  mode: MgmaViewMode,
): {
  profitCenters: MgmaScopeViewModel[];
  corporateOffices: MgmaScopeViewModel[];
} {
  const records = rawScopeRecords(value);
  const scopes = SCOPE_DEFINITIONS.map((definition) => {
    const source = records.find((entry) => {
      const code = textValue(
        firstValue(entry, ["code", "division", "scopeCode", "id"]),
      );
      return code?.toUpperCase() === definition.code;
    });
    return normalizeScope(source, definition, mode);
  });

  return {
    profitCenters: scopes.filter((scope) => scope.kind === "profit_center"),
    corporateOffices: scopes.filter(
      (scope) => scope.kind === "corporate_office",
    ),
  };
}

function normalizeDataQuality(value: unknown): MgmaDataQualityViewModel[] {
  const source = record(value) ?? {};
  const checkRecords = list(firstValue(source, ["checks", "items"]));

  return QUALITY_DEFINITIONS.map((definition) => {
    const arrayMatch = checkRecords.map(record).find((check) => {
      if (!check) return false;
      const id = textValue(firstValue(check, ["id", "key", "name", "label"]));
      const compact = id?.toLowerCase().replace(/[\s_-]+/g, "");
      return definition.aliases.some(
        (alias) => alias.toLowerCase().replace(/[\s_-]+/g, "") === compact,
      );
    });
    const keyedValue = definition.aliases
      .map((alias) => source[alias])
      .find((entry) => entry !== undefined && entry !== null);
    const check = arrayMatch ?? record(keyedValue) ?? {};
    const primitiveValue = record(keyedValue) ? null : keyedValue;

    return {
      id: definition.id,
      label:
        textValue(firstValue(check, ["label", "name"])) ?? definition.label,
      status: normalizeQualityStatus(
        firstValue(check, ["status", "result", "state"]),
      ),
      value:
        metricValue(
          firstValue(check, ["value", "score", "count", "percentage"]),
        ) ?? metricValue(primitiveValue),
      detail: textValue(
        firstValue(check, ["detail", "message", "description", "reason"]),
      ),
    };
  });
}

function normalizeApprovalItems(value: unknown): MgmaApprovalItemViewModel[] {
  return list(value).flatMap((item, index) => {
    const source = record(item);
    if (!source) return [];
    return [
      {
        id:
          textValue(firstValue(source, ["id", "code"])) ??
          `approval-${index + 1}`,
        label:
          textValue(firstValue(source, ["label", "name", "approvalName"])) ??
          `Approval ${index + 1}`,
        status:
          textValue(firstValue(source, ["status", "decision"])) ??
          "not_started",
        owner: textValue(firstValue(source, ["owner", "approver", "role"])),
        decidedAt: textValue(
          firstValue(source, ["decidedAt", "approvedAt", "completedAt"]),
        ),
      },
    ];
  });
}

export function normalizeMgmaScorecard(
  value: unknown,
  requestedViewMode: MgmaViewMode,
): MgmaScorecardViewModel {
  const source = record(value) ?? {};
  const returnedMode = textValue(source.viewMode);
  const viewMode: MgmaViewMode =
    returnedMode === "production_baseline" || returnedMode === "synthetic_demo"
      ? returnedMode
      : requestedViewMode;
  const baseline =
    record(firstValue(source, ["baselinePeriod", "period"])) ?? {};
  const domains = ensureSevenDomains(list(source.domains), viewMode);
  const scopes = normalizeScopes(source.scopeSummaries, viewMode);
  const overall = record(source.overallKpis) ?? {};
  const derivedOnTarget = domains.reduce(
    (total, domain) => total + domain.onTarget,
    0,
  );
  const derivedAtRisk = domains.reduce(
    (total, domain) => total + domain.atRisk,
    0,
  );
  const derivedOffTarget = domains.reduce(
    (total, domain) => total + domain.offTarget,
    0,
  );
  const derivedNotMeasured = domains.reduce(
    (total, domain) => total + domain.notMeasured,
    0,
  );
  const hasRawOverall = Object.keys(overall).length > 0;
  const onTarget =
    integerValue(firstValue(overall, ["onTarget", "kpisOnTarget"])) ??
    (hasRawOverall ? derivedOnTarget : null);
  const atRisk =
    integerValue(firstValue(overall, ["atRisk", "kpisAtRisk"])) ??
    (hasRawOverall ? derivedAtRisk : null);
  const offTarget =
    integerValue(firstValue(overall, ["offTarget", "kpisOffTarget"])) ??
    (hasRawOverall ? derivedOffTarget : null);
  const notMeasured =
    integerValue(firstValue(overall, ["notMeasured", "kpisNotMeasured"])) ??
    (hasRawOverall ? derivedNotMeasured : null);
  const measured = (onTarget ?? 0) + (atRisk ?? 0) + (offTarget ?? 0);
  const rawOverallScore = numberValue(source.overallScore);
  const overallScore =
    rawOverallScore === null ||
    (viewMode === "production_baseline" && measured === 0)
      ? null
      : Math.max(0, Math.min(100, rawOverallScore));
  const approvalsSource =
    record(firstValue(source, ["approvals", "approvalSummary"])) ?? {};
  const dataQualitySource = record(source.dataQuality) ?? {};

  return {
    viewMode,
    evidenceLabel:
      textValue(source.evidenceLabel) ??
      (viewMode === "synthetic_demo"
        ? "Synthetic preview — not production evidence"
        : "Governed production baseline evidence"),
    baselinePeriod: {
      start: textValue(
        firstValue(baseline, ["start", "startDate", "periodStart"]),
      ),
      end: textValue(firstValue(baseline, ["end", "endDate", "periodEnd"])),
      status:
        textValue(firstValue(baseline, ["status", "baselineStatus"])) ??
        "not_started",
      approvalStatus:
        textValue(
          firstValue(baseline, ["approvalStatus", "approval_status"]),
        ) ??
        textValue(firstValue(approvalsSource, ["status", "approvalStatus"])) ??
        "not_started",
    },
    overallScore,
    domains,
    profitCenters: scopes.profitCenters,
    corporateOffices: scopes.corporateOffices,
    overallKpis: {
      total: integerValue(
        firstValue(overall, ["total", "totalKpis", "kpiCount"]),
      ),
      onTarget,
      atRisk,
      offTarget,
      notMeasured,
    },
    dataQuality: normalizeDataQuality(source.dataQuality),
    dataQualityStatus:
      textValue(firstValue(dataQualitySource, ["status", "overallStatus"])) ??
      "not_checked",
    approvals: {
      status:
        textValue(firstValue(approvalsSource, ["status", "approvalStatus"])) ??
        textValue(
          firstValue(baseline, ["approvalStatus", "approval_status"]),
        ) ??
        "not_started",
      required: integerValue(
        firstValue(approvalsSource, ["required", "requiredCount", "total"]),
      ),
      approved: integerValue(
        firstValue(approvalsSource, ["approved", "approvedCount"]),
      ),
      pending: integerValue(
        firstValue(approvalsSource, ["pending", "pendingCount"]),
      ),
      rejected: integerValue(
        firstValue(approvalsSource, ["rejected", "rejectedCount"]),
      ),
      approvedBy: textValue(
        firstValue(approvalsSource, ["approvedBy", "lastApprovedBy"]),
      ),
      lastApprovedAt: textValue(
        firstValue(approvalsSource, ["lastApprovedAt", "approvedAt"]),
      ),
      nextReviewAt: textValue(
        firstValue(approvalsSource, ["nextReviewAt", "reviewDueAt"]),
      ),
      items: normalizeApprovalItems(
        firstValue(approvalsSource, ["items", "approvals", "steps"]),
      ),
    },
  };
}
