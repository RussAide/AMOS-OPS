import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  EyeOff,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  prettyToken,
  type M41aDataQualityState,
  type M41aMetricStatus,
} from "./m41a-model";

type StatusValue = M41aMetricStatus | M41aDataQualityState | string;

const STATUS_STYLES: Record<
  string,
  { className: string; icon: typeof CheckCircle2 }
> = {
  on_target: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  pass: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  current: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  good: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  at_risk: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  stale: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  off_target: {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
  fail: {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
  missing: {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
  conflicting: {
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: AlertTriangle,
  },
  contradictory: {
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: AlertTriangle,
  },
  suppressed: {
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: EyeOff,
  },
  not_measured: {
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: CircleHelp,
  },
  unknown: {
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: CircleHelp,
  },
  open: {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: AlertTriangle,
  },
  acknowledged: {
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: CheckCircle2,
  },
  assigned: {
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: CheckCircle2,
  },
  decision_recorded: {
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: CheckCircle2,
  },
  evidence_added: {
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    icon: CheckCircle2,
  },
  resolved: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  decided: {
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: CheckCircle2,
  },
  evidence_pending: {
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    icon: Clock3,
  },
  critical: {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
  urgent: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  advisory: {
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: CircleHelp,
  },
};

export function M41aStatusPill({
  value,
  label,
  className,
}: {
  value: StatusValue;
  label?: string;
  className?: string;
}) {
  const normalized = value.toLowerCase();
  const style = STATUS_STYLES[normalized] ?? STATUS_STYLES.unknown;
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        style.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label ?? prettyToken(value)}
    </span>
  );
}
