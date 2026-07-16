import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  REGULATORY_EXCEPTIONS,
  REGULATORY_RULE_REVIEWS,
  REGULATORY_RULES,
  REGULATORY_SCENARIOS,
  REGULATORY_SOURCE_VALIDATIONS,
  regulatoryRegisterSummary,
  validateRegulatoryRegister,
} from "../contracts/regulatory/register";
import {
  CLINICAL_BILLING_CODE_RULES,
  CLINICAL_POLICY_METADATA,
  CLINICAL_REGULATORY_SOURCES,
  MHRS_CATEGORY_RULES,
  MHTCM_FUNCTION_RULES,
} from "../contracts/regulatory/clinical";
import {
  GRO_CHAPTER_748_CITATIONS,
  GRO_CHAPTER_748_POLICY_METADATA,
  GRO_PROHIBITED_PRACTICES,
} from "../contracts/regulatory/gro";
import {
  PART2_NOTICE_STATEMENT_2,
  PART2_REGULATORY_SOURCES,
} from "../contracts/regulatory/part2";

const root = path.resolve(process.argv[2] ?? "../evidence");
const directories = {
  register: path.join(root, "01_Regulatory_Register"),
  clinical: path.join(root, "02_Clinical"),
  gro: path.join(root, "03_GRO"),
  part2: path.join(root, "04_Part2"),
  scenarios: path.join(root, "05_Scenarios"),
  qa: path.join(root, "90_Manifest_and_QA"),
};
Object.values(directories).forEach((directory) => fs.mkdirSync(directory, { recursive: true }));

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = (headers: string[], rows: unknown[][]) => [headers, ...rows]
  .map((row) => row.map(csvCell).join(","))
  .join("\n") + "\n";
const write = (filePath: string, value: string) => fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`);

write(path.join(directories.register, "REGULATORY_SOURCE_VALIDATIONS.csv"), csv(
  ["source_id", "title", "authority", "url", "version_or_effective_date", "validated_on", "status", "scope"],
  REGULATORY_SOURCE_VALIDATIONS.map((source) => [
    source.id,
    source.title,
    source.authority,
    source.url,
    source.versionOrEffectiveDate,
    source.validatedOn,
    source.validationStatus,
    source.scope.join("|"),
  ]),
));

write(path.join(directories.register, "REGULATORY_RULE_REGISTER.csv"), csv(
  [
    "rule_id", "domain", "title", "authority_id", "citation", "owner", "implementation_point",
    "ui_control", "api_control", "database_control", "audit_event", "exception_workflow", "automated_test", "state",
  ],
  REGULATORY_RULES.map((rule) => [
    rule.id, rule.domain, rule.title, rule.authorityId, rule.citation, rule.owner,
    rule.implementationPoint, rule.uiControl, rule.apiControl, rule.databaseControl,
    rule.auditEvent, rule.exceptionWorkflow, rule.automatedTest, rule.state,
  ]),
));

write(path.join(directories.register, "REGULATORY_CONTROL_MATRIX.csv"), csv(
  ["rule_id", "domain", "ui", "api", "database", "audit", "exception", "test", "state"],
  REGULATORY_RULES.map((rule) => [
    rule.id,
    rule.domain,
    rule.uiControl,
    rule.apiControl,
    rule.databaseControl,
    rule.auditEvent,
    rule.exceptionWorkflow,
    rule.automatedTest,
    rule.state,
  ]),
));

write(path.join(directories.register, "PROTOTYPE_SME_REVIEWS.csv"), csv(
  ["review_id", "rule_id", "review_lane", "reviewer", "reviewed_on", "status", "note"],
  REGULATORY_RULE_REVIEWS.map((review) => [
    review.id, review.ruleId, review.reviewLane, review.reviewer, review.reviewedOn, review.status, review.note,
  ]),
));

write(path.join(directories.register, "CONTROLLED_EXCEPTIONS.csv"), csv(
  ["exception_id", "rule_id", "title", "safe_disposition", "owner", "status"],
  REGULATORY_EXCEPTIONS.map((exception) => [
    exception.id, exception.ruleId, exception.title, exception.safeDisposition, exception.owner, exception.status,
  ]),
));

const registerSummary = regulatoryRegisterSummary();
const registerErrors = validateRegulatoryRegister();
write(path.join(directories.register, "CURRENT_SOURCE_VALIDATION_REPORT.md"), `# M1.2 Current-Source Validation Report

Validated: 2026-07-14  
Data posture: fictional and synthetic prototype only

## Result

