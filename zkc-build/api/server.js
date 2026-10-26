// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ZKCommerce v4.4.0 â€” Main API Server
// ZKandavel Infotech Pvt Ltd Â· Smart Commerce. Limitless Growth.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const config       = require('./config');
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const pool         = require('./db');
const { renderStore } = require('./store-renderer');
// Tracked schema migrations (api/services/pg-migrations.js) run once at start-up.
require('./services/pg-migrations').ready().catch(e => console.error('[ZKCommerce] Database migration failed:', e.message));
const path = require('path');
const fs   = require('fs');

const app  = express();
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be a valid TCP port from 1 to 65535');

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'] }));
app.use(express.json({ limit: '10mb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500, message: { error: 'Too many requests' } }));
app.use('/store-builder', express.static(path.join(__dirname, '..', 'store-builder')));
app.use('/auth', express.static(path.join(__dirname, '..', 'auth')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/clients', express.static(path.join(__dirname, '..', 'clients')));
app.use('/merchant', express.static(path.join(__dirname, '..', 'merchant')));
app.get(['/release-history.html', '/release_history.html', '/changelog'], (req, res) => res.sendFile(path.join(__dirname, '..', 'release-history.html')));
app.get(['/db-migrations.html', '/db-migrations', '/migrations'], (req, res) => res.sendFile(path.join(__dirname, '..', 'db-migrations.html')));
app.get(['/gap-analysis.html', '/gap-analysis', '/audit'], (req, res) => res.sendFile(path.join(__dirname, '..', 'gap-analysis.html')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets'), { fallthrough: true, maxAge: '7d' }));

// â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// /api/health is the Railway health-check path (railway.toml); /health is kept for local scripts.
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', version: '4.4.0', env: config.mode });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// â”€â”€ Route modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/migrations',  require('./routes/migrations'));
// Catalogue changes (products, categories, pages, stock) go live at once; theme edits still wait for Publish.
const { liveCatalog } = require('./services/live-catalog');
app.use(['/api/products', '/api/categories', '/api/inventory'], liveCatalog);
app.use('/api/stores', (req, res, next) => (/^\/\d+\/(pages|scaffold-pages)(\/|$)/.test(req.path) ? liveCatalog(req, res, next) : next()));
app.use('/api/stores',      require('./routes/stores'));
app.use('/api/products',    require('./routes/products'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/customers',   require('./routes/customers'));
app.use('/api/payments',    require('./routes/payments'));
app.use('/api/invoices',    require('./routes/invoices'));
app.use('/api/staff',       require('./routes/staff'));
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/marketing',   require('./routes/marketing'));
app.use('/api/affiliates',  require('./routes/affiliates'));
app.use('/api/recurring',   require('./routes/recurring'));
app.use('/api/flash-sales', require('./routes/flashSales'));
app.use('/api/blog',        require('./routes/blog'));
app.use('/api/shipping',    require('./routes/shipping'));
app.use('/api/gst',         require('./routes/gst'));
app.use('/api/loyalty',     require('./routes/loyalty'));
app.use('/api/coupons',     require('./routes/coupons'));
app.use('/api/reviews',     require('./routes/reviews'));
app.use('/api/storefront',  require('./routes/storefront'));  // public
app.use('/api/meta',        require('./routes/meta'));
app.use('/api/cron',        require('./routes/cron'));
app.use('/api/admin',       require('./routes/adminRoutes'));
app.use('/api/upload',      require('./routes/upload'));
app.use('/api/notify',      require('./routes/notify'));
app.use('/api/inventory',   require('./routes/inventory'));
app.use('/api/whatsapp',    require('./routes/whatsapp'));
app.use('/api/shipments',   require('./routes/shipments'));

async function serveStore(req, res, identifier, subpath = '/', basePathOverride = null) {
  const cleanId = String(identifier || '').toLowerCase().trim().replace(/^www\./, '');
  const { rows } = await pool.query(
    `SELECT * FROM stores
     WHERE lower(slug)=lower($1) 
        OR lower(published_snapshot->'store'->>'custom_domain')=lower($1) 
        OR lower(custom_domain)=lower($1)
        OR lower(slug)=lower($2)
        OR regexp_replace(lower(COALESCE(custom_domain, '')), '^www\\.', '')=lower($2)
        OR regexp_replace(lower(COALESCE(published_snapshot->'store'->>'custom_domain', '')), '^www\\.', '')=lower($2)
     LIMIT 1`, [identifier, cleanId]
  );
  if (!rows.length) return res.status(404).send('Store not found');
  const store = rows[0];
  let snapshot = store.published_snapshot;
  if (!snapshot) {
    const [products, pages, categories] = await Promise.all([
      pool.query('SELECT p.*, c.name AS category_name, c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC, p.created_at DESC', [store.id]),
      pool.query("SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order, id", [store.id]),
      pool.query("SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order, name, id", [store.id])
    ]);
    snapshot = {
      version: 1,
      store: {
        store_name: store.store_name, slug: store.slug, custom_domain: store.custom_domain,
        tagline: store.tagline, hero_headline: store.hero_headline, hero_subtext: store.hero_subtext,
        hero_cta_text: store.hero_cta_text, primary_colour: store.primary_colour, bg_colour: store.bg_colour,
        accent_colour: store.accent_colour, logo_url: store.logo_url, whatsapp_number: store.whatsapp_number,
        instagram_handle: store.instagram_handle, address: store.address, city: store.city, state: store.state
      },
      theme_config: store.theme_config || {},
      products: products.rows,
      pages: pages.rows,
      categories: categories.rows
    };
  } else if (!snapshot.categories || snapshot.categories.length === 0) {
    const categories = await pool.query("SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order, name, id", [store.id]);
    snapshot.categories = categories.rows;
  }

  let page, product, collection, template = 'home';
  const cleanSubpath = subpath === '' ? '/' : subpath;
  const pageMatch = cleanSubpath.match(/^\/page\/([^/]+)\/?$/);
  const productMatch = cleanSubpath.match(/^\/products\/([^/]+)\/?$/);
  const collectionMatch = cleanSubpath.match(/^\/collections\/([^/]+)\/?$/);

  if (pageMatch) {
    page = (snapshot.pages || []).find(p => p.slug === decodeURIComponent(pageMatch[1]));
    if (!page) return res.status(404).send('Page not found: ' + decodeURIComponent(pageMatch[1]));
    template = 'page';
  } else if (productMatch) {
    product = (snapshot.products || []).find(p => p.slug === decodeURIComponent(productMatch[1]));
    if (!product) return res.status(404).send('Product not found: ' + decodeURIComponent(productMatch[1]));
    template = 'product';
  } else if (collectionMatch) {
    collection = decodeURIComponent(collectionMatch[1]);
    template = 'collection';
  }

  const basePath = basePathOverride != null ? basePathOverride : (req.path.startsWith('/store/' + identifier) ? '/store/' + identifier : '');
  res.type('html').send(renderStore(snapshot, { page, product, collection, template, showContact: !page, basePath }));
}

// Store-specific and client-specific merchant admin access
app.get(['/store/:slug/merchant*', '/clients/:client/merchant*'], (req, res) => {
  let subpath = req.path.replace(/^\/(store|clients)\/[^/]+\/merchant\/?/, '');
  if (!subpath || subpath === '/') subpath = 'index.html';
  const target = path.join(__dirname, '..', 'merchant', subpath);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return res.sendFile(target);
  }
  res.sendFile(path.join(__dirname, '..', 'merchant', 'index.html'));
});

// Direct path-based store access: /store/:slug and /store/:slug/*
app.get('/store/:slug*', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const basePath = `/store/${slug}`;
    const subpath = req.path.slice(basePath.length) || '/';
    await serveStore(req, res, slug, subpath, basePath);
  } catch (e) { next(e); }
});

// Resolve wildcard subdomains, custom domains, or ?store=... query
app.get('*', async (req,res,next) => {
  try {
    if (req.path.startsWith('/api/') || req.path.startsWith('/store/') || req.path.startsWith('/merchant') || req.path.startsWith('/auth') || req.path.startsWith('/assets') || req.path.startsWith('/admin') || req.path.startsWith('/clients') || req.path.startsWith('/store-builder')) return next();
    if (req.query.store) {
      return await serveStore(req, res, req.query.store, req.path);
    }
    if (req.path !== '/' && !/^\/(page|products|collections)\//.test(req.path)) return next();
    const host = String(req.hostname || '').toLowerCase().replace(/:\d+$/,'');
    const storeBuilderHost = String(process.env.STORE_BUILDER_HOST || 'storebuilderapp.zksuvevy.in').toLowerCase();
    if (host === storeBuilderHost) return next();
    const baseDomain = String(process.env.STORE_BASE_DOMAIN || 'zkcommerce.in').toLowerCase();
    const isSubdomain = host.endsWith(`.${baseDomain}`) && host !== `www.${baseDomain}`;
    const isCustomDomain = host.includes('.') && host !== baseDomain && host !== `www.${baseDomain}` && host !== 'localhost' && !host.endsWith('.localhost');
    if (!isSubdomain && !isCustomDomain) {
      // Localhost or direct single-domain fallback for storefront subpaths (/page/*, /products/*, /collections/*)
      if (/^\/(page|products|collections)\//.test(req.path)) {
        let storeSlug = null;
        let basePath = '';
        const referer = String(req.headers.referer || '');
        const refMatch = referer.match(/\/store\/([a-z0-9_-]+)/i);
        if (refMatch) {
          storeSlug = refMatch[1];
          basePath = `/store/${storeSlug}`;
        } else {
          const { rows } = await pool.query("SELECT slug FROM stores WHERE status='published' OR slug='smeram' ORDER BY CASE WHEN slug='smeram' THEN 0 ELSE 1 END, id LIMIT 1");
          if (rows.length) storeSlug = rows[0].slug;
        }
        if (storeSlug) {
          return await serveStore(req, res, storeSlug, req.path, basePath);
        }
      }
      return next();
    }
    const identifier = isSubdomain ? host.slice(0,-baseDomain.length-1) : host;
    await serveStore(req, res, identifier, req.path);
  } catch(e) { next(e); }
});

// The marketing site is the default page on localhost and the platform domain.
// This route follows Host-based storefront resolution so store subdomains still render their stores.
app.get('/', (req,res) => {
  const host = String(req.hostname || '').toLowerCase().replace(/:\d+$/,'');
  const storeBuilderHost = String(process.env.STORE_BUILDER_HOST || 'storebuilderapp.zksuvevy.in').toLowerCase();
  res.sendFile(path.join(__dirname, '..', host === storeBuilderHost ? 'store-builder/index.html' : 'index.html'));
});

// Root-level marketing/theme pages referenced by links inside index.html.
const publicPages = new Set(['index.html','theme-1-dark.html','theme-2-light.html','theme-3-gradient.html','customers.html']);
app.get('/:page', (req,res,next) => {
  if (!publicPages.has(req.params.page)) return next();
  res.sendFile(path.join(__dirname, '..', req.params.page));
});

// â”€â”€ 404 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => res.status(404).json({ error: 'Route not found', path: req.path }));

// â”€â”€ Error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, next) => {
  console.error('[ZKCommerce]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`[ZKCommerce] v4.4.0 listening on port ${PORT}`);
  console.log(`[ZKCommerce] Environment: ${config.mode}`);
  if (config.mode === 'development') console.log(`[ZKCommerce] Health: http://localhost:${PORT}/health`);
  else if (process.env.FRONTEND_URL) console.log(`[ZKCommerce] Public app URL: ${process.env.FRONTEND_URL}`);
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[ZKCommerce] Port ${PORT} is already in use. Stop the existing server or set PORT to a free port.`);
  } else {
    console.error('[ZKCommerce] Could not start the HTTP server:', error.message);
  }
  process.exitCode = 1;
});

module.exports = app;




