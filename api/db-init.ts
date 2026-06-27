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

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT
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
      address TEXT,
      facility_type TEXT,
      square_footage INTEGER,
      rooms INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
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
      persona_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      scope_domains TEXT,
      trigger_conditions TEXT,
      is_active INTEGER DEFAULT 1
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

  // Seed default admin if no users exist
  const userCount = sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as any;
  if ((userCount?.c ?? 0) === 0) {
    console.log("[DB] No users found. Run 'Create Default Admin Account' on the login page.");
  }

  console.log("[DB] Database initialized successfully.");
}
