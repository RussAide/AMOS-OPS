import { describe, expect, it } from "vitest";

import {
  mayUseHrDemoData,
  mergeModuleStatuses,
  resolveHrCollection,
} from "./hr-context";

describe("RM.1 HR production data boundary", () => {
  it("permits demo fixtures only in evaluation or the training workspace", () => {
    expect(mayUseHrDemoData(false, "operational")).toBe(false);
    expect(mayUseHrDemoData(false, null)).toBe(false);
    expect(mayUseHrDemoData(false, "training")).toBe(true);
    expect(mayUseHrDemoData(true, "operational")).toBe(true);
  });

  it("keeps an empty or unavailable authoritative Production response empty", () => {
    const demo = [{ id: "synthetic-person" }];

    expect(resolveHrCollection(undefined, demo, false)).toEqual([]);
    expect(resolveHrCollection([], demo, false)).toEqual([]);
  });

  it("allows an explicitly isolated demo workspace to use its fixture fallback", () => {
    const demo = [{ id: "synthetic-person" }];

    expect(resolveHrCollection(undefined, demo, true)).toEqual(demo);
    expect(resolveHrCollection([], demo, true)).toEqual(demo);
  });

  it("does not invent missing module statuses for authoritative Production people", () => {
    const people = [
      {
        id: "person-1",
        firstName: "Authoritative",
        lastName: "Person",
        employeeId: null,
        role: "Employee",
        department: "Operations",
        lane: "management",
        isActive: true,
        isEmployee: true,
        hireDate: null,
        supervisor: null,
        createdAt: null,
      },
    ];

    const [productionPerson] = mergeModuleStatuses(people, [], false);
    const [demoPerson] = mergeModuleStatuses(people, [], true);

    expect(productionPerson.moduleStatuses).toEqual({});
    expect(Object.keys(demoPerson.moduleStatuses).length).toBeGreaterThan(0);
    expect(Object.values(demoPerson.moduleStatuses)).toContain("pending");
  });
});
