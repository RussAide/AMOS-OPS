import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { heroConfigs } from "@/data/navData";
import { Breadcrumb } from "./breadcrumb";
import { HeroBanner } from "./hero-banner";

interface PageLayoutProps {
  children: ReactNode;
  category?: string;
  title?: string;
  subtitle?: string;
  hideHero?: boolean;
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export function PageLayout({
  children,
  category,
  title,
  subtitle,
  hideHero = false,
}: PageLayoutProps) {
  const location = useLocation();
  const path = location.pathname;

  // Look up hero config from navData
  const config = heroConfigs[path];
  const resolvedCategory = category ?? config?.category ?? "";
  const resolvedTitle = title ?? config?.title ?? "";
  const resolvedSubtitle = subtitle ?? config?.subtitle ?? "";

  const showHero = !hideHero && resolvedTitle;

  return (
    <motion.div
      key={path}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Breadcrumb */}
      <Breadcrumb path={path} />

      {/* Hero Banner */}
      {showHero && (
        <HeroBanner
          config={{
            category: resolvedCategory,
            title: resolvedTitle,
            subtitle: resolvedSubtitle,
          }}
        />
      )}

      {/* Page Content */}
      <div className={showHero ? "mt-0" : "mt-4"}>{children}</div>
    </motion.div>
  );
}
