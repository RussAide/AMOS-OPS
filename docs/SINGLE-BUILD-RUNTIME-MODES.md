# AMOS-OPS Single Build: Demo and Production Modes

## Decision

AMOS-OPS uses one immutable application build. The deployment selects one of
two modes at process startup with `AMOS_RUNTIME_MODE`:

| Mode | Data boundary | Evaluation fallback | External/live writes | Current release state |
|---|---|---:|---:|---|
| `demo` | Fictional and isolated demo data only | Allowed for eligible reads | Blocked | Available for controlled demonstration |
| `production` + isolated review | Isolated review data | Blocked | Blocked | Available for owner experience review |
| `production` + live authorization | Authorized production data | Blocked | Allowed only after the production release gate | **Locked / NO-GO** |

The mode is not an in-app user setting. Changing it requires a restart or a new
deployment using the same verified image digest. Demo and Production must never
share a database, upload location, credentials, origin, or connector identity.

The browser obtains the verified mode from the read-only same-origin endpoint
`GET /api/runtime-config`. If that contract is unavailable, malformed, or
contradictory, the browser displays a safe startup lock and does not enable Demo
fixtures or Production operations.

Isolated review is a deployment posture, not a third runtime mode. It runs the
Production code path in `APP_ENV=staging`, disables evaluation fallbacks,
provides the configured owner with MFA-protected access, and keeps production
data and external writes blocked. Deployment approval is deliberately outside
the application and does not appear in navigation, pages, APIs, or database
workflows.

## Simple to-do checklist

### 1. Demo pathway

- [ ] Build the container once and record its immutable image digest.
- [ ] Set `APP_ENV=demo` and `AMOS_RUNTIME_MODE=demo`.
- [ ] Set demo-only database, upload, credential, and environment namespaces.
- [ ] Keep production credentials and production connector identities absent.
- [ ] Run `npm run env:validate` before startup.
- [ ] Start the build and confirm the amber **DEMO — NOT FOR CARE DELIVERY** banner.
- [ ] Confirm `/api/runtime-config` reports synthetic-only safeguards and no live writes.
- [ ] Run the Demo smoke test with fictional records only.

### 2. Go-Live Production pathway

- [ ] Deploy the sealed candidate to an isolated release-review environment.
- [ ] Sign in as the configured owner with MFA and review complete functionality.
- [ ] Record the owner's decision outside AMOS.
- [ ] Discuss and separately authorize the deployment strategy outside AMOS.
- [ ] Close every RG.1 P0 release gate and record the formal GO decision.
- [ ] Provision separate Production secrets, database, uploads, credentials, and exact origins.
- [ ] Require MFA for all users and keep self-registration disabled.
- [ ] Use the exact same verified image digest that passed release testing.
- [ ] Set `APP_ENV=production` and `AMOS_RUNTIME_MODE=production`.
- [ ] Set the approved deployment and change references.
- [ ] Only after formal GO, set `AMOS_PRODUCTION_RELEASE_AUTHORIZED=true` and the approved `AMOS_PRODUCTION_RELEASE_ID`.
- [ ] Run `npm run env:validate`; any error is a stop condition.
- [ ] Start the build and confirm the green **PRODUCTION** banner and correct release ID.
- [ ] Complete production smoke, audit, backup/restore, access, and rollback checks before admitting users.

## Startup profiles

Demo:

```dotenv
APP_ENV=demo
AMOS_RUNTIME_MODE=demo
AMOS_ENVIRONMENT_ID=amos-ops-demo
CREDENTIAL_NAMESPACE=amos-ops/demo
DATABASE_PATH=/app/data/demo/amos-ops.db
UPLOAD_PATH=/app/uploads/demo
ALLOW_SELF_REGISTRATION=true
MFA_POLICY=required-all
```

Release review (Production pathway, synthetic and live-write locked):

```dotenv
APP_ENV=staging
AMOS_RUNTIME_MODE=production
AMOS_REVIEW_DEPLOYMENT=true
AMOS_ENVIRONMENT_ID=amos-ops-staging-review
CREDENTIAL_NAMESPACE=amos-ops/staging
DATABASE_PATH=/app/data/staging/amos-ops.db
UPLOAD_PATH=/app/uploads/staging
ALLOW_SELF_REGISTRATION=false
MFA_POLICY=required-all
AMOS_FINAL_GATE_OWNER_EMAIL=owner@amos-ops.invalid
AMOS_FINAL_GATE_CANDIDATE_ID=DMS.1
AMOS_BUILD_ID=<sealed-build-id>
AMOS_SOURCE_DIGEST=<sealed-source-sha256>
AMOS_REVIEW_OWNER_PASSWORD_HASH=<bcrypt-hash>
AMOS_REVIEW_OWNER_MFA_CODE=<private-six-digit-code>
```

Production (remains locked until every placeholder is replaced and release GO
is formally authorized):

```dotenv
APP_ENV=production
AMOS_RUNTIME_MODE=production
AMOS_ENVIRONMENT_ID=amos-ops-production
CREDENTIAL_NAMESPACE=amos-ops/production
DATABASE_PATH=/app/data/production/amos-ops.db
UPLOAD_PATH=/app/uploads/production
ALLOW_SELF_REGISTRATION=false
MFA_POLICY=required-all
DEPLOYMENT_APPROVAL_ID=<approved-id>
DEPLOYMENT_CHANGE_REFERENCE=<approved-change>
AMOS_PRODUCTION_RELEASE_AUTHORIZED=true
AMOS_PRODUCTION_RELEASE_ID=<approved-rg1-go-release-id>
```

Production authorization variables are release evidence, not a substitute for
the RG.1 gate. They must remain unset or false while the gate decision is NO-GO.
