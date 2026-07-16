import { z } from "zod";
import { createRouter, publicQuery, roleQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { ensurePhase2ControlSchema, seedPhase2ControlScenario } from "../services/phase2/runtime-schema";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

type Row = Record<string, unknown>;

function rows(sql: string, ...params: unknown[]): Row[] {
  return sqlite.prepare(sql).all(...params) as Row[];
}

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function overview(episodeId?: string) {
  ensurePhase2ControlSchema();
  const episode = episodeId
    ? sqlite.prepare("SELECT * FROM phase2_care_episodes WHERE id = ?").get(episodeId) as Row | undefined
    : sqlite.prepare("SELECT * FROM phase2_care_episodes ORDER BY updated_at DESC LIMIT 1").get() as Row | undefined;
  if (!episode) return { initialized: false, episode: null, workItems: [], alerts: [], links: [], handoffs: [], claimHandoffs: [], auditEvents: [], scenarios: [] };
  const id = String(episode.id);
  return {
    initialized: true,
    episode,
    workItems: rows("SELECT * FROM phase2_work_items WHERE episode_id = ? ORDER BY due_at, domain", id),
    alerts: rows("SELECT * FROM phase2_alerts WHERE episode_id = ? ORDER BY due_at, domain", id),
    links: rows("SELECT * FROM phase2_care_links WHERE episode_id = ? ORDER BY source_domain, target_domain", id),
    handoffs: rows("SELECT *, json(payload_json) AS payload FROM phase2_handoffs WHERE episode_id = ? ORDER BY initiated_at", id).map((row) => ({ ...row, payload: parseJson(row.payload_json, {}) })),
    claimHandoffs: rows("SELECT * FROM phase2_claim_handoffs WHERE episode_id = ? ORDER BY decided_at", id).map((row) => ({ ...row, findings: parseJson(row.findings_json, []) })),
    auditEvents: rows("SELECT * FROM phase2_audit_events WHERE episode_id = ? ORDER BY occurred_at DESC", id).map((row) => ({ ...row, before: parseJson(row.before_json, undefined), after: parseJson(row.after_json, undefined), changedFields: parseJson(row.changed_fields_json, []) })),
    scenarios: rows("SELECT * FROM phase2_scenario_runs WHERE episode_id = ? ORDER BY milestone, started_at", id).map((row) => ({ ...row, evidence: parseJson(row.evidence_json, {}) })),
  };
}

export const phase2Router = createRouter({
  overview: publicQuery.input(z.object({ episodeId: z.string().optional() }).optional()).query(({ input }) => overview(input?.episodeId)),
  seedDemo: roleQuery(["super-admin", "managing-director", "administrator"]).mutation(() => {
    assertSyntheticScenarioRuntime(env);
    seedPhase2ControlScenario();
    return overview("SYNTH-PHASE2-EPISODE-001");
  }),
});
