const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { exportStoreDeployment, exportDbMigration, PHP_PARTS } = require('../services/deployment-exporter');
const zkEnv = require('../services/zk-env');
// Defined here (not imported) so listing and downloading packages keeps working whatever the exporter exports.
const DEPLOY_ROOT = process.env.ZKC_DEPLOY_ROOT || path.join(__dirname, '..', '..', 'deployment');
const mysqlMigrations = require('../services/mysql-migrations');
const orderMessages = require('../services/order-messages');
const deploySettings = require('../services/deployment-settings');
const ftpDeployer = require('../services/ftp-deployer');
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
    res.json({ store: stores[0], products: products.rows, pages: pages.rows, categories: categories.rows,
      payments: { razorpay_configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), razorpay_mode: /^rzp_live_/.test(process.env.RAZORPAY_KEY_ID || '') ? 'live' : 'test' } });
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
    const [products,pages,categories] = await Promise.all([
      client.query('SELECT p.*,c.name AS category_name,c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC,p.created_at DESC',[store.id]),
      client.query("SELECT * FROM store_pages WHERE store_id=$1 AND status='published' ORDER BY sort_order,id",[store.id]),
      client.query("SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order,name,id",[store.id])
    ]);
    const snapshot = { version: 1, published_at: new Date().toISOString(), store: { store_name:store.store_name,slug:store.slug,custom_domain:store.custom_domain,tagline:store.tagline,hero_headline:store.hero_headline,hero_subtext:store.hero_subtext,hero_cta_text:store.hero_cta_text,primary_colour:store.primary_colour,bg_colour:store.bg_colour,accent_colour:store.accent_colour,logo_url:store.logo_url,whatsapp_number:store.whatsapp_number,instagram_handle:store.instagram_handle,address:store.address,city:store.city,state:store.state }, theme_config:store.theme_config||{}, products:products.rows, pages:pages.rows, categories:categories.rows };
    const updated = await client.query(
      `UPDATE stores SET published_snapshot=$2::jsonb,status=CASE WHEN status='live' THEN 'live' ELSE 'published' END,published_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,slug,status,published_at`,
      [store.id,JSON.stringify(snapshot)]
    );
    await client.query('COMMIT');
    res.json({ store:updated.rows[0], published_snapshot:snapshot });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});


// ── Deployment: environments, packages, FTP ──────────────────────────────

const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,3}$/;
const sendError = (res, e) => res.status(e.status || 500).json({ error: e.message });

async function loadPackageData(storeId, db = pool) {
  const [products, pages, categories, coupons, shippingRates] = await Promise.all([
    db.query('SELECT p.*,c.name AS category_name,c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC,p.created_at DESC', [storeId]),
    db.query("SELECT * FROM store_pages WHERE store_id=$1 AND status='published' ORDER BY sort_order,id", [storeId]),
    db.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order,name,id', [storeId]),
    db.query('SELECT * FROM coupons WHERE store_id=$1 ORDER BY id', [storeId]),
    db.query('SELECT * FROM store_shipping_rates WHERE store_id=$1 ORDER BY id', [storeId])
  ]);
  return { products: products.rows, pages: pages.rows, categories: categories.rows, coupons: coupons.rows, shipping_rates: shippingRates.rows };
}

// Settings the PHP package needs to apply the same rules as this server: GST, stock alerts, Ekart, WhatsApp sender.
async function packageCommerce(storeId) {
  const [{ rows: [gst] }, inv, ship, sender] = await Promise.all([
    pool.query('SELECT enabled, default_rate, gstin FROM gst_settings WHERE store_id=$1', [storeId]),
    require('../services/inventory').settingsFor(storeId),
    require('../services/shipping').settingsFor(storeId),
    require('../services/wa-sender').loadSender(storeId)
  ]);
  const plain = { ...sender, zkwaconnect: { ...sender.zkwaconnect, api_key: deploySettings.decrypt(sender.zkwaconnect.api_key) || '' },
    gupshup: { ...sender.gupshup, api_key: deploySettings.decrypt(sender.gupshup.api_key) || '' } };
  return { gst: gst || {}, inventory: inv, shipping: { enabled: ship.enabled, courier_name: ship.courier_name, tracking_url_template: ship.tracking_url_template }, sender: plain };
}

