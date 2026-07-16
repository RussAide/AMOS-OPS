# AMOS-OPS controlled environment runbook

This M1.1 runbook supersedes every earlier deployment instruction in this source package. The controlling architecture is [config/environments/README.md](config/environments/README.md).

## Supported profiles

AMOS-OPS has exactly four isolated profiles: `development`, `demo`, `staging`, and `production`. Each profile uses a distinct environment ID, database, upload path, credential namespace, origin allowlist, and deployment control record.

All profiles use one immutable build. `AMOS_RUNTIME_MODE=demo|production` is
selected only at process startup; see
[docs/SINGLE-BUILD-RUNTIME-MODES.md](docs/SINGLE-BUILD-RUNTIME-MODES.md).

Never copy a database, upload directory, token, secret, or `.env` file between profiles.

## Local development

1. Install the lockfile exactly: `npm ci`.
2. Copy `.env.development.example` to a local `.env` that remains outside source control.
3. Run `npm run env:validate`.
4. Run `npm run verify`.
5. Start the local application with `npm run dev`.

The default development stores are `data/development/amos-ops.db` and `uploads/development/`.

## Fictional demo evaluation

The demo profile is the only profile permitted to enable fictional evaluation mode.

1. Use `.env.demo.example` as the local profile.
2. Use only fictional `@amos-ops.invalid` identities and synthetic records.
3. Run `npm run env:validate` and `npm run verify`.
4. Build/start the isolated demo container with `docker compose up --build` when container evaluation is desired.
5. Register a fictional account with a 12+ character password.
6. Complete the guided synthetic MFA challenge. Demo MFA/recovery disclosures are never emitted in staging or production.

Demo stores are `data/demo/amos-ops.db` and `uploads/demo/`. There are no hard-coded default credentials.

## Staging and production

Staging and production are manual, protected workflow targets. A controlled dispatch must provide:

- the explicit target environment;
- an environment-scoped host token and service/site identifier;
- distinct `APP_SECRET` and `JWT_SECRET` values from that target's credential namespace;
- exact `AMOS_ALLOWED_ORIGINS` values;
- an approval ID and change reference; and
- the exact verified image digest being promoted.

Production additionally requires `MFA_POLICY=required-all`, disabled
self-registration, and the RG.1-approved release authorization variables. The
workflow runs `npm ci`, `npm run env:validate`, and `npm run verify` before
invoking the protected Node/container host.

No deployment is performed by this prototype milestone build.

## Identity behavior

- Self-registration defaults on only in development/demo.
- Passwords require 12+ characters with upper/lowercase, numeric, and special characters.
- Five failed passwords cause a 15-minute lockout.
- Sessions are server-revocable, environment-bound, and limited by idle and absolute timeouts.
- MFA is mandatory for every Production account; other controlled profiles may apply a stricter policy.
- Password recovery is single-use and revokes prior sessions.
- Account removal is a retained-evidence deactivation, not a hard delete.
- Access reviews are recorded and may retain, modify, or revoke access.

## Generated state

Do not package `.env` files, databases, upload contents, logs, build output, or dependency directories. They are runtime state, not accepted source.
