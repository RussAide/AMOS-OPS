import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { mgmaDomains, mgmaKpiTargets, mgmaScorecards } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// ══════════════════════════════════════════════════════════════
// MGMA: 7-Domain Practice Management Baseline Router (T-008)
// Medical Group Management Association Body of Knowledge
// ══════════════════════════════════════════════════════════════

export const mgmaRouter = createRouter({

  // ════════════════════════════════════════════════════════════
  // DOMAINS
  // ════════════════════════════════════════════════════════════

  listDomains: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(mgmaDomains).orderBy(mgmaDomains.domainNumber);
  }),

  getDomain: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const domain = await db.select().from(mgmaDomains).where(eq(mgmaDomains.id, input.id)).get();
      if (!domain) return null;
      const kpis = await db.select().from(mgmaKpiTargets).where(eq(mgmaKpiTargets.domainId, input.id)).orderBy(mgmaKpiTargets.kpiName);
      return { ...domain, kpis };
    }),

  configureDomain: adminQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["planned", "configured", "active", "under_review"]),
      configuredBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(mgmaDomains).set({
        status: input.status,
        configuredAt: new Date().toISOString(),
        configuredBy: input.configuredBy,
        updatedAt: new Date().toISOString(),
      }).where(eq(mgmaDomains.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // KPI TARGETS
  // ════════════════════════════════════════════════════════════

  listKpiTargets: authedQuery
    .input(z.object({
      domainId: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let conditions = [];
      if (input?.domainId) conditions.push(eq(mgmaKpiTargets.domainId, input.domainId));
      if (input?.status) conditions.push(eq(mgmaKpiTargets.status, input.status));

      const results = conditions.length > 0
        ? await db.select().from(mgmaKpiTargets).where(and(...conditions)).orderBy(mgmaKpiTargets.kpiName)
        : await db.select().from(mgmaKpiTargets).orderBy(mgmaKpiTargets.kpiName);
      return results;
    }),

  updateKpiCurrentValue: adminQuery
    .input(z.object({
      id: z.string(),
      currentValue: z.string(),
      status: z.enum(["on_target", "at_risk", "off_target", "not_measured"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(mgmaKpiTargets).set({
        currentValue: input.currentValue,
        status: input.status,
        lastMeasuredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(mgmaKpiTargets.id, input.id));
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // SCORECARDS
  // ════════════════════════════════════════════════════════════

  listScorecards: authedQuery
    .input(z.object({
      division: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.division) {
        return db.select().from(mgmaScorecards).where(eq(mgmaScorecards.division, input.division)).orderBy(desc(mgmaScorecards.scorecardDate));
      }
      return db.select().from(mgmaScorecards).orderBy(desc(mgmaScorecards.scorecardDate));
    }),

  createScorecard: adminQuery
    .input(z.object({
      division: z.enum(["EO", "GAD", "GRO", "BHC"]),
      scorecardDate: z.string(),
      overallScore: z.number().optional(),
      executiveSummary: z.string().optional(),
      actionItems: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Count current KPI statuses for this division
      const domains = await db.select().from(mgmaDomains).where(eq(mgmaDomains.responsibleDivision, input.division));
      const domainIds = domains.map((d) => d.id);

      let onTarget = 0, atRisk = 0, offTarget = 0, notMeasured = 0;
      const domainScores: Record<string, { name: string; score: number; kpis: number }> = {};

      for (const domain of domains) {
        const kpis = await db.select().from(mgmaKpiTargets).where(eq(mgmaKpiTargets.domainId, domain.id));
        let dOn = 0, dTotal = 0;
        for (const kpi of kpis) {
          if (kpi.status === "on_target") { onTarget++; dOn++; dTotal++; }
          else if (kpi.status === "at_risk") { atRisk++; dTotal++; }
          else if (kpi.status === "off_target") { offTarget++; dTotal++; }
          else { notMeasured++; }
        }
        domainScores[domain.id] = {
          name: domain.domainName,
          score: dTotal > 0 ? Math.round((dOn / dTotal) * 100) : 0,
          kpis: dTotal,
        };
      }

      const totalMeasured = onTarget + atRisk + offTarget;
      const overallScore = totalMeasured > 0 ? Math.round((onTarget / totalMeasured) * 100) : 0;

      const id = randomUUID();
      await db.insert(mgmaScorecards).values({
        id,
        division: input.division,
        scorecardDate: input.scorecardDate,
        overallScore,
        kpisOnTarget: onTarget,
        kpisAtRisk: atRisk,
        kpisOffTarget: offTarget,
        kpisNotMeasured: notMeasured,
        domainScoresJson: JSON.stringify(domainScores),
        executiveSummary: input.executiveSummary ?? null,
        actionItems: input.actionItems ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { success: true, id, overallScore, kpisOnTarget: onTarget, kpisAtRisk: atRisk, kpisOffTarget: offTarget };
    }),

  // ════════════════════════════════════════════════════════════
  // EXECUTIVE DASHBOARD
  // ════════════════════════════════════════════════════════════

  executiveDashboard: authedQuery.query(async () => {
    const db = getDb();

    // All domains with their KPIs
    const domains = await db.select().from(mgmaDomains).orderBy(mgmaDomains.domainNumber);
    const domainCards = [];

    for (const domain of domains) {
      const kpis = await db.select().from(mgmaKpiTargets).where(eq(mgmaKpiTargets.domainId, domain.id));
      const onTarget = kpis.filter((k) => k.status === "on_target").length;
      const atRisk = kpis.filter((k) => k.status === "at_risk").length;
      const offTarget = kpis.filter((k) => k.status === "off_target").length;
      const notMeasured = kpis.filter((k) => k.status === "not_measured").length;
      const measured = onTarget + atRisk + offTarget;
      const score = measured > 0 ? Math.round((onTarget / measured) * 100) : 0;

      domainCards.push({
        ...domain,
        kpiCount: kpis.length,
        onTarget,
        atRisk,
        offTarget,
        notMeasured,
        score,
        kpis: kpis.map((k) => ({
          name: k.kpiName,
          target: k.targetValue,
          unit: k.targetUnit,
          current: k.currentValue,
          status: k.status,
        })),
      });
    }

    // Division summaries
    const divisions = ["EO", "GAD", "GRO", "BHC"] as const;
    const divisionSummaries = [];
    for (const div of divisions) {
      const divDomains = domainCards.filter((d) => d.responsibleDivision === div);
      const totalKpis = divDomains.reduce((sum, d) => sum + d.kpiCount, 0);
      const totalOnTarget = divDomains.reduce((sum, d) => sum + d.onTarget, 0);
      const totalMeasured = totalKpis - divDomains.reduce((sum, d) => sum + d.notMeasured, 0);
      divisionSummaries.push({
        division: div,
        domainCount: divDomains.length,
        totalKpis,
        onTarget: totalOnTarget,
        score: totalMeasured > 0 ? Math.round((totalOnTarget / totalMeasured) * 100) : 0,
      });
    }

    return {
      domains: domainCards,
      divisionSummaries,
      overallKpis: {
        total: domainCards.reduce((sum, d) => sum + d.kpiCount, 0),
        onTarget: domainCards.reduce((sum, d) => sum + d.onTarget, 0),
        atRisk: domainCards.reduce((sum, d) => sum + d.atRisk, 0),
        offTarget: domainCards.reduce((sum, d) => sum + d.offTarget, 0),
        notMeasured: domainCards.reduce((sum, d) => sum + d.notMeasured, 0),
      },
    };
  }),

  // ════════════════════════════════════════════════════════════
  // SEED DATA
  // ════════════════════════════════════════════════════════════

  seedMgmaData: adminQuery.mutation(async () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed 7 MGMA domains
    await db.insert(mgmaDomains).values([
      { id: "mgma-d1", domainNumber: 1, domainName: "Operations Management", domainDescription: "Patient flow, scheduling, facility management, supply chain, and day-to-day operational efficiency", amosOpsModule: "GRO Residential + BHC Clinical Operations", moduleRoute: "/operations", responsibleDivision: "GAD", status: "active", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
      { id: "mgma-d2", domainNumber: 2, domainName: "Financial Management", domainDescription: "Revenue cycle, billing, collections, budgeting, financial reporting, and cost management", amosOpsModule: "Revenue Dashboard + Claims Management", moduleRoute: "/revenue", responsibleDivision: "GAD", status: "active", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
      { id: "mgma-d3", domainNumber: 3, domainName: "Human Resource Management", domainDescription: "Staffing, recruitment, retention, credentialing, training, and performance management", amosOpsModule: "HR Personnel Files + Credentials + Performance", moduleRoute: "/hr", responsibleDivision: "GAD", status: "active", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
      { id: "mgma-d4", domainNumber: 4, domainName: "Compliance & Risk Management", domainDescription: "Regulatory compliance, risk mitigation, quality assurance, accreditation, and legal adherence", amosOpsModule: "Compliance + QA + 42CFR2 + T-748", moduleRoute: "/compliance", responsibleDivision: "EO", status: "active", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
      { id: "mgma-d5", domainNumber: 5, domainName: "Patient Care & Clinical Quality", domainDescription: "Clinical outcomes, care coordination, treatment effectiveness, patient safety, and satisfaction", amosOpsModule: "BHC Clinical + GRO Care + CANS Tracking", moduleRoute: "/clinical", responsibleDivision: "BHC", status: "active", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
      { id: "mgma-d6", domainNumber: 6, domainName: "Information Management", domainDescription: "EHR systems, data analytics, reporting infrastructure, cybersecurity, and health information exchange", amosOpsModule: "AMOS-OPS Platform + NIL Knowledge Graph", moduleRoute: "/intelligence", responsibleDivision: "EO", status: "configured", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
      { id: "mgma-d7", domainNumber: 7, domainName: "Transformation & Strategy", domainDescription: "Strategic planning, organizational development, innovation, market expansion, and change management", amosOpsModule: "Executive Dashboard + Agent Swarm + Milestone Tracking", moduleRoute: "/executive", responsibleDivision: "EO", status: "configured", configuredAt: now, configuredBy: "AMOS-Domain", createdAt: now, updatedAt: now },
    ]).onConflictDoNothing();

    // Seed KPI targets per domain
    await db.insert(mgmaKpiTargets).values([
      // Domain 1: Operations
      { id: "kpi-001", domainId: "mgma-d1", kpiName: "Average Days to Appointment", kpiDescription: "Days from referral to first scheduled appointment", targetValue: "7", targetUnit: "days", comparisonOperator: "less_than", benchmarkSource: "MGMA 2024", currentValue: "5", lastMeasuredAt: now, measurementFrequency: "monthly", status: "on_target", alertThreshold: "10" },
      { id: "kpi-002", domainId: "mgma-d1", kpiName: "No-Show Rate", kpiDescription: "Percentage of scheduled appointments where patient did not show", targetValue: "8", targetUnit: "percentage", comparisonOperator: "less_than", benchmarkSource: "MGMA 2024", currentValue: "12", lastMeasuredAt: now, measurementFrequency: "monthly", status: "off_target", alertThreshold: "10" },
      { id: "kpi-003", domainId: "mgma-d1", kpiName: "Bed Occupancy Rate", kpiDescription: "Percentage of licensed beds occupied", targetValue: "85", targetUnit: "percentage", comparisonOperator: "between", benchmarkSource: "HHSC Target", currentValue: "62", lastMeasuredAt: now, measurementFrequency: "daily", status: "at_risk", alertThreshold: "70" },

      // Domain 2: Financial
      { id: "kpi-004", domainId: "mgma-d2", kpiName: "Days in Accounts Receivable", kpiDescription: "Average days to collect payment after service delivery", targetValue: "40", targetUnit: "days", comparisonOperator: "less_than", benchmarkSource: "MGMA 2024", currentValue: "38", lastMeasuredAt: now, measurementFrequency: "monthly", status: "on_target", alertThreshold: "45" },
      { id: "kpi-005", domainId: "mgma-d2", kpiName: "Clean Claim Rate", kpiDescription: "Percentage of claims paid on first submission without denial", targetValue: "95", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "MGMA 2024", currentValue: "92", lastMeasuredAt: now, measurementFrequency: "monthly", status: "at_risk", alertThreshold: "90" },
      { id: "kpi-006", domainId: "mgma-d2", kpiName: "Net Collection Rate", kpiDescription: "Percentage of collectible revenue actually collected", targetValue: "97", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "MGMA 2024", currentValue: "97", lastMeasuredAt: now, measurementFrequency: "monthly", status: "on_target", alertThreshold: "95" },
      { id: "kpi-007", domainId: "mgma-d2", kpiName: "Cost per Encounter", kpiDescription: "Average operational cost per clinical encounter", targetValue: "125", targetUnit: "dollars", comparisonOperator: "less_than", benchmarkSource: "Internal Benchmark", currentValue: null, lastMeasuredAt: null, measurementFrequency: "quarterly", status: "not_measured", alertThreshold: "150" },

      // Domain 3: HR
      { id: "kpi-008", domainId: "mgma-d3", kpiName: "Staff Turnover Rate", kpiDescription: "Annual percentage of staff leaving the organization", targetValue: "15", targetUnit: "percentage", comparisonOperator: "less_than", benchmarkSource: "MGMA 2024", currentValue: "18", lastMeasuredAt: now, measurementFrequency: "quarterly", status: "off_target", alertThreshold: "20" },
      { id: "kpi-009", domainId: "mgma-d3", kpiName: "Credentialing Completion Time", kpiDescription: "Days to complete full credentialing for new hires", targetValue: "21", targetUnit: "days", comparisonOperator: "less_than", benchmarkSource: "MGMA 2024", currentValue: "24", lastMeasuredAt: now, measurementFrequency: "monthly", status: "at_risk", alertThreshold: "30" },
      { id: "kpi-010", domainId: "mgma-d3", kpiName: "Training Compliance Rate", kpiDescription: "Percentage of staff with current required training certifications", targetValue: "95", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "HHSC Requirement", currentValue: "88", lastMeasuredAt: now, measurementFrequency: "monthly", status: "off_target", alertThreshold: "90" },

      // Domain 4: Compliance
      { id: "kpi-011", domainId: "mgma-d4", kpiName: "Documentation Timeliness", kpiDescription: "Percentage of clinical notes completed within 24 hours", targetValue: "95", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "Internal Policy", currentValue: "91", lastMeasuredAt: now, measurementFrequency: "weekly", status: "at_risk", alertThreshold: "90" },
      { id: "kpi-012", domainId: "mgma-d4", kpiName: "42 CFR Part 2 Training Rate", kpiDescription: "Percentage of staff trained on SUD confidentiality requirements", targetValue: "100", targetUnit: "percentage", comparisonOperator: "equal_to", benchmarkSource: "Federal Regulation", currentValue: "75", lastMeasuredAt: now, measurementFrequency: "quarterly", status: "off_target", alertThreshold: "95" },
      { id: "kpi-013", domainId: "mgma-d4", kpiName: "Incident Report Closure Time", kpiDescription: "Average days to close a restraint/seclusion incident report", targetValue: "3", targetUnit: "days", comparisonOperator: "less_than", benchmarkSource: "T-748 Requirement", currentValue: "2", lastMeasuredAt: now, measurementFrequency: "monthly", status: "on_target", alertThreshold: "5" },

      // Domain 5: Patient Care
      { id: "kpi-014", domainId: "mgma-d5", kpiName: "CANS Completion Rate", kpiDescription: "Percentage of youth with completed CANS assessment within 14 days", targetValue: "100", targetUnit: "percentage", comparisonOperator: "equal_to", benchmarkSource: "HHSC Requirement", currentValue: "33", lastMeasuredAt: now, measurementFrequency: "weekly", status: "off_target", alertThreshold: "90" },
      { id: "kpi-015", domainId: "mgma-d5", kpiName: "Treatment Plan Review Adherence", kpiDescription: "Percentage of active treatment plans reviewed within 90-day window", targetValue: "95", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "HHSC Requirement", currentValue: "100", lastMeasuredAt: now, measurementFrequency: "monthly", status: "on_target", alertThreshold: "90" },
      { id: "kpi-016", domainId: "mgma-d5", kpiName: "Youth Rights Acknowledgment Rate", kpiDescription: "Percentage of youth with fully completed rights acknowledgment", targetValue: "100", targetUnit: "percentage", comparisonOperator: "equal_to", benchmarkSource: "T-748 Requirement", currentValue: "50", lastMeasuredAt: now, measurementFrequency: "weekly", status: "off_target", alertThreshold: "95" },
      { id: "kpi-017", domainId: "mgma-d5", kpiName: "Client Satisfaction Score", kpiDescription: "Average satisfaction rating from youth/guardian surveys", targetValue: "85", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "Internal Benchmark", currentValue: null, lastMeasuredAt: null, measurementFrequency: "quarterly", status: "not_measured", alertThreshold: "80" },

      // Domain 6: Information Management
      { id: "kpi-018", domainId: "mgma-d6", kpiName: "System Uptime", kpiDescription: "Percentage of time AMOS-OPS platform is available", targetValue: "99.9", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "Industry Standard", currentValue: "99.5", lastMeasuredAt: now, measurementFrequency: "daily", status: "at_risk", alertThreshold: "99" },
      { id: "kpi-019", domainId: "mgma-d6", kpiName: "Data Backup Completion", kpiDescription: "Percentage of scheduled backups completed successfully", targetValue: "100", targetUnit: "percentage", comparisonOperator: "equal_to", benchmarkSource: "Internal Policy", currentValue: "100", lastMeasuredAt: now, measurementFrequency: "daily", status: "on_target", alertThreshold: "100" },

      // Domain 7: Strategy
      { id: "kpi-020", domainId: "mgma-d7", kpiName: "Milestone Completion Rate", kpiDescription: "Percentage of project milestones completed on schedule", targetValue: "80", targetUnit: "percentage", comparisonOperator: "greater_than", benchmarkSource: "Internal Target", currentValue: "70", lastMeasuredAt: now, measurementFrequency: "monthly", status: "at_risk", alertThreshold: "70" },
      { id: "kpi-021", domainId: "mgma-d7", kpiName: "Agent Swarm Task Velocity", kpiDescription: "Average tasks completed per development cycle", targetValue: "8", targetUnit: "count", comparisonOperator: "greater_than", benchmarkSource: "Internal Target", currentValue: "7", lastMeasuredAt: now, measurementFrequency: "weekly", status: "at_risk", alertThreshold: "6" },
    ]).onConflictDoNothing();

    return { success: true, message: "MGMA seeded: 7 domains, 21 KPI targets" };
  }),
});