// Razorpay keys for a package: this environment's saved keys, else this server's .env keys for that environment
// (phpdev / development → RAZORPAY_TEST_*, prod / production → RAZORPAY_LIVE_*).
function razorpayKeysFor(saved, env) {
  const p = saved.payments || {};
  const e = process.env, live = env === 'production';
  const envKey = live ? e.RAZORPAY_LIVE_KEY_ID : e.RAZORPAY_TEST_KEY_ID;
  const envSecret = live ? e.RAZORPAY_LIVE_KEY_SECRET : e.RAZORPAY_TEST_KEY_SECRET;
  const hasSaved = !!(p.key_id && p.key_secret);
  const key_id = hasSaved ? p.key_id : (envKey || '');
  const key_secret = hasSaved ? p.key_secret : (envSecret || '');
  const webhook_secret = p.webhook_secret || (live ? e.RAZORPAY_LIVE_WEBHOOK_SECRET : e.RAZORPAY_TEST_WEBHOOK_SECRET) || '';
  return key_id && key_secret ? { key_id, key_secret, webhook_secret, mode: /^rzp_live_/.test(key_id) ? 'live' : 'test', source: p.key_id ? 'environment' : 'server' } : null;
}

// Frontend / Backend + API URLs for a PHP environment (written into zk-env.js and store_config.php):
// the ones saved in the Publish portal, else defaults from the domain.
function envUrls(store, env, saved, customDomain) {
  const defaults = zkEnv.defaultPhpUrls(store, env, customDomain);
  return { site_url: saved.site_url || defaults.site_url, backend_url: saved.backend_url || defaults.backend_url };
}

// Build a versioned package for one environment, using saved settings with optional request overrides.
async function buildPackage(store, merchantId, body, data) {
  const env = deploySettings.normalizeEnv(body.env) || 'production';
  const loaded = await deploySettings.loadSettings(store.id, merchantId);
  const { settings } = loaded;
  const saved = deploySettings.resolvedEnv(settings, env);
  const technology = deploySettings.TECHNOLOGIES.includes(body.technology) ? body.technology : (saved.technology || 'php');
  if (body.version && !VERSION_RE.test(String(body.version))) throw Object.assign(new Error('Version must look like 1.0.3'), { status: 400 });
  // Frontend and Backend + API PHP packages are versioned separately ("php-frontend", "php-backend").
  const part = technology === 'php' && PHP_PARTS.includes(body.part) ? body.part : 'full';
  const buildKey = part === 'full' ? technology : `${technology}-${part}`;
  const version = body.version ? String(body.version) : deploySettings.nextVersion(settings, env, buildKey);
  const sdb = saved.db || {};
  const db = {
    type: body.db_type || sdb.type, host: body.db_host || sdb.host, port: body.db_port || sdb.port,
    name: body.db_name || sdb.name, user: body.db_user || sdb.user, password: body.db_password || sdb.password
  };
  const customDomain = env === 'production' ? (store.custom_domain || saved.custom_domain) : (body.custom_domain || saved.custom_domain);
  const urls = envUrls(store, env, saved, customDomain);
  const deployment = await exportStoreDeployment({
    store, themeConfig: store.theme_config || {}, ...(data || await loadPackageData(store.id)),
    options: { env, technology, part, version, urls, provider: body.provider || saved.provider || 'godaddy', db, db_type: db.type, custom_domain: customDomain, razorpay: razorpayKeysFor(saved, env), admin_password: saved.admin_password, whatsapp: await orderMessages.loadSettings(store.id), commerce: await packageCommerce(store.id) }
  });
  settings.versions[`${env}:${buildKey}`] = version;
  const envSettings = settings.environments[env] || {};
  // Build history drives "migrate from version X": each entry remembers the schema that version shipped with.
  // Read it before last_package is replaced so a pre-history build is carried over.
  const history = deploySettings.buildHistory(envSettings).filter(b => !(b.version === version && b.technology === buildKey));
  envSettings.technology = technology;
  envSettings.last_package = { technology: buildKey, version, schema: deployment.schema, zip_name: deployment.zip_name, zip_path: deployment.zip_path, export_dir: deployment.export_dir, built_at: deployment.built_at };
  envSettings.builds = [{ version, technology: buildKey, schema: deployment.schema, zip_name: deployment.zip_name, zip_path: deployment.zip_path, built_at: deployment.built_at }, ...history].slice(0, 50);
  settings.environments[env] = envSettings;
  settings.active_env = env;
  await deploySettings.persist(store.id, settings);
  return deployment;
}

