import { createHash } from "node:crypto";
import {
  type M51aConnectorCheckpoint,
  type M51aConnectorFailureClassification,
  type M51aConnectorOperationAttempt,
  type M51aIdempotentOperationRequest,
  type M51aIdempotentOperationResult,
  type M51aReconciliationReport,
} from "@contracts/m51a/connector-reconciliation";
import type { M51aConnectorRegistryEntry } from "@contracts/m51a/microsoft-connectors";
import {
  M51A_EVALUATION_AS_OF,
  requireM51ASyntheticId,
} from "@contracts/m51a/shared";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import { M51aConnectorRegistry } from "./connector-registry";
import {
  cloneM51aSnapshots,
  M51aReconciliationEngine,
} from "./reconciliation-engine";
import {
  M51aSyntheticMicrosoftError,
  SyntheticM51aMicrosoftAdapter,
} from "./synthetic-microsoft-adapter";
import { m51aMicrosoftItemAddressKey } from "./stable-object-resolver";

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 500;

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function deterministicId(prefix: string, ...parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
  return `${prefix}-${digest}`;
}

function virtualTime(base: string, offsetMs: number): string {
  return new Date(Date.parse(base) + offsetMs).toISOString();
}

interface NormalizedFailure {
  status: number | null;
  code: string;
  retryAfterMs: number | null;
}

function normalizeFailure(error: unknown): NormalizedFailure {
  if (error instanceof M51aSyntheticMicrosoftError) {
    return {
      status: error.status,
      code: error.code,
      retryAfterMs: error.retryAfterMs,
    };
  }
  if (error instanceof Error) {
    return {
      status: null,
      code: error.message || "M51A_UNKNOWN_CONNECTOR_FAILURE",
      retryAfterMs: null,
    };
  }
  return {
    status: null,
    code: "M51A_UNKNOWN_CONNECTOR_FAILURE",
    retryAfterMs: null,
  };
}

export function classifyM51aConnectorFailure(
  error: unknown,
  attempt: number,
): M51aConnectorFailureClassification {
  const failure = normalizeFailure(error);
  const fallbackDelay = BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1);
  if (failure.status === 429) {
    return frozen({
      disposition: "retry",
      code: failure.code,
      delayMs: failure.retryAfterMs ?? fallbackDelay,
      status: failure.status,
      retryAfterHonored: failure.retryAfterMs !== null,
    });
  }
  if (
    failure.status === 503 ||
    failure.status === 504 ||
    (failure.status === null && /timeout|timedout|econnreset|network/i.test(failure.code))
  ) {
    return frozen({
      disposition: "retry",
      code: failure.code,
      delayMs: fallbackDelay,
      status: failure.status,
      retryAfterHonored: false,
    });
  }
  if (failure.status === 409 || failure.status === 412) {
    return frozen({
      disposition: "conflict",
      code: failure.code,
      delayMs: null,
      status: failure.status,
      retryAfterHonored: false,
    });
  }
  if (failure.status === 410) {
    return frozen({
      disposition: "resync_required",
      code: failure.code,
      delayMs: null,
      status: failure.status,
      retryAfterHonored: false,
    });
  }
  return frozen({
    disposition: "fail",
    code: failure.code,
    delayMs: null,
    status: failure.status,
    retryAfterHonored: false,
  });
}

export interface M51aFullResyncOutcome {
  report: M51aReconciliationReport;
  checkpoint: M51aConnectorCheckpoint;
  mirror: readonly M51aMicrosoftItemSnapshot[];
  resyncPerformed: true;
}

export interface M51aDeltaSyncOutcome {
  report: M51aReconciliationReport;
  checkpoint: M51aConnectorCheckpoint;
  mirror: readonly M51aMicrosoftItemSnapshot[];
  pagesProcessed: number;
  resyncPerformed: false;
}

