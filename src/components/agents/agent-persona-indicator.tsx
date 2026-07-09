/**
 * AgentPersonaIndicator.tsx
 *
 * Displays the active AMOS agent persona for the current workspace.
 * Shows agent name, scope, boundaries, and status.
 *
 * Tech: React 19, TypeScript 5.9, Tailwind 3.4, shadcn/ui, lucide-react
 */

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  ChevronDown,
  ChevronUp,
  Lock,
  Plane,
  CircleDot,
  Shield,
  AlertTriangle,
  Eye,
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

// ─── Color → Tailwind Class Mapping ──────────────────────────────────────────

const COLOR_STYLES: Record<
  AgentColor,
  {
    bar: string;
    badge: string;
    badgeBg: string;
    text: string;
    border: string;
    iconBg: string;
    iconText: string;
  }
> = {
  blue: {
    bar: "bg-blue-500",
    badge: "text-blue-700 border-blue-200",
    badgeBg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
  },
  green: {
    bar: "bg-green-500",
    badge: "text-green-700 border-green-200",
    badgeBg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    iconBg: "bg-green-100",
    iconText: "text-green-600",
  },
  teal: {
    bar: "bg-teal-500",
    badge: "text-teal-700 border-teal-200",
    badgeBg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    iconBg: "bg-teal-100",
    iconText: "text-teal-600",
  },
  amber: {
    bar: "bg-amber-500",
    badge: "text-amber-700 border-amber-200",
    badgeBg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
  },
  purple: {
    bar: "bg-purple-500",
    badge: "text-purple-700 border-purple-200",
    badgeBg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    iconBg: "bg-purple-100",
    iconText: "text-purple-600",
  },
  orange: {
    bar: "bg-orange-500",
    badge: "text-orange-700 border-orange-200",
    badgeBg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    iconBg: "bg-orange-100",
    iconText: "text-orange-600",
  },
  pink: {
    bar: "bg-pink-500",
    badge: "text-pink-700 border-pink-200",
    badgeBg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    iconBg: "bg-pink-100",
    iconText: "text-pink-600",
  },
  red: {
    bar: "bg-red-500",
    badge: "text-red-700 border-red-200",
    badgeBg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    iconBg: "bg-red-100",
    iconText: "text-red-600",
  },
  indigo: {
    bar: "bg-indigo-500",
    badge: "text-indigo-700 border-indigo-200",
    badgeBg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-600",
  },
  cyan: {
    bar: "bg-cyan-500",
    badge: "text-cyan-700 border-cyan-200",
    badgeBg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    iconBg: "bg-cyan-100",
    iconText: "text-cyan-600",
  },
  violet: {
    bar: "bg-violet-500",
    badge: "text-violet-700 border-violet-200",
    badgeBg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    iconBg: "bg-violet-100",
    iconText: "text-violet-600",
  },
  yellow: {
    bar: "bg-yellow-500",
    badge: "text-yellow-700 border-yellow-200",
    badgeBg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    iconBg: "bg-yellow-100",
    iconText: "text-yellow-600",
  },
  rose: {
    bar: "bg-rose-500",
    badge: "text-rose-700 border-rose-200",
    badgeBg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
  },
};

// ─── Status Badge Configuration ──────────────────────────────────────────────

function StatusBadge({
  status,
  color,
}: {
  status: AgentStatus;
  color: AgentColor;
}) {
  const styles = COLOR_STYLES[color];

  if (status === "deferred") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-xs font-medium gap-1",
          styles.badge,
          styles.badgeBg
        )}
      >
        <Lock className="h-3 w-3" />
        Coming Soon
      </Badge>
    );
  }

  if (status === "pilot") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-xs font-medium gap-1",
          styles.badge,
          styles.badgeBg
        )}
      >
        <Plane className="h-3 w-3" />
        Pilot
      </Badge>
    );
  }

  // active
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium gap-1",
        styles.badge,
        styles.badgeBg
      )}
    >
      <CircleDot className="h-3 w-3" />
      Active
    </Badge>
  );
}

// ─── Compliance Badges ───────────────────────────────────────────────────────

