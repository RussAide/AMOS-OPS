import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  TrainingAccountCreationPanel,
  buildTrainingInvitationUrl,
  validateTrainingAccountDraft,
  type TrainingAccountDraft,
} from "./settings-page";

const validDraft = (
  overrides: Partial<TrainingAccountDraft> = {},
): TrainingAccountDraft => ({
  email: "trainee@example.invalid",
  firstName: "Synthetic",
  lastName: "Trainee",
  role: "training-coordinator",
  identityType: "workforce",
  sponsorName: "",
  accessExpiresAt: "2026-08-31T17:00",
  rationale: "Authorized platform-orientation participant.",
  syntheticOnlyAcknowledged: true,
  ...overrides,
});

describe("TA.1 Training-account creation form", () => {
  it("renders a structured, labelled synthetic-only form", () => {
    const html = renderToStaticMarkup(
      <TrainingAccountCreationPanel
        defaultSponsorName="Authorized Administrator"
        isPending={false}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Create synthetic-only Training account");
    expect(html).toContain("Work email");
    expect(html).toContain("First name");
    expect(html).toContain("Last name");
    expect(html).toContain("Canonical AMOS-OPS role");
    expect(html).toContain("Identity type");
    expect(html).toContain("Access expiration");
    expect(html).toContain("Access rationale");
    expect(html).toContain("will not be used for PHI");
    expect(html).toContain("Authorized Administrator");
    expect(html).not.toContain("#invite=");
  });

  it("rejects missing fields and a missing synthetic-only acknowledgement", () => {
    const result = validateTrainingAccountDraft(
      {
        email: "",
        firstName: "",
        lastName: "",
        role: "not-a-canonical-role" as TrainingAccountDraft["role"],
        identityType: "external_guest",
        sponsorName: "",
        accessExpiresAt: "",
        rationale: "",
        syntheticOnlyAcknowledged: false,
      },
      "Authorized Administrator",
      new Date("2026-07-17T12:00:00.000Z"),
    );

    expect(result.request).toBeUndefined();
    expect(result.errors).toMatchObject({
      email: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
      role: expect.any(String),
      sponsorName: expect.any(String),
      accessExpiresAt: expect.any(String),
      rationale: expect.any(String),
      syntheticOnlyAcknowledged: expect.any(String),
    });
  });

  it("uses the signed-in administrator as sponsor for workforce accounts", () => {
    const result = validateTrainingAccountDraft(
      validDraft(),
      "Authorized Administrator",
      new Date("2026-07-17T12:00:00.000Z"),
    );

    expect(result.errors).toEqual({});
    expect(result.request).toMatchObject({
      email: "trainee@example.invalid",
      role: "training-coordinator",
      identityType: "workforce",
      sponsorName: "Authorized Administrator",
      accessExpiresAt: new Date("2026-08-31T17:00").toISOString(),
    });
    expect(result.request).not.toHaveProperty("syntheticOnlyAcknowledged");
  });

  it("requires and records a named sponsor for an external stakeholder", () => {
    const result = validateTrainingAccountDraft(
      validDraft({
        identityType: "external_guest",
        sponsorName: "External Access Sponsor",
      }),
      "Authorized Administrator",
      new Date("2026-07-17T12:00:00.000Z"),
    );

    expect(result.errors).toEqual({});
    expect(result.request).toMatchObject({
      identityType: "external_guest",
      sponsorName: "External Access Sponsor",
    });
  });

  it("rejects expired access and puts the invitation secret in the URL fragment", () => {
    const validation = validateTrainingAccountDraft(
      validDraft({ accessExpiresAt: "2026-07-17T06:00" }),
      "Authorized Administrator",
      new Date("2026-07-17T12:00:00.000Z"),
    );

    expect(validation.request).toBeUndefined();
    expect(validation.errors.accessExpiresAt).toContain("future");
    expect(
      buildTrainingInvitationUrl(
        "https://amos.example.invalid",
        "one-time/token?value",
      ),
    ).toBe(
      "https://amos.example.invalid/login#invite=one-time%2Ftoken%3Fvalue",
    );
  });
});
