# ZKCommerce v4.1 — Local Development Setup
## Step-by-step guide to run on your laptop (Mac / Windows / Linux)

---

## Prerequisites — What you need installed

| Tool | Version | Why needed | Download |
|---|---|---|---|
| Node.js | 20+ (LTS) | Runs the API server | nodejs.org |
| npm | 10+ (comes with Node) | Installs packages | (with Node) |
| PostgreSQL | 15+ | Database | postgresql.org |
| Git | Any | Clone/manage code | git-scm.com |
| VS Code | Any | Edit code (recommended) | code.visualstudio.com |

**Optional but recommended:**
| Tool | Why | Download |
|---|---|---|
| pgAdmin 4 | GUI to view your database | pgadmin.org |
| Postman | Test API routes | postman.com |

---

## PART 1 — Install required tools

### Step 1 — Install Node.js 20

**Mac:**
```bash
# Option A — download installer (easiest)
# Go to https://nodejs.org → click "20.x LTS" → download .pkg → run installer

# Option B — using Homebrew
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows:**
```
1. Go to https://nodejs.org
2. Click "20.x LTS" — download the .msi installer
3. Run installer — tick "Add to PATH" checkbox
4. Restart Command Prompt / PowerShell after install
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify install:**
```bash
node --version   # should show v20.x.x
npm --version    # should show 10.x.x
```

---

### Step 2 — Install PostgreSQL 15

**Mac:**
```bash
# Option A — Postgres.app (easiest for Mac, GUI included)
# Go to https://postgresapp.com → download → drag to Applications → Open
# Click "Initialize" → database is running

# Option B — Homebrew
brew install postgresql@15
brew services start postgresql@15
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows:**
```
1. Go to https://www.postgresql.org/download/windows/
2. Click "Download the installer" → pick version 15
3. Run installer:
   - Port: 5432 (default — keep it)
   - Password: set a password you will remember (e.g. zkcommerce123)
   - Locale: default
4. Untick "Stack Builder" at the end (not needed)
5. PostgreSQL is now running as a Windows service
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Verify install:**
```bash
psql --version    # should show psql (PostgreSQL) 15.x
```

---

### Step 3 — Install Git (if not already installed)

**Mac:** Git comes pre-installed. Verify: `git --version`

**Windows:**
```
Go to https://git-scm.com/download/win
Download and run the installer (all defaults are fine)
```

**Linux:**
```bash
sudo apt install -y git
```

---

## PART 2 — Project setup

### Step 4 — Get the project files

**Option A — From the ZIP file you downloaded:**
```bash
# Mac / Linux
cd ~/Desktop
unzip zkcommerce-v4-complete.zip
cd zkc-build

# Windows (PowerShell)
cd $env:USERPROFILE\Desktop
Expand-Archive zkcommerce-v4-complete.zip -DestinationPath .
cd zkc-build
```

**Option B — If you have a Git repository:**
```bash
git clone https://github.com/your-org/zkcommerce.git
cd zkcommerce
```

---

### Step 5 — Install Node.js packages

```bash
# Inside the zkc-build folder:
npm install
```

This installs all 14 packages: express, bcryptjs, jsonwebtoken, pg, razorpay, zod, helmet, cors, multer, nodemailer, passport, etc.

Expected output: `added 187 packages` (no errors)

**If you see errors:**
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

### Step 6 — Create your .env file

```bash
# Mac / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Now open `.env` in VS Code and fill in these values:

```env
# ── REQUIRED for local dev ──────────────────────────────────
PORT=3000
NODE_ENV=development

# Database — you will create this in Step 7
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/zkcommerce

# JWT — paste any long random string (min 32 chars)
JWT_SECRET=zkcommerce_local_dev_secret_key_change_in_production_2026

# ── OPTIONAL for local dev (can leave as placeholder) ───────
# Razorpay (use test keys — get free at razorpay.com/x/test)
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder
RAZORPAY_WEBHOOK_SECRET=placeholder

# Email (payments + alerts won't send emails locally without this)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password

# WhatsApp (optional — skip for local dev)
GUPSHUP_API_KEY=skip_for_local
GUPSHUP_APP_NAME=ZKCommerce
WHATSAPP_FROM=+919000012345

# Delhivery (optional — shipping will use stub locally)
DELHIVERY_API_KEY=skip_for_local

# Storage (optional — image upload will use local disk)
R2_PUBLIC_URL=http://localhost:3000/uploads

# URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3000
```

**Important on Windows:** Replace `YOUR_PASSWORD` with the PostgreSQL password you set during install.

---

## PART 3 — Database setup

### Step 7 — Create the database

**Mac (Postgres.app):**
```bash
# Open Terminal
createdb zkcommerce
```

**Mac (Homebrew) / Linux:**
```bash
# Create database
createdb -U postgres zkcommerce

