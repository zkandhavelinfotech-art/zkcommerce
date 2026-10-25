/**
 * ZKCommerce v4.1 — Phase 2 Routes
 * Variants, Warehouses, Campaigns, Subscriptions, Wishlists, Reviews
 * Sprint 2-4 features
 */

'use strict';

module.exports = function registerPhase2Routes(
  app, db, verifyToken, requireRole,
  asyncHandler, paginate, validate, schemas, respond, err
) {

  // ── PRODUCT VARIANTS ─────────────────────────────────────────────
  app.get('/api/products/:id/variants', verifyToken, asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM product_variants WHERE product_id=$1 ORDER BY sort_order',
      [req.params.id]
    );
    respond(res, { variants: rows });
  }));

  app.post('/api/products/:id/variants', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { name, sku, price, stock, attributes } = req.body;
    const { rows: [v] } = await db.query(
      `INSERT INTO product_variants (product_id, name, sku, price, stock, attributes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [req.params.id, name, sku, price, stock || 0, JSON.stringify(attributes || {})]
    );
    respond(res, { variant: v }, 201);
  }));

  app.put('/api/products/:id/variants/:vid', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { name, price, stock, sku } = req.body;
    const { rows: [v] } = await db.query(
      `UPDATE product_variants SET
         name=COALESCE($1,name), price=COALESCE($2,price),
         stock=COALESCE($3,stock), sku=COALESCE($4,sku)
       WHERE id=$5 AND product_id=$6 RETURNING *`,
      [name, price, stock, sku, req.params.vid, req.params.id]
    );
    if (!v) return err(res, 'Variant not found', 404);
    respond(res, { variant: v });
  }));

  app.delete('/api/products/:id/variants/:vid', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    await db.query('DELETE FROM product_variants WHERE id=$1 AND product_id=$2', [req.params.vid, req.params.id]);
    respond(res, { message: 'Variant deleted' });
  }));

  // ── WAREHOUSES ───────────────────────────────────────────────────
  app.get('/api/warehouses', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT w.*, COUNT(ws.product_id) as product_count FROM warehouses w LEFT JOIN warehouse_stock ws ON ws.warehouse_id=w.id WHERE w.store_id=$1 GROUP BY w.id ORDER BY w.is_primary DESC',
      [req.user.store_id]
    );
    respond(res, { warehouses: rows });
  }));

  app.post('/api/warehouses', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { name, address, city, pincode, is_primary } = req.body;
    if (is_primary) {
      await db.query('UPDATE warehouses SET is_primary=false WHERE store_id=$1', [req.user.store_id]);
    }
    const { rows: [w] } = await db.query(
      `INSERT INTO warehouses (store_id, name, address, city, pincode, is_primary, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [req.user.store_id, name, address, city, pincode, is_primary || false]
    );
    respond(res, { warehouse: w }, 201);
  }));

  app.get('/api/warehouses/:id/stock', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT ws.*, p.name, p.slug, p.price
       FROM warehouse_stock ws
       JOIN products p ON p.id=ws.product_id
       WHERE ws.warehouse_id=$1 AND p.store_id=$2
       ORDER BY p.name`,
      [req.params.id, req.user.store_id]
    );
    respond(res, { stock: rows });
  }));

  app.put('/api/warehouses/:id/stock/:productId', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { stock } = req.body;
    await db.query(
      `INSERT INTO warehouse_stock (warehouse_id, product_id, stock, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (warehouse_id, product_id) DO UPDATE SET stock=$3, updated_at=NOW()`,
      [req.params.id, req.params.productId, stock]
    );
    respond(res, { message: 'Stock updated' });
  }));

  // ── CAMPAIGNS ────────────────────────────────────────────────────
  app.get('/api/campaigns', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT c.*, COUNT(cr.id) as recipient_count,
              COUNT(CASE WHEN cr.status='opened' THEN 1 END) as opened_count
       FROM campaigns c
       LEFT JOIN campaign_recipients cr ON cr.campaign_id=c.id
       WHERE c.store_id=$1
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [req.user.store_id]
    );
    respond(res, { campaigns: rows });
  }));

  app.post('/api/campaigns', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { name, type, subject, content, audience, scheduled_at } = req.body;
    const { rows: [c] } = await db.query(
      `INSERT INTO campaigns (store_id, name, type, subject, content, audience, status, scheduled_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,NOW()) RETURNING *`,
      [req.user.store_id, name, type, subject, content, JSON.stringify(audience || {}), scheduled_at || null]
    );
    respond(res, { campaign: c }, 201);
  }));

  app.post('/api/campaigns/:id/send', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows: [c] } = await db.query(
      'SELECT * FROM campaigns WHERE id=$1 AND store_id=$2',
      [req.params.id, req.user.store_id]
    );
    if (!c) return err(res, 'Campaign not found', 404);
    if (c.status === 'sent') return err(res, 'Campaign already sent');

    // Get recipients
    const { rows: customers } = await db.query(
      'SELECT DISTINCT u.id, u.email, u.name, u.phone FROM orders o JOIN users u ON u.id=o.user_id WHERE o.store_id=$1',
      [req.user.store_id]
    );

    // Queue sends (in production: use BullMQ)
    let sent = 0;
    for (const customer of customers) {
      await db.query(
        `INSERT INTO campaign_recipients (campaign_id, user_id, status, created_at)
         VALUES ($1,$2,'queued',NOW()) ON CONFLICT DO NOTHING`,
        [c.id, customer.id]
      );
      sent++;
    }

    await db.query(
      "UPDATE campaigns SET status='sent', sent_at=NOW(), sent_count=$1 WHERE id=$2",
      [sent, c.id]
    );
    respond(res, { sent, message: `Campaign queued for ${sent} recipients` });
  }));

  app.get('/api/campaigns/:id/analytics', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows: [stats] } = await db.query(
      `SELECT
         COUNT(*) as total_recipients,
         COUNT(CASE WHEN status='opened'   THEN 1 END) as opened,
         COUNT(CASE WHEN status='clicked'  THEN 1 END) as clicked,
         COUNT(CASE WHEN status='bounced'  THEN 1 END) as bounced,
         COUNT(CASE WHEN status='sent'     THEN 1 END) as delivered
       FROM campaign_recipients WHERE campaign_id=$1`,
      [req.params.id]
    );
    respond(res, { analytics: stats });
  }));

  // ── SUBSCRIPTIONS ────────────────────────────────────────────────
  app.get('/api/subscriptions/current', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows: [sub] } = await db.query(
      `SELECT s.*, st.name as store_name, st.plan, st.trial_ends_at
       FROM subscriptions s
       JOIN stores st ON st.id=s.store_id
       WHERE s.store_id=$1 AND s.status='active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.store_id]
    );
    const planLimits = {
      starter: { products: 100, staff: 1, price: 399 },
      growth:  { products: -1, staff: -1, price: 799 },
      enterprise: { products: -1, staff: -1, price: 1999 },
    };
    const { rows: [store] } = await db.query('SELECT plan, trial_ends_at FROM stores WHERE id=$1', [req.user.store_id]);
    respond(res, {
      subscription: sub || null,
      plan: store.plan,
      limits: planLimits[store.plan] || planLimits.starter,
      trial_ends_at: store.trial_ends_at,
      is_trial: store.trial_ends_at > new Date(),
    });
  }));

  app.post('/api/subscriptions/upgrade', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { plan } = req.body;
    const validPlans = ['starter','growth','enterprise'];
    if (!validPlans.includes(plan)) return err(res, 'Invalid plan');
    const prices = { starter: 399, growth: 799, enterprise: 1999 };
    // Create Razorpay subscription order
    respond(res, {
      plan,
      amount: prices[plan],
      message: `Upgrade to ${plan} plan — ₹${prices[plan]}/month`,
      razorpay_plan_id: `plan_${plan}_monthly`,
    });
  }));

  app.get('/api/subscriptions/invoices', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM subscription_invoices WHERE store_id=$1 ORDER BY created_at DESC',
      [req.user.store_id]
    );
    respond(res, { invoices: rows });
  }));

  // ── WISHLISTS ────────────────────────────────────────────────────
  app.get('/api/wishlist', verifyToken, asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT w.id, p.id as product_id, p.name, p.price, p.mrp, p.slug, p.stock,
              (SELECT url FROM product_images WHERE product_id=p.id LIMIT 1) as image_url
       FROM wishlists w JOIN products p ON p.id=w.product_id
       WHERE w.user_id=$1 ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    respond(res, { items: rows });
  }));

  app.post('/api/wishlist', verifyToken, asyncHandler(async (req, res) => {
    const { product_id } = req.body;
    await db.query(
      `INSERT INTO wishlists (user_id, product_id, created_at) VALUES ($1,$2,NOW())
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [req.user.id, product_id]
    );
    respond(res, { message: 'Added to wishlist' });
  }));

  app.delete('/api/wishlist/:productId', verifyToken, asyncHandler(async (req, res) => {
    await db.query('DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
    respond(res, { message: 'Removed from wishlist' });
  }));

  // ── REVIEWS ──────────────────────────────────────────────────────
  app.get('/api/products/:id/reviews', asyncHandler(async (req, res) => {
    const { limit, offset } = paginate(req.query.page, req.query.limit);
    const { rows } = await db.query(
      `SELECT r.*, u.name as reviewer_name
       FROM reviews r JOIN users u ON u.id=r.user_id
       WHERE r.product_id=$1 AND r.status='approved'
       ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    const { rows: [stats] } = await db.query(
      `SELECT ROUND(AVG(rating),1) as avg_rating, COUNT(*) as total
       FROM reviews WHERE product_id=$1 AND status='approved'`,
      [req.params.id]
    );
    respond(res, { reviews: rows, stats });
  }));

  app.post('/api/products/:id/reviews', verifyToken, asyncHandler(async (req, res) => {
    const { rating, title, body } = req.body;
    if (!rating || rating < 1 || rating > 5) return err(res, 'Rating must be 1-5');
    const { rows: [r] } = await db.query(
      `INSERT INTO reviews (product_id, user_id, rating, title, body, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending',NOW()) RETURNING *`,
      [req.params.id, req.user.id, rating, title, body]
    );
    respond(res, { review: r, message: 'Review submitted for approval' }, 201);
  }));

  app.put('/api/reviews/:id/status', verifyToken, requireRole('merchant','admin'), asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['approved','rejected','flagged'].includes(status)) return err(res, 'Invalid status');
    const { rows: [r] } = await db.query(
      "UPDATE reviews SET status=$1, moderated_at=NOW() WHERE id=$2 RETURNING *",
      [status, req.params.id]
    );
    respond(res, { review: r });
  }));

  // ── STAFF MANAGEMENT ─────────────────────────────────────────────
  app.get('/api/staff', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT ss.*, u.name, u.email, u.phone, u.last_login
       FROM store_staff ss JOIN users u ON u.id=ss.user_id
       WHERE ss.store_id=$1 ORDER BY ss.created_at DESC`,
      [req.user.store_id]
    );
    respond(res, { staff: rows });
  }));

  app.post('/api/staff/invite', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { email, role, permissions } = req.body;
    // Check if user exists
    const { rows: [existing] } = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    const token = require('crypto').randomBytes(32).toString('hex');
    if (existing) {
      await db.query(
        `INSERT INTO store_staff (store_id, user_id, role, permissions, invite_token, status, created_at)
         VALUES ($1,$2,$3,$4,$5,'pending',NOW())
         ON CONFLICT (store_id, user_id) DO UPDATE SET role=$3, status='pending'`,
        [req.user.store_id, existing.id, role, JSON.stringify(permissions || {}), token]
      );
    }
    respond(res, { message: `Invite sent to ${email}`, token });
  }));

  app.delete('/api/staff/:userId', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    await db.query(
      'DELETE FROM store_staff WHERE store_id=$1 AND user_id=$2 AND role!=\'owner\'',
      [req.user.store_id, req.params.userId]
    );
    respond(res, { message: 'Staff removed' });
  }));

  // ── PAYOUTS ──────────────────────────────────────────────────────
  app.get('/api/payouts', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    // In production: query payouts table + Razorpay X API
    const { rows } = await db.query(
      `SELECT DATE_TRUNC('week', created_at) as period,
              SUM(total) as amount,
              COUNT(*) as order_count,
              'settled' as status
       FROM orders
       WHERE store_id=$1 AND status='delivered'
         AND payment_method != 'cod'
       GROUP BY DATE_TRUNC('week', created_at)
       ORDER BY period DESC LIMIT 12`,
      [req.user.store_id]
    );
    const { rows: [pending] } = await db.query(
      `SELECT COALESCE(SUM(total),0) as amount, COUNT(*) as orders
       FROM orders WHERE store_id=$1 AND status='processing' AND payment_status='paid'`,
      [req.user.store_id]
    );
    respond(res, { payouts: rows, pending_payout: pending });
  }));

  // ── RETURNS ──────────────────────────────────────────────────────
  app.get('/api/returns', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT o.id as order_id, o.user_id, o.total,
              u.name as customer_name, u.phone,
              'return_requested' as return_status
       FROM orders o JOIN users u ON u.id=o.user_id
       WHERE o.store_id=$1 AND o.status='return_requested'
       ORDER BY o.updated_at DESC`,
      [req.user.store_id]
    );
    respond(res, { returns: rows });
  }));

  app.put('/api/returns/:orderId/status', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { status, rejection_reason } = req.body;
    const validStatuses = ['return_approved','return_rejected','refunded'];
    if (!validStatuses.includes(status)) return err(res, 'Invalid return status');
    await db.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND store_id=$3',
      [status, req.params.orderId, req.user.store_id]
    );
    respond(res, { message: `Return ${status.replace('return_', '')}` });
  }));

  // ── COUPONS ──────────────────────────────────────────────────────
  app.get('/api/coupons', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM coupons WHERE store_id=$1 ORDER BY created_at DESC',
      [req.user.store_id]
    );
    respond(res, { coupons: rows });
  }));

  app.post('/api/coupons', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const d = req.body;
    const { rows: [c] } = await db.query(
      `INSERT INTO coupons (store_id, code, type, value, min_order, max_uses, is_active, expires_at, description, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,NOW()) RETURNING *`,
      [req.user.store_id, d.code?.toUpperCase(), d.type, d.value, d.min_order || 0,
       d.max_uses || null, d.expires_at || null, d.description || '']
    );
    respond(res, { coupon: c }, 201);
  }));

  app.put('/api/coupons/:id', verifyToken, requireRole('merchant'), asyncHandler(async (req, res) => {
    const { is_active, expires_at, max_uses } = req.body;
    const { rows: [c] } = await db.query(
      `UPDATE coupons SET is_active=COALESCE($1,is_active),
         expires_at=COALESCE($2,expires_at), max_uses=COALESCE($3,max_uses)
       WHERE id=$4 AND store_id=$5 RETURNING *`,
      [is_active, expires_at, max_uses, req.params.id, req.user.store_id]
    );
    respond(res, { coupon: c });
  }));

  // ── NOTIFICATIONS ────────────────────────────────────────────────
  app.get('/api/notifications', verifyToken, asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT * FROM notifications WHERE user_id=$1
       ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    respond(res, { notifications: rows });
  }));

  app.put('/api/notifications/:id/read', verifyToken, asyncHandler(async (req, res) => {
    await db.query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    respond(res, { message: 'Marked as read' });
  }));

  // ── SITEMAP ──────────────────────────────────────────────────────
  app.get('/api/sitemap/:slug', asyncHandler(async (req, res) => {
    const { rows: [store] } = await db.query('SELECT id FROM stores WHERE slug=$1', [req.params.slug]);
    if (!store) return err(res, 'Store not found', 404);
    const { rows: products } = await db.query(
      "SELECT slug, updated_at FROM products WHERE store_id=$1 AND status='published'",
      [store.id]
    );
    const baseUrl = `https://${req.params.slug}.zkcommerce.in`;
    const urls = [
      `<url><loc>${baseUrl}</loc><changefreq>daily</changefreq></url>`,
      ...products.map(p =>
        `<url><loc>${baseUrl}/p/${p.slug}</loc><lastmod>${p.updated_at?.toISOString().split('T')[0]}</lastmod><changefreq>weekly</changefreq></url>`
      ),
    ];
    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  }));

  console.log('  Phase 2 routes loaded: variants, warehouses, campaigns, subscriptions, wishlists, reviews, staff, payouts, returns, coupons, notifications, sitemap');
};
