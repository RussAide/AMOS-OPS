/**
 * Adolbi Cypress launch-matrix staging ingestion.
 * Isolated, idempotent, and deliberately unavailable in Production.
 *
 * Source: SharePoint-controlled 40-action launch registry, November 21, 2026.
 * Do not insert patient, youth, clinical, credential, or personal records.
 */
import { sqlite, currentDataScope } from "../queries/connection";
import { env } from "../lib/env";

type LaunchPriority = "P0" | "P1" | "P2" | "P3";
type QueuePriority = "urgent" | "high" | "medium" | "low";

interface LaunchAction {
  id: string;
  title: string;
  priority: LaunchPriority;
  original_due: string;
  lead: string;
  deps: string;
  status: string;
  rank: number;
  immediate_action: string;
  approval: string;
}

const PREFIX = "ADL-LAUNCH-2026-";
const ENTITY_TYPE = "adolbi_cypress_launch_2026";
const SOURCE_URL =
  "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/" +
  "06%20-%20GRO%20Operations%20%26%20Activation/" +
  "02%20-%20Operational%20Activation/" +
  "2026-09-09%20-%20AMOS-OPS%20Led%20Launch%20Doctrine/" +
  "Adolbi_AMOS_OPS_Launch_Control_Registry_v2_2026-11-21.json";

const expectedActionIds = new Set(
  ["G", "C", "W", "S", "B", "N", "O", "F", "T", "Q"].flatMap((prefix) =>
    [1, 2, 3, 4].map((number) => prefix + "0" + number),
  ),
);

const priorityMapping: Record<LaunchPriority, QueuePriority> = {
  P0: "urgent",
  P1: "high",
  P2: "medium",
  P3: "low",
};

function requireText(value: unknown, name: string, maximum = 1200): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error("CYPRESS_LAUNCH_INVALID_" + name);
  }
  return value.trim();
}

function originalHoustonDue(value: string): string {
  const match = /\b(\d{1,2})\s+(Nov|Dec)\s+2026\b/.exec(value);
  if (!match) {
    throw new Error("CYPRESS_LAUNCH_INVALID_DUE_DATE");
  }
  const day = Number(match[1]);
  const month = match[2] === "Nov" ? "11" : "12";
  if (day < 1 || day > 31) {
    throw new Error("CYPRESS_LAUNCH_INVALID_DUE_DAY");
  }
  return "2026-" + month + "-" + String(day).padStart(2, "0");
}

export function parseCypressLaunchMatrix(input: string): LaunchAction[] {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error("CYPRESS_LAUNCH_INVALID_JSON");
  }
  if (!Array.isArray(raw) || raw.length !== 40) {
    throw new Error("CYPRESS_LAUNCH_REQUIRES_40_ACTIONS");
  }
  const seen = new Set<string>();
  const ranks = new Set<number>();
  const validated: LaunchAction[] = raw.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("CYPRESS_LAUNCH_INVALID_ROW");
    }
    const row = value as Record<string, unknown>;
    const id = requireText(row.id, "ID", 3);
    if (!expectedActionIds.has(id) || seen.has(id)) {
      throw new Error("CYPRESS_LAUNCH_DUPLICATE_OR_UNKNOWN_ID");
    }
    seen.add(id);
    const priority = requireText(row.priority, "PRIORITY", 2) as LaunchPriority;
    if (!Object.prototype.hasOwnProperty.call(priorityMapping, priority)) {
      throw new Error("CYPRESS_LAUNCH_INVALID_PRIORITY");
    }
    const rank = row.rank;
    if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 1 ||
        rank > 40 || ranks.has(rank)) {
      throw new Error("CYPRESS_LAUNCH_INVALID_RANK");
    }
    ranks.add(rank);
    const original_due = requireText(row.original_due, "DUE_DATE", 40);
    originalHoustonDue(original_due);
    const status = requireText(row.status, "SOURCE_STATUS", 40);
    if (!["Planned", "Evidence needed", "On hold"].includes(status)) {
      throw new Error("CYPRESS_LAUNCH_INVALID_SOURCE_STATUS");
    }
    return {
      id,
      title: requireText(row.title, "TITLE", 250),
      priority,
      original_due,
      lead: requireText(row.lead, "LEAD", 160),
      deps: requireText(row.deps, "DEPENDENCIES", 160),
      status,
      rank,
      immediate_action: requireText(row.immediate_action, "NEXT_ACTION", 1600),
      approval: requireText(row.approval, "APPROVAL", 1200),
    };
  });
  if (seen.size !== expectedActionIds.size) {
    throw new Error("CYPRESS_LAUNCH_INCOMPLETE_ACTION_SET");
  }
  const distribution = validated.reduce<Record<LaunchPriority, number>>(
    (result, action) => {
      result[action.priority] += 1;
      return result;
    }, { P0: 0, P1: 0, P2: 0, P3: 0 },
  );
  if (distribution.P0 !== 14 || distribution.P1 !== 14 ||
      distribution.P2 !== 9 || distribution.P3 !== 3) {
    throw new Error("CYPRESS_LAUNCH_UNEXPECTED_PRIORITY_DISTRIBUTION");
  }
  return validated.sort((left, right) => left.rank - right.rank);
}

