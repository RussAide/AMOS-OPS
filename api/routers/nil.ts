import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── NIL: Network Intelligence Layer ─────────────────────────
// Knowledge graph connecting entities across all modules

type DbRow = Record<string, unknown>;

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  assigned_clinician_id: string | null;
  mrn: string;
}

interface ClinicianRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
}

interface TreatmentPlanRow {
  id: string;
  patient_id: string | null;
  plan_number: string;
  primary_diagnosis: string | null;
  status: string;
  assigned_clinician_id: string | null;
}

interface SessionRow {
  id: string;
  patient_id: string | null;
  treatment_plan_id: string | null;
  clinician_id: string | null;
  session_type: string;
  billing_code: string | null;
}

interface FormRow {
  id: string;
  template_name: string;
  category: string;
  binder_area: string;
}

interface AuditRow {
  id: string;
  audit_number: string;
  title: string;
  audit_type: string;
  status: string;
  score: number | null;
}

interface ClaimRow {
  id: string;
  claim_number: string;
  patient_id: string | null;
  payer_id: string | null;
  status: string;
  total_amount: number;
}

interface WorkOrderRow {
  id: string;
  wo_number: string;
  title: string;
  status: string;
  category: string;
  facility: string;
}

interface PersonaIndexRow {
  persona_id: string;
  name: string;
  description: string;
  scope_domains: string | null;
}

interface EntityIdRow {
  id: string;
  source_id: string;
}

interface IdRow {
  id: string;
}

interface EntityCountRow {
  entities: number;
}

interface RelationshipCountRow {
  relationships: number;
}

interface CountRow {
  count: number;
}

interface RelationshipRow extends DbRow {
  from_entity_id: string;
  to_entity_id: string;
}

interface NeighborRow {
  neighbor_id: string;
}

