import type {
  M51BTeamsAdapterMetrics,
  M51BTeamsDestination,
  M51BTeamsMinimizedPayload,
} from "../../../../contracts/m51b/teams";
import { deepFreeze, isoAt, parseTeamsTimestamp, teamsDigest } from "./support";

export class M51BTeamsSyntheticError extends Error {
  readonly statusCode: number | null;
  readonly code: string;
  readonly retryAfterMs: number | null;

  constructor(
    statusCode: number | null,
    code: string,
    retryAfterMs: number | null = null,
  ) {
    super(code);
    this.name = "M51BTeamsSyntheticError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface M51BTeamsFailureDecision {
  disposition: "retry" | "fail";
  statusCode: number | null;
  code: string;
  delayMs: number;
  retryAfterHonored: boolean;
}

export function classifyM51BTeamsFailure(
  error: unknown,
  attempt: number,
): M51BTeamsFailureDecision {
  const synthetic =
    error instanceof M51BTeamsSyntheticError
      ? error
      : new M51BTeamsSyntheticError(
          null,
          error instanceof Error ? error.message : "M51B_TEAMS_UNKNOWN_FAILURE",
        );
  if (synthetic.statusCode === 429) {
    const retryAfter = synthetic.retryAfterMs ?? 1_000;
    return deepFreeze({
      disposition: "retry",
      statusCode: 429,
      code: synthetic.code,
      delayMs: Math.min(Math.max(retryAfter, 0), 10_000),
      retryAfterHonored: synthetic.retryAfterMs !== null,
    });
  }
  if (
    synthetic.statusCode === 503 ||
    synthetic.statusCode === 504 ||
    synthetic.statusCode === null
  ) {
    return deepFreeze({
      disposition: "retry",
      statusCode: synthetic.statusCode,
      code: synthetic.code,
      delayMs: Math.min(500 * 2 ** Math.max(attempt - 1, 0), 4_000),
      retryAfterHonored: false,
    });
  }
  return deepFreeze({
    disposition: "fail",
    statusCode: synthetic.statusCode,
    code: synthetic.code,
    delayMs: 0,
    retryAfterHonored: false,
  });
}

export interface M51BTeamsSyntheticSendInput {
  idempotencyKey: string;
  requestFingerprint: string;
  eventId: string;
  destination: M51BTeamsDestination;
  payload: M51BTeamsMinimizedPayload;
  attempt: number;
  attemptedAt: string;
}

export interface M51BTeamsSyntheticSendReceipt {
  messageId: string;
  deliveredAt: string;
  contentHash: string;
  synthetic: true;
}

export class SyntheticM51BTeamsAdapter {
  readonly adapterKind = "deterministic_synthetic_teams" as const;
  readonly liveGraphAvailable = false as const;
  readonly liveTeamsWriteAvailable = false as const;
  readonly credentialAccessAvailable = false as const;

  private readonly faultPlans = new Map<
    string,
    readonly (M51BTeamsSyntheticError | null)[]
  >();
  private syntheticSendAttempts = 0;
  private syntheticDeliveries = 0;
  private blockedLiveOperations = 0;

  constructor(private readonly deliveryLatencyMs = 1_250) {
    if (
      !Number.isInteger(deliveryLatencyMs) ||
      deliveryLatencyMs < 0 ||
      deliveryLatencyMs > 60_000
    ) {
      throw new Error("M51B_TEAMS_SYNTHETIC_LATENCY_INVALID");
    }
  }

  scheduleFaults(
    idempotencyKey: string,
    faults: readonly (M51BTeamsSyntheticError | null)[],
  ): void {
    this.faultPlans.set(idempotencyKey, deepFreeze([...faults]));
  }

  clearFaults(idempotencyKey?: string): void {
    if (idempotencyKey) this.faultPlans.delete(idempotencyKey);
    else this.faultPlans.clear();
  }

  sendSynthetic(input: M51BTeamsSyntheticSendInput): M51BTeamsSyntheticSendReceipt {
    const attemptedAt = parseTeamsTimestamp(input.attemptedAt);
    if (attemptedAt === null) {
      throw new M51BTeamsSyntheticError(
        400,
        "M51B_TEAMS_SYNTHETIC_ATTEMPT_TIME_INVALID",
      );
    }
    this.syntheticSendAttempts += 1;
    const fault = this.faultPlans.get(input.idempotencyKey)?.[input.attempt - 1];
    if (fault) throw fault;
    const contentHash = teamsDigest(input.payload);
    const receipt = deepFreeze({
      messageId: `SYNTH-M51B-TEAMS-MESSAGE-${teamsDigest(
        input.idempotencyKey,
        input.requestFingerprint,
        input.destination.channelId,
        contentHash,
      )
        .slice(-20)
        .toUpperCase()}`,
      deliveredAt: isoAt(attemptedAt + this.deliveryLatencyMs),
      contentHash,
      synthetic: true as const,
    });
    this.syntheticDeliveries += 1;
    return receipt;
  }

  sendLiveTeamsNotification(): never {
    this.blockedLiveOperations += 1;
    throw new M51BTeamsSyntheticError(
      403,
      "M51B_TEAMS_LIVE_NOTIFICATION_PROHIBITED",
    );
  }

  metrics(): M51BTeamsAdapterMetrics {
    return deepFreeze({
      syntheticSendAttempts: this.syntheticSendAttempts,
      syntheticDeliveries: this.syntheticDeliveries,
      blockedLiveOperations: this.blockedLiveOperations,
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
      credentialReads: 0,
    });
  }
}

