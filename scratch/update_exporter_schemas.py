import re

with open('zkc/api/services/deployment-exporter.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add escapePgString and postgresSeedStatements
pg_helpers = """
function escapePgString(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function postgresSeedStatements(store, categories = [], products = [], pages = [], extra = {}) {
  const sid = Number(store.id);
  const out = [];

  out.push(`INSERT INTO "stores" ("id", "store_name", "slug", "custom_domain", "tagline", "hero_headline", "hero_subtext", "hero_cta_text", "primary_colour", "bg_colour", "accent_colour", "logo_url", "whatsapp_number", "instagram_handle", "address", "city", "state", "theme_config", "status")
VALUES (${sid}, ${escapePgString(store.store_name)}, ${escapePgString(store.slug)}, ${escapePgString(store.custom_domain)}, ${escapePgString(store.tagline)}, ${escapePgString(store.hero_headline)}, ${escapePgString(store.hero_subtext)}, ${escapePgString(store.hero_cta_text)}, ${escapePgString(store.primary_colour)}, ${escapePgString(store.bg_colour)}, ${escapePgString(store.accent_colour)}, ${escapePgString(store.logo_url)}, ${escapePgString(store.whatsapp_number)}, ${escapePgString(store.instagram_handle)}, ${escapePgString(store.address)}, ${escapePgString(store.city)}, ${escapePgString(store.state)}, ${escapePgString(JSON.stringify(store.theme_config || {}))}::jsonb, 'published')
ON CONFLICT ("id") DO UPDATE SET "store_name"=EXCLUDED."store_name", "custom_domain"=EXCLUDED."custom_domain", "tagline"=EXCLUDED."tagline", "hero_headline"=EXCLUDED."hero_headline", "hero_subtext"=EXCLUDED."hero_subtext", "hero_cta_text"=EXCLUDED."hero_cta_text", "primary_colour"=EXCLUDED."primary_colour", "bg_colour"=EXCLUDED."bg_colour", "accent_colour"=EXCLUDED."accent_colour", "logo_url"=EXCLUDED."logo_url", "whatsapp_number"=EXCLUDED."whatsapp_number", "instagram_handle"=EXCLUDED."instagram_handle", "address"=EXCLUDED."address", "city"=EXCLUDED."city", "state"=EXCLUDED."state", "theme_config"=EXCLUDED."theme_config"`);

  for (const c of categories) {
    out.push(`INSERT INTO "categories" ("id", "store_id", "name", "slug", "image_url", "sort_order", "active")
VALUES (${Number(c.id)}, ${sid}, ${escapePgString(c.name)}, ${escapePgString(c.slug)}, ${escapePgString(c.image_url)}, ${Number(c.sort_order || 0)}, ${c.active !== false ? 'TRUE' : 'FALSE'})
ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "slug"=EXCLUDED."slug", "image_url"=EXCLUDED."image_url", "sort_order"=EXCLUDED."sort_order", "active"=EXCLUDED."active"`);
  }

  for (const p of products) {
    const imgJson = Array.isArray(p.images) ? JSON.stringify(p.images) : (p.images ? JSON.stringify([p.images]) : '[]');
    out.push(`INSERT INTO "products" ("id", "store_id", "category_id", "name", "slug", "sku", "price", "compare_price", "cost_price", "gst_rate", "product_size", "offer_text", "badge_text", "description", "ingredients", "user_instructions", "benefits", "additional_note", "images", "quantity", "in_stock", "active", "variants", "net_quantity_value", "net_quantity_unit", "low_stock_threshold", "show_offer")
VALUES (${Number(p.id)}, ${sid}, ${p.category_id ? Number(p.category_id) : 'NULL'}, ${escapePgString(p.name)}, ${escapePgString(p.slug)}, ${escapePgString(p.sku)}, ${Number(p.price || 0)}, ${p.compare_price ? Number(p.compare_price) : 'NULL'}, ${sqlNum(p.cost_price)}, ${escapePgString(p.gst_rate || '12')}, ${escapePgString(p.product_size || p.size)}, ${escapePgString(p.offer_text || p.offer)}, ${escapePgString(p.badge_text)}, ${escapePgString(p.description)}, ${escapePgString(p.ingredients)}, ${escapePgString(p.user_instructions)}, ${escapePgString(p.benefits)}, ${escapePgString(p.additional_note || 'Inclusive of GST and free shipping.')}, ${escapePgString(imgJson)}::jsonb, ${productQuantity(p)}, ${p.in_stock !== false ? 'TRUE' : 'FALSE'}, ${p.active !== false ? 'TRUE' : 'FALSE'}, ${escapePgString(JSON.stringify(Array.isArray(p.variants) ? p.variants : []))}::jsonb, ${sqlNum(p.net_quantity_value)}, ${escapePgString(p.net_quantity_unit)}, ${sqlNum(p.low_stock_threshold)}, ${p.show_offer === true ? "'show'" : p.show_offer === false ? "'hide'" : 'NULL'})
ON CONFLICT ("id") DO UPDATE SET "category_id"=EXCLUDED."category_id", "name"=EXCLUDED."name", "slug"=EXCLUDED."slug", "sku"=EXCLUDED."sku", "price"=EXCLUDED."price", "compare_price"=EXCLUDED."compare_price", "cost_price"=EXCLUDED."cost_price", "gst_rate"=EXCLUDED."gst_rate", "product_size"=EXCLUDED."product_size", "offer_text"=EXCLUDED."offer_text", "badge_text"=EXCLUDED."badge_text", "description"=EXCLUDED."description", "ingredients"=EXCLUDED."ingredients", "user_instructions"=EXCLUDED."user_instructions", "benefits"=EXCLUDED."benefits", "additional_note"=EXCLUDED."additional_note", "images"=EXCLUDED."images", "active"=EXCLUDED."active", "variants"=EXCLUDED."variants", "net_quantity_value"=EXCLUDED."net_quantity_value", "net_quantity_unit"=EXCLUDED."net_quantity_unit", "low_stock_threshold"=EXCLUDED."low_stock_threshold", "show_offer"=EXCLUDED."show_offer"`);
  }

  const stockRows = products.flatMap(p => { const vs = activeVariants(p); return vs.length ? vs.map(v => [p.id, v.id, Number(v.quantity) || 0]) : [[p.id, '', productQuantity(p)]]; });
  for (const [pid, vid, q] of stockRows) {
    out.push(`INSERT INTO "product_stock" ("store_id", "product_id", "variant_id", "quantity") VALUES (${sid}, ${Number(pid)}, ${escapePgString(String(vid))}, ${Math.trunc(q)}) ON CONFLICT ("product_id", "variant_id") DO UPDATE SET "quantity" = EXCLUDED."quantity"`);
  }

  if (Array.isArray(extra.coupons)) {
    for (const c of extra.coupons) {
      out.push(`INSERT INTO "coupons" ("id", "store_id", "code", "discount_type", "discount_value", "minimum_order", "usage_limit", "starts_at", "expires_at", "active")
VALUES (${Number(c.id)}, ${sid}, ${escapePgString(String(c.code).toUpperCase())}, ${escapePgString(c.discount_type)}, ${sqlNum(c.discount_value)}, ${Number(c.minimum_order) || 0}, ${sqlNum(c.usage_limit)}, ${c.starts_at ? escapePgString(new Date(c.starts_at).toISOString()) : 'NULL'}, ${c.expires_at ? escapePgString(new Date(c.expires_at).toISOString()) : 'NULL'}, ${c.active !== false ? 'TRUE' : 'FALSE'})
ON CONFLICT ("id") DO UPDATE SET "code"=EXCLUDED."code", "discount_type"=EXCLUDED."discount_type", "discount_value"=EXCLUDED."discount_value", "minimum_order"=EXCLUDED."minimum_order", "usage_limit"=EXCLUDED."usage_limit", "starts_at"=EXCLUDED."starts_at", "expires_at"=EXCLUDED."expires_at", "active"=EXCLUDED."active"`);
    }
  }

  if (Array.isArray(extra.shipping_rates)) {
    for (const r of extra.shipping_rates) {
      out.push(`INSERT INTO "shipping_rates" ("id", "store_id", "name", "rate", "free_above", "postal_prefix", "estimated_days", "courier", "active")
VALUES (${Number(r.id)}, ${sid}, ${escapePgString(r.name)}, ${Number(r.rate) || 0}, ${sqlNum(r.free_above)}, ${escapePgString(r.postal_prefix || null)}, ${escapePgString(r.estimated_days)}, ${escapePgString(r.courier)}, ${r.active !== false ? 'TRUE' : 'FALSE'})
ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "rate"=EXCLUDED."rate", "free_above"=EXCLUDED."free_above", "postal_prefix"=EXCLUDED."postal_prefix", "estimated_days"=EXCLUDED."estimated_days", "courier"=EXCLUDED."courier", "active"=EXCLUDED."active"`);
    }
  }

  for (const page of pages) {
    const contentJson = typeof page.content === 'object' ? JSON.stringify(page.content) : String(page.content || '');
    out.push(`INSERT INTO "store_pages" ("id", "store_id", "title", "slug", "content", "status", "sort_order")
VALUES (${Number(page.id)}, ${sid}, ${escapePgString(page.title)}, ${escapePgString(page.slug)}, ${escapePgString(contentJson)}, ${escapePgString(page.status || 'published')}, ${Number(page.sort_order || 0)})
ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title", "slug"=EXCLUDED."slug", "content"=EXCLUDED."content", "status"=EXCLUDED."status", "sort_order"=EXCLUDED."sort_order"`);
  }

  out.push(`SELECT setval(pg_get_serial_sequence('"stores"', 'id'), COALESCE((SELECT MAX("id") FROM "stores"), 1))`);
  out.push(`SELECT setval(pg_get_serial_sequence('"categories"', 'id'), COALESCE((SELECT MAX("id") FROM "categories"), 1))`);
  out.push(`SELECT setval(pg_get_serial_sequence('"products"', 'id'), COALESCE((SELECT MAX("id") FROM "products"), 1))`);
  out.push(`SELECT setval(pg_get_serial_sequence('"shipping_rates"', 'id'), COALESCE((SELECT MAX("id") FROM "shipping_rates"), 1))`);
  out.push(`SELECT setval(pg_get_serial_sequence('"coupons"', 'id'), COALESCE((SELECT MAX("id") FROM "coupons"), 1))`);
  out.push(`SELECT setval(pg_get_serial_sequence('"store_pages"', 'id'), COALESCE((SELECT MAX("id") FROM "store_pages"), 1))`);

  return out;
}

function generatePostgresSeed(store, categories = [], products = [], pages = [], { version = '', env = 'production', extra = {} } = {}) {
  const schemaFile = path.join(REPO_ROOT, 'zkc', 'database', 'migration-postgres.sql');
  const ddl = fs.existsSync(schemaFile) ? fs.readFileSync(schemaFile, 'utf8') : '';
  const seedStmts = postgresSeedStatements(store, categories, products, pages, extra);
  return `-- ============================================================
-- ${store.store_name} — PostgreSQL Install & Seed Data${version ? ` (package v${version}, ${env})` : ''}
-- Target: Neon / Railway / Supabase / AWS RDS / PostgreSQL 14+
-- Generated: ${new Date().toISOString()}
-- ============================================================

${ddl}

-- ── Store Catalog Seed Data ──
${seedStmts.join(';\n\n')};
`;
}

function generatePostgresMigration(store, { fromVersion, toVersion, env, includeSeed, categories = [], products = [], pages = [], extra = {} } = {}) {
  const migrationFile = path.join(REPO_ROOT, 'zkc', 'database', 'migration-postgres.sql');
  const ddl = fs.existsSync(migrationFile) ? fs.readFileSync(migrationFile, 'utf8') : '';
  const seedStmts = includeSeed ? postgresSeedStatements(store, categories, products, pages, extra) : [];
  return `-- ============================================================
-- ${store.store_name} — PostgreSQL Migration ${fromVersion ? 'v' + fromVersion : 'fresh'} → v${toVersion} (${env})
-- Target: Neon / Railway / Supabase / AWS RDS
-- Generated: ${new Date().toISOString()}
-- ============================================================

${ddl}
${includeSeed ? `\n-- ── Catalog Seed Refresh ──\n${seedStmts.join(';\n\n')};\n` : ''}
`;
}
"""

# Replace old generatePostgresSeed
old_func_pattern = r'function generatePostgresSeed\(store, categories, products, pages\) \{[\s\S]*?\n\}\n'
content = re.sub(old_func_pattern, pg_helpers, content)

# Update database bundle in exportStoreDeployment for PHP
old_php_db = """    const dbDir = path.join(exportDir, 'database');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, `${slug}_mysql.sql`), mysqlSql, 'utf8');"""

new_php_db = """    const dbDir = path.join(exportDir, 'database');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, `${slug}_mysql.sql`), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-postgres.sql'), generatePostgresSeed(store, categories, products, livePages, { version, env, extra }), 'utf8');
    const rootDbDir = path.join(REPO_ROOT, 'zkc', 'database');
    for (const sqlName of ['migration-mysql.sql', 'migration-postgres.sql', 'smeram_full_reset_and_seed.sql', 'smeram_full_reset_and_seed_postgres.sql', 'update-smeram-password.sql']) {
      const srcSql = path.join(rootDbDir, sqlName);
      if (fs.existsSync(srcSql)) fs.copyFileSync(srcSql, path.join(dbDir, sqlName));
    }"""

content = content.replace(old_php_db, new_php_db)

# Update database bundle in exportStoreDeployment for Node
old_node_db = """    fs.writeFileSync(path.join(dbDir, 'schema-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'seed-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-postgres.sql'), generatePostgresSeed(store, categories, products, livePages), 'utf8');"""

new_node_db = """    fs.writeFileSync(path.join(dbDir, 'schema-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'seed-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-postgres.sql'), generatePostgresSeed(store, categories, products, livePages, { version, env, extra }), 'utf8');
    const rootDbDir = path.join(REPO_ROOT, 'zkc', 'database');
    for (const sqlName of ['migration-mysql.sql', 'migration-postgres.sql', 'smeram_full_reset_and_seed.sql', 'smeram_full_reset_and_seed_postgres.sql', 'update-smeram-password.sql']) {
      const srcSql = path.join(rootDbDir, sqlName);
      if (fs.existsSync(srcSql)) fs.copyFileSync(srcSql, path.join(dbDir, sqlName));
    }"""

content = content.replace(old_node_db, new_node_db)

# Also ensure generatePostgresMigration is exported
if 'generatePostgresMigration' not in content.split('module.exports')[1]:
    content = content.replace('generatePostgresSeed,', 'generatePostgresSeed,\n  generatePostgresMigration,')

with open('zkc/api/services/deployment-exporter.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated deployment-exporter.js with dual MySQL & PostgreSQL schema generators and bundles.")

