/**
 * Controlled Cypress 40-action Launch Matrix import into the existing M1 work_queue.
 *
 * Accepts a current, administrator-supplied SharePoint Launch Control Registry
 * snapshot at the Production release boundary, without copying the restricted
 * registry into this public source repository.
 *
 * Fail closed, insert missing actions only, and retain ALL existing work status,
 * assignees, evidence, comments and completion history. First admission Q04
 * remains held; ordinary M1 completion is blocked in api/routers/m1.ts.
 */
import { createHash } from "node:crypto";
import { sqlite, currentDataScope } from "../queries/connection";
import { env } from "../lib/env";
import { parseCypressLaunchMatrix } from "./staging-launch-matrix";

export const CYPRESS_LAUNCH_ENTITY_TYPE = "adolbi_cypress_launch_2026";
export const CYPRESS_LAUNCH_PREFIX = "ADL-LAUNCH-2026-";
export const CYPRESS_LAUNCH_REGISTRY_URL =
  "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/" +
  "06%20-%20GRO%20Operations%20%26%20Activation/" +
  "02%20-%20Operational%20Activation/" +
  "2026-09-09%20-%20AMOS-OPS%20Led%20Launch%20Doctrine/" +
  "Adolbi_AMOS_OPS_Launch_Control_Registry_v2_2026-11-21.json";

const PRIORITIES = { P0: "urgent", P1: "high", P2: "medium", P3: "low" } as const;

type RegistryAction = {
  id: string; title: string; priority: keyof typeof PRIORITIES; rank: number;
  original_due: string; lead: string; deps: string; status: string;
  immediate_action: string; approval: string;
};
type ExistingRow = {
  id: string; entity_type: string | null; entity_id: string | null;
  status: string; assigned_to: string | null; evidence_uploaded: number;
  task_title: string; evidence_required: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseAuthoritativeCypressRegistry(payload: string): RegistryAction[] {
  const json: unknown = JSON.parse(payload);
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("CYPRESS_REGISTRY_OBJECT_REQUIRED");
  }
  const root = json as Record<string, unknown>;
  if (!root.metadata || typeof root.metadata !== "object" ||
      Array.isArray(root.metadata) || !Array.isArray(root.actions)) {
    throw new Error("CYPRESS_REGISTRY_SOURCE_SHAPE_INVALID");
  }
  const metadata = root.metadata as Record<string, unknown>;
  if (metadata.work_item !== "ADL-AMOS-OPS-LAUNCH-2026-11" ||
      !text(metadata.repository_destination).startsWith(
        "https://adolbi.sharepoint.com/sites/CypressGRO/"
      )) {
    throw new Error("CYPRESS_REGISTRY_AUTHORITY_MISMATCH");
  }
  const sourceActions = root.actions.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("CYPRESS_REGISTRY_ACTION_INVALID");
    }
    const action = raw as Record<string, unknown>;
    if (action.verified_in_amos_ops !== false &&
        action.verified_in_amos_ops !== true) {
      throw new Error("CYPRESS_REGISTRY_VERIFICATION_STATE_INVALID");
    }
    // Do not turn a reporting status into approval or a task completion.
    if (action.id === "Q04" &&
        (action.source_status !== "On hold" || action.status !== "On hold")) {
      throw new Error("CYPRESS_FIRST_ADMISSION_HOLD_REQUIRED");
    }
    return {
      id: text(action.id),
      title: text(action.title),
      priority: text(action.priority),
      original_due: text(action.planned_due_original),
      lead: text(action.lead),
      deps: text(action.dependencies),
      status: text(action.source_status),
      rank: action.rank,
      immediate_action: text(action.immediate_action),
      approval: text(action.approval),
    };
  });
  const actions = parseCypressLaunchMatrix(JSON.stringify(sourceActions));
  const q04 = actions.find((a) => a.id === "Q04");
  if (!q04 || q04.status !== "On hold") {
    throw new Error("CYPRESS_FIRST_ADMISSION_HOLD_REQUIRED");
  }
  const distribution = root.priority_distribution;
  if (!distribution || typeof distribution !== "object" ||
      (distribution as Record<string, unknown>).P0 !== 14 ||
      (distribution as Record<string, unknown>).P1 !== 14 ||
      (distribution as Record<string, unknown>).P2 !== 9 ||
      (distribution as Record<string, unknown>).P3 !== 3) {
    throw new Error("CYPRESS_REGISTRY_PRIORITY_MISMATCH");
  }
  return actions;
}

