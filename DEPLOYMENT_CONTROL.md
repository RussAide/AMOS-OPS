# AMOS-OPS Deployment Control

## Controlling model

- GitHub repository: `RussAide/AMOS-OPS`
- `main`: source integration and release qualification only.
- Railway Staging: controlled candidate validation.
- Railway Production: explicit exact-SHA release only.
- A merge or push to `main` is not Production authorization.
- Netlify is not an AMOS-OPS Production dependency under the accepted Railway single-surface architecture.
- Production authority remains reserved to Eghosa Olayinka Aideyan.
- SharePoint is the authoritative release/evidence repository.

## Production runtime

- Railway project: `f9357da4-00c4-4f25-a52d-5c53f6ce07dc`
- Service: `AMOS-OPS` / `8fdf6d7e-c7ba-412d-95f0-8b980ba612ba`
- Production environment: `7c22d214-abac-478f-983b-1418a7cbac77`
- Production domain: `https://amos-ops.com`
- Railway service domain: `https://amos-ops-production.up.railway.app`

## Release contract

1. CI on `main` runs lint, typecheck, tests, build, and source qualification only.
2. Staging validates an approved candidate and exact commit SHA.
3. Production release is a separate `workflow_dispatch` action.
4. The Production workflow checks out the explicitly approved 40-character SHA.
5. It builds and validates once, seals the release identity, creates an immutable Railway release stage, and deploys only that stage.
6. Production health and live release-manifest identity must match the approved release.
7. Netlify Production publication is prohibited from the active release pathway.
8. Historical Netlify evidence is preserved; no platform cleanup is implied.
9. Railway GitHub autodeploy for Production must remain disabled so normal `main` activity cannot independently deploy Production.
