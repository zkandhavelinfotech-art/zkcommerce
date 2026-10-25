const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');
const { renderStore } = require('../store-renderer');
const { templates, configFor, demoSnapshot } = require('../store-templates');
const { scaffoldDefaultPages } = require('../services/defaultPages');

// Public catalog used by the new merchant setup wizard.
router.get('/templates', (_req, res) => res.json({ templates: templates.map(t => t.design ? { ...t, starter_fields: configFor(t).fields } : t) }));

// Rendered sample storefront for full-layout designs, shown as the wizard preview.
router.get('/templates/:id/preview', (req, res) => {
  const selected = templates.find(item => item.id === req.params.id && item.design);
  if (!selected) return res.status(404).send('Template preview not found');
  const snapshot = demoSnapshot(selected);
  const template = req.query.template === 'product' ? 'product' : 'home';
  res.type('html').send(renderStore(snapshot, { template, product: template === 'product' ? snapshot.products[0] : null, showContact: true }));
});

// Create the first store only after its owner has selected a starter design.
router.post('/setup', auth, async (req, res) => {
  const selected = templates.find(item => item.id === req.body.template_id);
  const storeName = String(req.body.store_name || '').trim();
  if (!selected) return res.status(400).json({ error: 'Choose a storefront template to continue' });
  if (!storeName || storeName.length > 150) return res.status(400).json({ error: 'Enter a store name up to 150 characters' });
  const baseSlug = storeName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'');
  if (!baseSlug) return res.status(400).json({ error: 'Store name must include letters or numbers' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT id,store_id FROM merchants WHERE id=$1 FOR UPDATE',[req.user.id]);
    if (!existing.length) { await client.query('ROLLBACK'); return res.status(401).json({ error:'Please sign in again' }); }
    if (existing[0].store_id) { await client.query('ROLLBACK'); return res.status(409).json({ error:'A store already exists for this account', store_id:existing[0].store_id }); }
    let slug=baseSlug, suffix=2;
    while ((await client.query('SELECT 1 FROM stores WHERE lower(slug)=lower($1)',[slug])).rowCount) {
      const ending='-'+suffix++;
      slug=baseSlug.slice(0,100-ending.length)+ending;
    }
    const themeConfig=configFor(selected);
    const { rows:[store] } = await client.query(
      `INSERT INTO stores (merchant_id,store_name,slug,status,theme_name,primary_colour,bg_colour,accent_colour,tagline,hero_headline,hero_subtext,hero_cta_text,theme_config)
       VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id,slug,store_name,status,theme_name,theme_config`,
      [req.user.id,storeName,slug,selected.preset,...selected.colors,
       'Thoughtfully made essentials for everyday living',themeConfig.fields.hero_h1,themeConfig.fields.hero_desc,themeConfig.fields.hero_cta,JSON.stringify(themeConfig)]
    );
    await client.query('UPDATE merchants SET store_id=$1 WHERE id=$2',[store.id,req.user.id]);
    await client.query('COMMIT');
    try { await scaffoldDefaultPages(store.id, store); } catch (_) {}
    res.status(201).json({ store });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(e.code==='23505'?409:500).json({ error:e.code==='23505'?'Store name is already taken. Try another name.':e.message });
  } finally { client.release(); }
});

