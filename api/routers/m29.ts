import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

// ─── M29: NIL Knowledge Graph — Semantic Search & Relationships ───

interface Entity {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  module: string;
  status: string;
  lastUpdated: string;
  tags: string[];
  relevance: number;
}

interface Relationship {
  from: string;
  to: string;
  type: string;
  label: string;
}

const ENTITY_DB: Entity[] = [
  { id: "y1", type: "youth", title: "Synthetic Youth 001", subtitle: "SYNTH-BHC-001 • Age 16 • Residential", module: "Clinical", status: "active", lastUpdated: "2026-07-02", tags: ["trauma", "CBT", "conduct-disorder"], relevance: 1.0 },
  { id: "y2", type: "youth", title: "Synthetic Youth 005", subtitle: "SYNTH-BHC-002 • Age 16 • Residential", module: "Clinical", status: "active", lastUpdated: "2026-07-02", tags: ["anxiety", "depression", "mood-disorder"], relevance: 1.0 },
  { id: "y3", type: "youth", title: "Synthetic Youth 007", subtitle: "SYNTH-BHC-003 • Age 15 • Assessment", module: "Clinical", status: "assessment", lastUpdated: "2026-06-29", tags: ["conduct-disorder", "intake-pending", "CANS"], relevance: 0.95 },
  { id: "y4", type: "youth", title: "Synthetic Youth 002", subtitle: "SYNTH-BHC-004 • Age 17 • Crisis Stabilization", module: "Clinical", status: "hold", lastUpdated: "2026-07-01", tags: ["behavioral", "peer-conflict", "safety-plan"], relevance: 0.9 },
  { id: "ir-0701", type: "incident", title: "Peer Conflict — Synthetic Youth 002", subtitle: "2026-07-01 14:30 • Moderate severity • Resolved", module: "Compliance", status: "resolved", lastUpdated: "2026-07-01", tags: ["behavioral", "peer-conflict", "Synthetic-Person-002-Thompson"], relevance: 0.85 },
  { id: "ir-0628", type: "incident", title: "Equipment Malfunction — Vitals Monitor", subtitle: "2026-06-28 08:00 • Low severity • Service ordered", module: "Compliance", status: "resolved", lastUpdated: "2026-06-28", tags: ["equipment", "GAD", "maintenance"], relevance: 0.7 },
  { id: "ir-0615", type: "incident", title: "Behavioral Event — Synthetic Youth 001", subtitle: "2026-06-15 21:15 • High severity • PRN administered", module: "Compliance", status: "resolved", lastUpdated: "2026-06-16", tags: ["behavioral", "medication", "PRN", "Synthetic-Youth-001"], relevance: 0.88 },
  { id: "ca-0701", type: "chart_audit", title: "Chart Audit — Synthetic Youth 002", subtitle: "Auditor: Demo Clinical Lead • 6/9 areas passed • Pass with notes", module: "Compliance", status: "pass_with_notes", lastUpdated: "2026-07-01", tags: ["audit", "Synthetic-Person-002-Thompson", "deficiency"], relevance: 0.82 },
  { id: "tx-001", type: "treatment_plan", title: "Treatment Plan — Synthetic Youth 001", subtitle: "CBT-based • 6-month residential • Goals: 4 active", module: "Clinical", status: "active", lastUpdated: "2026-06-15", tags: ["CBT", "trauma", "residential", "Synthetic-Youth-001"], relevance: 0.92 },
  { id: "tx-002", type: "treatment_plan", title: "Treatment Plan — Synthetic Youth 005", subtitle: "DBT-informed • Mood regulation focus • Goals: 3 active", module: "Clinical", status: "active", lastUpdated: "2026-06-20", tags: ["DBT", "mood-disorder", "residential", "Synthetic-Youth-005"], relevance: 0.91 },
  { id: "med-001", type: "medication_order", title: "Medication Order — Sertraline 50mg", subtitle: "Synthetic Youth 001 • Daily PO • Active since 2026-04-01", module: "Residential", status: "active", lastUpdated: "2026-06-01", tags: ["medication", "SSRI", "Synthetic-Youth-001", "psychiatric"], relevance: 0.87 },
  { id: "med-002", type: "medication_order", title: "Medication Order — Methylphenidate 20mg", subtitle: "Synthetic Youth 005 • Daily PO • Active since 2026-04-15", module: "Residential", status: "active", lastUpdated: "2026-06-01", tags: ["medication", "stimulant", "Synthetic-Youth-005", "ADHD"], relevance: 0.86 },
  { id: "wo-001", type: "work_order", title: "HVAC Repair — Common Area", subtitle: "GAD-001 • In Progress • Assigned: Mike HVAC", module: "GAD", status: "in_progress", lastUpdated: "2026-07-01", tags: ["HVAC", "maintenance", "facility"], relevance: 0.65 },
  { id: "wo-002", type: "work_order", title: "Plumbing Leak — Room 102", subtitle: "GAD-002 • Open • High priority", module: "GAD", status: "open", lastUpdated: "2026-06-30", tags: ["plumbing", "Room-102", "urgent"], relevance: 0.75 },
  { id: "auth-001", type: "authorization", title: "Authorization — Synthetic Youth 001", subtitle: "Texas Medicaid • Approved • Auth #TXM-88765432", module: "Revenue", status: "approved", lastUpdated: "2026-04-01", tags: ["authorization", "Medicaid", "Synthetic-Youth-001"], relevance: 0.8 },
  { id: "doc-001", type: "document", title: "Intake Assessment — Synthetic Youth 007", subtitle: "CANS Score: Pending • 6/10 checklist items complete", module: "Clinical", status: "in_progress", lastUpdated: "2026-06-29", tags: ["intake", "assessment", "CANS", "Synthetic-Person-004-Martinez"], relevance: 0.83 },
  { id: "sop-001", type: "sop", title: "SOP: Crisis Intervention Protocol", subtitle: "v2.3 • Approved 2026-01-15 • Next review: 2026-07-15", module: "Compliance", status: "active", lastUpdated: "2026-01-15", tags: ["crisis", "protocol", "safety", "training-required"], relevance: 0.78 },
  { id: "sop-002", type: "sop", title: "SOP: Medication Administration", subtitle: "v1.8 • Approved 2026-02-01 • Next review: 2026-08-01", module: "Residential", status: "active", lastUpdated: "2026-02-01", tags: ["medication", "MAR", "C-II", "training-required"], relevance: 0.79 },
  { id: "cap-001", type: "cap", title: "CAP: Revenue Collection Rate", subtitle: "Target: 85% • Current: 77% • 8-point gap", module: "Revenue", status: "open", lastUpdated: "2026-06-15", tags: ["CAP", "revenue", "denial-management", "documentation"], relevance: 0.84 },
  { id: "cap-002", type: "cap", title: "CAP: Clinical Hiring Pipeline", subtitle: "4 open positions • 2 candidates in final stage", module: "HR", status: "open", lastUpdated: "2026-06-20", tags: ["CAP", "hiring", "clinical", "staffing"], relevance: 0.81 },
];

