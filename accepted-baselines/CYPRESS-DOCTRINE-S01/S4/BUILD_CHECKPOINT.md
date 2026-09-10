# Cypress Doctrine Sprint 01 — S4 Build Checkpoint

## Control status

- Agent: AMOS Prime
- Work item: S4 — Launch Command / Doctrine
- Component status: VERIFICATION CANDIDATE / bounded doctrine implementation
- Production promotion: NOT AUTHORIZED
- SharePoint governance changes: NONE
- Data used for acceptance: synthetic / no PHI

This checkpoint is part of the controlled `sprint/cypress-doctrine-s01` branch. The exact controlling S4 commit is established only after the dedicated S4 validation workflow and CodeQL both succeed on the commit containing this file; that exact SHA and run evidence are recorded in the SharePoint S4 acceptance checkpoint and PR #52 metadata.

## Controlling doctrine implemented

- Cypress GRO current licensed launch capacity: 10 beds.
- Sixteen beds: future expansion only after regulatory approval and express authorization.
- Rate doctrine: $450 floor / $550 target / $650 enhanced; operating controls, not a payer guarantee.
- High-acuity placement: evidence-gated; convenience/cherry-picking declines are not accepted doctrine.
- Placement stability: crisis → stabilize → reassess → modify supports → return when supportable, otherwise justify discharge; automatic discharge is unacceptable.
- Governed record retrieval: CURRENT / CONTROLLING only; competing current controllers create an authority-conflict exception and AMOS must not guess.
- SharePoint remains the authoritative enterprise repository; AMOS-DMS provides governed identity/authority/access; Ask AMOS is the frontline governed interface.
- L0–L12 advancement is capability-gated and evidence-gated, never date-gated.

## S4 implementation surface

- `contracts/doctrine/cypress-launch-command.ts`
- `api/doctrine/cypress-launch-command.ts`
- `api/routers/cypress-launch-command.ts`
- `api/routers/m2-authority.ts`
- `src/components/m41b/m41b-launch-command-preview.tsx`
- `src/pages/exec/m41b-intelligence-assistant-page.tsx`
- `api/tests/s4-cypress-launch-command.test.ts`
- `.github/workflows/cypress-s01-s4-validation.yml`

S4 reuses the existing governed M2 / Ask AMOS boundary and does not create a parallel assistant or application.

## Acceptance scenarios

1. Controlled 10-bed baseline resolves only through the bounded S4 capability.
2. A 16-bed request is blocked from superseding the current 10-bed controller.
3. Competing current doctrine authorities fail closed and withhold doctrine values.
4. Live production readiness is blocked while EXC-S2-01 remains open.
5. A calendar/date attempt to bypass L6–L11 and jump to L12 is blocked.
6. Preview status explicitly declares synthetic/no-PHI mode and no production authorization.

## Carry-forward exceptions

- EXC-S1-01 — OPEN / inherited: malformed `rm7-zone-a-verify.yml`; not Sprint 01 acceptance evidence.
- EXC-S1-05 — OPEN / inherited dependency risk: npm audit currently reports 18 vulnerabilities (11 moderate, 7 high). Do not apply blind/breaking remediation.
- EXC-S2-01 — OPEN / deployment dependency: live AMOS-OPS runtime/Railway Microsoft Graph credentials and an actual live SharePoint runtime probe remain unconfigured/unverified.

## Boundary

This checkpoint does not authorize a merge to `main`, production deployment, SharePoint permission/classification/retention/disposition changes, 16-bed activation, S5 execution, or any live-data acceptance test.
