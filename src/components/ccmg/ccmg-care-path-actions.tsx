import { useState, type FormEvent } from "react";
import {
  ClipboardCheck,
  GitBranch,
  Loader2,
  Pill,
  Send,
  ShieldCheck,
} from "lucide-react";

export const CCMG_CANS_DOMAINS = [
  "behavioral_emotional",
  "risk_behaviors",
  "life_functioning",
  "strengths",
  "caregiver_resources",
  "cultural_factors",
] as const;

export type CcmgCansDomain = (typeof CCMG_CANS_DOMAINS)[number];

export interface CcmgCansActionableItemInput {
  itemCode: string;
  label: string;
  domain: CcmgCansDomain;
  rating: 0 | 1 | 2 | 3;
  disposition: "need" | "strength";
}

type EligibilityCriteria = {
  ageQualified: boolean;
  diagnosisQualified: boolean;
  functionalImpairment: boolean;
  coverageQualified: boolean;
};

export type CcmgReferralGateActionRequest =
  | {
      kind: "record_gate";
      gate: "intake";
      decision: { status: "complete" };
      reason: string;
    }
  | {
      kind: "record_gate";
      gate: "eligibility";
      decision: {
        status: "eligible" | "ineligible" | "needs_review";
        criteria?: EligibilityCriteria;
        rationale: string;
      };
      reason: string;
    }
  | {
      kind: "record_gate";
      gate: "payer_authorization";
      decision: {
        payerLabel: string;
        verificationStatus: "verified" | "failed";
        authorizationRequired: boolean;
        authorizationStatus:
          "not_required" | "pending" | "approved" | "denied" | "expired";
        authorizationReference?: string;
        effectiveAt?: string;
        expiresAt?: string;
      };
      reason: string;
    }
  | {
      kind: "record_gate";
      gate: "consent";
      decision: {
        status: "active" | "declined" | "revoked" | "expired";
        consentReference?: string;
        effectiveAt?: string;
        expiresAt?: string;
      };
      reason: string;
    }
  | {
      kind: "record_gate";
      gate: "cans_schedule";
      decision: {
        status: "scheduled" | "overdue" | "cancelled";
        dueAt: string;
        scheduledFor?: string;
      };
      reason: string;
    }
  | {
      kind: "record_gate";
      gate: "capacity";
      decision: {
        required: boolean;
        facilityLabel?: string;
        status: "available" | "reserved" | "waitlisted" | "unavailable";
        availableSlots?: number;
        reservedSlotReference?: string;
        checkedAt?: string;
      };
      reason: string;
    };

export type CcmgCarePathActionRequest =
  | CcmgReferralGateActionRequest
  | {
      kind: "finalize_cans";
      instrumentVersion: string;
      domainScores: Record<CcmgCansDomain, number>;
      actionableItems: CcmgCansActionableItemInput[];
      totalScore: number;
      acuity: "low" | "moderate" | "high" | "critical";
      completedAt: string;
      reason: string;
    }
  | {
      kind: "approve_target_route";
      cansAssessmentId: string;
      targetType: "mhtcm_plan" | "mhrs_skills_goals";
      targetRecordId: string;
      targetVersion: number;
      reason: string;
    }
  | {
      kind: "create_medication_alert";
      title: string;
      priority: "urgent" | "critical";
      dueAt: string;
      reason: string;
    };

type CarePathKind =
  "gate" | "cans" | "mhtcm_route" | "mhrs_route" | "medication";

type GateKind = CcmgReferralGateActionRequest["gate"];

const COLORS = {
  teal: "#245C5A",
  amber: "#D97706",
  red: "#B91C1C",
  slate: "#64748B",
} as const;

const ACTIONS: ReadonlyArray<{
  kind: CarePathKind;
  label: string;
  icon: typeof ClipboardCheck;
}> = [
  { kind: "gate", label: "Gate decision", icon: ShieldCheck },
  { kind: "cans", label: "Finalize CANS", icon: ClipboardCheck },
  { kind: "mhtcm_route", label: "MHTCM target", icon: GitBranch },
  { kind: "mhrs_route", label: "MHRS target", icon: GitBranch },
  { kind: "medication", label: "Medication alert", icon: Pill },
];

