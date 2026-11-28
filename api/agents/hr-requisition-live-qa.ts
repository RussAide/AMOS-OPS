import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../lib/env";
import { operationalSqlite, runWithDataScope, sqlite } from "../queries/connection";
import { identityService } from "../security/identity";
import { encryptTotpSecret, generateTotpSecret, totpCodeForTest } from "../security/totp";

type QaStep = "create temporary HR identity" | "password and MFA sign-in" |
  "save and reopen" | "reject duplicate" | "edit and reopen" | "verify Training isolation" |
  "revoke session" | "remove synthetic requisition";

export async function runStagingHrRequisitionQa(port: number, candidate: string) {
  const stagingOrigin = "https://amos-ops-staging.up.railway.app";
  if (!env.isStaging || env.isProduction ||
      !/^RAILWAY-GITHUB-[a-f0-9]{40}$/.test(candidate) ||
      process.env.AMOS_HR_REQUISITION_QA_CANDIDATE !== candidate ||
      !env.allowedOrigins.includes(stagingOrigin)) return null;

  const runId = `hr-requisition-qa:${candidate}`;
  const reserved = runWithDataScope("training", () => sqlite.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, performed_at)
     VALUES (?, 'qa_run', ?, 'started', 'staging-qa-runner', ?)
     ON CONFLICT(id) DO NOTHING`,
  ).run(runId, candidate, new Date().toISOString()).changes === 1);
  if (!reserved) return null;

  const id = randomUUID();
  const reference = `CYP-QA-REQ-${id}`;
  const email = `requisition-qa-${id}@example.invalid`;
  const password = randomBytes(32).toString("base64url") + "!Qa4";
  const secret = generateTotpSecret();
  const fields = {
    position: "Synthetic QA worker",
    department: "GRO",
    supervisor: "Synthetic QA supervisor",
    hiringOwner: "Synthetic QA hiring owner",
    approvedHeadcount: 2,
  };
  let step: QaStep = "create temporary HR identity";
  let identityCreated = false;
  let completed = false;
  let failure: QaStep | undefined;
  let sessionsClosed = false;
  let fixtureRemoved = false;

  async function request(procedure: string, input?: object, token?: string): Promise<{
    status: number;
    data?: unknown;
    errorCode?: string;
  }> {
    const response = await fetch(`http://127.0.0.1:${port}/api/trpc/${procedure}`, {
      method: input ? "POST" : "GET",
      headers: {
        Origin: stagingOrigin,
        "x-amos-workspace": "training",
        ...(input ? { "content-type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(input ? { body: JSON.stringify({ json: input }) } : {}),
      signal: AbortSignal.timeout(7_000),
    });
    const body = await response.json() as {
      result?: { data?: { json?: unknown } };
      error?: { json?: { data?: { code?: string } } };
    };
    return {
      status: response.status,
      data: body.result?.data?.json,
      errorCode: body.error?.json?.data?.code,
    };
  }

  const rowMatches = (value: unknown, revision: number) => {
    if (!value || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    return row.reference === reference && row.revision === revision &&
      Object.entries(fields).every(([key, expected]) =>
        row[key] === (revision === 2 && key === "approvedHeadcount" ? 3 : expected),
      );
  };

  try {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 10 * 60_000).toISOString();
    operationalSqlite.prepare(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role,
          is_active, access_status, identity_type, access_expires_at, training_access,
          mfa_enabled, mfa_method, mfa_totp_secret, created_at, updated_at)
       VALUES (?, ?, ?, 'Synthetic', 'HR QA', 'hr-director', 1, 'training',
          'external_guest', ?, 1, 1, 'totp', ?, ?, ?)`,
    ).run(id, email, await bcrypt.hash(password, 12), expires,
      encryptTotpSecret(secret, env.appSecret), now, now);
    identityCreated = true;

    step = "password and MFA sign-in";
    const login = await request("auth.login", { email, password });
    const challenge = login.data as { status?: string; challengeId?: string; mfa?: { challengeId?: string } } | undefined;
    const challengeId = challenge?.challengeId ?? challenge?.mfa?.challengeId;
    if (login.status !== 200 || !challengeId) throw new Error();
    const mfa = await request("auth.verifyMfa", { challengeId, code: totpCodeForTest(secret, new Date()) });
    const session = mfa.data as { token?: string; user?: { role?: string; dataScope?: string } } | undefined;
    if (mfa.status !== 200 || !session?.token || session.user?.role !== "hr-director" ||
        session.user.dataScope !== "training") throw new Error();
    const token = session.token;
    const reopened = async (revision: number) => {
      const rows = await request("hr.listRequisitions", undefined, token);
      return rows.status === 200 && Array.isArray(rows.data) &&
        rows.data.filter(row => row?.reference === reference).length === 1 &&
        rows.data.some(row => rowMatches(row, revision));
    };

    step = "save and reopen";
    const created = await request("hr.createRequisition", { reference, fields }, token);
    if (created.status !== 200 || !rowMatches(created.data, 1) || !await reopened(1)) throw new Error();

    step = "reject duplicate";
    const duplicate = await request("hr.createRequisition", { reference, fields }, token);
    if (duplicate.errorCode !== "CONFLICT" || !await reopened(1)) throw new Error();

    step = "edit and reopen";
    const updated = await request("hr.updateRequisition", {
      reference, revision: 1, fields: { ...fields, approvedHeadcount: 3 },
    }, token);
    if (updated.status !== 200 || !rowMatches(updated.data, 2) || !await reopened(2)) throw new Error();

    step = "verify Training isolation";
    if (operationalSqlite.prepare("SELECT 1 FROM hr_requisitions WHERE reference = ?").get(reference)) {
      throw new Error();
    }
    if (!runWithDataScope("training", () =>
      (sqlite.prepare("SELECT count(*) AS size FROM audit_logs WHERE entity_type = 'hr_requisition' AND entity_id = ? AND performed_by = ?")
        .get(reference, id) as { size: number }).size === 2,
    )) throw new Error();

    step = "revoke session";
    identityService.revokeAllSessions(id, "staging_hr_qa_finished");
    const afterRevoke = await request("hr.listRequisitions", undefined, token);
    if (afterRevoke.status !== 401) throw new Error();
    completed = true;
  } catch {
    failure = step;
  } finally {
    if (identityCreated) {
      try {
        operationalSqlite.transaction(() => {
          identityService.revokeAllSessions(id, "staging_hr_qa_finished");
          operationalSqlite.prepare(
            "UPDATE users SET is_active = 0, access_status = 'deactivated', mfa_totp_secret = NULL WHERE id = ? AND email = ?",
          ).run(id, email);
        })();
        sessionsClosed = true;
      } catch {
        failure ??= "revoke session";
      }
    }
    try {
      runWithDataScope("training", () => {
        sqlite.prepare("DELETE FROM hr_requisitions WHERE reference = ?").run(reference);
        fixtureRemoved = !sqlite.prepare("SELECT 1 FROM hr_requisitions WHERE reference = ?").get(reference);
      });
    } catch {
      failure ??= "remove synthetic requisition";
    }
  }
  return { candidate, passed: completed && !failure && sessionsClosed && fixtureRemoved,
    ...(failure ? { failure } : {}), sessionsClosed, fixtureRemoved };
}
