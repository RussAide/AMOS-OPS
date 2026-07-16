import type { UserRole } from "@/constants/roles";
import type {
  M41cCmbhsReconciliationInput,
  M41cCmbhsReconciliationResult,
  M41cFhirAlignedBundle,
  M41cFhirAlignedResource,
  M41cFhirAlignedResourceType,
  M41cMappingMonitorResult,
} from "@contracts/m41c/mappings";
import type { M41cBlockedActionResult } from "@contracts/m41c/pathways";
import {
  assertM41cSyntheticIdentifier,
  blockM41cControlledAction,
  buildM41cHumanGate,
  createM41cAuditEvent,
  m41cDeterministicId,
} from "./pathway-orchestrator";

export interface M41cFhirProjectionInput {
  bundleId: string;
  subjectId: string;
  episodeId: string;
  generatedAt: string;
  versionId: string;
  consentState: "active" | "not_required" | "missing" | "expired" | "revoked";
  sourceRecordIds: readonly string[];
  questionnaireIds: readonly string[];
  assessmentIds: readonly string[];
  carePlanIds: readonly string[];
  measureIds: readonly string[];
  planDefinitionIds: readonly string[];
  serviceRequestIds: readonly string[];
  taskIds: readonly string[];
  detectedIssueIds: readonly string[];
}

function resource(
  input: M41cFhirProjectionInput,
  resourceType: M41cFhirAlignedResourceType,
  id: string,
  status: string,
  sourceRecordIds: readonly string[],
  data: Readonly<Record<string, unknown>>,
): M41cFhirAlignedResource {
  const definitionResource = (
    ["Questionnaire", "Measure", "PlanDefinition"] as const
  ).some((candidate) => candidate === resourceType);
  return Object.freeze({
    resourceType,
    id,
    meta: Object.freeze({
      profile: Object.freeze([
        `https://amos-ops.invalid/fhir-aligned/m41c/${resourceType.toLowerCase()}`,
      ]),
      versionId: input.versionId,
      lastUpdated: input.generatedAt,
      security: Object.freeze(["SYNTHETIC", "NO-LIVE-TRANSMISSION"]),
    }),
    subjectReference: definitionResource ? null : `Patient/${input.subjectId}`,
    episodeReference:
      resourceType === "Patient" || definitionResource
        ? null
        : `EpisodeOfCare/${input.episodeId}`,
    status,
    sourceRecordIds: Object.freeze([...sourceRecordIds]),
    data: Object.freeze({ ...data }),
    syntheticOnly: true,
  });
}

