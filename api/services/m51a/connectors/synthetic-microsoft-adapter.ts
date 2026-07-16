import { createHash } from "node:crypto";
import type {
  M51aConnectorRegistryEntry,
  M51aConnectorOperation,
} from "@contracts/m51a/microsoft-connectors";
import type { M51aDeltaPage } from "@contracts/m51a/connector-reconciliation";
import type {
  M51aMicrosoftItemAddress,
  M51aMicrosoftItemSnapshot,
} from "@contracts/m51a/stable-object-mapping";
import { M51aConnectorRegistry } from "./connector-registry";
import { m51aMicrosoftItemAddressKey } from "./stable-object-resolver";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function nextVersionNumber(versionId: string): number {
  const match = /(?:-|V)(\d+)$/.exec(versionId);
  return match ? Number(match[1]) + 1 : 2;
}

function syntheticDigest(prefix: string, ...parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex");
  return `${prefix}:${digest}`;
}

export class M51aSyntheticMicrosoftError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryAfterMs: number | null;

  constructor(
    status: number | null,
    code: string,
    retryAfterMs: number | null = null,
  ) {
    super(code);
    this.name = "M51aSyntheticMicrosoftError";
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface M51aSyntheticAdapterMetrics {
  syntheticReads: number;
  syntheticMutations: number;
  blockedLiveOperations: number;
  liveGraphCalls: 0;
  liveWrites: 0;
  credentialReads: 0;
}

interface SyntheticMetadataPatch {
  name?: string;
  path?: string;
  parentItemId?: string;
  metadataSeed?: string;
}

export class SyntheticM51aMicrosoftAdapter {
  readonly adapterKind = "deterministic_synthetic_microsoft" as const;
  readonly liveGraphAvailable = false as const;
  readonly liveWriteAvailable = false as const;
  readonly credentialAccessAvailable = false as const;

  private readonly registry: M51aConnectorRegistry;
  private readonly itemsByAddress = new Map<string, M51aMicrosoftItemSnapshot>();
  private readonly addressByStableObject = new Map<string, string>();
  private readonly deltaPages = new Map<string, M51aDeltaPage>();
  private readonly deltaFailures = new Map<string, M51aSyntheticMicrosoftError>();
  private syntheticReads = 0;
  private syntheticMutations = 0;
  private blockedLiveOperations = 0;

  constructor(
    repositories: readonly M51aConnectorRegistryEntry[],
    items: readonly M51aMicrosoftItemSnapshot[],
  ) {
    this.registry = new M51aConnectorRegistry(repositories);
    for (const item of items) {
      const connector = this.registry.get(item.connectorId);
      if (connector.connectorMode === "Excluded/System-Managed") {
        throw new Error("M51A_EXCLUDED_REPOSITORY_ITEM_FIXTURE_PROHIBITED");
      }
      if (
        item.address.tenantId !== connector.location.tenantId ||
        item.address.siteId !== connector.location.siteId ||
        item.address.driveId !== connector.location.driveId
      ) {
        throw new Error("M51A_SYNTHETIC_ITEM_REPOSITORY_ADDRESS_MISMATCH");
      }
      const addressKey = m51aMicrosoftItemAddressKey(item.address);
      if (this.itemsByAddress.has(addressKey)) {
        throw new Error("M51A_SYNTHETIC_ITEM_ADDRESS_DUPLICATE");
      }
      if (this.addressByStableObject.has(item.stableObjectId)) {
        throw new Error("M51A_SYNTHETIC_STABLE_OBJECT_DUPLICATE");
      }
      this.itemsByAddress.set(addressKey, item);
      this.addressByStableObject.set(item.stableObjectId, addressKey);
    }
  }

  getRepository(connectorId: string): M51aConnectorRegistryEntry {
    this.syntheticReads += 1;
    return this.registry.get(connectorId);
  }

  listRepositories(): readonly M51aConnectorRegistryEntry[] {
    this.syntheticReads += 1;
    return this.registry.list();
  }

  listItems(connectorId: string): readonly M51aMicrosoftItemSnapshot[] {
    const connector = this.registry.get(connectorId);
    if (connector.connectorMode === "Excluded/System-Managed") {
      throw new M51aSyntheticMicrosoftError(
        403,
        "M51A_EXCLUDED_REPOSITORY_CONTENT_READ_PROHIBITED",
      );
    }
    this.syntheticReads += 1;
    return frozen(
      [...this.itemsByAddress.values()]
        .filter((item) => item.connectorId === connectorId && !item.deleted)
        .sort((left, right) =>
          left.stableObjectId.localeCompare(right.stableObjectId),
        ),
    );
  }

  getItem(address: M51aMicrosoftItemAddress): M51aMicrosoftItemSnapshot {
    this.syntheticReads += 1;
    const item = this.itemsByAddress.get(m51aMicrosoftItemAddressKey(address));
    if (!item || item.deleted) {
      throw new M51aSyntheticMicrosoftError(404, "M51A_SYNTHETIC_ITEM_NOT_FOUND");
    }
    return item;
  }

  getItemByStableObject(stableObjectId: string): M51aMicrosoftItemSnapshot {
    const addressKey = this.addressByStableObject.get(stableObjectId);
    if (!addressKey) {
      throw new M51aSyntheticMicrosoftError(404, "M51A_SYNTHETIC_ITEM_NOT_FOUND");
    }
    this.syntheticReads += 1;
    const item = this.itemsByAddress.get(addressKey);
    if (!item || item.deleted) {
      throw new M51aSyntheticMicrosoftError(404, "M51A_SYNTHETIC_ITEM_NOT_FOUND");
    }
    return item;
  }

  applySyntheticMetadataPatch(input: {
    stableObjectId: string;
    expectedETag: string;
    patch: SyntheticMetadataPatch;
    modifiedAt: string;
  }): M51aMicrosoftItemSnapshot {
    const current = this.getItemByStableObject(input.stableObjectId);
    const connector = this.registry.get(current.connectorId);
    if (!connector.allowedOperations.includes("metadata_write")) {
      throw new M51aSyntheticMicrosoftError(
        403,
        "M51A_CONNECTOR_MODE_METADATA_WRITE_DENY",
      );
    }
    if (current.eTag !== input.expectedETag) {
      throw new M51aSyntheticMicrosoftError(
        412,
        "M51A_ETAG_PRECONDITION_FAILED",
      );
    }
    if (
      current.retention.recordLocked ||
      current.retention.legalHoldIds.length > 0
    ) {
      throw new M51aSyntheticMicrosoftError(
        423,
        "M51A_RETENTION_OR_LEGAL_HOLD_WRITE_DENY",
      );
    }
    if (!Number.isFinite(Date.parse(input.modifiedAt))) {
      throw new Error("M51A_SYNTHETIC_MODIFIED_TIME_INVALID");
    }
    const version = nextVersionNumber(current.versionId);
    const name = input.patch.name ?? current.name;
    const parentItemId = input.patch.parentItemId ?? current.parentItemId;
    const path = input.patch.path ?? current.path;
    const metadataSeed =
      input.patch.metadataSeed ?? `${name}|${path}|${parentItemId}`;
    const updated: M51aMicrosoftItemSnapshot = frozen({
      ...current,
      name,
      path,
      parentItemId,
      eTag: `"SYNTH-ETAG-${current.address.itemId}-V${version}"`,
      cTag: current.cTag,
      versionId: `SYNTH-VERSION-${current.address.itemId}-${version}`,
      metadataHash: syntheticDigest(
        "sha256",
        current.stableObjectId,
        metadataSeed,
        input.modifiedAt,
      ),
      lastModifiedAt: input.modifiedAt,
    });
    this.replaceItem(current, updated);
    return updated;
  }

  applySyntheticContentUpdate(input: {
    stableObjectId: string;
    expectedETag: string;
    contentHash: string;
    modifiedAt: string;
  }): M51aMicrosoftItemSnapshot {
    const current = this.getItemByStableObject(input.stableObjectId);
    const connector = this.registry.get(current.connectorId);
    if (!connector.allowedOperations.includes("content_write")) {
      throw new M51aSyntheticMicrosoftError(
        403,
        "M51A_CONNECTOR_MODE_CONTENT_WRITE_DENY",
      );
    }
    if (current.eTag !== input.expectedETag) {
      throw new M51aSyntheticMicrosoftError(
        412,
        "M51A_ETAG_PRECONDITION_FAILED",
      );
    }
    if (
      current.retention.recordLocked ||
      current.retention.legalHoldIds.length > 0
    ) {
      throw new M51aSyntheticMicrosoftError(
        423,
        "M51A_RETENTION_OR_LEGAL_HOLD_WRITE_DENY",
      );
    }
    if (!/^sha256:[a-z0-9-]{12,}$/i.test(input.contentHash)) {
      throw new Error("M51A_SYNTHETIC_CONTENT_HASH_INVALID");
    }
    const version = nextVersionNumber(current.versionId);
    const updated: M51aMicrosoftItemSnapshot = frozen({
      ...current,
      eTag: `"SYNTH-ETAG-${current.address.itemId}-V${version}"`,
      cTag: `"SYNTH-CTAG-${current.address.itemId}-V${version}"`,
      versionId: `SYNTH-VERSION-${current.address.itemId}-${version}`,
      contentHash: input.contentHash,
      lastModifiedAt: input.modifiedAt,
    });
    this.replaceItem(current, updated);
    return updated;
  }

  configureDeltaPages(
    connectorId: string,
    pages: readonly M51aDeltaPage[],
  ): void {
    this.registry.get(connectorId);
    for (const page of pages) {
      if (page.connectorId !== connectorId || !page.synthetic) {
        throw new Error("M51A_DELTA_PAGE_CONNECTOR_MISMATCH");
      }
      const key = this.deltaKey(connectorId, page.cursor);
      if (this.deltaPages.has(key)) throw new Error("M51A_DELTA_CURSOR_DUPLICATE");
      this.deltaPages.set(key, page);
    }
  }

  configureDeltaFailure(
    connectorId: string,
    cursor: string | null,
    error: M51aSyntheticMicrosoftError,
  ): void {
    this.registry.get(connectorId);
    this.deltaFailures.set(this.deltaKey(connectorId, cursor), error);
  }

  fetchDeltaPage(
    connectorId: string,
    cursor: string | null,
  ): M51aDeltaPage {
    const key = this.deltaKey(connectorId, cursor);
    const error = this.deltaFailures.get(key);
    if (error) throw error;
    const page = this.deltaPages.get(key);
    if (!page) {
      throw new M51aSyntheticMicrosoftError(410, "M51A_DELTA_TOKEN_EXPIRED");
    }
    this.syntheticReads += 1;
    return page;
  }

  assertLiveOperationProhibited(
    operation: M51aConnectorOperation,
  ): never {
    this.blockedLiveOperations += 1;
    throw new Error(`M51A_LIVE_MICROSOFT_OPERATION_PROHIBITED:${operation}`);
  }

  readProductionCredential(): never {
    this.blockedLiveOperations += 1;
    throw new Error("M51A_PRODUCTION_SECRET_USE_PROHIBITED");
  }

  metrics(): M51aSyntheticAdapterMetrics {
    return frozen({
      syntheticReads: this.syntheticReads,
      syntheticMutations: this.syntheticMutations,
      blockedLiveOperations: this.blockedLiveOperations,
      liveGraphCalls: 0,
      liveWrites: 0,
      credentialReads: 0,
    });
  }

  private replaceItem(
    previous: M51aMicrosoftItemSnapshot,
    updated: M51aMicrosoftItemSnapshot,
  ): void {
    const previousKey = m51aMicrosoftItemAddressKey(previous.address);
    const updatedKey = m51aMicrosoftItemAddressKey(updated.address);
    if (previousKey !== updatedKey) this.itemsByAddress.delete(previousKey);
    this.itemsByAddress.set(updatedKey, updated);
    this.addressByStableObject.set(updated.stableObjectId, updatedKey);
    this.syntheticMutations += 1;
  }

  private deltaKey(connectorId: string, cursor: string | null): string {
    return `${connectorId}::${cursor ?? "__INITIAL__"}`;
  }
}
