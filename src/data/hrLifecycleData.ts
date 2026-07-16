// AMOS-OPS HR Lifecycle Data Model
// Two lanes: Workforce Activation (6 modules) + Workforce Management (5 modules)
// Per the HR Lifecycle Build Doctrine (Adolbi Care HR Standards)

// ─── Lane Definitions ─────────────────────────────────────────

export interface HRLane {
  id: string;
  name: string;
  description: string;
  modules: HRModuleDef[];
}

export interface HRModuleDef {
  id: string;
  laneId: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  statusModel: HRStatus[];
  requiredRecords: string[];
  gateRules: HRGateRule[];
}

export interface HRStatus {
  id: string;
  label: string;
  color: string; // hex color
  bgColor: string;
  category: "start" | "progress" | "pending" | "complete" | "terminal";
}

export interface HRGateRule {
  id: string;
  description: string;
  requiredStatusIds: string[];
  blocksAdvancementTo: string[];
}

// ─── Status Presets ───────────────────────────────────────────

export const STATUS_CATEGORIES = {
  start: { label: "Start", color: "#6B7280", bgColor: "#F3F4F6" },
  progress: { label: "In Progress", color: "#D97706", bgColor: "#FFFBEB" },
  pending: { label: "Pending", color: "#2563EB", bgColor: "#EFF6FF" },
  complete: { label: "Complete", color: "#059669", bgColor: "#D1FAE5" },
  terminal: { label: "Terminal", color: "#DC2626", bgColor: "#FEE2E2" },
} as const;

// ─── Module Definitions ───────────────────────────────────────

