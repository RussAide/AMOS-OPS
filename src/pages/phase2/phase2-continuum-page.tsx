import { ArrowRight, BedDouble, BriefcaseMedical, HeartHandshake, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Phase2AlertPanel,
  Phase2AuditTimeline,
  Phase2BillingReadinessPanel,
  Phase2CareLineagePanel,
  Phase2WorkQueuePanel,
} from "@/components/phase2";
import { trpc } from "@/providers/trpc";
import type { Phase2Alert, Phase2AuditEvent, Phase2CareLink, Phase2ClaimHandoff, Phase2WorkItem } from "@contracts/phase2";

type UnknownRow = Record<string, unknown>;
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" ? value : fallback;

function normalizeWork(row: UnknownRow): Phase2WorkItem {
  return {
    id: stringValue(row.id), episodeId: stringValue(row.episode_id), domain: stringValue(row.domain) as Phase2WorkItem["domain"],
    title: stringValue(row.title), sourceType: stringValue(row.source_type), sourceId: stringValue(row.source_id),
    status: stringValue(row.status) as Phase2WorkItem["status"], priority: stringValue(row.priority) as Phase2WorkItem["priority"],
    assignedRole: stringValue(row.assigned_role), assignedTo: stringValue(row.assigned_to) || undefined,
    dueAt: stringValue(row.due_at), escalationLevel: stringValue(row.escalation_level) as Phase2WorkItem["escalationLevel"],
    escalatedAt: stringValue(row.escalated_at) || undefined, escalationReason: stringValue(row.escalation_reason) || undefined,
    exceptionCode: stringValue(row.exception_code) || undefined, exceptionReason: stringValue(row.exception_reason) || undefined,
    version: numberValue(row.version, 1), createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at),
  };
}

function normalizeAlert(row: UnknownRow): Phase2Alert {
  return {
    id: stringValue(row.id), episodeId: stringValue(row.episode_id), domain: stringValue(row.domain) as Phase2Alert["domain"],
    alertType: stringValue(row.alert_type), sourceType: stringValue(row.source_type), sourceId: stringValue(row.source_id),
    title: stringValue(row.title), status: stringValue(row.status) as Phase2Alert["status"],
    priority: stringValue(row.priority) as Phase2Alert["priority"], dueAt: stringValue(row.due_at),
    assignedRole: stringValue(row.assigned_role), assignedTo: stringValue(row.assigned_to) || undefined,
    escalationLevel: stringValue(row.escalation_level) as Phase2Alert["escalationLevel"],
    acknowledgedAt: stringValue(row.acknowledged_at) || undefined, resolvedAt: stringValue(row.resolved_at) || undefined,
    createdAt: stringValue(row.created_at),
  };
}

function normalizeLink(row: UnknownRow): Phase2CareLink {
  return {
    episodeId: stringValue(row.episode_id), caseId: stringValue(row.case_id),
    sourceDomain: stringValue(row.source_domain) as Phase2CareLink["sourceDomain"], sourceType: stringValue(row.source_type),
    sourceId: stringValue(row.source_id), sourceVersion: numberValue(row.source_version, 1),
    targetDomain: stringValue(row.target_domain) as Phase2CareLink["targetDomain"], targetType: stringValue(row.target_type),
    targetId: stringValue(row.target_id), targetVersion: numberValue(row.target_version, 1),
    relation: stringValue(row.relation) as Phase2CareLink["relation"], evidenceClass: "synthetic_demo",
    createdAt: stringValue(row.created_at),
  };
}

function normalizeClaim(row: UnknownRow): Phase2ClaimHandoff {
  return {
    id: stringValue(row.id), episodeId: stringValue(row.episode_id), program: stringValue(row.program) as Phase2ClaimHandoff["program"],
    encounterId: stringValue(row.encounter_id), procedureCode: stringValue(row.procedure_code) as Phase2ClaimHandoff["procedureCode"],
    status: stringValue(row.status) as Phase2ClaimHandoff["status"],
    findings: Array.isArray(row.findings) ? row.findings as Phase2ClaimHandoff["findings"] : [],
    evaluatorVersion: stringValue(row.evaluator_version), decidedAt: stringValue(row.decided_at),
    handedOffAt: stringValue(row.handed_off_at) || undefined, correlationId: stringValue(row.correlation_id),
    evidenceClass: "synthetic_demo",
  };
}

