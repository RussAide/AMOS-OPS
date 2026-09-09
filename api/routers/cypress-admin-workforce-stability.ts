import { z } from "zod";
import {
  CYPRESS_S6_PREVIEW_SCENARIOS,
  type CypressS6PreviewScenario,
} from "../../contracts/doctrine/cypress-admin-workforce-stability";
import {
  buildCypressS6Preview,
  getCypressS6Status,
} from "../doctrine/cypress-admin-workforce-stability";
import { authedQuery, createRouter } from "../middleware";

const scenarioSchema = z.enum(CYPRESS_S6_PREVIEW_SCENARIOS);

export const cypressAdminWorkforceStabilityRouter = createRouter({
  adminWorkforceStabilityStatus: authedQuery.query(() => getCypressS6Status()),

  adminWorkforceStabilityPreview: authedQuery
    .input(z.object({ scenario: scenarioSchema }))
    .query(({ input }) =>
      buildCypressS6Preview(input.scenario as CypressS6PreviewScenario),
    ),
});
