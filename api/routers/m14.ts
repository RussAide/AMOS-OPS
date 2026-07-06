import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M14: Assessment Framework Router ────────────────────────

export const m14Router = createRouter({
  // ─── Assessments CRUD ──────────────────────────────────────
  listAssessments: authedQuery
    .input(z.object({ youthId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM assessments WHERE 1=1";
      const params: any[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getAssessment: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const assessment = sqlite.prepare("SELECT * FROM assessments WHERE id = ?").get(input.id) as any;
      if (!assessment) return null;
      const domains = sqlite.prepare("SELECT * FROM assessment_domains WHERE assessment_id = ? ORDER BY domain_number").all(input.id) ?? [];
      return { ...assessment, domains };
    }),

  createAssessment: authedQuery
    .input(z.object({
      youthId: z.string(),
      mrn: z.string(),
      youthName: z.string(),
      assessmentType: z.enum(["intake", "quarterly", "annual", "discharge", "incident_driven"]).default("intake"),
      assessmentDate: z.string(),
      presentingProblems: z.string().optional(),
      psychiatricHistory: z.string().optional(),
      substanceUseHistory: z.string().optional(),
      traumaHistory: z.string().optional(),
      medicalHistory: z.string().optional(),
      familyHistory: z.string().optional(),
      educationalHistory: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const actorId = ctx.user?.id ?? "";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`INSERT INTO assessments (
        id, youth_id, mrn, youth_name, assessment_type, assessment_date,
        completed_by, completed_by_id, presenting_problems, psychiatric_history,
        substance_use_history, trauma_history, medical_history, family_history,
        educational_history, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.youthId, input.mrn, input.youthName, input.assessmentType,
        input.assessmentDate, actor, actorId, input.presentingProblems ?? null,
        input.psychiatricHistory ?? null, input.substanceUseHistory ?? null,
        input.traumaHistory ?? null, input.medicalHistory ?? null,
        input.familyHistory ?? null, input.educationalHistory ?? null,
        "draft", now, now, actor
      );

      // Create 6 empty domain records
      const domainNames = [
        "Behavioral / Emotional Functioning",
        "Cognitive / Developmental Functioning",
        "Social / Relational Functioning",
        "Family / Caregiver Functioning",
        "Safety / Risk Behaviors",
        "Physical Health / Medical",
      ];
      for (let i = 0; i < 6; i++) {
        const domainId = randomUUID();
        sqlite.prepare(`INSERT INTO assessment_domains (
          id, assessment_id, domain_number, domain_name, intervention_needed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)`).run(
          domainId, id, i + 1, domainNames[i], now, now
        );
      }

      auditLog({
        action: "m14:createAssessment",
        actor,
        resource: `assessment:${id}`,
        details: `Created ${input.assessmentType} assessment for ${input.youthName}`,
      });

      return { id, ...input, status: "draft", createdAt: now };
    }),

  updateAssessment: authedQuery
    .input(z.object({
      id: z.string(),
      presentingProblems: z.string().optional(),
      psychiatricHistory: z.string().optional(),
      substanceUseHistory: z.string().optional(),
      traumaHistory: z.string().optional(),
      medicalHistory: z.string().optional(),
      familyHistory: z.string().optional(),
      educationalHistory: z.string().optional(),
      cansCompleted: z.boolean().optional(),
      cansTotalScore: z.number().optional(),
      cansRiskLevel: z.enum(["low", "moderate", "high", "very_high"]).optional(),
      locDetermined: z.boolean().optional(),
      locLevel: z.enum(["loc_1_high_acuity", "loc_2_moderate_acuity", "loc_3_low_acuity", "not_determined"]).optional(),
      locDecisionMatrixJson: z.string().optional(),
      locClinicalRationale: z.string().optional(),
      locApprovedBy: z.string().optional(),
      riskSuicide: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
      riskSelfHarm: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
      riskAggression: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
      riskElopement: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
      riskSubstanceUse: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
      riskVulnerability: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
      overallRiskLevel: z.enum(["low", "moderate", "high", "critical"]).optional(),
      safetyPlanRequired: z.boolean().optional(),
      safetyPlanCompleted: z.boolean().optional(),
      status: z.enum(["draft", "in_progress", "pending_review", "completed", "superseded"]).optional(),
      reviewedBy: z.string().optional(),
      approvedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const fieldMap: Record<string, string> = {
        presentingProblems: "presenting_problems",
        psychiatricHistory: "psychiatric_history",
        substanceUseHistory: "substance_use_history",
        traumaHistory: "trauma_history",
        medicalHistory: "medical_history",
        familyHistory: "family_history",
        educationalHistory: "educational_history",
        cansCompleted: "cans_completed",
        cansTotalScore: "cans_total_score",
        cansRiskLevel: "cans_risk_level",
        locDetermined: "loc_determined",
        locLevel: "loc_level",
        locDecisionMatrixJson: "loc_decision_matrix_json",
        locClinicalRationale: "loc_clinical_rationale",
        locApprovedBy: "loc_approved_by",
        locApprovedAt: "loc_approved_at",
        riskSuicide: "risk_suicide",
        riskSelfHarm: "risk_self_harm",
        riskAggression: "risk_aggression",
        riskElopement: "risk_elopement",
        riskSubstanceUse: "risk_substance_use",
        riskVulnerability: "risk_vulnerability",
        overallRiskLevel: "overall_risk_level",
        safetyPlanRequired: "safety_plan_required",
        safetyPlanCompleted: "safety_plan_completed",
        status: "status",
        reviewedBy: "reviewed_by",
        reviewedAt: "reviewed_at",
        approvedBy: "approved_by",
        approvedAt: "approved_at",
      };

      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          const col = fieldMap[key];
          if (!col) continue;
          updates.push(`${col} = ?`);
          if (typeof val === "boolean") {
            values.push(val ? 1 : 0);
          } else {
            values.push(val);
          }
          // Set timestamp for approval/review
          if (key === "locApprovedBy") {
            updates.push("loc_approved_at = ?");
            values.push(now);
          }
          if (key === "reviewedBy") {
            updates.push("reviewed_at = ?");
            values.push(now);
          }
          if (key === "approvedBy") {
            updates.push("approved_at = ?");
            values.push(now);
          }
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = ?");
        updates.push("updated_by = ?");
        values.push(now, actor);
        sqlite.prepare(`UPDATE assessments SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }

      auditLog({ action: "m14:updateAssessment", actor, resource: `assessment:${id}` });
      return { success: true };
    }),

  // ─── Assessment Domains ────────────────────────────────────
  updateDomain: authedQuery
    .input(z.object({
      id: z.string(),
      score: z.number().min(0).max(3).optional(),
      scoreLabel: z.enum(["no_evidence", "mild", "moderate", "severe"]).optional(),
      strengths: z.string().optional(),
      needs: z.string().optional(),
      observations: z.string().optional(),
      clinicalNotes: z.string().optional(),
      interventionNeeded: z.boolean().optional(),
      interventionDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const fieldMap: Record<string, string> = {
        score: "score", scoreLabel: "score_label", strengths: "strengths",
        needs: "needs", observations: "observations", clinicalNotes: "clinical_notes",
        interventionNeeded: "intervention_needed", interventionDescription: "intervention_description",
      };

      const updates: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          updates.push(`${fieldMap[key]} = ?`);
          values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = ?");
        values.push(now);
        sqlite.prepare(`UPDATE assessment_domains SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }

      auditLog({ action: "m14:updateDomain", actor, resource: `domain:${id}` });
      return { success: true };
    }),

  // ─── LOC Determination Matrix ──────────────────────────────
  determineLOC: authedQuery
    .input(z.object({
      assessmentId: z.string(),
      decisionAreas: z.object({
        safetyRisk: z.enum(["high", "moderate", "low"]),
        clinicalComplexity: z.enum(["high", "moderate", "low"]),
        functionalImpairment: z.enum(["high", "moderate", "low"]),
        familySupport: z.enum(["high", "moderate", "low"]),
      }),
      clinicalRationale: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const now = new Date().toISOString();

      // LOC determination logic: count high/moderate areas
      const areas = Object.values(input.decisionAreas);
      const highCount = areas.filter(a => a === "high").length;
      const moderateCount = areas.filter(a => a === "moderate").length;

      let locLevel: string;
      if (highCount >= 2 || (highCount >= 1 && input.decisionAreas.safetyRisk === "high")) {
        locLevel = "loc_1_high_acuity";
      } else if (highCount >= 1 || moderateCount >= 2) {
        locLevel = "loc_2_moderate_acuity";
      } else {
        locLevel = "loc_3_low_acuity";
      }

      sqlite.prepare(`UPDATE assessments SET
        loc_determined = 1, loc_level = ?, loc_decision_matrix_json = ?,
        loc_clinical_rationale = ?, loc_approved_by = ?, loc_approved_at = ?,
        updated_at = ?, updated_by = ?
      WHERE id = ?`).run(
        locLevel, JSON.stringify(input.decisionAreas), input.clinicalRationale,
        actor, now, now, actor, input.assessmentId
      );

      // Update youth profile LOC
      const assessment = sqlite.prepare("SELECT youth_id FROM assessments WHERE id = ?").get(input.assessmentId) as any;
      if (assessment) {
        sqlite.prepare("UPDATE youth_profiles SET level_of_care = ?, updated_at = ? WHERE id = ?")
          .run(locLevel, now, assessment.youth_id);
      }

      auditLog({
        action: "m14:determineLOC",
        actor,
        resource: `assessment:${input.assessmentId}`,
        details: `LOC determined: ${locLevel}`,
      });

      return { success: true, locLevel, highCount, moderateCount };
    }),
});
