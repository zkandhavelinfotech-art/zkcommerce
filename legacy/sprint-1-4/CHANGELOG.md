# ZKCommerce v4.1 — Changelog

## v4.1.0 — Dev Release (August 2026)

### Bug Fixes
- Fixed asset path bug: `../../assets/` → `../assets/` across all 48 HTML pages
- Fixed authentication: login.html now calls real API, shows API status indicator
- Fixed demo fallback: works only when API is offline, shows correct error messages
- Fixed register.html: now calls POST /api/auth/register with proper validation
- Fixed storefront/home.html: dynamic store loading from URL ?store= param
- Fixed product routing: storefront links pass store slug via URL params

### New Features — API Wiring (18 pages now call real API)
- auth/login.html          → POST /api/auth/login (real JWT + demo fallback)
- auth/register.html       → POST /api/auth/register
- merchant/dashboard.html  → GET /api/analytics/revenue + /api/orders + /api/products
- merchant/products.html   → GET /api/products (with delete action)
- merchant/products-add.html → POST /api/products (with category load)
- merchant/orders.html     → GET /api/orders (paginated + filter)
- merchant/orders-detail.html → GET/PUT /api/orders/:id + AWB + refund
- merchant/inventory.html  → GET /api/products + PUT /api/products/:id (stock update)
- merchant/gst-report.html → GET /api/gst/report + GSTR-1 CSV download
- merchant/analytics.html  → GET /api/analytics/revenue
- merchant/payouts.html    → GET /api/payouts
- merchant/returns.html    → GET /api/returns + PUT /api/returns/:id/status
- merchant/loyalty.html    → GET /api/loyalty/balance
- storefront/home.html     → GET /api/storefront/:slug + /products + /categories
- storefront/product.html  → GET /api/storefront/:slug/products (by ID)
- storefront/search.html   → GET /api/search
- storefront/cart.html     → localStorage cart with coupon validation API
- admin/dashboard.html     → GET /api/admin/stats
- admin/merchants.html     → GET /api/admin/merchants

### app.js Rewrite (v3 → v4.1)
- Fixed ZK.api base URL detection (file://, localhost, *.zkcommerce.in)
- Added api.get/post/put/delete helpers with auto Bearer token
- Fixed fmt.inr, fmt.inrCompact, fmt.orderId, fmt.date, fmt.datetime
- Fixed cart.add/remove/update with localStorage sync + badge update
- Fixed toast — now queues multiple toasts, no overlap
- Added btnLoading() spinner helper
- Added auth.requireAuth() redirect helper
- Added gst.split() calculator
- Added loyalty.tier() and loyalty.worth() helpers

### Database
- Added zkcommerce-additions.sql (missing functions + views from phase1/phase2)
- Functions: earn_loyalty_points, redeem_loyalty_points, auto_create_invoice,
  get_or_create_cart, upsert_cart_item, product_total_stock
- Views: v_cart_summary, v_invoice_summary, v_product_stock
- Sequence: invoice_number_seq

### Developer Experience
- Added open-frontend.bat (Windows menu launcher for all pages)
- Added run-migration-windows.bat (fixed path quoting for spaces in Program Files)
- Fixed zkcommerce-master.sql: removed all emojis (Windows encoding compatible)
- Fixed VALUES join syntax in seed data (removed broken FROM clause)

## v4.0.0 — UI Complete Release (July 2026)
- 47 HTML pages built (auth, merchant, storefront, admin)
- ZKCommerce Design System v3
- Store setup wizard — 16 industries, 8 themes, live CMS
- Node.js/Express API — 83 routes written
- PostgreSQL schema — 36 tables, 25 indexes, RLS
- All infrastructure configs (Railway, Vercel, Docker, nginx, CI/CD)
