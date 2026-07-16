import {
  M51A_HUB_EVALUATION_AS_OF,
  M51A_METADATA_FIELD_CODES,
  type M51aContentTypeDefinition,
  type M51aHandlingClass,
  type M51aHubLibrary,
  type M51aIntranetPublishingCandidate,
  type M51aMetadataFieldCode,
  type M51aPublishingDecision,
} from "@contracts/m51a/operations-hub";
import {
  createSyntheticM51aHubContentModel,
  type M51aHubContentModel,
} from "./content-model";
import { createSyntheticM51aHandlingClasses } from "./handling-policy";
import {
  M51A_OPERATIONS_HUB_SITE_ID,
  m51aHubDeterministicId,
  m51aHubImmutable,
} from "./topology";

function completeMetadata(input: {
  objectId: string;
  documentType: string;
  sensitivity: string;
  lifecycle: string;
  owner: string;
  approver: string;
  effectiveAt: string;
  reviewDueAt: string;
  authoritative: boolean;
  intranetState: string;
}): Readonly<Record<M51aMetadataFieldCode, unknown>> {
  return m51aHubImmutable({
    amos_object_id: input.objectId,
    document_type: input.documentType,
    division: "enterprise",
    department_service_line: "enterprise-operations",
    program_campus: "adolbi-care-enterprise",
    record_class: "operational-guidance",
    sensitivity: input.sensitivity,
    phi_part2_indicator: "none",
    lifecycle_status: input.lifecycle,
    owner: input.owner,
    approver: input.approver,
    effective_date: input.effectiveAt,
    review_date: input.reviewDueAt,
    retention_class: "SYNTH-RET-POLICY-7Y",
    source_system: "AMOS-DMS",
    authoritative_record_flag: input.authoritative,
    intranet_state: input.intranetState,
    connector_state: "architecture-only-no-live-write",
  });
}

function candidate(
  input: Omit<
    M51aIntranetPublishingCandidate,
    "siteId" | "sourceSystem" | "realDataUsed" | "synthetic"
  >,
): M51aIntranetPublishingCandidate {
  return m51aHubImmutable({
    ...input,
    siteId: M51A_OPERATIONS_HUB_SITE_ID,
    sourceSystem: "AMOS-DMS",
    metadata: m51aHubImmutable({ ...input.metadata }),
    realDataUsed: false,
    synthetic: true,
  });
}

function validCandidate(input: {
  objectId: string;
  title: string;
  contentTypeCode: M51aIntranetPublishingCandidate["contentTypeCode"];
  ownerRole: M51aIntranetPublishingCandidate["ownerRole"];
  approverRole: NonNullable<M51aIntranetPublishingCandidate["approverRole"]>;
}): M51aIntranetPublishingCandidate {
  const effectiveAt = "2026-01-01T00:00:00.000Z";
  const reviewDueAt = "2027-12-31T23:59:59.000Z";
  const ownerId = `SYNTH-HUMAN-${input.ownerRole.toUpperCase()}`;
  const approverId = `SYNTH-HUMAN-${input.approverRole.toUpperCase()}`;
  return candidate({
    objectId: input.objectId,
    title: input.title,
    libraryCode: "published-intranet-content",
    contentTypeCode: input.contentTypeCode,
    handlingClass: "internal-controlled",
    lifecycleState: "Published",
    approvalState: "approved",
    ownerId,
    ownerRole: input.ownerRole,
    approverId,
    approverRole: input.approverRole,
    effectiveAt,
    reviewDueAt,
    authoritativeRecord: true,
    intranetState: "published",
    sourceOfTruthUri: `amos-dms://synthetic/${input.objectId}`,
    contentHash: `sha256:${input.objectId.toLowerCase()}-content-v1`,
    metadata: completeMetadata({
      objectId: input.objectId,
      documentType: input.contentTypeCode,
      sensitivity: "internal-controlled",
      lifecycle: "Published",
      owner: ownerId,
      approver: approverId,
      effectiveAt,
      reviewDueAt,
      authoritative: true,
      intranetState: "published",
    }),
  });
}

