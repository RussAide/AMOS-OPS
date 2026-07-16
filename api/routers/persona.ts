import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════
// Persona Router — Pilot Activation System
// ═══════════════════════════════════════════════════════════════
//
// 6 Pilot Personas (status = 'pilot' — visible in UI):
//   AMOS-Core, AMOS-Clinical, AMOS-GRO, AMOS-Sentinel,
//   AMOS-Scribe, AMOS-Revenue
//
// 7 Deferred Personas (status = 'deferred' — hidden from UI):
//   AMOS-HR, AMOS-Prime, AMOS-NXL, AMOS-THESIS, AMOS-DMS,
//   AMOS-Coach, AMOS-Strategy
//
// Status values: "active" | "pilot" | "deferred"
// ═══════════════════════════════════════════════════════════════

// ─── Row mapper: DB row → API shape ───────────────────────────
interface PersonaRow {
  id: string;
  key: string;
  name: string;
  code: string;
  description: string;
  scope: string | null;
  boundaries_json: string | null;
  status: "active" | "pilot" | "deferred";
  wave: string | null;
  category: string | null;
  color: string | null;
  icon: string | null;
  permissions: string | null;
  outputs: string | null;
  activated_at: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  trigger_conditions: string | null;
}

interface TriggerCondition {
  type: "keyword" | "module";
  pattern: string;
}

