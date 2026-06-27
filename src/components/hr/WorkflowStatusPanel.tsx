import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import {
  Zap,
  ToggleLeft,
  ToggleRight,
  Workflow,
  Bell,
  ArrowRight,
  Shield,
  FileText,
  GraduationCap,
} from "lucide-react";

// ─── Static fallback rules ───────────────────────────────────

const STATIC_RULES = [
  { id: "wf-hr-status-change", name: "HR Status Changed", event: "hr.status-changed", category: "HR", enabled: true, condition: null as string | null, actions: [{ type: "notify", target: "hr-director", priority: "normal" }] },
  { id: "wf-hr-person-created", name: "New Person Added", event: "hr.person-created", category: "HR", enabled: true, condition: null, actions: [{ type: "notify", target: "hr-director", priority: "normal" }] },
  { id: "wf-offer-accepted", name: "Offer Accepted", event: "hr.status-changed", category: "HR", enabled: true, condition: "offers → o-accepted", actions: [{ type: "notify", target: "hr-director", priority: "high" }] },
  { id: "wf-cleared-for-duty", name: "Cleared for Duty", event: "hr.status-changed", category: "HR", enabled: true, condition: "clearance → c-cleared", actions: [{ type: "notify", target: "hr-director", priority: "high" }, { type: "notify", target: "supervisor", priority: "normal" }] },
  { id: "wf-credential-expired", name: "Credential Expired", event: "hr.status-changed", category: "HR", enabled: true, condition: "credentials → cr-expired", actions: [{ type: "notify", target: "qa-officer", priority: "urgent" }, { type: "notify", target: "hr-director", priority: "urgent" }] },
  { id: "wf-doc-uploaded", name: "Document Uploaded", event: "document.uploaded", category: "Documents", enabled: true, condition: null, actions: [{ type: "notify", target: "hr-director", priority: "low" }] },
  { id: "wf-doc-verified", name: "Document Verified", event: "document.verified", category: "Documents", enabled: true, condition: null, actions: [{ type: "notify", target: "self", priority: "normal" }] },
  { id: "wf-doc-rejected", name: "Document Rejected", event: "document.rejected", category: "Documents", enabled: true, condition: null, actions: [{ type: "notify", target: "self", priority: "high" }, { type: "notify", target: "hr-director", priority: "normal" }] },
  { id: "wf-training-completed", name: "Training Completed", event: "training.completed", category: "Training", enabled: true, condition: null, actions: [{ type: "notify", target: "self", priority: "normal" }, { type: "notify", target: "supervisor", priority: "normal" }] },
];

export function WorkflowStatusPanel() {
  const { data: apiRules } = trpc.workflow.listRules.useQuery();
  const { data: apiEventTypes } = trpc.workflow.getEventTypes.useQuery();
  const [rules, setRules] = useState(STATIC_RULES);
  const [isLoading, setIsLoading] = useState(true);

  // Use API data if available, otherwise fall back to static
  useEffect(() => {
    if (apiRules && apiRules.length > 0) {
      const mapped = apiRules.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name),
        event: String(r.event),
        category: apiEventTypes?.find((e: Record<string, unknown>) => e.event === r.event)?.category as string || "Other",
        enabled: !!r.enabled,
        condition: r.condition ? JSON.stringify(r.condition) : null,
        actions: (r.actions as Array<Record<string, unknown>> || []).map((a) => ({
          type: String(a.type),
          target: String(a.target),
          priority: String(a.priority),
        })),
      }));
      setRules(mapped);
    }
    setIsLoading(false);
  }, [apiRules, apiEventTypes]);

  // Group rules by category
  const byCategory: Record<string, typeof rules> = {};
  for (const rule of rules) {
    if (!byCategory[rule.category]) byCategory[rule.category] = [];
    byCategory[rule.category].push(rule);
  }

  const categoryOrder = ["HR", "Documents", "Training"];
  const categoryIcon: Record<string, typeof Zap> = {
    HR: Shield,
    Documents: FileText,
    Training: GraduationCap,
    Other: Zap,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
          <Workflow size={16} style={{ color: "#245C5A" }} />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            Workflow Engine
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {rules.filter((r) => r.enabled).length} of {rules.length} rules active
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-6">
          <div className="w-5 h-5 border-2 border-[#245C5A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[11px] text-muted-foreground mt-2">Loading rules...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categoryOrder.map((cat) => {
            const catRules = byCategory[cat];
            if (!catRules || catRules.length === 0) return null;
            const Icon = categoryIcon[cat] || Zap;

            return (
              <div key={cat} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border, #E2E8F0)" }}>
                {/* Category header */}
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid var(--card-border, #E2E8F0)" }}
                >
                  <Icon size={13} style={{ color: "#245C5A" }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#64748B" }}>
                    {cat}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                    {catRules.filter((r) => r.enabled).length} active
                  </span>
                </div>

                {/* Rules */}
                <div className="divide-y" style={{ borderColor: "var(--card-border, #E2E8F0)" }}>
                  {catRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-gray-50/50"
                    >
                      {rule.enabled ? (
                        <ToggleRight size={16} className="shrink-0 mt-0.5" style={{ color: "#059669" }} />
                      ) : (
                        <ToggleLeft size={16} className="shrink-0 mt-0.5" style={{ color: "#94A3B8" }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>
                            {rule.name}
                          </p>
                          {rule.condition && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                              conditional
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          On: {rule.event}
                        </p>
                        {/* Actions */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {rule.actions.map((action, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor:
                                  action.priority === "urgent"
                                    ? "#FEF2F2"
                                    : action.priority === "high"
                                    ? "#FFFBEB"
                                    : "#F1F5F9",
                                color:
                                  action.priority === "urgent"
                                    ? "#DC2626"
                                    : action.priority === "high"
                                    ? "#D97706"
                                    : "#64748B",
                              }}
                            >
                              <Bell size={8} />
                              {action.target}
                              {action.priority && (
                                <span className="opacity-70">· {action.priority}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <ToggleRight size={12} style={{ color: "#059669" }} /> Active
        </span>
        <span className="flex items-center gap-1">
          <ToggleLeft size={12} style={{ color: "#94A3B8" }} /> Inactive
        </span>
        <span className="flex items-center gap-1">
          <ArrowRight size={12} /> Auto-triggers notification
        </span>
      </div>
    </div>
  );
}
