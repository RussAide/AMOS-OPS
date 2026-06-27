# AMOS-OPS Deployment Guide

## Architecture Overview

```
                    User Browser
                         |
           +-------------+-------------+
           |                           |
     Static Frontend            Backend API
   (CDN / Kimi Platform)      (Docker / VPS)
   amos-ops.kimi.page         api.yourdomain.com
           |                           |
     React + Vite               Hono + tRPC
     Tailwind + shadcn          Drizzle ORM
     HashRouter                 SQLite
     Static files               JWT Auth
                                File Uploads
```

## Option A: Static-Only Demo (Already Deployed)

**URL**: https://b3lhsdt5d4f62.kimi.page

This is the frontend-only version with in-memory data. No backend required.
Works for demos and presentations but has no data persistence.

### What's Available in Demo Mode
- All 116 training modules across 9 tracks
- HR Lifecycle with 25 sample people
- Role switching (8 roles)
- Document tracking (sample data)
- Notification panel (demo data)
- Workflow rules display
- Analytics dashboard (sample data)

### What's NOT Available in Demo Mode
- User login / authentication
- Database persistence
- File upload / storage
- Auto-generated notifications
- Real-time data updates

---

## Option B: Docker Deployment (Recommended)

### Prerequisites
- Docker 20+ and docker-compose
- A server with 1GB RAM minimum
- Ports 3000 (backend) and 80/443 (proxy) available

### Step 1: Build the Backend

```bash
# From the project root
cd /path/to/amos-ops

# Build both frontend and backend
npm run build

# This creates:
# - dist/public/   (static frontend)
# - dist/boot.js   (backend server)
```

### Step 2: Deploy with Docker Compose

```bash
# Set your secrets
cp .env.production .env
# Edit .env with your production values:
# - JWT_SECRET: generate with `openssl rand -hex 32`
# - APP_SECRET: any random string

# Start the backend
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f amos-backend
```

The backend API will be available at `http://your-server:3000`.

### Step 3: Verify Backend Health

```bash
curl http://localhost:3000/api/trpc/ping
# Expected: {"result":{"data":{"ok":true,"ts":...}}}
```

### Step 4: Seed the Database (First Run Only)

```bash
# Run the seed script inside the container
docker-compose exec amos-backend npx tsx db/seed.ts
```

### Step 5: Configure Frontend to Use Backend

Edit the frontend API URL in `src/providers/trpc.tsx`:

```typescript
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "https://api.yourdomain.com/api/trpc",  // Your backend URL
      // ... rest unchanged
    }),
  ],
});
```

Then rebuild and redeploy the static frontend.

---

## Option C: VPS / Bare Metal Deployment

### Prerequisites
- Node.js 20+ LTS
- npm or yarn
- PM2 or systemd for process management

### Step 1: Install Dependencies

```bash
git clone <your-repo-url> /opt/amos-ops
cd /opt/amos-ops
npm ci
```

### Step 2: Build

```bash
npm run build
```

### Step 3: Configure Environment

```bash
cp .env.production .env
# Edit .env with production values
```

### Step 4: Create Systemd Service

Create `/etc/systemd/system/amos-ops.service`:

```ini
[Unit]
Description=AMOS-OPS Backend
After=network.target

[Service]
Type=simple
User=amos
WorkingDirectory=/opt/amos-ops
ExecStart=/usr/bin/node dist/boot.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_PATH=/opt/amos-ops/data/amos-ops.db
Environment=JWT_SECRET=your-secret-here

[Install]
WantedBy=multi-user.target
```

### Step 5: Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable amos-ops
sudo systemctl start amos-ops

# Check status
sudo systemctl status amos-ops
```

### Step 6: Configure Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Large file uploads
    client_max_body_size 50M;
}
```

---

## Option D: Railway / Render / Fly.io (Platform-as-a-Service)

### Railway

1. Push code to GitHub
2. Connect Railway to repo
3. Set environment variables in Railway dashboard
4. Railway auto-detects Dockerfile and deploys

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Set:
   - Build Command: `npm ci && npm run build`
   - Start Command: `node dist/boot.js`
4. Add environment variables
5. Add disk for persistent storage (SQLite + uploads)

### Fly.io

```bash
# Install flyctl
# Login
fly auth login

# Launch
fly launch --name amos-ops

# Set secrets
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly secrets set APP_SECRET=$(openssl rand -hex 16)

# Create persistent volume for data
fly volumes create amos_data --size 1

# Deploy
fly deploy
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Set to `production` |
| `PORT` | No | `3000` | Server port |
| `DATABASE_PATH` | No | `amos-ops.db` | SQLite file path |
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `APP_ID` | No | `amos-ops` | Application ID |
| `APP_SECRET` | No | - | Application secret |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trpc/ping` | GET | Health check |
| `/api/trpc/auth.login` | POST | User login |
| `/api/trpc/auth.register` | POST | User registration |
| `/api/trpc/auth.me` | GET | Current user |
| `/api/trpc/hr.listPeople` | GET | List all people |
| `/api/trpc/hr.createPerson` | POST | Create person |
| `/api/trpc/hr.setModuleStatus` | POST | Update module status |
| `/api/trpc/documents.list` | GET | List documents |
| `/api/trpc/documents.create` | POST | Create document record |
| `/api/upload` | POST | File upload (multipart) |
| `/uploads/:filename` | GET | File download |

---

## Security Checklist

- [ ] Change `JWT_SECRET` to a cryptographically secure random string
- [ ] Change `APP_SECRET` from default
- [ ] Enable HTTPS (nginx/traefik/caddy)
- [ ] Restrict CORS to your frontend domain
- [ ] Set up firewall rules (ufw/aws security groups)
- [ ] Enable automated backups for SQLite database
- [ ] Configure log rotation
- [ ] Set up monitoring (uptime alerts)
- [ ] Run database migrations on first deploy

---

## Backup Strategy

### SQLite Database
```bash
# Automated daily backup via cron
0 2 * * * cp /opt/amos-ops/data/amos-ops.db /opt/amos-ops/backups/amos-ops-$(date +\%Y\%m\%d).db
```

### Uploaded Files
```bash
# Sync uploads to S3 or backup server
rsync -avz /opt/amos-ops/uploads/ backup-server:/backups/amos-ops/uploads/
```

---

## Troubleshooting

### Port already in use
```bash
lsof -ti:3000 | xargs kill -9
```

### Database locked
```bash
# SQLite WAL mode should prevent this, but if needed:
sqlite3 data/amos-ops.db "PRAGMA wal_checkpoint;"
```

### Frontend can't reach backend
- Check CORS configuration
- Verify backend URL in `src/providers/trpc.tsx`
- Check network tab in browser dev tools
- Ensure backend health check passes: `curl /api/trpc/ping`

### File uploads fail
- Check `client_max_body_size` in nginx (min 50M)
- Verify uploads directory exists and is writable
- Check disk space

---

## Quick Start Commands

```bash
# Full deploy with Docker (recommended)
docker-compose up -d

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Update (after code changes)
git pull && npm run build && docker-compose up -d --build

# Stop
docker-compose down
```
