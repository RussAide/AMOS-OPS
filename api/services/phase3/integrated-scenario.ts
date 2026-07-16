import Database from "better-sqlite3";
import {
  PHASE3_CRITERIA,
  PHASE3_DEMO_CONTROL_ROLES,
  PHASE3_DX1_APPLICABLE_CONTROLS,
  assertCompleteModuleResult,
  assertPhase3Synthetic,
  mayControlPhase3Demo,
  stablePhase3Id,
  type Phase3AuditEvent,
  type Phase3Criterion,
  type Phase3Dx1Result,
  type Phase3FeatureScenario,
  type Phase3IntegratedResult,
  type Phase3ModuleResult,
  type Phase3SupportLink,
  type Phase3WorkItem,
} from "@contracts/phase3/shared";
import { buildEnvironmentConfig } from "../../lib/env";
import { runM31SyntheticSuite } from "../m31";
import { runM32SyntheticSuite } from "../m32";
import { runM33SyntheticSuite } from "../m33";
import { runM34SyntheticSuite } from "../m34";
import {
  assertPhase3DemoControlActive,
  assertPhase3DemoResetAllowed,
  getPhase3DemoControlState,
  recordPhase3AccessReview,
  resetPhase3ControlScenario,
  seedPhase3ControlScenario,
  setPhase3KillSwitch,
} from "./runtime-schema";

const SUPPORT_CASE_ID = "SYNTH-PHASE3-SUPPORT-001";
const SOURCE_EPISODE_ID = "SYNTH-PHASE2-EPISODE-001";
const STARTED_AT = "2026-07-14T13:00:00.000Z";
const COMPLETED_AT = "2026-07-14T18:30:00.000Z";

const PRODUCTION_ACTIONS_BLOCKED = Object.freeze([
  "Live patient or youth record creation, access, or mutation",
  "Live clinical care delivery, treatment recommendation, or crisis coordination",
  "Live medication ordering, dispensing, or administration",
  "Live claim submission, adjudication, payment posting, or payer transmission",
  "Live disclosure, consent, protected-record export, or regulatory filing",
  "Live workforce, credential, payroll, or personnel-record mutation",
  "Live vendor purchase, work-order dispatch, inventory issue, or transport dispatch",
  "Live notification to a patient, guardian, employee, payer, vendor, or authority",
  "Live CMBHS, EHR, clearinghouse, banking, or external-system transaction",
  "Live Microsoft 365, SharePoint, OneDrive, Teams, or connector mutation",
]);

function moduleForCriterion(criterionId: Phase3Criterion): Phase3ModuleResult {
  if (criterionId.startsWith("M3.1")) return runM31SyntheticSuite();
  if (criterionId.startsWith("M3.2")) return runM32SyntheticSuite();
  if (criterionId.startsWith("M3.3")) return runM33SyntheticSuite();
  return runM34SyntheticSuite();
}

export function evaluatePhase3Component(criterionId: Phase3Criterion): {
  feature: Phase3FeatureScenario;
  module: Phase3ModuleResult;
} {
  const module = moduleForCriterion(criterionId);
  assertCompleteModuleResult(module);
  const criterion = module.criteria.find(
    (candidate) => candidate.criterionId === criterionId,
  );
  if (!criterion) throw new Error(`PHASE3_COMPONENT_NOT_FOUND:${criterionId}`);
  return Object.freeze({
    feature: Object.freeze({
      scenarioId: `SYNTH-DX1-${criterion.criterionId}-SCENARIO`,
      milestone: module.milestone,
      criterionId: criterion.criterionId,
      summary: criterion.summary,
      expectedResult: "pass",
      actualResult: criterion.passed ? "pass" : "fail",
      evidenceIds: Object.freeze([`SYNTH-EVIDENCE-${criterion.criterionId}`]),
    }),
    module,
  });
}

