import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const productionEnvironment = {
  APP_ENV: "production",
  AMOS_RUNTIME_MODE: "production",
  NODE_ENV: "production",
  AMOS_ENVIRONMENT_ID: "amos-ops-production",
  CREDENTIAL_NAMESPACE: "amos-ops/production",
  PERSISTENT_ROOT: "/app/persistent",
  DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
  TRAINING_DATABASE_PATH:
    "/app/persistent/data/production/training/amos-ops-training.db",
  UPLOAD_PATH: "/app/persistent/uploads/production",
  TRAINING_UPLOAD_PATH: "/app/persistent/uploads/production/training",
  BACKUP_PATH: "/app/persistent/backups/production",
  APP_SECRET: "rm1-production-app-secret-value-000001",
  JWT_SECRET: "rm1-production-jwt-secret-value-000001",
  DEPLOYMENT_APPROVAL_ID: "RM1-TEST-APPROVAL",
  DEPLOYMENT_CHANGE_REFERENCE: "RM1-TEST-CHANGE",
  AMOS_ALLOWED_ORIGINS: "https://amos.example.invalid",
  ALLOW_SELF_REGISTRATION: "false",
  MFA_POLICY: "required-all",
  AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
  AMOS_PRODUCTION_RELEASE_ID: "RM1-TEST-RELEASE",
};

function setEnvironment(values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
}

function routerSource(name: string): string {
  return readFileSync(
    new URL(`../routers/${name}.ts`, import.meta.url),
    "utf8",
  );
}

type RouterResolver = (options: unknown) => unknown;

function procedureResolver(procedure: unknown): RouterResolver {
  const definition = (procedure as { _def?: { resolver?: unknown } })._def;
  if (typeof definition?.resolver !== "function") {
    throw new Error("Expected a callable tRPC procedure resolver");
  }
  return definition.resolver as RouterResolver;
}

