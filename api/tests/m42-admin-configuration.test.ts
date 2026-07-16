import { describe, expect, it } from "vitest";
import type { M42ActorContext, M42RoleTier } from "@contracts/m42/shared";
import type { UserRole } from "../../src/constants/roles";
import { createSyntheticM42ConfigurationAdmin } from "../services/m42/configuration-admin";

function actor(input: {
  actorId: string;
  role: UserRole;
  tier: M42RoleTier;
  permissions: readonly string[];
}): M42ActorContext {
  return Object.freeze({
    actorId: input.actorId,
    role: input.role,
    tier: input.tier,
    divisionIds: Object.freeze(["eo"] as const),
    permissions: Object.freeze([...input.permissions]),
    sensitivityClearance: Object.freeze([
      "public",
      "internal",
      "confidential",
      "restricted",
    ] as const),
    minimumNecessaryPurpose:
      "Administer approved synthetic M4.2 configuration.",
    synthetic: true,
  });
}

const editor = actor({
  actorId: "SYNTH-M42-CONFIG-EDITOR",
  role: "hr-director",
  tier: "T2",
  permissions: [
    "m42:admin:records",
    "m42:admin:search",
    "m42:admin:reporting",
    "m42:admin:workspace",
  ],
});

const approver = actor({
  actorId: "SYNTH-M42-CONFIG-APPROVER",
  role: "managing-director",
  tier: "T1",
  permissions: ["m42:admin:approve", "m42:admin:audit", "*"],
});

