import { createHash } from "node:crypto";
import {
  M51A_RECONCILIATION_DIMENSIONS,
  type M51aReconciliationDifference,
  type M51aReconciliationDimension,
  type M51aReconciliationReport,
} from "@contracts/m51a/connector-reconciliation";
import { M51A_EVALUATION_AS_OF } from "@contracts/m51a/shared";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digest(...parts: readonly string[]): string {
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex");
}

export function m51aSnapshotFingerprint(
  snapshots: readonly M51aMicrosoftItemSnapshot[],
): string {
  return `sha256:${digest(
    canonicalString(
      [...snapshots].sort((left, right) =>
        left.stableObjectId.localeCompare(right.stableObjectId),
      ),
    ),
  )}`;
}

export function cloneM51aSnapshots(
  snapshots: readonly M51aMicrosoftItemSnapshot[],
): readonly M51aMicrosoftItemSnapshot[] {
  return frozen([...snapshots]);
}

function difference(input: {
  connectorId: string;
  stableObjectId: string | null;
  dimension: M51aReconciliationDimension;
  sourceValue: unknown;
  targetValue: unknown;
  severity: "P0" | "P1" | "P2";
  explanation: string | null;
}): M51aReconciliationDifference {
  const sourceValue = canonicalString(input.sourceValue);
  const targetValue = canonicalString(input.targetValue);
  return frozen({
    differenceId: `SYNTH-M51A-DIFF-${digest(
      input.connectorId,
      input.stableObjectId ?? "COUNT",
      input.dimension,
      sourceValue,
      targetValue,
    )
      .slice(0, 20)
      .toUpperCase()}`,
    stableObjectId: input.stableObjectId,
    dimension: input.dimension,
    sourceValue,
    targetValue,
    explained: input.explanation !== null,
    explanation: input.explanation,
    severity: input.severity,
  });
}

export interface M51aReconciliationInput {
  connectorId: string;
  source: readonly M51aMicrosoftItemSnapshot[];
  target: readonly M51aMicrosoftItemSnapshot[];
  evaluatedAt?: string;
  explanations?: Readonly<
    Record<string, string>
  >;
}

export class M51aReconciliationEngine {
  readonly synthetic = true as const;
  readonly liveRepositoryWrite = false as const;

  reconcile(input: M51aReconciliationInput): M51aReconciliationReport {
    const evaluatedAt = input.evaluatedAt ?? M51A_EVALUATION_AS_OF;
    if (!Number.isFinite(Date.parse(evaluatedAt))) {
      throw new Error("M51A_RECONCILIATION_TIME_INVALID");
    }
    const sourceBefore = m51aSnapshotFingerprint(input.source);
    const differences: M51aReconciliationDifference[] = [];
    const explanations = input.explanations ?? {};
    const explanationFor = (
      stableObjectId: string | null,
      dimension: M51aReconciliationDimension,
    ): string | null =>
      explanations[`${stableObjectId ?? "COUNT"}:${dimension}`] ?? null;

    if (input.source.length !== input.target.length) {
      differences.push(
        difference({
          connectorId: input.connectorId,
          stableObjectId: null,
          dimension: "item_count",
          sourceValue: input.source.length,
          targetValue: input.target.length,
          severity: "P0",
          explanation: explanationFor(null, "item_count"),
        }),
      );
    }

    const sourceById = new Map(
      input.source.map((item) => [item.stableObjectId, item]),
    );
    const targetById = new Map(
      input.target.map((item) => [item.stableObjectId, item]),
    );
    const allStableIds = [...new Set([...sourceById.keys(), ...targetById.keys()])].sort();

    for (const stableObjectId of allStableIds) {
      const source = sourceById.get(stableObjectId);
      const target = targetById.get(stableObjectId);
      if (!source || !target) {
        differences.push(
          difference({
            connectorId: input.connectorId,
            stableObjectId,
            dimension: "stable_object_id",
            sourceValue: source ? "present" : "missing",
            targetValue: target ? "present" : "missing",
            severity: "P0",
            explanation: explanationFor(stableObjectId, "stable_object_id"),
          }),
        );
        continue;
      }

      const checks: readonly {
        dimension: M51aReconciliationDimension;
        sourceValue: unknown;
        targetValue: unknown;
        severity: "P0" | "P1" | "P2";
      }[] = [
        {
          dimension: "content_hash",
          sourceValue: source.contentHash,
          targetValue: target.contentHash,
          severity: "P0",
        },
        {
          dimension: "version_identity",
          sourceValue: {
            versionId: source.versionId,
            eTag: source.eTag,
            cTag: source.cTag,
          },
          targetValue: {
            versionId: target.versionId,
            eTag: target.eTag,
            cTag: target.cTag,
          },
          severity: "P1",
        },
        {
          dimension: "metadata",
          sourceValue: {
            metadataHash: source.metadataHash,
            name: source.name,
          },
          targetValue: {
            metadataHash: target.metadataHash,
            name: target.name,
          },
          severity: "P1",
        },
        {
          dimension: "permissions",
          sourceValue: source.permissions,
          targetValue: target.permissions,
          severity: "P0",
        },
        {
          dimension: "locator",
          sourceValue: {
            address: source.address,
            path: source.path,
            parentItemId: source.parentItemId,
          },
          targetValue: {
            address: target.address,
            path: target.path,
            parentItemId: target.parentItemId,
          },
          severity: "P1",
        },
        {
          dimension: "sensitivity_retention",
          sourceValue: {
            handlingClass: source.handlingClass,
            sensitivityLabelRef: source.sensitivityLabelRef,
            retention: source.retention,
          },
          targetValue: {
            handlingClass: target.handlingClass,
            sensitivityLabelRef: target.sensitivityLabelRef,
            retention: target.retention,
          },
          severity: "P0",
        },
      ];

      for (const check of checks) {
        if (canonicalString(check.sourceValue) === canonicalString(check.targetValue)) {
          continue;
        }
        differences.push(
          difference({
            connectorId: input.connectorId,
            stableObjectId,
            ...check,
            explanation: explanationFor(stableObjectId, check.dimension),
          }),
        );
      }
    }

    const sourceAfter = m51aSnapshotFingerprint(input.source);
    if (sourceBefore !== sourceAfter) {
      throw new Error("M51A_RECONCILIATION_SOURCE_MUTATED");
    }
    const unexplained = differences.filter((candidate) => !candidate.explained);
    return frozen({
      reportId: `SYNTH-M51A-RECON-${digest(
        input.connectorId,
        sourceBefore,
        m51aSnapshotFingerprint(input.target),
        evaluatedAt,
      )
        .slice(0, 20)
        .toUpperCase()}`,
      connectorId: input.connectorId,
      sourceCount: input.source.length,
      targetCount: input.target.length,
      dimensionsChecked: M51A_RECONCILIATION_DIMENSIONS,
      differences: frozen(differences),
      unexplainedDifferenceCount: unexplained.length,
      p0DifferenceCount: differences.filter(
        (candidate) => candidate.severity === "P0",
      ).length,
      p1DifferenceCount: differences.filter(
        (candidate) => candidate.severity === "P1",
      ).length,
      passed: unexplained.length === 0,
      evaluatedAt,
      sourceUnchanged: true,
      liveRepositoryWrite: false,
      synthetic: true,
    });
  }
}
