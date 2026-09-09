import { createRouter } from "../middleware";
import { m2AuthorityRouter as s1AuthorityRouter } from "./m2-authority-s1";
import { m2SharePointRouter } from "./m2-sharepoint-authority";
import { m2AskAmosMedicalRouter } from "./m2-ask-amos-medical";

/**
 * Cypress Doctrine Sprint 01 governed M2 composition boundary.
 * The verified S1 implementation is preserved byte-for-byte in
 * ./m2-authority-s1.ts. S2 adds bounded SharePoint backend mapping and
 * verification administration procedures. S3 adds the Ask AMOS medical-record
 * bridge plus a synthetic no-PHI preview surface; no production promotion or
 * live Graph claim is implied by this composition.
 */
export const m2AuthorityRouter = createRouter({
  ...s1AuthorityRouter._def.record,
  ...m2SharePointRouter._def.record,
  ...m2AskAmosMedicalRouter._def.record,
});