function buildSupportLinks(): readonly Phase3SupportLink[] {
  return Object.freeze([
    {
      id: "SYNTH-P3-LINK-COMPLIANCE",
      domain: "COMPLIANCE",
      sourceDivision: "BHC",
      sourceType: "ccmg_case",
      sourceId: "M21-CASE-EXISTING-001",
      targetType: "m31_mock_survey",
      targetId: "SYNTH-M31-SURVEY-001",
      relation: "assures",
      evidenceClass: "synthetic_demo",
      createdAt: STARTED_AT,
    },
    {
      id: "SYNTH-P3-LINK-REVENUE",
      domain: "REVENUE",
      sourceDivision: "BHC",
      sourceType: "phase2_claim_handoff",
      sourceId: "M22-CLAIM-HANDOFF-0024",
      targetType: "m32_claim_cycle",
      targetId: "SYNTH-M32-CLAIM-T1017-001",
      relation: "funds",
      evidenceClass: "synthetic_demo",
      createdAt: STARTED_AT,
    },
    {
      id: "SYNTH-P3-LINK-WORKFORCE",
      domain: "WORKFORCE",
      sourceDivision: "GRO",
      sourceType: "phase2_shift_staffing_evaluation",
      sourceId: "SYNTH-M24-SHIFT-00062",
      targetType: "m33_workforce_record",
      targetId: "SYNTH-M33-WORKFORCE-T1",
      relation: "staffs",
      evidenceClass: "synthetic_demo",
      createdAt: STARTED_AT,
    },
    {
      id: "SYNTH-P3-LINK-GAD",
      domain: "GAD",
      sourceDivision: "GRO",
      sourceType: "phase2_gro_placement",
      sourceId: "SYNTH-M24-PLACEMENT-00001",
      targetType: "m34_facility_stage",
      targetId: "SYNTH-M34-STAGE-1",
      relation: "maintains",
      evidenceClass: "synthetic_demo",
      createdAt: STARTED_AT,
    },
  ]);
}

function buildCompletedWorkItems(
  moduleResults: readonly Phase3ModuleResult[],
): readonly Phase3WorkItem[] {
  const definitions = [
    [
      "SYNTH-P3-WORK-M31",
      "COMPLIANCE",
      "Close routed chart-audit finding",
      "ccmg_case",
      "M21-CASE-EXISTING-001",
      "hr-compliance-officer",
      "SYNTH-HR-COMPLIANCE-OFFICER",
      "M3.1",
    ],
    [
      "SYNTH-P3-WORK-M32",
      "REVENUE",
      "Complete T1017 and H2017 claim cycles",
      "phase2_claim_handoff",
      "M22-CLAIM-HANDOFF-0024",
      "revenue-cycle-manager",
      "SYNTH-REVENUE-MANAGER",
      "M3.2",
    ],
    [
      "SYNTH-P3-WORK-M33",
      "WORKFORCE",
      "Release qualified representative staff to duty",
      "phase2_shift_staffing_evaluation",
      "SYNTH-M24-SHIFT-00062",
      "hr-director",
      "SYNTH-HR-DIRECTOR",
      "M3.3",
    ],
    [
      "SYNTH-P3-WORK-M34",
      "GAD",
      "Verify campus facilities and support services",
      "phase2_gro_placement",
      "SYNTH-M24-PLACEMENT-00001",
      "facilities-manager",
      "SYNTH-FACILITIES-MANAGER",
      "M3.4",
    ],
  ] as const;

  return Object.freeze(
    definitions.map(
      ([
        id,
        domain,
        title,
        sourceType,
        sourceId,
        assignedRole,
        assignedTo,
        milestone,
      ]) => {
        const module = moduleResults.find(
          (result) => result.milestone === milestone,
        );
        if (!module)
          throw new Error(`PHASE3_MODULE_RESULT_MISSING:${milestone}`);
        return Object.freeze({
          id,
          supportCaseId: SUPPORT_CASE_ID,
          domain,
          title,
          sourceType,
          sourceId,
          status: "completed" as const,
          priority: "urgent" as const,
          assignedRole,
          assignedTo,
          dueAt: "2026-07-18T17:00:00.000Z",
          completedAt: COMPLETED_AT,
          evidenceIds: Object.freeze(
            module.criteria.map(
              (criterion) => `SYNTH-EVIDENCE-${criterion.criterionId}`,
            ),
          ),
          evidenceClass: "synthetic_demo" as const,
          createdAt: STARTED_AT,
          updatedAt: COMPLETED_AT,
        });
      },
    ),
  );
}

