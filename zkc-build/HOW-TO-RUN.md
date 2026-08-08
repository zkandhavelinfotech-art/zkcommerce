# ZKCommerce v4.1 — How to Run (Complete Guide)
## Prerequisites, Installation, Database, API, Frontend — Step by Step
## Works on: Windows 10/11 | Mac | Ubuntu/Linux

---

## PART 1 — PREREQUISITES

Install these once. Skip anything already installed.

### 1A. Check what you already have

Run in terminal / Command Prompt:
```
node --version     # need: v20.x.x
npm --version      # need: v9.x.x or higher
psql --version     # need: psql (PostgreSQL) 15.x or 16.x
git --version      # need: 2.x.x
```

---

### 1B. Install Node.js 20 LTS

**Windows:**
1. Go to https://nodejs.org
2. Click "20.x LTS" download button
3. Run the .msi installer
4. On "Tools for Native Modules" screen: tick the checkbox
5. Complete install, restart Command Prompt
6. Verify: `node --version`

**Mac:**
1. Go to https://nodejs.org
2. Click "20.x LTS" download button
3. Run the .pkg installer
4. Verify: `node --version`

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

---

### 1C. Install PostgreSQL 15

**Windows:**
1. Go to https://www.postgresql.org/download/windows/
2. Click "Download the installer" (EDB)
3. Select version 15.x, Windows x86-64
4. Run installer:
   - Port: 5432 (keep default)
   - Password: set something simple like `postgres123` — WRITE IT DOWN
   - Locale: keep default
   - Uncheck "Stack Builder" at the end
5. Add psql to PATH:
   - Search "Edit the system environment variables"
   - Environment Variables > System Variables > Path > Edit > New
   - Add: `C:\Program Files\PostgreSQL\15\bin`
   - Click OK everywhere
   - Restart Command Prompt
6. Verify: `psql --version`

**Mac (recommended: Postgres.app):**
1. Go to https://postgresapp.com
2. Download, open DMG, drag to Applications
3. Open Postgres.app, click Initialize
4. Add to PATH (paste in Terminal):
```bash
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```
5. Verify: `psql --version`

**Linux:**
```bash
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres123';"
```

---

## PART 2 — PROJECT SETUP (do once)

### Step 1: Extract the project

**Windows:**
```powershell
# In PowerShell, go to where you downloaded the zip
cd Downloads
Expand-Archive zkcommerce-v4-complete.zip -DestinationPath .
# Move to a good location (no spaces in path is safer)
Move-Item zkc-build C:\zkcommerce
cd C:\zkcommerce
```

**Mac/Linux:**
```bash
cd ~/Downloads
unzip zkcommerce-v4-complete.zip
mv zkc-build ~/zkcommerce
cd ~/zkcommerce
```

---

### Step 2: Install npm packages

```bash
# Inside the zkcommerce folder:
npm install
```

Expected: `added 187 packages` — takes about 1 minute.

If errors:
```bash
npm install --legacy-peer-deps
```

---

### Step 3: Create your .env file

**Windows:**
```powershell
Copy-Item .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

Open `.env` in Notepad or VS Code and set these values:
```
PORT=3000
NODE_ENV=development

# CHANGE THIS — use your PostgreSQL password:
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/zkcommerce

# CHANGE THIS — any long random string:
JWT_SECRET=zkcommerce_dev_secret_2026_change_in_production

# Leave as placeholder for now (payments won't process but API starts):
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder
RAZORPAY_WEBHOOK_SECRET=placeholder

# Leave blank for now (emails will be logged to console):
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@zkcommerce.in

