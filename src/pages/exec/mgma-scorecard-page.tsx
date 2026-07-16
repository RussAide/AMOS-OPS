import { useState } from "react";
import {
  normalizeMgmaScorecard,
  type MgmaViewMode,
} from "@/components/mgma/mgma-scorecard-model";
import { MgmaScorecardView } from "@/components/mgma/mgma-scorecard-view";
import { trpc } from "@/providers/trpc";

export function MGMAScorecardPage() {
  const [viewMode, setViewMode] = useState<MgmaViewMode>("production_baseline");
  const dashboardQuery = trpc.mgma.executiveDashboard.useQuery({ viewMode });
  const model = normalizeMgmaScorecard(dashboardQuery.data, viewMode);
  const queryState = dashboardQuery.isLoading
    ? "loading"
    : dashboardQuery.isError
      ? "error"
      : "ready";

  return (
    <MgmaScorecardView
      model={model}
      viewMode={viewMode}
      queryState={queryState}
      isRefreshing={dashboardQuery.isFetching}
      onViewModeChange={setViewMode}
      onRefresh={() => {
        void dashboardQuery.refetch();
      }}
    />
  );
}

export default MGMAScorecardPage;