const GATES: ReadonlyArray<{ value: GateKind; label: string }> = [
  { value: "intake", label: "Intake complete" },
  { value: "eligibility", label: "Eligibility" },
  { value: "payer_authorization", label: "Payer authorization" },
  { value: "consent", label: "Consent" },
  { value: "cans_schedule", label: "CANS schedule" },
  { value: "capacity", label: "Capacity" },
];

const inputClass =
  "min-h-10 w-full rounded-lg border bg-transparent px-3 text-[11px] outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

function localDateTime(offsetHours: number): string {
  const value = new Date(Date.now() + offsetHours * 60 * 60 * 1_000);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function GateOutcomeNotice({
  gate,
  eligibilityStatus,
  capacityStatus,
}: {
  gate: GateKind;
  eligibilityStatus: "eligible" | "ineligible" | "needs_review";
  capacityStatus: "available" | "reserved" | "waitlisted" | "unavailable";
}) {
  const message =
    gate === "eligibility" && eligibilityStatus === "ineligible"
      ? "Server effect: persists a rejected referral and rejection reason."
      : gate === "eligibility" && eligibilityStatus === "needs_review"
        ? "Server effect: persists a held referral pending controlled review."
        : gate === "capacity" &&
            ["waitlisted", "unavailable"].includes(capacityStatus)
          ? "Server effect: persists a held referral until a passing capacity decision is recorded."
          : "The server recomputes readiness and persists any resulting referral status.";
  return (
    <p
      className="rounded-lg border px-3 py-2 text-[10px] leading-4"
      style={{ borderColor: `${COLORS.amber}55`, color: COLORS.amber }}
    >
      {message}
    </p>
  );
}

export function CcmgCarePathActions({
  referralId,
  referralVersion,
  latestCansAssessmentId,
  authenticatedRoleLabel,
  synthetic,
  enabled,
  disabledReason,
  submitting,
  error,
  success,
  onAction,
}: {
  referralId: string;
  referralVersion: number | null;
  latestCansAssessmentId: string | null;
  authenticatedRoleLabel: string;
  synthetic: boolean;
  enabled: boolean;
  disabledReason?: string;
  submitting: boolean;
  error?: string;
  success?: string;
  onAction: (request: CcmgCarePathActionRequest) => Promise<void>;
}) {
  const [kind, setKind] = useState<CarePathKind>("gate");
  const [gate, setGate] = useState<GateKind>("intake");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [eligibilityStatus, setEligibilityStatus] = useState<
    "eligible" | "ineligible" | "needs_review"
  >("eligible");
  const [eligibilityRationale, setEligibilityRationale] = useState(
    "Synthetic reviewer gate decision.",
  );
  const [criteria, setCriteria] = useState<EligibilityCriteria>({
    ageQualified: true,
    diagnosisQualified: true,
    functionalImpairment: true,
    coverageQualified: true,
  });

  const [payerLabel, setPayerLabel] = useState("Synthetic payer");
  const [verificationStatus, setVerificationStatus] = useState<
    "verified" | "failed"
  >("verified");
  const [authorizationRequired, setAuthorizationRequired] = useState(true);
  const [authorizationStatus, setAuthorizationStatus] = useState<
    "not_required" | "pending" | "approved" | "denied" | "expired"
  >("approved");
  const [authorizationReference, setAuthorizationReference] =
    useState("SYN-AUTH-REVIEW");
  const [authorizationEffectiveAt, setAuthorizationEffectiveAt] = useState(() =>
    localDateTime(0),
  );
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState(() =>
    localDateTime(24 * 30),
  );

  const [consentStatus, setConsentStatus] = useState<
    "active" | "declined" | "revoked" | "expired"
  >("active");
  const [consentReference, setConsentReference] =
    useState("SYN-CONSENT-REVIEW");
  const [consentEffectiveAt, setConsentEffectiveAt] = useState(() =>
    localDateTime(0),
  );
  const [consentExpiresAt, setConsentExpiresAt] = useState(() =>
    localDateTime(24 * 30),
  );

  const [cansScheduleStatus, setCansScheduleStatus] = useState<
    "scheduled" | "overdue" | "cancelled"
  >("scheduled");
  const [cansDueAt, setCansDueAt] = useState(() => localDateTime(24));
  const [cansScheduledFor, setCansScheduledFor] = useState(() =>
    localDateTime(12),
  );

  const [capacityRequired, setCapacityRequired] = useState(true);
  const [capacityStatus, setCapacityStatus] = useState<
    "available" | "reserved" | "waitlisted" | "unavailable"
  >("available");
  const [facilityLabel, setFacilityLabel] = useState("Synthetic CCMG capacity");
  const [availableSlots, setAvailableSlots] = useState(1);
  const [reservedSlotReference, setReservedSlotReference] =
    useState("SYN-SLOT-REVIEW");
  const [capacityCheckedAt, setCapacityCheckedAt] = useState(() =>
    localDateTime(0),
  );

  const [instrumentVersion, setInstrumentVersion] = useState("CANS 2.0");
  const [domainScores, setDomainScores] = useState<
    Record<CcmgCansDomain, number>
  >({
    behavioral_emotional: 2,
    risk_behaviors: 2,
    life_functioning: 2,
    strengths: 1,
    caregiver_resources: 2,
    cultural_factors: 1,
  });
  const [totalScore, setTotalScore] = useState(28);
  const [acuity, setAcuity] = useState<
    "low" | "moderate" | "high" | "critical"
  >("high");
  const [completedAt, setCompletedAt] = useState(() => localDateTime(0));
  const [itemCode, setItemCode] = useState("SYN-NEED-REVIEW");
  const [itemLabel, setItemLabel] = useState(
    "Synthetic care coordination need",
  );
  const [itemDomain, setItemDomain] = useState<CcmgCansDomain>(
    "behavioral_emotional",
  );
  const [itemRating, setItemRating] = useState<0 | 1 | 2 | 3>(2);
  const [itemDisposition, setItemDisposition] = useState<"need" | "strength">(
    "need",
  );

  const [cansAssessmentId, setCansAssessmentId] = useState(
    latestCansAssessmentId ?? "",
  );
  const [mhtcmTargetId, setMhtcmTargetId] = useState("SYN-MHTCM-PLAN-REVIEW");
  const [mhrsTargetId, setMhrsTargetId] = useState("SYN-MHRS-GOALS-REVIEW");
  const [targetVersion, setTargetVersion] = useState(1);

  const [medicationTitle, setMedicationTitle] = useState(
    "Urgent synthetic medication-oversight review",
  );
  const [medicationPriority, setMedicationPriority] = useState<
    "urgent" | "critical"
  >("urgent");
  const [medicationDueAt, setMedicationDueAt] = useState(() =>
    localDateTime(4),
  );

  if (!synthetic) return null;

  const formEnabled = enabled && referralVersion !== null;

  const submitGate = async (auditReason: string) => {
    if (gate === "intake") {
      await onAction({
        kind: "record_gate",
        gate,
        decision: { status: "complete" },
        reason: auditReason,
      });
      return;
    }
    if (gate === "eligibility") {
      if (!eligibilityRationale.trim()) {
        throw new Error("Eligibility rationale is required.");
      }
      await onAction({
        kind: "record_gate",
        gate,
        decision: {
          status: eligibilityStatus,
          criteria,
          rationale: eligibilityRationale.trim(),
        },
        reason: auditReason,
      });
      return;
    }
    if (gate === "payer_authorization") {
      const effectiveAt = authorizationEffectiveAt
        ? toIso(authorizationEffectiveAt)
        : null;
      const expiresAt = authorizationExpiresAt
        ? toIso(authorizationExpiresAt)
        : null;
      if (
        (authorizationEffectiveAt && !effectiveAt) ||
        (authorizationExpiresAt && !expiresAt)
      ) {
        throw new Error(
          "Enter valid authorization effective and expiry times.",
        );
      }
      await onAction({
        kind: "record_gate",
        gate,
        decision: {
          payerLabel: payerLabel.trim(),
          verificationStatus,
          authorizationRequired,
          authorizationStatus,
          ...(authorizationReference.trim()
            ? { authorizationReference: authorizationReference.trim() }
            : {}),
          ...(effectiveAt ? { effectiveAt } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        },
        reason: auditReason,
      });
      return;
    }
    if (gate === "consent") {
      const effectiveAt = consentEffectiveAt ? toIso(consentEffectiveAt) : null;
      const expiresAt = consentExpiresAt ? toIso(consentExpiresAt) : null;
      if (
        (consentEffectiveAt && !effectiveAt) ||
        (consentExpiresAt && !expiresAt)
      ) {
        throw new Error("Enter valid consent effective and expiry times.");
      }
      await onAction({
        kind: "record_gate",
        gate,
        decision: {
          status: consentStatus,
          ...(consentReference.trim()
            ? { consentReference: consentReference.trim() }
            : {}),
          ...(effectiveAt ? { effectiveAt } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        },
        reason: auditReason,
      });
      return;
    }
    if (gate === "cans_schedule") {
      const dueAt = toIso(cansDueAt);
      const scheduledFor = cansScheduledFor ? toIso(cansScheduledFor) : null;
      if (!dueAt || (cansScheduledFor && !scheduledFor)) {
        throw new Error("Enter valid CANS due and scheduled times.");
      }
      await onAction({
        kind: "record_gate",
        gate,
        decision: {
          status: cansScheduleStatus,
          dueAt,
          ...(scheduledFor ? { scheduledFor } : {}),
        },
        reason: auditReason,
      });
      return;
    }

    const checkedAt = capacityCheckedAt ? toIso(capacityCheckedAt) : null;
    if (capacityCheckedAt && !checkedAt) {
      throw new Error("Enter a valid capacity check time.");
    }
    await onAction({
      kind: "record_gate",
      gate: "capacity",
      decision: {
        required: capacityRequired,
        ...(facilityLabel.trim()
          ? { facilityLabel: facilityLabel.trim() }
          : {}),
        status: capacityStatus,
        ...(["available", "reserved"].includes(capacityStatus) &&
        Number.isInteger(availableSlots) &&
        availableSlots >= 0
          ? { availableSlots }
          : {}),
        ...(capacityStatus === "reserved" && reservedSlotReference.trim()
          ? { reservedSlotReference: reservedSlotReference.trim() }
          : {}),
        ...(checkedAt ? { checkedAt } : {}),
      },
      reason: auditReason,
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const auditReason = reason.trim();
    if (!auditReason) {
      setValidationError("A reason is required for the immutable audit trail.");
      return;
    }
    if (!formEnabled || submitting) return;
    setValidationError(null);
    try {
      if (kind === "gate") {
        await submitGate(auditReason);
        return;
      }
      if (kind === "cans") {
        const completedAtIso = toIso(completedAt);
        if (
          !completedAtIso ||
          !instrumentVersion.trim() ||
          !itemCode.trim() ||
          !itemLabel.trim()
        ) {
          throw new Error(
            "Complete the CANS version and actionable item fields.",
          );
        }
        if (
          CCMG_CANS_DOMAINS.some(
            (domain) =>
              !Number.isInteger(domainScores[domain]) ||
              domainScores[domain] < 0 ||
              domainScores[domain] > 3,
          )
        ) {
          throw new Error(
            "Each CANS domain score must be an integer from 0 to 3.",
          );
        }
        await onAction({
          kind: "finalize_cans",
          instrumentVersion: instrumentVersion.trim(),
          domainScores,
          actionableItems: [
            {
              itemCode: itemCode.trim(),
              label: itemLabel.trim(),
              domain: itemDomain,
              rating: itemRating,
              disposition: itemDisposition,
            },
          ],
          totalScore,
          acuity,
          completedAt: completedAtIso,
          reason: auditReason,
        });
        return;
      }
      if (kind === "mhtcm_route" || kind === "mhrs_route") {
        const targetRecordId =
          kind === "mhtcm_route" ? mhtcmTargetId.trim() : mhrsTargetId.trim();
        if (
          !cansAssessmentId.trim() ||
          !targetRecordId ||
          !Number.isInteger(targetVersion) ||
          targetVersion < 1
        ) {
          throw new Error(
            "A finalized CANS assessment, target record, and positive target version are required.",
          );
        }
        await onAction({
          kind: "approve_target_route",
          cansAssessmentId: cansAssessmentId.trim(),
          targetType:
            kind === "mhtcm_route" ? "mhtcm_plan" : "mhrs_skills_goals",
          targetRecordId,
          targetVersion,
          reason: auditReason,
        });
        return;
      }

      const medicationDueAtIso = toIso(medicationDueAt);
      if (!medicationTitle.trim() || !medicationDueAtIso) {
        throw new Error(
          "Medication alert title and a valid due time are required.",
        );
      }
      await onAction({
        kind: "create_medication_alert",
        title: medicationTitle.trim(),
        priority: medicationPriority,
        dueAt: medicationDueAtIso,
        reason: auditReason,
      });
    } catch (submissionError: unknown) {
      setValidationError(
        submissionError instanceof Error
          ? submissionError.message
          : "The care-path request could not be prepared.",
      );
    }
  };

  return (
    <section
      className="mt-4 rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      aria-labelledby="care-path-actions-heading"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2
            id="care-path-actions-heading"
            className="text-[13px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            Synthetic-demo care path
          </h2>
          <p
            className="mt-1 max-w-3xl text-[10px] leading-4"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Exercise controlled gates—including persisted rejection and hold
            outcomes—CANS finalization, both approved plan targets, and urgent
            medication oversight. The server validates the authenticated role,
            current referral version, prerequisites, and audit reason; this
            interface makes no optimistic completion claim.
          </p>
        </div>
        <div
          className="rounded-lg border px-3 py-2 text-[9px] leading-4"
          style={{ borderColor: "var(--card-border)", color: COLORS.slate }}
        >
          <p>{authenticatedRoleLabel}</p>
          <p>
            {referralId} · Referral version {referralVersion ?? "—"}
          </p>
        </div>
      </div>

      {!formEnabled && (
        <p
          className="mt-3 rounded-lg border px-3 py-2 text-[10px]"
          style={{ borderColor: `${COLORS.amber}66`, color: COLORS.amber }}
        >
          {disabledReason ??
            "A server-returned referral version is required before care-path actions are enabled."}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const active = action.kind === kind;
          return (
            <button
              key={action.kind}
              type="button"
              onClick={() => {
                setKind(action.kind);
                setValidationError(null);
              }}
              aria-pressed={active}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{
                color: active ? "white" : COLORS.teal,
                borderColor: active ? COLORS.teal : "var(--card-border)",
                backgroundColor: active ? COLORS.teal : "transparent",
              }}
            >
              <Icon size={14} aria-hidden="true" /> {action.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {kind === "gate" && (
          <div className="space-y-3">
            <label className="block text-[10px] font-semibold">
              Gate
              <select
                className={`${inputClass} mt-1`}
                value={gate}
                onChange={(event) => setGate(event.target.value as GateKind)}
                disabled={!formEnabled || submitting}
              >
                {GATES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {gate === "intake" && (
              <p className="text-[10px]" style={{ color: COLORS.slate }}>
                Records the controlled intake decision as complete. Actor and
                completion time are stamped by the server.
              </p>
            )}

            {gate === "eligibility" && (
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="text-[10px] font-semibold">
                  Eligibility status
                  <select
                    className={`${inputClass} mt-1`}
                    value={eligibilityStatus}
                    onChange={(event) =>
                      setEligibilityStatus(
                        event.target.value as typeof eligibilityStatus,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    <option value="eligible">Eligible</option>
                    <option value="ineligible">Ineligible — reject</option>
                    <option value="needs_review">Needs review — hold</option>
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Eligibility rationale
                  <input
                    className={`${inputClass} mt-1`}
                    value={eligibilityRationale}
                    onChange={(event) =>
                      setEligibilityRationale(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
                  {Object.entries(criteria).map(([criterion, checked]) => (
                    <label
                      key={criterion}
                      className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px]"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setCriteria((current) => ({
                            ...current,
                            [criterion]: event.target.checked,
                          }))
                        }
                        disabled={!formEnabled || submitting}
                      />
                      {humanize(criterion)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {gate === "payer_authorization" && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-[10px] font-semibold">
                  Payer label
                  <input
                    className={`${inputClass} mt-1`}
                    value={payerLabel}
                    onChange={(event) => setPayerLabel(event.target.value)}
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Verification
                  <select
                    className={`${inputClass} mt-1`}
                    value={verificationStatus}
                    onChange={(event) =>
                      setVerificationStatus(
                        event.target.value as typeof verificationStatus,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    <option value="verified">Verified</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Authorization status
                  <select
                    className={`${inputClass} mt-1`}
                    value={authorizationStatus}
                    onChange={(event) =>
                      setAuthorizationStatus(
                        event.target.value as typeof authorizationStatus,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    {[
                      "not_required",
                      "pending",
                      "approved",
                      "denied",
                      "expired",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {humanize(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Authorization reference
                  <input
                    className={`${inputClass} mt-1`}
                    value={authorizationReference}
                    onChange={(event) =>
                      setAuthorizationReference(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Effective at
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={authorizationEffectiveAt}
                    onChange={(event) =>
                      setAuthorizationEffectiveAt(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Expires at
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={authorizationExpiresAt}
                    onChange={(event) =>
                      setAuthorizationExpiresAt(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-[10px] font-semibold md:col-span-2 xl:col-span-3">
                  <input
                    type="checkbox"
                    checked={authorizationRequired}
                    onChange={(event) => {
                      const required = event.target.checked;
                      setAuthorizationRequired(required);
                      setAuthorizationStatus((current) =>
                        required
                          ? current === "not_required"
                            ? "pending"
                            : current
                          : "not_required",
                      );
                    }}
                    disabled={!formEnabled || submitting}
                  />
                  Authorization required
                </label>
              </div>
            )}

            {gate === "consent" && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-[10px] font-semibold">
                  Consent status
                  <select
                    className={`${inputClass} mt-1`}
                    value={consentStatus}
                    onChange={(event) =>
                      setConsentStatus(
                        event.target.value as typeof consentStatus,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    {["active", "declined", "revoked", "expired"].map(
                      (status) => (
                        <option key={status} value={status}>
                          {humanize(status)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Consent reference
                  <input
                    className={`${inputClass} mt-1`}
                    value={consentReference}
                    onChange={(event) =>
                      setConsentReference(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Effective at
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={consentEffectiveAt}
                    onChange={(event) =>
                      setConsentEffectiveAt(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Expires at
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={consentExpiresAt}
                    onChange={(event) =>
                      setConsentExpiresAt(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
              </div>
            )}

            {gate === "cans_schedule" && (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-[10px] font-semibold">
                  Schedule status
                  <select
                    className={`${inputClass} mt-1`}
                    value={cansScheduleStatus}
                    onChange={(event) =>
                      setCansScheduleStatus(
                        event.target.value as typeof cansScheduleStatus,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    {["scheduled", "overdue", "cancelled"].map((status) => (
                      <option key={status} value={status}>
                        {humanize(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Due at
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={cansDueAt}
                    onChange={(event) => setCansDueAt(event.target.value)}
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Scheduled for
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={cansScheduledFor}
                    onChange={(event) =>
                      setCansScheduledFor(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
              </div>
            )}

            {gate === "capacity" && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-[10px] font-semibold">
                  Capacity status
                  <select
                    className={`${inputClass} mt-1`}
                    value={capacityStatus}
                    onChange={(event) =>
                      setCapacityStatus(
                        event.target.value as typeof capacityStatus,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    {["available", "reserved", "waitlisted", "unavailable"].map(
                      (status) => (
                        <option key={status} value={status}>
                          {humanize(status)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Facility label
                  <input
                    className={`${inputClass} mt-1`}
                    value={facilityLabel}
                    onChange={(event) => setFacilityLabel(event.target.value)}
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Available slots
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} mt-1`}
                    value={availableSlots}
                    onChange={(event) =>
                      setAvailableSlots(Number(event.target.value))
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Reservation reference
                  <input
                    className={`${inputClass} mt-1`}
                    value={reservedSlotReference}
                    onChange={(event) =>
                      setReservedSlotReference(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="text-[10px] font-semibold">
                  Checked at
                  <input
                    type="datetime-local"
                    className={`${inputClass} mt-1`}
                    value={capacityCheckedAt}
                    onChange={(event) =>
                      setCapacityCheckedAt(event.target.value)
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-[10px] font-semibold self-end">
                  <input
                    type="checkbox"
                    checked={capacityRequired}
                    onChange={(event) =>
                      setCapacityRequired(event.target.checked)
                    }
                    disabled={!formEnabled || submitting}
                  />
                  Capacity required
                </label>
              </div>
            )}

            <GateOutcomeNotice
              gate={gate}
              eligibilityStatus={eligibilityStatus}
              capacityStatus={capacityStatus}
            />
          </div>
        )}

        {kind === "cans" && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-[10px] font-semibold">
                Instrument version
                <input
                  className={`${inputClass} mt-1`}
                  value={instrumentVersion}
                  onChange={(event) => setInstrumentVersion(event.target.value)}
                  disabled={!formEnabled || submitting}
                />
              </label>
              <label className="text-[10px] font-semibold">
                Total score
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} mt-1`}
                  value={totalScore}
                  onChange={(event) =>
                    setTotalScore(Number(event.target.value))
                  }
                  disabled={!formEnabled || submitting}
                />
              </label>
              <label className="text-[10px] font-semibold">
                Acuity
                <select
                  className={`${inputClass} mt-1`}
                  value={acuity}
                  onChange={(event) =>
                    setAcuity(event.target.value as typeof acuity)
                  }
                  disabled={!formEnabled || submitting}
                >
                  {["low", "moderate", "high", "critical"].map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-semibold">
                Completed at
                <input
                  type="datetime-local"
                  className={`${inputClass} mt-1`}
                  value={completedAt}
                  onChange={(event) => setCompletedAt(event.target.value)}
                  disabled={!formEnabled || submitting}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {CCMG_CANS_DOMAINS.map((domain) => (
                <label key={domain} className="text-[10px] font-semibold">
                  {humanize(domain)}
                  <input
                    type="number"
                    min={0}
                    max={3}
                    className={`${inputClass} mt-1`}
                    value={domainScores[domain]}
                    onChange={(event) =>
                      setDomainScores((current) => ({
                        ...current,
                        [domain]: Number(event.target.value),
                      }))
                    }
                    disabled={!formEnabled || submitting}
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-[10px] font-semibold">
                Actionable item code
                <input
                  className={`${inputClass} mt-1`}
                  value={itemCode}
                  onChange={(event) => setItemCode(event.target.value)}
                  disabled={!formEnabled || submitting}
                />
              </label>
              <label className="text-[10px] font-semibold xl:col-span-2">
                Actionable item label
                <input
                  className={`${inputClass} mt-1`}
                  value={itemLabel}
                  onChange={(event) => setItemLabel(event.target.value)}
                  disabled={!formEnabled || submitting}
                />
              </label>
              <label className="text-[10px] font-semibold">
                Domain
                <select
                  className={`${inputClass} mt-1`}
                  value={itemDomain}
                  onChange={(event) =>
                    setItemDomain(event.target.value as CcmgCansDomain)
                  }
                  disabled={!formEnabled || submitting}
                >
                  {CCMG_CANS_DOMAINS.map((domain) => (
                    <option key={domain} value={domain}>
                      {humanize(domain)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold">
                  Rating
                  <select
                    className={`${inputClass} mt-1`}
                    value={itemRating}
                    onChange={(event) =>
                      setItemRating(Number(event.target.value) as 0 | 1 | 2 | 3)
                    }
                    disabled={!formEnabled || submitting}
                  >
                    {[0, 1, 2, 3].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-semibold">
                  Type
                  <select
                    className={`${inputClass} mt-1`}
                    value={itemDisposition}
                    onChange={(event) =>
                      setItemDisposition(
                        event.target.value as typeof itemDisposition,
                      )
                    }
                    disabled={!formEnabled || submitting}
                  >
                    <option value="need">Need</option>
                    <option value="strength">Strength</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}

        {(kind === "mhtcm_route" || kind === "mhrs_route") && (
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-[10px] font-semibold">
              Finalized CANS assessment ID
              <input
                className={`${inputClass} mt-1`}
                value={cansAssessmentId}
                onChange={(event) => setCansAssessmentId(event.target.value)}
                disabled={!formEnabled || submitting}
              />
            </label>
            <label className="text-[10px] font-semibold">
              {kind === "mhtcm_route" ? "MHTCM plan" : "MHRS skills/goals"}{" "}
              record ID
              <input
                className={`${inputClass} mt-1`}
                value={kind === "mhtcm_route" ? mhtcmTargetId : mhrsTargetId}
                onChange={(event) =>
                  kind === "mhtcm_route"
                    ? setMhtcmTargetId(event.target.value)
                    : setMhrsTargetId(event.target.value)
                }
                disabled={!formEnabled || submitting}
              />
            </label>
            <label className="text-[10px] font-semibold">
              Target version
              <input
                type="number"
                min={1}
                className={`${inputClass} mt-1`}
                value={targetVersion}
                onChange={(event) =>
                  setTargetVersion(Number(event.target.value))
                }
                disabled={!formEnabled || submitting}
              />
            </label>
            <p
              className="text-[10px] leading-4 md:col-span-3"
              style={{ color: COLORS.slate }}
            >
              The server independently approves and routes this one target,
              creates its controlled work and handoff records, and returns new
              versions. Complete both target actions to establish dual lineage.
            </p>
          </div>
        )}

        {kind === "medication" && (
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-[10px] font-semibold">
              Alert title
              <input
                className={`${inputClass} mt-1`}
                value={medicationTitle}
                onChange={(event) => setMedicationTitle(event.target.value)}
                disabled={!formEnabled || submitting}
              />
            </label>
            <label className="text-[10px] font-semibold">
              Priority
              <select
                className={`${inputClass} mt-1`}
                value={medicationPriority}
                onChange={(event) =>
                  setMedicationPriority(
                    event.target.value as typeof medicationPriority,
                  )
                }
                disabled={!formEnabled || submitting}
              >
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="text-[10px] font-semibold">
              Due at
              <input
                type="datetime-local"
                className={`${inputClass} mt-1`}
                value={medicationDueAt}
                onChange={(event) => setMedicationDueAt(event.target.value)}
                disabled={!formEnabled || submitting}
              />
            </label>
            <p
              className="text-[10px] leading-4 md:col-span-3"
              style={{ color: COLORS.slate }}
            >
              After the alert is returned as a medication-oversight work item,
              use the existing guided Approval action for the clinical-director
              disposition. Server versions remain mandatory for both steps.
            </p>
          </div>
        )}

        <label className="block text-[10px] font-semibold">
          Audit reason
          <textarea
            className={`${inputClass} mt-1 min-h-20 py-2`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Required server-audited rationale"
            disabled={!formEnabled || submitting}
          />
        </label>

        {(validationError || error || success) && (
          <p
            role={validationError || error ? "alert" : "status"}
            className="rounded-lg border px-3 py-2 text-[10px]"
            style={{
              borderColor: validationError || error ? "#FCA5A5" : "#86EFAC",
              color: validationError || error ? COLORS.red : "#047857",
            }}
          >
            {validationError ?? error ?? success}
          </p>
        )}

        <button
          type="submit"
          disabled={!formEnabled || submitting}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: COLORS.teal }}
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Submit to controlled M2.1 service
        </button>
      </form>
    </section>
  );
}
