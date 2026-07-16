import {
  M51A_CONTENT_TYPE_CODES,
  M51A_DOCUMENT_LIFECYCLE,
  M51A_LIBRARY_CODES,
  M51A_METADATA_FIELD_CODES,
  type M51aContentTypeCode,
  type M51aContentTypeDefinition,
  type M51aHubLibrary,
  type M51aHubSite,
  type M51aLibraryCode,
  type M51aMetadataDefinition,
  type M51aMetadataFieldCode,
} from "@contracts/m51a/operations-hub";
import { M51A_OPERATIONS_HUB_SITE_ID, m51aHubImmutable } from "./topology";

const ALL_METADATA = M51A_METADATA_FIELD_CODES;
const ALL_LIFECYCLE = M51A_DOCUMENT_LIFECYCLE;

function metadata(
  code: M51aMetadataFieldCode,
  label: string,
  valueType: M51aMetadataDefinition["valueType"],
  immutableAfterPublication: boolean,
): M51aMetadataDefinition {
  return m51aHubImmutable({
    fieldId: `SYNTH-M51A-METADATA-${code.toUpperCase().replace(/-/g, "_")}`,
    code,
    label,
    valueType,
    requiredForPublished: true,
    immutableAfterPublication,
    sourceOfAuthority: "AMOS-DMS",
    synthetic: true,
  });
}

function contentType(
  code: M51aContentTypeCode,
  name: string,
  purpose: string,
  allowedLibraries: readonly M51aLibraryCode[],
  controlled = true,
): M51aContentTypeDefinition {
  return m51aHubImmutable({
    contentTypeId: `SYNTH-M51A-CONTENT-TYPE-${code.toUpperCase()}`,
    code,
    name,
    purpose,
    requiredMetadataFields: m51aHubImmutable([...ALL_METADATA]),
    allowedLibraries: m51aHubImmutable([...allowedLibraries]),
    controlled,
    synthetic: true,
  });
}

function library(
  input: Omit<
    M51aHubLibrary,
    | "libraryId"
    | "siteId"
    | "requiredMetadataFields"
    | "permittedLifecycleStates"
    | "liveLibraryCreationAvailable"
    | "synthetic"
  >,
): M51aHubLibrary {
  return m51aHubImmutable({
    ...input,
    libraryId: `SYNTH-M51A-LIBRARY-${input.code.toUpperCase()}`,
    siteId: M51A_OPERATIONS_HUB_SITE_ID,
    allowedContentTypes: m51aHubImmutable([...input.allowedContentTypes]),
    requiredMetadataFields: m51aHubImmutable([...ALL_METADATA]),
    permittedLifecycleStates: m51aHubImmutable([...ALL_LIFECYCLE]),
    liveLibraryCreationAvailable: false,
    synthetic: true,
  });
}

export interface M51aHubContentModel {
  libraries: readonly M51aHubLibrary[];
  contentTypes: readonly M51aContentTypeDefinition[];
  metadataDefinitions: readonly M51aMetadataDefinition[];
  synthetic: true;
}

