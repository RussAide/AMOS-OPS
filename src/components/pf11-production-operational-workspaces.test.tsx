import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationalProgramSummary } from "../../api/services/operational-program-summary";
import { M22Workspace } from "./mhtcm/m22-workspace";
import { M23Workspace } from "./mhrs/m23-workspace";

function summary(program: "MHTCM" | "MHRS"): OperationalProgramSummary {
  return {
    program,
    generatedAt: "2026-07-20T12:00:00.000Z",
    source: {
      provider: "m21_ccmg_durable",
      evidenceClass: "production",
      accessMode: "read_only",
    },
    empty: false,
    metrics: {
      totalWorkItems: 1,
      activeWorkItems: 1,
      overdueWorkItems: 0,
      urgentWorkItems: 1,
      pendingApprovals: 0,
      openExceptions: 0,
      activeHandoffs: 1,
      approvedLineages: 1,
    },
    workItems: [
      {
        id: `WORK-${program}`,
        caseId: `CASE-${program}-PRODUCTION`,
        title: `Governed ${program} coordination`,
        status: "in_progress",
        priority: "urgent",
        assignedRole:
          program === "MHTCM" ? "mhtcm-supervisor" : "mhrs-supervisor",
        dueAt: "2026-07-21T12:00:00.000Z",
        approvalStatus: "approved",
        exceptionStatus: "none",
        updatedAt: "2026-07-20T10:00:00.000Z",
      },
    ],
    handoffs: [
      {
        id: `HANDOFF-${program}`,
        caseId: `CASE-${program}-PRODUCTION`,
        workItemId: `WORK-${program}`,
        status: "accepted",
        initiatedAt: "2026-07-20T09:00:00.000Z",
        dueAt: "2026-07-21T12:00:00.000Z",
        acceptedAt: "2026-07-20T10:00:00.000Z",
        completedAt: null,
      },
    ],
    approvedLineage: [
      {
        id: `LINEAGE-${program}`,
        caseId: `CASE-${program}-PRODUCTION`,
        cansAssessmentId: "CANS-PRODUCTION-1",
        cansVersion: 1,
        targetRecordId: `PLAN-${program}-1`,
        targetVersion: 1,
        approvedAt: "2026-07-20T08:00:00.000Z",
        routedAt: "2026-07-20T09:00:00.000Z",
      },
    ],
  };
}

describe("PF-11 Production MHTCM/MHRS workspaces", () => {
  it.each([
    [
      "MHTCM",
      <M22Workspace
        syntheticDataAllowed={false}
        operationalSummary={summary("MHTCM")}
      />,
    ],
    [
      "MHRS",
      <M23Workspace
        syntheticDataAllowed={false}
        operationalSummary={summary("MHRS")}
      />,
    ],
  ])("renders the authoritative %s operational queue", (program, view) => {
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(`${program} Operational Queue`);
    expect(markup).toContain(`CASE-${program}-PRODUCTION`);
    expect(markup).toContain("Authoritative");
    expect(markup).toContain("read only");
    expect(markup).not.toContain("Synthetic Youth");
    expect(markup).not.toContain("Demo mode");
    expect(markup).not.toContain("READY FOR REVENUE");
  });

  it.each([
    [
      "MHTCM",
      <M22Workspace
        syntheticDataAllowed={false}
        operationalSummary={{
          ...summary("MHTCM"),
          empty: true,
          workItems: [],
          handoffs: [],
          approvedLineage: [],
        }}
      />,
    ],
    [
      "MHRS",
      <M23Workspace
        syntheticDataAllowed={false}
        operationalSummary={{
          ...summary("MHRS"),
          empty: true,
          workItems: [],
          handoffs: [],
          approvedLineage: [],
        }}
      />,
    ],
  ])("renders an honest empty state for %s", (program, view) => {
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(`No ${program} operational records`);
    expect(markup).toContain("authoritative durable store is connected");
    expect(markup).not.toContain("Synthetic Youth");
  });

  it.each([
    ["MHTCM", <M22Workspace syntheticDataAllowed={false} operationalError />],
    ["MHRS", <M23Workspace syntheticDataAllowed={false} operationalError />],
  ])("fails closed with a safe %s error state", (program, view) => {
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(`${program} operational data could not be loaded`);
    expect(markup).toContain(
      "No cached or demonstration records were substituted",
    );
    expect(markup).not.toContain("Synthetic Youth");
  });
});
