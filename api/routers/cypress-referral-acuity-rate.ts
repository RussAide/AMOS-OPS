import { z } from "zod";
import {
  CYPRESS_S5_PREVIEW_SCENARIOS,
  type CypressS5PreviewScenario,
} from "../../contracts/doctrine/cypress-referral-acuity-rate";
import {
  buildCypressS5Preview,
  getCypressS5Status,
} from "../doctrine/cypress-referral-acuity-rate";
import { authedQuery, createRouter } from "../middleware";

const scenarioSchema = z.enum(CYPRESS_S5_PREVIEW_SCENARIOS);

export const cypressReferralAcuityRateRouter = createRouter({
  referralAcuityRateStatus: authedQuery.query(() => getCypressS5Status()),

  referralAcuityRatePreview: authedQuery
    .input(z.object({ scenario: scenarioSchema }))
    .query(({ input }) =>
      buildCypressS5Preview(input.scenario as CypressS5PreviewScenario),
    ),
});
