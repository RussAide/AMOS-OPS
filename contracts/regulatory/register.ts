/**
 * M1.2 controlled regulatory-rules register.
 *
 * This is a synthetic prototype control set. It contains no patient, employee,
 * or production data. Human acceptance of the milestone is recorded outside
 * the application package by the milestone owner.
 */

export type RegulatoryDomain = "MHTCM" | "MHRS" | "BILLING" | "GRO" | "PART2";
export type RuleControlState = "operational" | "conditional";

export interface RegulatorySourceValidation {
  id: string;
  title: string;
  authority: string;
  url: string;
  versionOrEffectiveDate: string;
  validatedOn: string;
  validationStatus: "current-source-validated";
  scope: readonly RegulatoryDomain[];
}

export interface RegulatoryRule {
  id: string;
  domain: RegulatoryDomain;
  title: string;
  authorityId: string;
  citation: string;
  owner: string;
  implementationPoint: string;
  uiControl: string;
  apiControl: string;
  databaseControl: string;
  auditEvent: string;
  exceptionWorkflow: string;
  automatedTest: string;
  state: RuleControlState;
}

export interface RegulatoryRuleReview {
  id: string;
  ruleId: string;
  reviewLane: "compliance" | "operations";
  reviewer: string;
  reviewedOn: string;
  status: "prototype-reviewed";
  note: string;
}

export interface RegulatoryException {
  id: string;
  ruleId: string;
  title: string;
  safeDisposition: string;
  owner: string;
  status: "controlled-open";
}

export interface RegulatoryScenario {
  id: string;
  domain: RegulatoryDomain;
  title: string;
  expectedOutcome: "allow" | "deny" | "review";
  evidence: string;
}

export const REGULATORY_SOURCE_VALIDATIONS: readonly RegulatorySourceValidation[] = [
  {
    id: "SRC-TMHP-BH-2026-07",
    title: "Texas Medicaid Provider Procedures Manual - Behavioral Health Services Handbook",
    authority: "Texas Medicaid & Healthcare Partnership",
    url: "https://www.tmhp.com/sites/default/files/file-library/resources/provider-manuals/tmppm/pdf-chapters/2026/2026-07-july/2_02_behavioral_health.pdf",
    versionOrEffectiveDate: "July 2026 handbook",
    validatedOn: "2026-07-14",
    validationStatus: "current-source-validated",
    scope: ["MHTCM", "MHRS", "BILLING"],
  },
  {
    id: "SRC-TX-26TAC-748",
    title: "Texas Administrative Code - 26 TAC Chapter 748",
    authority: "Texas Secretary of State",
    url: "https://texas-sos.appianportalsgov.com/rules-and-meetings?interface=VIEW_TAC&title=26&part=1&chapter=748",
    versionOrEffectiveDate: "Official TAC chapter queried as in effect on 2026-07-14",
    validatedOn: "2026-07-14",
    validationStatus: "current-source-validated",
    scope: ["GRO"],
  },
  {
    id: "SRC-42CFR-PART2",
    title: "42 CFR Part 2 - Confidentiality of Substance Use Disorder Patient Records",
    authority: "Electronic Code of Federal Regulations",
    url: "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2",
    versionOrEffectiveDate: "eCFR current through 2026-07-10 at validation",
    validatedOn: "2026-07-14",
    validationStatus: "current-source-validated",
    scope: ["PART2"],
  },
  {
    id: "SRC-45CFR-164-502",
    title: "45 CFR 164.502 - Uses and disclosures of protected health information",
    authority: "Electronic Code of Federal Regulations",
    url: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.502",
    versionOrEffectiveDate: "eCFR current online edition at validation",
    validatedOn: "2026-07-14",
    validationStatus: "current-source-validated",
    scope: ["PART2"],
  },
];

