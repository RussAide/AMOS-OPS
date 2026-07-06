# AMOS-OPS Deployment Guide: Railway + Netlify via GitHub
## Full-Stack Deployment with CI/CD

---

## Architecture Overview

```
                   +------------------+
                   |     GitHub       |
                   |   (Repository)   |
                   +--------+---------+
                            | Push to main
                            |
              +-------------+-------------+
              |                           |
     +--------v--------+       +---------v--------+
     |    Netlify      |       |     Railway      |
     |  (Frontend)     |       |    (Backend)     |
     |   Static SPA    |       |   API Server     |
     |   React 19      |       |   Hono + tRPC    |
     |   dist/         |       |   SQLite         |
     |   Port 443      |       |   Port 3000      |
     +--------+--------+       +---------+--------+
              |                           |
              | HTTPS                     | HTTPS
              |                           |
       +------v------+            +-------v--------+
       |   Users     |            |   Database     |
       |  Browser    |            |   (SQLite)     |
       +-------------+            +----------------+
```

| Service | Role | URL Pattern |
|---------|------|-------------|
| **Netlify** | Frontend hosting | `https://amos-ops.your-site.netlify.app` |
| **Railway** | Backend API + Database | `https://amos-ops-backend.up.railway.app` |
| **GitHub** | Source control + CI/CD | `https://github.com/your-org/amos-ops` |

---

## Prerequisites

