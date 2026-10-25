# ZKCommerce Roadmap (code version: v4.4.0; production activation in progress, Oct 2026)

## v4.1.0 baseline (historical)

| Area | Status |
|---|---|
| Auth (email, WhatsApp OTP flow, reset) | Code is present; WhatsApp/Gupshup delivery is TODO (OTP is logged only) |
| Stores: create, theme, status draft → published → live, domain, export HTML | API code is present |
| Products CRUD, categories, orders list/status | API code is present |
| Public storefront API (`/api/storefront/:slug`), checkout (COD + Razorpay order) | API code is present; live Razorpay credentials and end-to-end payment remain unverified |
| Analytics dashboard and revenue chart | Code is present |
| Admin store list and approval | Code is present |
| Marketing site, three themes, auth pages | Static HTML |
| Store Builder | Draft-backed editor API and preview/publish snapshots implemented |
| Miliro and Smeram | Static HTML demos; not database-backed |
| Customers, invoices/GST PDF, staff, marketing, affiliates, recurring, flash sales, blog, shipping, GST, loyalty, coupons, reviews, meta, cron, upload, notify | Stub routes or incomplete implementations; verify each module before treating it as production-ready |

## v4.2 — “Make the CMS real” (implemented; activation and completion remain)

**Implementation status:** Core v4.2 code is present. The code has not been confirmed against a live deployment. Production activation still requires applying the schema migration, configuring R2, running the Miliro/Smeram seed after an admin account exists, and setting wildcard DNS/TLS. The custom-domain code resolves a Host header, but domain ownership verification and automated certificate provisioning are not implemented.

**Release outcome:** the core create/edit/preview/publish path is implemented in code. The storefront renderer is a basic product catalog template; cart buttons only update a browser counter, so it is not yet a complete shopping/checkout storefront. Treat v4.2 as code-complete for its foundation, pending deployment activation and the gaps below.

### v4.2 completion audit

| Feature | Status | Remaining work |
|---|---|---|
| Builder settings, theme config, products, and pages | Implemented in code | Run against the deployed database; improve editor coverage and error handling. Some layout controls remain limited. |
| Shared database-backed renderer | Implemented in code | Storefront is a basic catalog; cart/checkout interaction is not connected. Static demo files remain in the repository. |
| Draft, preview, published snapshot | Implemented in code | Apply migration and verify behavior in the deployed environment. |
| R2 uploads | Endpoint and builder integration implemented | Configure bucket, credentials, public asset URL and access policy; verify live upload and retrieval. |
| Subdomain and custom Host lookup | Application routing implemented; custom-domain resolution follows the published snapshot | Configure wildcard DNS/TLS; custom-domain verification and certificate lifecycle are still missing. Draft domain changes do not affect storefront routing until Publish. |
| Miliro and Smeram DB migration | Seed SQL provided | Run after creating the admin account and confirm the stores/products/images render correctly. |
| Contact and notify endpoints | Implemented in code | Apply schema, exercise rate limits in deployment, and add a merchant-facing inbox. |
| Customers, invoices, coupons, shipping | Basic routes implemented | Customers are order-derived summaries; invoice PDF is minimal and needs statutory GST validation; coupons are not applied in checkout; shipping has no courier/rates/labels integration. |

**Operational release blockers:** schema migration, R2 configuration, demo-store seeding, and DNS/TLS are not performed by source changes and remain deployment tasks. No live deployment verification has been recorded.

### Store Builder scope

1. **Persisted editor and store settings**
   - Load and save the selected store's `theme_config` through authenticated store APIs.
   - Persist design tokens: color palette, heading/body font, typography scale, and button style.
   - Persist header options: logo, header background color or image, announcement/sub-top bar text and background color or image.
   - Persist page sections and their order/visibility: hero, image slider, featured products, offers/promotions, collection list, rich text, and footer.
   - Persist footer content and styling, including footer background color or image and an optional section immediately above the footer with its own color or image.
   - Provide sensible defaults and validate uploaded image URLs, colors, font choices, and section settings. Keep layout choices within supported, responsive section templates for v4.2; a free-form drag-and-drop page designer is a later milestone.