export function createSyntheticM51aHubContentModel(): M51aHubContentModel {
  const metadataDefinitions = m51aHubImmutable([
    metadata("amos_object_id", "AMOS Object ID", "stable_object_id", true),
    metadata("document_type", "Document Type", "choice", true),
    metadata("division", "Division", "choice", true),
    metadata("department_service_line", "Department / Service Line", "choice", false),
    metadata("program_campus", "Program / Campus", "choice", false),
    metadata("record_class", "Record Class", "choice", true),
    metadata("sensitivity", "Sensitivity", "choice", true),
    metadata("phi_part2_indicator", "PHI / Part 2 Indicator", "choice", true),
    metadata("lifecycle_status", "Lifecycle Status", "choice", false),
    metadata("owner", "Owner", "identity", false),
    metadata("approver", "Approver", "identity", false),
    metadata("effective_date", "Effective Date", "date", false),
    metadata("review_date", "Review Date", "date", false),
    metadata("retention_class", "Retention Class", "choice", true),
    metadata("source_system", "Source System", "string", true),
    metadata("authoritative_record_flag", "Authoritative Record", "boolean", false),
    metadata("intranet_state", "Intranet State", "choice", false),
    metadata("connector_state", "Connector State", "choice", false),
  ]);

  const contentTypes = m51aHubImmutable([
    contentType("controlled-policy", "Controlled Policy", "Approved enterprise or division policy.", ["enterprise-governance-doctrine", "policies-sops-standards", "published-intranet-content"]),
    contentType("standard-operating-procedure", "Standard Operating Procedure", "Controlled operating procedure or standard.", ["policies-sops-standards", "programs-service-operations", "published-intranet-content"]),
    contentType("form-template", "Form or Template", "Controlled reusable form or template.", ["forms-templates", "published-intranet-content"]),
    contentType("program-manual", "Program Manual", "Approved program, service-line, or campus operating manual.", ["programs-service-operations", "published-intranet-content"]),
    contentType("training-competency-module", "Training or Competency Module", "Controlled learning and competency content.", ["learning-knowledge", "published-intranet-content"]),
    contentType("contract-grant", "Contract or Grant", "Partnership, contract, or grant artifact.", ["contracts-partnerships", "legacy-intake-disposition"]),
    contentType("project-release-artifact", "Project or Release Artifact", "Project, change, release, or AMOS build artifact.", ["projects-change-releases", "legacy-intake-disposition"]),
    contentType("meeting-decision-record", "Meeting or Decision Record", "Governed meeting record, decision, or approval evidence.", ["enterprise-governance-doctrine", "quality-compliance-safety", "projects-change-releases"]),
    contentType("quality-compliance-evidence", "Quality or Compliance Evidence", "Quality, compliance, safety, or audit evidence.", ["quality-compliance-safety"]),
    contentType("intranet-knowledge-article", "Intranet Knowledge Article", "Source-visible approved operational guidance for staff.", ["learning-knowledge", "published-intranet-content"]),
    contentType("general-working-document", "General Working Document", "Non-authoritative collaborative working document.", ["programs-service-operations", "contracts-partnerships", "projects-change-releases", "legacy-intake-disposition"], false),
  ]);

  const libraries = m51aHubImmutable([
    library({ code: "enterprise-governance-doctrine", name: "Enterprise Governance & Doctrine", purpose: "Governed doctrine, charters, decisions, and enterprise control records.", ownerRole: "managing-director", allowedContentTypes: ["controlled-policy", "meeting-decision-record"], defaultHandlingClass: "internal-controlled", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "policies-sops-standards", name: "Policies, SOPs & Standards", purpose: "Controlled policy, procedure, and standards source records.", ownerRole: "administrator", allowedContentTypes: ["controlled-policy", "standard-operating-procedure"], defaultHandlingClass: "internal-controlled", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "forms-templates", name: "Forms & Templates", purpose: "Controlled reusable forms and templates.", ownerRole: "administrator", allowedContentTypes: ["form-template"], defaultHandlingClass: "internal-general", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "programs-service-operations", name: "Programs & Service Operations", purpose: "Program manuals, operating procedures, and general program working documents.", ownerRole: "administrator", allowedContentTypes: ["standard-operating-procedure", "program-manual", "general-working-document"], defaultHandlingClass: "internal-controlled", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "quality-compliance-safety", name: "Quality, Compliance & Safety", purpose: "Quality, compliance, audit, safety, and decision evidence.", ownerRole: "hr-compliance-officer", allowedContentTypes: ["quality-compliance-evidence", "meeting-decision-record"], defaultHandlingClass: "confidential", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "learning-knowledge", name: "Learning & Knowledge", purpose: "Learning modules, competency content, and knowledge articles before publishing.", ownerRole: "training-coordinator", allowedContentTypes: ["training-competency-module", "intranet-knowledge-article"], defaultHandlingClass: "internal-general", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "contracts-partnerships", name: "Contracts & Partnerships", purpose: "Controlled contract, grant, and partnership collaboration.", ownerRole: "managing-director", allowedContentTypes: ["contract-grant", "general-working-document"], defaultHandlingClass: "confidential", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "projects-change-releases", name: "Projects, Change & Releases", purpose: "Projects, changes, release artifacts, and governed decisions.", ownerRole: "super-admin", allowedContentTypes: ["project-release-artifact", "meeting-decision-record", "general-working-document"], defaultHandlingClass: "internal-controlled", authoritativeGuidanceEligible: false, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "published-intranet-content", name: "Published Intranet Content", purpose: "The only controlled roll-up source for authoritative staff guidance.", ownerRole: "administrator", allowedContentTypes: ["controlled-policy", "standard-operating-procedure", "form-template", "program-manual", "training-competency-module", "intranet-knowledge-article"], defaultHandlingClass: "internal-general", authoritativeGuidanceEligible: true, temporaryIntakeOnly: false, generalNavigationEligible: true }),
    library({ code: "legacy-intake-disposition", name: "Legacy Intake & Disposition", purpose: "Temporary read-only staging for inventory and approved disposition; never authoritative guidance.", ownerRole: "administrator", allowedContentTypes: ["contract-grant", "project-release-artifact", "general-working-document"], defaultHandlingClass: "internal-controlled", authoritativeGuidanceEligible: false, temporaryIntakeOnly: true, generalNavigationEligible: false }),
  ]);

  return m51aHubImmutable({
    libraries,
    contentTypes,
    metadataDefinitions,
    synthetic: true,
  });
}

