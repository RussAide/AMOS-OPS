import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

export const personaRouter = createRouter({
  list: publicQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM agent_personas WHERE is_active = 1 ORDER BY name").all() ?? [];
  }),

  getById: publicQuery
    .input(z.object({ personaId: z.string() }))
    .query(async ({ input }) => {
      return sqlite.prepare("SELECT * FROM agent_personas WHERE persona_id = ?").get(input.personaId) ?? null;
    }),

  findTriggered: publicQuery
    .input(z.object({ queryText: z.string(), currentPath: z.string().optional() }))
    .query(async ({ input }) => {
      const personas = sqlite.prepare("SELECT * FROM agent_personas WHERE is_active = 1").all() ?? [];
      const query = input.queryText.toLowerCase();
      const path = input.currentPath ?? "";

      return (personas as any[]).filter((p: any) => {
        if (!p.trigger_conditions) return false;
        try {
          const triggers = JSON.parse(p.trigger_conditions);
          return triggers.some((t: any) => {
            if (t.type === "keyword") return new RegExp(t.pattern, "i").test(query);
            if (t.type === "module") return path.startsWith(t.pattern);
            return false;
          });
        } catch {
          return false;
        }
      });
    }),

  interact: publicQuery
    .input(z.object({
      personaId: z.string(),
      queryText: z.string(),
      contextData: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const persona = sqlite.prepare("SELECT * FROM agent_personas WHERE persona_id = ?").get(input.personaId);
      if (!persona) throw new Error("Persona not found");

      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO persona_interactions (id, persona_id, query_text, response_text, context_data, status, started_at) VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))"
      ).run(id, input.personaId, input.queryText, `Response from ${(persona as any).name}: Processing your request about "${input.queryText}"...`, input.contextData ?? null);

      return sqlite.prepare("SELECT * FROM persona_interactions WHERE id = ?").get(id);
    }),

  listInteractions: publicQuery
    .input(z.object({ personaId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.personaId) {
        return sqlite.prepare("SELECT * FROM persona_interactions WHERE persona_id = ? ORDER BY started_at DESC LIMIT 50").all(input.personaId) ?? [];
      }
      return sqlite.prepare("SELECT * FROM persona_interactions ORDER BY started_at DESC LIMIT 50").all() ?? [];
    }),
});
