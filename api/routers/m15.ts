import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M14: Daily BHC-GRO Coordination Router ──────────────────

interface AssignedClinicianRow {
  assigned_clinician_id: string | null;
  assigned_clinician_name: string | null;
}

interface CountRow {
  c: number;
}

type MeetingRow = Record<string, unknown>;

export const M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED =
  "M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED" as const;

export function assertM15ObservationScoresAbsent(input: {
  domain1SafetyScore?: unknown;
  domain2RegulationScore?: unknown;
  domain3FunctioningScore?: unknown;
  domain4MedicationScore?: unknown;
  domain5RelationshipsScore?: unknown;
  domain6ParticipationScore?: unknown;
}): void {
  if (
    input.domain1SafetyScore !== undefined ||
    input.domain2RegulationScore !== undefined ||
    input.domain3FunctioningScore !== undefined ||
    input.domain4MedicationScore !== undefined ||
    input.domain5RelationshipsScore !== undefined ||
    input.domain6ParticipationScore !== undefined
  ) {
    throw new Error(M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED);
  }
}

export const M41C_NARRATIVE_OBSERVATION_COLUMNS = `
  id, youth_id, youth_name, mrn, observation_date, shift, observed_by,
  observed_by_id, domain1_safety, domain1_safety_notes, domain2_regulation,
  domain2_regulation_notes, domain3_functioning, domain3_functioning_notes,
  domain4_medication, domain4_medication_notes, domain5_relationships,
  domain5_relationships_notes, domain6_participation,
  domain6_participation_notes, clinical_concerns, clinician_response,
  responded_by, responded_at, created_at, updated_at, created_by
`;

