const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

async function ownedStore(req) {
  const storeId = Number((req.body || {}).store_id || req.query.store_id || req.user.store_id);
  if (!Number.isInteger(storeId) || storeId < 1) return null;
  const { rows } = await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2', [storeId, req.user.id]);
  return rows[0] || null;
}

function categorySlug(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

router.get('/', auth, async (req, res) => {
  try {
    const store = await ownedStore(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const { rows } = await pool.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order,name,id', [store.id]);
    res.json({ categories: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const store = await ownedStore(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const name = String(req.body.name || '').trim();
    const slug = categorySlug(name);
    const imageUrl = req.body.image_url ? String(req.body.image_url).trim() : null;
    if (!name || name.length > 120 || !slug) return res.status(400).json({ error: 'A category name up to 120 characters is required' });
    const exists = await pool.query('SELECT id FROM categories WHERE store_id=$1 AND slug=$2', [store.id, slug]);
    if (exists.rowCount) return res.status(409).json({ error: 'A category with this name already exists' });
    const { rows } = await pool.query('INSERT INTO categories (store_id,name,slug,image_url) VALUES ($1,$2,$3,$4) RETURNING *', [store.id, name, slug, imageUrl]);
    res.status(201).json({ category: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const store = await ownedStore(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const current = await pool.query('SELECT * FROM categories WHERE id=$1 AND store_id=$2', [req.params.id, store.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Category not found' });
    const cat = current.rows[0];

    let name = cat.name;
    let slug = cat.slug;
    if (req.body.name !== undefined) {
      name = String(req.body.name || '').trim();
      slug = categorySlug(name);
      if (!name || name.length > 120 || !slug) return res.status(400).json({ error: 'A category name up to 120 characters is required' });
      const exists = await pool.query('SELECT id FROM categories WHERE store_id=$1 AND slug=$2 AND id<>$3', [store.id, slug, req.params.id]);
      if (exists.rowCount) return res.status(409).json({ error: 'A category with this name already exists' });
    }

    let imageUrl = cat.image_url;
    if (req.body.image_url !== undefined) {
      imageUrl = req.body.image_url ? String(req.body.image_url).trim() : null;
    }

    const { rows } = await pool.query('UPDATE categories SET name=$3,slug=$4,image_url=$5 WHERE id=$1 AND store_id=$2 RETURNING *', [req.params.id, store.id, name, slug, imageUrl]);
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ category: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const store = await ownedStore(req);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id=$1 AND store_id=$2', [req.params.id, store.id]);
    if (!rowCount) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted. Products were kept and are now uncategorized.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
