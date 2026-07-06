# AMOS-OPS Deployment Guide
## Sprint Complete — 143 Tasks Done
## Date: 2026-07-05

---

## What You Need

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| npm | 10+ |
| SQLite | 3+ (embedded, no separate install needed) |

---

## Step 1: Install Dependencies

```bash
cd codebase/
npm install
```

> If you get peer dependency warnings, use: `npm install --legacy-peer-deps`

---

## Step 2: Set Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and set at least these:

```env
# REQUIRED: Strong JWT secret (min 32 chars, random generated)
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-strong-generated-secret-here-min-32-chars

# Database (SQLite — embedded, no separate server)
DATABASE_URL=file:./amos-ops.db

# App URL
APP_URL=http://localhost:5173

# Microsoft Graph (optional — can run without MS integration)
MS_GRAPH_TENANT_ID=your-tenant-id
MS_GRAPH_CLIENT_ID=your-client-id
MS_GRAPH_CLIENT_SECRET=your-client-secret
```

> The app will **refuse to start** with a weak JWT_SECRET in production mode.

---

## Step 3: Initialize Database

```bash
npm run db:push
# or
npx drizzle-kit push
```

This creates all tables defined in `db/schema.ts`.

---

## Step 4: Seed Data (Optional but Recommended)

```bash
npm run db:seed
```

This seeds:
- 8 workflow definitions (WF-001 through WF-008)
- 21 workflow instances (3 pilot cases + 18 sample)
- 13 agent personas (6 pilot + 7 deferred)
- 36 KPI baseline data
- Sample patients, clinical sessions, HR data

---

## Step 5: Build for Production

```bash
npm run build
```

This produces:
- `dist/` — Frontend (React app)
- `dist-server/` — Backend (Hono API server)

---

## Step 6: Start the Application

### Development Mode (hot reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The app will be available at `http://localhost:5173`

---

## Default Login

After seeding, use these credentials:

| Role | Username | Password |
|------|----------|----------|
| Super Admin | admin | Admin123! |
| Clinical Director | clinical | Clinical123! |
| GRO Administrator | gro-admin | GroAdmin123! |
| QA Coordinator | qa | QA123! |
| HR Director | hr-director | HRDirector123! |

> **IMPORTANT:** Change default passwords immediately after first login.

---

## What Was Built (Sprint Summary)

| Stage | Tasks | Key Deliverables |
|-------|-------|-----------------|
| Stage 0 | Inventory | 9 files audited, 6 routers secured |
| Stage 1 | Cleanup | Route fixes, nav rewrite, auth security |
| Stage 2A | Foundation | 7-section sidebar, 28 routes, role-based access |
| Stage 2B | Work Queue + DMS | MyWorkToday workspace, document lifecycle |
| Stage 2C | Workflows | 8 workflows, 64 endpoints, 21 instances |
| Stage 2D | Personas + Workspaces | Clinical + GRO frontline workspaces |
| Stage 3 | Departments | 7 departments, 50+ features, 36 KPIs |
| Stage 4 | Security | Password complexity, PHI enforcement, encryption strategy |
| Stage 5 | ICR + RC | 5 ICR entries, 15 RC decisions |

**Total: 143 tasks completed. Zero remaining.**

---

## Troubleshooting

### Build fails with "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Database errors
```bash
rm -f amos-ops.db
npm run db:push
npm run db:seed
```

### Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Or change port in .env
```

### Weak JWT_SECRET error in production
Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## File Manifest (Key Files)

| File | Purpose |
|------|---------|
| `src/pages/DashboardPage.tsx` | Main dashboard with 36 KPIs |
| `src/pages/clinical/ClinicalWorkspacePage.tsx` | BHC clinical frontline workspace |
| `src/pages/gro/GROWorkspacePage.tsx` | GRO residential frontline workspace |
| `src/pages/workflows/MyWorkTodayPage.tsx` | Work queue workspace |
| `src/data/navData.ts` | 7-section sidebar navigation |
| `api/router.ts` | tRPC router registration |
| `api/middleware.ts` | Auth + PHI + boundary enforcement |
| `db/schema.ts` | Database schema (all tables) |
| `docs/icr/ICR-REGISTRY.md` | Interface Contract Registry |
| `docs/RC-DECISION-LOG.md` | RC integration decisions |
| `ENCRYPTION.md` | Encryption at rest strategy |
| `TASK_REGISTRY.md` | Complete task registry (all DONE) |

---

## Support

For issues or questions, reference:
- `TASK_REGISTRY.md` — full task list with acceptance criteria
- `ENCRYPTION.md` — security implementation guide
- `docs/icr/ICR-REGISTRY.md` — API contracts
- `docs/RC-DECISION-LOG.md` — integration decisions
