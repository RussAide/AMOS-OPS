import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CcmgWorkflowActions } from "./ccmg-workflow-actions";
import type { CcmgWorkflowViewModel } from "./ccmg-oversight-model";

const workflow: CcmgWorkflowViewModel = {
  workItemId: "SYN-WI-ACTION-001",
  expectedVersion: 3,
  status: "in_progress",
  stage: "intake",
  assignedDivision: "BHC",
  assignedDepartment: "CCMG",
  assignedTo: "synthetic-assignee",
  assignedRole: "intake-coordinator",
  dueAt: "2026-07-15T12:00:00.000Z",
  approvalStatus: "pending",
  escalationLevel: "none",
  exceptionCode: "SYNTHETIC_EXCEPTION",
  exceptionStatus: "open",
  handoff: "Synthetic handoff",
  handoffId: "SYN-HO-ACTION-001",
  handoffVersion: 1,
  handoffStatus: "initiated",
  exceptions: ["SYNTHETIC_EXCEPTION"],
};

describe("CCMG guided workflow action UI", () => {
  it("shows the complete server-authorized action set and authority notice", () => {
    const markup = renderToStaticMarkup(
      <CcmgWorkflowActions
        workflow={workflow}
        authenticatedRoleLabel="CCMG Program Director"
        enabled
        submitting={false}
        onAction={async () => undefined}
      />,
    );

    expect(markup).toContain("Guided workflow actions");
    expect(markup).toContain("Status");
    expect(markup).toContain("Assign");
    expect(markup).toContain("Approval");
    expect(markup).toContain("Handoff");
    expect(markup).toContain("Escalate");
    expect(markup).toContain("Exception");
    expect(markup).toContain("Handoff decision");
    expect(markup).toContain("server validates the authenticated session role");
    expect(markup).toContain("applies no optimistic update");
  });

  it("keeps built fixture actions visibly read-only", () => {
    const markup = renderToStaticMarkup(
      <CcmgWorkflowActions
        workflow={workflow}
        authenticatedRoleLabel="Evaluation Viewer"
        enabled={false}
        disabledReason="Built fallback fixtures are read-only."
        submitting={false}
        onAction={async () => undefined}
      />,
    );

    expect(markup).toContain("Built fallback fixtures are read-only.");
    expect(markup).toContain("disabled");
  });
});
