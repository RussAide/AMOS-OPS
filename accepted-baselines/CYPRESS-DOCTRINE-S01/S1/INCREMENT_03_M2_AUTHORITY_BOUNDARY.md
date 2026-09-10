# AMOS-OPS Cypress Doctrine Sprint 01 — S1 M2 Authority Boundary Increment

**Authority:** Eghosa Olayinka Aideyan  
**Agent:** AMOS Prime  
**Date:** 2026-09-09  
**Work item:** S1 — Medical Record Authority & Contextual Access Model  
**Increment:** 03 — AMOS-DMS M2 Governed Retrieval Boundary  
**Status:** IMPLEMENTED ON SPRINT BRANCH / REVIEW VALIDATION OPEN  
**Production promotion:** NOT AUTHORIZED / NOT PERFORMED

## GitHub control state

- Repository: `RussAide/AMOS-OPS`
- Production `main` controlling baseline: `1a927b0e9b9111862524382fff5313006d68730e`
- Sprint branch: `sprint/cypress-doctrine-s01`
- Sprint head after this increment: `d05aa523f2add5782b4fcfb4f430eab3203ed9fd`
- Review PR: `#52 — Cypress Doctrine Sprint 01 — S1 record authority foundation`
- PR state: draft / open / unmerged

## Implemented in this increment

1. Extended the canonical authority service so access-resource and contextual requirements are derived only after a single controlling authority record resolves.
2. Added DMS-document-to-authority-lineage binding resolution:
   - exactly one lineage -> bound;
   - no lineage -> fail closed as unregistered;
   - multiple lineages -> fail closed as binding conflict.
3. Added server-derived assignment context using persisted CCMG work ownership:
   - assigned case IDs;
   - assigned youth IDs;
   - Cypress GRO/BHC operation context.
   Request payloads do not supply assignment membership.
4. Added server-owned governed-record-to-RBAC mapping by record class.
5. Added a controlled `m2.getById` override that enforces:
   - authenticated existing M2 RBAC boundary;
   - DMS authority binding;
   - single CURRENT/CONTROLLING resolution;
   - server-derived contextual access;
   - immutable authority/access audit;
   - rejection of stale/reference copies when the requested DMS document is not the controlling document.
6. S1 does not retrieve a SharePoint binary and does not expose backend source locators. Governed responses redact `filePath` and `permissionsJson` pending S2.
7. Root router composition preserves all existing M2 procedures and overrides only `getById` with the S1 governed procedure.
8. Added synthetic unit coverage for document binding, binding conflict, unregistered state, server assignment derivation, record-class policy mapping, and derived context requirements.

## Root-router QA

The `api/router.ts` diff was inspected after update. Only these functional changes are present:

- import `m2AuthorityRouter`;
- create `controlledM2Router` by spreading legacy M2 then S1 authority procedures;
- mount `m2: controlledM2Router` instead of `m2: m2Router`.

No unrelated dashboard/router logic was changed.

## Important clarification

The existing symbol `publicQuery` is an authenticated compatibility alias for `authedQuery`; therefore the pre-S1 defect was not anonymous retrieval. The material gap was authenticated M2 document retrieval without governed record-authority resolution. This increment inserts that missing authority layer.

## Validation state

- Static root-router diff review: VERIFIED CLEAN.
- Synthetic S1 test files: ADDED / UPDATED.
- GitHub CodeQL review for current sprint head: STARTED; final conclusion not yet controlling at checkpoint creation.
- Repository `AMOS-OPS Evaluation Build CI`: no current-head run observed at checkpoint creation; therefore lint/typecheck/test/build are not claimed as verified here.
- Inherited `RM.7 Zone A Verification` workflow remains malformed on the controlling baseline and fails before jobs; it is not an S1 implementation failure and has not been modified in this sprint.

## Open exceptions

- `EXC-S1-01` — inherited RM7 workflow file is malformed and cannot provide valid sprint QA evidence.
- `EXC-S1-02` — standard Evaluation Build CI has not produced a current-head validation run; S1 is not accepted complete until equivalent lint/typecheck/test/build evidence is obtained.
- `EXC-S1-03` — legacy M2 list/search metadata path remains outside this increment and must be reviewed before S1 final acceptance to ensure governed metadata cannot bypass the authority model.
- `EXC-S1-04` — DMS authority intake/registration workflow is not yet exposed through a controlled M2 administration procedure; unregistered documents therefore fail closed at governed retrieval.

## Authoritative SharePoint destination

`Cypress GRO → 06 - GRO Operations & Activation → 02 - Operational Activation → 2026-09-09 - AMOS-OPS Led Launch Doctrine → AMOS-OPS Doctrine Implementation Sprint`

## Decisions preserved

- Existing DMS lifecycle remains unchanged.
- Record authority remains a separate governed dimension.
- Conflicting current/controlling records fail closed.
- No production promotion.
- No SharePoint permissions, classification, retention, deletion, disposition, or repository-structure changes.
- S2 SharePoint retrieval bridge and S3 Ask AMOS remain blocked until S1 acceptance.

## Exact next action

Complete S1 by closing the remaining M2 authority surfaces: review and control list/search metadata exposure, add the governed authority-registration/intake administration procedure, obtain current-head lint/typecheck/test/build evidence, then issue the S1 acceptance checkpoint. Do not begin S2 before S1 acceptance.
