# AMOS-OPS Training Activation

## Purpose

This document governs a limited AMOS-OPS Production training pilot while the
Production corrective milestones continue on a separate track. Training is an
account access profile inside the live AMOS-OPS deployment; it is not a second
deployment and it does not authorize operational-data use.

The first pilot is for platform orientation and synthetic workflow practice.
It is not clinical competency validation, regulatory certification, workforce
clearance, or authorization to provide care.

## Two separate decisions

| Decision                 | Meaning                                                                                                                                                  | Current result           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Build complete           | The Training controls are implemented, tested, merged, and ready for a controlled deployment. No staff access is implied.                                | Partial — action remains |
| Live activation complete | The verified build is deployed, live health and isolation gates pass, the pilot roster is enrolled with MFA, and monitored synthetic-only use may begin. | Not started              |

Training build work may proceed while RM.2 continues. A Training deployment or
pilot session must not overlap an RM.2 storage migration, key change, rollback,
or other Production maintenance window.

## Training activation milestones

### TA.0 — Readiness baseline and safety contract

**Objective:** Establish the existing control baseline, the allowed pilot
boundary, stop conditions, and evidence requirements before code or live-user
activation.

**Status:** Complete

Completed controls:

- reviewed account-level Training identity, database, upload, routing, and
  fixture behavior;
- verified 56 focused identity, isolation, Production-boundary, and resilient
  transport tests;
- identified the invitation/MFA, role assignment, progress persistence,
  authorization, fallback, mobile-warning, file-upload, and test-coverage gaps;
- established the synthetic-only/no-PHI boundary below.

TA.0 completion does not mean the live pilot is ready.

### TA.1 — Training Activation Foundation

**Objective:** Build and verify the minimum controls needed for individually
authenticated, role-appropriate, synthetic-only staff orientation.

**Status:** Partial — action remains

Implementation checkpoint (2026-07-17):

- structured, sponsored, expiring Training invitations now enroll TOTP and use
  a fragment-based one-time link;
- Training sessions route only to an immutable 16-module universal-orientation
  allowlist with a persistent amber no-PHI/practice-only warning;
- self-progress is session-derived, stored only in the Training database,
  hydrated after login, and displayed only after the server confirms a save;
- operational routes/procedure families, synthetic client fallbacks, live
  connectors, and Training file upload/download are denied;
- the remaining build gate is atomic fail-closed Training audit recording plus
  the documented browser-level enrollment/routing/persistence test coverage.

Required work:

- replace the undelivered Production email-OTP path for new Training users with
  one-time invitation and TOTP enrollment;
- collect the canonical role, identity type, sponsor, access expiration, and
  rationale before creating the account; do not default every invite to
  `rcs-day`;
- keep invitation tokens out of server-facing query strings and remove them
  from the browser location immediately after capture;
- make Production synthetic-route access depend on the authenticated,
  server-resolved Training scope, not a browser local-storage value;
- preserve a visible `TRAINING — SYNTHETIC DATA ONLY — NO PHI` warning on
  desktop and mobile;
- separate curriculum definitions from per-user progress and start every new
  pilot user at zero progress;
- persist the trainee's progress and quiz results in the Training database;
- derive self-service progress ownership from the authenticated user and never
  trust a caller-supplied user ID;
- allow trainees to reach only their own assigned orientation content and allow
  cohort administration only for an approved trainer role;
- prevent API outages or server errors from becoming apparent successful
  completions through client fallback;
- disable Training uploads, evidence attachments, exports, and live connector
  actions for the pilot;
- add browser and integration coverage for enrollment, MFA, role routing,
  isolation, persistence, denial, suspension, expiry, and logout.

### TA.2 — Controlled key-staff pilot

**Objective:** Activate a small supervised roster after TA.1 and every live gate
below pass.

**Status:** Not started

Pilot controls:

- use individually assigned accounts; shared accounts are prohibited;
- limit each account to a verified work email, name, canonical AMOS role,
  sponsor, and expiration date;
- begin with a small representative roster covering an administrator/trainer,
  an executive or department leader, a BHC leader, a GRO leader, and a standard
  staff role;
