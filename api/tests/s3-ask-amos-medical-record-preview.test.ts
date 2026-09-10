import { describe, expect, it } from "vitest";
import { runAskAmosMedicalRecordPreview } from "../dms/ask-amos-medical-record";

describe("S3 Ask AMOS medical-record preview", () => {
  it("returns only the authorized current/controlling synthetic medical record", async () => {
    const result = await runAskAmosMedicalRecordPreview("authorized");
    expect(result).toMatchObject({
      environment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      outcome: "AUTHORIZED",
      code: "AUTHORIZED_SHAREPOINT_BINARY",
    });
    expect(result.record).toMatchObject({
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      documentId: "SYNTH-S3-MEDICAL-CURRENT",
    });
    expect(result.backend).toMatchObject({
      integrityVerified: true,
      stableObjectId: "AMOS-DMS:SYNTH-S3-MEDICAL-CURRENT",
    });
    expect(result.trace.every((entry) => entry.status === "PASS")).toBe(true);
  });

  it("fails closed before record disclosure when contextual assignment is denied", async () => {
    const result = await runAskAmosMedicalRecordPreview("denied");
    expect(result.outcome).toBe("DENIED");
    expect(result.record).toBeNull();
    expect(result.backend).toBeNull();
    expect(result.trace.find((entry) => entry.step === "Contextual access")?.status).toBe(
      "BLOCKED",
    );
    expect(
      result.trace.find((entry) => entry.step === "SharePoint object re-verification")
        ?.status,
    ).toBe("NOT_REACHED");
  });

  it("refuses to guess when more than one current controller exists", async () => {
    const result = await runAskAmosMedicalRecordPreview("authority_conflict");
    expect(result).toMatchObject({
      outcome: "AUTHORITY_CONFLICT",
      code: "AUTHORITY_CONFLICT",
      record: null,
      backend: null,
    });
    expect(result.trace[0]).toMatchObject({
      step: "Authority resolution",
      status: "BLOCKED",
    });
  });

  it("withholds content when the bound SharePoint metadata has drifted", async () => {
    const result = await runAskAmosMedicalRecordPreview("backend_stale");
    expect(result).toMatchObject({
      outcome: "BACKEND_STALE",
      code: "SHAREPOINT_BACKEND_STALE",
      record: null,
      backend: null,
    });
    expect(
      result.trace.find((entry) => entry.step === "SharePoint object re-verification")
        ?.status,
    ).toBe("BLOCKED");
  });

  it("protects the superseded copy and returns only the replacement controller", async () => {
    const result = await runAskAmosMedicalRecordPreview("superseded_protected");
    expect(result).toMatchObject({
      outcome: "AUTHORIZED",
      code: "SUPERSEDED_COPY_BLOCKED_CURRENT_RETURNED",
    });
    expect(result.record?.documentId).toBe("SYNTH-S3-MEDICAL-V2");
    expect(result.record?.governingVersion).toBe("v2");
    expect(result.trace[0]?.detail).toContain("SYNTH-S3-MEDICAL-V1");
  });
});
