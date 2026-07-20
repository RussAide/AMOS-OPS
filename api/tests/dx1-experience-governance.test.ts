import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DX1_PILOT_STAGE_IDS } from "../services/dx1/contracts";
import {
  runDx1ExperienceGovernanceStream,
  validateDx1ExperienceGovernanceResult,
} from "../services/dx1/experience";
import {
  APP_ROUTE_REGISTRY,
  appRoutePath,
} from "../../src/data/app-route-registry";

describe("DX.1 enterprise experience and governance verification", () => {
  it("completes the exact five assigned criteria with executable assertions", () => {
    const result = runDx1ExperienceGovernanceStream();
    expect(result).toMatchObject({
      streamId: "experience-governance",
      passed: true,
      assertionCount: 38,
      validationErrors: [],
      boundary: {
        synthetic: true,
        demoMode: true,
        productionRows: 0,
        liveExternalCalls: 0,
        liveMicrosoftReads: 0,
        liveMicrosoftWrites: 0,
        liveClinicalScoringActivations: 0,
        liveLevelOfCareDecisions: 0,
        realNotificationsSent: 0,
        deployments: 0,
        githubPushes: 0,
      },
    });
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual([
      "DX.1-01",
      "DX.1-02",
      "DX.1-09",
      "DX.1-11",
      "DX.1-12",
    ]);
    expect(result.criteria.map((criterion) => criterion.assertionIds.length)).toEqual([
      6, 8, 7, 8, 9,
    ]);
    expect(result.criteria.every((criterion) => criterion.status === "Complete")).toBe(
      true,
    );
  });

  it("reuses the accepted Operations Hub, workplan assistant, and change-control modules", () => {
    expect(runDx1ExperienceGovernanceStream().acceptedModules).toMatchObject({
      operationsHubAccepted: true,
      intranetDestinations: 11,
      canonicalRolesEvaluated: 36,
      workplanAssistantAccepted: true,
      governedGuidanceIntents: 7,
      changeControlAccepted: true,
      appendOnlyChangeHistory: true,
      projectReleaseLibraryPresent: true,
      productionActionsBlocked: true,
      liveExternalWrites: 0,
      synthetic: true,
    });
  });

  it("keeps all enterprise workspaces configured and routes every persona to assigned work", () => {
    const result = runDx1ExperienceGovernanceStream();
    expect(result.workspaces).toHaveLength(11);
    expect(
      result.workspaces.every(
        (workspace) =>
          workspace.configured &&
          workspace.navigableForAtLeastOneCanonicalRole &&
          workspace.physicalMicrosoftUrl === null,
      ),
    ).toBe(true);
    expect(result.personaAssignments).toHaveLength(5);
    expect(
      result.personaAssignments.every(
        (assignment) =>
          assignment.routeAllowed &&
          assignment.permissionTrimmed &&
          !assignment.architectureKnowledgeRequired,
      ),
    ).toBe(true);

    const sourceRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../..",
    );
    const appRoutes = fs.readFileSync(
      path.join(sourceRoot, "src/components/shell/app-shell.tsx"),
      "utf8",
    );
    for (const assignment of result.personaAssignments) {
      const registeredRoute = APP_ROUTE_REGISTRY.find(
        ({ path: routePath }) => routePath === assignment.primaryWorkPath,
      );
      expect(registeredRoute).toBeDefined();
      if (!registeredRoute) continue;
      expect(appRoutePath(registeredRoute.id)).toBe(assignment.primaryWorkPath);
      const bindingStart = appRoutes.indexOf(
        `path={appRoutePath("${registeredRoute.id}")}`,
      );
      expect(bindingStart).toBeGreaterThan(-1);
      expect(appRoutes.slice(bindingStart, bindingStart + 260)).toContain(
        "element={<",
      );
    }
  });

  it("governs every pilot workflow with ownership, status, evidence, and escalation", () => {
    const workflows = runDx1ExperienceGovernanceStream().workflows;
    expect(workflows.map((workflow) => workflow.stageId)).toEqual(
      DX1_PILOT_STAGE_IDS,
    );
    expect(new Set(workflows.map((workflow) => workflow.workflowId)).size).toBe(8);
    for (const workflow of workflows) {
      expect(workflow.ownerRole).toBeTruthy();
      expect(workflow.statusModel.length).toBeGreaterThanOrEqual(3);
      expect(workflow.evidenceGateId).toMatch(/^SYNTH-DX1-GATE-/);
      expect(workflow.requiredEvidence.length).toBeGreaterThan(0);
      expect(workflow.escalation).toMatchObject({ bypassAvailable: false });
      expect(workflow.unmanaged).toBe(false);
      expect(workflow.liveExecutionAvailable).toBe(false);
    }
  });

  it("proves plain-language completion for four representative frontline personas", () => {
    const walkthroughs = runDx1ExperienceGovernanceStream().frontlineWalkthroughs;
    expect(walkthroughs).toHaveLength(4);
    for (const walkthrough of walkthroughs) {
      expect(walkthrough.completed).toBe(true);
      expect(walkthrough.completedActions).toBe(walkthrough.visibleActions.length);
      expect(walkthrough.visibleActions.length).toBeLessThanOrEqual(4);
      expect(walkthrough).toMatchObject({
        hiddenTechnicalSteps: 0,
        architectureTermsExposed: false,
        commandLineRequired: false,
        completionEvidenceVisible: true,
      });
    }
  });

  it("provides stage-specific quick guidance, SOPs, AMOS-Coach prompts, and issue support", () => {
    const result = runDx1ExperienceGovernanceStream();
    expect(result.guidanceAtWork.map((guidance) => guidance.stageId)).toEqual(
      DX1_PILOT_STAGE_IDS,
    );
    for (const guidance of result.guidanceAtWork)
      expect(guidance).toMatchObject({
        issueSupportPath: "#dx1-issue-support",
        sourceVisible: true,
        bypassAvailable: false,
        synthetic: true,
      });
    expect(
      result.guidanceAtWork.every(
        (guidance) =>
          /^SOP-\d{3}$/.test(guidance.sopId) &&
          guidance.coachPrompt.length > 20 &&
          guidance.quickGuidance.length > 20,
      ),
    ).toBe(true);
    expect(result.issueSupport).toMatchObject({
      path: "#dx1-issue-support",
      ownerRole: "administrator",
      liveTicketCreated: false,
    });
  });

  it("operates release governance without activating production change", () => {
    const release = runDx1ExperienceGovernanceStream().releaseGovernance;
    expect(release).toMatchObject({
      governingLibraryCode: "projects-change-releases",
      governingContentTypeCode: "project-release-artifact",
      inheritedAppendOnlyChangeControl: true,
      productionActivationAvailable: false,
      liveWrites: 0,
      deployments: 0,
      githubPushes: 0,
      safeChangeDisposition: {
        disposition: "approved-demo-only",
        productionActivation: false,
        deploymentExecuted: false,
        githubPushPerformed: false,
        liveWrites: 0,
      },
    });
    expect(release.releaseRegister).toHaveLength(1);
    expect(release.enhancementBacklog).toHaveLength(3);
    expect(release.evidenceHistory.map((entry) => entry.sequence)).toEqual([
      1, 2, 3,
    ]);
    expect(release.evidenceHistory.every((entry) => entry.appendOnly)).toBe(true);
  });

  it("replays deterministically and freezes the complete result", () => {
    const left = runDx1ExperienceGovernanceStream();
    const right = runDx1ExperienceGovernanceStream();
    expect(left).toEqual(right);
    expect(validateDx1ExperienceGovernanceResult(left)).toEqual([]);
    expect(Object.isFrozen(left)).toBe(true);
    expect(Object.isFrozen(left.personaAssignments)).toBe(true);
    expect(Object.isFrozen(left.releaseGovernance.evidenceHistory[0])).toBe(true);
  });
});
