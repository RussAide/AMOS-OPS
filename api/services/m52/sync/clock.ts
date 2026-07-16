export class M52DeterministicClock {
  private currentEpochMs: number;

  constructor(initialTime = "2026-07-15T14:00:00.000Z") {
    const parsed = Date.parse(initialTime);
    if (!Number.isFinite(parsed)) {
      throw new Error("M52_INVALID_CLOCK_INITIAL_TIME");
    }
    this.currentEpochMs = parsed;
  }

  now(): string {
    return new Date(this.currentEpochMs).toISOString();
  }

  advance(milliseconds: number): string {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error("M52_CLOCK_ADVANCE_MUST_BE_NON_NEGATIVE");
    }
    this.currentEpochMs += milliseconds;
    return this.now();
  }

  atOffset(milliseconds: number): string {
    return new Date(this.currentEpochMs + milliseconds).toISOString();
  }
}
