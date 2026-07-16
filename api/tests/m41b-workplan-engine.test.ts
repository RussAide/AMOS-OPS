import { describe, expect, it } from "vitest";
import {
  M41B_CADENCES,
  M41B_SOURCE_REGISTER,
  buildM41bRoleContext,
} from "@contracts/m41b";
import { ALL_ROLES } from "@/constants/roles";
import {
  buildM41bWorkplan,
  deriveM41bPriority,
  selectM41bSourcesForContext,
} from "../services/m41b/workplan-engine";

describe("M4.1B deterministic five-cadence workplan engine", () => {
  it("builds the same authoritative five-cadence plan for all 36 canonical roles", () => {
    expect(ALL_ROLES).toHaveLength(36);
    const canonicalSourceIds = new Set(
      M41B_SOURCE_REGISTER.map((source) => source.id),
    );

    for (const role of ALL_ROLES) {
      const context = buildM41bRoleContext(role);
      const first = buildM41bWorkplan(context);
      const second = buildM41bWorkplan(context);

      expect(first).toEqual(second);
      expect(first.roleContext.role).toBe(role);
      expect(first.productionActionsBlocked).toBe(true);
      expect(first.evidenceClass).toBe("synthetic_demo");
      expect(Object.keys(first.briefs)).toEqual([...M41B_CADENCES]);

      for (const cadence of M41B_CADENCES) {
        const brief = first.briefs[cadence];
        expect(brief.cadence).toBe(cadence);
        expect(brief.items.length).toBeGreaterThan(0);
        expect(brief.title).toContain(context.department);
        expect(brief.purpose).toContain(role);
        expect(
          brief.items.every((item) => item.ownerId === context.userId),
        ).toBe(true);
        expect(brief.items.every((item) => item.ownerRole === role)).toBe(true);
        expect(brief.items.every((item) => item.cadence === cadence)).toBe(
          true,
        );
        expect(brief.items.every((item) => item.humanApprovalRequired)).toBe(
          true,
        );
        expect(
          brief.items.every((item) => item.completionEvidenceIds.length === 0),
        ).toBe(true);
        expect(brief.items.every((item) => item.closedAt === null)).toBe(true);
        expect(
          brief.items.every((item) =>
            item.sourceIds.every((sourceId) =>
              canonicalSourceIds.has(sourceId),
            ),
          ),
        ).toBe(true);
      }
    }
  });

  it("covers representative T1-T4 personas and all four divisions", () => {
    const representatives = [
      buildM41bRoleContext("managing-director"),
      buildM41bRoleContext("program-director"),
      buildM41bRoleContext("facilities-manager"),
      buildM41bRoleContext("therapist"),
    ] as const;

    expect(new Set(representatives.map((context) => context.tier))).toEqual(
      new Set(["T1", "T2", "T3", "T4"]),
    );
    expect(new Set(representatives.map((context) => context.division))).toEqual(
      new Set(["eo", "gro", "gad", "bhc"]),
    );

    for (const context of representatives) {
      const plan = buildM41bWorkplan(context, {
        requestedDivision: context.division,
      });
      const items = M41B_CADENCES.flatMap(
        (cadence) => plan.briefs[cadence].items,
      );
      expect(items.every((item) => item.division === context.division)).toBe(
        true,
      );
      expect(
        items.every((item) =>
          item.objective.includes(
            context.tier === "T4"
              ? "frontline"
              : context.tier === "T3"
                ? "supervisory"
                : "leadership",
          ),
        ),
      ).toBe(true);
    }
  });

  it("uses division, source sensitivity, tier, and canonical permissions before retrieval", () => {
    const revenue = buildM41bRoleContext("revenue-cycle-manager");
    const hr = buildM41bRoleContext("hr-director");
    const bhcFrontDesk = buildM41bRoleContext("bhc-front-desk");

    expect(
      selectM41bSourcesForContext(revenue).map((source) => source.id),
    ).toContain("M41B-SRC-FINANCE-CONFLICT");
    expect(
      selectM41bSourcesForContext(revenue).map((source) => source.id),
    ).not.toContain("M41B-SRC-PERSONNEL-STALE");
    expect(
      selectM41bSourcesForContext(hr).map((source) => source.id),
    ).toContain("M41B-SRC-PERSONNEL-STALE");
    expect(
      selectM41bSourcesForContext(hr).map((source) => source.id),
    ).not.toContain("M41B-SRC-FINANCE-CONFLICT");
    expect(
      selectM41bSourcesForContext(bhcFrontDesk).map((source) => source.id),
    ).toContain("M41B-SRC-CLINICAL-MISSING");
    expect(
      selectM41bSourcesForContext(bhcFrontDesk).map((source) => source.id),
    ).not.toContain("M41B-SRC-GRO-SHIFT");
  });

  it("uses caseload and delegated workflow context to derive priority without changing source truth", () => {
    const withCaseload = buildM41bRoleContext("clinical-supervisor");
    const withoutCaseload = {
      ...withCaseload,
      caseloadIds: [] as const,
    };

    expect(
      deriveM41bPriority("M41B-SRC-BHC-AUDIT", "daily", withCaseload),
    ).toBe("critical");
    expect(
      deriveM41bPriority("M41B-SRC-BHC-AUDIT", "daily", withoutCaseload),
    ).toBe("high");

    const frontline = buildM41bRoleContext("rcs-day");
    expect(() =>
      buildM41bWorkplan({
        ...frontline,
        delegatedActions: [
          ...frontline.delegatedActions,
          "route_cross_division",
        ],
      }),
    ).toThrow("M41B_ROLE_CONTEXT_DELEGATION_MISMATCH");
  });

  it("denies cross-division planning and does not leak inaccessible source identifiers", () => {
    const bhc = buildM41bRoleContext("clinical-supervisor");
    expect(() => buildM41bWorkplan(bhc, { requestedDivision: "gro" })).toThrow(
      "M41B_CROSS_DIVISION_ACCESS_DENIED:clinical-supervisor:gro",
    );

    const sourceIds = M41B_CADENCES.flatMap((cadence) =>
      buildM41bWorkplan(bhc).briefs[cadence].items.flatMap(
        (item) => item.sourceIds,
      ),
    );
    expect(sourceIds).not.toContain("M41B-SRC-GRO-SHIFT");
  });

  it("preserves current, stale, missing, and contradictory source states in briefs", () => {
    const plan = buildM41bWorkplan(buildM41bRoleContext("super-admin"));
    const dailyStates = new Set(plan.briefs.daily.sourceStates);
    expect(dailyStates).toEqual(
      new Set(["current", "contradictory", "missing", "stale"]),
    );
    expect(
      plan.briefs.daily.limitations.some((limit) =>
        limit.includes("remains stale"),
      ),
    ).toBe(true);
    expect(
      plan.briefs.daily.limitations.some((limit) =>
        limit.includes("remains missing"),
      ),
    ).toBe(true);
    expect(
      plan.briefs.daily.limitations.some((limit) =>
        limit.includes("remains contradictory"),
      ),
    ).toBe(true);

    const missing = plan.briefs.daily.items.find((item) =>
      item.sourceIds.includes("M41B-SRC-CLINICAL-MISSING"),
    );
    const contradictory = plan.briefs.daily.items.find((item) =>
      item.sourceIds.includes("M41B-SRC-FINANCE-CONFLICT"),
    );
    expect(missing?.priority).toBe("critical");
    expect(missing?.evidenceRequirements).toContain(
      "Current authorized clinical assessment",
    );
    expect(
      contradictory?.evidenceRequirements.some((value) =>
        value.includes("every conflicting"),
      ),
    ).toBe(true);
  });

  it("assigns deterministic cadence deadlines and predecessor dependencies", () => {
    const plan = buildM41bWorkplan(buildM41bRoleContext("facilities-manager"));
    const expectedDueAt = {
      daily: "2026-10-15T23:59:59.999Z",
      weekly: "2026-10-22T23:59:59.999Z",
      monthly: "2026-10-31T23:59:59.999Z",
      quarterly: "2026-12-31T23:59:59.999Z",
      annual: "2026-12-31T23:59:59.999Z",
    } as const;

    for (const cadence of M41B_CADENCES) {
      const baseline = plan.briefs[cadence].items.find((item) =>
        item.sourceIds.includes(
          M41B_SOURCE_REGISTER.find(
            (source) =>
              source.cadences.length === 1 && source.cadences[0] === cadence,
          )?.id ?? "",
        ),
      );
      expect(baseline?.dueAt).toBe(expectedDueAt[cadence]);
      expect(baseline?.dependencyIds.length).toBe(cadence === "daily" ? 0 : 1);
    }
  });
});
