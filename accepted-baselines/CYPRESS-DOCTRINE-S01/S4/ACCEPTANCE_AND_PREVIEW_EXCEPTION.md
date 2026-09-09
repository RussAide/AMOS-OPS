# Cypress Doctrine Sprint 01 — S4 Acceptance and Preview Exception

## Authority and status

- Authority: Eghosa Olayinka Aideyan
- Acceptance date: 2026-09-09
- S4 — Launch Command / Doctrine: ACCEPTED
- S5 — Referral / Acuity / Rate: AUTHORIZED
- Production promotion: NOT AUTHORIZED
- SharePoint governance changes: NONE

Eghosa explicitly directed AMOS Prime to proceed after review of the S4 checkpoint. This constitutes acceptance of the verified S4 control implementation and authorization to execute S5 within the existing bounded Cypress Doctrine Sprint 01 component.

## Preview-delivery exception

### EXC-S4-UX-01 — User-facing preview failed on iOS file preview

Status: OPEN / presentation and acceptance UX exception

Observed behavior: the standalone S4 HTML preview did not execute its interactive scenario controls when opened through the iOS/Apple remote file-preview path. The user therefore did not receive the intended click/tap behavior in the actual review environment.

Control interpretation:

- This does not supersede the successful S4 code, regression, build, and security validation evidence.
- The failed mobile preview must not be represented as successful user-facing acceptance evidence.
- Future sprint acceptance previews must use a browser-native/review-runtime surface or another interaction mechanism verified on the user's actual review path; do not rely on sanitized iOS file-preview execution of standalone JavaScript.
- The exception does not authorize production deployment or a change to hosting architecture.

## Carried control boundary

The accepted S4 doctrine remains controlling:

- Current licensed Cypress GRO capacity: 10 beds.
- Sixteen beds: future expansion only after regulatory approval and express authorization.
- Rate doctrine: $450 floor / $550 target / $650 enhanced; operating controls, not a payer guarantee.
- High-acuity placement: evidence-gated; convenience or cherry-picking is not a valid decline basis.
- L0–L12 progression is capability/evidence gated, not date gated.
- SharePoint remains the authoritative repository.
- Merge to `main` and production promotion remain separately reserved decisions.

## Exact next action

Execute S5 — Referral / Acuity / Rate on `sprint/cypress-doctrine-s01`, using synthetic/no-PHI acceptance evidence, reusing the existing CCMG referral and GRO foundations, and stop at the S5 acceptance gate before S6.