- conduct the first session under supervision and verify each user's route
  visibility before independent use;
- use only the approved platform-orientation track and synthetic exercises;
- record defects and feedback without entering operational or regulated data;
- suspend the pilot immediately when any stop condition occurs.

## Synthetic-only and no-PHI boundary

### Account/control-plane data permitted

Only the minimum identity information required to authenticate real staff is
permitted in the operational identity control plane:

- staff name;
- verified organizational email;
- canonical AMOS role and department;
- sponsor, access status, expiration, and access-review metadata;
- authentication, MFA, session, and security-audit events.

This information is not Training scenario content. It must not be copied into
synthetic cases or displayed as fictional workforce/clinical records.

### Training workspace data permitted

- fictional records with conspicuous `SYNTH-` identifiers;
- approved synthetic names and `example.invalid` or `amos-ops.invalid`
  addresses;
- fictional cases, tasks, referrals, schedules, payments, documents, and
  workflow outcomes;
- platform-orientation progress and quiz results for the authenticated trainee;
- synthetic defect reports that contain no real client, employee, payer, or
  service information.

### Prohibited data and actions

- patient, client, youth, resident, family, or substance-use-disorder data;
- PHI, 42 CFR Part 2 records, or any real care-delivery documentation;
- real clinical assessments, medication records, incidents, referrals,
  authorizations, claims, billing, or payer data;
- personnel files, payroll, background checks, performance records,
  credential-source documents, or employee medical information;
- real documents, screenshots containing real records, CSV imports, copied
  Production text, or file evidence uploads;
- Operational workspace access by a Training-only account;
- live Microsoft 365, SharePoint, Teams, Outlook, email, SMS, payer, clinical,
  or other external connector operations;
- exports, bulk downloads, printing of regulated-looking records, or treatment
  of pilot results as official records;
- use of prototype course completion as clinical competency, clearance,
  certification, continuing education, or compliance evidence.

If real or regulated data is entered accidentally, stop the pilot, preserve the
security event, restrict access, and follow the incident-response process. Do
not copy the data into an evidence package.

## Screen allowlist for TA.2

No live Training screen is approved until TA.1 and the live gates pass.

After approval, the initial allowlist is:

- sign-in, one-time invitation acceptance, TOTP enrollment, MFA verification,
  logout, and the user's own session view;
- Training home/launch page with the persistent no-PHI warning;
- the assigned platform-orientation track;
- synthetic role-navigation walkthroughs that passed the role-specific smoke
  test;
- the trainee's own progress and quiz-result view;
- a trainer-only synthetic cohort dashboard containing no operational workforce
  records.

The following remain unavailable during the pilot:

- evidence/file upload and download screens;
- operational user administration while the administrator is switched into
  Training;
- credential, clearance, payroll, performance, or personnel-record screens;
- clinical, medication, incident, claims, billing, and official compliance
  actions;
- any screen that cannot prove server-authoritative Training scope;
- any screen that substitutes fixture content after an API or readiness
  failure.

Authorized administrators may create, suspend, revoke, or review Training
accounts only from the Operational workspace. Those actions are pilot
administration, not trainee activities.

## TA.1 build acceptance criteria

TA.1 is build-complete only when all of the following pass:

1. An authorized administrator creates a sponsored, expiring Training account
   with the intended canonical role in one operation.
2. The one-time invitation expires, is single-use, is not logged, and is absent
   from browser history and server-facing URLs after capture.
3. The invited user sets a policy-compliant password, enrolls TOTP, verifies a
   current code, and receives a revocable Training-scoped session.
4. A Training-only identity requesting Operational scope receives HTTP 403.
5. Suspended, deactivated, expired, and revoked accounts cannot authenticate or
   retain active sessions.
6. Training and operational read/write probes remain in their separate
   databases and upload roots.
7. Every connector and external-write probe is denied in Training.
8. Each pilot role can open only its approved navigation and assigned
   orientation content.
9. Trainees can read and update only their own progress; trainers have only the
   approved cohort scope.
10. Progress survives refresh, logout/login, backend restart, and redeployment.
11. Service failures produce an unavailable/error state and never apparent
    progress or completion.
