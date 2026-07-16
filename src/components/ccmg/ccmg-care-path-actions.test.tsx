import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CcmgCarePathActions,
  type CcmgCarePathActionRequest,
  type CcmgReferralGateActionRequest,
} from "./ccmg-care-path-actions";

const approvedGateShapes = [
  {
    kind: "record_gate",
    gate: "intake",
    decision: { status: "complete" },
    reason: "Synthetic intake completion.",
  },
  {
    kind: "record_gate",
    gate: "eligibility",
    decision: {
      status: "needs_review",
      rationale: "Synthetic held-referral rationale.",
    },
    reason: "Synthetic eligibility hold.",
  },
  {
    kind: "record_gate",
    gate: "payer_authorization",
    decision: {
      payerLabel: "Synthetic payer",
      verificationStatus: "verified",
      authorizationRequired: true,
      authorizationStatus: "approved",
      authorizationReference: "SYN-AUTH-1",
      effectiveAt: "2026-07-14T12:00:00.000Z",
      expiresAt: "2026-08-14T12:00:00.000Z",
    },
    reason: "Synthetic payer gate.",
  },
  {
    kind: "record_gate",
    gate: "consent",
    decision: {
      status: "active",
      consentReference: "SYN-CONSENT-1",
      effectiveAt: "2026-07-14T12:00:00.000Z",
      expiresAt: "2026-08-14T12:00:00.000Z",
    },
    reason: "Synthetic consent gate.",
  },
  {
    kind: "record_gate",
    gate: "cans_schedule",
    decision: {
      status: "scheduled",
      dueAt: "2026-07-15T12:00:00.000Z",
      scheduledFor: "2026-07-14T16:00:00.000Z",
    },
    reason: "Synthetic CANS schedule.",
  },
  {
    kind: "record_gate",
    gate: "capacity",
    decision: {
      required: true,
      facilityLabel: "Synthetic facility",
      status: "reserved",
      availableSlots: 1,
      reservedSlotReference: "SYN-SLOT-1",
      checkedAt: "2026-07-14T12:00:00.000Z",
    },
    reason: "Synthetic capacity gate.",
  },
] satisfies CcmgReferralGateActionRequest[];

const approvedRequestShapes = [
  {
    kind: "record_gate",
    gate: "eligibility",
    decision: {
      status: "ineligible",
      criteria: {
        ageQualified: true,
        diagnosisQualified: false,
        functionalImpairment: true,
        coverageQualified: true,
      },
      rationale: "Synthetic rejection rationale.",
    },
    reason: "Synthetic audited gate review.",
  },
  {
    kind: "finalize_cans",
    instrumentVersion: "CANS 2.0",
    domainScores: {
      behavioral_emotional: 2,
      risk_behaviors: 2,
      life_functioning: 2,
      strengths: 1,
      caregiver_resources: 2,
      cultural_factors: 1,
    },
    actionableItems: [
      {
        itemCode: "SYN-NEED-1",
        label: "Synthetic need",
        domain: "behavioral_emotional",
        rating: 2,
        disposition: "need",
      },
    ],
    totalScore: 28,
    acuity: "high",
    completedAt: "2026-07-14T12:00:00.000Z",
    reason: "Synthetic CANS finalization.",
  },
  {
    kind: "approve_target_route",
    cansAssessmentId: "SYN-CANS-1",
    targetType: "mhtcm_plan",
    targetRecordId: "SYN-MHTCM-PLAN-1",
    targetVersion: 1,
    reason: "Synthetic MHTCM target approval.",
  },
  {
    kind: "approve_target_route",
    cansAssessmentId: "SYN-CANS-1",
    targetType: "mhrs_skills_goals",
    targetRecordId: "SYN-MHRS-GOALS-1",
    targetVersion: 1,
    reason: "Synthetic MHRS target approval.",
  },
  {
    kind: "create_medication_alert",
    title: "Urgent synthetic medication review",
    priority: "urgent",
    dueAt: "2026-07-14T16:00:00.000Z",
    reason: "Synthetic medication alert.",
  },
] satisfies CcmgCarePathActionRequest[];

describe("CCMG synthetic care-path action UI", () => {
  it("exposes every controlled care-path step with server-version authority", () => {
    const markup = renderToStaticMarkup(
      <CcmgCarePathActions
        referralId="SYN-REF-1"
        referralVersion={4}
        latestCansAssessmentId="SYN-CANS-1"
        authenticatedRoleLabel="CCMG Program Director"
        synthetic
        enabled
        submitting={false}
        onAction={async () => undefined}
      />,
    );

    expect(markup).toContain("Synthetic-demo care path");
    expect(markup).toContain("Gate decision");
    expect(markup).toContain("Finalize CANS");
    expect(markup).toContain("MHTCM target");
    expect(markup).toContain("MHRS target");
    expect(markup).toContain("Medication alert");
    expect(markup).toContain("Referral version 4");
    expect(markup).toContain("makes no optimistic completion claim");
    expect(approvedRequestShapes.map((request) => request.kind)).toEqual([
      "record_gate",
      "finalize_cans",
      "approve_target_route",
      "approve_target_route",
      "create_medication_alert",
    ]);
    expect(approvedGateShapes.map((request) => request.gate)).toEqual([
      "intake",
      "eligibility",
      "payer_authorization",
      "consent",
      "cans_schedule",
      "capacity",
    ]);
  });

  it("keeps built fallback data read-only and stays off production detail", () => {
    const fallbackMarkup = renderToStaticMarkup(
      <CcmgCarePathActions
        referralId="SYN-REF-1"
        referralVersion={4}
        latestCansAssessmentId="SYN-CANS-1"
        authenticatedRoleLabel="Evaluation Viewer"
        synthetic
        enabled={false}
        disabledReason="Built fallback fixtures are read-only."
        submitting={false}
        onAction={async () => undefined}
      />,
    );
    const productionMarkup = renderToStaticMarkup(
      <CcmgCarePathActions
        referralId="REF-1"
        referralVersion={4}
        latestCansAssessmentId={null}
        authenticatedRoleLabel="CCMG Program Director"
        synthetic={false}
        enabled
        submitting={false}
        onAction={async () => undefined}
      />,
    );

    expect(fallbackMarkup).toContain("Built fallback fixtures are read-only.");
    expect(fallbackMarkup).toContain("disabled");
    expect(productionMarkup).toBe("");
  });
});