/** Creates an internal FHIR-aligned projection, never an external transaction. */
export function projectM41cFhirAlignedBundle(
  input: M41cFhirProjectionInput,
): M41cFhirAlignedBundle {
  assertM41cSyntheticIdentifier(input.bundleId);
  assertM41cSyntheticIdentifier(input.subjectId);
  assertM41cSyntheticIdentifier(input.episodeId);
  [
    ...input.sourceRecordIds,
    ...input.questionnaireIds,
    ...input.assessmentIds,
    ...input.carePlanIds,
    ...input.measureIds,
    ...input.planDefinitionIds,
    ...input.serviceRequestIds,
    ...input.taskIds,
    ...input.detectedIssueIds,
  ].forEach((id) => assertM41cSyntheticIdentifier(id));
  if (!Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error("M41C_FHIR_PROJECTION_TIME_INVALID");
  }
  if (!input.versionId.trim()) throw new Error("M41C_FHIR_VERSION_REQUIRED");
  if (
    input.consentState !== "active" &&
    input.consentState !== "not_required"
  ) {
    throw new Error("M41C_FHIR_CONSENT_DENIED");
  }
  const provenanceId = m41cDeterministicId(
    "SYNTH-M41C-PROVENANCE",
    input.bundleId,
  );
  const consentId = m41cDeterministicId("SYNTH-M41C-CONSENT", input.bundleId);
  const resources: M41cFhirAlignedResource[] = [
    resource(
      input,
      "Patient",
      input.subjectId,
      "active",
      input.sourceRecordIds,
      {
        identifier: input.subjectId,
        identityClass: "synthetic",
      },
    ),
    resource(
      input,
      "EpisodeOfCare",
      input.episodeId,
      "active",
      input.sourceRecordIds,
      { continuum: "youth" },
    ),
    ...input.questionnaireIds.map((id) =>
      resource(input, "Questionnaire", id, "active", [id], {
        content: "metadata-only synthetic questionnaire definition",
        proprietaryItemWordingStored: false,
      }),
    ),
    ...input.assessmentIds.map((id) =>
      resource(input, "Observation", id, "final", [id], {
        content: "metadata-only synthetic assessment projection",
      }),
    ),
    ...input.carePlanIds.map((id) =>
      resource(input, "CarePlan", id, "draft", [id], {
        humanApprovalRequired: true,
      }),
    ),
    ...input.measureIds.map((id) =>
      resource(input, "Measure", id, "active", [id], {
        content: "synthetic measurement metadata",
        executableScoringStored: false,
      }),
    ),
    ...input.planDefinitionIds.map((id) =>
      resource(input, "PlanDefinition", id, "active", [id], {
        content: "synthetic governed pathway definition metadata",
        autonomousExecutionAvailable: false,
      }),
    ),
    ...input.serviceRequestIds.map((id) =>
      resource(input, "ServiceRequest", id, "draft", [id], {
        intent: "proposal",
      }),
    ),
    ...input.taskIds.map((id) =>
      resource(input, "Task", id, "requested", [id], {
        productionExecutionAvailable: false,
      }),
    ),
    resource(
      input,
      "Consent",
      consentId,
      input.consentState,
      input.sourceRecordIds,
      { state: input.consentState, part2EvaluationRequired: true },
    ),
    ...input.detectedIssueIds.map((id) =>
      resource(input, "DetectedIssue", id, "preliminary", [id], {
        namedHumanReviewRequired: true,
      }),
    ),
    resource(
      input,
      "Provenance",
      provenanceId,
      "completed",
      input.sourceRecordIds,
      {
        targetIds: [
          input.subjectId,
          input.episodeId,
          ...input.questionnaireIds,
          ...input.assessmentIds,
          ...input.carePlanIds,
          ...input.measureIds,
          ...input.planDefinitionIds,
          ...input.serviceRequestIds,
          ...input.taskIds,
          ...input.detectedIssueIds,
          consentId,
        ],
        externalTransmissionAvailable: false,
      },
    ),
  ];
  return Object.freeze({
    bundleId: input.bundleId,
    type: "collection",
    generatedAt: input.generatedAt,
    resources: Object.freeze(resources),
    provenanceResourceId: provenanceId,
    externalTransmissionAvailable: false,
    certificationClaimed: false,
    syntheticOnly: true,
  });
}