export function createSyntheticM51aPublishingCandidates(): readonly M51aIntranetPublishingCandidate[] {
  const policy = validCandidate({
    objectId: "SYNTH-AMOS-DMS-OBJECT-POLICY-001",
    title: "Synthetic Enterprise Safety Policy",
    contentTypeCode: "controlled-policy",
    ownerRole: "administrator",
    approverRole: "managing-director",
  });
  const article = validCandidate({
    objectId: "SYNTH-AMOS-DMS-OBJECT-ARTICLE-001",
    title: "Synthetic Operations Hub Staff Guide",
    contentTypeCode: "intranet-knowledge-article",
    ownerRole: "training-coordinator",
    approverRole: "administrator",
  });
  return m51aHubImmutable([
    policy,
    article,
    candidate({
      ...policy,
      objectId: "SYNTH-AMOS-DMS-OBJECT-DRAFT-001",
      title: "Synthetic Draft Guidance",
      lifecycleState: "Draft",
      approvalState: "pending",
      approverId: null,
      approverRole: null,
      authoritativeRecord: false,
      intranetState: "review",
      sourceOfTruthUri: "amos-dms://synthetic/SYNTH-AMOS-DMS-OBJECT-DRAFT-001",
      contentHash: "sha256:synth-draft-guidance-v1",
      metadata: {
        ...policy.metadata,
        amos_object_id: "SYNTH-AMOS-DMS-OBJECT-DRAFT-001",
        lifecycle_status: "Draft",
        authoritative_record_flag: false,
        intranet_state: "review",
      },
    }),
    candidate({
      ...policy,
      objectId: "SYNTH-AMOS-DMS-OBJECT-SUPERSEDED-001",
      title: "Synthetic Superseded Guidance",
      lifecycleState: "Superseded",
      intranetState: "withdrawn",
      sourceOfTruthUri: "amos-dms://synthetic/SYNTH-AMOS-DMS-OBJECT-SUPERSEDED-001",
      contentHash: "sha256:synth-superseded-guidance-v1",
      metadata: {
        ...policy.metadata,
        amos_object_id: "SYNTH-AMOS-DMS-OBJECT-SUPERSEDED-001",
        lifecycle_status: "Superseded",
        intranet_state: "withdrawn",
      },
    }),
    candidate({
      ...article,
      objectId: "SYNTH-AMOS-DMS-OBJECT-LEGACY-001",
      title: "Synthetic Legacy Intake Item",
      libraryCode: "legacy-intake-disposition",
      sourceOfTruthUri: "amos-dms://synthetic/SYNTH-AMOS-DMS-OBJECT-LEGACY-001",
      contentHash: "sha256:synth-legacy-intake-v1",
      metadata: {
        ...article.metadata,
        amos_object_id: "SYNTH-AMOS-DMS-OBJECT-LEGACY-001",
      },
    }),
    candidate({
      ...article,
      objectId: "SYNTH-AMOS-DMS-OBJECT-PART2-001",
      title: "Synthetic Part 2 Restricted Item",
      handlingClass: "restricted-sud-part2",
      sourceOfTruthUri: "amos-dms://synthetic/SYNTH-AMOS-DMS-OBJECT-PART2-001",
      contentHash: "sha256:synth-part2-restricted-v1",
      metadata: {
        ...article.metadata,
        amos_object_id: "SYNTH-AMOS-DMS-OBJECT-PART2-001",
        sensitivity: "restricted-sud-part2",
        phi_part2_indicator: "part2",
      },
    }),
    candidate({
      ...policy,
      objectId: "SYNTH-AMOS-DMS-OBJECT-OVERDUE-001",
      title: "Synthetic Overdue Guidance",
      reviewDueAt: "2026-06-30T23:59:59.000Z",
      sourceOfTruthUri: "amos-dms://synthetic/SYNTH-AMOS-DMS-OBJECT-OVERDUE-001",
      contentHash: "sha256:synth-overdue-guidance-v1",
      metadata: {
        ...policy.metadata,
        amos_object_id: "SYNTH-AMOS-DMS-OBJECT-OVERDUE-001",
        review_date: "2026-06-30T23:59:59.000Z",
      },
    }),
  ]);
}

