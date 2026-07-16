import type { M52DeterministicClock } from "./clock";
import { m52FreezePayload } from "./fingerprint";
import { isM52ApprovedOfflineWorkflow } from "./types";
import type {
  M52DestinationInspection,
  M52DestinationMetrics,
  M52DestinationReceipt,
  M52SyncLineage,
  M52SyncRecord,
  M52SyncStep,
} from "./types";

export class M52NetworkUnavailableError extends Error {
  readonly step: M52SyncStep;

  constructor(step: M52SyncStep) {
    super(`M52_SYNTHETIC_NETWORK_UNAVAILABLE:${step}`);
    this.name = "M52NetworkUnavailableError";
    this.step = step;
  }
}

export class M52DestinationIdempotencyCollisionError extends Error {
  readonly idempotencyKey: string;
  readonly attemptedPayloadFingerprint: string;
  readonly retainedPayloadFingerprint: string;
  readonly retainedRecord: M52SyncRecord;

  constructor(input: {
    idempotencyKey: string;
    attemptedPayloadFingerprint: string;
    retainedPayloadFingerprint: string;
    retainedRecord: M52SyncRecord;
  }) {
    super("M52_DESTINATION_IDEMPOTENCY_PAYLOAD_COLLISION");
    this.name = "M52DestinationIdempotencyCollisionError";
    this.idempotencyKey = input.idempotencyKey;
    this.attemptedPayloadFingerprint = input.attemptedPayloadFingerprint;
    this.retainedPayloadFingerprint = input.retainedPayloadFingerprint;
    this.retainedRecord = freezeRecord(input.retainedRecord);
  }
}

interface MutableReceipt {
  idempotencyKey: string;
  payloadFingerprint: string;
  committedRecord: M52SyncRecord;
  lineage: Readonly<M52SyncLineage>;
  committedAt: string;
}

function freezeRecord(record: M52SyncRecord): M52SyncRecord {
  if (!isM52ApprovedOfflineWorkflow(record.workflow)) {
    throw new Error("M52_OFFLINE_WORKFLOW_NOT_APPROVED");
  }
  return Object.freeze({
    ...record,
    payload: m52FreezePayload(record.payload),
    synthetic: true,
  });
}

function freezeLineage(lineage: Readonly<M52SyncLineage>): Readonly<M52SyncLineage> {
  return Object.freeze({ ...lineage });
}

function freezeReceipt(
  receipt: MutableReceipt,
  duplicateSuppressed: boolean,
): M52DestinationReceipt {
  return Object.freeze({
    ...receipt,
    committedRecord: freezeRecord(receipt.committedRecord),
    lineage: freezeLineage(receipt.lineage),
    duplicateSuppressed,
    synthetic: true,
  });
}

/**
 * Deterministic, in-memory destination used only by the M5.2 synthetic
 * prototype. It deliberately models acknowledgement loss after a mutation so
 * reconnect logic can prove exact-once behavior without any live connector.
 */
export class M52SyntheticSyncDestination {
  private readonly records = new Map<string, M52SyncRecord>();
  private readonly receipts = new Map<string, MutableReceipt>();
  private readonly faults = new Map<string, number>();
  private connected = true;
  private syntheticMutationCount = 0;
  private duplicateSuppressionCount = 0;