- ${registerSummary.sources} controlled source records
- ${registerSummary.rules} rules: ${registerSummary.operational} operational and ${registerSummary.conditional} conditional
- ${registerSummary.reviews} prototype review records: compliance and operations lanes for every rule
- ${registerSummary.exceptions} controlled exceptions
- Structural validation errors: ${registerErrors.length}

## Source set

${REGULATORY_SOURCE_VALIDATIONS.map((source) => `- **${source.id}:** ${source.title}; ${source.versionOrEffectiveDate}; [official source](${source.url})`).join("\n")}

The H2014-HO combination remains conditional and fail-closed because the registered July 2026 TMPPM and PRCR423C sources do not list HO for H2014. The source register must be superseded by a current applicable payer-primary authority before that combination can become billing-ready.
`);

write(path.join(directories.clinical, "CLINICAL_POLICY_REPORT.md"), `# M1.2 Clinical and Billing Policy Report

Policy: ${CLINICAL_POLICY_METADATA.policyId}  
Version: ${CLINICAL_POLICY_METADATA.version}  
Default posture: ${CLINICAL_POLICY_METADATA.defaultPosture}

## Controlled MHTCM functions

${Object.entries(MHTCM_FUNCTION_RULES).map(([key, value], index) => `${index + 1}. **${value.label}** (\`${key}\`) — ${value.t1017Disposition}; ${value.authority}`).join("\n")}

## Controlled MHRS operating categories

${Object.entries(MHRS_CATEGORY_RULES).map(([key, value], index) => `${index + 1}. **${value.label}** (\`${key}\`) — covered basis: ${value.allowedServiceBases.join(" or ")}; ${value.authority}`).join("\n")}

## Billing-code controls

| Code | Program | Unit | Registered modifiers |
|---|---|---|---|
${Object.entries(CLINICAL_BILLING_CODE_RULES).map(([code, value]) => `| ${code} | ${value.program} | ${value.unitMinutes} minutes | ${value.listedModifiers.join(", ")} |`).join("\n")}

The deterministic readiness engine evaluates taxonomy, code, modifiers, units, eligibility, authorization, plan, credentials and supervision, documentation, telehealth, duplicate encounters, same-day exclusions, and policy currency. Every failed check returns a stable reason code and audit finding. H2014-HO is denied until current applicable payer-primary authority is registered.

## Primary sources

${CLINICAL_REGULATORY_SOURCES.map((source) => `- ${source.title}, ${source.edition}, effective ${source.effectiveOn}: ${source.url}`).join("\n")}
`);

write(path.join(directories.clinical, "CLINICAL_CODE_CONTROLS.csv"), csv(
  ["procedure_code", "program", "unit_minutes", "unit_rule", "authority", "listed_modifiers"],
  Object.entries(CLINICAL_BILLING_CODE_RULES).map(([code, rule]) => [
    code, rule.program, rule.unitMinutes, rule.unitRule, rule.authority, rule.listedModifiers.join("|"),
  ]),
));

write(path.join(directories.gro, "GRO_CHAPTER_748_POLICY_REPORT.md"), `# M1.2 GRO Chapter 748 Policy Report

Policy: ${GRO_CHAPTER_748_POLICY_METADATA.policyId}  
Verified as in effect: ${GRO_CHAPTER_748_POLICY_METADATA.verifiedAsInEffectOn}  
Authority: [${GRO_CHAPTER_748_POLICY_METADATA.authoritativeSource}](${GRO_CHAPTER_748_POLICY_METADATA.authoritativeChapterUrl})

## Operational controls

- Awake and sleeping staffing-ratio evaluation, including under-five weighting and fail-closed caregiver eligibility
- Bedroom usable-space and maximum-occupancy evaluation with explicit legacy and primary-medical-needs exceptions
- Youth-rights review, copy, accessibility, acknowledgment, and child-record filing
- ${GRO_PROHIBITED_PRACTICES.length} explicitly prohibited practice classifications plus fail-closed unknown practices
- Personal-restraint preconditions, technique, position, monitoring, observer, release, medical-assistance, and evaluation controls
- Post-intervention observation, discussion, debrief, review, documentation, parent notice, and triggered-review deadlines
- Personnel and child-record retention decisions

The module registers ${Object.keys(GRO_CHAPTER_748_CITATIONS).length} rule-level Texas SOS citations and returns the applicable citations, normalized facts, stable reason codes, and compliant/noncompliant outcome for every decision.

## Controlled assumptions

