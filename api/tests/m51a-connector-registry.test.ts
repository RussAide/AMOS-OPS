import { describe, expect, it } from "vitest";
import {
  M51A_CONNECTOR_MODES,
  M51A_CONNECTOR_MODE_OPERATION_MATRIX,
  M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS,
} from "@contracts/m51a/microsoft-connectors";
import { M51A_HANDLING_CLASS_CODES } from "@contracts/m51a/operations-hub";
import {
  M51aConnectorRegistry,
  validateM51aConnectorRegistry,
} from "../services/m51a/connectors/connector-registry";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";
import { SyntheticM51aMicrosoftAdapter } from "../services/m51a/connectors/synthetic-microsoft-adapter";

describe("M5.1A connector registry and four-mode architecture", () => {
  it("registers every deterministic repository exactly once with every required field", () => {
    const entries = createSyntheticM51aConnectorRegistryEntries();
    const registry = new M51aConnectorRegistry(entries);
    const completeness = registry.inventoryCompleteness();

    expect(entries).toHaveLength(9);
    expect(validateM51aConnectorRegistry(entries)).toEqual([]);
    expect(completeness).toMatchObject({
      repositoryCount: 9,
      registeredExactlyOnce: true,
      requiredFieldCount: 9 * M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS.length,
      completeFieldCount: 9 * M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS.length,
      liveCredentials: 0,
      liveConnections: 0,
      synthetic: true,
    });
    expect(completeness.representedModes).toEqual(M51A_CONNECTOR_MODES);
    for (const entry of entries) {
      for (const field of M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS) {
        expect(Object.hasOwn(entry, field)).toBe(true);
        expect(entry[field]).not.toBeUndefined();
      }
      expect(entry.credentialReference).toBeNull();
      expect(entry.liveTenantConnected).toBe(false);
      expect(entry.liveReadsAvailable).toBe(false);
      expect(entry.liveWritesAvailable).toBe(false);
    }
  });

  it("enforces the exact exclusive operation matrix for all four connector modes", () => {
    const registry = new M51aConnectorRegistry(
      createSyntheticM51aConnectorRegistryEntries(),
    );
    for (const mode of M51A_CONNECTOR_MODES) {
      const entries = registry.listByMode(mode);
      expect(entries.length).toBeGreaterThan(0);
      expect(
        entries.every(
          (entry) =>
            entry.connectorMode === mode &&
            entry.allowedOperations === M51A_CONNECTOR_MODE_OPERATION_MATRIX[mode],
        ),
      ).toBe(true);
    }
    expect(
      registry
        .listByMode("Metadata-Only Restricted Reference")
        .every(
          (entry) =>
            !entry.allowedOperations.includes("content_read") &&
            !entry.allowedOperations.includes("download") &&
            !entry.allowedOperations.includes("content_write"),
        ),
    ).toBe(true);
  });

  it("represents all six handling classes and forces system support libraries to Exclude", () => {
    const entries = createSyntheticM51aConnectorRegistryEntries();
    expect(
      [...new Set(entries.map((entry) => entry.handlingClass))].sort(),
    ).toEqual([...M51A_HANDLING_CLASS_CODES].sort());

    const excluded = entries.filter(
      (entry) => entry.repositoryKind === "system_managed_library",
    );
    expect(excluded.map((entry) => entry.displayName)).toEqual([
      "PersonalCacheLibrary",
      "HR365 Support Library",
    ]);
    expect(
      excluded.every(
        (entry) =>
          entry.connectorMode === "Excluded/System-Managed" &&
          entry.disposition === "Exclude" &&
          entry.status === "excluded" &&
          entry.intranetRoute.visibility === "excluded" &&
          entry.sync.method === "excluded",
      ),
    ).toBe(true);
  });

  it("detects duplicate repositories, mode drift, and an unexcluded system library", () => {
    const entries = createSyntheticM51aConnectorRegistryEntries();
    const duplicate = { ...entries[0] };
    const modeDrift = {
      ...entries[2],
      allowedOperations: ["discover_repository"] as const,
    };
    const systemDrift = {
      ...entries[7],
      connectorMode: "Permission-Trimmed Reference" as const,
      allowedOperations:
        M51A_CONNECTOR_MODE_OPERATION_MATRIX["Permission-Trimmed Reference"],
      disposition: "Retain" as const,
      status: "active" as const,
      intranetRoute: {
        ...entries[7].intranetRoute,
        visibility: "administrative_only" as const,
      },
      sync: {
        ...entries[7].sync,
        method: "synthetic_delta" as const,
        cadence: "daily" as const,
        state: "ready" as const,
      },
    };
    const issues = validateM51aConnectorRegistry(
      [...entries, duplicate, modeDrift, systemDrift],
      false,
    );
    expect(issues.map((candidate) => candidate.code)).toEqual(
      expect.arrayContaining([
        "M51A_REGISTRY_DUPLICATE_CONNECTOR_ID",
        "M51A_REGISTRY_DUPLICATE_REPOSITORY_ADDRESS",
        "M51A_REGISTRY_OPERATION_MATRIX_MISMATCH",
        "M51A_REGISTRY_SYSTEM_REPOSITORY_NOT_EXCLUDED",
      ]),
    );
  });

  it("exposes only deterministic synthetic data and blocks every live operation boundary", () => {
    const entries = createSyntheticM51aConnectorRegistryEntries();
    const adapter = new SyntheticM51aMicrosoftAdapter(
      entries,
      createSyntheticM51aMicrosoftItems(entries),
    );
    expect(() => adapter.assertLiveOperationProhibited("content_read")).toThrow(
      "M51A_LIVE_MICROSOFT_OPERATION_PROHIBITED",
    );
    expect(() => adapter.readProductionCredential()).toThrow(
      "M51A_PRODUCTION_SECRET_USE_PROHIBITED",
    );
    expect(adapter.metrics()).toMatchObject({
      liveGraphCalls: 0,
      liveWrites: 0,
      credentialReads: 0,
      blockedLiveOperations: 2,
    });
  });

  it("rejects incomplete sensitivity, routing, retention, sync, and exception governance", () => {
    const entries = createSyntheticM51aConnectorRegistryEntries();
    const corrupted = entries.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            sensitivityLabelRef: "",
            dlpPolicyRef: "",
            intranetRoute: { ...entry.intranetRoute, routePath: "" },
            retentionPolicy: {
              ...entry.retentionPolicy,
              scheduleCode: "",
            },
            sync: {
              ...entry.sync,
              method: "excluded" as const,
              state: "exception" as const,
              cadence: "manual" as const,
            },
            exceptionState: {
              status: "owner_review_required" as const,
              code: null,
              rationale: null,
            },
          }
        : entry,
    );
    const issues = validateM51aConnectorRegistry(corrupted);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "M51A_REGISTRY_GOVERNANCE_METADATA_INCOMPLETE",
        "M51A_REGISTRY_SYNC_STATE_INCONSISTENT",
        "M51A_REGISTRY_EXCEPTION_STATE_INCOMPLETE",
      ]),
    );
  });
});
