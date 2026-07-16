import { z } from "zod";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { randomUUID } from "crypto";

// ─── M6: GRO — Growth & Outreach ───────────────────────────

// In-memory storage for GRO (no dedicated schema tables yet)
interface ReferralRecord {
  id: string;
  referral_number: string;
  patient_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  referral_source: string;
  source_detail: string | null;
  referral_type: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  outcome: string | null;
  converted_patient_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PartnershipRecord {
  id: string;
  organization_name: string;
  partnership_type: string;
  status: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  notes: string | null;
  start_date: string | null;
  renewal_date: string | null;
  referral_count: number;
  created_at: string;
}

interface CampaignRecord {
  id: string;
  campaign_name: string;
  campaign_type: string;
  start_date: string;
  end_date: string;
  status: string;
  budget: number;
  leads_generated: number;
  conversions: number;
  notes: string;
  created_at: string;
}

const referralsStore: ReferralRecord[] = [];
const partnershipsStore: PartnershipRecord[] = [];
const campaignsStore: CampaignRecord[] = [];

// Seed initial data
function seedGRO() {
  if (referralsStore.length === 0) {
    referralsStore.push(
      { id: "r1", referral_number: "REF-2026-001", patient_name: "Synthetic Youth 029", contact_phone: "(713) 555-1001", contact_email: "parent1@example.invalid", referral_source: "HISD School Counselor", source_detail: "Kashmere High School", referral_type: "adolescent", status: "active", assigned_to: "rcs-lead@amos-ops.invalid", notes: "15-year-old male, depression and anxiety, parents seeking residential care", outcome: null, converted_patient_id: null, created_at: "2026-06-15T10:00:00Z", updated_at: "2026-06-15T10:00:00Z" },
      { id: "r2", referral_number: "REF-2026-002", patient_name: "Synthetic Youth 028", contact_phone: "(281) 555-2002", contact_email: "parent2@example.invalid", referral_source: "Pediatrician", source_detail: "Dr. Elena Vasquez", referral_type: "intake", status: "in_review", assigned_to: "clinical-director@amos-ops.invalid", notes: "14-year-old female, trauma history, self-harm behaviors. Awaiting clinical assessment.", outcome: null, converted_patient_id: null, created_at: "2026-06-18T09:30:00Z", updated_at: "2026-06-20T14:00:00Z" },
      { id: "r3", referral_number: "REF-2026-003", patient_name: "Synthetic Youth 031", contact_phone: "(832) 555-3003", contact_email: "parent3@example.invalid", referral_source: "Juvenile Court Probation", source_detail: "Harris County JJP", referral_type: "mandatory", status: "active", assigned_to: "gro.admin@amos-ops.invalid", notes: "Court-ordered residential placement. Aggressive behavior, prior group home disruption.", outcome: null, converted_patient_id: null, created_at: "2026-06-22T11:00:00Z", updated_at: "2026-06-22T11:00:00Z" },
      { id: "r4", referral_number: "REF-2026-004", patient_name: "Synthetic Youth 017", contact_phone: "(713) 555-4004", contact_email: "parent4@example.invalid", referral_source: "Family Self-Referral", source_detail: "Website inquiry", referral_type: "crisis", status: "new", assigned_to: null, notes: "16-year-old female, suicidal ideation with plan. Parent called crisis line. Needs immediate assessment.", outcome: null, converted_patient_id: null, created_at: "2026-06-27T08:15:00Z", updated_at: "2026-06-27T08:15:00Z" },
      { id: "r5", referral_number: "REF-2026-005", patient_name: "Synthetic Youth 033", contact_phone: "(281) 555-5005", contact_email: "parent5@example.invalid", referral_source: "DCF Caseworker", source_detail: "Texas CPS Region 6", referral_type: "adolescent", status: "converted", assigned_to: "rcs-lead@amos-ops.invalid", notes: "Foster care placement disrupted. Maltreatment history. Successfully converted to patient SYNTH-REC-4521.", outcome: "converted", converted_patient_id: "p1", created_at: "2026-05-20T13:00:00Z", updated_at: "2026-06-01T10:00:00Z" },
      { id: "r6", referral_number: "REF-2026-006", patient_name: "Synthetic Youth 026", contact_phone: "(832) 555-6006", contact_email: "parent6@example.invalid", referral_source: "Community Mental Health Center", source_detail: "Legacy Community Health", referral_type: "educational", status: "deferred", assigned_to: "rcs-day@amos-ops.invalid", notes: "Not currently appropriate for residential. Referred to outpatient IOP. Follow up in 90 days.", outcome: "deferred", converted_patient_id: null, created_at: "2026-05-10T15:00:00Z", updated_at: "2026-05-25T09:00:00Z" },
      { id: "r7", referral_number: "REF-2026-007", patient_name: "Synthetic Youth 012", contact_phone: "(713) 555-7007", contact_email: "parent7@example.invalid", referral_source: "Hospital Discharge Planner", source_detail: "Texas Childrens Hospital", referral_type: "crisis", status: "closed", assigned_to: "clinical-director@amos-ops.invalid", notes: "Crisis stabilization completed. Family opted for outpatient care closer to home.", outcome: "closed", converted_patient_id: null, created_at: "2026-04-05T10:00:00Z", updated_at: "2026-04-12T16:00:00Z" },
      { id: "r8", referral_number: "REF-2026-008", patient_name: "Synthetic Youth 032", contact_phone: "(281) 555-8008", contact_email: "parent8@example.invalid", referral_source: "Community Event", source_detail: "Mental Health Awareness Fair", referral_type: "community", status: "active", assigned_to: "gro.admin@amos-ops.invalid", notes: "Parents attended community fair. 13-year-old female, social anxiety, school refusal.", outcome: null, converted_patient_id: null, created_at: "2026-06-25T14:00:00Z", updated_at: "2026-06-25T14:00:00Z" },
    );
  }
  if (partnershipsStore.length === 0) {
    partnershipsStore.push(
      { id: "part1", organization_name: "Houston ISD", partnership_type: "school_district", status: "active", contact_name: "Maria Gonzalez", contact_phone: "(713) 555-0100", contact_email: "m.gonzalez@example.invalid", address: "4400 West 18th St, Houston, TX", notes: "Primary referral source. Quarterly check-ins with counseling department.", start_date: "2025-09-01", renewal_date: "2026-09-01", referral_count: 12, created_at: "2025-09-01" },
      { id: "part2", organization_name: "Harris County Juvenile Probation", partnership_type: "government", status: "active", contact_name: "Deputy Chief Williams", contact_phone: "(713) 555-0200", contact_email: "d.williams@example.invalid", address: "1200 Congress St, Houston, TX", notes: "Court-ordered placements. Monthly reporting required.", start_date: "2026-01-15", renewal_date: "2027-01-15", referral_count: 4, created_at: "2026-01-15" },
      { id: "part3", organization_name: "Legacy Community Health", partnership_type: "healthcare", status: "active", contact_name: "Dr. Sarah Kim", contact_phone: "(832) 555-0300", contact_email: "s.kim@example.invalid", address: " various clinic locations", notes: "Coordinated care referrals. Shared care plans for dual-enrolled patients.", start_date: "2026-03-01", renewal_date: "2027-03-01", referral_count: 6, created_at: "2026-03-01" },
      { id: "part4", organization_name: "Texas Childrens Hospital", partnership_type: "healthcare", status: "pending", contact_name: "James Okafor", contact_phone: "(832) 555-0400", contact_email: "j.okafor@example.invalid", address: "6621 Fannin St, Houston, TX", notes: "Crisis discharge planning partnership. MOU under legal review.", start_date: null, renewal_date: null, referral_count: 2, created_at: "2026-06-10" },
      { id: "part5", organization_name: "Texas CPS Region 6", partnership_type: "government", status: "active", contact_name: "Case Supervisor Torres", contact_phone: "(713) 555-0500", contact_email: "r.torres@example.invalid", address: "2525 Murworth Dr, Houston, TX", notes: "Foster care placement referrals. 24-hour response requirement.", start_date: "2026-02-01", renewal_date: "2027-02-01", referral_count: 3, created_at: "2026-02-01" },
    );
  }
  if (campaignsStore.length === 0) {
    campaignsStore.push(
      { id: "camp1", campaign_name: "Spring 2026 School Outreach", campaign_type: "school", start_date: "2026-03-01", end_date: "2026-05-31", status: "completed", budget: 5000, leads_generated: 24, conversions: 8, notes: "Visited 12 schools, presented at 8 PTA meetings", created_at: "2026-03-01" },
      { id: "camp2", campaign_name: "Summer Community Health Fairs", campaign_type: "community", start_date: "2026-06-01", end_date: "2026-08-31", status: "active", budget: 3000, leads_generated: 15, conversions: 3, notes: "Booth at 5 community events, distributed materials at 10 locations", created_at: "2026-06-01" },
      { id: "camp3", campaign_name: "Digital Ad Campaign — Houston", campaign_type: "digital", start_date: "2026-04-01", end_date: "2026-06-30", status: "completed", budget: 8000, leads_generated: 42, conversions: 6, notes: "Google Ads + Facebook targeting Harris County parents of teens 12-17", created_at: "2026-04-01" },
      { id: "camp4", campaign_name: "Pediatrician Referral Program", campaign_type: "professional", start_date: "2026-05-01", end_date: "2026-12-31", status: "active", budget: 2000, leads_generated: 8, conversions: 2, notes: "Direct outreach to 50 pediatricians, referral pad distribution, CME event planned", created_at: "2026-05-01" },
    );
  }
}
seedGRO();

export const m6Router = createRouter({
  // ─── Referrals ─────────────────────────────────────────────
  listReferrals: authedQuery
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...referralsStore];
      if (input?.status) results = results.filter((r) => r.status === input.status);
      if (input?.search) {
        const q = input.search.toLowerCase();
        results = results.filter((r) =>
          r.patient_name?.toLowerCase().includes(q) ||
          r.referral_number?.toLowerCase().includes(q) ||
          r.referral_source?.toLowerCase().includes(q)
        );
      }
      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }),

  getReferral: authedQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const ref = referralsStore.find((r) => r.id === input.id);
      if (!ref) throw new Error("Referral not found");
      return ref;
    }),

  createReferral: authedQuery
    .input(z.object({
      patientName: z.string().min(1), contactPhone: z.string().optional(),
      contactEmail: z.string().optional(), referralSource: z.string().min(1),
      sourceDetail: z.string().optional(), referralType: z.string().optional(),
      assignedTo: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const referralNumber = `REF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const now = new Date().toISOString();

      referralsStore.push({
        id, referral_number: referralNumber,
        patient_name: input.patientName, contact_phone: input.contactPhone ?? null,
        contact_email: input.contactEmail ?? null,
        referral_source: input.referralSource, source_detail: input.sourceDetail ?? null,
        referral_type: input.referralType ?? "intake", status: "new",
        assigned_to: input.assignedTo ?? null, notes: input.notes ?? null,
        outcome: null, converted_patient_id: null,
        created_at: now, updated_at: now,
      });

      auditLog({ action: "m6:createReferral", actor, resource: `referral:${referralNumber}`, details: `Created referral for ${input.patientName}` });
      return { success: true, id, referralNumber };
    }),

  updateReferral: authedQuery
    .input(z.object({
      id: z.string(), status: z.enum(["new", "in_review", "active", "converted", "deferred", "closed"]).optional(),
      assignedTo: z.string().optional(), notes: z.string().optional(),
      outcome: z.string().optional(), convertedPatientId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const ref = referralsStore.find((r) => r.id === input.id);
      if (!ref) throw new Error("Referral not found");

      if (input.status !== undefined) ref.status = input.status;
      if (input.assignedTo !== undefined) ref.assigned_to = input.assignedTo;
      if (input.notes !== undefined) ref.notes = input.notes;
      if (input.outcome !== undefined) ref.outcome = input.outcome;
      if (input.convertedPatientId !== undefined) ref.converted_patient_id = input.convertedPatientId;
      ref.updated_at = new Date().toISOString();

      auditLog({ action: "m6:updateReferral", actor, resource: `referral:${ref.referral_number}`, details: `Updated referral status` });
      return { success: true };
    }),

  // ─── Partnerships ──────────────────────────────────────────
  listPartnerships: authedQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...partnershipsStore];
      if (input?.status) results = results.filter((p) => p.status === input.status);
      return results;
    }),

  createPartnership: authedQuery
    .input(z.object({
      organizationName: z.string().min(1), partnershipType: z.string(),
      contactName: z.string().optional(), contactPhone: z.string().optional(),
      contactEmail: z.string().optional(), address: z.string().optional(),
      notes: z.string().optional(), startDate: z.string().optional(),
      renewalDate: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();

      partnershipsStore.push({
        id, organization_name: input.organizationName,
        partnership_type: input.partnershipType, status: "pending",
        contact_name: input.contactName ?? null, contact_phone: input.contactPhone ?? null,
        contact_email: input.contactEmail ?? null, address: input.address ?? null,
        notes: input.notes ?? null, start_date: input.startDate ?? null,
        renewal_date: input.renewalDate ?? null, referral_count: 0,
        created_at: new Date().toISOString(),
      });

      auditLog({ action: "m6:createPartnership", actor, resource: `partnership:${input.organizationName}`, details: `Created partnership` });
      return { success: true, id };
    }),

  // ─── Campaigns ─────────────────────────────────────────────
  listCampaigns: authedQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...campaignsStore];
      if (input?.status) results = results.filter((c) => c.status === input.status);
      return results;
    }),

  // ─── Dashboard KPIs ────────────────────────────────────────
  dashboardKPIs: publicQuery.query(() => {
    const activeReferrals = referralsStore.filter((r) => r.status === "new" || r.status === "in_review" || r.status === "active").length;
    const activePartnerships = partnershipsStore.filter((p) => p.status === "active").length;
    const converted = referralsStore.filter((r) => r.status === "converted").length;
    const totalClosed = referralsStore.filter((r) => r.status === "converted" || r.status === "closed" || r.status === "deferred").length;
    const conversionRate = totalClosed > 0 ? Math.round((converted / totalClosed) * 100) : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const newThisMonth = referralsStore.filter((r) => r.created_at >= monthStart).length;

    // Top referral sources
    const sourceCounts: Record<string, number> = {};
    for (const r of referralsStore) {
      sourceCounts[r.referral_source] = (sourceCounts[r.referral_source] ?? 0) + 1;
    }
    const topSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));

    return { activeReferrals, activePartnerships, conversionRate, newThisMonth, totalReferrals: referralsStore.length, topSources };
  }),
});
