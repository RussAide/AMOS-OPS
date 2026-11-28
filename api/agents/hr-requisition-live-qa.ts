import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../lib/env";
import { operationalSqlite, runWithDataScope, sqlite } from "../queries/connection";
import { identityService } from "../security/identity";
import { encryptTotpSecret, generateTotpSecret, totpCodeForTest } from "../security/totp";

type QaStep = "create temporary HR identity" | "password and MFA sign-in" |
  "save and reopen" | "reject duplicate" | "edit and reopen" |
  "link and reopen application" | "reject incomplete application review" |
  "save and reopen application review" | "record issued offer" |
  "accept and verify one personnel record" | "save and reopen personnel packet" |
  "verify Training isolation" |
  "revoke session" | "remove synthetic fixtures";

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
  const applicationReference = `CYP-QA-APP-${id}`;
  const offerReference = `CYP-QA-OFFER-${id}`;
  const sourceReference = "QA-POSTING";
  const review = {
    qualificationOutcome: "met",
    qualificationReference: "QA-QUALIFICATIONS",
    screeningReference: "QA-SCREENING",
    interviewReference: "QA-INTERVIEW",
    referencesReference: "QA-REFERENCES",
    disposition: "recommended",
  };
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

  async function request(procedure: string, input?: object, token?: string, method = input ? "POST" : "GET"): Promise<{
    status: number;
    data?: unknown;
    errorCode?: string;
  }> {
    const url = new URL(`http://127.0.0.1:${port}/api/trpc/${procedure}`);
    if (input && method === "GET") url.searchParams.set("input", JSON.stringify({ json: input }));
    const bodyInput = input && method === "POST" ? { body: JSON.stringify({ json: input }) } : {};
    const response = await fetch(url, {
      method,
      headers: {
        Origin: stagingOrigin,
        "x-amos-workspace": "training",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...bodyInput,
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

    const reopenedApplication = async (expected: Record<string, string | number>) => {
      const response = await request("hr.listApplications", undefined, token);
      if (response.status !== 200 || !Array.isArray(response.data)) return false;
      const matches = response.data.filter(row => row?.reference === applicationReference);
      return matches.length === 1 && matches[0].requisitionReference === reference &&
        matches[0].sourceReference === sourceReference &&
        Object.entries(expected).every(([key, value]) => matches[0][key] === value);
    };

    step = "link and reopen application";
    const application = { reference: applicationReference, requisitionReference: reference, sourceReference };
    const linked = await request("hr.createApplication", application, token);
    if (linked.status !== 200 || !await reopenedApplication({ revision: 1, disposition: "pending" })) throw new Error();
    const duplicateApplication = await request("hr.createApplication", application, token);
    if (duplicateApplication.errorCode !== "CONFLICT") throw new Error();

    step = "reject incomplete application review";
    const reviewUpdate = { reference: applicationReference, revision: 1, review };
    const incomplete = await request("hr.updateApplicationReview", {
      ...reviewUpdate, review: { ...review, interviewReference: null },
    }, token);
    if (incomplete.errorCode !== "BAD_REQUEST" ||
        !await reopenedApplication({ revision: 1, disposition: "pending" })) throw new Error();

    step = "save and reopen application review";
    const reviewed = await request("hr.updateApplicationReview", reviewUpdate, token);
    if (reviewed.status !== 200 || !await reopenedApplication({ revision: 2, ...review })) throw new Error();

    step = "record issued offer";
    const offer = { applicationReference, offerReference, selectionReference: "QA-APPROVED-SELECTION" };
    const pending = await request("hr.createOffer", offer, token);
    const pendingRow = pending.data as { status?: string; personId?: string | null } | undefined;
    if (pending.status !== 200 || pendingRow?.status !== "pending" || pendingRow.personId !== null) throw new Error();
    const duplicateOffer = await request("hr.createOffer", offer, token);
    if (duplicateOffer.errorCode !== "CONFLICT") throw new Error();

    step = "accept and verify one personnel record";
    const acceptance = {
      applicationReference, revision: 1,
      response: { status: "accepted", evidence: "QA-SIGNED-ACCEPTANCE", firstName: "Synthetic", lastName: "Offer QA" },
    };
    const accepted = await request("hr.recordOfferResponse", acceptance, token);
    const acceptedRow = accepted.data as { status?: string; personId?: string; revision?: number } | undefined;
    const personId = acceptedRow?.personId;
    if (accepted.status !== 200 || acceptedRow?.status !== "accepted" || !personId || acceptedRow.revision !== 2) throw new Error();
    const retry = await request("hr.recordOfferResponse", acceptance, token);
    if (retry.status !== 200 || (retry.data as { personId?: string } | undefined)?.personId !== personId) throw new Error();
    const person = await request("hr.getPerson", { id: personId }, token, "GET");
    const personRow = person.data as Record<string, unknown> | undefined;
    if (person.status !== 200 || personRow?.id !== personId || personRow.role !== fields.position ||
        personRow.supervisor !== fields.supervisor || personRow.department !== fields.department ||
        personRow.lane !== "activation" || personRow.isEmployee !== false) throw new Error();

    step = "save and reopen personnel packet";
    const packet = {
      packetReference: "QA-PACKET-INDEX", fileChecklistReference: "QA-PERSONNEL-FILE-CHECKLIST", packetStatus: "ready_for_review",
    };
    const savedPacket = await request("hr.updateOfferPacket", { applicationReference, revision: 2, ...packet }, token);
    const listedOffers = await request("hr.listOffers", undefined, token);
    const matches = Array.isArray(listedOffers.data)
      ? listedOffers.data.filter(row => row?.applicationReference === applicationReference) : [];
    if (savedPacket.status !== 200 || listedOffers.status !== 200 || matches.length !== 1 ||
        !Object.entries({ ...offer, ...packet, personId, revision: 3, status: "accepted" })
          .every(([key, value]) => matches[0][key] === value)) throw new Error();

    step = "verify Training isolation";
    if (operationalSqlite.prepare("SELECT 1 FROM hr_requisitions WHERE reference = ?").get(reference) ||
        operationalSqlite.prepare("SELECT 1 FROM hr_applications WHERE reference = ?").get(applicationReference) ||
        operationalSqlite.prepare("SELECT 1 FROM hr_offers WHERE application_reference = ?").get(applicationReference) ||
        operationalSqlite.prepare("SELECT 1 FROM hr_people WHERE id = ?").get(personId)) {
      throw new Error();
    }
    if (!runWithDataScope("training", () => {
      const audit = sqlite.prepare(
        "SELECT count(*) AS size FROM audit_logs WHERE entity_type = ? AND entity_id = ? AND performed_by = ?",
      );
      const count = (kind: string, ref: string) => (audit.get(kind, ref, id) as { size: number }).size;
      return count("hr_requisition", reference) === 2 && count("hr_application", applicationReference) === 2 &&
        count("hr_offer", applicationReference) === 3;
    })) throw new Error();

    step = "revoke session";
    identityService.revokeAllSessions(id, "staging_hr_qa_finished");
    const afterRevoke = await request("hr.getPerson", { id: personId }, token, "GET");
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
      runWithDataScope("training", () => sqlite.transaction(() => {
        const removed = sqlite.prepare(
          "DELETE FROM hr_offers WHERE application_reference = ? AND offer_reference = ? RETURNING person_id",
        ).get(applicationReference, offerReference) as { person_id: string | null } | undefined;
        if (removed?.person_id) sqlite.prepare("DELETE FROM hr_people WHERE id = ?").run(removed.person_id);
        sqlite.prepare("DELETE FROM hr_applications WHERE reference = ? AND requisition_reference = ?")
          .run(applicationReference, reference);
        sqlite.prepare("DELETE FROM hr_requisitions WHERE reference = ?").run(reference);
        fixtureRemoved =
          (!removed?.person_id || !sqlite.prepare("SELECT 1 FROM hr_people WHERE id = ?").get(removed.person_id)) &&
          !sqlite.prepare("SELECT 1 FROM hr_offers WHERE application_reference = ?").get(applicationReference) &&
          !sqlite.prepare("SELECT 1 FROM hr_applications WHERE reference = ?").get(applicationReference) &&
          !sqlite.prepare("SELECT 1 FROM hr_requisitions WHERE reference = ?").get(reference);
      })());
    } catch {
      failure ??= "remove synthetic fixtures";
    }
  }
  return { candidate, passed: completed && !failure && sessionsClosed && fixtureRemoved,
    workflow: "requisition-screening-offer-and-personnel",
    ...(failure ? { failure } : {}), identityDeactivated: sessionsClosed, fixtureRemoved };
}