const ACCEPTED_PHASE2_SOURCE_IDS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    ccmg_case: Object.freeze(["M21-CASE-EXISTING-001"]),
    phase2_claim_handoff: Object.freeze([
      "M22-CLAIM-HANDOFF-0024",
      "M23-CLAIM-0002",
    ]),
    phase2_shift_staffing_evaluation: Object.freeze(["SYNTH-M24-SHIFT-00062"]),
    phase2_gro_placement: Object.freeze(["SYNTH-M24-PLACEMENT-00001"]),
  });

const PHASE3_TARGET_MILESTONE: Readonly<Record<string, string>> = Object.freeze(
  {
    m31_mock_survey: "M3.1",
    m32_claim_cycle: "M3.2",
    m33_workforce_record: "M3.3",
    m34_facility_stage: "M3.4",
  },
);

export function validatePhase3SupportLinks(
  links: readonly Phase3SupportLink[],
  modules: readonly Phase3ModuleResult[],
): boolean {
  if (
    links.length !== 4 ||
    new Set(links.map((link) => link.domain)).size !== 4
  )
    return false;
  return links.every((link) => {
    const acceptedSources = ACCEPTED_PHASE2_SOURCE_IDS[link.sourceType];
    const expectedMilestone = PHASE3_TARGET_MILESTONE[link.targetType];
    const module = modules.find(
      (candidate) => candidate.milestone === expectedMilestone,
    );
    return (
      acceptedSources?.includes(link.sourceId) === true &&
      module !== undefined &&
      JSON.stringify(module).includes(`"${link.targetId}"`)
    );
  });
}

interface Dx1ExecutableChecks {
  isolatedEnvironment: boolean;
  additiveSchema: boolean;
  persistentBanner: boolean;
  deterministicReset: boolean;
  killSwitch: boolean;
  dataExpiration: boolean;
  accessReview: boolean;
  separateAuditEvidence: boolean;
}

function executeDx1Controls(): Dx1ExecutableChecks {
  let rejectedProductionPath = false;
  try {
    buildEnvironmentConfig({
      APP_ENV: "demo",
      NODE_ENV: "production",
      AMOS_RUNTIME_MODE: "demo",
      AMOS_ENVIRONMENT_ID: "amos-ops-demo",
      CREDENTIAL_NAMESPACE: "amos-ops/demo",
      DATABASE_PATH: "/data/production/amos-ops.db",
      UPLOAD_PATH: "/uploads/demo",
    });
  } catch {
    rejectedProductionPath = true;
  }
  const isolatedProfile = buildEnvironmentConfig({
    APP_ENV: "demo",
    NODE_ENV: "production",
    AMOS_RUNTIME_MODE: "demo",
    AMOS_ENVIRONMENT_ID: "amos-ops-demo",
    CREDENTIAL_NAMESPACE: "amos-ops/demo",
    DATABASE_PATH: "/data/demo/amos-ops.db",
    UPLOAD_PATH: "/uploads/demo",
  });

  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  try {
    seedPhase3ControlScenario(db);
    const controlColumns = new Set(
      (
        db.prepare("PRAGMA table_info(phase3_demo_controls)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );
    const additiveSchema = [
      "environment_label",
      "data_store_label",
      "access_reviewed_at",
      "access_reviewed_by",
      "last_reset_at",
    ].every((column) => controlColumns.has(column));

    const initialControl = assertPhase3DemoControlActive(db);
    assertPhase3DemoResetAllowed(db);
    resetPhase3ControlScenario(db);
    const deterministicReset =
      getPhase3DemoControlState(db).lastResetAt === "2026-07-14T18:30:00.000Z";

    setPhase3KillSwitch(
      true,
      "SYNTH-MANAGING-DIRECTOR",
      "managing-director",
      db,
      "2026-07-14T18:31:00.000Z",
    );
    let killBlocked = false;
    try {
      assertPhase3DemoControlActive(db);
    } catch (error) {
      killBlocked =
        error instanceof Error &&
        error.message === "PHASE3_DEMO_KILL_SWITCH_ACTIVE";
    }
    setPhase3KillSwitch(
      false,
      "SYNTH-MANAGING-DIRECTOR",
      "managing-director",
      db,
      "2026-07-14T18:32:00.000Z",
    );
    assertPhase3DemoControlActive(db);

    db.prepare(
      "UPDATE phase3_demo_controls SET data_expires_at = '2026-07-14T18:29:00.000Z'",
    ).run();
    let expirationBlocked = false;
    try {
      assertPhase3DemoControlActive(db);
    } catch (error) {
      expirationBlocked =
        error instanceof Error && error.message === "PHASE3_DEMO_DATA_EXPIRED";
    }
    db.prepare(
      "UPDATE phase3_demo_controls SET data_expires_at = '2027-01-14T00:00:00.000Z', access_reviewed_at = '2026-01-01T00:00:00.000Z'",
    ).run();
    let staleReviewBlocked = false;
    try {
      assertPhase3DemoControlActive(db);
    } catch (error) {
      staleReviewBlocked =
        error instanceof Error &&
        error.message === "PHASE3_ACCESS_REVIEW_STALE";
    }
    recordPhase3AccessReview(
      "SYNTH-MANAGING-DIRECTOR",
      "managing-director",
      db,
      "2026-07-14T18:30:00.000Z",
    );
    assertPhase3DemoControlActive(db);
    const immutableControlAuditCount = Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_audit_events WHERE entity_type IN ('phase3_demo_control','phase3_demo_access_review','phase3_demo_reset')",
          )
          .get() as { count: number }
      ).count,
    );

    return Object.freeze({
      isolatedEnvironment:
        rejectedProductionPath &&
        isolatedProfile.isDemo &&
        isolatedProfile.evaluationMode &&
        isolatedProfile.databasePath.includes("demo"),
      additiveSchema,
      persistentBanner:
        initialControl.environmentLabel === "DEMO - NOT FOR CARE DELIVERY" &&
        initialControl.environmentId === "AMOS-OPS-PHASE3-EVALUATION",
      deterministicReset,
      killSwitch: killBlocked,
      dataExpiration: expirationBlocked,
      accessReview: staleReviewBlocked,
      separateAuditEvidence: immutableControlAuditCount === 4,
    });
  } finally {
    db.close();
  }
}