export const nilRouter = createRouter({
  // ─── Auto-index all modules ────────────────────────────────

  reindex: adminQuery.mutation(async () => {
    // Clear existing
    sqlite.exec("DELETE FROM nil_relationships");
    sqlite.exec("DELETE FROM nil_entities");

    // Index patients
    const patients = sqlite.prepare("SELECT id, first_name, last_name, status, assigned_clinician_id, mrn FROM patients").all() as PatientRow[];
    for (const p of patients) {
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
    const clinicians = sqlite.prepare("SELECT id, first_name, last_name, role, department FROM hr_people WHERE department = 'Clinical' OR department = 'HR'").all() as ClinicianRow[];
    for (const c of clinicians) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'person', ?, 'hr_people', ?, ?, ?, ?)"
      ).run(randomUUID(), c.id, `${c.first_name} ${c.last_name}`, c.role, JSON.stringify({ department: c.department, role: c.role }), c.department?.toLowerCase() ?? "hr");
    }

    // Index treatment plans
    const plans = sqlite.prepare("SELECT id, patient_id, plan_number, primary_diagnosis, status, assigned_clinician_id FROM treatment_plans").all() as TreatmentPlanRow[];
    for (const pl of plans) {
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
    const sessions = sqlite.prepare("SELECT id, patient_id, treatment_plan_id, clinician_id, session_type, billing_code FROM clinical_sessions LIMIT 50").all() as SessionRow[];
    for (const s of sessions) {
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
    const forms = sqlite.prepare("SELECT id, template_name, category, binder_area FROM form_templates LIMIT 50").all() as FormRow[];
    for (const f of forms) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'form', ?, 'form_templates', ?, ?, ?, 'hr')"
      ).run(randomUUID(), f.id, f.template_name, `${f.category} / ${f.binder_area}`, JSON.stringify({ category: f.category, binder: f.binder_area }));
    }

    // Index audits
    const audits = sqlite.prepare("SELECT id, audit_number, title, audit_type, status, score FROM audits_qa").all() as AuditRow[];
    for (const a of audits) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'audit', ?, 'audits_qa', ?, ?, ?, 'qa')"
      ).run(randomUUID(), a.id, a.audit_number, a.title, JSON.stringify({ type: a.audit_type, status: a.status, score: a.score }));
    }

    // Index claims
    const claims = sqlite.prepare("SELECT id, claim_number, patient_id, payer_id, status, total_amount FROM claims LIMIT 25").all() as ClaimRow[];
    for (const c of claims) {
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
    const wos = sqlite.prepare("SELECT id, wo_number, title, status, category, facility FROM work_orders").all() as WorkOrderRow[];
    for (const wo of wos) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'work_order', ?, 'work_orders', ?, ?, ?, 'gad')"
      ).run(randomUUID(), wo.id, wo.wo_number, wo.title, JSON.stringify({ status: wo.status, category: wo.category, facility: wo.facility }));
    }

    // Index agent personas
    const personas = sqlite.prepare("SELECT persona_id, name, description, scope_domains FROM agent_personas").all() as PersonaIndexRow[];
    for (const pe of personas) {
      sqlite.prepare(
        "INSERT INTO nil_entities (id, entity_type, source_id, source_table, display_name, description, metadata, module) VALUES (?, 'agent', ?, 'agent_personas', ?, ?, ?, 'system')"
      ).run(randomUUID(), pe.persona_id, pe.name, pe.description, JSON.stringify({ domains: pe.scope_domains }));
    }

    // Create cross-module relationships: patient → claims
    const patientEntities = sqlite.prepare("SELECT source_id, id FROM nil_entities WHERE entity_type = 'patient'").all() as EntityIdRow[];
    for (const pe of patientEntities) {
      const pClaims = sqlite.prepare("SELECT id FROM nil_entities WHERE entity_type = 'claim' AND source_id IN (SELECT id FROM claims WHERE patient_id = ?)").all(pe.source_id) as IdRow[];
      for (const pc of pClaims) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO nil_relationships (id, from_entity_id, to_entity_id, relation_type, strength) VALUES (?, ?, ?, 'has_claim', 0.6)"
        ).run(randomUUID(), pe.id, pc.id);
      }
    }

    const stats = sqlite.prepare("SELECT COUNT(*) as entities FROM nil_entities").get() as EntityCountRow | undefined;
    const relStats = sqlite.prepare("SELECT COUNT(*) as relationships FROM nil_relationships").get() as RelationshipCountRow | undefined;
    return { entities: stats?.entities ?? 0, relationships: relStats?.relationships ?? 0 };
  }),

  // ─── Graph Queries ─────────────────────────────────────────

  getStats: publicQuery.query(async () => {
    const entityTypes = sqlite.prepare("SELECT entity_type, COUNT(*) as count FROM nil_entities GROUP BY entity_type").all() ?? [];
    const relTypes = sqlite.prepare("SELECT relation_type, COUNT(*) as count FROM nil_relationships GROUP BY relation_type").all() ?? [];
    const modules = sqlite.prepare("SELECT module, COUNT(*) as count FROM nil_entities GROUP BY module").all() ?? [];
    const totalEntities = sqlite.prepare("SELECT COUNT(*) as count FROM nil_entities").get() as CountRow | undefined;
    const totalRels = sqlite.prepare("SELECT COUNT(*) as count FROM nil_relationships").get() as CountRow | undefined;
    return {
      totalEntities: totalEntities?.count ?? 0,
      totalRelationships: totalRels?.count ?? 0,
      entityTypes,
      relationTypes: relTypes,
      moduleDistribution: modules,
    };
  }),

  searchEntities: publicQuery
    .input(z.object({ query: z.string(), entityType: z.string().optional(), module: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      let sql = "SELECT * FROM nil_entities WHERE display_name LIKE ? OR description LIKE ?";
      const params: unknown[] = [`%${input.query}%`, `%${input.query}%`];
      if (input.entityType) { sql += " AND entity_type = ?"; params.push(input.entityType); }
      if (input.module) { sql += " AND module = ?"; params.push(input.module); }
      sql += " LIMIT ?"; params.push(input.limit);
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getEntityNetwork: publicQuery
    .input(z.object({ entityId: z.string(), depth: z.number().max(3).default(2) }))
    .query(async ({ input }) => {
      const visited = new Set<string>();
      const nodes: DbRow[] = [];
      const edges: DbRow[] = [];

      const queue: { id: string; d: number }[] = [{ id: input.entityId, d: 0 }];
      visited.add(input.entityId);

      const root = sqlite.prepare("SELECT * FROM nil_entities WHERE id = ?").get(input.entityId) as DbRow | undefined;
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
        for (const rel of outgoing as RelationshipRow[]) {
          edges.push({ ...rel, direction: "outgoing" });
          if (!visited.has(rel.to_entity_id)) {
            visited.add(rel.to_entity_id);
            const node = stmtNode.get(rel.to_entity_id) as DbRow | undefined;
            if (node) { nodes.push(node); queue.push({ id: rel.to_entity_id, d: current.d + 1 }); }
          }
        }

        const incoming = stmtIncoming.all(current.id) ?? [];
        for (const rel of incoming as RelationshipRow[]) {
          edges.push({ ...rel, direction: "incoming" });
          if (!visited.has(rel.from_entity_id)) {
            visited.add(rel.from_entity_id);
            const node = stmtNode.get(rel.from_entity_id) as DbRow | undefined;
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

      const neighborIds = (neighbors as NeighborRow[]).map((n) => `'${n.neighbor_id}'`).join(",");

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
        for (const rel of rels as RelationshipRow[]) {
          const next = rel.from_entity_id === current ? rel.to_entity_id : rel.from_entity_id;
          if (!visited.has(next)) {
            visited.set(next, current);
            queue.push(next);
          }
        }
      }

      const path: DbRow[] = [];
      if (!visited.has(input.toId)) return { found: false, path: [], hops: 0 };

      let current = input.toId;
      while (current !== input.fromId) {
        const prev = visited.get(current)!;
        const node = stmtNode.get(current) as DbRow | undefined;
        if (node) path.unshift(node);
        current = prev!;
      }
      const startNode = stmtNode.get(input.fromId) as DbRow | undefined;
      if (startNode) path.unshift(startNode);

      return { found: true, path, hops: path.length - 1 };
    }),

  listEntitiesByType: publicQuery
    .input(z.object({ entityType: z.string(), module: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      let sql = "SELECT * FROM nil_entities WHERE entity_type = ?";
      const params: unknown[] = [input.entityType];
      if (input.module) { sql += " AND module = ?"; params.push(input.module); }
      sql += " ORDER BY display_name LIMIT ?"; params.push(input.limit);
      return sqlite.prepare(sql).all(...params) ?? [];
    }),
});