function metadataComplete(
  candidateRecord: M51aIntranetPublishingCandidate,
): boolean {
  return M51A_METADATA_FIELD_CODES.every((field) => {
    const value = candidateRecord.metadata[field];
    return value !== undefined && value !== null && value !== "";
  });
}

function metadataCoherenceErrors(
  candidateRecord: M51aIntranetPublishingCandidate,
): readonly string[] {
  const expected: readonly [M51aMetadataFieldCode, unknown][] = [
    ["amos_object_id", candidateRecord.objectId],
    ["document_type", candidateRecord.contentTypeCode],
    ["sensitivity", candidateRecord.handlingClass],
    ["lifecycle_status", candidateRecord.lifecycleState],
    ["owner", candidateRecord.ownerId],
    ["approver", candidateRecord.approverId],
    ["effective_date", candidateRecord.effectiveAt],
    ["review_date", candidateRecord.reviewDueAt],
    ["source_system", candidateRecord.sourceSystem],
    ["authoritative_record_flag", candidateRecord.authoritativeRecord],
    ["intranet_state", candidateRecord.intranetState],
  ];
  return m51aHubImmutable(
    expected
      .filter(([field, value]) => candidateRecord.metadata[field] !== value)
      .map(([field]) => `PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:${field}`),
  );
}

