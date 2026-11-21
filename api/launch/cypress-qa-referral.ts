type QaReferralResult =
  | { status: "disabled" | "unavailable" | "source_access_denied" | "fixture_missing" }
  | {
      status: "ok";
      referenceCode: string;
      synthetic: true;
      stage: "received_for_review";
      fitDecision: "pending";
      admissionStatus: "not_admitted";
    };

export async function readCypressQaReferral(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<QaReferralResult> {
  const token = env.AMOS_OPS_CYPRESS_QA_REFERRAL_TOKEN;
  const sourceHost = env.AMOS_OPS_CYPRESS_QA_REFERRAL_HOST;
  const referenceCode = env.AMOS_OPS_CYPRESS_QA_REFERRAL_REFERENCE;
  if (
    env.RAILWAY_ENVIRONMENT_NAME?.toLowerCase() !== "staging" ||
    !env.RAILWAY_ENVIRONMENT_ID ||
    !token || !/^[A-Za-z0-9_-]{43,128}$/.test(token) ||
    !sourceHost || !/^[a-z0-9-]+\.up\.railway\.app$/.test(sourceHost) ||
    !referenceCode || !/^[A-Z0-9-]{1,64}$/.test(referenceCode)
  ) return { status: "disabled" };

  try {
    const response = await request(`https://${sourceHost}/api/integrations/amos-ops/qa-referral`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 401 || response.status === 403) {
      return { status: "source_access_denied" };
    }
    if (response.status === 404) {
      const failure: unknown = await response.json();
      return {
        status: typeof failure === "object" && failure !== null &&
          "error" in failure && failure.error === "fixture_not_found"
          ? "fixture_missing" : "unavailable",
      };
    }
    if (!response.ok) return { status: "unavailable" };

    const record: unknown = await response.json();
    if (!record || typeof record !== "object") return { status: "unavailable" };
    const fields = record as Record<string, unknown>;
    if (
      fields.reference_code !== referenceCode || fields.synthetic !== true ||
      fields.stage !== "received_for_review" || fields.fit_decision !== "pending" ||
      fields.admission_status !== "not_admitted"
    ) return { status: "unavailable" };
    return {
      status: "ok",
      referenceCode,
      synthetic: true,
      stage: "received_for_review",
      fitDecision: "pending",
      admissionStatus: "not_admitted",
    };
  } catch {
    return { status: "unavailable" };
  }
}
