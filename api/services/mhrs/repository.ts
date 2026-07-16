import type {
  M23AssessedNeed,
  M23AuditEvent,
  M23BarrierRecord,
  M23ClaimHandoff,
  M23Goal,
  M23Intervention,
  M23OutcomeRecord,
  M23PlanStateEvent,
  M23PlanVersion,
  M23ProgramCase,
  M23ProgressRecord,
  M23RepositorySnapshot,
  M23ReviewAlert,
  M23ReviewAlertEvent,
  M23Session,
  M23SessionStateEvent,
} from "../../../contracts/mhrs/types";

export interface M23Collections {
  cases: M23ProgramCase[];
  needs: M23AssessedNeed[];
  planVersions: M23PlanVersion[];
  planStateEvents: M23PlanStateEvent[];
  goals: M23Goal[];
  interventions: M23Intervention[];
  sessions: M23Session[];
  sessionStateEvents: M23SessionStateEvent[];
  progress: M23ProgressRecord[];
  barriers: M23BarrierRecord[];
  outcomes: M23OutcomeRecord[];
  reviewAlerts: M23ReviewAlert[];
  reviewAlertEvents: M23ReviewAlertEvent[];
  claimHandoffs: M23ClaimHandoff[];
  auditEvents: M23AuditEvent[];
}

/** Adapter boundary for the integration stream's shared persistence binding. */
export interface M23RepositoryPort {
  nextId(prefix: string): string;
  append<K extends keyof M23Collections>(
    collection: K,
    value: M23Collections[K][number],
  ): M23Collections[K][number];
  all<K extends keyof M23Collections>(collection: K): readonly M23Collections[K][number][];
  snapshot(): M23RepositorySnapshot;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class M23MemoryRepository implements M23RepositoryPort {
  private readonly collections: M23Collections = {
    cases: [],
    needs: [],
    planVersions: [],
    planStateEvents: [],
    goals: [],
    interventions: [],
    sessions: [],
    sessionStateEvents: [],
    progress: [],
    barriers: [],
    outcomes: [],
    reviewAlerts: [],
    reviewAlertEvents: [],
    claimHandoffs: [],
    auditEvents: [],
  };

  private readonly counters = new Map<string, number>();

  nextId(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  append<K extends keyof M23Collections>(
    collection: K,
    value: M23Collections[K][number],
  ): M23Collections[K][number] {
    const immutable = deepFreeze(clone(value));
    (this.collections[collection] as Array<M23Collections[K][number]>).push(immutable);
    return immutable;
  }

  all<K extends keyof M23Collections>(collection: K): readonly M23Collections[K][number][] {
    return [...this.collections[collection]];
  }

  snapshot(): M23RepositorySnapshot {
    return deepFreeze(clone({
      cases: this.collections.cases,
      needs: this.collections.needs,
      planVersions: this.collections.planVersions,
      planStateEvents: this.collections.planStateEvents,
      goals: this.collections.goals,
      interventions: this.collections.interventions,
      sessions: this.collections.sessions,
      sessionStateEvents: this.collections.sessionStateEvents,
      progress: this.collections.progress,
      barriers: this.collections.barriers,
      outcomes: this.collections.outcomes,
      reviewAlerts: this.collections.reviewAlerts,
      reviewAlertEvents: this.collections.reviewAlertEvents,
      claimHandoffs: this.collections.claimHandoffs,
      auditEvents: this.collections.auditEvents,
    }));
  }
}