  constructor(
    private readonly clock: M52DeterministicClock,
    initialRecords: readonly M52SyncRecord[] = [],
  ) {
    for (const record of initialRecords) {
      this.records.set(record.recordId, freezeRecord(record));
    }
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  isConnected(): boolean {
    return this.connected;
  }

  planNetworkLoss(
    operationId: string,
    step: M52SyncStep,
    occurrences = 1,
  ): void {
    if (!Number.isInteger(occurrences) || occurrences < 1) {
      throw new Error("M52_NETWORK_LOSS_OCCURRENCES_MUST_BE_POSITIVE");
    }
    this.faults.set(`${operationId}:${step}`, occurrences);
  }

  clearNetworkLoss(operationId?: string): void {
    if (!operationId) {
      this.faults.clear();
      return;
    }
    for (const key of this.faults.keys()) {
      if (key.startsWith(`${operationId}:`)) {
        this.faults.delete(key);
      }
    }
  }

  checkpoint(operationId: string, step: M52SyncStep): void {
    if (!this.connected) {
      throw new M52NetworkUnavailableError(step);
    }
    const key = `${operationId}:${step}`;
    const remaining = this.faults.get(key) ?? 0;
    if (remaining > 0) {
      if (remaining === 1) {
        this.faults.delete(key);
      } else {
        this.faults.set(key, remaining - 1);
      }
      throw new M52NetworkUnavailableError(step);
    }
  }

  inspect(input: {
    operationId: string;
    recordId: string;
    idempotencyKey: string;
    payloadFingerprint: string;
  }): M52DestinationInspection {
    this.checkpoint(input.operationId, "read_destination");
    const retained = this.receipts.get(input.idempotencyKey);
    if (retained && retained.payloadFingerprint !== input.payloadFingerprint) {
      throw new M52DestinationIdempotencyCollisionError({
        idempotencyKey: input.idempotencyKey,
        attemptedPayloadFingerprint: input.payloadFingerprint,
        retainedPayloadFingerprint: retained.payloadFingerprint,
        retainedRecord: retained.committedRecord,
      });
    }
    if (retained) {
      this.duplicateSuppressionCount += 1;
    }
    return Object.freeze({
      destinationRecord: this.records.get(input.recordId) ?? null,
      existingReceipt: retained ? freezeReceipt(retained, true) : null,
      synthetic: true,
    });
  }

  apply(input: {
    operationId: string;
    idempotencyKey: string;
    payloadFingerprint: string;
    expectedDestinationVersion: number;
    record: M52SyncRecord;
    lineage: Readonly<M52SyncLineage>;
  }): M52DestinationReceipt {
    this.checkpoint(input.operationId, "write_before");
    const retained = this.receipts.get(input.idempotencyKey);
    if (retained) {
      if (retained.payloadFingerprint !== input.payloadFingerprint) {
        throw new M52DestinationIdempotencyCollisionError({
          idempotencyKey: input.idempotencyKey,
          attemptedPayloadFingerprint: input.payloadFingerprint,
          retainedPayloadFingerprint: retained.payloadFingerprint,
          retainedRecord: retained.committedRecord,
        });
      }
      this.duplicateSuppressionCount += 1;
      this.checkpoint(input.operationId, "write_after");
      return freezeReceipt(retained, true);
    }

    const current = this.records.get(input.record.recordId);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== input.expectedDestinationVersion) {
      throw new Error("M52_DESTINATION_VERSION_CHANGED_DURING_WRITE");
    }

    const committedRecord = freezeRecord({
      ...input.record,
      version: currentVersion + 1,
      updatedAt: this.clock.now(),
      synthetic: true,
    });
    const receipt: MutableReceipt = {
      idempotencyKey: input.idempotencyKey,
      payloadFingerprint: input.payloadFingerprint,
      committedRecord,
      lineage: freezeLineage(input.lineage),
      committedAt: this.clock.now(),
    };
    this.records.set(committedRecord.recordId, committedRecord);
    this.receipts.set(input.idempotencyKey, receipt);
    this.syntheticMutationCount += 1;

    // The write is durable before this checkpoint. A failure here simulates a
    // lost acknowledgement and must be duplicate-suppressed on reconnect.
    this.checkpoint(input.operationId, "write_after");
    return freezeReceipt(receipt, false);
  }

  confirm(operationId: string): void {
    this.checkpoint(operationId, "confirm_commit");
  }

  reconcileCheckpoint(operationId: string): void {
    this.checkpoint(operationId, "reconcile");
  }

  getRecord(recordId: string): M52SyncRecord | null {
    const record = this.records.get(recordId);
    return record ? freezeRecord(record) : null;
  }

  listRecords(): readonly M52SyncRecord[] {
    return Object.freeze(
      [...this.records.values()]
        .sort((left, right) => left.recordId.localeCompare(right.recordId))
        .map(freezeRecord),
    );
  }

  metrics(): M52DestinationMetrics {
    return Object.freeze({
      connected: this.connected,
      syntheticMutationCount: this.syntheticMutationCount,
      duplicateSuppressionCount: this.duplicateSuppressionCount,
      retainedReceiptCount: this.receipts.size,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }
}
