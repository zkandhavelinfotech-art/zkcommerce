const router    = require('express').Router();
const pool      = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { renderStore } = require('../store-renderer');

// GET /api/admin/stores?status=draft|published|live
router.get('/stores', adminAuth, async (req, res) => {
  try {
    const status = req.query.status;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    if (status && !['draft','published','live','suspended'].includes(status))
      return res.status(400).json({ error: 'Invalid store status filter' });
    const params = [limit, (page - 1) * limit];
    let where = '';
    if (status) { where = 'WHERE s.status=$3'; params.push(status); }
    const { rows } = await pool.query(`
      SELECT s.id, s.store_name, s.slug, s.custom_domain, s.status, s.theme_name,
             s.created_at, s.published_at, m.name AS merchant_name, m.email AS merchant_email,
             COUNT(DISTINCT p.id)::int AS product_count, COUNT(DISTINCT o.id)::int AS order_count
      FROM stores s JOIN merchants m ON m.id=s.merchant_id
      LEFT JOIN products p ON p.store_id=s.id AND p.active=true
      LEFT JOIN orders   o ON o.store_id=s.id
      ${where} GROUP BY s.id, m.name, m.email
      ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`, params);
    const { rows: [t] } = await pool.query(`
      SELECT COUNT(*)::int total,
             COUNT(*) FILTER (WHERE status='draft')::int draft,
             COUNT(*) FILTER (WHERE status='published')::int published,
             COUNT(*) FILTER (WHERE status='live')::int live FROM stores`);
    res.json({ stores: rows, summary: t, pagination: { page, limit } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin-only preview of either the current draft or published snapshot.
router.get('/stores/:id/preview', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid store id' });
    const version = req.query.version === 'published' ? 'published' : 'draft';
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    const store = rows[0];
    let data;
    if (version === 'published') {
      if (!store.published_snapshot) return res.status(409).json({ error: 'This store has no published snapshot' });
      data = store.published_snapshot;
    } else {
      const [products, pages] = await Promise.all([
        pool.query('SELECT * FROM products WHERE store_id=$1 AND active=true ORDER BY featured DESC,created_at DESC', [id]),
        pool.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order,id', [id])
      ]);
      data = { store, theme_config: store.theme_config || {}, products: products.rows, pages: pages.rows };
    }
    res.set('Cache-Control', 'no-store').type('html').send(renderStore(data, { showContact: true }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/stores/:id/status  — admin approves published → live
router.put('/stores/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft','published','live','suspended'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    const { rows } = await pool.query(
      `UPDATE stores SET status=$1, updated_at=NOW(),
         published_at = CASE WHEN $1 IN ('published','live') THEN COALESCE(published_at,NOW()) ELSE published_at END
       WHERE id=$2 RETURNING id, store_name, slug, status`, [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    res.json({ store: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
