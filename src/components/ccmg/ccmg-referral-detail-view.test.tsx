import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { normalizeCcmgReferralDetail } from "./ccmg-oversight-model";
import { CcmgReferralDetailView } from "./ccmg-referral-detail-view";
import { getSyntheticCcmgReferralDetail } from "./ccmg-synthetic-data";

describe("CCMG referral detail view", () => {
  it("renders assessment and instrument versions distinctly with both target routes", () => {
    const model = normalizeCcmgReferralDetail(
      getSyntheticCcmgReferralDetail("SYN-REF-ATLAS"),
      "SYN-REF-ATLAS",
    );
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <CcmgReferralDetailView
          model={model}
          authenticatedRoleLabel="CCMG Program Director"
          queryState="ready"
          isRefreshing={false}
          carePathEnabled={false}
          carePathDisabledReason="Read-only care-path render test."
          carePathSubmitting={false}
          actionsEnabled={false}
          actionsDisabledReason="Read-only render test."
          actionSubmitting={false}
          onCarePathAction={async () => undefined}
          onWorkflowAction={async () => undefined}
          onRefresh={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain("Assessment v2");
    expect(markup).toContain("Instrument CANS 2.0");
    expect(markup).toContain("SYN-MHTCM-PLAN-ATLAS-V2");
    expect(markup).toContain("SYN-MHRS-GOALS-ATLAS-V2");
    expect(markup).toContain("1 mapped goal");
    expect(markup).toContain("2 mapped goals");
    expect(markup).toContain("Synthetic-demo care path");
    expect(markup).toContain("Read-only care-path render test.");
  });
});
