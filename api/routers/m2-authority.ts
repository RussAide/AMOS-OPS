import { createRouter } from "../middleware";
import { m2AuthorityRouter as s1AuthorityRouter } from "./m2-authority-s1";
import { m2SharePointRouter } from "./m2-sharepoint-authority";
import { m2AskAmosMedicalRouter } from "./m2-ask-amos-medical";
import { cypressLaunchCommandRouter } from "./cypress-launch-command";
import { cypressReferralAcuityRateRouter } from "./cypress-referral-acuity-rate";
import { cypressAdminWorkforceStabilityRouter } from "./cypress-admin-workforce-stability";

/**
 * Cypress Doctrine Sprint 01 governed M2 composition boundary.
 * The verified S1 implementation is preserved byte-for-byte in
 * ./m2-authority-s1.ts. S2 adds bounded SharePoint backend mapping and
 * verification administration procedures. S3 adds the Ask AMOS medical-record
 * bridge plus a synthetic no-PHI preview surface. S4 adds the bounded Launch
 * Command / Doctrine resolver. S5 adds referral, acuity, placement-decline,
 * capacity, and $450/$550/$650 rate-control reasoning by reusing the existing
 * CCMG referral-readiness foundation. S6 adds role-based Administrator
 * benchmarks, M3.3 workforce readiness, M2.4 staffing evaluation, and
 * crisis-to-return/justified-discharge placement-stability controls. No
 * production promotion, capacity expansion, live-data acceptance, or live
 * Graph claim is implied by this composition.
 */
export const m2AuthorityRouter = createRouter({
  ...s1AuthorityRouter._def.record,
  ...m2SharePointRouter._def.record,
  ...m2AskAmosMedicalRouter._def.record,
  ...cypressLaunchCommandRouter._def.record,
  ...cypressReferralAcuityRateRouter._def.record,
  ...cypressAdminWorkforceStabilityRouter._def.record,
});
