# AMOS-OPS Universal Footer Navigation Preview Control

Authority: Eghosa Olayinka Aideyan
Control: AMOS Prime
Shared Platform Contract: IntraLink Universal Footer Navigation Standard v1.0
Candidate: AMOS-OPS v1.3.1-footer-nav-preview
Source baseline: main @ a6f8b2b68e1b3a3c3fd7a547034c09307064251e
Deployment boundary: AMOS-OPS user-facing shell only
Production promotion authorized: NO

## Mapping
1. Home — current authorized Home route
2. My Work — current authorized My Work route
3. Ask AMOS — current authorized intelligence-assistant route
4. Workspace — signed-in role's primary authorized division workspace
5. More — all remaining permission-trimmed shell destinations

## Control properties
- Existing AMOS-OPS branding retained.
- Existing authorization remains source of route visibility.
- Existing sidebar and top navigation remain authoritative on desktop.
- Footer is mobile-first at <=767px.
- More supports keyboard focus and Escape close.
- Safe-area bottom padding is reserved.
- No data schema, database, authentication, role, permission, environment, or Production routing change.
- Production remains Railway-only exact-SHA under DEPLOYMENT_CONTROL.md.

## Release sequence
feature branch -> CI qualification -> Railway Staging exact candidate -> mobile/auth QA -> SharePoint evidence -> Eghosa Production gate -> exact-SHA Production release only after explicit authorization.
