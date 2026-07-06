# AMOS-OPS Deployment Guide: Updating Your Existing Live Site
## GitHub Desktop + File Explorer Workflow
## For: Existing Repo with Railway + Netlify Already Connected

---

## Your Current Setup (Confirmed)

| Service | Status | Connected |
|---------|--------|-----------|
| GitHub repo | Live | Source of truth |
| Railway | Live | Auto-deploys from GitHub |
| Netlify | Live | Auto-deploys from GitHub |
| Local files | Needs update | This is what we're doing |

**How it works:** Files → GitHub Desktop → GitHub → Railway + Netlify

---

## BEFORE YOU START: CRITICAL BACKUP STEPS

### Step 0A: Backup Your Database (5 minutes)

Your Railway database has LIVE DATA. Back it up FIRST.

**Method 1: Via Railway Dashboard (easiest)**
1. Go to [railway.app](https://railway.app)
2. Click your AMOS-OPS project
3. Click your database service
4. Click **"Backups"** tab
5. Click **"Create Backup"**
6. Name it: `pre-sprint-deploy-2026-07-05`

**Method 2: Via Railway Shell (if you need a local copy)**
1. Railway Dashboard → Your service → **Shell** tab
2. Run: `sqlite3 /app/db/amos-ops.db ".backup /app/db/amos-ops-backup-2026-07-05.db"`
3. Download the backup file via Railway's file manager

**If something goes wrong, you can restore:** Railway → Database → Backups → Click your backup → Restore

### Step 0B: Note Your Current Working Commit

In GitHub Desktop:
1. Look at the current commit hash (top bar)
2. Write it down: `Current commit: _______________`
3. If you need to roll back, you can always return to this commit

### Step 0C: Create a Git Tag for Easy Rollback

In GitHub Desktop:
1. Repository menu → **"Open in Command Prompt"** (or Terminal)
2. Run: `git tag pre-sprint-deploy`
3. Run: `git push origin pre-sprint-deploy`

Now you have a permanent rollback point called `pre-sprint-deploy`.

---

## PHASE 1: Prepare the New Files (10 minutes)

### Step 1: Download the New Codebase

**Option A: Download the ZIP from this conversation**
1. Download `AMOS-OPS-Full-Deploy.zip` from the file reference above
2. Extract it to your Downloads folder
3. You should have a folder called `deploy/` with all the files

**Option B: If ZIP doesn't work**
1. I can provide individual file contents that you paste/create manually
2. Tell me which files you need and I'll paste them

### Step 2: Set Up Your Working Directory

```
AMOS-OPS-SPRINT-UPDATE/          <-- Create this folder on your Desktop
├── NEW_FILES/                   <-- Files from the extracted ZIP
│   ├── src/
│   ├── api/
│   ├── db/
│   ├── docs/
│   ├── Dockerfile
│   ├── netlify.toml
│   ├── railway.toml
│   ├── railway.json
│   ├── .github/
│   ├── ENCRYPTION.md
│   ├── DEPLOY.md
│   └── RAILWAY_NETLIFY_DEPLOY.md
│
└── CURRENT_REPO/                <-- Your current GitHub repo (clone)
    ├── .git/
    ├── src/
    ├── api/
    ├── db/
    ├── package.json
    └── ...
```

### Step 3: Clone Your Current Repo (fresh copy)

```bash
# Open Command Prompt or PowerShell
cd Desktop
mkdir AMOS-OPS-SPRINT-UPDATE
cd AMOS-OPS-SPRINT-UPDATE

# Clone your existing repo
git clone https://github.com/YOUR_USERNAME/amos-ops.git CURRENT_REPO
```

**Or via GitHub Desktop:**
1. File → **Clone repository**
2. Choose your `amos-ops` repo
3. Set local path to: `C:\Users\YOUR_NAME\Desktop\AMOS-OPS-SPRINT-UPDATE\CURRENT_REPO`

---

## PHASE 2: Merge New Files into Your Repo (15 minutes)

### Strategy: Copy New Files Over Existing Repo

**SAFETY RULE:** We're copying ON TOP of your existing repo. Git will track every change.

### Step 4: Copy New Source Files

From `NEW_FILES/` → into `CURRENT_REPO/`:

**Batch 1: New Pages (copy entire folders)**
```
NEW_FILES/src/pages/workflows/     → CURRENT_REPO/src/pages/workflows/
NEW_FILES/src/pages/analytics/     → CURRENT_REPO/src/pages/analytics/
NEW_FILES/src/pages/knowledge/     → CURRENT_REPO/src/pages/knowledge/
NEW_FILES/src/pages/clinical/*.tsx  → CURRENT_REPO/src/pages/clinical/ (overwrite existing)
NEW_FILES/src/pages/gro/*.tsx       → CURRENT_REPO/src/pages/gro/ (overwrite existing)
NEW_FILES/src/pages/qa/*.tsx        → CURRENT_REPO/src/pages/qa/ (overwrite existing)
NEW_FILES/src/pages/revenue/*.tsx   → CURRENT_REPO/src/pages/revenue/ (overwrite existing)
NEW_FILES/src/pages/hr/*.tsx        → CURRENT_REPO/src/pages/hr/ (overwrite existing)
NEW_FILES/src/pages/exec/*.tsx      → CURRENT_REPO/src/pages/exec/ (overwrite existing)
NEW_FILES/src/pages/admin/*.tsx     → CURRENT_REPO/src/pages/admin/
NEW_FILES/src/pages/gad/*.tsx       → CURRENT_REPO/src/pages/gad/
```

**How to do this in File Explorer:**
1. Open two File Explorer windows side by side
2. Left: `NEW_FILES/src/pages/`
3. Right: `CURRENT_REPO/src/pages/`
4. Drag-and-drop each folder. When Windows asks "Replace files?" → click **"Replace"**

**Batch 2: New Components**
```
NEW_FILES/src/components/agents/        → CURRENT_REPO/src/components/agents/
NEW_FILES/src/components/workflows/     → CURRENT_REPO/src/components/workflows/
NEW_FILES/src/components/help/          → CURRENT_REPO/src/components/help/
NEW_FILES/src/components/sentinel/      → CURRENT_REPO/src/components/sentinel/
```

**Batch 3: Modified Core Files (overwrite these carefully)**
```
NEW_FILES/src/data/navData.ts                    → CURRENT_REPO/src/data/navData.ts
NEW_FILES/src/hooks/useAuth.tsx                  → CURRENT_REPO/src/hooks/useAuth.tsx
NEW_FILES/src/components/shell/AppShell.tsx      → CURRENT_REPO/src/components/shell/AppShell.tsx
NEW_FILES/src/components/shell/AppShellRoutes.tsx → CURRENT_REPO/src/components/shell/AppShellRoutes.tsx
NEW_FILES/src/components/shell/AppSidebar.tsx    → CURRENT_REPO/src/components/shell/AppSidebar.tsx
NEW_FILES/src/pages/DashboardPage.tsx            → CURRENT_REPO/src/pages/DashboardPage.tsx
NEW_FILES/src/pages/MyWorkTodayPage.tsx          → CURRENT_REPO/src/pages/MyWorkTodayPage.tsx
NEW_FILES/src/pages/SOPKnowledgePage.tsx         → CURRENT_REPO/src/pages/SOPKnowledgePage.tsx
```

**Batch 4: Backend Routers (ALL api/routers/*.ts files)**
```
NEW_FILES/api/routers/*.ts  → CURRENT_REPO/api/routers/ (copy ALL files, overwrite all)
```

**Batch 5: Backend Core Files**
```
NEW_FILES/api/router.ts      → CURRENT_REPO/api/router.ts
NEW_FILES/api/middleware.ts  → CURRENT_REPO/api/middleware.ts
```

**Batch 6: Database**
```
NEW_FILES/db/schema.ts      → CURRENT_REPO/db/schema.ts
NEW_FILES/db/relations.ts   → CURRENT_REPO/db/relations.ts
NEW_FILES/db/seed.ts        → CURRENT_REPO/db/seed.ts
NEW_FILES/db/migrations/    → CURRENT_REPO/db/migrations/ (merge, don't replace folder)
NEW_FILES/db/seed-case2*    → CURRENT_REPO/db/ (new seed files)
```

**Batch 7: Documentation & Config (new files)**
```
NEW_FILES/docs/                         → CURRENT_REPO/docs/ (create folder if doesn't exist)
NEW_FILES/ENCRYPTION.md                 → CURRENT_REPO/ENCRYPTION.md
NEW_FILES/Dockerfile                    → CURRENT_REPO/Dockerfile
NEW_FILES/netlify.toml                  → CURRENT_REPO/netlify.toml (edit Railway URL inside)
NEW_FILES/railway.toml                  → CURRENT_REPO/railway.toml
NEW_FILES/railway.json                  → CURRENT_REPO/railway.json
NEW_FILES/.github/workflows/            → CURRENT_REPO/.github/workflows/ (create .github/workflows/ if needed)
```

**Batch 8: .env.example**
```
NEW_FILES/.env.example  → CURRENT_REPO/.env.example
```

### Step 5: CRITICAL — Edit netlify.toml with Your Railway URL

Open `CURRENT_REPO/netlify.toml` in a text editor:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-ACTUAL-RAILWAY-URL.up.railway.app/api/:splat"   <-- CHANGE THIS
  status = 200
  force = true

[[redirects]]
  from = "/trpc/*"
  to = "https://YOUR-ACTUAL-RAILWAY-URL.up.railway.app/trpc/:splat"  <-- CHANGE THIS
  status = 200
  force = true
```

Replace `YOUR-ACTUAL-RAILWAY-URL` with your real Railway app URL.

---

## PHASE 3: Commit and Push via GitHub Desktop (10 minutes)

### Step 6: Review Changes in GitHub Desktop

1. Open **GitHub Desktop**
2. Select your `amos-ops` repository
3. You should see hundreds of changed files — this is NORMAL
4. Review the summary (left panel):
   - Added: ~40 new files
   - Modified: ~30 files
   - Removed: ~6 files

### Step 7: Commit

1. At the bottom left, enter commit message:
   - **Summary:** `Sprint complete: 143 tasks, 16 documents, full-stack features`
   - **Description:** (optional) `D-001 through D-016. Auth security, 8 workflows, clinical+GRO workspaces, DMS, 36 KPIs, human-in-command boundaries.`
2. Click **"Commit to main"**

### Step 8: Push to GitHub

1. Click **"Push origin"** (top right)
2. Wait for the push to complete

### Step 9: Verify GitHub

1. Open your browser → `github.com/YOUR_USERNAME/amos-ops`
2. Check that the latest commit shows your message
3. Browse to a few files to confirm they uploaded (e.g., `src/pages/clinical/ClinicalWorkspacePage.tsx`)

---

## PHASE 4: Railway Auto-Deploys Backend (5 minutes)

### Step 10: Monitor Railway Deployment

1. Go to [railway.app](https://railway.app)
2. Click your AMOS-OPS project
3. Watch the deployment progress
4. Wait for status: **"Healthy"** (green dot)

**If deployment fails:**
1. Click the failed deployment
2. Check **"Deploy Logs"** for errors
3. Common fixes:
   - "module not found" → Run `npm install` locally, commit `package-lock.json`, push again
   - "JWT_SECRET too weak" → Add a strong JWT_SECRET to Railway environment variables
   - "database error" → Continue to Phase 5 (migrations)

### Step 11: Run Database Migrations

Once Railway shows "Healthy":

1. Railway Dashboard → Your service → **Shell** tab
2. Run migrations:
```bash
npx drizzle-kit push
```
3. You should see output like: `Tables created: workflow_definitions_v2, workflow_instances_v2, ...`

### Step 12: Seed New Data

Still in Railway Shell:
```bash
npx tsx db/seed.ts
```

This seeds:
- 8 workflow definitions
- 21 workflow instances (3 pilot cases)
- 13 agent personas
- 36 KPI baseline data

**To verify seed worked:**
```bash
sqlite3 /app/db/amos-ops.db "SELECT COUNT(*) FROM workflow_definitions_v2;"
# Should return: 8

sqlite3 /app/db/amos-ops.db "SELECT COUNT(*) FROM agent_personas;"
# Should return: 13
```

---

## PHASE 5: Netlify Auto-Deploys Frontend (5 minutes)

### Step 13: Monitor Netlify Deployment

1. Go to [netlify.com](https://netlify.com)
2. Click your AMOS-OPS site
3. Go to **Deploys** tab
4. You should see a new deploy in progress (triggered by Git push)
5. Wait for **"Published"** status

### Step 14: Update Netlify Environment Variable

1. Netlify → Your site → **Site configuration** → **Environment variables**
2. Add/update:
   - `VITE_API_URL` = `https://YOUR-RAILWAY-URL.up.railway.app`
3. This tells the frontend where to find the backend API

### Step 15: Trigger Redeploy

1. Netlify → **Deploys** → **Trigger deploy** → **Clear cache and retry**
2. Wait for "Published"

---

## PHASE 6: Verify Everything Works (10 minutes)

### Checklist: Open your Netlify URL and verify:

| # | Check | How |
|---|-------|-----|
| 1 | **Site loads** | Netlify URL shows login page |
| 2 | **Login works** | Use existing credentials |
| 3 | **Dashboard loads** | `/` shows 36 KPI cards |
| 4 | **Navigation is 7 sections** | Sidebar shows: Operations, Compliance, Reports, HR, Workforce Activation, Workforce Management, Admin |
| 5 | **Clinical workspace works** | `/clinical` shows 5 quick action buttons |
| 6 | **GRO workspace works** | `/gro` shows 5 quick action buttons |
| 7 | **My Work Today works** | `/workflows` shows task list |
| 8 | **API calls succeed** | Browser F12 → Network tab → no red (5xx) errors |
| 9 | **No 404s on major routes** | Click through main navigation items |
| 10 | **Help panel visible** | Floating "?" button bottom-right corner |

### If Something Is Broken

**Frontend issue (Netlify):**
- Check Netlify deploy logs for build errors
- Verify `netlify.toml` has correct Railway URL
- Check browser console (F12) for JavaScript errors

**Backend issue (Railway):**
- Check Railway deploy logs
- Check Railway runtime logs (Shell → `pm2 logs` or `journalctl`)
- Verify database migrations ran successfully
- Check `api/health` endpoint

---

## ROLLBACK PLAN (If Everything Breaks)

### Option 1: Fast Rollback via Railway/Netlify (2 minutes)

**Railway:**
1. Railway Dashboard → Deployments
2. Find the deployment BEFORE your latest one
3. Click the three dots → **"Redeploy"**

**Netlify:**
1. Netlify Dashboard → Deploys
2. Find the deploy BEFORE your latest one
3. Click **"Publish deploy"**

### Option 2: Git Rollback via GitHub Desktop (2 minutes)

1. GitHub Desktop → **History** tab
2. Find the commit BEFORE your sprint deploy
3. Right-click → **"Revert this commit"**
4. Click **"Push origin"**

This will undo ALL the sprint changes.

### Option 3: Restore Database (5 minutes)

1. Railway Dashboard → Database → Backups
2. Find your pre-deploy backup: `pre-sprint-deploy-2026-07-05`
3. Click **Restore**

---

## FILE SUMMARY FOR COPY-PASTE

If you want to do this file-by-file, here's the exact list in order:

### Priority 1: Must copy (breaks without these)
```
src/data/navData.ts
src/hooks/useAuth.tsx
src/components/shell/AppShell.tsx
src/components/shell/AppShellRoutes.tsx
src/components/shell/AppSidebar.tsx
api/router.ts
api/middleware.ts
db/schema.ts
db/relations.ts
```

### Priority 2: New features (copy all)
```
src/pages/workflows/WorkflowsPage.tsx
src/pages/analytics/AnalyticsPage.tsx
src/pages/knowledge/KnowledgePage.tsx
src/components/agents/
src/components/workflows/
src/components/help/
src/components/sentinel/
```

### Priority 3: Department pages (copy all)
```
src/pages/clinical/*.tsx (overwrite existing)
src/pages/gro/*.tsx (overwrite existing)
src/pages/qa/*.tsx (overwrite existing)
src/pages/revenue/*.tsx (overwrite existing)
src/pages/hr/*.tsx (overwrite existing)
src/pages/exec/*.tsx (overwrite existing)
src/pages/admin/*.tsx
src/pages/gad/*.tsx
```

### Priority 4: Backend routers (copy all)
```
api/routers/*.ts (overwrite ALL 47 files)
```

### Priority 5: Database + docs (copy)
```
db/seed.ts
db/migrations/
db/seed-case2*
docs/
ENCRYPTION.md
```

### Priority 6: Deployment config
```
Dockerfile
netlify.toml (EDIT Railway URL first)
railway.toml
railway.json
.github/workflows/
.env.example
```

---

## TROUBLESHOOTING

### "Too many files to copy"

Instead of copying folder-by-folder, do this:

```bash
# In Command Prompt, run this ONE command to copy everything:
# (Replace paths with your actual paths)

xcopy "C:\Users\YOU\Downloads\deploy\*" "C:\Users\YOU\Desktop\AMOS-OPS-SPRINT-UPDATE\CURRENT_REPO\" /E /Y /I
```

This copies ALL files from the extracted ZIP into your repo in one go.

Then use GitHub Desktop to review what changed before committing.

### "GitHub Desktop shows thousands of changes"

This is normal. The sprint touched ~150 files. Review the changes list — if you see unexpected deletions, you may have missed copying some folders.

### "Railway build fails"

1. Check Railway deploy logs for the exact error
2. Most common: missing dependency → add to package.json
3. Send me the error message and I'll tell you the fix

### "Database migration fails"

1. Check if migration already ran: `npx drizzle-kit status`
2. If stuck: backup DB, delete migration record, re-run
3. Or: restore from backup, start fresh

### "Frontend loads but API calls fail"

1. Open browser F12 → Network tab
2. Look for red/failed requests
3. Check the URL — is it pointing to Railway?
4. Verify `VITE_API_URL` in Netlify environment variables
5. Verify `FRONTEND_URL` in Railway environment variables
6. Check CORS: both must reference each other's URLs exactly

---

## NEED HELP?

If you get stuck at any step:
1. Tell me which step number you're on
2. Tell me the exact error message
3. I'll give you the specific fix

DO NOT push broken code to main — use GitHub Desktop to review changes before every commit.
