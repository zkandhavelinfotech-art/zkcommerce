# ZKCommerce v4.1 -- Enterprise Deployment Guide

## Technology Stack
| Layer | Technology | Version | Provider |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | - |
| Framework | Express.js | 4.x | - |
| Database | PostgreSQL | 15 | Neon (cloud) / local |
| Cache | Redis | 7 | Upstash (cloud) / local |
| Frontend | Static HTML | - | Vercel |
| Container | Docker | 24+ | Railway |
| CDN | Cloudflare | - | Cloudflare |
| Storage | Cloudflare R2 | - | Cloudflare |
| Email | Resend | - | Resend |
| Payments | Razorpay | - | Razorpay |
| WhatsApp | Gupshup | - | Gupshup |
| Monitoring | Sentry | - | Sentry |
| CI/CD | GitHub Actions | - | GitHub |

---

## Deployment Manager

The Deployment Manager is at `deployment/launcher`.

### Usage

```bash
# From project root
node deployment/launcher <command> [environment]
```

### Commands

| Command | What it does |
|---|---|
| `start development` | Start API with nodemon (hot reload) |
| `health development` | Full health check: DB, API, env, files |
| `deploy staging` | Health check + migrate + start |
| `db:create development` | Create PostgreSQL database |
| `db:migrate development` | Run all SQL migration files |
| `db:backup production` | Backup DB to deployment/backups/ |
| `db:reset development` | Drop + recreate + migrate |
| `db:status production` | Row counts + connection status |
| `status development` | Check PostgreSQL, Redis, API status |
| `build` | Build production Docker image |
| `logs` | Tail deployment logs |

---

## Environments

### Development (localhost)

**Prerequisites:** Node.js 20, PostgreSQL 15, Git

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env -- set DATABASE_URL with your PostgreSQL password

# 3. Create and migrate database
node deployment/launcher db:create development
node deployment/launcher db:migrate development

# 4. Health check
node deployment/launcher health development

# 5. Start
node deployment/launcher start development
# or simply: npm run dev

# 6. Verify
# Browser: http://localhost:3000/health
```

**Expected output:**
```
ZKCommerce API v4.1 running on port 3000
Database: Connected
```

---

### Staging (Railway + Vercel + Neon)

**Prerequisites:** Railway account, Vercel account, Neon account, GitHub repo

```bash
# Step 1: Create Neon database
# Go to neon.tech -> New Project -> Region: ap-south-1
# Copy connection string

# Step 2: Run migration on Neon
DATABASE_URL="your-neon-url" node deployment/launcher db:migrate staging

# Step 3: Deploy API to Railway
railway login
railway init
railway up

# Add env vars in Railway dashboard:
# DATABASE_URL, JWT_SECRET, RAZORPAY_KEY_ID, etc.

# Step 4: Deploy frontend to Vercel
vercel --prod

# Step 5: Health check
node deployment/launcher health staging
```

**Staging environment variables (Railway dashboard):**
See `deployment/environments/.env.staging` for full list.
Never paste real values in files -- set them in the Railway dashboard only.

---

### Production (Railway + Vercel + Neon + Cloudflare)

**Prerequisites:** All staging prerequisites + Razorpay KYC approved + domain

```bash
# CHECKLIST before production deploy:
# [ ] Razorpay live keys received (KYC approved)
# [ ] Gupshup WhatsApp API key + templates approved
# [ ] Resend email configured with verified domain
# [ ] Cloudflare R2 bucket created
# [ ] Neon production project created (ap-south-1)
# [ ] Domain zkcommerce.in in Cloudflare
# [ ] Security audit completed
# [ ] Load test passed (100 concurrent checkouts)
# [ ] Sentry DSN configured

# Deploy
node deployment/launcher deploy production

# Run health check post-deploy
node deployment/launcher health production
```

---

## Docker

### Local Development with Docker

```bash
# Start all services (PostgreSQL + Redis + API)
cd deployment/docker
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all
docker-compose down

# Reset (remove volumes)
docker-compose down -v
```

### Production Docker Build

```bash
# Build
docker build -f deployment/docker/Dockerfile.production -t zkcommerce-api:latest .

# Run
docker run -d \
  --name zkc-api \
  -p 3000:3000 \
  --env-file deployment/environments/.env.production \
  zkcommerce-api:latest

# Health check
curl http://localhost:3000/health
```

---

## Database

### Migration order (always this order)

```bash
# 1. Master (all 36 tables, seed data)
psql $DATABASE_URL -f database/zkcommerce-master.sql

# 2. Additions (functions, views, sequences from phase1+2)
psql $DATABASE_URL -f database/zkcommerce-additions.sql
```

### Backup

```bash
# Manual backup
node deployment/launcher db:backup production

# Or use the shell script directly
bash deployment/backups/backup.sh production

# Windows
deployment\backups\backup-windows.bat production
```

Backups are saved to `deployment/backups/` with timestamp.
Retention policy: last 14 backups kept automatically.

### Restore

```bash
psql $DATABASE_URL < deployment/backups/zkcommerce-production-TIMESTAMP.sql
```

---

## CI/CD Pipeline

The pipeline is at `.github/workflows/deploy.yml`.

### Flow

```
Push to staging branch
  -> test (PostgreSQL service + migration + health check)
  -> security (npm audit)
  -> build (Docker image -> GitHub Container Registry)
  -> deploy-staging (Railway)

Push to main branch
  -> test + security + build
  -> deploy-production (Railway API + Vercel frontend)
```

### Required GitHub Secrets

| Secret | Value |
|---|---|
| `RAILWAY_TOKEN_STAGING` | Railway staging service token |
| `RAILWAY_TOKEN_PRODUCTION` | Railway production service token |
| `VERCEL_TOKEN` | Vercel deployment token |

---

## Monitoring

### Sentry Setup

```bash
npm install @sentry/node

# Add to .env (Railway dashboard for production):
SENTRY_DSN=https://your-key@sentry.io/your-project-id
```

The `deployment/monitoring/sentry.js` module is already integrated.
It safely redacts passwords and secrets before sending to Sentry.

### Log files

| File | Content |
|---|---|
| `deployment/logs/database.log` | DB operations, migrations, backups |
| `deployment/logs/backup.log` | Backup history |
| `deployment/logs/health.log` | Health check results |

---

## Nginx (self-hosted)

Copy config to server:
```bash
sudo cp deployment/nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

SSL certificates go in `deployment/certificates/`:
- `fullchain.pem`
- `privkey.pem`

Get free SSL with Certbot:
```bash
sudo certbot certonly --nginx -d api.zkcommerce.in -d zkcommerce.in
```

---

## Release Versions

| Version | Status | Notes |
|---|---|---|
| v4.0 | Complete | 48 pages, 83 API routes, DB schema |
| v4.1 | In progress | Wiring pages to API + deployment |
| v5.0 | Q4 2026 | Instagram shop, abandoned cart WA, blog, Tally |
| v6.0 | 2027 | Multi-language, Amazon/Flipkart, POS |

---

*ZKCommerce v4.1 -- ZKanadavel Infotech Pvt Ltd & ZK Infotech INC*
