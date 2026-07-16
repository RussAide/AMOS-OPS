import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { prettyToken } from "./m41b-experience-model";

const POSITIVE = new Set(["approved", "completed", "current", "not_required"]);
const WARNING = new Set([
  "high",
  "pending",
  "pending_approval",
  "evidence_pending",
  "in_progress",
  "modified",
  "stale",
]);
const CRITICAL = new Set([
  "critical",
  "contradictory",
  "escalated",
  "missing",
  "refused",
  "rejected",
]);

export function M41bGovernanceBadge({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const Icon = POSITIVE.has(value)
    ? CheckCircle2
    : CRITICAL.has(value)
      ? ShieldAlert
      : WARNING.has(value)
        ? AlertTriangle
        : CircleDashed;

  return (
    <Badge
      className={cn(
        "gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        POSITIVE.has(value) &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        WARNING.has(value) && "border-amber-200 bg-amber-50 text-amber-900",
        CRITICAL.has(value) && "border-rose-200 bg-rose-50 text-rose-800",
        !POSITIVE.has(value) &&
          !WARNING.has(value) &&
          !CRITICAL.has(value) &&
          "border-slate-200 bg-slate-50 text-slate-700",
        className,
      )}
      variant="outline"
    >
      <Icon aria-hidden="true" className="size-3" />
      {label ?? prettyToken(value)}
    </Badge>
  );
}
