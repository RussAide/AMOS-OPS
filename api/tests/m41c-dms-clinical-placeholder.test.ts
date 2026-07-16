import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER } from "../routers/m2";

describe("M4.1C DMS clinical-instrument quarantine", () => {
  it("seeds only a draft metadata placeholder with no instrument or scoring content", () => {
    expect(M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER.status).toBe("draft");
    expect(M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER.description).toContain(
      "Metadata-only synthetic placeholder",
    );
    expect(M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER.description).toContain(
      "no instrument wording",
    );
    expect(M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER.tagsJson).toContain(
      "quarantined",
    );
    expect(M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER).not.toHaveProperty(
      "publishedAt",
    );
    expect(M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER).not.toHaveProperty(
      "publishedBy",
    );
  });

  it("requires the admin boundary and contains no published CANS scoring guide seed", () => {
    const source = readFileSync(
      new URL("../routers/m2.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/seedDocuments:\s*adminQuery\.mutation/);
    expect(source).not.toContain('title: "CANS Assessment Guide"');
    expect(source).not.toContain(
      "assessment administration guide with scoring rubrics",
    );
  });
});