function ComplianceBadges({ agent }: { agent: AgentPersona }) {
  const items: { icon: LucideIcon; label: string; variant: "clinical" | "qa" | "phi" }[] = [];

  if (agent.requiresClinicianReview) {
    items.push({
      icon: Eye,
      label: "Requires Clinician Review",
      variant: "clinical",
    });
  }
  if (agent.routedToQAOfficer) {
    items.push({
      icon: Shield,
      label: "Routed to QA Officer",
      variant: "qa",
    });
  }
  if (agent.accessesPhi) {
    items.push({
      icon: AlertTriangle,
      label: "PHI Access Logged",
      variant: "phi",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item) => (
        <Badge
          key={item.label}
          variant="outline"
          className={cn(
            "text-[10px] font-medium gap-1",
            item.variant === "clinical" &&
              "text-amber-700 border-amber-200 bg-amber-50",
            item.variant === "qa" && "text-blue-700 border-blue-200 bg-blue-50",
            item.variant === "phi" &&
              "text-red-700 border-red-200 bg-red-50"
          )}
        >
          <item.icon className="h-2.5 w-2.5" />
          {item.label}
        </Badge>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AgentPersonaIndicator({
  agentKey,
  showDetails: initialShowDetails = false,
  className,
}: AgentPersonaIndicatorProps) {
  const [isOpen, setIsOpen] = useState(initialShowDetails);
  const [showAllBoundaries, setShowAllBoundaries] = useState(false);

  const agent = AGENT_PERSONAS[agentKey.toLowerCase()];

  // Unknown agent fallback
  if (!agent) {
    return (
      <div
        className={cn(
          "w-full rounded-md border border-gray-200 bg-gray-50 px-4 py-3",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Cpu className="h-4 w-4" />
          <span className="font-medium">Unknown Agent:</span>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            {agentKey}
          </code>
        </div>
      </div>
    );
  }

  const styles = COLOR_STYLES[agent.color];
  const Icon = agent.icon;
  const isDeferred = agent.status === "deferred";

  // Show max 3 boundaries by default, all when expanded
  const visibleBoundaries =
    showAllBoundaries || isOpen
      ? agent.boundaries
      : agent.boundaries.slice(0, 3);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "w-full rounded-lg border shadow-sm overflow-hidden",
          styles.border,
          isDeferred ? "bg-gray-50/80 opacity-80" : "bg-white",
          className
        )}
      >
        {/* Top color bar */}
        <div className={cn("h-1 w-full", styles.bar)} />

        {/* Collapsible wrapper */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* ─── Header Row ───────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Agent icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    styles.iconBg,
                    styles.iconText
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs font-medium">{agent.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Key: {agent.key}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">
                  {agent.name}
                </span>
                <StatusBadge status={agent.status} color={agent.color} />
              </div>
              {!isOpen && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {agent.scope}
                </p>
              )}
            </div>

            {/* Collapsible toggle */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isDeferred && "cursor-not-allowed opacity-50"
                )}
                disabled={isDeferred}
                aria-label={isOpen ? "Collapse details" : "Expand details"}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
          </div>

          {/* ─── Expanded Details ─────────────────────────────────── */}
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {/* Divider */}
              <div className={cn("border-t", styles.border)} />

              {/* Scope */}
              <div>
                <h4
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-1",
                    styles.text
                  )}
                >
                  Scope
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {agent.scope}
                </p>
              </div>

              {/* Boundaries */}
              <div>
                <h4
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-1",
                    styles.text
                  )}
                >
                  Boundaries — This agent does NOT:
                </h4>
                <ul className="space-y-1">
                  {visibleBoundaries.map((boundary, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-gray-600"
                    >
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                          styles.bar
                        )}
                      />
                      <span className="leading-relaxed">{boundary}</span>
                    </li>
                  ))}
                </ul>
                {agent.boundaries.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllBoundaries(!showAllBoundaries)}
                    className={cn(
                      "mt-1.5 text-[11px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                      styles.text
                    )}
                  >
                    {showAllBoundaries
                      ? "Show less"
                      : `Show all ${agent.boundaries.length} boundaries`}
                  </button>
                )}
              </div>

              {/* Compliance badges */}
              <ComplianceBadges agent={agent} />

              {/* Human-in-command reminder */}
              <div className="flex items-start gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                <Shield className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  <span className="font-medium">Human-in-Command:</span> This
                  agent operates within defined boundaries. All clinical outputs
                  marked &quot;requires clinician review&quot; must be validated
                  by a licensed professional. All compliance outputs are routed
                  to the QA Officer. All PHI access is logged and auditable.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}

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

export default AgentPersonaIndicator;
