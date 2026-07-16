import { createHash } from "node:crypto";
import type { M42ActorContext, M42AuditEvent } from "@contracts/m42/shared";
import {
  M42_EVIDENCE_CLASS,
  requireM42SyntheticId,
  tierAtLeastT2,
} from "@contracts/m42/shared";
import type {
  M42ReportBuilderSnapshot,
  M42ReportDefinitionDraft,
  M42ReportExecution,
  M42ReportExportManifest,
  M42ReportFieldDefinition,
  M42ReportFilter,
  M42ReportLineage,
  M42ReportOperator,
  M42ReportScalar,
  M42ReportSourceDefinition,
  M42SavedReportDefinition,
} from "@contracts/m42/reporting";

export interface M42ReportSourceRuntime {
  definition: M42ReportSourceDefinition;
  rows: readonly Readonly<Record<string, M42ReportScalar>>[];
}

const REPORT_BUILD_PERMISSION = "m42:report:build";
const REPORT_EXPORT_PERMISSION = "m42:report:export";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hasPermission(actor: M42ActorContext, permission: string): boolean {
  return (
    actor.permissions.includes("*") || actor.permissions.includes(permission)
  );
}

function isScalarArray(
  value: M42ReportFilter["value"],
): value is readonly M42ReportScalar[] {
  return Array.isArray(value);
}

function assertTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value)))
    throw new Error(`M42_${label}_TIMESTAMP_INVALID`);
}

function assertReportBuilderActor(actor: M42ActorContext): void {
  requireM42SyntheticId(actor.actorId, "report_actor");
  if (!actor.synthetic) throw new Error("M42_REPORT_SYNTHETIC_ACTOR_REQUIRED");
  if (!tierAtLeastT2(actor.tier))
    throw new Error(`M42_REPORT_TIER_ACCESS_DENIED:${actor.tier}`);
  if (!hasPermission(actor, REPORT_BUILD_PERMISSION))
    throw new Error("M42_REPORT_BUILD_PERMISSION_REQUIRED");
}

function canAccessField(
  actor: M42ActorContext,
  field: M42ReportFieldDefinition,
): boolean {
  return (
    field.allowedTiers.includes(actor.tier) &&
    hasPermission(actor, field.requiredPermission) &&
    actor.sensitivityClearance.includes(field.classification)
  );
}

function cloneFilter(filter: M42ReportFilter): M42ReportFilter {
  return Object.freeze({
    fieldId: filter.fieldId,
    operator: filter.operator,
    value: isScalarArray(filter.value)
      ? Object.freeze([...filter.value])
      : filter.value,
  });
}

function freezeDefinition(
  definition: M42SavedReportDefinition,
): M42SavedReportDefinition {
  return Object.freeze({
    ...definition,
    selectedFieldIds: Object.freeze([...definition.selectedFieldIds]),
    filters: Object.freeze(definition.filters.map(cloneFilter)),
  });
}

function valueMatchesType(
  value: M42ReportScalar,
  field: M42ReportFieldDefinition,
): boolean {
  if (value === null) return true;
  if (field.dataType === "date")
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  return typeof value === field.dataType;
}

const STRING_OPERATORS = new Set<M42ReportOperator>([
  "equals",
  "not_equals",
  "contains",
  "in",
]);
const NUMBER_DATE_OPERATORS = new Set<M42ReportOperator>([
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "in",
]);
const BOOLEAN_OPERATORS = new Set<M42ReportOperator>([
  "equals",
  "not_equals",
  "in",
]);

function validateFilter(
  filter: M42ReportFilter,
  field: M42ReportFieldDefinition,
): void {
  const operators =
    field.dataType === "string"
      ? STRING_OPERATORS
      : field.dataType === "boolean"
        ? BOOLEAN_OPERATORS
        : NUMBER_DATE_OPERATORS;
  if (!operators.has(filter.operator))
    throw new Error(
      `M42_REPORT_FILTER_OPERATOR_INVALID:${filter.fieldId}:${filter.operator}`,
    );
  if (filter.operator === "in") {
    if (!isScalarArray(filter.value) || filter.value.length === 0)
      throw new Error(`M42_REPORT_FILTER_LIST_REQUIRED:${filter.fieldId}`);
    if (!filter.value.every((value) => valueMatchesType(value, field)))
      throw new Error(`M42_REPORT_FILTER_VALUE_INVALID:${filter.fieldId}`);
    return;
  }
  if (isScalarArray(filter.value) || !valueMatchesType(filter.value, field))
    throw new Error(`M42_REPORT_FILTER_VALUE_INVALID:${filter.fieldId}`);
}

