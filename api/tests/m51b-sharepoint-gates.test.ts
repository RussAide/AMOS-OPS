import { describe, expect, it } from "vitest";
import { M51A_CONNECTOR_MODE_OPERATION_MATRIX } from "@contracts/m51a/microsoft-connectors";
import type { M51aConnectorRegistryEntry } from "@contracts/m51a/microsoft-connectors";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import type { M51BSharePointWorkflowRequest } from "@contracts/m51b/sharepoint";
import { M51aStableObjectResolver } from "../services/m51a/connectors/stable-object-resolver";
import { createM51bSharePointScenarioFixtures } from "../services/m51b/sharepoint/fixtures";
import { evaluateM51bSharePointGates } from "../services/m51b/sharepoint/gates";

function evaluate(input: {
  request?: M51BSharePointWorkflowRequest;
  connector?: M51aConnectorRegistryEntry;
  item?: M51aMicrosoftItemSnapshot;
  externalGuest?: boolean;
}) {
  const fixture = createM51bSharePointScenarioFixtures();
  const connector = input.connector ?? fixture.connector;
  const item = input.item ?? fixture.initialTarget;
  const resolver = new M51aStableObjectResolver();
  resolver.bind(fixture.initialTarget, fixture.request.requestedAt);
  return evaluateM51bSharePointGates({
    request: input.request ?? fixture.request,
    connector,
    actor: {
      ...fixture.actor,
      externalGuest: input.externalGuest ?? fixture.actor.externalGuest,
    },
    item,
    resolver,
  });
}

function connectorForMode(
  mode: M51aConnectorRegistryEntry["connectorMode"],
): M51aConnectorRegistryEntry {
  const fixture = createM51bSharePointScenarioFixtures();
  const excluded = mode === "Excluded/System-Managed";
  const metadataOnly = mode === "Metadata-Only Restricted Reference";
  return {
    ...fixture.connector,
    connectorMode: mode,
    allowedOperations: M51A_CONNECTOR_MODE_OPERATION_MATRIX[mode],
    disposition: excluded ? "Exclude" : fixture.connector.disposition,
    status: excluded ? "excluded" : "active",
    intranetRoute: {
      ...fixture.connector.intranetRoute,
      visibility: excluded
        ? "excluded"
        : fixture.connector.intranetRoute.visibility,
    },
    sync: {
      ...fixture.connector.sync,
      method: excluded
        ? "excluded"
        : metadataOnly
          ? "synthetic_metadata_inventory"
          : "synthetic_delta",
      state: excluded ? "excluded" : metadataOnly ? "metadata_only" : "ready",
      cadence: excluded ? "none" : "event_plus_daily_reconciliation",
    },
  };
}

describe("M5.1B SharePoint governance gates", () => {
  it.each([
    "Permission-Trimmed Reference",
    "Metadata-Only Restricted Reference",
    "Excluded/System-Managed",
  ] as const)("denies content synchronization in %s mode", (mode) => {
    const decision = evaluate({ connector: connectorForMode(mode) });
    expect(decision.allowed).toBe(false);
    expect(decision.gates.connector_mode).toBe(false);
    expect(decision.accessDecision.allowed).toBe(false);
    expect(decision.accessDecision.reasonCodes).toContain(
      "M51A_CONNECTOR_MODE_DENY",
    );
    expect(decision.reasonCodes).toContain(
      "M51B_SHAREPOINT_CONNECTOR_MODE_DENY",
    );
  });

  it("denies an external guest before any SharePoint content disclosure or write", () => {
    const decision = evaluate({ externalGuest: true });
    expect(decision.allowed).toBe(false);
    expect(decision.gates.permission).toBe(false);
    expect(decision.accessDecision).toMatchObject({
      allowed: false,
      contentVisible: false,
      concealAsNotFound: true,
      liveExecutionAvailable: false,
    });
    expect(decision.accessDecision.reasonCodes).toContain(
      "M51A_EXTERNAL_GUEST_DENY",
    );
  });

  it("denies mismatched classification and sensitivity", () => {
    const fixture = createM51bSharePointScenarioFixtures();
    const request: M51BSharePointWorkflowRequest = {
      ...fixture.request,
      handlingClass: "confidential",
      sensitivityLabelRef: "SYNTH-M51B-UNAPPROVED-SENSITIVITY",
    };
    const decision = evaluate({ request });
    expect(decision.allowed).toBe(false);
    expect(decision.gates.classification).toBe(false);
    expect(decision.reasonCodes).toContain(
      "M51B_SHAREPOINT_CLASSIFICATION_DENY",
    );
  });

  it("denies a record lock or legal hold", () => {
    const fixture = createM51bSharePointScenarioFixtures();
    const item: M51aMicrosoftItemSnapshot = {
      ...fixture.initialTarget,
      retention: {
        ...fixture.initialTarget.retention,
        recordLocked: true,
        legalHoldIds: ["SYNTH-M51B-HOLD-001"],
      },
    };
    const decision = evaluate({ item });
    expect(decision.allowed).toBe(false);
    expect(decision.gates.retention).toBe(false);
    expect(decision.gates.permission).toBe(false);
    expect(decision.accessDecision.reasonCodes).toEqual(
      expect.arrayContaining([
        "M51A_RECORD_LOCK_WRITE_DENY",
        "M51A_LEGAL_HOLD_WRITE_DENY",
      ]),
    );
  });

  it("denies draft, unapproved, non-authoritative, or misrouted requests", () => {
    const fixture = createM51bSharePointScenarioFixtures();
    const decision = evaluate({
      request: {
        ...fixture.request,
        lifecycleState: "Draft",
        approvalState: "pending",
        sourceOfTruth: "Microsoft 365",
        routeCode: "clinical",
      } as unknown as M51BSharePointWorkflowRequest,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.gates.lifecycle).toBe(false);
    expect(decision.gates.approval).toBe(false);
    expect(decision.gates.source_of_truth).toBe(false);
    expect(decision.gates.intranet_route).toBe(false);
    expect(decision.publishingDecision.authoritativeGuidanceEligible).toBe(
      false,
    );
  });

  it("denies a stable object ID that cannot resolve to the SharePoint item", () => {
    const fixture = createM51bSharePointScenarioFixtures();
    const decision = evaluate({
      request: {
        ...fixture.request,
        stableObjectId: "SYNTH-AMOS-DMS-OBJECT-M51B-UNMAPPED-999",
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.gates.stable_identity).toBe(false);
    expect(decision.stableBindingId).toBeNull();
  });
});