function descriptionFor(row: LaunchAction): string {
  const entries = [
    "Controlled launch action " + row.id + " | " + row.priority +
      " | sequence " + row.rank + "/40",
    "Source status: " + row.status + "; original Houston due: " +
      row.original_due,
    "Original functional lead: " + row.lead,
    "Dependencies: " + row.deps,
    "Interim accountable: Eghosa O. Aideyan, Managing Director and " +
      "Interim Logistics Manager; unstaffed functional vacancies remain open",
    "Immediate next action: " + row.immediate_action,
    "Internal/qualified approval boundary: " + row.approval,
    "Authoritative registry: " + SOURCE_URL,
    "Production change: NOT AUTHORIZED. First admission: HOLD.",
  ];
  return entries.join("\n");
}

interface ExistingQueueRow {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface LaunchMatrixSeedResult {
  actionCount: number;
  inserted: number;
  reconciled: number;
  source: "staging-training";
  distribution: Record<LaunchPriority, number>;
}

/**
 * Only call inside runWithDataScope("training") on the Railway Staging host.
 * Never writes to operational SQLite. A conflicting ID fails closed.
 */
export function seedCypressLaunchTrainingMatrix(
  payload: string,
): LaunchMatrixSeedResult {
  if (!env.isStaging || env.isProduction || currentDataScope() !== "training") {
    throw new Error("CYPRESS_LAUNCH_STAGING_TRAINING_ONLY");
  }
  const actions = parseCypressLaunchMatrix(payload);
  const table = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'work_queue'",
  ).get();
  if (!table) {
    throw new Error("CYPRESS_LAUNCH_WORK_QUEUE_MISSING");
  }
  const find = sqlite.prepare(
    "SELECT id, entity_type, entity_id FROM work_queue WHERE id = ?",
  );
  const insert = sqlite.prepare(
    "INSERT INTO work_queue " +
      "(id, task_title, task_type, description, assigned_to, assigned_by, " +
      "priority, status, entity_type, entity_id, workflow_id, " +
      "evidence_required, evidence_uploaded, due_date, created_at) " +
      "VALUES (?, ?, 'general', ?, NULL, 'AMOS-STAGING-LAUNCH-SEED', " +
      "?, 'pending', ?, ?, NULL, 1, 0, ?, datetime('now'))",
  );
  const reconcile = sqlite.prepare(
    "UPDATE work_queue SET task_title = ?, description = ?, " +
      "priority = ?, due_date = ? WHERE id = ? " +
      "AND entity_type = ? AND entity_id = ?",
  );
  let inserted = 0;
  let reconciled = 0;
  const run = sqlite.transaction(() => {
    for (const action of actions) {
      const id = PREFIX + action.id;
      const existing = find.get(id) as ExistingQueueRow | undefined;
      if (existing && (existing.entity_type !== ENTITY_TYPE ||
          existing.entity_id !== action.id)) {
        throw new Error("CYPRESS_LAUNCH_TASK_ID_CONFLICT");
      }
      const title = "[" + action.priority + "-" + String(action.rank).padStart(2, "0") + "] " + action.id + " — " +
        (action.id === "Q04" ? "[FIRST ADMISSION HOLD] " : "") +
        action.title;
      const description = descriptionFor(action);
      const priority = priorityMapping[action.priority];
      const due = originalHoustonDue(action.original_due);
      if (existing) {
        const result = reconcile.run(
          title, description, priority, due, id, ENTITY_TYPE, action.id,
        );
        if (result.changes !== 1) {
          throw new Error("CYPRESS_LAUNCH_RECONCILE_FAILED");
        }
        reconciled += 1;
      } else {
        insert.run(
          id, title, description, priority, ENTITY_TYPE, action.id, due,
        );
        inserted += 1;
      }
    }
  });
  run();
  const persisted = sqlite.prepare(
    "SELECT id, entity_id, priority FROM work_queue " +
    "WHERE entity_type = ? AND id LIKE ?",
  ).all(ENTITY_TYPE, PREFIX + "%") as Array<{
    id: string; entity_id: string; priority: string;
  }>;
  if (persisted.length !== 40 ||
      persisted.some((row) => !expectedActionIds.has(row.entity_id) ||
        row.id !== PREFIX + row.entity_id)) {
    throw new Error("CYPRESS_LAUNCH_PERSISTED_COUNT_MISMATCH");
  }
  return {
    actionCount: persisted.length,
    inserted,
    reconciled,
    source: "staging-training",
    distribution: {
      P0: persisted.filter((row) => row.priority === "urgent").length,
      P1: persisted.filter((row) => row.priority === "high").length,
      P2: persisted.filter((row) => row.priority === "medium").length,
      P3: persisted.filter((row) => row.priority === "low").length,
    },
  };
}
