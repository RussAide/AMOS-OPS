import { createContext, createElement, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  ALL_HR_MODULES,
  HR_LANES,
  COMMAND_CARDS,
  ALERT_RULES,
  type HRPerson,
  type HRModuleDef,
  type HRLane,
  type AlertRule,
} from "@/data/hrLifecycleData";
import { type HRDocument } from "@/data/hrDocumentData";
import { trpc } from "@/providers/trpc";

export interface StatusTransition {
  id: string;
  personId: string;
  personName: string;
  moduleId: string;
  moduleName: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

// ─── Merge DB module statuses into HRPerson format ──────────
interface RawPerson {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  role: string;
  department: string;
  lane: string;
  isActive: boolean | number;
  isEmployee: boolean | number;
  hireDate: string | null;
  supervisor: string | null;
  createdAt: string | null;
}

interface RawStatus {
  personId: string;
  moduleId: string;
  statusId: string;
}

function mergeModuleStatuses(rawPeople: RawPerson[], statuses: RawStatus[]): HRPerson[] {
  return rawPeople.map((p) => {
    const personStatuses = statuses.filter((s) => s.personId === p.id);
    const moduleStatuses: Record<string, string> = {};
    for (const s of personStatuses) {
      moduleStatuses[s.moduleId] = s.statusId;
    }
    // Pre-populate default statuses
    for (const mod of ALL_HR_MODULES) {
      if (!(mod.id in moduleStatuses)) {
        moduleStatuses[mod.id] = "pending";
      }
    }
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      employeeId: p.employeeId || "",
      role: p.role,
      department: p.department,
      lane: p.lane as "activation" | "management",
      isActive: !!p.isActive,
      isEmployee: !!p.isEmployee,
      hireDate: p.hireDate || "",
      supervisor: p.supervisor || "",
      moduleStatuses,
    };
  });
}

// ─── Context Interface ───────────────────────────────────────

interface HRState {
  lanes: HRLane[];
  modules: HRModuleDef[];
  people: HRPerson[];
  transitions: StatusTransition[];
  documents: HRDocument[];
  commandCards: typeof COMMAND_CARDS;
  alertRules: AlertRule[];
  isLoading: boolean;

  // Actions
  createPerson: (person: Omit<HRPerson, "id" | "moduleStatuses" | "isActive">) => HRPerson;
  updatePerson: (personId: string, updates: Partial<Omit<HRPerson, "id" | "moduleStatuses">>) => void;
  updatePersonStatus: (personId: string, moduleId: string, statusId: string) => void;
  getPeopleInModule: (moduleId: string) => HRPerson[];
  getPeopleByStatus: (moduleId: string, statusId: string) => HRPerson[];
  getActiveAlerts: () => Array<{ rule: AlertRule; people: HRPerson[] }>;
  getCardMetrics: () => Record<string, number>;
  getPendingActionsCount: () => number;
  getTransitionsForPerson: (personId: string) => StatusTransition[];

  // Document management
  addDocument: (doc: Omit<HRDocument, "id" | "uploadedAt">) => void;
  verifyDocument: (docId: string, verifier: string) => void;
  rejectDocument: (docId: string, note: string) => void;
  getDocumentsForPerson: (personId: string) => HRDocument[];
  getDocumentsForPersonAndModule: (personId: string, moduleId: string) => HRDocument[];
  getDocumentCompleteness: (personId: string, moduleId: string) => { uploaded: string[]; missing: string[]; percent: number };
  getMissingDocumentsGlobally: () => Array<{ personId: string; personName: string; moduleId: string; moduleName: string; missingRecords: string[] }>;
}

const HRContext = createContext<HRState | null>(null);

