# Cypress Doctrine Sprint 01 — S3 Build Checkpoint

Authority: Eghosa Olayinka Aideyan  
Agent: AMOS Prime  
Component: AMOS-OPS / Cypress Doctrine Sprint 01  
Gate: S3 — Ask AMOS Medical Record Bridge  
Status: IN PROGRESS — awaiting exact-SHA validation  
Base verified S2 checkpoint: `518a220b4c20577b5ea270b1514df132e7cac2cc`

## Authorization

S2 was accepted and S3 was expressly authorized by Eghosa on 2026-09-09 with the additional requirement that the preview be viewable without blockers.

## S3 bounded implementation

1. Reuse the existing M4.1B Ask AMOS experience; do not create a parallel assistant.
2. Compose Ask AMOS medical-record retrieval through the verified S1 authority/context controls and S2 exact SharePoint backend bridge.
3. Provide a synthetic, no-PHI preview that does not depend on Railway/Microsoft Graph credentials.
4. Demonstrate five controlled scenarios: authorized current record, superseded-copy protection, contextual denial, authority conflict, and backend metadata drift.
5. On denial, conflict, unavailable authority, or stale backend, return no medical-record content and no backend locator.
6. Keep the live Graph path fail-closed until runtime credentials are configured and a successful live probe is independently verified.
7. Do not merge to `main`, promote production, or alter SharePoint permissions, classification, retention, deletion, disposition, or repository structure under this gate.

## Preview semantics

The preview is an isolated in-memory training fixture and uses synthetic identifiers/content only. It exercises the real S1 authority resolver and S2 backend bridge rather than bypassing them with a disconnected UI mock.

The default preview scenario is an authorized CURRENT / CONTROLLING medical continuity record so the experience is immediately visible. Alternate controls are selectable in the same panel.

## Open exceptions carried forward

- EXC-S1-01 — inherited malformed RM7 workflow on `main`; not S3 acceptance evidence.
- EXC-S1-05 — inherited npm dependency-risk finding; production release dependency remains open.
- EXC-S2-01 — AMOS-OPS runtime Microsoft Graph credentials and live runtime probe remain unverified. This does not block the synthetic S3 preview, but it blocks any claim of live SharePoint medical-record operation.

## Acceptance evidence required

S3 is not verified complete until the exact sprint SHA passes the dedicated S3 workflow: locked install, strict lint, typecheck, focused S3 tests, full repository regression tests, and client/server build.
