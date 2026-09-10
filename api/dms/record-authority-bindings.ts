import type Database from "better-sqlite3";
import { ensureRecordAuthoritySchema } from "./record-authority-store";

export type DocumentAuthorityBindingResult =
  | {
      outcome: "BOUND";
      code: "DOCUMENT_AUTHORITY_BOUND";
      documentId: string;
      recordKey: string;
    }
  | {
      outcome: "UNREGISTERED";
      code: "DOCUMENT_AUTHORITY_UNREGISTERED";
      documentId: string;
      recordKey: null;
    }
  | {
      outcome: "CONFLICT";
      code: "DOCUMENT_AUTHORITY_BINDING_CONFLICT";
      documentId: string;
      recordKey: null;
      recordKeys: string[];
    };

/**
 * Resolve an existing AMOS-DMS document identity to exactly one governed
 * record lineage. Multiple lineage keys for the same document fail closed.
 */
export function resolveDocumentAuthorityBinding(
  db: Database.Database,
  documentId: string,
): DocumentAuthorityBindingResult {
  ensureRecordAuthoritySchema(db);
  const rows = db
    .prepare(
      `SELECT DISTINCT record_key
       FROM dms_record_authority_registry
       WHERE document_id = ?
       ORDER BY record_key ASC`,
    )
    .all(documentId) as Array<{ record_key: string }>;

  const recordKeys = rows.map((row) => row.record_key);
  if (recordKeys.length === 0) {
    return {
      outcome: "UNREGISTERED",
      code: "DOCUMENT_AUTHORITY_UNREGISTERED",
      documentId,
      recordKey: null,
    };
  }

  if (recordKeys.length > 1) {
    return {
      outcome: "CONFLICT",
      code: "DOCUMENT_AUTHORITY_BINDING_CONFLICT",
      documentId,
      recordKey: null,
      recordKeys,
    };
  }

  return {
    outcome: "BOUND",
    code: "DOCUMENT_AUTHORITY_BOUND",
    documentId,
    recordKey: recordKeys[0],
  };
}
