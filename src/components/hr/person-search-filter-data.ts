import { useMemo } from "react";
import { useHR } from "@/context/hr-context";

export interface FilterState {
  search: string;
  lane: string;
  department: string;
  supervisor: string;
  moduleId: string;
  statusId: string;
}

export function useFilteredPeople(filters: FilterState) {
  const { people } = useHR();
  return useMemo(() => {
    return people.filter((person) => {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        person.firstName.toLowerCase().includes(searchLower) ||
        person.lastName.toLowerCase().includes(searchLower) ||
        `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchLower) ||
        (person.employeeId || "").toLowerCase().includes(searchLower) ||
        person.role.toLowerCase().includes(searchLower);
      const matchesLane = filters.lane === "all" || person.lane === filters.lane;
      const matchesDepartment =
        filters.department === "all" || person.department === filters.department;
      const matchesSupervisor =
        filters.supervisor === "all" || person.supervisor === filters.supervisor;
      const matchesModule =
        !filters.moduleId ||
        !filters.statusId ||
        person.moduleStatuses[filters.moduleId] === filters.statusId;
      return (
        matchesSearch &&
        matchesLane &&
        matchesDepartment &&
        matchesSupervisor &&
        matchesModule
      );
    });
  }, [people, filters]);
}
