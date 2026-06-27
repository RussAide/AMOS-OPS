import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--content-bg)" }}>
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-screen ml-[240px]">
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
