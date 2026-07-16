import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

type Outputs = inferRouterOutputs<AppRouter>;
export type M42Snapshot = Outputs["m42"]["getExperienceSnapshot"];
export type M42AcceptanceStatus = Outputs["m42"]["getAcceptanceStatus"];
export type M42ScenarioResult = Outputs["m42"]["runIntegratedScenario"];
export type M42DocumentSearchResult = Outputs["m42"]["searchDocuments"];
export type M42NilSearchResult = Outputs["m42"]["searchNil"];
export type M42GovernedDocuments = Outputs["m42"]["listGovernedDocuments"];
export type M42DocumentActionResult = Outputs["m42"]["evaluateDocumentAction"];
export type M42VersionDemoResult = Outputs["m42"]["runVersionControlDemo"];
export type M42ReportFields = Outputs["m42"]["listReportFields"];
export type M42ReportDemoResult = Outputs["m42"]["runReportBuilderDemo"];
export type M42ConfigurationSchemas = Outputs["m42"]["listConfigurationSchemas"];
export type M42ConfigurationDemoResult = Outputs["m42"]["runConfigurationDemo"];

export function m42AcceptanceCounts(
  acceptance: M42AcceptanceStatus | null,
): { passed: number; total: number } {
  return {
    passed:
      acceptance?.acceptanceFlags.filter((flag) => flag.passed).length ?? 0,
    total: acceptance?.acceptanceFlags.length ?? 8,
  };
}