const RELATIONSHIPS: Relationship[] = [
  { from: "y4", to: "ir-0701", type: "involved_in", label: "involved in" },
  { from: "y4", to: "ca-0701", type: "audited", label: "subject of" },
  { from: "ir-0701", to: "sop-001", type: "references", label: "references" },
  { from: "y1", to: "tx-001", type: "has_plan", label: "treatment plan" },
  { from: "y1", to: "med-001", type: "prescribed", label: "medication order" },
  { from: "y1", to: "ir-0615", type: "involved_in", label: "involved in" },
  { from: "ir-0615", to: "med-001", type: "references", label: "PRN event" },
  { from: "y2", to: "tx-002", type: "has_plan", label: "treatment plan" },
  { from: "y2", to: "med-002", type: "prescribed", label: "medication order" },
  { from: "y3", to: "doc-001", type: "has_document", label: "intake document" },
  { from: "cap-001", to: "auth-001", type: "relates_to", label: "revenue impact" },
  { from: "cap-002", to: "sop-001", type: "relates_to", label: "staffing impact" },
  { from: "wo-002", to: "y2", type: "affects", label: "affects room" },
  { from: "sop-002", to: "med-001", type: "governs", label: "governs" },
  { from: "sop-002", to: "med-002", type: "governs", label: "governs" },
  { from: "ca-0701", to: "sop-002", type: "references", label: "audit reference" },
];

const syntheticKnowledgeFixturesEnabled = (() => {
  try {
    assertSyntheticScenarioRuntime(env);
    return true;
  } catch {
    return false;
  }
})();