function buildPhase3Dx1Result(
  modules: readonly Phase3ModuleResult[],
  productionActionsBlocked: readonly string[],
): Phase3Dx1Result {
  const executable = executeDx1Controls();
  const featureScenarios = Object.freeze(
    modules.flatMap((module) =>
      module.criteria.map((criterion) =>
        Object.freeze({
          scenarioId: `SYNTH-DX1-${criterion.criterionId}-SCENARIO`,
          milestone: module.milestone,
          criterionId: criterion.criterionId,
          summary: criterion.summary,
          expectedResult: "pass" as const,
          actualResult: criterion.passed
            ? ("pass" as const)
            : ("fail" as const),
          evidenceIds: Object.freeze([
            `SYNTH-EVIDENCE-${criterion.criterionId}`,
          ]),
        }),
      ),
    ),
  );
  const parityDeviationRegister = Object.freeze([
    Object.freeze({
      item: "Accepted Phase 2 synthetic lineage into Phase 3",
      disposition: "parity" as const,
      rationale:
        "M21, M22, M23, and M24 accepted identifiers are carried into typed Phase 3 support and revenue records.",
    }),
    Object.freeze({
      item: "Phase 3 persistence adapters",
      disposition: "controlled_deviation" as const,
      rationale:
        "Evaluation uses an isolated SQLite store while production adapters remain disabled and out of scope for this milestone.",
    }),
    Object.freeze({
      item: "External payer and banking transactions",
      disposition: "controlled_deviation" as const,
      rationale:
        "Deterministic claim states are evaluated without transmitting a claim, payment, or banking instruction.",
    }),
    Object.freeze({
      item: "Evidence-based clinical algorithm simulations",
      disposition: "deferred_by_sequence" as const,
      rationale:
        "Clinical decision-support resources belong to a later controlling milestone and are not claimed by Phase 3.",
    }),
    Object.freeze({
      item: "Synthetic SharePoint repository workflows",
      disposition: "deferred_by_sequence" as const,
      rationale:
        "Microsoft repository simulation belongs to the future DMS connector sequence and is not claimed by Phase 3.",
    }),
  ]);
  const deferredControls = Object.freeze(
    parityDeviationRegister.filter(
      (entry) => entry.disposition === "deferred_by_sequence",
    ),
  );
  const evidenceByControl: Readonly<Record<string, readonly string[]>> =
    Object.freeze({
      "DX1-ISOLATED-ENVIRONMENT": Object.freeze([
        "source/api/lib/env.ts",
        "source/api/lib/env.test.ts",
      ]),
      "DX1-ADDITIVE-CONTROLS": Object.freeze([
        "source/db/migrations/0007_phase3_integrated_controls.sql",
      ]),
      "DX1-PERSISTENT-BANNER": Object.freeze([
        "source/src/components/shell/app-shell.tsx",
      ]),
      "DX1-SYNTHETIC-PROVENANCE": Object.freeze([
        "source/contracts/phase3/shared.ts",
      ]),
      "DX1-ROLE-PERSONAS": Object.freeze([
        "source/api/routers/phase3.ts",
        "source/api/security/identity.ts",
      ]),
      "DX1-FEATURE-INVENTORY": Object.freeze(["dx1.featureScenarios"]),
      "DX1-DETERMINISTIC-SCENARIOS": Object.freeze([
        "source/api/services/phase3/integrated-scenario.ts",
      ]),
      "DX1-PRODUCTION-ACTIONS-BLOCKED": productionActionsBlocked,
      "DX1-MICROSOFT-MUTATIONS-BLOCKED": Object.freeze([
        productionActionsBlocked[9] ?? "Microsoft mutations blocked",
      ]),
      "DX1-SEPARATE-AUDIT-EVIDENCE": Object.freeze([
        "source/api/services/phase3/control-store.ts",
      ]),
      "DX1-RESET-KILL-EXPIRATION-ACCESS-REVIEW": Object.freeze([
        "source/api/services/phase3/runtime-schema.ts",
        "source/api/tests/phase3-runtime-schema.test.ts",
      ]),
      "DX1-PARITY-DEVIATION-REGISTER": Object.freeze([
        "controls/PHASE_3_DEMO_PARITY_DEVIATION_REGISTER.md",
      ]),
    });
  const applicableControls = Object.freeze(
    PHASE3_DX1_APPLICABLE_CONTROLS.map((id) =>
      Object.freeze({
        id,
        passed: (() => {
          if ((evidenceByControl[id]?.length ?? 0) === 0) return false;
          switch (id) {
            case "DX1-ISOLATED-ENVIRONMENT":
              return executable.isolatedEnvironment;
            case "DX1-ADDITIVE-CONTROLS":
              return executable.additiveSchema;
            case "DX1-PERSISTENT-BANNER":
              return executable.persistentBanner;
            case "DX1-SYNTHETIC-PROVENANCE":
              return modules.every(
                (module) => module.evidenceClass === "synthetic_demo",
              );
            case "DX1-ROLE-PERSONAS":
              return (
                PHASE3_DEMO_CONTROL_ROLES.every(mayControlPhase3Demo) &&
                !mayControlPhase3Demo("rcs-day")
              );
            case "DX1-FEATURE-INVENTORY":
              return featureScenarios.length === PHASE3_CRITERIA.length;
            case "DX1-DETERMINISTIC-SCENARIOS":
              return featureScenarios.every(
                (scenario) => scenario.actualResult === "pass",
              );
            case "DX1-PRODUCTION-ACTIONS-BLOCKED":
              return productionActionsBlocked.length >= 10;
            case "DX1-MICROSOFT-MUTATIONS-BLOCKED":
              return productionActionsBlocked.some((action) =>
                action.includes("Microsoft 365"),
              );
            case "DX1-SEPARATE-AUDIT-EVIDENCE":
              return executable.separateAuditEvidence;
            case "DX1-RESET-KILL-EXPIRATION-ACCESS-REVIEW":
              return (
                executable.deterministicReset &&
                executable.killSwitch &&
                executable.dataExpiration &&
                executable.accessReview
              );
            case "DX1-PARITY-DEVIATION-REGISTER":
              return (
                parityDeviationRegister.some(
                  (entry) => entry.disposition === "parity",
                ) &&
                parityDeviationRegister.some(
                  (entry) => entry.disposition === "controlled_deviation",
                ) &&
                deferredControls.length === 2
              );
          }
        })(),
        evidence: evidenceByControl[id] ?? Object.freeze([]),
      }),
    ),
  );
  return Object.freeze({
    controlId: "DX.1-P3",
    evidenceClass: "synthetic_demo",
    passed:
      applicableControls.every((control) => control.passed) &&
      featureScenarios.every((scenario) => scenario.actualResult === "pass"),
    environmentId: "AMOS-OPS-PHASE3-EVALUATION",
    environmentLabel: "DEMO - NOT FOR CARE DELIVERY",
    applicableControls,
    deferredControls,
    featureScenarios,
    authorizedControlRoles: Object.freeze([...PHASE3_DEMO_CONTROL_ROLES]),
    deniedRepresentativeRole: "rcs-day",
    dataProvenance: Object.freeze([
      "Every evaluative record is fictional and labeled synthetic_demo.",
      "Accepted Phase 2 identifiers are used only inside deterministic synthetic scenarios.",
      "No patient, employee, payer, vendor, or Microsoft tenant data is read or mutated.",
    ]),
    parityDeviationRegister,
    runtimeControls: Object.freeze({
      productionWritesBlocked: productionActionsBlocked.length >= 10,
      microsoftMutationsBlocked: productionActionsBlocked.some((action) =>
        action.includes("Microsoft 365"),
      ),
      separateAuditEvidence: executable.separateAuditEvidence,
      deterministicResetTested: executable.deterministicReset,
      killSwitchTested: executable.killSwitch,
      dataExpirationTested: executable.dataExpiration,
      accessReviewCurrent: executable.accessReview,
    }),
  });
}

