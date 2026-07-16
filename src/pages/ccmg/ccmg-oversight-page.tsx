import { normalizeCcmgDashboard } from "@/components/ccmg/ccmg-oversight-model";
import { CcmgOversightView } from "@/components/ccmg/ccmg-oversight-view";
import {
  CCMG_FIXTURE_FALLBACK_NOTICE,
  isBuiltCcmgFixture,
  mayUseCcmgFixtureForError,
} from "@/components/ccmg/ccmg-query-fallback";
import { CCMG_SYNTHETIC_DASHBOARD } from "@/components/ccmg/ccmg-synthetic-data";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

export function CcmgOversightPage() {
  const { getRoleDef } = useAuth();
  const dashboardQuery = trpc.m21.getOversightDashboard.useQuery({
    evidenceClass: runtimeConfig.evaluationMode
      ? "synthetic_demo"
      : "production",
  });
  const useFixture =
    dashboardQuery.isError &&
    mayUseCcmgFixtureForError(
      dashboardQuery.error,
      "m21.getOversightDashboard",
    );
  const rawDashboard = useFixture
    ? CCMG_SYNTHETIC_DASHBOARD
    : dashboardQuery.data;
  const model = normalizeCcmgDashboard(rawDashboard);
  const queryState = dashboardQuery.isLoading
    ? "loading"
    : dashboardQuery.isError && !useFixture
      ? "error"
      : "ready";
  const fallbackNotice =
    useFixture || isBuiltCcmgFixture(dashboardQuery.data)
      ? CCMG_FIXTURE_FALLBACK_NOTICE
      : undefined;

  return (
    <CcmgOversightView
      model={model}
      authenticatedRoleLabel={getRoleDef().label}
      queryState={queryState}
      isRefreshing={dashboardQuery.isFetching}
      fallbackNotice={fallbackNotice}
      onRefresh={() => {
        void dashboardQuery.refetch();
      }}
    />
  );
}

export default CcmgOversightPage;
