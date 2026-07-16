import type { CcmgEvidenceClass, ReferralStatus } from "./intake";

export const CANS_DOMAINS = [
  "behavioral_emotional",
  "risk_behaviors",
  "life_functioning",
  "strengths",
  "caregiver_resources",
  "cultural_factors",
] as const;

export type CansDomain = (typeof CANS_DOMAINS)[number];
export type CansAcuity = "low" | "moderate" | "high" | "critical";

export interface CansActionableItem {
  itemCode: string;
  label: string;
  domain: CansDomain;
  rating: 0 | 1 | 2 | 3;
  disposition: "need" | "strength";
}

export interface CansAssessmentVersion {
  id: string;
  caseId: string;
  referralId: string;
  evidenceClass: CcmgEvidenceClass;
  version: number;
  instrumentVersion: string;
  status: "draft" | "final" | "superseded";
  previousAssessmentId: string | null;
  completedAt: string | null;
  completedBy: string | null;
  totalScore: number | null;
  acuity: CansAcuity;
  domainScores: Readonly<Record<CansDomain, number>>;
  actionableItems: readonly CansActionableItem[];
  createdAt: string;
}

export interface ApprovedPlanTarget {
  id: string;
  version: number;
  targetType: "mhtcm_plan" | "mhrs_skills_goals";
  status: "draft" | "under_review" | "approved" | "superseded";
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface RoutedPlanGoal {
  sourceItemCode: string;
  sourceDomain: CansDomain;
  sourceRating: number;
  goalCode: string;
  goalText: string;
  workflow: "MHTCM" | "MHRS";
}

export interface CansPlanLineage {
  cansAssessmentId: string;
  cansVersion: number;
  targetType: ApprovedPlanTarget["targetType"];
  targetRecordId: string;
  targetVersion: number;
  targetApprovalStatus: "approved";
  targetApprovedBy: string;
  targetApprovedAt: string;
  routedBy: string;
  routedAt: string;
  mappedGoals: readonly RoutedPlanGoal[];
}

export type CansRoutingReasonCode =
  | "REFERRAL_NOT_ROUTABLE"
  | "CANS_NOT_FINAL"
  | "CANS_VERSION_INVALID"
  | "CANS_PREVIOUS_VERSION_MISMATCH"
  | "CANS_HISTORY_SCOPE_MISMATCH"
  | "CANS_DOMAIN_SCORE_INVALID"
  | "CANS_ACTIONABLE_ITEM_INVALID"
  | "TARGET_NOT_APPROVED"
  | "TARGET_TYPE_MISMATCH"
  | "TARGET_VERSION_INVALID";

export interface CansRoutingResult {
  valid: boolean;
  reasonCodes: readonly CansRoutingReasonCode[];
  lineage: readonly CansPlanLineage[];
}

const MHTCM_FUNCTION_BY_DOMAIN: Readonly<Record<CansDomain, string>> = {
  behavioral_emotional: "monitoring",
  risk_behaviors: "coordination",
  life_functioning: "referral",
  strengths: "transition",
  caregiver_resources: "coordination",
  cultural_factors: "intake",
};

function mhtcmGoals(items: readonly CansActionableItem[]): RoutedPlanGoal[] {
  return items
    .filter((item) => item.disposition === "need" && item.rating >= 2)
    .map((item) => ({
      sourceItemCode: item.itemCode,
      sourceDomain: item.domain,
      sourceRating: item.rating,
      goalCode: `MHTCM-${MHTCM_FUNCTION_BY_DOMAIN[item.domain].toUpperCase()}-${item.itemCode}`,
      goalText: `Address ${item.label.toLowerCase()} through the approved ${MHTCM_FUNCTION_BY_DOMAIN[item.domain]} function.`,
      workflow: "MHTCM" as const,
    }));
}

function mhrsGoals(items: readonly CansActionableItem[]): RoutedPlanGoal[] {
  return items
    .filter((item) => (
      (item.disposition === "need" && item.rating >= 2 && ["behavioral_emotional", "life_functioning", "caregiver_resources"].includes(item.domain))
      || (item.disposition === "strength" && item.rating >= 1)
    ))
    .map((item) => ({
      sourceItemCode: item.itemCode,
      sourceDomain: item.domain,
      sourceRating: item.rating,
      goalCode: `MHRS-SKILL-${item.itemCode}`,
      goalText: `Build and practice a measurable skill for ${item.label.toLowerCase()}.`,
      workflow: "MHRS" as const,
    }));
}

export function routeCansToApprovedPlans(input: {
  referralStatus: ReferralStatus;
  assessment: CansAssessmentVersion;
  previousAssessment: CansAssessmentVersion | null;
  mhtcmPlan: ApprovedPlanTarget;
  mhrsSkillsGoals: ApprovedPlanTarget;
  routedBy: string;
  routedAt: string;
}): CansRoutingResult {
  const reasons: CansRoutingReasonCode[] = [];
  const { assessment, previousAssessment } = input;

  if (!["ready_for_routing", "active"].includes(input.referralStatus)) reasons.push("REFERRAL_NOT_ROUTABLE");
  if (assessment.status !== "final") reasons.push("CANS_NOT_FINAL");
  if (!Number.isInteger(assessment.version) || assessment.version < 1) reasons.push("CANS_VERSION_INVALID");
  if (assessment.version === 1 && assessment.previousAssessmentId !== null) reasons.push("CANS_PREVIOUS_VERSION_MISMATCH");
  if (assessment.version > 1 && (
    !previousAssessment
    || assessment.previousAssessmentId !== previousAssessment.id
    || previousAssessment.version !== assessment.version - 1
    || previousAssessment.caseId !== assessment.caseId
  )) reasons.push("CANS_PREVIOUS_VERSION_MISMATCH");
  if (CANS_DOMAINS.some((domain) => {
    const score = assessment.domainScores[domain];
    return !Number.isInteger(score) || score < 0 || score > 3;
  })) reasons.push("CANS_DOMAIN_SCORE_INVALID");
  if (assessment.actionableItems.some((item) => !CANS_DOMAINS.includes(item.domain) || item.rating < 0 || item.rating > 3 || !item.itemCode.trim())) {
    reasons.push("CANS_ACTIONABLE_ITEM_INVALID");
  }

  const targets = [input.mhtcmPlan, input.mhrsSkillsGoals];
  if (input.mhtcmPlan.targetType !== "mhtcm_plan" || input.mhrsSkillsGoals.targetType !== "mhrs_skills_goals") {
    reasons.push("TARGET_TYPE_MISMATCH");
  }
  if (targets.some((target) => target.status !== "approved" || !target.approvedBy || !target.approvedAt)) reasons.push("TARGET_NOT_APPROVED");
  if (targets.some((target) => !Number.isInteger(target.version) || target.version < 1)) reasons.push("TARGET_VERSION_INVALID");
  if (reasons.length > 0) return { valid: false, reasonCodes: [...new Set(reasons)], lineage: [] };

  return {
    valid: true,
    reasonCodes: [],
    lineage: targets.map((target) => ({
      cansAssessmentId: assessment.id,
      cansVersion: assessment.version,
      targetType: target.targetType,
      targetRecordId: target.id,
      targetVersion: target.version,
      targetApprovalStatus: "approved",
      targetApprovedBy: target.approvedBy!,
      targetApprovedAt: target.approvedAt!,
      routedBy: input.routedBy,
      routedAt: input.routedAt,
      mappedGoals: target.targetType === "mhtcm_plan"
        ? mhtcmGoals(assessment.actionableItems)
        : mhrsGoals(assessment.actionableItems),
    })),
  };
}

export function validateCansVersionHistory(versions: readonly CansAssessmentVersion[]): readonly CansRoutingReasonCode[] {
  const sorted = [...versions].sort((left, right) => left.version - right.version);
  const reasons: CansRoutingReasonCode[] = [];
  const historyScope = sorted[0]
    ? {
        caseId: sorted[0].caseId,
        referralId: sorted[0].referralId,
        evidenceClass: sorted[0].evidenceClass,
      }
    : null;
  sorted.forEach((assessment, index) => {
    if (historyScope && (
      assessment.caseId !== historyScope.caseId
      || assessment.referralId !== historyScope.referralId
      || assessment.evidenceClass !== historyScope.evidenceClass
    )) reasons.push("CANS_HISTORY_SCOPE_MISMATCH");
    if (assessment.version !== index + 1) reasons.push("CANS_VERSION_INVALID");
    if (index === 0 && assessment.previousAssessmentId !== null) reasons.push("CANS_PREVIOUS_VERSION_MISMATCH");
    if (index > 0 && assessment.previousAssessmentId !== sorted[index - 1].id) reasons.push("CANS_PREVIOUS_VERSION_MISMATCH");
  });
  return [...new Set(reasons)];
}
