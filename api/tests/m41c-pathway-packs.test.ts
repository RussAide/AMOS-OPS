import { describe, expect, it } from "vitest";
import { M41C_YOUTH_PATHWAY_DOMAINS } from "@contracts/m41c/pathways";
import type { M41cYouthPathwayDomain } from "@contracts/m41c/pathways";
import { createM41cSignedValidationRecord } from "../services/m41c/clinical-governance";
import {
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
} from "../services/m41c/competency-registry";
import {
  evaluateM41cYouthPathwayPack,
  getM41cYouthPathwayPack,
  M41C_YOUTH_PATHWAY_PACKS,
} from "../services/m41c/youth-pathway-packs";

const competencyGate = evaluateM41cCompetencyGate(
  createSyntheticM41cCompetencyRegistry(),
  {
    staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    staffRole: "clinical-director",
    requirementIds: ["M41C-COMP-PATHWAY"],
  },
);

function governed(domain: M41cYouthPathwayDomain) {
  const pack = getM41cYouthPathwayPack(domain);
  return {
    competencyGate,
    signedValidation: createM41cSignedValidationRecord({
      artifactId: pack.id,
      artifactKind: "pathway",
      artifactVersion: pack.version,
      checks: [
        {
          checkId: `${pack.id}-PREACTIVATION`,
          label: "Synthetic pathway pack pre-activation validation",
          passed: true,
          evidenceIds: [`SYNTH-EVIDENCE-${pack.id}`],
          notes: ["Synthetic metadata-only pack"],
        },
      ],
      competencyGate,
      sourceIds: pack.sourceIds,
      signatures: [
        {
          signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
          signedByRole: "clinical-director",
          signedAt: "2026-11-15T08:01:00.000Z",
          attestation: "The bounded synthetic pathway pack passed review.",
        },
        {
          signedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
          signedByRole: "bhc-director",
          signedAt: "2026-11-15T08:02:00.000Z",
          attestation: "The pack is approved only for demo evaluation.",
        },
      ],
    }),
  };
}

describe("M4.1C governed youth pathway packs", () => {
  it("provides distinct metadata-only packs for all controlling domains", () => {
    expect(M41C_YOUTH_PATHWAY_PACKS.map((pack) => pack.domain)).toEqual(
      M41C_YOUTH_PATHWAY_DOMAINS,
    );
    for (const pack of M41C_YOUTH_PATHWAY_PACKS) {
      expect(pack.syntheticOnly, pack.domain).toBe(true);
      expect(pack.activationState, pack.domain).toBe("demo_approved");
      expect(pack.instrumentMetadataIds[0], pack.domain).toBe(
        "SYNTH-M41C-INSTRUMENT-STANDIN",
      );
      expect(pack.boundaries.join(" "), pack.domain).toContain(
        "no proprietary item wording",
      );
      expect(pack.schedule.responseReviewRequired, pack.domain).toBe(true);
      expect(pack.schedule.nonresponseReviewRequired, pack.domain).toBe(true);
    }
  });

  it("routes response, nonresponse, comorbidity, and missing evidence distinctly", () => {
    expect(
      evaluateM41cYouthPathwayPack({
        domain: "depression",
        ...governed("depression"),
        evidenceComplete: true,
        observedSignals: ["SYNTH-MEASURE-IMPROVING"],
        activeComorbidityDomains: [],
      }).status,
    ).toBe("response_review");
    expect(
      evaluateM41cYouthPathwayPack({
        domain: "depression",
        ...governed("depression"),
        evidenceComplete: true,
        observedSignals: ["SYNTH-MEASURE-NOT-IMPROVING"],
        activeComorbidityDomains: [],
      }).status,
    ).toBe("nonresponse_review");
    expect(
      evaluateM41cYouthPathwayPack({
        domain: "depression",
        ...governed("depression"),
        evidenceComplete: true,
        observedSignals: [],
        activeComorbidityDomains: ["trauma"],
      }).status,
    ).toBe("comorbidity_review");
    const incomplete = evaluateM41cYouthPathwayPack({
      domain: "depression",
      ...governed("depression"),
      evidenceComplete: false,
      observedSignals: [],
      activeComorbidityDomains: [],
    });
    expect(incomplete.status).toBe("blocked_incomplete");
    expect(incomplete.humanGate.required).toBe(true);
    expect(incomplete.prohibitedActions).toContain("diagnosis");
  });
});
