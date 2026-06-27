import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── NIL: Network Intelligence Layer ─────────────────────────
// Knowledge graph connecting entities across all modules

export const nilRouter = createRouter({
  // ─── Auto-index all modules ────────────────────────────────

  reindex: adminQuery.mutation(async () => {
    // Clear existing
    sqlite.exec("DELETE FROM nil_relationships");
    sqlite.exec("DELETE FROM nil_entities");

    // Index patients
    const patients = sqlite.prepare("SELECT id, first_name, last_name, status, assigned_clinician_id, mrn FROM patients").all() ?? [];
    for (const p of patients as any[]) {
      const eid = randomUUID();
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'patient', ?, 'patients', ?, ?, ?, 'bhc')"
      ).run(eid, p.id, `${p.last_name}, ${p.first_name}`, `MRN: ${p.mrn}, Status: ${p.status}`, JSON.stringify({ mrn: p.mrn, status: p.status }));
      if (p.assigned_clinician_id) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'assigned_to', 1.0)"
        ).run(randomUUID(), eid, p.assigned_clinician_id);
      }
    }

    // Index clinicians
    const clinicians = sqlite.prepare("SELECT id, first_name, last_name, role, department FROM hr_people WHERE department = 'Clinical' OR department = 'HR'").all() ?? [];
    for (const c of clinicians as any[]) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'person', ?, 'hr_people', ?, ?, ?, ?)"
      ).run(randomUUID(), c.id, `${c.first_name} ${c.last_name}`, c.role, JSON.stringify({ department: c.department, role: c.role }), c.department?.toLowerCase() ?? "hr");
    }

    // Index treatment plans
    const plans = sqlite.prepare("SELECT id, patient_id, plan_number, primary_diagnosis, status, assigned_clinician_id FROM treatment_plans").all() ?? [];
    for (const pl of plans as any[]) {
      const eid = randomUUID();
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'treatment_plan', ?, 'treatment_plans', ?, ?, ?, 'bhc')"
      ).run(eid, pl.id, pl.plan_number, pl.primary_diagnosis, JSON.stringify({ diagnosis: pl.primary_diagnosis, status: pl.status }));
      if (pl.patient_id) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'plan_for', 1.0)"
        ).run(randomUUID(), eid, pl.patient_id);
      }
    }

    // Index clinical sessions
    const sessions = sqlite.prepare("SELECT id, patient_id, treatment_plan_id, clinician_id, session_type, billing_code FROM clinical_sessions LIMIT 50").all() ?? [];
    for (const s of sessions as any[]) {
      const eid = randomUUID();
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'session', ?, 'clinical_sessions', ?, ?, ?, 'bhc')"
      ).run(eid, s.id, `Session ${s.id.slice(0, 8)}`, `${s.session_type} session`, JSON.stringify({ type: s.session_type, billing: s.billing_code }));
      if (s.patient_id) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'session_for', 0.8)"
        ).run(randomUUID(), eid, s.patient_id);
      }
      if (s.treatment_plan_id) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'part_of_plan', 0.9)"
        ).run(randomUUID(), eid, s.treatment_plan_id);
      }
    }

    // Index form templates
    const forms = sqlite.prepare("SELECT id, template_name, category, binder_area FROM form_templates LIMIT 50").all() ?? [];
    for (const f of forms as any[]) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'form', ?, 'form_templates', ?, ?, ?, 'hr')"
      ).run(randomUUID(), f.id, f.template_name, `${f.category} / ${f.binder_area}`, JSON.stringify({ category: f.category, binder: f.binder_area }));
    }

    // Index audits
    const audits = sqlite.prepare("SELECT id, audit_number, title, audit_type, status, score FROM audits_qa").all() ?? [];
    for (const a of audits as any[]) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'audit', ?, 'audits_qa', ?, ?, ?, 'qa')"
      ).run(randomUUID(), a.id, a.audit_number, a.title, JSON.stringify({ type: a.audit_type, status: a.status, score: a.score }));
    }

    // Index claims
    const claims = sqlite.prepare("SELECT id, claim_number, patient_id, payer_id, status, total_amount FROM claims LIMIT 25").all() ?? [];
    for (const c of claims as any[]) {
      const eid = randomUUID();
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'claim', ?, 'claims', ?, ?, ?, 'revenue')"
      ).run(eid, c.id, c.claim_number, `Status: ${c.status}, Amount: $${(c.total_amount / 100).toFixed(2)}`, JSON.stringify({ status: c.status, amount: c.total_amount }));
      if (c.patient_id) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'claim_for', 0.7)"
        ).run(randomUUID(), eid, c.patient_id);
      }
    }

    // Index work orders
    const wos = sqlite.prepare("SELECT id, wo_number, title, status, category, facility FROM work_orders").all() ?? [];
    for (const wo of wos as any[]) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'work_order', ?, 'work_orders', ?, ?, ?, 'gad')"
      ).run(randomUUID(), wo.id, wo.wo_number, wo.title, JSON.stringify({ status: wo.status, category: wo.category, facility: wo.facility }));
    }

    // Index agent personas
    const personas = sqlite.prepare("SELECT persona_id, name, description, scope_domains FROM agent_personas").all() ?? [];
    for (const pe of personas as any[]) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'agent', ?, 'agent_personas', ?, ?, ?, 'system')"
      ).run(randomUUID(), pe.persona_id, pe.name, pe.description, JSON.stringify({ domains: pe.scope_domains }));
    }

    // Create cross-module relationships: patient → claims
    const patientEntities = sqlite.prepare("SELECT source_id, id FROM nil_entities WHERE entity_type = 'patient'").all() ?? [];
    for (const pe of patientEntities as any[]) {
      const pClaims = sqlite.prepare("SELECT id FROM nil_entities WHERE entity_type = 'claim' AND source_id IN (SELECT id FROM claims WHERE patient_id = ?)").all(pe.source_id) ?? [];
      for (const pc of pClaims as any[]) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'has_claim', 0.6)"
        ).run(randomUUID(), pe.id, pc.id);
      }
    }

    const stats = sqlite.prepare("SELECT COUNT(*) as entities FROM nil_entities").get() as any;
    const relStats = sqlite.prepare("SELECT COUNT(*) as relationships FROM nil_relationships").get() as any;
    return { entities: (stats as any)?.entities ?? 0, relationships: (relStats as any)?.relationships ?? 0 };
  }),

  // ─── Graph Queries ─────────────────────────────────────────

  getStats: publicQuery.query(async () => {
    const entityTypes = sqlite.prepare("SELECT entity_type, COUNT(*) as count FROM nil_entities GROUP BY entity_type").all() ?? [];
    const relTypes = sqlite.prepare("SELECT relation_type, COUNT(*) as count FROM nil_relationships GROUP BY relation_type").all() ?? [];
    const modules = sqlite.prepare("SELECT module, COUNT(*) as count FROM nil_entities GROUP BY module").all() ?? [];
    const totalEntities = sqlite.prepare("SELECT COUNT(*) as count FROM nil_entities").get() as any;
    const totalRels = sqlite.prepare("SELECT COUNT(*) as count FROM nil_relationships").get() as any;
    return {
      totalEntities: (totalEntities as any)?.count ?? 0,
      totalRelationships: (totalRels as any)?.count ?? 0,
      entityTypes,
      relationTypes: relTypes,
      moduleDistribution: modules,
    };
  }),

  searchEntities: publicQuery
    .input(z.object({ query: z.string(), entityType: z.string().optional(), module: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      let sql = "SELECT * FROM nil_entities WHERE display_name LIKE ? OR description LIKE ?";
      const params: any[] = [`%${input.query}%`, `%${input.query}%`];
      if (input.entityType) { sql += " AND entity_type = ?"; params.push(input.entityType); }
      if (input.module) { sql += " AND module = ?"; params.push(input.module); }
      sql += " LIMIT ?"; params.push(input.limit);
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getEntityNetwork: publicQuery
    .input(z.object({ entityId: z.string(), depth: z.number().max(3).default(2) }))
    .query(async ({ input }) => {
      const visited = new Set<string>();
      const nodes: any[] = [];
      const edges: any[] = [];

      const queue: { id: string; d: number }[] = [{ id: input.entityId, d: 0 }];
      visited.add(input.entityId);

      const root = sqlite.prepare("SELECT * FROM nil_entities WHERE id = ?").get(input.entityId);
      if (root) nodes.push(root);

      const stmtOutgoing = sqlite.prepare(
        "SELECT r.*, e.display_name as target_name, e.entity_type as target_type FROM nil_relationships r JOIN nil_entities e ON r.to_entity_id = e.id WHERE r.from_entity_id = ?"
      );
      const stmtIncoming = sqlite.prepare(
        "SELECT r.*, e.display_name as source_name, e.entity_type as source_type FROM nil_relationships r JOIN nil_entities e ON r.from_entity_id = e.id WHERE r.to_entity_id = ?"
      );
      const stmtNode = sqlite.prepare("SELECT * FROM nil_entities WHERE id = ?");

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.d >= input.depth) continue;

        const outgoing = stmtOutgoing.all(current.id) ?? [];
        for (const rel of outgoing as any[]) {
          edges.push({ ...rel, direction: "outgoing" });
          if (!visited.has(rel.to_entity_id)) {
            visited.add(rel.to_entity_id);
            const node = stmtNode.get(rel.to_entity_id);
            if (node) { nodes.push(node); queue.push({ id: rel.to_entity_id, d: current.d + 1 }); }
          }
        }

        const incoming = stmtIncoming.all(current.id) ?? [];
        for (const rel of incoming as any[]) {
          edges.push({ ...rel, direction: "incoming" });
          if (!visited.has(rel.from_entity_id)) {
            visited.add(rel.from_entity_id);
            const node = stmtNode.get(rel.from_entity_id);
            if (node) { nodes.push(node); queue.push({ id: rel.from_entity_id, d: current.d + 1 }); }
          }
        }
      }

      return { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length };
    }),

  getRecommendations: publicQuery
    .input(z.object({ entityId: z.string(), limit: z.number().default(5) }))
    .query(async ({ input }) => {
      const entity = sqlite.prepare("SELECT * FROM nil_entities WHERE id = ?").get(input.entityId);
      if (!entity) return [];

      const neighbors = sqlite.prepare(
        "SELECT DISTINCT CASE WHEN from_entity_id = ? THEN to_entity_id ELSE from_entity_id END as neighbor_id FROM nil_relationships WHERE from_entity_id = ? OR to_entity_id = ?"
      ).all(input.entityId, input.entityId, input.entityId) ?? [];

      if (neighbors.length === 0) return [];

      const neighborIds = (neighbors as any[]).map((n: any) => `'${n.neighbor_id}'`).join(",");

      const recommendations = sqlite.prepare(
        `SELECT e.*, COUNT(*) as shared_connections FROM nil_entities e
         JOIN nil_relationships r ON (r.from_entity_id = e.id OR r.to_entity_id = e.id)
         WHERE e.id != ?
         AND e.id NOT IN (${neighborIds})
         AND (r.from_entity_id IN (${neighborIds}) OR r.to_entity_id IN (${neighborIds}))
         GROUP BY e.id
         ORDER BY shared_connections DESC
         LIMIT ?`
      ).all(input.entityId, input.limit) ?? [];

      return recommendations;
    }),

  findPath: publicQuery
    .input(z.object({ fromId: z.string(), toId: z.string() }))
    .query(async ({ input }) => {
      const visited = new Map<string, string | null>();
      const queue = [input.fromId];
      visited.set(input.fromId, null);

      const stmtRels = sqlite.prepare("SELECT * FROM nil_relationships WHERE from_entity_id = ? OR to_entity_id = ?");
      const stmtNode = sqlite.prepare("SELECT * FROM nil_entities WHERE id = ?");

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === input.toId) break;

        const rels = stmtRels.all(current, current) ?? [];
        for (const rel of rels as any[]) {
          const next = rel.from_entity_id === current ? rel.to_entity_id : rel.from_entity_id;
          if (!visited.has(next)) {
            visited.set(next, current);
            queue.push(next);
          }
        }
      }

      const path: any[] = [];
      if (!visited.has(input.toId)) return { found: false, path: [], hops: 0 };

      let current = input.toId;
      while (current !== input.fromId) {
        const prev = visited.get(current)!;
        const node = stmtNode.get(current);
        if (node) path.unshift(node);
        current = prev!;
      }
      const startNode = stmtNode.get(input.fromId);
      if (startNode) path.unshift(startNode);

      return { found: true, path, hops: path.length - 1 };
    }),

  listEntitiesByType: publicQuery
    .input(z.object({ entityType: z.string(), module: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      let sql = "SELECT * FROM nil_entities WHERE entity_type = ?";
      const params: any[] = [input.entityType];
      if (input.module) { sql += " AND module = ?"; params.push(input.module); }
      sql += " ORDER BY display_name LIMIT ?"; params.push(input.limit);
      return sqlite.prepare(sql).all(...params) ?? [];
    }),
});
