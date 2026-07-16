import {
  Building2,
  CheckCircle2,
  DollarSign,
  Link2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";
import {
  mayControlPhase3Demo,
  type Phase3Criterion,
} from "@contracts/phase3/shared";

type UnknownRow = Record<string, unknown>;

const MODULES = [
  {
    id: "M3.1",
    title: "Compliance & Audit",
    description:
      "Regulatory alerts, configurable audits, routed findings, CAP lifecycle, mock survey, and immutable evidence.",
    firstCriterion: "M3.1-01" as const,
    criteria: 7,
    icon: ShieldCheck,
  },
  {
    id: "M3.2",
    title: "Revenue Cycle",
    description:
      "Effective-dated rules, documentation-to-charge gates, full claim lifecycle, AR work queues, and service-code testing.",
    firstCriterion: "M3.2-01" as const,
    criteria: 8,
    icon: DollarSign,
  },
  {
    id: "M3.3",
    title: "Workforce",
    description:
      "Recruit-to-duty gates, credentials, alerts, performance, protected personnel records, training, and T1–T4 activation.",
    firstCriterion: "M3.3-01" as const,
    criteria: 8,
    icon: Users,
  },
  {
    id: "M3.4",
    title: "GAD Operations",
    description:
      "Three-stage campus controls, work orders, preventive maintenance, purchasing, inventory, drills, transport, and uptime.",
    firstCriterion: "M3.4-01" as const,
    criteria: 8,
    icon: Building2,
  },
] as const;

function asRows(value: unknown): UnknownRow[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is UnknownRow => typeof row === "object" && row !== null,
      )
    : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function prettyLabel(value: unknown) {
  return stringValue(value).replace(/_/g, " ").replace(/-/g, " ");
}

function snapshotPayload(row: UnknownRow | undefined): UnknownRow {
  const payload = row?.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as UnknownRow)
    : {};
}

