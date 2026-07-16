import { describe, expect, it } from "vitest";
import type { M51aConnectorActorContext } from "@contracts/m51a/microsoft-connectors";
import { evaluateM51aConnectorAccess } from "../services/m51a/connectors/connector-policy";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";

function actor(
  overrides: Partial<M51aConnectorActorContext> = {},
): M51aConnectorActorContext {
  return {
    actorId: "SYNTH-ACTOR-ACCESS-TEST",
    role: "managing-director",
    roleTier: "T1",
    divisions: ["enterprise"],
    amosPermissions: [
      "dms.connector.discover",
      "dms.connector.read",
      "dms.handling.internal_controlled",
    ],
    purposeOfUse: "operations",
    tenantId: "SYNTH-TENANT-ADOLBI",
    microsoftPrincipalId: "SYNTH-PRINCIPAL-ACCESS-TEST",
    microsoftGroupIds: ["SYNTH-GROUP-ENTERPRISE-OPS"],
    graphScopes: ["Sites.Read.All"],
    part2ConsentId: null,
    enterpriseEntitlements: [],
    externalGuest: false,
    synthetic: true,
    ...overrides,
  };
}

describe("M5.1A AMOS plus Microsoft plus mode plus sensitivity intersection", () => {
  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  const repository = (connectorId: string) =>
    repositories.find((candidate) => candidate.connectorId === connectorId)!;
  const item = (stableObjectId: string) =>
    items.find((candidate) => candidate.stableObjectId === stableObjectId)!;

  it("allows a fully intersected governed read and exposes no live execution capability", () => {
    const decision = evaluateM51aConnectorAccess(
      repository("SYNTH-CONNECTOR-GOVERNANCE"),
      actor(),
      "content_read",
      item("SYNTH-AMOS-OBJECT-GOVERNANCE-001"),
    );
    expect(decision).toMatchObject({
      allowed: true,
      metadataVisible: true,
      contentVisible: true,
      downloadable: false,
      concealAsNotFound: false,
      architectureOperationAllowed: true,
      liveExecutionAvailable: false,
      reasonCodes: [],
    });
  });

  it("proves that an enterprise T1 role is not a universal Microsoft-content bypass", () => {
    const decision = evaluateM51aConnectorAccess(
      repository("SYNTH-CONNECTOR-GOVERNANCE"),
      actor({
        amosPermissions: [],
        microsoftGroupIds: [],
        graphScopes: [],
      }),
      "metadata_read",
      item("SYNTH-AMOS-OBJECT-GOVERNANCE-001"),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.metadataVisible).toBe(false);
    expect(decision.contentVisible).toBe(false);
    expect(decision.concealAsNotFound).toBe(true);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51A_GRAPH_SCOPE_REQUIRED",
        "M51A_AMOS_CONNECTOR_PERMISSION_REQUIRED",
        "M51A_AMOS_HANDLING_PERMISSION_REQUIRED",
        "M51A_MICROSOFT_REPOSITORY_ACL_DENY",
        "M51A_MICROSOFT_ITEM_ACL_DENY",
      ]),
    );
  });

  it("permits clinical metadata but never body or download in metadata-only mode", () => {
    const clinicalActor = actor({
      role: "therapist",
      roleTier: "T4",
      divisions: ["bhc"],
      amosPermissions: [
        "dms.connector.read",
        "dms.handling.restricted_clinical",
      ],
      purposeOfUse: "treatment",
      microsoftGroupIds: ["SYNTH-GROUP-BHC-CLINICAL"],
    });
    const connector = repository("SYNTH-CONNECTOR-CLINICAL");
    const clinicalItem = item("SYNTH-AMOS-OBJECT-CLINICAL-001");
    const metadata = evaluateM51aConnectorAccess(
      connector,
      clinicalActor,
      "metadata_read",
      clinicalItem,
    );
    const content = evaluateM51aConnectorAccess(
      connector,
      clinicalActor,
      "content_read",
      clinicalItem,
    );
    const download = evaluateM51aConnectorAccess(
      connector,
      clinicalActor,
      "download",
      clinicalItem,
    );
    expect(metadata).toMatchObject({
      allowed: true,
      metadataVisible: true,
      contentVisible: false,
    });
    expect(content).toMatchObject({
      allowed: false,
      metadataVisible: false,
      contentVisible: false,
      concealAsNotFound: true,
    });
    expect(content.reasonCodes).toContain("M51A_CONNECTOR_MODE_DENY");
    expect(download.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51A_CONNECTOR_MODE_DENY",
        "M51A_HANDLING_CLASS_DOWNLOAD_DENY",
      ]),
    );
  });

  it("requires Part 2 consent authorization in addition to role, purpose, ACL, and scope", () => {
    const connector = repository("SYNTH-CONNECTOR-PART2");
    const part2Item = item("SYNTH-AMOS-OBJECT-PART2-001");
    const part2Actor = actor({
      role: "clinical-director",
      roleTier: "T2",
      divisions: ["bhc", "eo"],
      amosPermissions: [
        "dms.connector.read",
        "dms.handling.restricted_part2",
      ],
      purposeOfUse: "treatment",
      microsoftGroupIds: ["SYNTH-GROUP-PART2-AUTHORIZED"],
    });
    const denied = evaluateM51aConnectorAccess(
      connector,
      part2Actor,
      "metadata_read",
      part2Item,
    );
    const allowed = evaluateM51aConnectorAccess(
      connector,
      {
        ...part2Actor,
        part2ConsentId: "SYNTH-CONSENT-PART2-001",
        enterpriseEntitlements: ["part2.consent_authorized"],
      },
      "metadata_read",
      part2Item,
    );
    expect(denied.allowed).toBe(false);
    expect(denied.reasonCodes).toContain(
      "M51A_PART2_CONSENT_AUTHORIZATION_REQUIRED",
    );
    expect(denied.concealAsNotFound).toBe(true);
    expect(allowed.allowed).toBe(true);
    expect(allowed.metadataVisible).toBe(true);
    expect(allowed.contentVisible).toBe(false);
  });

  it("applies the most restrictive repository-or-item handling class", () => {
    const decision = evaluateM51aConnectorAccess(
      repository("SYNTH-CONNECTOR-GOVERNANCE"),
      actor(),
      "metadata_read",
      {
        ...item("SYNTH-AMOS-OBJECT-GOVERNANCE-001"),
        handlingClass: "restricted-sud-part2",
      },
    );
    expect(decision.effectiveHandlingClass).toBe("restricted-sud-part2");
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51A_AMOS_HANDLING_PERMISSION_REQUIRED",
        "M51A_PART2_CONSENT_AUTHORIZATION_REQUIRED",
      ]),
    );
  });

  it("fails closed on record locks, legal holds, and unexpired retention", () => {
    const baseConnector = repository("SYNTH-CONNECTOR-GOVERNANCE");
    const writePermissions = {
      ...baseConnector.permissionModel.repositoryPermissions,
      grants: [
        {
          principalType: "group" as const,
          principalId: "SYNTH-GROUP-ENTERPRISE-OPS",
          roles: ["read", "write"] as const,
          inherited: true,
        },
      ],
    };
    const connector = {
      ...baseConnector,
      permissionModel: {
        ...baseConnector.permissionModel,
        repositoryPermissions: writePermissions,
      },
    };
    const governedItem = {
      ...item("SYNTH-AMOS-OBJECT-GOVERNANCE-001"),
      permissions: writePermissions,
      retention: {
        ...item("SYNTH-AMOS-OBJECT-GOVERNANCE-001").retention,
        legalHoldIds: ["SYNTH-HOLD-GOVERNANCE-001"],
        recordLocked: true,
        dispositionAllowed: false,
        retentionUntil: "2036-07-15T00:00:00.000Z",
      },
    };
    const decision = evaluateM51aConnectorAccess(
      connector,
      actor({
        amosPermissions: [
          "dms.connector.write",
          "dms.handling.internal_controlled",
        ],
        graphScopes: ["Sites.ReadWrite.All"],
      }),
      "delete",
      governedItem,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51A_RECORD_LOCK_WRITE_DENY",
        "M51A_LEGAL_HOLD_WRITE_DENY",
        "M51A_RETENTION_DISPOSITION_DENY",
      ]),
    );
    expect(decision.liveExecutionAvailable).toBe(false);
  });

  it("denies external guests without revealing repository or item metadata", () => {
    const decision = evaluateM51aConnectorAccess(
      repository("SYNTH-CONNECTOR-PUBLISHED"),
      actor({
        amosPermissions: ["dms.connector.read"],
        microsoftGroupIds: ["SYNTH-GROUP-ALL-STAFF"],
        externalGuest: true,
      }),
      "metadata_read",
      item("SYNTH-AMOS-OBJECT-PUBLISHED-001"),
    );
    expect(decision).toMatchObject({
      allowed: false,
      metadataVisible: false,
      contentVisible: false,
      concealAsNotFound: true,
    });
    expect(decision.reasonCodes).toContain("M51A_EXTERNAL_GUEST_DENY");
  });
});
