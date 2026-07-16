import { describe, expect, it } from "vitest";

import {
  M42_SEARCH_ACCEPTANCE_TARGET_MS,
  M42_SEARCH_PERFORMANCE_DOCUMENT_COUNT,
  M42_SEARCH_PERFORMANCE_QUERY_COUNT,
} from "../../contracts/m42/search";
import {
  M42_APPROVED_SEARCH_CORPUS_SHA256,
  createApprovedM42SearchPerformanceCorpus,
  createApprovedM42SearchPerformanceQueries,
  evaluateApprovedM42SearchPerformance,
  hashM42SearchCorpus,
} from "../services/m42/search-engine";

describe("M4.2 frozen search performance acceptance", () => {
  it("pins the approved deterministic corpus and query set", () => {
    const corpus = createApprovedM42SearchPerformanceCorpus();
    const queries = createApprovedM42SearchPerformanceQueries();

    expect(corpus).toHaveLength(M42_SEARCH_PERFORMANCE_DOCUMENT_COUNT);
    expect(queries).toHaveLength(M42_SEARCH_PERFORMANCE_QUERY_COUNT);
    expect(hashM42SearchCorpus(corpus)).toBe(M42_APPROVED_SEARCH_CORPUS_SHA256);
    expect(new Set(corpus.map(({ id }) => id)).size).toBe(corpus.length);
    expect(corpus.every(({ synthetic }) => synthetic)).toBe(true);
  });

  it("completes every permission-trimmed search under three seconds", () => {
    const result = evaluateApprovedM42SearchPerformance(3);

    expect(result).toMatchObject({
      frozen: true,
      documentCount: M42_SEARCH_PERFORMANCE_DOCUMENT_COUNT,
      queryCount: M42_SEARCH_PERFORMANCE_QUERY_COUNT,
      sampleCount: M42_SEARCH_PERFORMANCE_QUERY_COUNT * 3,
      corpusHashVerified: true,
      targetMsExclusive: M42_SEARCH_ACCEPTANCE_TARGET_MS,
      permissionTrimmedBeforeRanking: true,
      permissionTrimmedBeforeCitation: true,
      accepted: true,
      externalModelCalls: 0,
      externalWrites: 0,
    });
    expect(result.maxMs).toBeLessThan(M42_SEARCH_ACCEPTANCE_TARGET_MS);
    expect(result.p50Ms).toBeLessThanOrEqual(result.p95Ms);
    expect(result.p95Ms).toBeLessThanOrEqual(result.maxMs);
    expect(
      result.samples.every(
        ({ elapsedMs }) => elapsedMs < M42_SEARCH_ACCEPTANCE_TARGET_MS,
      ),
    ).toBe(true);
    expect(result.samples.every(({ resultCount }) => resultCount > 0)).toBe(
      true,
    );
  });
});
