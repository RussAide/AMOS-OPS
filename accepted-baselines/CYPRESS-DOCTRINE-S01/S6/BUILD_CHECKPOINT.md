# Cypress Doctrine Sprint 01 — S6 Build Checkpoint

## Control state

- Authority: Eghosa Olayinka Aideyan
- Agent: AMOS Prime
- Component: AMOS-OPS / Cypress Doctrine Sprint 01 — bounded doctrine component, not a third enterprise execution thread
- Stage: S6 — Administrator / Workforce / Placement Stability
- S5: ACCEPTED
- S6: IMPLEMENTED / FINAL CHECKPOINT VALIDATION REQUIRED
- S7: NOT AUTHORIZED
- Production promotion: NOT AUTHORIZED
- Merge to `main`: NOT AUTHORIZED

## Implementation candidate

Implementation candidate before this documentation-bearing checkpoint:
`1a9803e7f92cb172b832f68728e8cadd65040878`

The final S6 frozen SHA is the commit containing this checkpoint after successful exact-SHA validation.

## Existing foundations reused

S6 does not create a parallel workforce, staffing, placement, or executive application. It reuses:

- M3.3 workforce controls for recruitment-to-release gates, credential requirement classes, annual training, controlled personnel access, and workforce evidence.
- M2.4 GRO staffing and placement engine for census/staffing evaluation, crisis documentation safeguards, leave/return transitions, and discharge-coordination gates.
- Existing governed M2 / Ask AMOS composition boundary for the S6 API and browser-native command surface.

## S6 controls implemented

### Administrator scorecard — role based

Subject: `ROLE:GRO_ADMINISTRATOR`; the control is not coded around one individual.

Five evidence-based benchmarks:

1. On-site leadership
2. Referral responsiveness
3. Staffing readiness
4. High-acuity execution
5. Compliance & reporting

A missed benchmark is not silently normalized. It enters the controlled sequence:

`evidence assembled → management review → corrective action/support → follow-up → close or escalate`

### Workforce fit and readiness

S6 carries the approved workforce-fit dimensions:

- rapport
- de-escalation
- resilience
- supervision discipline
- documentation
- crisis judgment
- reliability
- teamwork

The synthetic readiness controller reuses M3.3 and can hold release to duty when clearance evidence is incomplete.

### Staffing readiness

S6 reuses the M2.4 GRO staffing evaluator. The acceptance suite includes a synthetic 6-youth / 1-qualified-present-staff condition that fails readiness and is held rather than treated as acceptable staffing.

Controlling licensed Cypress capacity remains **10 beds**. The future 16-bed figure cannot be borrowed into current operations.

### Placement stability / hospitalization continuity

Controlling sequence:

`crisis → stabilize → reassess → modify supports → return-capability review → return when supportable or justified discharge`

Hospitalization, aggression, elopement, or crisis are not automatic discharge triggers.

The S6 synthetic crisis path satisfies the inherited M2.4 requirement for an explicit response plan. The implementation did not weaken or bypass that existing safeguard.

Support-modification evidence demonstrated in the return path includes:

- temporary 2:1 supervision during transition;
- revised crisis-prevention and elopement-response plan;
- clinical/hospital coordination before return;
- confirmation of qualified staffing and relief coverage.

The hospitalization-to-immediate-discharge pattern is flagged for executive review and blocked while reassessment, support modification, or return-capability review remains incomplete.

A discharge is permitted only after the complete continuity sequence and required discharge-coordination evidence establish that safe return is not supportable within the verified capability.

## Synthetic/no-PHI acceptance scenarios

1. Administrator ready
2. Administrator benchmark exception
3. Workforce clearance gap
4. Hospitalization → supported return
5. Automatic post-crisis discharge blocked
6. Justified discharge after completed continuity review

All scenarios retain:

- current licensed capacity: 10 beds;
- future capacity: 16 beds only after regulatory approval and express authorization;
- S6 capability boundary: L9 / L10;
- synthetic/no-PHI data boundary;
- production promotion: NOT AUTHORIZED.

## Browser-native review surface

S6 adds an interactive browser-native command surface to the existing M4.1B Ask AMOS page. It presents:

- six scenario selectors;
- Administrator scorecard;
- workforce-fit and clearance status;
- M2.4 staffing result;
- corrective-action workflow;
- placement-stability continuity chain;
- exceptions and executive flags;
- synthetic audit trail;
- exact next action.

This implementation is not counted as successful user-facing preview evidence until Eghosa actually experiences it through a working review runtime. The failed S4 iOS standalone-file preview remains an open review UX exception.

## Implementation validation evidence

Workflow: `Cypress Doctrine S01 — S6 Validation`

Implementation candidate validation:

- SHA: `1a9803e7f92cb172b832f68728e8cadd65040878`
- Run: `34386448658`
- Job: `102583797524`
- exact-SHA checkout: PASS
- locked dependency install: PASS
- strict lint: PASS
- typecheck: PASS
- focused S6: **1 file / 8 tests PASS**
- full regression: **254 files / 1,731 tests PASS**
- schema export: PASS
- client build: PASS
- server build: PASS

Inherited npm audit result remains **18 vulnerabilities (11 moderate, 7 high)** under EXC-S1-05; no blind or breaking dependency remediation was authorized.

## Superseded S6 validation candidates

### `e58578ae41321fbdc48731d67108198dfd40c9b7`

Superseded. First S6 validation failed at typecheck because TypeScript over-narrowed a newly created M2.4 shift to `scheduled` and rejected the legitimate `active` state returned after attendance. Corrected by typing the state as the existing `M24Shift` contract. No doctrine change.

### `7f382b9b7bb7d749f2fc2197048b80b4731e4b39`

Superseded. Lint and typecheck passed; four placement-continuity tests correctly failed the existing M2.4 `M24_CRISIS_RESPONSE_REQUIRED` safeguard. Corrected by adding the required documented crisis response plan to the synthetic hospitalization event. The M2.4 safeguard was preserved, not weakened.

## Open exceptions carried forward

- **EXC-S1-01 — OPEN / inherited:** malformed `.github/workflows/rm7-zone-a-verify.yml`; not Sprint 01 acceptance evidence.
- **EXC-S1-05 — OPEN / inherited dependency risk:** npm reports 18 vulnerabilities (11 moderate, 7 high); no blind/breaking remediation performed.
- **EXC-S2-01 — OPEN / deployment dependency:** AMOS-OPS Railway/runtime Microsoft Graph credentials and live SharePoint runtime probe remain unconfigured/unverified.
- **EXC-S4-UX-01 — OPEN / review UX:** S4 standalone HTML preview failed interactively in Eghosa’s iOS file-preview path. S6 does not rely on standalone-file JavaScript as acceptance evidence.
- **No new S6 control exception.**

## SharePoint authority

Authoritative destination:

`Cypress GRO → 06 - GRO Operations & Activation → 02 - Operational Activation → 2026-09-09 - AMOS-OPS Led Launch Doctrine → AMOS-OPS Doctrine Implementation Sprint`

No SharePoint permission, classification, retention, deletion/disposition, or repository-structure change is authorized or implied.

## Exact next action

Run the dedicated S6 validation workflow against the documentation-bearing checkpoint SHA. Require strict lint, typecheck, 8/8 focused S6 tests, full repository regression, and build to pass on that exact commit; verify CodeQL on the same final SHA when available. Only then classify S6 as VERIFIED COMPLETE and preserve the S6 acceptance checkpoint and reconciled sprint index in SharePoint. Stop for Eghosa acceptance before S7.