export function HRProvider({ children }: { children: ReactNode }) {
  // ─── tRPC Queries ──────────────────────────────────────────
  const { data: rawPeople = [], isLoading: peopleLoading } = trpc.hr.listPeople.useQuery();
  const { data: rawStatuses = [] } = trpc.hr.getModuleStatuses.useQuery(undefined);
  const { data: rawTransitions = [] } = trpc.hr.listTransitions.useQuery({});
  const { data: rawDocuments = [] } = trpc.documents.list.useQuery({});

  // Local state - initialized with demo data, overwritten by tRPC when backend available
  const [localPeople, setLocalPeople] = useState<HRPerson[]>([
    { id: "p-001", firstName: "Synthetic", lastName: "Person-001", role: "GRO Specialist", department: "Field Operations", lane: "activation", isActive: true, isEmployee: true, employeeId: "E-1045", hireDate: "2024-01-15", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-002", firstName: "Sarah", lastName: "Chen", role: "GRO Associate", department: "Field Operations", lane: "activation", isActive: true, isEmployee: true, employeeId: "E-1046", hireDate: "2024-02-01", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-in-progress", onboarding: "ob-in-progress", clearance: "c-pending-bg", "personnel-files": "pf-incomplete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-003", firstName: "David", lastName: "Rodriguez", role: "GRO Specialist", department: "Field Operations", lane: "activation", isActive: true, isEmployee: true, employeeId: "E-1047", hireDate: "", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-posted", screening: "s-interview-sched", interview: "i-not-started", offers: "o-not-started", orientation: "or-not-started", onboarding: "ob-not-started", clearance: "c-not-ready", "personnel-files": "pf-not-started", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-004", firstName: "Aisha", lastName: "Patel", role: "GRO Trainee", department: "Field Operations", lane: "activation", isActive: true, isEmployee: false, employeeId: "", hireDate: "", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-sent", orientation: "or-assigned", onboarding: "ob-not-started", clearance: "c-not-ready", "personnel-files": "pf-incomplete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-005", firstName: "James", lastName: "Wilson", role: "GRO Associate", department: "Field Operations", lane: "activation", isActive: true, isEmployee: true, employeeId: "E-1048", hireDate: "2024-03-10", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-006", firstName: "Elena", lastName: "Vasquez", role: "GRO Specialist", department: "Field Operations", lane: "activation", isActive: true, isEmployee: true, employeeId: "E-1049", hireDate: "2024-01-20", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-cert-pending", clearance: "c-super-review", "personnel-files": "pf-complete", credentials: "cr-expiring", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-007", firstName: "Michael", lastName: "Thompson", role: "GRO Trainee", department: "Field Operations", lane: "activation", isActive: true, isEmployee: false, employeeId: "", hireDate: "", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-posted", screening: "s-not-started", interview: "i-not-started", offers: "o-not-started", orientation: "or-not-started", onboarding: "ob-not-started", clearance: "c-not-ready", "personnel-files": "pf-not-started", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-008", firstName: "Priya", lastName: "Nair", role: "GRO Associate", department: "Field Operations", lane: "activation", isActive: true, isEmployee: true, employeeId: "E-1050", hireDate: "2024-02-15", supervisor: "Robert Fitzgerald", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed" } },
    { id: "p-009", firstName: "Robert", lastName: "Fitzgerald", role: "Supervisor", department: "Operations", lane: "management", isActive: true, isEmployee: true, employeeId: "E-1001", hireDate: "2022-06-01", supervisor: "Admin", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" } },
    { id: "p-010", firstName: "Linda", lastName: "Hartman", role: "HR Coordinator", department: "Human Resources", lane: "management", isActive: true, isEmployee: true, employeeId: "E-1002", hireDate: "2022-08-15", supervisor: "Admin", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" } },
    { id: "p-011", firstName: "Amanda", lastName: "Sullivan", role: "Clinical Director", department: "Clinical", lane: "management", isActive: true, isEmployee: true, employeeId: "E-1003", hireDate: "2021-03-01", supervisor: "Admin", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" } },
    { id: "p-012", firstName: "Kevin", lastName: "OBrien", role: "QA Officer", department: "Quality Assurance", lane: "management", isActive: true, isEmployee: true, employeeId: "E-1004", hireDate: "2023-01-10", supervisor: "Admin", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-open", compliance: "ca-closed", separation: "sep-closed" } },
    { id: "p-013", firstName: "Nicole", lastName: "Peterson", role: "Operations Manager", department: "Operations", lane: "management", isActive: true, isEmployee: true, employeeId: "E-1005", hireDate: "2022-01-20", supervisor: "Admin", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" } },
    { id: "p-014", firstName: "Rachel", lastName: "Dumont", role: "Training Coordinator", department: "Training", lane: "management", isActive: true, isEmployee: true, employeeId: "E-1006", hireDate: "2023-06-01", supervisor: "Admin", moduleStatuses: { recruitment: "r-closed", screening: "s-selected", interview: "i-completed", offers: "o-file-ready", orientation: "or-signed", onboarding: "ob-comp-done", clearance: "c-cleared", "personnel-files": "pf-complete", credentials: "cr-current", performance: "pa-closed", compliance: "ca-closed", separation: "sep-closed" } },
  ]);
  const [localTransitions, setLocalTransitions] = useState<StatusTransition[]>([
    { id: "t-001", personId: "p-001", personName: "Synthetic Youth 001", moduleId: "recruitment", moduleName: "Recruitment", fromStatus: "(none)", toStatus: "Closed", changedBy: "HR Director", changedAt: "2024-01-10T10:00:00Z" },
    { id: "t-002", personId: "p-001", personName: "Synthetic Youth 001", moduleId: "clearance", moduleName: "Clearance", fromStatus: "Pending", toStatus: "Cleared", changedBy: "QA Officer", changedAt: "2024-02-20T14:00:00Z" },
    { id: "t-003", personId: "p-009", personName: "Robert Fitzgerald", moduleId: "performance", moduleName: "Performance", fromStatus: "(none)", toStatus: "Closed", changedBy: "System", changedAt: "2024-06-01T08:00:00Z" },
  ]);
  const [localDocuments, setLocalDocuments] = useState<HRDocument[]>([
    { id: "d-001", personId: "p-001", moduleId: "recruitment", recordName: "Resume", fileName: "marcus_johnson_resume.pdf", fileType: "application/pdf", fileSize: 1024000, uploadedAt: "2024-01-10T10:00:00Z", uploadedBy: "HR Director", verifiedAt: "2024-01-11T14:00:00Z", verifiedBy: "HR Director", status: "verified" },
    { id: "d-002", personId: "p-001", moduleId: "screening", recordName: "Background Check", fileName: "bg_check_marcus.pdf", fileType: "application/pdf", fileSize: 512000, uploadedAt: "2024-01-12T09:00:00Z", uploadedBy: "HR Director", verifiedAt: "2024-01-15T11:00:00Z", verifiedBy: "HR Director", status: "verified" },
    { id: "d-003", personId: "p-002", moduleId: "recruitment", recordName: "Resume", fileName: "sarah_chen_resume.pdf", fileType: "application/pdf", fileSize: 890000, uploadedAt: "2024-02-05T10:00:00Z", uploadedBy: "HR Director", status: "uploaded" },
    { id: "d-004", personId: "p-009", moduleId: "performance", recordName: "Q2 Review", fileName: "q2_review_robert.pdf", fileType: "application/pdf", fileSize: 1200000, uploadedAt: "2024-05-01T10:00:00Z", uploadedBy: "HR Director", verifiedAt: "2024-05-03T14:00:00Z", verifiedBy: "HR Director", status: "verified" },
  ]);

  // Mutations
  const updatePersonMutation = trpc.hr.updatePerson.useMutation();
  const setStatusMutation = trpc.hr.setModuleStatus.useMutation();
  const createTransitionMutation = trpc.hr.createTransition.useMutation();
  const createDocMutation = trpc.documents.create.useMutation();
  const updateDocStatusMutation = trpc.documents.updateStatus.useMutation();
  const utils = trpc.useUtils();

  // ─── Sync tRPC data to local state ─────────────────────────
  useEffect(() => {
    if (rawPeople.length > 0) {
      const merged = mergeModuleStatuses(rawPeople, rawStatuses);
      queueMicrotask(() => setLocalPeople(merged));
    }
  }, [rawPeople, rawStatuses]);

  useEffect(() => {
    if (rawTransitions.length > 0) {
      const transitions: StatusTransition[] = rawTransitions.map((transition) => ({
        id: transition.id,
        personId: transition.personId,
        personName: transition.personName,
        moduleId: transition.moduleId,
        moduleName: transition.moduleName,
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
        changedBy: transition.changedBy,
        changedAt: transition.changedAt ?? new Date().toISOString(),
        note: transition.note ?? undefined,
      }));
      queueMicrotask(() => setLocalTransitions(transitions));
    }
  }, [rawTransitions]);

  useEffect(() => {
    if (rawDocuments.length > 0) {
      const documents: HRDocument[] = rawDocuments.map((document) => ({
        id: document.id,
        personId: document.personId,
        moduleId: document.moduleId,
        recordName: document.recordName,
        fileName: document.fileName,
        fileType: document.fileType ?? "",
        fileSize: document.fileSize ?? 0,
        uploadedAt: document.uploadedAt ?? new Date().toISOString(),
        uploadedBy: document.uploadedBy ?? "",
        verifiedAt: document.verifiedAt ?? undefined,
        verifiedBy: document.verifiedBy ?? undefined,
        status: document.status,
        expiryDate: document.expiryDate ?? undefined,
        note: document.note ?? undefined,
      }));
      queueMicrotask(() => setLocalDocuments(documents));
    }
  }, [rawDocuments]);

  const isLoading = peopleLoading && localPeople.length === 0;

  // ─── Actions ───────────────────────────────────────────────

  const updatePersonStatus = useCallback(
    async (personId: string, moduleId: string, statusId: string) => {
      const person = localPeople.find((p) => p.id === personId);
      const moduleDef = ALL_HR_MODULES.find((m) => m.id === moduleId);
      if (!person || !moduleDef) return;

      const oldStatusId = person.moduleStatuses[moduleId] || "";
      const oldStatus = moduleDef.statusModel.find((s) => s.id === oldStatusId);
      const newStatus = moduleDef.statusModel.find((s) => s.id === statusId);

      // Optimistic update
      setLocalPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? { ...p, moduleStatuses: { ...p.moduleStatuses, [moduleId]: statusId } }
            : p
        )
      );

      // Persist to API
      try {
        await setStatusMutation.mutateAsync({ personId, moduleId, statusId });

        const transitionResult = await createTransitionMutation.mutateAsync({
          personId,
          personName: `${person.firstName} ${person.lastName}`,
          moduleId,
          moduleName: moduleDef.name,
          fromStatus: oldStatus?.label || oldStatusId || "(none)",
          toStatus: newStatus?.label || statusId,
          changedBy: "Current User",
        });

        if (transitionResult) {
          setLocalTransitions((prev) => [{
            id: transitionResult.id,
            personId: transitionResult.personId,
            personName: transitionResult.personName,
            moduleId: transitionResult.moduleId,
            moduleName: transitionResult.moduleName,
            fromStatus: transitionResult.fromStatus,
            toStatus: transitionResult.toStatus,
            changedBy: transitionResult.changedBy,
            changedAt: transitionResult.changedAt ?? new Date().toISOString(),
            note: transitionResult.note ?? undefined,
          }, ...prev]);
        }

        utils.hr.listPeople.invalidate();
        utils.hr.listTransitions.invalidate();
      } catch (err) {
        console.error("Failed to update status:", err);
        setLocalPeople((prev) =>
          prev.map((p) =>
            p.id === personId
              ? { ...p, moduleStatuses: { ...p.moduleStatuses, [moduleId]: oldStatusId } }
              : p
          )
        );
      }
    },
    [localPeople, setStatusMutation, createTransitionMutation, utils]
  );

  const getTransitionsForPerson = useCallback(
    (personId: string) =>
      localTransitions
        .filter((t) => t.personId === personId)
        .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()),
    [localTransitions]
  );

  const addDocument = useCallback(
    async (doc: Omit<HRDocument, "id" | "uploadedAt">) => {
      try {
        const result = await createDocMutation.mutateAsync({
          personId: doc.personId,
          moduleId: doc.moduleId,
          recordName: doc.recordName,
          fileName: doc.fileName,
          fileType: doc.fileType || undefined,
          fileSize: doc.fileSize || undefined,
          uploadedBy: doc.uploadedBy || undefined,
          expiryDate: doc.expiryDate || undefined,
        });

        if (result) {
          const newDoc: HRDocument = {
            id: result.id,
            personId: result.personId,
            moduleId: result.moduleId,
            recordName: result.recordName,
            fileName: result.fileName,
            fileType: result.fileType ?? "",
            fileSize: result.fileSize ?? 0,
            uploadedAt: result.uploadedAt ?? new Date().toISOString(),
            uploadedBy: result.uploadedBy ?? "",
            status: result.status,
            verifiedAt: result.verifiedAt ?? undefined,
            verifiedBy: result.verifiedBy ?? undefined,
            expiryDate: result.expiryDate ?? undefined,
            note: result.note ?? undefined,
          };
          setLocalDocuments((prev) => [newDoc, ...prev]);
        }

        utils.documents.list.invalidate();
      } catch (err) {
        console.error("Failed to add document:", err);
      }
    },
    [createDocMutation, utils]
  );

  const verifyDocument = useCallback(
    async (docId: string, verifier: string) => {
      try {
        await updateDocStatusMutation.mutateAsync({
          id: docId,
          status: "verified",
          verifiedBy: verifier,
        });

        setLocalDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? { ...d, status: "verified" as const, verifiedBy: verifier, verifiedAt: new Date().toISOString() }
              : d
          )
        );

        utils.documents.list.invalidate();
      } catch (err) {
        console.error("Failed to verify document:", err);
      }
    },
    [updateDocStatusMutation, utils]
  );

  const rejectDocument = useCallback(
    async (docId: string, note: string) => {
      try {
        await updateDocStatusMutation.mutateAsync({
          id: docId,
          status: "rejected",
          note,
        });

        setLocalDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, status: "rejected" as const, note } : d
          )
        );

        utils.documents.list.invalidate();
      } catch (err) {
        console.error("Failed to reject document:", err);
      }
    },
    [updateDocStatusMutation, utils]
  );

  const _getDocumentsForPerson = useCallback(
    (personId: string) => localDocuments.filter((d) => d.personId === personId),
    [localDocuments]
  );

  const _getDocumentsForPersonAndModule = useCallback(
    (personId: string, moduleId: string) =>
      localDocuments.filter((d) => d.personId === personId && d.moduleId === moduleId),
    [localDocuments]
  );

  const _getDocumentCompleteness = useCallback(
    (personId: string, moduleId: string) => {
      const mod = ALL_HR_MODULES.find((m) => m.id === moduleId);
      if (!mod) return { uploaded: [] as string[], missing: [] as string[], percent: 0 };
      const docs = localDocuments.filter((d) => d.personId === personId && d.moduleId === moduleId);
      const uploaded = docs.map((d) => d.recordName);
      const missing = mod.requiredRecords.filter((r) => !uploaded.includes(r));
      const percent = mod.requiredRecords.length > 0
        ? Math.round((uploaded.length / mod.requiredRecords.length) * 100)
        : 0;
      return { uploaded, missing, percent };
    },
    [localDocuments]
  );

  const _getMissingDocumentsGlobally = useCallback(() => {
    const results: Array<{ personId: string; personName: string; moduleId: string; moduleName: string; missingRecords: string[] }> = [];

    for (const person of localPeople) {
      for (const mod of ALL_HR_MODULES) {
        const docs = localDocuments.filter(
          (d) => d.personId === person.id && d.moduleId === mod.id && d.status === "verified"
        );
        const uploaded = docs.map((d) => d.recordName);
        const missing = mod.requiredRecords.filter((r) => !uploaded.includes(r));
        if (missing.length > 0) {
          results.push({
            personId: person.id,
            personName: `${person.firstName} ${person.lastName}`,
            moduleId: mod.id,
            moduleName: mod.name,
            missingRecords: missing,
          });
        }
      }
    }
    return results;
  }, [localPeople, localDocuments]);

  // ─── Create Person ─────────────────────────────────────────
  const createPerson = useCallback(
    (person: Omit<HRPerson, "id" | "moduleStatuses" | "isActive">): HRPerson => {
      const newId = `p-${String(localPeople.length + 1).padStart(3, "0")}`;
      // Initialize all module statuses to "pending"
      const defaultStatuses: Record<string, string> = {};
      for (const mod of ALL_HR_MODULES) {
        defaultStatuses[mod.id] = "pending";
      }
      const newPerson: HRPerson = {
        id: newId,
        ...person,
        isActive: true,
        moduleStatuses: defaultStatuses,
      };
      setLocalPeople((prev) => [...prev, newPerson]);
      // Create a transition log entry
      const newTransition: StatusTransition = {
        id: `t-${Date.now()}`,
        personId: newId,
        personName: `${person.firstName} ${person.lastName}`,
        moduleId: "system",
        moduleName: "System",
        fromStatus: "(none)",
        toStatus: "Created",
        changedBy: "Current User",
        changedAt: new Date().toISOString(),
        note: `New ${person.lane} candidate created`,
      };
      setLocalTransitions((prev) => [newTransition, ...prev]);
      return newPerson;
    },
    [localPeople]
  );

  // ─── Update Person ─────────────────────────────────────────
  const updatePerson = useCallback(
    async (personId: string, updates: Partial<Omit<HRPerson, "id" | "moduleStatuses">>) => {
      // Optimistic update
      setLocalPeople((prev) =>
        prev.map((p) =>
          p.id === personId ? { ...p, ...updates } : p
        )
      );

      // Persist to API
      try {
        await updatePersonMutation.mutateAsync({ id: personId, ...updates });
        utils.hr.listPeople.invalidate();
      } catch (err) {
        console.error("Failed to update person:", err);
        // Revert handled by API invalidation
      }
    },
    [updatePersonMutation, utils]
  );

  const getPeopleInModule = useCallback(
    (moduleId: string) => localPeople.filter((p) => moduleId in p.moduleStatuses),
    [localPeople]
  );

  const getPeopleByStatus = useCallback(
    (moduleId: string, statusId: string) =>
      localPeople.filter((p) => p.moduleStatuses[moduleId] === statusId),
    [localPeople]
  );

  const getActiveAlerts = useCallback(() => {
    return ALERT_RULES.map((rule) => {
      let affected: HRPerson[] = [];
      if (rule.moduleId === "clearance" && rule.id === "al-1") {
        affected = localPeople.filter(
          (p) =>
            p.isActive &&
            p.moduleStatuses.clearance !== "c-cleared" &&
            p.moduleStatuses.clearance !== "c-not-cleared"
        );
      } else if (rule.moduleId === "credentials") {
        affected = localPeople.filter((p) => p.moduleStatuses.credentials === "cr-expired");
      } else if (rule.moduleId === "orientation") {
        affected = localPeople.filter((p) => p.moduleStatuses.orientation === "or-in-progress");
      } else if (rule.moduleId === "personnel-files") {
        affected = localPeople.filter((p) => p.moduleStatuses["personnel-files"] === "pf-incomplete");
      } else if (rule.moduleId === "clearance" && rule.id === "al-5") {
        affected = localPeople.filter((p) => p.moduleStatuses.clearance === "c-restricted");
      }
      return { rule, people: affected };
    }).filter((a) => a.people.length > 0);
  }, [localPeople]);

  const getCardMetrics = useCallback(() => {
    return {
      active_requisitions: localPeople.filter((p) => p.moduleStatuses.recruitment === "r-posted").length,
      pending_packets: localPeople.filter((p) =>
        ["o-sent", "o-packet-sent", "o-packet-inc", "o-file-build"].includes(p.moduleStatuses.offers)
      ).length,
      pending_signoffs: localPeople.filter((p) =>
        ["or-in-progress", "or-review"].includes(p.moduleStatuses.orientation)
      ).length,
      incomplete_training: localPeople.filter((p) =>
        ["ob-not-started", "ob-in-progress", "ob-cert-pending", "ob-comp-pending"].includes(
          p.moduleStatuses.onboarding
        )
      ).length,
      pending_reviews: localPeople.filter((p) =>
        ["c-not-ready", "c-pending-file", "c-pending-bg", "c-hr-review", "c-super-review"].includes(
          p.moduleStatuses.clearance
        )
      ).length,
      incomplete_files: localPeople.filter((p) =>
        ["pf-incomplete", "pf-missing"].includes(p.moduleStatuses["personnel-files"])
      ).length,
      expiring_soon: localPeople.filter((p) => p.moduleStatuses.credentials === "cr-expiring").length,
      open_actions: localPeople.filter((p) =>
        ["pa-open", "pa-notified", "pa-followup"].includes(p.moduleStatuses.performance)
      ).length,
    };
  }, [localPeople]);

  const getPendingActionsCount = useCallback(() => {
    return localPeople.filter((p) => {
      const statuses = Object.values(p.moduleStatuses);
      return statuses.some((s) =>
        [
          "r-posted", "r-review", "r-screening", "r-interview",
          "s-not-started", "s-interview-sched", "s-ref-pending",
          "o-sent", "o-packet-sent", "o-packet-inc", "o-file-build",
          "or-assigned", "or-in-progress", "or-review",
          "ob-in-progress", "ob-cert-pending", "ob-comp-pending",
          "c-pending-file", "c-pending-bg", "c-pending-refs",
          "c-pending-training", "c-pending-creds", "c-hr-review",
          "c-super-review", "c-restricted",
          "pf-incomplete", "pf-missing", "pf-pending",
          "cr-expiring", "cr-expired", "cr-renewal",
          "pa-open", "pa-notified", "pa-followup",
          "ca-deficiency", "ca-correction",
          "sep-initiated", "sep-offboarding", "sep-access", "sep-final",
        ].includes(s)
      );
    }).length;
  }, [localPeople]);

  return createElement(
    HRContext.Provider,
    {
      value: {
        lanes: HR_LANES,
        modules: ALL_HR_MODULES,
        people: localPeople.length > 0 ? localPeople : [],
        transitions: localTransitions,
        documents: localDocuments,
        commandCards: COMMAND_CARDS,
        alertRules: ALERT_RULES,
        isLoading,
        createPerson,
        updatePerson,
        updatePersonStatus,
        getPeopleInModule,
        getPeopleByStatus,
        getActiveAlerts,
        getCardMetrics,
        getPendingActionsCount,
        getTransitionsForPerson,
        addDocument,
        verifyDocument,
        rejectDocument,
        getDocumentsForPerson: _getDocumentsForPerson,
        getDocumentsForPersonAndModule: _getDocumentsForPersonAndModule,
        getDocumentCompleteness: _getDocumentCompleteness,
        getMissingDocumentsGlobally: _getMissingDocumentsGlobally,
      },
    },
    children,
  );
}

export function useHR() {
  const ctx = useContext(HRContext);
  if (!ctx) throw new Error("useHR must be used within HRProvider");
  return ctx;
}
