# ZKCommerce v5.0 — Release README
## Planned Q4 2026 — Starts after v4.1 live with paying merchants

---

## Prerequisites for v5.0 development

- v4.1 deployed and live (Railway + Vercel + Neon)
- Minimum 100 paying merchants
- Minimum 1,000 orders processed
- All v4.1 blockers resolved (Razorpay live, security audit, load test)

---

## v5.0 Feature Scope (15 features)

### 1. Abandoned Cart WhatsApp Recovery
**Status:** Code ready — needs cron job
**Tables:** abandoned_carts (ready in master SQL)
**Code:**   api/whatsapp.js WA.abandonedCart() — written
**API:**    POST /api/cron/abandoned-carts (in v5-routes.js)
**Work:**   Set up cron scheduler (Railway Cron or Upstash QStash).
            Trigger every 60 minutes. Target carts idle >60 min.

### 2. Blog + SEO Module
**Status:** Tables + UI ready — API wired in v5-routes.js
**Tables:** blog_posts, store_seo (both in master SQL)
**UI:**     merchant/blog.html — done
            merchant/seo-settings.html — done
**API:**    GET/POST/PUT/DELETE /api/blog/posts (in v5-routes.js)
            GET/PUT /api/stores/:id/seo (in v5-routes.js)
**Work:**   Add rich text editor (Quill.js or TipTap).
            Wire sitemap route to blog posts.

### 3. Flash Sales + Countdown Timer
**Status:** Tables + UI ready — API wired in v5-routes.js
**Tables:** flash_sales (in master SQL)
**UI:**     merchant/flash-sales.html — done
**API:**    GET/POST/PUT /api/flash-sales (in v5-routes.js)
            GET /api/storefront/:slug/flash-sales (in v5-routes.js)
**Work:**   Add countdown banner component to storefront/home.html.
            Add cron job to auto-activate/deactivate by starts_at/ends_at.

### 4. Instagram/Facebook Shop Sync
**Status:** Skeleton API in v5-routes.js
**Tables:** meta_catalogue_items (in v5-additions.sql)
**API:**    POST /api/meta/sync (skeleton — needs Graph API)
**Work:**   Meta Business account + Facebook App.
            Get Catalogue ID. Call Graph API POST /catalog_id/batch.
            Handle product updates + deletions.
            Add merchant/meta-shop.html UI.

### 5. BNPL / No-Cost EMI
**Status:** Skeleton API in v5-routes.js
**Tables:** bnpl_transactions (in v5-additions.sql)
**API:**    POST /api/payments/bnpl/initiate (skeleton)
**Work:**   Simpl SDK: simpl.com/developers
            LazyPay SDK: lazypay.in/developers
            Bajaj Finserv: bajajfinserv.in/business-partner
            Add EMI option to storefront/checkout.html.

### 6. Tally ERP Integration
**Status:** Table only
**Tables:** tally_sync_log (in v5-additions.sql)
**Work:**   Study TallyPrime REST API (XML format).
            Build POST /api/integrations/tally/push route.
            Map ZK orders to Tally voucher format.
            Add daily cron sync + merchant UI.

### 7. Real Delhivery AWB
**Status:** Stub in server.js — replace with real calls
**Work:**   Get Delhivery Business API token.
            Replace stub in POST /api/shipping/awb.
            Add webhook for shipment status updates.
            Wire tracking in storefront/order-tracking.html.

### 8. GST Invoice PDF
**Status:** JSON data ready — PDF generation missing
**Work:**   npm install puppeteer OR npm install pdfkit
            Add POST /api/invoices/:id/pdf route.
            Generate HTML template, convert to PDF.
            Store in R2, return download URL.

### 9. Multi-Courier Comparison
**Status:** Skeleton in v5-routes.js (hardcoded rates)
**Tables:** courier_rates (in v5-additions.sql)
**API:**    POST /api/shipping/compare (in v5-routes.js)
**Work:**   Integrate real Delhivery rate API.
            Add BlueDart and XpressBees API calls.
            Store rates in courier_rates table.
            Show rate card in merchant/orders-detail.html.

### 10. Next.js SSR Storefront
**Status:** Planning only
**Work:**   npm create next-app zkcommerce-storefront
            Migrate storefront/*.html to Next.js pages.
            Dynamic routing: /[slug]/products/[id]
            Use existing ZK design system CSS as Tailwind plugin.
            Point *.zkcommerce.in to Next.js on Vercel.

### 11. Category Create UI (merchant)
**Status:** API in v5-routes.js
**API:**    POST/PUT/DELETE /api/categories (in v5-routes.js)
**Work:**   Add "New Category" modal to merchant/products.html.
            Wire form to POST /api/categories.
            Support parent/child hierarchy.

### 12. Admin Revenue Charts
**Status:** API in v5-routes.js
**API:**    GET /api/admin/revenue (in v5-routes.js)
**Work:**   Wire admin/revenue.html to the new API.
            Add Chart.js line chart for daily revenue.
            Add pie chart for plan distribution.

### 13. Affiliate / Influencer System
**Status:** Table only
**Tables:** affiliates (in v5-additions.sql)
**Work:**   POST /api/affiliates — create influencer
            Unique ref code appended to store URL
            Track conversions, calculate commission
            Pay via Razorpay X payouts

### 14. WhatsApp Template Approval
**Status:** 6 templates coded in api/whatsapp.js
**Work:**   Submit templates at business.facebook.com
            Templates: order_confirmed, order_shipped,
            cod_otp, low_stock, abandoned_cart, flash_sale
            Approval takes 24–48 hours

### 15. Subscription / Recurring Orders
**Status:** Table only
**Tables:** recurring_orders (in v5-additions.sql)
**Work:**   POST /api/recurring — set up recurring order
            Cron: check next_order_date daily
            Auto-create order + charge via Razorpay
            Customer: pause, skip, cancel UI

---

## v5.0 Deployment Plan

```
1. Create staging branch from v4.1 main
2. Run database/v5-additions.sql on Neon staging
3. Mount api/v5-routes.js in server.js:
   const v5 = require('./v5-routes');
   app.use(v5);
4. Deploy to Railway staging service
5. QA each feature with pilot merchants
6. Feature flags: enable per merchant via store settings
7. Promote to production one feature at a time
```

## Run v5 migration

```bash
node deployment/scripts/neon-migrate.js YOUR_NEON_URL
# Then run v5 additions:
# In pgAdmin or psql:
# \i database/v5-additions.sql
```

---

## File additions in v5.0

```
api/v5-routes.js           10 new route groups (439 lines)
database/v5-additions.sql  7 new tables, 4 indexes
merchant/blog.html         Blog management UI
merchant/flash-sales.html  Flash sale management UI
merchant/seo-settings.html SEO meta settings UI
merchant/meta-shop.html    Instagram shop sync (new)
merchant/recurring.html    Recurring orders UI (new)
storefront/home.html       Add flash sale banner
storefront/checkout.html   Add BNPL/EMI option
```

---

*ZKCommerce v5.0 Planning — ZKanadavel Infotech Pvt Ltd*
*Build begins Q4 2026 after v4.1 production launch*