# Leave blank for now (WhatsApp alerts will be skipped):
GUPSHUP_API_KEY=
```

Mac with Postgres.app (no password):
```
DATABASE_URL=postgresql://postgres@localhost:5432/zkcommerce
```

---

## PART 3 — DATABASE SETUP (do once)

### Step 4: Create the database

**Windows (Command Prompt with psql in PATH):**
```cmd
psql -U postgres -c "CREATE DATABASE zkcommerce;"
```
Enter your PostgreSQL password when prompted.

**Or via pgAdmin 4 (easier on Windows):**
1. Open pgAdmin 4 (installed with PostgreSQL)
2. In the left panel: Servers > PostgreSQL 15 > right-click
3. Connect (enter your password)
4. Right-click "Databases" > Create > Database
5. Name: `zkcommerce`
6. Click Save

**Mac/Linux:**
```bash
createdb zkcommerce
# or if postgres user needed:
createdb -U postgres zkcommerce
```

---

### Step 5: Run the migration

This creates all 36 tables, 70 indexes, 5 views, seed data, and demo accounts.

**Windows — Option A (double-click):**
1. Open Windows Explorer
2. Navigate to: `C:\zkcommerce\database\`
3. Double-click `run-migration-windows.bat`
4. Enter your PostgreSQL password
5. Wait ~15 seconds for "SUCCESS" message

**Windows — Option B (pgAdmin Query Tool):**
1. In pgAdmin, click `zkcommerce` database
2. Click Tools > Query Tool (or press Alt+Shift+Q)
3. Click File > Open
4. Navigate to `database\zkcommerce-master.sql`
5. Click Open, then press F5 (Run)
6. Wait ~15 seconds
7. You should see `ANALYZE` at the bottom = success

**Mac/Linux:**
```bash
cd ~/zkcommerce
export DATABASE_URL="postgresql://postgres@localhost:5432/zkcommerce"
psql $DATABASE_URL -f database/zkcommerce-master.sql
```

**Verify migration worked:**
```sql
-- In pgAdmin Query Tool or psql:
SELECT COUNT(*) FROM users;
-- Expected: 3 (admin, merchant, customer)

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: 30+ tables listed
```

If migration had errors, run it again — it starts with DROP TABLE IF EXISTS so it is safe to rerun.

---

## PART 4 — START THE APPLICATION

### Step 6: Start the API server

Make sure PostgreSQL is running first, then:

```bash
# Windows — in Command Prompt:
cd C:\zkcommerce
npm run dev

# Mac/Linux — in Terminal:
cd ~/zkcommerce
npm run dev
```

**SUCCESS looks like this:**
```
[nodemon] starting `node api/server.js`

  ZKCommerce API v4.1 running on port 3000
  Database: Connected
  Razorpay: Test mode
  Email:    Not configured
  Env:      development

Phase 2 routes registered
```

**Common errors and fixes:**

| Error | Cause | Fix |
|---|---|---|
| `Cannot find module 'bcryptjs'` | npm install not done | Run `npm install` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running | Start PostgreSQL service |
| `password authentication failed` | Wrong password in .env | Fix DATABASE_URL password |
| `database "zkcommerce" does not exist` | DB not created | Run Step 4 again |
| `Port 3000 in use` | Another process | Kill it or change PORT in .env |
| `relation "users" does not exist` | Migration not run | Run Step 5 again |

**Port 3000 in use:**
```bash
# Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Windows PowerShell:
netstat -ano | findstr :3000
taskkill /PID <number_shown> /F
```

---

### Step 7: Verify API is working

Open in browser:
```
http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","version":"v4.1","db":"connected"}
```

Test login API (use Postman or curl):
```bash
# Mac/Linux curl:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@zkcommerce.in","password":"demo1234"}'

# Expected: {"token":"eyJ...","user":{"id":2,"name":"Rajan Kumar","role":"merchant"}}
```

---

## PART 5 — OPEN THE FRONTEND

### Step 8: Open HTML pages

The frontend is static HTML. Open any file directly in your browser.

**Windows — double-click `open-frontend.bat`:**
```
Located in: C:\zkcommerce\open-frontend.bat
Double-click it > choose a number (1-9) > page opens in browser
```

**Or open directly:**

| Page | Windows path | Mac/Linux path |
|---|---|---|
| Login | `auth\login.html` | `auth/login.html` |
| Merchant dashboard | `merchant\dashboard.html` | `merchant/dashboard.html` |
| Add product | `merchant\products-add.html` | `merchant/products-add.html` |
| Products list | `merchant\products.html` | `merchant/products.html` |
| Orders | `merchant\orders.html` | `merchant/orders.html` |
| Inventory | `merchant\inventory.html` | `merchant/inventory.html` |
| GST report | `merchant\gst-report.html` | `merchant/gst-report.html` |
| Store setup wizard | `merchant\setup.html` | `merchant/setup.html` |
| Customer storefront | `storefront\home.html` | `storefront/home.html` |
| Admin panel | `admin\dashboard.html` | `admin/dashboard.html` |
| Gap analysis | `admin\gap-analysis-full.html` | `admin/gap-analysis-full.html` |
| Release status | `admin\release-status.html` | `admin/release-status.html` |

**Mac quick-open:**
```bash
cd ~/zkcommerce
open auth/login.html
open merchant/dashboard.html
open storefront/home.html
open admin/dashboard.html
```

---

### Step 9: Login

Open `auth/login.html` in browser.

The page will show:
- Green bar: "API connected: http://localhost:3000/api" — real login will work
- Yellow bar: "API offline" — demo mode (API not running)

**Demo credentials (all use password: demo1234):**

| Role | Email | Password | Goes to |
|---|---|---|---|
| Merchant | merchant@zkcommerce.in | demo1234 | merchant/dashboard.html |
| Admin | admin@zkcommerce.in | demo1234 | admin/dashboard.html |
| Customer | customer@zkcommerce.in | demo1234 | storefront/home.html |

---

## PART 6 — TEST KEY FLOWS

### Test 1: Create a product via API (Postman)

1. Login: `POST http://localhost:3000/api/auth/login`
   Body: `{"email":"merchant@zkcommerce.in","password":"demo1234"}`
   Copy the `token` from response

