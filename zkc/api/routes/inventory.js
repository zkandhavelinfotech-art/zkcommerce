// Inventory: stock per product / variant, manual adjustments, history, low-stock level.
const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const inventory = require('../services/inventory');

async function storeFor(req) {
  const id = Number((req.body && req.body.store_id) || req.query.store_id || req.user.store_id);
  const admin = req.user.role === 'admin';
  const { rows } = Number.isSafeInteger(id) && id > 0
    ? await pool.query('SELECT id FROM stores WHERE id=$1 AND ($2::boolean OR merchant_id=$3)', [id, admin, req.user.id])
    : await pool.query('SELECT id FROM stores WHERE ($1::boolean OR merchant_id=$2) ORDER BY id LIMIT 1', [admin, req.user.id]);
  return rows[0] || null;
}
const fail = (res, e) => res.status(e.status || 500).json({ error: e.message });

router.get('/', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(await inventory.overview(store.id));
  } catch (e) { fail(res, e); }
});

router.put('/settings', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ settings: await inventory.saveSettings(store.id, req.body || {}) });
  } catch (e) { fail(res, e); }
});

// Set the stock of a product (or one variant) to an exact count, e.g. after a stock-take or delivery.
router.put('/:productId/stock', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const result = await inventory.setStock(store.id, Number(req.params.productId), req.body.variant_id || null, req.body.quantity, req.body.note);
    if (!result) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true, ...result });
  } catch (e) { fail(res, e); }
});

router.get('/movements', auth, async (req, res) => {
  try {
    const store = await storeFor(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const params = [store.id];
    let where = 'm.store_id=$1';
    if (req.query.product_id) { params.push(Number(req.query.product_id)); where += ` AND m.product_id=$${params.length}`; }
    const { rows } = await pool.query(`SELECT m.*, p.name AS product_name, o.order_number FROM inventory_movements m
      JOIN products p ON p.id = m.product_id LEFT JOIN orders o ON o.id = m.order_id
      WHERE ${where} ORDER BY m.created_at DESC LIMIT 200`, params);
    res.json({ movements: rows });
  } catch (e) { fail(res, e); }
});

module.exports = router;