function mapPersonaRow(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as PersonaRow;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    code: row.code,
    description: row.description,
    scope: row.scope ?? null,
    boundaries: row.boundaries_json ? JSON.parse(row.boundaries_json) : [],
    status: row.status as "active" | "pilot" | "deferred",
    wave: row.wave ?? null,
    category: row.category ?? null,
    color: row.color ?? null,
    icon: row.icon ?? null,
    permissions: row.permissions ? JSON.parse(row.permissions) : [],
    outputs: row.outputs ? JSON.parse(row.outputs) : [],
    activatedAt: row.activated_at ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export const personaRouter = createRouter({
  // ═════════════════════════════════════════════════════════════
  // NEW ENDPOINTS (Pilot Activation System)
  // ═════════════════════════════════════════════════════════════

  /**
   * listPersonas — Returns all 13 personas with their status.
   * Authed users can see both pilot and deferred personas.
   */
  listPersonas: authedQuery.query(async () => {
    const rows = sqlite
      .prepare(
        "SELECT * FROM agent_personas ORDER BY sort_order ASC, name ASC"
      )
      .all();
    return (rows ?? []).map(mapPersonaRow);
  }),

  /**
   * getPersona — Returns a single persona by its unique key.
   * Keys are: amos-core, amos-clinical, amos-gro, amos-sentinel,
   * amos-scribe, amos-revenue, amos-hr, amos-prime, amos-nxl,
   * amos-thesis, amos-dms, amos-coach, amos-strategy
   */
  getPersona: authedQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare("SELECT * FROM agent_personas WHERE key = ?")
        .get(input.key);
      return mapPersonaRow(row);
    }),

  /**
   * listPilotPersonas — Returns ONLY the 6 pilot personas.
   * These are the only personas that appear in the UI.
   * Status = 'pilot' (active in the pilot program).
   */
  listPilotPersonas: authedQuery.query(async () => {
    const rows = sqlite
      .prepare(
        "SELECT * FROM agent_personas WHERE status = 'pilot' ORDER BY sort_order ASC, name ASC"
      )
      .all();
    return (rows ?? []).map(mapPersonaRow);
  }),

  /**
   * activatePersona — Admin-only mutation to promote a deferred
   * persona to pilot (active) status.
   */
  activatePersona: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const row = sqlite
        .prepare("SELECT * FROM agent_personas WHERE key = ?")
        .get(input.key);
      if (!row) throw new Error(`Persona '${input.key}' not found`);

      const currentStatus = (row as PersonaRow).status;
      if (currentStatus === "pilot" || currentStatus === "active") {
        throw new Error(
          `Persona '${input.key}' is already ${currentStatus}; cannot activate`
        );
      }

      const now = new Date().toISOString();
      sqlite
        .prepare(
          "UPDATE agent_personas SET status = 'pilot', activated_at = ?, updated_at = ? WHERE key = ?"
        )
        .run(now, now, input.key);

      return {
        success: true,
        key: input.key,
        previousStatus: currentStatus,
        newStatus: "pilot",
        activatedBy: ctx.user.email,
        activatedAt: now,
      };
    }),

  /**
   * deactivatePersona — Admin-only mutation to demote a pilot
   * persona back to deferred status.
   */
  deactivatePersona: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const row = sqlite
        .prepare("SELECT * FROM agent_personas WHERE key = ?")
        .get(input.key);
      if (!row) throw new Error(`Persona '${input.key}' not found`);

      const currentStatus = (row as PersonaRow).status;
      if (currentStatus === "deferred") {
        throw new Error(
          `Persona '${input.key}' is already deferred; cannot deactivate`
        );
      }

      const now = new Date().toISOString();
      sqlite
        .prepare(
          "UPDATE agent_personas SET status = 'deferred', activated_at = NULL, updated_at = ? WHERE key = ?"
        )
        .run(now, input.key);

      return {
        success: true,
        key: input.key,
        previousStatus: currentStatus,
        newStatus: "deferred",
        deactivatedBy: ctx.user.email,
        deactivatedAt: now,
      };
    }),

  // ═════════════════════════════════════════════════════════════
  // BACKWARD COMPATIBILITY ENDPOINTS (existing)
  // ═════════════════════════════════════════════════════════════

  /**
   * list — Returns active personas (status = 'pilot').
   * Legacy endpoint; superseded by listPilotPersonas.
   */
  list: publicQuery.query(async () => {
    const rows = sqlite
      .prepare(
        "SELECT * FROM agent_personas WHERE status = 'pilot' ORDER BY name"
      )
      .all();
    return (rows ?? []).map(mapPersonaRow);
  }),

  /**
   * getById — Returns a single persona by id.
   * Legacy endpoint; superseded by getPersona (uses key).
   */
  getById: publicQuery
    .input(z.object({ personaId: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare("SELECT * FROM agent_personas WHERE id = ?")
        .get(input.personaId);
      return mapPersonaRow(row);
    }),

  /**
   * findTriggered — Returns personas whose trigger conditions match
   * the query text and current path.
   */
  findTriggered: publicQuery
    .input(
      z.object({
        queryText: z.string(),
        currentPath: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const personas = sqlite
        .prepare("SELECT * FROM agent_personas WHERE status = 'pilot'")
        .all();
      const query = input.queryText.toLowerCase();
      const path = input.currentPath ?? "";

      return (personas as PersonaRow[])
        .filter((p) => {
          if (!p.trigger_conditions) return false;
          try {
            const triggers = JSON.parse(p.trigger_conditions) as TriggerCondition[];
            return triggers.some((t) => {
              if (t.type === "keyword")
                return new RegExp(t.pattern, "i").test(query);
              if (t.type === "module")
                return path.startsWith(t.pattern);
              return false;
            });
          } catch {
            return false;
          }
        })
        .map(mapPersonaRow);
    }),

  /**
   * interact — Records a persona interaction.
   */
  interact: publicQuery
    .input(
      z.object({
        personaId: z.string(),
        queryText: z.string(),
        contextData: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const persona = sqlite
        .prepare("SELECT * FROM agent_personas WHERE id = ?")
        .get(input.personaId);
      if (!persona) throw new Error("Persona not found");

      const id = randomUUID();
      sqlite
        .prepare(
          "INSERT INTO persona_interactions (id, persona_id, query_text, response_text, context_data, status, started_at) VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))"
        )
        .run(
          id,
          input.personaId,
          input.queryText,
          `Response from ${(persona as PersonaRow).name}: Processing your request about "${input.queryText}"...`,
          input.contextData ?? null
        );

      return sqlite
        .prepare("SELECT * FROM persona_interactions WHERE id = ?")
        .get(id);
    }),

  /**
   * listInteractions — Lists persona interaction history.
   */
  listInteractions: publicQuery
    .input(z.object({ personaId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.personaId) {
        return (
          sqlite
            .prepare(
              "SELECT * FROM persona_interactions WHERE persona_id = ? ORDER BY started_at DESC LIMIT 50"
            )
            .all(input.personaId) ?? []
        );
      }
      return (
        sqlite
          .prepare(
            "SELECT * FROM persona_interactions ORDER BY started_at DESC LIMIT 50"
          )
          .all() ?? []
      );
    }),
});
