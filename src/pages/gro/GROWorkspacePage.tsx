/**
 * GROWorkspacePage.tsx
 * Residential Operations Workspace — connected to all 6 GRO features via tRPC
 * Navigation hub for Shift Logs, Safety Rounds, Care Logs, Incidents, Supervision, Handoffs
 */

import { useState } from "react";
import { PageLayout } from "@/components/shell/PageLayout";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  Clock, ShieldCheck, Heart, AlertTriangle, StickyNote,
  ClipboardSignature, CheckCircle2, AlertCircle, ChevronRight,
  RefreshCw, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FEATURE_CARDS = [
  {
    title: "Shift Logs",
    description: "Digital shift logs with timestamps",
    icon: Clock,
    path: "/gro/shift-logs",
    color: "bg-green-50 text-green-700 border-green-200",
    iconColor: "text-green-600",
    statKey: "shiftLogs" as const,
    statLabel: (d: any) => `${d?.active ?? 0} active`,
  },
  {
    title: "Safety Rounds",
    description: "Area-based safety inspection checklists",
    icon: ShieldCheck,
    path: "/gro/safety-rounds",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600",
    statKey: "safetyRounds" as const,
    statLabel: (d: any) => `${d?.completionRate ?? 0}% pass rate`,
  },
  {
    title: "Care Logs",
    description: "Per-resident care entries",
    icon: Heart,
    path: "/gro/care-logs",
    color: "bg-pink-50 text-pink-700 border-pink-200",
    iconColor: "text-pink-600",
    statKey: "youthCareLogs" as const,
    statLabel: (d: any) => `${d?.today ?? 0} today`,
  },
  {
    title: "Incident Reports",
    description: "Residential incident reporting",
    icon: AlertTriangle,
    path: "/gro/incidents",
    color: "bg-red-50 text-red-700 border-red-200",
    iconColor: "text-red-600",
    statKey: "incidents" as const,
    statLabel: (d: any) => `${d?.open ?? 0} open`,
  },
  {
    title: "Supervision",
    description: "Supervision notes and staff development",
    icon: StickyNote,
    path: "/gro/supervision",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    iconColor: "text-indigo-600",
    statKey: "supervisionNotes" as const,
    statLabel: (d: any) => `${d?.pendingAcknowledgment ?? 0} pending ack`,
  },
  {
    title: "Shift Handoffs",
    description: "End-of-shift summaries",
    icon: ClipboardSignature,
    path: "/gro/handoffs",
    color: "bg-teal-50 text-teal-700 border-teal-200",
    iconColor: "text-teal-600",
    statKey: "shiftHandoffs" as const,
    statLabel: (d: any) => `${d?.pending ?? 0} pending`,
  },
];

export default function GROWorkspacePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: dashboard, isLoading } = trpc.groResidential.residentialDashboard.useQuery();
  const { data: incidentDashboard } = trpc.groResidential.incidentDashboard.useQuery();
  const { data: safetyDashboard } = trpc.groResidential.safetyRoundDashboard.useQuery();

  const seedData = trpc.groResidential.seedResidentialData.useMutation({
    onSuccess: (d) => {
      utils.groResidential.residentialDashboard.invalidate();
      utils.groResidential.incidentDashboard.invalidate();
      utils.groResidential.safetyRoundDashboard.invalidate();
      toast.success(d.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const openIncidents = dashboard?.incidents?.open ?? 0;
  const criticalIncidents = dashboard?.incidents?.critical ?? 0;
  const safetyFollowUp = dashboard?.safetyRounds?.followUpNeeded ?? 0;
  const careFollowUp = dashboard?.youthCareLogs?.followUpNeeded ?? 0;

  return (
    <PageLayout category="Residential" title="GRO Residential Operations" subtitle="Comprehensive residential operations management">
      <div className="px-4 md:px-6 pt-4 pb-8 max-w-7xl mx-auto space-y-6">

        {/* Status Banner */}
        {(criticalIncidents > 0 || openIncidents > 0) && (
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm",
            criticalIncidents > 0 ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-800"
          )}>
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">
                {criticalIncidents > 0 ? `${criticalIncidents} Critical Incident${criticalIncidents > 1 ? "s" : ""} — ` : ""}
                {openIncidents} open incident{openIncidents !== 1 ? "s" : ""} requiring attention
              </span>
            </div>
            <Button size="sm" variant="outline" className={cn("text-xs h-7", criticalIncidents > 0 ? "border-red-300 text-red-700 hover:bg-red-100" : "border-amber-300 text-amber-700 hover:bg-amber-100")} onClick={() => navigate("/gro/incidents")}>
              View <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        )}

        {(safetyFollowUp > 0 || careFollowUp > 0) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">
                {safetyFollowUp > 0 ? `${safetyFollowUp} safety round${safetyFollowUp > 1 ? "s" : ""} need follow-up` : ""}
                {safetyFollowUp > 0 && careFollowUp > 0 ? " · " : ""}
                {careFollowUp > 0 ? `${careFollowUp} care log${careFollowUp > 1 ? "s" : ""} need follow-up` : ""}
              </span>
            </div>
            <div className="flex gap-1.5">
              {safetyFollowUp > 0 && <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => navigate("/gro/safety-rounds")}>Safety <ChevronRight className="h-3 w-3 ml-0.5" /></Button>}
              {careFollowUp > 0 && <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => navigate("/gro/care-logs")}>Care <ChevronRight className="h-3 w-3 ml-0.5" /></Button>}
            </div>
          </div>
        )}

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_CARDS.map((feature) => {
            const Icon = feature.icon;
            const statData = dashboard?.[feature.statKey];
            return (
              <Card
                key={feature.path}
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: feature.color.includes("green") ? "#22c55e" : feature.color.includes("blue") ? "#3b82f6" : feature.color.includes("pink") ? "#ec4899" : feature.color.includes("red") ? "#ef4444" : feature.color.includes("indigo") ? "#6366f1" : "#14b8a6" }}
                onClick={() => navigate(feature.path)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", feature.iconColor)} />
                      <CardTitle className="text-sm font-semibold">{feature.title}</CardTitle>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", feature.color)}>
                      {isLoading ? "..." : feature.statLabel(statData)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">{feature.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {statData?.total ?? 0} total records
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-500">Active Shifts</span>
              </div>
              <div className="text-lg font-bold text-green-700 mt-1">
                {isLoading ? <Skeleton className="h-6 w-12" /> : dashboard?.shiftLogs?.active ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-gray-500">Safety Today</span>
              </div>
              <div className="text-lg font-bold text-blue-700 mt-1">
                {isLoading ? <Skeleton className="h-6 w-12" /> : safetyDashboard?.todayRounds ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-gray-500">Open Incidents</span>
              </div>
              <div className="text-lg font-bold text-red-700 mt-1">
                {isLoading ? <Skeleton className="h-6 w-12" /> : incidentDashboard?.open ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ClipboardSignature className="h-4 w-4 text-teal-600" />
                <span className="text-xs text-gray-500">Pending Handoffs</span>
              </div>
              <div className="text-lg font-bold text-teal-700 mt-1">
                {isLoading ? <Skeleton className="h-6 w-12" /> : dashboard?.shiftHandoffs?.pending ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seed Data Button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => seedData.mutate()} disabled={seedData.isPending}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", seedData.isPending && "animate-spin")} />
            {seedData.isPending ? "Seeding..." : "Seed Demo Data"}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