export class M51aConnectorSyncOrchestrator {
  readonly synthetic = true as const;
  readonly maximumAttempts = MAX_ATTEMPTS;
  readonly actualSleepCalls = 0 as const;
  readonly liveGraphCalls = 0 as const;
  readonly liveWrites = 0 as const;

  private readonly registry: M51aConnectorRegistry;
  private readonly adapter: SyntheticM51aMicrosoftAdapter;
  private readonly reconciliation: M51aReconciliationEngine;
  private readonly operationLedger = new Map<
    string,
    M51aIdempotentOperationResult<unknown>
  >();
  private readonly checkpoints = new Map<string, M51aConnectorCheckpoint>();
  private readonly mirrors = new Map<
    string,
    readonly M51aMicrosoftItemSnapshot[]
  >();

  constructor(input: {
    repositories: readonly M51aConnectorRegistryEntry[];
    adapter: SyntheticM51aMicrosoftAdapter;
    reconciliation?: M51aReconciliationEngine;
  }) {
    this.registry = new M51aConnectorRegistry(input.repositories);
    this.adapter = input.adapter;
    this.reconciliation = input.reconciliation ?? new M51aReconciliationEngine();
  }

  async executeIdempotent<T>(
    request: M51aIdempotentOperationRequest,
    execute: (attempt: number) => Promise<T> | T,
  ): Promise<M51aIdempotentOperationResult<T>> {
    requireM51ASyntheticId(request.idempotencyKey, "idempotency_key");
    requireM51ASyntheticId(request.connectorId, "connector_id");
    if (!request.requestFingerprint.trim()) {
      throw new Error("M51A_REQUEST_FINGERPRINT_REQUIRED");
    }
    if (!Number.isFinite(Date.parse(request.requestedAt))) {
      throw new Error("M51A_OPERATION_REQUEST_TIME_INVALID");
    }

    const existing = this.operationLedger.get(request.idempotencyKey);
    if (existing) {
      if (
        existing.requestFingerprint !== request.requestFingerprint ||
        existing.connectorId !== request.connectorId ||
        existing.operation !== request.operation
      ) {
        throw new Error("M51A_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
      }
      return frozen({
        ...(existing as M51aIdempotentOperationResult<T>),
        replayed: true,
      });
    }

    const operationId = deterministicId(
      "SYNTH-M51A-OPERATION",
      request.idempotencyKey,
      request.requestFingerprint,
      request.connectorId,
      request.operation,
    );
    const attempts: M51aConnectorOperationAttempt[] = [];
    let virtualOffsetMs = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = virtualTime(request.requestedAt, virtualOffsetMs);
      try {
        const value = await execute(attempt);
        const completedAt = virtualTime(request.requestedAt, virtualOffsetMs + 100);
        attempts.push(
          frozen({
            attempt,
            startedAt,
            completedAt,
            outcome: "succeeded",
            errorCode: null,
            status: null,
            scheduledDelayMs: null,
          }),
        );
        const result: M51aIdempotentOperationResult<T> = frozen({
          operationId,
          idempotencyKey: request.idempotencyKey,
          requestFingerprint: request.requestFingerprint,
          connectorId: request.connectorId,
          operation: request.operation,
          status: "succeeded",
          attempts: frozen(attempts),
          value,
          errorCode: null,
          replayed: false,
          liveGraphCalls: 0,
          liveWrites: 0,
          completedAt,
          synthetic: true,
        });
        this.operationLedger.set(request.idempotencyKey, result);
        return result;
      } catch (error) {
        const classification = classifyM51aConnectorFailure(error, attempt);
        const completedAt = virtualTime(request.requestedAt, virtualOffsetMs + 100);
        if (
          classification.disposition === "retry" &&
          attempt < MAX_ATTEMPTS
        ) {
          attempts.push(
            frozen({
              attempt,
              startedAt,
              completedAt,
              outcome: "retry_scheduled",
              errorCode: classification.code,
              status: classification.status,
              scheduledDelayMs: classification.delayMs,
            }),
          );
          virtualOffsetMs += 100 + (classification.delayMs ?? 0);
          continue;
        }

        const terminalStatus =
          classification.disposition === "conflict"
            ? "conflict"
            : classification.disposition === "resync_required"
              ? "resync_required"
              : "failed";
        const outcome =
          terminalStatus === "conflict"
            ? "conflict"
            : terminalStatus === "resync_required"
              ? "resync_required"
              : "failed";
        attempts.push(
          frozen({
            attempt,
            startedAt,
            completedAt,
            outcome,
            errorCode: classification.code,
            status: classification.status,
            scheduledDelayMs: null,
          }),
        );
        const errorCode =
          classification.disposition === "retry"
            ? `M51A_RETRY_EXHAUSTED:${classification.code}`
            : classification.code;
        const result: M51aIdempotentOperationResult<T> = frozen({
          operationId,
          idempotencyKey: request.idempotencyKey,
          requestFingerprint: request.requestFingerprint,
          connectorId: request.connectorId,
          operation: request.operation,
          status: terminalStatus,
          attempts: frozen(attempts),
          value: null,
          errorCode,
          replayed: false,
          liveGraphCalls: 0,
          liveWrites: 0,
          completedAt,
          synthetic: true,
        });
        this.operationLedger.set(request.idempotencyKey, result);
        return result;
      }
    }
    throw new Error("M51A_UNREACHABLE_RETRY_STATE");
  }

