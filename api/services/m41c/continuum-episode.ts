import type {
  M41cContinuumEpisodeInput,
  M41cContinuumEpisodeResult,
  M41cContinuumStage,
} from "@contracts/m41c/pathways";
import {
  assertM41cSyntheticIdentifier,
  buildM41cHumanGate,
} from "./pathway-orchestrator";

function unique<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)]);
}

export function buildM41cContinuumEpisode(
  input: M41cContinuumEpisodeInput,
): M41cContinuumEpisodeResult {
  assertM41cSyntheticIdentifier(input.episodeId);
  assertM41cSyntheticIdentifier(input.subjectId);
  if (!Number.isFinite(Date.parse(input.openedAt))) {
    throw new Error("M41C_CONTINUUM_OPEN_TIME_INVALID");
  }
  if (input.events.length === 0) {
    throw new Error("M41C_CONTINUUM_EVENT_REQUIRED");
  }
  if (
    new Set(input.events.map((event) => event.id)).size !== input.events.length
  )
    throw new Error("M41C_CONTINUUM_EVENT_ID_DUPLICATE");
  for (const event of input.events) {
    assertM41cSyntheticIdentifier(event.id);
    if (event.serviceId) assertM41cSyntheticIdentifier(event.serviceId);
    if (event.aftercareLinkId) {
      assertM41cSyntheticIdentifier(event.aftercareLinkId);
    }
    event.sourceRecordIds.forEach((id) => assertM41cSyntheticIdentifier(id));
    if (!Number.isFinite(Date.parse(event.occurredAt))) {
      throw new Error("M41C_CONTINUUM_EVENT_TIME_INVALID");
    }
    if (Date.parse(event.occurredAt) < Date.parse(input.openedAt)) {
      throw new Error("M41C_CONTINUUM_EVENT_BEFORE_OPEN");
    }
  }
  const events = [...input.events].sort(
    (left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );
  if (
    input.humanDecision &&
    Date.parse(input.humanDecision.decidedAt) <
      Date.parse(events[events.length - 1].occurredAt)
  ) {
    throw new Error("M41C_CONTINUUM_DECISION_BEFORE_TRANSITION");
  }
  const warnings: string[] = [];
  if (!events.some((event) => event.stage === "intake")) {
    warnings.push("No intake event is linked to the episode.");
  }
  for (let index = 1; index < events.length; index += 1) {
    if (
      events[index].stage !== events[index - 1].stage &&
      !events[index].transitionReason
    ) {
      warnings.push(
        `Transition into ${events[index].stage} lacks a documented reason.`,
      );
    }
  }
  const hasAftercare = events.some(
    (event) => event.stage === "aftercare" || event.aftercareLinkId,
  );
  const hasAcuteStage = events.some((event) =>
    (
      [
        "crisis",
        "emergency",
        "inpatient",
        "gro",
      ] as readonly M41cContinuumStage[]
    ).includes(event.stage),
  );
  if (hasAcuteStage && !hasAftercare) {
    warnings.push(
      "Acute or residential service has no linked aftercare record.",
    );
  }
  if (events.length > 1 && !input.humanDecision) {
    warnings.push(
      "Continuum transitions await a named qualified human decision.",
    );
  }
  const transitionGate = buildM41cHumanGate({
    gateId: `${input.episodeId}-TRANSITION-HUMAN-GATE`,
    accountableRoles: [
      "clinical-director",
      "clinical-supervisor",
      "treatment-director",
      "program-director",
    ],
    competencyIds: ["M41C-COMP-CONTINUUM-TRANSITION"],
    decision: input.humanDecision,
  });

  return Object.freeze({
    episodeId: input.episodeId,
    subjectId: input.subjectId,
    stagesRepresented: unique(events.map((event) => event.stage)),
    events: Object.freeze(events.map((event) => Object.freeze({ ...event }))),
    longitudinalReference: Object.freeze({
      episodeId: input.episodeId,
      subjectId: input.subjectId,
      assessmentIds: unique(
        events
          .filter((event) => event.stage === "intake")
          .flatMap((event) => event.sourceRecordIds),
      ),
      formulationIds: Object.freeze([]),
      goalIds: Object.freeze([]),
      interventionIds: Object.freeze([]),
      serviceIds: unique(
        events.flatMap((event) => (event.serviceId ? [event.serviceId] : [])),
      ),
      outcomeIds: unique(
        events
          .filter((event) =>
            (
              [
                "outpatient",
                "mhtcm",
                "mhrs",
                "gro",
                "aftercare",
              ] as readonly M41cContinuumStage[]
            ).includes(event.stage),
          )
          .flatMap((event) => event.sourceRecordIds),
      ),
      transitionIds: unique(
        events
          .filter((event) => event.transitionReason !== null)
          .map((event) => event.id),
      ),
      aftercareIds: unique(
        events.flatMap((event) =>
          event.aftercareLinkId ? [event.aftercareLinkId] : [],
        ),
      ),
    }),
    transitionGate,
    continuityWarnings: Object.freeze(warnings),
    productionRows: 0,
    liveWrites: 0,
  });
}