function normalizeAudit(row: UnknownRow): Phase2AuditEvent {
  return {
    id: stringValue(row.id), episodeId: stringValue(row.episode_id) || undefined,
    domain: stringValue(row.domain) as Phase2AuditEvent["domain"], eventType: stringValue(row.event_type) as Phase2AuditEvent["eventType"],
    action: stringValue(row.action), entityType: stringValue(row.entity_type), entityId: stringValue(row.entity_id),
    actorId: stringValue(row.actor_id), actorRole: stringValue(row.actor_role), reason: stringValue(row.reason),
    before: row.before && typeof row.before === "object" ? row.before as Record<string, unknown> : undefined,
    after: row.after && typeof row.after === "object" ? row.after as Record<string, unknown> : undefined,
    changedFields: Array.isArray(row.changedFields) ? row.changedFields.filter((value): value is string => typeof value === "string") : [],
    correlationId: stringValue(row.correlation_id), evidenceClass: "synthetic_demo", occurredAt: stringValue(row.occurred_at),
  };
}

const MODULES = [
  { id: "M2.2", title: "MHTCM Case Management", description: "Six-function lifecycle, T1017 controls, discharge, aftercare, and authorization renewal.", href: "/mhtcm", icon: HeartHandshake },
  { id: "M2.3", title: "MHRS Service Delivery", description: "Four governed service workflows, plan lineage, 90-day review, and claim handoff.", href: "/mhrs", icon: BriefcaseMedical },
  { id: "M2.4", title: "GRO Residential Operations", description: "Census, staffing, shifts, MAR, incidents, rights, and continuity across every shift.", href: "/gro/residential-operations", icon: BedDouble },
] as const;

export function Phase2ContinuumPage() {
  const overview = trpc.phase2.overview.useQuery(undefined);
  const seed = trpc.phase2.seedDemo.useMutation({ onSuccess: () => void overview.refetch() });
  const data = overview.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2"><Badge variant="outline">Phase 2</Badge><Badge className="bg-violet-100 text-violet-800">Synthetic evaluation mode</Badge></div><h1 className="text-3xl font-bold tracking-tight">Youth Continuum Operations Hub</h1><p className="mt-2 max-w-3xl text-muted-foreground">One guided operating experience across CCMG, MHTCM, MHRS, and GRO, with department ownership, time controls, billing gates, and audit lineage preserved.</p></div>
        <Button variant="outline" onClick={() => void overview.refetch()} disabled={overview.isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {MODULES.map((module) => <Card key={module.id} className="border-violet-100"><CardHeader><div className="flex items-center justify-between"><module.icon className="h-6 w-6 text-violet-700" /><Badge variant="outline">{module.id}</Badge></div><CardTitle>{module.title}</CardTitle><CardDescription>{module.description}</CardDescription></CardHeader><CardContent><Button asChild className="w-full"><Link to={module.href}>Open workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>)}
      </div>

      {!data?.initialized ? <Card><CardHeader><CardTitle>Initialize the controlled demo</CardTitle><CardDescription>Create the shared synthetic care episode and cross-program lineage. No real data is used.</CardDescription></CardHeader><CardContent><Button onClick={() => seed.mutate()} disabled={seed.isPending}><ShieldCheck className="mr-2 h-4 w-4" />Initialize demo episode</Button></CardContent></Card> : (
        <>
          <div className="grid gap-4 xl:grid-cols-2"><Phase2WorkQueuePanel items={(data.workItems as UnknownRow[]).map(normalizeWork)} /><Phase2AlertPanel alerts={(data.alerts as UnknownRow[]).map(normalizeAlert)} /></div>
          <div className="grid gap-4 xl:grid-cols-2"><Phase2CareLineagePanel links={(data.links as UnknownRow[]).map(normalizeLink)} /><Phase2BillingReadinessPanel handoffs={(data.claimHandoffs as UnknownRow[]).map(normalizeClaim)} /></div>
          <Phase2AuditTimeline events={(data.auditEvents as UnknownRow[]).map(normalizeAudit)} />
        </>
      )}
    </div>
  );
}

export default Phase2ContinuumPage;
