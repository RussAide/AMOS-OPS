import type { UserRole } from "../../src/constants/roles";
import type {
  M42AuditEvent,
  M42RoleTier,
  M42SensitivityLevel,
  M42SourceCitation,
} from "./shared";

export const M42_REPORT_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "in",
] as const;
export type M42ReportOperator = (typeof M42_REPORT_OPERATORS)[number];
export type M42ReportScalar = string | number | boolean | null;
export type M42ReportDataType = "string" | "number" | "boolean" | "date";

export interface M42ReportFieldDefinition {
  fieldId: string;
  label: string;
  dataType: M42ReportDataType;
  classification: M42SensitivityLevel;
  allowedTiers: readonly M42RoleTier[];
  requiredPermission: string;
  sourcePath: string;
  exportable: boolean;
  synthetic: true;
}

export interface M42ReportSourceDefinition {
  sourceId: string;
  title: string;
  version: string;
  sourceOfTruthUri: string;
  ownerRole: UserRole;
  fields: readonly M42ReportFieldDefinition[];
  citation: M42SourceCitation;
  synthetic: true;
}

export interface M42ReportFilter {
  fieldId: string;
  operator: M42ReportOperator;
  value: M42ReportScalar | readonly M42ReportScalar[];
}

export interface M42ReportDefinitionDraft {
  stableKey: string;
  title: string;
  purpose: string;
  sourceId: string;
  selectedFieldIds: readonly string[];
  filters: readonly M42ReportFilter[];
  exportEnabled: boolean;
}

export interface M42SavedReportDefinition extends M42ReportDefinitionDraft {
  definitionId: string;
  version: number;
  previousDefinitionId: string | null;
  createdBy: string;
  createdByRole: UserRole;
  createdAt: string;
  immutable: true;
  synthetic: true;
}

export interface M42ReportFieldLineage {
  fieldId: string;
  sourcePath: string;
  classification: M42SensitivityLevel;
  sourceId: string;
  sourceVersion: string;
}

export interface M42ReportLineage {
  lineageId: string;
  definitionId: string;
  definitionVersion: number;
  definitionHash: string;
  sourceIds: readonly string[];
  sourceCitations: readonly M42SourceCitation[];
  fields: readonly M42ReportFieldLineage[];
  filters: readonly M42ReportFilter[];
  generatedAt: string;
  immutable: true;
  synthetic: true;
}

export interface M42ReportExecution {
  executionId: string;
  definitionId: string;
  definitionVersion: number;
  executedBy: string;
  executedByRole: UserRole;
  executedAt: string;
  selectedFieldIds: readonly string[];
  concealedFieldIds: readonly string[];
  rows: readonly Readonly<Record<string, M42ReportScalar>>[];
  rowCount: number;
  lineage: M42ReportLineage;
  permissionTrimmedBeforeSelection: true;
  realDataUsed: false;
  externalWritePerformed: false;
  synthetic: true;
}

export interface M42ReportExportManifest {
  manifestId: string;
  executionId: string;
  definitionId: string;
  definitionVersion: number;
  requestedBy: string;
  requestedByRole: UserRole;
  createdAt: string;
  format: "csv-manifest" | "json-manifest";
  fieldIds: readonly string[];
  concealedFieldIds: readonly string[];
  rowCount: number;
  contentSha256: string;
  deliveryStatus: "manifest_only_demo_boundary";
  externalRecipient: null;
  liveRepositoryWrite: false;
  realDataUsed: false;
  immutable: true;
  synthetic: true;
}

export type M42ConfigurationValue =
  string | number | boolean | readonly string[];
export type M42ConfigurationValueType =
  "string" | "number" | "boolean" | "string_list";

export interface M42ConfigurationSchema {
  configKey: string;
  label: string;
  description: string;
  valueType: M42ConfigurationValueType;
  domain: "records" | "search" | "reporting" | "workspace";
  requiredPermission: string;
  allowedTiers: readonly M42RoleTier[];
  approvalRequired: boolean;
  approvalRoles: readonly UserRole[];
  minimum?: number;
  maximum?: number;
  allowedValues?: readonly string[];
  productionConnectorMutationAvailable: false;
  synthetic: true;
}

export interface M42ConfigurationVersion {
  versionId: string;
  configKey: string;
  version: number;
  previousVersionId: string | null;
  value: M42ConfigurationValue;
  changeType: "initial" | "change" | "rollback";
  reason: string;
  changedBy: string;
  changedByRole: UserRole;
  changedAt: string;
  approvedBy: string | null;
  approvalId: string | null;
  rollbackTargetVersionId: string | null;
  immutable: true;
  synthetic: true;
}

export interface M42ConfigurationPreview {
  previewId: string;
  action: "change" | "rollback";
  configKey: string;
  currentVersionId: string;
  currentValue: M42ConfigurationValue;
  proposedValue: M42ConfigurationValue;
  rollbackTargetVersionId: string | null;
  requestedBy: string;
  requestedByRole: UserRole;
  requestedAt: string;
  reason: string;
  valid: boolean;
  validationErrors: readonly string[];
  approvalRequired: boolean;
  approvalRoles: readonly UserRole[];
  mutatesState: false;
  synthetic: true;
}

export interface M42ConfigurationApproval {
  approvalId: string;
  previewId: string;
  approvedBy: string;
  approvedByRole: UserRole;
  approvedAt: string;
  rationale: string;
  immutable: true;
  synthetic: true;
}

export interface M42ConfigurationApplyResult {
  preview: M42ConfigurationPreview;
  version: M42ConfigurationVersion;
  approval: M42ConfigurationApproval | null;
  auditEvents: readonly M42AuditEvent[];
  rollbackCreatedNewVersion: boolean;
  liveConnectorMutation: false;
  synthetic: true;
}

export interface M42ReportBuilderSnapshot {
  sources: readonly M42ReportSourceDefinition[];
  definitions: readonly M42SavedReportDefinition[];
  auditEvents: readonly M42AuditEvent[];
  immutableDefinitions: true;
  synthetic: true;
}

export interface M42ConfigurationSnapshot {
  schemas: readonly M42ConfigurationSchema[];
  versions: readonly M42ConfigurationVersion[];
  auditEvents: readonly M42AuditEvent[];
  appendOnlyHistory: true;
  synthetic: true;
}
