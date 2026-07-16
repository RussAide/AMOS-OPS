import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M14: Assessment Framework Router ────────────────────────

type AssessmentRow = Record<string, unknown>;

export const M41C_NARRATIVE_ASSESSMENT_COLUMNS = `
  id, youth_id, mrn, youth_name, assessment_type, assessment_date,
  completed_by, completed_by_id, presenting_problems, psychiatric_history,
  substance_use_history, trauma_history, medical_history, family_history,
  educational_history, status, reviewed_by, reviewed_at, approved_by,
  approved_at, created_at, updated_at, created_by, updated_by
`;

export function quarantineM14UnapprovedClinicalLogic(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED: incomplete scoring, derived risk bands, and generic level-of-care determination are unavailable. Use the governed M4.1C program-specific workflow.",
  });
}

export const m14Router = createRouter({
  // ─── Assessments CRUD ──────────────────────────────────────
  listAssessments: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          status: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT ${M41C_NARRATIVE_ASSESSMENT_COLUMNS} FROM assessments WHERE 1=1`;
      const params: unknown[] = [];
      if (input?.youthId) {
        sql += " AND youth_id = ?";
        params.push(input.youthId);
      }
      if (input?.status) {
        sql += " AND status = ?";
        params.push(input.status);
      }
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getAssessment: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const assessment = sqlite
        .prepare(
          `SELECT ${M41C_NARRATIVE_ASSESSMENT_COLUMNS} FROM assessments WHERE id = ?`,
        )
        .get(input.id) as AssessmentRow | undefined;
      if (!assessment) return null;
      const domains =
        sqlite
          .prepare(
            `SELECT id, assessment_id, domain_number, domain_name,
            strengths, needs, observations, clinical_notes, intervention_needed,
            intervention_description, created_at, updated_at
            FROM assessment_domains WHERE assessment_id = ? ORDER BY domain_number`,
          )
          .all(input.id) ?? [];
      return { ...assessment, domains };
    }),

  createAssessment: authedQuery
    .input(
      z.object({
        youthId: z.string(),
        mrn: z.string(),
        youthName: z.string(),
        assessmentType: z
          .enum([
            "intake",
            "quarterly",
            "annual",
            "discharge",
            "incident_driven",
          ])
          .default("intake"),
        assessmentDate: z.string(),
        presentingProblems: z.string().optional(),
        psychiatricHistory: z.string().optional(),
        substanceUseHistory: z.string().optional(),
        traumaHistory: z.string().optional(),
        medicalHistory: z.string().optional(),
        familyHistory: z.string().optional(),
        educationalHistory: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const actorId = ctx.user?.id ?? "";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite
        .prepare(
          `INSERT INTO assessments (
        id, youth_id, mrn, youth_name, assessment_type, assessment_date,
        completed_by, completed_by_id, presenting_problems, psychiatric_history,
        substance_use_history, trauma_history, medical_history, family_history,
        educational_history, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.youthId,
          input.mrn,
          input.youthName,
          input.assessmentType,
          input.assessmentDate,
          actor,
          actorId,
          input.presentingProblems ?? null,
          input.psychiatricHistory ?? null,
          input.substanceUseHistory ?? null,
          input.traumaHistory ?? null,
          input.medicalHistory ?? null,
          input.familyHistory ?? null,
          input.educationalHistory ?? null,
          "draft",
          now,
          now,
          actor,
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
        sqlite
          .prepare(
            `INSERT INTO assessment_domains (
          id, assessment_id, domain_number, domain_name, intervention_needed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
          )
          .run(domainId, id, i + 1, domainNames[i], now, now);
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
    .input(
      z.object({
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
        cansRiskLevel: z
          .enum(["low", "moderate", "high", "very_high"])
          .optional(),
        locDetermined: z.boolean().optional(),
        locLevel: z
          .enum([
            "loc_1_high_acuity",
            "loc_2_moderate_acuity",
            "loc_3_low_acuity",
            "not_determined",
          ])
          .optional(),
        locDecisionMatrixJson: z.string().optional(),
        locClinicalRationale: z.string().optional(),
        locApprovedBy: z.string().optional(),
        riskSuicide: z
          .enum(["none", "low", "moderate", "high", "imminent"])
          .optional(),
        riskSelfHarm: z
          .enum(["none", "low", "moderate", "high", "imminent"])
          .optional(),
        riskAggression: z
          .enum(["none", "low", "moderate", "high", "imminent"])
          .optional(),
        riskElopement: z
          .enum(["none", "low", "moderate", "high", "imminent"])
          .optional(),
        riskSubstanceUse: z
          .enum(["none", "low", "moderate", "high", "imminent"])
          .optional(),
        riskVulnerability: z
          .enum(["none", "low", "moderate", "high", "imminent"])
          .optional(),
        overallRiskLevel: z
          .enum(["low", "moderate", "high", "critical"])
          .optional(),
        safetyPlanRequired: z.boolean().optional(),
        safetyPlanCompleted: z.boolean().optional(),
        status: z
          .enum([
            "draft",
            "in_progress",
            "pending_review",
            "completed",
            "superseded",
          ])
          .optional(),
        reviewedBy: z.string().optional(),
        approvedBy: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.cansCompleted !== undefined ||
        input.cansTotalScore !== undefined ||
        input.cansRiskLevel !== undefined ||
        input.locDetermined !== undefined ||
        input.locLevel !== undefined ||
        input.locDecisionMatrixJson !== undefined ||
        input.locClinicalRationale !== undefined ||
        input.locApprovedBy !== undefined ||
        input.riskSuicide !== undefined ||
        input.riskSelfHarm !== undefined ||
        input.riskAggression !== undefined ||
        input.riskElopement !== undefined ||
        input.riskSubstanceUse !== undefined ||
        input.riskVulnerability !== undefined ||
        input.overallRiskLevel !== undefined ||
        input.safetyPlanRequired !== undefined ||
        input.safetyPlanCompleted !== undefined
      ) {
        quarantineM14UnapprovedClinicalLogic();
      }
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
        status: "status",
        reviewedBy: "reviewed_by",
        reviewedAt: "reviewed_at",
        approvedBy: "approved_by",
        approvedAt: "approved_at",
      };

      const updates: string[] = [];
      const values: unknown[] = [];

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
        sqlite
          .prepare(`UPDATE assessments SET ${updates.join(", ")} WHERE id = ?`)
          .run(...values, id);
      }

      auditLog({
        action: "m14:updateAssessment",
        actor,
        resource: `assessment:${id}`,
      });
      return { success: true };
    }),

  // ─── Assessment Domains ────────────────────────────────────
  updateDomain: authedQuery
    .input(
      z.object({
        id: z.string(),
        score: z.number().min(0).max(3).optional(),
        scoreLabel: z
          .enum(["no_evidence", "mild", "moderate", "severe"])
          .optional(),
        strengths: z.string().optional(),
        needs: z.string().optional(),
        observations: z.string().optional(),
        clinicalNotes: z.string().optional(),
        interventionNeeded: z.boolean().optional(),
        interventionDescription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.score !== undefined || input.scoreLabel !== undefined) {
        quarantineM14UnapprovedClinicalLogic();
      }
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const now = new Date().toISOString();

      const fieldMap: Record<string, string> = {
        strengths: "strengths",
        needs: "needs",
        observations: "observations",
        clinicalNotes: "clinical_notes",
        interventionNeeded: "intervention_needed",
        interventionDescription: "intervention_description",
      };

      const updates: string[] = [];
      const values: unknown[] = [];

      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          const column = fieldMap[key];
          if (!column) continue;
          updates.push(`${column} = ?`);
          values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = ?");
        values.push(now);
        sqlite
          .prepare(
            `UPDATE assessment_domains SET ${updates.join(", ")} WHERE id = ?`,
          )
          .run(...values, id);
      }

      auditLog({ action: "m14:updateDomain", actor, resource: `domain:${id}` });
      return { success: true };
    }),

  // ─── LOC Determination Matrix ──────────────────────────────
  determineLOC: authedQuery
    .input(
      z.object({
        assessmentId: z.string(),
        decisionAreas: z.object({
          safetyRisk: z.enum(["high", "moderate", "low"]),
          clinicalComplexity: z.enum(["high", "moderate", "low"]),
          functionalImpairment: z.enum(["high", "moderate", "low"]),
          familySupport: z.enum(["high", "moderate", "low"]),
        }),
        clinicalRationale: z.string(),
      }),
    )
    .mutation(() => quarantineM14UnapprovedClinicalLogic()),
});
