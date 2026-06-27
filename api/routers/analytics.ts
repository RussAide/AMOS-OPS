// AMOS-OPS Analytics Router
// Aggregated queries for workforce trends, compliance scoring, and operational metrics

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { hrPeople, moduleStatuses, statusTransitions, documents } from "@db/schema";
import { eq } from "drizzle-orm";

export const analyticsRouter = createRouter({
  // ─── Workforce Overview ────────────────────────────────────

  workforceOverview: publicQuery.query(async () => {
    const db = getDb();
    const allPeople = await db.select().from(hrPeople).all();

    const byLane = {
      activation: allPeople.filter((p) => p.lane === "activation").length,
      management: allPeople.filter((p) => p.lane === "management").length,
    };

    const byDepartment: Record<string, number> = {};
    for (const p of allPeople) {
      byDepartment[p.department] = (byDepartment[p.department] || 0) + 1;
    }

    const byStatus = {
      active: allPeople.filter((p) => p.isActive).length,
      inactive: allPeople.filter((p) => !p.isActive).length,
    };

    const employeeCount = allPeople.filter((p) => p.isEmployee).length;

    return {
      total: allPeople.length,
      employees: employeeCount,
      candidates: allPeople.length - employeeCount,
      byLane,
      byDepartment,
      byStatus,
    };
  }),

  // ─── Module Status Distribution ────────────────────────────

  moduleStatusDistribution: publicQuery
    .input(z.object({ moduleId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const statuses = input?.moduleId
        ? await db.select().from(moduleStatuses).where(eq(moduleStatuses.moduleId, input.moduleId)).all()
        : await db.select().from(moduleStatuses).all();

      const distribution: Record<string, Record<string, number>> = {};
      for (const s of statuses) {
        if (!distribution[s.moduleId]) distribution[s.moduleId] = {};
        distribution[s.moduleId][s.statusId] = (distribution[s.moduleId][s.statusId] || 0) + 1;
      }

      return distribution;
    }),

  // ─── Module Completion Rates ───────────────────────────────

  moduleCompletionRates: publicQuery.query(async () => {
    const db = getDb();
    const statuses = await db.select().from(moduleStatuses).all();

    const moduleNames: Record<string, string> = {
      recruitment: "Recruitment",
      screening: "Screening",
      interview: "Interview",
      offers: "Offers",
      orientation: "Orientation",
      onboarding: "Onboarding",
      clearance: "Clearance",
      "personnel-files": "Personnel Files",
      credentials: "Credentials",
      performance: "Performance",
      compliance: "Compliance",
      separation: "Separation",
    };

    const terminalStatuses: Record<string, string[]> = {
      recruitment: ["r-closed"],
      screening: ["s-selected", "s-rejected"],
      interview: ["i-completed"],
      offers: ["o-file-ready", "o-accepted"],
      orientation: ["or-signed"],
      onboarding: ["ob-comp-done"],
      clearance: ["c-cleared"],
      "personnel-files": ["pf-complete"],
      credentials: ["cr-current"],
      performance: ["pa-closed"],
      compliance: ["ca-closed"],
      separation: ["sep-closed"],
    };

    const moduleTotals: Record<string, { total: number; completed: number }> = {};
    for (const s of statuses) {
      if (!moduleTotals[s.moduleId]) moduleTotals[s.moduleId] = { total: 0, completed: 0 };
      moduleTotals[s.moduleId].total++;
      const terminals = terminalStatuses[s.moduleId] || [];
      if (terminals.includes(s.statusId)) {
        moduleTotals[s.moduleId].completed++;
      }
    }

    return Object.entries(moduleTotals).map(([moduleId, data]) => ({
      moduleId,
      moduleName: moduleNames[moduleId] || moduleId,
      total: data.total,
      completed: data.completed,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      pending: data.total - data.completed,
    }));
  }),

  // ─── Document Compliance ───────────────────────────────────

  documentCompliance: publicQuery.query(async () => {
    const db = getDb();
    const allDocs = await db.select().from(documents).all();

    const byModule: Record<string, { total: number; verified: number; uploaded: number; rejected: number; expired: number }> = {};

    for (const d of allDocs) {
      if (!byModule[d.moduleId]) {
        byModule[d.moduleId] = { total: 0, verified: 0, uploaded: 0, rejected: 0, expired: 0 };
      }
      byModule[d.moduleId].total++;
      byModule[d.moduleId][d.status as "verified" | "uploaded" | "rejected" | "expired"]++;
    }

    return Object.entries(byModule).map(([moduleId, data]) => ({
      moduleId,
      moduleName: moduleId,
      ...data,
      complianceRate: data.total > 0 ? Math.round((data.verified / data.total) * 100) : 0,
    }));
  }),

  // ─── Status Transition Activity ────────────────────────────

  transitionActivity: publicQuery
    .input(z.object({ days: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const days = input?.days || 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const transitions = await db
        .select()
        .from(statusTransitions)
        .all();

      const recent = transitions.filter((t) => t.changedAt && t.changedAt >= cutoff);

      // Group by day
      const byDay: Record<string, number> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        byDay[d.toISOString().slice(0, 10)] = 0;
      }
      for (const t of recent) {
        if (!t.changedAt) continue;
        const day = t.changedAt.slice(0, 10);
        if (day in byDay) byDay[day]++;
      }

      // Group by module
      const byModule: Record<string, number> = {};
      for (const t of recent) {
        byModule[t.moduleName] = (byModule[t.moduleName] || 0) + 1;
      }

      return {
        total: transitions.length,
        recent: recent.length,
        byDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
        byModule: Object.entries(byModule)
          .sort((a, b) => b[1] - a[1])
          .map(([moduleName, count]) => ({ moduleName, count })),
      };
    }),

  // ─── Time-to-Clear Metrics ─────────────────────────────────

  timeToClearMetrics: publicQuery.query(async () => {
    const db = getDb();
    const people = await db.select().from(hrPeople).all();
    const transitions = await db.select().from(statusTransitions).all();

    // For each person with clearance transitions, calculate time from first recruitment to clearance
    const metrics: Array<{ personName: string; lane: string; department: string; daysToClear: number }> = [];

    for (const p of people) {
      if (!p.isEmployee) continue;

      const personTransitions = transitions
        .filter((t) => t.personId === p.id && t.changedAt)
        .sort((a, b) => new Date(a.changedAt!).getTime() - new Date(b.changedAt!).getTime());

      if (personTransitions.length === 0) continue;

      const firstTransition = personTransitions[0];
      const clearanceTransition = personTransitions.find((t) =>
        t.toStatus.toLowerCase().includes("cleared") || t.toStatus.toLowerCase().includes("clear")
      );

      if (clearanceTransition && clearanceTransition.changedAt) {
        const start = new Date(firstTransition.changedAt!).getTime();
        const end = new Date(clearanceTransition.changedAt).getTime();
        const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
        metrics.push({
          personName: `${p.firstName} ${p.lastName}`,
          lane: p.lane,
          department: p.department,
          daysToClear: Math.max(1, days),
        });
      }
    }

    const avgDays = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.daysToClear, 0) / metrics.length)
      : 0;

    const byLane: Record<string, { count: number; avgDays: number }> = {};
    for (const m of metrics) {
      if (!byLane[m.lane]) byLane[m.lane] = { count: 0, avgDays: 0 };
      byLane[m.lane].count++;
      byLane[m.lane].avgDays += m.daysToClear;
    }
    for (const lane of Object.keys(byLane)) {
      byLane[lane].avgDays = Math.round(byLane[lane].avgDays / byLane[lane].count);
    }

    return {
      totalCleared: metrics.length,
      averageDays: avgDays,
      byLane,
      details: metrics.slice(0, 20), // Top 20
    };
  }),

  // ─── Alert Summary ─────────────────────────────────────────

  alertSummary: publicQuery.query(async () => {
    const db = getDb();
    const people = await db.select().from(hrPeople).all();
    const allStatuses = await db.select().from(moduleStatuses).all();

    const personStatusMap: Record<string, Record<string, string>> = {};
    for (const s of allStatuses) {
      if (!personStatusMap[s.personId]) personStatusMap[s.personId] = {};
      personStatusMap[s.personId][s.moduleId] = s.statusId;
    }

    // Count people by alert-triggering statuses
    const alerts = {
      activeWithoutClearance: 0,
      expiredCredentials: 0,
      pendingOrientation: 0,
      incompletePersonnelFiles: 0,
      restrictedClearance: 0,
      pendingOffers: 0,
      pendingReviews: 0,
      expiringSoon: 0,
    };

    for (const p of people) {
      if (!p.isActive) continue;
      const ms = personStatusMap[p.id] || {};

      if (ms.clearance && ms.clearance !== "c-cleared" && ms.clearance !== "c-not-cleared") {
        alerts.activeWithoutClearance++;
      }
      if (ms.credentials === "cr-expired") alerts.expiredCredentials++;
      if (ms.orientation === "or-in-progress") alerts.pendingOrientation++;
      if (ms["personnel-files"] === "pf-incomplete") alerts.incompletePersonnelFiles++;
      if (ms.clearance === "c-restricted") alerts.restrictedClearance++;
      if (["o-sent", "o-packet-sent", "o-packet-inc", "o-file-build"].includes(ms.offers)) {
        alerts.pendingOffers++;
      }
      if (["pa-open", "pa-notified", "pa-followup"].includes(ms.performance)) {
        alerts.pendingReviews++;
      }
      if (ms.credentials === "cr-expiring") alerts.expiringSoon++;
    }

    return alerts;
  }),
});
