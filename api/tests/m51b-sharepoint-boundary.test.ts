import { describe, expect, it } from "vitest";
import { M51B_EVIDENCE_CLASS } from "@contracts/m51b/shared";
import { runM51bApprovedSharePointSync } from "../services/m51b/sharepoint/sync";

describe("M5.1B SharePoint synthetic boundary and audit evidence", () => {
  it("records a complete immutable SharePoint audit chain", async () => {
    const result = await runM51bApprovedSharePointSync();
    expect(result.auditEvents).toHaveLength(15);
    expect(new Set(result.auditEvents.map((event) => event.eventId)).size).toBe(
      15,
    );
    expect(
      result.auditEvents.every(
        (event) =>
          event.channel === "sharepoint" &&
          event.correlationId === result.correlationId &&
          event.immutable &&
          event.synthetic &&
          event.evidenceClass === M51B_EVIDENCE_CLASS &&
          Object.isFrozen(event),
      ),
    ).toBe(true);
    expect(result.auditEvents.map((event) => event.eventType)).toEqual([
      "sharepoint_governance_gates_evaluated",
      "sharepoint_stale_etag_conflict_detected",
      "sharepoint_outage_retry_scheduled",
      "sharepoint_approved_content_delivered",
      "sharepoint_idempotent_replay_prevented",
      "sharepoint_source_target_reconciled",
      "sharepoint_checkpoint_recorded",
      "sharepoint_synthetic_boundary_verified",
      "m51b.integration.dead_lettered",
      "sharepoint_operational_alert_verified",
      "sharepoint_recovery_gates_revalidated",
      "m51b.integration.delivered",
      "m51b.integration.dead_letter_recovered",
      "sharepoint_recovery_reconciled",
      "m51b.integration.duplicate_suppressed",
    ]);
  });

  it("proves zero live Microsoft activity and zero real content use", async () => {
    const result = await runM51bApprovedSharePointSync();
    expect(result).toMatchObject({
      productionRows: 0,
      liveGraphCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveWrites: 0,
      realDataUsed: false,
      realFileContentRead: false,
      synthetic: true,
      accepted: true,
    });
    expect(result.boundary).toMatchObject({
      syntheticOnly: true,
      realDataUsed: false,
      realFileContentRead: false,
      liveGraphCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      realNotificationsSent: 0,
      realMailRead: 0,
      productionRows: 0,
      liveWrites: 0,
      liveConnectorMutation: false,
      tenantProvisioning: false,
      productionSecretRead: false,
      productionDeployment: false,
      githubPush: false,
    });
    expect(result.adapterMetrics).toMatchObject({
      syntheticMutations: 1,
      blockedLiveOperations: 0,
      liveGraphCalls: 0,
      liveWrites: 0,
      credentialReads: 0,
    });
  });
});