export function validateM41cFhirAlignedBundle(
  bundle: M41cFhirAlignedBundle,
): M41cMappingMonitorResult {
  const errors: string[] = [];
  if (!bundle.bundleId.startsWith("SYNTH-"))
    errors.push("Bundle identifier must remain synthetic.");
  if (!Number.isFinite(Date.parse(bundle.generatedAt)))
    errors.push("Bundle generation time is invalid.");
  if (!bundle.syntheticOnly)
    errors.push("Bundle must retain the synthetic-only boundary.");
  if (bundle.externalTransmissionAvailable) {
    errors.push("External transmission must remain unavailable.");
  }
  if (bundle.certificationClaimed) {
    errors.push("The internal projection cannot claim FHIR certification.");
  }
  if (!bundle.resources.some((item) => item.resourceType === "Patient")) {
    errors.push("Synthetic Patient reference is missing.");
  }
  if (!bundle.resources.some((item) => item.resourceType === "EpisodeOfCare")) {
    errors.push("EpisodeOfCare reference is missing.");
  }
  for (const requiredType of [
    "Questionnaire",
    "Observation",
    "CarePlan",
    "Task",
    "Measure",
    "Provenance",
    "PlanDefinition",
  ] as const) {
    if (!bundle.resources.some((item) => item.resourceType === requiredType)) {
      errors.push(`Required FHIR-aligned ${requiredType} resource is missing.`);
    }
  }
  const provenance = bundle.resources.find(
    (item) =>
      item.resourceType === "Provenance" &&
      item.id === bundle.provenanceResourceId,
  );
  if (!provenance) errors.push("Provenance resource is missing.");
  if (
    new Set(bundle.resources.map((item) => `${item.resourceType}/${item.id}`))
      .size !== bundle.resources.length
  ) {
    errors.push("FHIR-aligned resource identifiers must be unique.");
  }
  if (
    bundle.resources.some(
      (item) =>
        !item.syntheticOnly ||
        !item.meta.security.includes("NO-LIVE-TRANSMISSION"),
    )
  ) {
    errors.push(
      "Every resource must retain the synthetic no-transmission label.",
    );
  }
  const patient = bundle.resources.find(
    (item) => item.resourceType === "Patient",
  );
  const episode = bundle.resources.find(
    (item) => item.resourceType === "EpisodeOfCare",
  );
  const expectedSubject = patient ? `Patient/${patient.id}` : null;
  const expectedEpisode = episode ? `EpisodeOfCare/${episode.id}` : null;
  const definitionTypes = new Set<M41cFhirAlignedResourceType>([
    "Patient",
    "Questionnaire",
    "Measure",
    "PlanDefinition",
  ]);
  for (const item of bundle.resources) {
    if (!item.id.startsWith("SYNTH-"))
      errors.push(`Resource ${item.resourceType}/${item.id} is not synthetic.`);
    if (!Number.isFinite(Date.parse(item.meta.lastUpdated)))
      errors.push(`Resource ${item.resourceType}/${item.id} has invalid time.`);
    if (
      !item.meta.security.includes("SYNTHETIC") ||
      !item.meta.security.includes("NO-LIVE-TRANSMISSION")
    ) {
      errors.push(
        `Resource ${item.resourceType}/${item.id} lacks security labels.`,
      );
    }
    if (
      !definitionTypes.has(item.resourceType) &&
      item.subjectReference !== expectedSubject
    ) {
      errors.push(
        `Resource ${item.resourceType}/${item.id} has inconsistent subject reference.`,
      );
    }
    if (
      !definitionTypes.has(item.resourceType) &&
      item.resourceType !== "EpisodeOfCare" &&
      item.episodeReference !== expectedEpisode
    ) {
      errors.push(
        `Resource ${item.resourceType}/${item.id} has inconsistent episode reference.`,
      );
    }
    if (
      (definitionTypes.has(item.resourceType) ||
        item.resourceType === "EpisodeOfCare") &&
      item.resourceType !== "Patient" &&
      definitionTypes.has(item.resourceType) &&
      (item.subjectReference !== null || item.episodeReference !== null)
    ) {
      errors.push(
        `Definition resource ${item.resourceType}/${item.id} must not carry subject references.`,
      );
    }
    if (item.sourceRecordIds.some((id) => !id.startsWith("SYNTH-")))
      errors.push(
        `Resource ${item.resourceType}/${item.id} has a non-synthetic source record.`,
      );
  }
  const consent = bundle.resources.find(
    (item) => item.resourceType === "Consent",
  );
  if (!consent || !["active", "not_required"].includes(consent.status))
    errors.push(
      "An active or not-required synthetic consent record is required.",
    );
  if (provenance) {
    const targets = Array.isArray(provenance.data.targetIds)
      ? provenance.data.targetIds.filter(
          (target): target is string => typeof target === "string",
        )
      : [];
    const requiredTargets = bundle.resources
      .filter((item) => item.resourceType !== "Provenance")
      .map((item) => item.id);
    if (requiredTargets.some((target) => !targets.includes(target)))
      errors.push("Provenance does not cover every projected resource.");
    if (provenance.data.externalTransmissionAvailable !== false)
      errors.push(
        "Provenance must record that external transmission is unavailable.",
      );
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    resourceCount: bundle.resources.length,
    provenancePresent: Boolean(provenance),
    externalWritesBlocked: !bundle.externalTransmissionAvailable,
  });
}

