import { useMemo, useState } from "react";
import { useHR } from "@/context/hr-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import type { FilterState } from "./person-search-filter-data";

interface Props {
  onFilterChange: (filters: FilterState) => void;
}

export function PersonSearchFilter({ onFilterChange }: Props) {
  const { people } = useHR();
  const [search, setSearch] = useState("");
  const [lane, setLane] = useState("all");
  const [department, setDepartment] = useState("all");
  const [supervisor, setSupervisor] = useState("all");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract unique values from people
  const departments = useMemo(
    () => [...new Set(people.map((p) => p.department))].sort(),
    [people]
  );
  const supervisors = useMemo(
    () => [...new Set(people.map((p) => p.supervisor).filter(Boolean))].sort() as string[],
    [people]
  );

  const activeFilterCount = [
    search,
    lane !== "all" ? lane : "",
    department !== "all" ? department : "",
    supervisor !== "all" ? supervisor : "",
  ].filter(Boolean).length;

  const handleChange = (updates: Partial<FilterState>) => {
    const current: FilterState = {
      search: updates.search !== undefined ? updates.search : search,
      lane: updates.lane !== undefined ? updates.lane : lane,
      department: updates.department !== undefined ? updates.department : department,
      supervisor: updates.supervisor !== undefined ? updates.supervisor : supervisor,
      moduleId: "",
      statusId: "",
    };
    onFilterChange(current);
  };

  const clearAll = () => {
    setSearch("");
    setLane("all");
    setDepartment("all");
    setSupervisor("all");
    onFilterChange({ search: "", lane: "all", department: "all", supervisor: "all", moduleId: "", statusId: "" });
  };

  return (
    <div className="space-y-2">
      {/* Primary search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); handleChange({ search: e.target.value }); }}
            placeholder="Search by name, employee ID, or role..."
            className="pl-8 text-sm h-9"
          />
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            showAdvanced || activeFilterCount > 0
              ? "border-[#245C5A] bg-[#F0FDFA] text-[#245C5A]"
              : "border-input bg-background hover:bg-accent"
          }`}
        >
          <Filter size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-[#245C5A] text-white text-[9px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-red-600 flex items-center gap-1 px-2">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-md bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lane</span>
            <Select value={lane} onValueChange={(v) => { setLane(v); handleChange({ lane: v }); }}>
              <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lanes</SelectItem>
                <SelectItem value="activation">Activation</SelectItem>
                <SelectItem value="management">Management</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Department</span>
            <Select value={department} onValueChange={(v) => { setDepartment(v); handleChange({ department: v }); }}>
              <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Supervisor</span>
            <Select value={supervisor} onValueChange={(v) => { setSupervisor(v); handleChange({ supervisor: v }); }}>
              <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Supervisors</SelectItem>
                {supervisors.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