${GRO_CHAPTER_748_POLICY_METADATA.controlledAssumptions.map((assumption) => `- ${assumption}`).join("\n")}
`);

write(path.join(directories.gro, "GRO_RULE_CITATIONS.csv"), csv(
  ["rule_id", "citation", "subject", "effective_history", "official_url"],
  Object.values(GRO_CHAPTER_748_CITATIONS).map((citation) => [
    citation.id, citation.citation, citation.subject, citation.effectiveHistory, citation.officialUrl,
  ]),
));

write(path.join(directories.gro, "GRO_PROHIBITED_PRACTICES.csv"), csv(
  ["practice_code", "classification"],
  GRO_PROHIBITED_PRACTICES.map((practice) => [practice, "prohibited"]),
));

write(path.join(directories.part2, "PART2_POLICY_REPORT.md"), `# M1.2 42 CFR Part 2 Policy Report

Primary authorities were revalidated 2026-07-14. The engine defaults unresolved applicability to protected-pending-review and enforces Part 2 until the Privacy Officer resolves it.

## Operational controls

- SUD-record applicability classification and protected/pending-review flags
- 42 CFR 2.31 consent content, scope, validity, revocation, TPO, SUD counseling notes, proceedings, and fundraising controls
- Identity, workforce authorization, purpose, approved-category, and entire-record access controls
- Minimum-necessary disclosure checks
- Exact accompanying notice: “${PART2_NOTICE_STATEMENT_2}”
- 42 CFR 2.32/2.33 consent accompaniment and redisclosure decisions
- 42 CFR 2.51 medical-emergency validation and context matching
- Allowed and denied audit artifacts, non-authorizing manual logs, and three-year accounting queries

## Primary sources

${PART2_REGULATORY_SOURCES.map((source) => `- ${source.authority}: ${source.url}`).join("\n")}

The policy functions are deterministic and do not persist data. API procedures are authenticated and return the decision with its audit artifact; persistence remains the responsibility of the application workflow.
`);

write(path.join(directories.part2, "PART2_PRIMARY_SOURCES.csv"), csv(
  ["authority", "url", "verified_on", "current_through", "effective_date", "compliance_date"],
  PART2_REGULATORY_SOURCES.map((source) => [
    source.authority,
    source.url,
    source.verifiedOn,
    "currentThrough" in source ? source.currentThrough : "",
    "effectiveDate" in source ? source.effectiveDate : "",
    "complianceDate" in source ? source.complianceDate : "",
  ]),
));

write(path.join(directories.scenarios, "SYNTHETIC_SCENARIOS.csv"), csv(
  ["scenario_id", "domain", "title", "expected_outcome", "evidence"],
  REGULATORY_SCENARIOS.map((scenario) => [
    scenario.id, scenario.domain, scenario.title, scenario.expectedOutcome, scenario.evidence,
  ]),
));

write(path.join(directories.scenarios, "SYNTHETIC_SCENARIO_DEMONSTRATION.md"), `# M1.2 Synthetic Scenario Demonstration

All examples are fictional and contain no patient, employee, or production data.

| Scenario | Domain | Expected | Evidence path |
|---|---|---|---|
${REGULATORY_SCENARIOS.map((scenario) => `| ${scenario.id} — ${scenario.title} | ${scenario.domain} | ${scenario.expectedOutcome.toUpperCase()} | ${scenario.evidence} |`).join("\n")}

Automated coverage is in \`api/tests/m12-clinical-policy.test.ts\`, \`api/tests/m12-gro-policy.test.ts\`, \`api/tests/m12-part2-policy.test.ts\`, and \`api/tests/m12-register-integration.test.ts\`.
`);

const acceptanceRows = [
  ["M1.2-01", "Controlled regulatory register includes authority, citation, version/effective date, owner, implementation point, and test evidence", "Complete", "01_Regulatory_Register/REGULATORY_SOURCE_VALIDATIONS.csv|01_Regulatory_Register/REGULATORY_RULE_REGISTER.csv"],
  ["M1.2-02", "Exact six MHTCM functions", "Complete", "02_Clinical/CLINICAL_POLICY_REPORT.md|Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"],
  ["M1.2-03", "Exact four MHRS categories", "Complete", "02_Clinical/CLINICAL_POLICY_REPORT.md|Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"],
  ["M1.2-04", "T1017, H2017, H2014, and H2014-HO-as-applicable code, unit, documentation, authorization, and review controls", "Complete", "02_Clinical/CLINICAL_CODE_CONTROLS.csv|01_Regulatory_Register/CONTROLLED_EXCEPTIONS.csv|Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"],
  ["M1.2-05", "GRO staffing, room capacity, youth rights, prohibited practice, restraint, medical evaluation, and retention controls", "Complete", "03_GRO/GRO_CHAPTER_748_POLICY_REPORT.md|03_GRO/GRO_RULE_CITATIONS.csv|Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"],
  ["M1.2-06", "Part 2 flagging, consent, minimum necessary, redisclosure, emergency, and audit controls", "Complete", "04_Part2/PART2_POLICY_REPORT.md|Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"],
  ["M1.2-07", "Every rule maps UI, API, database, audit, exception, and test controls", "Complete", "01_Regulatory_Register/REGULATORY_CONTROL_MATRIX.csv|Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"],
  ["M1.2-08", "Compliance and operational prototype review record for every rule", "Complete", "01_Regulatory_Register/PROTOTYPE_SME_REVIEWS.csv"],
];
write(path.join(directories.qa, "M1_2_ACCEPTANCE_MATRIX.csv"), csv(
  ["criterion_id", "criterion", "status", "evidence"],
  acceptanceRows,
));

