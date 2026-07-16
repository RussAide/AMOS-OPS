import { describe, expect, it } from "vitest";
import {
  runDx1ExperienceGovernanceStream,
  validateDx1ExperienceGovernanceResult,
  type Dx1ExperienceGovernanceResult,
} from "../services/dx1/experience";

function corrupt(
  update: Partial<Dx1ExperienceGovernanceResult>,
): Dx1ExperienceGovernanceResult {
  return {
    ...runDx1ExperienceGovernanceStream(),
    ...update,
  } as Dx1ExperienceGovernanceResult;
}

describe("DX.1 experience and governance fail-closed controls", () => {
  it("detects drift in the accepted Operations Hub role and route inventory", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    expect(
      validateDx1ExperienceGovernanceResult(
        corrupt({
          acceptedModules: {
            ...baseline.acceptedModules,
            intranetDestinations: 10,
            canonicalRolesEvaluated: 35,
          },
        }),
      ),
    ).toContain("DX1_ACCEPTED_MODULE_RECONCILIATION_FAILED");
  });

  it("detects a missing enterprise workspace", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    expect(
      validateDx1ExperienceGovernanceResult(
        corrupt({ workspaces: baseline.workspaces.slice(1) }),
      ),
    ).toContain("DX1_ENTERPRISE_WORKSPACE_NAVIGATION_INCOMPLETE");
  });

  it("detects a persona route that exposes technical burden", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    const personaAssignments = baseline.personaAssignments.map((assignment, index) =>
      index === 0
        ? {
            ...assignment,
            routeAllowed: false as never,
            architectureKnowledgeRequired: true as never,
          }
        : assignment,
    );
    expect(
      validateDx1ExperienceGovernanceResult(corrupt({ personaAssignments })),
    ).toContain("DX1_PERSONA_ASSIGNED_WORK_UNREACHABLE");
  });

  it("detects an unmanaged workflow or bypassable escalation", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    const workflows = baseline.workflows.map((workflow, index) =>
      index === 0
        ? {
            ...workflow,
            ownerRole: "" as never,
            unmanaged: true as never,
            escalation: {
              ...workflow.escalation,
              bypassAvailable: true as never,
            },
          }
        : workflow,
    );
    expect(validateDx1ExperienceGovernanceResult(corrupt({ workflows }))).toContain(
      "DX1_CORE_WORKFLOW_GOVERNANCE_INCOMPLETE",
    );
  });

  it("detects hidden technical steps in a frontline walkthrough", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    const frontlineWalkthroughs = baseline.frontlineWalkthroughs.map(
      (walkthrough, index) =>
        index === 0
          ? {
              ...walkthrough,
              hiddenTechnicalSteps: 1 as never,
              commandLineRequired: true as never,
            }
          : walkthrough,
    );
    expect(
      validateDx1ExperienceGovernanceResult(
        corrupt({ frontlineWalkthroughs }),
      ),
    ).toContain("DX1_FRONTLINE_USABILITY_INCOMPLETE");
  });

  it("detects missing SOP and bypassable at-work guidance", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    const guidanceAtWork = baseline.guidanceAtWork.map((guidance, index) =>
      index === 0
        ? {
            ...guidance,
            sopId: "UNCONTROLLED",
            bypassAvailable: true as never,
          }
        : guidance,
    );
    expect(
      validateDx1ExperienceGovernanceResult(corrupt({ guidanceAtWork })),
    ).toContain("DX1_GUIDANCE_SOP_COACH_SUPPORT_INCOMPLETE");
  });

  it("detects an unsafe release disposition or external mutation", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    const releaseGovernance = {
      ...baseline.releaseGovernance,
      productionActivationAvailable: true as never,
      deployments: 1 as never,
      safeChangeDisposition: {
        ...baseline.releaseGovernance.safeChangeDisposition,
        productionActivation: true as never,
        githubPushPerformed: true as never,
      },
    };
    expect(
      validateDx1ExperienceGovernanceResult(
        corrupt({ releaseGovernance }),
      ),
    ).toContain("DX1_RELEASE_CHANGE_GOVERNANCE_INCOMPLETE");
  });

  it("detects any live activity in the prototype boundary", () => {
    const baseline = runDx1ExperienceGovernanceStream();
    expect(
      validateDx1ExperienceGovernanceResult(
        corrupt({
          boundary: {
            ...baseline.boundary,
            liveExternalCalls: 1 as never,
          },
        }),
      ),
    ).toContain("DX1_SYNTHETIC_BOUNDARY_INVALID");
  });
});
