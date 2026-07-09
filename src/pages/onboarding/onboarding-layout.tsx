import { Outlet, useLocation } from "react-router-dom";
import { Breadcrumb } from "@/components/shell/nav-breadcrumb";
import { HeroBanner } from "@/components/shell/hero-banner";
import { heroConfigs } from "@/data/navData";

export function OnboardingLayout() {
  const location = useLocation();
  const path = location.pathname;

  // Find hero config based on path
  let heroConfig = heroConfigs[path];
  if (!heroConfig) {
    // Check for dynamic routes
    if (path.startsWith("/onboarding/module")) {
      heroConfig = heroConfigs["/onboarding/module"];
    } else if (path.startsWith("/onboarding/employee")) {
      heroConfig = heroConfigs["/onboarding/employee"];
    } else {
      heroConfig = heroConfigs["/onboarding"];
    }
  }

  return (
    <>
      <Breadcrumb path={path} />
      <HeroBanner config={heroConfig} />
      <Outlet />
    </>
  );
}

export default OnboardingLayout;
