import { createHash } from "node:crypto";
import {
  M51A_EVALUATION_AS_OF,
  requireM51ASyntheticId,
} from "@contracts/m51a/shared";
import type {
  M51aMicrosoftItemAddress,
  M51aMicrosoftItemSnapshot,
  M51aStableBindingEvent,
  M51aStableBindingReason,
  M51aStableMappingValidationIssue,
  M51aStableObjectMapping,
} from "@contracts/m51a/stable-object-mapping";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function deterministicId(prefix: string, ...parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
  return `${prefix}-${digest}`;
}

function assertIso(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

export function m51aMicrosoftItemAddressKey(
  address: M51aMicrosoftItemAddress,
): string {
  return [address.tenantId, address.siteId, address.driveId, address.itemId].join(
    "::",
  );
}

function sameAddress(
  left: M51aMicrosoftItemAddress,
  right: M51aMicrosoftItemAddress,
): boolean {
  return m51aMicrosoftItemAddressKey(left) === m51aMicrosoftItemAddressKey(right);
}

function createBindingEvent(
  snapshot: M51aMicrosoftItemSnapshot,
  bindingVersion: number,
  reason: M51aStableBindingReason,
  observedAt: string,
  active: boolean,
): M51aStableBindingEvent {
  return frozen({
    bindingId: deterministicId(
      "SYNTH-M51A-BINDING",
      snapshot.stableObjectId,
      m51aMicrosoftItemAddressKey(snapshot.address),
      snapshot.eTag,
      observedAt,
      String(bindingVersion),
      reason,
    ),
    bindingVersion,
    stableObjectId: snapshot.stableObjectId,
    connectorId: snapshot.connectorId,
    address: frozen({ ...snapshot.address }),
    name: snapshot.name,
    path: snapshot.path,
    parentItemId: snapshot.parentItemId,
    eTag: snapshot.eTag,
    cTag: snapshot.cTag,
    versionId: snapshot.versionId,
    contentHash: snapshot.contentHash,
    metadataHash: snapshot.metadataHash,
    observedAt,
    effectiveAt: observedAt,
    supersededAt: active ? null : observedAt,
    reason,
    active,
    deleted: snapshot.deleted,
    synthetic: true,
  });
}

function currentBinding(
  mapping: M51aStableObjectMapping,
): M51aStableBindingEvent | null {
  if (mapping.currentBindingId === null) return null;
  return (
    mapping.bindingHistory.find(
      (binding) => binding.bindingId === mapping.currentBindingId,
    ) ?? null
  );
}

function observationReason(
  current: M51aStableBindingEvent,
  snapshot: M51aMicrosoftItemSnapshot,
): M51aStableBindingReason {
  if (!sameAddress(current.address, snapshot.address)) return "cross_drive_rebind";
  if (
    current.parentItemId !== snapshot.parentItemId ||
    (current.path !== snapshot.path && current.name === snapshot.name)
  ) {
    return "move_within_drive";
  }
  if (current.name !== snapshot.name) return "rename";
  return "metadata_refresh";
}

function noMaterialChange(
  current: M51aStableBindingEvent,
  snapshot: M51aMicrosoftItemSnapshot,
): boolean {
  return (
    sameAddress(current.address, snapshot.address) &&
    current.name === snapshot.name &&
    current.path === snapshot.path &&
    current.parentItemId === snapshot.parentItemId &&
    current.eTag === snapshot.eTag &&
    current.cTag === snapshot.cTag &&
    current.versionId === snapshot.versionId &&
    current.contentHash === snapshot.contentHash &&
    current.metadataHash === snapshot.metadataHash &&
    current.deleted === snapshot.deleted
  );
}

export function validateM51aStableObjectMappings(
  mappings: readonly M51aStableObjectMapping[],
): readonly M51aStableMappingValidationIssue[] {
  const issues: M51aStableMappingValidationIssue[] = [];
  const stableIds = new Set<string>();
  const activeAddresses = new Set<string>();

  for (const mapping of mappings) {
    if (stableIds.has(mapping.stableObjectId)) {
      issues.push(
        frozen({
          stableObjectId: mapping.stableObjectId,
          code: "M51A_DUPLICATE_STABLE_OBJECT_ID",
          message: "A Stable AMOS DMS Object ID may have only one mapping ledger.",
        }),
      );
    }
    stableIds.add(mapping.stableObjectId);
    const activeBindings = mapping.bindingHistory.filter((binding) => binding.active);
    if (
      mapping.status === "active" &&
      (activeBindings.length !== 1 ||
        activeBindings[0]?.bindingId !== mapping.currentBindingId)
    ) {
      issues.push(
        frozen({
          stableObjectId: mapping.stableObjectId,
          code: "M51A_ACTIVE_BINDING_CARDINALITY_INVALID",
          message: "An active mapping must have exactly one current binding.",
        }),
      );
    }
    if (
      mapping.status !== "active" &&
      (mapping.currentBindingId !== null || activeBindings.length !== 0)
    ) {
      issues.push(
        frozen({
          stableObjectId: mapping.stableObjectId,
          code: "M51A_INACTIVE_MAPPING_HAS_ACTIVE_BINDING",
          message: "Tombstoned or quarantined mappings cannot resolve an active item.",
        }),
      );
    }
    mapping.bindingHistory.forEach((binding, index) => {
      if (binding.bindingVersion !== index + 1) {
        issues.push(
          frozen({
            stableObjectId: mapping.stableObjectId,
            code: "M51A_BINDING_HISTORY_SEQUENCE_INVALID",
            message: "Binding history must be append-only and sequential.",
          }),
        );
      }
      if (binding.active) {
        const addressKey = m51aMicrosoftItemAddressKey(binding.address);
        if (activeAddresses.has(addressKey)) {
          issues.push(
            frozen({
              stableObjectId: mapping.stableObjectId,
              code: "M51A_MICROSOFT_ITEM_ACTIVE_BINDING_DUPLICATE",
              message: "A Microsoft item may resolve to only one active AMOS object.",
            }),
          );
        }
        activeAddresses.add(addressKey);
      }
    });
  }
  return frozen(issues);
}

export class M51aStableObjectResolver {
  readonly synthetic = true as const;
  readonly liveMicrosoftMutationAvailable = false as const;

  private readonly mappings = new Map<string, M51aStableObjectMapping>();
  private readonly activeByAddress = new Map<string, string>();

  bind(
    snapshot: M51aMicrosoftItemSnapshot,
    observedAt: string = M51A_EVALUATION_AS_OF,
  ): M51aStableObjectMapping {
    assertIso(observedAt, "M51A_BINDING_TIME_INVALID");
    requireM51ASyntheticId(snapshot.stableObjectId, "stable_object_id");
    requireM51ASyntheticId(snapshot.connectorId, "connector_id");
    requireM51ASyntheticId(snapshot.address.itemId, "microsoft_item_id");
    if (!snapshot.synthetic || snapshot.deleted) {
      throw new Error("M51A_ACTIVE_SYNTHETIC_ITEM_REQUIRED");
    }
    if (this.mappings.has(snapshot.stableObjectId)) {
      throw new Error("M51A_STABLE_OBJECT_ALREADY_BOUND");
    }
    const addressKey = m51aMicrosoftItemAddressKey(snapshot.address);
    if (this.activeByAddress.has(addressKey)) {
      throw new Error("M51A_MICROSOFT_ITEM_ALREADY_BOUND");
    }
    const binding = createBindingEvent(
      snapshot,
      1,
      "initial_bind",
      observedAt,
      true,
    );
    const mapping: M51aStableObjectMapping = frozen({
      stableObjectId: snapshot.stableObjectId,
      connectorId: snapshot.connectorId,
      currentBindingId: binding.bindingId,
      status: "active",
      sourceOfTruth: "AMOS-DMS",
      bindingHistory: frozen([binding]),
      createdAt: observedAt,
      updatedAt: observedAt,
      liveMicrosoftMutationAvailable: false,
      appendOnlyHistory: true,
      synthetic: true,
    });
    this.mappings.set(mapping.stableObjectId, mapping);
    this.activeByAddress.set(addressKey, mapping.stableObjectId);
    return mapping;
  }

  observe(
    stableObjectId: string,
    snapshot: M51aMicrosoftItemSnapshot,
    observedAt: string = M51A_EVALUATION_AS_OF,
  ): M51aStableObjectMapping {
    assertIso(observedAt, "M51A_OBSERVATION_TIME_INVALID");
    const mapping = this.get(stableObjectId);
    if (mapping.status === "quarantined") {
      throw new Error("M51A_QUARANTINED_MAPPING_CANNOT_REBIND");
    }
    if (snapshot.stableObjectId !== stableObjectId) {
      throw new Error("M51A_STABLE_OBJECT_ID_MISMATCH");
    }
    if (snapshot.deleted) return this.tombstone(stableObjectId, snapshot, observedAt);
    const current = currentBinding(mapping);
    if (current && noMaterialChange(current, snapshot)) return mapping;

    const newAddressKey = m51aMicrosoftItemAddressKey(snapshot.address);
    const occupiedBy = this.activeByAddress.get(newAddressKey);
    if (occupiedBy && occupiedBy !== stableObjectId) {
      throw new Error("M51A_MICROSOFT_ITEM_ALREADY_BOUND");
    }
    const reason = current
      ? observationReason(current, snapshot)
      : "cross_drive_rebind";
    const supersededHistory = mapping.bindingHistory.map((binding) =>
      binding.active
        ? frozen({ ...binding, active: false, supersededAt: observedAt })
        : binding,
    );
    const binding = createBindingEvent(
      snapshot,
      mapping.bindingHistory.length + 1,
      reason,
      observedAt,
      true,
    );
    if (current) {
      this.activeByAddress.delete(m51aMicrosoftItemAddressKey(current.address));
    }
    const updated: M51aStableObjectMapping = frozen({
      ...mapping,
      connectorId: snapshot.connectorId,
      currentBindingId: binding.bindingId,
      status: "active",
      bindingHistory: frozen([...supersededHistory, binding]),
      updatedAt: observedAt,
    });
    this.mappings.set(stableObjectId, updated);
    this.activeByAddress.set(newAddressKey, stableObjectId);
    return updated;
  }

  tombstone(
    stableObjectId: string,
    deletedSnapshot: M51aMicrosoftItemSnapshot,
    observedAt: string = M51A_EVALUATION_AS_OF,
  ): M51aStableObjectMapping {
    assertIso(observedAt, "M51A_TOMBSTONE_TIME_INVALID");
    if (!deletedSnapshot.deleted) {
      throw new Error("M51A_DELETED_ITEM_FACET_REQUIRED");
    }
    const mapping = this.get(stableObjectId);
    const current = currentBinding(mapping);
    if (!current) throw new Error("M51A_ACTIVE_BINDING_REQUIRED");
    if (!sameAddress(current.address, deletedSnapshot.address)) {
      throw new Error("M51A_TOMBSTONE_ADDRESS_MISMATCH");
    }
    const history = mapping.bindingHistory.map((binding) =>
      binding.active
        ? frozen({ ...binding, active: false, supersededAt: observedAt })
        : binding,
    );
    const tombstone = createBindingEvent(
      deletedSnapshot,
      mapping.bindingHistory.length + 1,
      "tombstone",
      observedAt,
      false,
    );
    this.activeByAddress.delete(m51aMicrosoftItemAddressKey(current.address));
    const updated: M51aStableObjectMapping = frozen({
      ...mapping,
      currentBindingId: null,
      status: "tombstoned",
      bindingHistory: frozen([...history, tombstone]),
      updatedAt: observedAt,
    });
    this.mappings.set(stableObjectId, updated);
    return updated;
  }

  quarantine(
    stableObjectId: string,
    observedAt: string = M51A_EVALUATION_AS_OF,
  ): M51aStableObjectMapping {
    assertIso(observedAt, "M51A_QUARANTINE_TIME_INVALID");
    const mapping = this.get(stableObjectId);
    const current = currentBinding(mapping);
    if (current) {
      this.activeByAddress.delete(m51aMicrosoftItemAddressKey(current.address));
    }
    const history = mapping.bindingHistory.map((binding) =>
      binding.active
        ? frozen({ ...binding, active: false, supersededAt: observedAt })
        : binding,
    );
    const updated: M51aStableObjectMapping = frozen({
      ...mapping,
      currentBindingId: null,
      status: "quarantined",
      bindingHistory: frozen(history),
      updatedAt: observedAt,
    });
    this.mappings.set(stableObjectId, updated);
    return updated;
  }

  get(stableObjectId: string): M51aStableObjectMapping {
    const mapping = this.mappings.get(stableObjectId);
    if (!mapping) throw new Error("M51A_STABLE_OBJECT_NOT_FOUND");
    return mapping;
  }

  resolve(stableObjectId: string): M51aStableBindingEvent {
    const mapping = this.get(stableObjectId);
    if (mapping.status !== "active") {
      throw new Error("M51A_STABLE_OBJECT_NOT_RESOLVABLE");
    }
    const binding = currentBinding(mapping);
    if (!binding) throw new Error("M51A_ACTIVE_BINDING_REQUIRED");
    return binding;
  }

  resolveByMicrosoftAddress(
    address: M51aMicrosoftItemAddress,
  ): M51aStableObjectMapping {
    const stableObjectId = this.activeByAddress.get(
      m51aMicrosoftItemAddressKey(address),
    );
    if (!stableObjectId) throw new Error("M51A_MICROSOFT_ITEM_NOT_MAPPED");
    return this.get(stableObjectId);
  }

  list(): readonly M51aStableObjectMapping[] {
    return frozen([...this.mappings.values()]);
  }

  validate(): readonly M51aStableMappingValidationIssue[] {
    return validateM51aStableObjectMappings(this.list());
  }
}
