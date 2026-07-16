import type Database from "better-sqlite3";
import {
  assertSyntheticBoundary,
  changedFieldNames,
  stablePhase2Id,
  type Phase2Actor,
  type Phase2Alert,
  type Phase2AuditEvent,
  type Phase2CareEpisode,
  type Phase2ClaimHandoff,
  type Phase2Domain,
  type Phase2Handoff,
  type Phase2ScenarioRun,
  type Phase2WorkItem,
} from "@contracts/phase2";

type SqliteDatabase = Database.Database;

export class Phase2ControlStore {
  constructor(private readonly db: SqliteDatabase) {}

  saveEpisode(episode: Phase2CareEpisode, actor: Phase2Actor, reason: string): void {
    assertSyntheticBoundary({ id: episode.id, evidenceClass: episode.evidenceClass });
    const previous = this.db.prepare("SELECT * FROM phase2_care_episodes WHERE id = ?").get(episode.id) as Record<string, unknown> | undefined;
    this.db.prepare(`
      INSERT INTO phase2_care_episodes (
        id, case_id, referral_id, youth_id, youth_display_label, evidence_class, status,
        cans_assessment_id, cans_version, mhtcm_plan_id, mhrs_plan_id, gro_placement_id,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        cans_assessment_id = excluded.cans_assessment_id,
        cans_version = excluded.cans_version,
        mhtcm_plan_id = excluded.mhtcm_plan_id,
        mhrs_plan_id = excluded.mhrs_plan_id,
        gro_placement_id = excluded.gro_placement_id,
        version = excluded.version,
        updated_at = excluded.updated_at
    `).run(
      episode.id, episode.caseId, episode.referralId, episode.youthId, episode.youthDisplayLabel,
      episode.evidenceClass, episode.status, episode.cansAssessmentId ?? null, episode.cansVersion ?? null,
      episode.mhtcmPlanId ?? null, episode.mhrsPlanId ?? null, episode.groPlacementId ?? null,
      episode.version, episode.createdAt, episode.updatedAt,
    );
    this.appendAudit({
      id: stablePhase2Id("SYNTH-AUD", episode.id, String(episode.version), reason),
      episodeId: episode.id,
      domain: "SHARED",
      eventType: "material_change",
      action: previous ? "episode.updated" : "episode.created",
      entityType: "care_episode",
      entityId: episode.id,
      actorId: actor.id,
      actorRole: actor.role,
      reason,
      before: previous,
      after: episode as unknown as Record<string, unknown>,
      changedFields: changedFieldNames(previous, episode as unknown as Record<string, unknown>),
      correlationId: episode.caseId,
      evidenceClass: episode.evidenceClass,
      occurredAt: episode.updatedAt,
    });
  }

