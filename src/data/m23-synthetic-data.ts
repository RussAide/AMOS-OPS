import type { MhrsCategory } from "@contracts/regulatory/clinical";

export interface M23ScenarioViewModel {
  readonly id: string;
  readonly name: string;
  readonly category: MhrsCategory;
  readonly procedureCode: "H2014" | "H2017";
  readonly setting: "Individual" | "Group";
  readonly age: number;
  readonly status: "Ready for revenue";
  readonly lineage: readonly string[];
}

export interface M23GateViewModel {
  readonly label: string;
  readonly status: "Pass" | "Blocked as designed";
  readonly detail: string;
}

export const M23_SYNTHETIC_VIEW = {
  evidenceClass: "Synthetic prototype — no real client data",
  asOf: "September 30, 2026",
  metrics: [
    { label: "Service workflows", value: "4 / 4", detail: "Every controlled MHRS category is exercised" },
    { label: "Ready scenarios", value: "4", detail: "Plan, note, signature, and billing gates passed" },
    { label: "Fail-closed controls", value: "6", detail: "HO plus five missing-evidence paths rejected" },
    { label: "Plan review", value: "v2", detail: "90-day alert escalated and closed with a new version" },
  ],
  scenarios: [
    {
      id: "M23-SCENARIO-INDIVIDUAL",
      name: "Individual skills training",
      category: "skills_training",
      procedureCode: "H2014",
      setting: "Individual",
      age: 16,
      status: "Ready for revenue",
      lineage: ["CANS need", "Plan v1", "Skills goal", "H2014 intervention", "Signed session", "Progress + barrier + outcome", "Revenue handoff"],
    },
    {
      id: "M23-SCENARIO-GROUP",
      name: "Group psychosocial rehabilitation",
      category: "psychosocial_rehabilitation",
      procedureCode: "H2017",
      setting: "Group",
      age: 19,
      status: "Ready for revenue",
      lineage: ["CCMG referral", "Plan v1", "Social-function goal", "H2017 group intervention", "Signed session", "Progress + barrier + outcome", "Revenue handoff"],
    },
    {
      id: "M23-SCENARIO-SUPPORTIVE",
      name: "Supportive intervention",
      category: "supportive_interventions",
      procedureCode: "H2014",
      setting: "Individual",
      age: 17,
      status: "Ready for revenue",
      lineage: ["CANS need", "Plan v1", "Regulation goal", "H2014 supportive intervention", "Signed session", "Progress + barrier + outcome", "Revenue handoff"],
    },
    {
      id: "M23-SCENARIO-COMMUNITY",
      name: "Community integration",
      category: "community_integration",
      procedureCode: "H2017",
      setting: "Individual",
      age: 18,
      status: "Ready for revenue",
      lineage: ["CCMG referral", "Plan v1", "Community goal", "H2017 integration intervention", "Signed session", "Progress + barrier + outcome", "Revenue handoff"],
    },
  ] satisfies readonly M23ScenarioViewModel[],
  gates: [
    { label: "H2014-HO authority", status: "Blocked as designed", detail: "HO remains closed until a current applicable payer-primary rule is registered." },
    { label: "Active approved plan", status: "Blocked as designed", detail: "A missing or inactive plan cannot reach revenue cycle." },
    { label: "Authorization", status: "Blocked as designed", detail: "Missing, pending, denied, expired, or exhausted authorization is rejected." },
    { label: "Credential + supervision", status: "Blocked as designed", detail: "The evaluator verifies role eligibility, currency, training, competency, and supervision chain." },
    { label: "Complete service note", status: "Blocked as designed", detail: "Required content, date, time, delivery mode, duration, units, and credential must agree." },
    { label: "Provider signature", status: "Blocked as designed", detail: "An unsigned immutable session cannot create a claim handoff." },
  ] satisfies readonly M23GateViewModel[],
  bridges: [
    { owner: "CCMG", record: "Referral and case handoff", mode: "Read only" },
    { owner: "CCMG", record: "Versioned CANS lineage", mode: "Read only" },
    { owner: "MHTCM", record: "Approved coordination plan", mode: "Read only" },
  ],
} as const;

