import type { createIdentityService, IdentityUser } from "../security/identity";

type IdentityService = ReturnType<typeof createIdentityService>;

export interface SyntheticLoginScenario {
  userId: string;
  email: string;
  password: string;
  role: string;
  division: "EO" | "GAD" | "GRO" | "BHC";
  department: string;
}

export interface LoginAttemptResult {
  email: string;
  role: string;
  division: SyntheticLoginScenario["division"];
  status: "authenticated" | "failed";
  mfaVerified: boolean;
  durationMs: number;
  error?: string;
}

export interface LoginConcurrencyReport {
  requested: number;
  authenticated: number;
  failed: number;
  mfaVerified: number;
  maximumConcurrency: number;
  unrecoverableCrashes: number;
  durationMs: number;
  p95DurationMs: number;
  representedRoles: string[];
  representedDivisions: string[];
  results: LoginAttemptResult[];
}

async function completeLogin(
  service: IdentityService,
  scenario: SyntheticLoginScenario,
): Promise<{ user: IdentityUser; token: string; mfaVerified: boolean }> {
  const context = {
    ipAddress: `192.0.2.${(Number.parseInt(scenario.userId.replace(/\D/g, ""), 10) % 200) + 1}`,
    userAgent: "AMOS-M1.1-Synthetic-Load-Harness/1.0",
  };
  const result = await service.login({
    email: scenario.email,
    password: scenario.password,
    ...context,
  });
  if (result.status === "authenticated") {
    return { user: result.user, token: result.token, mfaVerified: result.mfaVerified };
  }
  if (!result.evaluationCode) {
    throw new Error("Synthetic MFA challenge did not expose an evaluation code");
  }
  const verified = await service.verifyMfa({
    challengeId: result.challengeId,
    code: result.evaluationCode,
    ...context,
  });
  return { user: verified.user, token: verified.token, mfaVerified: true };
}

export async function executeLoginConcurrencyTest(
  service: IdentityService,
  scenarios: readonly SyntheticLoginScenario[],
): Promise<LoginConcurrencyReport> {
  const startedAt = performance.now();
  let inFlight = 0;
  let maximumConcurrency = 0;
  let unrecoverableCrashes = 0;

  const results = await Promise.all(
    scenarios.map(async (scenario): Promise<LoginAttemptResult> => {
      inFlight += 1;
      maximumConcurrency = Math.max(maximumConcurrency, inFlight);
      const attemptStartedAt = performance.now();
      try {
        const authenticated = await completeLogin(service, scenario);
        const sessionUser = service.getSession(authenticated.token);
        if (!sessionUser || sessionUser.id !== scenario.userId) {
          throw new Error("Issued session could not be recovered for the expected identity");
        }
        return {
          email: scenario.email,
          role: scenario.role,
          division: scenario.division,
          status: "authenticated",
          mfaVerified: authenticated.mfaVerified,
          durationMs: Math.round((performance.now() - attemptStartedAt) * 100) / 100,
        };
      } catch (error) {
        return {
          email: scenario.email,
          role: scenario.role,
          division: scenario.division,
          status: "failed",
          mfaVerified: false,
          durationMs: Math.round((performance.now() - attemptStartedAt) * 100) / 100,
          error: error instanceof Error ? error.message : "Handled login failure",
        };
      } finally {
        inFlight -= 1;
      }
    }),
  ).catch((error: unknown) => {
    unrecoverableCrashes += 1;
    throw error;
  });

  const durations = results.map((result) => result.durationMs).sort((left, right) => left - right);
  const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
  return {
    requested: scenarios.length,
    authenticated: results.filter((result) => result.status === "authenticated").length,
    failed: results.filter((result) => result.status === "failed").length,
    mfaVerified: results.filter((result) => result.mfaVerified).length,
    maximumConcurrency,
    unrecoverableCrashes,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    p95DurationMs: durations[p95Index] ?? 0,
    representedRoles: [...new Set(scenarios.map((scenario) => scenario.role))].sort(),
    representedDivisions: [...new Set(scenarios.map((scenario) => scenario.division))].sort(),
    results,
  };
}

export async function executePasswordRecoveryTest(
  service: IdentityService,
  scenario: SyntheticLoginScenario,
  newPassword: string,
): Promise<{
  recovered: boolean;
  priorSessionRevoked: boolean;
  newSessionValid: boolean;
}> {
  const initial = await completeLogin(service, scenario);
  const recovery = service.requestPasswordReset({
    email: scenario.email,
    ipAddress: "192.0.2.250",
  });
  if (!recovery.evaluationToken) {
    throw new Error("Synthetic recovery token was not available in evaluation mode");
  }
  await service.resetPassword({ token: recovery.evaluationToken, newPassword });
  const priorSessionRevoked = service.getSession(initial.token) === null;
  const renewed = await completeLogin(service, { ...scenario, password: newPassword });
  const newSessionValid = service.getSession(renewed.token)?.id === scenario.userId;
  return { recovered: priorSessionRevoked && newSessionValid, priorSessionRevoked, newSessionValid };
}
