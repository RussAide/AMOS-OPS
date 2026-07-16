# AMOS-OPS Account-Level Training

AMOS-OPS uses one application build, one GitHub repository, one Railway service,
one Netlify site, and the existing `amos-ops.com` domain. Training is an account
access profile, not a second deployment or a global runtime switch.

## Access profiles

- **Training** — the account is forced into the isolated Training workspace.
  Operational records, files, Microsoft 365, and email connectors are unavailable.
- **Operational — Cleared** — normal role-based production access. A designated
  trainer may also switch into Training without receiving a second account.
- **Suspended** and **Deactivated** — authentication and active sessions are denied.

New workforce and external-stakeholder invitations start in Training. External
stakeholder accounts cannot be promoted to Operational. Workforce promotion
requires a clearance evidence reference and rationale; the change revokes all
existing sessions and records an access-profile event.

## Physical isolation

Railway must provide one persistent volume containing four distinct paths:

```text
/app/data/production/amos-ops.db
/app/data/production/training/amos-ops-training.db
/app/uploads/production/
/app/uploads/production/training/
```

Every authenticated application request is routed through an asynchronous data
scope. Legacy raw-SQL callers and Drizzle callers both resolve to the same scoped
database. File upload and download routes use the same account scope. Identity,
sessions, invitations, clearance evidence, and access events always remain in the
operational control plane.

## Hosted topology

- Netlify serves the browser application on `amos-ops.com`.
- Railway runs the API and both isolated data workspaces.
- Netlify receives `VITE_AMOS_API_ORIGIN` with the Railway public origin.
- Railway allows the exact `https://amos-ops.com` and optional
  `https://www.amos-ops.com` origins through `AMOS_ALLOWED_ORIGINS`.

No Training or Demo subdomain, branch, service, database deployment, or second
site is required.
