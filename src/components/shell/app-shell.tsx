import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import { AskAmosPanel } from "@/components/help/AskAmosPanel";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--content-bg)" }}>
      {/* ─── Desktop Sidebar (always visible on lg+) ─── */}
      <div className="hidden lg:block">
        <AppSidebar mobile={false} onNavigate={() => {}} />
      </div>

      {/* ─── Mobile Sidebar (overlay, toggleable) ─── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Slide-in sidebar */}
          <div className="fixed left-0 top-0 h-screen z-[70] lg:hidden animate-slideIn">
            <AppSidebar mobile={true} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col min-h-screen lg:ml-[240px]">
        <TopBar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          menuOpen={sidebarOpen}
        />
        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* ─── Help Panel — accessible from every page ─── */}
      <AskAmosPanel />
    </div>
  );
}
