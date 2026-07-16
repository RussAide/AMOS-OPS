import {
  Cpu,
  HeartPulse,
  Home,
  ShieldAlert,
  FileText,
  DollarSign,
  Users,
  Crown,
  Brain,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentStatus = "active" | "pilot" | "deferred";

export type AgentColor =
  | "blue"
  | "green"
  | "teal"
  | "amber"
  | "purple"
  | "orange"
  | "pink"
  | "red"
  | "indigo"
  | "cyan"
  | "violet"
  | "yellow"
  | "rose";

export interface AgentPersona {
  key: string;
  name: string;
  scope: string;
  boundaries: string[];
  color: AgentColor;
  status: AgentStatus;
  icon: LucideIcon;
  /** Whether outputs from this agent require clinician review */
  requiresClinicianReview?: boolean;
  /** Whether outputs from this agent are routed to QA Officer */
  routedToQAOfficer?: boolean;
  /** Whether this agent accesses PHI (must be logged) */
  accessesPhi?: boolean;
}

export interface AgentPersonaIndicatorProps {
  /** Agent key, e.g. "amos-core", "amos-clinical" */
  agentKey: string;
  /** Expand to show full scope and boundaries */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ─── 13 Registered Personas ──────────────────────────────────────────────────

export const AGENT_PERSONAS: Record<string, AgentPersona> = {
  "amos-core": {
    key: "amos-core",
    name: "AMOS-Core",
    scope:
      "System operations, routing, core services, API gateway, authentication, and cross-module orchestration for the AMOS enterprise intranet.",
    boundaries: [
      "Does not make clinical decisions",
      "Does not process billing claims",
      "Does not access PHI without audit logging",
      "Does not override human-in-command directives",
    ],
    color: "blue",
    status: "active",
    icon: Cpu,
    accessesPhi: true,
  },
  "amos-clinical": {
    key: "amos-clinical",
    name: "AMOS-Clinical",
    scope:
      "BHC clinical operations including MHTCM (Mental Health Targeted Case Management), MHRS (Mental Health Rehabilitative Services), treatment planning, and care coordination workflows.",
    boundaries: [
      "Does not replace licensed clinician judgment",
      "Does not prescribe medications",
      "Does not diagnose independently — all outputs require clinician review",
      "Does not access 42 CFR Part 2 records without explicit authorization",
    ],
    color: "green",
    status: "active",
    icon: HeartPulse,
    requiresClinicianReview: true,
    accessesPhi: true,
  },
  "amos-gro": {
    key: "amos-gro",
    name: "AMOS-GRO",
    scope:
      "Residential operations, shift management, group residential care scheduling, bed management, and daily living activity tracking for residential programs.",
    boundaries: [
      "Does not provide clinical treatment",
      "Does not manage medication administration",
      "Does not override safety protocols",
      "Does not access clinical notes without authorization",
    ],
    color: "teal",
    status: "active",
    icon: Home,
    accessesPhi: true,
  },
  "amos-sentinel": {
    key: "amos-sentinel",
    name: "AMOS-Sentinel",
    scope:
      "QA, compliance monitoring, audit trails, 42 CFR Part 2 enforcement, regulatory adherence tracking, and quality assurance oversight.",
    boundaries: [
      "Does not provide clinical care",
      "Does not make billing decisions",
      "Does not access PHI outside audit scope",
      "All compliance outputs routed to QA Officer",
    ],
    color: "amber",
    status: "active",
    icon: ShieldAlert,
    routedToQAOfficer: true,
    accessesPhi: true,
  },
  "amos-scribe": {
    key: "amos-scribe",
    name: "AMOS-Scribe",
    scope:
      "Document management, DMS (Document Management System), form packets, e-signature workflows, and document lifecycle tracking.",
    boundaries: [
      "Does not alter documents without version control",
      "Does not destroy records outside retention policy",
      "Does not bypass approval workflows",
      "Does not access documents beyond user permissions",
    ],
    color: "purple",
    status: "active",
    icon: FileText,
    accessesPhi: true,
  },
  "amos-revenue": {
    key: "amos-revenue",
    name: "AMOS-Revenue",
    scope:
      "Billing, claims processing, revenue cycle management, MGMA benchmarking, payer reconciliation, and financial reporting.",
    boundaries: [
      "Does not provide clinical guidance",
      "Does not alter clinical documentation for billing purposes",
      "Does not process claims without coding verification",
      "All billing outputs require finance officer review",
    ],
    color: "orange",
    status: "active",
    icon: DollarSign,
    routedToQAOfficer: true,
  },
  "amos-hr": {
    key: "amos-hr",
    name: "AMOS-HR",
    scope:
      "Human resources, workforce lifecycle management, credentialing, training records, and staff scheduling.",
    boundaries: [
      "Does not make hiring decisions",
      "Does not access employee PHI",
      "Does not override HR policy",
      "Does not process payroll",
    ],
    color: "pink",
    status: "deferred",
    icon: Users,
  },
  "amos-prime": {
    key: "amos-prime",
    name: "AMOS-Prime",
    scope:
      "Executive intelligence, strategic planning, board reporting, organizational KPIs, and leadership dashboards.",
    boundaries: [
      "Does not make strategic decisions autonomously",
      "Does not access individual client records",
      "Does not replace executive judgment",
      "Aggregated data only — no individual PHI",
    ],
    color: "red",
    status: "deferred",
    icon: Crown,
  },
  "amos-nxl": {
    key: "amos-nxl",
    name: "AMOS-NXL",
    scope:
      "Advanced analytics, predictive models, risk stratification, outcome forecasting, and machine learning pipelines.",
    boundaries: [
      "Does not replace clinical assessment",
      "Model outputs require human validation",
      "Does not automate care decisions",
      "All predictions flagged as advisory only",
    ],
    color: "indigo",
    status: "deferred",
    icon: Brain,
    requiresClinicianReview: true,
  },
  "amos-thesis": {
    key: "amos-thesis",
    name: "AMOS-THESIS",
    scope:
      "Research support, outcomes analysis, academic publishing assistance, IRB coordination, and scholarly metrics.",
    boundaries: [
      "Does not conduct human subjects research",
      "Does not guarantee publication",
      "Does not access identifiable PHI for research without IRB",
      "All research outputs require principal investigator review",
    ],
    color: "cyan",
    status: "deferred",
    icon: FlaskConical,
    requiresClinicianReview: true,
  },
  "amos-dms": {
    key: "amos-dms",
    name: "AMOS-DMS",
    scope:
      "Document lifecycle management, retention scheduling, archival, destruction workflows, and compliance document tracking.",
    boundaries: [
      "Does not destroy documents before retention period",
      "Does not bypass legal hold",
      "Does not alter document metadata",
      "Does not grant access beyond role permissions",
    ],
    color: "violet",
    status: "deferred",
    icon: FolderOpen,
    accessesPhi: true,
  },
  "amos-coach": {
    key: "amos-coach",
    name: "AMOS-Coach",
    scope:
      "Training delivery, onboarding workflows, SOP dissemination, competency tracking, and staff development programs.",
    boundaries: [
      "Does not replace supervisor mentorship",
      "Does not certify competency autonomously",
      "Does not override training requirements",
      "Does not access trainee clinical records",
    ],
    color: "yellow",
    status: "deferred",
    icon: GraduationCap,
  },
  "amos-strategy": {
    key: "amos-strategy",
    name: "AMOS-Strategy",
    scope:
      "Market analysis, growth planning, competitive intelligence, service line expansion, and strategic partnership evaluation.",
    boundaries: [
      "Does not make investment decisions",
      "Does not replace board strategic planning",
      "Does not access individual client data",
      "All recommendations require executive review",
    ],
    color: "rose",
    status: "deferred",
    icon: TrendingUp,
  },
};

// ─── Helper: Get agent key for a route path ──────────────────────────────────

/**
 * Maps route paths to their responsible agent key.
 * Falls back to "amos-core" for unmatched routes.
 */
export function getAgentForRoute(route: string): string {
  const normalized = route.toLowerCase().replace(/\/$/, "");

  const routeAgentMap: Record<string, string> = {
    // Clinical
    "/clinical": "amos-clinical",
    "/clinical/mhtcm": "amos-clinical",
    "/clinical/mhrs": "amos-clinical",
    "/clinical/treatment-plans": "amos-clinical",
    "/clinical/care-coordination": "amos-clinical",

    // Residential / GRO
    "/residential": "amos-gro",
    "/residential/shifts": "amos-gro",
    "/residential/beds": "amos-gro",
    "/residential/daily-activities": "amos-gro",
    "/gro": "amos-gro",

    // QA / Compliance / Sentinel
    "/qa": "amos-sentinel",
    "/compliance": "amos-sentinel",
    "/audit": "amos-sentinel",
    "/sentinel": "amos-sentinel",
    "/compliance/42-cfr-part-2": "amos-sentinel",

    // Documents / Scribe
    "/documents": "amos-scribe",
    "/dms": "amos-scribe",
    "/documents/packets": "amos-scribe",
    "/documents/forms": "amos-scribe",
    "/e-signature": "amos-scribe",

    // Revenue
    "/revenue": "amos-revenue",
    "/billing": "amos-revenue",
    "/claims": "amos-revenue",
    "/revenue-cycle": "amos-revenue",
    "/mgma": "amos-revenue",
    "/payers": "amos-revenue",

    // HR
    "/hr": "amos-hr",
    "/workforce": "amos-hr",
    "/staffing": "amos-hr",
    "/credentials": "amos-hr",

    // Executive / Prime
    "/executive": "amos-prime",
    "/dashboard": "amos-prime",
    "/kpi": "amos-prime",
    "/board": "amos-prime",
    "/prime": "amos-prime",

    // Analytics / NXL
    "/analytics": "amos-nxl",
    "/predictions": "amos-nxl",
    "/nxl": "amos-nxl",
    "/ml": "amos-nxl",

    // Research / THESIS
    "/research": "amos-thesis",
    "/thesis": "amos-thesis",
    "/outcomes": "amos-thesis",
    "/irb": "amos-thesis",
    "/publications": "amos-thesis",

    // Document Lifecycle / DMS
    "/document-lifecycle": "amos-dms",
    "/retention": "amos-dms",
    "/archive": "amos-dms",

    // Training / Coach
    "/training": "amos-coach",
    "/onboarding": "amos-coach",
    "/sop": "amos-coach",
    "/coach": "amos-coach",
    "/competency": "amos-coach",

    // Strategy
    "/strategy": "amos-strategy",
    "/market-analysis": "amos-strategy",
    "/growth": "amos-strategy",
  };

  // Exact match
  if (routeAgentMap[normalized]) {
    return routeAgentMap[normalized];
  }

  // Prefix match — find the most specific (longest) matching prefix
  let bestMatch: string | null = null;
  let bestMatchLength = 0;

  for (const [routePrefix, agentKey] of Object.entries(routeAgentMap)) {
    if (
      normalized.startsWith(routePrefix + "/") ||
      normalized === routePrefix
    ) {
      if (routePrefix.length > bestMatchLength) {
        bestMatch = agentKey;
        bestMatchLength = routePrefix.length;
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // Default fallback
  return "amos-core";
}
