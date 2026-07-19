import { runtimeConfig, type ClientRuntimeConfig } from "@/config/runtime";

type BannerRuntimeConfig = Pick<
  ClientRuntimeConfig,
  | "environmentId"
  | "evaluationMode"
  | "mode"
  | "productionReleaseAuthorized"
  | "productionReleaseId"
>;

interface WorkspaceEnvironmentBannerProps {
  workspace: "training" | "operational";
  config?: BannerRuntimeConfig;
}

export function WorkspaceEnvironmentBanner({
  workspace,
  config = runtimeConfig,
}: WorkspaceEnvironmentBannerProps) {
  if (workspace === "training") {
    return (
      <div
        role="status"
        aria-label="Training workspace safety notice"
        data-amos-environment={config.environmentId}
        data-amos-runtime-mode="training"
        className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-600 bg-amber-300 px-3 py-2 text-center text-[11px] font-bold tracking-wide text-slate-950 print:flex"
      >
        <span>TRAINING WORKSPACE</span>
        <span aria-hidden="true">•</span>
        <span>Synthetic data only</span>
        <span aria-hidden="true">•</span>
        <span>No PHI or regulated data</span>
        <span aria-hidden="true">•</span>
        <span>Not for care delivery</span>
        <span aria-hidden="true">•</span>
        <span>Practice only — no certification or clearance</span>
      </div>
    );
  }

  if (config.evaluationMode) {
    return (
      <div
        role="status"
        data-amos-environment={config.environmentId}
        data-amos-runtime-mode="demo"
        data-amos-control-plane="AMOS-OPS-PHASE3-EVALUATION"
        className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500 bg-amber-300 px-3 py-1.5 text-center text-[11px] font-bold tracking-wide text-slate-950 print:flex"
      >
        <span>DEMO - NOT FOR CARE DELIVERY</span>
        <span aria-hidden="true">•</span>
        <span>Environment: {config.environmentId}</span>
        <span aria-hidden="true">•</span>
        <span>Control plane: AMOS-OPS-PHASE3-EVALUATION</span>
        <span aria-hidden="true">•</span>
        <span>
          Synthetic data only · Production and Microsoft writes blocked
        </span>
      </div>
    );
  }

  if (config.mode === "production" && config.productionReleaseAuthorized) {
    return (
      <div
        role="status"
        data-amos-environment={config.environmentId}
        data-amos-runtime-mode="production"
        className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-emerald-800 bg-emerald-950 px-3 py-1.5 text-center text-[11px] font-bold tracking-wide text-emerald-50 print:flex"
      >
        <span>PRODUCTION</span>
        <span aria-hidden="true">•</span>
        <span>Authorized live operations</span>
        <span aria-hidden="true">•</span>
        <span>Release: {config.productionReleaseId}</span>
      </div>
    );
  }

  return null;
}