// GET /api/stores  â€” merchant's own stores
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
        COUNT(DISTINCT p.id)::int AS product_count,
        COUNT(DISTINCT o.id)::int AS order_count
       FROM stores s
       LEFT JOIN products p ON p.store_id=s.id AND p.active=true
       LEFT JOIN orders   o ON o.store_id=s.id
       WHERE s.merchant_id=$1 GROUP BY s.id ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ stores: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/stores/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    res.json({ store: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Builder bootstrap: store draft, products, and pages in one owned-store response.
router.get('/:id/builder', auth, async (req, res) => {
  try {
    const { rows: stores } = await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!stores.length) return res.status(404).json({ error: 'Store not found' });
    let [products, pages, categories] = await Promise.all([
      pool.query('SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 ORDER BY p.created_at DESC', [req.params.id]),
      pool.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order,id', [req.params.id]),
      pool.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order,name,id', [req.params.id])
    ]);
    if (pages.rows.length === 0) {
      try {
        await scaffoldDefaultPages(stores[0].id, stores[0]);
        const refetched = await pool.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order,id', [req.params.id]);
        pages = refetched;
      } catch (_) {}
    }
    res.json({ store: stores[0], products: products.rows, pages: pages.rows, categories: categories.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Explicit 1-click endpoint to scaffold standard eCommerce legal & policy pages
router.post('/:id/scaffold-pages', auth, async (req, res) => {
  try {
    const { rows: stores } = await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!stores.length) return res.status(404).json({ error: 'Store not found' });
    const created = await scaffoldDefaultPages(stores[0].id, stores[0]);
    const { rows: allPages } = await pool.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order,id', [stores[0].id]);
    res.json({ message: 'Default standard pages generated successfully', created_count: created.length, pages: allPages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Persist the working draft. The public renderer never reads this config.
router.put('/:id/draft', auth, async (req, res) => {
  try {
    const { theme_config, store_fields } = req.body;
    if (!theme_config || typeof theme_config !== 'object' || Array.isArray(theme_config))
      return res.status(400).json({ error: 'theme_config must be a JSON object' });
    const fields = store_fields || {};
    if (fields.custom_domain && !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(fields.custom_domain))
      return res.status(400).json({ error: 'Enter a valid custom domain without https:// or a path' });
    if (fields.custom_domain) {
      const conflict = await pool.query('SELECT id FROM stores WHERE lower(custom_domain)=lower($1) AND id<>$2',[fields.custom_domain,req.params.id]);
      if (conflict.rows.length) return res.status(409).json({ error: 'Custom domain is already connected to another store' });
    }
    const { rows } = await pool.query(
      `UPDATE stores SET theme_config=$3::jsonb, store_name=COALESCE($4,store_name), tagline=COALESCE($5,tagline),
       hero_headline=COALESCE($6,hero_headline),hero_subtext=COALESCE($7,hero_subtext),hero_cta_text=COALESCE($8,hero_cta_text),
       primary_colour=COALESCE($9,primary_colour),bg_colour=COALESCE($10,bg_colour),accent_colour=COALESCE($11,accent_colour),
       logo_url=COALESCE($12,logo_url),whatsapp_number=COALESCE($13,whatsapp_number),instagram_handle=COALESCE($14,instagram_handle),
       address=COALESCE($15,address),city=COALESCE($16,city),state=COALESCE($17,state),custom_domain=COALESCE($18,custom_domain),updated_at=NOW()
       WHERE id=$1 AND merchant_id=$2 RETURNING id,store_name,slug,status,theme_config,updated_at`,
      [req.params.id, req.user.id, JSON.stringify(theme_config), fields.store_name, fields.tagline,
       fields.hero_headline, fields.hero_subtext, fields.hero_cta_text, fields.primary_colour,
       fields.bg_colour, fields.accent_colour, fields.logo_url, fields.whatsapp_number, fields.instagram_handle,
       fields.address, fields.city, fields.state, fields.custom_domain]
    );
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    res.json({ store: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/pages', auth, async (req, res) => {
  try {
    const own = await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!own.rows.length) return res.status(404).json({ error: 'Store not found' });
    const { rows } = await pool.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order,id', [req.params.id]);
    res.json({ pages: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/pages', auth, async (req, res) => {
  try {
    const { title, slug, content={}, status='draft', sort_order=0 } = req.body;
    if (!title || !slug || String(title).length>150 || !/^[a-z0-9-]{1,150}$/i.test(String(slug))) return res.status(400).json({ error: 'A title (up to 150 characters) and a simple page slug are required' });
    if (!['draft','published'].includes(status)) return res.status(400).json({error:'Page status must be draft or published'});
    const own = await pool.query('SELECT id FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!own.rows.length) return res.status(404).json({ error: 'Store not found' });
    const { rows } = await pool.query(
      'INSERT INTO store_pages(store_id,title,slug,content,status,sort_order) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING *',
      [req.params.id,title,slug,JSON.stringify(content),status,sort_order]
    );
    res.status(201).json({ page: rows[0] });
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Page slug already exists' : e.message }); }
});

router.put('/:id/pages/:pageId', auth, async (req, res) => {
  try {
    const { title, slug, content, status, sort_order } = req.body;
    if (title && String(title).length>150) return res.status(400).json({error:'Page title is too long'});
    if (slug && !/^[a-z0-9-]{1,150}$/i.test(String(slug))) return res.status(400).json({error:'Use letters, numbers, and dashes for the page slug'});
    if (status && !['draft','published'].includes(status)) return res.status(400).json({error:'Page status must be draft or published'});
    const { rows } = await pool.query(
      `UPDATE store_pages p SET title=COALESCE($4,p.title),slug=COALESCE($5,p.slug),content=COALESCE($6::jsonb,p.content),
       status=COALESCE($7,p.status),sort_order=COALESCE($8,p.sort_order),updated_at=NOW()
       FROM stores s WHERE p.id=$1 AND p.store_id=$2 AND s.id=p.store_id AND s.merchant_id=$3 RETURNING p.*`,
      [req.params.pageId,req.params.id,req.user.id,title,slug,content===undefined?null:JSON.stringify(content),status,sort_order]
    );
    if (!rows.length) return res.status(404).json({ error: 'Page not found' });
    res.json({ page: rows[0] });
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Page slug already exists' : e.message }); }
});

router.delete('/:id/pages/:pageId', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM store_pages p USING stores s WHERE p.id=$1 AND p.store_id=$2 AND s.id=p.store_id AND s.merchant_id=$3`,
      [req.params.pageId,req.params.id,req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Page not found' });
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Capture config, published pages, and active products atomically. Draft writes never touch this snapshot.
router.post('/:id/publish', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2 FOR UPDATE', [req.params.id,req.user.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Store not found' }); }
    const store = rows[0];
    const [products,pages] = await Promise.all([
      client.query('SELECT p.*,c.name AS category_name,c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC,p.created_at DESC',[store.id]),
      client.query("SELECT * FROM store_pages WHERE store_id=$1 AND status='published' ORDER BY sort_order,id",[store.id])
    ]);
    const snapshot = { version: 1, published_at: new Date().toISOString(), store: { store_name:store.store_name,slug:store.slug,custom_domain:store.custom_domain,tagline:store.tagline,hero_headline:store.hero_headline,hero_subtext:store.hero_subtext,hero_cta_text:store.hero_cta_text,primary_colour:store.primary_colour,bg_colour:store.bg_colour,accent_colour:store.accent_colour,logo_url:store.logo_url,whatsapp_number:store.whatsapp_number,instagram_handle:store.instagram_handle,address:store.address,city:store.city,state:store.state }, theme_config:store.theme_config||{}, products:products.rows, pages:pages.rows };
    const updated = await client.query(
      `UPDATE stores SET published_snapshot=$2::jsonb,status=CASE WHEN status='live' THEN 'live' ELSE 'published' END,published_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,slug,status,published_at`,
      [store.id,JSON.stringify(snapshot)]
    );
    await client.query('COMMIT');
    res.json({ store:updated.rows[0], published_snapshot:snapshot });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.get('/:id/preview', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,store_name,slug,custom_domain,tagline,hero_headline,hero_subtext,hero_cta_text,primary_colour,bg_colour,accent_colour,logo_url,whatsapp_number,instagram_handle,address,city,state,theme_config FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id,req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    const [products,pages,categories] = await Promise.all([
      pool.query('SELECT p.*,c.name AS category_name,c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC,p.created_at DESC',[req.params.id]),
      pool.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order,id',[req.params.id]),
      pool.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order,name,id',[req.params.id])
    ]);
    let previewConfig = rows[0].theme_config || {};
    if (req.query.theme_config) {
      try { previewConfig = JSON.parse(req.query.theme_config); }
      catch (_) { return res.status(400).json({ error: 'Invalid preview theme_config JSON' }); }
      if (!previewConfig || typeof previewConfig !== 'object' || Array.isArray(previewConfig)) return res.status(400).json({ error: 'Preview theme_config must be a JSON object' });
    }
    const data = { store:rows[0], theme_config:previewConfig, products:products.rows, pages:pages.rows, categories:categories.rows };
    if (req.query.format === 'html') {
      const selectedPage = req.query.page_id ? pages.rows.find(page => String(page.id) === String(req.query.page_id) || page.slug === String(req.query.page_id)) : null;
      if (req.query.page_id && !selectedPage) return res.status(404).json({ error: 'Page not found' });
      const selectedTemplate = ['home','product','collection','page'].includes(req.query.template) ? req.query.template : selectedPage ? 'page' : 'home';
      const selectedProduct = selectedTemplate === 'product' ? data.products.find(product => String(product.id) === String(req.query.product_id) || product.slug === String(req.query.product_id)) || data.products[0] : null;
      return res.type('html').send(renderStore({store:data.store,theme_config:data.theme_config,products:data.products,pages:data.pages,categories:data.categories},{showContact:true,page:selectedPage,template:selectedTemplate,product:selectedProduct,collection:req.query.collection,basePath:req.query.base_path||''}));
    }
    res.json({ ...data, preview:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// POST /api/stores
router.post('/', auth, async (req, res) => {
  try {
    const { store_name, slug } = req.body;
    if (!store_name || String(store_name).length>150 || !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/i.test(String(slug||'')))
      return res.status(400).json({error:'Store name and a 1â€“100 character slug using letters, numbers, and dashes are required'});
    const { rows } = await pool.query(
      `INSERT INTO stores (merchant_id,store_name,slug,status,theme_name,primary_colour,bg_colour,accent_colour)
       VALUES ($1,$2,$3,'draft','dark-navy','#1688E8','#06152B','#A6D900') RETURNING *`,
      [req.user.id, store_name, slug]
    );
    const createdStore = rows[0];
    try { await scaffoldDefaultPages(createdStore.id, createdStore); } catch (_) {}
    res.status(201).json({ store: createdStore });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/stores/:id/theme
router.put('/:id/theme', auth, async (req, res) => {
  try {
    const f = req.body;
    const { rows } = await pool.query(
      `UPDATE stores SET
        theme_name=COALESCE($3,theme_name), primary_colour=COALESCE($4,primary_colour),
        bg_colour=COALESCE($5,bg_colour), accent_colour=COALESCE($6,accent_colour),
        store_name=COALESCE($7,store_name), tagline=COALESCE($8,tagline),
        hero_headline=COALESCE($9,hero_headline), hero_subtext=COALESCE($10,hero_subtext),
        hero_cta_text=COALESCE($11,hero_cta_text), whatsapp_number=COALESCE($12,whatsapp_number),
        instagram_handle=COALESCE($13,instagram_handle), updated_at=NOW()
       WHERE id=$1 AND merchant_id=$2 RETURNING id,store_name,theme_name,status`,
      [req.params.id, req.user.id,
       f.theme_name, f.primary_colour, f.bg_colour, f.accent_colour,
       f.store_name, f.tagline, f.hero_headline, f.hero_subtext,
       f.hero_cta_text, f.whatsapp_number, f.instagram_handle]
    );
    if (!rows.length) return res.status(403).json({ error: 'Not authorised' });
    res.json({ store: rows[0], message: 'Theme updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/stores/:id/status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft','published','live','suspended'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'published') return res.status(400).json({ error: 'Use POST /api/stores/:id/publish to create a published snapshot' });
    if (status === 'live') {
      const snap = await pool.query('SELECT published_snapshot FROM stores WHERE id=$1 AND (merchant_id=$2 OR $3=true)',[req.params.id,req.user.id,req.user.role==='admin']);
      if (!snap.rows.length) return res.status(404).json({error:'Store not found'});
      if (!snap.rows[0].published_snapshot) return res.status(409).json({error:'Publish a snapshot before setting this store live'});
    }
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ['live','suspended'].includes(status))
      return res.status(403).json({ error: 'Only admin can set live/suspended' });
    const q = isAdmin
      ? `UPDATE stores SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,store_name,slug,status,custom_domain`
      : `UPDATE stores SET status=$1,updated_at=NOW() WHERE id=$2 AND merchant_id=$3 RETURNING id,store_name,slug,status,custom_domain`;
    const params = isAdmin ? [status, req.params.id] : [status, req.params.id, req.user.id];
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(403).json({ error: 'Not authorised' });
    const s = rows[0];
    const url = s.custom_domain ? `https://${s.custom_domain}` : `https://${s.slug}.zkcommerce.in`;
    res.json({ store: s, store_url: url, message: `Store is now ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/stores/:id/domain
router.put('/:id/domain', auth, async (req, res) => {
  try {
    const { custom_domain } = req.body;
    const dup = await pool.query('SELECT id FROM stores WHERE custom_domain=$1 AND id!=$2', [custom_domain, req.params.id]);
    if (dup.rows.length) return res.status(409).json({ error: 'Domain already in use' });
    const { rows } = await pool.query(
      `UPDATE stores SET custom_domain=$1,updated_at=NOW() WHERE id=$2 AND merchant_id=$3 RETURNING id,slug,custom_domain`,
      [custom_domain, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'Not authorised' });
    res.json({
      store: rows[0],
      dns_instructions: {
        type: 'CNAME', host: custom_domain, points_to: 'stores.zkcommerce.in',
        note: 'Add CNAME in GoDaddy DNS. Propagation: 2â€“48 hours.',
        hostinger_alternative: { ns1: 'ns1.hostinger.com', ns2: 'ns2.hostinger.com' }
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/stores/:id/export â€” download store HTML
router.get('/:id/export', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(403).json({ error: 'Not authorised' });
    const store = rows[0];
    const [products,pages] = await Promise.all([
      pool.query('SELECT * FROM products WHERE store_id=$1 AND active=true ORDER BY featured DESC,created_at DESC',[store.id]),
      pool.query('SELECT * FROM store_pages WHERE store_id=$1 AND status=\'published\' ORDER BY sort_order,id',[store.id])
    ]);
    const html = renderStore({store,theme_config:store.theme_config||{},products:products.rows,pages:pages.rows},{showContact:true});
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${store.slug}-store.html"`);
    res.send(html);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

