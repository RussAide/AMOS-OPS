/**
 * Canonical authenticated application route inventory.
 *
 * Route targets are declared here once. The application shell binds each id to
 * its React element, while navigation surfaces resolve destinations by id.
 */
export interface AppRouteDefinition {
  readonly id: string;
  readonly path: string;
}

export const APP_ROUTE_REGISTRY = [
  { id: "home", path: "/" },
  { id: "home-alerts", path: "/home/alerts" },
  { id: "home-divisions", path: "/home/divisions" },
  { id: "home-quick-actions", path: "/home/quick-actions" },
  { id: "continuum", path: "/continuum" },
  { id: "corporate-operations", path: "/corporate-operations" },
  { id: "clinical", path: "/clinical" },
  { id: "clinical-intelligence-fabric", path: "/clinical/intelligence-fabric" },
  { id: "clinical-sessions", path: "/clinical/sessions" },
  { id: "clinical-treatment-plans", path: "/clinical/treatment-plans" },
  { id: "clinical-cans-assessments", path: "/clinical/cans-assessments" },
  { id: "clinical-outcome-measures", path: "/clinical/outcome-measures" },
  { id: "clinical-insurance-plans", path: "/clinical/insurance-plans" },
  { id: "clinical-referrals", path: "/clinical/referrals" },
  { id: "clinical-service-delivery", path: "/clinical/service-delivery" },
  { id: "clinical-patients", path: "/clinical/patients" },
  { id: "clinical-patient-id", path: "/clinical/patient/:id" },
  { id: "clinical-patients-id", path: "/clinical/patients/:id" },
  { id: "clinical-workspace", path: "/clinical/workspace" },
  { id: "bhc", path: "/bhc" },
  { id: "ccmg", path: "/ccmg" },
  { id: "ccmg-referrals-referralId", path: "/ccmg/referrals/:referralId" },
  { id: "mhtcm", path: "/mhtcm" },
  { id: "mhrs", path: "/mhrs" },
  { id: "intake", path: "/intake" },
  { id: "intake-pipeline", path: "/intake/pipeline" },
  { id: "intake-assessment", path: "/intake/assessment" },
  { id: "crisis", path: "/crisis" },
  { id: "cases", path: "/cases" },
  { id: "gro", path: "/gro" },
  { id: "gro-workspace", path: "/gro/workspace" },
  { id: "gro-compliance", path: "/gro/compliance" },
  { id: "gro-incidents", path: "/gro/incidents" },
  { id: "gro-shift-logs", path: "/gro/shift-logs" },
  { id: "gro-safety-rounds", path: "/gro/safety-rounds" },
  { id: "gro-care-logs", path: "/gro/care-logs" },
  { id: "gro-supervision", path: "/gro/supervision" },
  { id: "gro-handoffs", path: "/gro/handoffs" },
  { id: "gro-residential-operations", path: "/gro/residential-operations" },
  { id: "residential", path: "/residential" },
  { id: "medications", path: "/medications" },
  { id: "mobile-mar", path: "/mobile-mar" },
  { id: "mar-facility", path: "/mar-facility" },
  { id: "family", path: "/family" },
  { id: "handoffs", path: "/handoffs" },
  { id: "residential-analytics", path: "/residential/analytics" },
  { id: "observations", path: "/observations" },
  { id: "meetings", path: "/meetings" },
  { id: "escalation-ladder", path: "/escalation-ladder" },
  { id: "campus", path: "/campus" },
  { id: "qa", path: "/qa" },
  { id: "qa-list", path: "/qa/list" },
  { id: "qa-audit-binder", path: "/qa/audit-binder" },
  { id: "qa-cap-tracker", path: "/qa/cap-tracker" },
  { id: "qa-compliance-memo", path: "/qa/compliance-memo" },
  { id: "qa-deficiency-tracking", path: "/qa/deficiency-tracking" },
  { id: "qa-evidence-matrix", path: "/qa/evidence-matrix" },
  { id: "compliance-hhsc-export", path: "/compliance/hhsc-export" },
  { id: "compliance-part2", path: "/compliance/part2" },
  {
    id: "compliance-regulatory-framework",
    path: "/compliance/regulatory-framework",
  },
  { id: "toolkits-chart-audit", path: "/toolkits/chart-audit" },
  { id: "toolkits-cans", path: "/toolkits/cans" },
  { id: "toolkits", path: "/toolkits" },
  { id: "revenue", path: "/revenue" },
  { id: "revenue-claims", path: "/revenue/claims" },
  { id: "revenue-claim-submission", path: "/revenue/claim-submission" },
  { id: "revenue-denials", path: "/revenue/denials" },
  { id: "authorizations", path: "/authorizations" },
  { id: "revenue-aging", path: "/revenue/aging" },
  { id: "revenue-proof-of-service", path: "/revenue/proof-of-service" },
  { id: "revenue-payer-packets", path: "/revenue/payer-packets" },
  { id: "hr", path: "/hr" },
  { id: "hr-credentials", path: "/hr/credentials" },
  { id: "hr-performance", path: "/hr/performance" },
  { id: "hr-onboarding", path: "/hr/onboarding" },
  { id: "hr-separation", path: "/hr/separation" },
  { id: "hr-module", path: "/hr/module" },
  { id: "hr-layout", path: "/hr/layout" },
  { id: "hr-training", path: "/hr/training" },
  { id: "hr-recruitment", path: "/hr/recruitment" },
  { id: "hr-tracker", path: "/hr/tracker" },
  { id: "hr-screening", path: "/hr/screening" },
  { id: "hr-offers", path: "/hr/offers" },
  { id: "hr-orientation", path: "/hr/orientation" },
  { id: "hr-clearance", path: "/hr/clearance" },
  { id: "hr-compliance", path: "/hr/compliance" },
  { id: "hr-separations", path: "/hr/separations" },
  { id: "hr-credentials-tracker", path: "/hr/credentials-tracker" },
  { id: "hr-training-assignments", path: "/hr/training-assignments" },
  { id: "hr-performance-reviews", path: "/hr/performance-reviews" },
  { id: "hr-onboarding-workflow", path: "/hr/onboarding-workflow" },
  { id: "hr-personnel", path: "/hr/personnel" },
  { id: "hr-credential-tracker", path: "/hr/credential-tracker" },
  { id: "hr-onboarding-flow", path: "/hr/onboarding-flow" },
  { id: "hr-person-personId", path: "/hr/person/:personId" },
  { id: "hr-moduleId", path: "/hr/:moduleId" },
  { id: "executive", path: "/executive" },
  {
    id: "executive-decision-intelligence",
    path: "/executive/decision-intelligence",
  },
  { id: "executive-mgma", path: "/executive/mgma" },
  { id: "executive-strategic-projects", path: "/executive/strategic-projects" },
  { id: "executive-marketing-review", path: "/executive/marketing-review" },
  { id: "gad", path: "/gad" },
  { id: "gad-facilities-work-orders", path: "/gad/facilities-work-orders" },
  { id: "gad-procurement-vendors", path: "/gad/procurement-vendors" },
  {
    id: "gad-safety-emergency-preparedness",
    path: "/gad/safety-emergency-preparedness",
  },
  { id: "gad-transportation-logistics", path: "/gad/transportation-logistics" },
  { id: "gad-regulatory-support", path: "/gad/regulatory-support" },
  { id: "mgma", path: "/mgma" },
  { id: "strategic-projects", path: "/strategic-projects" },
  { id: "site-review", path: "/site-review" },
  { id: "analytics", path: "/analytics" },
  { id: "documents", path: "/documents" },
  { id: "documents-wildcard", path: "/documents/*" },
  { id: "knowledge", path: "/knowledge" },
  {
    id: "knowledge-document-intelligence",
    path: "/knowledge/document-intelligence",
  },
  { id: "operations-hub", path: "/operations-hub" },
  {
    id: "operations-hub-microsoft-integrations",
    path: "/operations-hub/microsoft-integrations",
  },
  {
    id: "operations-hub-mobile-offline",
    path: "/operations-hub/mobile-offline",
  },
  {
    id: "operations-hub-enterprise-demo",
    path: "/operations-hub/enterprise-demo",
  },
  { id: "sop-knowledge", path: "/sop-knowledge" },
  { id: "nil", path: "/nil" },
  { id: "nil-graph", path: "/nil/graph" },
  { id: "workflows", path: "/workflows" },
  {
    id: "workflows-intelligence-assistant",
    path: "/workflows/intelligence-assistant",
  },
  { id: "workflows-my-work-today", path: "/workflows/my-work-today" },
  { id: "workflows-assigned-tasks", path: "/workflows/assigned-tasks" },
  { id: "workflows-attention", path: "/workflows/attention" },
  { id: "workflows-calendar", path: "/workflows/calendar" },
  { id: "workflows-recent-activity", path: "/workflows/recent-activity" },
  { id: "my-work-today", path: "/my-work-today" },
  { id: "onboarding", path: "/onboarding" },
  { id: "onboarding-track", path: "/onboarding/track" },
  {
    id: "onboarding-track-universal-orientation",
    path: "/onboarding/track/universal-orientation",
  },
  { id: "onboarding-track-trackId", path: "/onboarding/track/:trackId" },
  { id: "onboarding-module", path: "/onboarding/module" },
  { id: "onboarding-module-moduleId", path: "/onboarding/module/:moduleId" },
  { id: "onboarding-employee", path: "/onboarding/employee" },
  { id: "onboarding-employee-id", path: "/onboarding/employee/:id" },
  { id: "onboarding-supervisor", path: "/onboarding/supervisor" },
  { id: "onboarding-management", path: "/onboarding/management" },
  { id: "onboarding-evidence", path: "/onboarding/evidence" },
  { id: "onboarding-training", path: "/onboarding/training" },
  { id: "admin-organization", path: "/admin/organization" },
  { id: "admin-access-recovery", path: "/admin/access-recovery" },
  { id: "admin-settings", path: "/admin/settings" },
  { id: "admin-workflow", path: "/admin/workflow" },
  { id: "admin-workflows", path: "/admin/workflows" },
  { id: "admin-entra-id", path: "/admin/entra-id" },
  { id: "admin-enhancement-register", path: "/admin/enhancement-register" },
  { id: "admin-enhancements", path: "/admin/enhancements" },
  { id: "admin-enhancement", path: "/admin/enhancement" },
  { id: "admin-nil-graph", path: "/admin/nil-graph" },
  { id: "admin-entra-sync", path: "/admin/entra-sync" },
  { id: "authorization", path: "/authorization" },
  { id: "my-shift", path: "/my-shift" },
  { id: "meetings-escalations", path: "/meetings-escalations" },
] as const satisfies readonly AppRouteDefinition[];

export type AppRouteId = (typeof APP_ROUTE_REGISTRY)[number]["id"];
export type AppRoutePath = (typeof APP_ROUTE_REGISTRY)[number]["path"];

/** Concrete deep links that intentionally resolve through a dynamic route. */
export const APP_DEEP_LINK_TARGETS = Object.freeze({
  "hr-personnel-files": "/hr/personnel-files",
});

export type AppDeepLinkId = keyof typeof APP_DEEP_LINK_TARGETS;

const routeById = new Map<AppRouteId, AppRoutePath>(
  APP_ROUTE_REGISTRY.map((route) => [route.id, route.path]),
);

export function appRoutePath(id: AppRouteId): AppRoutePath {
  const path = routeById.get(id);
  if (!path) throw new Error(`Unknown application route id: ${id}`);
  return path;
}

export function appDeepLinkPath(id: AppDeepLinkId): string {
  return APP_DEEP_LINK_TARGETS[id];
}

export const APP_SHELL_BOUNDARY_PATHS = Object.freeze({
  login: "/login",
  fallback: "*",
});
