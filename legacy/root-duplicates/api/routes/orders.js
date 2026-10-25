const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');
const whatsapp = require('../services/whatsapp');

async function storeFor(req) {
  const requested = Number((req.body && req.body.store_id) || req.query.store_id || req.user.store_id);
  const admin = req.user.role === 'admin';
  if (Number.isSafeInteger(requested) && requested > 0) {
    const { rows } = await pool.query(
      'SELECT id, store_name, slug, whatsapp_number FROM stores WHERE id=$1 AND ($2::boolean OR merchant_id=$3)',
      [requested, admin, req.user.id]
    );
    if (rows.length) return rows[0];
  }
  const { rows } = await pool.query(
    'SELECT id, store_name, slug, whatsapp_number FROM stores WHERE ($1::boolean OR merchant_id=$2) ORDER BY id LIMIT 1',
    [admin, req.user.id]
  );
  return rows[0] || null;
}

// Summary metrics for merchant dashboard overview
router.get('/metrics', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const [stats, recent, inbox] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','failed') THEN total_amount ELSE 0 END),0)::numeric AS total_revenue,
        COUNT(CASE WHEN status IN ('confirmed','processing') THEN 1 END)::int AS pending_fulfillment,
        COUNT(CASE WHEN status='shipped' THEN 1 END)::int AS shipped_count,
        COUNT(CASE WHEN status='delivered' THEN 1 END)::int AS delivered_count
        FROM orders WHERE store_id=$1`, [store.id]),
      pool.query('SELECT * FROM orders WHERE store_id=$1 ORDER BY created_at DESC LIMIT 5', [store.id]),
      pool.query(`SELECT
        (SELECT COUNT(*) FROM contact_messages WHERE store_id=$1 AND inbox_status='unread')::int AS unread_contact,
        (SELECT COUNT(*) FROM notify_requests WHERE store_id=$1 AND inbox_status='unread')::int AS unread_notify`, [store.id])
    ]);

    res.json({
      store,
      metrics: stats.rows[0],
      recent_orders: recent.rows,
      unread: inbox.rows[0]
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE o.store_id=$1';
    const params = [store.id];
    let idx = 2;

    if (status && status !== 'all') {
      where += ` AND o.status=$${idx++}`;
      params.push(status);
    }
    if (search && String(search).trim()) {
      where += ` AND (o.order_number ILIKE $${idx} OR o.customer_name ILIKE $${idx} OR o.customer_phone ILIKE $${idx} OR o.customer_email ILIKE $${idx})`;
      params.push(`%${String(search).trim()}%`);
      idx++;
    }

    const { rows } = await pool.query(
      `SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );
    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM orders o ${where}`, params);

    res.json({ orders: rows, pagination: { page: Number(page), limit: Number(limit), total: Number(count) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1 AND store_id=$2', [req.params.id, store.id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/status', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const { status, tracking_number, courier } = req.body;
    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { rows } = await pool.query(
      `UPDATE orders SET status=$3, tracking_number=COALESCE($4, tracking_number), courier=COALESCE($5, courier), updated_at=NOW()
       WHERE id=$1 AND store_id=$2 RETURNING *`,
      [req.params.id, store.id, status, tracking_number || null, courier || null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });

    // If marked shipped, notify customer on WhatsApp
    if (status === 'shipped') {
      try {
        await whatsapp.sendOrderTrackingNotification({ order: rows[0], store });
      } catch (waErr) {
        console.warn('[Orders Status WhatsApp] Warning:', waErr.message);
      }
    }

    res.json({ order: rows[0], message: `Order updated to ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/invoice', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const { rows } = await pool.query(
      `SELECT o.*, s.store_name, s.gst_number, s.address, s.state FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=$1 AND o.store_id=$2`,
      [req.params.id, store.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ invoice: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
