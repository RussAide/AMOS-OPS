import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Sparkles,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { authorizeClientRoute } from "@/constants/access-control";
import { useAuth } from "@/hooks/use-auth";

interface FooterDestination {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

function pathMatches(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const PRIMARY_DESTINATIONS: FooterDestination[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    id: "my-work",
    label: "My Work",
    href: "/workflows/my-work-today",
    icon: ClipboardList,
  },
  {
    id: "ask-amos",
    label: "Ask AMOS",
    href: "/workflows/intelligence-assistant",
    icon: Sparkles,
  },
  {
    id: "clinical",
    label: "Clinical",
    href: "/clinical",
    icon: Stethoscope,
  },
];

const MORE_DESTINATIONS: FooterDestination[] = [
  {
    id: "operations-hub",
    label: "Operations Hub",
    href: "/operations-hub",
    icon: LayoutDashboard,
    description: "Enterprise operations and governed integrations",
  },
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: FileText,
    description: "Document Studio and controlled publishing",
  },
  {
    id: "hr",
    label: "HR",
    href: "/hr",
    icon: Users,
    description: "Workforce command and personnel operations",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Authorized system settings",
  },
];

export function UniversalFooterNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const moreDestinations = useMemo(
    () =>
      MORE_DESTINATIONS.filter((item) =>
        authorizeClientRoute(currentRole, item.href).allowed,
      ),
    [currentRole],
  );

  const primaryDestinations = useMemo(
    () =>
      PRIMARY_DESTINATIONS.filter((item) =>
        authorizeClientRoute(currentRole, item.href).allowed,
      ),
    [currentRole],
  );

  const moreIsActive = moreDestinations.some((item) =>
    pathMatches(item.href, location.pathname),
  );

  useEffect(() => {
    if (!moreOpen) return;
    sheetRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        requestAnimationFrame(() => moreButtonRef.current?.focus());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moreOpen]);

  const go = (href: string) => {
    setMoreOpen(false);
    navigate(href);
  };

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-5 border-t border-slate-200/80 bg-white/95 px-2 pt-1.5 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
        style={{
          paddingBottom: "calc(0.4rem + env(safe-area-inset-bottom))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        {primaryDestinations.slice(0, 4).map((item) => {
          const active = pathMatches(item.href, location.pathname);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={`${item.label} mobile navigation`}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border-none px-1 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7EC8CA] focus-visible:ring-offset-1"
              style={{
                color: active ? "#123C3A" : "#64748B",
                backgroundColor: active ? "rgba(126,200,202,0.14)" : "transparent",
              }}
              onClick={() => go(item.href)}
            >
              <Icon size={19} aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}

        <button
          ref={moreButtonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-label="More mobile navigation"
          className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border-none px-1 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7EC8CA] focus-visible:ring-offset-1"
          style={{
            color: moreOpen || moreIsActive ? "#123C3A" : "#64748B",
            backgroundColor:
              moreOpen || moreIsActive ? "rgba(126,200,202,0.14)" : "transparent",
          }}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close more navigation"
            className="fixed inset-0 z-[61] border-none bg-black/45 lg:hidden"
            onClick={() => {
              setMoreOpen(false);
              requestAnimationFrame(() => moreButtonRef.current?.focus());
            }}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-[62] max-h-[78vh] overflow-y-auto rounded-t-[24px] border border-b-0 border-slate-200 bg-white px-4 pt-2 shadow-[0_-28px_70px_rgba(15,23,42,0.24)] outline-none dark:border-slate-800 dark:bg-slate-950 lg:hidden"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  AMOS-OPS
                </p>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  More
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close more navigation"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7EC8CA] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                onClick={() => {
                  setMoreOpen(false);
                  requestAnimationFrame(() => moreButtonRef.current?.focus());
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-2">
              {moreDestinations.map((item) => {
                const active = pathMatches(item.href, location.pathname);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7EC8CA] dark:border-slate-800 dark:bg-slate-900"
                    style={{
                      borderColor: active ? "#7EC8CA" : undefined,
                    }}
                    onClick={() => go(item.href)}
                  >
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: active
                          ? "rgba(126,200,202,0.18)"
                          : "rgba(100,116,139,0.10)",
                        color: active ? "#245C5A" : "#64748B",
                      }}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