2. Create product: `POST http://localhost:3000/api/products`
   Header: `Authorization: Bearer YOUR_TOKEN`
   Body:
   ```json
   {
     "name": "Test Saree",
     "price": 5000,
     "gst_rate": "5",
     "stock": 20,
     "status": "published"
   }
   ```
   Expected: `{"product":{"id":1,"name":"Test Saree",...}}`

3. List products: `GET http://localhost:3000/api/products`
   Header: `Authorization: Bearer YOUR_TOKEN`
   Expected: `{"products":[...],"total":1}`

4. Open `merchant/products.html` in browser — product should appear in table.

### Test 2: Open storefront for demo store

Open in browser:
```
storefront/home.html?store=rajanTextiles
```
Should show: "Rajan Textiles" store with 5 demo products loaded from API.

### Test 3: Check database in pgAdmin

In pgAdmin Query Tool:
```sql
-- See all users
SELECT id, name, email, role FROM users;

-- See the demo store
SELECT id, name, slug, plan, is_active FROM stores;

-- See demo products
SELECT id, name, price, stock, status FROM products;

-- See categories
SELECT id, name, slug, store_id FROM categories;
```

---

## PART 7 — DAILY WORKFLOW

Every time you want to work on the project:

```
1. Start PostgreSQL
   Windows:  Services > postgresql-x64-15 > Start
   Mac:      Click elephant in menu bar (Postgres.app)
   Linux:    sudo systemctl start postgresql

2. Open terminal, go to project
   Windows:  cd C:\zkcommerce
   Mac:      cd ~/zkcommerce

3. Start API
   npm run dev
   (keep this terminal open)

4. Open frontend pages
   Windows:  open-frontend.bat
   Mac:      open auth/login.html

5. Test changes at http://localhost:3000
```

To stop the API: press `Ctrl + C` in the terminal.

---

## PART 8 — RESET DATABASE (if needed)

If you want to start fresh:

**Windows:**
```powershell
$env:PGPASSWORD = "postgres123"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS zkcommerce;"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE zkcommerce;"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d zkcommerce -f database\zkcommerce-master.sql
```

**Mac/Linux:**
```bash
dropdb zkcommerce
createdb zkcommerce
psql postgresql://postgres@localhost:5432/zkcommerce -f database/zkcommerce-master.sql
```

---

## QUICK REFERENCE CARD

| Task | Command |
|---|---|
| Start API | `npm run dev` |
| Stop API | Ctrl+C |
| Check API health | `http://localhost:3000/health` |
| Reset DB + re-migrate | `dropdb zkcommerce && createdb zkcommerce && psql ... -f database/zkcommerce-master.sql` |
| Open frontend menu | Double-click `open-frontend.bat` (Windows) |
| View all tables | pgAdmin > zkcommerce > Schemas > public > Tables |
| Test API | Postman: `http://localhost:3000/api/...` |

---

## FILES IN THIS PROJECT

```
zkcommerce/
  api/
    server.js              API server -- start with npm run dev
    phase2-routes.js       Phase 2 routes (auto-loaded by server.js)
    whatsapp.js            WhatsApp integration (needs Gupshup key)
    jobs.js                Background job queue (needs Redis)
  database/
    zkcommerce-master.sql  RUN THIS -- single clean migration file
    zkcommerce-additions.sql  Run after master -- adds functions + views
    run-migration-windows.bat  Windows one-click migration
    run-migration-mac-linux.sh Mac/Linux migration script
  auth/                   Login, register, forgot/reset password
  merchant/               15 merchant dashboard pages
  storefront/             10 customer-facing pages
  admin/                  12 admin panel pages
  assets/
    css/design-system.css  ZKCommerce Design System v3
    js/app.js              Utilities: fmt, api, auth, cart, toast
  .env                    Your config (never commit this)
  .env.example            Template for .env
  package.json            npm dependencies
  HOW-TO-RUN.md           This file
  DEPLOYMENT-READINESS.md Staging/production checklist
  CHANGELOG.md            What changed in each release
  open-frontend.bat       Windows: open any page in browser
```

---

## DEMO ACCOUNTS

| Role | Email | Password |
|---|---|---|
| Admin | admin@zkcommerce.in | demo1234 |
| Merchant | merchant@zkcommerce.in | demo1234 |
| Customer | customer@zkcommerce.in | demo1234 |

---

*ZKCommerce v4.1 -- ZKanadavel Infotech Pvt Ltd & ZK Infotech INC*
*Built in Tamil Nadu. Made for Indian merchants.*
