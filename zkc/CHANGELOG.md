# Changelog
## Unreleased — merchant operations APIs
- Replaced the staff, marketing, affiliate, recurring subscription, flash sale, blog, GST, loyalty, review, SEO metadata, and cron “coming soon” handlers with store-scoped database APIs.
- Added schema for staff records, campaigns, affiliates/referrals, subscription schedules, flash sales, blog posts, GST settings, loyalty accounts/ledger, product reviews, SEO metadata, and cron run history.
- Campaign delivery, recurring charges, affiliate attribution/payouts, staff sign-in, storefront flash-sale pricing, and GST filing remain integration work; APIs report these boundaries instead of claiming completion.

## 4.2.0 — CMS and database-backed storefront
- Store Builder connects to authenticated store APIs for design drafts, products, and pages.
- Draft preview and publish snapshots isolate public stores from unsaved edits.
- Shared server-rendered storefront supports wildcard subdomains and custom domains.
- `/api/upload/:storeId` uploads validated images to Cloudflare R2; contact and restock requests persist.
- Added customer summaries, GST invoice PDF downloads, coupon CRUD/validation, and shipping tracking routes.
- Added database seed records for Miliro and Smeram; both start as drafts for review.

## 4.1.0 — Oct 2026
- Rebuilt backend package: Express API, Postgres schema, Neon migration script
- Store lifecycle: draft → published → live; admin store list and approval
- Public storefront API and checkout; Razorpay order/verify/webhook
- Store Builder CMS prototype (theme, sections, products, pages, settings UI)
- Client demo stores: Miliro (dishwash), Smeram Naturals (Siddha hair oil, real product photos)
- Customers showcase page with slider
- Marketing site: index + 3 themes
- Known gaps listed in ROADMAP.md
