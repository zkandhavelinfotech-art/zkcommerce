# ZKCommerce v4.1 — Dev Environment: Do This Right Now
## Follow in exact order. Each step has a verification check.

---

## STEP 0 — Know your OS

**Which laptop are you on?**
- Mac (Apple Silicon M1/M2/M3) → use "Mac ARM" commands
- Mac (Intel) → use "Mac Intel" commands
- Windows 10/11 → use "Windows" commands
- Ubuntu/Linux → use "Linux" commands

---

## STEP 1 — Check what's already installed

Run these first. Skip installs for anything already showing correct version.

```bash
node --version        # need: v20.x.x or higher
npm --version         # need: v9.x.x or higher
psql --version        # need: psql (PostgreSQL) 15.x or 16.x
git --version         # need: git version 2.x.x
```

Note down what's missing. Install only what you need below.

---

## STEP 2 — Install Node.js 20 (if missing)

### Mac (any chip):
```bash
# Go to https://nodejs.org
# Click the "20.x LTS" green button
# Download .pkg file → double click → follow installer
# Then reopen Terminal and check:
node --version    # should show v20.x.x
```

### Windows:
```
1. Go to https://nodejs.org
2. Click "20.x LTS" → download the Windows Installer (.msi)
3. Run the installer
4. IMPORTANT: on the "Tools for Native Modules" screen → tick the checkbox
5. Click Install → wait (~2 minutes)
6. Close and reopen PowerShell
7. Type: node --version
```

### Ubuntu/Linux:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

---

## STEP 3 — Install PostgreSQL 15 (if missing)

### Mac — Postgres.app (EASIEST — recommended):
```
1. Go to https://postgresapp.com
2. Download "Postgres.app with PostgreSQL 15 and 16"
3. Open the downloaded .dmg → drag Postgres.app to Applications
4. Open Postgres.app from Applications
5. Click "Initialize" button
6. Click "Open psql" → a terminal opens with postgres prompt
7. Type \q and press Enter to exit
```

Add psql to your terminal PATH (do this once):
```bash
# Mac with zsh (default since macOS Catalina):
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Mac with bash (older Macs):
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile

# Verify:
psql --version    # should show psql (PostgreSQL) 15.x or 16.x
```

### Mac — Homebrew alternative:
```bash
brew install postgresql@15
brew services start postgresql@15
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
psql --version
```

### Windows:
```
1. Go to https://www.postgresql.org/download/windows/
2. Click "Download the installer" (by EDB)
3. Select version: 15.x → Windows x86-64
4. Run the installer:
   - Installation Directory: leave as default
   - Select components: tick all (PostgreSQL Server, pgAdmin, Command Line Tools)
   - Data Directory: leave as default
   - Password: type a password → WRITE THIS DOWN → you need it later
     (use something simple like: postgres123)
   - Port: 5432 (do not change)
   - Locale: leave as default
5. Click Next → Next → Install → wait ~3 minutes
6. UNCHECK "Launch Stack Builder" → click Finish
```

Add psql to Windows PATH:
```
1. Press Windows key → search "Edit the system environment variables"
2. Click "Environment Variables"
3. Under "System variables" → find "Path" → click Edit
4. Click "New" → paste: C:\Program Files\PostgreSQL\15\bin
5. Click OK → OK → OK
6. Close and reopen PowerShell
7. Type: psql --version
```

### Ubuntu/Linux:
```bash
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres123';"
psql --version
```

---

## STEP 4 — Extract the project

### Mac / Linux:
```bash
# Go to where you downloaded the zip
cd ~/Downloads

# Unzip
unzip zkcommerce-v4-complete.zip

# Move to a good location
mv zkc-build ~/zkcommerce
cd ~/zkcommerce

# Confirm you're in the right place
ls
# Should see: api/  auth/  merchant/  storefront/  admin/  database/  package.json  etc.
```

### Windows (PowerShell):
```powershell
# Go to Downloads
cd $env:USERPROFILE\Downloads

# Unzip
Expand-Archive zkcommerce-v4-complete.zip -DestinationPath .

# Move to a good location
Move-Item zkc-build $env:USERPROFILE\zkcommerce
cd $env:USERPROFILE\zkcommerce

# Confirm
dir
# Should see: api  auth  merchant  storefront  admin  database  package.json  etc.
```

