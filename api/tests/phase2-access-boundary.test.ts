import { describe, expect, it } from "vitest";
import { authorizeClientRoute, procedureAccessResource, authorizeAccess } from "../../src/constants/access-control";

describe("Phase 2 explicit access boundaries", () => {
  it("maps each module to its authoritative department or division", () => {
    expect(procedureAccessResource("m22.dashboard", "query")).toMatchObject({ domain: "clinical", division: "bhc", department: "mhtcm", action: "read" });
    expect(procedureAccessResource("m23.dashboard", "query")).toMatchObject({ domain: "clinical", division: "bhc", department: "mhrs", action: "read" });
    expect(procedureAccessResource("m24.dashboard", "query")).toMatchObject({ domain: "gro", division: "gro", action: "read" });
  });

  it("allows the intended frontline module personas", () => {
    expect(authorizeAccess({ role: "case-manager" }, procedureAccessResource("m22.createEncounter", "mutation")! ).allowed).toBe(true);
    expect(authorizeAccess({ role: "therapist" }, procedureAccessResource("m23.createSession", "mutation")! ).allowed).toBe(true);
    expect(authorizeAccess({ role: "shift-supervisor" }, procedureAccessResource("m24.createShift", "mutation")! ).allowed).toBe(true);
  });

  it("keeps department boundaries and explicit client routes", () => {
    expect(authorizeClientRoute("case-manager", "/mhtcm").allowed).toBe(true);
    expect(authorizeClientRoute("therapist", "/mhrs").allowed).toBe(true);
    expect(authorizeClientRoute("shift-supervisor", "/gro/residential-operations").allowed).toBe(true);
    expect(authorizeClientRoute("therapist", "/mhtcm").allowed).toBe(false);
  });
});
