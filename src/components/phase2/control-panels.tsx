import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Phase2Alert,
  Phase2AuditEvent,
  Phase2CareLink,
  Phase2ClaimHandoff,
  Phase2WorkItem,
} from "@contracts/phase2";

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const className = normalized.includes("blocked") || normalized.includes("overdue") || normalized.includes("critical")
    ? "border-red-200 bg-red-50 text-red-700"
    : normalized.includes("complete") || normalized.includes("ready") || normalized.includes("resolved")
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return <Badge variant="outline" className={className}>{value.replace(/_/g, " ")}</Badge>;
}

export function Phase2WorkQueuePanel({ items }: { items: readonly Phase2WorkItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Assigned work</CardTitle>
        <CardDescription>One cross-program view; ownership remains with the assigned department.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No assigned work.</p> : items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.domain} · {item.assignedRole} · due {item.dueAt}</p></div>
            <StatusBadge value={item.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Phase2AlertPanel({ alerts }: { alerts: readonly Phase2Alert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alerts and escalation</CardTitle>
        <CardDescription>Time-controlled review, authorization, safety, and capacity signals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">No open alerts.</p> : alerts.map((alert) => (
          <div key={alert.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div><p className="font-medium">{alert.title}</p><p className="text-xs text-muted-foreground">{alert.domain} · {alert.escalationLevel} · due {alert.dueAt}</p></div>
            <StatusBadge value={alert.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Phase2CareLineagePanel({ links }: { links: readonly Phase2CareLink[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ArrowRight className="h-4 w-4" /> Care lineage</CardTitle>
        <CardDescription>Version-exact references without collapsing departmental records.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.length === 0 ? <p className="text-sm text-muted-foreground">No lineage links.</p> : links.map((link) => (
          <div key={`${link.sourceDomain}-${link.sourceId}-${link.targetDomain}-${link.targetId}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border p-3 text-sm">
            <div><p className="font-medium">{link.sourceDomain}</p><p className="text-xs text-muted-foreground">{link.sourceType} v{link.sourceVersion}</p></div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div><p className="font-medium">{link.targetDomain}</p><p className="text-xs text-muted-foreground">{link.targetType} v{link.targetVersion}</p></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Phase2BillingReadinessPanel({ handoffs }: { handoffs: readonly Phase2ClaimHandoff[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Billing readiness</CardTitle>
        <CardDescription>Fail-closed clinical evidence decisions and minimum-necessary revenue handoff.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {handoffs.length === 0 ? <p className="text-sm text-muted-foreground">No claim handoff decisions.</p> : handoffs.map((handoff) => (
          <div key={handoff.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4"><p className="font-medium">{handoff.procedureCode} · {handoff.encounterId}</p><StatusBadge value={handoff.status} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{handoff.findings.length === 0 ? "All configured controls passed." : handoff.findings.map((finding) => finding.code).join(", ")}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Phase2AuditTimeline({ events }: { events: readonly Phase2AuditEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Audit timeline</CardTitle>
        <CardDescription>Immutable, correlated material events with actor and reason.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No audited events.</p> : events.map((event) => (
          <div key={event.id} className="flex gap-3 rounded-lg border p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div><p className="font-medium">{event.action.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{event.domain} · {event.actorRole} · {event.occurredAt}</p><p className="mt-1 text-sm">{event.reason}</p></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