# If the above gives "role postgres does not exist":
createdb zkcommerce
```

**Windows (PowerShell):**
```powershell
# Open PowerShell as Administrator
# Replace YOUR_PASSWORD with your PostgreSQL password
$env:PGPASSWORD="YOUR_PASSWORD"
& "C:\Program Files\PostgreSQL\15\bin\createdb.exe" -U postgres zkcommerce
```

**Verify database was created:**
```bash
psql -U postgres -l | grep zkcommerce
# Should show: zkcommerce | postgres | UTF8 ...
```

---

### Step 8 — Run database migrations

This creates all 36 tables, views, indexes, and seed data.

**Mac / Linux:**
```bash
# Set DATABASE_URL first
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/zkcommerce"

# Run all 4 SQL files in order
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/phase1-additions.sql
psql $DATABASE_URL -f database/phase2-additions.sql
psql $DATABASE_URL -f database/phase3-additions.sql
```

**Or use the npm script:**
```bash
# Mac / Linux only
npm run db:migrate
```

**Windows (PowerShell):**
```powershell
$env:PGPASSWORD="YOUR_PASSWORD"
$psql = "C:\Program Files\PostgreSQL\15\bin\psql.exe"

& $psql -U postgres -d zkcommerce -f database\schema.sql
& $psql -U postgres -d zkcommerce -f database\phase1-additions.sql
& $psql -U postgres -d zkcommerce -f database\phase2-additions.sql
& $psql -U postgres -d zkcommerce -f database\phase3-additions.sql
```

**Expected output for each file:**
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
...
INSERT 0 1   ← seed data inserted
```

**Verify tables were created:**
```bash
psql $DATABASE_URL -c "\dt"
# Should list 20+ tables: users, stores, products, orders, etc.
```

---

### Step 9 — Update .env with your database password

Open `.env` and make sure DATABASE_URL matches:
```env
# Mac/Linux (if no password set):
DATABASE_URL=postgresql://postgres@localhost:5432/zkcommerce

# Mac/Linux (with password):
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/zkcommerce

# Windows (always has password):
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/zkcommerce
```

---

## PART 4 — Start the server

### Step 10 — Start the API

```bash
npm run dev
```

**Expected output:**
```
[nodemon] starting `node api/server.js`

  ⚡ ZKCommerce API v4.1 running on port 3000
  🗄️  Database: Connected
  💳 Razorpay: Test mode
  📧 Email:    Not configured
  🌍 Env:      development
```

**If you see an error like `Cannot find module 'bcryptjs'`:**
```bash
npm install    # packages not installed yet
```

**If you see `ECONNREFUSED` (database not running):**
```bash
# Mac — restart PostgreSQL
brew services restart postgresql@15
# or if using Postgres.app — click the elephant icon, click Stop, then Start

# Windows — restart service
net stop postgresql-x64-15
net start postgresql-x64-15

# Linux
sudo systemctl restart postgresql
```

**If you see `password authentication failed`:**
```bash
# Check your DATABASE_URL password matches PostgreSQL password
# Edit .env and fix DATABASE_URL
```

---

### Step 11 — Test the API is working

Open a new terminal tab and run:

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","version":"v4.1","db":"connected"}
```

Or open in browser: **http://localhost:3000/health**

**Test auth:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@zkcommerce.in","password":"demo1234"}'

# Expected: {"token":"eyJ...","user":{...}}
```

---

### Step 12 — Open the frontend

The frontend is static HTML — just open any file in your browser:

```bash
# Mac
open index.html                       # Marketing page
open auth/login.html                  # Login
open merchant/dashboard.html          # Merchant dashboard
open storefront/home.html             # Customer storefront
open admin/dashboard.html             # Admin panel
open admin/release-status.html        # Release status report
open admin/gap-analysis-full.html     # Gap analysis

# Windows
start index.html
start auth\login.html

# Linux
xdg-open index.html
```

**Demo login credentials:**
```
Merchant:  merchant@zkcommerce.in  / demo1234
Admin:     admin@zkcommerce.in     / admin1234
Customer:  customer@zkcommerce.in  / demo1234
```

---

## PART 5 — Test core flows locally

### Step 13 — Test registration (API)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Merchant",
    "email": "test@mystore.in",
    "phone": "9876543210",
    "password": "password123",
    "storeName": "My Test Store"
  }'
```

Expected: `{"token":"eyJ...","user":{...},"message":"Registration successful"}`

### Step 14 — Test product creation (API)

```bash
# First get a token from login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@zkcommerce.in","password":"demo1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Create a product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Kanjivaram Silk Saree",
    "price": 12500,
    "gst_rate": "12",
    "stock": 50,
    "status": "published"
  }'
```

### Step 15 — Use Postman (easier than curl)

1. Download Postman from postman.com
2. Create new collection: "ZKCommerce v4.1"
3. Set base URL variable: `{{base_url}}` = `http://localhost:3000`
4. Test these endpoints in order:
   - `POST {{base_url}}/api/auth/login` → copy token
   - Set Authorization: Bearer `{{token}}` on all subsequent requests
   - `GET {{base_url}}/api/products`
   - `GET {{base_url}}/api/orders`
   - `GET {{base_url}}/api/analytics/revenue`

