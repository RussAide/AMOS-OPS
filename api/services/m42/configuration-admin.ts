import type { M42ActorContext, M42AuditEvent } from "@contracts/m42/shared";
import {
  M42_EVIDENCE_CLASS,
  requireM42SyntheticId,
  tierAtLeastT2,
} from "@contracts/m42/shared";
import type {
  M42ConfigurationApplyResult,
  M42ConfigurationApproval,
  M42ConfigurationPreview,
  M42ConfigurationSchema,
  M42ConfigurationSnapshot,
  M42ConfigurationValue,
  M42ConfigurationVersion,
} from "@contracts/m42/reporting";

const CONFIG_APPROVE_PERMISSION = "m42:admin:approve";
const CONFIG_AUDIT_PERMISSION = "m42:admin:audit";
const INITIALIZED_AT = "2026-12-15T08:00:00.000Z";

interface InitialConfiguration {
  schema: M42ConfigurationSchema;
  value: M42ConfigurationValue;
}

function hasPermission(actor: M42ActorContext, permission: string): boolean {
  return (
    actor.permissions.includes("*") || actor.permissions.includes(permission)
  );
}

function assertTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value)))
    throw new Error(`M42_${label}_TIMESTAMP_INVALID`);
}

function assertSyntheticActor(actor: M42ActorContext, purpose: string): void {
  requireM42SyntheticId(actor.actorId, `${purpose}_actor`);
  if (!actor.synthetic) throw new Error("M42_ADMIN_SYNTHETIC_ACTOR_REQUIRED");
  if (!tierAtLeastT2(actor.tier))
    throw new Error(`M42_ADMIN_TIER_ACCESS_DENIED:${actor.tier}`);
}

function cloneValue(value: M42ConfigurationValue): M42ConfigurationValue {
  return Array.isArray(value) ? Object.freeze([...value]) : value;
}