function description(action: RegistryAction): string {
  return [
    "Controlled launch action " + action.id + " | " + action.priority +
      " | sequence " + action.rank + "/40",
    "Source status: " + action.status + "; original Houston due: " +
      action.original_due,
    "Original functional lead: " + action.lead,
    "Dependencies: " + action.deps,
    "Interim accountable: Eghosa O. Aideyan, Managing Director / Interim Logistics Manager",
    "Immediate next action: " + action.immediate_action,
    "Approval boundary: " + action.approval,
    "Authoritative SharePoint registry: " + CYPRESS_LAUNCH_REGISTRY_URL,
    "Evidence review and qualified approvals are required before closeout.",
    "First admission: HOLD. Q04 cannot be closed via ordinary M1 work queue.",
  ].join("\n");
}

export interface ProductionLaunchImportResult {
  actionCount: 40;
  inserted: number;
  retained: number;
  source: "production-operational";
  registrySha256: string;
  firstAdmissionHold: true;
}

/** Explicit release-controlled import; NEVER call from a user-facing request. */
export function importProductionCypressLaunchMatrix(
  payload: string,
): ProductionLaunchImportResult {
  if (!env.isProduction || currentDataScope() !== "operational") {
    throw new Error("CYPRESS_LAUNCH_PRODUCTION_OPERATIONAL_ONLY");
  }
  const actions = parseAuthoritativeCypressRegistry(payload);
  if (!sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='work_queue'",
  ).get()) {
    throw new Error("CYPRESS_LAUNCH_WORK_QUEUE_MISSING");
  }
  const getExisting = sqlite.prepare(
    "SELECT id, entity_type, entity_id, status, assigned_to, evidence_uploaded, " +
      "task_title, evidence_required FROM work_queue WHERE id = ?",
  );
  const insert = sqlite.prepare(
    "INSERT INTO work_queue " +
      "(id, task_title, task_type, description, assigned_to, assigned_by, " +
      "priority, status, entity_type, entity_id, workflow_id, " +
      "evidence_required, evidence_uploaded, due_date, created_at) " +
      "VALUES (?, ?, 'general', ?, NULL, 'AMOS-CYPRESS-REGISTRY-IMPORT', " +
      "?, 'pending', ?, ?, NULL, 1, 0, ?, datetime('now'))",
  );
  const byId = new Map(actions.map((a) => [a.id, a]));
  let inserted = 0;
  let retained = 0;
  sqlite.transaction(() => {
    for (const action of actions) {
      const id = CYPRESS_LAUNCH_PREFIX + action.id;
      const existing = getExisting.get(id) as ExistingRow | undefined;
      if (existing) {
        if (existing.entity_type !== CYPRESS_LAUNCH_ENTITY_TYPE ||
            existing.entity_id !== action.id ||
            existing.evidence_required !== 1) {
          throw new Error("CYPRESS_LAUNCH_EXISTING_TASK_CONFLICT:" + action.id);
        }
        if (action.id === "Q04" && existing.status === "completed") {
          throw new Error("CYPRESS_FIRST_ADMISSION_PREMATURE_CLOSURE");
        }
        // Do NOT overwrite status, assignments, title, evidence or history.
        retained += 1;
        continue;
      }
      const match = /\b(\d{1,2})\s+(Nov|Dec)\s+2026\b/.exec(action.original_due);
      if (!match) throw new Error("CYPRESS_LAUNCH_DUE_INVALID:" + action.id);
      const due = "2026-" + (match[2] === "Nov" ? "11" : "12") + "-" +
        String(Number(match[1])).padStart(2, "0");
      const title = "[" + action.priority + "-" +
        String(action.rank).padStart(2, "0") + "] " + action.id + " — " +
        (action.id === "Q04" ? "[FIRST ADMISSION HOLD] " : "") + action.title;
      insert.run(id, title, description(action), PRIORITIES[action.priority],
        CYPRESS_LAUNCH_ENTITY_TYPE, action.id, due);
      inserted += 1;
    }
    const rows = sqlite.prepare(
      "SELECT id, entity_id, status FROM work_queue WHERE entity_type = ?",
    ).all(CYPRESS_LAUNCH_ENTITY_TYPE) as Array<{id: string; entity_id: string; status: string}>;
    if (rows.length !== 40 ||
        rows.some((row) => row.id !== CYPRESS_LAUNCH_PREFIX + row.entity_id ||
          !byId.has(row.entity_id))) {
      throw new Error("CYPRESS_LAUNCH_READBACK_INCOMPLETE_OR_DUPLICATE");
    }
    if (rows.find((row) => row.entity_id === "Q04")?.status === "completed") {
      throw new Error("CYPRESS_FIRST_ADMISSION_PREMATURE_CLOSURE");
    }
  })();
  return {
    actionCount: 40, inserted, retained, source: "production-operational",
    registrySha256: createHash("sha256").update(payload).digest("hex"),
    firstAdmissionHold: true,
  };
}
