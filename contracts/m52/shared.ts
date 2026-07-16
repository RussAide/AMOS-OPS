export const M52_MILESTONE = "M5.2" as const;
export const M52_EVALUATION_STARTED_AT = "2026-07-15T15:00:00.000Z";

export const M52_CRITERION_IDS = Object.freeze([
  "M5.2-01",
  "M5.2-02",
  "M5.2-03",
  "M5.2-04",
  "M5.2-05",
  "M5.2-06",
  "M5.2-07",
  "M5.2-08",
] as const);

export type M52CriterionId = (typeof M52_CRITERION_IDS)[number];

export const M52_APPROVED_WORKFLOW_IDS = Object.freeze([
  "gro_tablet_medication_pass",
  "gro_shift_safety_handoff",
  "bhc_field_case_management_contact",
  "enterprise_task_structured_form",
] as const);

export type M52ApprovedWorkflowId =
  (typeof M52_APPROVED_WORKFLOW_IDS)[number];

export interface M52AcceptanceFlag {
  criterionId: M52CriterionId;
  passed: boolean;
  assertionCount: number;
  summary: string;
  evidenceIds: readonly string[];
}

export interface M52PrototypeBoundary {
  evidenceClass: "SYNTHETIC_PROTOTYPE";
  productionRows: 0;
  realPeople: 0;
  realMedicationAdministrations: 0;
  liveDeviceEnrollments: 0;
  physicalDeviceWipes: 0;
  liveExternalCalls: 0;
  liveMicrosoftReads: 0;
  liveMicrosoftWrites: 0;
  realNotificationsSent: 0;
  deployments: 0;
  githubPushes: 0;
  usesProductionData: false;
}

export function createM52PrototypeBoundary(): Readonly<M52PrototypeBoundary> {
  return Object.freeze({
    evidenceClass: "SYNTHETIC_PROTOTYPE",
    productionRows: 0,
    realPeople: 0,
    realMedicationAdministrations: 0,
    liveDeviceEnrollments: 0,
    physicalDeviceWipes: 0,
    liveExternalCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    realNotificationsSent: 0,
    deployments: 0,
    githubPushes: 0,
    usesProductionData: false,
  });
}