function sameValue(
  left: M42ConfigurationValue,
  right: M42ConfigurationValue,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function freezeSchema(schema: M42ConfigurationSchema): M42ConfigurationSchema {
  return Object.freeze({
    ...schema,
    allowedTiers: Object.freeze([...schema.allowedTiers]),
    approvalRoles: Object.freeze([...schema.approvalRoles]),
    allowedValues: schema.allowedValues
      ? Object.freeze([...schema.allowedValues])
      : undefined,
  });
}

function freezeVersion(
  version: M42ConfigurationVersion,
): M42ConfigurationVersion {
  return Object.freeze({ ...version, value: cloneValue(version.value) });
}

function freezePreview(
  preview: M42ConfigurationPreview,
): M42ConfigurationPreview {
  return Object.freeze({
    ...preview,
    currentValue: cloneValue(preview.currentValue),
    proposedValue: cloneValue(preview.proposedValue),
    validationErrors: Object.freeze([...preview.validationErrors]),
    approvalRoles: Object.freeze([...preview.approvalRoles]),
  });
}

function syntheticConfigurationCatalog(): readonly InitialConfiguration[] {
  return Object.freeze([
    Object.freeze({
      schema: freezeSchema({
        configKey: "records.retention.review_window_days",
        label: "Retention review window",
        description:
          "Days before the synthetic retention review queue is surfaced.",
        valueType: "number",
        domain: "records",
        requiredPermission: "m42:admin:records",
        allowedTiers: ["T1", "T2"],
        approvalRequired: true,
        approvalRoles: ["managing-director", "administrator"],
        minimum: 15,
        maximum: 365,
        productionConnectorMutationAvailable: false,
        synthetic: true,
      }),
      value: 90,
    }),
    Object.freeze({
      schema: freezeSchema({
        configKey: "search.result_limit",
        label: "Default search result limit",
        description:
          "Maximum deterministic synthetic results returned per search page.",
        valueType: "number",
        domain: "search",
        requiredPermission: "m42:admin:search",
        allowedTiers: ["T1", "T2"],
        approvalRequired: false,
        approvalRoles: [],
        minimum: 5,
        maximum: 100,
        productionConnectorMutationAvailable: false,
        synthetic: true,
      }),
      value: 25,
    }),
    Object.freeze({
      schema: freezeSchema({
        configKey: "search.enabled_classifications",
        label: "Enabled search classifications",
        description:
          "Approved classifications available to the permission-trimmed synthetic search engine.",
        valueType: "string_list",
        domain: "search",
        requiredPermission: "m42:admin:search",
        allowedTiers: ["T1"],
        approvalRequired: true,
        approvalRoles: ["managing-director", "administrator"],
        allowedValues: ["public", "internal", "confidential", "restricted"],
        productionConnectorMutationAvailable: false,
        synthetic: true,
      }),
      value: Object.freeze(["public", "internal", "confidential"]),
    }),
    Object.freeze({
      schema: freezeSchema({
        configKey: "reporting.export.max_rows",
        label: "Synthetic export manifest row limit",
        description:
          "Maximum rows represented by a controlled synthetic export manifest.",
        valueType: "number",
        domain: "reporting",
        requiredPermission: "m42:admin:reporting",
        allowedTiers: ["T1", "T2"],
        approvalRequired: true,
        approvalRoles: ["managing-director", "administrator"],
        minimum: 1,
        maximum: 1000,
        productionConnectorMutationAvailable: false,
        synthetic: true,
      }),
      value: 250,
    }),
    Object.freeze({
      schema: freezeSchema({
        configKey: "workspace.documents.default_view",
        label: "Default document workspace view",
        description:
          "Default no-code presentation mode for the synthetic document workspace.",
        valueType: "string",
        domain: "workspace",
        requiredPermission: "m42:admin:workspace",
        allowedTiers: ["T1", "T2"],
        approvalRequired: false,
        approvalRoles: [],
        allowedValues: ["recent", "owned", "review_queue"],
        productionConnectorMutationAvailable: false,
        synthetic: true,
      }),
      value: "recent",
    }),
  ]);
}

function validateConfigurationValue(
  schema: M42ConfigurationSchema,
  value: M42ConfigurationValue,
): readonly string[] {
  const errors: string[] = [];
  if (schema.valueType === "string" && typeof value !== "string")
    errors.push("M42_CONFIG_STRING_REQUIRED");
  if (schema.valueType === "number" && typeof value !== "number")
    errors.push("M42_CONFIG_NUMBER_REQUIRED");
  if (schema.valueType === "boolean" && typeof value !== "boolean")
    errors.push("M42_CONFIG_BOOLEAN_REQUIRED");
  if (
    schema.valueType === "string_list" &&
    (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
  )
    errors.push("M42_CONFIG_STRING_LIST_REQUIRED");
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      errors.push("M42_CONFIG_NUMBER_FINITE_REQUIRED");
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`M42_CONFIG_MINIMUM:${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`M42_CONFIG_MAXIMUM:${schema.maximum}`);
  }
  if (schema.allowedValues) {
    const values = Array.isArray(value) ? value : [value];
    if (
      values.some(
        (candidate) =>
          typeof candidate !== "string" ||
          !schema.allowedValues?.includes(candidate),
      )
    )
      errors.push(
        `M42_CONFIG_ALLOWED_VALUES:${schema.allowedValues.join("|")}`,
      );
  }
  if (Array.isArray(value) && new Set(value).size !== value.length)
    errors.push("M42_CONFIG_DUPLICATE_LIST_VALUE");
  return Object.freeze(errors);
}

export class M42NoCodeConfigurationAdmin {
  readonly #schemas: readonly M42ConfigurationSchema[];
  readonly #versions: M42ConfigurationVersion[] = [];
  readonly #previews: M42ConfigurationPreview[] = [];
  readonly #approvals: M42ConfigurationApproval[] = [];
  readonly #auditEvents: M42AuditEvent[] = [];

  constructor(
    catalog: readonly InitialConfiguration[] = syntheticConfigurationCatalog(),
  ) {
    if (catalog.length === 0) throw new Error("M42_CONFIG_SCHEMA_REQUIRED");
    const keys = catalog.map((item) => item.schema.configKey);
    if (new Set(keys).size !== keys.length)
      throw new Error("M42_CONFIG_DUPLICATE_SCHEMA_KEY");
    this.#schemas = Object.freeze(
      catalog.map((item) => freezeSchema(item.schema)),
    );
    for (const item of catalog) {
      const errors = validateConfigurationValue(item.schema, item.value);
      if (errors.length > 0)
        throw new Error(
          `M42_CONFIG_INITIAL_VALUE_INVALID:${item.schema.configKey}:${errors.join(",")}`,
        );
      this.#versions.push(
        freezeVersion({
          versionId: `SYNTH-M42-CONFIG-${item.schema.configKey.split(".").join("-").toUpperCase()}-V1`,
          configKey: item.schema.configKey,
          version: 1,
          previousVersionId: null,
          value: item.value,
          changeType: "initial",
          reason: "Frozen synthetic milestone baseline.",
          changedBy: "SYNTH-M42-SYSTEM",
          changedByRole: "super-admin",
          changedAt: INITIALIZED_AT,
          approvedBy: null,
          approvalId: null,
          rollbackTargetVersionId: null,
          immutable: true,
          synthetic: true,
        }),
      );
    }
  }

  listSchemas(actor: M42ActorContext): readonly M42ConfigurationSchema[] {
    assertSyntheticActor(actor, "config_list");
    return Object.freeze(
      this.#schemas.filter(
        (schema) =>
          schema.allowedTiers.includes(actor.tier) &&
          hasPermission(actor, schema.requiredPermission),
      ),
    );
  }

  currentVersion(
    actor: M42ActorContext,
    configKey: string,
  ): M42ConfigurationVersion {
    const schema = this.#authorizedSchema(actor, configKey);
    return this.#current(schema.configKey);
  }

  history(
    actor: M42ActorContext,
    configKey: string,
  ): readonly M42ConfigurationVersion[] {
    const schema = this.#authorizedSchema(actor, configKey);
    return Object.freeze(
      this.#versions.filter(
        (version) => version.configKey === schema.configKey,
      ),
    );
  }

  previewChange(
    actor: M42ActorContext,
    input: {
      configKey: string;
      proposedValue: M42ConfigurationValue;
      reason: string;
      requestedAt: string;
    },
  ): M42ConfigurationPreview {
    const schema = this.#authorizedSchema(actor, input.configKey);
    assertTimestamp(input.requestedAt, "CONFIG_PREVIEW");
    const reason = input.reason.trim();
    if (reason.length < 10)
      throw new Error("M42_CONFIG_CHANGE_REASON_REQUIRED");
    const current = this.#current(input.configKey);
    const errors = [...validateConfigurationValue(schema, input.proposedValue)];
    if (sameValue(current.value, input.proposedValue))
      errors.push("M42_CONFIG_VALUE_UNCHANGED");
    const preview = this.#storePreview({
      previewId: this.#nextPreviewId(),
      action: "change",
      configKey: input.configKey,
      currentVersionId: current.versionId,
      currentValue: current.value,
      proposedValue: input.proposedValue,
      rollbackTargetVersionId: null,
      requestedBy: actor.actorId,
      requestedByRole: actor.role,
      requestedAt: input.requestedAt,
      reason,
      valid: errors.length === 0,
      validationErrors: errors,
      approvalRequired: schema.approvalRequired,
      approvalRoles: schema.approvalRoles,
      mutatesState: false,
      synthetic: true,
    });
    this.#recordAudit({
      eventType: "configuration_validated",
      actor,
      entityId: preview.previewId,
      correlationId: `${preview.previewId}-CORRELATION`,
      outcome: preview.valid ? "recorded" : "denied",
      reason: preview.valid
        ? "No-code configuration preview passed schema validation without changing state."
        : `No-code configuration preview rejected: ${preview.validationErrors.join(", ")}`,
      occurredAt: input.requestedAt,
    });
    return preview;
  }

  previewRollback(
    actor: M42ActorContext,
    input: {
      configKey: string;
      targetVersionId: string;
      reason: string;
      requestedAt: string;
    },
  ): M42ConfigurationPreview {
    const schema = this.#authorizedSchema(actor, input.configKey);
    assertTimestamp(input.requestedAt, "CONFIG_ROLLBACK_PREVIEW");
    const reason = input.reason.trim();
    if (reason.length < 10)
      throw new Error("M42_CONFIG_ROLLBACK_REASON_REQUIRED");
    const current = this.#current(input.configKey);
    const target = this.#versions.find(
      (version) =>
        version.configKey === input.configKey &&
        version.versionId === input.targetVersionId,
    );
    const errors: string[] = [];
    if (!target) errors.push("M42_CONFIG_ROLLBACK_TARGET_UNKNOWN");
    if (target?.versionId === current.versionId)
      errors.push("M42_CONFIG_ROLLBACK_TARGET_IS_CURRENT");
    if (target)
      errors.push(...validateConfigurationValue(schema, target.value));
    const preview = this.#storePreview({
      previewId: this.#nextPreviewId(),
      action: "rollback",
      configKey: input.configKey,
      currentVersionId: current.versionId,
      currentValue: current.value,
      proposedValue: target?.value ?? current.value,
      rollbackTargetVersionId: target?.versionId ?? input.targetVersionId,
      requestedBy: actor.actorId,
      requestedByRole: actor.role,
      requestedAt: input.requestedAt,
      reason,
      valid: errors.length === 0,
      validationErrors: errors,
      approvalRequired: true,
      approvalRoles:
        schema.approvalRoles.length > 0
          ? schema.approvalRoles
          : ["managing-director", "administrator"],
      mutatesState: false,
      synthetic: true,
    });
    this.#recordAudit({
      eventType: "configuration_validated",
      actor,
      entityId: preview.previewId,
      correlationId: `${preview.previewId}-CORRELATION`,
      outcome: preview.valid ? "recorded" : "denied",
      reason: preview.valid
        ? "Rollback preview passed validation without replacing history."
        : `Rollback preview rejected: ${preview.validationErrors.join(", ")}`,
      occurredAt: input.requestedAt,
    });
    return preview;
  }

  approvePreview(
    approver: M42ActorContext,
    preview: M42ConfigurationPreview,
    input: { approvedAt: string; rationale: string },
  ): M42ConfigurationApproval {
    assertSyntheticActor(approver, "config_approval");
    assertTimestamp(input.approvedAt, "CONFIG_APPROVAL");
    const stored = this.#storedPreview(preview.previewId);
    this.#assertUntamperedPreview(preview, stored);
    if (!stored.valid)
      throw new Error("M42_CONFIG_INVALID_PREVIEW_CANNOT_APPROVE");
    if (!stored.approvalRequired)
      throw new Error("M42_CONFIG_APPROVAL_NOT_REQUIRED");
    if (stored.requestedBy === approver.actorId)
      throw new Error("M42_CONFIG_SELF_APPROVAL_DENIED");
    if (!stored.approvalRoles.includes(approver.role))
      throw new Error(`M42_CONFIG_APPROVER_ROLE_DENIED:${approver.role}`);
    if (!hasPermission(approver, CONFIG_APPROVE_PERMISSION))
      throw new Error("M42_CONFIG_APPROVE_PERMISSION_REQUIRED");
    const rationale = input.rationale.trim();
    if (rationale.length < 10)
      throw new Error("M42_CONFIG_APPROVAL_RATIONALE_REQUIRED");
    const approval = Object.freeze({
      approvalId: `${stored.previewId}-APPROVAL`,
      previewId: stored.previewId,
      approvedBy: approver.actorId,
      approvedByRole: approver.role,
      approvedAt: input.approvedAt,
      rationale,
      immutable: true as const,
      synthetic: true as const,
    });
    this.#approvals.push(approval);
    return approval;
  }

  applyPreview(
    actor: M42ActorContext,
    preview: M42ConfigurationPreview,
    appliedAt: string,
    approval: M42ConfigurationApproval | null = null,
  ): M42ConfigurationApplyResult {
    const schema = this.#authorizedSchema(actor, preview.configKey);
    assertTimestamp(appliedAt, "CONFIG_APPLY");
    const stored = this.#storedPreview(preview.previewId);
    this.#assertUntamperedPreview(preview, stored);
    if (stored.requestedBy !== actor.actorId)
      throw new Error("M42_CONFIG_PREVIEW_OWNER_REQUIRED");
    if (!stored.valid)
      throw new Error(
        `M42_CONFIG_PREVIEW_INVALID:${stored.validationErrors.join(",")}`,
      );
    const current = this.#current(stored.configKey);
    if (current.versionId !== stored.currentVersionId)
      throw new Error("M42_CONFIG_STALE_PREVIEW");
    const validationErrors = validateConfigurationValue(
      schema,
      stored.proposedValue,
    );
    if (validationErrors.length > 0)
      throw new Error(`M42_CONFIG_VALUE_INVALID:${validationErrors.join(",")}`);
    const verifiedApproval = this.#verifyApproval(stored, approval);
    const history = this.#versions.filter(
      (version) => version.configKey === stored.configKey,
    );
    const versionNumber = history.length + 1;
    const version = freezeVersion({
      versionId: `SYNTH-M42-CONFIG-${stored.configKey.split(".").join("-").toUpperCase()}-V${versionNumber}`,
      configKey: stored.configKey,
      version: versionNumber,
      previousVersionId: current.versionId,
      value: stored.proposedValue,
      changeType: stored.action === "rollback" ? "rollback" : "change",
      reason: stored.reason,
      changedBy: actor.actorId,
      changedByRole: actor.role,
      changedAt: appliedAt,
      approvedBy: verifiedApproval?.approvedBy ?? null,
      approvalId: verifiedApproval?.approvalId ?? null,
      rollbackTargetVersionId: stored.rollbackTargetVersionId,
      immutable: true,
      synthetic: true,
    });
    this.#versions.push(version);
    this.#recordAudit({
      eventType:
        stored.action === "rollback"
          ? "configuration_rolled_back"
          : "configuration_changed",
      actor,
      entityId: version.versionId,
      correlationId: `${stored.previewId}-CORRELATION`,
      outcome: "recorded",
      reason:
        stored.action === "rollback"
          ? `Rollback created append-only version ${version.version}; prior history was preserved.`
          : `Validated no-code change created append-only version ${version.version}.`,
      occurredAt: appliedAt,
    });
    const auditEvents = Object.freeze(
      this.#auditEvents.filter(
        (event) =>
          event.entityId === stored.previewId ||
          event.entityId === version.versionId,
      ),
    );
    return Object.freeze({
      preview: stored,
      version,
      approval: verifiedApproval,
      auditEvents,
      rollbackCreatedNewVersion: stored.action === "rollback",
      liveConnectorMutation: false,
      synthetic: true,
    });
  }

  snapshot(actor: M42ActorContext): M42ConfigurationSnapshot {
    assertSyntheticActor(actor, "config_audit");
    if (!hasPermission(actor, CONFIG_AUDIT_PERMISSION))
      throw new Error("M42_CONFIG_AUDIT_PERMISSION_REQUIRED");
    return Object.freeze({
      schemas: Object.freeze([...this.#schemas]),
      versions: Object.freeze([...this.#versions]),
      auditEvents: Object.freeze([...this.#auditEvents]),
      appendOnlyHistory: true,
      synthetic: true,
    });
  }

  assertLiveConnectorMutationUnavailable(): never {
    throw new Error("M42_LIVE_CONFIGURATION_MUTATION_UNAVAILABLE");
  }

  #authorizedSchema(
    actor: M42ActorContext,
    configKey: string,
  ): M42ConfigurationSchema {
    assertSyntheticActor(actor, "config");
    const schema = this.#schemas.find(
      (candidate) => candidate.configKey === configKey,
    );
    if (!schema) throw new Error(`M42_CONFIG_KEY_UNKNOWN:${configKey}`);
    if (!schema.allowedTiers.includes(actor.tier))
      throw new Error(
        `M42_CONFIG_TIER_ACCESS_DENIED:${actor.tier}:${configKey}`,
      );
    if (!hasPermission(actor, schema.requiredPermission))
      throw new Error(
        `M42_CONFIG_PERMISSION_REQUIRED:${schema.requiredPermission}`,
      );
    return schema;
  }

  #current(configKey: string): M42ConfigurationVersion {
    const history = this.#versions.filter(
      (version) => version.configKey === configKey,
    );
    const current = history[history.length - 1];
    if (!current) throw new Error(`M42_CONFIG_VALUE_MISSING:${configKey}`);
    return current;
  }

  #nextPreviewId(): string {
    return `SYNTH-M42-CONFIG-PREVIEW-${String(this.#previews.length + 1).padStart(4, "0")}`;
  }

  #storePreview(preview: M42ConfigurationPreview): M42ConfigurationPreview {
    const frozen = freezePreview(preview);
    this.#previews.push(frozen);
    return frozen;
  }

  #storedPreview(previewId: string): M42ConfigurationPreview {
    const preview = this.#previews.find(
      (candidate) => candidate.previewId === previewId,
    );
    if (!preview) throw new Error(`M42_CONFIG_PREVIEW_UNKNOWN:${previewId}`);
    return preview;
  }

  #assertUntamperedPreview(
    supplied: M42ConfigurationPreview,
    stored: M42ConfigurationPreview,
  ): void {
    if (JSON.stringify(supplied) !== JSON.stringify(stored))
      throw new Error("M42_CONFIG_PREVIEW_TAMPERED");
  }

  #verifyApproval(
    preview: M42ConfigurationPreview,
    supplied: M42ConfigurationApproval | null,
  ): M42ConfigurationApproval | null {
    if (!preview.approvalRequired) {
      if (supplied) throw new Error("M42_CONFIG_UNEXPECTED_APPROVAL");
      return null;
    }
    if (!supplied) throw new Error("M42_CONFIG_APPROVAL_REQUIRED");
    const stored = this.#approvals.find(
      (approval) => approval.approvalId === supplied.approvalId,
    );
    if (!stored || JSON.stringify(stored) !== JSON.stringify(supplied))
      throw new Error("M42_CONFIG_APPROVAL_INVALID");
    if (stored.previewId !== preview.previewId)
      throw new Error("M42_CONFIG_APPROVAL_PREVIEW_MISMATCH");
    return stored;
  }

  #recordAudit(input: {
    eventType: M42AuditEvent["eventType"];
    actor: M42ActorContext;
    entityId: string;
    correlationId: string;
    outcome: M42AuditEvent["outcome"];
    reason: string;
    occurredAt: string;
  }): void {
    this.#auditEvents.push(
      Object.freeze({
        eventId: `SYNTH-M42-CONFIG-AUDIT-${String(this.#auditEvents.length + 1).padStart(4, "0")}`,
        eventType: input.eventType,
        actorId: input.actor.actorId,
        actorRole: input.actor.role,
        entityType: "configuration" as const,
        entityId: input.entityId,
        correlationId: input.correlationId,
        sourceIds: Object.freeze([]),
        outcome: input.outcome,
        reason: input.reason,
        occurredAt: input.occurredAt,
        immutable: true as const,
        evidenceClass: M42_EVIDENCE_CLASS,
      }),
    );
  }
}

export function createSyntheticM42ConfigurationAdmin(): M42NoCodeConfigurationAdmin {
  return new M42NoCodeConfigurationAdmin();
}
