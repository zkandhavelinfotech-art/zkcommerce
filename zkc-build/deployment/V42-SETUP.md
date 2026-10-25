# v4.2 Store Builder and storefront setup

## 1. Install and migrate

Install the updated project dependencies, register an account using `admin@zkcommerce.in`, then apply `database/schema.sql` through `npm run db:migrate`. The migration adds published snapshots, product SKUs, invoice/coupon tables, and backfills existing published/live stores from their current database records.

To add the Miliro and Smeram demo records, run `database/seed.sql` once after the account exists. The seed promotes that account to admin while retaining its registered password. The two stores are created as drafts so an operator can review them before publishing. Smeram's existing embedded product photos are stored under `/assets`; Miliro has no embedded product photos in its source page.

## 2. Configure R2 uploads

Set these server-side environment values:

```text
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=https://cdn.example.com
```

The R2 bucket must permit the API to write objects and the configured public URL must serve those objects over HTTPS. Uploads are limited to JPEG, PNG, WebP, GIF, or AVIF files up to 5 MB. The builder calls `POST /api/upload/:storeId` with a multipart `file` field.

## 3. Configure store domains

Set `STORE_BASE_DOMAIN=zkcommerce.in`. Point the wildcard `*.zkcommerce.in` record and `stores.zkcommerce.in` to the running Express service, and provision wildcard TLS at the proxy/hosting layer. For custom domains, merchants configure a CNAME to `stores.zkcommerce.in`; the hosting layer must also accept that host and provision TLS. The API resolves the store from the request `Host` header once those DNS and TLS steps are complete.

## 4. Open the builder

With the API running, open `/store-builder/` and sign in first so `zk_token` is present in local storage. If the builder is hosted on a different origin from the API, set `window.ZK_API_BASE` to the API's `/api` URL before loading the builder, or pass `?apiBase=https://api.example.com/api`.

Draft settings, products, and pages are private to the authenticated store owner. `POST /api/stores/:id/publish` captures the public snapshot; public requests read only that snapshot. Existing `published`/`live` v4.1 stores receive a one-time snapshot during migration.

## 5. Public endpoints

- `GET /api/storefront/:slug` returns the published snapshot as JSON.
- `POST /api/notify/:slug/contact` saves a contact message.
- `POST /api/notify/:slug/notify` saves a restock notification request.
- `GET /` on a store subdomain or configured custom domain returns the shared server-rendered storefront.
- Published custom pages render at `/page/:slug`.

Customers, invoice PDF, coupon, and shipping endpoints are available under their corresponding `/api` route modules and are scoped to stores owned by the authenticated merchant.
