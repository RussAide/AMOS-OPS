# AMOS PRIME — AMOS-OPS / Cypress Doctrine Sprint 01 — S1 Authorized Retrieval Increment

**Control date:** 2026-09-09  
**Authority:** Eghosa “Russ” Aideyan  
**Agent:** AMOS Prime  
**Work item:** S1 — Medical Record Authority & Contextual Access  
**Status:** IN PROGRESS — canonical authority + access retrieval service implemented  
**Production promotion:** NOT AUTHORIZED / NOT PERFORMED

## Increment completed

A canonical server-side retrieval composition has been added for governed records. The sequence is fixed as:

`record authority resolution → stop on conflict/unavailable → contextual access authorization → immutable access-decision audit → return record only on explicit allow`

This prevents a later DMS or Ask AMOS caller from receiving a record merely because it was found. The record must first be the single controlling record and then pass the existing RBAC plus workspace/operation/case/youth context policy.

## Code evidence

- `api/dms/record-authority-service.ts`
- `api/tests/s1-record-authority-service.test.ts`

The service returns no record payload for:

- authority conflict;
- no controlling record;
- RBAC denial;
- workspace/data-scope denial;
- operation-context denial;
- case-assignment denial;
- youth-assignment denial.

Synthetic tests cover successful retrieval, denied retrieval with no record payload, and authority conflict stopping before an access decision can expose content.

## Control boundary preserved

- Existing AMOS-DMS lifecycle remains unchanged.
- No production ref or deployment was changed.
- Draft PR #52 remains review-only and unmerged.
- No SharePoint permissions, classification, retention, deletion, disposition or repository structure were changed.
- S2 DMS↔SharePoint retrieval and S3 Ask AMOS remain out of scope until S1 acceptance.

## Open exception carried forward

`EXC-S1-01` — the inherited `.github/workflows/rm7-zone-a-verify.yml` on `main` is an invalid unified-diff artifact rather than executable Actions YAML. It cannot serve as S1 acceptance evidence until separately corrected under appropriate repository-control authority.

## Exact next action

Wire the canonical retrieval service into the existing `api/routers/m2.ts` server boundary with controlled registration/resolution procedures and trusted server-derived case/youth/operation assignment context, then execute the S1 synthetic end-to-end acceptance scenarios. Do not merge PR #52 and do not begin S2.

## Authoritative SharePoint destination

`Cypress GRO → 06 - GRO Operations & Activation → 02 - Operational Activation → 2026-09-09 - AMOS-OPS Led Launch Doctrine → AMOS-OPS Doctrine Implementation Sprint`
