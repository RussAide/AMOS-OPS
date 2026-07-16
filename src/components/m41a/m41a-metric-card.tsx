import {
  ArrowRight,
  CalendarClock,
  Database,
  Gauge,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTimestamp, type M41aMetricView } from "./m41a-model";
import { M41aStatusPill } from "./m41a-status-pill";

function MetadataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-[11px] leading-4">
      <Icon aria-hidden="true" className="mt-0.5 size-3.5 text-slate-400" />
      <div className="min-w-0">
        <span className="font-semibold text-slate-600">{label}: </span>
        <span className="break-words text-slate-700">{value}</span>
      </div>
    </div>
  );
}

export function M41aMetricCard({
  metric,
  selected,
  onInspect,
}: {
  metric: M41aMetricView;
  selected: boolean;
  onInspect: (metric: M41aMetricView) => void;
}) {
  return (
    <Card
      data-testid={`m41a-metric-${metric.id}`}
      className={cn(
        "gap-4 overflow-hidden py-0 transition-shadow",
        selected && "border-teal-500 shadow-md ring-2 ring-teal-500/15",
      )}
    >
      <div
        className={cn(
          "h-1.5",
          metric.status === "on_target" && "bg-emerald-500",
          metric.status === "at_risk" && "bg-amber-500",
          metric.status === "off_target" && "bg-rose-500",
          metric.status === "suppressed" && "bg-slate-400",
          (metric.status === "not_measured" || metric.status === "unknown") &&
            "bg-slate-300",
        )}
      />
      <CardHeader className="gap-3 px-5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-teal-700">
              {metric.category}
            </p>
            <CardTitle className="text-sm leading-5 text-slate-900">
              {metric.title}
            </CardTitle>
          </div>
          <M41aStatusPill value={metric.status} />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-slate-950">
            {metric.formattedValue}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <M41aStatusPill
              value={metric.dataQualityState}
              label={`DQ · ${metric.dataQualityLabel}`}
            />
            <span className="text-[10px] text-slate-500">
              {metric.varianceLabel}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-5 pb-1">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Definition
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-700">
            {metric.definition}
          </p>
        </div>
        <div className="space-y-2">
          <MetadataRow
            icon={Database}
            label="Source"
            value={`${metric.sourceLabel} · ${metric.sourceRecordIds.length} linked record${metric.sourceRecordIds.length === 1 ? "" : "s"}`}
          />
          <MetadataRow icon={UserRound} label="Owner" value={metric.ownerLabel} />
          <MetadataRow
            icon={CalendarClock}
            label="Refresh"
            value={`${metric.refreshLabel} · ${formatTimestamp(metric.refreshedAt)}`}
          />
          <MetadataRow icon={Target} label="Target" value={metric.targetLabel} />
          <MetadataRow
            icon={Gauge}
            label="Variance"
            value={metric.varianceLabel}
          />
          <MetadataRow
            icon={ShieldCheck}
            label="Quality"
            value={
              metric.dataQualityReasons.length > 0
                ? `${metric.dataQualityLabel} · ${metric.dataQualityReasons.join("; ")}`
                : metric.dataQualityLabel
            }
          />
        </div>
        {metric.disclosure ? (
          <p className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[10px] leading-4 text-slate-600">
            {metric.disclosure}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="border-t bg-slate-50/80 px-5 py-3">
        <Button
          className="w-full justify-between"
          disabled={!metric.drilldownAvailable}
          onClick={() => onInspect(metric)}
          size="sm"
          variant={selected ? "default" : "outline"}
        >
          <span>
            {metric.drilldownAvailable
              ? "Inspect governed detail"
              : "Supporting detail unavailable"}
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            Step 1 of 3
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </span>
        </Button>
      </CardFooter>
    </Card>
  );
}