export function reconcileM41cCmbhsSnapshots(
  input: M41cCmbhsReconciliationInput,
): M41cCmbhsReconciliationResult {
  assertM41cSyntheticIdentifier(input.reconciliationId);
  assertM41cSyntheticIdentifier(input.localSnapshot.snapshotId);
  assertM41cSyntheticIdentifier(input.localSnapshot.subjectId);
  assertM41cSyntheticIdentifier(input.localSnapshot.episodeId);
  assertM41cSyntheticIdentifier(input.actorId);
  if (
    !["clinical-director", "clinical-supervisor", "chart-auditor"].includes(
      input.actorRole,
    )
  ) {
    throw new Error("M41C_CMBHS_RECONCILIATION_ROLE_DENIED");
  }
  if (
    input.localSnapshot.syntheticOnly !== true ||
    !input.localSnapshot.sourceVersion.trim()
  ) {
    throw new Error("M41C_CMBHS_SYNTHETIC_SNAPSHOT_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("M41C_CMBHS_RECONCILIATION_TIME_INVALID");
  }
  if (
    input.externalSnapshot &&
    (input.localSnapshot.subjectId !== input.externalSnapshot.subjectId ||
      input.localSnapshot.episodeId !== input.externalSnapshot.episodeId)
  ) {
    throw new Error("M41C_CMBHS_SNAPSHOT_IDENTITY_MISMATCH");
  }
  if (input.expectedFieldNames.length === 0) {
    throw new Error("M41C_CMBHS_EXPECTED_FIELDS_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(input.localSnapshot.capturedAt))) {
    throw new Error("M41C_CMBHS_SNAPSHOT_TIME_INVALID");
  }
  if (input.externalSnapshot) {
    assertM41cSyntheticIdentifier(input.externalSnapshot.snapshotId);
    assertM41cSyntheticIdentifier(input.externalSnapshot.subjectId);
    assertM41cSyntheticIdentifier(input.externalSnapshot.episodeId);
    if (
      input.externalSnapshot.syntheticOnly !== true ||
      !input.externalSnapshot.sourceVersion.trim()
    ) {
      throw new Error("M41C_CMBHS_SYNTHETIC_SNAPSHOT_REQUIRED");
    }
    if (!Number.isFinite(Date.parse(input.externalSnapshot.capturedAt))) {
      throw new Error("M41C_CMBHS_SNAPSHOT_TIME_INVALID");
    }
  }
  const external = input.externalServiceAvailable
    ? input.externalSnapshot
    : null;
  const differences = [...new Set(input.expectedFieldNames)]
    .sort()
    .map((fieldName) => {
      const localValue = input.localSnapshot.fields[fieldName];
      const externalValue = external?.fields[fieldName];
      const state =
        localValue === undefined
          ? "missing_local"
          : externalValue === undefined
            ? "missing_external"
            : localValue === externalValue
              ? "match"
              : "mismatch";
      return Object.freeze({
        fieldName,
        localValue,
        externalValue,
        state,
        humanReviewRequired: state !== "match",
      });
    });
  const status =
    !input.externalServiceAvailable || !external
      ? "outage"
      : differences.some((difference) => difference.state !== "match")
        ? "differences_pending"
        : "reconciled";
  const humanGate = buildM41cHumanGate({
    gateId: `${input.reconciliationId}-CMBHS-HUMAN-GATE`,
    accountableRoles: [
      "clinical-director",
      "clinical-supervisor",
      "chart-auditor",
    ],
    competencyIds: ["M41C-COMP-CMBHS-RECONCILIATION"],
  });
  const auditEvents = [
    createM41cAuditEvent({
      eventType: "mapping_projected",
      actorId: input.actorId,
      actorRole: input.actorRole,
      entityType: "mapping",
      entityId: input.reconciliationId,
      correlationId: input.reconciliationId,
      after: {
        mode: "read_and_reconcile_simulator",
        status,
        differenceCount: differences.filter(
          (difference) => difference.state !== "match",
        ).length,
        externalWriteAttempted: false,
      },
      rationale:
        "CMBHS data was compared in the synthetic read/reconcile simulator; no write surface exists.",
      occurredAt: input.occurredAt,
    }),
  ];
  return Object.freeze({
    reconciliationId: input.reconciliationId,
    mode: "read_and_reconcile_simulator",
    status,
    differences: Object.freeze(differences),
    humanGate,
    auditEvents: Object.freeze(auditEvents),
    externalWriteAttempted: false,
    externalWriteSucceeded: false,
    liveWrites: 0,
    productionRows: 0,
  });
}

export function attemptM41cCmbhsWrite(input: {
  actorId: string;
  actorRole: UserRole;
  reconciliationId: string;
  occurredAt: string;
}): M41cBlockedActionResult {
  return blockM41cControlledAction({
    action: "cmbhs_write",
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityId: input.reconciliationId,
    correlationId: input.reconciliationId,
    occurredAt: input.occurredAt,
  });
}