// GET /api/stores/:id/deployment-settings — saved per-environment settings (no passwords)
router.get('/:id/deployment-settings', auth, async (req, res) => {
  try {
    const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'Store not found' });
    const view = deploySettings.publicView(loaded.settings);
    // Defaults shown in the Environment URLs fields until the merchant saves their own.
    view.default_urls = {};
    for (const env of deploySettings.ENVIRONMENTS) {
      const e = loaded.settings.environments[env] || {};
      view.default_urls[env] = zkEnv.defaultPhpUrls(loaded.store, env, env === 'production' ? loaded.store.custom_domain || e.custom_domain : e.custom_domain);
    }
    view.next_versions = {};
    for (const env of deploySettings.ENVIRONMENTS) for (const t of [...deploySettings.TECHNOLOGIES, 'php-frontend', 'php-backend'])
      view.next_versions[`${env}:${t}`] = deploySettings.nextVersion(loaded.settings, env, t);
    view.schema = { latest: mysqlMigrations.latestId(), latest_version: mysqlMigrations.latestVersion(), migrations: mysqlMigrations.MIGRATIONS.map(m => ({ id: m.id, version: m.version, description: m.description })) };
    // Which ZIPs can still be downloaded (deleted or moved files show as unavailable in the dashboard).
    const onDisk = name => !!name && ['', 'published', 'db-migrations'].some(dir => fs.existsSync(path.join(DEPLOY_ROOT, dir, path.basename(name))));
    for (const e of Object.values(view.environments)) {
      if (e.last_package) e.last_package.zip_exists = onDisk(e.last_package.zip_name);
      if (e.last_migration) e.last_migration.zip_exists = onDisk(e.last_migration.zip_name);
      for (const b of e.builds || []) b.zip_exists = onDisk(b.zip_name);
    }
    res.json(view);
  } catch (e) { sendError(res, e); }
});

// PUT /api/stores/:id/deployment-settings/:env — save db / ftp / domain / technology for one environment
router.put('/:id/deployment-settings/:env', auth, async (req, res) => {
  try {
    const env = deploySettings.normalizeEnv(req.params.env);
    if (!env) return res.status(400).json({ error: 'Environment must be development, stage, preview or production' });
    const view = await deploySettings.saveEnvironment(req.params.id, req.user.id, env, req.body || {});
    if (!view) return res.status(404).json({ error: 'Store not found' });
    res.json({ success: true, env, settings: view });
  } catch (e) { sendError(res, e); }
});

// POST /api/stores/:id/publish-portal — publish snapshot, then build the selected environment's package
router.post('/:id/publish-portal', auth, async (req, res) => {
  const env = deploySettings.normalizeEnv(req.body.env) || 'production';
  const client = await pool.connect();
  let committed = false, released = false;
  const release = () => { if (!released) { released = true; client.release(); } };
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!rows.length) { await client.query('ROLLBACK'); release(); return res.status(404).json({ error: 'Store not found' }); }
    const store = rows[0];

    // Only production owns the store's real custom domain; other environments keep theirs in deployment settings.
    if (env === 'production' && req.body.custom_domain !== undefined) {
      const cd = String(req.body.custom_domain || '').trim().toLowerCase();
      await client.query('UPDATE stores SET custom_domain=$1 WHERE id=$2', [cd || null, store.id]);
      store.custom_domain = cd || null;
    }

    const data = await loadPackageData(store.id, client);
    const snapshot = {
      version: 1,
      published_at: new Date().toISOString(),
      store: {
        store_name: store.store_name, slug: store.slug, custom_domain: store.custom_domain,
        tagline: store.tagline, hero_headline: store.hero_headline, hero_subtext: store.hero_subtext,
        hero_cta_text: store.hero_cta_text, primary_colour: store.primary_colour, bg_colour: store.bg_colour,
        accent_colour: store.accent_colour, logo_url: store.logo_url, whatsapp_number: store.whatsapp_number,
        instagram_handle: store.instagram_handle, address: store.address, city: store.city, state: store.state
      },
      theme_config: store.theme_config || {},
      ...data
    };
    const updated = await client.query(
      `UPDATE stores SET published_snapshot=$2::jsonb,status=CASE WHEN status='live' THEN 'live' ELSE 'published' END,published_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,slug,status,custom_domain,published_at`,
      [store.id, JSON.stringify(snapshot)]
    );
    await client.query('COMMIT');
    committed = true;
    release();

    if (env !== 'production' && req.body.custom_domain !== undefined) {
      await deploySettings.saveEnvironment(store.id, req.user.id, env, { custom_domain: req.body.custom_domain });
    }
    const deployment = await buildPackage({ ...store, ...updated.rows[0] }, req.user.id, { ...req.body, env }, data);
    const envDomain = env === 'production' ? store.custom_domain : req.body.custom_domain;
    // { upload: true } also sends the freshly built package to this environment's saved FTP server.
    let upload = null;
    if (req.body.upload) {
      try { upload = await uploadPackage(req, env, deployment); }
      catch (e) { upload = { error: e.message }; }
    }
    res.json({
      success: true,
      store: updated.rows[0],
      published_snapshot: snapshot,
      deployment,
      upload,
      live_url: deployment.site_url || (envDomain ? 'https://' + envDomain : '/store/' + store.slug)
    });
  } catch (e) {
    if (!committed) await client.query('ROLLBACK').catch(() => {});
    release();
    sendError(res, e);
  }
});