export function evaluateM51aAuthoritativePublishing(
  candidateRecord: M51aIntranetPublishingCandidate,
  model: M51aHubContentModel = createSyntheticM51aHubContentModel(),
  handlingClasses: readonly M51aHandlingClass[] =
    createSyntheticM51aHandlingClasses(),
  evaluatedAt: string = M51A_HUB_EVALUATION_AS_OF,
): M51aPublishingDecision {
  const reasonCodes: string[] = [];
  const library: M51aHubLibrary | undefined = model.libraries.find(
    (item) => item.code === candidateRecord.libraryCode,
  );
  const contentType: M51aContentTypeDefinition | undefined =
    model.contentTypes.find(
      (item) => item.code === candidateRecord.contentTypeCode,
    );
  const handlingClass = handlingClasses.find(
    (item) => item.code === candidateRecord.handlingClass,
  );

  if (!library) reasonCodes.push("LIBRARY_NOT_REGISTERED");
  else {
    if (library.code !== "published-intranet-content")
      reasonCodes.push("PUBLISHED_INTRANET_CONTENT_LIBRARY_REQUIRED");
    if (!library.authoritativeGuidanceEligible)
      reasonCodes.push("LIBRARY_NOT_AUTHORITATIVE_GUIDANCE_ELIGIBLE");
    if (!library.allowedContentTypes.includes(candidateRecord.contentTypeCode))
      reasonCodes.push("CONTENT_TYPE_NOT_ALLOWED_IN_LIBRARY");
  }
  if (!contentType) reasonCodes.push("CONTENT_TYPE_NOT_REGISTERED");
  if (!handlingClass) reasonCodes.push("HANDLING_CLASS_NOT_REGISTERED");
  else if (!handlingClass.generalHubRollupAllowed)
    reasonCodes.push("HANDLING_CLASS_GENERAL_ROLLUP_DENIED");
  if (candidateRecord.siteId !== M51A_OPERATIONS_HUB_SITE_ID)
    reasonCodes.push("OPERATIONS_HUB_SITE_REQUIRED");
  if (candidateRecord.lifecycleState !== "Published")
    reasonCodes.push(`LIFECYCLE_NOT_PUBLISHED:${candidateRecord.lifecycleState}`);
  if (candidateRecord.approvalState !== "approved")
    reasonCodes.push("APPROVAL_REQUIRED");
  if (!candidateRecord.approverId || !candidateRecord.approverRole)
    reasonCodes.push("ACCOUNTABLE_APPROVER_REQUIRED");
  if (!candidateRecord.authoritativeRecord)
    reasonCodes.push("AUTHORITATIVE_RECORD_FLAG_REQUIRED");
  if (candidateRecord.intranetState !== "published")
    reasonCodes.push("INTRANET_STATE_NOT_PUBLISHED");
  if (!candidateRecord.ownerId || !candidateRecord.ownerRole)
    reasonCodes.push("ACCOUNTABLE_OWNER_REQUIRED");
  if (
    !candidateRecord.effectiveAt ||
    !Number.isFinite(Date.parse(candidateRecord.effectiveAt)) ||
    Date.parse(candidateRecord.effectiveAt) > Date.parse(evaluatedAt)
  )
    reasonCodes.push("EFFECTIVE_DATE_INVALID");
  if (
    !candidateRecord.reviewDueAt ||
    !Number.isFinite(Date.parse(candidateRecord.reviewDueAt)) ||
    Date.parse(candidateRecord.reviewDueAt) < Date.parse(evaluatedAt)
  )
    reasonCodes.push("REVIEW_OVERDUE_OR_INVALID");
  if (!/^SYNTH-AMOS-DMS-OBJECT-[A-Z0-9-]+$/.test(candidateRecord.objectId))
    reasonCodes.push("STABLE_AMOS_OBJECT_ID_REQUIRED");
  if (!candidateRecord.sourceOfTruthUri.startsWith("amos-dms://synthetic/"))
    reasonCodes.push("AMOS_DMS_SOURCE_OF_TRUTH_REQUIRED");
  if (!candidateRecord.contentHash.startsWith("sha256:"))
    reasonCodes.push("CONTENT_HASH_REQUIRED");
  if (!metadataComplete(candidateRecord))
    reasonCodes.push("REQUIRED_PUBLISHED_METADATA_INCOMPLETE");
  reasonCodes.push(...metadataCoherenceErrors(candidateRecord));
  if (candidateRecord.realDataUsed || !candidateRecord.synthetic)
    reasonCodes.push("SYNTHETIC_BOUNDARY_REQUIRED");

  const eligible = reasonCodes.length === 0;
  return m51aHubImmutable({
    decisionId: m51aHubDeterministicId(
      "M51A-PUBLISHING",
      candidateRecord.objectId,
      evaluatedAt,
    ),
    objectId: candidateRecord.objectId,
    authoritativeGuidanceEligible: eligible,
    reasonCodes: m51aHubImmutable(
      eligible ? ["AUTHORITATIVE_GUIDANCE_ALLOWED"] : reasonCodes,
    ),
    citation: eligible
      ? m51aHubImmutable({
          objectId: candidateRecord.objectId,
          title: candidateRecord.title,
          sourceSystem: "AMOS-DMS" as const,
          sourceOfTruthUri: candidateRecord.sourceOfTruthUri,
          contentHash: candidateRecord.contentHash,
          ownerRole: candidateRecord.ownerRole,
          approverRole: candidateRecord.approverRole!,
          effectiveAt: candidateRecord.effectiveAt!,
          reviewDueAt: candidateRecord.reviewDueAt!,
          synthetic: true as const,
        })
      : null,
    liveMicrosoftPublishPerformed: false,
    liveExternalWrites: 0,
    synthetic: true,
  });
}

export function selectM51aAuthoritativeGuidance(
  candidates: readonly M51aIntranetPublishingCandidate[],
  evaluatedAt: string = M51A_HUB_EVALUATION_AS_OF,
): {
  decisions: readonly M51aPublishingDecision[];
  citations: readonly NonNullable<M51aPublishingDecision["citation"]>[];
  deniedObjectIds: readonly string[];
  liveExternalWrites: 0;
  synthetic: true;
} {
  const decisions = m51aHubImmutable(
    candidates.map((item) =>
      evaluateM51aAuthoritativePublishing(
        item,
        createSyntheticM51aHubContentModel(),
        createSyntheticM51aHandlingClasses(),
        evaluatedAt,
      ),
    ),
  );
  return m51aHubImmutable({
    decisions,
    citations: m51aHubImmutable(
      decisions
        .map((decision) => decision.citation)
        .filter(
          (
            citation,
          ): citation is NonNullable<M51aPublishingDecision["citation"]> =>
            citation !== null,
        ),
    ),
    deniedObjectIds: m51aHubImmutable(
      decisions
        .filter((decision) => !decision.authoritativeGuidanceEligible)
        .map((decision) => decision.objectId),
    ),
    liveExternalWrites: 0,
    synthetic: true,
  });
}
