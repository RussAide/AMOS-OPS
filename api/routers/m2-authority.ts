import { createRouter } from "../middleware";
import { m2AuthorityRouter as s1AuthorityRouter } from "./m2-authority-s1";
import { m2SharePointRouter } from "./m2-sharepoint-authority";

/**
 * Cypress Doctrine Sprint 01 governed M2 composition boundary.
 * The verified S1 implementation is preserved byte-for-byte in
 * ./m2-authority-s1.ts. S2 adds only bounded SharePoint backend mapping and
 * verification administration procedures.
 */
export const m2AuthorityRouter = createRouter({
  ...s1AuthorityRouter._def.record,
  ...m2SharePointRouter._def.record,
});