export const WORKFORCE_ACTIVATION: HRModuleDef[] = [
  {
    id: "recruitment",
    laneId: "activation",
    name: "Recruitment",
    description: "Role requisition, approval, posting, and applicant intake",
    icon: "Users",
    statusModel: [
      { id: "r-draft", label: "Draft Position", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "r-approved", label: "Approved for Recruitment", color: "#7C3AED", bgColor: "#F3E8FF", category: "progress" },
      { id: "r-posted", label: "Posted", color: "#2563EB", bgColor: "#EFF6FF", category: "progress" },
      { id: "r-received", label: "Application Received", color: "#2563EB", bgColor: "#EFF6FF", category: "progress" },
      { id: "r-review", label: "Under HR Review", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "r-screening", label: "Screening Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "r-screened", label: "Screened", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "r-interview", label: "Interview Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "r-selected", label: "Selected for Offer", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "r-not-selected", label: "Not Selected", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "r-closed", label: "Closed", color: "#6B7280", bgColor: "#F3F4F6", category: "terminal" },
    ],
    requiredRecords: [
      "Role Requisition Form",
      "Position Description",
      "Approval Documentation",
      "Job Posting Record",
      "Applicant File",
      "Minimum Qualification Review",
    ],
    gateRules: [
      { id: "r-g1", description: "Candidate cannot advance without applicant record + minimum qualification review", requiredStatusIds: ["r-received"], blocksAdvancementTo: ["r-review"] },
    ],
  },
  {
    id: "screening",
    laneId: "activation",
    name: "Screening & Selection",
    description: "Qualification review, interviews, reference verification",
    icon: "Search",
    statusModel: [
      { id: "s-not-started", label: "Screening Not Started", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "s-phone", label: "Phone Screen Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "s-interview-sched", label: "Interview Scheduled", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "s-interview-done", label: "Interview Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "s-ref-pending", label: "Reference Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "s-ref-done", label: "Reference Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "s-recommended", label: "Recommended", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "s-not-recommended", label: "Not Recommended", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "s-selected", label: "Selected", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
    ],
    requiredRecords: [
      "Phone Screen Worksheet",
      "Interview Schedule Record",
      "Interview Scorecard",
      "Reference Verification",
      "Employment History Check",
      "Selection Recommendation",
    ],
    gateRules: [
      { id: "s-g1", description: "No conditional offer without recorded selection decision", requiredStatusIds: ["s-recommended", "s-selected"], blocksAdvancementTo: ["offers"] },
    ],
  },
  {
    id: "offers",
    laneId: "activation",
    name: "Offers & Pre-Employment",
    description: "Offer generation, acceptance, packet collection, file build",
    icon: "FileText",
    statusModel: [
      { id: "o-drafted", label: "Offer Drafted", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "o-sent", label: "Offer Sent", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "o-accepted", label: "Offer Accepted", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "o-declined", label: "Offer Declined", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "o-packet-sent", label: "Packet Sent", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "o-packet-inc", label: "Packet Incomplete", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "o-packet-done", label: "Packet Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "o-file-build", label: "File Build In Progress", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "o-file-ready", label: "File Ready for Review", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
    ],
    requiredRecords: [
      "Conditional Offer Letter",
      "Offer Acceptance",
      "Pre-Employment Packet",
      "Employment Application",
      "Background Check Authorization",
      "Confidentiality Acknowledgment",
      "Payroll Forms (W-4, Direct Deposit)",
      "I-9 Form",
      "Personnel File Shell",
      "Missing Items Tracker",
    ],
    gateRules: [
      { id: "o-g1", description: "No orientation without minimum file readiness", requiredStatusIds: ["o-packet-done"], blocksAdvancementTo: ["orientation"] },
    ],
  },
  {
    id: "orientation",
    laneId: "activation",
    name: "Orientation",
    description: "New employee orientation, policy acknowledgment, supervisor sign-off",
    icon: "Compass",
    statusModel: [
      { id: "or-not-assigned", label: "Not Assigned", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "or-assigned", label: "Assigned", color: "#2563EB", bgColor: "#EFF6FF", category: "progress" },
      { id: "or-in-progress", label: "In Progress", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "or-completed", label: "Completed", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "or-review", label: "Supervisor Review Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "or-signed", label: "Signed Off", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
    ],
    requiredRecords: [
      "Orientation Assignment",
      "Attendance Record",
      "Policy Acknowledgments",
      "Supervisor Sign-Off",
      "Completion Record",
      "Unsupervised Work Authorization",
    ],
    gateRules: [
      { id: "or-g1", description: "No unsupervised duties until orientation evidenced", requiredStatusIds: ["or-completed"], blocksAdvancementTo: ["onboarding"] },
    ],
  },
  {
    id: "onboarding",
    laneId: "activation",
    name: "Onboarding & Training",
    description: "Role-based training, competency verification, clearance readiness",
    icon: "GraduationCap",
    statusModel: [
      { id: "ob-not-started", label: "Training Not Started", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "ob-assigned", label: "Assigned", color: "#2563EB", bgColor: "#EFF6FF", category: "progress" },
      { id: "ob-in-progress", label: "In Progress", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "ob-cert-pending", label: "Certificate Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "ob-training-done", label: "Training Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "ob-comp-pending", label: "Competency Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "ob-comp-done", label: "Competency Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "ob-ready", label: "Ready for Clearance Review", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
    ],
    requiredRecords: [
      "Training Matrix Assignment",
      "Training Completion Record",
      "Certificate Upload",
      "Competency Checklist",
      "90-Day Progress Tracker",
      "Supervisor Training Sign-Off",
      "Role Track Completion",
      "Quiz Results (80%+ required)",
    ],
    gateRules: [
      { id: "ob-g1", description: "No clearance review while training/certification incomplete", requiredStatusIds: ["ob-comp-done"], blocksAdvancementTo: ["clearance"] },
    ],
  },
  {
    id: "clearance",
    laneId: "activation",
    name: "Clearance & Activation",
    description: "Final eligibility verification and release-to-duty authorization",
    icon: "ShieldCheck",
    statusModel: [
      { id: "c-not-ready", label: "Not Ready", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "c-pending-file", label: "Pending File Documents", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-pending-bg", label: "Pending Background", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-pending-refs", label: "Pending References", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-pending-training", label: "Pending Training", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-pending-creds", label: "Pending Credential Verification", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-hr-review", label: "Pending HR Review", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-super-review", label: "Pending Supervisor Review", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-cleared", label: "Cleared for Duty", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "c-restricted", label: "Restricted Clearance", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "c-not-cleared", label: "Not Cleared", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
    ],
    requiredRecords: [
      "File Completeness Verification",
      "Background Confirmation",
      "Reference Confirmation",
      "Training Verification",
      "Credential Verification",
      "Restriction Recording",
      "Clearance Decision Record",
    ],
    gateRules: [
      { id: "c-g1", description: "No release-to-duty without all verifications complete", requiredStatusIds: ["c-cleared"], blocksAdvancementTo: [] },
    ],
  },
];

export const WORKFORCE_MANAGEMENT: HRModuleDef[] = [
  {
    id: "personnel-files",
    laneId: "management",
    name: "Personnel Files",
    description: "Official employee record with 7 file sections",
    icon: "FolderOpen",
    statusModel: [
      { id: "pf-complete", label: "File Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "pf-incomplete", label: "File Incomplete", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "pf-missing", label: "Missing Required Document", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "pf-pending", label: "Pending HR Review", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "pf-audit-ready", label: "Audit Ready", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "pf-deficient", label: "Audit Deficient", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "pf-archived", label: "Archived", color: "#6B7280", bgColor: "#F3F4F6", category: "terminal" },
    ],
    requiredRecords: [
      "Section 00: Control Index",
      "Section A: Employment & Hiring",
      "Section B: Credentials & Licenses",
      "Section C: Background & References",
      "Section D: Orientation & Policy",
      "Section E: Training & Competency",
      "Section F: Performance & Separation",
      "File Completeness Checklist",
      "Audit Packet",
    ],
    gateRules: [
      { id: "pf-g1", description: "File must show active/restricted/separated/archived/pending status", requiredStatusIds: [], blocksAdvancementTo: [] },
    ],
  },
  {
    id: "credentials",
    laneId: "management",
    name: "Credential & Training Compliance",
    description: "Credential expiration tracking and compliance monitoring",
    icon: "Award",
    statusModel: [
      { id: "cr-current", label: "Current", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "cr-expiring", label: "Expiring Soon", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "cr-expired", label: "Expired", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "cr-renewal", label: "Renewal Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "cr-verification", label: "Verification Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "cr-restricted", label: "Restricted", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
    ],
    requiredRecords: [
      "Credential/Certification Record",
      "License Verification",
      "Training Renewal Deadline",
      "Expiration Alert Log",
      "Compliance Restriction Record",
      "Renewal Documentation",
    ],
    gateRules: [
      { id: "cr-g1", description: "Expired credentials auto-create restriction signal", requiredStatusIds: ["cr-expired"], blocksAdvancementTo: [] },
    ],
  },
  {
    id: "performance",
    laneId: "management",
    name: "Performance & Corrective Action",
    description: "Performance documentation, coaching, and corrective action tracking",
    icon: "TrendingUp",
    statusModel: [
      { id: "pa-open", label: "Open", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "pa-notified", label: "Employee Notified", color: "#2563EB", bgColor: "#EFF6FF", category: "progress" },
      { id: "pa-ack", label: "Acknowledged", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "pa-followup", label: "Follow-Up Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "pa-resolved", label: "Resolved", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "pa-escalated", label: "Escalated", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "pa-closed", label: "Closed", color: "#6B7280", bgColor: "#F3F4F6", category: "terminal" },
    ],
    requiredRecords: [
      "Performance Issue Documentation",
      "Coaching Notes",
      "Corrective Action Plan",
      "Employee Notification",
      "Acknowledgment Record",
      "Supervisor Follow-Up",
    ],
    gateRules: [],
  },
  {
    id: "compliance",
    laneId: "management",
    name: "Compliance & Audits",
    description: "Personnel file audits, deficiency tracking, and correction management",
    icon: "ClipboardCheck",
    statusModel: [
      { id: "ca-not-started", label: "Audit Not Started", color: "#6B7280", bgColor: "#F3F4F6", category: "start" },
      { id: "ca-in-review", label: "In Review", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "ca-deficiency", label: "Deficiency Found", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "ca-correction", label: "Correction Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "ca-done", label: "Correction Complete", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "ca-closed", label: "Audit Closed", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
    ],
    requiredRecords: [
      "Audit Schedule",
      "Audit Worksheet",
      "Deficiency Report",
      "Correction Assignment",
      "Evidence Packet",
      "Closure Record",
    ],
    gateRules: [
      { id: "ca-g1", description: "Every deficiency must have owner, due date, correction evidence, and closure decision", requiredStatusIds: [], blocksAdvancementTo: [] },
    ],
  },
  {
    id: "separation",
    laneId: "management",
    name: "Separation & Offboarding",
    description: "Employee separation, offboarding, file closure, and archive",
    icon: "LogOut",
    statusModel: [
      { id: "sep-initiated", label: "Separation Initiated", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "sep-notice", label: "Notice Received", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "sep-offboarding", label: "Offboarding In Progress", color: "#D97706", bgColor: "#FFFBEB", category: "progress" },
      { id: "sep-access", label: "Access Removal Pending", color: "#DC2626", bgColor: "#FEE2E2", category: "terminal" },
      { id: "sep-final", label: "Final Documentation Pending", color: "#D97706", bgColor: "#FFFBEB", category: "pending" },
      { id: "sep-closed", label: "Closed", color: "#059669", bgColor: "#D1FAE5", category: "complete" },
      { id: "sep-archived", label: "Archived", color: "#6B7280", bgColor: "#F3F4F6", category: "terminal" },
    ],
    requiredRecords: [
      "Separation Reason Record",
      "Offboarding Checklist",
      "System Access Removal Log",
      "Property Return Documentation",
      "Personnel File Closure",
      "Rehire Eligibility Flag",
      "Archive Record",
      "Final Pay Documentation",
    ],
    gateRules: [
      { id: "sep-g1", description: "Separated employee must not remain in active eligibility lists", requiredStatusIds: [], blocksAdvancementTo: [] },
    ],
  },
];

// ─── Combined Lanes ───────────────────────────────────────────

export const HR_LANES: HRLane[] = [
  {
    id: "activation",
    name: "Workforce Activation",
    description: "From candidate to cleared-for-duty",
    modules: WORKFORCE_ACTIVATION,
  },
  {
    id: "management",
    name: "Workforce Management",
    description: "From activation through separation",
    modules: WORKFORCE_MANAGEMENT,
  },
];

export const ALL_HR_MODULES = [...WORKFORCE_ACTIVATION, ...WORKFORCE_MANAGEMENT];

// ─── Helper: Get Module by ID ─────────────────────────────────

export function getHRModule(id: string): HRModuleDef | undefined {
  return ALL_HR_MODULES.find((m) => m.id === id);
}

export function getModuleStatusOptions(moduleId: string): HRStatus[] {
  return getHRModule(moduleId)?.statusModel || [];
}

// ─── Command Center Card Definitions ──────────────────────────

export interface CommandCard {
  id: string;
  title: string;
  moduleId: string;
  icon: string;
  metric: string;
  alertThreshold?: number;
  alertColor?: string;
}

export const COMMAND_CARDS: CommandCard[] = [
  { id: "cmd-recruit", title: "Recruitment Pipeline", moduleId: "recruitment", icon: "Users", metric: "active_requisitions", alertThreshold: 5, alertColor: "#D97706" },
  { id: "cmd-preemp", title: "Pre-Employment Completion", moduleId: "offers", icon: "FileCheck", metric: "pending_packets", alertThreshold: 3, alertColor: "#DC2626" },
  { id: "cmd-orient", title: "Orientation Completion", moduleId: "orientation", icon: "Compass", metric: "pending_signoffs", alertThreshold: 2, alertColor: "#D97706" },
  { id: "cmd-training", title: "Training Compliance", moduleId: "onboarding", icon: "GraduationCap", metric: "incomplete_training", alertThreshold: 5, alertColor: "#DC2626" },
  { id: "cmd-clearance", title: "Clearance Readiness", moduleId: "clearance", icon: "ShieldCheck", metric: "pending_reviews", alertThreshold: 2, alertColor: "#DC2626" },
  { id: "cmd-files", title: "Personnel File Health", moduleId: "personnel-files", icon: "FolderOpen", metric: "incomplete_files", alertThreshold: 3, alertColor: "#D97706" },
  { id: "cmd-expiration", title: "Expiration Risk", moduleId: "credentials", icon: "Clock", metric: "expiring_soon", alertThreshold: 5, alertColor: "#DC2626" },
  { id: "cmd-corrective", title: "Corrective Action Tracker", moduleId: "performance", icon: "AlertTriangle", metric: "open_actions", alertThreshold: 2, alertColor: "#D97706" },
];

// ─── Alert Rule Definitions ───────────────────────────────────

export interface AlertRule {
  id: string;
  severity: "red" | "amber";
  title: string;
  description: string;
  moduleId: string;
  condition: string;
}

export const ALERT_RULES: AlertRule[] = [
  { id: "al-1", severity: "red", title: "Active Without Clearance", description: "Employee assigned to work without completed clearance review", moduleId: "clearance", condition: "status != cleared AND has_work_assignment" },
  { id: "al-2", severity: "red", title: "Expired Credential", description: "Active employee with expired credential or license", moduleId: "credentials", condition: "status == expired" },
  { id: "al-3", severity: "amber", title: "Overdue Orientation", description: "Orientation completion past due date without sign-off", moduleId: "orientation", condition: "status == in-progress AND past_due" },
  { id: "al-4", severity: "amber", title: "Missing File Documents", description: "Personnel file missing required section documents", moduleId: "personnel-files", condition: "status == incomplete" },
  { id: "al-5", severity: "red", title: "Untransmitted Restriction", description: "Restriction decision recorded but not yet sent to operations", moduleId: "clearance", condition: "status == restricted AND not_transmitted" },
];

// ─── Sample People Data ───────────────────────────────────────

export interface HRPerson {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  department: string;
  lane: "activation" | "management";
  moduleStatuses: Record<string, string>;
  hireDate: string;
  supervisor: string;
  isActive: boolean;
  isEmployee: boolean;
}

export const SAMPLE_PEOPLE: HRPerson[] = [
  { id: "p-001", firstName: "Sarah", lastName: "Martinez", employeeId: "EMP-1001", role: "Clinical Staff", department: "Behavioral Health", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" }, hireDate: "2025-01-15", supervisor: "Dr. Synthetic Staff 09", isActive: true },
  { id: "p-002", firstName: "David", lastName: "Chen", employeeId: "EMP-1002", role: "GRO Residential Staff", department: "Residential", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" }, hireDate: "2025-02-01", supervisor: "Maria Rodriguez", isActive: true },
  { id: "p-003", firstName: "Aisha", lastName: "Johnson", employeeId: "EMP-1003", role: "QA Specialist", department: "Quality Assurance", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-in-progress", clearance: "c-not-ready", "personnel-files": "pf-incomplete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-not-started" }, hireDate: "2025-03-10", supervisor: "Robert Park", isActive: true },
  { id: "p-004", firstName: "Michael", lastName: "Torres", employeeId: "EMP-1004", role: "Revenue Cycle Specialist", department: "Billing", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-build", orientation: "or-not-assigned" }, hireDate: "2025-04-01", supervisor: "Lisa Chang", isActive: true },
  { id: "p-005", firstName: "Synthetic", lastName: "Person-037", employeeId: "EMP-1005", role: "Supervisor", department: "Clinical", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-restricted", "personnel-files": "pf-complete", credentials: "cr-expiring", performance: "pa-open", compliance: "ca-in-review" }, hireDate: "2025-01-20", supervisor: "Dr. Synthetic Staff 09", isActive: true },
  { id: "p-006", firstName: "James", lastName: "Park", employeeId: "EMP-1006", role: "Management", department: "Executive", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" }, hireDate: "2025-01-10", supervisor: "Executive Board", isActive: true },
  { id: "p-007", firstName: "Maria", lastName: "Rodriguez", employeeId: "EMP-1007", role: "HR Coordinator", department: "Human Resources", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" }, hireDate: "2024-12-01", supervisor: "James Park", isActive: true },
  { id: "p-008", firstName: "Lisa", lastName: "Chang", employeeId: "EMP-1008", role: "GAD Operations", department: "Administration", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" }, hireDate: "2025-02-15", supervisor: "James Park", isActive: true },
  { id: "p-009", firstName: "Robert", lastName: "Kim", employeeId: "", role: "Clinical Staff", department: "Behavioral Health", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-posted" }, hireDate: "", supervisor: "", isActive: false },
  { id: "p-010", firstName: "Jennifer", lastName: "Adams", employeeId: "", role: "GRO Residential Staff", department: "Residential", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-closed", screening: "s-interview-sched" }, hireDate: "", supervisor: "", isActive: false },
  { id: "p-011", firstName: "Daniel", lastName: "Williams", employeeId: "", role: "Clinical Staff", department: "Behavioral Health", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-received" }, hireDate: "", supervisor: "", isActive: false },
  { id: "p-012", firstName: "Michelle", lastName: "Brown", employeeId: "", role: "QA Specialist", department: "Quality Assurance", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-closed", screening: "s-ref-pending" }, hireDate: "", supervisor: "", isActive: false },
  { id: "p-013", firstName: "Christopher", lastName: "Lee", employeeId: "EMP-1013", role: "Supervisor", department: "Residential", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-accepted", orientation: "or-in-progress" }, hireDate: "", supervisor: "James Park", isActive: true },
  { id: "p-014", firstName: "Amanda", lastName: "Garcia", employeeId: "EMP-1014", role: "GRO Residential Staff", department: "Residential", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-cert-pending", clearance: "c-pending-training", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-not-started" }, hireDate: "2025-05-01", supervisor: "Maria Rodriguez", isActive: true },
  { id: "p-015", firstName: "Kevin", lastName: "Thompson", employeeId: "EMP-1015", role: "Clinical Staff", department: "Behavioral Health", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-renewal", performance: "pa-closed", compliance: "ca-in-review" }, hireDate: "2024-11-15", supervisor: "Dr. Synthetic Staff 09", isActive: true },
  { id: "p-016", firstName: "Rachel", lastName: "White", employeeId: "", role: "Revenue Cycle Specialist", department: "Billing", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-packet-inc" }, hireDate: "", supervisor: "Lisa Chang", isActive: true },
  { id: "p-017", firstName: "Brian", lastName: "Harris", employeeId: "EMP-1017", role: "GAD Operations", department: "Administration", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-notified", compliance: "ca-not-started" }, hireDate: "2025-02-20", supervisor: "James Park", isActive: true },
  { id: "p-018", firstName: "Nicole", lastName: "Clark", employeeId: "EMP-1018", role: "Clinical Staff", department: "Behavioral Health", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-expired", performance: "pa-closed", compliance: "ca-deficiency" }, hireDate: "2024-10-01", supervisor: "Dr. Synthetic Staff 09", isActive: true },
  { id: "p-019", firstName: "Jason", lastName: "Lewis", employeeId: "", role: "Supervisor", department: "Clinical", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-approved" }, hireDate: "", supervisor: "", isActive: false },
  { id: "p-020", firstName: "Stephanie", lastName: "Walker", employeeId: "EMP-1020", role: "HR Coordinator", department: "Human Resources", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-initiated" }, hireDate: "2023-06-01", supervisor: "James Park", isActive: true },
  { id: "p-021", firstName: "Mark", lastName: "Hall", employeeId: "EMP-1021", role: "GRO Residential Staff", department: "Residential", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-audit-ready", credentials: "cr-current", performance: "pa-closed", compliance: "ca-in-review" }, hireDate: "2025-03-15", supervisor: "Maria Rodriguez", isActive: true },
  { id: "p-022", firstName: "Laura", lastName: "Young", employeeId: "", role: "QA Specialist", department: "Quality Assurance", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-screening" }, hireDate: "", supervisor: "", isActive: false },
  { id: "p-023", firstName: "Eric", lastName: "King", employeeId: "EMP-1023", role: "Management", department: "Executive", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-escalated", compliance: "ca-closed" }, hireDate: "2024-08-01", supervisor: "Executive Board", isActive: true },
  { id: "p-024", firstName: "Sandra", lastName: "Scott", employeeId: "EMP-1024", role: "Clinical Staff", department: "Behavioral Health", lane: "management", isEmployee: true, moduleStatuses: { recruitment: "r-closed", screening: "s-selected", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-followup", compliance: "ca-not-started" }, hireDate: "2025-04-10", supervisor: "Dr. Synthetic Staff 09", isActive: true },
  { id: "p-025", firstName: "Thomas", lastName: "Green", employeeId: "", role: "GAD Operations", department: "Administration", lane: "activation", isEmployee: false, moduleStatuses: { recruitment: "r-closed", screening: "s-not-recommended" }, hireDate: "", supervisor: "", isActive: false },
];
