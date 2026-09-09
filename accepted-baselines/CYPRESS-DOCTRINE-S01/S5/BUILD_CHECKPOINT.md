# Cypress Doctrine Sprint 01 — S5 Build Checkpoint

## Control status

- Authority: Eghosa Olayinka Aideyan
- Agent: AMOS Prime
- Component: AMOS-OPS / Cypress Doctrine Sprint 01 — bounded component, not a third enterprise execution thread
- Stage: S5 — Referral / Acuity / Rate
- S4: ACCEPTED 2026-09-09
- S5 build state at checkpoint creation: IMPLEMENTED / implementation-validation GREEN / final documentation-bearing exact-SHA validation REQUIRED
- S6: NOT AUTHORIZED
- Production promotion: NOT AUTHORIZED / NOT PERFORMED
- Merge to `main`: NOT AUTHORIZED / NOT PERFORMED

## Controlling doctrine preserved

- Current licensed Cypress GRO capacity: **10 beds**.
- Sixteen beds: future expansion only after regulatory approval and express authorization.
- Rate doctrine: **$450 floor / $550 target / $650 enhanced**; these are operating controls, not payer guarantees.
- High-acuity placement: evidence-gated; convenience, staff preference, generalized complexity avoidance, and acuity cherry-picking are not valid final decline bases.
- Placement decisions fail closed when required controlled evidence is incomplete.
- Existing CCMG referral-readiness gates are reused, not duplicated.
- SharePoint remains the authoritative repository.
- L0–L12 progression remains capability/evidence-gated, not calendar-gated.

## S5 implementation

### Contract

`contracts/doctrine/cypress-referral-acuity-rate.ts`

Defines bounded S5 preview scenarios, acuity/supervision profiles, rate controls, decline classes, decision outcomes, exceptions, audit events, and synthetic/no-PHI status.

### Service

`api/doctrine/cypress-referral-acuity-rate.ts`

Reuses the existing CCMG `evaluateIntakeReadiness(...)` model and applies Cypress-specific controls for:

1. referral readiness,
2. evidence-backed acuity/resource fit,
3. the controlling 10-bed capacity,
4. placement-decline classification and review,
5. $450/$550/$650 rate-control reasoning,
6. fail-closed evidence handling, and
7. synthetic audit visibility.

### Router

`api/routers/cypress-referral-acuity-rate.ts`

Adds authenticated S5 status and preview procedures. `api/routers/m2-authority.ts` composes S5 with the accepted S1–S4 governed boundary.

### Ask AMOS surface

`src/components/m41b/m41b-referral-acuity-rate-preview.tsx`

Mounted into the existing M4.1B Ask AMOS page. It provides a browser-native S5 decision-control surface with scenario selection, existing CCMG gate status, acuity/resource fit, census/capacity, rate doctrine, decline control, exceptions, synthetic audit trail, and exact next action.

The UI exists in the controlled branch. It is **not represented as successfully experienced by Eghosa until a working browser-native review surface is actually provided and used.** No production deployment is implied.

## Synthetic acceptance scenarios

| Scenario | Controlling expected behavior |
| --- | --- |
| High-acuity accept | Evidence-backed high-acuity referral within the 10-bed controller may reach ACCEPT; enhanced $650 tier is an operating control only. |
| Target-population decline review | A convenience/low-acuity preference decline cannot be finalized; doctrine review is required. |
| Below-floor rate | A proposed rate below $450 is held; AMOS does not silently accept it. |
| Capacity full | At 10/10, the referral is held; future 16-bed capacity is not borrowed. |
| Evidence gap | Missing controlled acuity/CANS evidence blocks high-acuity placement/rate inference. |

## Implementation-validation evidence before checkpoint freeze

Implementation candidate SHA:
`71aec2fb759533188fd2a6a33e19289fddd40d6d`

Workflow:
`Cypress Doctrine S01 — S5 Validation`

Run:
`34377034736`

Job:
`102552328838`

Results:
- exact commit checkout: PASS
- locked dependency install: PASS
- strict lint: PASS
- typecheck: PASS
- focused S5: **1 file / 7 tests PASS**
- full regression: **253 files / 1,723 tests PASS**
- schema export: PASS
- client build: PASS
- server build: PASS
- npm audit carried forward: **18 vulnerabilities (11 moderate, 7 high)**; no blind/breaking remediation performed

This build-checkpoint commit itself must pass the same exact-SHA workflow before S5 may be declared VERIFIED COMPLETE.

## Preview exception carried forward

### EXC-S4-UX-01 — OPEN

The standalone S4 HTML preview failed to execute scenario interactions through Eghosa's iOS/Apple remote file-preview path. It must not be described as successful user-facing acceptance evidence. The S5 browser-native UI addresses the implementation side of the problem, but this exception remains open until an actual accessible review-runtime path is verified by the user.

## Other open exceptions carried forward

- **EXC-S1-01 — OPEN / inherited:** malformed `.github/workflows/rm7-zone-a-verify.yml`; not Sprint 01 acceptance evidence.
- **EXC-S1-05 — OPEN / inherited dependency risk:** npm reports 18 vulnerabilities (11 moderate, 7 high); no blind/breaking dependency remediation performed.
- **EXC-S2-01 — OPEN / deployment dependency:** AMOS-OPS Railway/runtime Microsoft Graph credentials and the live SharePoint runtime probe remain unconfigured/unverified. Live SharePoint medical-record operation and production readiness must not be declared until closed.

## Authoritative repository destination

`Cypress GRO → 06 - GRO Operations & Activation → 02 - Operational Activation → 2026-09-09 - AMOS-OPS Led Launch Doctrine → AMOS-OPS Doctrine Implementation Sprint`

No SharePoint permission, classification, retention, deletion/disposition, or repository-structure change is authorized by this checkpoint.

## Exact next action

Run the dedicated S5 workflow on this documentation-bearing commit. If exact-SHA lint, typecheck, focused tests, full regression, build, and security checks are successful, freeze S5 as VERIFIED COMPLETE, preserve the S5 acceptance checkpoint in the authoritative SharePoint destination, reconcile the preservation index in place, and stop for Eghosa's acceptance before S6.