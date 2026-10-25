# ZKCommerce — Local Desktop Setup Guide
# Get the full platform running on your Windows PC in 15 minutes

---

## What you need installed first

| Tool | Download | Why |
|------|----------|-----|
| Node.js 20 LTS | nodejs.org/en/download | Runs the API server |
| Git | git-scm.com | Version control |
| VS Code | code.visualstudio.com | Code editor (optional) |
| PowerShell 7 | Already on Windows 10/11 | Run commands |

---

## Step 1 — Extract the project

Unzip `zkcommerce-v4-complete.zip` to:
```
D:\ZKCommerce\zkc-build\
```

Open PowerShell and navigate there:
```powershell
cd "D:\ZKCommerce\zkc-build"
```

---

## Step 2 — Install dependencies

```powershell
npm install
```

This installs all packages (takes 2–3 minutes first time).

---

## Step 3 — Create your .env file

Copy the example:
```powershell
copy .env.example .env
```

Open `.env` in Notepad or VS Code and set:
```
NODE_ENV=development
PORT=3000

# Your Neon database URL (from neon.tech dashboard)
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-rice-axslvoko.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require

# Generate a secret: open PowerShell and run:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=PASTE_YOUR_64_CHAR_SECRET_HERE

# Razorpay test keys (get from razorpay.com → Settings → API Keys)
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY
RAZORPAY_KEY_SECRET=YOUR_SECRET
```

---

## Step 4 — Run the database migration

This creates all 43 tables in Neon:
```powershell
node deployment/scripts/neon-migrate.js
```

Expected output:
```
✅ Connected to Neon database
✅ Running migration...
✅ 43 tables created
✅ Seed data inserted
✅ Migration complete
```

If you see an error about KEY= prefix, pass the URL directly:
```powershell
node deployment/scripts/neon-migrate.js "postgresql://neondb_owner:PASS@host/neondb?sslmode=require"
```

---

## Step 5 — Start the API server

```powershell
npm run dev
```

Expected output:
```
[ZKCommerce] API running on port 3000
[ZKCommerce] Database connected ✅
[ZKCommerce] Environment: development
```

Keep this PowerShell window open — it's your API server.

---

## Step 6 — Open the frontend

**Option A — Double-click (simplest)**
Open File Explorer → `D:\ZKCommerce\zkc-build\auth\login.html`
Double-click to open in browser.

**Option B — Local web server (recommended)**
Open a NEW PowerShell window:
```powershell
cd "D:\ZKCommerce\zkc-build"
npx serve . -p 8080
```
Then open: http://localhost:8080/auth/login.html

---

## Step 7 — Login and test

Use these local demo accounts (password: **demo1234** for the demo merchants; register the admin email first and choose its password, then run `database/seed.sql` to grant the admin role):

| Role | Email | What you can do |
|------|-------|-----------------|
| Admin | admin@zkcommerce.in | Platform dashboard, all merchants |
| Merchant | merchant@miliro.in | Store Builder: Miliro |
| Merchant | merchant@smeramnaturals.in | Store Builder: Smeram Naturals |

Open `http://localhost:3000/admin/dashboard.html` for platform store review. Demo stores start in draft status; use Store Builder or the admin preview to inspect them before publishing.

---

## What you'll see

| URL | Page |
|-----|------|
| /auth/login.html | Merchant login |
| /merchant/dashboard.html | Store dashboard |
| /admin/dashboard.html | Admin panel |
| /storefront/home.html | Customer storefront |
| /theme-1-dark.html | Dark marketing theme |
| /theme-2-light.html | Light marketing theme |
| /theme-3-gradient.html | Gradient marketing theme |

---

## API test (verify server is working)

In your browser or Postman:
```
GET http://localhost:3000/health
→ {"status":"ok","db":"connected","version":"4.2.0"}
```

---

## Troubleshooting

**"Cannot find module" error**
```powershell
npm install
```

**"EADDRINUSE port 3000"** — port already in use
```powershell
# Find what's using port 3000
netstat -ano | findstr :3000
# Kill it (replace PID with the number shown)
taskkill /PID 12345 /F
```

**"SSL connection failed"** — Neon URL missing ?sslmode=require
Make sure your DATABASE_URL ends with `?sslmode=require`

**Page shows "API error"** — API server not running
Make sure `npm run dev` is running in a PowerShell window

**"fetch failed" on file://** — open via serve instead
Use `npx serve . -p 8080` and http://localhost:8080

---

## npm commands reference

```powershell
npm run dev              # Start API (auto-restart on changes)
npm start                # Start API (production mode)
npm run db:migrate       # Run database migration
npm run health:dev       # Check all services status
```

---

## Quick 5-command setup (copy-paste)

```powershell
cd "D:\ZKCommerce\zkc-build"
npm install
copy .env.example .env
# Edit .env with your Neon URL and JWT secret, then:
node deployment/scripts/neon-migrate.js
npm run dev
```

Open browser: http://localhost:8080/auth/login.html
(in second terminal: `npx serve . -p 8080`)
