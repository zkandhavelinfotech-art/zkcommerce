const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

// Auto-migrate additional columns if not exists
(async function initProductColumns() {
  try {
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS user_instructions TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_note TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 100");
  } catch (e) {
    // Ignore migration error if already exists or db not ready
  }
})();

async function ownedStore(req) {
  const storeId = Number((req.body || {}).store_id || req.query.store_id || req.user.store_id);
  if (!Number.isInteger(storeId) || storeId < 1) return null;
  const { rows } = await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2',[storeId,req.user.id]);
  return rows[0] || null;
}

async function categoryForStore(categoryId, storeId) {
  if (categoryId === null || categoryId === undefined || categoryId === '') return null;
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) return false;
  const { rowCount } = await pool.query('SELECT id FROM categories WHERE id=$1 AND store_id=$2', [id, storeId]);
  return rowCount ? id : false;
}

// GET /api/products
router.get('/', auth, async (req, res) => {
  try {
    const store = await ownedStore(req);
    if (!store) return res.status(404).json({error:'Store not found'});
    const { page=1, limit=20, category, search, status } = req.query;
    const offset = (page-1)*limit;
    let where = 'WHERE p.store_id=$1';
    const params = [store.id];
    let idx = 2;
    if (category) { where += ` AND c.slug=$${idx++}`; params.push(category); }
    if (search)   { where += ` AND p.name ILIKE $${idx++}`; params.push(`%${search}%`); }
    if (status)   { where += ` AND p.active=$${idx++}`; params.push(status==='active'); }
    const { rows } = await pool.query(
      `SELECT p.*,c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id=p.category_id ${where}
       ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]
    );
    const { rows:[{count}] } = await pool.query(`SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id=p.category_id ${where}`, params);
    res.json({ products: rows, pagination: { page:+page, limit:+limit, total:+count, pages:Math.ceil(count/limit) } });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// GET /api/products/:id
router.get('/:id', auth, async (req,res) => {
  try {
    const store = await ownedStore(req); if (!store) return res.status(404).json({error:'Store not found'});
    const {rows} = await pool.query(`SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND p.store_id=$2`,[req.params.id,store.id]);
    if(!rows.length) return res.status(404).json({error:'Product not found'});
    res.json({product:rows[0]});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// POST /api/products
router.post('/', auth, async (req,res) => {
  try {
    const store = await ownedStore(req); if (!store) return res.status(404).json({error:'Store not found'});
    const {
      name, sku, description, price, compare_price, images, variants, category_id,
      in_stock=true, active=true, featured=false, badge_text, ingredients,
      product_size, offer_text, user_instructions, benefits, additional_note,
      quantity=100
    } = req.body;
    if(!name||price===undefined||Number(price)<0) return res.status(400).json({error:'name and a non-negative price are required'});
    const categoryId=await categoryForStore(category_id,store.id);
    if(categoryId===false) return res.status(400).json({error:'Category does not belong to this store'});
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now().toString(36);
    const parsedQty = quantity !== undefined && quantity !== null && !isNaN(Number(quantity)) ? Math.max(0, parseInt(quantity, 10)) : 100;
    const finalInStock = in_stock !== undefined ? (in_stock === true || in_stock === 'true') : (parsedQty > 0);
    const {rows} = await pool.query(
      `INSERT INTO products (store_id,name,slug,sku,description,price,compare_price,images,variants,category_id,in_stock,active,featured,badge_text,ingredients,product_size,offer_text,user_instructions,benefits,additional_note,quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [store.id,name,slug,sku||null,description||null,price,compare_price||null,JSON.stringify(images||[]),JSON.stringify(variants||[]),categoryId,finalInStock,active,featured,badge_text||null,ingredients||null,product_size||null,offer_text||null,user_instructions||null,benefits||null,additional_note||null,parsedQty]
    );
    res.status(201).json({product:rows[0]});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// PUT /api/products/:id
router.put('/:id', auth, async (req,res) => {
  try {
    const f = req.body;
    const store = await ownedStore(req);
    if (!store) return res.status(404).json({error:'Store not found'});

    const updates = [];
    const params = [];
    let idx = 1;

    if (f.name !== undefined) { updates.push(`name=$${idx++}`); params.push(f.name); }
    if (f.sku !== undefined) { updates.push(`sku=$${idx++}`); params.push(f.sku); }
    if (f.description !== undefined) { updates.push(`description=$${idx++}`); params.push(f.description); }
    if (f.price !== undefined) { updates.push(`price=$${idx++}`); params.push(f.price); }
    if (f.compare_price !== undefined) { updates.push(`compare_price=$${idx++}`); params.push(f.compare_price); }
    if (f.images !== undefined) { updates.push(`images=$${idx++}`); params.push(JSON.stringify(f.images || [])); }
    if (f.variants !== undefined) { updates.push(`variants=$${idx++}`); params.push(JSON.stringify(f.variants || [])); }
    if (f.quantity !== undefined && f.quantity !== null) {
      const qty = Math.max(0, parseInt(f.quantity, 10) || 0);
      updates.push(`quantity=$${idx++}`);
      params.push(qty);
      if (f.in_stock === undefined) {
        updates.push(`in_stock=$${idx++}`);
        params.push(qty > 0);
      }
    }
    if (f.in_stock !== undefined) { updates.push(`in_stock=$${idx++}`); params.push(f.in_stock); }
    if (f.active !== undefined) { updates.push(`active=$${idx++}`); params.push(f.active); }
    if (f.featured !== undefined) { updates.push(`featured=$${idx++}`); params.push(f.featured); }
    if (f.badge_text !== undefined) { updates.push(`badge_text=$${idx++}`); params.push(f.badge_text); }
    if (f.ingredients !== undefined) { updates.push(`ingredients=$${idx++}`); params.push(f.ingredients); }
    if (f.product_size !== undefined) { updates.push(`product_size=$${idx++}`); params.push(f.product_size); }
    if (f.offer_text !== undefined) { updates.push(`offer_text=$${idx++}`); params.push(f.offer_text); }
    if (f.user_instructions !== undefined) { updates.push(`user_instructions=$${idx++}`); params.push(f.user_instructions); }
    if (f.benefits !== undefined) { updates.push(`benefits=$${idx++}`); params.push(f.benefits); }
    if (f.additional_note !== undefined) { updates.push(`additional_note=$${idx++}`); params.push(f.additional_note); }

    if (Object.prototype.hasOwnProperty.call(f, 'category_id')) {
      const categoryId = await categoryForStore(f.category_id, store.id);
      if (categoryId === false) return res.status(400).json({error:'Category does not belong to this store'});
      updates.push(`category_id=$${idx++}`);
      params.push(categoryId);
    }

    if (!updates.length) return res.status(400).json({error:'No fields to update'});

    updates.push('updated_at=NOW()');
    params.push(req.params.id);
    const idIdx = idx++;
    params.push(store.id);
    const storeIdIdx = idx++;

    const { rows } = await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id=$${idIdx} AND store_id=$${storeIdIdx} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({error:'Product not found'});
    res.json({product:rows[0]});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// DELETE /api/products/:id
router.delete('/:id', auth, async (req,res) => {
  try {
    const store = await ownedStore(req); if (!store) return res.status(404).json({error:'Store not found'});
    const {rowCount} = await pool.query('UPDATE products SET active=false WHERE id=$1 AND store_id=$2',[req.params.id,store.id]);
    if (!rowCount) return res.status(404).json({error:'Product not found'});
    res.json({message:'Product deactivated'});
  } catch(e){ res.status(500).json({error:e.message}); }
});

module.exports = router;