2. **Products and pages**
   - Connect the builder's product list and editor to the existing product API, scoped to the selected store. Support create, edit, archive, search, product images, prices, stock, and featured status.
   - Connect page management to `store_pages`: create/edit pages and control whether they are drafts or published.

3. **Draft, preview, and publish**
   - Save edits as a draft configuration and render a private preview from that draft.
   - Publish an immutable snapshot of the store configuration, pages, and the product data needed by the storefront. Public requests must read only the latest published snapshot; saving a draft must not change the live store.
   - Show save/publish state and useful errors in the builder. Require authentication and store ownership for all editing operations.

4. **Database-backed storefront renderer**
   - Build one responsive storefront template that renders the supported sections from published configuration and products.
   - Resolve the store from a subdomain or custom-domain `Host` header, and serve the same template for every store. Keep `/api/storefront/:slug` available for API consumers.
   - Escape merchant content and use safe URL handling when rendering user-provided text, links, and images.

5. **Image uploads**
   - Implement `/api/upload` for authenticated, store-scoped uploads to Cloudflare R2 (logo, header/hero/slider, footer, and product gallery images).
   - Enforce file type and size limits, use non-guessable object keys, and return stable public URLs. Configure R2 credentials and public asset delivery outside source control. Do not publish a placeholder URL on upload failure.

6. **Demo-store migration**
   - Move Miliro and Smeram content and products into the database and render them through the shared storefront template.
   - Preserve their current branding and product imagery, subject to having the source assets and store-owner approval for production publication.

7. **Storefront interactions**
   - Implement contact form and notify-me endpoints backed by `contact_messages` and `notify_requests`, with input validation and rate limiting.

### Original v4.2 delivery plan (reference)

1. Confirm schema/API contracts for draft configuration, published snapshots, pages, and store ownership; add a migration that preserves existing store data.
2. Implement settings and page APIs, then connect the builder's load/save and product CRUD flows.
3. Implement draft preview and publish snapshots; verify draft changes cannot leak to public storefront responses.
4. Implement R2 uploads and wire all builder image controls to returned URLs.
5. Implement the shared renderer and Host-based subdomain/custom-domain resolution; configure wildcard DNS/TLS and deployment routing.
6. Migrate Miliro and Smeram, then connect contact and notify forms.
7. Add basic APIs for customers, invoices/PDF, coupons, and shipping. The remaining merchant operations routes were subsequently implemented as database-backed APIs; integrations and production readiness are tracked under v4.4.

### v4.2 acceptance criteria (deployment verification still required)

- A merchant can reopen the builder and see saved theme, layout, image, product, and page settings from the database.
- Preview reflects draft settings; the public domain remains on the prior published snapshot until Publish is clicked.
- Publish updates the storefront from the database-backed renderer without client-specific HTML files.
- Uploads return usable R2 URLs and are rejected for unsupported types, oversized files, or unauthorized stores.
- A subdomain and a configured custom domain resolve to the correct live store; unknown/unpublished stores return a not-found response.
- Miliro and Smeram render from database records, and contact/notify submissions persist to their intended tables.

## v4.3 — “Make stores ready to sell” (implementation in progress)

**Goal:** let merchants accept and manage orders through payment, invoicing, customer messages, and shipping. This section records the v4.3 scope; production readiness is not established.

**Implemented in this code update:**

1. Storefront cart and checkout UI for COD and Razorpay, including customer/address capture.
2. Checkout-side coupon validation and transactional usage reservation; discount and configured GST rate are included in order totals.
3. Razorpay order creation restricted to ZKCommerce payment orders, signature comparison, provider order/amount verification, webhook raw-body signature validation, and payment-failure recording with retry support.
4. Merchant-configured flat/zone shipping rates, free-shipping thresholds, checkout selection, and manual fulfillment/tracking controls.
5. GSTIN format and state-prefix checks, confirmed-order invoice creation, and downloadable PDF output with recorded subtotal, discount, shipping, and GST totals.
6. Merchant inbox page for contact and back-in-stock messages, with unread/read/resolved status controls.
7. Additive schema migration fields for payment status/failure, coupon discount, GST rate, shipping, inbox status, and shipping rates.

