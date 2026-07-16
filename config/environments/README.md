# AMOS-OPS environment and deployment control

AMOS-OPS uses one immutable build with two governed startup modes: `demo` and
`production`. The existing development, demo, staging, and production profiles
remain physically and logically isolated; no profile may reuse another
profile's database path, credential namespace, or deployment approval record.

| Profile       | Purpose                        | Data store                     | Credentials                | Deployment control             | Evaluation data |
| ------------- | ------------------------------ | ------------------------------ | -------------------------- | ------------------------------ | --------------- |
| `development` | Local engineering              | Development database + uploads | Development namespace only | Local, no deployment           | Off by default  |
| `demo`        | Fictional feature evaluation   | Demo database + uploads        | Demo namespace only        | Single build, Demo startup     | Required        |
| `staging`     | Release verification           | Dedicated staging stores       | Staging vault/namespace    | Approval ID + change reference | Prohibited      |
| `production`  | Authorized operational release | Dedicated production stores    | Production vault/namespace | Approval ID + change reference | Prohibited      |

## Built-in enforcement

- `APP_ENV` selects exactly one profile.
- `AMOS_RUNTIME_MODE` selects `demo` or `production` at process startup; it is never a browser or user preference.
- `AMOS_ENVIRONMENT_ID` scopes server sessions; a token issued in one environment is invalid in every other environment.
- `DATABASE_PATH` and `CREDENTIAL_NAMESPACE` must contain `staging` or `production` for controlled profiles.
- `UPLOAD_PATH` is scoped by environment; controlled profiles reject shared or incorrectly named upload stores.
- The browser verifies the server-issued mode at `/api/runtime-config`; a missing or contradictory response activates the safe startup lock.
- Staging and production refuse placeholder or short secrets and require both `DEPLOYMENT_APPROVAL_ID` and `DEPLOYMENT_CHANGE_REFERENCE`.
- Staging and production require exact comma-separated `AMOS_ALLOWED_ORIGINS`; wildcard authenticated CORS is prohibited.
- Production requires MFA for every account, disabled self-registration, and explicit RG.1 release authorization.
- `.env` files, databases, logs, and generated runtime state remain excluded from source snapshots.
- Demo and Production use the same compiled frontend/backend artifact. Mode-specific values are injected only when the process starts.

## Safe evaluation sequence

1. Copy `.env.demo.example` to a local `.env` outside the accepted source package.
2. Start with a new `data/demo/amos-ops.db`; never import another environment's database.
3. Register a fictional `@amos-ops.invalid` account with a 12+ character password.
4. Complete the disclosed synthetic MFA challenge. MFA and password-recovery codes are disclosed only when both `APP_ENV=demo` and evaluation mode are enabled.
5. Delete the generated `.env` and runtime data before packaging evidence.

## Controlled deployment sequence

1. The release operator selects staging or production explicitly.
2. The host injects credentials from that environment's credential namespace; secrets never enter source files.
3. The operator records an approval ID and change reference.
4. Production remains locked until the RG.1 gate is GO and the approved release ID is injected with explicit production authorization.
5. Run `npm run env:validate`; any isolation or approval failure stops the deployment.
6. Run the full verification suite, then invoke the environment-protected manual deployment job with the already-verified image digest.

Staging and production GitHub environments must hold different host tokens,
site/service identifiers, origins, and protected reviewers. The governed runtime
requires the Node container and same-origin API; static-only hosting is not a
supported mode-switch target.

The example staging and production profiles intentionally contain invalid placeholders. They are documentation templates and must fail validation until an authorized host injects real values.
