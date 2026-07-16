import { describe, expect, it } from "vitest";
import { ALL_ROLES } from "@/constants/roles";
import {
  authorizeAccess,
  authorizeClientRoute,
  procedureAccessResource,
} from "@/constants/access-control";
import { M41B_AUTHORIZED_ROLES } from "@contracts/m41b";

describe("M4.1B universal governed entry route", () => {
  it("admits every canonical role through the explicit workflow-domain policy", () => {
    expect(M41B_AUTHORIZED_ROLES).toEqual(ALL_ROLES);
    for (const role of ALL_ROLES) {
      expect(
        authorizeClientRoute(role, "/workflows/intelligence-assistant"),
        role,
      ).toMatchObject({ allowed: true });
    }
  });

  it("admits all 36 roles to governed self-service procedures before endpoint gates", () => {
    const selfServiceProcedures = [
      ["getMyWorkplan", "query"],
      ["getCadenceBrief", "query"],
      ["askAmos", "mutation"],
      ["addCompletionEvidence", "mutation"],
      ["completeTask", "mutation"],
      ["escalateTask", "mutation"],
      ["getAuditLineage", "query"],
    ] as const;
    for (const [procedure, type] of selfServiceProcedures) {
      const resource = procedureAccessResource(`m41b.${procedure}`, type);
      expect(resource, procedure).toMatchObject({ domain: "self-service" });
      for (const role of ALL_ROLES) {
        expect(authorizeAccess({ role }, resource!).allowed, `${role}:${procedure}`).toBe(
          true,
        );
      }
    }
  });

  it("keeps accountable disposition and enterprise reset outside self-service", () => {
    const disposition = procedureAccessResource(
      "m41b.recordHumanDisposition",
      "mutation",
    );
    const reset = procedureAccessResource("m41b.resetEvaluation", "mutation");
    expect(disposition).toMatchObject({ domain: "workflow", action: "approve" });
    expect(reset).toMatchObject({ domain: "workflow", action: "manage" });
    expect(authorizeAccess({ role: "administrator" }, disposition!).allowed).toBe(
      true,
    );
    expect(authorizeAccess({ role: "bhc-front-desk" }, disposition!).allowed).toBe(
      false,
    );
    expect(authorizeAccess({ role: "managing-director" }, reset!).allowed).toBe(
      true,
    );
    expect(authorizeAccess({ role: "rcs-day" }, reset!).allowed).toBe(false);
  });

  it("retains fail-closed behavior for unknown roles and unmapped routes", () => {
    expect(
      authorizeClientRoute(
        "not-a-canonical-role",
        "/workflows/intelligence-assistant",
      ).allowed,
    ).toBe(false);
    expect(
      authorizeClientRoute("administrator", "/m41b-unmapped-prototype").allowed,
    ).toBe(false);
  });
});