// POST /api/stores/:id/deployment-package — build a versioned ZIP (php | nodejs | static) without re-publishing
router.post('/:id/deployment-package', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    const deployment = await buildPackage(rows[0], req.user.id, req.body || {});
    if (!deployment.zip_path) return res.status(500).json({ error: 'Package folder was built but the ZIP failed: ' + deployment.zip_error, deployment });
    res.json({ success: true, deployment });
  } catch (e) { sendError(res, e); }
});

// POST /api/stores/:id/api-package — build dedicated standalone PHP API + Swagger + DB tester package
router.post('/:id/api-package', auth, async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const scriptPath = path.join(__dirname, '../../deployment/scripts/build-api-bundle.js');
    execSync(`node "${scriptPath}"`, { stdio: 'pipe' });
    const version = '1.0.12';
    const zipName = `smeram-api-v${version}.zip`;
    res.json({
      success: true,
      package: {
        zip_name: zipName,
        version: version,
        swagger_url: 'swagger.html',
        test_db_url: 'test-db.php',
        message: 'Standalone API & Swagger package v' + version + ' ready for download'
      }
    });
  } catch (e) { sendError(res, e); }
});

// Find a built ZIP for this store: a recorded package, or an older version still on disk.
// Returns { zip_path, zip_name } | { error, status } | null (nothing built yet and no file asked for).
function resolvePackage(loaded, file) {
  const packages = Object.values(loaded.settings.environments).map(e => e.last_package).filter(p => p && p.zip_path)
    .sort((a, b) => String(b.built_at).localeCompare(String(a.built_at)));
  if (!file) return packages[0] || null;
  const name = path.basename(String(file));
  const pkg = packages.find(p => p.zip_name === name);
  if (pkg && fs.existsSync(pkg.zip_path)) return pkg;
  const candidates = [path.join(DEPLOY_ROOT, name), path.join(DEPLOY_ROOT, 'published', name), path.join(DEPLOY_ROOT, 'db-migrations', name)];
  const found = name.startsWith(loaded.store.slug) && name.endsWith('.zip') && candidates.find(f => fs.existsSync(f));
  return found ? { zip_path: found, zip_name: name } : { error: `${name} was not found. Build it again.`, status: 404 };
}

// deployment/<client>/downloads — the "project folder" download target on the server PC.
const downloadsDirFor = slug => path.join(DEPLOY_ROOT, String(slug).toLowerCase().replace(/[^a-z0-9_-]/g, '-'), 'downloads');

// GET /api/stores/:id/deployment-zip?file=<zip name> — download a built package (latest when no file is given)
router.get('/:id/deployment-zip', auth, async (req, res) => {
  try {
    const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'Store not found' });
    let pkg = resolvePackage(loaded, req.query.file);
    if (pkg && pkg.error) return res.status(pkg.status).json({ error: pkg.error });
    if (!pkg) {
      const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1', [req.params.id]);
      const built = await buildPackage(rows[0], req.user.id, { env: loaded.settings.active_env || 'production' });
      pkg = { zip_path: built.zip_path, zip_name: built.zip_name };
    }
    if (!pkg.zip_path || !fs.existsSync(pkg.zip_path)) return res.status(404).json({ error: 'Deployment archive not found. Build the package again.' });
    res.download(pkg.zip_path, pkg.zip_name);
  } catch (e) { sendError(res, e); }
});