---

## STEP 5 — Install npm packages

```bash
# Make sure you're inside the zkcommerce folder
# Mac/Linux: cd ~/zkcommerce
# Windows: cd $env:USERPROFILE\zkcommerce

npm install
```

**Expected output (last few lines):**
```
added 187 packages, and audited 188 packages in 45s
found 0 vulnerabilities
```

**If you see errors:**
```bash
# Try this:
npm install --legacy-peer-deps

# If still errors on Windows, run PowerShell as Administrator and retry
```

---

## STEP 6 — Create your .env file

### Mac / Linux:
```bash
cp .env.example .env
```

### Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

Now open `.env` in any text editor (Notepad, VS Code, TextEdit).

**Replace ONLY these lines — leave everything else as-is:**

```env
# Line 8 — change YOUR_PASSWORD to your PostgreSQL password
# Mac with Postgres.app (no password):
DATABASE_URL=postgresql://postgres@localhost:5432/zkcommerce

# Mac with Homebrew (no password set):
DATABASE_URL=postgresql://localhost/zkcommerce

# Windows (use the password you set in Step 3):
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/zkcommerce

# Linux:
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/zkcommerce

# Line 12 — JWT secret (paste this exactly):
JWT_SECRET=zkcommerce_dev_secret_do_not_use_in_production_2026_local

# Line 17 — Razorpay (leave as placeholder for now, payments won't process but API starts fine):
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder
```

Save the file. Leave all other lines exactly as they are.

---

## STEP 7 — Create the database

### Mac (Postgres.app):
```bash
createdb zkcommerce
# No output = success
```

### Mac (Homebrew) / Linux:
```bash
createdb -U postgres zkcommerce

# If asked for password, type the one you set
# If you get "role postgres does not exist":
createdb zkcommerce
```

### Windows (PowerShell):
```powershell
# Replace postgres123 with your actual password
$env:PGPASSWORD = "postgres123"
& "C:\Program Files\PostgreSQL\15\bin\createdb.exe" -U postgres zkcommerce
```

**Verify the database was created:**
```bash
# Mac/Linux:
psql -l | grep zkcommerce

# Windows:
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -l
# Look for zkcommerce in the list
```

---

## STEP 8 — Run the 4 database migration files

This creates all 36 tables, 25 indexes, Row Level Security, and seed data.
**Run in this exact order:**

### Mac / Linux:
```bash
# Set the database URL first (replace password if needed)
export DATABASE_URL="postgresql://postgres@localhost:5432/zkcommerce"

# Run migrations one by one
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/phase1-additions.sql
psql $DATABASE_URL -f database/phase2-additions.sql
psql $DATABASE_URL -f database/phase3-additions.sql

# OR use the npm script (does all 4 at once):
npm run db:migrate
```

### Windows (PowerShell):
```powershell
$env:PGPASSWORD = "postgres123"
$psql = "C:\Program Files\PostgreSQL\15\bin\psql.exe"

& $psql -U postgres -d zkcommerce -f database\schema.sql
& $psql -U postgres -d zkcommerce -f database\phase1-additions.sql
& $psql -U postgres -d zkcommerce -f database\phase2-additions.sql
& $psql -U postgres -d zkcommerce -f database\phase3-additions.sql
```

**Expected output for each file (example):**
```
CREATE TABLE
CREATE TABLE
...
CREATE INDEX
...
INSERT 0 1
DO
```

**Verify tables were created:**
```bash
# Mac/Linux:
psql $DATABASE_URL -c "\dt" | head -30

# Windows:
& $psql -U postgres -d zkcommerce -c "\dt"
```

You should see a list including: users, stores, products, orders, carts, loyalty_points, etc.

---

## STEP 9 — Start the API server

```bash
npm run dev
```

