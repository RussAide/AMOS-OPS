/**
 * Cypress Doctrine Sprint 01 — S1 governed record-authority contract.
 *
 * Record authority is deliberately separate from the existing AMOS-DMS
 * document lifecycle. A document can be published in the lifecycle while its
 * governed authority is REFERENCE_COPY, SUBMISSION_COPY, etc.
 */

export const RECORD_AUTHORITY_STATES = [
  "CURRENT_CONTROLLING",
  "REFERENCE_COPY",
  "SUBMISSION_COPY",
  "SUPERSEDED",
  "ARCHIVED",
  "PENDING",
] as const;

export type RecordAuthorityState = (typeof RECORD_AUTHORITY_STATES)[number];

export const GOVERNED_RECORD_CLASSES = [
  "MEDICAL_RECORD",
  "CLINICAL_RECORD",
  "PLACEMENT_RECORD",
  "LICENSING_RECORD",
  "GOVERNANCE_RECORD",
  "OPERATIONAL_RECORD",
  "FINANCIAL_RECORD",
  "PERSONNEL_RECORD",
  "OTHER_GOVERNED_RECORD",
] as const;

export type GovernedRecordClass = (typeof GOVERNED_RECORD_CLASSES)[number];
export type GovernedDataScope = "operational" | "training";

export interface RecordAuthorityCandidate {
  /** Immutable authority-row identity. */
  id: string;
  /** Existing AMOS-DMS document identity. */
  documentId: string;
  /** Stable lineage key used to resolve competing versions/copies of one governed record. */
  recordKey: string;
  recordClass: GovernedRecordClass;
  authorityState: RecordAuthorityState;
  sourceSystem: string;
  sourceLocator: string;
  backendObjectId: string | null;
  governingDocumentId: string | null;
  governingVersion: string | null;
  supersedesAuthorityId: string | null;
  youthId: string | null;
  caseId: string | null;
  operationId: string | null;
  division: string | null;
  dataScope: GovernedDataScope;
  rationale: string;
  establishedBy: string;
  establishedAt: string;
  effectiveAt: string;
}

export type RecordAuthorityResolution =
  | {
      outcome: "RESOLVED";
      code: "CONTROLLING_RECORD_RESOLVED";
      recordKey: string;
      record: RecordAuthorityCandidate;
      candidateIds: string[];
    }
  | {
      outcome: "CONFLICT";
      code: "AUTHORITY_CONFLICT";
      recordKey: string;
      record: null;
      candidateIds: string[];
    }
  | {
      outcome: "UNAVAILABLE";
      code: "NO_CONTROLLING_RECORD";
      recordKey: string;
      record: null;
      candidateIds: string[];
    };

/**
 * Doctrine rule: CURRENT_CONTROLLING is the only state eligible for default
 * retrieval. Reference/submission/pending/superseded/archived copies never
 * silently substitute for a controlling record.
 *
 * Authority rows are immutable. A later row may retire an earlier row by
 * naming it in `supersedesAuthorityId`; retired rows are historical evidence
 * and are excluded from the effective authority set. This is what allows a
 * controlling record to change without mutating or deleting the prior row.
 *
 * More than one effective CURRENT_CONTROLLING candidate fails closed.
 */
export function resolveControllingRecord(
  recordKey: string,
  candidates: readonly RecordAuthorityCandidate[],
): RecordAuthorityResolution {
  const scoped = candidates
    .filter((candidate) => candidate.recordKey === recordKey)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const scopedIds = new Set(scoped.map((candidate) => candidate.id));
  const retiredIds = new Set(
    scoped
      .map((candidate) => candidate.supersedesAuthorityId)
      .filter(
        (authorityId): authorityId is string =>
          Boolean(authorityId) && scopedIds.has(authorityId as string),
      ),
  );
  const effective = scoped.filter((candidate) => !retiredIds.has(candidate.id));
  const controlling = effective.filter(
    (candidate) => candidate.authorityState === "CURRENT_CONTROLLING",
  );
  const candidateIds = effective.map((candidate) => candidate.id);

  if (controlling.length === 1) {
    return {
      outcome: "RESOLVED",
      code: "CONTROLLING_RECORD_RESOLVED",
      recordKey,
      record: controlling[0],
      candidateIds,
    };
  }

  if (controlling.length > 1) {
    return {
      outcome: "CONFLICT",
      code: "AUTHORITY_CONFLICT",
      recordKey,
      record: null,
      candidateIds: controlling.map((candidate) => candidate.id).sort(),
    };
  }

  return {
    outcome: "UNAVAILABLE",
    code: "NO_CONTROLLING_RECORD",
    recordKey,
    record: null,
    candidateIds,
  };
}
