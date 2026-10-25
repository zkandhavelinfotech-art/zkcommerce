# ZKCommerce

One codebase. **Edit code in `zkc/` only.**

| Folder | What it is | Edit it? |
|---|---|---|
| `zkc/` | The application: API (`zkc/api`), Store Builder, merchant dashboard, storefront, deployment exporter | **Yes — the only source** |
| `zkc-build/` | Exact copy of `zkc/` that hosting runs (root `server.js` → `zkc-build/api/server.js`, Railway, Vercel build) | **No — generated** |
| `legacy/sprint-1-4/` | The earlier "Sprint 1-4" server, schema and pages, kept for reference while their features (cart, addresses, returns, search) are ported | No |
| `legacy/root-duplicates/` | Old duplicate `api/` and `store-builder/` that used to sit at the repo root | No |

## Everyday workflow

```bash
cd zkc && npm run dev          # develop (http://localhost:3000)
npm run release:sync           # from the repo root: copy zkc/ → zkc-build/
npm run release:check          # verify zkc-build/ matches zkc/ (also runs in the pre-commit hook and CI)
npm test                       # node:test suites
```

Enable the pre-commit check once per clone: `git config core.hooksPath .githooks`

## Rules

- Never edit `zkc-build/` by hand — the next sync overwrites it, and CI fails if it differs from `zkc/`.
- Pushing `main` deploys production (Railway API + Vercel static). Run the app locally before pushing.
- Never commit secrets. `.env*`, `db_config.php`, `payment_config.php`, built deployment packages and uploads are ignored on purpose.
