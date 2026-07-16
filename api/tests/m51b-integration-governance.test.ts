import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  M51B_LEAST_PRIVILEGE_SCOPES,
  M51B_REQUIRED_CHANNELS,
} from "@contracts/m51b/integration-governance";
import {
  createSyntheticM51BIntegrationContracts,
  createSyntheticM51BPrivacyThreatControls,
  evaluateM51BIntegrationGovernance,
  validateM51BIntegrationContracts,
} from "../services/m51b/integration/governance";
import { verifyM51BInheritedM51ABaseline } from "../services/m51b/integration/inherited-baseline";

describe("M5.1B inherited baseline and integration governance", () => {
  it("re-executes the accepted M5.1A baseline before workflow automation", async () => {
    const result = await verifyM51BInheritedM51ABaseline();
    expect(result).toMatchObject({
      milestone: "M5.1A",
      criteriaPassed: 8,
      criteriaExpected: 8,
      connectorModeMismatches: 0,
      stableIdentityIssues: 0,
      securityViolations: 0,
      productionRows: 0,
      liveMicrosoftWrites: 0,
      artifactVerification: {
        artifactsAvailable: true,
        acceptedManifestVerified: true,
      },
      accepted: true,
      synthetic: true,
    });
    expect(result.acceptanceIds).toEqual([
      "M5.1A-AC-01",
      "M5.1A-AC-02",
      "M5.1A-AC-03",
      "M5.1A-AC-04",
      "M5.1A-AC-05",
      "M5.1A-AC-06",
      "M5.1A-AC-07",
      "M5.1A-AC-08",
    ]);
  });

  it("uses the hash-pinned accepted manifest in a standalone deployment", async () => {
    const result = await verifyM51BInheritedM51ABaseline({
      milestoneWorkRoot: "/tmp/amos-ops-m51b-standalone-deployment",
      acceptedManifestRoot: path.resolve(process.cwd(), "accepted-baselines"),
    });
    expect(result.accepted).toBe(true);
    expect(result.artifactVerification).toEqual({
      artifactsAvailable: true,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      acceptedManifestVerified: true,
      verificationBasis: "accepted-manifest",
    });
  });

  it("defines exactly one complete contract for every required channel", () => {
    const contracts = createSyntheticM51BIntegrationContracts();
    expect(contracts.map((contract) => contract.channel)).toEqual(
      M51B_REQUIRED_CHANNELS,
    );
    expect(validateM51BIntegrationContracts(contracts)).toEqual([]);
    const result = evaluateM51BIntegrationGovernance(contracts);
    expect(result).toMatchObject({
      accepted: true,
      synthetic: true,
      totals: {
        contracts: 3,
        requiredChannels: 3,
        leastPrivilegeScopes: 9,
        accessReviews: 3,
        privacyThreatControls: 4,
        liveCredentials: 0,
        liveConsentMutations: 0,
        productionRows: 0,
        liveWrites: 0,
      },
    });
  });

  it("enforces the exact least-privilege scope matrix", () => {
    for (const contract of createSyntheticM51BIntegrationContracts())
      expect(contract.leastPrivilegeScopes).toEqual(
        M51B_LEAST_PRIVILEGE_SCOPES[contract.channel],
      );
  });

  it("enforces the exact stable AMOS object-ID matrix and rejects every drift", () => {
    const contracts = createSyntheticM51BIntegrationContracts();
    expect(
      Object.fromEntries(
        contracts.map((contract) => [
          contract.channel,
          contract.identity.stableAmosObjectIdRequired,
        ]),
      ),
    ).toEqual({ teams: false, outlook: true, sharepoint: true });

    for (const [channel, expectedError] of [
      ["teams", "M51B_CONTRACT_TEAMS_STABLE_AMOS_OBJECT_ID_MUST_BE_FALSE"],
      ["outlook", "M51B_CONTRACT_OUTLOOK_STABLE_AMOS_OBJECT_ID_REQUIRED"],
      ["sharepoint", "M51B_CONTRACT_SHAREPOINT_STABLE_AMOS_OBJECT_ID_REQUIRED"],
    ] as const) {
      const corrupted = contracts.map((contract) =>
        contract.channel === channel
          ? {
              ...contract,
              identity: {
                ...contract.identity,
                stableAmosObjectIdRequired:
                  !contract.identity.stableAmosObjectIdRequired,
              },
            }
          : contract,
      );
      expect(validateM51BIntegrationContracts(corrupted)).toContain(
        expectedError,
      );
      expect(evaluateM51BIntegrationGovernance(corrupted)).toMatchObject({
        accepted: false,
        validationErrors: expect.arrayContaining([expectedError]),
      });
    }
  });

  it("uses managed references without exposing credentials or live consent", () => {
    for (const contract of createSyntheticM51BIntegrationContracts()) {
      expect(contract.managedSecretReference).toMatch(
        /^vault-ref:\/\/synthetic\/m51b\//,
      );
      expect(contract.secretMaterialPresent).toBe(false);
      expect(contract.productionCredentialReadAvailable).toBe(false);
      expect(contract.consent.liveConsentGranted).toBe(false);
      expect(contract.liveConsentMutationAvailable).toBe(false);
      expect(contract.accessReview).toMatchObject({
        cadence: "quarterly",
        leastPrivilegeConfirmed: true,
        exceptions: [],
      });
    }
  });

  it("records the approved privacy and threat controls", () => {
    const controls = createSyntheticM51BPrivacyThreatControls();
    expect(controls).toHaveLength(4);
    expect(controls.map((control) => control.channel)).toEqual([
      "teams",
      "outlook",
      "sharepoint",
      "integration",
    ]);
    expect(
      controls.every(
        (control) =>
          control.approved &&
          control.residualRisk === "low" &&
          control.controls.length >= 4,
      ),
    ).toBe(true);
  });

  it("fails closed on tenant, permission, credential, consent, owner, review, and retry drift", () => {
    const contracts = createSyntheticM51BIntegrationContracts();
    const corrupted = contracts.map((contract, index) =>
      index === 0
        ? {
            ...contract,
            tenantBoundary: "SYNTHETIC-UNAPPROVED-TENANT" as never,
            leastPrivilegeScopes: [
              ...contract.leastPrivilegeScopes,
              "teams.unbounded.admin",
            ],
            managedSecretReference: "client_secret=not-allowed",
            secretMaterialPresent: true as never,
            liveConsentMutationAvailable: true as never,
            consent: {
              ...contract.consent,
              bypassAvailable: true as never,
              liveConsentGranted: true as never,
            },
            support: {
              ...contract.support,
              workflowOwnerRole: "unknown-role" as never,
            },
            accessReview: {
              ...contract.accessReview,
              nextReviewDueAt: "2026-07-01T11:59:59.000Z",
              leastPrivilegeConfirmed: false as never,
            },
            retry: {
              ...contract.retry,
              maximumAttempts: 99 as never,
              deadLetterRequired: false as never,
            },
          }
        : contract,
    );
    expect(validateM51BIntegrationContracts(corrupted)).toEqual(
      expect.arrayContaining([
        "M51B_CONTRACT_TEAMS_TENANT_BOUNDARY_DENIED",
        "M51B_CONTRACT_TEAMS_LEAST_PRIVILEGE_SCOPE_DRIFT",
        "M51B_CONTRACT_TEAMS_MANAGED_SECRET_BOUNDARY_INVALID",
        "M51B_CONTRACT_TEAMS_PRIVACY_OR_CONSENT_CONTROL_INVALID",
        "M51B_CONTRACT_TEAMS_CANONICAL_OWNER_REQUIRED",
        "M51B_CONTRACT_TEAMS_ACCESS_REVIEW_INVALID",
        "M51B_CONTRACT_TEAMS_RETRY_IDEMPOTENCY_SUPPORT_INVALID",
      ]),
    );
  });

  it("replays deterministically", () => {
    expect(evaluateM51BIntegrationGovernance()).toEqual(
      evaluateM51BIntegrationGovernance(),
    );
  });
});
