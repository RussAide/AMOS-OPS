import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M13: Youth Intake Pipeline Router ───────────────────────

interface IntakeStatusRow {
  youth_id: string;
  overall_status: string;
}

type ChecklistRow = Record<string, number>;

export const M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED =
  "M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED" as const;
export const M41C_M13_LEGACY_LOC_READS_WITHHELD =
  "M41C_M13_LEGACY_LOC_READS_WITHHELD" as const;

export const M41C_YOUTH_PROFILE_COLUMNS = `
  id, mrn, first_name, last_name, date_of_birth, age, gender, race, ethnicity,
  preferred_language, phone, email, address, city, state, zip,
  guardian1_name, guardian1_relationship, guardian1_phone, guardian1_email,
  guardian2_name, guardian2_relationship, guardian2_phone, guardian2_email,
  emergency_name, emergency_relationship, emergency_phone,
  referral_source_type, referral_source_name, referral_source_phone,
  referred_by, referral_date, assigned_clinician_id, assigned_clinician_name,
  assigned_case_manager_id, assigned_case_manager_name, status, bed_assignment,
  primary_payer_id, primary_payer_name, policy_number, group_number,
  subscriber_name, subscriber_relationship, admission_date,
  projected_discharge_date, actual_discharge_date, discharge_reason,
  discharge_disposition, created_at, updated_at, created_by, updated_by, notes
`;

export function buildM13GovernedLocReference(subjectId: string) {
  return Object.freeze({
    milestone: "M4.1C" as const,
    subjectId,
    disposition: M41C_M13_LEGACY_LOC_READS_WITHHELD,
    rawLegacyLevelOfCareReturned: false as const,
    sourceOfTruth:
      "M4.1C program-specific pathway with named qualified human review",
    humanReviewRequired: true as const,
    liveWrites: 0 as const,
  });
}

export interface M13YouthProfileReadRow extends Record<string, unknown> {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age: number;
  gender: string | null;
  preferred_language: string | null;
  guardian1_name: string;
  guardian1_relationship: string;
  guardian1_phone: string;
  guardian2_name: string | null;
  guardian2_relationship: string | null;
  guardian2_phone: string | null;
  assigned_clinician_name: string | null;
  assigned_case_manager_name: string | null;
  status: string;
  bed_assignment: string | null;
  notes: string | null;
}

function withM13GovernedLocReference<T extends M13YouthProfileReadRow>(row: T) {
  return {
    ...row,
    governed_level_of_care_reference: buildM13GovernedLocReference(row.id),
  };
}

export function quarantineM13UngovernedLevelOfCare(): never {
  throw new Error(M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED);
}

export function assertM13LevelOfCareInputAbsent(input: {
  levelOfCare?: unknown;
}): void {
  if (input.levelOfCare !== undefined) {
    quarantineM13UngovernedLevelOfCare();
  }
}

