import { describe, expect, it } from "vitest";
import {
  M41C_CONTINUUM_STAGES,
  type M41cNamedHumanDecision,
} from "@contracts/m41c/pathways";
import { buildM41cContinuumEpisode } from "../services/m41c/continuum-episode";

const decision: M41cNamedHumanDecision = {
  decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR-001",
  decidedByRole: "clinical-director",
  decidedAt: "2026-11-15T09:00:00.000Z",
  disposition: "approved",
  rationale: "Synthetic continuum transitions reviewed for demonstration.",
  overrideReason: null,
  qualificationIds: ["M41C-COMP-CONTINUUM-TRANSITION"],
};

describe("M4.1C longitudinal youth continuum episode", () => {
  it("links prevention through community supports in one synthetic episode", () => {
    const events = M41C_CONTINUUM_STAGES.map((stage, index) => ({
      id: `SYNTH-CONTINUUM-EVENT-${String(index + 1).padStart(2, "0")}`,
      stage,
      occurredAt: `2026-11-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
      serviceId: `SYNTH-SERVICE-${stage.toUpperCase().replaceAll("_", "-")}`,
      sourceRecordIds: [
        `SYNTH-RECORD-${stage.toUpperCase().replaceAll("_", "-")}`,
      ],
      transitionReason:
        index === 0 ? null : `Synthetic transition into ${stage}`,
      aftercareLinkId:
        stage === "aftercare" ? "SYNTH-AFTERCARE-LINK-001" : null,
    }));
    const result = buildM41cContinuumEpisode({
      episodeId: "SYNTH-EPISODE-CONTINUUM-001",
      subjectId: "SYNTH-YOUTH-001",
      openedAt: "2026-11-01T07:00:00.000Z",
      events,
      humanDecision: decision,
    });
    expect(result.stagesRepresented).toEqual(M41C_CONTINUUM_STAGES);
    expect(result.continuityWarnings).toEqual([]);
    expect(result.transitionGate).toMatchObject({
      status: "approved",
      decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR-001",
    });
    expect(result.longitudinalReference.serviceIds).toHaveLength(
      M41C_CONTINUUM_STAGES.length,
    );
    expect(result.longitudinalReference.aftercareIds).toEqual([
      "SYNTH-AFTERCARE-LINK-001",
    ]);
    expect(result.productionRows).toBe(0);
    expect(result.liveWrites).toBe(0);
  });

  it("surfaces intake, transition, aftercare, and human-review continuity gaps", () => {
    const result = buildM41cContinuumEpisode({
      episodeId: "SYNTH-EPISODE-GAPS-001",
      subjectId: "SYNTH-YOUTH-001",
      openedAt: "2026-11-01T07:00:00.000Z",
      events: [
        {
          id: "SYNTH-CONTINUUM-EVENT-CRISIS",
          stage: "crisis",
          occurredAt: "2026-11-01T08:00:00.000Z",
          serviceId: "SYNTH-SERVICE-CRISIS",
          sourceRecordIds: ["SYNTH-CRISIS-RECORD"],
          transitionReason: null,
          aftercareLinkId: null,
        },
        {
          id: "SYNTH-CONTINUUM-EVENT-STEP-DOWN",
          stage: "step_down",
          occurredAt: "2026-11-02T08:00:00.000Z",
          serviceId: "SYNTH-SERVICE-STEP-DOWN",
          sourceRecordIds: ["SYNTH-STEP-DOWN-RECORD"],
          transitionReason: null,
          aftercareLinkId: null,
        },
      ],
    });
    expect(result.continuityWarnings).toEqual(
      expect.arrayContaining([
        "No intake event is linked to the episode.",
        "Transition into step_down lacks a documented reason.",
        "Acute or residential service has no linked aftercare record.",
        "Continuum transitions await a named qualified human decision.",
      ]),
    );
    expect(result.transitionGate.status).toBe("pending");
  });

  it("rejects events that predate the episode", () => {
    expect(() =>
      buildM41cContinuumEpisode({
        episodeId: "SYNTH-EPISODE-TIME-001",
        subjectId: "SYNTH-YOUTH-001",
        openedAt: "2026-11-02T08:00:00.000Z",
        events: [
          {
            id: "SYNTH-CONTINUUM-EVENT-EARLY",
            stage: "intake",
            occurredAt: "2026-11-01T08:00:00.000Z",
            serviceId: null,
            sourceRecordIds: [],
            transitionReason: null,
            aftercareLinkId: null,
          },
        ],
      }),
    ).toThrow("M41C_CONTINUUM_EVENT_BEFORE_OPEN");
  });

  it("rejects duplicate events and decisions made before the reviewed transition", () => {
    const event = {
      id: "SYNTH-CONTINUUM-EVENT-DUPLICATE",
      stage: "intake" as const,
      occurredAt: "2026-11-10T08:00:00.000Z",
      serviceId: null,
      sourceRecordIds: ["SYNTH-INTAKE-RECORD"],
      transitionReason: null,
      aftercareLinkId: null,
    };
    expect(() =>
      buildM41cContinuumEpisode({
        episodeId: "SYNTH-EPISODE-DUPLICATE-001",
        subjectId: "SYNTH-YOUTH-001",
        openedAt: "2026-11-01T08:00:00.000Z",
        events: [event, event],
      }),
    ).toThrow("M41C_CONTINUUM_EVENT_ID_DUPLICATE");

    expect(() =>
      buildM41cContinuumEpisode({
        episodeId: "SYNTH-EPISODE-EARLY-DECISION-001",
        subjectId: "SYNTH-YOUTH-001",
        openedAt: "2026-11-01T08:00:00.000Z",
        events: [event],
        humanDecision: {
          ...decision,
          decidedAt: "2026-11-09T08:00:00.000Z",
        },
      }),
    ).toThrow("M41C_CONTINUUM_DECISION_BEFORE_TRANSITION");
  });
});
