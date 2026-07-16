import { describe, expect, it } from "vitest";
import {
  assertM41cProductionKnowledgeActivationUnavailable,
  assertM41cRegistryEntryCanDriveSyntheticDemo,
  createSyntheticM41cClinicalKnowledgeRegistry,
  exportM41cClinicalKnowledgeRegistry,
  registerM41cClinicalSource,
  validateM41cRegistryEntry,
} from "../services/m41c/clinical-knowledge-registry";

describe("M4.1C versioned clinical knowledge registry", () => {
  it("exports deterministic full metadata, five cadences, tests, and human gates", () => {
    const registry = createSyntheticM41cClinicalKnowledgeRegistry();
    const first = exportM41cClinicalKnowledgeRegistry(registry);
    const second = exportM41cClinicalKnowledgeRegistry(
      createSyntheticM41cClinicalKnowledgeRegistry(),
    );
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      sourceCount: 11,
      entryCount: 3,
      productionActivationAvailable: false,
      evidenceClass: "synthetic_clinical_demo",
    });
    for (const entry of first.entries) {
      expect(entry).toMatchObject({
        ownerRole: "clinical-director",
        productionActivationAvailable: false,
      });
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      expect(entry.requiredHumanApprover).toEqual([
        "clinical-director",
        "bhc-director",
      ]);
      expect(entry.humanGateTemplate.required).toBe(true);
      expect(
        new Set(entry.workplanEvents.map((event) => event.cadence)),
      ).toEqual(new Set(["daily", "weekly", "monthly", "quarterly", "annual"]));
      expect(entry.demoTestIds.length).toBeGreaterThan(0);
      expect(entry.auditEventIds.length).toBeGreaterThan(0);
    }
  });

  it("allows only the governed synthetic stand-in to drive demo behavior", () => {
    const registry = createSyntheticM41cClinicalKnowledgeRegistry();
    const synthetic = validateM41cRegistryEntry(
      registry,
      "SYNTH-M41C-KNOWLEDGE-INSTRUMENT-STANDIN",
    );
    const trr = validateM41cRegistryEntry(
      registry,
      "M41C-KNOWLEDGE-TRR-CANS-METADATA",
    );
    const dfps = validateM41cRegistryEntry(
      registry,
      "M41C-KNOWLEDGE-DFPS-CANS-3-METADATA",
    );
    expect(synthetic).toMatchObject({
      valid: true,
      eligibleForSyntheticDemo: true,
      productionUseAuthorized: false,
    });
    expect(trr.valid).toBe(true);
    expect(trr.eligibleForSyntheticDemo).toBe(false);
    expect(trr.warnings).toContain(
      "M41C-SRC-TRR-CANS-METADATA:LICENSE_NOT_DEMO_READY",
    );
    expect(dfps.valid).toBe(true);
    expect(dfps.eligibleForSyntheticDemo).toBe(false);
    expect(() =>
      assertM41cRegistryEntryCanDriveSyntheticDemo(
        registry,
        "M41C-KNOWLEDGE-TRR-CANS-METADATA",
      ),
    ).toThrow("M41C_KNOWLEDGE_ENTRY_NOT_DEMO_ELIGIBLE");
  });

  it("stores metadata and content hashes without proprietary clinical content", () => {
    const registry = createSyntheticM41cClinicalKnowledgeRegistry();
    for (const source of registry.sources) {
      expect(source.contentBinding.proprietaryContentStored).toBe(false);
      if (source.sourceType === "instrument_metadata") {
        expect(source.contentBinding).toMatchObject({
          contentAvailable: false,
          contentHash: null,
          exactWordingValidated: false,
          responseOptionsValidated: false,
          scoringLogicValidated: false,
        });
        expect(["metadata_only", "license_validation_pending"]).toContain(
          source.licenseState,
        );
        expect(source.missingEvidence.length).toBeGreaterThan(0);
      }
    }
  });

  it("binds primary authority metadata without treating authority as activation", () => {
    const registry = createSyntheticM41cClinicalKnowledgeRegistry();
    const required = new Map([
      [
        "M41C-SRC-TRR-CANS-METADATA",
        "https://www.hhs.texas.gov/sites/default/files/documents/trr-um-guidelines-child.pdf",
      ],
      [
        "M41C-SRC-DFPS-CANS-3-METADATA",
        "https://www.dfps.texas.gov/Child_Protection/Medical_Services/documents/CANS_3.0_Manual_Reference_Guide.pdf",
      ],
      ["M41C-SRC-HL7-FHIR-R4", "https://hl7.org/fhir/R4/"],
      [
        "M41C-SRC-42-CFR-PART-2",
        "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2?toc=1",
      ],
    ]);
    for (const [sourceId, canonicalUrl] of required) {
      const source = registry.sources.find(
        (candidate) => candidate.id === sourceId,
      );
      expect(source).toMatchObject({
        canonicalUrl,
        state: "current",
        evidenceGrade: "official_authority",
      });
      expect(source?.contentBinding).toMatchObject({
        contentAvailable: false,
        proprietaryContentStored: false,
        scoringLogicValidated: false,
      });
      expect(source?.limitations).toContain(
        "Authority-source status is independent from algorithm, scoring, pathway, or live-write activation.",
      );
    }
    expect(
      validateM41cRegistryEntry(registry, "M41C-KNOWLEDGE-TRR-CANS-METADATA")
        .eligibleForSyntheticDemo,
    ).toBe(false);
  });

  it("rejects incomplete and duplicate source records", () => {
    const registry = createSyntheticM41cClinicalKnowledgeRegistry();
    const source = registry.sources[0];
    expect(() =>
      registerM41cClinicalSource(registry, { ...source, id: "", title: "" }),
    ).toThrow("M41C_SOURCE_INVALID:SOURCE_ID_REQUIRED,SOURCE_TITLE_REQUIRED");
    expect(() => registerM41cClinicalSource(registry, source)).toThrow(
      "M41C_SOURCE_ALREADY_REGISTERED",
    );
  });

  it("fails demo eligibility when a governed source becomes stale", () => {
    const original = createSyntheticM41cClinicalKnowledgeRegistry();
    const registry = {
      ...original,
      sources: original.sources.map((source) =>
        source.id === "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN"
          ? { ...source, state: "stale" as const }
          : source,
      ),
    };
    const result = validateM41cRegistryEntry(
      registry,
      "SYNTH-M41C-KNOWLEDGE-INSTRUMENT-STANDIN",
    );
    expect(result.eligibleForSyntheticDemo).toBe(false);
    expect(result.warnings).toContain(
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN:SOURCE_NOT_CURRENT",
    );
  });

  it("derives source-expiration controls from the review date even when a source is labeled current", () => {
    const registry = createSyntheticM41cClinicalKnowledgeRegistry();
    const result = validateM41cRegistryEntry(
      registry,
      "SYNTH-M41C-KNOWLEDGE-INSTRUMENT-STANDIN",
      "2027-06-01T00:00:00.000Z",
    );
    expect(result.eligibleForSyntheticDemo).toBe(false);
    expect(result.warnings).toContain(
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN:SOURCE_REVIEW_OVERDUE",
    );
  });

  it("exposes no production knowledge activation path", () => {
    expect(assertM41cProductionKnowledgeActivationUnavailable).toThrow(
      "M41C_PRODUCTION_KNOWLEDGE_ACTIVATION_UNAVAILABLE",
    );
  });
});