export function validateM51aHubContentModel(
  model: M51aHubContentModel,
  sites: readonly M51aHubSite[],
): readonly string[] {
  const errors: string[] = [];
  const siteIds = new Set(sites.map((candidate) => candidate.siteId));
  const libraryCodes = new Set<M51aLibraryCode>();
  const contentTypeCodes = new Set<M51aContentTypeCode>();
  const metadataCodes = new Set<M51aMetadataFieldCode>();

  for (const item of model.libraries) {
    if (libraryCodes.has(item.code)) errors.push(`DUPLICATE_LIBRARY_CODE:${item.code}`);
    libraryCodes.add(item.code);
    if (!siteIds.has(item.siteId)) errors.push(`LIBRARY_SITE_MISSING:${item.code}`);
    if (item.allowedContentTypes.length === 0) errors.push(`LIBRARY_CONTENT_TYPE_REQUIRED:${item.code}`);
    if (new Set(item.requiredMetadataFields).size !== M51A_METADATA_FIELD_CODES.length || M51A_METADATA_FIELD_CODES.some((code) => !item.requiredMetadataFields.includes(code))) errors.push(`LIBRARY_METADATA_INCOMPLETE:${item.code}`);
    if (
      new Set(item.permittedLifecycleStates).size !==
        M51A_DOCUMENT_LIFECYCLE.length ||
      M51A_DOCUMENT_LIFECYCLE.some(
        (state) => !item.permittedLifecycleStates.includes(state),
      )
    )
      errors.push(`LIBRARY_LIFECYCLE_INCOMPLETE:${item.code}`);
    if (!item.ownerRole || !item.purpose.trim())
      errors.push(`LIBRARY_GOVERNANCE_INCOMPLETE:${item.code}`);
    if (item.liveLibraryCreationAvailable !== false || !item.synthetic) errors.push(`LIBRARY_SYNTHETIC_BOUNDARY_INVALID:${item.code}`);
  }
  for (const code of M51A_LIBRARY_CODES)
    if (!libraryCodes.has(code)) errors.push(`REQUIRED_LIBRARY_MISSING:${code}`);

  for (const item of model.contentTypes) {
    if (contentTypeCodes.has(item.code)) errors.push(`DUPLICATE_CONTENT_TYPE:${item.code}`);
    contentTypeCodes.add(item.code);
    if (item.allowedLibraries.length === 0) errors.push(`CONTENT_TYPE_LIBRARY_REQUIRED:${item.code}`);
    if (new Set(item.requiredMetadataFields).size !== M51A_METADATA_FIELD_CODES.length || M51A_METADATA_FIELD_CODES.some((code) => !item.requiredMetadataFields.includes(code))) errors.push(`CONTENT_TYPE_METADATA_INCOMPLETE:${item.code}`);
    if (item.allowedLibraries.some((code) => !M51A_LIBRARY_CODES.includes(code))) errors.push(`CONTENT_TYPE_LIBRARY_UNKNOWN:${item.code}`);
    if (!item.name.trim() || !item.purpose.trim())
      errors.push(`CONTENT_TYPE_GOVERNANCE_INCOMPLETE:${item.code}`);
  }
  for (const code of M51A_CONTENT_TYPE_CODES)
    if (!contentTypeCodes.has(code)) errors.push(`REQUIRED_CONTENT_TYPE_MISSING:${code}`);

  for (const field of model.metadataDefinitions) {
    if (metadataCodes.has(field.code)) errors.push(`DUPLICATE_METADATA_FIELD:${field.code}`);
    metadataCodes.add(field.code);
    if (!field.requiredForPublished || field.sourceOfAuthority !== "AMOS-DMS") errors.push(`PUBLISHED_METADATA_RULE_INVALID:${field.code}`);
    if (!field.label.trim()) errors.push(`METADATA_LABEL_REQUIRED:${field.code}`);
  }
  for (const code of M51A_METADATA_FIELD_CODES)
    if (!metadataCodes.has(code)) errors.push(`REQUIRED_METADATA_FIELD_MISSING:${code}`);

  const publishing = model.libraries.filter((item) => item.authoritativeGuidanceEligible);
  if (publishing.length !== 1 || publishing[0]?.code !== "published-intranet-content") errors.push("PUBLISHED_INTRANET_LIBRARY_MUST_BE_SOLE_AUTHORITY");
  const legacy = model.libraries.find((item) => item.code === "legacy-intake-disposition");
  if (!legacy || !legacy.temporaryIntakeOnly || legacy.authoritativeGuidanceEligible || legacy.generalNavigationEligible) errors.push("LEGACY_INTAKE_BOUNDARY_INVALID");

  return m51aHubImmutable([...new Set(errors)]);
}
