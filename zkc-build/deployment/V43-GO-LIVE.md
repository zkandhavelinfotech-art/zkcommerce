# v4.3 Go-live and recovery runbook

The application code exposes `/health` for an HTTP and PostgreSQL check. It does not provision an uptime monitor, APM service, managed database backup policy, or courier account. Configure those with the production providers before accepting live orders.

## Release sequence

1. Take a provider-managed PostgreSQL snapshot or `pg_dump` backup before applying schema changes.
2. Apply `database/schema.sql` to a staging database with `npm run db:migrate` and verify existing stores and orders remain available.
3. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Register `/api/payments/razorpay/webhook` for `payment.captured` and `payment.failed`; validate both in Razorpay test mode before switching to live credentials.
4. Configure GST settings per store. The application checks GSTIN shape and state prefix; those checks do not validate the checksum or determine tax classification/place of supply. Have the merchant's accountant approve tax settings and invoice output.
5. Configure merchant shipping rates under `/api/shipping/rates`. These rates support flat, postal-prefix, and free-above rules. Fulfillment and tracking can be recorded manually. Courier serviceability, labels, pickup booking, and automated tracking are not connected yet.
6. Configure R2, wildcard DNS/TLS, custom-domain routing, and demo-store content as described in [V42-SETUP.md](V42-SETUP.md).
7. Run a staging purchase for COD and Razorpay, including a valid coupon, invalid/expired coupon, failed payment, retry, invoice download, shipping-rate selection, and inbox status change.

## Monitoring

- Configure an external uptime monitor to check `/health` and alert on non-2xx responses.
- Collect application logs from the process/container and alert on repeated API 5xx responses and payment webhook failures.
- The health endpoint currently checks PostgreSQL connectivity only. It is not a payment, R2, DNS, or courier dependency check.
- Keep live payment and storage credentials in the deployment platform's secret manager, never in source control.

## Backup and recovery

- Enable automated backups and point-in-time recovery at the PostgreSQL provider. Choose retention and recovery time objectives with the business owner.
- Before each schema or release change, take an additional snapshot or export.
- At least quarterly, restore a recent backup into a separate, isolated database and verify stores, products, orders, invoices, and published snapshots. Do not test restoration by overwriting the production database.
- For recovery, provision a new database, restore the selected snapshot, validate row counts and recent orders, update the application `DATABASE_URL` through the secret manager, deploy/restart, then check `/health` and storefront/API reads.
- Keep R2 object storage retention/versioning and a restore/export plan separate from PostgreSQL backups; database snapshots do not contain uploaded image objects.

## Remaining external launch requirements

Live payment credentials and webhook delivery, courier-provider credentials and an implemented adapter, monitoring/alert destinations, managed database backups and a successful restore drill, tax/accounting sign-off, DNS/TLS, and production smoke checks must be completed in the deployment environment. This repository change does not claim those external systems have been activated.
