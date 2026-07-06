import { z } from "zod";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

export const m21Router = createRouter({
  listAudits: authedQuery
    .input(z.object({ youthId: z.string().optional(), result: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM chart_audits WHERE 1=1";
      const params: any[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      if (input?.result) { sql += " AND overall_result = ?"; params.push(input.result); }
      sql += " ORDER BY audit_date DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getAudit: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite.prepare("SELECT * FROM chart_audits WHERE id = ?").get(input.id);
      return row ?? null;
    }),

  createAudit: authedQuery
    .input(z.object({
      youthId: z.string(), youthName: z.string(), mrn: z.string(),
      auditDate: z.string(), auditorName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO chart_audits (id, youth_id, youth_name, mrn, audit_date, auditor_name, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.youthId, input.youthName, input.mrn, input.auditDate, input.auditorName, now, now, actor);
      auditLog({ action: "m18:createAudit", actor, resource: `audit:${id}` });
      return { id, ...input, createdAt: now };
    }),

  updateAudit: authedQuery
    .input(z.object({
      id: z.string(),
      area1: z.boolean().optional(), area1Notes: z.string().optional(),
      area2: z.boolean().optional(), area2Notes: z.string().optional(),
      area3: z.boolean().optional(), area3Notes: z.string().optional(),
      area4: z.boolean().optional(), area4Notes: z.string().optional(),
      area5: z.boolean().optional(), area5Notes: z.string().optional(),
      area6: z.boolean().optional(), area6Notes: z.string().optional(),
      area7: z.boolean().optional(), area7Notes: z.string().optional(),
      area8: z.boolean().optional(), area8Notes: z.string().optional(),
      area9: z.boolean().optional(), area9Notes: z.string().optional(),
      correctiveActions: z.string().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const areaMap: Record<string, { field: string; notes: string }> = {
        area1: { field: "area1_identifying_info", notes: "area1_notes" },
        area2: { field: "area2_consent_forms", notes: "area2_notes" },
        area3: { field: "area3_assessment_current", notes: "area3_notes" },
        area4: { field: "area4_treatment_plan", notes: "area4_notes" },
        area5: { field: "area5_progress_notes", notes: "area5_notes" },
        area6: { field: "area6_medication_records", notes: "area6_notes" },
        area7: { field: "area7_safety_plans", notes: "area7_notes" },
        area8: { field: "area8_incident_reports", notes: "area8_notes" },
        area9: { field: "area9_authorization_billing", notes: "area9_notes" },
      };

      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(fields)) {
        if (val === undefined) continue;
        if (key.endsWith("Notes")) {
          const areaKey = key.replace("Notes", "");
          updates.push(`${areaMap[areaKey].notes} = ?`);
          values.push(val);
        } else {
          updates.push(`${areaMap[key].field} = ?`);
          values.push(val ? 1 : 0);
        }
      }

      if (updates.length > 0) {
        const current = sqlite.prepare("SELECT * FROM chart_audits WHERE id = ?").get(id) as any;
        if (current) {
          const allAreas = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (fields as any)[`area${i}`] ?? current[`area${i}_identifying_info`] ?? current[areaMap[`area${i}`].field]);
          const passed = allAreas.filter(Boolean).length;
          updates.push("areas_passed = ?"); values.push(passed);

          let result = "incomplete";
          if (passed === 9) result = "pass";
          else if (passed >= 7) result = "pass_with_notes";
          else if (passed > 0) result = "fail";
          updates.push("overall_result = ?"); values.push(result);
        }
        updates.push("updated_at = ?"); values.push(new Date().toISOString());
        sqlite.prepare(`UPDATE chart_audits SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }
      auditLog({ action: "m18:updateAudit", actor, resource: `audit:${id}` });
      return { success: true };
    }),

  // ─── M21: Persona Activation Wave 1 ────────────────────

  listPersonas: publicQuery.query(async () => {
    const rows = sqlite.prepare("SELECT * FROM agent_personas ORDER BY sort_order").all() as any[];
    if (rows.length === 0) return PERSONA_SEED;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      status: r.status,
      wave: r.wave,
      category: r.category,
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
      outputs: r.outputs ? JSON.parse(r.outputs) : [],
      activatedAt: r.activated_at,
      sortOrder: r.sort_order,
    }));
  }),

  getPersona: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const r = sqlite.prepare("SELECT * FROM agent_personas WHERE id = ?").get(input.id) as any;
      if (!r) return null;
      return {
        id: r.id, name: r.name, code: r.code, description: r.description,
        status: r.status, wave: r.wave, category: r.category,
        permissions: r.permissions ? JSON.parse(r.permissions) : [],
        outputs: r.outputs ? JSON.parse(r.outputs) : [],
        activatedAt: r.activated_at, sortOrder: r.sort_order,
      };
    }),

  activatePersona: publicQuery
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const status = input.active ? "active" : "inactive";
      const activatedAt = input.active ? new Date().toISOString() : null;
      sqlite.prepare("UPDATE agent_personas SET status = ?, activated_at = ? WHERE id = ?")
        .run(status, activatedAt, input.id);
      return { success: true, id: input.id, status };
    }),

  getActivationStatus: publicQuery.query(async () => {
    const rows = sqlite.prepare("SELECT status, COUNT(*) as count FROM agent_personas GROUP BY status").all() as any[];
    const byWave = sqlite.prepare("SELECT wave, status, COUNT(*) as count FROM agent_personas GROUP BY wave, status").all() as any[];
    const total = sqlite.prepare("SELECT COUNT(*) as c FROM agent_personas").get() as any;
    return {
      total: total?.c ?? 0,
      active: rows.find(r => r.status === "active")?.count ?? 0,
      inactive: rows.find(r => r.status === "inactive")?.count ?? 0,
      byWave: byWave.reduce((acc: any, r: any) => {
        if (!acc[r.wave]) acc[r.wave] = { active: 0, inactive: 0 };
        acc[r.wave][r.status] = r.count;
        return acc;
      }, {}),
    };
  }),
});

// ─── Persona Seed Data (13 personas) ─────────────────────

const PERSONA_SEED = [
  { id: "amos-prime", name: "AMOS-Prime", code: "AP", description: "Executive orchestration persona. Top-level task routing, cross-system coordination, and strategic synthesis.", status: "inactive", wave: "wave3", category: "Executive", permissions: ["all_read", "routing_write"], outputs: ["memos", "decisions", "alerts"], activatedAt: null, sortOrder: 1 },
  { id: "amos-core", name: "AMOS-Core", code: "AC", description: "Universal operational backbone. Dashboard aggregation, notification routing, cross-module search, and daily operational support.", status: "active", wave: "pilot", category: "Core", permissions: ["all_read", "ops_write"], outputs: ["dashboards", "alerts", "search_results"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 2 },
  { id: "amos-nxl", name: "AMOS-NXL", code: "ANXL", description: "Narrative intelligence engine. Generates operational narratives, trend explanations, and executive briefings from live data.", status: "inactive", wave: "wave3", category: "Intelligence", permissions: ["analytics_read", "narrative_write"], outputs: ["briefings", "narratives", "summaries"], activatedAt: null, sortOrder: 3 },
  { id: "amos-thesis", name: "AMOS-THESIS", code: "AT", description: "Research and evidence synthesis. Academic literature review, regulatory research, evidence-based recommendation engine.", status: "inactive", wave: "wave3", category: "Research", permissions: ["research_read", "synthesis_write"], outputs: ["reports", "literature_reviews", "recommendations"], activatedAt: null, sortOrder: 4 },
  { id: "amos-dms", name: "AMOS-DMS", code: "ADMS", description: "Document management specialist. Document lifecycle, template generation, packet assembly, and compliance publishing.", status: "inactive", wave: "wave3", category: "Documents", permissions: ["documents_read", "dms_write", "templates_write"], outputs: ["documents", "packets", "templates"], activatedAt: null, sortOrder: 5 },
  { id: "amos-sentinel", name: "AMOS-Sentinel", code: "ASENT", description: "QA and compliance guardian. Audit readiness, CAP tracking, deficiency monitoring, regulatory compliance verification.", status: "active", wave: "pilot", category: "Compliance", permissions: ["qa_read", "audit_write", "compliance_write"], outputs: ["audits", "cap_plans", "compliance_reports"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 6 },
  { id: "amos-scribe", name: "AMOS-Scribe", code: "ASCR", description: "Document production engine. Branded DOCX/PDF/Excel generation, template library, controlled publishing workflow.", status: "active", wave: "pilot", category: "Documents", permissions: ["documents_read", "studio_write", "templates_write"], outputs: ["documents", "presentations", "spreadsheets"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 7 },
  { id: "amos-clinical", name: "AMOS-Clinical", code: "ACL", description: "Clinical operations specialist. BHC care delivery, CANS/ANSA assessment support, treatment planning, clinical documentation guidance.", status: "active", wave: "pilot", category: "Clinical", permissions: ["clinical_read", "clinical_write", "phi_access"], outputs: ["assessments", "treatment_plans", "clinical_notes"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 8 },
  { id: "amos-gro", name: "AMOS-GRO", code: "AGRO", description: "Residential operations specialist. GRO shift management, youth care logs, behavioral observations, safety rounds, census tracking.", status: "active", wave: "pilot", category: "Residential", permissions: ["gro_read", "gro_write", "residential_write"], outputs: ["shift_logs", "observations", "care_plans"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 9 },
  { id: "amos-revenue", name: "AMOS-Revenue", code: "AREV", description: "Revenue cycle specialist. Authorizations, claims management, billing readiness, payer packet assembly, denials tracking.", status: "active", wave: "pilot", category: "Revenue", permissions: ["revenue_read", "billing_write", "claims_write"], outputs: ["claims", "authorizations", "payer_packets"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 10 },
  { id: "amos-hr", name: "AMOS-HR", code: "AHR", description: "Human resources specialist. Onboarding workflow, credential tracking, training assignments, performance documentation, compliance auditing.", status: "inactive", wave: "wave1", category: "HR", permissions: ["hr_read", "hr_write", "credentials_write"], outputs: ["onboarding_plans", "credentials_reports", "performance_reviews"], activatedAt: null, sortOrder: 11 },
  { id: "amos-coach", name: "AMOS-Coach", code: "ACOACH", description: "Training and coaching facilitator. Staff development, competency tracking, scenario-based learning, performance coaching.", status: "inactive", wave: "wave2", category: "Training", permissions: ["training_read", "coaching_write"], outputs: ["training_plans", "competency_assessments", "coaching_sessions"], activatedAt: null, sortOrder: 12 },
  { id: "amos-strategy", name: "AMOS-Strategy", code: "ASTRAT", description: "Strategic planning analyst. Growth initiatives, market analysis, board reporting, risk register, strategic decision support.", status: "inactive", wave: "wave2", category: "Strategy", permissions: ["executive_read", "strategy_write"], outputs: ["strategic_plans", "risk_registers", "board_memos"], activatedAt: null, sortOrder: 13 },
];
