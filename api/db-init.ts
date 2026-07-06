import { sqlite } from "./queries/connection";

// ─── Auto-create all tables on startup ─────────────────────

export function initDatabase() {
  console.log("[DB] Initializing database...");

  // Users & Auth
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'gro-staff',
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // HR
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS hr_people (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      employee_id TEXT,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      lane TEXT NOT NULL DEFAULT 'activation',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_employee INTEGER NOT NULL DEFAULT 0,
      hire_date TEXT,
      supervisor TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS module_statuses (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      status_id TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS status_transitions (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      person_name TEXT NOT NULL,
      module_id TEXT NOT NULL,
      module_name TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TEXT,
      note TEXT
    )
  `);

  // Clinical
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      mrn TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT,
      gender TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      assigned_clinician_id TEXT,
      insurance_plan_id TEXT,
      admission_date TEXT,
      discharge_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS treatment_plans (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      plan_number TEXT NOT NULL,
      primary_diagnosis TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      assigned_clinician_id TEXT,
      start_date TEXT,
      end_date TEXT,
      goals_json TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      treatment_plan_id TEXT,
      clinician_id TEXT,
      session_type TEXT,
      session_date TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      billing_code TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS outcome_measures (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      measure_type TEXT NOT NULL,
      score INTEGER,
      severity TEXT,
      administered_at TEXT,
      clinician_id TEXT,
      notes TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS insurance_plans (
      id TEXT PRIMARY KEY,
      plan_name TEXT NOT NULL,
      payer_name TEXT,
      payer_type TEXT,
      plan_type TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  // Revenue
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payers (
      id TEXT PRIMARY KEY,
      payer_name TEXT NOT NULL,
      payer_type TEXT,
      contact_info TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_number TEXT NOT NULL UNIQUE,
      patient_id TEXT,
      payer_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount INTEGER,
      submitted_at TEXT,
      paid_at TEXT,
      denial_reason TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS claim_line_items (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      service_code TEXT NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price INTEGER,
      total_price INTEGER,
      created_at TEXT
    )
  `);

  // QA
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audits_qa (
      id TEXT PRIMARY KEY,
      audit_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      assigned_auditor_id TEXT,
      department TEXT,
      findings_json TEXT DEFAULT '[]',
      score INTEGER,
      started_at TEXT,
      completed_at TEXT,
      due_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      incident_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      patient_id TEXT,
      reported_by TEXT NOT NULL,
      assigned_to TEXT,
      occurred_at TEXT NOT NULL,
      resolved_at TEXT,
      resolution_notes TEXT,
      follow_up_required INTEGER NOT NULL DEFAULT 0,
      follow_up_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS corrective_actions (
      id TEXT PRIMARY KEY,
      action_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      related_audit_id TEXT,
      related_incident_id TEXT,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT NOT NULL,
      due_date TEXT NOT NULL,
      completed_at TEXT,
      completion_notes TEXT,
      verified_by TEXT,
      verified_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // GAD
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      wo_number TEXT,
      title TEXT,
      description TEXT,
      priority TEXT,
      status TEXT DEFAULT 'open',
      category TEXT,
      assigned_to TEXT,
      due_date TEXT,
      facility TEXT,
      completion_notes TEXT,
      completed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT,
      vendor_type TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      services TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      type TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      licensed_capacity INTEGER DEFAULT 0,
      operational_capacity INTEGER DEFAULT 0,
      current_occupancy INTEGER DEFAULT 0,
      total_rooms INTEGER DEFAULT 0,
      total_beds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      activation_date TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL,
      room_number TEXT NOT NULL,
      floor TEXT DEFAULT 'ground',
      room_type TEXT DEFAULT 'standard',
      max_beds INTEGER DEFAULT 2,
      current_occupancy INTEGER DEFAULT 0,
      bed_layout TEXT DEFAULT 'double',
      has_private_bath INTEGER DEFAULT 0,
      has_window INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS procurement_requests (
      id TEXT PRIMARY KEY,
      request_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity INTEGER DEFAULT 1,
      estimated_unit_cost INTEGER,
      estimated_total_cost INTEGER,
      vendor_id TEXT,
      vendor_name TEXT,
      facility_id TEXT,
      facility_name TEXT,
      requested_by TEXT NOT NULL,
      requested_by_id TEXT,
      approved_by TEXT,
      approved_at TEXT,
      status TEXT DEFAULT 'draft',
      priority TEXT DEFAULT 'medium',
      justification TEXT,
      rejection_reason TEXT,
      po_number TEXT,
      received_at TEXT,
      received_by TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS safety_inspections (
      id TEXT PRIMARY KEY,
      inspection_number TEXT NOT NULL UNIQUE,
      facility_id TEXT NOT NULL,
      facility_name TEXT NOT NULL,
      inspection_type TEXT NOT NULL,
      inspected_by TEXT NOT NULL,
      inspected_by_id TEXT,
      inspection_date TEXT NOT NULL,
      next_due_date TEXT,
      frequency_days INTEGER DEFAULT 90,
      status TEXT DEFAULT 'pending',
      score INTEGER,
      checklist_json TEXT DEFAULT '[]',
      findings TEXT,
      corrective_actions TEXT,
      corrective_actions_completed INTEGER DEFAULT 0,
      corrective_actions_completed_at TEXT,
      photos_json TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vendor_contracts (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      contract_number TEXT NOT NULL UNIQUE,
      contract_type TEXT DEFAULT 'service_agreement',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      value INTEGER,
      payment_terms TEXT,
      auto_renew INTEGER DEFAULT 0,
      renewal_terms TEXT,
      termination_notice_days INTEGER DEFAULT 30,
      status TEXT DEFAULT 'active',
      scope_of_work TEXT,
      documents_json TEXT,
      primary_contact_name TEXT,
      primary_contact_email TEXT,
      primary_contact_phone TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // GRO
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referral_number TEXT,
      patient_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      referral_source TEXT,
      source_detail TEXT,
      referral_type TEXT,
      status TEXT DEFAULT 'new',
      assigned_to TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS partnerships (
      id TEXT PRIMARY KEY,
      organization_name TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      partnership_type TEXT,
      status TEXT DEFAULT 'active',
      start_date TEXT,
      notes TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS outreach_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      target_audience TEXT,
      leads_generated INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT
    )
  `);

  // Agent Personas
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_personas (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      scope TEXT,
      boundaries_json TEXT,
      status TEXT DEFAULT 'deferred',
      wave TEXT DEFAULT 'wave3',
      category TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      permissions TEXT,
      outputs TEXT,
      activated_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS persona_interactions (
      id TEXT PRIMARY KEY,
      persona_id TEXT,
      query_text TEXT,
      response_text TEXT,
      context_data TEXT,
      status TEXT DEFAULT 'completed',
      started_at TEXT,
      completed_at TEXT
    )
  `);

  // NIL Knowledge Graph
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nil_entities (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      source_id TEXT,
      source_table TEXT,
      display_name TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      module TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nil_relationships (
      id TEXT PRIMARY KEY,
      from_entity_id TEXT NOT NULL,
      to_entity_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      strength INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  // MS Graph
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ms_graph_users (
      id TEXT PRIMARY KEY,
      entra_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      given_name TEXT,
      surname TEXT,
      user_principal_name TEXT NOT NULL,
      mail TEXT,
      job_title TEXT,
      department TEXT,
      office_location TEXT,
      account_enabled INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      last_sync_at TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ms_graph_groups (
      id TEXT PRIMARY KEY,
      entra_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      group_type TEXT,
      security_enabled INTEGER,
      mail_enabled INTEGER,
      member_count INTEGER DEFAULT 0,
      last_sync_at TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ms_graph_sync_log (
      id TEXT PRIMARY KEY,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      users_synced INTEGER DEFAULT 0,
      groups_synced INTEGER DEFAULT 0,
      errors_json TEXT,
      started_at TEXT,
      completed_at TEXT
    )
  `);

  // Workflow
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      trigger_data TEXT,
      started_at TEXT,
      completed_at TEXT,
      triggered_by TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_approvals (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      approver_role TEXT NOT NULL,
      approver_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      requested_at TEXT,
      responded_at TEXT
    )
  `);

  // Audit log (shared for workflow + security)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_audit_log (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      created_at TEXT
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // D005: Workflow Engine Tables (v2)
  // ═══════════════════════════════════════════════════════════════

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_definitions_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status_map TEXT,
      evidence_gates TEXT,
      escalation_rules TEXT,
      entity_type TEXT NOT NULL DEFAULT 'general',
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_instances_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      current_status TEXT NOT NULL,
      previous_status TEXT,
      assigned_to TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      due_date TEXT,
      escalation_level INTEGER DEFAULT 0,
      escalation_reason TEXT,
      notes TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_transitions_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT,
      reason TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_evidence_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL,
      gate_name TEXT NOT NULL,
      file_name TEXT,
      file_path TEXT,
      submitted_by TEXT,
      submitted_at TEXT,
      validated INTEGER DEFAULT 0
    )
  `);

  // Notifications
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      person_name TEXT,
      module_name TEXT,
      action_href TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT
    )
  `);

  // Forms
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS form_templates (
      id TEXT PRIMARY KEY,
      template_name TEXT NOT NULL,
      category TEXT,
      binder_area TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS form_template_fields (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      label TEXT NOT NULL,
      required INTEGER DEFAULT 0,
      options_json TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // ─── M1: Onboarding Progress ─────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_progress (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      module_name TEXT,
      status TEXT NOT NULL DEFAULT 'not-started',
      score INTEGER,
      completed_at TEXT,
      assigned_by TEXT,
      assigned_at TEXT,
      due_date TEXT,
      evidence_required INTEGER DEFAULT 0,
      evidence_uploaded INTEGER DEFAULT 0,
      UNIQUE(person_id, module_id)
    )
  `);

  // ─── M1: Credential Expiries ─────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS credential_expiries (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      credential_type TEXT NOT NULL,
      credential_name TEXT NOT NULL,
      issued_date TEXT,
      expiry_date TEXT NOT NULL,
      alert_threshold_days INTEGER DEFAULT 30,
      alert_status TEXT NOT NULL DEFAULT 'current',
      document_id TEXT,
      verified_by TEXT,
      verified_at TEXT,
      notes TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Document Templates ──────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id TEXT PRIMARY KEY,
      template_name TEXT NOT NULL,
      template_code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT,
      required_fields_json TEXT DEFAULT '[]',
      default_metadata_json TEXT DEFAULT '{}',
      version TEXT DEFAULT '1.0',
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Evidence Packets ────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS evidence_packets (
      id TEXT PRIMARY KEY,
      packet_name TEXT NOT NULL,
      packet_type TEXT NOT NULL,
      person_id TEXT,
      case_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      document_ids_json TEXT DEFAULT '[]',
      assembled_by TEXT,
      assembled_at TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Work Queue ──────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS work_queue (
      id TEXT PRIMARY KEY,
      task_title TEXT NOT NULL,
      task_type TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT,
      assigned_by TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      entity_type TEXT,
      entity_id TEXT,
      workflow_id TEXT,
      evidence_required INTEGER DEFAULT 0,
      evidence_uploaded INTEGER DEFAULT 0,
      due_date TEXT,
      completed_at TEXT,
      completed_by TEXT,
      escalation_level INTEGER DEFAULT 0,
      escalated_at TEXT,
      escalation_reason TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Workflow Definitions ────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_definitions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL UNIQUE,
      workflow_name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  // ─── M1: Evidence Gates (per workflow) ───────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS evidence_gates (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT,
      UNIQUE(workflow_id, gate_name)
    )
  `);

  // ─── M1: Task Evidence (uploaded files) ──────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_evidence (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      uploaded_by TEXT,
      uploaded_at TEXT
    )
  `);

  // ─── M1: Escalation Log ──────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS escalation_log (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      previous_level INTEGER DEFAULT 0,
      new_level INTEGER NOT NULL,
      reason TEXT,
      escalated_by TEXT,
      notification_sent INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);

  // ─── M1: Reassignment Log ────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reassignment_log (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      old_assignee TEXT,
      new_assignee TEXT NOT NULL,
      reason TEXT NOT NULL,
      reassigned_by TEXT,
      created_at TEXT
    )
  `);

  // Seed default admin if no users exist
  const userCount = sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as any;
  if ((userCount?.c ?? 0) === 0) {
    console.log("[DB] No users found. First registration will auto-create super-admin.");
  }

  // Seed 13 AMOS personas if none exist
  const personaCount = sqlite.prepare("SELECT COUNT(*) as c FROM agent_personas").get() as any;
  if ((personaCount?.c ?? 0) === 0) {
    const now = new Date().toISOString();
    const seedPersonas = [
      // ═══ 6 Pilot Personas (Active in UI) ═══
      ["amos-core", "amos-core", "AMOS-Core", "AC", "Universal operational backbone. Dashboard aggregation, notification routing, cross-module search, and daily operational support.", "system-operations", JSON.stringify(["dashboards", "notifications", "search", "system-config"]), "pilot", "pilot", "Core", "#3B82F6", "Cpu", JSON.stringify(["all_read", "ops_write"]), JSON.stringify(["dashboards", "alerts", "search_results"]), "2026-01-01T00:00:00Z", 1, now, now],
      ["amos-clinical", "amos-clinical", "AMOS-Clinical", "ACL", "Clinical operations specialist. BHC care delivery, CANS/ANSA assessment support, treatment planning, clinical documentation guidance.", "bhc-clinical", JSON.stringify(["assessments", "treatment-plans", "clinical-notes", "cans-ansi"]), "pilot", "pilot", "Clinical", "#10B981", "Stethoscope", JSON.stringify(["clinical_read", "clinical_write", "phi_access"]), JSON.stringify(["assessments", "treatment_plans", "clinical_notes"]), "2026-01-01T00:00:00Z", 2, now, now],
      ["amos-gro", "amos-gro", "AMOS-GRO", "AGRO", "Residential operations specialist. GRO shift management, youth care logs, behavioral observations, safety rounds, census tracking.", "residential-operations", JSON.stringify(["shift-logs", "observations", "care-plans", "safety-rounds", "census"]), "pilot", "pilot", "Residential", "#F59E0B", "Home", JSON.stringify(["gro_read", "gro_write", "residential_write"]), JSON.stringify(["shift_logs", "observations", "care_plans"]), "2026-01-01T00:00:00Z", 3, now, now],
      ["amos-sentinel", "amos-sentinel", "AMOS-Sentinel", "ASENT", "QA and compliance guardian. Audit readiness, CAP tracking, deficiency monitoring, regulatory compliance verification.", "qa-compliance", JSON.stringify(["audits", "cap-plans", "compliance-reports", "deficiency-tracking"]), "pilot", "pilot", "Compliance", "#EF4444", "Shield", JSON.stringify(["qa_read", "audit_write", "compliance_write"]), JSON.stringify(["audits", "cap_plans", "compliance_reports"]), "2026-01-01T00:00:00Z", 4, now, now],
      ["amos-scribe", "amos-scribe", "AMOS-Scribe", "ASCR", "Document production engine. Branded DOCX/PDF/Excel generation, template library, controlled publishing workflow.", "document-management", JSON.stringify(["documents", "templates", "publishing", "docx-pdf"]), "pilot", "pilot", "Documents", "#8B5CF6", "FileText", JSON.stringify(["documents_read", "studio_write", "templates_write"]), JSON.stringify(["documents", "presentations", "spreadsheets"]), "2026-01-01T00:00:00Z", 5, now, now],
      ["amos-revenue", "amos-revenue", "AMOS-Revenue", "AREV", "Revenue cycle specialist. Authorizations, claims management, billing readiness, payer packet assembly, denials tracking.", "billing-revenue", JSON.stringify(["claims", "authorizations", "billing", "payer-packets", "denials"]), "pilot", "pilot", "Revenue", "#06B6D4", "Banknote", JSON.stringify(["revenue_read", "billing_write", "claims_write"]), JSON.stringify(["claims", "authorizations", "payer_packets"]), "2026-01-01T00:00:00Z", 6, now, now],
      // ═══ 7 Deferred Personas (NOT Active in UI) ═══
      ["amos-hr", "amos-hr", "AMOS-HR", "AHR", "Human resources specialist. Onboarding workflow, credential tracking, training assignments, performance documentation, compliance auditing.", "hr-operations", JSON.stringify(["onboarding", "credentials", "training", "performance"]), "deferred", "wave1", "HR", "#EC4899", "Users", JSON.stringify(["hr_read", "hr_write", "credentials_write"]), JSON.stringify(["onboarding_plans", "credentials_reports", "performance_reviews"]), null, 7, now, now],
      ["amos-prime", "amos-prime", "AMOS-Prime", "AP", "Executive orchestration persona. Top-level task routing, cross-system coordination, and strategic synthesis.", "executive", JSON.stringify(["routing", "coordination", "strategic-synthesis"]), "deferred", "wave3", "Executive", "#F97316", "Crown", JSON.stringify(["all_read", "routing_write"]), JSON.stringify(["memos", "decisions", "alerts"]), null, 8, now, now],
      ["amos-nxl", "amos-nxl", "AMOS-NXL", "ANXL", "Narrative intelligence engine. Generates operational narratives, trend explanations, and executive briefings from live data.", "intelligence", JSON.stringify(["narratives", "briefings", "trends"]), "deferred", "wave3", "Intelligence", "#14B8A6", "Brain", JSON.stringify(["analytics_read", "narrative_write"]), JSON.stringify(["briefings", "narratives", "summaries"]), null, 9, now, now],
      ["amos-thesis", "amos-thesis", "AMOS-THESIS", "AT", "Research and evidence synthesis. Academic literature review, regulatory research, evidence-based recommendation engine.", "research", JSON.stringify(["literature-review", "regulatory-research", "evidence-synthesis"]), "deferred", "wave3", "Research", "#6366F1", "GraduationCap", JSON.stringify(["research_read", "synthesis_write"]), JSON.stringify(["reports", "literature_reviews", "recommendations"]), null, 10, now, now],
      ["amos-dms", "amos-dms", "AMOS-DMS", "ADMS", "Document management specialist. Document lifecycle, template generation, packet assembly, and compliance publishing.", "document-system", JSON.stringify(["doc-lifecycle", "templates", "packet-assembly", "compliance-pub"]), "deferred", "wave3", "Documents", "#84CC16", "FolderOpen", JSON.stringify(["documents_read", "dms_write", "templates_write"]), JSON.stringify(["documents", "packets", "templates"]), null, 11, now, now],
      ["amos-coach", "amos-coach", "AMOS-Coach", "ACOACH", "Training and coaching facilitator. Staff development, competency tracking, scenario-based learning, performance coaching.", "training", JSON.stringify(["staff-dev", "competency", "learning", "coaching"]), "deferred", "wave2", "Training", "#D946EF", "Trophy", JSON.stringify(["training_read", "coaching_write"]), JSON.stringify(["training_plans", "competency_assessments", "coaching_sessions"]), null, 12, now, now],
      ["amos-strategy", "amos-strategy", "AMOS-Strategy", "ASTRAT", "Strategic planning analyst. Growth initiatives, market analysis, board reporting, risk register, strategic decision support.", "strategy", JSON.stringify(["growth", "market-analysis", "board-reports", "risk-register"]), "deferred", "wave2", "Strategy", "#0EA5E9", "TrendingUp", JSON.stringify(["executive_read", "strategy_write"]), JSON.stringify(["strategic_plans", "risk_registers", "board_memos"]), null, 13, now, now],
    ];
    const insert = sqlite.prepare("INSERT INTO agent_personas (id, key, name, code, description, scope, boundaries_json, status, wave, category, color, icon, permissions, outputs, activated_at, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const p of seedPersonas) insert.run(...p);
    console.log("[DB] Seeded 13 AMOS personas (6 pilot active, 7 deferred).");
  }

  console.log("[DB] Database initialized successfully.");
}
