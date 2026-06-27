# AMOS-OPS Deployment Guide

## Architecture

```
                    +------------------+
                    |     Users        |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+       +-----------v----------+
    |    Netlify        |       |     Railway          |
    |  (Frontend SPA)   |       |   (Backend API)      |
    |  dist/public/     |       |  dist/boot.js        |
    |  Port: n/a        |       |  Port: 3000          |
    +---------+---------+       +-----------+----------+
              |                             |
              |  /api/*  +------>  /api/trpc/*
              |  (proxy) |       (tRPC + SQLite)
              |          |
              +----------v-----------+
                         |
               +---------v----------+
               |   amos-ops.db      |
               |   (SQLite/WAL)     |
               +--------------------+
```

## Prerequisites

- GitHub account
- Railway account (railway.app)
- Netlify account (netlify.com)
- Node.js 20+ (local development)

## Step 1: Push to GitHub

```bash
cd /path/to/amos-ops
git init
git add .
git commit -m "AMOS-OPS v1.0 ready for deploy"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/amos-ops.git
git push -u origin main
```

## Step 2: Railway Backend Deployment

### 2.1 Create Project

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your `amos-ops` repository
5. Railway auto-detects the Dockerfile

### 2.2 Configure Environment Variables

Go to Project → Variables and add:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | `3000` | Yes |
| `DATABASE_PATH` | `/app/data/amos-ops.db` | Yes |
| `JWT_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Yes |
| `APP_ID` | `amos-ops` | Optional |
| `APP_SECRET` | Any strong random string | Optional |

### 2.3 Add Persistent Volume

1. Go to Project → Your Service → Settings
2. Scroll to **Volumes**
3. Click **Add Volume**
4. Mount path: `/app/data`
5. Size: 1GB (can scale later)

### 2.4 Deploy

1. Click **Deploy** (or push to main branch for auto-deploy)
2. Wait for build to complete (~2-3 minutes)
3. Click the generated domain to verify: `https://your-app.up.railway.app/api/trpc/ping`
4. Should return: `{ "ok": true, "ts": ... }`

### 2.5 Seed the Database (First Time Only)

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | bash

# Login
railway login

# Link to project
railway link

# Open a shell to the running container
railway shell

# Inside the container, seed data:
node -e "
const sqlite = require('better-sqlite3');
const db = new sqlite('/app/data/amos-ops.db');
// Run the seed script contents here
console.log('Database seeded');
"
```

Or use the **Seed Admin** button in the UI after first deploy.

## Step 3: Netlify Frontend Deployment

### 3.1 Update API Proxy URL

Edit `netlify.toml` and replace the Railway URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-RAILWAY-APP.up.railway.app/api/:splat"
  status = 200
```

### 3.2 Connect to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click **Add new site** → **Import an existing project**
3. Select **GitHub** → Choose `amos-ops` repo
4. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist/public`
5. Click **Deploy site**

### 3.3 Configure Environment (Optional)

If you want the frontend to connect directly to Railway without the proxy:

1. Go to Site → Configuration → Environment variables
2. Add: `VITE_API_URL=https://your-railway-app.up.railway.app`
3. Update `src/providers/trpc.tsx` to use `import.meta.env.VITE_API_URL`

### 3.4 Verify

1. Visit your Netlify URL: `https://your-site.netlify.app`
2. Should redirect to `/login`
3. Create admin account → Log in → All modules visible

## Step 4: Post-Deployment Checklist

### 4.1 First Login

1. Visit your Netlify URL
2. Click **"Create Default Admin Account"**
3. Log in with `admin@adolbi.com` / `admin123`
4. Navigate to all modules to verify

### 4.2 Verify API Endpoints

```bash
# Health check
curl https://YOUR-RAILWAY.up.railway.app/api/trpc/ping

# Auth test
curl -X POST https://YOUR-RAILWAY.up.railway.app/api/trpc/auth.seedAdmin

# Protected endpoint (should fail without auth)
curl https://YOUR-RAILWAY.up.railway.app/api/trpc/nil.getStats

# With auth
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR-RAILWAY.up.railway.app/api/trpc/nil.getStats
```

### 4.3 Enable Auto-Deploy

**Railway:** Auto-deploys on every push to `main` (enabled by default)
**Netlify:** Auto-deploys on every push to `main` (enabled by default)

## Troubleshooting

### Issue: "Database locked" errors
**Fix:** Ensure only one Railway instance is running. SQLite doesn't support concurrent writes across instances.

### Issue: "Cannot find module" on Railway
**Fix:** Check that `npm run build` succeeds locally. The Dockerfile runs this during the build stage.

### Issue: Frontend shows "API Error"
**Fix:** 
1. Check Railway service is running
2. Verify `netlify.toml` proxy URL matches Railway domain
3. Check browser dev tools → Network for 404s

### Issue: Sessions lost on restart
**Fix:** Ensure `/app/data` volume is mounted. Sessions are stored in SQLite which is on the volume.

## Security Recommendations

1. **Change JWT_SECRET** immediately after first deploy
2. **Change admin password** after first login
3. **Enable HTTPS only** (both Railway and Netlify do this by default)
4. **Set up database backups** (Railway volume snapshots or manual export)
5. **Restrict CORS** in production by updating `api/boot.ts`

## Backup & Restore

### Backup SQLite Database
```bash
# From Railway shell
sqlite3 /app/data/amos-ops.db ".backup /app/data/backup-$(date +%Y%m%d).db"

# Download the backup
railway ssh
cat /app/data/backup-20250101.db > backup.db
```

### Restore
```bash
# Upload backup to Railway volume
railway ssh
cat backup.db | sqlite3 /app/data/amos-ops.db ".restore -"
```
