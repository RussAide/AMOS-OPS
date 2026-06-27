// AMOS-OPS HR Document Management Data Model
// Tracks uploaded documents per person per module

export interface HRDocument {
  id: string;
  personId: string;
  moduleId: string;
  recordName: string; // matches a required record name from the module
  fileName: string;
  fileType: string;
  fileSize: number; // bytes
  uploadedAt: string; // ISO date
  uploadedBy: string;
  filePath?: string; // server path to the stored file
  verifiedAt?: string;
  verifiedBy?: string;
  status: "uploaded" | "verified" | "rejected" | "expired";
  expiryDate?: string;
  note?: string;
}

// ─── Sample Documents (pre-populated for demo) ──────────────

export const SAMPLE_DOCUMENTS: HRDocument[] = [
  // Sarah Martinez (p-001) - fully cleared employee
  { id: "doc-001", personId: "p-001", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_Letter_Sarah_Martinez_2025.pdf", fileType: "application/pdf", fileSize: 245760, uploadedAt: "2025-01-10T09:00:00Z", uploadedBy: "HR Admin", status: "verified", verifiedAt: "2025-01-10T10:00:00Z", verifiedBy: "HR Director" },
  { id: "doc-002", personId: "p-001", moduleId: "offers", recordName: "Offer Acceptance", fileName: "Signed_Acceptance_Sarah_Martinez.pdf", fileType: "application/pdf", fileSize: 180224, uploadedAt: "2025-01-12T11:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-003", personId: "p-001", moduleId: "offers", recordName: "I-9 Form", fileName: "I-9_Sarah_Martinez.pdf", fileType: "application/pdf", fileSize: 315392, uploadedAt: "2025-01-13T14:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-004", personId: "p-001", moduleId: "offers", recordName: "Background Check Authorization", fileName: "BG_Check_Auth_Sarah_Martinez.pdf", fileType: "application/pdf", fileSize: 122880, uploadedAt: "2025-01-11T08:30:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-005", personId: "p-001", moduleId: "clearance", recordName: "Clearance Checklist", fileName: "Clearance_Checklist_SM.pdf", fileType: "application/pdf", fileSize: 204800, uploadedAt: "2025-01-15T10:00:00Z", uploadedBy: "HR Admin", status: "verified", verifiedAt: "2025-01-15T15:00:00Z", verifiedBy: "HR Director" },
  { id: "doc-006", personId: "p-001", moduleId: "personnel-files", recordName: "Personnel File Cover Sheet", fileName: "PF_Cover_Sarah_Martinez.pdf", fileType: "application/pdf", fileSize: 98304, uploadedAt: "2025-01-16T09:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-007", personId: "p-001", moduleId: "credentials", recordName: "CPR Certification", fileName: "CPR_Cert_Sarah_Martinez_2025.pdf", fileType: "application/pdf", fileSize: 450560, uploadedAt: "2025-03-15T09:30:00Z", uploadedBy: "HR Admin", status: "verified", expiryDate: "2026-03-15" },
  { id: "doc-008", personId: "p-001", moduleId: "credentials", recordName: "Clinical License", fileName: "Clinical_License_SM_2025.pdf", fileType: "application/pdf", fileSize: 389120, uploadedAt: "2025-01-15T11:00:00Z", uploadedBy: "HR Admin", status: "verified", expiryDate: "2025-12-31" },

  // David Chen (p-002)
  { id: "doc-009", personId: "p-002", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_Letter_David_Chen_2025.pdf", fileType: "application/pdf", fileSize: 235520, uploadedAt: "2025-02-05T10:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-010", personId: "p-002", moduleId: "offers", recordName: "I-9 Form", fileName: "I-9_David_Chen.pdf", fileType: "application/pdf", fileSize: 307200, uploadedAt: "2025-02-06T13:00:00Z", uploadedBy: "HR Admin", status: "verified" },

  // Aisha Johnson (p-003) - has expired credential
  { id: "doc-011", personId: "p-003", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_Aisha_Johnson.pdf", fileType: "application/pdf", fileSize: 221184, uploadedAt: "2024-08-01T09:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-012", personId: "p-003", moduleId: "credentials", recordName: "CPR Certification", fileName: "CPR_Cert_Aisha_Johnson_2024.pdf", fileType: "application/pdf", fileSize: 425984, uploadedAt: "2024-08-15T10:00:00Z", uploadedBy: "HR Admin", status: "expired", expiryDate: "2025-06-01" },
  { id: "doc-013", personId: "p-003", moduleId: "personnel-files", recordName: "Personnel File Cover Sheet", fileName: "PF_Cover_Aisha_Johnson.pdf", fileType: "application/pdf", fileSize: 90112, uploadedAt: "2024-09-01T08:00:00Z", uploadedBy: "HR Admin", status: "verified" },

  // Robert Kim (p-009) - candidate in recruitment
  { id: "doc-014", personId: "p-009", moduleId: "recruitment", recordName: "Applicant File", fileName: "Application_Robert_Kim.pdf", fileType: "application/pdf", fileSize: 512000, uploadedAt: "2025-06-10T08:45:00Z", uploadedBy: "System", status: "uploaded" },
  { id: "doc-015", personId: "p-009", moduleId: "recruitment", recordName: "Minimum Qualification Review", fileName: "QualReview_Robert_Kim.pdf", fileType: "application/pdf", fileSize: 98304, uploadedAt: "2025-06-10T08:45:00Z", uploadedBy: "System", status: "uploaded" },

  // Jennifer Adams (p-010) - candidate in screening
  { id: "doc-016", personId: "p-010", moduleId: "recruitment", recordName: "Applicant File", fileName: "Application_Jennifer_Adams.pdf", fileType: "application/pdf", fileSize: 548864, uploadedAt: "2025-06-08T10:30:00Z", uploadedBy: "System", status: "verified" },
  { id: "doc-017", personId: "p-010", moduleId: "screening", recordName: "Interview Notes", fileName: "Interview_Notes_Jennifer_Adams.pdf", fileType: "application/pdf", fileSize: 131072, uploadedAt: "2025-06-12T14:00:00Z", uploadedBy: "HR Admin", status: "uploaded" },

  // Daniel Williams (p-011)
  { id: "doc-018", personId: "p-011", moduleId: "recruitment", recordName: "Applicant File", fileName: "Application_Daniel_Williams.pdf", fileType: "application/pdf", fileSize: 491520, uploadedAt: "2025-06-14T09:15:00Z", uploadedBy: "System", status: "uploaded" },

  // Michelle Brown (p-012)
  { id: "doc-019", personId: "p-012", moduleId: "recruitment", recordName: "Applicant File", fileName: "Application_Michelle_Brown.pdf", fileType: "application/pdf", fileSize: 524288, uploadedAt: "2025-06-15T14:30:00Z", uploadedBy: "System", status: "uploaded" },
  { id: "doc-020", personId: "p-012", moduleId: "recruitment", recordName: "Minimum Qualification Review", fileName: "QualReview_Michelle_Brown.pdf", fileType: "application/pdf", fileSize: 114688, uploadedAt: "2025-06-15T14:30:00Z", uploadedBy: "System", status: "uploaded" },

  // Emily Foster (p-006) - incomplete personnel file
  { id: "doc-021", personId: "p-006", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_Emily_Foster.pdf", fileType: "application/pdf", fileSize: 237568, uploadedAt: "2025-02-20T09:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-022", personId: "p-006", moduleId: "personnel-files", recordName: "Personnel File Cover Sheet", fileName: "PF_Cover_Emily_Foster.pdf", fileType: "application/pdf", fileSize: 94208, uploadedAt: "2025-02-25T08:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  // Missing: Emergency Contact Form, Direct Deposit Form for Emily

  // Christopher Lee (p-013) - offer accepted, packet incomplete
  { id: "doc-023", personId: "p-013", moduleId: "offers", recordName: "Offer Acceptance", fileName: "Signed_Acceptance_Chris_Lee.pdf", fileType: "application/pdf", fileSize: 172032, uploadedAt: "2025-06-01T10:00:00Z", uploadedBy: "System", status: "verified" },
  { id: "doc-024", personId: "p-013", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_Chris_Lee_2025.pdf", fileType: "application/pdf", fileSize: 241664, uploadedAt: "2025-05-28T14:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  // Missing: I-9, Background Check, Pre-Employment Packet

  // James Park (p-007)
  { id: "doc-025", personId: "p-007", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_James_Park_2024.pdf", fileType: "application/pdf", fileSize: 258048, uploadedAt: "2024-09-01T09:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-026", personId: "p-007", moduleId: "credentials", recordName: "Management Certification", fileName: "Mgmt_Cert_James_Park.pdf", fileType: "application/pdf", fileSize: 512000, uploadedAt: "2024-09-15T10:00:00Z", uploadedBy: "HR Admin", status: "verified", expiryDate: "2025-09-15" },
  { id: "doc-027", personId: "p-007", moduleId: "personnel-files", recordName: "Personnel File Cover Sheet", fileName: "PF_Cover_James_Park.pdf", fileType: "application/pdf", fileSize: 86016, uploadedAt: "2024-09-05T08:00:00Z", uploadedBy: "HR Admin", status: "verified" },

  // Maria Rodriguez (p-008)
  { id: "doc-028", personId: "p-008", moduleId: "offers", recordName: "Conditional Offer Letter", fileName: "Offer_Maria_Rodriguez_2024.pdf", fileType: "application/pdf", fileSize: 229376, uploadedAt: "2024-10-01T09:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-029", personId: "p-008", moduleId: "personnel-files", recordName: "Personnel File Cover Sheet", fileName: "PF_Cover_Maria_R.pdf", fileType: "application/pdf", fileSize: 90112, uploadedAt: "2024-10-05T08:00:00Z", uploadedBy: "HR Admin", status: "verified" },
  { id: "doc-030", personId: "p-008", moduleId: "credentials", recordName: "CPR Certification", fileName: "CPR_Maria_Rodriguez_2025.pdf", fileType: "application/pdf", fileSize: 438272, uploadedAt: "2025-04-01T09:00:00Z", uploadedBy: "HR Admin", status: "verified", expiryDate: "2026-04-01" },
];

// ─── Helpers ──────────────────────────────────────────────────

export function getDocumentsForPerson(docs: HRDocument[], personId: string): HRDocument[] {
  return docs.filter((d) => d.personId === personId);
}

export function getDocumentsForPersonAndModule(docs: HRDocument[], personId: string, moduleId: string): HRDocument[] {
  return docs.filter((d) => d.personId === personId && d.moduleId === moduleId);
}

export function getDocumentCompleteness(
  docs: HRDocument[],
  personId: string,
  moduleId: string,
  requiredRecords: string[]
): { uploaded: string[]; missing: string[]; percent: number } {
  const personDocs = getDocumentsForPersonAndModule(docs, personId, moduleId);
  const uploaded = requiredRecords.filter((rr) =>
    personDocs.some((d) => d.recordName === rr && d.status !== "rejected")
  );
  const missing = requiredRecords.filter((rr) => !uploaded.includes(rr));
  const percent = requiredRecords.length > 0 ? Math.round((uploaded.length / requiredRecords.length) * 100) : 100;
  return { uploaded, missing, percent };
}

export function getMissingDocumentsGlobally(
  docs: HRDocument[],
  people: { id: string; firstName: string; lastName: string; moduleStatuses: Record<string, string> }[],
  modules: { id: string; name: string; requiredRecords: string[] }[]
): Array<{
  personId: string;
  personName: string;
  moduleId: string;
  moduleName: string;
  missingRecords: string[];
}> {
  const result: Array<{ personId: string; personName: string; moduleId: string; moduleName: string; missingRecords: string[] }> = [];

  for (const person of people) {
    // Only check modules where person is actively engaged (has a status)
    for (const mod of modules) {
      const status = person.moduleStatuses[mod.id];
      if (!status || status === "" || status.includes("not-started") || status.includes("closed")) continue;

      const personDocs = getDocumentsForPersonAndModule(docs, person.id, mod.id);
      const missingRecords = mod.requiredRecords.filter((rr) =>
        !personDocs.some((d) => d.recordName === rr && d.status !== "rejected")
      );

      if (missingRecords.length > 0) {
        result.push({
          personId: person.id,
          personName: `${person.firstName} ${person.lastName}`,
          moduleId: mod.id,
          moduleName: mod.name,
          missingRecords,
        });
      }
    }
  }

  return result;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
