import { z } from "zod";
import {
  CYPRESS_S7_PREVIEW_SCENARIOS,
  type CypressS7PreviewScenario,
} from "../../contracts/doctrine/cypress-cwop-continuum-intelligence";
import {
  buildCypressS7Preview,
  getCypressS7Status,
} from "../doctrine/cypress-cwop-continuum-intelligence";
import { authedQuery, createRouter } from "../middleware";

const scenarioSchema = z.enum(CYPRESS_S7_PREVIEW_SCENARIOS);

export const cypressCwopContinuumIntelligenceRouter = createRouter({
  cwopContinuumIntelligenceStatus: authedQuery.query(() => getCypressS7Status()),

  cwopContinuumIntelligencePreview: authedQuery
    .input(z.object({ scenario: scenarioSchema }))
    .query(({ input }) =>
      buildCypressS7Preview(input.scenario as CypressS7PreviewScenario),
    ),
});
