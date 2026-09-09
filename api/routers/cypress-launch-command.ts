import { z } from "zod";
import {
  CYPRESS_LAUNCH_PREVIEW_SCENARIOS,
  type CypressLaunchPreviewScenario,
} from "../../contracts/doctrine/cypress-launch-command";
import {
  buildCypressLaunchCommandPreview,
  getCypressLaunchCommandStatus,
} from "../doctrine/cypress-launch-command";
import { authedQuery, createRouter } from "../middleware";

const scenarioSchema = z.enum(CYPRESS_LAUNCH_PREVIEW_SCENARIOS);

export const cypressLaunchCommandRouter = createRouter({
  status: authedQuery.query(() => getCypressLaunchCommandStatus()),

  preview: authedQuery
    .input(z.object({ scenario: scenarioSchema }))
    .query(({ input }) =>
      buildCypressLaunchCommandPreview(
        input.scenario as CypressLaunchPreviewScenario,
      ),
    ),
});
