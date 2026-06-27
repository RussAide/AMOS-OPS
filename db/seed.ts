// AMOS-OPS Database Seed Script
// Populates the database with sample data for development

import { getDb, sqlite } from "../api/queries/connection";
import {
  users,
  hrPeople,
  moduleStatuses,
  statusTransitions,
  documents,
  trainingModules,
  notifications,
} from "./schema";
import { randomUUID } from "crypto";

// Create tables if they don't exist
function initTables() {
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS module_statuses (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      status_id TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      note TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      record_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      file_path TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uploaded_by TEXT,
      verified_at TEXT,
      verified_by TEXT,
      status TEXT NOT NULL DEFAULT 'uploaded',
      expiry_date TEXT,
      note TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS training_modules (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      step_count INTEGER NOT NULL DEFAULT 5,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS training_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      completed_steps INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      quiz_score INTEGER,
      quiz_passed INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT
    )
  `);

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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("[DB] All tables initialized");
}

async function seed() {
  console.log("[Seed] Starting database seed...");
  initTables();

  const db = getDb();

  // ─── Seed Users ────────────────────────────────────────────
  console.log("[Seed] Creating users...");

  const adminId = randomUUID();
  const hrId = randomUUID();

  await db.insert(users).values([
    {
      id: adminId,
      email: "admin@adolbi.com",
      passwordHash: "$2a$12$K0ByB.6YI2/OYrB4fQOYLe6QdRg6XnYlYqYqYqYqYqYqYqYqYqYqYq",
      firstName: "System",
      lastName: "Administrator",
      role: "administrator" as const,
      department: "IT",
      isActive: true,
    },
    {
      id: hrId,
      email: "hr@adolbi.com",
      passwordHash: "$2a$12$K0ByB.6YI2/OYrB4fQOYLe6QdRg6XnYlYqYqYqYqYqYqYqYqYqYqYq",
      firstName: "HR",
      lastName: "Director",
      role: "hr-director" as const,
      department: "Human Resources",
      isActive: true,
    },
  ]);

  // ─── Seed HR People ────────────────────────────────────────
  console.log("[Seed] Creating HR people...");

  const activationPeople = [
    { firstName: "Marcus", lastName: "Johnson", role: "GRO Specialist", department: "Field Operations", lane: "activation" as const, isEmployee: true, employeeId: "E-1045" },
    { firstName: "Sarah", lastName: "Chen", role: "GRO Associate", department: "Field Operations", lane: "activation" as const, isEmployee: true, employeeId: "E-1046" },
    { firstName: "David", lastName: "Rodriguez", role: "GRO Specialist", department: "Field Operations", lane: "activation" as const, isEmployee: true, employeeId: "E-1047" },
    { firstName: "Aisha", lastName: "Patel", role: "GRO Trainee", department: "Field Operations", lane: "activation" as const, isEmployee: false },
    { firstName: "James", lastName: "Wilson", role: "GRO Associate", department: "Field Operations", lane: "activation" as const, isEmployee: true, employeeId: "E-1048" },
    { firstName: "Elena", lastName: "Vasquez", role: "GRO Specialist", department: "Field Operations", lane: "activation" as const, isEmployee: true, employeeId: "E-1049" },
    { firstName: "Michael", lastName: "Thompson", role: "GRO Trainee", department: "Field Operations", lane: "activation" as const, isEmployee: false },
    { firstName: "Priya", lastName: "Nair", role: "GRO Associate", department: "Field Operations", lane: "activation" as const, isEmployee: true, employeeId: "E-1050" },
  ];

  const managementPeople: Array<{
    firstName: string; lastName: string; role: string; department: string;
    lane: "management"; isEmployee: boolean; employeeId: string; supervisor?: string;
  }> = [
    { firstName: "Robert", lastName: "Fitzgerald", role: "Supervisor", department: "Operations", lane: "management", isEmployee: true, employeeId: "E-1001", supervisor: "Admin" },
    { firstName: "Linda", lastName: "Hartman", role: "HR Coordinator", department: "Human Resources", lane: "management", isEmployee: true, employeeId: "E-1002" },
    { firstName: "Amanda", lastName: "Sullivan", role: "Clinical Director", department: "Clinical", lane: "management", isEmployee: true, employeeId: "E-1003" },
    { firstName: "Kevin", lastName: "OBrien", role: "QA Officer", department: "Quality Assurance", lane: "management", isEmployee: true, employeeId: "E-1004" },
    { firstName: "Nicole", lastName: "Peterson", role: "Operations Manager", department: "Operations", lane: "management", isEmployee: true, employeeId: "E-1005" },
    { firstName: "Rachel", lastName: "Dumont", role: "Training Coordinator", department: "Training", lane: "management", isEmployee: true, employeeId: "E-1006" },
  ];

  const peopleIds: string[] = [];

  for (const person of activationPeople) {
    const id = randomUUID();
    peopleIds.push(id);
    await db.insert(hrPeople).values({
      id,
      firstName: person.firstName,
      lastName: person.lastName,
      role: person.role,
      department: person.department,
      lane: person.lane,
      isEmployee: person.isEmployee,
      employeeId: person.employeeId ?? null,
      supervisor: null,
    });
  }

  for (const person of managementPeople) {
    const id = randomUUID();
    peopleIds.push(id);
    await db.insert(hrPeople).values({
      id,
      firstName: person.firstName,
      lastName: person.lastName,
      role: person.role,
      department: person.department,
      lane: person.lane,
      isEmployee: person.isEmployee,
      employeeId: person.employeeId,
      supervisor: person.supervisor ?? null,
    });
  }

  // ─── Seed Module Statuses ──────────────────────────────────
  console.log("[Seed] Creating module statuses...");

  const activationModules = ["recruitment", "screening", "interview", "offers", "onboarding", "personnel-files"];
  const managementModules = ["performance", "pto-leaves", "disciplinary", "benefits", "offboarding"];

  for (let i = 0; i < peopleIds.length; i++) {
    const personId = peopleIds[i];
    const isManagement = i >= activationPeople.length;
    const modules = isManagement ? managementModules : activationModules;

    for (const moduleId of modules) {
      await db.insert(moduleStatuses).values({
        id: randomUUID(),
        personId,
        moduleId,
        statusId: "pending",
      });
    }
  }

  // ─── Seed Status Transitions ───────────────────────────────
  console.log("[Seed] Creating status transitions...");

  await db.insert(statusTransitions).values([
    {
      id: randomUUID(),
      personId: peopleIds[0],
      personName: "Marcus Johnson",
      moduleId: "recruitment",
      moduleName: "Recruitment",
      fromStatus: "pending",
      toStatus: "in-progress",
      changedBy: "HR Director",
      note: "Initial status change",
    },
    {
      id: randomUUID(),
      personId: peopleIds[1],
      personName: "Sarah Chen",
      moduleId: "screening",
      moduleName: "Screening",
      fromStatus: "pending",
      toStatus: "completed",
      changedBy: "HR Director",
      note: "Screening passed",
    },
    {
      id: randomUUID(),
      personId: peopleIds[8],
      personName: "Robert Fitzgerald",
      moduleId: "performance",
      moduleName: "Performance Management",
      fromStatus: "pending",
      toStatus: "in-progress",
      changedBy: "Administrator",
      note: "Q2 review started",
    },
  ]);

  // ─── Seed Documents ────────────────────────────────────────
  console.log("[Seed] Creating documents...");

  const sampleDocs = [
    { personIdx: 0, moduleId: "recruitment", recordName: "Resume", fileName: "marcus_johnson_resume.pdf", status: "verified" as const },
    { personIdx: 0, moduleId: "recruitment", recordName: "Application Form", fileName: "application_form.pdf", status: "verified" as const },
    { personIdx: 0, moduleId: "screening", recordName: "Background Check", fileName: "bg_check.pdf", status: "verified" as const },
    { personIdx: 0, moduleId: "interview", recordName: "Interview Notes", fileName: "interview_notes.pdf", status: "uploaded" as const },
    { personIdx: 1, moduleId: "recruitment", recordName: "Resume", fileName: "sarah_chen_resume.pdf", status: "verified" as const },
    { personIdx: 1, moduleId: "screening", recordName: "Reference Check", fileName: "reference_check.pdf", status: "verified" as const },
    { personIdx: 2, moduleId: "recruitment", recordName: "Resume", fileName: "david_rodriguez_resume.pdf", status: "verified" as const },
    { personIdx: 3, moduleId: "recruitment", recordName: "Resume", fileName: "aisha_patel_resume.pdf", status: "uploaded" as const },
    { personIdx: 8, moduleId: "performance", recordName: "Q2 Review", fileName: "q2_review_2024.pdf", status: "verified" as const },
    { personIdx: 8, moduleId: "benefits", recordName: "Benefits Enrollment", fileName: "benefits_enrollment.pdf", status: "verified" as const },
  ];

  for (const doc of sampleDocs) {
    await db.insert(documents).values({
      id: randomUUID(),
      personId: peopleIds[doc.personIdx],
      moduleId: doc.moduleId,
      recordName: doc.recordName,
      fileName: doc.fileName,
      fileType: "application/pdf",
      fileSize: 1024 * 1024,
      status: doc.status,
      uploadedBy: "HR Director",
      verifiedAt: doc.status === "verified" ? new Date().toISOString() : null,
      verifiedBy: doc.status === "verified" ? "HR Director" : null,
    });
  }

  // ─── Seed Training Modules ─────────────────────────────────
  console.log("[Seed] Creating training modules...");

  await db.insert(trainingModules).values([
    { id: "mod-101", trackId: "universal-orientation", title: "Welcome to the Mission", category: "Universal Orientation", stepCount: 5 },
    { id: "mod-102", trackId: "universal-orientation", title: "Safety & Emergency Protocols", category: "Universal Orientation", stepCount: 6 },
    { id: "mod-103", trackId: "universal-orientation", title: "Privacy & Confidentiality", category: "Universal Orientation", stepCount: 5 },
    { id: "mod-104", trackId: "universal-orientation", title: "Communication Standards", category: "Universal Orientation", stepCount: 5 },
    { id: "mod-100", trackId: "gro-direct-care", title: "GRO Direct Care LMS", category: "GRO Direct Care", stepCount: 5 },
  ]);

  // ─── Seed Notifications ────────────────────────────────────
  console.log("[Seed] Creating notifications...");

  await db.insert(notifications).values([
    {
      id: randomUUID(),
      userId: adminId,
      type: "status-change" as const,
      title: "Status Change: Marcus Johnson",
      message: "Marcus Johnson moved from Pending to In Progress in Recruitment",
      personName: "Marcus Johnson",
      moduleName: "Recruitment",
      isRead: false,
    },
    {
      id: randomUUID(),
      userId: adminId,
      type: "document" as const,
      title: "Document Uploaded",
      message: "New document uploaded for Sarah Chen in Screening",
      personName: "Sarah Chen",
      moduleName: "Screening",
      isRead: false,
    },
    {
      id: randomUUID(),
      userId: hrId,
      type: "alert" as const,
      title: "Missing Documents Alert",
      message: "3 employees have missing required documents",
      isRead: false,
    },
  ]);

  console.log("[Seed] Database seeded successfully!");
  console.log(`  - 2 users`);
  console.log(`  - ${activationPeople.length + managementPeople.length} HR people`);
  console.log(`  - ${sampleDocs.length} documents`);
  console.log(`  - 5 training modules`);
  console.log(`  - 3 notifications`);
}

seed().catch((err) => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});
