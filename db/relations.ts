import { relations } from "drizzle-orm";
import {
  youthProfiles,
  campusStages,
  stageAssignments,
  campusReadinessCriteria,
  censusAlerts,
  censusSnapshots,
  facilities,
  rooms,
  bedCensusV2,
  facilityPhases,
  mhtcmServicePlans,
  mhtcmEncounters,
  ccmgCareCoordination,
  ccmgReferrals,
  restraintIncidents,
  prohibitedPractices,
  mhrsServicePlans,
  mhrsEncounters,
  mhrsSkillsAssessments,
  sudRecords,
  part2Consents,
  mgmaDomains,
  mgmaKpiTargets,
  mgmaMeasurements,
  mgmaDataQualityResults,
  mgmaOwnerApprovals,
  documentTemplates,
  generatedDocuments,
  shiftLogs,
  safetyRounds,
  youthCareLogs,
  incidentReports,
  supervisionNotes,
} from "./schema";

// ─── Campus Stage Relations ──────────────────────────────────

export const campusStagesRelations = relations(campusStages, ({ many, one }) => ({
  facility: one(facilities, { fields: [campusStages.facilityId], references: [facilities.id] }),
  assignments: many(stageAssignments),
  criteria: many(campusReadinessCriteria),
  censusAlerts: many(censusAlerts),
  rooms: many(rooms),
}));

export const stageAssignmentsRelations = relations(stageAssignments, ({ one }) => ({
  toStage: one(campusStages, { fields: [stageAssignments.toStageId], references: [campusStages.id] }),
}));

export const campusReadinessCriteriaRelations = relations(campusReadinessCriteria, ({ one }) => ({
  stage: one(campusStages, { fields: [campusReadinessCriteria.stageId], references: [campusStages.id] }),
}));

export const censusAlertsRelations = relations(censusAlerts, ({ one }) => ({
  stage: one(campusStages, { fields: [censusAlerts.stageId], references: [campusStages.id] }),
  facility: one(facilities, { fields: [censusAlerts.facilityId], references: [facilities.id] }),
}));

export const censusSnapshotsRelations = relations(censusSnapshots, ({ one }) => ({
  facility: one(facilities, { fields: [censusSnapshots.facilityId], references: [facilities.id] }),
}));

// ─── Facility Relations ──────────────────────────────────────

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  rooms: many(rooms),
  phases: many(facilityPhases),
  stages: many(campusStages),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  facility: one(facilities, { fields: [rooms.facilityId], references: [facilities.id] }),
  beds: many(bedCensusV2),
  stage: one(campusStages, { fields: [rooms.phaseActivationId], references: [campusStages.id] }),
}));

// ─── Youth Profile Relations ─────────────────────────────────

export const youthProfilesRelations = relations(youthProfiles, ({ many }) => ({
  stageAssignments: many(stageAssignments),
}));

// ─── MHTCM Relations ─────────────────────────────────────────

export const mhtcmServicePlansRelations = relations(mhtcmServicePlans, ({ many }) => ({
  encounters: many(mhtcmEncounters),
}));

export const mhtcmEncountersRelations = relations(mhtcmEncounters, ({ one }) => ({
  servicePlan: one(mhtcmServicePlans, { fields: [mhtcmEncounters.servicePlanId], references: [mhtcmServicePlans.id] }),
}));

// ─── CCMG Relations ──────────────────────────────────────────

export const ccmgCareCoordinationRelations = relations(ccmgCareCoordination, ({ many }) => ({
  referrals: many(ccmgReferrals),
}));

export const ccmgReferralsRelations = relations(ccmgReferrals, ({ one }) => ({
  careCoordination: one(ccmgCareCoordination, { fields: [ccmgReferrals.youthId], references: [ccmgCareCoordination.youthId] }),
}));

// ─── GRO Compliance Relations ────────────────────────────────

export const restraintIncidentsRelations = relations(restraintIncidents, ({ one }) => ({
  prohibitedPractices: one(prohibitedPractices, { fields: [restraintIncidents.id], references: [prohibitedPractices.incidentId] }),
}));

export const prohibitedPracticesRelations = relations(prohibitedPractices, ({ one }) => ({
  incident: one(restraintIncidents, { fields: [prohibitedPractices.incidentId], references: [restraintIncidents.id] }),
}));