export const m29Router = createRouter({
  // ─── Semantic Search ─────────────────────────────────────
  search: publicQuery
    .input(z.object({ query: z.string().min(1), filters: z.object({
      types: z.array(z.string()).optional(),
      modules: z.array(z.string()).optional(),
      status: z.array(z.string()).optional(),
    }).optional() }))
    .query(async ({ input }) => {
      if (!syntheticKnowledgeFixturesEnabled) return [];
      const q = input.query.toLowerCase();
      const filters = input.filters;

      let results = ENTITY_DB.map(entity => {
        let score = 0;
        // Title match
        if (entity.title.toLowerCase().includes(q)) score += 10;
        // Subtitle match
        if (entity.subtitle.toLowerCase().includes(q)) score += 5;
        // Tag match
        entity.tags.forEach(tag => {
          if (tag.toLowerCase().includes(q)) score += 8;
          // Fuzzy tag matching
          const tagWords = tag.toLowerCase().split(/[-_]/);
          const queryWords = q.split(/\s+/);
          queryWords.forEach(qw => {
            if (tagWords.some(tw => tw.includes(qw) || qw.includes(tw))) score += 4;
          });
        });
        // Type match
        if (entity.type.toLowerCase().includes(q)) score += 3;
        // Module match
        if (entity.module.toLowerCase().includes(q)) score += 2;

        return { ...entity, score };
      }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

      // Apply filters
      if (filters?.types?.length) results = results.filter(r => filters.types!.includes(r.type));
      if (filters?.modules?.length) results = results.filter(r => filters.modules!.includes(r.module));
      if (filters?.status?.length) results = results.filter(r => filters.status!.includes(r.status));

      return results.slice(0, 20);
    }),

  // ─── Get Entity Relationships ────────────────────────────
  getRelationships: publicQuery
    .input(z.object({ entityId: z.string() }))
    .query(async ({ input }) => {
      if (!syntheticKnowledgeFixturesEnabled) return [];
      const outgoing = RELATIONSHIPS.filter(r => r.from === input.entityId);
      const incoming = RELATIONSHIPS.filter(r => r.to === input.entityId);

      const connected = [...outgoing, ...incoming].map(r => {
        const otherId = r.from === input.entityId ? r.to : r.from;
        const entity = ENTITY_DB.find(e => e.id === otherId);
        return {
          relationship: r,
          entity: entity ?? null,
          direction: r.from === input.entityId ? "outgoing" : "incoming" as const,
        };
      }).filter(r => r.entity !== null);

      return connected;
    }),

  // ─── Get Entity by ID ────────────────────────────────────
  getEntity: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      if (!syntheticKnowledgeFixturesEnabled) return null;
      return ENTITY_DB.find(e => e.id === input.id) ?? null;
    }),

  // ─── Get Related Entities (multi-hop) ────────────────────
  getRelated: publicQuery
    .input(z.object({ entityId: z.string(), hops: z.number().default(1) }))
    .query(async ({ input }) => {
      if (!syntheticKnowledgeFixturesEnabled) return [];
      const visited = new Set<string>();
      const queue: { id: string; hop: number }[] = [{ id: input.entityId, hop: 0 }];
      const related: Entity[] = [];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id)) continue;
        visited.add(current.id);

        if (current.hop > 0) {
          const entity = ENTITY_DB.find(e => e.id === current.id);
          if (entity) related.push({ ...entity, relevance: 1 - current.hop * 0.3 });
        }

        if (current.hop < input.hops) {
          RELATIONSHIPS.filter(r => r.from === current.id || r.to === current.id)
            .forEach(r => {
              const nextId = r.from === current.id ? r.to : r.from;
              if (!visited.has(nextId)) queue.push({ id: nextId, hop: current.hop + 1 });
            });
        }
      }

      return related;
    }),

  // ─── Typeahead / Autocomplete ────────────────────────────
  typeahead: publicQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      if (!syntheticKnowledgeFixturesEnabled) return [];
      const q = input.query.toLowerCase();
      const matches = ENTITY_DB.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      ).slice(0, 8);

      return matches.map(m => ({
        id: m.id,
        title: m.title,
        type: m.type,
        module: m.module,
      }));
    }),

  // ─── Get Stats ───────────────────────────────────────────
  stats: publicQuery.query(async () => {
    if (!syntheticKnowledgeFixturesEnabled) {
      return { totalEntities: 0, totalRelationships: 0, byType: {}, byModule: {} };
    }
    const byType = ENTITY_DB.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byModule = ENTITY_DB.reduce((acc, e) => {
      acc[e.module] = (acc[e.module] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const relationshipCount = RELATIONSHIPS.length;

    return {
      totalEntities: ENTITY_DB.length,
      totalRelationships: relationshipCount,
      byType,
      byModule,
    };
  }),
});