  async runControlledFullResync(input: {
    connectorId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    requestedAt?: string;
  }): Promise<M51aIdempotentOperationResult<M51aFullResyncOutcome>> {
    const connector = this.registry.get(input.connectorId);
    if (!connector.allowedOperations.includes("reconcile")) {
      throw new Error("M51A_CONNECTOR_RECONCILIATION_MODE_DENY");
    }
    const requestedAt = input.requestedAt ?? M51A_EVALUATION_AS_OF;
    const result = await this.executeIdempotent<M51aFullResyncOutcome>(
      {
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        connectorId: input.connectorId,
        operation: "reconcile",
        requestedAt,
      },
      () => {
        const source = this.adapter.listItems(input.connectorId);
        const mirror = cloneM51aSnapshots(source);
        const report = this.reconciliation.reconcile({
          connectorId: input.connectorId,
          source,
          target: mirror,
          evaluatedAt: requestedAt,
        });
        if (!report.passed) {
          throw new M51aSyntheticMicrosoftError(
            409,
            "M51A_FULL_RESYNC_RECONCILIATION_CONFLICT",
          );
        }
        const checkpoint: M51aConnectorCheckpoint = frozen({
          connectorId: input.connectorId,
          checkpoint: deterministicId(
            "SYNTH-FULL-RESYNC-CHECKPOINT",
            input.connectorId,
            report.reportId,
          ),
          checkpointKind: "full_resync",
          reconciledAt: requestedAt,
          reconciliationReportId: report.reportId,
          itemCount: mirror.length,
          liveCheckpointWrite: false,
          synthetic: true,
        });
        return frozen({
          report,
          checkpoint,
          mirror,
          resyncPerformed: true,
        });
      },
    );
    if (result.status === "succeeded" && result.value && !result.replayed) {
      this.mirrors.set(input.connectorId, result.value.mirror);
      this.checkpoints.set(input.connectorId, result.value.checkpoint);
    }
    return result;
  }

