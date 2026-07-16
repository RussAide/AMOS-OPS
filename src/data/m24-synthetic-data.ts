import type { M24CriterionId, M24ScenarioId } from "../../contracts/gro/m24-model";

export interface M24StageViewModel {
  readonly id: string;
  readonly name: string;
  readonly status: "Operational" | "Evaluation";
  readonly census: number;
  readonly capacity: number;
  readonly leave: number;
  readonly percentFull: number;
}

export interface M24CriterionViewModel {
  readonly id: M24CriterionId;
  readonly title: string;
  readonly status: "Pass";
  readonly proof: string;
}

export interface M24ScenarioViewModel {
  readonly id: M24ScenarioId;
  readonly label: string;
  readonly status: "Passed";
  readonly summary: string;
  readonly evidence: readonly string[];
}

export const M24_SYNTHETIC_VIEW = {
  evidenceClass: "Synthetic prototype — no real youth or workforce data",
  asOf: "July 15, 2026 at 8:01 AM UTC",
  headlineMetrics: [
    { label: "Residential census", value: "14 / 48", detail: "Peak 15 of 16 triggered the threshold before coordinated discharge" },
    { label: "Shift coverage", value: "2 + 1", detail: "Two staffed shifts plus one detected shortage scenario" },
    { label: "Medication controls", value: "4 / 4", detail: "PRN, count, effectiveness, and handoff evidence passed" },
    { label: "Acceptance scenarios", value: "6 / 6", detail: "All controlling M2.4 scenarios passed deterministically" },
  ],
  stages: [
    { id: "M24-STAGE-1", name: "Stage 1 — Main Residential Unit", status: "Operational", census: 14, capacity: 16, leave: 0, percentFull: 88 },
    { id: "M24-STAGE-2", name: "Stage 2 — Emergency Care Services", status: "Evaluation", census: 0, capacity: 16, leave: 0, percentFull: 0 },
    { id: "M24-STAGE-3", name: "Stage 3 — Cypress Campus", status: "Evaluation", census: 0, capacity: 16, leave: 0, percentFull: 0 },
  ] satisfies readonly M24StageViewModel[],
  operationalPanels: [
    { label: "Shift operations", value: "2 active", detail: "Attendance, safety rounds, care logs, tasks, escalation, and acceptance-gated handoff" },
    { label: "MAR & controlled medication", value: "Reconciled", detail: "PRN reason and effectiveness complete; controlled balance 10 → 9 with independent witness" },
    { label: "Incident management", value: "L3 closed", detail: "Notifications, one-hour documentation, 24-hour debrief, parent notice, and correction complete" },
    { label: "Youth rights", value: "Acknowledged", detail: "Active posting plus child and parent review, copy, signature, and record-filing evidence" },
    { label: "Family & activity", value: "Complete", detail: "Family contact and structured recreation are in the case history" },
    { label: "Continuum coordination", value: "Complete", detail: "Transport, crisis response, medication reconciliation, aftercare, and discharge coordination linked" },
  ],
  workQueues: [
    { stream: "Census", item: "Stage 1 peak reached 94%; discharge returned it to 88%", owner: "GRO Administrator", state: "Alert resolved", tone: "green" },
    { stream: "Staffing", item: "Synthetic shortage requires added qualified capacity", owner: "Shift Supervisor", state: "Critical task", tone: "red" },
    { stream: "Handoff", item: "Evening wellness check transferred and resolved", owner: "Incoming Shift", state: "Completed", tone: "green" },
    { stream: "Medication", item: "Controlled PRN and effectiveness accepted", owner: "Incoming Nurse", state: "Accepted", tone: "green" },
    { stream: "Incident", item: "L3 restraint evidence and corrective review", owner: "Compliance Officer", state: "Closed", tone: "green" },
  ],
  criteria: [
    { id: "M2.4-01", title: "Census, beds, placement, and three-stage capacity", status: "Pass", proof: "Atomic admission/transfer/leave/return/discharge transitions and 90% capacity alert." },
    { id: "M2.4-02", title: "Staffing and room capacity controls", status: "Pass", proof: "Chapter 748 bedroom and waking/night supervision evaluators enforce capacity and qualified coverage." },
    { id: "M2.4-03", title: "Shift execution and handoff", status: "Pass", proof: "Attendance, rounds, care logs, work, escalation, and unresolved-item handoff gating are evidenced." },
    { id: "M2.4-04", title: "MAR, PRN, and controlled medication", status: "Pass", proof: "Disposition reasons, witnessed counts, discrepancy resolution, effectiveness, and medication handoff are controlled." },
    { id: "M2.4-05", title: "L1–L5 incident lifecycle", status: "Pass", proof: "Role-based notices, one-hour documentation, 24-hour debrief, medical/parent evidence, correction, and closure gates operate." },
    { id: "M2.4-06", title: "Youth rights and prohibited practices", status: "Pass", proof: "Active rights posting and acknowledgment coexist with fail-closed prohibited and unknown practice evaluation." },
    { id: "M2.4-07", title: "Family, activity, transport, crisis, and discharge", status: "Pass", proof: "Five continuum event types share the governed residential case history." },
    { id: "M2.4-08", title: "Acceptance scenarios and synthetic boundary", status: "Pass", proof: "Six repeatable scenarios produce stable synthetic evidence without changing runtime singleton state." },
  ] satisfies readonly M24CriterionViewModel[],
  scenarios: [
    { id: "multi_shift", label: "Multi-shift operations", status: "Passed", summary: "Two consecutive shifts recorded attendance, a safety round, a youth care log, rights, and engagement work.", evidence: ["2 active shifts", "1 safety round", "1 youth care log", "5 engagement event types"] },
    { id: "high_census", label: "High census", status: "Passed", summary: "Stage 1 reached 15 of 16 occupied beds and emitted the required threshold alert.", evidence: ["94% occupied", "1 bed available", "90% alert open"] },
    { id: "medication", label: "Medication administration", status: "Passed", summary: "A controlled PRN passed witnessed count, reason, effectiveness, and incoming-shift acceptance controls.", evidence: ["10 → 9 count", "Independent witness", "PRN effective", "Handoff accepted"] },
    { id: "incident", label: "Incident response", status: "Passed", summary: "An L3 restraint event satisfied regulatory evidence, response deadlines, notification, correction, and closure.", evidence: ["3 role notifications", "30-minute documentation", "1-hour debrief", "Corrective action complete"] },
    { id: "staffing_shortage", label: "Staffing shortage", status: "Passed", summary: "The waking-hours ratio evaluator detected insufficient qualified capacity and issued critical work.", evidence: ["Ratio failed closed", "Critical task issued", "Administrator notified"] },
    { id: "handoff", label: "Unresolved-work handoff", status: "Passed", summary: "The incoming shift saw the unresolved task and could not complete the handoff until the task closed.", evidence: ["Task visible", "Acceptance recorded", "Completion gate enforced"] },
  ] satisfies readonly M24ScenarioViewModel[],
} as const;