// POST /api/stores/:id/deployment-zip/save { file } — copy a built ZIP into deployment/<client>/downloads on this server
router.post('/:id/deployment-zip/save', auth, async (req, res) => {
  try {
    const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'Store not found' });
    if (!req.body.file) return res.status(400).json({ error: 'file is required' });
    const pkg = resolvePackage(loaded, req.body.file);
    if (!pkg || pkg.error) return res.status(404).json({ error: (pkg && pkg.error) || 'Package not found' });
    const dir = downloadsDirFor(loaded.store.slug);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, pkg.zip_name);
    fs.copyFileSync(pkg.zip_path, dest);
    res.json({ success: true, saved_path: dest, folder: dir, bytes: fs.statSync(dest).size });
  } catch (e) { sendError(res, e); }
});

// POST /api/stores/:id/deployment-zip/open-folder { file? } — open Explorer on the server PC.
// Only for requests made on the server machine itself (localhost) on Windows.
router.post('/:id/deployment-zip/open-folder', auth, async (req, res) => {
  try {
    const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'Store not found' });
    const ip = String(req.socket.remoteAddress || '');
    if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) return res.status(403).json({ error: 'Open folder only works in a browser on the server PC. The file is saved on the PC at: ' + downloadsDirFor(loaded.store.slug) });
    if (process.platform !== 'win32') return res.status(400).json({ error: 'Open folder is only available on Windows' });
    const dir = downloadsDirFor(loaded.store.slug);
    fs.mkdirSync(dir, { recursive: true });
    const target = req.body.file ? path.join(dir, path.basename(String(req.body.file))) : null;
    const args = target && fs.existsSync(target) ? ['/select,', target] : [dir];
    require('child_process').spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
    res.json({ success: true, folder: dir });
  } catch (e) { sendError(res, e); }
});

// POST /api/stores/:id/db-migration — only the DB changes since a deployed version (+ optional catalog refresh)
// body: { env, from_version ('' = fresh database), to_version?, include_seed }
router.post('/:id/db-migration', auth, async (req, res) => {
  try {
    const env = deploySettings.normalizeEnv(req.body.env) || 'production';
    const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'Store not found' });
    const envSettings = loaded.settings.environments[env] || {};
    const builds = deploySettings.buildHistory(envSettings);
    const fromVersion = String(req.body.from_version || '');
    let fromSchema = '';
    let fromLabel = fromVersion;
    if (fromVersion) {
      const from = builds.find(b => b.version === fromVersion);
      if (from) {
        fromSchema = from.schema;
        fromLabel = from.version;
      } else {
        const found = mysqlMigrations.MIGRATIONS.find(m => m.id === fromVersion || m.version === fromVersion || m.id.startsWith(fromVersion));
        if (found) {
          fromSchema = found.id;
          fromLabel = found.version || found.id;
        } else {
          return res.status(400).json({ error: `No ${env} build or schema checkpoint ${fromVersion} found` });
        }
      }
    }
    if (req.body.to_version && !VERSION_RE.test(String(req.body.to_version))) return res.status(400).json({ error: 'Version must look like 1.0.3' });
    const toVersion = String(req.body.to_version || (builds[0] && builds[0].version) || mysqlMigrations.latestVersion() || '1.0.9');
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1', [req.params.id]);
    const migration = await exportDbMigration({
      store: rows[0], ...(await loadPackageData(req.params.id)),
      env, fromVersion: fromLabel, fromSchema, toVersion, includeSeed: req.body.include_seed !== false, whatsapp: await orderMessages.loadSettings(req.params.id), commerce: await packageCommerce(req.params.id)
    });
    if (!migration.zip_path) return res.status(500).json({ error: 'Could not create the migration ZIP: ' + migration.zip_error });
    envSettings.last_migration = { from_version: migration.from_version, to_version: toVersion, zip_name: migration.zip_name, zip_path: migration.zip_path, built_at: migration.built_at };
    loaded.settings.environments[env] = envSettings;
    await deploySettings.persist(req.params.id, loaded.settings);
    res.json({ success: true, migration });
  } catch (e) { sendError(res, e); }
});

