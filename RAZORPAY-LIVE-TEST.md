# v4.7 — Razorpay live ₹1 test (Smeram Naturals)

Goal: prove a real customer payment works end to end on production — Razorpay → order paid → stock → WhatsApp → refund —
using a hidden ₹1 product that shoppers cannot see in the shop.

---

## 1. Before you push `main`

- [ ] **Railway variables** (Railway → service → Variables):
  - `DATABASE_URL` is the **production** Postgres (not the dev one).
  - `RAZORPAY_KEY_ID` starts with **`rzp_live_`**, and `RAZORPAY_KEY_SECRET` is the matching live secret.
  - `RAZORPAY_WEBHOOK_SECRET` is set; you will paste the same value into Razorpay in step 3.
- [ ] **Back up the production database** (Railway → Postgres → Backups, or `pg_dump`).
- [ ] Know what the first start does: it applies these Postgres migrations once (all add columns or tables, nothing is deleted):
  `001_product_content_fields` … `006_product_unlisted`. Each is recorded in the `zkc_pg_migrations` table.

## 2. Deploy

- [ ] `git push origin main`, then wait for the Railway deploy to go green.
- [ ] `https://smeramnaturals.com/api/health` shows `"status":"ok","db":"connected"`.
- [ ] The Railway log shows `Applied database migrations: …` (first start only) and no errors.
- [ ] The home page, a product page, the cart and the merchant dashboard all load.

## 3. Razorpay dashboard (live mode)

- [ ] The account is **activated for live payments**, and smeramnaturals.com is the approved website.
- [ ] Settings → Webhooks → Add:
  - URL: `https://smeramnaturals.com/api/payments/razorpay/webhook`
  - Events: **payment.captured** and **payment.failed**
  - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`

## 4. Create the hidden ₹1 product (production Store Builder)

- [ ] Products → **Add product**:
  - Name: `Payment Test ₹1 (do not ship)`
  - Price: `1`
  - Stock: `5`
  - Low-stock alert level: `0` (so no low-stock WhatsApp is sent)
  - Offer / discount display: *Hide for this product*
  - **Visibility: Hidden — link only (not listed, still sells)**
- [ ] Save, then **Publish**.
  Publishing also puts any other draft changes live. The dev store's draft currently has *Cash on delivery off*. Check Settings → checkout is how you want it.
- [ ] In the product list it shows **Hidden · link only**. Click **Copy link**: `https://smeramnaturals.com/products/<slug>`.
- [ ] Check that it is really hidden: it is not on the home page, not in any category, and not in search.
- [ ] Settings → checkout: **Pay online via Razorpay** is on.
- [ ] For an exact ₹1 total, GST must be off and there must be no shipping rates (both are off for Smeram today). Otherwise expect GST and shipping on top.

## 5. The test (use your own phone and UPI)

| # | Do | Expect | ✔ |
|---|----|--------|---|
| 1 | Open the copied link, then Add to cart → Checkout with your own name, phone and address. Choose **Pay online**. | The Razorpay window opens for **₹1.00**. | |
| 2 | Pay with UPI. | The success screen appears, and WhatsApp opens with the order for customer care (if hand-off is on). | |
| 3 | Merchant dashboard → Orders | The order is **confirmed / paid** and shows the Razorpay payment id. | |
| 4 | Dashboard → Inventory | The ₹1 product's stock went from **5 to 4**, with an "Order" line in its history. | |
| 5 | Dashboard → WhatsApp → Outbox | The order confirmation and the care alert are there: *sent* if ZKWAConnect is set up, otherwise *pending* with "Send now". | |
| 6 | Razorpay → Payments | ₹1 is **captured**. | |
| 7 | Razorpay → Webhooks → your webhook → deliveries | `payment.captured` returned **200**. | |
| 8 | **Webhook-only path:** buy again, and **close the browser tab as soon as UPI says paid**. | Within a minute the order still becomes **paid** and stock goes 4 → 3. The webhook did it. | |
| 9 | **Failure path:** buy again, then cancel or close the Razorpay window without paying. | The order stays unpaid / failed, no stock is taken, and checking out again works. | |
| 10 | Wrong-key check (optional, any time): the dashboard or checkout shows "Razorpay: Authentication failed (check the Razorpay key id / secret)". | This means the live keys on Railway are wrong. Fix them and redeploy. | |

## 6. After the test

- [ ] Razorpay → Payments → each ₹1 payment → **Refund**.
  ZKCommerce does not get refund events, so step 2 below is manual.
- [ ] Dashboard → Orders → each test order → **Cancelled**. This puts the stock back and keeps the reports clean.
- [ ] Keep the product hidden for future checks, or set Visibility to **Draft**.
- [ ] Note the results:

| Date | Payment id(s) | Paid OK | Webhook 200 | Stock moved | WhatsApp | Refunded |
|------|---------------|---------|-------------|-------------|----------|----------|
|      |               |         |             |             |          |          |

## 7. GoDaddy PHP site (only if Smeram also runs the PHP package)

- Build and upload the new package, then open `/migrate.php` and click **Apply** (back up first in phpMyAdmin).
- Put the live keys and `RAZORPAY_WEBHOOK_SECRET` in `payment_config.php`.
- The Razorpay webhook URL for the PHP site is `https://<domain>/api.php?route=payments/razorpay/webhook`.
- Repeat section 5. Check results in `/admin-orders.php` and `/stock.php` instead of the dashboard.

## If something goes wrong

- Payments fail with an auth error: fix the live keys in Railway, then redeploy.
- The webhook is not 200: check the URL and that the secret is identical on both sides. Razorpay retries failed deliveries.
- You need to roll back: in Railway → Deployments, redeploy the previous build. The migrations only added columns and tables, so the old code still runs on the new database.