| Tool | Purpose | Sign Up |
|------|---------|---------|
| GitHub account | Source control | [github.com](https://github.com) |
| Netlify account | Frontend hosting | [netlify.com](https://netlify.com) |
| Railway account | Backend hosting | [railway.app](https://railway.app) |
| Git | Version control | `apt install git` / `brew install git` |

---

## Step 1: Create Your GitHub Repository

### 1.1 Initialize the Repository

```bash
# Create a new directory for your repo
mkdir amos-ops-deploy
cd amos-ops-deploy

# Initialize git
git init

# Create the project structure from the extracted codebase
cp -r /path/to/extracted/codebase/* .

# Add deployment config files
cp /path/to/deploy/netlify.toml .
cp /path/to/deploy/Dockerfile .
cp /path/to/deploy/railway.toml .
cp /path/to/deploy/railway.json .
mkdir -p .github/workflows
cp /path/to/deploy/.github/workflows/* .github/workflows/
```

### 1.2 Update Build Scripts in package.json

Edit `package.json` to add these scripts if they don't exist:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "vite",
    "dev:server": "tsx watch api/index.ts",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "esbuild api/index.ts --bundle --platform=node --outfile=dist-server/index.js --external:hono --external:drizzle-orm --external:better-sqlite3",
    "start": "node dist-server/index.js",
    "start:server": "node dist-server/index.js",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx db/seed.ts",
    "db:migrate": "drizzle-kit migrate",
    "lint": "eslint . --ext ts,tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

### 1.3 Create the Server Entry Point

Create `api/index.ts` if it doesn't exist:

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { trpcServer } from '@trpc/server/adapters/fetch';
import { appRouter } from './router';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// CORS - allow Netlify frontend
app.use('/*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// tRPC API
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext: (opts) => ({
    req: opts.req,
    user: null, // Auth context populated by middleware
  }),
}));

// Serve static frontend (for Railway single-deployment)
app.use('/*', serveStatic({ root: './dist' }));

// Fallback to index.html for SPA routing
app.get('*', (c) => {
  return c.text('AMOS-OPS API Server Running', 200);
});

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

console.log(`AMOS-OPS server running on port ${port}`);
```

### 1.4 Commit and Push to GitHub

```bash
# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
dist-server/

# Environment
.env
.env.local
.env.production

# Database
*.db
*.db-journal
*.db-wal
*.db-shm

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Railway
.railway/

# Netlify
.netlify/
EOF

# Commit everything
git add .
git commit -m "Initial AMOS-OPS deployment setup"

# Create GitHub repo (via web or gh CLI) and push
git remote add origin https://github.com/YOUR_USERNAME/amos-ops.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Railway

### 2.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `amos-ops` repository
5. Railway will auto-detect the `Dockerfile` or `railway.toml`

### 2.2 Add Environment Variables

In Railway dashboard → Your Project → Variables, add:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | `3000` | Yes |
| `JWT_SECRET` | *(generate below)* | **CRITICAL** |
| `DATABASE_URL` | `file:./amos-ops.db` | Yes |
| `FRONTEND_URL` | *(your Netlify URL — update after Step 3)* | Yes |
| `APP_URL` | *(your Railway URL)* | Yes |
| `MS_GRAPH_TENANT_ID` | *(optional)* | No |
| `MS_GRAPH_CLIENT_ID` | *(optional)* | No |
| `MS_GRAPH_CLIENT_SECRET` | *(optional)* | No |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2.3 Add Persistent Volume (SQLite)

Railway containers are ephemeral — you need a volume for SQLite:

1. Railway Dashboard → Your Project → **Add** → **Volume**
2. Mount path: `/app/db`
3. Size: Start with 1GB
4. Update `DATABASE_URL` to: `file:/app/db/amos-ops.db`

### 2.4 Deploy

Railway auto-deploys on push to main. For first deploy:

1. Railway Dashboard → Deployments
2. Click **"Deploy"** if not auto-deployed
3. Wait for build (~2-3 minutes)
4. Note the deployed URL: `https://amos-ops-backend.up.railway.app`

### 2.5 Run Database Migrations & Seed

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Run migrations
railway run npx drizzle-kit push

# Seed data
railway run npx tsx db/seed.ts
```

Or via Railway Dashboard:
1. Go to your service → **Shell** tab
2. Run: `npx drizzle-kit push`
3. Run: `npx tsx db/seed.ts`

### 2.6 Verify Backend

```bash
curl https://YOUR_RAILWAY_URL/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## Step 3: Deploy Frontend to Netlify

### 3.1 Option A: Deploy via Git (Recommended — Auto CI/CD)

1. Go to [netlify.com](https://netlify.com) and log in
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize
4. Select your `amos-ops` repository
5. Build settings:
   - **Build command:** `npm install --legacy-peer-deps && npm run build:client`
   - **Publish directory:** `dist`
6. Click **"Deploy site"**

### 3.2 Update Environment Variables in Netlify

Netlify Dashboard → Site → **Site configuration** → **Environment variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://YOUR_RAILWAY_URL` |
| `NODE_VERSION` | `20` |

### 3.3 Update netlify.toml with Railway URL

Edit `netlify.toml` in your repo:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR_ACTUAL_RAILWAY_URL/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/trpc/*"
  to = "https://YOUR_ACTUAL_RAILWAY_URL/trpc/:splat"
  status = 200
  force = true
```

Commit and push — Netlify auto-redeploys.

### 3.4 Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Link to site
netlify link

# Set env vars
netlify env:set VITE_API_URL https://YOUR_RAILWAY_URL

# Deploy
netlify deploy --prod --dir=dist
```

### 3.5 Verify Frontend

Visit your Netlify URL:
```
https://amos-ops-XXXXXX.netlify.app
```

You should see the AMOS-OPS login page.

---

## Step 4: Set Up CI/CD with GitHub Actions

### 4.1 Add GitHub Secrets

Go to GitHub → Your Repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret Name | Value | Where to Get |
|-------------|-------|--------------|
| `RAILWAY_TOKEN` | Railway API token | Railway Dashboard → Account → Tokens |
| `NETLIFY_AUTH_TOKEN` | Netlify personal token | Netlify → User settings → Applications |
| `NETLIFY_SITE_ID` | Your site ID | Netlify → Site → Site configuration → General |

### 4.2 CI/CD Workflows (Already Created)

Your repo has these workflows in `.github/workflows/`:

| Workflow | File | Trigger | Action |
|----------|------|---------|--------|
| CI | `ci.yml` | PR + push | Lint, typecheck, build |
| Deploy Backend | `deploy-railway.yml` | Push to main | Auto-deploy to Railway |
| Deploy Frontend | `deploy-netlify.yml` | Push to main | Auto-deploy to Netlify |

**Enable them:**

```bash
git add .github/workflows/
git commit -m "Add CI/CD workflows"
git push origin main
```

Now every push to `main` will:
1. Run CI checks
2. Auto-deploy backend to Railway
3. Auto-deploy frontend to Netlify

---

## Step 5: Post-Deployment Configuration

### 5.1 Update CORS in Backend

After both services are live, update Railway environment variable:

```
FRONTEND_URL=https://YOUR_NETLIFY_URL
```

### 5.2 Create Admin Account

```bash
# Via Railway shell
curl -X POST https://YOUR_RAILWAY_URL/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!","role":"super-admin","email":"admin@adbolicare.com"}'
```

### 5.3 Verify Full Stack

| Check | URL | Expected |
|-------|-----|----------|
| Frontend loads | Netlify URL | Login page visible |
| Backend health | `/api/health` | `{"status":"ok"}` |
| tRPC API | `/trpc/auth.me` | User data or null |
| Login works | Submit credentials | Redirect to dashboard |
| Dashboard KPIs | `/` | 36 KPI cards load |
| Clinical workspace | `/clinical` | 5 quick actions visible |

---

## Environment Variable Reference

### Railway (Backend)

```env
# === REQUIRED ===
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/app/db/amos-ops.db
JWT_SECRET=<generate-strong-secret>
FRONTEND_URL=https://your-netlify-site.netlify.app

# === OPTIONAL: Microsoft Graph ===
MS_GRAPH_TENANT_ID=
MS_GRAPH_CLIENT_ID=
MS_GRAPH_CLIENT_SECRET=

# === OPTIONAL: Email ===
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### Netlify (Frontend)

```env
# === REQUIRED ===
VITE_API_URL=https://your-railway-app.up.railway.app
NODE_VERSION=20

# === OPTIONAL ===
VITE_APP_NAME=AMOS-OPS
VITE_ENABLE_DEBUG=false
```

---

## Troubleshooting

### Railway: "Application failed to start"

```bash
# Check logs
railway logs

# Common fixes:
# 1. Weak JWT_SECRET — generate strong one
# 2. Missing DATABASE_URL — add volume and env var
# 3. Build failed — check railway logs for build errors
```

### Netlify: "404 on API calls"

```bash
# Check redirects are configured
# In netlify.toml, verify Railway URL is correct
# Test redirect:
curl -I https://your-netlify-site.netlify.app/api/health
# Should proxy to Railway, not return 404
```

### CORS Errors in Browser

```bash
# Verify FRONTEND_URL in Railway matches Netlify URL exactly
# (including https:// and no trailing slash)
```

### Database "table not found"

```bash
# Run migrations via Railway shell
npx drizzle-kit push

# Then seed
npx tsx db/seed.ts
```

### Build fails with "module not found"

```bash
# Clear cache and redeploy
# Railway: Settings → Deploy → Clear build cache
# Netlify: Site → Deploys → Clear cache and retry
```

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Railway for backend** | Simple Docker deploy, SQLite volume support, auto-scaling, generous free tier |
| **Netlify for frontend** | Static site hosting, edge CDN, automatic SPA routing, free tier |
| **Separate deployments** | Frontend/backend can scale independently, easier debugging |
| **SQLite (not PostgreSQL)** | Zero-config, file-based, perfect for single-instance Railway deploy |
| **GitHub Actions CI/CD** | Free for public repos, triggers on push, secret management |
| **Docker on Railway** | Reproducible builds, consistent environment |

---

## Cost Estimate (Free Tier)

| Service | Free Tier Limits | AMOS-OPS Usage | Cost |
|---------|-----------------|----------------|------|
| **Railway** | $5/month credit | 1 service, 1GB volume | **Free** |
| **Netlify** | 100GB bandwidth/month | ~10MB SPA | **Free** |
| **GitHub** | 2,000 Actions minutes/month | ~5 min per deploy | **Free** |
| **Total** | | | **$0/month** |

---

## Next Steps After Deployment

1. [ ] Set custom domain (optional): Netlify → Domain settings, Railway → Custom domain
2. [ ] Enable HTTPS (auto on both platforms)
3. [ ] Set up monitoring: Railway has built-in metrics
4. [ ] Configure backups: Railway volume snapshots
5. [ ] Add team members: GitHub repo access + Railway/Netlify team

---

## Quick Reference Commands

```bash
# Local development
npm install --legacy-peer-deps
npm run dev              # Frontend + backend
npm run build            # Production build
npm run db:push          # Push schema
npm run db:seed          # Seed data

# Railway
railway login
railway link
railway up               # Deploy
railway logs             # View logs
railway run <command>    # Run command in prod

# Netlify
netlify login
netlify link
netlify deploy --prod    # Deploy
netlify open             # Open site

# Git
gh repo create amos-ops --public
git push -u origin main
```
