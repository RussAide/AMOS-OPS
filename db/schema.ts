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
    // Executive Office (EO)
    "super-admin", "managing-director", "administrator",
    // General Administration Division (GAD)
    "hr-director", "hr-compliance-officer", "revenue-cycle-manager",
    "billing-specialist", "training-coordinator", "facilities-manager",
    // GRO Residential
    "gro-administrator", "program-director", "shift-supervisor",
    "rcs-lead", "rcs-day", "rcs-night", "rcs-prn",
    "youth-care-worker", "behavioral-support", "crisis-intervention-specialist",
    "recreation-coordinator", "medication-aide", "family-liaison",
    // BHC Division
    "bhc-director", "treatment-director", "clinical-director",
    "ccmg-program-director", "mhtcm-supervisor", "mhrs-supervisor",
    "clinical-supervisor", "chart-auditor", "qmhp-cs",
    "case-manager", "therapist", "nurse",
    "intake-coordinator", "bhc-front-desk",
  ] }).notNull().default("rcs-day"),
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

// ─── Agent Personas ──────────────────────────────────────────

export const agentPersonas = sqliteTable("agent_personas", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  scope: text("scope"),
  boundariesJson: text("boundaries_json"),
  status: text("status", { enum: ["active", "pilot", "deferred"] }).notNull().default("deferred"),
  wave: text("wave").default("wave3"),
  category: text("category").notNull(),
  color: text("color"),
  icon: text("icon"),
  permissions: text("permissions"),
  outputs: text("outputs"),
  activatedAt: text("activated_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
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

// ─── DMS: Document Categories ────────────────────────────────

export const documentCategories = sqliteTable("document_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  department: text("department"),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── DMS: Document Lifecycle Documents ───────────────────────

export const dmsDocuments = sqliteTable("dms_documents", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().unique(), // AMOS-DMS ID: ADL-DEPT-CAT-YYYYMM-SEQ
  title: text("title").notNull(),
  description: text("description"),
  categoryId: text("category_id").notNull(),
  category: text("category").notNull(),
  department: text("department").notNull(),
  status: text("status", { enum: [
    "draft", "in-review", "approved", "published", "archived", "superseded",
  ] }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  assignedReviewerId: text("assigned_reviewer_id"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path"),
  tagsJson: text("tags_json").default("[]"),
  permissionsJson: text("permissions_json").default("[]"), // roles that can access
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
  publishedAt: text("published_at"),
  publishedBy: text("published_by"),
  archivedAt: text("archived_at"),
  archivedBy: text("archived_by"),
  archiveReason: text("archive_reason"),
  supersededById: text("superseded_by_id"),
  retentionYears: integer("retention_years").default(7),
  expiryDate: text("expiry_date"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── DMS: Document Versions ──────────────────────────────────

export const documentVersions = sqliteTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(), // references dmsDocuments.documentId
  versionNumber: integer("version_number").notNull(),
  changeSummary: text("change_summary"),
  fileName: text("file_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── DMS: Document Audit Log ─────────────────────────────────

export const documentAuditLog = sqliteTable("document_audit_log", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  action: text("action").notNull(), // created, updated, status-changed, reviewed, approved, published, archived
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  details: text("details"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
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

// ═══════════════════════════════════════════════════════════════
// SPRINT 2: YOUTH PATHWAY ARCHITECTURE
// ═══════════════════════════════════════════════════════════════

// ─── M13: Youth Profiles (central spine for all milestones) ──

export const youthProfiles = sqliteTable("youth_profiles", {
  id: text("id").primaryKey(),
  mrn: text("mrn").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  age: integer("age").notNull(),
  gender: text("gender", { enum: ["male", "female", "non_binary", "prefer_not_say"] }),
  race: text("race"),
  ethnicity: text("ethnicity"),
  preferredLanguage: text("preferred_language").default("English"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  guardian1Name: text("guardian1_name").notNull(),
  guardian1Relationship: text("guardian1_relationship").notNull(),
  guardian1Phone: text("guardian1_phone").notNull(),
  guardian1Email: text("guardian1_email"),
  guardian2Name: text("guardian2_name"),
  guardian2Relationship: text("guardian2_relationship"),
  guardian2Phone: text("guardian2_phone"),
  guardian2Email: text("guardian2_email"),
  emergencyName: text("emergency_name"),
  emergencyRelationship: text("emergency_relationship"),
  emergencyPhone: text("emergency_phone"),
  referralSourceType: text("referral_source_type", { enum: ["self", "family", "school", "dcf", "hospital", "court", "other_provider", "other"] }),
  referralSourceName: text("referral_source_name"),
  referralSourcePhone: text("referral_source_phone"),
  referredBy: text("referred_by"),
  referralDate: text("referral_date"),
  assignedClinicianId: text("assigned_clinician_id"),
  assignedClinicianName: text("assigned_clinician_name"),
  assignedCaseManagerId: text("assigned_case_manager_id"),
  assignedCaseManagerName: text("assigned_case_manager_name"),
  status: text("status", { enum: ["referral_pending", "screening", "intake", "assessment", "admitted", "active", "hold", "discharge_planning", "discharged", "transferred"] }).notNull().default("referral_pending"),
  levelOfCare: text("level_of_care", { enum: ["residential", "day_treatment", "outpatient", "crisis_stabilization", "not_yet_determined"] }).default("not_yet_determined"),
  bedAssignment: text("bed_assignment"),
  primaryPayerId: text("primary_payer_id"),
  primaryPayerName: text("primary_payer_name"),
  policyNumber: text("policy_number"),
  groupNumber: text("group_number"),
  subscriberName: text("subscriber_name"),
  subscriberRelationship: text("subscriber_relationship"),
  admissionDate: text("admission_date"),
  projectedDischargeDate: text("projected_discharge_date"),
  actualDischargeDate: text("actual_discharge_date"),
  dischargeReason: text("discharge_reason"),
  dischargeDisposition: text("discharge_disposition"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  notes: text("notes"),
});

// ─── M13: Intake Pipeline ────────────────────────────────────

export const intakePipeline = sqliteTable("intake_pipeline", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  mrn: text("mrn").notNull(),
  youthName: text("youth_name").notNull(),
  referralReceivedDate: text("referral_received_date"),
  referralReceivedBy: text("referral_received_by"),
  referralReceivedNotes: text("referral_received_notes"),
  referralReceivedCompleted: integer("referral_received_completed", { mode: "boolean" }).notNull().default(false),
  screeningDate: text("screening_date"),
  screeningCompletedBy: text("screening_completed_by"),
  screeningResult: text("screening_result", { enum: ["pass", "fail", "needs_review", "pending"] }),
  screeningNotes: text("screening_notes"),
  screeningCompleted: integer("screening_completed", { mode: "boolean" }).notNull().default(false),
  consentDate: text("consent_date"),
  consentCompletedBy: text("consent_completed_by"),
  guardianConsentObtained: integer("guardian_consent_obtained", { mode: "boolean" }).notNull().default(false),
  youthAssentObtained: integer("youth_assent_obtained", { mode: "boolean" }).notNull().default(false),
  hipaaAcknowledgment: integer("hipaa_acknowledgment", { mode: "boolean" }).notNull().default(false),
  rightsAcknowledgment: integer("rights_acknowledgment", { mode: "boolean" }).notNull().default(false),
  consentNotes: text("consent_notes"),
  consentCompleted: integer("consent_completed", { mode: "boolean" }).notNull().default(false),
  payerVerificationDate: text("payer_verification_date"),
  payerVerificationCompletedBy: text("payer_verification_completed_by"),
  benefitsVerified: integer("benefits_verified", { mode: "boolean" }).notNull().default(false),
  authorizationRequired: integer("authorization_required", { mode: "boolean" }).notNull().default(false),
  authorizationSubmitted: integer("authorization_submitted", { mode: "boolean" }).notNull().default(false),
  authorizationApproved: integer("authorization_approved", { mode: "boolean" }).notNull().default(false),
  payerNotes: text("payer_notes"),
  payerCompleted: integer("payer_completed", { mode: "boolean" }).notNull().default(false),
  dispositionDate: text("disposition_date"),
  dispositionCompletedBy: text("disposition_completed_by"),
  disposition: text("disposition", { enum: ["admit", "deny", "waitlist", "refer_elsewhere", "pending"] }),
  dispositionReason: text("disposition_reason"),
  bedAssigned: text("bed_assigned"),
  admissionScheduledDate: text("admission_scheduled_date"),
  dispositionCompleted: integer("disposition_completed", { mode: "boolean" }).notNull().default(false),
  currentStep: text("current_step", { enum: ["referral", "screening", "consent", "payer", "disposition", "completed"] }).notNull().default("referral"),
  overallStatus: text("overall_status", { enum: ["in_progress", "completed", "blocked", "abandoned"] }).notNull().default("in_progress"),
  isBlocked: integer("is_blocked", { mode: "boolean" }).notNull().default(false),
  blockReason: text("block_reason"),
  referralElapsedHours: integer("referral_elapsed_hours").default(0),
  screeningElapsedHours: integer("screening_elapsed_hours").default(0),
  consentElapsedHours: integer("consent_elapsed_hours").default(0),
  payerElapsedHours: integer("payer_elapsed_hours").default(0),
  dispositionElapsedHours: integer("disposition_elapsed_hours").default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

// ─── M13: Comprehensive Assessments ──────────────────────────

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  mrn: text("mrn").notNull(),
  youthName: text("youth_name").notNull(),
  assessmentType: text("assessment_type", { enum: ["intake", "quarterly", "annual", "discharge", "incident_driven"] }).notNull().default("intake"),
  assessmentDate: text("assessment_date").notNull(),
  completedBy: text("completed_by").notNull(),
  completedById: text("completed_by_id"),
  clinicianName: text("clinician_name"),
  clinicianId: text("clinician_id"),
  supervisorName: text("supervisor_name"),
  supervisorId: text("supervisor_id"),
  presentingProblems: text("presenting_problems"),
  psychiatricHistory: text("psychiatric_history"),
  substanceUseHistory: text("substance_use_history"),
  traumaHistory: text("trauma_history"),
  medicalHistory: text("medical_history"),
  familyHistory: text("family_history"),
  educationalHistory: text("educational_history"),
  cansCompleted: integer("cans_completed", { mode: "boolean" }).notNull().default(false),
  cansTotalScore: integer("cans_total_score"),
  cansRiskLevel: text("cans_risk_level", { enum: ["low", "moderate", "high", "very_high"] }),
  locDetermined: integer("loc_determined", { mode: "boolean" }).notNull().default(false),
  locLevel: text("loc_level", { enum: ["loc_1_high_acuity", "loc_2_moderate_acuity", "loc_3_low_acuity", "not_determined"] }).default("not_determined"),
  locDecisionMatrixJson: text("loc_decision_matrix_json"),
  locClinicalRationale: text("loc_clinical_rationale"),
  locApprovedBy: text("loc_approved_by"),
  locApprovedAt: text("loc_approved_at"),
  riskSuicide: text("risk_suicide", { enum: ["none", "low", "moderate", "high", "imminent"] }),
  riskSelfHarm: text("risk_self_harm", { enum: ["none", "low", "moderate", "high", "imminent"] }),
  riskAggression: text("risk_aggression", { enum: ["none", "low", "moderate", "high", "imminent"] }),
  riskElopement: text("risk_elopement", { enum: ["none", "low", "moderate", "high", "imminent"] }),
  riskSubstanceUse: text("risk_substance_use", { enum: ["none", "low", "moderate", "high", "imminent"] }),
  riskVulnerability: text("risk_vulnerability", { enum: ["none", "low", "moderate", "high", "imminent"] }),
  overallRiskLevel: text("overall_risk_level", { enum: ["low", "moderate", "high", "critical"] }),
  safetyPlanRequired: integer("safety_plan_required", { mode: "boolean" }).notNull().default(false),
  safetyPlanCompleted: integer("safety_plan_completed", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["draft", "in_progress", "pending_review", "completed", "superseded"] }).notNull().default("draft"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

// ─── M13: Assessment Domains (individual domain scores) ──────

export const assessmentDomains = sqliteTable("assessment_domains", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").notNull(),
  domainNumber: integer("domain_number").notNull(),
  domainName: text("domain_name").notNull(),
  score: integer("score"),
  scoreLabel: text("score_label", { enum: ["no_evidence", "mild", "moderate", "severe"] }),
  strengths: text("strengths"),
  needs: text("needs"),
  observations: text("observations"),
  clinicalNotes: text("clinical_notes"),
  interventionNeeded: integer("intervention_needed", { mode: "boolean" }).notNull().default(false),
  interventionDescription: text("intervention_description"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M13: Referral Checklist (SOP Toolkit 1) ─────────────────

export const referralChecklists = sqliteTable("referral_checklists", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  intakeId: text("intake_id").notNull(),
  item1ReferralFormReceived: integer("item1_referral_form_received", { mode: "boolean" }).notNull().default(false),
  item2DemographicsComplete: integer("item2_demographics_complete", { mode: "boolean" }).notNull().default(false),
  item3InsuranceVerified: integer("item3_insurance_verified", { mode: "boolean" }).notNull().default(false),
  item4ConsentForRelease: integer("item4_consent_for_release", { mode: "boolean" }).notNull().default(false),
  item5PsychiatricHistory: integer("item5_psychiatric_history", { mode: "boolean" }).notNull().default(false),
  item6MedicalRecordsRequested: integer("item6_medical_records_requested", { mode: "boolean" }).notNull().default(false),
  item7EducationalRecordsRequested: integer("item7_educational_records_requested", { mode: "boolean" }).notNull().default(false),
  item8LegalStatusConfirmed: integer("item8_legal_status_confirmed", { mode: "boolean" }).notNull().default(false),
  item9GuardianContactVerified: integer("item9_guardian_contact_verified", { mode: "boolean" }).notNull().default(false),
  item10ServiceActivationDateSet: integer("item10_service_activation_date_set", { mode: "boolean" }).notNull().default(false),
  itemsCompleted: integer("items_completed").notNull().default(0),
  itemsTotal: integer("items_total").notNull().default(10),
  allItemsComplete: integer("all_items_complete", { mode: "boolean" }).notNull().default(false),
  completedBy: text("completed_by"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M14: Daily BHC-GRO Coordination & Meeting Cadence
// ═══════════════════════════════════════════════════════════════

// ─── M14: Daily Observations (6 domains) ─────────────────────

export const dailyObservations = sqliteTable("daily_observations", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  observationDate: text("observation_date").notNull(),
  shift: text("shift", { enum: ["day", "evening", "night", "overnight"] }).notNull(),
  observedBy: text("observed_by").notNull(),
  observedById: text("observed_by_id"),
  domain1Safety: integer("domain1_safety", { mode: "boolean" }).notNull().default(false),
  domain1SafetyNotes: text("domain1_safety_notes"),
  domain1SafetyScore: integer("domain1_safety_score"),
  domain2Regulation: integer("domain2_regulation", { mode: "boolean" }).notNull().default(false),
  domain2RegulationNotes: text("domain2_regulation_notes"),
  domain2RegulationScore: integer("domain2_regulation_score"),
  domain3Functioning: integer("domain3_functioning", { mode: "boolean" }).notNull().default(false),
  domain3FunctioningNotes: text("domain3_functioning_notes"),
  domain3FunctioningScore: integer("domain3_functioning_score"),
  domain4Medication: integer("domain4_medication", { mode: "boolean" }).notNull().default(false),
  domain4MedicationNotes: text("domain4_medication_notes"),
  domain4MedicationScore: integer("domain4_medication_score"),
  domain5Relationships: integer("domain5_relationships", { mode: "boolean" }).notNull().default(false),
  domain5RelationshipsNotes: text("domain5_relationships_notes"),
  domain5RelationshipsScore: integer("domain5_relationships_score"),
  domain6Participation: integer("domain6_participation", { mode: "boolean" }).notNull().default(false),
  domain6ParticipationNotes: text("domain6_participation_notes"),
  domain6ParticipationScore: integer("domain6_participation_score"),
  clinicallySignificant: integer("clinically_significant", { mode: "boolean" }).notNull().default(false),
  clinicalConcerns: text("clinical_concerns"),
  routedToClinician: integer("routed_to_clinician", { mode: "boolean" }).notNull().default(false),
  routedToClinicianId: text("routed_to_clinician_id"),
  routedToClinicianName: text("routed_to_clinician_name"),
  clinicianResponse: text("clinician_response"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── M14: Meetings (4 types + action items) ──────────────────

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  meetingType: text("meeting_type", { enum: ["daily_huddle", "case_staffing", "treatment_plan_review", "family_conference"] }).notNull(),
  title: text("title").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  durationMinutes: integer("duration_minutes").default(30),
  facilitatorId: text("facilitator_id"),
  facilitatorName: text("facilitator_name"),
  attendeesJson: text("attendees_json"),
  youthIdsJson: text("youth_ids_json"),
  agendaJson: text("agenda_json"),
  notes: text("notes"),
  status: text("status", { enum: ["scheduled", "in_progress", "completed", "cancelled", "no_show"] }).notNull().default("scheduled"),
  completedAt: text("completed_at"),
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpNotes: text("follow_up_notes"),
  nextMeetingDate: text("next_meeting_date"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

export const meetingActionItems = sqliteTable("meeting_action_items", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull(),
  description: text("description").notNull(),
  assignedToId: text("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  dueDate: text("due_date"),
  status: text("status", { enum: ["open", "in_progress", "completed", "overdue"] }).notNull().default("open"),
  completedAt: text("completed_at"),
  completedBy: text("completed_by"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M14: Escalation Events (5-tier ladder) ──────────────────

export const escalationEvents = sqliteTable("escalation_events", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  tier: text("tier", { enum: ["routine", "clinical", "urgent", "crisis", "post_crisis"] }).notNull(),
  previousTier: text("previous_tier", { enum: ["routine", "clinical", "urgent", "crisis", "post_crisis"] }),
  triggerSource: text("trigger_source", { enum: ["observation", "staff_report", "family_report", "youth_self_report", "automated_alert"] }),
  triggerDescription: text("trigger_description").notNull(),
  triggerDetail: text("trigger_detail"),
  responseActions: text("response_actions"),
  responderId: text("responder_id"),
  responderName: text("responder_name"),
  responderRole: text("responder_role"),
  respondedAt: text("responded_at"),
  resolutionNotes: text("resolution_notes"),
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by"),
  status: text("status", { enum: ["active", "escalating", "de_escalating", "resolved", "monitoring"] }).notNull().default("active"),
  requiresPostCrisisReview: integer("requires_post_crisis_review", { mode: "boolean" }).notNull().default(false),
  postCrisisReviewCompleted: integer("post_crisis_review_completed", { mode: "boolean" }).notNull().default(false),
  postCrisisReviewDate: text("post_crisis_review_date"),
  postCrisisReviewBy: text("post_crisis_review_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// M15: MHTCM Case Management & Crisis Response
// ═══════════════════════════════════════════════════════════════

// ─── M15: Case Management ────────────────────────────────────

export const caseManagement = sqliteTable("case_management", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  caseManagerId: text("case_manager_id"),
  caseManagerName: text("case_manager_name"),
  // 6 care management functions per SOP
  function1Coordination: integer("function1_coordination", { mode: "boolean" }).notNull().default(false),
  function1CoordinationNotes: text("function1_coordination_notes"),
  function2Referrals: integer("function2_referrals", { mode: "boolean" }).notNull().default(false),
  function2ReferralsJson: text("function2_referrals_json"), // array of {provider, type, status, date}
  function3Collaterals: integer("function3_collaterals", { mode: "boolean" }).notNull().default(false),
  function3CollateralsJson: text("function3_collaterals_json"), // array of {contact, relationship, date, notes}
  function4Barriers: integer("function4_barriers", { mode: "boolean" }).notNull().default(false),
  function4BarriersJson: text("function4_barriers_json"), // array of {barrier, impact, resolution}
  function5Monitoring: integer("function5_monitoring", { mode: "boolean" }).notNull().default(false),
  function5MonitoringNotes: text("function5_monitoring_notes"),
  function6Transition: integer("function6_transition", { mode: "boolean" }).notNull().default(false),
  function6TransitionNotes: text("function6_transition_notes"),
  transitionPlanDate: text("transition_plan_date"),
  projectedDischargeDate: text("projected_discharge_date"),
  // Status
  status: text("status", { enum: ["active", "on_hold", "pending_review", "closed", "transferred"] }).notNull().default("active"),
  lastReviewDate: text("last_review_date"),
  nextReviewDate: text("next_review_date"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
});

// ─── M15: Crisis Events ──────────────────────────────────────

export const crisisEvents = sqliteTable("crisis_events", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // 5 crisis types
  crisisType: text("crisis_type", { enum: ["behavioral_escalation", "suicide_self_harm", "medical_emergency", "elopement", "substance_intoxication"] }).notNull(),
  // 7-step SOP workflow
  step1Identified: integer("step1_identified", { mode: "boolean" }).notNull().default(false),
  step1IdentifiedAt: text("step1_identified_at"),
  step1IdentifiedBy: text("step1_identified_by"),
  step2Activated: integer("step2_activated", { mode: "boolean" }).notNull().default(false),
  step2ActivatedAt: text("step2_activated_at"),
  step2ActivatedBy: text("step2_activated_by"),
  step3Responded: integer("step3_responded", { mode: "boolean" }).notNull().default(false),
  step3RespondedAt: text("step3_responded_at"),
  step3ResponderName: text("step3_responder_name"),
  step3ResponseActions: text("step3_response_actions"),
  step4EnsuredSafety: integer("step4_ensured_safety", { mode: "boolean" }).notNull().default(false),
  step4SafetyMeasures: text("step4_safety_measures"),
  step4EnsuredAt: text("step4_ensured_at"),
  step5Notified: integer("step5_notified", { mode: "boolean" }).notNull().default(false),
  step5NotifiedParties: text("step5_notified_parties"), // JSON array
  step5NotifiedAt: text("step5_notified_at"),
  step6Documented: integer("step6_documented", { mode: "boolean" }).notNull().default(false),
  step6DocumentedAt: text("step6_documented_at"),
  step6DocumentationRef: text("step6_documentation_ref"),
  step7Reviewed: integer("step7_reviewed", { mode: "boolean" }).notNull().default(false),
  step7ReviewedAt: text("step7_reviewed_at"),
  step7ReviewedBy: text("step7_reviewed_by"),
  step7ReviewNotes: text("step7_review_notes"),
  // Current step tracking
  currentStep: integer("current_step").notNull().default(1), // 1-7
  overallStatus: text("overall_status", { enum: ["active", "contained", "resolved", "under_review"] }).notNull().default("active"),
  // Outcome
  youthInjured: integer("youth_injured", { mode: "boolean" }).notNull().default(false),
  staffInjured: integer("staff_injured", { mode: "boolean" }).notNull().default(false),
  restrictiveInterventionUsed: integer("restrictive_intervention_used", { mode: "boolean" }).notNull().default(false),
  restrictiveInterventionType: text("restrictive_intervention_type", { enum: ["restraint", "seclusion", "prn_medication", "none"] }),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── M15: Crisis Debriefs (SOP Toolkit 6) ────────────────────

export const crisisDebriefs = sqliteTable("crisis_debriefs", {
  id: text("id").primaryKey(),
  crisisEventId: text("crisis_event_id").notNull(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  // 9-field debrief template
  field1EventSummary: text("field1_event_summary"),
  field2TriggersIdentified: text("field2_triggers_identified"),
  field3EarlyWarningSigns: text("field3_early_warning_signs"),
  field4InterventionsUsed: text("field4_interventions_used"),
  field5WhatWorked: text("field5_what_worked"),
  field6WhatDidNotWork: text("field6_what_did_not_work"),
  field7YouthPerspective: text("field7_youth_perspective"),
  field8StaffPerspective: text("field8_staff_perspective"),
  field9PlanAdjustments: text("field9_plan_adjustments"),
  // Safety plan update
  safetyPlanUpdated: integer("safety_plan_updated", { mode: "boolean" }).notNull().default(false),
  safetyPlanChanges: text("safety_plan_changes"),
  // Follow-up
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpActions: text("follow_up_actions"),
  followUpDate: text("follow_up_date"),
  // Completion
  completedBy: text("completed_by"),
  completedById: text("completed_by_id"),
  completedAt: text("completed_at"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M16: Residential Operations & Medication Administration
// ═══════════════════════════════════════════════════════════════

// ─── M16: Bed Census (12 beds) ─────────────────────────────

export const bedCensus = sqliteTable("bed_census", {
  id: text("id").primaryKey(),
  roomNumber: text("room_number").notNull(),
  bedLetter: text("bed_letter").notNull(), // A, B for shared rooms
  bedName: text("bed_name").notNull(), // e.g. "101-A"
  isOccupied: integer("is_occupied", { mode: "boolean" }).notNull().default(false),
  youthId: text("youth_id"),
  youthName: text("youth_name"),
  mrn: text("mrn"),
  assignedDate: text("assigned_date"),
  // Room features
  isAccessible: integer("is_accessible", { mode: "boolean" }).notNull().default(false),
  isObservation: integer("is_observation", { mode: "boolean" }).notNull().default(false),
  isQuiet: integer("is_quiet", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Shifts ───────────────────────────────────────────

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  shiftDate: text("shift_date").notNull(),
  shiftType: text("shift_type", { enum: ["day", "evening", "night", "overnight"] }).notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  // Staff assignments
  rcsLeadId: text("rcs_lead_id"),
  rcsLeadName: text("rcs_lead_name"),
  rcsStaffIdsJson: text("rcs_staff_ids_json"), // array of assigned RCS staff
  nurseId: text("nurse_id"),
  nurseName: text("nurse_name"),
  clinicianOnCall: text("clinician_on_call"),
  // Status
  status: text("status", { enum: ["scheduled", "in_progress", "completed", "no_show", "absent"] }).notNull().default("scheduled"),
  coverageStatus: text("coverage_status", { enum: ["full", "partial", "uncovered"] }).notNull().default("full"),
  coverageNotes: text("coverage_notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Shift Handoffs ───────────────────────────────────

export const shiftHandoffs = sqliteTable("shift_handoffs", {
  id: text("id").primaryKey(),
  fromShiftId: text("from_shift_id").notNull(),
  toShiftId: text("to_shift_id"),
  handoffDate: text("handoff_date").notNull(),
  fromStaffName: text("from_staff_name").notNull(),
  toStaffName: text("to_staff_name"),
  // Youth status summary
  youthStatusJson: text("youth_status_json"), // array of {youthId, name, status, concerns}
  // Pending items
  pendingItems: text("pending_items"), // array of action items
  medicationUpdates: text("medication_updates"),
  appointmentReminders: text("appointment_reminders"),
  // Alerts
  highPriorityAlerts: text("high_priority_alerts"),
  safetyAlerts: text("safety_alerts"),
  // Notes
  generalNotes: text("general_notes"),
  // Status
  status: text("status", { enum: ["pending", "in_progress", "completed"] }).notNull().default("pending"),
  completedAt: text("completed_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Behavioral Observations ──────────────────────────

export const behavioralObservations = sqliteTable("behavioral_observations", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  observationDate: text("observation_date").notNull(),
  observedBy: text("observed_by").notNull(),
  // Behavior details
  behaviorType: text("behavior_type").notNull(), // e.g. "aggression", "self_injury", "elopement"
  frequency: text("frequency", { enum: ["single", "intermittent", "continuous"] }),
  intensity: text("intensity", { enum: ["mild", "moderate", "severe"] }),
  duration: text("duration"), // e.g. "5 minutes"
  triggers: text("triggers"),
  antecedents: text("antecedents"),
  // Intervention
  interventionUsed: text("intervention_used"),
  interventionEffective: integer("intervention_effective", { mode: "boolean" }),
  prnAdministered: integer("prn_administered", { mode: "boolean" }).notNull().default(false),
  prnDetails: text("prn_details"),
  // Outcome
  outcome: text("outcome"),
  followUpNeeded: integer("follow_up_needed", { mode: "boolean" }).notNull().default(false),
  followUpActions: text("follow_up_actions"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Milieu Notes ─────────────────────────────────────

export const milieuNotes = sqliteTable("milieu_notes", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  noteDate: text("note_date").notNull(),
  shift: text("shift", { enum: ["day", "evening", "night", "overnight"] }).notNull(),
  recordedBy: text("recorded_by").notNull(),
  // Daily routine
  wakeTime: text("wake_time"),
  bedtime: text("bedtime"),
  mealsEaten: text("meals_eaten"), // JSON array
  hygieneStatus: text("hygiene_status"),
  // Activities
  activitiesParticipated: text("activities_participated"), // JSON array
  activityNotes: text("activity_notes"),
  schoolAttendance: text("school_attendance"),
  schoolNotes: text("school_notes"),
  // Mood/behavior
  mood: text("mood"),
  affect: text("affect"),
  socialInteractions: text("social_interactions"),
  sleepQuality: text("sleep_quality"),
  // Notes
  staffNotes: text("staff_notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Family Contacts ──────────────────────────────────

export const familyContacts = sqliteTable("family_contacts", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Contact details
  contactDate: text("contact_date").notNull(),
  contactType: text("contact_type", { enum: ["phone_call", "video_call", "in_person_visit", "letter", "email", "family_therapy", "education_session"] }).notNull(),
  contactDirection: text("contact_direction", { enum: ["incoming", "outgoing"] }).notNull().default("incoming"),
  contactedPerson: text("contacted_person").notNull(),
  relationship: text("relationship"),
  phoneNumber: text("phone_number"),
  // Visit details
  visitStartTime: text("visit_start_time"),
  visitEndTime: text("visit_end_time"),
  visitLocation: text("visit_location"),
  supervisorPresent: text("supervisor_present"),
  // Content
  topicsDiscussed: text("topics_discussed"),
  youthParticipation: text("youth_participation"),
  concernsRaised: text("concerns_raised"),
  actionItems: text("action_items"),
  followUpNeeded: integer("follow_up_needed", { mode: "boolean" }).notNull().default(false),
  followUpDate: text("follow_up_date"),
  // Outcome
  outcome: text("outcome"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Restrictive Interventions ────────────────────────

export const restrictiveInterventions = sqliteTable("restrictive_interventions", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Intervention details
  interventionType: text("intervention_type", { enum: ["physical_restraint", "mechanical_restraint", "seclusion", "prn_medication", "time_out"] }).notNull(),
  incidentDate: text("incident_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  durationMinutes: integer("duration_minutes"),
  // Staff
  initiatedBy: text("initiated_by").notNull(),
  initiatedByRole: text("initiated_by_role"),
  witnesses: text("witnesses"), // JSON array
  // Trigger
  precipitatingFactors: text("precipitating_factors"),
  alternativesAttempted: text("alternatives_attempted"),
  // Safety
  youthInjuries: text("youth_injuries"),
  staffInjuries: text("staff_injuries"),
  medicalAssessment: text("medical_assessment"),
  // Debrief
  debriefCompleted: integer("debrief_completed", { mode: "boolean" }).notNull().default(false),
  debriefDate: text("debrief_date"),
  debriefNotes: text("debrief_notes"),
  guardianNotified: integer("guardian_notified", { mode: "boolean" }).notNull().default(false),
  guardianNotificationDate: text("guardian_notification_date"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M16: Medication Administrations (MAR) ─────────────────

export const medicationAdministrations = sqliteTable("medication_administrations", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Medication
  medicationName: text("medication_name").notNull(),
  genericName: text("generic_name"),
  dosage: text("dosage").notNull(),
  route: text("route", { enum: ["oral", "sublingual", "im", "iv", "subcutaneous", "topical", "inhalation", "rectal"] }).notNull(),
  frequency: text("frequency").notNull(), // e.g. "BID", "TID", "QHS", "PRN"
  indication: text("indication"),
  prescribingProvider: text("prescribing_provider"),
  prescriptionDate: text("prescription_date"),
  // Administration
  scheduledTime: text("scheduled_time").notNull(),
  adminDate: text("admin_date").notNull(),
  adminTime: text("admin_time"),
  administeredBy: text("administered_by"),
  witnessedBy: text("witnessed_by"),
  // Status
  status: text("status", { enum: ["scheduled", "administered", "refused", "held", "missed", "not_available"] }).notNull().default("scheduled"),
  refusalReason: text("refusal_reason"),
  holdReason: text("hold_reason"),
  // PRN tracking
  isPrn: integer("is_prn", { mode: "boolean" }).notNull().default(false),
  prnReason: text("prn_reason"),
  prnEffectiveness: text("prn_effectiveness"), // effective, partial, ineffective
  // Controlled substance
  isControlled: integer("is_controlled", { mode: "boolean" }).notNull().default(false),
  controlledCountBefore: integer("controlled_count_before"),
  controlledCountAfter: integer("controlled_count_after"),
  wasteWitnessedBy: text("waste_witnessed_by"),
  // Notes
  notes: text("notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M17: Authorization Lifecycle & Executive Intelligence
// ═══════════════════════════════════════════════════════════════

export const authorizations = sqliteTable("authorizations", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  payerName: text("payer_name").notNull(),
  policyNumber: text("policy_number"),
  stage: text("stage", { enum: ["readiness", "submission", "tracking", "reauthorization", "retrospective"] }).notNull(),
  status: text("status", { enum: ["pending", "in_progress", "submitted", "approved", "denied", "appealed", "expired", "closed"] }).notNull().default("pending"),
  readinessClinicalDocs: integer("readiness_clinical_docs", { mode: "boolean" }).notNull().default(false),
  readinessAssessmentCurrent: integer("readiness_assessment_current", { mode: "boolean" }).notNull().default(false),
  readinessLOCSupported: integer("readiness_loc_supported", { mode: "boolean" }).notNull().default(false),
  readinessTreatmentPlan: integer("readiness_treatment_plan", { mode: "boolean" }).notNull().default(false),
  readinessProgressNotes: integer("readiness_progress_notes", { mode: "boolean" }).notNull().default(false),
  readinessMedicalNecessity: integer("readiness_medical_necessity", { mode: "boolean" }).notNull().default(false),
  readinessUtilizationReview: integer("readiness_utilization_review", { mode: "boolean" }).notNull().default(false),
  readinessGuardianConsent: integer("readiness_guardian_consent", { mode: "boolean" }).notNull().default(false),
  readinessUB04Clean: integer("readiness_ub04_clean", { mode: "boolean" }).notNull().default(false),
  readinessExcludedServices: integer("readiness_excluded_services", { mode: "boolean" }).notNull().default(false),
  readinessMetAt: text("readiness_met_at"),
  submissionDate: text("submission_date"),
  submittedBy: text("submitted_by"),
  submissionMethod: text("submission_method", { enum: ["portal", "fax", "email", "phone"] }),
  submissionReference: text("submission_reference"),
  authorizationNumber: text("authorization_number"),
  approvedUnits: integer("approved_units"),
  approvedFromDate: text("approved_from_date"),
  approvedToDate: text("approved_to_date"),
  approvedLevelOfCare: text("approved_level_of_care"),
  denialReason: text("denial_reason"),
  appealDate: text("appeal_date"),
  appealStatus: text("appeal_status"),
  reauthDueDate: text("reauth_due_date"),
  reauthSubmittedAt: text("reauth_submitted_at"),
  reauthStatus: text("reauth_status", { enum: ["not_due", "upcoming", "overdue", "submitted", "approved"] }).default("not_due"),
  daysUntilExpiration: integer("days_until_expiration"),
  retrospectiveReviewDate: text("retrospective_review_date"),
  retrospectiveFindings: text("retrospective_findings"),
  retrospectiveActions: text("retrospective_actions"),
  billingExcludedServices: text("billing_excluded_services"),
  exclusionControlsApplied: text("exclusion_controls_applied"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});


// ═══════════════════════════════════════════════════════════════
// M18: Chart Audits (SOP Toolkit 8)
// ═══════════════════════════════════════════════════════════════

export const chartAudits = sqliteTable("chart_audits", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  auditDate: text("audit_date").notNull(),
  auditorName: text("auditor_name").notNull(),
  area1IdentifyingInfo: integer("area1_identifying_info", { mode: "boolean" }).notNull().default(false),
  area1Notes: text("area1_notes"),
  area2ConsentForms: integer("area2_consent_forms", { mode: "boolean" }).notNull().default(false),
  area2Notes: text("area2_notes"),
  area3AssessmentCurrent: integer("area3_assessment_current", { mode: "boolean" }).notNull().default(false),
  area3Notes: text("area3_notes"),
  area4TreatmentPlan: integer("area4_treatment_plan", { mode: "boolean" }).notNull().default(false),
  area4Notes: text("area4_notes"),
  area5ProgressNotes: integer("area5_progress_notes", { mode: "boolean" }).notNull().default(false),
  area5Notes: text("area5_notes"),
  area6MedicationRecords: integer("area6_medication_records", { mode: "boolean" }).notNull().default(false),
  area6Notes: text("area6_notes"),
  area7SafetyPlans: integer("area7_safety_plans", { mode: "boolean" }).notNull().default(false),
  area7Notes: text("area7_notes"),
  area8IncidentReports: integer("area8_incident_reports", { mode: "boolean" }).notNull().default(false),
  area8Notes: text("area8_notes"),
  area9AuthorizationBilling: integer("area9_authorization_billing", { mode: "boolean" }).notNull().default(false),
  area9Notes: text("area9_notes"),
  areasPassed: integer("areas_passed").notNull().default(0),
  areasTotal: integer("areas_total").notNull().default(9),
  overallResult: text("overall_result", { enum: ["pass", "pass_with_notes", "fail", "incomplete"] }).default("incomplete"),
  correctiveActions: text("corrective_actions"),
  followUpDate: text("follow_up_date"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── M19: Facilities (48-Bed Campus Architecture) ────────────

export const facilities = sqliteTable("facilities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  type: text("type", { enum: ["main_residence", "emergency_care", "purpose_built"] }).notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  licensedCapacity: integer("licensed_capacity").notNull().default(0),
  operationalCapacity: integer("operational_capacity").notNull().default(0),
  currentOccupancy: integer("current_occupancy").notNull().default(0),
  totalRooms: integer("total_rooms").notNull().default(0),
  totalBeds: integer("total_beds").notNull().default(0),
  status: text("status", { enum: ["active", "inactive", "planned", "under_construction"] }).notNull().default("active"),
  activationDate: text("activation_date"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id").notNull(),
  roomNumber: text("room_number").notNull(),
  floor: text("floor", { enum: ["ground", "first", "second", "third", "basement"] }).notNull().default("ground"),
  roomType: text("room_type", { enum: ["standard", "observation", "quiet", "ada_accessible", "isolation"] }).notNull().default("standard"),
  maxBeds: integer("max_beds").notNull().default(2),
  currentOccupancy: integer("current_occupancy").notNull().default(0),
  bedLayout: text("bed_layout", { enum: ["single", "double", "bunk"] }).notNull().default("double"),
  hasPrivateBath: integer("has_private_bath", { mode: "boolean" }).notNull().default(false),
  hasWindow: integer("has_window", { mode: "boolean" }).notNull().default(true),
  status: text("status", { enum: ["active", "inactive", "maintenance", "reserved"] }).notNull().default("active"),
  phaseActivationId: text("phase_activation_id"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const facilityPhases = sqliteTable("facility_phases", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id").notNull(),
  phaseName: text("phase_name").notNull(),
  phaseNumber: integer("phase_number").notNull(),
  bedsActivated: integer("beds_activated").notNull().default(0),
  roomsActivated: integer("rooms_activated").notNull().default(0),
  activationDate: text("activation_date"),
  targetDate: text("target_date"),
  status: text("status", { enum: ["pending", "active", "completed", "deferred"] }).notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvalDate: text("approval_date"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M19: Bed Census v2 (Multi-Facility) ─────────────────────

export const bedCensusV2 = sqliteTable("bed_census_v2", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id").notNull(),
  roomId: text("room_id").notNull(),
  bedNumber: text("bed_number").notNull(),
  bedLabel: text("bed_label").notNull(),
  isOccupied: integer("is_occupied", { mode: "boolean" }).notNull().default(false),
  youthId: text("youth_id"),
  youthName: text("youth_name"),
  mrn: text("mrn"),
  assignedDate: text("assigned_date"),
  expectedDischargeDate: text("expected_discharge_date"),
  isAccessible: integer("is_accessible", { mode: "boolean" }).notNull().default(false),
  isObservation: integer("is_observation", { mode: "boolean" }).notNull().default(false),
  isQuiet: integer("is_quiet", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M21: Agent Persona Registry
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MHRS: Mental Health Rehabilitative Services (T-005)
// 4 categories: Psychosocial Rehab, Skills Training,
// Supportive Interventions, Community Integration. H2017 billing.
// ═══════════════════════════════════════════════════════════════

export const MHRS_CATEGORIES = [
  "psychosocial_rehabilitation",
  "skills_training",
  "supportive_interventions",
  "community_integration",
] as const;
export type MhrsCategory = (typeof MHRS_CATEGORIES)[number];

// ─── MHRS: Service Plans ─────────────────────────────────────

export const mhrsServicePlans = sqliteTable("mhrs_service_plans", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  mhrsSupervisorId: text("mhrs_supervisor_id"),
  mhrsSupervisorName: text("mhrs_supervisor_name"),
  therapistId: text("therapist_id"),
  therapistName: text("therapist_name"),
  // Plan lifecycle
  planStatus: text("plan_status", { enum: ["draft", "active", "under_review", "approved", "superseded", "closed"] }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  // Timelines
  intakeDate: text("intake_date").notNull(),
  planDueDate: text("plan_due_date").notNull(),
  planCompletedDate: text("plan_completed_date"),
  nextReviewDue: text("next_review_due"),
  lastReviewDate: text("last_review_date"),
  // 4 MHRS category goals
  cat1PsychoGoal: text("cat1_psycho_goal"),
  cat1PsychoObjectives: text("cat1_psycho_objectives"), // JSON array
  cat1PsychoCompleted: integer("cat1_psycho_completed", { mode: "boolean" }).notNull().default(false),
  cat2SkillsGoal: text("cat2_skills_goal"),
  cat2SkillsObjectives: text("cat2_skills_objectives"), // JSON array
  cat2SkillsCompleted: integer("cat2_skills_completed", { mode: "boolean" }).notNull().default(false),
  cat3SupportiveGoal: text("cat3_supportive_goal"),
  cat3SupportiveObjectives: text("cat3_supportive_objectives"), // JSON array
  cat3SupportiveCompleted: integer("cat3_supportive_completed", { mode: "boolean" }).notNull().default(false),
  cat4CommunityGoal: text("cat4_community_goal"),
  cat4CommunityObjectives: text("cat4_community_objectives"), // JSON array
  cat4CommunityCompleted: integer("cat4_community_completed", { mode: "boolean" }).notNull().default(false),
  // CANS functional domain linkage
  cansDomainPrimary: text("cans_domain_primary", { enum: ["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"] }),
  cansDomainSecondary: text("cans_domain_secondary", { enum: ["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"] }),
  cansBaselineScore: integer("cans_baseline_score"),
  cansTargetScore: integer("cans_target_score"),
  // Approval
  preparedBy: text("prepared_by"),
  preparedAt: text("prepared_at"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── MHRS: Encounters (H2017 Billing) ────────────────────────

export const mhrsEncounters = sqliteTable("mhrs_encounters", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  servicePlanId: text("service_plan_id").notNull(),
  therapistId: text("therapist_id").notNull(),
  therapistName: text("therapist_name").notNull(),
  // Encounter
  encounterDate: text("encounter_date").notNull(),
  encounterType: text("encounter_type", { enum: ["individual_skills", "group_skills", "psychoeducational", "community_integration", "family_session", "crisis_intervention"] }).notNull(),
  // H2017 billing
  billingCode: text("billing_code").notNull().default("H2017"),
  unitsBilled: integer("units_billed").notNull().default(1),
  minutesDelivered: integer("minutes_delivered").notNull().default(15),
  // Category mapping
  mhrsCategory: text("mhrs_category", { enum: ["psychosocial_rehabilitation", "skills_training", "supportive_interventions", "community_integration"] }).notNull(),
  // CANS domain targeted
  cansDomainTargeted: text("cans_domain_targeted", { enum: ["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"] }),
  // Documentation
  serviceDescription: text("service_description").notNull(),
  skillsTaught: text("skills_taught"),
  youthProgress: text("youth_progress"),
  barriersIdentified: text("barriers_identified"),
  homeworkAssignment: text("homework_assignment"),
  nextSteps: text("next_steps"),
  // Outcome
  goalProgress: text("goal_progress", { enum: ["no_change", "minimal_progress", "moderate_progress", "significant_progress", "goal_achieved"] }).default("no_change"),
  cansScoreCurrent: integer("cans_score_current"),
  // Status
  documentationStatus: text("documentation_status", { enum: ["draft", "completed", "signed", "submitted"] }).notNull().default("draft"),
  signedBy: text("signed_by"),
  signedAt: text("signed_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── MHRS: Skills Assessments ────────────────────────────────

export const mhrsSkillsAssessments = sqliteTable("mhrs_skills_assessments", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  servicePlanId: text("service_plan_id").notNull(),
  assessedBy: text("assessed_by").notNull(),
  assessedById: text("assessed_by_id"),
  assessmentDate: text("assessment_date").notNull(),
  // CANS functional domain
  cansDomain: text("cans_domain", { enum: ["behavioral_emotional", "risk_behaviors", "functioning", "strengths", "caregiver_resources", "acculturation"] }).notNull(),
  // Skills rating (1-5 scale)
  skillAreasJson: text("skill_areas_json").notNull(), // [{area, baselineScore, currentScore, targetScore}]
  overallBaseline: integer("overall_baseline"),
  overallCurrent: integer("overall_current"),
  overallTarget: integer("overall_target"),
  // Progress
  progressPercentage: integer("progress_percentage"), // 0-100
  readinessForTransition: text("readiness_for_transition", { enum: ["not_ready", "approaching", "ready", "transitioned"] }).default("not_ready"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// BHC: Department Model — CCMG, MHTCM, MHRS (T-003)
// ═══════════════════════════════════════════════════════════════

export const BHC_DEPARTMENTS = ["CCMG", "MHTCM", "MHRS"] as const;
export type BhcDepartment = (typeof BHC_DEPARTMENTS)[number];

// ─── CCMG: Care Coordination Hub ─────────────────────────────

export const ccmgCareCoordination = sqliteTable("ccmg_care_coordination", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // CCMG oversight
  ccmgProgramDirectorId: text("ccmg_program_director_id"),
  ccmgProgramDirectorName: text("ccmg_program_director_name"),
  caseManagerId: text("case_manager_id"),
  caseManagerName: text("case_manager_name"),
  // Cross-departmental assignment
  assignedDepartment: text("assigned_department", { enum: ["CCMG", "MHTCM", "MHRS"] }).notNull().default("CCMG"),
  departmentTransferDate: text("department_transfer_date"),
  transferredFrom: text("transferred_from", { enum: ["CCMG", "MHTCM", "MHRS"] }),
  transferRationale: text("transfer_rationale"),
  // Care coordination tracking
  intakeCompleted: integer("intake_completed", { mode: "boolean" }).notNull().default(false),
  intakeCompletedDate: text("intake_completed_date"),
  assessmentCompleted: integer("assessment_completed", { mode: "boolean" }).notNull().default(false),
  assessmentCompletedDate: text("assessment_completed_date"),
  cansCompleted: integer("cans_completed", { mode: "boolean" }).notNull().default(false),
  cansScore: integer("cans_score"),
  cansRiskLevel: text("cans_risk_level", { enum: ["low", "moderate", "high", "very_high"] }),
  // Cross-divisional liaison (GRO ↔ BHC)
  groLiaisonId: text("gro_liaison_id"),
  groLiaisonName: text("gro_liaison_name"),
  groFacilityId: text("gro_facility_id"),
  bedAssignment: text("bed_assignment"),
  // Status
  status: text("status", { enum: ["intake", "active", "on_hold", "transitioning", "discharged"] }).notNull().default("intake"),
  // Timeline
  admissionDate: text("admission_date").$defaultFn(() => new Date().toISOString()),
  projectedDischargeDate: text("projected_discharge_date"),
  actualDischargeDate: text("actual_discharge_date"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── CCMG: Cross-Divisional Referrals ────────────────────────

export const ccmgReferrals = sqliteTable("ccmg_referrals", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Referral details
  referralType: text("referral_type", { enum: ["internal", "external", "gro_to_bhc", "bhc_to_gro", "inter_department"] }).notNull(),
  fromDepartment: text("from_department", { enum: ["CCMG", "MHTCM", "MHRS", "GRO"] }).notNull(),
  toDepartment: text("to_department", { enum: ["CCMG", "MHTCM", "MHRS", "GRO"] }).notNull(),
  requestedBy: text("requested_by").notNull(),
  requestedById: text("requested_by_id"),
  requestDate: text("request_date").$defaultFn(() => new Date().toISOString()),
  // Content
  reasonForReferral: text("reason_for_referral").notNull(),
  clinicalJustification: text("clinical_justification"),
  urgency: text("urgency", { enum: ["routine", "urgent", "emergency"] }).notNull().default("routine"),
  // Outcome
  status: text("status", { enum: ["pending", "accepted", "scheduled", "completed", "declined", "cancelled"] }).notNull().default("pending"),
  acceptedBy: text("accepted_by"),
  acceptedAt: text("accepted_at"),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  outcomeNotes: text("outcome_notes"),
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpDate: text("follow_up_date"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── BHC Department Metrics ──────────────────────────────────

export const bhcDepartmentMetrics = sqliteTable("bhc_department_metrics", {
  id: text("id").primaryKey(),
  department: text("department", { enum: ["CCMG", "MHTCM", "MHRS"] }).notNull(),
  metricDate: text("metric_date").notNull(),
  // Census
  activeCases: integer("active_cases").notNull().default(0),
  newIntakes: integer("new_intakes").notNull().default(0),
  discharges: integer("discharges").notNull().default(0),
  transfersIn: integer("transfers_in").notNull().default(0),
  transfersOut: integer("transfers_out").notNull().default(0),
  // Clinical
  avgLengthOfStayDays: integer("avg_length_of_stay_days"),
  plansOverdue: integer("plans_overdue").notNull().default(0),
  encountersThisWeek: integer("encounters_this_week").notNull().default(0),
  // Quality
  cansCompletionRate: integer("cans_completion_rate"), // percentage
  satisfactionScore: integer("satisfaction_score"), // 0-100
  // Staffing
  staffCount: integer("staff_count").notNull().default(0),
  openPositions: integer("open_positions").notNull().default(0),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// MHTCM: Mental Health Targeted Case Management (T-004)
// 6 core functions per HHSC. T1017 billing. Service plan within 14 days.
// ═══════════════════════════════════════════════════════════════

// ─── MHTCM: Service Plans ────────────────────────────────────

export const mhtcmServicePlans = sqliteTable("mhtcm_service_plans", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  caseManagerId: text("case_manager_id").notNull(),
  caseManagerName: text("case_manager_name").notNull(),
  // Plan lifecycle
  planStatus: text("plan_status", { enum: ["draft", "active", "under_review", "approved", "superseded", "closed"] }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  // Timelines
  intakeDate: text("intake_date").notNull(),
  planDueDate: text("plan_due_date").notNull(), // intake + 14 days
  planCompletedDate: text("plan_completed_date"),
  nextReviewDue: text("next_review_due"), // +90 days from approval
  lastReviewDate: text("last_review_date"),
  // 6 MHTCM functions with goals
  function1IntakeGoal: text("function1_intake_goal"),
  function1IntakeCompleted: integer("function1_intake_completed", { mode: "boolean" }).notNull().default(false),
  function2EligibilityGoal: text("function2_eligibility_goal"),
  function2EligibilityCompleted: integer("function2_eligibility_completed", { mode: "boolean" }).notNull().default(false),
  function3CoordinationGoal: text("function3_coordination_goal"),
  function3CoordinationCompleted: integer("function3_coordination_completed", { mode: "boolean" }).notNull().default(false),
  function4ReferralGoal: text("function4_referral_goal"),
  function4ReferralCompleted: integer("function4_referral_completed", { mode: "boolean" }).notNull().default(false),
  function5MonitoringGoal: text("function5_monitoring_goal"),
  function5MonitoringCompleted: integer("function5_monitoring_completed", { mode: "boolean" }).notNull().default(false),
  function6TransitionGoal: text("function6_transition_goal"),
  function6TransitionCompleted: integer("function6_transition_completed", { mode: "boolean" }).notNull().default(false),
  // CANS integration
  cansScoreAtIntake: integer("cans_score_at_intake"),
  cansRiskLevel: text("cans_risk_level", { enum: ["low", "moderate", "high", "very_high"] }),
  locDetermined: integer("loc_determined", { mode: "boolean" }).notNull().default(false),
  locLevel: text("loc_level", { enum: ["loc_1_high_acuity", "loc_2_moderate_acuity", "loc_3_low_acuity", "not_determined"] }).default("not_determined"),
  // Approval chain
  preparedBy: text("prepared_by"),
  preparedAt: text("prepared_at"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  approvedBy: text("approved_by"), // LPHA required
  approvedAt: text("approved_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── MHTCM: Encounters (T1017 Billing) ───────────────────────

export const mhtcmEncounters = sqliteTable("mhtcm_encounters", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  servicePlanId: text("service_plan_id").notNull(),
  caseManagerId: text("case_manager_id").notNull(),
  caseManagerName: text("case_manager_name").notNull(),
  // Encounter details
  encounterDate: text("encounter_date").notNull(),
  encounterType: text("encounter_type", { enum: ["intake_assessment", "care_coordination", "collateral_contact", "referral_linkage", "monitoring_visit", "crisis_response", "discharge_planning", "telehealth"] }).notNull(),
  // T1017 billing
  billingCode: text("billing_code").notNull().default("T1017"),
  unitsBilled: integer("units_billed").notNull().default(1), // per 15-min unit
  minutesDelivered: integer("minutes_delivered").notNull().default(15),
  // Function mapping
  mhtcmFunction: text("mhtcm_function", { enum: ["intake", "eligibility", "coordination", "referral", "monitoring", "transition"] }).notNull(),
  // Documentation
  serviceDescription: text("service_description").notNull(),
  barriersIdentified: text("barriers_identified"),
  interventionsProvided: text("interventions_provided"),
  youthResponse: text("youth_response"),
  planModifications: text("plan_modifications"),
  nextSteps: text("next_steps"),
  // Collateral contacts
  collateralContactsJson: text("collateral_contacts_json"), // [{name, role, contactType, notes}]
  // Outcome
  goalProgress: text("goal_progress", { enum: ["no_change", "minimal_progress", "moderate_progress", "significant_progress", "goal_achieved"] }).default("no_change"),
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpDate: text("follow_up_date"),
  followUpActions: text("follow_up_actions"),
  // Status
  documentationStatus: text("documentation_status", { enum: ["draft", "completed", "signed", "submitted"] }).notNull().default("draft"),
  signedBy: text("signed_by"),
  signedAt: text("signed_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── MHTCM: Eligibility Tracking ─────────────────────────────

export const mhtcmEligibility = sqliteTable("mhtcm_eligibility", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Eligibility criteria
  ageQualified: integer("age_qualified", { mode: "boolean" }).notNull().default(false), // 3-17 for youth
  diagnosisQualified: integer("diagnosis_qualified", { mode: "boolean" }).notNull().default(false), // DSM-5 diagnosis
  functionalImpairment: integer("functional_impairment", { mode: "boolean" }).notNull().default(false), // CANS-based
  medicaidEligible: integer("medicaid_eligible", { mode: "boolean" }).notNull().default(false),
  // Diagnosis
  primaryDiagnosis: text("primary_diagnosis"),
  primaryDiagnosisCode: text("primary_diagnosis_code"), // ICD-10
  secondaryDiagnosis: text("secondary_diagnosis"),
  secondaryDiagnosisCode: text("secondary_diagnosis_code"),
  // Determination
  eligibilityStatus: text("eligibility_status", { enum: ["pending", "eligible", "ineligible", "under_review", "expired"] }).notNull().default("pending"),
  determinedBy: text("determined_by"),
  determinedAt: text("determined_at"),
  determinationRationale: text("determination_rationale"),
  // CANS reference
  cansAssessmentId: text("cans_assessment_id"),
  cansTotalScore: integer("cans_total_score"),
  // Renewal
  effectiveDate: text("effective_date"),
  expirationDate: text("expiration_date"), // typically 1 year
  reauthorizationDue: text("reauthorization_due"),
  reauthorizationStatus: text("reauthorization_status", { enum: ["not_due", "upcoming", "overdue", "submitted", "approved"] }).default("not_due"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// 42 CFR Part 2: SUD Confidentiality Compliance (T-007)
// Substance Use Disorder information protection, consent
// management, qualified service organization agreements,
// breach notification, audit trail
// ═══════════════════════════════════════════════════════════════

// ─── 42CFR2: SUD Records ─────────────────────────────────────

export const sudRecords = sqliteTable("sud_records", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // SUD information classification
  substanceType: text("substance_type", { enum: ["alcohol", "cannabis", "opioids", "stimulants", "sedatives", "hallucinogens", "polysubstance", "other"] }).notNull(),
  diagnosisCode: text("diagnosis_code"), // ICD-10 F10-F19
  severity: text("severity", { enum: ["mild", "moderate", "severe"] }),
  // 42 CFR Part 2 flags
  isPart2Protected: integer("is_part2_protected", { mode: "boolean" }).notNull().default(true),
  part2DesignationDate: text("part2_designation_date").$defaultFn(() => new Date().toISOString()),
  // Status
  status: text("status", { enum: ["active", "in_remission", "resolved", "transferred"] }).notNull().default("active"),
  // Clinical
  assessmentDate: text("assessment_date").notNull(),
  assessingClinicianId: text("assessing_clinician_id"),
  assessingClinicianName: text("assessing_clinician_name"),
  treatmentPlanReference: text("treatment_plan_reference"),
  notes: text("notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── 42CFR2: Consent Management ──────────────────────────────

export const part2Consents = sqliteTable("part2_consents", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  sudRecordId: text("sud_record_id").notNull(),
  // Consent scope
  consentType: text("consent_type", { enum: ["initial", "renewal", "revocation", "amendment"] }).notNull(),
  // Recipient
  recipientName: text("recipient_name").notNull(),
  recipientOrganization: text("recipient_organization"),
  recipientType: text("recipient_type", { enum: ["healthcare_provider", "insurance", "court", "family_member", "school", "employer", "research", "other"] }).notNull(),
  recipientNpi: text("recipient_npi"),
  // Scope
  informationScope: text("information_scope", { enum: ["full_record", "summary_only", "specific_elements"] }).notNull().default("full_record"),
  specificElements: text("specific_elements"), // JSON if scope is specific_elements
  purpose: text("purpose").notNull(),
  // Duration
  effectiveDate: text("effective_date").notNull(),
  expirationDate: text("expiration_date"),
  expirationEvent: text("expiration_event", { enum: ["fixed_date", "treatment_end", "youth_age_18", "specific_event"] }).default("fixed_date"),
  // Authorization
  authorizedBy: text("authorized_by").notNull(), // "youth_guardian" or "youth" if emancipated
  guardianName: text("guardian_name"),
  guardianRelationship: text("guardian_relationship"),
  youthSignature: text("youth_signature"), // boolean as string for simplicity
  guardianSignature: text("guardian_signature"),
  witnessName: text("witness_name"),
  witnessSignature: text("witness_signature"),
  // Status
  status: text("status", { enum: ["pending", "active", "expired", "revoked", "superseded"] }).notNull().default("pending"),
  revokedAt: text("revoked_at"),
  revokedBy: text("revoked_by"),
  revocationReason: text("revocation_reason"),
  // QSOA indicator
  isQsoa: integer("is_qsoa", { mode: "boolean" }).notNull().default(false),
  qsoaAgreementId: text("qsoa_agreement_id"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── 42CFR2: Qualified Service Organization Agreements ───────

export const qsoaAgreements = sqliteTable("qsoa_agreements", {
  id: text("id").primaryKey(),
  organizationName: text("organization_name").notNull(),
  organizationType: text("organization_type", { enum: ["laboratory", "pharmacy", "billing_service", "quality_assurance", "it_vendor", "other"] }).notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  // Agreement
  agreementDate: text("agreement_date").notNull(),
  effectiveDate: text("effective_date").notNull(),
  expirationDate: text("expiration_date"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
  // Scope
  servicesProvided: text("services_provided").notNull(),
  dataAccessScope: text("data_access_scope", { enum: ["full", "limited", "de_identified"] }).notNull().default("limited"),
  dataAccessDescription: text("data_access_description"),
  // Compliance
  baaExecuted: integer("baa_executed", { mode: "boolean" }).notNull().default(false),
  baaDate: text("baa_date"),
  staffTrained: integer("staff_trained", { mode: "boolean" }).notNull().default(false),
  trainingDate: text("training_date"),
  // Status
  status: text("status", { enum: ["draft", "active", "expiring_soon", "expired", "terminated"] }).notNull().default("draft"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── 42CFR2: Access Audit Log ────────────────────────────────

export const part2AuditLog = sqliteTable("part2_audit_log", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  mrn: text("mrn").notNull(),
  sudRecordId: text("sud_record_id").notNull(),
  // Access details
  accessType: text("access_type", { enum: ["view", "create", "update", "delete", "disclose", "print", "export"] }).notNull(),
  accessedBy: text("accessed_by").notNull(),
  accessedById: text("accessed_by_id"),
  accessedByRole: text("accessed_by_role"),
  // Context
  accessTimestamp: text("access_timestamp").$defaultFn(() => new Date().toISOString()),
  accessContext: text("access_context", { enum: ["treatment", "payment", "healthcare_operations", "audit", "research", "legal", "other"] }).notNull(),
  consentId: text("consent_id"), // null if internal access
  qsoaId: text("qsoa_id"), // null if not QSOA
  // Record details
  recordTypeAccessed: text("record_type_accessed").notNull(),
  fieldsAccessed: text("fields_accessed"), // JSON array
  // Flag
  unauthorizedFlag: integer("unauthorized_flag", { mode: "boolean" }).notNull().default(false),
  flagReason: text("flag_reason"),
  // IP / session
  ipAddress: text("ip_address"),
  sessionId: text("session_id"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── 42CFR2: Breach Notification ─────────────────────────────

export const part2BreachNotifications = sqliteTable("part2_breach_notifications", {
  id: text("id").primaryKey(),
  breachNumber: text("breach_number").notNull().unique(),
  // Breach details
  discoveredDate: text("discovered_date").notNull(),
  breachType: text("breach_type", { enum: ["unauthorized_access", "unauthorized_disclosure", "data_loss", "system_intrusion", "physical_theft", "other"] }).notNull(),
  description: text("description").notNull(),
  affectedYouthCount: integer("affected_youth_count").notNull().default(0),
  affectedRecordCount: integer("affected_record_count").notNull().default(0),
  // Affected youth (JSON array for simplicity)
  affectedYouthJson: text("affected_youth_json"),
  // Response
  containmentActions: text("containment_actions"),
  mitigationActions: text("mitigation_actions"),
  // Notification timeline
  secretaryNotified: integer("secretary_notified", { mode: "boolean" }).notNull().default(false),
  secretaryNotifiedAt: text("secretary_notified_at"),
  patientsNotified: integer("patients_notified", { mode: "boolean" }).notNull().default(false),
  patientsNotifiedAt: text("patients_notified_at"),
  patientsNotifiedBy: text("patients_notified_by"),
  // Status
  status: text("status", { enum: ["open", "contained", "mitigated", "notified", "closed"] }).notNull().default("open"),
  closedAt: text("closed_at"),
  closedBy: text("closed_by"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// GRO: Minimum Standards Compliance (T-006)
// Title 26 TAC Chapter 748 — staffing ratios, youth rights,
// restraint reporting, prohibited practices, record retention
// ═══════════════════════════════════════════════════════════════

// ─── GRO: Youth Rights Acknowledgment ────────────────────────

export const youthRightsAcknowledgments = sqliteTable("youth_rights_acknowledgments", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Rights document
  rightsVersion: text("rights_version").notNull().default("2024-01"),
  rightsDocumentUrl: text("rights_document_url"),
  // Acknowledgment
  acknowledgedByYouth: integer("acknowledged_by_youth", { mode: "boolean" }).notNull().default(false),
  youthAcknowledgedAt: text("youth_acknowledged_at"),
  acknowledgedByGuardian: integer("acknowledged_by_guardian", { mode: "boolean" }).notNull().default(false),
  guardianAcknowledgedAt: text("guardian_acknowledged_at"),
  guardianName: text("guardian_name"),
  // Delivery
  deliveredBy: text("delivered_by").notNull(),
  deliveredById: text("delivered_by_id"),
  deliveredAt: text("delivered_at").$defaultFn(() => new Date().toISOString()),
  deliveryMethod: text("delivery_method", { enum: ["in_person", "video", "written", "interpreter"] }).notNull().default("in_person"),
  language: text("language").notNull().default("English"),
  interpreterUsed: integer("interpreter_used", { mode: "boolean" }).notNull().default(false),
  interpreterName: text("interpreter_name"),
  // Notes
  notes: text("notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── GRO: Restraint / Seclusion Incident Reports ─────────────

export const restraintIncidents = sqliteTable("restraint_incidents", {
  id: text("id").primaryKey(),
  incidentNumber: text("incident_number").notNull().unique(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Incident details
  incidentDate: text("incident_date").notNull(),
  incidentTime: text("incident_time").notNull(),
  incidentLocation: text("incident_location").notNull(),
  incidentType: text("incident_type", { enum: ["physical_restraint", "mechanical_restraint", "seclusion", "chemical_restraint", "time_out", "emergency_safety_intervention"] }).notNull(),
  // Staff involved
  primaryStaffId: text("primary_staff_id").notNull(),
  primaryStaffName: text("primary_staff_name").notNull(),
  secondaryStaffId: text("secondary_staff_id"),
  secondaryStaffName: text("secondary_staff_name"),
  supervisorNotifiedAt: text("supervisor_notified_at"),
  // Circumstances
  precipitatingFactors: text("precipitating_factors").notNull(),
  youthBehavior: text("youth_behavior").notNull(),
  deescalationAttempts: text("deescalation_attempts").notNull(),
  lessRestrictiveAlternatives: text("less_restrictive_alternatives"),
  // Duration
  interventionStartedAt: text("intervention_started_at").notNull(),
  interventionEndedAt: text("intervention_ended_at"),
  durationMinutes: integer("duration_minutes"),
  // Injuries
  youthInjuries: text("youth_injuries"),
  staffInjuries: text("staff_injuries"),
  medicalAttentionRequired: integer("medical_attention_required", { mode: "boolean" }).notNull().default(false),
  medicalEvaluationCompleted: integer("medical_evaluation_completed", { mode: "boolean" }).notNull().default(false),
  medicalEvaluationCompletedAt: text("medical_evaluation_completed_at"),
  medicalEvaluationBy: text("medical_evaluation_by"),
  // Documentation timeline (T-748 compliance)
  initialDocumentationCompleted: integer("initial_documentation_completed", { mode: "boolean" }).notNull().default(false),
  initialDocumentationDue: text("initial_documentation_due"), // incidentTime + 1 hour
  initialDocumentationCompletedAt: text("initial_documentation_completed_at"),
  // Follow-up
  followUpReviewCompleted: integer("follow_up_review_completed", { mode: "boolean" }).notNull().default(false),
  followUpReviewDue: text("follow_up_review_due"), // incidentDate + 24 hours
  followUpReviewCompletedAt: text("follow_up_review_completed_at"),
  followUpActions: text("follow_up_actions"),
  // Status
  status: text("status", { enum: ["open", "documented", "medical_pending", "under_review", "closed"] }).notNull().default("open"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});

// ─── GRO: Prohibited Practices Checklist ─────────────────────

export const prohibitedPractices = sqliteTable("prohibited_practices", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull(),
  incidentNumber: text("incident_number").notNull(),
  youthId: text("youth_id").notNull(),
  // 748.5567 — Prohibited practices
  proneRestraintUsed: integer("prone_restraint_used", { mode: "boolean" }).notNull().default(false),
  supineRestraintUsed: integer("supine_restraint_used", { mode: "boolean" }).notNull().default(false),
  mechanicalRestraintUsed: integer("mechanical_restraint_used", { mode: "boolean" }).notNull().default(false),
  chemicalRestraintUsed: integer("chemical_restraint_used", { mode: "boolean" }).notNull().default(false),
  denialOfMeals: integer("denial_of_meals", { mode: "boolean" }).notNull().default(false),
  denialOfSleep: integer("denial_of_sleep", { mode: "boolean" }).notNull().default(false),
  corporalPunishment: integer("corporal_punishment", { mode: "boolean" }).notNull().default(false),
  humiliationDegradation: integer("humiliation_degradation", { mode: "boolean" }).notNull().default(false),
  // Verification
  certified: integer("certified", { mode: "boolean" }).notNull().default(false),
  certifiedBy: text("certified_by"),
  certifiedAt: text("certified_at"),
  notes: text("notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── GRO: Record Retention Tracking ──────────────────────────

export const recordRetention = sqliteTable("record_retention", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  // Retention rules per T-748
  recordType: text("record_type", { enum: ["admission_intake", "medical", "behavioral", "incident", "treatment_plan", "discharge_summary", "guardian_communication", "education", "medication_administration"] }).notNull(),
  // Timeline
  createdDate: text("created_date").notNull(),
  retentionYears: integer("retention_years").notNull().default(5),
  expirationDate: text("expiration_date").notNull(), // createdDate + retentionYears
  // Status
  status: text("status", { enum: ["active", "expiring_soon", "expired", "archived", "destroyed"] }).notNull().default("active"),
  // Destruction
  destroyedBy: text("destroyed_by"),
  destroyedAt: text("destroyed_at"),
  destructionAuthorization: text("destruction_authorization"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M19-EXT: Three-Stage Campus Data Model (T-002)
// ═══════════════════════════════════════════════════════════════

// ─── Campus Stages ───────────────────────────────────────────

export const campusStages = sqliteTable("campus_stages", {
  id: text("id").primaryKey(),
  stageNumber: integer("stage_number").notNull(), // 1, 2, 3
  name: text("name").notNull(), // e.g. "Stage 1 — Assessment & Stabilization"
  description: text("description"),
  facilityId: text("facility_id").notNull(),
  // Capacity
  licensedCapacity: integer("licensed_capacity").notNull().default(16),
  operationalCapacity: integer("operational_capacity").notNull().default(16),
  currentCensus: integer("current_census").notNull().default(0),
  // Alert thresholds (percentage)
  capacityAlertThreshold: integer("capacity_alert_threshold").notNull().default(90), // % full → warning
  capacityCriticalThreshold: integer("capacity_critical_threshold").notNull().default(95), // % full → critical
  // Status
  status: text("status", { enum: ["planned", "active", "paused", "closed"] }).notNull().default("planned"),
  activationDate: text("activation_date"),
  deactivationDate: text("deactivation_date"),
  // Staffing ratios (per HHSC Title 26 TAC Ch 748)
  awakeStaffRatio: text("awake_staff_ratio").notNull().default("1:8"),
  overnightStaffRatio: text("overnight_staff_ratio").notNull().default("1:16"),
  // Clinical requirements
  requiresLPHAAssessment: integer("requires_lpha_assessment", { mode: "boolean" }).notNull().default(false),
  minAssessmentHours: integer("min_assessment_hours").notNull().default(0),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Stage Assignment History ────────────────────────────────

export const stageAssignments = sqliteTable("stage_assignments", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  fromStageId: text("from_stage_id"), // null for initial assignment
  toStageId: text("to_stage_id").notNull(),
  assignmentType: text("assignment_type", { enum: ["initial", "progression", "regression", "transfer", "discharge"] }).notNull().default("initial"),
  assignedBy: text("assigned_by").notNull(),
  assignedById: text("assigned_by_id"),
  assignmentRationale: text("assignment_rationale"),
  projectedDurationDays: integer("projected_duration_days"),
  bedAssignment: text("bed_assignment"), // references bedCensusV2.bedLabel
  // Outcome
  completedDate: text("completed_date"),
  completionOutcome: text("completion_outcome", { enum: ["progressed", "regressed", "discharged", "transferred", "ongoing"] }),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Stage Progression Criteria ──────────────────────────────

export const stageProgressionCriteria = sqliteTable("stage_progression_criteria", {
  id: text("id").primaryKey(),
  stageId: text("stage_id").notNull(),
  criterionNumber: integer("criterion_number").notNull(),
  criterionName: text("criterion_name").notNull(),
  description: text("description").notNull(),
  requiredForProgression: integer("required_for_progression", { mode: "boolean" }).notNull().default(true),
  assessmentTool: text("assessment_tool"), // e.g. "CANS", "PHQ-9", "Clinical Judgment"
  targetScore: text("target_score"), // threshold description
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Census Alerts ───────────────────────────────────────────

export const censusAlerts = sqliteTable("census_alerts", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id").notNull(),
  stageId: text("stage_id").notNull(),
  alertType: text("alert_type", { enum: ["capacity_warning", "capacity_critical", "staffing_shortfall", "admission_ready", "discharge_ready", "overage"] }).notNull(),
  severity: text("severity", { enum: ["low", "moderate", "high", "critical"] }).notNull(),
  message: text("message").notNull(),
  currentCensus: integer("current_census").notNull(),
  capacityLimit: integer("capacity_limit").notNull(),
  percentFull: integer("percent_full").notNull(), // integer percentage 0-100
  triggeredAt: text("triggered_at").$defaultFn(() => new Date().toISOString()),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: text("acknowledged_at"),
  resolvedAt: text("resolved_at"),
  autoResolved: integer("auto_resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Campus Stage Census Snapshot (point-in-time for reporting) ─

export const censusSnapshots = sqliteTable("census_snapshots", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  snapshotTime: text("snapshot_time").notNull().default("23:59:59"),
  stage1Census: integer("stage1_census").notNull().default(0),
  stage2Census: integer("stage2_census").notNull().default(0),
  stage3Census: integer("stage3_census").notNull().default(0),
  totalCensus: integer("total_census").notNull().default(0),
  stage1Capacity: integer("stage1_capacity").notNull().default(16),
  stage2Capacity: integer("stage2_capacity").notNull().default(16),
  stage3Capacity: integer("stage3_capacity").notNull().default(16),
  totalCapacity: integer("total_capacity").notNull().default(48),
  stage1Percent: integer("stage1_percent").notNull().default(0),
  stage2Percent: integer("stage2_percent").notNull().default(0),
  stage3Percent: integer("stage3_percent").notNull().default(0),
  overallPercent: integer("overall_percent").notNull().default(0),
  alertsTriggered: integer("alerts_triggered").notNull().default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// Document Generation Pipeline (T-010)
// Template registry for AMOS-OPS branded document generation
// ═══════════════════════════════════════════════════════════════

export const documentTemplates = sqliteTable("document_templates", {
  id: text("id").primaryKey(),
  templateName: text("template_name").notNull(),
  templateCode: text("template_code").notNull().unique(), // e.g. "treatment-plan", "incident-report"
  description: text("description"),
  documentType: text("document_type", { enum: ["clinical", "compliance", "administrative", "financial", "hr", "executive"] }).notNull(),
  // Division scope
  applicableDivisions: text("applicable_divisions").notNull().default("all"), // JSON array: ["GRO","BHC","EO","GAD"]
  // Template configuration
  coverPageRequired: integer("cover_page_required", { mode: "boolean" }).notNull().default(true),
  tocRequired: integer("toc_required", { mode: "boolean" }).notNull().default(false),
  signatureBlocks: integer("signature_blocks").notNull().default(0),
  // Swiss Style config
  primaryColor: text("primary_color").notNull().default("#245C5A"),
  accentColor: text("accent_color"),
  // Status
  status: text("status", { enum: ["draft", "active", "deprecated"] }).notNull().default("draft"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const generatedDocuments = sqliteTable("generated_documents", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  templateCode: text("template_code").notNull(),
  documentTitle: text("document_title").notNull(),
  // Context
  youthId: text("youth_id"),
  youthName: text("youth_name"),
  mrn: text("mrn"),
  generatedBy: text("generated_by").notNull(),
  generatedById: text("generated_by_id"),
  division: text("division"),
  // Status
  status: text("status", { enum: ["queued", "generating", "completed", "failed"] }).notNull().default("queued"),
  // Output
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  pageCount: integer("page_count"),
  // Error
  errorMessage: text("error_message"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

// ═══════════════════════════════════════════════════════════════
// MGMA: 7-Domain Practice Management Baseline (T-008)
// ═══════════════════════════════════════════════════════════════

export const mgmaDomains = sqliteTable("mgma_domains", {
  id: text("id").primaryKey(),
  domainNumber: integer("domain_number").notNull(),
  domainName: text("domain_name").notNull(),
  domainDescription: text("domain_description").notNull(),
  amosOpsModule: text("amos_ops_module").notNull(),
  moduleRoute: text("module_route").notNull(),
  responsibleDivision: text("responsible_division", { enum: ["EO", "GAD", "GRO", "BHC"] }).notNull(),
  status: text("status", { enum: ["planned", "configured", "active", "under_review"] }).notNull().default("planned"),
  configuredAt: text("configured_at"),
  configuredBy: text("configured_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const mgmaKpiTargets = sqliteTable("mgma_kpi_targets", {
  id: text("id").primaryKey(),
  domainId: text("domain_id").notNull(),
  kpiName: text("kpi_name").notNull(),
  kpiDescription: text("kpi_description").notNull(),
  targetValue: text("target_value").notNull(),
  targetUnit: text("target_unit").notNull(),
  comparisonOperator: text("comparison_operator", { enum: ["less_than", "greater_than", "equal_to", "between"] }).notNull().default("less_than"),
  benchmarkSource: text("benchmark_source").notNull().default("MGMA 2024"),
  currentValue: text("current_value"),
  lastMeasuredAt: text("last_measured_at"),
  measurementFrequency: text("measurement_frequency", { enum: ["daily", "weekly", "monthly", "quarterly", "annually"] }).notNull().default("monthly"),
  status: text("status", { enum: ["on_target", "at_risk", "off_target", "not_measured"] }).notNull().default("not_measured"),
  alertThreshold: text("alert_threshold"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const mgmaScorecards = sqliteTable("mgma_scorecards", {
  id: text("id").primaryKey(),
  division: text("division", { enum: ["EO", "GAD", "GRO", "BHC"] }).notNull(),
  scorecardDate: text("scorecard_date").notNull(),
  overallScore: integer("overall_score"),
  kpisOnTarget: integer("kpis_on_target").notNull().default(0),
  kpisAtRisk: integer("kpis_at_risk").notNull().default(0),
  kpisOffTarget: integer("kpis_off_target").notNull().default(0),
  kpisNotMeasured: integer("kpis_not_measured").notNull().default(0),
  domainScoresJson: text("domain_scores_json"),
  executiveSummary: text("executive_summary"),
  actionItems: text("action_items"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M7: GAD — General Administration
// ═══════════════════════════════════════════════════════════════

// ─── M7: Procurement Requests ──────────────────────────────

export const procurementRequests = sqliteTable("procurement_requests", {
  id: text("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["equipment", "supplies", "services", "furniture", "technology", "safety", "other"] }).notNull().default("supplies"),
  quantity: integer("quantity").notNull().default(1),
  estimatedUnitCost: integer("estimated_unit_cost"), // cents
  estimatedTotalCost: integer("estimated_total_cost"), // cents
  vendorId: text("vendor_id"),
  vendorName: text("vendor_name"),
  facilityId: text("facility_id"),
  facilityName: text("facility_name"),
  requestedBy: text("requested_by").notNull(),
  requestedById: text("requested_by_id"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  status: text("status", { enum: ["draft", "submitted", "under_review", "approved", "rejected", "ordered", "received", "cancelled"] }).notNull().default("draft"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  justification: text("justification"),
  rejectionReason: text("rejection_reason"),
  poNumber: text("po_number"),
  receivedAt: text("received_at"),
  receivedBy: text("received_by"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M7: Safety Inspections ────────────────────────────────

export const safetyInspections = sqliteTable("safety_inspections", {
  id: text("id").primaryKey(),
  inspectionNumber: text("inspection_number").notNull().unique(),
  facilityId: text("facility_id").notNull(),
  facilityName: text("facility_name").notNull(),
  inspectionType: text("inspection_type", { enum: ["fire_safety", "sprinkler", "emergency_lighting", "generator", "extinguisher", "hvac", "electrical", "plumbing", "security", "grounds", "food_service", "general"] }).notNull(),
  inspectedBy: text("inspected_by").notNull(),
  inspectedById: text("inspected_by_id"),
  inspectionDate: text("inspection_date").notNull(),
  nextDueDate: text("next_due_date"),
  frequencyDays: integer("frequency_days").notNull().default(90),
  status: text("status", { enum: ["passed", "passed_with_notes", "failed", "pending", "overdue"] }).notNull().default("pending"),
  score: integer("score"), // 0-100
  checklistJson: text("checklist_json").notNull().default("[]"),
  findings: text("findings"),
  correctiveActions: text("corrective_actions"),
  correctiveActionsCompleted: integer("corrective_actions_completed", { mode: "boolean" }).notNull().default(false),
  correctiveActionsCompletedAt: text("corrective_actions_completed_at"),
  photosJson: text("photos_json"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── M7: Vendor Contracts ──────────────────────────────────

export const vendorContracts = sqliteTable("vendor_contracts", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  contractNumber: text("contract_number").notNull().unique(),
  contractType: text("contract_type", { enum: ["service_agreement", "purchase_order", "maintenance", "warranty", "insurance", "lease", "other"] }).notNull().default("service_agreement"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  value: integer("value"), // cents
  paymentTerms: text("payment_terms"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
  renewalTerms: text("renewal_terms"),
  terminationNoticeDays: integer("termination_notice_days").default(30),
  status: text("status", { enum: ["draft", "active", "expiring", "expired", "terminated", "pending_renewal"] }).notNull().default("active"),
  scopeOfWork: text("scope_of_work"),
  documentsJson: text("documents_json"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// M21: Agent Persona Registry
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// D005: Workflow Engine Tables (v2)
// ═══════════════════════════════════════════════════════════════

export const workflowDefinitionsV2 = sqliteTable("workflow_definitions_v2", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  statusMap: text("status_map"), // JSON array
  evidenceGates: text("evidence_gates"), // JSON array
  escalationRules: text("escalation_rules"), // JSON array
  entityType: text("entity_type").notNull().default("general"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const workflowInstancesV2 = sqliteTable("workflow_instances_v2", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  workflowId: text("workflow_id").notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  currentStatus: text("current_status").notNull(),
  previousStatus: text("previous_status"),
  assignedTo: text("assigned_to"),
  createdBy: text("created_by"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  dueDate: text("due_date"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  escalationReason: text("escalation_reason"),
  notes: text("notes"),
});

export const workflowTransitionsV2 = sqliteTable("workflow_transitions_v2", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  instanceId: integer("instance_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actor: text("actor"),
  reason: text("reason"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const workflowEvidenceV2 = sqliteTable("workflow_evidence_v2", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  instanceId: integer("instance_id").notNull(),
  gateName: text("gate_name").notNull(),
  fileName: text("file_name"),
  filePath: text("file_path"),
  submittedBy: text("submitted_by"),
  submittedAt: text("submitted_at").$defaultFn(() => new Date().toISOString()),
  validated: integer("validated", { mode: "boolean" }).notNull().default(false),
});

// ═══════════════════════════════════════════════════════════════
// D006-03: Human-in-Command Boundary Enforcement Tables
// ═══════════════════════════════════════════════════════════════

// ─── PHI Access Log ──────────────────────────────────────────

export const phiAccessLog = sqliteTable("phi_access_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  patientId: text("patient_id").notNull(),
  recordType: text("record_type", {
    enum: [
      "demographics", "clinical_assessment", "treatment_plan",
      "medication", "diagnosis", "progress_note", "lab_result",
      "insurance", "appointment", "contact_info", "emergency_contact",
      "discharge_summary", "case_note", "cans_assessment",
      "incident_report", "billing_record",
    ],
  }).notNull(),
  endpoint: text("endpoint").notNull(),
  accessPurpose: text("access_purpose").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  accessedAt: text("accessed_at").$defaultFn(() => new Date().toISOString()),
  outcome: text("outcome", { enum: ["allowed", "denied", "blocked"] }).notNull().default("allowed"),
  denialReason: text("denial_reason"),
});

// ─── Compliance Queue ────────────────────────────────────────

export const complianceQueue = sqliteTable("compliance_queue", {
  id: text("id").primaryKey(),
  findingType: text("finding_type").notNull(),
  severity: text("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  description: text("description").notNull(),
  clientId: text("client_id"),
  programId: text("program_id"),
  evidenceRefs: text("evidence_refs"), // JSON array of evidence reference IDs
  reportedBy: text("reported_by").notNull(),
  qaOfficerId: text("qa_officer_id"),
  status: text("status", {
    enum: ["pending_review", "under_review", "approved", "rejected", "escalated"],
  }).notNull().default("pending_review"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  reviewedAt: text("reviewed_at"),
  resolutionNotes: text("resolution_notes"),
});

// ═══════════════════════════════════════════════════════════════
// QA: Evidence Matrix (D008-03)
// ═══════════════════════════════════════════════════════════════

export const evidenceMatrix = sqliteTable("evidence_matrix", {
  id: text("id").primaryKey(),
  evidenceNumber: text("evidence_number").notNull().unique(), // EVM-YYYY-NNNN
  title: text("title").notNull(),
  description: text("description"),
  // Classification
  category: text("category", { enum: ["policy", "procedure", "training_record", "audit_report", "incident_report", "credential", "risk_assessment", "other"] }).notNull(),
  complianceArea: text("compliance_area", { enum: ["hipaa_privacy", "hipaa_security", "cfr42_part2", "state_licensure", "staff_credentials", "incident_reporting", "medication_management", "youth_rights", "other"] }).notNull(),
  // Source
  sourceType: text("source_type", { enum: ["document", "system_log", "interview", "observation", "external_report", "photo", "other"] }).notNull(),
  sourceReference: text("source_reference"), // document ID, file path, etc.
  // Location
  department: text("department"),
  facilityId: text("facility_id"),
  // Dates
  evidenceDate: text("evidence_date").notNull(), // when the evidence was captured
  reviewDate: text("review_date"),
  expirationDate: text("expiration_date"),
  // Review
  reviewedBy: text("reviewed_by"),
  reviewedById: text("reviewed_by_id"),
  reviewNotes: text("review_notes"),
  // Status
  status: text("status", { enum: ["active", "under_review", "expired", "superseded", "archived"] }).notNull().default("active"),
  supersededById: text("superseded_by_id"),
  // Relation to audit
  relatedAuditId: text("related_audit_id"),
  relatedAuditNumber: text("related_audit_number"),
  // Tags (JSON)
  tagsJson: text("tags_json").default("[]"),
  // File
  fileName: text("file_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  createdById: text("created_by_id"),
});

// ═══════════════════════════════════════════════════════════════
// QA: Compliance Memo Generator (D008-03)
// ═══════════════════════════════════════════════════════════════

export const complianceMemos = sqliteTable("compliance_memos", {
  id: text("id").primaryKey(),
  memoNumber: text("memo_number").notNull().unique(), // MEMO-YYYY-NNNN
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  // Recipients
  toRecipients: text("to_recipients").notNull(), // JSON array of {name, role}
  ccRecipients: text("cc_recipients"), // JSON array
  fromName: text("from_name").notNull(),
  fromId: text("from_id").notNull(),
  fromTitle: text("from_title"),
  // Content
  body: text("body").notNull(),
  findingsJson: text("findings_json").default("[]"), // array of finding IDs
  recommendationsJson: text("recommendations_json").default("[]"), // array of recommendations
  referencesJson: text("references_json").default("[]"), // regulatory citations
  // Related entities
  relatedAuditId: text("related_audit_id"),
  relatedAuditNumber: text("related_audit_number"),
  relatedIncidentId: text("related_incident_id"),
  relatedIncidentNumber: text("related_incident_number"),
  relatedCapId: text("related_cap_id"),
  relatedCapNumber: text("related_cap_number"),
  // Memo metadata
  memoDate: text("memo_date").notNull(),
  priority: text("priority", { enum: ["routine", "urgent", "emergency"] }).notNull().default("routine"),
  classification: text("classification", { enum: ["internal", "restricted", "confidential"] }).notNull().default("internal"),
  // Status lifecycle
  status: text("status", { enum: ["draft", "pending_review", "approved", "issued", "acknowledged", "superseded"] }).notNull().default("draft"),
  reviewedBy: text("reviewed_by"),
  reviewedById: text("reviewed_by_id"),
  reviewedAt: text("reviewed_at"),
  approvedBy: text("approved_by"),
  approvedById: text("approved_by_id"),
  approvedAt: text("approved_at"),
  issuedAt: text("issued_at"),
  issuedBy: text("issued_by"),
  // Acknowledgments
  acknowledgmentsJson: text("acknowledgments_json").default("[]"), // [{recipientId, name, acknowledgedAt}]
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  createdById: text("created_by_id"),
});

// ═══════════════════════════════════════════════════════════════
// QA: Deficiency Tracking (D008-03)
// ═══════════════════════════════════════════════════════════════

export const deficiencyTracking = sqliteTable("deficiency_tracking", {
  id: text("id").primaryKey(),
  deficiencyNumber: text("deficiency_number").notNull().unique(), // DEF-YYYY-NNNN
  title: text("title").notNull(),
  description: text("description").notNull(),
  // Classification
  category: text("category", { enum: ["clinical_documentation", "safety", "staffing", "training", "facilities", "medication", "resident_rights", "infection_control", "administrative", "other"] }).notNull(),
  severity: text("severity", { enum: ["citation", "standard", "element", "risk_only", "other"] }).notNull().default("standard"),
  scope: text("scope", { enum: ["isolated", "widespread", "pattern"] }).notNull().default("isolated"),
  // Source
  sourceType: text("source_type", { enum: ["state_survey", "internal_audit", "complaint", "accreditation", "self_identified", "other"] }).notNull(),
  sourceReference: text("source_reference"), // survey ID, complaint ID, etc.
  surveyTag: text("survey_tag"), // e.g. "FTag-Tag number", "KTag-Tag number"
  // Regulatory reference
  regulationCitation: text("regulation_citation"), // e.g. "42 CFR 483.25"
  tagNumber: text("tag_number"), // CMS tag number
  // Location
  department: text("department"),
  facilityId: text("facility_id"),
  // Responsible party
  assignedTo: text("assigned_to"),
  assignedToId: text("assigned_to_id"),
  // Timeline
  identifiedDate: text("identified_date").notNull(),
  correctionDueDate: text("correction_due_date").notNull(),
  correctionCompletedDate: text("correction_completed_date"),
  verifiedDate: text("verified_date"),
  // Plan of Correction
  pocDescription: text("poc_description"), // Plan of Correction narrative
  pocSubmittedDate: text("poc_submitted_date"),
  pocApprovedDate: text("poc_approved_date"),
  // Status
  status: text("status", { enum: ["open", "poc_pending", "poc_approved", "in_progress", "corrected", "verified", "closed"] }).notNull().default("open"),
  // Verification
  verifiedBy: text("verified_by"),
  verifiedById: text("verified_by_id"),
  verificationMethod: text("verification_method", { enum: ["document_review", "interview", "observation", "record_review", "other"] }),
  verificationNotes: text("verification_notes"),
  // Related entities
  relatedAuditId: text("related_audit_id"),
  relatedAuditNumber: text("related_audit_number"),
  relatedCapId: text("related_cap_id"),
  relatedCapNumber: text("related_cap_number"),
  // Tags (JSON)
  tagsJson: text("tags_json").default("[]"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
  createdById: text("created_by_id"),
});

// ─── Boundary Violations ─────────────────────────────────────

export const boundaryViolations = sqliteTable("boundary_violations", {
  id: text("id").primaryKey(),
  violationType: text("violation_type", {
    enum: [
      "unmarked_clinical_output",
      "unrouted_compliance_finding",
      "unauthorized_phi_access",
      "unauthenticated_phi_access",
      "role_escalation_attempt",
      "qa_override_attempt",
      "missing_clinician_review",
      "unlogged_phi_access",
    ],
  }).notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical", "emergency"] }).notNull(),
  endpoint: text("endpoint").notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  description: text("description").notNull(),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════
// GRO RESIDENTIAL OPERATIONS (D008-02)
// Shift Log, Safety Round Checklist, Youth Care Log,
// Incident Report, Supervision Documentation, Shift Handoff
// ═══════════════════════════════════════════════════════════════

// ─── GRO: Shift Logs ─────────────────────────────────────────

export const shiftLogs = sqliteTable("shift_logs", {
  id: text("id").primaryKey(),
  shiftDate: text("shift_date").notNull(),
  shiftType: text("shift_type", { enum: ["day", "evening", "night", "overnight"] }).notNull(),
  staffName: text("staff_name").notNull(),
  staffId: text("staff_id"),
  supervisorName: text("supervisor_name"),
  // Milestone timestamps
  clockInAt: text("clock_in_at").notNull(),
  clockOutAt: text("clock_out_at"),
  // Shift entries (JSON array of {time, category, note})
  entriesJson: text("entries_json").default("[]"),
  // Categories covered
  safetyRoundsCompleted: integer("safety_rounds_completed").notNull().default(0),
  careLogsCompleted: integer("care_logs_completed").notNull().default(0),
  incidentsReported: integer("incidents_reported").notNull().default(0),
  medicationsAdministered: integer("medications_administered").notNull().default(0),
  // Status
  status: text("status", { enum: ["active", "completed", "no_show", "absent"] }).notNull().default("active"),
  notes: text("notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── GRO: Safety Round Checklists ────────────────────────────

export const safetyRounds = sqliteTable("safety_rounds", {
  id: text("id").primaryKey(),
  shiftId: text("shift_id"),
  shiftDate: text("shift_date").notNull(),
  shiftType: text("shift_type", { enum: ["day", "evening", "night", "overnight"] }).notNull(),
  // Area inspected
  area: text("area").notNull(),
  areaOrder: integer("area_order").notNull().default(0),
  // Checklist items
  item1NoHazards: integer("item1_no_hazards", { mode: "boolean" }).notNull().default(false),
  item2LightingWorking: integer("item2_lighting_working", { mode: "boolean" }).notNull().default(false),
  item3EmergencyExitsClear: integer("item3_emergency_exits_clear", { mode: "boolean" }).notNull().default(false),
  item4FireExtinguishersOk: integer("item4_fire_extinguishers_ok", { mode: "boolean" }).notNull().default(false),
  item5NoContraband: integer("item5_no_contraband", { mode: "boolean" }).notNull().default(false),
  item6CleanSanitary: integer("item6_clean_sanitary", { mode: "boolean" }).notNull().default(false),
  item7EquipmentSecure: integer("item7_equipment_secure", { mode: "boolean" }).notNull().default(false),
  item8YouthAreasSafe: integer("item8_youth_areas_safe", { mode: "boolean" }).notNull().default(false),
  // Overall result
  allItemsPassed: integer("all_items_passed", { mode: "boolean" }).notNull().default(false),
  itemsPassed: integer("items_passed").notNull().default(0),
  itemsTotal: integer("items_total").notNull().default(8),
  // Issues
  hazardsFound: text("hazards_found"),
  correctiveAction: text("corrective_action"),
  requiresFollowUp: integer("requires_follow_up", { mode: "boolean" }).notNull().default(false),
  followUpNotes: text("follow_up_notes"),
  // Staff
  completedBy: text("completed_by").notNull(),
  completedById: text("completed_by_id"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── GRO: Youth Care Logs ────────────────────────────────────

export const youthCareLogs = sqliteTable("youth_care_logs", {
  id: text("id").primaryKey(),
  youthId: text("youth_id").notNull(),
  youthName: text("youth_name").notNull(),
  mrn: text("mrn").notNull(),
  shiftId: text("shift_id"),
  logDate: text("log_date").notNull(),
  shiftType: text("shift_type", { enum: ["day", "evening", "night", "overnight"] }).notNull(),
  // Care type
  careType: text("care_type", { enum: ["daily_living", "behavioral", "medical", "educational", "recreational", "emotional_support", "crisis_intervention"] }).notNull(),
  // Details
  description: text("description").notNull(),
  observations: text("observations"),
  youthResponse: text("youth_response"),
  // Outcome
  outcome: text("outcome"),
  followUpNeeded: integer("follow_up_needed", { mode: "boolean" }).notNull().default(false),
  followUpActions: text("follow_up_actions"),
  // Goals addressed (JSON array)
  goalsAddressedJson: text("goals_addressed_json"),
  // Staff
  recordedBy: text("recorded_by").notNull(),
  recordedById: text("recorded_by_id"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── GRO: Incident Reports ───────────────────────────────────

export const incidentReports = sqliteTable("incident_reports", {
  id: text("id").primaryKey(),
  incidentNumber: text("incident_number").notNull().unique(),
  // Classification
  incidentType: text("incident_type", { enum: ["behavioral", "safety", "medication", "injury", "elopement", "self_harm", "aggression", "property_damage", "seclusion", "restraint", "other"] }).notNull(),
  severity: text("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  status: text("status", { enum: ["open", "under_review", "pending_supervisor", "resolved", "closed"] }).notNull().default("open"),
  // Youth involved
  youthId: text("youth_id"),
  youthName: text("youth_name"),
  mrn: text("mrn"),
  otherYouthInvolved: text("other_youth_involved"), // JSON array
  // When / where
  occurredAt: text("occurred_at").notNull(),
  occurredLocation: text("occurred_location").notNull(),
  // Description
  description: text("description").notNull(),
  immediateAction: text("immediate_action"),
  factors: text("factors"),
  // Injuries
  youthInjuries: text("youth_injuries"),
  staffInjuries: text("staff_injuries"),
  propertyDamage: text("property_damage"),
  // Medical
  medicalAttentionRequired: integer("medical_attention_required", { mode: "boolean" }).notNull().default(false),
  medicalAttentionProvided: text("medical_attention_provided"),
  // Notifications
  guardianNotified: integer("guardian_notified", { mode: "boolean" }).notNull().default(false),
  guardianNotifiedAt: text("guardian_notified_at"),
  guardianNotifiedBy: text("guardian_notified_by"),
  supervisorNotified: integer("supervisor_notified", { mode: "boolean" }).notNull().default(false),
  supervisorNotifiedAt: text("supervisor_notified_at"),
  supervisorNotifiedBy: text("supervisor_notified_by"),
  // Staff involved
  reportedBy: text("reported_by").notNull(),
  reportedById: text("reported_by_id"),
  witnesses: text("witnesses"), // JSON array
  staffInvolved: text("staff_involved"), // JSON array
  // Investigation
  investigatorAssigned: text("investigator_assigned"),
  investigationNotes: text("investigation_notes"),
  rootCause: text("root_cause"),
  correctiveActions: text("corrective_actions"),
  // Resolution
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── GRO: Supervision Documentation ──────────────────────────

export const supervisionNotes = sqliteTable("supervision_notes", {
  id: text("id").primaryKey(),
  // Supervision session
  supervisionDate: text("supervision_date").notNull(),
  supervisionType: text("supervision_type", { enum: ["individual", "group", "crisis_debrief", "incident_review", "training", "observation"] }).notNull(),
  // Staff involved
  supervisorName: text("supervisor_name").notNull(),
  supervisorId: text("supervisor_id"),
  superviseeName: text("supervisee_name").notNull(),
  superviseeId: text("supervisee_id"),
  // Content
  topicsDiscussed: text("topics_discussed").notNull(),
  staffConcerns: text("staff_concerns"),
  performanceObservations: text("performance_observations"),
  trainingNeeds: text("training_needs"),
  goalsSet: text("goals_set"),
  actionItems: text("action_items"), // JSON array
  // Follow-up
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpDate: text("follow_up_date"),
  followUpTopics: text("follow_up_topics"),
  // Review
  superviseeAcknowledged: integer("supervisee_acknowledged", { mode: "boolean" }).notNull().default(false),
  superviseeAcknowledgedAt: text("supervisee_acknowledged_at"),
  // Related incidents/care logs
  relatedIncidentId: text("related_incident_id"),
  relatedCareLogIds: text("related_care_log_ids"), // JSON array
  // System
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by"),
});
