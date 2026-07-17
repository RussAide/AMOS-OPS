import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

export const M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED =
  "M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED" as const;

const syntheticAnalyticsEnabled = (() => {
  try {
    assertSyntheticScenarioRuntime(env);
    return true;
  } catch {
    return false;
  }
})();

function assertSyntheticAnalyticsWrite(): void {
  if (!syntheticAnalyticsEnabled) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Analytics writes are unavailable because no authoritative Production provider is configured.",
    });
  }
}

// ─── M10: Analytics ────────────────────────────────────────

export const m10Router = createRouter({
  workforceOverview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    total: 42,
    employees: 38,
    contractors: 4,
    byLane: { activation: 22, management: 20 },
    byDepartment: {
      Clinical: 8,
      HR: 5,
      "QA & Compliance": 3,
      Revenue: 3,
      GRO: 6,
      GAD: 4,
      Executive: 3,
      IT: 2,
      Operations: 8,
    },
    byStatus: {
      active: 32,
      onboarding: 5,
      "on-leave": 2,
      terminated: 3,
    },
  }) : ({
    total: 0,
    employees: 0,
    contractors: 0,
    byLane: {},
    byDepartment: {},
    byStatus: {},
  })),

  moduleCompletionRates: authedQuery.query(() => syntheticAnalyticsEnabled ? [
    {
      moduleId: "mod-hr-policies",
      moduleName: "HR Policies & Procedures",
      completed: 35,
      pending: 7,
      rate: 83,
    },
    {
      moduleId: "mod-hipaa",
      moduleName: "HIPAA Privacy & Security",
      completed: 38,
      pending: 4,
      rate: 90,
    },
    {
      moduleId: "mod-cfr-42",
      moduleName: "42 CFR Part 2",
      completed: 36,
      pending: 6,
      rate: 86,
    },
    {
      moduleId: "mod-crisis",
      moduleName: "Crisis Intervention",
      completed: 30,
      pending: 12,
      rate: 71,
    },
    {
      moduleId: "mod-documentation",
      moduleName: "Clinical Documentation",
      completed: 32,
      pending: 10,
      rate: 76,
    },
    {
      moduleId: "mod-medication",
      moduleName: "Medication Administration",
      completed: 28,
      pending: 14,
      rate: 67,
    },
    {
      moduleId: "mod-youth-rights",
      moduleName: "Youth Rights & Advocacy",
      completed: 34,
      pending: 8,
      rate: 81,
    },
    {
      moduleId: "mod-restraint",
      moduleName: "Restraint & Seclusion",
      completed: 29,
      pending: 13,
      rate: 69,
    },
    {
      moduleId: "mod-billing",
      moduleName: "Billing & Coding Basics",
      completed: 25,
      pending: 17,
      rate: 60,
    },
    {
      moduleId: "mod-safety",
      moduleName: "Facility Safety & Fire",
      completed: 40,
      pending: 2,
      rate: 95,
    },
  ] : []),

  documentCompliance: authedQuery.query(() => syntheticAnalyticsEnabled ? [
    {
      moduleId: "personnel-file",
      verified: 35,
      uploaded: 5,
      rejected: 2,
      complianceRate: 83,
    },
    {
      moduleId: "credential-verification",
      verified: 32,
      uploaded: 8,
      rejected: 2,
      complianceRate: 76,
    },
    {
      moduleId: "background-check",
      verified: 38,
      uploaded: 3,
      rejected: 1,
      complianceRate: 90,
    },
    {
      moduleId: "tb-screening",
      verified: 36,
      uploaded: 5,
      rejected: 1,
      complianceRate: 86,
    },
    {
      moduleId: "drug-screening",
      verified: 37,
      uploaded: 4,
      rejected: 1,
      complianceRate: 88,
    },
    {
      moduleId: "i-9-verification",
      verified: 34,
      uploaded: 6,
      rejected: 2,
      complianceRate: 81,
    },
    {
      moduleId: "w-4-forms",
      verified: 38,
      uploaded: 3,
      rejected: 1,
      complianceRate: 90,
    },
    {
      moduleId: "emergency-contact",
      verified: 40,
      uploaded: 2,
      rejected: 0,
      complianceRate: 95,
    },
  ] : []),

  transitionActivity: authedQuery
    .input(z.object({ days: z.number().default(30) }))
    .query(() => {
      if (!syntheticAnalyticsEnabled) {
        return { recent: 0, byDay: [], byModule: [] };
      }
      const byDay = [
        { date: "2026-05-30", count: 2 },
        { date: "2026-05-31", count: 1 },
        { date: "2026-06-01", count: 3 },
        { date: "2026-06-02", count: 0 },
        { date: "2026-06-03", count: 2 },
        { date: "2026-06-04", count: 4 },
        { date: "2026-06-05", count: 1 },
        { date: "2026-06-06", count: 0 },
        { date: "2026-06-07", count: 2 },
        { date: "2026-06-08", count: 3 },
        { date: "2026-06-09", count: 1 },
        { date: "2026-06-10", count: 2 },
        { date: "2026-06-11", count: 4 },
        { date: "2026-06-12", count: 2 },
        { date: "2026-06-13", count: 1 },
        { date: "2026-06-14", count: 0 },
        { date: "2026-06-15", count: 3 },
        { date: "2026-06-16", count: 2 },
        { date: "2026-06-17", count: 1 },
        { date: "2026-06-18", count: 3 },
        { date: "2026-06-19", count: 2 },
        { date: "2026-06-20", count: 4 },
        { date: "2026-06-21", count: 1 },
        { date: "2026-06-22", count: 2 },
        { date: "2026-06-23", count: 3 },
        { date: "2026-06-24", count: 1 },
        { date: "2026-06-25", count: 2 },
        { date: "2026-06-26", count: 3 },
        { date: "2026-06-27", count: 1 },
        { date: "2026-06-28", count: 2 },
      ];
      const byModule = [
        { moduleId: "hr", moduleName: "HR Lifecycle", count: 18 },
        { moduleId: "clinical", moduleName: "Clinical", count: 12 },
        { moduleId: "qa", moduleName: "QA & Compliance", count: 8 },
        { moduleId: "revenue", moduleName: "Revenue Cycle", count: 6 },
        { moduleId: "documents", moduleName: "Documents", count: 10 },
        { moduleId: "gad", moduleName: "GAD Operations", count: 7 },
        { moduleId: "gro", moduleName: "Growth & Outreach", count: 5 },
      ];
      return {
        recent: byDay.reduce((s, d) => s + d.count, 0),
        byDay,
        byModule,
      };
    }),

  timeToClearMetrics: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    averageDays: 14,
    medianDays: 12,
    byLane: {
      activation: { avgDays: 18, count: 15 },
      management: { avgDays: 10, count: 23 },
    },
    byDepartment: {
      Clinical: { avgDays: 16, count: 8 },
      HR: { avgDays: 12, count: 5 },
      "QA & Compliance": { avgDays: 20, count: 3 },
      Revenue: { avgDays: 11, count: 3 },
      GRO: { avgDays: 15, count: 6 },
      GAD: { avgDays: 13, count: 4 },
      Executive: { avgDays: 8, count: 3 },
      Operations: { avgDays: 14, count: 8 },
    },
  }) : ({ averageDays: 0, medianDays: 0, byLane: {}, byDepartment: {} })),

  alertSummary: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    activeWithoutClearance: 2,
    expiredCredentials: 3,
    pendingOrientation: 5,
    incompletePersonnelFiles: 4,
    restrictedClearance: 1,
    pendingOffers: 2,
    pendingReviews: 3,
    expiringSoon: 6,
  }) : ({
    activeWithoutClearance: 0,
    expiredCredentials: 0,
    pendingOrientation: 0,
    incompletePersonnelFiles: 0,
    restrictedClearance: 0,
    pendingOffers: 0,
    pendingReviews: 0,
    expiringSoon: 0,
  })),

  // ─── Cross-Module Operational KPIs ───────────────────────

  clinicalOverview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    totalYouth: 4,
    activeYouth: 4,
    admissionsThisMonth: 2,
    dischargesThisMonth: 0,
    assessmentsPending: 1,
    sessionsThisWeek: 12,
    governedReviewsPending: 1,
    humanReviewsCompleted: 3,
    byWorkflowStage: { intake: 1, active_care: 3, aftercare: 0 },
    byReviewStatus: { current: 2, due: 1, escalated: 1 },
  }) : ({
    totalYouth: 0, activeYouth: 0, admissionsThisMonth: 0,
    dischargesThisMonth: 0, assessmentsPending: 0, sessionsThisWeek: 0,
    governedReviewsPending: 0, humanReviewsCompleted: 0,
    byWorkflowStage: {}, byReviewStatus: {},
  })),

  residentialOverview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    campusCapacity: 48,
    operationalBeds: 12,
    occupiedBeds: 7,
    occupancyRate: 58,
    shiftsThisWeek: 21,
    observationsThisWeek: 18,
    familyContactsThisWeek: 6,
    medicationsScheduled: 8,
    medicationsAdministered: 6,
    medicationsRefused: 1,
    medicationsHeld: 1,
    behavioralIncidentsThisWeek: 2,
    prnAdministrations: 1,
    byFacility: [
      {
        facilityId: "fac-001",
        name: "Main Residence",
        occupied: 4,
        capacity: 4,
        rate: 100,
      },
      {
        facilityId: "fac-002",
        name: "New Facility",
        occupied: 3,
        capacity: 8,
        rate: 38,
      },
      {
        facilityId: "fac-003",
        name: "Emergency Care GRO",
        occupied: 0,
        capacity: 16,
        rate: 0,
      },
      {
        facilityId: "fac-004",
        name: "Purpose-Built",
        occupied: 0,
        capacity: 16,
        rate: 0,
      },
    ],
  }) : ({
    campusCapacity: 0, operationalBeds: 0, occupiedBeds: 0, occupancyRate: 0,
    shiftsThisWeek: 0, observationsThisWeek: 0, familyContactsThisWeek: 0,
    medicationsScheduled: 0, medicationsAdministered: 0,
    medicationsRefused: 0, medicationsHeld: 0,
    behavioralIncidentsThisWeek: 0, prnAdministrations: 0, byFacility: [],
  })),

  revenueOverview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    totalClaims: 24,
    claimsPending: 6,
    claimsApproved: 14,
    claimsDenied: 3,
    claimsAppealed: 1,
    totalBilled: 1840000,
    totalCollected: 1420000,
    collectionRate: 77,
    avgDaysToPayment: 18,
    authorizationsActive: 4,
    authorizationsPending: 2,
    authorizationsExpiring: 1,
    denialsByReason: [
      { reason: "Missing Documentation", count: 1 },
      { reason: "Authorization Required", count: 1 },
      { reason: "Coding Error", count: 1 },
    ],
  }) : ({
    totalClaims: 0, claimsPending: 0, claimsApproved: 0, claimsDenied: 0,
    claimsAppealed: 0, totalBilled: 0, totalCollected: 0, collectionRate: 0,
    avgDaysToPayment: 0, authorizationsActive: 0, authorizationsPending: 0,
    authorizationsExpiring: 0, denialsByReason: [],
  })),

  complianceOverview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    openIncidents: 2,
    incidentsThisMonth: 4,
    openAudits: 1,
    auditsThisQuarter: 2,
    correctiveActionsOpen: 3,
    correctiveActionsOverdue: 1,
    chartAuditPassRate: 78,
    chartAuditsThisMonth: 2,
    hhscReportsDue: 1,
    hhscReportsOverdue: 0,
    byIncidentType: [
      { type: "behavioral", count: 2 },
      { type: "medication_error", count: 1 },
      { type: "equipment", count: 1 },
    ],
    byAuditResult: [
      { result: "pass", count: 1 },
      { result: "pass_with_notes", count: 1 },
    ],
  }) : ({
    openIncidents: 0, incidentsThisMonth: 0, openAudits: 0,
    auditsThisQuarter: 0, correctiveActionsOpen: 0,
    correctiveActionsOverdue: 0, chartAuditPassRate: 0,
    chartAuditsThisMonth: 0, hhscReportsDue: 0, hhscReportsOverdue: 0,
    byIncidentType: [], byAuditResult: [],
  })),

  gadOverview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    openWorkOrders: 3,
    inProgressWorkOrders: 2,
    completedThisMonth: 2,
    overdueWorkOrders: 0,
    urgentHighCount: 3,
    vendorCount: 7,
    vendorContractsExpiring: 2,
    facilities: 2,
    totalEstimatedSpend: 743000,
    totalActualSpend: 103000,
    byWorkType: [
      { type: "hvac", count: 1 },
      { type: "plumbing", count: 1 },
      { type: "electrical", count: 1 },
      { type: "safety", count: 1 },
      { type: "security", count: 1 },
      { type: "it", count: 1 },
      { type: "maintenance", count: 1 },
    ],
  }) : ({
    openWorkOrders: 0, inProgressWorkOrders: 0, completedThisMonth: 0,
    overdueWorkOrders: 0, urgentHighCount: 0, vendorCount: 0,
    vendorContractsExpiring: 0, facilities: 0, totalEstimatedSpend: 0,
    totalActualSpend: 0, byWorkType: [],
  })),

  // ─── Enterprise Executive Summary ────────────────────────

  executiveSummary: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    timestamp: new Date().toISOString(),
    operationalStatus: "stable",
    criticalAlerts: 2,
    modulesOnline: 6,
    modulesTotal: 13,
    youthServedMTD: 4,
    revenueMTD: 1420000,
    expensesMTD: 103000,
    headcountActive: 38,
    openPositions: 4,
    incidentsOpen: 2,
    complianceScore: 78,
    riskLevel: "moderate",
  }) : ({
    timestamp: new Date().toISOString(), operationalStatus: "unavailable",
    criticalAlerts: 0, modulesOnline: 0, modulesTotal: 13,
    youthServedMTD: 0, revenueMTD: 0, expensesMTD: 0,
    headcountActive: 0, openPositions: 0, incidentsOpen: 0,
    complianceScore: 0, riskLevel: "unknown",
  })),

  // ═══════════════════════════════════════════════════════════
  // STRATEGIC PROJECTS HUB
  // ═══════════════════════════════════════════════════════════

  /** List all strategic projects with their current status */
  listStrategicProjects: authedQuery.query(async () => {
    try {
      return sqlite.prepare("SELECT * FROM strategic_projects").all();
    } catch {
      return syntheticAnalyticsEnabled ? STRATEGIC_PROJECTS_SEED : [];
    }
  }),

  /** Get a single project with milestones */
  getStrategicProject: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const project = sqlite
          .prepare("SELECT * FROM strategic_projects WHERE id = ?")
          .get(input.id);
        if (project) return project;
      } catch {
        // The synthetic fallback below is limited to isolated scenario runtimes.
      }
      const project = syntheticAnalyticsEnabled
        ? STRATEGIC_PROJECTS_SEED.find((p) => p.id === input.id)
        : null;
      if (!project) return null;
      return { ...project, milestones: project.milestones ?? [] };
    }),

  /** Create a new strategic project */
  createStrategicProject: adminQuery
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        owner: z.string().min(1),
        division: z.enum(["EO", "GAD", "GRO", "BHC"]),
        priority: z
          .enum(["critical", "high", "medium", "low"])
          .default("medium"),
        status: z
          .enum(["planning", "active", "on_hold", "completed", "cancelled"])
          .default("planning"),
        startDate: z.string(),
        targetDate: z.string(),
        budget: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = randomUUID();
      const now = new Date().toISOString();
      try {
        sqlite
          .prepare(
            `INSERT INTO strategic_projects (
          id, name, description, owner, division, priority, status,
          start_date, target_date, budget, progress, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.name,
            input.description ?? null,
            input.owner,
            input.division,
            input.priority,
            input.status,
            input.startDate,
            input.targetDate,
            input.budget ?? null,
            0,
            now,
            now,
          );
      } catch (error) {
        if (!syntheticAnalyticsEnabled) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "The authoritative strategic-project store is unavailable.",
            cause: error,
          });
        }
      }
      return { success: true, id, ...input, progress: 0 };
    }),

  /** Update project progress */
  updateProjectProgress: adminQuery
    .input(
      z.object({
        id: z.string(),
        progress: z.number().min(0).max(100),
        status: z
          .enum(["planning", "active", "on_hold", "completed", "cancelled"])
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      assertSyntheticAnalyticsWrite();
      return {
        success: true,
        id: input.id,
        progress: input.progress,
        status: input.status,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // KNOWLEDGE & SOP LIBRARY
  // ═══════════════════════════════════════════════════════════

  /** List all SOPs and policies */
  listSOPs: authedQuery.query(() => syntheticAnalyticsEnabled ? SOP_ITEMS_SEED : []),

  /** List regulatory references */
  listRegulatoryRefs: authedQuery.query(() => syntheticAnalyticsEnabled ? REGULATORY_REFS_SEED : []),

  /** Get SOP detail by ID */
  getSOP: authedQuery.input(z.object({ id: z.string() })).query(({ input }) => {
    return syntheticAnalyticsEnabled
      ? SOP_ITEMS_SEED.find((s) => s.id === input.id) ?? null
      : null;
  }),

  // ═══════════════════════════════════════════════════════════
  // MARKETING SITE REVIEW
  // ═══════════════════════════════════════════════════════════

  /** Get marketing site review summary */
  marketingSiteReview: authedQuery.query(() => syntheticAnalyticsEnabled ? ({
    overallScore: 72,
    lastReviewed: "2026-06-28",
    reviewer: "AMOS-Sentinel",
    categories: [
      {
        name: "Accessibility",
        score: 65,
        issues: 12,
        critical: 3,
        status: "needs_work",
      },
      { name: "SEO", score: 78, issues: 8, critical: 1, status: "acceptable" },
      {
        name: "Performance",
        score: 82,
        issues: 5,
        critical: 0,
        status: "good",
      },
      {
        name: "Content",
        score: 70,
        issues: 10,
        critical: 2,
        status: "needs_work",
      },
      { name: "Mobile", score: 85, issues: 3, critical: 0, status: "good" },
      {
        name: "Security",
        score: 90,
        issues: 2,
        critical: 0,
        status: "excellent",
      },
    ],
    pages: [
      {
        url: "/",
        title: "Homepage",
        score: 75,
        lastChecked: "2026-06-28",
        issues: 8,
      },
      {
        url: "/about",
        title: "About Us",
        score: 68,
        lastChecked: "2026-06-27",
        issues: 11,
      },
      {
        url: "/services",
        title: "Services",
        score: 72,
        lastChecked: "2026-06-27",
        issues: 9,
      },
      {
        url: "/admissions",
        title: "Admissions",
        score: 80,
        lastChecked: "2026-06-26",
        issues: 5,
      },
      {
        url: "/contact",
        title: "Contact",
        score: 88,
        lastChecked: "2026-06-26",
        issues: 3,
      },
      {
        url: "/careers",
        title: "Careers",
        score: 55,
        lastChecked: "2026-06-25",
        issues: 18,
      },
      {
        url: "/compliance",
        title: "Compliance",
        score: 70,
        lastChecked: "2026-06-25",
        issues: 10,
      },
    ],
    recentIssues: [
      {
        id: "i1",
        page: "/careers",
        category: "Accessibility",
        severity: "critical",
        description: "Missing alt text on 6 images",
        status: "open",
        reportedAt: "2026-06-28",
      },
      {
        id: "i2",
        page: "/about",
        category: "Content",
        severity: "critical",
        description: "Outdated leadership team information",
        status: "open",
        reportedAt: "2026-06-27",
      },
      {
        id: "i3",
        page: "/",
        category: "Accessibility",
        severity: "high",
        description: "Insufficient color contrast on CTA buttons",
        status: "open",
        reportedAt: "2026-06-28",
      },
      {
        id: "i4",
        page: "/services",
        category: "SEO",
        severity: "medium",
        description: "Missing meta descriptions on 3 service pages",
        status: "open",
        reportedAt: "2026-06-27",
      },
      {
        id: "i5",
        page: "/careers",
        category: "Performance",
        severity: "high",
        description: "Page load time exceeds 4s on mobile",
        status: "open",
        reportedAt: "2026-06-25",
      },
    ],
  }) : ({
    overallScore: 0,
    lastReviewed: null,
    reviewer: null,
    categories: [],
    pages: [],
    recentIssues: [],
    status: "unavailable",
  })),

  /** Run a marketing site scan (mock) */
  runMarketingScan: adminQuery.mutation(async () => {
    assertSyntheticAnalyticsWrite();
    return {
      scanId: randomUUID(),
      startedAt: new Date().toISOString(),
      status: "running",
      pagesQueued: 7,
      estimatedCompletion: "3 minutes",
    };
  }),
});

// ═══════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════

const STRATEGIC_PROJECTS_SEED = [
  {
    id: "sp1",
    name: "CBC Faith-Based Partnership",
    description:
      "Community engagement with Covenant Bible Church for mentorship, family support, and volunteer programs.",
    status: "active",
    priority: "high" as const,
    progress: 65,
    owner: "Demo Executive",
    division: "EO",
    startDate: "2026-04-01",
    targetDate: "2026-09-30",
    budget: 50000,
    milestones: [
      { label: "Initial contact", done: true },
      { label: "MOU draft", done: true },
      { label: "Legal review", done: false },
      { label: "Board approval", done: false },
      { label: "Launch", done: false },
    ],
  },
  {
    id: "sp2",
    name: "GRO Residential Launch",
    description:
      "48-bed residential treatment campus with phased activation. Current: 12 beds operational.",
    status: "active",
    priority: "critical" as const,
    progress: 38,
    owner: "Operations",
    division: "GRO",
    startDate: "2026-01-01",
    targetDate: "2026-12-31",
    budget: 743000,
    milestones: [
      { label: "Phase 1 (12 beds)", done: true },
      { label: "Phase 2 (16 beds)", done: false },
      { label: "Phase 3 (16 beds)", done: false },
      { label: "Phase 4 (4 beds)", done: false },
      { label: "Full activation", done: false },
    ],
  },
  {
    id: "sp3",
    name: "BHC Clinical Expansion",
    description:
      "Expand BHC services to include outpatient and crisis stabilization programs.",
    status: "active",
    priority: "high" as const,
    progress: 45,
    owner: "Demo Clinical Director",
    division: "BHC",
    startDate: "2026-03-01",
    targetDate: "2026-10-31",
    budget: 320000,
    milestones: [
      { label: "Outpatient licensure", done: true },
      { label: "Crisis protocol draft", done: true },
      { label: "Staff hiring (4 roles)", done: false },
      { label: "Pilot launch", done: false },
    ],
  },
  {
    id: "sp4",
    name: "AMOS-OPS Full Deployment",
    description:
      "Enterprise intranet rollout across all 13 personas and 8 workflows.",
    status: "active",
    priority: "critical" as const,
    progress: 72,
    owner: "AMOS II / Demo Executive",
    division: "EO",
    startDate: "2026-01-01",
    targetDate: "2026-08-31",
    budget: 180000,
    milestones: [
      { label: "Sprint 1 complete", done: true },
      { label: "Sprint 2 complete", done: true },
      { label: "Sprint 3 in progress", done: true },
      { label: "Pilot activation", done: false },
      { label: "Production handoff", done: false },
    ],
  },
  {
    id: "sp5",
    name: "Revenue Cycle Optimization",
    description:
      "Target 85% collection rate through denial management and documentation improvements.",
    status: "active",
    priority: "high" as const,
    progress: 30,
    owner: "Demo Clinical Lead",
    division: "GAD",
    startDate: "2026-05-01",
    targetDate: "2026-09-30",
    budget: 45000,
    milestones: [
      { label: "Denial analysis", done: true },
      { label: "Process redesign", done: false },
      { label: "Staff training", done: false },
      { label: "Target achievement", done: false },
    ],
  },
  {
    id: "sp6",
    name: "HHSC Licensing Automation",
    description: "Automated HHSC reporting and compliance tracking system.",
    status: "planning",
    priority: "medium" as const,
    progress: 10,
    owner: "QA Lead",
    division: "GAD",
    startDate: "2026-07-01",
    targetDate: "2026-11-30",
    budget: 25000,
    milestones: [
      { label: "Requirements gathering", done: true },
      { label: "System design", done: false },
      { label: "Implementation", done: false },
      { label: "Testing", done: false },
    ],
  },
];

const SOP_ITEMS_SEED = [
  {
    id: "SOP-001",
    title: "SOP Part I: Professional Boundaries",
    category: "Professional Standards",
    updated: "2026-06-01",
    status: "current",
  },
  {
    id: "SOP-002",
    title: "SOP Part II: Safety Protocols",
    category: "Safety",
    updated: "2026-05-15",
    status: "current",
  },
  {
    id: "SOP-003",
    title: "SOP Part III: Referral & Intake",
    category: "Intake",
    updated: "2026-06-20",
    status: "current",
  },
  {
    id: "SOP-004",
    title: "SOP Part IV: Governed Clinical Assessment",
    category: "Clinical",
    updated: "2026-06-18",
    status: "review",
  },
  {
    id: "SOP-005",
    title: "SOP Part V: Service Delivery",
    category: "Care",
    updated: "2026-05-01",
    status: "current",
  },
  {
    id: "SOP-006",
    title: "SOP Part VI: Residential Operations",
    category: "GRO",
    updated: "2026-06-25",
    status: "current",
  },
  {
    id: "SOP-007",
    title: "SOP Part VII: Case Management",
    category: "Care",
    updated: "2026-04-10",
    status: "review",
  },
  {
    id: "SOP-008",
    title: "SOP Part VIII: Observation & Meetings",
    category: "Operations",
    updated: "2026-06-10",
    status: "current",
  },
  {
    id: "SOP-009",
    title: "SOP Part IX: Crisis Response",
    category: "Safety",
    updated: "2026-06-15",
    status: "current",
  },
  {
    id: "SOP-010",
    title: "SOP Part X: Compliance & QA",
    category: "Compliance",
    updated: "2026-05-20",
    status: "current",
  },
  {
    id: "SOP-011",
    title: "SOP Part XI: Revenue Cycle",
    category: "Revenue",
    updated: "2026-04-01",
    status: "review",
  },
  {
    id: "SOP-012",
    title: "SOP Part XII: Workforce Management",
    category: "HR",
    updated: "2026-06-01",
    status: "current",
  },
];

const REGULATORY_REFS_SEED = [
  {
    title: "42 CFR Part 2 — Confidentiality of SUD Patient Records",
    citation: "42 CFR § 2.1 et seq.",
  },
  {
    title: "Texas Health and Safety Code — Mental Health",
    citation: "Tex. Health & Safety Code Ch. 572",
  },
  {
    title: "Texas Administrative Code — Residential Treatment",
    citation: "40 TAC Ch. 245",
  },
  { title: "HIPAA Privacy Rule", citation: "45 CFR § 164.500" },
  {
    title: "HHSC Minimum Standards for RTCs",
    citation: "CCL-205 through CCL-208",
  },
];
