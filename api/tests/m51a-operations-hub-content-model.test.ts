import { describe, expect, it } from "vitest";
import {
  M51A_CONTENT_TYPE_CODES,
  M51A_LIBRARY_CODES,
  M51A_METADATA_FIELD_CODES,
} from "@contracts/m51a/operations-hub";
import {
  createSyntheticM51aHubContentModel,
  validateM51aHubContentModel,
} from "../services/m51a/operations-hub/content-model";
import { createSyntheticM51aHubTopology } from "../services/m51a/operations-hub/topology";

describe("M5.1A Hub A02 controlled library and content architecture", () => {
  it("defines the ten checklist libraries exactly once", () => {
    const model = createSyntheticM51aHubContentModel();
    expect(model.libraries).toHaveLength(10);
    expect(model.libraries.map((library) => library.code)).toEqual(
      M51A_LIBRARY_CODES,
    );
    expect(model.libraries.map((library) => library.name)).toEqual([
      "Enterprise Governance & Doctrine",
      "Policies, SOPs & Standards",
      "Forms & Templates",
      "Programs & Service Operations",
      "Quality, Compliance & Safety",
      "Learning & Knowledge",
      "Contracts & Partnerships",
      "Projects, Change & Releases",
      "Published Intranet Content",
      "Legacy Intake & Disposition",
    ]);
  });

  it("defines all eleven approved content types and their allowed libraries", () => {
    const model = createSyntheticM51aHubContentModel();
    expect(model.contentTypes).toHaveLength(11);
    expect(model.contentTypes.map((item) => item.code)).toEqual(
      M51A_CONTENT_TYPE_CODES,
    );
    for (const item of model.contentTypes) {
      expect(item.allowedLibraries.length).toBeGreaterThan(0);
      expect(item.requiredMetadataFields).toEqual(M51A_METADATA_FIELD_CODES);
      expect(item.synthetic).toBe(true);
    }
  });

  it("defines all eighteen mandatory metadata fields under AMOS-DMS authority", () => {
    const model = createSyntheticM51aHubContentModel();
    expect(model.metadataDefinitions).toHaveLength(18);
    expect(model.metadataDefinitions.map((field) => field.code)).toEqual(
      M51A_METADATA_FIELD_CODES,
    );
    expect(
      model.metadataDefinitions.every(
        (field) =>
          field.requiredForPublished &&
          field.sourceOfAuthority === "AMOS-DMS" &&
          field.synthetic,
      ),
    ).toBe(true);
  });

  it("requires every library to carry the full metadata and seven-state lifecycle", () => {
    const model = createSyntheticM51aHubContentModel();
    for (const library of model.libraries) {
      expect(library.requiredMetadataFields).toEqual(M51A_METADATA_FIELD_CODES);
      expect(library.permittedLifecycleStates).toEqual([
        "Draft",
        "Review",
        "Approved",
        "Published",
        "Superseded",
        "Withdrawn",
        "Retained",
      ]);
      expect(library.ownerRole).toBeTruthy();
      expect(library.allowedContentTypes.length).toBeGreaterThan(0);
      expect(library.liveLibraryCreationAvailable).toBe(false);
    }
  });

  it("makes Published Intranet Content the sole authoritative guidance library", () => {
    const model = createSyntheticM51aHubContentModel();
    expect(
      model.libraries
        .filter((library) => library.authoritativeGuidanceEligible)
        .map((library) => library.code),
    ).toEqual(["published-intranet-content"]);
    const legacy = model.libraries.find(
      (library) => library.code === "legacy-intake-disposition",
    );
    expect(legacy).toMatchObject({
      temporaryIntakeOnly: true,
      authoritativeGuidanceEligible: false,
      generalNavigationEligible: false,
    });
  });

  it("validates the complete model against the approved topology", () => {
    expect(
      validateM51aHubContentModel(
        createSyntheticM51aHubContentModel(),
        createSyntheticM51aHubTopology(),
      ),
    ).toEqual([]);
  });

  it("detects incomplete metadata and competing publication authorities", () => {
    const model = createSyntheticM51aHubContentModel();
    const corrupted = {
      ...model,
      libraries: model.libraries.map((library, index) =>
        index === 0
          ? {
              ...library,
              requiredMetadataFields: ["amos_object_id" as const],
              authoritativeGuidanceEligible: true,
            }
          : library,
      ),
    };
    expect(
      validateM51aHubContentModel(
        corrupted,
        createSyntheticM51aHubTopology(),
      ),
    ).toEqual(
      expect.arrayContaining([
        "LIBRARY_METADATA_INCOMPLETE:enterprise-governance-doctrine",
        "PUBLISHED_INTRANET_LIBRARY_MUST_BE_SOLE_AUTHORITY",
      ]),
    );
  });

  it("rejects a seven-entry lifecycle list that omits canonical states", () => {
    const model = createSyntheticM51aHubContentModel();
    const corrupted = {
      ...model,
      libraries: model.libraries.map((library, index) =>
        index === 0
          ? {
              ...library,
              permittedLifecycleStates: Array(7).fill("Draft"),
            }
          : library,
      ),
    };
    expect(
      validateM51aHubContentModel(
        corrupted as typeof model,
        createSyntheticM51aHubTopology(),
      ),
    ).toContain(
      "LIBRARY_LIFECYCLE_INCOMPLETE:enterprise-governance-doctrine",
    );
  });
});