function rule(
  id: string,
  domain: RegulatoryDomain,
  title: string,
  authorityId: string,
  citation: string,
  owner: string,
  implementationPoint: string,
  automatedTest: string,
  state: RuleControlState = "operational",
): RegulatoryRule {
  return {
    id,
    domain,
    title,
    authorityId,
    citation,
    owner,
    implementationPoint,
    uiControl: `Regulatory Framework Command Center / ${domain} control card`,
    apiControl: `regulatoryFramework.evaluate${domain === "PART2" ? "Part2Disclosure" : domain === "GRO" ? "GroCompliance" : "ClinicalBilling"}`,
    databaseControl: "0003_m12_regulatory_framework.sql / regulatory_rules and regulatory_control_events",
    auditEvent: `regulatory.${domain.toLowerCase()}.${id.toLowerCase()}`,
    exceptionWorkflow: "Fail closed and create a controlled regulatory exception for compliance review",
    automatedTest,
    state,
  };
}

export const REGULATORY_RULES: readonly RegulatoryRule[] = [
  rule("M12-CL-001", "MHTCM", "Intake screening function", "SRC-TMHP-BH-2026-07", "MHTCM six-function model", "MHTCM Supervisor", "Clinical service workflow intake gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-002", "MHTCM", "Eligibility function", "SRC-TMHP-BH-2026-07", "MHTCM six-function model", "MHTCM Supervisor", "Eligibility and medical-necessity gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-003", "MHTCM", "Care coordination function", "SRC-TMHP-BH-2026-07", "MHTCM six-function model", "MHTCM Supervisor", "Care coordination work item", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-004", "MHTCM", "Referral management function", "SRC-TMHP-BH-2026-07", "MHTCM six-function model", "MHTCM Supervisor", "Referral tracking and closure gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-005", "MHTCM", "Discharge planning function", "SRC-TMHP-BH-2026-07", "MHTCM six-function model", "MHTCM Supervisor", "Discharge readiness workflow", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-006", "MHTCM", "Aftercare follow-up function", "SRC-TMHP-BH-2026-07", "MHTCM six-function model", "MHTCM Supervisor", "Post-discharge follow-up queue", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-007", "MHRS", "Psychosocial rehabilitation category", "SRC-TMHP-BH-2026-07", "MHRS four-category model", "MHRS Supervisor", "MHRS service selection gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-008", "MHRS", "Skills training category", "SRC-TMHP-BH-2026-07", "MHRS four-category model", "MHRS Supervisor", "MHRS service selection gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-009", "MHRS", "Supportive interventions category", "SRC-TMHP-BH-2026-07", "MHRS four-category model", "MHRS Supervisor", "MHRS service selection gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-CL-010", "MHRS", "Community integration category", "SRC-TMHP-BH-2026-07", "MHRS four-category model", "MHRS Supervisor", "MHRS service selection gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-BL-001", "BILLING", "T1017 service-code and unit control", "SRC-TMHP-BH-2026-07", "T1017 billing requirements", "Revenue Cycle Manager", "Claim proof-of-service gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-BL-002", "BILLING", "H2017 service-code and unit control", "SRC-TMHP-BH-2026-07", "H2017 billing requirements", "Revenue Cycle Manager", "Claim proof-of-service gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-BL-003", "BILLING", "H2014 service-code and unit control", "SRC-TMHP-BH-2026-07", "H2014 billing requirements", "Revenue Cycle Manager", "Claim proof-of-service gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-BL-004", "BILLING", "H2014-HO conditional billing control", "SRC-TMHP-BH-2026-07", "H2014 with HO modifier as applicable", "Revenue Cycle Manager", "Claim proof-of-service gate", "api/tests/m12-clinical-policy.test.ts", "conditional"),
  rule("M12-BL-005", "BILLING", "Service documentation completeness", "SRC-TMHP-BH-2026-07", "Documentation requirements", "Clinical Supervisor", "Encounter completion and signature gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-BL-006", "BILLING", "Authorization and review currency", "SRC-TMHP-BH-2026-07", "Prior authorization and periodic review", "Clinical Supervisor", "Authorization currency gate", "api/tests/m12-clinical-policy.test.ts"),
  rule("M12-GRO-001", "GRO", "Awake and sleeping staffing ratios", "SRC-TX-26TAC-748", "26 TAC Chapter 748 supervision ratios", "GRO Administrator", "Shift staffing composer", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-002", "GRO", "Under-five weighted supervision count", "SRC-TX-26TAC-748", "26 TAC Chapter 748 mixed-age supervision", "Program Director", "Shift ratio calculator", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-003", "GRO", "Bedroom square footage and capacity", "SRC-TX-26TAC-748", "26 TAC Chapter 748 physical environment", "Facilities Manager", "Room assignment gate", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-004", "GRO", "Youth rights delivery and acknowledgment", "SRC-TX-26TAC-748", "26 TAC Chapter 748 rights and responsibilities", "Program Director", "Admission rights checkpoint", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-005", "GRO", "Prohibited practices", "SRC-TX-26TAC-748", "26 TAC Chapter 748 behavior intervention", "Compliance Officer", "Incident and intervention entry gate", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-006", "GRO", "Restraint monitoring and medical response", "SRC-TX-26TAC-748", "26 TAC Chapter 748 emergency behavior intervention", "Director of Nursing", "Restraint event workflow", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-007", "GRO", "Post-event observation, discussion, and review", "SRC-TX-26TAC-748", "26 TAC Chapter 748 post-intervention review", "Program Director", "Post-event deadline monitor", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-GRO-008", "GRO", "Child and personnel record retention", "SRC-TX-26TAC-748", "26 TAC Chapter 748 records", "Compliance Officer", "DMS retention assignment", "api/tests/m12-gro-policy.test.ts"),
  rule("M12-P2-001", "PART2", "Part 2 applicability and protected-pending-review flag", "SRC-42CFR-PART2", "42 CFR 2.11-2.12", "Privacy Officer", "SUD record classification gate", "api/tests/m12-part2-policy.test.ts"),
  rule("M12-P2-002", "PART2", "Consent content and validity", "SRC-42CFR-PART2", "42 CFR 2.31", "Privacy Officer", "Disclosure consent gate", "api/tests/m12-part2-policy.test.ts"),
  rule("M12-P2-003", "PART2", "Minimum-necessary disclosure scope", "SRC-45CFR-164-502", "45 CFR 164.502(b)", "Privacy Officer", "Disclosure field-selection gate", "api/tests/m12-part2-policy.test.ts"),
  rule("M12-P2-004", "PART2", "Accompanying notice and redisclosure control", "SRC-42CFR-PART2", "42 CFR 2.32-2.33", "Privacy Officer", "Disclosure packaging gate", "api/tests/m12-part2-policy.test.ts"),
  rule("M12-P2-005", "PART2", "Medical-emergency exception record", "SRC-42CFR-PART2", "42 CFR 2.51", "Privacy Officer", "Emergency disclosure workflow", "api/tests/m12-part2-policy.test.ts"),
  rule("M12-P2-006", "PART2", "Access/disclosure audit and accounting", "SRC-42CFR-PART2", "42 CFR 2.25", "Privacy Officer", "Disclosure accounting ledger", "api/tests/m12-part2-policy.test.ts"),
];

export const REGULATORY_RULE_REVIEWS: readonly RegulatoryRuleReview[] = REGULATORY_RULES.flatMap((item) => [
  {
    id: `${item.id}-REV-C`,
    ruleId: item.id,
    reviewLane: "compliance" as const,
    reviewer: "Synthetic Compliance SME",
    reviewedOn: "2026-07-14",
    status: "prototype-reviewed" as const,
    note: "Synthetic prototype review completed against the cited source; formal human acceptance remains the milestone owner's decision.",
  },
  {
    id: `${item.id}-REV-O`,
    ruleId: item.id,
    reviewLane: "operations" as const,
    reviewer: "Synthetic Operational SME",
    reviewedOn: "2026-07-14",
    status: "prototype-reviewed" as const,
    note: "Synthetic workflow review completed for demonstrability and fail-closed behavior.",
  },
]);

export const REGULATORY_EXCEPTIONS: readonly RegulatoryException[] = [
  {
    id: "M12-EX-001",
    ruleId: "M12-BL-004",
    title: "H2014-HO payer applicability",
    safeDisposition: "Keep the combination inactive and deny billing until the payer contract and authorization explicitly permit it.",
    owner: "Revenue Cycle Manager",
    status: "controlled-open",
  },
  {
    id: "M12-EX-002",
    ruleId: "M12-GRO-002",
    title: "Mixed-age or heightened-needs staffing",
    safeDisposition: "Apply the strictest calculated ratio and require Program Director review before the shift is released.",
    owner: "GRO Administrator",
    status: "controlled-open",
  },
  {
    id: "M12-EX-003",
    ruleId: "M12-P2-001",
    title: "Uncertain Part 2 applicability",
    safeDisposition: "Classify the record as protected-pending-review and prohibit disclosure until the Privacy Officer resolves applicability.",
    owner: "Privacy Officer",
    status: "controlled-open",
  },
];

export const REGULATORY_SCENARIOS: readonly RegulatoryScenario[] = [
  { id: "M12-SCN-01", domain: "MHTCM", title: "Complete T1017 encounter", expectedOutcome: "allow", evidence: "Six-function service selection, current authorization, complete note, valid unit calculation" },
  { id: "M12-SCN-02", domain: "BILLING", title: "Expired authorization claim", expectedOutcome: "deny", evidence: "Proof-of-service gate refuses submission and emits reason code" },
  { id: "M12-SCN-03", domain: "GRO", title: "Compliant synthetic night shift", expectedOutcome: "allow", evidence: "Ratio calculator and room-capacity checks pass" },
  { id: "M12-SCN-04", domain: "GRO", title: "Prohibited intervention selection", expectedOutcome: "deny", evidence: "Incident workflow fails closed and creates an audit event" },
  { id: "M12-SCN-05", domain: "PART2", title: "Valid consent disclosure", expectedOutcome: "allow", evidence: "Consent, minimum-necessary, notice, and accounting controls pass" },
  { id: "M12-SCN-06", domain: "PART2", title: "Uncertain applicability without consent", expectedOutcome: "review", evidence: "Protected-pending-review classification prevents disclosure" },
];

export function regulatoryRegisterSummary() {
  const operational = REGULATORY_RULES.filter((item) => item.state === "operational").length;
  const conditional = REGULATORY_RULES.length - operational;
  return {
    sources: REGULATORY_SOURCE_VALIDATIONS.length,
    rules: REGULATORY_RULES.length,
    operational,
    conditional,
    reviews: REGULATORY_RULE_REVIEWS.length,
    exceptions: REGULATORY_EXCEPTIONS.length,
    scenarios: REGULATORY_SCENARIOS.length,
  };
}

export function validateRegulatoryRegister(): readonly string[] {
  const errors: string[] = [];
  const sourceIds = new Set(REGULATORY_SOURCE_VALIDATIONS.map((item) => item.id));
  const ruleIds = new Set<string>();

  for (const item of REGULATORY_RULES) {
    if (ruleIds.has(item.id)) errors.push(`Duplicate rule id: ${item.id}`);
    ruleIds.add(item.id);
    if (!sourceIds.has(item.authorityId)) errors.push(`Unknown authority for ${item.id}: ${item.authorityId}`);
    for (const field of [item.uiControl, item.apiControl, item.databaseControl, item.auditEvent, item.exceptionWorkflow, item.automatedTest]) {
      if (!field.trim()) errors.push(`Incomplete control mapping for ${item.id}`);
    }
  }

  for (const item of REGULATORY_RULES) {
    const reviews = REGULATORY_RULE_REVIEWS.filter((review) => review.ruleId === item.id);
    if (reviews.length !== 2) errors.push(`Expected two prototype reviews for ${item.id}`);
  }

  for (const exception of REGULATORY_EXCEPTIONS) {
    if (!ruleIds.has(exception.ruleId)) errors.push(`Exception ${exception.id} references an unknown rule`);
  }

  return errors;
}
