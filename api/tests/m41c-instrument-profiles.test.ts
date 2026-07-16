import { describe, expect, it } from "vitest";
import type { M41cValidationCheck } from "@contracts/m41c/governance";
import { createM41cSignedValidationRecord } from "../services/m41c/clinical-governance";
import { createSyntheticM41cClinicalKnowledgeRegistry } from "../services/m41c/clinical-knowledge-registry";
import {
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
} from "../services/m41c/competency-registry";
import {
  activateM41cInstrumentProfile,
  createSyntheticM41cInstrumentProfileRegistry,
  evaluateM41cSyntheticInstrumentStandin,
  quarantineM41cInstrumentProfile,
  validateM41cInstrumentProfile,
  verifyM41cTrRAndDfpsProfileSeparation,
} from "../services/m41c/instrument-profile-registry";

function instrumentUserGate() {
  return evaluateM41cCompetencyGate(createSyntheticM41cCompetencyRegistry(), {
    staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    staffRole: "clinical-director",
    requirementIds: Object.freeze(["M41C-COMP-SYNTHETIC-INSTRUMENT-USER"]),
  });
}

function validatedStandin() {
  const registry = createSyntheticM41cInstrumentProfileRegistry();
  const knowledge = createSyntheticM41cClinicalKnowledgeRegistry();
  const profile = registry.profiles.find(
    (candidate) => candidate.profileId === "SYNTH-M41C-INSTRUMENT-STANDIN",
  )!;
  const validation = validateM41cInstrumentProfile(profile, knowledge.sources);
  const checks: readonly M41cValidationCheck[] = Object.freeze(
    validation.checks.map((check) =>
      Object.freeze({
        checkId: check.checkId,
        label: check.checkId.replaceAll("_", " "),
        passed: check.passed,
        evidenceIds: check.evidenceIds,
        notes: check.notes,
      }),
    ),
  );
  const signedValidation = createM41cSignedValidationRecord({
    artifactId: profile.governanceArtifactId,
    artifactKind: "instrument",
    artifactVersion: profile.version,
    checks,
    competencyGate: instrumentUserGate(),
    sourceIds: profile.sourceIds,
    signatures: Object.freeze([
      Object.freeze({
        signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        signedByRole: "clinical-director" as const,
        signedAt: "2026-11-15T08:01:00.000Z",
        attestation:
          "The synthetic stand-in passed every pre-activation validation check.",
      }),
      Object.freeze({
        signedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
        signedByRole: "bhc-director" as const,
        signedAt: "2026-11-15T08:02:00.000Z",
        attestation:
          "The synthetic stand-in is approved only for bounded demo evaluation.",
      }),
    ]),
  });
  return { registry, knowledge, profile, validation, signedValidation };
}

