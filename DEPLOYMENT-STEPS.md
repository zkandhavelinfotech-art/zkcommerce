# ZKCommerce Deployment Runbook

This runbook covers four targets: local, shared development, staging, and production. Run every command from the repository root.

```powershell
cd "D:\ZK Software\Stage\zkcommerce\zkcommerce-v4-complete"
```

## Environment model

| Target | Git branch | Launcher name | Database | API process |
| --- | --- | --- | --- | --- |
| Local | Any working branch | `local` | Local PostgreSQL or personal Neon branch | `nodemon` |
| Development | `develop` | `dev` | Neon `development` branch | Railway Development environment |
| Staging | `staging` | `staging` | Neon `staging` branch | Railway Staging environment |
| Production | `main` | `production` | Neon production/default branch | Railway Production environment |

`local` and `dev` both normalize to `NODE_ENV=development`. They differ operationally: local runs on the developer computer, while development is the shared cloud environment.

## Storefront URLs

Replace `<slug>` with the generated store slug, for example `mangalam-textiles`.

| Target | Storefront URL |
| --- | --- |
| Local | `http://localhost:8080/storefront/home.html?store=<slug>` |
| Development | `https://<development-frontend>/storefront/home.html?store=<slug>` |
| Staging | `https://<staging-frontend>/storefront/home.html?store=<slug>` |
| Production | `https://<slug>.zkcommerce.in/` |

Local, development, and staging use the query-string slug because wildcard subdomains are normally unavailable there. Production uses the tenant wildcard domain and requires `*.zkcommerce.in` DNS plus the Cloudflare storefront worker route. The setup wizard now generates the correct link automatically for its current environment.

## One-time preparation

```powershell
npm install
npm test
npm run build
```

For each Neon environment, keep two URLs:

```env
DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require
DIRECT_DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
```

- `DATABASE_URL` is the pooled application connection.
- `DIRECT_DATABASE_URL` is the direct, non-pooler migration connection.
- Never commit real URLs or secrets.

## 1. Local

### Configure

```powershell
Copy-Item "zkc-build\.env.example" "zkc-build\.env"
```

Set at least these values in `zkc-build/.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/zkcommerce
JWT_SECRET=replace-with-at-least-32-random-characters
FRONTEND_URL=http://localhost:8080
```

If local development uses Neon, also set `DIRECT_DATABASE_URL` to the direct URL for your personal Neon branch.

### Migrate and run

```powershell
node zkc-build\deployment\launcher db:migrate local
node zkc-build\deployment\launcher start local
```

In a second terminal:

```powershell
npm run build
npx serve zkc-build\dist -l 8080
```

Verify:

```powershell
node zkc-build\deployment\launcher health local
```

Open `http://localhost:8080` and confirm `http://localhost:3000/health` returns `status: ok`.

## 2. Shared development

### Provision once

1. Create a Neon branch named `development`.
2. In Railway, duplicate the service into a persistent Development environment.
3. Connect that environment to the `develop` Git branch.
4. Keep Railway Root Directory as `/` and config path as `/railway.toml`.
5. Add Development environment variables:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=<development pooled Neon URL>
DIRECT_DATABASE_URL=<development direct Neon URL>
JWT_SECRET=<development secret of at least 32 characters>
FRONTEND_URL=<development frontend URL>
```

Add test/sandbox credentials for Razorpay, SMTP, Redis, R2, and other enabled integrations.

### Deploy

```powershell
git switch develop
git push origin develop
```

Railway automatically performs:

```text
npm run build
npm run db:migrate
npm start
```

For a manual deployment on a VM or developer computer with the Development variables loaded:

```powershell
node zkc-build\deployment\launcher deploy dev
```

Verify the Railway Development URL:

```text
https://<development-api-domain>/health
```

## 3. Staging

### Provision once

1. Create a Neon branch named `staging`, preferably from the production branch after production is stable.
2. Duplicate the Railway service into a persistent Staging environment.
3. Connect it to the `staging` Git branch.
4. Add staging-specific variables:

```env
NODE_ENV=staging
PORT=3000
DATABASE_URL=<staging pooled Neon URL>
DIRECT_DATABASE_URL=<staging direct Neon URL>
JWT_SECRET=<staging secret of at least 32 characters>
FRONTEND_URL=<staging frontend URL>
```

Use Razorpay test keys and non-production email, WhatsApp, Redis, R2, and Sentry projects.

### Promote and deploy

```powershell
git switch staging
git merge develop
npm test
npm run build
git push origin staging
```

Railway runs the Node migration before replacing the active application instance. To run the same sequence manually with staging variables loaded:

```powershell
node zkc-build\deployment\launcher deploy staging
```

Smoke-test:

```text
GET  https://<staging-api-domain>/health
POST https://<staging-api-domain>/api/auth/login
GET  https://<staging-frontend-domain>/
```

Do not promote if the migration, health check, authentication, checkout, or payment sandbox test fails.

## 4. Production

### Pre-deployment checklist

- Staging passed migration and smoke tests.
- Production has its own Neon branch/database and direct migration URL.
- `JWT_SECRET` is unique and at least 32 characters.
- Razorpay uses live keys and the production webhook URL.
- Production SMTP, R2, Redis, Sentry, WhatsApp, DNS, and custom domains are configured.
- `FRONTEND_URL` exactly matches the production frontend origin.
- A recent database recovery point or Neon restore window is available.

Never run `db:create` or `db:reset` against production.

### Promote and deploy

```powershell
git switch main
git merge staging
npm test
npm run build
git push origin main
```

Railway Production then runs:

```text
npm run db:migrate
npm start
```

For a manual non-Railway production host with all production variables already loaded:

```powershell
node zkc-build\deployment\launcher deploy production
```

Verify immediately:

```text
https://api.zkcommerce.in/health
https://app.zkcommerce.in/
```

Then verify login, one read-only merchant flow, Sentry, Railway logs, and Neon connections. Application rollback does not reverse database migrations; migration files are immutable and checksum-protected.

## Frontend deployment for development, staging, and production

The frontend uses same-origin `/api` calls. Vercel proxies those calls using the destination in `vercel.json`.

The committed destination is currently production:

```json
"destination": "https://api.zkcommerce.in/api/:path*"
```

Before deploying a separate Development or Staging Vercel project, its deployment branch must point this destination to the matching Development or Staging Railway API. Never deploy a staging frontend that proxies to the production API.

Vercel settings for every frontend project:

```text
Root Directory: /
Framework Preset: Other
Build Command: npm run build
Output Directory: zkc-build/dist
```

## Command reference

```powershell
# Help
node zkc-build\deployment\launcher help local

# Start
node zkc-build\deployment\launcher start local
node zkc-build\deployment\launcher start dev
node zkc-build\deployment\launcher start staging
node zkc-build\deployment\launcher start production

# Database migration
node zkc-build\deployment\launcher db:migrate local
node zkc-build\deployment\launcher db:migrate dev
node zkc-build\deployment\launcher db:migrate staging
node zkc-build\deployment\launcher db:migrate production

# Health
node zkc-build\deployment\launcher health local
node zkc-build\deployment\launcher health dev
node zkc-build\deployment\launcher health staging
node zkc-build\deployment\launcher health production

# Full manual sequence: health, migration, start
node zkc-build\deployment\launcher deploy dev
node zkc-build\deployment\launcher deploy staging
node zkc-build\deployment\launcher deploy production
```
