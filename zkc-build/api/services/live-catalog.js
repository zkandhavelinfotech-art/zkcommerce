// Live catalogue (v4.8): product, category, page and stock changes go to the shop at once, like Shopify.
// Only the catalogue part of the published snapshot is refreshed; theme/design edits stay in the draft until Publish.
const pool = require('../db');

/** Rebuild products / categories / pages of one published store from the database (same queries as Publish). */
async function refreshLiveCatalog(storeId, db = pool) {
  const [products, pages, categories] = await Promise.all([
    db.query('SELECT p.*,c.name AS category_name,c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC,p.created_at DESC', [storeId]),
    db.query("SELECT * FROM store_pages WHERE store_id=$1 AND status='published' ORDER BY sort_order,id", [storeId]),
    db.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order,name,id', [storeId])
  ]);
  await db.query(
    `UPDATE stores SET published_snapshot = published_snapshot || jsonb_build_object('products', $2::jsonb, 'pages', $3::jsonb, 'categories', $4::jsonb, 'catalog_updated_at', to_jsonb(NOW()))
     WHERE id=$1 AND published_snapshot IS NOT NULL`,
    [storeId, JSON.stringify(products.rows), JSON.stringify(pages.rows), JSON.stringify(categories.rows)]);
}

/** Refresh every published store of a merchant (they have a handful; this keeps routes free of store bookkeeping). */
async function refreshMerchantStores(user) {
  const { rows } = user.role === 'admin' && user.store_id
    ? await pool.query('SELECT id FROM stores WHERE id=$1 AND published_snapshot IS NOT NULL', [user.store_id])
    : await pool.query('SELECT id FROM stores WHERE merchant_id=$1 AND published_snapshot IS NOT NULL', [user.id]);
  for (const r of rows) await refreshLiveCatalog(r.id);
}

/**
 * Express middleware for catalogue routes: after a successful change (non-GET, 2xx), refresh the live catalogue
 * before the response is sent, so the shop shows the change as soon as the dashboard says "saved".
 */
function liveCatalog(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const json = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 300 || !req.user) return json(body);
    refreshMerchantStores(req.user)
      .catch(e => console.warn('[live catalogue] refresh failed:', e.message))
      .finally(() => json(body));
    return res;
  };
  next();
}

module.exports = { refreshLiveCatalog, refreshMerchantStores, liveCatalog };
