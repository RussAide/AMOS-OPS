// AMOS-OPS Database Schema
// SQLite with Drizzle ORM

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Users & Authentication ──────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role", { enum: [
    "administrator",
    "hr-director",
    "supervisor",
    "clinical-director",
    "gro-staff",
    "qa-officer",
    "training-coordinator",
    "operations-manager",
  ] }).notNull().default("gro-staff"),
  department: text("department"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── HR People (Candidates & Employees) ──────────────────────

export const hrPeople = sqliteTable("hr_people", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  employeeId: text("employee_id"),
  role: text("role").notNull(),
  department: text("department").notNull(),
  lane: text("lane", { enum: ["activation", "management"] }).notNull().default("activation"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isEmployee: integer("is_employee", { mode: "boolean" }).notNull().default(false),
  hireDate: text("hire_date"),
  supervisor: text("supervisor"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Module Statuses ─────────────────────────────────────────

export const moduleStatuses = sqliteTable("module_statuses", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  moduleId: text("module_id").notNull(),
  statusId: text("status_id").notNull(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Status Transitions (Audit Trail) ────────────────────────

export const statusTransitions = sqliteTable("status_transitions", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  personName: text("person_name").notNull(),
  moduleId: text("module_id").notNull(),
  moduleName: text("module_name").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: text("changed_at").$defaultFn(() => new Date().toISOString()),
  note: text("note"),
});

// ─── Documents ───────────────────────────────────────────────

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  moduleId: text("module_id").notNull(),
  recordName: text("record_name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path"),
  uploadedAt: text("uploaded_at").$defaultFn(() => new Date().toISOString()),
  uploadedBy: text("uploaded_by"),
  verifiedAt: text("verified_at"),
  verifiedBy: text("verified_by"),
  status: text("status", { enum: ["uploaded", "verified", "rejected", "expired"] }).notNull().default("uploaded"),
  expiryDate: text("expiry_date"),
  note: text("note"),
});

// ─── Training Modules ────────────────────────────────────────

export const trainingModules = sqliteTable("training_modules", {
  id: text("id").primaryKey(),
  trackId: text("track_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  stepCount: integer("step_count").notNull().default(5),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Training Progress ───────────────────────────────────────

export const trainingProgress = sqliteTable("training_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  completedSteps: integer("completed_steps").notNull().default(0),
  status: text("status", { enum: ["available", "in-progress", "completed"] }).notNull().default("available"),
  quizScore: integer("quiz_score"),
  quizPassed: integer("quiz_passed", { mode: "boolean" }).default(false),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

// ─── Credentials ─────────────────────────────────────────────

export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  credentialType: text("credential_type").notNull(),
  licenseNumber: text("license_number"),
  issuingBody: text("issuing_body"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  status: text("status", { enum: ["valid", "expiring", "expired", "pending"] }).notNull().default("pending"),
  documentId: text("document_id"),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Performance Reviews ─────────────────────────────────────

export const performanceReviews = sqliteTable("performance_reviews", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  reviewType: text("review_type", { enum: ["30-day", "90-day", "annual", "corrective"] }).notNull(),
  reviewDate: text("review_date").notNull(),
  competencies: text("competencies"),
  goals: text("goals"),
  supervisorComments: text("supervisor_comments"),
  actionItems: text("action_items"),
  overallRating: text("overall_rating", { enum: ["exceeds", "meets", "needs-improvement", "unsatisfactory"] }),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  signedOffBy: text("signed_off_by"),
  signedOffAt: text("signed_off_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Separation Checklists ───────────────────────────────────

export const separationChecklists = sqliteTable("separation_checklists", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  itemId: text("item_id").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedBy: text("completed_by"),
  completedAt: text("completed_at"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Audit Logs ──────────────────────────────────────────────

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  performedBy: text("performed_by").notNull(),
  performedAt: text("performed_at").$defaultFn(() => new Date().toISOString()),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// ─── Form Templates ──────────────────────────────────────────

export const formTemplates = sqliteTable("form_templates", {
  id: text("id").primaryKey(),
  formCode: text("form_code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  binderArea: text("binder_area").notNull(),
  binderAreaIndex: integer("binder_area_index").notNull().default(0),
  lifecycleModule: text("lifecycle_module"),
  roleApplicabilityJson: text("role_applicability_json"),
  triggeringStatus: text("triggering_status"),
  requiredForGate: integer("required_for_gate", { mode: "boolean" }).notNull().default(false),
  signatureRequired: integer("signature_required", { mode: "boolean" }).notNull().default(false),
  reviewerRequired: integer("reviewer_required", { mode: "boolean" }).notNull().default(false),
  outputFormat: text("output_format", { enum: ["pdf", "docx"] }).notNull().default("pdf"),
  sourcePdfPath: text("source_pdf_path"),
  activeVersion: integer("active_version").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  retentionCategory: text("retention_category"),
  renewalRule: text("renewal_rule"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Form Template Fields ────────────────────────────────────

export const formTemplateFields = sqliteTable("form_template_fields", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  fieldType: text("field_type", { enum: [
    "text", "textarea", "date", "checkbox", "select", "multiselect",
    "number", "email", "phone", "signature", "initials", "file",
  ] }).notNull(),
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  optionsJson: text("options_json"),
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  defaultValue: text("default_value"),
  validationRegex: text("validation_regex"),
  sortOrder: integer("sort_order").notNull().default(0),
  section: text("section"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Form Role Bindings ──────────────────────────────────────

export const formRoleBindings = sqliteTable("form_role_bindings", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  role: text("role").notNull(),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  isAutoAssigned: integer("is_auto_assigned", { mode: "boolean" }).notNull().default(true),
  assignmentTrigger: text("assignment_trigger").notNull().default("on-create"),
  dueDays: integer("due_days").notNull().default(7),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Form Instances ──────────────────────────────────────────

export const formInstances = sqliteTable("form_instances", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  personId: text("person_id").notNull(),
  moduleId: text("module_id"),
  packetId: text("packet_id"),
  status: text("status", { enum: [
    "draft", "assigned", "in-progress", "submitted",
    "under-review", "returned-for-correction", "approved",
    "locked", "filed-to-dms", "expired", "waived", "superseded",
  ] }).notNull().default("assigned"),
  assignedToUserId: text("assigned_to_user_id"),
  assignedByUserId: text("assigned_by_user_id"),
  assignedAt: text("assigned_at").$defaultFn(() => new Date().toISOString()),
  dueDate: text("due_date"),
  overdueReminderSent: integer("overdue_reminder_sent", { mode: "boolean" }).notNull().default(false),
  submittedByUserId: text("submitted_by_user_id"),
  submittedAt: text("submitted_at"),
  reviewedByUserId: text("reviewed_by_user_id"),
  reviewedAt: text("reviewed_at"),
  returnedReason: text("returned_reason"),
  approvedAt: text("approved_at"),
  lockedAt: text("locked_at"),
  dmsArtifactId: text("dms_artifact_id"),
  fieldValuesJson: text("field_values_json"),
  auditVersion: integer("audit_version").notNull().default(1),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Form Packets ────────────────────────────────────────────

export const formPackets = sqliteTable("form_packets", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  packetType: text("packet_type", { enum: [
    "candidate-intake", "conditional-offer", "pre-employment",
    "screening", "final-agreement", "orientation", "training",
    "clearance", "personnel-file", "audit",
  ] }).notNull(),
  status: text("status", { enum: [
    "packet-not-started", "packet-building", "packet-incomplete",
    "packet-ready-for-review", "packet-approved", "packet-locked", "packet-filed",
  ] }).notNull().default("packet-not-started"),
  requiredFormIdsJson: text("required_form_ids_json"),
  completedFormIdsJson: text("completed_form_ids_json"),
  missingFormIdsJson: text("missing_form_ids_json"),
  packetArtifactId: text("packet_artifact_id"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  approvedAt: text("approved_at"),
  filedAt: text("filed_at"),
});

// ─── BHC: Insurance Plans ────────────────────────────────────

export const insurancePlans = sqliteTable("insurance_plans", {
  id: text("id").primaryKey(),
  payerName: text("payer_name").notNull(),
  planName: text("plan_name").notNull(),
  policyNumberPattern: text("policy_number_pattern"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── BHC: Patients ───────────────────────────────────────────

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  mrn: text("mrn").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: text("gender", { enum: ["male", "female", "non_binary", "prefer_not_say"] }),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  insuranceId: text("insurance_id"),
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  referralSource: text("referral_source"),
  status: text("status", { enum: ["intake", "active", "hold", "discharged", "transferred"] }).notNull().default("intake"),
  assignedClinicianId: text("assigned_clinician_id"),
  intakeDate: text("intake_date").$defaultFn(() => new Date().toISOString()),
  dischargeDate: text("discharge_date"),
  dischargeReason: text("discharge_reason"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

// ─── BHC: Treatment Plans ────────────────────────────────────

export const treatmentPlans = sqliteTable("treatment_plans", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  planNumber: text("plan_number").notNull(),
  status: text("status", { enum: ["draft", "active", "under_review", "completed", "discontinued"] }).notNull().default("draft"),
  primaryDiagnosis: text("primary_diagnosis").notNull(),
  secondaryDiagnosis: text("secondary_diagnosis"),
  presentingProblem: text("presenting_problem").notNull(),
  goalsJson: text("goals_json").notNull().default("[]"),
  interventionsJson: text("interventions_json").notNull().default("[]"),
  estimatedDurationWeeks: integer("estimated_duration_weeks"),
  startDate: text("start_date"),
  reviewDate: text("review_date"),
  endDate: text("end_date"),
  assignedClinicianId: text("assigned_clinician_id").notNull(),
  supervisorId: text("supervisor_id"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── BHC: Clinical Sessions ──────────────────────────────────

export const clinicalSessions = sqliteTable("clinical_sessions", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  treatmentPlanId: text("treatment_plan_id"),
  clinicianId: text("clinician_id").notNull(),
  sessionDate: text("session_date").notNull(),
  sessionType: text("session_type", { enum: ["individual", "group", "family", "couples", "intake", "crisis", "telehealth"] }),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  chiefComplaint: text("chief_complaint"),
  sessionNotes: text("session_notes"),
  interventionsUsedJson: text("interventions_used_json").default("[]"),
  clientResponse: text("client_response"),
  planModifications: text("plan_modifications"),
  riskAssessmentJson: text("risk_assessment_json"),
  nextSessionDate: text("next_session_date"),
  nextSessionGoals: text("next_session_goals"),
  status: text("status", { enum: ["scheduled", "in_progress", "completed", "cancelled", "no_show"] }).notNull().default("scheduled"),
  billingCode: text("billing_code"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── BHC: Outcome Measures ───────────────────────────────────

export const outcomeMeasures = sqliteTable("outcome_measures", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  sessionId: text("session_id"),
  measureType: text("measure_type", { enum: ["PHQ-9", "GAD-7", "PSS-10", "WHO-5", "DASS-21", "PCL-5", "CGI-S"] }).notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  severityLevel: text("severity_level", { enum: ["none", "minimal", "mild", "moderate", "moderately_severe", "severe"] }),
  administeredBy: text("administered_by").notNull(),
  administeredAt: text("administered_at").$defaultFn(() => new Date().toISOString()),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Revenue: Payers ─────────────────────────────────────────

export const payers = sqliteTable("payers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  payerType: text("payer_type", { enum: ["insurance", "medicaid", "medicare", "self_pay", "other"] }).notNull().default("insurance"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  claimsAddress: text("claims_address"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Revenue: Claims ─────────────────────────────────────────

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  claimNumber: text("claim_number").notNull().unique(),
  patientId: text("patient_id").notNull(),
  payerId: text("payer_id"),
  clinicianId: text("clinician_id").notNull(),
  serviceDate: text("service_date").notNull(),
  submissionDate: text("submission_date"),
  status: text("status", { enum: ["draft", "pending", "submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid", "write_off"] }).notNull().default("draft"),
  totalAmount: integer("total_amount").notNull(), // cents
  allowedAmount: integer("allowed_amount"), // cents
  paidAmount: integer("paid_amount"), // cents
  patientResponsibility: integer("patient_responsibility"), // cents
  denialReason: text("denial_reason"),
  denialCode: text("denial_code"),
  appealDate: text("appeal_date"),
  appealStatus: text("appeal_status", { enum: ["not_appealed", "in_review", "approved", "denied"] }).notNull().default("not_appealed"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Revenue: Claim Line Items ───────────────────────────────

export const claimLineItems = sqliteTable("claim_line_items", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  serviceDate: text("service_date").notNull(),
  procedureCode: text("procedure_code").notNull(), // CPT/HCPCS
  diagnosisCode: text("diagnosis_code"), // ICD-10
  units: integer("units").notNull().default(1),
  unitPrice: integer("unit_price").notNull(), // cents
  totalPrice: integer("total_price").notNull(), // cents
  description: text("description"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── QA: Audits ──────────────────────────────────────────────

export const audits = sqliteTable("audits_qa", {
  id: text("id").primaryKey(),
  auditNumber: text("audit_number").notNull().unique(),
  title: text("title").notNull(),
  auditType: text("audit_type", { enum: ["internal", "external", "regulatory", "peer_review", "random"] }).notNull(),
  scope: text("scope").notNull(), // description of what's being audited
  status: text("status", { enum: ["planned", "in_progress", "pending_review", "completed", "closed"] }).notNull().default("planned"),
  assignedAuditorId: text("assigned_auditor_id"),
  department: text("department"),
  findingsJson: text("findings_json").default("[]"),
  score: integer("score"), // 0-100
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  dueDate: text("due_date"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── QA: Incidents ───────────────────────────────────────────

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  incidentNumber: text("incident_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  incidentType: text("incident_type", { enum: ["medication_error", "fall", "behavioral", "clinical_error", "equipment", "environmental", "other"] }).notNull(),
  severity: text("severity", { enum: ["low", "moderate", "high", "critical"] }).notNull(),
  status: text("status", { enum: ["open", "under_investigation", "resolved", "closed"] }).notNull().default("open"),
  patientId: text("patient_id"),
  reportedBy: text("reported_by").notNull(),
  assignedTo: text("assigned_to"),
  occurredAt: text("occurred_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpDate: text("follow_up_date"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── QA: Corrective Actions ──────────────────────────────────

export const correctiveActions = sqliteTable("corrective_actions", {
  id: text("id").primaryKey(),
  actionNumber: text("action_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  relatedAuditId: text("related_audit_id"),
  relatedIncidentId: text("related_incident_id"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull(),
  status: text("status", { enum: ["open", "in_progress", "pending_verification", "completed", "overdue"] }).notNull().default("open"),
  assignedTo: text("assigned_to").notNull(),
  dueDate: text("due_date").notNull(),
  completedAt: text("completed_at"),
  completionNotes: text("completion_notes"),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── NIL: Knowledge Graph Entities ─────────────────────────

export const nilEntities = sqliteTable("nil_entities", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  sourceId: text("source_id"),
  sourceTable: text("source_table"),
  displayName: text("display_name").notNull(),
  description: text("description"),
  metadata: text("metadata"),
  module: text("module").notNull().default("unknown"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── NIL: Knowledge Graph Relationships ─────────────────────

export const nilRelationships = sqliteTable("nil_relationships", {
  id: text("id").primaryKey(),
  fromEntityId: text("from_entity_id").notNull(),
  toEntityId: text("to_entity_id").notNull(),
  relationType: text("relation_type").notNull(),
  strength: integer("strength").notNull().default(1), // 1-100 scale, stored as int
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Microsoft Graph: Directory Sync ───────────────────────

export const msGraphUsers = sqliteTable("ms_graph_users", {
  id: text("id").primaryKey(),
  entraId: text("entra_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  givenName: text("given_name"),
  surname: text("surname"),
  userPrincipalName: text("user_principal_name").notNull(),
  mail: text("mail"),
  jobTitle: text("job_title"),
  department: text("department"),
  officeLocation: text("office_location"),
  accountEnabled: integer("account_enabled", { mode: "boolean" }).notNull().default(true),
  syncStatus: text("sync_status", { enum: ["active", "disabled", "pending", "error"] }).notNull().default("pending"),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const msGraphGroups = sqliteTable("ms_graph_groups", {
  id: text("id").primaryKey(),
  entraId: text("entra_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  groupType: text("group_type"),
  securityEnabled: integer("security_enabled", { mode: "boolean" }),
  mailEnabled: integer("mail_enabled", { mode: "boolean" }),
  memberCount: integer("member_count").default(0),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const msGraphSyncLog = sqliteTable("ms_graph_sync_log", {
  id: text("id").primaryKey(),
  syncType: text("sync_type", { enum: ["full", "delta", "users", "groups"] }).notNull(),
  status: text("status", { enum: ["running", "completed", "failed", "partial"] }).notNull(),
  usersSynced: integer("users_synced").default(0),
  groupsSynced: integer("groups_synced").default(0),
  errorsJson: text("errors_json"),
  startedAt: text("started_at").$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

// ─── Notifications ───────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type", { enum: ["status-change", "alert", "document", "training", "system"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  personName: text("person_name"),
  moduleName: text("module_name"),
  actionHref: text("action_href"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