function compareValues(
  candidate: M42ReportScalar,
  operator: M42ReportOperator,
  expected: M42ReportFilter["value"],
): boolean {
  if (operator === "in")
    return isScalarArray(expected) && expected.includes(candidate);
  if (isScalarArray(expected)) return false;
  if (operator === "equals") return candidate === expected;
  if (operator === "not_equals") return candidate !== expected;
  if (operator === "contains")
    return (
      typeof candidate === "string" &&
      typeof expected === "string" &&
      candidate.toLocaleLowerCase().includes(expected.toLocaleLowerCase())
    );
  if (candidate === null || expected === null) return false;
  const left =
    typeof candidate === "number" ? candidate : Date.parse(String(candidate));
  const right =
    typeof expected === "number" ? expected : Date.parse(String(expected));
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (operator === "greater_than") return left > right;
  if (operator === "greater_than_or_equal") return left >= right;
  if (operator === "less_than") return left < right;
  return left <= right;
}

function freezeSource(runtime: M42ReportSourceRuntime): M42ReportSourceRuntime {
  return Object.freeze({
    definition: Object.freeze({
      ...runtime.definition,
      fields: Object.freeze(
        runtime.definition.fields.map((field) =>
          Object.freeze({
            ...field,
            allowedTiers: Object.freeze([...field.allowedTiers]),
          }),
        ),
      ),
      citation: Object.freeze(runtime.definition.citation),
    }),
    rows: Object.freeze(runtime.rows.map((row) => Object.freeze({ ...row }))),
  });
}

function createSyntheticSource(): M42ReportSourceRuntime {
  const fields: readonly M42ReportFieldDefinition[] = Object.freeze([
    Object.freeze({
      fieldId: "record_id",
      label: "Synthetic record identifier",
      dataType: "string",
      classification: "internal",
      allowedTiers: Object.freeze(["T1", "T2"] as const),
      requiredPermission: REPORT_BUILD_PERMISSION,
      sourcePath: "synthetic.operations.record_id",
      exportable: true,
      synthetic: true,
    }),
    Object.freeze({
      fieldId: "division",
      label: "Operating division",
      dataType: "string",
      classification: "internal",
      allowedTiers: Object.freeze(["T1", "T2"] as const),
      requiredPermission: REPORT_BUILD_PERMISSION,
      sourcePath: "synthetic.operations.division",
      exportable: true,
      synthetic: true,
    }),
    Object.freeze({
      fieldId: "service_count",
      label: "Synthetic aggregate service count",
      dataType: "number",
      classification: "confidential",
      allowedTiers: Object.freeze(["T1", "T2"] as const),
      requiredPermission: "m42:report:clinical-aggregate",
      sourcePath: "synthetic.operations.service_count",
      exportable: true,
      synthetic: true,
    }),
    Object.freeze({
      fieldId: "net_revenue",
      label: "Synthetic net revenue",
      dataType: "number",
      classification: "confidential",
      allowedTiers: Object.freeze(["T1", "T2"] as const),
      requiredPermission: "m42:report:finance",
      sourcePath: "synthetic.operations.net_revenue",
      exportable: true,
      synthetic: true,
    }),
    Object.freeze({
      fieldId: "restricted_control_note",
      label: "Restricted synthetic control note",
      dataType: "string",
      classification: "restricted",
      allowedTiers: Object.freeze(["T1"] as const),
      requiredPermission: "m42:report:restricted",
      sourcePath: "synthetic.operations.restricted_control_note",
      exportable: false,
      synthetic: true,
    }),
  ]);
  const contentHash = hash({ sourceId: "SYNTH-M42-SOURCE-OPERATIONS", fields });
  return freezeSource({
    definition: {
      sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
      title: "Synthetic governed operations register",
      version: "SYNTH-1.0",
      sourceOfTruthUri: "amos-synthetic://m42/sources/operations/v1",
      ownerRole: "administrator",
      fields,
      citation: {
        sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
        stableObjectId: "SYNTH-M42-STABLE-OPERATIONS",
        title: "Synthetic governed operations register",
        version: "SYNTH-1.0",
        ownerRole: "administrator",
        recordState: "published",
        classification: "confidential",
        sourceOfTruthUri: "amos-synthetic://m42/sources/operations/v1",
        effectiveAt: "2026-12-01T08:00:00.000Z",
        reviewedAt: "2026-12-15T08:00:00.000Z",
        contentHash,
        synthetic: true,
      },
      synthetic: true,
    },
    rows: [
      {
        record_id: "SYNTH-M42-ROW-001",
        division: "BHC",
        service_count: 42,
        net_revenue: 125000,
        restricted_control_note: "SYNTH restricted finance review note",
      },
      {
        record_id: "SYNTH-M42-ROW-002",
        division: "GRO",
        service_count: 31,
        net_revenue: 98000,
        restricted_control_note: "SYNTH restricted operations review note",
      },
      {
        record_id: "SYNTH-M42-ROW-003",
        division: "BHC",
        service_count: 27,
        net_revenue: 81000,
        restricted_control_note: "SYNTH restricted quality review note",
      },
    ],
  });
}

