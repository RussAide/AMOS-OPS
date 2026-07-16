/**
 * AgentPersonaIndicator.tsx
 *
 * Displays the active AMOS agent persona for the current workspace.
 * Shows agent name, scope, boundaries, and status.
 *
 * Tech: React 19, TypeScript 5.9, Tailwind 3.4, shadcn/ui, lucide-react
 */

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
  ChevronDown,
  ChevronUp,
  Lock,
  Plane,
  CircleDot,
  Shield,
  AlertTriangle,
  Cpu,
  Eye,
  type LucideIcon,
} from "lucide-react";
import {
  AGENT_PERSONAS,
  type AgentColor,
  type AgentPersona,
  type AgentPersonaIndicatorProps,
  type AgentStatus,
} from "./agent-personas";

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


export default AgentPersonaIndicator;
