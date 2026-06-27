// localStorage persistence layer for AMOS-OPS
// Provides offline resilience and faster load times

const STORAGE_KEY = "amos-ops-hr-state";
const STORAGE_VERSION = 2; // bump when schema changes

export interface PersistedState {
  version: number;
  timestamp: string;
  steps: Array<{
    id: string;
    completed: boolean;
  }>;
  modules: Array<{
    id: string;
    completedSteps: number;
    status: string;
  }>;
  tracks: Array<{
    id: string;
    completedModules: number;
    clearanceStatus: string;
  }>;
  evidence: Array<{
    id: string;
    status: string;
  }>;
  employees: Array<{
    id: string;
    clearanceStatus: string;
    completedModules: number;
  }>;
  quizResults: Array<{
    moduleId: string;
    score: number;
    totalQuestions: number;
    passed: boolean;
  }>;
}

export function saveState(state: Omit<PersistedState, "version" | "timestamp">): void {
  try {
    const payload: PersistedState = {
      ...state,
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[AMOS-OPS] Failed to save state to localStorage:", e);
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== STORAGE_VERSION) {
      console.warn(`[AMOS-OPS] State version mismatch (${parsed.version} vs ${STORAGE_VERSION}). Clearing.`);
      clearState();
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn("[AMOS-OPS] Failed to load state from localStorage:", e);
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[AMOS-OPS] Failed to clear localStorage:", e);
  }
}

export function hasSavedState(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}

// Helper to merge server state with local state (server wins on conflict)
export function mergeWithServerState<T extends { id: string }>(
  localItems: T[],
  serverItems: T[],
  mergeFields: (keyof T)[]
): T[] {
  const serverMap = new Map(serverItems.map((s) => [s.id, s]));
  const localMap = new Map(localItems.map((l) => [l.id, l]));

  const merged = new Map<string, T>();

  // Server items take priority
  for (const [id, serverItem] of serverMap) {
    const localItem = localMap.get(id);
    if (localItem) {
      // Merge: prefer server for specified fields unless local is newer
      const mergedItem = { ...serverItem } as T;
      for (const field of mergeFields) {
        // If local value is "more progressed", keep it
        const localVal = localItem[field];
        const serverVal = serverItem[field];
        if (
          typeof localVal === "boolean" &&
          typeof serverVal === "boolean" &&
          localVal === true
        ) {
          (mergedItem as Record<string, unknown>)[field as string] = true;
        }
        if (
          typeof localVal === "number" &&
          typeof serverVal === "number" &&
          localVal > serverVal
        ) {
          (mergedItem as Record<string, unknown>)[field as string] = localVal;
        }
      }
      merged.set(id, mergedItem);
    } else {
      merged.set(id, serverItem);
    }
  }

  // Add local-only items (submitted while offline)
  for (const [id, localItem] of localMap) {
    if (!serverMap.has(id)) {
      merged.set(id, localItem);
    }
  }

  return Array.from(merged.values());
}