export class M42GovernedReportBuilder {
  readonly #sources: readonly M42ReportSourceRuntime[];
  readonly #definitions: M42SavedReportDefinition[] = [];
  readonly #auditEvents: M42AuditEvent[] = [];

  constructor(
    sources: readonly M42ReportSourceRuntime[] = [createSyntheticSource()],
  ) {
    if (sources.length === 0) throw new Error("M42_REPORT_SOURCE_REQUIRED");
    this.#sources = Object.freeze(sources.map(freezeSource));
  }

  listAvailableFields(
    actor: M42ActorContext,
    sourceId: string,
  ): readonly M42ReportFieldDefinition[] {
    assertReportBuilderActor(actor);
    const source = this.#source(sourceId);
    return Object.freeze(
      source.definition.fields.filter((field) => canAccessField(actor, field)),
    );
  }

  saveDefinition(
    actor: M42ActorContext,
    draft: M42ReportDefinitionDraft,
    createdAt: string,
  ): M42SavedReportDefinition {
    assertReportBuilderActor(actor);
    assertTimestamp(createdAt, "REPORT_DEFINITION");
    requireM42SyntheticId(draft.stableKey, "report_stable_key");
    const title = draft.title.trim();
    const purpose = draft.purpose.trim();
    if (title.length < 3) throw new Error("M42_REPORT_TITLE_REQUIRED");
    if (purpose.length < 10) throw new Error("M42_REPORT_PURPOSE_REQUIRED");
    if (draft.selectedFieldIds.length === 0)
      throw new Error("M42_REPORT_FIELD_REQUIRED");
    if (new Set(draft.selectedFieldIds).size !== draft.selectedFieldIds.length)
      throw new Error("M42_REPORT_DUPLICATE_FIELD");
    const source = this.#source(draft.sourceId);
    const fields = new Map(
      source.definition.fields.map((field) => [field.fieldId, field]),
    );
    for (const fieldId of draft.selectedFieldIds) {
      const field = fields.get(fieldId);
      if (!field) throw new Error(`M42_REPORT_FIELD_UNKNOWN:${fieldId}`);
      if (!canAccessField(actor, field))
        throw new Error(`M42_REPORT_FIELD_ACCESS_DENIED:${fieldId}`);
    }
    for (const filter of draft.filters) {
      const field = fields.get(filter.fieldId);
      if (!field)
        throw new Error(`M42_REPORT_FILTER_FIELD_UNKNOWN:${filter.fieldId}`);
      if (!canAccessField(actor, field))
        throw new Error(
          `M42_REPORT_FILTER_FIELD_ACCESS_DENIED:${filter.fieldId}`,
        );
      validateFilter(filter, field);
    }
    if (draft.exportEnabled && !hasPermission(actor, REPORT_EXPORT_PERMISSION))
      throw new Error("M42_REPORT_EXPORT_PERMISSION_REQUIRED");

    const history = this.#definitions.filter(
      (definition) => definition.stableKey === draft.stableKey,
    );
    const version = history.length + 1;
    const previous = history[history.length - 1] ?? null;
    const definition = freezeDefinition({
      stableKey: draft.stableKey,
      definitionId: `${draft.stableKey}-V${version}`,
      version,
      previousDefinitionId: previous?.definitionId ?? null,
      title,
      purpose,
      sourceId: draft.sourceId,
      selectedFieldIds: draft.selectedFieldIds,
      filters: draft.filters,
      exportEnabled: draft.exportEnabled,
      createdBy: actor.actorId,
      createdByRole: actor.role,
      createdAt,
      immutable: true,
      synthetic: true,
    });
    this.#definitions.push(definition);
    this.#recordAudit({
      eventType: "report_saved",
      actor,
      entityId: definition.definitionId,
      correlationId: `${draft.stableKey}-SAVE-V${version}`,
      sourceIds: [draft.sourceId],
      outcome: "recorded",
      reason: `Immutable synthetic report definition version ${version} saved.`,
      occurredAt: createdAt,
    });
    return definition;
  }

  definitionHistory(stableKey: string): readonly M42SavedReportDefinition[] {
    return Object.freeze(
      this.#definitions.filter(
        (definition) => definition.stableKey === stableKey,
      ),
    );
  }

  executeDefinition(
    actor: M42ActorContext,
    definitionId: string,
    executedAt: string,
  ): M42ReportExecution {
    assertReportBuilderActor(actor);
    assertTimestamp(executedAt, "REPORT_EXECUTION");
    const definition = this.#definition(definitionId);
    const source = this.#source(definition.sourceId);
    const fields = new Map(
      source.definition.fields.map((field) => [field.fieldId, field]),
    );
    for (const filter of definition.filters) {
      const field = fields.get(filter.fieldId);
      if (!field || !canAccessField(actor, field))
        throw new Error(
          `M42_REPORT_FILTER_FIELD_ACCESS_DENIED:${filter.fieldId}`,
        );
    }
    const selectedFieldIds = definition.selectedFieldIds.filter((fieldId) => {
      const field = fields.get(fieldId);
      return field !== undefined && canAccessField(actor, field);
    });
    const concealedFieldIds = definition.selectedFieldIds.filter(
      (fieldId) => !selectedFieldIds.includes(fieldId),
    );
    if (selectedFieldIds.length === 0)
      throw new Error("M42_REPORT_ALL_FIELDS_CONCEALED");
    const filteredRows = source.rows.filter((row) =>
      definition.filters.every((filter) =>
        compareValues(
          row[filter.fieldId] ?? null,
          filter.operator,
          filter.value,
        ),
      ),
    );
    const rows = Object.freeze(
      filteredRows.map((row) =>
        Object.freeze(
          Object.fromEntries(
            selectedFieldIds.map((fieldId) => [fieldId, row[fieldId] ?? null]),
          ),
        ),
      ),
    );
    const executionId = `${definition.definitionId}-EXEC-${
      this.#auditEvents.filter((event) => event.eventType === "report_executed")
        .length + 1
    }`;
    const lineage = this.#lineage(
      definition,
      source,
      selectedFieldIds,
      executedAt,
      executionId,
    );
    const execution: M42ReportExecution = Object.freeze({
      executionId,
      definitionId: definition.definitionId,
      definitionVersion: definition.version,
      executedBy: actor.actorId,
      executedByRole: actor.role,
      executedAt,
      selectedFieldIds: Object.freeze(selectedFieldIds),
      concealedFieldIds: Object.freeze(concealedFieldIds),
      rows,
      rowCount: rows.length,
      lineage,
      permissionTrimmedBeforeSelection: true,
      realDataUsed: false,
      externalWritePerformed: false,
      synthetic: true,
    });
    this.#recordAudit({
      eventType: "report_executed",
      actor,
      entityId: execution.executionId,
      correlationId: `${execution.executionId}-CORRELATION`,
      sourceIds: [source.definition.sourceId],
      outcome: "allowed",
      reason: `Permission-trimmed synthetic execution returned ${rows.length} rows and concealed ${concealedFieldIds.length} fields.`,
      occurredAt: executedAt,
    });
    return execution;
  }

  createExportManifest(
    actor: M42ActorContext,
    execution: M42ReportExecution,
    format: M42ReportExportManifest["format"],
    createdAt: string,
  ): M42ReportExportManifest {
    assertReportBuilderActor(actor);
    assertTimestamp(createdAt, "REPORT_EXPORT");
    if (!hasPermission(actor, REPORT_EXPORT_PERMISSION))
      throw new Error("M42_REPORT_EXPORT_PERMISSION_REQUIRED");
    const definition = this.#definition(execution.definitionId);
    if (!definition.exportEnabled)
      throw new Error("M42_REPORT_EXPORT_NOT_ENABLED");
    const source = this.#source(definition.sourceId);
    const fieldById = new Map(
      source.definition.fields.map((field) => [field.fieldId, field]),
    );
    const nonExportable = execution.selectedFieldIds.filter(
      (fieldId) => !fieldById.get(fieldId)?.exportable,
    );
    if (nonExportable.length > 0)
      throw new Error(
        `M42_REPORT_FIELD_NOT_EXPORTABLE:${nonExportable.join(",")}`,
      );
    const sequence =
      this.#auditEvents.filter(
        (event) => event.eventType === "export_manifest_created",
      ).length + 1;
    const manifest: M42ReportExportManifest = Object.freeze({
      manifestId: `${execution.executionId}-EXPORT-MANIFEST-${sequence}`,
      executionId: execution.executionId,
      definitionId: definition.definitionId,
      definitionVersion: definition.version,
      requestedBy: actor.actorId,
      requestedByRole: actor.role,
      createdAt,
      format,
      fieldIds: Object.freeze([...execution.selectedFieldIds]),
      concealedFieldIds: Object.freeze([...execution.concealedFieldIds]),
      rowCount: execution.rowCount,
      contentSha256: hash({
        definitionId: definition.definitionId,
        version: definition.version,
        fields: execution.selectedFieldIds,
        rows: execution.rows,
        lineage: execution.lineage.definitionHash,
      }),
      deliveryStatus: "manifest_only_demo_boundary",
      externalRecipient: null,
      liveRepositoryWrite: false,
      realDataUsed: false,
      immutable: true,
      synthetic: true,
    });
    this.#recordAudit({
      eventType: "export_manifest_created",
      actor,
      entityId: manifest.manifestId,
      correlationId: `${execution.executionId}-EXPORT`,
      sourceIds: execution.lineage.sourceIds,
      outcome: "recorded",
      reason:
        "Synthetic export manifest created; live delivery and repository writes remain unavailable.",
      occurredAt: createdAt,
    });
    return manifest;
  }

  assertLiveExportUnavailable(): never {
    throw new Error("M42_LIVE_REPORT_EXPORT_UNAVAILABLE");
  }

  snapshot(): M42ReportBuilderSnapshot {
    return Object.freeze({
      sources: Object.freeze(this.#sources.map((source) => source.definition)),
      definitions: Object.freeze([...this.#definitions]),
      auditEvents: Object.freeze([...this.#auditEvents]),
      immutableDefinitions: true,
      synthetic: true,
    });
  }

  #source(sourceId: string): M42ReportSourceRuntime {
    const source = this.#sources.find(
      (candidate) => candidate.definition.sourceId === sourceId,
    );
    if (!source) throw new Error(`M42_REPORT_SOURCE_UNKNOWN:${sourceId}`);
    return source;
  }

  #definition(definitionId: string): M42SavedReportDefinition {
    const definition = this.#definitions.find(
      (candidate) => candidate.definitionId === definitionId,
    );
    if (!definition)
      throw new Error(`M42_REPORT_DEFINITION_UNKNOWN:${definitionId}`);
    return definition;
  }

  #lineage(
    definition: M42SavedReportDefinition,
    source: M42ReportSourceRuntime,
    selectedFieldIds: readonly string[],
    generatedAt: string,
    executionId: string,
  ): M42ReportLineage {
    const fields = Object.freeze(
      selectedFieldIds.map((fieldId) => {
        const field = source.definition.fields.find(
          (candidate) => candidate.fieldId === fieldId,
        );
        if (!field) throw new Error(`M42_REPORT_FIELD_UNKNOWN:${fieldId}`);
        return Object.freeze({
          fieldId,
          sourcePath: field.sourcePath,
          classification: field.classification,
          sourceId: source.definition.sourceId,
          sourceVersion: source.definition.version,
        });
      }),
    );
    const definitionHash = hash({
      definitionId: definition.definitionId,
      version: definition.version,
      sourceId: definition.sourceId,
      selectedFieldIds,
      filters: definition.filters,
    });
    return Object.freeze({
      lineageId: `${executionId}-LINEAGE`,
      definitionId: definition.definitionId,
      definitionVersion: definition.version,
      definitionHash,
      sourceIds: Object.freeze([source.definition.sourceId]),
      sourceCitations: Object.freeze([source.definition.citation]),
      fields,
      filters: Object.freeze(definition.filters.map(cloneFilter)),
      generatedAt,
      immutable: true,
      synthetic: true,
    });
  }

  #recordAudit(input: {
    eventType: M42AuditEvent["eventType"];
    actor: M42ActorContext;
    entityId: string;
    correlationId: string;
    sourceIds: readonly string[];
    outcome: M42AuditEvent["outcome"];
    reason: string;
    occurredAt: string;
  }): void {
    const event = Object.freeze({
      eventId: `SYNTH-M42-AUDIT-${String(this.#auditEvents.length + 1).padStart(4, "0")}`,
      eventType: input.eventType,
      actorId: input.actor.actorId,
      actorRole: input.actor.role,
      entityType: "report" as const,
      entityId: input.entityId,
      correlationId: input.correlationId,
      sourceIds: Object.freeze([...input.sourceIds]),
      outcome: input.outcome,
      reason: input.reason,
      occurredAt: input.occurredAt,
      immutable: true as const,
      evidenceClass: M42_EVIDENCE_CLASS,
    });
    this.#auditEvents.push(event);
  }
}

export function createSyntheticM42ReportBuilder(): M42GovernedReportBuilder {
  return new M42GovernedReportBuilder();
}