// FTP settings for a request: typed values win, the saved password fills in when the field is left blank.
async function ftpConfigFor(req, env) {
  const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
  if (!loaded) return null;
  const saved = deploySettings.resolvedEnv(loaded.settings, env).ftp || {};
  const b = req.body || {};
  return {
    loaded,
    cfg: {
      host: deploySettings.normalizeFtpHost(b.host || saved.host),
      port: Number(b.port || saved.port) || 21,
      user: String(b.user || saved.user || '').trim(),
      password: b.password || saved.password || '',
      path: deploySettings.normalizeRemotePath(b.path || saved.path),
      secure: b.secure !== undefined ? !!b.secure : !!saved.secure
    },
    saved
  };
}

// POST /api/stores/:id/deploy-ftp/test — check login and the remote folder
async function ftpTest(req, res) {
  try {
    const env = deploySettings.normalizeEnv(req.body.env) || 'production';
    const ctx = await ftpConfigFor(req, env);
    if (!ctx) return res.status(404).json({ error: 'Store not found' });
    const { cfg, saved, loaded } = ctx;
    if (!cfg.host || !cfg.user || !cfg.password) return res.status(400).json({ error: 'FTP Host, Username, and Password are required' });
    let info;
    try { info = await ftpDeployer.testConnection(cfg); }
    catch (e) { return res.status(400).json({ error: ftpDeployer.friendlyError(e) }); }
    const matchesSaved = saved.host === cfg.host && saved.user === cfg.user && saved.password === cfg.password;
    if (matchesSaved) {
      loaded.settings.environments[env].ftp_tested_at = new Date().toISOString();
      await deploySettings.persist(req.params.id, loaded.settings);
    }
    res.json({
      success: true,
      saved: matchesSaved,
      ...info,
      message: info.path_exists
        ? `Connected. ${cfg.path} is ready (${info.entries} items).`
        : `Connected, but ${cfg.path} does not exist yet — it will be created on upload.`
    });
  } catch (e) { sendError(res, e); }
}
router.post('/:id/deploy-ftp/test', auth, ftpTest);
router.post('/:id/deploy-ftp', auth, ftpTest);

// The saved FTP settings for an environment, or a 400 error when none are saved.
async function savedFtpFor(req, env) {
  const loaded = await deploySettings.loadSettings(req.params.id, req.user.id);
  if (!loaded) throw Object.assign(new Error('Store not found'), { status: 404 });
  const ftpCfg = deploySettings.resolvedEnv(loaded.settings, env).ftp;
  if (!ftpCfg || !ftpCfg.host || !ftpCfg.password) throw Object.assign(new Error('Save the FTP settings for this environment first'), { status: 400 });
  return ftpCfg;
}

// Upload a built package with the saved FTP settings.
async function uploadPackage(req, env, deployment, ftpCfg) {
  ftpCfg = ftpCfg || await savedFtpFor(req, env);
  let result;
  try { result = await ftpDeployer.uploadDirectory(ftpCfg, deployment.upload_dir, { skipEnv: deployment.technology === 'nodejs' }); }
  catch (e) { throw Object.assign(new Error('Upload failed: ' + ftpDeployer.friendlyError(e)), { status: 400 }); }
  const label = deployment.part === 'frontend' ? 'Frontend ' : deployment.part === 'backend' ? 'Backend + API ' : '';
  return { ...result, message: `Uploaded ${label}v${deployment.version} (${result.files} files, ${(result.bytes / 1048576).toFixed(1)} MB) to ${ftpCfg.host}${result.remote_path}` };
}

// POST /api/stores/:id/deploy-ftp/upload — build a new version and upload it with the saved FTP settings
// body: { env, technology, part: 'frontend' | 'backend' | 'full', version? }
router.post('/:id/deploy-ftp/upload', auth, async (req, res) => {
  let deployment;
  try {
    const env = deploySettings.normalizeEnv(req.body.env) || 'production';
    const ftpCfg = await savedFtpFor(req, env);
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1', [req.params.id]);
    deployment = await buildPackage(rows[0], req.user.id, { ...req.body, env });
    const result = await uploadPackage(req, env, deployment, ftpCfg);
    res.json({ success: true, deployment, ...result });
  } catch (e) { res.status(e.status || 500).json({ error: e.message, deployment }); }
});