async function mockRouterMiddleware(): Promise<void> {
  vi.doMock("../middleware", async () => {
    const { initTRPC } = await import("@trpc/server");
    const trpc = initTRPC.context<Record<string, unknown>>().create();
    return {
      createRouter: trpc.router,
      publicQuery: trpc.procedure,
      authedQuery: trpc.procedure,
      adminQuery: trpc.procedure,
      auditLog: () => undefined,
    };
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("RM.1 Production fixture boundary", () => {
  it("loads no module-level GRO or GAD fixtures and rejects volatile writes in Production", async () => {
    setEnvironment(productionEnvironment);
    vi.resetModules();
    await mockRouterMiddleware();

    const [{ m6Router }, { m7Router }, { m8Router }, { m29Router }] =
      await Promise.all([
        import("../routers/m6"),
        import("../routers/m7"),
        import("../routers/m8"),
        import("../routers/m29"),
      ]);

    const listReferrals = procedureResolver(m6Router._def.record.listReferrals);
    const createReferral = procedureResolver(
      m6Router._def.record.createReferral,
    );
    const listFacilities = procedureResolver(
      m7Router._def.record.listFacilities,
    );
    const createWorkOrder = procedureResolver(
      m7Router._def.record.createWorkOrder,
    );
    const listWorkflowRules = procedureResolver(m8Router._def.record.listRules);
    const knowledgeStats = procedureResolver(m29Router._def.record.stats);

    await expect(
      Promise.resolve(listReferrals({ input: undefined } as never)),
    ).resolves.toEqual([]);
    await expect(
      Promise.resolve(listFacilities({ input: undefined } as never)),
    ).resolves.toEqual([]);
    await expect(
      Promise.resolve(listWorkflowRules({ input: undefined } as never)),
    ).resolves.toEqual([]);
    await expect(
      Promise.resolve(knowledgeStats({ input: undefined } as never)),
    ).resolves.toMatchObject({ totalEntities: 0, totalRelationships: 0 });
    expect(() =>
      createReferral({
        ctx: { user: { email: "operator@example.invalid" } },
        input: {
          patientName: "Do not persist",
          referralSource: "test",
        },
      } as never),
    ).toThrow(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
    expect(() =>
      createWorkOrder({
        ctx: { user: { email: "operator@example.invalid" } },
        input: {
          title: "Do not persist",
          description: "test",
          workType: "maintenance",
          priority: "low",
        },
      } as never),
    ).toThrow(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
  });

  it("retains GRO and GAD fixtures only in an isolated Demo runtime", async () => {
    setEnvironment({
      APP_ENV: "demo",
      AMOS_RUNTIME_MODE: "demo",
      NODE_ENV: "production",
      AMOS_ENVIRONMENT_ID: "amos-ops-demo",
      CREDENTIAL_NAMESPACE: "amos-ops/demo",
      DATABASE_PATH: "data/demo/amos-ops.db",
      TRAINING_DATABASE_PATH: "data/demo/training/amos-ops-training.db",
      UPLOAD_PATH: "uploads/demo",
      TRAINING_UPLOAD_PATH: "uploads/demo/training",
      BACKUP_PATH: "backups/demo",
      ALLOW_SELF_REGISTRATION: "true",
    });
    vi.resetModules();
    await mockRouterMiddleware();

    const [{ m6Router }, { m7Router }] = await Promise.all([
      import("../routers/m6"),
      import("../routers/m7"),
    ]);
    const listReferrals = procedureResolver(m6Router._def.record.listReferrals);
    const listFacilities = procedureResolver(
      m7Router._def.record.listFacilities,
    );

    expect(
      await Promise.resolve(listReferrals({ input: undefined } as never)),
    ).not.toEqual([]);
    expect(
      await Promise.resolve(listFacilities({ input: undefined } as never)),
    ).not.toEqual([]);
  });

  it("blocks simulated medication and volatile clinical providers in Production", async () => {
    setEnvironment(productionEnvironment);
    vi.resetModules();
    await mockRouterMiddleware();

    const orderBy = vi.fn(() => []);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where, orderBy }));
    const select = vi.fn(() => ({ from }));
    vi.doMock("../queries/connection", () => ({
      getDb: vi.fn(() => ({ select })),
      sqlite: {},
    }));

    const [
      { m20Router },
      { m22Router },
      { m23Router },
      { m24GroRouter },
      { mgmaRouter },
      { isM24GroEngineInitialized },
    ] = await Promise.all([
      import("../routers/m20"),
      import("../routers/m22"),
      import("../routers/m23"),
      import("../routers/m24-gro"),
      import("../routers/mgma"),
      import("../lib/m24-gro/engine"),
    ]);

    expect(isM24GroEngineInitialized()).toBe(false);

    const getFacilityMedications = procedureResolver(
      m20Router._def.record.getFacilityMedications,
    );
    const administerMedication = procedureResolver(
      m20Router._def.record.administerMedication,
    );
    const mhtcmScenario = procedureResolver(
      m22Router._def.record.representativeScenario,
    );
    const mhrsDashboard = procedureResolver(m23Router._def.record.dashboard);
    const residentialState = procedureResolver(m24GroRouter._def.record.state);
    const syntheticMgmaDashboard = procedureResolver(
      mgmaRouter._def.record.executiveDashboard,
    );
    const listMgmaScorecards = procedureResolver(
      mgmaRouter._def.record.listScorecards,
    );

    await expect(
      Promise.resolve(
        getFacilityMedications({
          input: { facilityId: "facility-1" },
        } as never),
      ),
    ).resolves.toEqual([]);
    await expect(
      Promise.resolve().then(() =>
        administerMedication({
          input: {
            medicationId: "medication-1",
            youthId: "youth-1",
            administeredBy: "operator-1",
            timestamp: "2026-07-17T12:00:00.000Z",
          },
        } as never),
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(
      Promise.resolve().then(() =>
        mhtcmScenario({ input: undefined } as never),
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(
      Promise.resolve().then(() =>
        syntheticMgmaDashboard({
          input: { viewMode: "synthetic_demo" },
        } as never),
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(
      Promise.resolve(listMgmaScorecards({ input: undefined } as never)),
    ).resolves.toEqual([]);
    expect(where).toHaveBeenCalledOnce();
    await expect(
      Promise.resolve().then(() =>
        mhrsDashboard({
          ctx: {
            user: {
              id: "operator-1",
              role: "super-admin",
              name: "Operator",
              email: "operator@example.invalid",
            },
          },
          input: { asOf: "2026-07-17T12:00:00.000Z" },
        } as never),
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(
      Promise.resolve().then(() =>
        residentialState({
          ctx: {
            user: {
              id: "operator-1",
              role: "super-admin",
              name: "Operator",
              email: "operator@example.invalid",
            },
          },
          input: undefined,
        } as never),
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(isM24GroEngineInitialized()).toBe(false);
  });

  it("gates every explicit router seed mutation behind the synthetic-scenario boundary", () => {
    const seedRouters = [
      "m1",
      "m2",
      "m4",
      "m5",
      "m9",
      "m19",
      "mgma",
      "ccmg",
      "gro",
      "gro-compliance",
      "part2",
      "mhtcm",
      "mhrs",
      "workflow",
      "documents",
    ];

    for (const router of seedRouters) {
      const source = routerSource(router);
      const seedProcedures = source.matchAll(
        /^\s{2}(seed[A-Za-z0-9_]*|reindex):/gm,
      );
      for (const match of seedProcedures) {
        const procedurePrefix = source.slice(match.index!, match.index! + 500);
        expect(procedurePrefix, `${router}.${match[1]}`).toContain(
          "assertSyntheticScenarioRuntime(env);",
        );
      }
    }
  });

  it("uses empty or unavailable Production responses instead of fixed analytics and compliance fixtures", () => {
    const analytics = routerSource("m10");
    const compliance = routerSource("m3");
    const ccmg = routerSource("m21");

    expect(analytics).toContain("syntheticAnalyticsEnabled ?");
    expect(analytics).toContain('operationalStatus: "unavailable"');
    expect(analytics).toContain(
      "return syntheticAnalyticsEnabled ? STRATEGIC_PROJECTS_SEED : [];",
    );
    expect(analytics).not.toContain(
      "Return mock success if table doesn't exist",
    );
    expect(compliance).toContain(
      "if (!syntheticComplianceFixturesEnabled) return [];",
    );
    expect(ccmg).toContain("assertSyntheticScenarioRuntime(env);");
    expect(ccmg).toMatch(/return PERSONA_SEED;[^]*?catch \{[^]*?return \[\];/);
  });
});