  getEpisode(id: string): Phase2CareEpisode | undefined {
    const row = this.db.prepare("SELECT * FROM phase2_care_episodes WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id), caseId: String(row.case_id), referralId: String(row.referral_id),
      youthId: String(row.youth_id), youthDisplayLabel: String(row.youth_display_label),
      evidenceClass: row.evidence_class as Phase2CareEpisode["evidenceClass"],
      status: row.status as Phase2CareEpisode["status"],
      cansAssessmentId: row.cans_assessment_id ? String(row.cans_assessment_id) : undefined,
      cansVersion: row.cans_version === null ? undefined : Number(row.cans_version),
      mhtcmPlanId: row.mhtcm_plan_id ? String(row.mhtcm_plan_id) : undefined,
      mhrsPlanId: row.mhrs_plan_id ? String(row.mhrs_plan_id) : undefined,
      groPlacementId: row.gro_placement_id ? String(row.gro_placement_id) : undefined,
      version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  createWorkItem(item: Phase2WorkItem): void {
    this.db.prepare(`INSERT INTO phase2_work_items
      (id, episode_id, domain, title, source_type, source_id, status, priority, assigned_role,
       assigned_to, due_at, escalation_level, escalated_at, escalation_reason, exception_code,
       exception_reason, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(item.id, item.episodeId, item.domain, item.title, item.sourceType, item.sourceId, item.status,
        item.priority, item.assignedRole, item.assignedTo ?? null, item.dueAt, item.escalationLevel,
        item.escalatedAt ?? null, item.escalationReason ?? null, item.exceptionCode ?? null,
        item.exceptionReason ?? null, item.version, item.createdAt, item.updatedAt);
  }

  createAlert(alert: Phase2Alert): void {
    this.db.prepare(`INSERT INTO phase2_alerts
      (id, episode_id, domain, alert_type, source_type, source_id, title, status, priority, due_at,
       assigned_role, assigned_to, escalation_level, acknowledged_at, resolved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(alert.id, alert.episodeId, alert.domain, alert.alertType, alert.sourceType, alert.sourceId,
        alert.title, alert.status, alert.priority, alert.dueAt, alert.assignedRole,
        alert.assignedTo ?? null, alert.escalationLevel, alert.acknowledgedAt ?? null,
        alert.resolvedAt ?? null, alert.createdAt);
  }

  createHandoff(handoff: Phase2Handoff): void {
    this.db.prepare(`INSERT INTO phase2_handoffs
      (id, episode_id, from_domain, to_domain, status, reason, payload_json, initiated_by,
       initiated_at, due_at, accepted_by, accepted_at, completed_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(handoff.id, handoff.episodeId, handoff.fromDomain, handoff.toDomain, handoff.status,
        handoff.reason, JSON.stringify(handoff.payload), handoff.initiatedBy, handoff.initiatedAt,
        handoff.dueAt, handoff.acceptedBy ?? null, handoff.acceptedAt ?? null,
        handoff.completedAt ?? null, handoff.version);
  }

  recordClaimHandoff(handoff: Phase2ClaimHandoff): void {
    this.db.prepare(`INSERT INTO phase2_claim_handoffs
      (id, episode_id, program, encounter_id, procedure_code, status, findings_json,
       evaluator_version, decided_at, handed_off_at, correlation_id, evidence_class)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(handoff.id, handoff.episodeId, handoff.program, handoff.encounterId,
        handoff.procedureCode, handoff.status, JSON.stringify(handoff.findings),
        handoff.evaluatorVersion, handoff.decidedAt, handoff.handedOffAt ?? null,
        handoff.correlationId, handoff.evidenceClass);
  }

  saveSnapshot(input: {
    id: string; episodeId: string; domain: Phase2Domain; aggregateType: string;
    aggregateId: string; aggregateVersion: number; payload: Readonly<Record<string, unknown>>;
    evidenceClass: "synthetic_demo"; createdAt: string;
  }): void {
    assertSyntheticBoundary({ id: input.id, evidenceClass: input.evidenceClass });
    const transaction = this.db.transaction(() => {
      this.db.prepare(`UPDATE phase2_program_snapshots SET is_current = 0
        WHERE domain = ? AND aggregate_type = ? AND aggregate_id = ? AND is_current = 1`)
        .run(input.domain, input.aggregateType, input.aggregateId);
      this.db.prepare(`INSERT INTO phase2_program_snapshots
        (id, episode_id, domain, aggregate_type, aggregate_id, aggregate_version, payload_json,
         evidence_class, is_current, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
        .run(input.id, input.episodeId, input.domain, input.aggregateType, input.aggregateId,
          input.aggregateVersion, JSON.stringify(input.payload), input.evidenceClass, input.createdAt);
    });
    transaction();
  }

  recordScenario(run: Phase2ScenarioRun): void {
    this.db.prepare(`INSERT INTO phase2_scenario_runs
      (id, milestone, scenario_type, status, episode_id, started_at, completed_at,
       assertions_passed, assertions_failed, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at,
       assertions_passed = excluded.assertions_passed, assertions_failed = excluded.assertions_failed,
       evidence_json = excluded.evidence_json`)
      .run(run.id, run.milestone, run.scenarioType, run.status, run.episodeId, run.startedAt,
        run.completedAt ?? null, run.assertionsPassed, run.assertionsFailed, JSON.stringify(run.evidence));
  }

  appendAudit(event: Phase2AuditEvent): void {
    this.db.prepare(`INSERT INTO phase2_audit_events
      (id, episode_id, domain, event_type, action, entity_type, entity_id, actor_id, actor_role,
       reason, before_json, after_json, changed_fields_json, correlation_id, evidence_class, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(event.id, event.episodeId ?? null, event.domain, event.eventType, event.action,
        event.entityType, event.entityId, event.actorId, event.actorRole, event.reason,
        event.before ? JSON.stringify(event.before) : null,
        event.after ? JSON.stringify(event.after) : null,
        JSON.stringify(event.changedFields), event.correlationId, event.evidenceClass, event.occurredAt);
  }
}