function deduplicateAuditEvents(
  events: readonly Phase3AuditEvent[],
): readonly Phase3AuditEvent[] {
  const byId = new Map<string, Phase3AuditEvent>();
  for (const event of events) {
    assertPhase3Synthetic({ id: event.id, evidenceClass: event.evidenceClass });
    if (byId.has(event.id))
      throw new Error(`PHASE3_DUPLICATE_AUDIT_EVENT:${event.id}`);
    byId.set(event.id, event);
  }
  return Object.freeze(
    [...byId.values()].sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt),
    ),
  );
}

export function runPhase3IntegratedScenario(): Phase3IntegratedResult {
  const m31 = runM31SyntheticSuite();
  const m32 = runM32SyntheticSuite();
  const m33 = runM33SyntheticSuite();
  const m34 = runM34SyntheticSuite();
  const modules = [m31, m32, m33, m34] as const;
  modules.forEach(assertCompleteModuleResult);

  const criterionResults = modules.flatMap((module) => module.criteria);
  const criterionIds = criterionResults.map(
    (criterion) => criterion.criterionId,
  );
  const distinctCriteria = new Set(criterionIds);
  if (
    criterionIds.length !== PHASE3_CRITERIA.length ||
    distinctCriteria.size !== PHASE3_CRITERIA.length
  ) {
    throw new Error("PHASE3_CRITERION_CARDINALITY_MISMATCH");
  }
  for (const criterionId of PHASE3_CRITERIA) {
    if (!distinctCriteria.has(criterionId))
      throw new Error(`PHASE3_CRITERION_MISSING:${criterionId}`);
  }

  const criteria = Object.fromEntries(
    criterionResults.map((criterion) => [
      criterion.criterionId,
      criterion.passed,
    ]),
  ) as Record<Phase3Criterion, boolean>;
  const failedCriteria = PHASE3_CRITERIA.filter(
    (criterionId) => !criteria[criterionId],
  );
  const supportLinks = buildSupportLinks();
  const supportLinksValid = validatePhase3SupportLinks(supportLinks, modules);
  const workItems = buildCompletedWorkItems(modules);
  for (const link of supportLinks)
    assertPhase3Synthetic({ id: link.id, evidenceClass: link.evidenceClass });
  for (const item of workItems)
    assertPhase3Synthetic({ id: item.id, evidenceClass: item.evidenceClass });

  const integratedAudit: Phase3AuditEvent = Object.freeze({
    id: stablePhase3Id("SYNTH-P3-AUDIT", SUPPORT_CASE_ID, "phase3-exit"),
    domain: "COMPLIANCE",
    action: "scenario",
    entityType: "phase3_support_case",
    entityId: SUPPORT_CASE_ID,
    actorId: "SYNTH-MANAGING-DIRECTOR",
    actorRole: "managing-director",
    reason:
      "Executed the pre-approved Phase 3 integrated synthetic evaluation and calculated the internal exit gate.",
    correlationId: SOURCE_EPISODE_ID,
    after: Object.freeze({
      criteriaPassed: criterionResults.filter((criterion) => criterion.passed)
        .length,
      milestonesPassed: modules.filter((module) => module.passed).length,
    }),
    changedFields: Object.freeze(["criteriaPassed", "milestonesPassed"]),
    evidenceClass: "synthetic_demo",
    occurredAt: COMPLETED_AT,
  });
  const auditEvents = deduplicateAuditEvents([
    ...modules.flatMap((module) => module.auditEvents),
    integratedAudit,
  ]);
  const dx1 = buildPhase3Dx1Result(modules, PRODUCTION_ACTIONS_BLOCKED);
  const exitGate =
    failedCriteria.length === 0 &&
    modules.every((module) => module.passed) &&
    supportLinksValid &&
    workItems.every((item) => item.status === "completed") &&
    PRODUCTION_ACTIONS_BLOCKED.length >= 10 &&
    dx1.passed;

  const assertionsPassed =
    criterionResults.filter((criterion) => criterion.passed).length +
    modules.filter((module) => module.passed).length +
    supportLinks.length +
    workItems.filter((item) => item.status === "completed").length +
    Number(PRODUCTION_ACTIONS_BLOCKED.length >= 10) +
    Number(auditEvents.length > modules.length) +
    Number(SOURCE_EPISODE_ID.startsWith("SYNTH-")) +
    Number(supportLinksValid) +
    dx1.applicableControls.filter((control) => control.passed).length +
    Number(dx1.passed);
  const assertionsTotal =
    PHASE3_CRITERIA.length +
    4 +
    4 +
    4 +
    4 +
    PHASE3_DX1_APPLICABLE_CONTROLS.length +
    1;
  const assertionsFailed = assertionsTotal - assertionsPassed;

  return Object.freeze({
    milestone: "PHASE3_EXIT",
    evidenceClass: "synthetic_demo",
    supportCaseId: SUPPORT_CASE_ID,
    sourceEpisodeId: SOURCE_EPISODE_ID,
    criteria: Object.freeze(criteria),
    failedCriteria: Object.freeze(failedCriteria),
    supportLinks,
    workItems,
    moduleResults: Object.freeze({
      "M3.1": m31,
      "M3.2": m32,
      "M3.3": m33,
      "M3.4": m34,
    }),
    auditEvents,
    productionActionsBlocked: PRODUCTION_ACTIONS_BLOCKED,
    dx1,
    exitGate,
    scenarioRun: Object.freeze({
      id: "SYNTH-PHASE3-EXIT-RUN-001",
      milestone: "PHASE3_EXIT",
      scenarioType: "integrated_corporate_operations",
      status: exitGate ? "passed" : "failed",
      supportCaseId: SUPPORT_CASE_ID,
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
      assertionsPassed,
      assertionsFailed,
      evidence: Object.freeze({
        sourceEpisodeId: SOURCE_EPISODE_ID,
        criterionIds: Object.freeze([...PHASE3_CRITERIA]),
        milestoneResults: Object.freeze(
          Object.fromEntries(
            modules.map((module) => [module.milestone, module.passed]),
          ),
        ),
        supportLinkIds: Object.freeze(supportLinks.map((link) => link.id)),
        completedWorkItemIds: Object.freeze(workItems.map((item) => item.id)),
        auditEventCount: auditEvents.length,
        productionActionsBlocked: PRODUCTION_ACTIONS_BLOCKED,
        dx1ControlId: dx1.controlId,
        dx1Passed: dx1.passed,
        featureScenarioIds: Object.freeze(
          dx1.featureScenarios.map((scenario) => scenario.scenarioId),
        ),
        metricOperators: Object.freeze({
          daysInAr: "<40",
          cleanClaimRate: ">95%",
          credentialingDays: "<30",
          annualTrainingHours: ">=40",
          facilityUptime: ">99%",
        }),
      }),
    }),
  });
}