// POST /api/stores/:id/deploy-github
router.post('/:id/deploy-github', auth, async (req, res) => {
  try {
    const { repo, token, branch = 'main' } = req.body;
    if (!repo || !token) return res.status(400).json({ error: 'GitHub Repository (owner/repo) and Personal Access Token are required' });
    const { rows } = await pool.query('SELECT * FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    const store = rows[0];

    const https = require('https');
    const repoParts = repo.trim().replace(/^https?:\/\/github\.com\//, '').split('/');
    if (repoParts.length < 2) return res.status(400).json({ error: 'Repository format must be owner/repository-name' });
    const owner = repoParts[0];
    const repoName = repoParts[1];

    const checkRepo = () => new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.github.com',
        path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
        headers: {
          'User-Agent': 'ZKCommerce-StoreBuilder',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      https.get(opts, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (r.statusCode >= 200 && r.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || `GitHub HTTP ${r.statusCode}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    const repoData = await checkRepo();
    res.json({
      success: true,
      message: `Authenticated with GitHub repository: ${repoData.full_name} (${branch} branch). Ready for push!`,
      repo: repoData.full_name,
      html_url: repoData.html_url,
      default_branch: repoData.default_branch
    });
  } catch (e) {
    res.status(400).json({ error: 'GitHub Authentication Error: ' + e.message });
  }
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
// Display switches for the merchant dashboard: offers/discounts and the "All Products" section.
// Written to the draft and, when the store is published, to the live snapshot too, so they apply straight away.
async function storeForDisplay(req) {
  const { rows } = await pool.query('SELECT id, theme_config, published_snapshot FROM stores WHERE id=$1 AND (merchant_id=$2 OR $3=true)', [req.params.id, req.user.id, req.user.role === 'admin']);
  return rows[0];
}
const displayOf = cfg => ({ 
  show_offers: ((cfg || {}).display || {}).show_offers !== false, 
  show_all_products: (((cfg || {}).sections || {}).products || {}).visible !== false,
  announcement_enabled: (cfg || {}).announcement_enabled !== false && (((cfg || {}).sections || {}).announcement || {}).visible !== false,
  category_link: CATEGORY_LINK_MODES.includes(((cfg || {}).display || {}).category_link) ? cfg.display.category_link : 'collection',
  category_cta_text: String(((cfg || {}).display || {}).category_cta_text || '')
});
// Where a home-page category box goes: its collection page, or straight to the product page.
const CATEGORY_LINK_MODES = ['collection', 'single_product', 'first_product'];
router.get('/:id/display', auth, async (req, res) => {
  try {
    const s = await storeForDisplay(req);
    if (!s) return res.status(404).json({ error: 'Store not found' });
    res.json({ display: displayOf(s.theme_config), live: s.published_snapshot ? displayOf(s.published_snapshot.theme_config) : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id/display', auth, async (req, res) => {
  try {
    const s = await storeForDisplay(req);
    if (!s) return res.status(404).json({ error: 'Store not found' });
    const apply = cfg => {
      cfg = cfg || {};
      if (req.body.show_offers !== undefined) cfg.display = { ...(cfg.display || {}), show_offers: req.body.show_offers !== false };
      if (req.body.category_link !== undefined) cfg.display = { ...(cfg.display || {}), category_link: CATEGORY_LINK_MODES.includes(req.body.category_link) ? req.body.category_link : 'collection' };
      if (req.body.category_cta_text !== undefined) cfg.display = { ...(cfg.display || {}), category_cta_text: String(req.body.category_cta_text || '').trim().slice(0, 40) };
      if (req.body.show_all_products !== undefined || req.body.products_enabled !== undefined) {
        const prodVal = req.body.show_all_products !== undefined ? req.body.show_all_products !== false : req.body.products_enabled !== false;
        cfg.sections = cfg.sections || {};
        cfg.sections.products = { ...(cfg.sections.products || {}), visible: prodVal };
      }
      if (req.body.announcement_enabled !== undefined) {
        cfg.announcement_enabled = req.body.announcement_enabled !== false;
        cfg.sections = cfg.sections || {};
        cfg.sections.announcement = { ...(cfg.sections.announcement || {}), visible: req.body.announcement_enabled !== false };
      }
      return cfg;
    };
    const draft = apply(s.theme_config);
    const snapshot = s.published_snapshot ? { ...s.published_snapshot, theme_config: apply(s.published_snapshot.theme_config) } : null;
    await pool.query('UPDATE stores SET theme_config=$2::jsonb, published_snapshot=COALESCE($3::jsonb, published_snapshot), updated_at=NOW() WHERE id=$1',
      [s.id, JSON.stringify(draft), snapshot ? JSON.stringify(snapshot) : null]);
    res.json({ display: displayOf(draft), live: snapshot ? displayOf(snapshot.theme_config) : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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

