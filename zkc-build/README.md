# ZKCommerce v4.4.0
Smart Commerce. Limitless Growth. — ZKandavel Infotech Pvt Ltd

## Run locally
    npm install
    cp .env.example .env        # set DATABASE_URL and JWT_SECRET
    npm run db:migrate
    npm run dev                 # http://localhost:3000/
    # Execute database/seed.sql to create local demo merchant/admin accounts and stores
    # Marketing home: http://localhost:3000/
    # Register/sign in: http://localhost:3000/auth/register.html (or /auth/login.html)
    # Store Builder: http://localhost:3000/store-builder/ (requires a saved login)
    # Merchant inbox: http://localhost:3000/merchant/inbox.html (requires a saved login)
    # Merchant operations: http://localhost:3000/merchant/operations.html (requires a saved login)
    # Shipping and fulfillment: http://localhost:3000/merchant/shipping.html (requires a saved login)
    # Platform admin dashboard: http://localhost:3000/admin/dashboard.html (admin role required)

`npm run dev` explicitly selects development mode, loads the local `.env`, and defaults to port 3000. If 3000 is already occupied, stop the earlier server or set `PORT=3001` in `.env`; the API and browser pages must use the same port. `npm start` explicitly selects production mode and loads `.env.production` if present. On a hosting platform, keep production secrets in its environment settings and let it provide the internal `PORT`. Set `FRONTEND_URL` to the public HTTPS app URL; visitors use that URL without adding the internal port. See `.env.production.example` for the separate production settings.

After merchant registration, the merchant chooses a storefront design and names the store in the setup wizard before the first store is created. The wizard includes Smeram Naturals and Miliro reference designs plus reusable starter themes; each choice is copied into the merchant's editable store theme. Existing merchants with a store continue to Store Builder after login. Admin accounts are sent to the platform admin dashboard, where they can inspect recent stores and preview draft or published storefronts. If you open either page without a saved session, it redirects to login. The API health endpoint is http://localhost:3000/health.

The Store Builder loads only stores owned by the signed-in merchant. Its Theme workspace offers eight built-in configurable storefront themes (Dark Navy, Studio, Botanical, Midnight, Atelier, Market, Playful, and Tech); the setup wizard also offers Smeram Naturals and Miliro inspired starter designs. The preview selector switches among home, product, collection, and content page templates. Each design uses the merchant's own store catalog and shared cart/checkout, and the merchant can edit brand colors, text, images, products, and page sections. Home page sections can be reordered or hidden, and settings open when a supported section is selected in the sidebar or preview canvas. Product and collection templates have their own editable settings; content page text is edited as a page resource. Product categories are optional: create them from Products → Manage categories or directly in the product form, then assign products to them. The Smeram Naturals demo includes Hair Care Oil, Joint Pain & Orthocare, Ayurgold Face Care, and Health Foods.

Local demo logins after running `database/seed.sql`:

| Account | Email | Password | Store |
|---|---|---|---|
| Miliro merchant | `merchant@miliro.in` | `demo1234` | Miliro |
| Smeram merchant | `merchant@smeramnaturals.in` | `demo1234` | Smeram Naturals |
| Demo merchant | `merchant@zkdemo.in` | `demo1234` | ZK Demo Market |
| Product owner admin | `admin@zkcommerce.in` | `demo1234` | Admin dashboard |

These demo credentials are for local development only. All three demo stores start as drafts. On localhost, the login page shows one-click sign-in choices that fill the credentials and log in automatically. Merchants can edit their own store and products in Store Builder; the product owner account opens the admin dashboard. Running the local seed resets the demo admin password to `demo1234`.

## Structure
    api/            Express API (routes/, middleware/)
    database/       schema.sql, seed.sql
    deployment/     migration script, deploy guide, v4.2 setup
    store-builder/  API-connected CMS editor
    clients/        original Miliro and Smeram demo source pages
    auth/           login / register pages
    *.html          marketing site and themes

## Release status
v4.4 adds a unified merchant operations dashboard with searchable customer profiles derived from orders, customer order history and CSV export, invoice search/retrieval/PDF download, coupon creation/editing/eligibility controls, manual shipment fulfillment with guarded status transitions, and a merchant inbox with status filters and unread counts. Courier booking and carrier labels are not connected; configure a provider adapter and credentials before enabling those carrier actions. GST validation remains format/state-prefix validation and needs accounting review for statutory production use. Apply the schema with `npm run db:migrate` when setting up a fresh database; this release adds no database migration. See [ROADMAP.md](ROADMAP.md), [deployment/V43-GO-LIVE.md](deployment/V43-GO-LIVE.md), and [deployment/V42-SETUP.md](deployment/V42-SETUP.md).
