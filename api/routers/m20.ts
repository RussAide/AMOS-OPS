import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { bedCensusV2, facilities } from "@db/schema";
import { eq, sql } from "drizzle-orm";

// ─── M20: Residential Operations v2 + Predictive Analytics ───

export const m20Router = createRouter({
  // ─── Census Predictive Analytics ─────────────────────────

  getAdmissionTrends: publicQuery.query(async () => {
    // Simulated weekly admission data (would be derived from youth_profiles in production)
    const weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"];
    const admissions = [2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 3, 2]; // Last 12 weeks
    const discharges = [1, 2, 1, 1, 3, 1, 2, 1, 2, 1, 1, 2];
    return { weeks, admissions, discharges };
  }),

  getDischargeForecast: publicQuery.query(async () => {
    // Get occupied beds with expected discharge dates
    const occupiedBeds = await getDb().select().from(bedCensusV2).where(eq(bedCensusV2.isOccupied, true));
    
    const now = new Date();
    const forecasts = occupiedBeds
      .filter(b => b.expectedDischargeDate)
      .map(b => ({
        youthName: b.youthName,
        mrn: b.mrn,
        bedLabel: b.bedLabel,
        expectedDischarge: b.expectedDischargeDate,
        daysRemaining: b.expectedDischargeDate 
          ? Math.ceil((new Date(b.expectedDischargeDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }))
      .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

    // Average LOS calculation (simulated from admission data)
    const avgLOS = 45; // days

    return { forecasts, averageLOS: avgLOS };
  }),

  getCapacityAlert: publicQuery.query(async () => {
    const allFacilities = await getDb().select().from(facilities);
    const allBeds = await getDb().select().from(bedCensusV2);
    
    const alerts = allFacilities.map(f => {
      const facilityBeds = allBeds.filter(b => b.facilityId === f.id);
      const occupied = facilityBeds.filter(b => b.isOccupied).length;
      const operational = f.operationalCapacity;
      const rate = operational > 0 ? (occupied / operational) * 100 : 0;
      
      let level: "normal" | "warning" | "critical" = "normal";
      let message = "";
      if (rate >= 95) { level = "critical"; message = `At ${Math.round(rate)}% — near capacity`; }
      else if (rate >= 90) { level = "critical"; message = `At ${Math.round(rate)}% — activate next phase`; }
      else if (rate >= 80) { level = "warning"; message = `At ${Math.round(rate)}% — monitor closely`; }
      
      return {
        facilityId: f.id,
        facilityName: f.name,
        occupied,
        operational,
        rate: Math.round(rate),
        level,
        message,
      };
    });

    // Campus-wide
    const campusOccupied = allBeds.filter(b => b.isOccupied).length;
    const campusOperational = allFacilities.reduce((s, f) => s + f.operationalCapacity, 0);
    const campusRate = campusOperational > 0 ? (campusOccupied / campusOperational) * 100 : 0;
    
    let campusLevel: "normal" | "warning" | "critical" = "normal";
    if (campusRate >= 90) campusLevel = "critical";
    else if (campusRate >= 80) campusLevel = "warning";

    return { 
      facilityAlerts: alerts, 
      campusRate: Math.round(campusRate),
      campusLevel,
      campusOccupied,
      campusOperational,
    };
  }),

  get30DayProjection: publicQuery.query(async () => {
    // Simulate 30-day bed availability projection
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0].slice(5); // "MM-DD"
    });
    
    // Current: 7 occupied of 12 operational
    // Projected: slight variation with planned admissions/discharges
    const currentOccupied = 7;
    const operational = 12;
    const availability = days.map((_, i) => {
      // Simulate 1 discharge in week 2, 1 admission in week 3
      let projected = currentOccupied;
      if (i >= 10 && i <= 14) projected -= 1; // discharge window
      if (i >= 18 && i <= 22) projected += 1; // admission window
      return operational - projected;
    });

    return { days, availability, operationalCapacity: operational };
  }),

  getPhaseRecommendation: publicQuery.query(async () => {
    const allFacilities = await getDb().select().from(facilities);
    const allBeds = await getDb().select().from(bedCensusV2);
    
    // Check New Facility Phase 2 (next phase)
    const nf = allFacilities.find(f => f.code === "NF");
    if (!nf) return { recommendation: "No New Facility data", weeksUntilActivation: null, confidence: null };
    
    const nfBeds = allBeds.filter(b => b.facilityId === nf.id);
    const nfOccupied = nfBeds.filter(b => b.isOccupied).length;
    const nfOperational = nf.operationalCapacity;
    const nfRate = nfOperational > 0 ? (nfOccupied / nfOperational) * 100 : 0;
    
    // Recommendation logic
    if (nfRate >= 85) {
      return {
        recommendation: "Activate Phase 2 (Downstairs) immediately",
        phaseName: "Phase 2: Downstairs",
        phaseId: "ph-002",
        bedsAdded: 8,
        weeksUntilActivation: 0,
        confidence: "high",
        reason: `New Facility at ${Math.round(nfRate)}% capacity — approaching limit`,
      };
    } else if (nfRate >= 70) {
      return {
        recommendation: "Prepare Phase 2 (Downstairs) for activation",
        phaseName: "Phase 2: Downstairs",
        phaseId: "ph-002",
        bedsAdded: 8,
        weeksUntilActivation: 2,
        confidence: "medium",
        reason: `New Facility at ${Math.round(nfRate)}% capacity — trending toward limit`,
      };
    } else {
      return {
        recommendation: "Phase 1 capacity sufficient — monitor weekly",
        phaseName: "Phase 2: Downstairs",
        phaseId: "ph-002",
        bedsAdded: 8,
        weeksUntilActivation: 4,
        confidence: "low",
        reason: `New Facility at ${Math.round(nfRate)}% capacity — adequate headroom`,
      };
    }
  }),

  // ─── MAR v2 — Facility Scoped ──────────────────────────

  getFacilityMedications: publicQuery
    .input(z.object({ facilityId: z.string() }))
    .query(async ({ input }) => {
      // Get youth assigned to this facility
      const facilityBeds = await getDb().select().from(bedCensusV2)
        .where(eq(bedCensusV2.facilityId, input.facilityId));
      
      const youthIds = facilityBeds.filter(b => b.isOccupied && b.youthId).map(b => b.youthId!);
      
      // Simulated medication data per youth
      const medications = youthIds.map((yid, idx) => ({
        youthId: yid,
        youthName: facilityBeds.find(b => b.youthId === yid)?.youthName ?? "Unknown",
        mrn: facilityBeds.find(b => b.youthId === yid)?.mrn ?? "",
        bedLabel: facilityBeds.find(b => b.youthId === yid)?.bedLabel ?? "",
        medications: [
          {
            id: `med-${idx}-1`,
            name: ["Sertraline", "Methylphenidate", "Aripiprazole", "Lisdexamfetamine", "Fluoxetine"][idx % 5],
            dosage: ["50mg", "20mg", "10mg", "30mg", "20mg"][idx % 5],
            frequency: ["Daily AM", "BID", "Daily PM", "Daily AM", "Daily AM"][idx % 5],
            route: "PO",
            status: ["scheduled", "administered", "scheduled", "refused", "scheduled"][idx % 5],
            lastAdministered: idx % 3 === 0 ? "2026-07-02T08:00:00Z" : null,
            isControlled: idx % 4 === 0,
          },
          {
            id: `med-${idx}-2`,
            name: ["Melatonin", "Clonidine", "Guafacine", "Hydroxyzine", "Propranolol"][(idx + 2) % 5],
            dosage: ["3mg", "0.1mg", "1mg", "25mg", "10mg"][(idx + 2) % 5],
            frequency: ["HS", "HS", "Daily AM", "PRN", "BID"][(idx + 2) % 5],
            route: "PO",
            status: ["scheduled", "scheduled", "administered", "scheduled", "held"][(idx + 1) % 5],
            lastAdministered: idx % 2 === 0 ? "2026-07-02T20:00:00Z" : null,
            isControlled: false,
          },
        ],
      }));

      return medications;
    }),

  administerMedication: publicQuery
    .input(z.object({
      medicationId: z.string(),
      youthId: z.string(),
      administeredBy: z.string(),
      timestamp: z.string(),
      notes: z.string().optional(),
      controlledWitness: z.string().optional(),
      countBefore: z.number().optional(),
      countAfter: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // In production: insert into medication_administrations table
      return { 
        success: true, 
        logId: `mar-log-${Date.now()}`,
        timestamp: input.timestamp,
        requiresWitness: input.controlledWitness ? false : true,
      };
    }),
});