function objectValue(value: unknown): UnknownRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRow)
    : {};
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function Phase3CorporateOperationsPage() {
  const { currentRole } = useAuth();
  const canControl = mayControlPhase3Demo(currentRole);
  const [selectedCriterion, setSelectedCriterion] =
    useState<Phase3Criterion>("M3.1-01");
  const overview = trpc.phase3.overview.useQuery(undefined);
  const featureCatalog = trpc.phase3.featureCatalog.useQuery(undefined);
  const runDemo = trpc.phase3.runDemo.useMutation({
    onSuccess: () => void overview.refetch(),
  });
  const resetDemo = trpc.phase3.resetDemo.useMutation({
    onSuccess: () => void overview.refetch(),
  });
  const evaluateComponent = trpc.phase3.evaluateComponent.useMutation();
  const setKillSwitch = trpc.phase3.setKillSwitch.useMutation({
    onSuccess: () => void overview.refetch(),
  });
  const recordAccessReview = trpc.phase3.recordAccessReview.useMutation({
    onSuccess: () => void overview.refetch(),
  });
  const data = overview.data;
  const snapshots = asRows(data?.snapshots);
  const workItems = asRows(data?.workItems);
  const links = asRows(data?.links);
  const scenarios = asRows(data?.scenarios);
  const demoControl =
    data?.demoControl && typeof data.demoControl === "object"
      ? (data.demoControl as UnknownRow)
      : undefined;

  const modules = MODULES.map((module) => {
    const snapshot = snapshots.find((row) => row.milestone === module.id);
    const payload = snapshotPayload(snapshot);
    const criteria = asRows(payload.criteria);
    return {
      ...module,
      passed: payload.passed === true,
      passedCriteria: criteria.filter((criterion) => criterion.passed === true)
        .length,
    };
  });
  const passedCriteria = modules.reduce(
    (total, module) => total + module.passedCriteria,
    0,
  );
  const completedModules = modules.filter((module) => module.passed).length;
  const completedWork = workItems.filter(
    (item) => item.status === "completed",
  ).length;
  const exitRun = scenarios.find(
    (scenario) => scenario.milestone === "PHASE3_EXIT",
  );
  const exitPassed = exitRun?.status === "passed";
  const productionBlocked =
    demoControl?.production_writes_blocked === 1 ||
    demoControl?.production_writes_blocked === true;
  const killSwitchEnabled =
    demoControl?.kill_switch_enabled === 1 ||
    demoControl?.kill_switch_enabled === true;
  const busy =
    overview.isFetching ||
    runDemo.isPending ||
    resetDemo.isPending ||
    evaluateComponent.isPending ||
    setKillSwitch.isPending ||
    recordAccessReview.isPending;

  const moduleSnapshot = (milestone: string) => {
    const payload = snapshotPayload(
      snapshots.find((row) => row.milestone === milestone),
    );
    return objectValue(payload.snapshot);
  };
  const revenueSnapshot = moduleSnapshot("M3.2");
  const revenueMetrics = asRows(revenueSnapshot.metrics);
  const cleanClaim = revenueMetrics.find(
    (metric) => metric.name === "clean_claim_rate",
  );
  const daysInAr = revenueMetrics.find(
    (metric) => metric.name === "days_in_ar",
  );
  const workforceSnapshot = moduleSnapshot("M3.3");
  const annualTraining = asRows(workforceSnapshot.annualTraining);
  const trainingHours = annualTraining.map((summary) =>
    numberValue(summary.completedHours),
  );
  const gadSnapshot = moduleSnapshot("M3.4");
  const uptime = objectValue(gadSnapshot.uptime);
  const metrics = [
    {
      label: "Days in AR",
      target: "< 40 days",
      value: daysInAr ? `${numberValue(daysInAr.value).toFixed(2)} days` : "—",
      detail: daysInAr
        ? `${numberValue(daysInAr.numerator).toLocaleString()} ÷ ${numberValue(daysInAr.denominator).toLocaleString()} · ${asRows(daysInAr.sourceRecordIds).length || (Array.isArray(daysInAr.sourceRecordIds) ? daysInAr.sourceRecordIds.length : 0)} sources`
        : "Run the integrated evaluation",
      passed: daysInAr?.passed === true,
    },
    {
      label: "Clean claim rate",
      target: "> 95%",
      value: cleanClaim ? `${numberValue(cleanClaim.value).toFixed(2)}%` : "—",
      detail: cleanClaim
        ? `${numberValue(cleanClaim.numerator)} accepted ÷ ${numberValue(cleanClaim.denominator)} submissions`
        : "Run the integrated evaluation",
      passed: cleanClaim?.passed === true,
    },
    {
      label: "Credentialing cycle",
      target: "< 30 days",
      value:
        workforceSnapshot.credentialingDurationDays !== undefined
          ? `${numberValue(workforceSnapshot.credentialingDurationDays)} days`
          : "—",
      detail: objectValue(workforceSnapshot.credentialingCycle).id
        ? "Verified-complete packet to final approval"
        : "Run the integrated evaluation",
      passed: numberValue(workforceSnapshot.credentialingDurationDays, 999) < 30,
    },
    {
      label: "Annual training",
      target: "≥ 40 hours",
      value:
        trainingHours.length > 0
          ? `${Math.min(...trainingHours).toFixed(1)}+ hours`
          : "—",
      detail:
        trainingHours.length > 0
          ? `${trainingHours.length} canonical T1–T4 personas; exclusions applied`
          : "Run the integrated evaluation",
      passed:
        trainingHours.length === 4 && trainingHours.every((hours) => hours >= 40),
    },
    {
      label: "Facility uptime",
      target: "> 99%",
      value:
        uptime.uptimePercent !== undefined
          ? `${numberValue(uptime.uptimePercent).toFixed(3)}%`
          : "—",
      detail:
        uptime.scheduledMinutes !== undefined
          ? `${numberValue(uptime.scheduledMinutes).toLocaleString()} scheduled min · ${numberValue(uptime.qualifyingDowntimeMinutes)} unplanned min`
          : "Run the integrated evaluation",
      passed: uptime.passed === true,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-300 text-slate-950 hover:bg-amber-300">
                AMOS-OPS · Phase 3
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
              >
                DEMO - NOT FOR CARE DELIVERY
              </Badge>
              <Badge
                variant="outline"
                className="border-white/20 text-slate-100"
              >
                Production writes blocked
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Corporate Operations Control Center
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              One guided demonstration across compliance, revenue, workforce,
              and GAD operations—linked to the accepted youth-continuum episode
              with shared work, audit, and evidence lineage.
            </p>
            <p className="mt-2 text-xs font-medium text-amber-200">
              Environment: AMOS-OPS-PHASE3-EVALUATION · Current persona: {currentRole}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => runDemo.mutate()}
              disabled={busy || !canControl || killSwitchEnabled}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Run integrated demo
            </Button>
            <Button
              variant="outline"
              className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() =>
                resetDemo.mutate({
                  confirmation: "RESET_PHASE3_SYNTHETIC_DATA",
                })
              }
              disabled={busy || !canControl}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            {canControl && (
              <Button
                variant="outline"
                className="border-amber-300/50 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20 hover:text-white"
                onClick={() =>
                  setKillSwitch.mutate({ enabled: !killSwitchEnabled })
                }
                disabled={busy}
              >
                {killSwitchEnabled ? "Release kill switch" : "Engage kill switch"}
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => void overview.refetch()}
              disabled={busy}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${overview.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
        {!canControl && (
          <p className="mt-4 rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
            This persona has read-only evaluation access. Select an authorized
            Phase 3 control persona to run, reset, or evaluate components.
          </p>
        )}
      </section>

      {(runDemo.error ||
        resetDemo.error ||
        evaluateComponent.error ||
        setKillSwitch.error ||
        recordAccessReview.error ||
        featureCatalog.error ||
        overview.error) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-800">
            {runDemo.error?.message ??
              resetDemo.error?.message ??
              evaluateComponent.error?.message ??
              setKillSwitch.error?.message ??
              recordAccessReview.error?.message ??
              featureCatalog.error?.message ??
              overview.error?.message}
          </CardContent>
        </Card>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Phase 3 status summary"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Milestones complete</CardDescription>
            <CardTitle className="text-3xl">{completedModules}/4</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={completedModules * 25} />
            <p className="mt-2 text-xs text-muted-foreground">
              M3.1 through M3.4
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Criteria passed</CardDescription>
            <CardTitle className="text-3xl">{passedCriteria}/31</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(passedCriteria / 31) * 100} />
            <p className="mt-2 text-xs text-muted-foreground">
              Controlling checklist criteria
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Shared work complete</CardDescription>
            <CardTitle className="text-3xl">
              {completedWork}/{workItems.length || 4}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(completedWork / (workItems.length || 4)) * 100} />
            <p className="mt-2 text-xs text-muted-foreground">
              One queue across four domains
            </p>
          </CardContent>
        </Card>
        <Card
          className={exitPassed ? "border-emerald-200 bg-emerald-50/60" : ""}
        >
          <CardHeader className="pb-2">
            <CardDescription>Phase exit gate</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              {exitPassed ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  Passed
                </>
              ) : (
                "Ready to evaluate"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {productionBlocked
                ? "Synthetic boundary active; live actions disabled."
                : "Loading demo boundary status."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <Card
            key={module.id}
            className={module.passed ? "border-emerald-200" : ""}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <module.icon className="h-6 w-6 text-emerald-700" />
                <Badge variant={module.passed ? "default" : "outline"}>
                  {module.id}
                </Badge>
              </div>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span>Acceptance criteria</span>
                  <span>
                    {module.passedCriteria}/{module.criteria}
                  </span>
                </div>
                <Progress
                  value={(module.passedCriteria / module.criteria) * 100}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedCriterion(module.firstCriterion);
                  document
                    .getElementById("phase3-feature-evaluator")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Evaluate module features
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Cross-enterprise support chain</CardTitle>
            <CardDescription>
              Operational support remains linked to the same synthetic
              youth-continuum episode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Initialize or run the demo to create the four controlled
                  support links.
                </p>
              ) : (
                links.map((link) => (
                  <div
                    key={stringValue(link.id)}
                    className="rounded-lg border p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">
                        {stringValue(link.domain)}
                      </Badge>
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {prettyLabel(link.source_type)} →{" "}
                      {prettyLabel(link.target_type)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Relation: {stringValue(link.relation)} · Source division:{" "}
                      {stringValue(link.source_division)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controlled metric tests</CardTitle>
            <CardDescription>
              Strict Phase 3 operators; internal prototype thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.map((metric) => {
              return (
                <div
                  key={metric.label}
                  className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Target {metric.target}
                    </p>
                    <p className="mt-1 text-xs font-semibold">{metric.value}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {metric.detail}
                    </p>
                  </div>
                  <Badge variant={metric.passed ? "default" : "outline"}>
                    {metric.passed ? "Validated" : "Pending"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card id="phase3-feature-evaluator">
        <CardHeader>
          <CardTitle>Feature and component evaluator</CardTitle>
          <CardDescription>
            Run any one of the 31 controlling Phase 3 feature scenarios and
            inspect its actual result without invoking a live external action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-sm font-medium">
              Feature scenario
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedCriterion}
                onChange={(event) =>
                  setSelectedCriterion(event.target.value as Phase3Criterion)
                }
              >
                {(featureCatalog.data ?? []).map((feature) => (
                  <option key={feature.criterionId} value={feature.criterionId}>
                    {feature.criterionId} · {feature.summary}
                  </option>
                ))}
                {(featureCatalog.data?.length ?? 0) === 0 && (
                  <option value={selectedCriterion}>{selectedCriterion}</option>
                )}
              </select>
            </label>
            <Button
              onClick={() =>
                evaluateComponent.mutate({ criterionId: selectedCriterion })
              }
              disabled={busy || !canControl || killSwitchEnabled}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Evaluate selected feature
            </Button>
            <Button
              variant="outline"
              onClick={() => recordAccessReview.mutate()}
              disabled={busy || !canControl}
            >
              Record persona access review
            </Button>
          </div>
          {evaluateComponent.data && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {evaluateComponent.data.feature.criterionId} · {" "}
                    {evaluateComponent.data.feature.summary}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scenario {evaluateComponent.data.feature.scenarioId} ·
                    expected pass · actual {evaluateComponent.data.feature.actualResult}
                  </p>
                </div>
                <Badge>
                  {evaluateComponent.data.feature.actualResult === "pass"
                    ? "Passed"
                    : "Failed"}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Evidence: {evaluateComponent.data.feature.evidenceIds.join(", ")}
              </p>
            </div>
          )}
          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="font-semibold">Kill switch</p>
              <p className="mt-1 text-muted-foreground">
                {killSwitchEnabled ? "Engaged — scenario runs blocked" : "Released"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">Synthetic data expiration</p>
              <p className="mt-1 text-muted-foreground">
                {stringValue(demoControl?.data_expires_at, "Loading")}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold">Last persona access review</p>
              <p className="mt-1 text-muted-foreground">
                {stringValue(demoControl?.access_reviewed_at, "Loading")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shared work and evidence queue</CardTitle>
          <CardDescription>
            Each domain owns one nonduplicative work item with evidence attached
            to the same support case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workItems.map((item) => (
              <div key={stringValue(item.id)} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="outline">{stringValue(item.domain)}</Badge>
                  <Badge
                    variant={
                      item.status === "completed" ? "default" : "secondary"
                    }
                  >
                    {prettyLabel(item.status)}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{stringValue(item.title)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Owner: {prettyLabel(item.assigned_role)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Phase3CorporateOperationsPage;
