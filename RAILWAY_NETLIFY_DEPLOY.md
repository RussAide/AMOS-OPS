# Superseded Railway and Netlify guide

This legacy guide is superseded. The current protected workflows are:

- `.github/workflows/deploy-railway.yml`
- `.github/workflows/deploy-netlify.yml`

Their controlling requirements are documented in [config/environments/README.md](config/environments/README.md) and [DEPLOY.md](DEPLOY.md).

The workflows require an explicit staging/production target, environment-scoped credentials and host identifiers, exact allowed origins, an approval ID, a change reference, and successful environment/full-build verification. Staging and production are isolated targets; fictional evaluation mode is prohibited in both.
