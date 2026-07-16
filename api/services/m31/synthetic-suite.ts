import { M31_CRITERIA, type M31ModuleResult } from "@contracts/phase3/m31";
import {
  buildM31AuditLedger,
  buildM31SyntheticSnapshot,
  areM31AuditEventsImmutable,
} from "./engine";

const REQUIRED_AUDIT_ACTIONS = [
  "access",
  "change",
  "approval",
  "disclosure",
  "export",
  "administrative_action",
] as const;

export function runM31SyntheticSuite(): M31ModuleResult {
  const snapshot = buildM31SyntheticSnapshot();
  const auditEvents = buildM31AuditLedger();
  const closedCap = snapshot.correctiveActionPlans.find(
    (cap) => cap.status === "closed",
  );
  const survey = snapshot.mockSurveys[0];
  const enterpriseRisk = snapshot.riskViews.find(
    (view) => view.scope === "enterprise",
  );
  const auditActions = new Set(auditEvents.map((event) => event.action));

  const criteria = [
    {
      criterionId: "M3.1-01" as const,
      passed:
        new Set(snapshot.alerts.map((alert) => alert.windowDays)).size === 3 &&
        snapshot.alerts.every((alert) =>
          Boolean(alert.assignedRole && alert.assignedTo),
        ) &&
        snapshot.alerts.some((alert) => Boolean(alert.acknowledgedAt)) &&
        snapshot.alerts.some((alert) =>
          Boolean(alert.escalatedAt && alert.escalationRole),
        ) &&
        snapshot.alerts.some(
          (alert) =>
            alert.status === "closed" && alert.closureEvidenceIds.length > 0,
        ),
      summary:
        "The calendar executes assigned 90/60/30 alerts with acknowledgement, escalation, and closure evidence.",
      evidence: {
        eventIds: snapshot.calendarEvents.map((item) => item.id),
        alertIds: snapshot.alerts.map((item) => item.id),
      },
    },
    {
      criterionId: "M3.1-02" as const,
      passed:
        new Set(snapshot.auditTemplates.map((template) => template.category))
          .size === 6 &&
        snapshot.auditTemplates.every(
          (template) => template.configurable && template.controls.length >= 2,
        ),
      summary:
        "Six configurable audit instruments cover chart, personnel, facility, billing, privacy, and operations.",
      evidence: {
        templateIds: snapshot.auditTemplates.map((item) => item.id),
        categories: snapshot.auditTemplates.map((item) => item.category),
      },
    },
    {
      criterionId: "M3.1-03" as const,
      passed:
        snapshot.findings.length >= 3 &&
        snapshot.findings.every((finding) =>
          Boolean(
            finding.division &&
            finding.severity &&
            finding.responsibleRole &&
            finding.dueAt &&
            finding.escalationPath.length,
          ),
        ),
      summary:
        "Every finding is automatically routed by division and severity to an owner, due date, and escalation path.",
      evidence: {
        routes: snapshot.findings.map(
          ({
            id,
            division,
            severity,
            responsibleRole,
            dueAt,
            escalationPath,
          }) => ({
            id,
            division,
            severity,
            responsibleRole,
            dueAt,
            escalationPath,
          }),
        ),
      },
    },
    {
      criterionId: "M3.1-04" as const,
      passed: Boolean(
        closedCap &&
        closedCap.rootCause &&
        closedCap.tasks.length &&
        closedCap.tasks.every(
          (task) => task.status === "completed" && task.evidenceIds.length,
        ) &&
        closedCap.evidenceIds.length &&
        closedCap.verification?.outcome === "verified" &&
        closedCap.effectivenessReview?.outcome === "effective" &&
        closedCap.closureApproval?.outcome === "approved" &&
        new Set([
          closedCap.ownerId,
          closedCap.verification.actorId,
          closedCap.closureApproval.actorId,
        ]).size === 3,
      ),
      summary:
        "A representative CAP completes root cause, assigned tasks, evidence, independent verification, effectiveness review, and authorized closure.",
      evidence: {
        capId: closedCap?.id,
        findingId: closedCap?.findingId,
        closureEvidenceIds: closedCap?.evidenceIds ?? [],
      },
    },
    {
      criterionId: "M3.1-05" as const,
      passed: Boolean(
        survey &&
        survey.status === "completed" &&
        survey.evidenceRequests.length &&
        survey.evidenceRequests.every(
          (request) =>
            request.status === "fulfilled" && request.evidenceIds.length,
        ) &&
        survey.interviews.length &&
        survey.samples.length &&
        survey.samples.every(
          (sample) => sample.selectedRecordIds.length === sample.sampleSize,
        ) &&
        survey.deficiencyFindingIds.length &&
        survey.readinessScore >= 90 &&
        survey.reportEvidenceId,
      ),
      summary:
        "The mock survey completes planning, evidence requests, interviews, sampling, deficiency linkage, and readiness reporting.",
      evidence: {
        surveyId: survey?.id,
        readinessScore: survey?.readinessScore,
        reportEvidenceId: survey?.reportEvidenceId,
      },
    },
    {
      criterionId: "M3.1-06" as const,
      passed:
        REQUIRED_AUDIT_ACTIONS.every((action) => auditActions.has(action)) &&
        areM31AuditEventsImmutable(auditEvents),
      summary:
        "A frozen append-only event ledger records every required compliance action category with fixed actors and timestamps.",
      evidence: {
        eventIds: auditEvents.map((event) => event.id),
        actions: [...auditActions],
        immutable: areM31AuditEventsImmutable(auditEvents),
      },
    },
    {
      criterionId: "M3.1-07" as const,
      passed: Boolean(
        enterpriseRisk &&
        enterpriseRisk.overdueControls > 0 &&
        enterpriseRisk.repeatFindings > 0 &&
        enterpriseRisk.openCaps > 0 &&
        snapshot.riskViews.filter((view) => view.scope === "division")
          .length === 4 &&
        snapshot.riskViews.every(
          (view) =>
            Number.isFinite(view.riskScore) && view.sourceRecordIds.length > 0,
        ),
      ),
      summary:
        "Derived enterprise and division risk views show overdue controls, repeat findings, open CAPs, and trends.",
      evidence: { riskViews: snapshot.riskViews },
    },
  ];

  const exactCriteria = criteria.map((criterion) => criterion.criterionId);
  const passed =
    criteria.every((criterion) => criterion.passed) &&
    exactCriteria.length === M31_CRITERIA.length &&
    exactCriteria.every(
      (criterion, index) => criterion === M31_CRITERIA[index],
    );

  return Object.freeze({
    milestone: "M3.1",
    domain: "COMPLIANCE",
    evidenceClass: "synthetic_demo",
    passed,
    criteria: Object.freeze(
      criteria.map((criterion) => Object.freeze(criterion)),
    ),
    snapshot,
    auditEvents,
  });
}