### ✅ Success looks like this:
```
[nodemon] 3.0.2
[nodemon] starting `node api/server.js`

  ⚡ ZKCommerce API v4.1 running on port 3000
  🗄️  Database: Connected
  💳 Razorpay: Test mode
  📧 Email:    Not configured
  🌍 Env:      development

✅ Phase 2 routes registered
```

### ❌ If you see errors:

**"Cannot find module 'bcryptjs'"** → run `npm install` again

**"ECONNREFUSED 127.0.0.1:5432"** → PostgreSQL is not running
```bash
# Mac Postgres.app: click the elephant in menu bar → Start
# Mac Homebrew:
brew services start postgresql@15
# Windows: open Services → find "postgresql-x64-15" → right click → Start
# Linux:
sudo systemctl start postgresql
```

**"password authentication failed"** → wrong password in DATABASE_URL
Open `.env`, fix the password in DATABASE_URL, save, restart with `npm run dev`

**"database zkcommerce does not exist"** → go back to Step 7

**Port 3000 in use:**
```bash
# Mac/Linux:
lsof -ti:3000 | xargs kill -9
# Windows PowerShell:
netstat -ano | findstr :3000
# Then: taskkill /PID <number> /F
```

---

## STEP 10 — Verify the API is working

Open a **new terminal tab** (keep `npm run dev` running in the first tab).

### Quick health check:
```bash
curl http://localhost:3000/health
```

**Expected:**
```json
{"status":"ok","version":"v4.1","timestamp":"2026-...","db":"connected"}
```

Or open in browser: **http://localhost:3000/health**

### Test login API:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@zkcommerce.in","password":"demo1234"}'
```

**Expected:**
```json
{"token":"eyJhbGciOiJIUzI1NiIs...","user":{"id":2,"name":"Rajan Kumar","email":"merchant@zkcommerce.in","role":"merchant"}}
```

### Test products API (with auth token):
```bash
# Mac/Linux — auto-extracts token:
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@zkcommerce.in","password":"demo1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token','NO_TOKEN'))")

echo "Token: ${TOKEN:0:30}..."

curl http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN"
```

---

## STEP 11 — Open the frontend pages

The frontend is static HTML — just open files directly in your browser.
No web server needed for the pages.

### Mac:
```bash
open auth/login.html
```

### Windows:
```powershell
Start-Process auth\login.html
```

### Or drag and drop any .html file into Chrome/Edge/Firefox

**Key pages to open:**

| Page | File path | What it is |
|---|---|---|
| Marketing | `index.html` | Public landing page |
| Login | `auth/login.html` | Login with demo accounts |
| Merchant dashboard | `merchant/dashboard.html` | Main merchant view |
| Add product | `merchant/products-add.html` | Product form |
| Orders | `merchant/orders.html` | Order management |
| Setup wizard | `merchant/setup.html` | 5-step store setup |
| Storefront home | `storefront/home.html` | Customer view |
| Shopping cart | `storefront/cart.html` | Cart and checkout |
| Admin panel | `admin/dashboard.html` | Platform admin |
| Gap analysis | `admin/gap-analysis-full.html` | 8-tab report |
| Release status | `admin/release-status.html` | Deployment readiness |

**Demo login credentials:**
```
Merchant:  merchant@zkcommerce.in  /  demo1234
Admin:     admin@zkcommerce.in     /  admin1234
Customer:  customer@zkcommerce.in  /  demo1234
```

---

## STEP 12 — Test a complete flow with Postman

Download Postman from postman.com (free). Then:

1. Open Postman → click **"New Collection"** → name it "ZKCommerce Dev"
2. Add a **Collection Variable**: `base_url` = `http://localhost:3000`

**Test these in order:**

### Register a new merchant:
```
POST {{base_url}}/api/auth/register
Body (JSON):
{
  "firstName": "Test",
  "lastName": "User",
  "email": "test@mystore.in",
  "phone": "9876543210",
  "password": "password123",
  "storeName": "My Test Store"
}
Expected: 201 Created + token
```

### Login:
```
POST {{base_url}}/api/auth/login
Body: {"email":"merchant@zkcommerce.in","password":"demo1234"}
Expected: 200 + token
→ Copy the token value
```

