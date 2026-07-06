import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery, auditLog } from "../middleware";
import { getDb } from "../queries/connection";
import { nilEntities, nilRelationships } from "@db/schema";
import { eq, like, and, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── M9: NIL Knowledge Graph ───────────────────────────────

export const m9Router = createRouter({
  getStats: publicQuery.query(async () => {
    const db = getDb();
    const allEntities = await db.select().from(nilEntities).all();
    const allRels = await db.select().from(nilRelationships).all();

    const byType: Record<string, number> = {};
    for (const e of allEntities) {
      byType[e.entityType] = (byType[e.entityType] ?? 0) + 1;
    }

    const entityTypes = Object.entries(byType).map(([entity_type, count]) => ({ entity_type, count }));

    return {
      totalEntities: allEntities.length,
      totalRelationships: allRels.length,
      entityTypes: entityTypes.sort((a, b) => b.count - a.count),
    };
  }),

  searchEntities: publicQuery
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      if (!input.query || input.query.length < 2) return [];
      const db = getDb();
      return db.select().from(nilEntities)
        .where(like(nilEntities.displayName, `%${input.query}%`))
        .orderBy(nilEntities.displayName)
        .limit(50)
        .all();
    }),

  getEntityNetwork: publicQuery
    .input(z.object({ entityId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const center = await db.select().from(nilEntities).where(eq(nilEntities.id, input.entityId)).get();
      if (!center) return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };

      // Get direct relationships (depth 1)
      const rels = await db.select().from(nilRelationships)
        .where(
          sql`${nilRelationships.fromEntityId} = ${input.entityId} OR ${nilRelationships.toEntityId} = ${input.entityId}`
        )
        .all();

      // Collect connected entity IDs
      const connectedIds = new Set<string>();
      for (const r of rels) {
        if (r.fromEntityId !== input.entityId) connectedIds.add(r.fromEntityId);
        if (r.toEntityId !== input.entityId) connectedIds.add(r.toEntityId);
      }

      // Fetch connected entities
      const connected: typeof center[] = [];
      for (const cid of connectedIds) {
        const e = await db.select().from(nilEntities).where(eq(nilEntities.id, cid)).get();
        if (e) connected.push(e);
      }

      // Build edges
      const edges = rels.map((r) => ({
        from_entity_id: r.fromEntityId,
        to_entity_id: r.toEntityId,
        relation_type: r.relationType,
        strength: r.strength,
      }));

      const nodes = [center, ...connected];
      return { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length };
    }),

  getRecommendations: publicQuery
    .input(z.object({ entityId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Find entities that share connections with the target entity
      // (entities connected to entities that the target is connected to, but not directly connected to target)
      const targetRels = await db.select().from(nilRelationships)
        .where(
          sql`${nilRelationships.fromEntityId} = ${input.entityId} OR ${nilRelationships.toEntityId} = ${input.entityId}`
        )
        .all();

      const targetConnectedIds = new Set<string>();
      for (const r of targetRels) {
        targetConnectedIds.add(r.fromEntityId === input.entityId ? r.toEntityId : r.fromEntityId);
      }

      // For each connected entity, find their connections
      const recommendationScores: Record<string, { entity: any; sharedConnections: number }> = {};

      for (const cid of targetConnectedIds) {
        const secondDegreeRels = await db.select().from(nilRelationships)
          .where(
            sql`${nilRelationships.fromEntityId} = ${cid} OR ${nilRelationships.toEntityId} = ${cid}`
          )
          .all();

        for (const r of secondDegreeRels) {
          const otherId = r.fromEntityId === cid ? r.toEntityId : r.fromEntityId;
          if (otherId === input.entityId || targetConnectedIds.has(otherId)) continue;

          if (!recommendationScores[otherId]) {
            const e = await db.select().from(nilEntities).where(eq(nilEntities.id, otherId)).get();
            if (e) recommendationScores[otherId] = { entity: e, sharedConnections: 0 };
          }
          if (recommendationScores[otherId]) {
            recommendationScores[otherId].sharedConnections++;
          }
        }
      }

      return Object.values(recommendationScores)
        .sort((a, b) => b.sharedConnections - a.sharedConnections)
        .slice(0, 10)
        .map((r) => ({
          ...r.entity,
          shared_connections: r.sharedConnections,
        }));
    }),

  findPath: publicQuery
    .input(z.object({ fromEntityId: z.string(), toEntityId: z.string() }))
    .query(async ({ input }) => {
      // BFS pathfinding
      const db = getDb();
      const visited = new Set<string>();
      const queue: { id: string; path: string[] }[] = [{ id: input.fromEntityId, path: [input.fromEntityId] }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.id === input.toEntityId) {
          // Fetch entities in path
          const pathEntities: any[] = [];
          for (const pid of current.path) {
            const e = await db.select().from(nilEntities).where(eq(nilEntities.id, pid)).get();
            if (e) pathEntities.push(e);
          }
          return { found: true, path: pathEntities, hops: current.path.length - 1 };
        }

        if (visited.has(current.id)) continue;
        visited.add(current.id);

        const rels = await db.select().from(nilRelationships)
          .where(
            sql`${nilRelationships.fromEntityId} = ${current.id} OR ${nilRelationships.toEntityId} = ${current.id}`
          )
          .all();

        for (const r of rels) {
          const nextId = r.fromEntityId === current.id ? r.toEntityId : r.fromEntityId;
          if (!visited.has(nextId)) {
            queue.push({ id: nextId, path: [...current.path, nextId] });
          }
        }
      }

      return { found: false, path: [], hops: 0 };
    }),

  reindex: publicQuery.mutation(async () => {
    const actor = "AMOS-Seed";
    const db = getDb();

    // Clear existing
    await db.delete(nilRelationships);
    await db.delete(nilEntities);

    const entities: any[] = [];
    const relationships: any[] = [];
    const now = new Date().toISOString();

    function addEntity(id: string, type: string, name: string, module: string, description?: string, sourceId?: string, sourceTable?: string) {
      entities.push({ id, entityType: type, displayName: name, description: description ?? null, module, sourceId: sourceId ?? null, sourceTable: sourceTable ?? null, metadata: null, createdAt: now });
    }
    function addRel(from: string, to: string, type: string, strength: number) {
      relationships.push({ id: randomUUID(), fromEntityId: from, toEntityId: to, relationType: type, strength, createdAt: now });
    }

    // ─── Clinical entities ───────────────────────────────────
    addEntity("ne-p1", "patient", "Marcus Johnson", "clinical", "15yo male, depression/anxiety", "p1", "patients");
    addEntity("ne-p2", "patient", "Aaliyah Williams", "clinical", "16yo female, trauma/self-harm", "p2", "patients");
    addEntity("ne-p3", "patient", "Carlos Martinez", "clinical", "15yo male, conduct disorder", "p3", "patients");
    addEntity("ne-p4", "patient", "Jada Thompson", "clinical", "17yo female, on hold", "p4", "patients");
    addEntity("ne-p5", "patient", "Ethan Davis", "clinical", "15yo male, discharged", "p5", "patients");

    addEntity("ne-dr-hall", "person", "Dr. Hall", "clinical", "Clinical Director, Psychiatrist", "u2", "users");
    addEntity("ne-lilian", "person", "Lilian Ike", "clinical", "Case Manager, RCS Night", "u3", "users");
    addEntity("ne-russ", "person", "E. Russ Aideyan", "executive", "CEO/Founder", "u1", "users");

    addEntity("ne-tp1", "treatment_plan", "TP-2026-1001 — MDD/GAD", "clinical", "Active treatment plan for Marcus Johnson", "tp1", "treatment_plans");
    addEntity("ne-tp2", "treatment_plan", "TP-2026-1002 — Conduct Disorder", "clinical", "Completed treatment plan for behavioral outbursts", "tp2", "treatment_plans");

    addEntity("ne-cs1", "session", "Session 2026-06-28", "clinical", "Individual therapy — trauma processing", "cs1", "clinical_sessions");

    // Clinical relationships
    addRel("ne-p1", "ne-dr-hall", "treated_by", 100);
    addRel("ne-p2", "ne-lilian", "treated_by", 100);
    addRel("ne-p3", "ne-dr-hall", "treated_by", 100);
    addRel("ne-p4", "ne-lilian", "treated_by", 100);
    addRel("ne-p1", "ne-tp1", "has_plan", 100);
    addRel("ne-p1", "ne-tp2", "had_plan", 80);
    addRel("ne-p1", "ne-cs1", "has_session", 100);
    addRel("ne-cs1", "ne-dr-hall", "conducted_by", 100);

    // ─── HR entities ─────────────────────────────────────────
    addEntity("ne-h-jg", "person", "Jonthan Guidry", "hr", "LPC, Case Manager", "h4", "people");
    addEntity("ne-h-rl", "person", "RCS Lead", "hr", "Residential Care Supervisor", "h5", "people");

    addEntity("ne-hr-ref", "form", "REF-2026-001 — K. Williams", "hr", "Reference check form", null, null);
    addEntity("ne-hr-app", "form", "APP-2026-001 — J. Guidry", "hr", "Application form", null, null);

    addRel("ne-h-jg", "ne-dr-hall", "reports_to", 90);
    addRel("ne-h-rl", "ne-russ", "reports_to", 90);
    addRel("ne-h-jg", "ne-hr-ref", "has_reference", 70);
    addRel("ne-h-jg", "ne-hr-app", "submitted", 100);

    // ─── Revenue entities ────────────────────────────────────
    addEntity("ne-c1", "claim", "CLM-2026-001 — TX Medicaid", "revenue", "Paid claim, $12,500", "c1", "claims");
    addEntity("ne-c3", "claim", "CLM-2026-003 — Aetna", "revenue", "Denied claim, $8,750", "c3", "claims");
    addRel("ne-c1", "ne-p1", "for_patient", 100);
    addRel("ne-c3", "ne-p3", "for_patient", 100);

    // ─── QA entities ─────────────────────────────────────────
    addEntity("ne-a1", "audit", "AUD-2026-001 — Q2 Clinical", "qa", "Completed audit, score 94%", "a1", "audits_qa");
    addEntity("ne-ca1", "form", "CAPA-2026-001", "qa", "Dual-signature medication check", "ca1", "corrective_actions");
    addRel("ne-a1", "ne-ca1", "generated_capa", 100);
    addRel("ne-a1", "ne-dr-hall", "audited_by", 90);

    // ─── GAD entities ────────────────────────────────────────
    addEntity("ne-wo1", "work_order", "WO-2026-001 — HVAC", "gad", "HVAC repair Wing B", "wo1", "work_orders");
    addEntity("ne-f1", "form", "BHC-CYP-01", "gad", "Main Campus, 18,500 sqft", "f1", "facilities");
    addRel("ne-wo1", "ne-f1", "for_facility", 100);
    addRel("ne-wo1", "ne-russ", "approved_by", 90);

    // ─── Document entities ───────────────────────────────────
    addEntity("ne-d1", "form", "ADL-HR-POL-202606-0001", "documents", "Employee Handbook v2026", "d1", "dms_documents");
    addRel("ne-d1", "ne-russ", "authored_by", 100);

    // ─── Referral entities ───────────────────────────────────
    addEntity("ne-r1", "form", "REF-2026-005 — A. Thompson", "gro", "Converted referral → patient", "r5", "referrals");
    addRel("ne-r1", "ne-p1", "converted_to", 100);

    // Insert all
    for (const e of entities) {
      await db.insert(nilEntities).values(e).onConflictDoNothing();
    }
    for (const r of relationships) {
      await db.insert(nilRelationships).values(r).onConflictDoNothing();
    }

    auditLog({ action: "m9:reindex", actor, resource: "nil-graph", details: `Indexed ${entities.length} entities, ${relationships.length} relationships` });

    return { entities: entities.length, relationships: relationships.length };
  }),
});
