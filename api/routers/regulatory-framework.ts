import { z } from "zod";
import { authedQuery, createRouter } from "../middleware";
import {
  REGULATORY_EXCEPTIONS,
  REGULATORY_RULE_REVIEWS,
  REGULATORY_RULES,
  REGULATORY_SCENARIOS,
  REGULATORY_SOURCE_VALIDATIONS,
  regulatoryRegisterSummary,
  validateRegulatoryRegister,
} from "@contracts/regulatory/register";
import { evaluateClinicalBillingReadiness } from "@contracts/regulatory/clinical";
import {
  evaluateGroBedroom,
  evaluateGroPersonalRestraint,
  evaluateGroPostIntervention,
  evaluateGroPractice,
  evaluateGroRecordRetention,
  evaluateGroSupervisionRatio,
  evaluateGroYouthRights,
} from "@contracts/regulatory/gro";
import {
  classifyPart2Record,
  evaluatePart2Access,
  evaluatePart2Disclosure,
} from "@contracts/regulatory/part2";
import {
  clinicalBillingEvaluationSchema,
  groComplianceSchema,
  part2AccessSchema,
  part2DisclosureSchema,
  part2RecordApplicabilitySchema,
} from "./regulatory-schemas";

const domainSchema = z.enum(["MHTCM", "MHRS", "BILLING", "GRO", "PART2"]);

export const regulatoryFrameworkRouter = createRouter({
  summary: authedQuery.query(() => ({
    ...regulatoryRegisterSummary(),
    integrityErrors: validateRegulatoryRegister(),
    dataPosture: "fictional-synthetic-only" as const,
    milestone: "M1.2" as const,
  })),

  listSources: authedQuery.query(() => REGULATORY_SOURCE_VALIDATIONS),

  listRules: authedQuery
    .input(z.object({
      domain: domainSchema.optional(),
      query: z.string().max(120).optional(),
    }).optional())
    .query(({ input }) => {
      const query = input?.query?.trim().toLowerCase();
      return REGULATORY_RULES.filter((rule) => {
        if (input?.domain && rule.domain !== input.domain) return false;
        if (!query) return true;
        return [rule.id, rule.title, rule.citation, rule.owner]
          .some((value) => value.toLowerCase().includes(query));
      });
    }),

  getRule: authedQuery
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => {
      const rule = REGULATORY_RULES.find((item) => item.id === input.id);
      if (!rule) return null;
      return {
        ...rule,
        reviews: REGULATORY_RULE_REVIEWS.filter((review) => review.ruleId === rule.id),
        exceptions: REGULATORY_EXCEPTIONS.filter((exception) => exception.ruleId === rule.id),
      };
    }),

  listScenarios: authedQuery
    .input(z.object({ domain: domainSchema.optional() }).optional())
    .query(({ input }) => input?.domain
      ? REGULATORY_SCENARIOS.filter((scenario) => scenario.domain === input.domain)
      : REGULATORY_SCENARIOS),

  listExceptions: authedQuery.query(() => REGULATORY_EXCEPTIONS),

  evaluateClinicalBilling: authedQuery
    .input(clinicalBillingEvaluationSchema)
    .query(({ input }) => evaluateClinicalBillingReadiness(input)),

  evaluateGroCompliance: authedQuery
    .input(groComplianceSchema)
    .query(({ input }) => {
      switch (input.control) {
        case "supervision_ratio": return evaluateGroSupervisionRatio(input.evidence);
        case "bedroom": return evaluateGroBedroom(input.evidence);
        case "youth_rights": return evaluateGroYouthRights(input.evidence);
        case "practice": return evaluateGroPractice(input.evidence);
        case "personal_restraint": return evaluateGroPersonalRestraint(input.evidence);
        case "post_intervention": return evaluateGroPostIntervention(input.evidence);
        case "record_retention": return evaluateGroRecordRetention(input.evidence);
      }
    }),

  classifyPart2Record: authedQuery
    .input(part2RecordApplicabilitySchema)
    .query(({ input }) => classifyPart2Record(input)),

  evaluatePart2Access: authedQuery
    .input(part2AccessSchema)
    .query(({ input }) => evaluatePart2Access(input)),

  evaluatePart2Disclosure: authedQuery
    .input(part2DisclosureSchema)
    .query(({ input }) => evaluatePart2Disclosure(input)),
});