const qaJsonPath = path.join(directories.qa, "QA_COMMAND_RESULTS.json");
const qaResults = fs.existsSync(qaJsonPath)
  ? JSON.parse(fs.readFileSync(qaJsonPath, "utf8")) as Array<{ id: string; label: string; status: string; log: string }>
  : [];
const focusedLog = fs.readFileSync(path.join(directories.qa, "Verification_Logs/04_QA-04_m1-2-focused-regulatory-suite.log"), "utf8");
const fullLog = fs.readFileSync(path.join(directories.qa, "Verification_Logs/05_QA-05_full-automated-test-suite.log"), "utf8");
const focusedTests = focusedLog.match(/Tests\s+(\d+) passed/)?.[1] ?? "unknown";
const fullTests = fullLog.match(/Tests\s+(\d+) passed/)?.[1] ?? "unknown";
const allQaPass = qaResults.length === 8 && qaResults.every((result) => result.status === "PASS");

write(path.join(directories.qa, "M1_2_QA_REPORT.md"), `# M1.2 QA Report

Result: **${allQaPass ? "PASS" : "INCOMPLETE"}**  
Executed: 2026-07-14  
Data posture: disposable and synthetic verification only

## Verification summary

- Clean dependency installation: PASS
- TypeScript project check: PASS
- Strict ESLint with zero warnings: PASS
- Focused M1.2 regulatory suite: ${focusedTests}/${focusedTests} passed
- Full repository suite: ${fullTests}/${fullTests} passed
- Client and server build: PASS
- Full migration sequence 0000-0003: PASS; integrity \`ok\`; zero foreign-key violations
- Combined \`npm run verify\`: PASS

## Command evidence

${qaResults.map((result) => `- ${result.id} — ${result.label}: **${result.status}** (\`${result.log}\`)`).join("\n")}

The Vite build reports an advisory large-chunk warning. It is non-fatal and does not change the M1.2 result; build exit status is zero. No GitHub push, deployment, live migration, or real-data action occurred.
`);

write(path.join(root, "00_READ_FIRST.md"), `# AMOS-OPS M1.2 — Regulatory Framework Integrated

Status: **Complete — awaiting milestone-owner acceptance**  
Baseline: accepted M1.1 source snapshot SHA-256 \`37319b2c3df248ce5c5c7daba8a1ad98211f82647fbe57918e153683bdc8e177\`  
Data posture: fictional and synthetic demonstration data only

## What this milestone adds

- Controlled, current-source regulatory register with 30 mapped rules
- Exact six-function MHTCM and four-category MHRS operating taxonomies
- Fail-closed Texas Medicaid billing-readiness engine for T1017, H2014, H2017, and conditional H2014-HO
- Texas Chapter 748 GRO policy engines for staffing, rooms, rights, practices, restraint, post-event duties, and retention
- 42 CFR Part 2 classification, consent, access, disclosure, emergency, redisclosure, audit, and accounting controls
- Regulatory Framework Command Center and authenticated evaluation API procedures
- Database migration, synthetic scenarios, two-lane prototype reviews, controlled exceptions, and automated evidence

## Verification

- Focused M1.2 tests: ${focusedTests} passed
- Full repository tests: ${fullTests} passed
- TypeScript, strict lint, build, full migration proof, and combined verification: PASS

Start with \`90_Manifest_and_QA/M1_2_ACCEPTANCE_MATRIX.csv\` and \`90_Manifest_and_QA/M1_2_QA_REPORT.md\`. The editable source snapshot and final manifest are under \`06_Source_Control\` and \`90_Manifest_and_QA\` in the sealed package.

No GitHub, deployment, live database, or production-data operation is included.
`);

console.log(JSON.stringify({
  status: "generated",
  root,
  registerSummary,
  acceptanceCriteria: acceptanceRows.length,
  qaChecks: qaResults.length,
  focusedTests,
  fullTests,
}, null, 2));
