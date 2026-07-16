import type { M24State } from "./m24-model";

/** Creates a fresh, deterministic, zero-resident three-stage evaluation state. */
export function createM24SyntheticState(): M24State {
  const stages: M24State["stages"] = [
    {
      id: "M24-STAGE-1",
      stageNumber: 1,
      name: "Stage 1 — Main Residential Unit",
      licensedCapacity: 16,
      operationalCapacity: 16,
      currentCensus: 0,
      leaveCount: 0,
      capacityAlertThreshold: 90,
      status: "operational",
    },
    {
      id: "M24-STAGE-2",
      stageNumber: 2,
      name: "Stage 2 — Emergency Care Services",
      licensedCapacity: 16,
      operationalCapacity: 16,
      currentCensus: 0,
      leaveCount: 0,
      capacityAlertThreshold: 90,
      status: "evaluation",
    },
    {
      id: "M24-STAGE-3",
      stageNumber: 3,
      name: "Stage 3 — Cypress Campus",
      licensedCapacity: 16,
      operationalCapacity: 16,
      currentCensus: 0,
      leaveCount: 0,
      capacityAlertThreshold: 90,
      status: "evaluation",
    },
  ];

  const rooms: M24State["rooms"] = [];
  const beds: M24State["beds"] = [];
  for (const stage of stages) {
    for (let roomNumber = 1; roomNumber <= 4; roomNumber += 1) {
      const roomId = `${stage.id}-ROOM-${roomNumber}`;
      rooms.push({
        id: roomId,
        stageId: stage.id,
        label: `S${stage.stageNumber}-${100 + roomNumber}`,
        grossFloorSquareFeet: 250,
        closetAndAlcoveSquareFeet: 10,
        maximumBeds: 4,
        active: true,
      });
      for (let bedNumber = 1; bedNumber <= 4; bedNumber += 1) {
        beds.push({
          id: `${roomId}-BED-${bedNumber}`,
          stageId: stage.id,
          roomId,
          label: `S${stage.stageNumber}-${100 + roomNumber}-${bedNumber}`,
          status: "available",
          youthId: null,
        });
      }
    }
  }

  return {
    sequence: 0,
    stages,
    rooms,
    beds,
    placements: [],
    transitions: [],
    censusAlerts: [],
    shifts: [],
    staffingEvaluations: [],
    safetyRounds: [],
    careLogs: [],
    tasks: [],
    shiftHandoffs: [],
    medications: [],
    medicationDiscrepancies: [],
    medicationHandoffs: [],
    incidents: [],
    notifications: [],
    correctiveActions: [],
    rightsPostings: [
      {
        id: "M24-RIGHTS-POSTING-1",
        version: "M24-RIGHTS-2026.1",
        documentUrl: "synthetic://m24/youth-rights/2026.1",
        postedAt: "2026-07-14T08:00:00.000Z",
        postedBy: "SYNTH-COMPLIANCE-OWNER",
        active: true,
      },
    ],
    rightsAcknowledgments: [],
    practiceDecisions: [],
    engagementEvents: [],
    auditEvents: [],
  };
}
