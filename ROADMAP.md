# ZKCommerce Roadmap (as of v4.1.0, Oct 2026)

## What v4.1.0 actually contains
| Area | Status |
|---|---|
| Auth (email, WhatsApp OTP flow, reset) | Working code; WhatsApp/Gupshup sending is a TODO (OTP is logged only) |
| Stores: create, theme, status draft→published→live, domain, export HTML | Working code |
| Products CRUD, categories, orders list/status | Working code |
| Public storefront API (`/api/storefront/:slug`), checkout (COD + Razorpay order) | Working code |
| Razorpay order / verify / webhook | Working code, untested against live keys |
| Analytics dashboard + revenue chart | Working code |
| Admin: store list by status, approve → live | Working code |
| Marketing site + 3 themes, auth pages | Static HTML |
| Store Builder (CMS UI) | **Prototype: runs on in-browser state, not yet wired to the API** |
| Client stores (Miliro, Smeram) | Static HTML demos, not yet generated from DB |
| Customers, invoices/GST PDF, staff, marketing, affiliates, recurring, flash sales, blog, shipping, loyalty, coupons, reviews, meta, cron, upload, notify | **Stub routes only** |

## v4.2 — "Make the CMS real" (next, ~3–4 weeks)
1. Wire Store Builder to the API: load/save `theme_config` JSON, product CRUD, pages
2. Server-side store renderer: one template reads `theme_config` + products and serves HTML at `slug.zkcommerce.in` (replaces hand-written client HTML)
3. Preview vs published: draft config + published snapshot, so edits don't go live until Publish
4. Image uploads to Cloudflare R2 (logo, hero, product gallery) — implement `/api/upload`
5. Wildcard subdomain routing (`*.zkcommerce.in`) + custom-domain lookup by Host header
6. Migrate Miliro and Smeram into the DB as real stores
7. Contact form + "notify me" endpoints saving to `contact_messages` / `notify_requests`
8. Replace stub routes in priority order: customers → invoices (GST PDF) → coupons → shipping

## v4.3 — Go-live hardening (~2 weeks)
Razorpay live KYC and keys, OWASP/ZAP scan, rate-limit tuning, load test, Sentry, backups, Gupshup templates approved, Resend email.

## v5.0 (Q1 2027, after ~100 paying merchants)
Next.js SSR storefront, Tally sync, AI product descriptions (Claude API), affiliates 2.0, multi-courier live rates, marketplace sync, section add/reorder/page builder.

## v6.0 (2027)
Tamil/Hindi/Telugu storefronts, POS, international payments, B2B wholesale.