---

## PART 6 — Common issues and fixes

### Port 3000 already in use

```bash
# Mac / Linux — find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Windows (PowerShell)
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F

# Or just change the port in .env:
PORT=3001
```

### PostgreSQL not found (Mac)

```bash
# Add PostgreSQL to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
# or for Postgres.app:
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "relation does not exist" error (API)

The SQL migrations haven't been run. Go back to Step 8.

```bash
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/phase1-additions.sql
psql $DATABASE_URL -f database/phase2-additions.sql
psql $DATABASE_URL -f database/phase3-additions.sql
```

### Windows: 'psql' not recognised

Add PostgreSQL to your PATH:
```
1. Search "Environment Variables" in Windows search
2. Click "Environment Variables"
3. Under System Variables → find "Path" → click Edit
4. Add new: C:\Program Files\PostgreSQL\15\bin
5. Click OK → restart PowerShell
```

### node_modules missing after unzip

```bash
cd zkc-build
npm install
```

### Login shows "demo mode" — not calling real API

This is a known issue. The fix is to edit `auth/login.html` and remove the demo fallback block. The API endpoint works correctly — this is a frontend wiring task.

---

## PART 7 — View your database (optional)

### Using pgAdmin (GUI — recommended for beginners)

1. Download pgAdmin 4 from pgadmin.org
2. Open pgAdmin → Servers → right-click → Register Server
3. Name: ZKCommerce Local
4. Connection tab:
   - Host: localhost
   - Port: 5432
   - Database: zkcommerce
   - Username: postgres
   - Password: your password
5. Save → expand the server → Databases → zkcommerce → Schemas → Tables
6. You should see all 36 tables

### Using psql (command line)

```bash
psql $DATABASE_URL

# Useful commands:
\dt              # list all tables
\d users         # describe users table
SELECT * FROM users;
SELECT * FROM stores;
SELECT COUNT(*) FROM products;
\q               # quit
```

---

## PART 8 — What works locally vs what needs live services

| Feature | Works locally? | What's needed for full functionality |
|---|---|---|
| API server start | ✅ Yes | Just `npm run dev` |
| Database (all 36 tables) | ✅ Yes | PostgreSQL running locally |
| Auth (register/login/JWT) | ✅ Yes | Works fully |
| Product CRUD | ✅ Yes | Works fully |
| Order creation | ✅ Yes | Works fully |
| Cart management | ✅ Yes | Works fully |
| GST report (JSON) | ✅ Yes | Works fully |
| GSTR-1 CSV export | ✅ Yes | Works fully |
| Loyalty points | ✅ Yes | Works fully |
| Razorpay payments | ⚠️ Partial | Get free test keys at razorpay.com |
| Email (welcome/order) | ⚠️ Partial | Need Gmail App Password or Resend key |
| WhatsApp alerts | ❌ Needs key | Gupshup API key required |
| Delhivery AWB | ⚠️ Stub | Returns fake AWB locally (real API needs key) |
| Image upload | ⚠️ Partial | Saves to memory — need R2/S3 for persistence |
| Frontend ↔ API | ⚠️ Partial | 2 of 47 pages wired; rest show demo data |

---

## Quick reference — daily commands

```bash
# Start everything
cd zkc-build
npm run dev          # starts API on http://localhost:3000

# Check API health
curl http://localhost:3000/health

# View logs (nodemon shows in terminal)
# Press Ctrl+C to stop

# Reset database (WARNING: deletes all data)
dropdb zkcommerce && createdb zkcommerce && npm run db:migrate

# Update code without restart (nodemon auto-restarts on file save)
# Just save any file in api/ and the server reloads automatically
```

---

## Folder structure reminder

```
zkc-build/
├── api/
│   ├── server.js          ← API server — start with npm run dev
│   ├── phase2-routes.js   ← Additional routes (auto-loaded)
│   ├── whatsapp.js        ← WhatsApp integration
│   └── jobs.js            ← Background job queue
├── database/
│   ├── schema.sql         ← Run first
│   ├── phase1-additions.sql ← Run second
│   ├── phase2-additions.sql ← Run third
│   └── phase3-additions.sql ← Run fourth
├── auth/                  ← Login, register pages
├── merchant/              ← Merchant dashboard pages
├── storefront/            ← Customer-facing pages
├── admin/                 ← Admin panel pages
├── assets/
│   ├── css/design-system.css
│   └── js/app.js
├── .env                   ← YOUR config (not in git)
├── .env.example           ← Template
├── package.json
└── LOCAL-SETUP.md         ← This file
```

---

## Need help?

- API not starting → check Step 10 troubleshooting
- Database errors → check Step 8, verify Step 9
- Pages showing demo data → this is expected (frontend wiring pending)
- Test API calls with Postman → Step 15

*ZKCommerce v4.1 · ZKanadavel Infotech Pvt Ltd · Local Development Guide*