12. The Training warning is continuously visible on desktop and mobile.
13. Upload, attachment, import, export, and live-send controls are absent or
    fail closed.
14. Invitation, enrollment, MFA, denial, progress, completion, suspension,
    expiry, and logout events are auditable without secrets.
15. Focused tests, typecheck, strict lint, the full automated suite, and the
    Production build pass.

## Live activation gates

TA.2 cannot begin until the deployed candidate passes these gates in order:

1. **Maintenance gate:** no RM.2 migration, key operation, deployment, or
   rollback is active.
2. **Liveness gate:** `/api/health/live` returns HTTP 200 on three consecutive
   checks during a five-minute observation window.
3. **Readiness gate:** `/api/health/ready` returns HTTP 200 and reports no
   initialization, database, audit, alert, storage, or encryption failure.
4. **Runtime gate:** `/api/runtime-config` reports the expected Production
   environment, build identifier, release identifier, and API origin; Demo or
   evaluation mode is not active.
5. **Administrator smoke:** the authorized administrator signs in with TOTP and
   can create, inspect, suspend, and revoke a disposable synthetic Training
   account from Operational scope.
6. **Trainee smoke:** the disposable account completes invitation, TOTP, MFA,
   Training landing, own-progress update, logout, and re-login.
7. **Isolation smoke:** Operational scope spoofing and cross-database/file
   probes fail; connectors, uploads, imports, exports, and live sends are denied.
8. **Persistence smoke:** a synthetic progress marker survives backend restart
   and redeployment without appearing in operational storage.
9. **Role smoke:** every role represented in the pilot roster passes the exact
   route/navigation allowlist.
10. **Content gate:** the pilot track is labeled platform orientation and all
    scenarios and identities pass the synthetic-data scan.
11. **Evidence gate:** the activation evidence set is complete, contains no
    token, TOTP secret, password, PHI, or unnecessary staff personal data, and
    records the rollback point.

## Evidence package

The TA.1/TA.2 evidence package must contain:

- source commit, tree hash, build identifier, and deployment identifier;
- focused and full QA logs;
- redacted liveness, readiness, and runtime-config results;
- invitation and TOTP lifecycle test results with all secrets removed;
- server-authoritative scope-denial results;
- cross-database and cross-file isolation results;
- connector/upload/import/export denial results;
- before/after persistence markers using synthetic identifiers and hashes;
- desktop and mobile screenshots showing the persistent Training warning;
- role-by-route results for every pilot role;
- audit event identifiers for enrollment, MFA, progress, denial, suspension,
  expiry, and logout;
- the pilot roster and session record in a restricted administrative evidence
  location, not the public repository;
- confirmation that zero PHI and zero operational records were used;
- rollback and pilot-suspension instructions.

## Stop and rollback conditions

Stop activation or suspend an active pilot when:

- liveness or readiness is not HTTP 200;
- the Training warning is absent;
- MFA cannot be completed or a session cannot be revoked;
- a Training identity reaches Operational scope;
- Training and operational data or files cross scopes;
- a live connector, upload, import, export, or external send succeeds;
- an API failure is masked by fixture fallback;
- progress is attributed to another user or is lost after restart;
- real or regulated data is entered;
- an RM.2 migration, key operation, rollback, or emergency deployment begins.

Suspend or revoke pilot sessions first. Roll back the application to the last
verified healthy deployment when required. Do not restore or replace persistent
data unless integrity evidence specifically requires it and the corrective
rollback procedure authorizes it.

## Relationship to corrective milestones

- RM.0 and RM.1 provide the rollback and persistence foundation.
- RM.2 remains the active corrective milestone and continues independently.
- TA.1 may implement only the minimum Training-specific identity and session
  behavior needed for the synthetic pilot; the broader Production identity
  lifecycle remains governed by RM.4.
- File uploads remain disabled because malware scanning, object-level file
  authorization, retention, and deletion belong to RM.5.
- TA.2 authorizes only synthetic platform orientation. It does not change the
  RM.8 requirement for final operational-data authorization.
