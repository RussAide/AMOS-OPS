import { describe, expect, it } from "vitest";

import type {
  M42SearchActorContext,
  M42SearchDocument,
} from "../../contracts/m42/search";
import {
  permissionTrimM42SearchDocuments,
  searchM42Documents,
} from "../services/m42/search-engine";

const documents: readonly M42SearchDocument[] = [
  {
    id: "SYN-M42-DOC-PUBLIC",
    libraryId: "operations-library",
    title: "Public synthetic retention guide",
    body: "General fictional retention and document lifecycle guidance.",
    metadata: {
      documentType: "guide",
      division: "enterprise-operations",
      lifecycle: "approved",
      ownerRole: "records-owner",
      tags: ["retention", "synthetic"],
    },
    access: {
      classification: "public",
      segmentId: "enterprise",
      requiredEntitlements: [],
    },
    citationSource: {
      sourceOfTruthId: "SOT-SYN-M42-PUBLIC",
      sourceVersion: "1.0",
      sourceFragment: "overview",
    },
    synthetic: true,
  },
  {
    id: "SYN-M42-DOC-INTERNAL",
    libraryId: "operations-library",
    title: "Internal synthetic retention procedure",
    body: "Fictional internal instructions for an approved retention review.",
    metadata: {
      documentType: "procedure",
      division: "enterprise-operations",
      lifecycle: "approved",
      ownerRole: "records-owner",
      tags: ["retention", "review"],
      sensitivityLabel: "internal-sensitive-demo",
      syntheticMatterCode: "MATTER-SECRET-42",
      syntheticProgramCode: "PROGRAM-DEMO-17",
    },
    access: {
      classification: "internal",
      segmentId: "enterprise",
      requiredEntitlements: ["document:read"],
    },
    citationSource: {
      sourceOfTruthId: "SOT-SYN-M42-INTERNAL",
      sourceVersion: "2.0",
      sourceFragment: "retention-review",
    },
    synthetic: true,
  },
  {
    id: "SYN-M42-DOC-RESTRICTED-ORCHID",
    libraryId: "operations-library",
    title: "ORCHID OMEGA restricted synthetic matter",
    body: "ORCHID OMEGA is a fictional restricted retrieval decoy.",
    metadata: {
      documentType: "restricted-decoy",
      division: "executive",
      lifecycle: "approved",
      ownerRole: "security-owner",
      tags: ["ORCHID-OMEGA", "restricted"],
      sensitivityLabel: "restricted-demo",
      syntheticMatterCode: "MATTER-ORCHID-OMEGA",
      syntheticProgramCode: "PROGRAM-RESTRICTED-DECOY",
    },
    access: {
      classification: "restricted",
      segmentId: "executive",
      requiredEntitlements: ["document:read", "document:restricted:read"],
    },
    citationSource: {
      sourceOfTruthId: "SOT-SYN-M42-RESTRICTED-ORCHID",
      sourceVersion: "9.9",
      sourceFragment: "restricted-fragment",
    },
    synthetic: true,
  },
];

const basicActor: M42SearchActorContext = {
  actorId: "SYN-M42-BASIC-ACTOR",
  allowedLibraryIds: ["operations-library"],
  allowedClassifications: ["public", "internal"],
  allowedSegmentIds: ["enterprise"],
  entitlements: ["document:read"],
  synthetic: true,
};

describe("M4.2 permission-trimmed document search", () => {
  it("trims before matching, ranking, and citation without leaking excluded identifiers", () => {
    const response = searchM42Documents(documents, basicActor, {
      text: "ORCHID OMEGA",
    });
    const serialized = JSON.stringify(response);

    expect(response.results).toEqual([]);
    expect(
      response.trace.map(({ stage, sequence }) => [stage, sequence]),
    ).toEqual([
      ["permission_trim", 1],
      ["metadata_projection", 2],
      ["query_match", 3],
      ["ranking", 4],
      ["citation_projection", 5],
    ]);
    expect(response.trace[0]).toMatchObject({ inputCount: 3, outputCount: 2 });
    expect(response.permissionTrimmedBeforeRanking).toBe(true);
    expect(response.permissionTrimmedBeforeCitation).toBe(true);
    expect(serialized).not.toContain("SYN-M42-DOC-RESTRICTED-ORCHID");
    expect(serialized).not.toContain("SOT-SYN-M42-RESTRICTED-ORCHID");
    expect(serialized).not.toContain("MATTER-ORCHID-OMEGA");
    expect(serialized).not.toContain("PROGRAM-RESTRICTED-DECOY");
  });

  it("scores and returns only projected metadata fields", () => {
    const response = searchM42Documents(documents, basicActor, {
      text: "retention",
      metadataFilters: { documentType: ["procedure"] },
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({
      documentId: "SYN-M42-DOC-INTERNAL",
      metadata: {
        documentType: "procedure",
        division: "enterprise-operations",
        lifecycle: "approved",
      },
      citation: {
        sourceOfTruthId: "SOT-SYN-M42-INTERNAL",
        sourceVersion: "2.0",
      },
    });
    expect(response.results[0]?.metadata).not.toHaveProperty(
      "sensitivityLabel",
    );
    expect(response.results[0]?.metadata).not.toHaveProperty(
      "syntheticMatterCode",
    );
    expect(response.results[0]?.metadata).not.toHaveProperty(
      "syntheticProgramCode",
    );
    expect(response.externalWriteAttempted).toBe(false);
  });

  it("does not score protected metadata unless the actor holds the field entitlement", () => {
    const withoutEntitlement = searchM42Documents(documents, basicActor, {
      text: "MATTER SECRET 42",
    });
    expect(withoutEntitlement.results).toEqual([]);

    const entitledActor: M42SearchActorContext = {
      ...basicActor,
      entitlements: ["document:read", "metadata:matter-code:read"],
    };
    const withEntitlement = searchM42Documents(documents, entitledActor, {
      text: "MATTER SECRET 42",
      metadataFilters: { syntheticMatterCode: ["MATTER-SECRET-42"] },
    });
    expect(withEntitlement.results).toHaveLength(1);
    expect(withEntitlement.results[0]?.metadata).toMatchObject({
      syntheticMatterCode: "MATTER-SECRET-42",
    });
    expect(withEntitlement.results[0]?.metadata).not.toHaveProperty(
      "sensitivityLabel",
    );
    expect(withEntitlement.results[0]?.metadata).not.toHaveProperty(
      "syntheticProgramCode",
    );
  });

  it("rejects a protected metadata filter with a generic non-disclosing error", () => {
    expect(() =>
      searchM42Documents(documents, basicActor, {
        metadataFilters: { syntheticMatterCode: ["MATTER-SECRET-42"] },
      }),
    ).toThrowError(/^M42_SEARCH_FILTER_NOT_AUTHORIZED$/);
  });

  it("exposes a pure permission trim boundary for integrated services", () => {
    const permitted = permissionTrimM42SearchDocuments(documents, basicActor);
    expect(permitted.map(({ id }) => id)).toEqual([
      "SYN-M42-DOC-PUBLIC",
      "SYN-M42-DOC-INTERNAL",
    ]);
  });
});
