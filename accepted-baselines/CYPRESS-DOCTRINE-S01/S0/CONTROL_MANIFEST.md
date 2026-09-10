# AMOS-OPS Cypress Doctrine Sprint 01 — S0 Accepted Control Manifest

**Authority:** Eghosa "Russ" Aideyan  
**Acceptance date:** 2026-09-09  
**Agent:** AMOS Prime  
**Work item:** S0 — Doctrine & Current-System Gap Mapping  
**Status:** ACCEPTED / VERIFIED COMPLETE  
**Production promotion:** NOT AUTHORIZED

## Verified GitHub baseline

- Repository: `RussAide/AMOS-OPS`
- Controlling `main` at branch entry: `1a927b0e9b9111862524382fff5313006d68730e`
- Sprint branch: `sprint/cypress-doctrine-s01`
- Branch created directly from the controlling baseline; no production ref was changed.

## Authoritative SharePoint destination

`Cypress GRO → 06 - GRO Operations & Activation → 02 - Operational Activation → 2026-09-09 - AMOS-OPS Led Launch Doctrine → AMOS-OPS Doctrine Implementation Sprint`

SharePoint remains the authoritative enterprise preservation repository. The full S0 checkpoint package and individual evidence registers are preserved there. This file is the repository control manifest for that accepted checkpoint.

## Accepted architecture decisions

1. Preserve AMOS-OPS as the operating and launch-control surface.
2. Preserve layer separation: Ask AMOS = frontline record interface; AMOS-DMS = record identity/authority/access; SharePoint = governed backend binary repository.
3. Preserve the existing DMS lifecycle states. Record authority is implemented as a separate governed dimension.
4. Required record-authority states are `CURRENT_CONTROLLING`, `REFERENCE_COPY`, `SUBMISSION_COPY`, `SUPERSEDED`, `ARCHIVED`, and `PENDING`.
5. Authority conflicts fail closed. If more than one candidate is current/controlling for the same governed record context, the system must raise an authority-conflict result and return no uncontrolled record content.
6. Reuse existing identity/RBAC, workflow, assignment and audit primitives rather than creating a parallel security or workflow framework.
7. Current licensed Cypress GRO capacity remains 10 beds. Sixteen beds remains a future scenario only pending authorization.
8. Doctrine planning-rate band remains $450 floor / $550 target / $650 enhanced.
9. No production promotion is authorized by this sprint.
10. No SharePoint permission, classification, retention, deletion, disposition or repository-structure changes are authorized.

## S0 verified system findings carried into S1

- `api/routers/m2.ts` provides substantive AMOS-DMS document identity, metadata, lifecycle, approval, retention and audit behavior.
- `src/constants/access-control.ts`, `api/authorization/http.ts`, and `api/security/identity.ts` provide substantial role, scope and identity controls.
- Current access logic does not yet unify identity + role + operation + assigned youth/case + record class + requested action + active access status for governed medical-record retrieval.
- `api/routers/msgraph.ts` is mock Microsoft Graph behavior; `connected: true` is not accepted as live SharePoint evidence.
- No named Ask AMOS implementation, Doctrine Registry, Launch Command Center or CWOP module was verified on the S0 baseline.
- Existing referral/CCMG, workflow and GRO prototype controls are reusable foundations for later sprint gates.

## Open S0 exceptions

- `EXC-S0-01` — live Railway/Netlify runtime not independently verified.
- `EXC-S0-02` — mock Microsoft Graph status can present `connected: true`; must not satisfy live-integration readiness.
- `EXC-S0-03` — live AMOS-DMS ingestion/search not yet verified end to end.
- `EXC-S0-04` — live DMS-to-SharePoint retrieval bridge absent/unverified.
- `EXC-S0-05` — Ask AMOS authoritative retrieval chain absent.
- `EXC-S0-06` — unified assigned-youth/case record authorization path absent.

## S1 entry condition — satisfied

Eghosa accepted S0 and expressly authorized creation of `sprint/cypress-doctrine-s01` and commencement of S1 with no production promotion and no SharePoint governance changes.

## S1 first increment

Implement an additive governed record-authority contract and persistence model containing:

- record class;
- authority state;
- authoritative source locator / backend object identity;
- governing record/version relationship;
- youth/case linkage where applicable;
- operation/division context;
- access-decision inputs;
- fail-closed authority-conflict outcome;
- immutable authority/access audit event.

The existing DMS document lifecycle must not be renamed or removed.

## Original S0 checkpoint checksums

```text
27d2eb53e6ee50737d5807f2a54d51c3b315568d62017e503fb080d93627b39f  00_S0_CONTROL_CHECKPOINT.md
46b25b6642ce906db0bda6667c2a2314967096b9d16923f603efea9c9f046099  01_S0_DOCTRINE_TO_SYSTEM_GAP_MATRIX.md
f04faebd73066926fae80fa3d2a965ebe8cf580e19565b5b9b1db83f80072c7c  02_S0_BUILD_REGISTRY_AND_TODO.md
6a5e6cf59899ce85a99c6897f7815470d46d99f221a200b41e79791d79dd393d  03_S0_ARCHITECTURE_DECISION_LOG.md
b083685ed4aba82876f9c6569ad7e7b6984c2ff1fcce23856620097ca4488d5a  04_S0_EVIDENCE_REGISTER.md
9b028fee574b2f04395d513e3ba9a9c86f99aef7aabd03e647f2b17bbe3aeb2c  05_S0_BRANCH_ENTRY_CONDITION.md
b339152b0b41a33cb15be0c84797cbceece3e874d62c0d56779ecedcb66cd5cf  06_S0_EXCEPTION_REGISTER.md
```