describe("M4.1C governed instrument profiles", () => {
  it("keeps TRR CANS and DFPS CANS 3.0 strictly separated", () => {
    const registry = createSyntheticM41cInstrumentProfileRegistry();
    const result = verifyM41cTrRAndDfpsProfileSeparation(registry);
    expect(result).toMatchObject({
      trrProfileId: "M41C-INSTRUMENT-TRR-CANS",
      dfpsProfileId: "M41C-INSTRUMENT-DFPS-CANS-3",
      distinct: true,
      errors: [],
    });
    expect(result.differences).toEqual(
      expect.arrayContaining([
        "profile_id",
        "family",
        "purpose",
        "program_authority",
        "program_scope",
        "certification",
        "external_mapping",
      ]),
    );
  });

  it("keeps authoritative instrument placeholders metadata-only and non-activatable", () => {
    const registry = createSyntheticM41cInstrumentProfileRegistry();
    const knowledge = createSyntheticM41cClinicalKnowledgeRegistry();
    for (const profileId of [
      "M41C-INSTRUMENT-TRR-CANS",
      "M41C-INSTRUMENT-DFPS-CANS-3",
    ]) {
      const profile = registry.profiles.find(
        (candidate) => candidate.profileId === profileId,
      )!;
      const validation = validateM41cInstrumentProfile(
        profile,
        knowledge.sources,
      );
      expect(profile.contentBinding).toMatchObject({
        contentAvailable: false,
        contentHash: null,
        proprietaryContentStored: false,
      });
      expect(profile.scoringPolicy).toMatchObject({
        mode: "unavailable_metadata_only",
        totalScoreSeverityBandsPermitted: false,
        genericLevelOfCareMappingPermitted: false,
        autonomousLevelOfCarePermitted: false,
      });
      expect(validation.passed).toBe(false);
      expect(validation.eligibleForSyntheticDemoActivation).toBe(false);
      expect(validation.productionUseAuthorized).toBe(false);
      expect(validation.errors).toEqual(
        expect.arrayContaining([
          "VALIDATION_FAILED:exact_wording_validated",
          "VALIDATION_FAILED:response_options_validated",
          "VALIDATION_FAILED:scoring_logic_validated",
          "VALIDATION_FAILED:license_validated",
        ]),
      );
    }
  });

  it("quarantines inherited home-grown total-score and generic routing logic", () => {
    const registry = createSyntheticM41cInstrumentProfileRegistry();
    const legacy = registry.profiles.find(
      (profile) => profile.profileId === "LEGACY-M21-CANS-TOTAL-SCORE-ROUTING",
    );
    const quarantine = registry.quarantines.find(
      (record) => record.profileId === legacy?.profileId,
    );
    expect(legacy?.activationState).toBe("quarantined");
    expect(quarantine).toMatchObject({
      productionClinicalUseBlocked: true,
      syntheticDisplayOnly: true,
      immutable: true,
    });
    expect(quarantine?.reasonCodes).toEqual(
      expect.arrayContaining([
        "unapproved_scoring_logic",
        "homegrown_total_score_band",
        "generic_level_of_care_mapping",
      ]),
    );
    expect(quarantine?.detectedLogic).toEqual(
      expect.arrayContaining([
        "totalScore acuity bands",
        "generic level-of-care inference",
      ]),
    );
  });

  it("activates only a fully validated, council-signed, competency-gated synthetic stand-in", () => {
    const { registry, validation, signedValidation } = validatedStandin();
    expect(validation.checks).toHaveLength(13);
    expect(validation).toMatchObject({
      passed: true,
      eligibleForSyntheticDemoActivation: true,
      productionUseAuthorized: false,
      errors: [],
      warnings: [],
    });
    const activated = activateM41cInstrumentProfile(
      registry,
      validation.profileId,
      {
        target: "synthetic_demo",
        validation,
        signedValidation,
        competencyGate: instrumentUserGate(),
      },
    );
    expect(
      activated.profiles.find(
        (profile) => profile.profileId === validation.profileId,
      )?.activationState,
    ).toBe("demo_approved");

    const routine = evaluateM41cSyntheticInstrumentStandin(
      activated,
      validation.profileId,
      { "SYNTH-SIGNAL-A": "none", "SYNTH-SIGNAL-B": "present" },
    );
    const urgent = evaluateM41cSyntheticInstrumentStandin(
      activated,
      validation.profileId,
      { "SYNTH-SIGNAL-A": "urgent", "SYNTH-SIGNAL-B": "none" },
    );
    expect(routine).toMatchObject({
      safetyTriggered: false,
      routeToHumanReview: true,
      clinicalScore: null,
      diagnosis: null,
      levelOfCare: null,
      productionEffect: false,
    });
    expect(urgent.safetyTriggered).toBe(true);
    expect(
      evaluateM41cSyntheticInstrumentStandin(activated, validation.profileId, {
        "SYNTH-SIGNAL-A": "none",
        "SYNTH-SIGNAL-B": "present",
      }).evaluationId,
    ).toBe(routine.evaluationId);
  });

  it("denies production activation even when synthetic evidence is complete", () => {
    const { registry, validation, signedValidation } = validatedStandin();
    expect(() =>
      activateM41cInstrumentProfile(registry, validation.profileId, {
        target: "production",
        validation,
        signedValidation,
        competencyGate: instrumentUserGate(),
      }),
    ).toThrow("M41C_PRODUCTION_INSTRUMENT_ACTIVATION_UNAVAILABLE");
  });

  it("requires the exact profile competency rather than any passing gate", () => {
    const { registry, validation, signedValidation } = validatedStandin();
    const unrelatedGate = evaluateM41cCompetencyGate(
      createSyntheticM41cCompetencyRegistry(),
      {
        staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        staffRole: "clinical-director",
        requirementIds: ["M41C-COMP-GOVERNANCE-APPROVER"],
      },
    );
    expect(unrelatedGate.passedForSyntheticDemo).toBe(true);
    expect(() =>
      activateM41cInstrumentProfile(registry, validation.profileId, {
        target: "synthetic_demo",
        validation,
        signedValidation,
        competencyGate: unrelatedGate,
      }),
    ).toThrow("M41C_INSTRUMENT_COMPETENCY_GATE_REQUIRED");
  });

  it("denies activation after explicit quarantine", () => {
    const { registry, validation, signedValidation } = validatedStandin();
    const quarantined = quarantineM41cInstrumentProfile(
      registry,
      validation.profileId,
      {
        reasonCodes: Object.freeze(["profile_conflict"]),
        rationale:
          "Synthetic conflict introduced for deterministic boundary testing.",
        detectedLogic: Object.freeze(["conflicting synthetic profile version"]),
        quarantinedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        quarantinedByRole: "clinical-director",
        quarantinedAt: "2026-11-15T09:00:00.000Z",
        releaseRequirements: Object.freeze([
          "resolve profile conflict",
          "repeat council validation",
        ]),
      },
    );
    expect(() =>
      activateM41cInstrumentProfile(quarantined, validation.profileId, {
        target: "synthetic_demo",
        validation,
        signedValidation,
        competencyGate: instrumentUserGate(),
      }),
    ).toThrow("M41C_QUARANTINED_INSTRUMENT_ACTIVATION_DENIED");
  });

  it("blocks missing or invalid responses and any metadata-only evaluation", () => {
    const { registry, validation, signedValidation } = validatedStandin();
    const activated = activateM41cInstrumentProfile(
      registry,
      validation.profileId,
      {
        target: "synthetic_demo",
        validation,
        signedValidation,
        competencyGate: instrumentUserGate(),
      },
    );
    expect(() =>
      evaluateM41cSyntheticInstrumentStandin(activated, validation.profileId, {
        "SYNTH-SIGNAL-A": "none",
      }),
    ).toThrow("M41C_INSTRUMENT_RESPONSE_REQUIRED:SYNTH-SIGNAL-B");
    expect(() =>
      evaluateM41cSyntheticInstrumentStandin(activated, validation.profileId, {
        "SYNTH-SIGNAL-A": "invalid",
        "SYNTH-SIGNAL-B": "none",
      }),
    ).toThrow("M41C_INSTRUMENT_RESPONSE_INVALID:SYNTH-SIGNAL-A");
    expect(() =>
      evaluateM41cSyntheticInstrumentStandin(activated, validation.profileId, {
        "SYNTH-SIGNAL-A": "none",
        "SYNTH-SIGNAL-B": "present",
        "SYNTH-UNKNOWN-SIGNAL": "present",
      }),
    ).toThrow("M41C_INSTRUMENT_RESPONSE_ITEM_UNKNOWN:SYNTH-UNKNOWN-SIGNAL");
    expect(() =>
      evaluateM41cSyntheticInstrumentStandin(
        activated,
        "M41C-INSTRUMENT-TRR-CANS",
        {},
      ),
    ).toThrow("M41C_INSTRUMENT_NOT_APPROVED_FOR_SYNTHETIC_DEMO");
  });
});