describe("M4.2 no-code configuration administration", () => {
  it("shows only authorized schemas and denies T3/T4 or missing permissions", () => {
    const admin = createSyntheticM42ConfigurationAdmin();
    expect(admin.listSchemas(editor).map((schema) => schema.configKey)).toEqual(
      [
        "records.retention.review_window_days",
        "search.result_limit",
        "reporting.export.max_rows",
        "workspace.documents.default_view",
      ],
    );

    const t3 = actor({
      actorId: "SYNTH-M42-CONFIG-T3",
      role: "billing-specialist",
      tier: "T3",
      permissions: ["*"],
    });
    const t4 = actor({
      actorId: "SYNTH-M42-CONFIG-T4",
      role: "youth-care-worker",
      tier: "T4",
      permissions: ["*"],
    });
    expect(() => admin.listSchemas(t3)).toThrow(
      "M42_ADMIN_TIER_ACCESS_DENIED:T3",
    );
    expect(() => admin.listSchemas(t4)).toThrow(
      "M42_ADMIN_TIER_ACCESS_DENIED:T4",
    );

    const leastPrivilege = actor({
      actorId: "SYNTH-M42-CONFIG-LIMITED",
      role: "training-coordinator",
      tier: "T2",
      permissions: ["m42:admin:workspace"],
    });
    expect(
      admin.listSchemas(leastPrivilege).map((schema) => schema.configKey),
    ).toEqual(["workspace.documents.default_view"]);
    expect(() =>
      admin.currentVersion(leastPrivilege, "search.result_limit"),
    ).toThrow("M42_CONFIG_PERMISSION_REQUIRED:m42:admin:search");
  });

  it("validates and previews changes without mutating configuration state", () => {
    const admin = createSyntheticM42ConfigurationAdmin();
    const before = admin.currentVersion(editor, "search.result_limit");
    const invalid = admin.previewChange(editor, {
      configKey: "search.result_limit",
      proposedValue: 500,
      reason: "Test an out-of-range no-code value.",
      requestedAt: "2026-12-15T08:10:00.000Z",
    });

    expect(invalid).toMatchObject({
      valid: false,
      validationErrors: ["M42_CONFIG_MAXIMUM:100"],
      mutatesState: false,
      approvalRequired: false,
    });
    expect(admin.currentVersion(editor, "search.result_limit")).toBe(before);
    expect(admin.history(editor, "search.result_limit")).toHaveLength(1);
    expect(() =>
      admin.applyPreview(editor, invalid, "2026-12-15T08:11:00.000Z"),
    ).toThrow("M42_CONFIG_PREVIEW_INVALID:M42_CONFIG_MAXIMUM:100");
  });

  it("applies an approved no-code value as a new immutable version", () => {
    const admin = createSyntheticM42ConfigurationAdmin();
    const preview = admin.previewChange(editor, {
      configKey: "records.retention.review_window_days",
      proposedValue: 120,
      reason: "Adjust the synthetic retention review work queue cadence.",
      requestedAt: "2026-12-15T08:10:00.000Z",
    });
    expect(preview).toMatchObject({
      currentValue: 90,
      proposedValue: 120,
      valid: true,
      approvalRequired: true,
      mutatesState: false,
    });
    expect(() =>
      admin.applyPreview(editor, preview, "2026-12-15T08:12:00.000Z"),
    ).toThrow("M42_CONFIG_APPROVAL_REQUIRED");

    expect(() =>
      admin.approvePreview(editor, preview, {
        approvedAt: "2026-12-15T08:11:00.000Z",
        rationale:
          "The editor cannot approve their own requested configuration.",
      }),
    ).toThrow("M42_CONFIG_SELF_APPROVAL_DENIED");
    const approval = admin.approvePreview(approver, preview, {
      approvedAt: "2026-12-15T08:11:00.000Z",
      rationale:
        "The bounded synthetic retention review adjustment is approved.",
    });
    const applied = admin.applyPreview(
      editor,
      preview,
      "2026-12-15T08:12:00.000Z",
      approval,
    );

    expect(applied).toMatchObject({
      version: {
        version: 2,
        previousVersionId:
          "SYNTH-M42-CONFIG-RECORDS-RETENTION-REVIEW_WINDOW_DAYS-V1",
        value: 120,
        changeType: "change",
        approvedBy: approver.actorId,
        approvalId: approval.approvalId,
        immutable: true,
      },
      rollbackCreatedNewVersion: false,
      liveConnectorMutation: false,
      synthetic: true,
    });
    expect(applied.auditEvents.map((event) => event.eventType)).toEqual([
      "configuration_validated",
      "configuration_changed",
    ]);
    expect(
      admin.history(editor, preview.configKey).map((item) => item.value),
    ).toEqual([90, 120]);
  });

  it("applies an approval-free validated setting and rejects stale previews", () => {
    const admin = createSyntheticM42ConfigurationAdmin();
    const first = admin.previewChange(editor, {
      configKey: "search.result_limit",
      proposedValue: 30,
      reason: "Increase the synthetic result page by five records.",
      requestedAt: "2026-12-15T08:10:00.000Z",
    });
    const stale = admin.previewChange(editor, {
      configKey: "search.result_limit",
      proposedValue: 35,
      reason: "Prepare another bounded synthetic result-page adjustment.",
      requestedAt: "2026-12-15T08:11:00.000Z",
    });
    const applied = admin.applyPreview(
      editor,
      first,
      "2026-12-15T08:12:00.000Z",
    );
    expect(applied.version).toMatchObject({ value: 30, version: 2 });
    expect(() =>
      admin.applyPreview(editor, stale, "2026-12-15T08:13:00.000Z"),
    ).toThrow("M42_CONFIG_STALE_PREVIEW");
  });

  it("rolls back by creating a new approved version and preserves all history", () => {
    const admin = createSyntheticM42ConfigurationAdmin();
    const change = admin.previewChange(editor, {
      configKey: "search.result_limit",
      proposedValue: 40,
      reason: "Evaluate a larger deterministic synthetic search result page.",
      requestedAt: "2026-12-15T08:10:00.000Z",
    });
    admin.applyPreview(editor, change, "2026-12-15T08:11:00.000Z");
    const historyBefore = admin.history(editor, "search.result_limit");
    const rollback = admin.previewRollback(editor, {
      configKey: "search.result_limit",
      targetVersionId: historyBefore[0].versionId,
      reason:
        "Restore the prior tested result limit through a controlled rollback.",
      requestedAt: "2026-12-15T08:12:00.000Z",
    });
    expect(rollback).toMatchObject({
      action: "rollback",
      currentValue: 40,
      proposedValue: 25,
      approvalRequired: true,
      mutatesState: false,
    });
    const approval = admin.approvePreview(approver, rollback, {
      approvedAt: "2026-12-15T08:13:00.000Z",
      rationale: "The prior verified search limit should be restored.",
    });
    const result = admin.applyPreview(
      editor,
      rollback,
      "2026-12-15T08:14:00.000Z",
      approval,
    );

    expect(result.version).toMatchObject({
      version: 3,
      value: 25,
      changeType: "rollback",
      rollbackTargetVersionId: historyBefore[0].versionId,
    });
    expect(result.rollbackCreatedNewVersion).toBe(true);
    expect(admin.history(editor, "search.result_limit")).toHaveLength(3);
    expect(
      admin
        .history(editor, "search.result_limit")
        .map((version) => version.value),
    ).toEqual([25, 40, 25]);
    expect(result.auditEvents.map((event) => event.eventType)).toEqual([
      "configuration_validated",
      "configuration_rolled_back",
    ]);
  });

  it("rejects tampered previews and exposes audit only to an authorized reviewer", () => {
    const admin = createSyntheticM42ConfigurationAdmin();
    const preview = admin.previewChange(editor, {
      configKey: "workspace.documents.default_view",
      proposedValue: "owned",
      reason: "Prefer the synthetic documents owned by the current user.",
      requestedAt: "2026-12-15T08:10:00.000Z",
    });
    const tampered = { ...preview, proposedValue: "review_queue" };
    expect(() =>
      admin.applyPreview(editor, tampered, "2026-12-15T08:11:00.000Z"),
    ).toThrow("M42_CONFIG_PREVIEW_TAMPERED");
    expect(() => admin.snapshot(editor)).toThrow(
      "M42_CONFIG_AUDIT_PERMISSION_REQUIRED",
    );
    expect(admin.snapshot(approver)).toMatchObject({
      appendOnlyHistory: true,
      synthetic: true,
    });
    expect(admin.snapshot(approver).auditEvents[0]).toMatchObject({
      eventType: "configuration_validated",
      entityType: "configuration",
      immutable: true,
    });
    expect(() => admin.assertLiveConnectorMutationUnavailable()).toThrow(
      "M42_LIVE_CONFIGURATION_MUTATION_UNAVAILABLE",
    );
  });
});