// ─── MHRS Relations ──────────────────────────────────────────

export const mhrsServicePlansRelations = relations(mhrsServicePlans, ({ many }) => ({
  encounters: many(mhrsEncounters),
  assessments: many(mhrsSkillsAssessments),
}));

export const mhrsEncountersRelations = relations(mhrsEncounters, ({ one }) => ({
  servicePlan: one(mhrsServicePlans, { fields: [mhrsEncounters.servicePlanId], references: [mhrsServicePlans.id] }),
}));

export const mhrsSkillsAssessmentsRelations = relations(mhrsSkillsAssessments, ({ one }) => ({
  servicePlan: one(mhrsServicePlans, { fields: [mhrsSkillsAssessments.servicePlanId], references: [mhrsServicePlans.id] }),
}));

// ─── 42 CFR Part 2 Relations ─────────────────────────────────

export const sudRecordsRelations = relations(sudRecords, ({ many }) => ({
  consents: many(part2Consents),
}));

export const part2ConsentsRelations = relations(part2Consents, ({ one }) => ({
  sudRecord: one(sudRecords, { fields: [part2Consents.sudRecordId], references: [sudRecords.id] }),
}));

// ─── MGMA Relations ──────────────────────────────────────────

export const mgmaDomainsRelations = relations(mgmaDomains, ({ many }) => ({
  kpis: many(mgmaKpiTargets),
}));

export const mgmaKpiTargetsRelations = relations(mgmaKpiTargets, ({ one, many }) => ({
  domain: one(mgmaDomains, { fields: [mgmaKpiTargets.domainId], references: [mgmaDomains.id] }),
  measurements: many(mgmaMeasurements),
  qualityResults: many(mgmaDataQualityResults),
  ownerApprovals: many(mgmaOwnerApprovals),
}));

export const mgmaMeasurementsRelations = relations(mgmaMeasurements, ({ one, many }) => ({
  kpi: one(mgmaKpiTargets, { fields: [mgmaMeasurements.kpiId], references: [mgmaKpiTargets.id] }),
  qualityResults: many(mgmaDataQualityResults),
}));

export const mgmaDataQualityResultsRelations = relations(mgmaDataQualityResults, ({ one }) => ({
  measurement: one(mgmaMeasurements, { fields: [mgmaDataQualityResults.measurementId], references: [mgmaMeasurements.id] }),
  kpi: one(mgmaKpiTargets, { fields: [mgmaDataQualityResults.kpiId], references: [mgmaKpiTargets.id] }),
}));

export const mgmaOwnerApprovalsRelations = relations(mgmaOwnerApprovals, ({ one }) => ({
  kpi: one(mgmaKpiTargets, { fields: [mgmaOwnerApprovals.kpiId], references: [mgmaKpiTargets.id] }),
}));

// ─── Document Relations ──────────────────────────────────────

export const documentTemplatesRelations = relations(documentTemplates, ({ many }) => ({
  generatedDocuments: many(generatedDocuments),
}));

export const generatedDocumentsRelations = relations(generatedDocuments, ({ one }) => ({
  template: one(documentTemplates, { fields: [generatedDocuments.templateId], references: [documentTemplates.id] }),
}));

// ─── GRO Residential Operations Relations ────────────────────

export const shiftLogsRelations = relations(shiftLogs, ({ many }) => ({
  safetyRounds: many(safetyRounds),
  careLogs: many(youthCareLogs),
}));

export const safetyRoundsRelations = relations(safetyRounds, ({ one }) => ({
  shift: one(shiftLogs, { fields: [safetyRounds.shiftId], references: [shiftLogs.id] }),
}));

export const youthCareLogsRelations = relations(youthCareLogs, ({ one }) => ({
  shift: one(shiftLogs, { fields: [youthCareLogs.shiftId], references: [shiftLogs.id] }),
}));

export const incidentReportsRelations = relations(incidentReports, ({ one }) => ({
  supervisionNote: one(supervisionNotes, { fields: [incidentReports.id], references: [supervisionNotes.relatedIncidentId] }),
}));

export const supervisionNotesRelations = relations(supervisionNotes, ({ one }) => ({
  relatedIncident: one(incidentReports, { fields: [supervisionNotes.relatedIncidentId], references: [incidentReports.id] }),
}));