### Create a product (paste token in Authorization → Bearer Token):
```
POST {{base_url}}/api/products
Authorization: Bearer <paste token here>
Body (JSON):
{
  "name": "Kanjivaram Silk Saree",
  "price": 12500,
  "gst_rate": "12",
  "stock": 50,
  "status": "published",
  "description": "Handloom silk from Tamil Nadu"
}
Expected: 201 + product object with id
```

### Get product list:
```
GET {{base_url}}/api/products
Authorization: Bearer <token>
Expected: 200 + {products: [...], total: 1}
```

### Check analytics:
```
GET {{base_url}}/api/analytics/revenue
Authorization: Bearer <token>
Expected: 200 + {daily: [], totals: {...}}
```

### Check loyalty balance:
```
GET {{base_url}}/api/loyalty/balance
Authorization: Bearer <token>
Expected: 200 + {balance: 0, tier: "Bronze", worth: 0}
```

---

## STEP 13 — Verify database has data

```bash
# Mac/Linux:
psql $DATABASE_URL

# Windows:
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d zkcommerce
```

Inside psql, run these:
```sql
-- Check tables exist
\dt

-- Check seed users
SELECT id, name, email, role FROM users;

-- Check demo store
SELECT id, name, slug, plan FROM stores;

-- Check any products you created via API
SELECT id, name, price, stock FROM products;

-- Exit
\q
```

---

## STEP 14 — Daily workflow from now on

```bash
# Every time you want to work on the project:

# 1. Make sure PostgreSQL is running
#    Mac Postgres.app: open it if elephant not in menu bar
#    Mac Homebrew: brew services start postgresql@15
#    Windows: check Services for postgresql-x64-15
#    Linux: sudo systemctl start postgresql

# 2. Go to project folder
cd ~/zkcommerce          # Mac/Linux
cd $env:USERPROFILE\zkcommerce   # Windows

# 3. Start API
npm run dev

# 4. Open any frontend page in browser
open auth/login.html     # Mac
start auth\login.html    # Windows

# 5. When done — Ctrl+C to stop the API
```

---

## WHAT TO EXPECT — Honest status

**Will work perfectly right now:**
- All 83 API routes — test with Postman or curl
- Login / Register / Password reset
- Product create, list, update, delete
- Order creation, status updates
- Cart management
- GST report and GSTR-1 CSV
- Loyalty balance and transactions
- Coupon validation
- Admin stats and merchant list
- All 48 HTML pages open and look complete

**Will show demo/mock data (not yet wired to your local API):**
- Merchant dashboard charts — hardcoded numbers
- Most page buttons show success toasts (not real API calls)
- This is expected — frontend wiring is the next sprint task

**Will NOT work without extra config:**
- Razorpay payment modal — add test keys to .env
- Email sending — add SMTP details to .env
- WhatsApp alerts — needs Gupshup key
- AWB generation — stub returns fake AWB number

---

## QUICK TROUBLESHOOTING CARD

| Error message | Cause | Fix |
|---|---|---|
| `Cannot find module 'X'` | npm not installed | `npm install` |
| `ECONNREFUSED 5432` | PostgreSQL not running | Start PostgreSQL |
| `password authentication failed` | Wrong DB password in .env | Fix DATABASE_URL in .env |
| `database "zkcommerce" does not exist` | DB not created | Run Step 7 |
| `relation "users" does not exist` | Migrations not run | Run Step 8 |
| `Port 3000 is already in use` | Another process using 3000 | Kill it or change PORT in .env |
| `JWT must be provided` | Forgot auth header | Add `Authorization: Bearer <token>` |
| `Invalid email or password` | Demo data not seeded | Run phase3 SQL again |

---

## YOU ARE DONE WHEN:

✅ `npm run dev` shows "Database: Connected"
✅ `http://localhost:3000/health` returns `{"status":"ok"}`
✅ Login API returns a JWT token
✅ You can create a product via Postman
✅ Frontend pages open in browser

**That is a fully working local dev environment.**

---

*ZKCommerce v4.1 · Dev Environment Setup · ZKanadavel Infotech Pvt Ltd*