export const m13Router = createRouter({
  // ─── Youth Profiles ────────────────────────────────────────
  listYouth: authedQuery.query(async () => {
    const rows = (sqlite
      .prepare(
        `SELECT ${M41C_YOUTH_PROFILE_COLUMNS} FROM youth_profiles ORDER BY created_at DESC`,
      )
      .all() ?? []) as M13YouthProfileReadRow[];
    return rows.map(withM13GovernedLocReference);
  }),

  getYouth: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare(
          `SELECT ${M41C_YOUTH_PROFILE_COLUMNS} FROM youth_profiles WHERE id = ?`,
        )
        .get(input.id) as M13YouthProfileReadRow | undefined;
      return row ? withM13GovernedLocReference(row) : null;
    }),

  getYouthByMRN: authedQuery
    .input(z.object({ mrn: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare(
          `SELECT ${M41C_YOUTH_PROFILE_COLUMNS} FROM youth_profiles WHERE mrn = ?`,
        )
        .get(input.mrn) as M13YouthProfileReadRow | undefined;
      return row ? withM13GovernedLocReference(row) : null;
    }),

  createYouth: authedQuery
    .input(
      z.object({
        mrn: z.string(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        dateOfBirth: z.string(),
        age: z.number().min(0).max(21),
        gender: z
          .enum(["male", "female", "non_binary", "prefer_not_say"])
          .optional(),
        race: z.string().optional(),
        ethnicity: z.string().optional(),
        preferredLanguage: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        guardian1Name: z.string().min(1),
        guardian1Relationship: z.string().min(1),
        guardian1Phone: z.string().min(1),
        guardian1Email: z.string().optional(),
        guardian2Name: z.string().optional(),
        guardian2Relationship: z.string().optional(),
        guardian2Phone: z.string().optional(),
        guardian2Email: z.string().optional(),
        emergencyName: z.string().optional(),
        emergencyRelationship: z.string().optional(),
        emergencyPhone: z.string().optional(),
        referralSourceType: z
          .enum([
            "self",
            "family",
            "school",
            "dcf",
            "hospital",
            "court",
            "other_provider",
            "other",
          ])
          .optional(),
        referralSourceName: z.string().optional(),
        referralSourcePhone: z.string().optional(),
        referredBy: z.string().optional(),
        referralDate: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite
        .prepare(
          `INSERT INTO youth_profiles (
        id, mrn, first_name, last_name, date_of_birth, age, gender, race, ethnicity,
        preferred_language, phone, email, address, city, state, zip,
        guardian1_name, guardian1_relationship, guardian1_phone, guardian1_email,
        guardian2_name, guardian2_relationship, guardian2_phone, guardian2_email,
        emergency_name, emergency_relationship, emergency_phone,
        referral_source_type, referral_source_name, referral_source_phone, referred_by, referral_date,
        status, level_of_care, created_at, updated_at, created_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.mrn,
          input.firstName,
          input.lastName,
          input.dateOfBirth,
          input.age,
          input.gender ?? null,
          input.race ?? null,
          input.ethnicity ?? null,
          input.preferredLanguage ?? "English",
          input.phone ?? null,
          input.email ?? null,
          input.address ?? null,
          input.city ?? null,
          input.state ?? null,
          input.zip ?? null,
          input.guardian1Name,
          input.guardian1Relationship,
          input.guardian1Phone,
          input.guardian1Email ?? null,
          input.guardian2Name ?? null,
          input.guardian2Relationship ?? null,
          input.guardian2Phone ?? null,
          input.guardian2Email ?? null,
          input.emergencyName ?? null,
          input.emergencyRelationship ?? null,
          input.emergencyPhone ?? null,
          input.referralSourceType ?? null,
          input.referralSourceName ?? null,
          input.referralSourcePhone ?? null,
          input.referredBy ?? null,
          input.referralDate ?? null,
          "referral_pending",
          "not_yet_determined",
          now,
          now,
          actor,
          input.notes ?? null,
        );

      auditLog({
        action: "m13:createYouth",
        actor,
        resource: `youth:${id}`,
        details: `Created youth profile ${input.firstName} ${input.lastName} (MRN: ${input.mrn})`,
      });

      return {
        id,
        ...input,
        status: "referral_pending",
        levelOfCare: "not_yet_determined",
        createdAt: now,
      };
    }),

  updateYouth: authedQuery
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        dateOfBirth: z.string().optional(),
        age: z.number().min(0).max(21).optional(),
        gender: z
          .enum(["male", "female", "non_binary", "prefer_not_say"])
          .optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        guardian1Name: z.string().optional(),
        guardian1Relationship: z.string().optional(),
        guardian1Phone: z.string().optional(),
        guardian1Email: z.string().optional(),
        status: z
          .enum([
            "referral_pending",
            "screening",
            "intake",
            "assessment",
            "admitted",
            "active",
            "hold",
            "discharge_planning",
            "discharged",
            "transferred",
          ])
          .optional(),
        levelOfCare: z
          .enum([
            "residential",
            "day_treatment",
            "outpatient",
            "crisis_stabilization",
            "not_yet_determined",
          ])
          .optional(),
        assignedClinicianId: z.string().optional(),
        assignedClinicianName: z.string().optional(),
        assignedCaseManagerId: z.string().optional(),
        assignedCaseManagerName: z.string().optional(),
        bedAssignment: z.string().optional(),
        primaryPayerId: z.string().optional(),
        primaryPayerName: z.string().optional(),
        policyNumber: z.string().optional(),
        groupNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertM13LevelOfCareInputAbsent(input);
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const updates: string[] = [];
      const values: unknown[] = [];

      const fieldMap: Record<string, string> = {
        firstName: "first_name",
        lastName: "last_name",
        dateOfBirth: "date_of_birth",
        age: "age",
        gender: "gender",
        phone: "phone",
        email: "email",
        address: "address",
        guardian1Name: "guardian1_name",
        guardian1Relationship: "guardian1_relationship",
        guardian1Phone: "guardian1_phone",
        guardian1Email: "guardian1_email",
        status: "status",
        assignedClinicianId: "assigned_clinician_id",
        assignedClinicianName: "assigned_clinician_name",
        assignedCaseManagerId: "assigned_case_manager_id",
        assignedCaseManagerName: "assigned_case_manager_name",
        bedAssignment: "bed_assignment",
        primaryPayerId: "primary_payer_id",
        primaryPayerName: "primary_payer_name",
        policyNumber: "policy_number",
        groupNumber: "group_number",
        notes: "notes",
      };

      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          updates.push(`${fieldMap[key] ?? key} = ?`);
          values.push(val);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = ?");
        updates.push("updated_by = ?");
        values.push(new Date().toISOString(), actor);
        sqlite
          .prepare(
            `UPDATE youth_profiles SET ${updates.join(", ")} WHERE id = ?`,
          )
          .run(...values, id);
      }

      auditLog({ action: "m13:updateYouth", actor, resource: `youth:${id}` });
      return { success: true };
    }),

  // ─── Intake Pipeline ───────────────────────────────────────
  listIntakes: authedQuery.query(async () => {
    const rows =
      sqlite
        .prepare("SELECT * FROM intake_pipeline ORDER BY created_at DESC")
        .all() ?? [];
    return rows;
  }),

  getIntake: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare("SELECT * FROM intake_pipeline WHERE id = ?")
        .get(input.id);
      return row ?? null;
    }),

  getIntakeByYouth: authedQuery
    .input(z.object({ youthId: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare(
          "SELECT * FROM intake_pipeline WHERE youth_id = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(input.youthId);
      return row ?? null;
    }),

  createIntake: authedQuery
    .input(
      z.object({
        youthId: z.string(),
        mrn: z.string(),
        youthName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite
        .prepare(
          `INSERT INTO intake_pipeline (
        id, youth_id, mrn, youth_name, current_step, overall_status,
        referral_received_by, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.youthId,
          input.mrn,
          input.youthName,
          "referral",
          "in_progress",
          actor,
          now,
          now,
          actor,
        );

      auditLog({
        action: "m13:createIntake",
        actor,
        resource: `intake:${id}`,
        details: `Created intake pipeline for ${input.youthName}`,
      });

      return {
        id,
        ...input,
        currentStep: "referral",
        overallStatus: "in_progress",
        createdAt: now,
      };
    }),

  updateStep: authedQuery
    .input(
      z.object({
        id: z.string(),
        step: z.enum([
          "referral",
          "screening",
          "consent",
          "payer",
          "disposition",
        ]),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, step, data } = input;
      const now = new Date().toISOString();

      const stepFields: Record<string, string[]> = {
        referral: [
          "referral_received_date",
          "referral_received_by",
          "referral_received_notes",
          "referral_received_completed",
        ],
        screening: [
          "screening_date",
          "screening_completed_by",
          "screening_result",
          "screening_notes",
          "screening_completed",
        ],
        consent: [
          "consent_date",
          "consent_completed_by",
          "guardian_consent_obtained",
          "youth_assent_obtained",
          "hipaa_acknowledgment",
          "rights_acknowledgment",
          "consent_notes",
          "consent_completed",
        ],
        payer: [
          "payer_verification_date",
          "payer_verification_completed_by",
          "benefits_verified",
          "authorization_required",
          "authorization_submitted",
          "authorization_approved",
          "payer_notes",
          "payer_completed",
        ],
        disposition: [
          "disposition_date",
          "disposition_completed_by",
          "disposition",
          "disposition_reason",
          "bed_assigned",
          "admission_scheduled_date",
          "disposition_completed",
        ],
      };

      const fields = stepFields[step];
      if (!fields) throw new Error(`Unknown step: ${step}`);

      const updates: string[] = [];
      const values: unknown[] = [];

      for (const field of fields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      // Determine next step
      const stepOrder = [
        "referral",
        "screening",
        "consent",
        "payer",
        "disposition",
      ];
      const currentIdx = stepOrder.indexOf(step);
      const allCompleted = fields
        .filter((f) => f.endsWith("_completed"))
        .every((f) => data[f] === true || data[f] === 1);

      if (allCompleted && currentIdx < stepOrder.length - 1) {
        updates.push("current_step = ?");
        values.push(stepOrder[currentIdx + 1]);
      } else if (allCompleted && currentIdx === stepOrder.length - 1) {
        updates.push("current_step = ?");
        updates.push("overall_status = ?");
        values.push("completed", "completed");
      }

      updates.push("updated_at = ?");
      updates.push("updated_by = ?");
      values.push(now, actor);

      sqlite
        .prepare(
          `UPDATE intake_pipeline SET ${updates.join(", ")} WHERE id = ?`,
        )
        .run(...values, id);

      // Update youth profile status to match
      const intake = sqlite
        .prepare(
          "SELECT youth_id, overall_status FROM intake_pipeline WHERE id = ?",
        )
        .get(id) as IntakeStatusRow | undefined;
      if (intake) {
        const statusMap: Record<string, string> = {
          referral: "referral_pending",
          screening: "screening",
          consent: "intake",
          payer: "intake",
          disposition: "assessment",
        };
        const youthStatus = statusMap[step] ?? "intake";
        sqlite
          .prepare(
            "UPDATE youth_profiles SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?",
          )
          .run(youthStatus, now, actor, intake.youth_id);
      }

      auditLog({
        action: "m13:updateStep",
        actor,
        resource: `intake:${id}`,
        details: `Updated ${step} step`,
      });
      return {
        success: true,
        nextStep: stepOrder[currentIdx + 1] ?? "completed",
      };
    }),

  // ─── Referral Checklist (SOP Toolkit 1) ────────────────────
  getChecklist: authedQuery
    .input(z.object({ youthId: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite
        .prepare(
          "SELECT * FROM referral_checklists WHERE youth_id = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(input.youthId);
      return row ?? null;
    }),

  createChecklist: authedQuery
    .input(z.object({ youthId: z.string(), intakeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite
        .prepare(
          `INSERT INTO referral_checklists (
        id, youth_id, intake_id, items_total, created_at, updated_at
      ) VALUES (?, ?, ?, 10, ?, ?)`,
        )
        .run(id, input.youthId, input.intakeId, now, now);

      auditLog({
        action: "m13:createChecklist",
        actor,
        resource: `checklist:${id}`,
      });
      return {
        id,
        ...input,
        itemsCompleted: 0,
        itemsTotal: 10,
        allItemsComplete: false,
      };
    }),

  updateChecklist: authedQuery
    .input(
      z.object({
        id: z.string(),
        item1: z.boolean().optional(),
        item2: z.boolean().optional(),
        item3: z.boolean().optional(),
        item4: z.boolean().optional(),
        item5: z.boolean().optional(),
        item6: z.boolean().optional(),
        item7: z.boolean().optional(),
        item8: z.boolean().optional(),
        item9: z.boolean().optional(),
        item10: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...items } = input;

      // Get current state
      const current = sqlite
        .prepare("SELECT * FROM referral_checklists WHERE id = ?")
        .get(id) as ChecklistRow | undefined;
      if (!current) throw new Error("Checklist not found");

      const updates: string[] = [];
      const values: unknown[] = [];

      const itemMap: Record<string, string> = {
        item1: "item1_referral_form_received",
        item2: "item2_demographics_complete",
        item3: "item3_insurance_verified",
        item4: "item4_consent_for_release",
        item5: "item5_psychiatric_history",
        item6: "item6_medical_records_requested",
        item7: "item7_educational_records_requested",
        item8: "item8_legal_status_confirmed",
        item9: "item9_guardian_contact_verified",
        item10: "item10_service_activation_date_set",
      };

      for (const [key, val] of Object.entries(items)) {
        if (val !== undefined) {
          updates.push(`${itemMap[key]} = ?`);
          values.push(val ? 1 : 0);
        }
      }

      // Recalculate completed count
      const allItems = [
        items.item1 ?? current.item1_referral_form_received,
        items.item2 ?? current.item2_demographics_complete,
        items.item3 ?? current.item3_insurance_verified,
        items.item4 ?? current.item4_consent_for_release,
        items.item5 ?? current.item5_psychiatric_history,
        items.item6 ?? current.item6_medical_records_requested,
        items.item7 ?? current.item7_educational_records_requested,
        items.item8 ?? current.item8_legal_status_confirmed,
        items.item9 ?? current.item9_guardian_contact_verified,
        items.item10 ?? current.item10_service_activation_date_set,
      ];
      const completed = allItems.filter(Boolean).length;
      const allComplete = completed === 10;

      updates.push("items_completed = ?");
      updates.push("all_items_complete = ?");
      updates.push("completed_by = ?");
      updates.push("completed_at = ?");
      updates.push("updated_at = ?");
      values.push(
        completed,
        allComplete ? 1 : 0,
        allComplete ? actor : null,
        allComplete ? new Date().toISOString() : null,
        new Date().toISOString(),
      );

      sqlite
        .prepare(
          `UPDATE referral_checklists SET ${updates.join(", ")} WHERE id = ?`,
        )
        .run(...values, id);

      return {
        success: true,
        itemsCompleted: completed,
        allItemsComplete: allComplete,
      };
    }),
});
