import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { Globe } from "lucide-react";

export function MarketingSiteReviewPage() {
  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EC4899" }}>
            <Globe size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Marketing Site Review</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Website content review and marketing material approval</p>
          </div>
        </div>
        <div className="rounded-lg border p-6 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <p style={{ color: "var(--topbar-subtitle)" }}>Marketing site review module coming soon.</p>
        </div>
      </div>
    </AppShell>
  );
}
