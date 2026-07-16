import { describe, expect, it } from "vitest";
import { M52_APPROVED_WORKFLOW_IDS } from "@contracts/m52/shared";
import {
  M52_APPROVED_OFFLINE_CORE_WORKFLOWS,
  M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS,
  M52_OFFLINE_CAPABILITY_MATRIX,
  M52_PROHIBITED_OFFLINE_RECORDS,
  evaluateM52OfflineCapability,
  evaluateM52PayloadMinimumNecessary,
  inspectM52CapabilityMatrix,
  type M52OfflineAction,
} from "../services/m52/security";

const BASE_REQUEST = {
  workflowId: "gro_tablet_medication_pass",
  action: "record-administration",
  role: "medication-aide",
  divisionId: "gro",
  youthId: "SYNTH-M52-YOUTH-ALPHA-001",
  online: false,
  deviceCompliant: true,
  sessionActive: true,
  synthetic: true,
} as const;

describe("M5.2-01 approved offline capability and prohibition policy", () => {
  it("matches the frozen four-workflow contract exactly", () => {
    const actual = M52_OFFLINE_CAPABILITY_MATRIX.map((item) => item.workflowId);
    expect(actual).toEqual(M52_APPROVED_WORKFLOW_IDS);
    expect(M52_APPROVED_OFFLINE_CORE_WORKFLOWS).toEqual(
      M52_APPROVED_WORKFLOW_IDS,
    );
    expect(new Set(actual).size).toBe(4);
    expect(inspectM52CapabilityMatrix()).toMatchObject({
      accepted: true,
      contractWorkflowSetMatch: true,
      approvedWorkflowCount: 4,
      offlineFirstWorkflowCount: 4,
      duplicateWorkflowIds: [],
      missingRequiredControls: [],
    });
  });

  it("documents minimum-necessary fields, restrictions, role/division scope, TTL, and reconnect disposition for every workflow", () => {
    for (const policy of M52_OFFLINE_CAPABILITY_MATRIX) {
      expect(policy.offlineFirst).toBe(true);
      expect(policy.youthBound).toBe(true);
      expect(policy.authorizedRoles.length).toBeGreaterThan(0);
      expect(policy.authorizedDivisions.length).toBeGreaterThan(0);
      expect(policy.allowedOfflineActions.length).toBeGreaterThan(0);
      expect(policy.prohibitedOfflineActions.length).toBeGreaterThan(0);
      expect(policy.minimumNecessaryFields.length).toBeGreaterThanOrEqual(5);
      expect(policy.restrictions.length).toBeGreaterThanOrEqual(5);
      expect(policy.maxCacheMinutes).toBeGreaterThan(0);
      expect(policy.maxCacheMinutes).toBeLessThanOrEqual(480);
      expect(policy.reconnectDisposition).toMatch(/before-finalize$/);
      expect(policy.synthetic).toBe(true);
      expect(Object.isFrozen(policy)).toBe(true);
    }
  });

  it.each([
    [
      "gro_tablet_medication_pass",
      "record-administration",
      "medication-aide",
      "gro",
    ],
    [
      "gro_shift_safety_handoff",
      "record-safety-observation",
      "youth-care-worker",
      "gro",
    ],
    [
      "bhc_field_case_management_contact",
      "capture-contact-draft",
      "case-manager",
      "bhc",
    ],
    [
      "enterprise_task_structured_form",
      "complete-structured-form-draft",
      "therapist",
      "bhc",
    ],
  ] as const)(
    "allows the scoped offline action for %s",
    (workflowId, action, role, divisionId) => {
      const decision = evaluateM52OfflineCapability({
        ...BASE_REQUEST,
        workflowId,
        action,
        role,
        divisionId,
      });
      expect(decision).toMatchObject({
        allowed: true,
        reasonCodes: ["M52_OFFLINE_ACTION_APPROVED"],
        synthetic: true,
      });
    },
  );

  it.each(M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS)(
    "denies global offline action %s even to an otherwise authorized user",
    (action) => {
      const decision = evaluateM52OfflineCapability({
        ...BASE_REQUEST,
        action,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCodes).toContain(
        "M52_ACTION_GLOBALLY_PROHIBITED_OFFLINE",
      );
    },
  );

  it("denies an unapproved workflow instead of treating the matrix as open-ended", () => {
    const decision = evaluateM52OfflineCapability({
      ...BASE_REQUEST,
      workflowId: "future-offline-workflow",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain("M52_WORKFLOW_NOT_APPROVED_OFFLINE");
  });

  it.each([
    [{ role: "billing-specialist" }, "M52_ROLE_NOT_AUTHORIZED_FOR_WORKFLOW"],
    [{ divisionId: "bhc" }, "M52_DIVISION_NOT_AUTHORIZED_FOR_WORKFLOW"],
    [{ youthId: null }, "M52_YOUTH_SCOPE_REQUIRED"],
    [{ youthId: "REAL-YOUTH-1" }, "M52_SYNTHETIC_YOUTH_SCOPE_REQUIRED"],
    [{ deviceCompliant: false }, "M52_DEVICE_NOT_COMPLIANT"],
    [{ sessionActive: false }, "M52_SESSION_NOT_ACTIVE"],
    [{ synthetic: false }, "M52_SYNTHETIC_REQUEST_REQUIRED"],
  ] as const)("denies invalid scope/control %#", (overrides, reason) => {
    const decision = evaluateM52OfflineCapability({
      ...BASE_REQUEST,
      ...overrides,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain(reason);
  });

  it("does not convert the offline matrix into an online authorization grant", () => {
    const decision = evaluateM52OfflineCapability({
      ...BASE_REQUEST,
      online: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain(
      "M52_OFFLINE_POLICY_NOT_AN_ONLINE_GRANT",
    );
  });

  it("documents the prohibited record classes required by the controlling baseline", () => {
    expect(M52_PROHIBITED_OFFLINE_RECORDS).toHaveLength(8);
    expect(M52_PROHIBITED_OFFLINE_RECORDS.map((row) => row.recordClass)).toEqual(
      expect.arrayContaining([
        "authoritative-medication-order",
        "clinical-score-or-level-of-care-decision",
        "crisis-dispatch-or-external-care-coordination",
        "claim-billing-or-payer-submission",
        "consent-signature-or-final-approval",
        "identity-role-permission-or-system-configuration",
        "microsoft-publication-or-external-disclosure",
        "authoritative-record-deletion",
      ]),
    );
    expect(
      M52_PROHIBITED_OFFLINE_RECORDS.every(
        (row) => row.reason.length > 40 && row.disposition.length > 0,
      ),
    ).toBe(true);
  });

  it("keeps allowed and prohibited actions disjoint", () => {
    for (const policy of M52_OFFLINE_CAPABILITY_MATRIX) {
      const prohibited = new Set<M52OfflineAction>(
        policy.prohibitedOfflineActions,
      );
      expect(
        policy.allowedOfflineActions.filter((action) => prohibited.has(action)),
      ).toEqual([]);
    }
  });

  it("does not mistake the required structured-observation field for a DOB field", () => {
    const decision = evaluateM52PayloadMinimumNecessary(
      "gro_shift_safety_handoff",
      {
        opaqueYouthLabel: "Synthetic Youth SHIFT-002",
        shiftWindow: "15:00Z-23:00Z",
        structuredObservationCodes: ["safety-round-complete"],
        adlBehaviorCodes: ["adl-routine-complete"],
        checklistCompletion: { roundsComplete: true },
        draftNarrative: "Synthetic routine observation.",
        handoffFlags: ["routine-follow-up"],
      },
    );
    expect(decision.allowed).toBe(true);
  });

  it("still denies short sensitive keys when nested inside an allowed field", () => {
    const decision = evaluateM52PayloadMinimumNecessary(
      "gro_shift_safety_handoff",
      {
        opaqueYouthLabel: "Synthetic Youth SHIFT-002",
        shiftWindow: "15:00Z-23:00Z",
        structuredObservationCodes: ["safety-round-complete"],
        adlBehaviorCodes: ["adl-routine-complete"],
        checklistCompletion: { patientDOB: "synthetic-prohibited" },
        draftNarrative: "Synthetic routine observation.",
        handoffFlags: ["routine-follow-up"],
      },
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain("M52_PAYLOAD_PROHIBITED_FIELD");
  });
});
