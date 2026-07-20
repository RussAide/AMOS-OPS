import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

/* ─── Types ─────────────────────────────────────────────── */

export interface WorkTaskFilterItem {
  id: string;
  task_title: string;
  task_type: string;
  assigned_to: string;
  priority: string;
  status: string;
  due_date: string;
  workflowCode?: string;
  workflowName?: string;
  isOverdue?: boolean;
  [key: string]: unknown;
}

export interface WorkTaskFiltersState {
  workflows: string[];
  priority: "all" | "high" | "medium" | "low";
  dueDate: "all" | "overdue" | "today" | "this-week" | "this-month";
  assignment: "all" | "me" | "my-team";
}

interface WorkTaskFiltersProps {
  tasks: WorkTaskFilterItem[];
  onFilterChange: (filtered: WorkTaskFilterItem[]) => void;
  currentUserName?: string;
  teamMembers?: string[];
}

/* ─── Workflow Definitions ──────────────────────────────── */

const WORKFLOW_OPTIONS = [
  { code: "WF-001", label: "Referral Intake" },
  { code: "WF-002", label: "Clinical Assessment" },
  { code: "WF-003", label: "Service Delivery" },
  { code: "WF-004", label: "GRO Shift Ops" },
  { code: "WF-005", label: "Incident Reporting" },
  { code: "WF-006", label: "CAP/Audit Readiness" },
  { code: "WF-007", label: "Billing Gate" },
  { code: "WF-008", label: "Executive Decision Routing" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

const DUE_DATE_OPTIONS = [
  { value: "all", label: "All Dates" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "this-week", label: "Due This Week" },
  { value: "this-month", label: "Due This Month" },
] as const;

const ASSIGNMENT_OPTIONS = [
  { value: "all", label: "All Assignments" },
  { value: "me", label: "Assigned to Me" },
  { value: "my-team", label: "Assigned to My Team" },
] as const;

/* ─── Date Helpers ──────────────────────────────────────── */

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isThisWeek(date: Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return date >= startOfWeek && date <= endOfWeek;
}

function isThisMonth(date: Date): boolean {
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/* ─── Component ─────────────────────────────────────────── */

export function WorkTaskFilters({
  tasks,
  onFilterChange,
  currentUserName = "Current User",
  teamMembers = [],
}: WorkTaskFiltersProps) {
  const [filters, setFilters] = useState<WorkTaskFiltersState>({
    workflows: [],
    priority: "all",
    dueDate: "all",
    assignment: "all",
  });

  /* Track which filter sections are open */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    workflow: true,
    priority: true,
    dueDate: true,
    assignment: true,
  });

  /* Mobile sheet open state */
  const [mobileOpen, setMobileOpen] = useState(false);

  /*
   * Parent pages may supply an equivalent inline array on each render. Use a
   * value-stable assignment set so the filtered result does not change merely
   * because the array identity changed; otherwise the notification effect can
   * repeatedly update the parent after live data resolves.
   */
  const teamMembersKey = teamMembers.join("\u0000");
  const assignmentTeam = useMemo(
    () =>
      new Set(
        teamMembersKey.length > 0
          ? teamMembersKey.split("\u0000")
          : [currentUserName],
      ),
    [currentUserName, teamMembersKey],
  );

  /* ─── Filter Logic ─── */
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      /* Workflow filter */
      if (filters.workflows.length > 0) {
        const taskWfCode = task.workflowCode || "WF-000";
        if (!filters.workflows.includes(taskWfCode)) return false;
      }

      /* Priority filter */
      if (filters.priority !== "all") {
        const taskPriority = task.priority?.toLowerCase() || "";
        /* Map "urgent" to "high" for grouping */
        const normalizedPriority =
          taskPriority === "urgent" ? "high" : taskPriority;
        if (normalizedPriority !== filters.priority) return false;
      }

      /* Due date filter */
      if (filters.dueDate !== "all") {
        const dueDate = new Date(task.due_date);
        if (filters.dueDate === "overdue") {
          if (task.isOverdue !== true) return false;
        } else if (filters.dueDate === "today") {
          if (!isToday(dueDate)) return false;
        } else if (filters.dueDate === "this-week") {
          if (!isThisWeek(dueDate)) return false;
        } else if (filters.dueDate === "this-month") {
          if (!isThisMonth(dueDate)) return false;
        }
      }

      /* Assignment filter */
      if (filters.assignment !== "all") {
        const assignee = task.assigned_to || "";
        if (filters.assignment === "me") {
          if (assignee !== currentUserName) return false;
        } else if (filters.assignment === "my-team") {
          /* My Team = supplied list OR the signed-in user fallback. */
          if (!assignmentTeam.has(assignee)) return false;
        }
      }

      return true;
    });
  }, [assignmentTeam, currentUserName, filters, tasks]);

  /* Notify parent when filtered result changes */
  useEffect(() => {
    onFilterChange(filteredTasks);
  }, [filteredTasks, onFilterChange]);

  /* ─── Active Filter Count ─── */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.workflows.length > 0) count += 1;
    if (filters.priority !== "all") count += 1;
    if (filters.dueDate !== "all") count += 1;
    if (filters.assignment !== "all") count += 1;
    return count;
  }, [filters]);

  /* ─── Handlers ─── */
  const toggleWorkflow = useCallback((code: string) => {
    setFilters((prev) => {
      const has = prev.workflows.includes(code);
      return {
        ...prev,
        workflows: has
          ? prev.workflows.filter((c) => c !== code)
          : [...prev.workflows, code],
      };
    });
  }, []);

  const selectAllWorkflows = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      workflows:
        prev.workflows.length === WORKFLOW_OPTIONS.length
          ? []
          : WORKFLOW_OPTIONS.map((w) => w.code),
    }));
  }, []);

  const setPriority = useCallback(
    (value: WorkTaskFiltersState["priority"]) => {
      setFilters((prev) => ({ ...prev, priority: value }));
    },
    []
  );

  const setDueDate = useCallback(
    (value: WorkTaskFiltersState["dueDate"]) => {
      setFilters((prev) => ({ ...prev, dueDate: value }));
    },
    []
  );

  const setAssignment = useCallback(
    (value: WorkTaskFiltersState["assignment"]) => {
      setFilters((prev) => ({ ...prev, assignment: value }));
    },
    []
  );

  const clearAll = useCallback(() => {
    setFilters({
      workflows: [],
      priority: "all",
      dueDate: "all",
      assignment: "all",
    });
  }, []);

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /* ─── Render Helpers ─── */
  const renderWorkflowFilters = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>
          Workflow
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={selectAllWorkflows}
        >
          {filters.workflows.length === WORKFLOW_OPTIONS.length
            ? "Clear All"
            : "Select All"}
        </Button>
      </div>
      <div className="space-y-1.5">
        {WORKFLOW_OPTIONS.map((wf) => (
          <div
            key={wf.code}
            className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/50 cursor-pointer"
            onClick={() => toggleWorkflow(wf.code)}
          >
            <Checkbox
              id={`wf-${wf.code}`}
              checked={filters.workflows.includes(wf.code)}
              onCheckedChange={() => toggleWorkflow(wf.code)}
              className="size-3.5"
            />
            <label
              htmlFor={`wf-${wf.code}`}
              className="text-[11px] cursor-pointer flex-1 leading-tight"
              style={{ color: "var(--topbar-title)" }}
            >
              {wf.label}
            </label>
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {wf.code}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPriorityFilters = () => (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>
        Priority
      </Label>
      <RadioGroup
        value={filters.priority}
        onValueChange={(v) => setPriority(v as WorkTaskFiltersState["priority"])}
        className="gap-1.5"
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/50 cursor-pointer"
            onClick={() => setPriority(opt.value as WorkTaskFiltersState["priority"])}>
            <RadioGroupItem value={opt.value} id={`prio-${opt.value}`} className="size-3.5" />
            <label
              htmlFor={`prio-${opt.value}`}
              className="text-[11px] cursor-pointer flex-1"
              style={{ color: "var(--topbar-title)" }}
            >
              {opt.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderDueDateFilters = () => (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>
        Due Date
      </Label>
      <RadioGroup
        value={filters.dueDate}
        onValueChange={(v) => setDueDate(v as WorkTaskFiltersState["dueDate"])}
        className="gap-1.5"
      >
        {DUE_DATE_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/50 cursor-pointer"
            onClick={() => setDueDate(opt.value as WorkTaskFiltersState["dueDate"])}>
            <RadioGroupItem value={opt.value} id={`due-${opt.value}`} className="size-3.5" />
            <label
              htmlFor={`due-${opt.value}`}
              className="text-[11px] cursor-pointer flex-1"
              style={{ color: "var(--topbar-title)" }}
            >
              {opt.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderAssignmentFilters = () => (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>
        Assignment
      </Label>
      <RadioGroup
        value={filters.assignment}
        onValueChange={(v) =>
          setAssignment(v as WorkTaskFiltersState["assignment"])
        }
        className="gap-1.5"
      >
        {ASSIGNMENT_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/50 cursor-pointer"
            onClick={() => setAssignment(opt.value as WorkTaskFiltersState["assignment"])}>
            <RadioGroupItem value={opt.value} id={`asgn-${opt.value}`} className="size-3.5" />
            <label
              htmlFor={`asgn-${opt.value}`}
              className="text-[11px] cursor-pointer flex-1"
              style={{ color: "var(--topbar-title)" }}
            >
              {opt.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderActiveFilterBadges = () => {
    if (activeFilterCount === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {filters.workflows.length > 0 &&
          filters.workflows.map((code) => {
            const label =
              WORKFLOW_OPTIONS.find((w) => w.code === code)?.label || code;
            return (
              <Badge
                key={code}
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
                style={{ borderColor: "#245C5A", color: "#245C5A" }}
                onClick={() => toggleWorkflow(code)}
              >
                {label}
                <X size={10} />
              </Badge>
            );
          })}
        {filters.priority !== "all" && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
            style={{ borderColor: "#D97706", color: "#D97706" }}
            onClick={() => setPriority("all")}
          >
            Priority: {filters.priority}
            <X size={10} />
          </Badge>
        )}
        {filters.dueDate !== "all" && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
            style={{ borderColor: "#2563EB", color: "#2563EB" }}
            onClick={() => setDueDate("all")}
          >
            {
              DUE_DATE_OPTIONS.find((d) => d.value === filters.dueDate)
                ?.label
            }
            <X size={10} />
          </Badge>
        )}
        {filters.assignment !== "all" && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
            style={{ borderColor: "#7C3AED", color: "#7C3AED" }}
            onClick={() => setAssignment("all")}
          >
            {
              ASSIGNMENT_OPTIONS.find((a) => a.value === filters.assignment)
                ?.label
            }
            <X size={10} />
          </Badge>
        )}
      </div>
    );
  };

  const renderFilterContent = () => (
    <div className="space-y-4">
      {/* Active filter badges */}
      {renderActiveFilterBadges()}

      {/* Clear all button */}
      {activeFilterCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-[11px] h-8"
          onClick={clearAll}
        >
          <X size={12} className="mr-1" />
          Clear All Filters
        </Button>
      )}

      {/* Workflow Section */}
      <Collapsible
        open={openSections.workflow}
        onOpenChange={() => toggleSection("workflow")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            Workflow Type
          </span>
          {openSections.workflow ? (
            <ChevronUp size={14} style={{ color: "var(--topbar-subtitle)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--topbar-subtitle)" }} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {renderWorkflowFilters()}
        </CollapsibleContent>
      </Collapsible>

      <div className="border-t" style={{ borderColor: "var(--card-border)" }} />

      {/* Priority Section */}
      <Collapsible
        open={openSections.priority}
        onOpenChange={() => toggleSection("priority")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            Priority
          </span>
          {openSections.priority ? (
            <ChevronUp size={14} style={{ color: "var(--topbar-subtitle)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--topbar-subtitle)" }} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {renderPriorityFilters()}
        </CollapsibleContent>
      </Collapsible>

      <div className="border-t" style={{ borderColor: "var(--card-border)" }} />

      {/* Due Date Section */}
      <Collapsible
        open={openSections.dueDate}
        onOpenChange={() => toggleSection("dueDate")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            Due Date
          </span>
          {openSections.dueDate ? (
            <ChevronUp size={14} style={{ color: "var(--topbar-subtitle)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--topbar-subtitle)" }} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {renderDueDateFilters()}
        </CollapsibleContent>
      </Collapsible>

      <div className="border-t" style={{ borderColor: "var(--card-border)" }} />

      {/* Assignment Section */}
      <Collapsible
        open={openSections.assignment}
        onOpenChange={() => toggleSection("assignment")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            Assignment
          </span>
          {openSections.assignment ? (
            <ChevronUp size={14} style={{ color: "var(--topbar-subtitle)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--topbar-subtitle)" }} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {renderAssignmentFilters()}
        </CollapsibleContent>
      </Collapsible>

      {/* Result count */}
      <div className="pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
        <p className="text-[11px] text-center" style={{ color: "var(--topbar-subtitle)" }}>
          Showing <strong style={{ color: "var(--topbar-title)" }}>{filteredTasks.length}</strong> of{" "}
          <strong style={{ color: "var(--topbar-title)" }}>{tasks.length}</strong> tasks
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Sheet-based filter panel */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 mb-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-[12px] h-9"
              >
                <SlidersHorizontal size={14} className="mr-1.5" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge
                    className="ml-1.5 text-[10px] px-1.5 py-0"
                    style={{ backgroundColor: "#245C5A", color: "white" }}
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[340px] p-4 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-[14px] flex items-center gap-2">
                  <Filter size={16} style={{ color: "#245C5A" }} />
                  Filter Tasks
                </SheetTitle>
              </SheetHeader>
              {renderFilterContent()}
              <SheetClose asChild>
                <Button
                  className="mt-4 w-full text-[12px] h-9"
                  style={{ backgroundColor: "#245C5A" }}
                >
                  Apply Filters
                </Button>
              </SheetClose>
            </SheetContent>
          </Sheet>

          {/* Inline active badges on mobile */}
          {renderActiveFilterBadges()}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-7 px-2"
              onClick={clearAll}
            >
              <X size={10} className="mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Desktop: Sidebar filter panel */}
      <div className="hidden lg:block">
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter size={14} style={{ color: "#245C5A" }} />
              <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                Filters
              </span>
              {activeFilterCount > 0 && (
                <Badge
                  className="text-[10px] px-1.5 py-0"
                  style={{ backgroundColor: "#245C5A", color: "white" }}
                >
                  {activeFilterCount}
                </Badge>
              )}
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-7 px-2"
                onClick={clearAll}
              >
                <X size={10} className="mr-1" />
                Clear
              </Button>
            )}
          </div>

          {renderFilterContent()}
        </div>
      </div>
    </>
  );
}

export default WorkTaskFilters;