**Still required before calling v4.3 production-ready:**

1. Apply the schema migration and verify the complete flow against a non-production database.
2. Configure live Razorpay keys and webhook secret; verify webhook delivery and payment retries with the provider.
3. Connect at least one courier API for serviceability, live rates, shipment creation, labels, cancellation, and tracking. Current shipping supports merchant-defined rates and manual tracking only; Delhivery credentials are not wired to an adapter.
4. Review GST classifications, place-of-supply rules, invoice numbering, and invoice layout with the merchant's tax/accounting requirements. GSTIN validation here checks format and state prefix, not checksum or legal compliance.
5. Add production error monitoring and alerting, and configure managed PostgreSQL backups plus a tested restore procedure. Source code cannot enable these provider-side services by itself.
6. Verify v4.2 activation prerequisites: R2, wildcard DNS/TLS, custom-domain setup, and Miliro/Smeram seed and storefronts.
7. Finish automated end-to-end and operational release validation before production rollout.

**Exit criteria:** a merchant can publish a configured store, a customer can place an order and complete payment, the merchant can fulfill it with a connected courier, issue an accounting-reviewed invoice, and manage inbox messages; the deployment has alerting and verified backups/restores.

## v4.4 — “Complete merchant operations” (implemented in code; carrier and production integrations remain)

**Goal:** give merchants one place to manage customers, invoices, coupons, fulfillment, and customer requests.

**Implemented in this build:**

1. Merchant Operations page with a shared store selector and Customers, Invoices, Coupons, Shipping, and Inbox views.
2. Customer profiles aggregated from store orders, searchable customer list, full order history, and CSV export.
3. Invoice list search, invoice detail retrieval, issuance from eligible orders, and downloadable PDFs.
4. Coupon create/edit/pause/delete, validation of dates and limits, and checkout-side eligibility/usage handling from v4.3.
5. Shipping rate management and manual fulfillment with guarded status transitions; courier and tracking number are required before marking shipped.
6. Contact and notify inbox management with read/resolved status, search/status filters in the API, and unread counts.
7. Replaced the hard-coded Store Builder demo with an owned-store editor, live database preview, eight built-in configurable storefront themes (Dark Navy, Studio, Botanical, Midnight, Atelier, Market, Playful, and Tech), home/product/collection/content-page selectors, canvas-to-property selection, section ordering/visibility controls, and API-backed product/page workspaces.

**Remaining before production sign-off:**

1. Connect a courier provider for serviceability, live rates, shipment booking, labels, cancellations, and tracking webhooks. Provider credentials and account configuration are deployment inputs; current fulfillment is manual.
2. Review GST classification, place-of-supply, invoice numbering, and PDF requirements with an accountant. Current GSTIN checks validate format/state prefix, not the GST portal registration or all statutory rules.
3. Add persistent customer profile fields such as editable notes/tags and verified merge rules if merchants require them beyond order-derived profiles.
4. Configure and verify live Razorpay/webhook credentials, monitoring, backups, restore, and deployment validation described under v4.3.
5. Prioritize remaining staff, campaigns, affiliates, recurring orders, flash sales, blog, GST reports, loyalty, reviews, metadata, and scheduled jobs from actual merchant usage; their existing APIs are not all complete end-to-end services.
6. A full theme marketplace with multiple independent storefront renderers, reusable saved templates, per-instance duplicated-section settings, and reorderable product/content template sections remains future Store Builder work. Current theme presets adjust shared design tokens and the current templates select page types on one renderer.

**Release goal:** merchants can search customer purchase history, issue and retrieve invoices, manage checkout coupons, fulfill orders manually with tracking, and handle contact/restock requests from a single dashboard. Automated carrier booking and production operation readiness require the remaining integrations above.

## v5.0 (Q1 2027, after ~100 paying merchants)

Next.js SSR storefront, Tally sync, AI product descriptions, affiliates 2.0, marketplace sync, and expanded page-builder layouts.

## v6.0 (2027)

Tamil/Hindi/Telugu storefronts, POS, international payments, and B2B wholesale.