export const m15Router = createRouter({
  // ─── Daily Observations ────────────────────────────────────
  listObservations: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          shift: z.string().optional(),
          date: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT ${M41C_NARRATIVE_OBSERVATION_COLUMNS} FROM daily_observations WHERE 1=1`;
      const params: unknown[] = [];
      if (input?.youthId) {
        sql += " AND youth_id = ?";
        params.push(input.youthId);
      }
      if (input?.shift) {
        sql += " AND shift = ?";
        params.push(input.shift);
      }
      if (input?.date) {
        sql += " AND observation_date = ?";
        params.push(input.date);
      }
      sql += " ORDER BY observation_date DESC, shift DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getObservation: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare(
          `SELECT ${M41C_NARRATIVE_OBSERVATION_COLUMNS} FROM daily_observations WHERE id = ?`,
        )
        .get(input.id);
      return row ?? null;
    }),

  createObservation: authedQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        observationDate: z.string(),
        shift: z.enum(["day", "evening", "night", "overnight"]),
        domain1Safety: z.boolean().optional(),
        domain1SafetyNotes: z.string().optional(),
        domain1SafetyScore: z.number().min(0).max(3).optional(),
        domain2Regulation: z.boolean().optional(),
        domain2RegulationNotes: z.string().optional(),
        domain2RegulationScore: z.number().min(0).max(3).optional(),
        domain3Functioning: z.boolean().optional(),
        domain3FunctioningNotes: z.string().optional(),
        domain3FunctioningScore: z.number().min(0).max(3).optional(),
        domain4Medication: z.boolean().optional(),
        domain4MedicationNotes: z.string().optional(),
        domain4MedicationScore: z.number().min(0).max(3).optional(),
        domain5Relationships: z.boolean().optional(),
        domain5RelationshipsNotes: z.string().optional(),
        domain5RelationshipsScore: z.number().min(0).max(3).optional(),
        domain6Participation: z.boolean().optional(),
        domain6ParticipationNotes: z.string().optional(),
        domain6ParticipationScore: z.number().min(0).max(3).optional(),
        clinicalConcerns: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertM15ObservationScoresAbsent(input);
      const actor = ctx.user?.email ?? "unknown";
      const actorId = ctx.user?.id ?? "";
      const id = randomUUID();
      const now = new Date().toISOString();

      const explicitClinicalConcern = (input.clinicalConcerns ?? "").trim();
      const humanAttentionRequested = explicitClinicalConcern.length > 0;

      // If significant, route to assigned clinician
      let routedToClinician = false;
      let routedToClinicianId: string | null = null;
      let routedToClinicianName: string | null = null;
      if (humanAttentionRequested) {
        const youth = sqlite
          .prepare(
            "SELECT assigned_clinician_id, assigned_clinician_name FROM youth_profiles WHERE id = ?",
          )
          .get(input.youthId) as AssignedClinicianRow | undefined;
        if (youth?.assigned_clinician_id) {
          routedToClinician = true;
          routedToClinicianId = youth.assigned_clinician_id;
          routedToClinicianName = youth.assigned_clinician_name;
        }
      }

      sqlite
        .prepare(
          `INSERT INTO daily_observations (
        id, youth_id, youth_name, mrn, observation_date, shift, observed_by, observed_by_id,
        domain1_safety, domain1_safety_notes, domain1_safety_score,
        domain2_regulation, domain2_regulation_notes, domain2_regulation_score,
        domain3_functioning, domain3_functioning_notes, domain3_functioning_score,
        domain4_medication, domain4_medication_notes, domain4_medication_score,
        domain5_relationships, domain5_relationships_notes, domain5_relationships_score,
        domain6_participation, domain6_participation_notes, domain6_participation_score,
        clinically_significant, clinical_concerns,
        routed_to_clinician, routed_to_clinician_id, routed_to_clinician_name,
        created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.youthId,
          input.youthName,
          input.mrn,
          input.observationDate,
          input.shift,
          actor,
          actorId,
          input.domain1Safety ? 1 : 0,
          input.domain1SafetyNotes ?? null,
          null,
          input.domain2Regulation ? 1 : 0,
          input.domain2RegulationNotes ?? null,
          null,
          input.domain3Functioning ? 1 : 0,
          input.domain3FunctioningNotes ?? null,
          null,
          input.domain4Medication ? 1 : 0,
          input.domain4MedicationNotes ?? null,
          null,
          input.domain5Relationships ? 1 : 0,
          input.domain5RelationshipsNotes ?? null,
          null,
          input.domain6Participation ? 1 : 0,
          input.domain6ParticipationNotes ?? null,
          null,
          humanAttentionRequested ? 1 : 0,
          explicitClinicalConcern || null,
          routedToClinician ? 1 : 0,
          routedToClinicianId,
          routedToClinicianName,
          now,
          now,
          actor,
        );

      auditLog({
        action: "m14:createObservation",
        actor,
        resource: `observation:${id}`,
        details: `Daily narrative observation for ${input.youthName} (${input.shift} shift)${humanAttentionRequested ? " — HUMAN ATTENTION REQUESTED" : ""}`,
      });

      return {
        id,
        youthId: input.youthId,
        youthName: input.youthName,
        mrn: input.mrn,
        observationDate: input.observationDate,
        shift: input.shift,
        humanAttentionRequested,
        routedToClinician,
        createdAt: now,
      };
    }),

  respondToObservation: authedQuery
    .input(
      z.object({
        id: z.string(),
        clinicianResponse: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      sqlite
        .prepare(
          "UPDATE daily_observations SET clinician_response = ?, updated_at = ? WHERE id = ?",
        )
        .run(input.clinicianResponse, new Date().toISOString(), input.id);
      auditLog({
        action: "m14:respondToObservation",
        actor,
        resource: `observation:${input.id}`,
      });
      return { success: true };
    }),

  // ─── Meetings ──────────────────────────────────────────────
  listMeetings: authedQuery
    .input(
      z
        .object({
          meetingType: z.string().optional(),
          status: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = "SELECT * FROM meetings WHERE 1=1";
      const params: unknown[] = [];
      if (input?.meetingType) {
        sql += " AND meeting_type = ?";
        params.push(input.meetingType);
      }
      if (input?.status) {
        sql += " AND status = ?";
        params.push(input.status);
      }
      sql += " ORDER BY scheduled_date DESC, scheduled_time DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getMeeting: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const meeting = sqlite
        .prepare("SELECT * FROM meetings WHERE id = ?")
        .get(input.id) as MeetingRow | undefined;
      if (!meeting) return null;
      const actionItems =
        sqlite
          .prepare(
            "SELECT * FROM meeting_action_items WHERE meeting_id = ? ORDER BY created_at DESC",
          )
          .all(input.id) ?? [];
      return { ...meeting, actionItems };
    }),

  createMeeting: authedQuery
    .input(
      z.object({
        meetingType: z.enum([
          "daily_huddle",
          "case_staffing",
          "treatment_plan_review",
          "family_conference",
        ]),
        title: z.string(),
        scheduledDate: z.string(),
        scheduledTime: z.string().optional(),
        durationMinutes: z.number().optional(),
        facilitatorName: z.string().optional(),
        attendeesJson: z.string().optional(),
        youthIdsJson: z.string().optional(),
        agendaJson: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite
        .prepare(
          `INSERT INTO meetings (
        id, meeting_type, title, scheduled_date, scheduled_time, duration_minutes,
        facilitator_name, attendees_json, youth_ids_json, agenda_json, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.meetingType,
          input.title,
          input.scheduledDate,
          input.scheduledTime ?? null,
          input.durationMinutes ?? 30,
          input.facilitatorName ?? null,
          input.attendeesJson ?? null,
          input.youthIdsJson ?? null,
          input.agendaJson ?? null,
          "scheduled",
          now,
          now,
          actor,
        );

      auditLog({
        action: "m14:createMeeting",
        actor,
        resource: `meeting:${id}`,
        details: `Created ${input.meetingType}: ${input.title}`,
      });
      return { id, ...input, status: "scheduled", createdAt: now };
    }),

  updateMeeting: authedQuery
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        status: z
          .enum([
            "scheduled",
            "in_progress",
            "completed",
            "cancelled",
            "no_show",
          ])
          .optional(),
        notes: z.string().optional(),
        followUpRequired: z.boolean().optional(),
        followUpNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (fields.title !== undefined) {
        updates.push("title = ?");
        values.push(fields.title);
      }
      if (fields.status !== undefined) {
        updates.push("status = ?");
        values.push(fields.status);
        if (fields.status === "completed") {
          updates.push("completed_at = ?");
          values.push(new Date().toISOString());
        }
      }
      if (fields.notes !== undefined) {
        updates.push("notes = ?");
        values.push(fields.notes);
      }
      if (fields.followUpRequired !== undefined) {
        updates.push("follow_up_required = ?");
        values.push(fields.followUpRequired ? 1 : 0);
      }
      if (fields.followUpNotes !== undefined) {
        updates.push("follow_up_notes = ?");
        values.push(fields.followUpNotes);
      }

      if (updates.length > 0) {
        updates.push("updated_at = ?");
        values.push(new Date().toISOString());
        sqlite
          .prepare(`UPDATE meetings SET ${updates.join(", ")} WHERE id = ?`)
          .run(...values, id);
      }
      auditLog({
        action: "m14:updateMeeting",
        actor,
        resource: `meeting:${id}`,
      });
      return { success: true };
    }),

  // ─── Meeting Action Items ──────────────────────────────────
  createActionItem: authedQuery
    .input(
      z.object({
        meetingId: z.string(),
        description: z.string(),
        assignedToName: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite
        .prepare(
          `INSERT INTO meeting_action_items (
        id, meeting_id, description, assigned_to_name, priority, due_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.meetingId,
          input.description,
          input.assignedToName ?? null,
          input.priority ?? "medium",
          input.dueDate ?? null,
          "open",
          now,
          now,
        );
      auditLog({
        action: "m14:createActionItem",
        actor,
        resource: `action:${id}`,
      });
      return { id, ...input, status: "open", createdAt: now };
    }),

  updateActionItem: authedQuery
    .input(
      z.object({
        id: z.string(),
        status: z
          .enum(["open", "in_progress", "completed", "overdue"])
          .optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updates: string[] = [];
      const values: unknown[] = [];
      if (fields.status !== undefined) {
        updates.push("status = ?");
        values.push(fields.status);
        if (fields.status === "completed") {
          updates.push("completed_at = ?");
          values.push(new Date().toISOString());
          updates.push("completed_by = ?");
          values.push(actor);
        }
      }
      if (fields.notes !== undefined) {
        updates.push("notes = ?");
        values.push(fields.notes);
      }
      if (updates.length > 0) {
        updates.push("updated_at = ?");
        values.push(new Date().toISOString());
        sqlite
          .prepare(
            `UPDATE meeting_action_items SET ${updates.join(", ")} WHERE id = ?`,
          )
          .run(...values, id);
      }
      return { success: true };
    }),

  // ─── Escalation Events ─────────────────────────────────────
  listEscalations: authedQuery
    .input(
      z
        .object({
          youthId: z.string().optional(),
          tier: z.string().optional(),
          status: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = "SELECT * FROM escalation_events WHERE 1=1";
      const params: unknown[] = [];
      if (input?.youthId) {
        sql += " AND youth_id = ?";
        params.push(input.youthId);
      }
      if (input?.tier) {
        sql += " AND tier = ?";
        params.push(input.tier);
      }
      if (input?.status) {
        sql += " AND status = ?";
        params.push(input.status);
      }
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getEscalation: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare("SELECT * FROM escalation_events WHERE id = ?")
        .get(input.id);
      return row ?? null;
    }),

  createEscalation: authedQuery
    .input(
      z.object({
        youthId: z.string(),
        youthName: z.string(),
        mrn: z.string(),
        tier: z.enum([
          "routine",
          "clinical",
          "urgent",
          "crisis",
          "post_crisis",
        ]),
        previousTier: z
          .enum(["routine", "clinical", "urgent", "crisis", "post_crisis"])
          .optional(),
        triggerSource: z
          .enum([
            "observation",
            "staff_report",
            "family_report",
            "youth_self_report",
            "automated_alert",
          ])
          .optional(),
        triggerDescription: z.string(),
        triggerDetail: z.string().optional(),
        responseActions: z.string().optional(),
        clinicalConcerns: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const actorId = ctx.user?.id ?? "";
      const id = randomUUID();
      const now = new Date().toISOString();

      const requiresPostCrisisReview =
        input.tier === "crisis" || input.tier === "post_crisis";

      sqlite
        .prepare(
          `INSERT INTO escalation_events (
        id, youth_id, youth_name, mrn, tier, previous_tier, trigger_source,
        trigger_description, trigger_detail, response_actions,
        responder_id, responder_name, responder_role, responded_at,
        requires_post_crisis_review, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.youthId,
          input.youthName,
          input.mrn,
          input.tier,
          input.previousTier ?? null,
          input.triggerSource ?? null,
          input.triggerDescription,
          input.triggerDetail ?? null,
          input.responseActions ?? null,
          actorId,
          actor,
          ctx.user?.role ?? "staff",
          now,
          requiresPostCrisisReview ? 1 : 0,
          input.tier === "crisis" ? "escalating" : "active",
          now,
          now,
          actor,
        );

      auditLog({
        action: "m14:createEscalation",
        actor,
        resource: `escalation:${id}`,
        details: `Escalation to ${input.tier} for ${input.youthName}: ${input.triggerDescription}`,
      });

      return {
        id,
        ...input,
        requiresPostCrisisReview,
        status: "active",
        createdAt: now,
      };
    }),

  updateEscalation: authedQuery
    .input(
      z.object({
        id: z.string(),
        tier: z
          .enum(["routine", "clinical", "urgent", "crisis", "post_crisis"])
          .optional(),
        status: z
          .enum([
            "active",
            "escalating",
            "de_escalating",
            "resolved",
            "monitoring",
          ])
          .optional(),
        resolutionNotes: z.string().optional(),
        responseActions: z.string().optional(),
        postCrisisReviewCompleted: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (fields.tier !== undefined) {
        updates.push("tier = ?");
        values.push(fields.tier);
        updates.push("previous_tier = tier");
      }
      if (fields.status !== undefined) {
        updates.push("status = ?");
        values.push(fields.status);
        if (fields.status === "resolved") {
          updates.push("resolved_at = ?");
          values.push(new Date().toISOString());
          updates.push("resolved_by = ?");
          values.push(actor);
        }
      }
      if (fields.resolutionNotes !== undefined) {
        updates.push("resolution_notes = ?");
        values.push(fields.resolutionNotes);
      }
      if (fields.responseActions !== undefined) {
        updates.push("response_actions = ?");
        values.push(fields.responseActions);
      }
      if (fields.postCrisisReviewCompleted !== undefined) {
        updates.push("post_crisis_review_completed = ?");
        values.push(fields.postCrisisReviewCompleted ? 1 : 0);
        if (fields.postCrisisReviewCompleted) {
          updates.push("post_crisis_review_date = ?");
          values.push(new Date().toISOString());
          updates.push("post_crisis_review_by = ?");
          values.push(actor);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = ?");
        values.push(new Date().toISOString());
        sqlite
          .prepare(
            `UPDATE escalation_events SET ${updates.join(", ")} WHERE id = ?`,
          )
          .run(...values, id);
      }

      auditLog({
        action: "m14:updateEscalation",
        actor,
        resource: `escalation:${id}`,
      });
      return { success: true };
    }),

  // ─── Dashboard Summary ─────────────────────────────────────
  coordinationSummary: authedQuery.query(async () => {
    const today = new Date().toISOString().split("T")[0];
    const obsCount = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM daily_observations WHERE observation_date = ?",
      )
      .get(today) as CountRow | undefined;
    const clinicalCount = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM daily_observations WHERE TRIM(COALESCE(clinical_concerns, '')) <> '' AND clinician_response IS NULL",
      )
      .get() as CountRow | undefined;
    const meetingCount = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM meetings WHERE scheduled_date = ? AND status = 'scheduled'",
      )
      .get(today) as CountRow | undefined;
    const openActions = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM meeting_action_items WHERE status IN ('open', 'overdue')",
      )
      .get() as CountRow | undefined;
    const activeEscalations = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM escalation_events WHERE status IN ('active', 'escalating')",
      )
      .get() as CountRow | undefined;
    const crisisCount = sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM escalation_events WHERE tier = 'crisis' AND status IN ('active', 'escalating')",
      )
      .get() as CountRow | undefined;

    return {
      todayObservations: obsCount?.c ?? 0,
      pendingClinicalResponses: clinicalCount?.c ?? 0,
      todaysMeetings: meetingCount?.c ?? 0,
      openActionItems: openActions?.c ?? 0,
      activeEscalations: activeEscalations?.c ?? 0,
      activeCrisisEvents: crisisCount?.c ?? 0,
    };
  }),
});
