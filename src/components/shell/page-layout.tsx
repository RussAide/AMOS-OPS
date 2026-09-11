import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bot } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { heroConfigs } from "@/data/navData";
import { appRoutePath } from "@/data/app-route-registry";
import { Breadcrumb } from "./nav-breadcrumb";
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

const ASK_AMOS_LAUNCHER_PATH = appRoutePath(
  "workflows-intelligence-assistant",
);

function shouldShowAskAmosLauncher(path: string): boolean {
  return (
    path === appRoutePath("workflows-my-work-today") ||
    path === appRoutePath("my-work-today")
  );
}

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
  const showAskAmosLauncher = shouldShowAskAmosLauncher(path);

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

      {/* My Work primary launcher */}
      {showAskAmosLauncher && (
        <section
          aria-label="Ask AMOS"
          data-testid="ask-amos-launcher"
          className="px-4 pt-4 md:px-6"
        >
          <div
            className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
            style={{
              background:
                "linear-gradient(135deg, rgba(36,92,90,0.10) 0%, rgba(126,200,202,0.08) 100%)",
              borderColor: "rgba(36,92,90,0.25)",
            }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "#245C5A", color: "#FFFFFF" }}
              >
                <Bot size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-[15px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Ask AMOS
                </h2>
                <p
                  className="mt-0.5 text-[12px] leading-relaxed"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Retrieve live SharePoint records directly from your My Work
                  workspace.
                </p>
              </div>
            </div>
            <Link
              to={ASK_AMOS_LAUNCHER_PATH}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 md:w-auto"
              style={{ backgroundColor: "#245C5A" }}
            >
              Open Ask AMOS
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {/* Page Content */}
      <div className={showHero ? "mt-0" : "mt-4"}>{children}</div>
    </motion.div>
  );
}