  async runDeltaSync(input: {
    connectorId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    requestedAt?: string;
    startCursor?: string | null;
  }): Promise<M51aIdempotentOperationResult<M51aDeltaSyncOutcome>> {
    const connector = this.registry.get(input.connectorId);
    if (!connector.allowedOperations.includes("reconcile")) {
      throw new Error("M51A_CONNECTOR_RECONCILIATION_MODE_DENY");
    }
    const requestedAt = input.requestedAt ?? M51A_EVALUATION_AS_OF;
    const result = await this.executeIdempotent<M51aDeltaSyncOutcome>(
      {
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        connectorId: input.connectorId,
        operation: "reconcile",
        requestedAt,
      },
      () => {
        const currentMirror = this.mirrors.get(input.connectorId);
        if (!currentMirror) {
          throw new M51aSyntheticMicrosoftError(
            410,
            "M51A_FULL_RESYNC_REQUIRED",
          );
        }
        const staged = new Map(
          currentMirror.map((item) => [item.stableObjectId, item]),
        );
        let cursor =
          input.startCursor ??
          this.checkpoints.get(input.connectorId)?.checkpoint ??
          null;
        const visited = new Set<string>();
        let deltaLink: string | null = null;
        let pagesProcessed = 0;

        while (true) {
          const cursorKey = cursor ?? "__INITIAL__";
          if (visited.has(cursorKey) || pagesProcessed >= 100) {
            throw new M51aSyntheticMicrosoftError(
              409,
              "M51A_DELTA_CURSOR_CYCLE_CONFLICT",
            );
          }
          visited.add(cursorKey);
          const page = this.adapter.fetchDeltaPage(input.connectorId, cursor);
          pagesProcessed += 1;
          for (const deletedAddress of page.deletedAddresses) {
            for (const [stableObjectId, item] of staged) {
              if (m51aMicrosoftItemAddressKey(item.address) === deletedAddress) {
                staged.delete(stableObjectId);
              }
            }
          }
          for (const change of page.changes) {
            if (change.connectorId !== input.connectorId) {
              throw new M51aSyntheticMicrosoftError(
                409,
                "M51A_DELTA_CHANGE_CONNECTOR_CONFLICT",
              );
            }
            if (change.deleted) staged.delete(change.stableObjectId);
            else staged.set(change.stableObjectId, change);
          }
          if (page.nextCursor !== null) {
            cursor = page.nextCursor;
            continue;
          }
          if (page.deltaLink === null) {
            throw new M51aSyntheticMicrosoftError(
              409,
              "M51A_DELTA_LINK_REQUIRED",
            );
          }
          deltaLink = page.deltaLink;
          break;
        }

        const source = this.adapter.listItems(input.connectorId);
        const mirror = cloneM51aSnapshots(
          [...staged.values()].sort((left, right) =>
            left.stableObjectId.localeCompare(right.stableObjectId),
          ),
        );
        const report = this.reconciliation.reconcile({
          connectorId: input.connectorId,
          source,
          target: mirror,
          evaluatedAt: requestedAt,
        });
        if (!report.passed) {
          throw new M51aSyntheticMicrosoftError(
            409,
            "M51A_DELTA_RECONCILIATION_CONFLICT",
          );
        }
        const checkpoint: M51aConnectorCheckpoint = frozen({
          connectorId: input.connectorId,
          checkpoint: deltaLink,
          checkpointKind: "delta_link",
          reconciledAt: requestedAt,
          reconciliationReportId: report.reportId,
          itemCount: mirror.length,
          liveCheckpointWrite: false,
          synthetic: true,
        });
        return frozen({
          report,
          checkpoint,
          mirror,
          pagesProcessed,
          resyncPerformed: false,
        });
      },
    );
    if (result.status === "succeeded" && result.value && !result.replayed) {
      this.mirrors.set(input.connectorId, result.value.mirror);
      this.checkpoints.set(input.connectorId, result.value.checkpoint);
    }
    return result;
  }

  getCheckpoint(connectorId: string): M51aConnectorCheckpoint | null {
    return this.checkpoints.get(connectorId) ?? null;
  }

  getMirror(connectorId: string): readonly M51aMicrosoftItemSnapshot[] {
    return this.mirrors.get(connectorId) ?? frozen([]);
  }

  listOperationLedger(): readonly M51aIdempotentOperationResult<unknown>[] {
    return frozen([...this.operationLedger.values()]);
  }
}
