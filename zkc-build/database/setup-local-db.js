const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function setup() {
  const adminClient = new Client({
    connectionString: 'postgresql://postgres:Admin%40123@localhost:5433/postgres'
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query("SELECT 1 FROM pg_database WHERE datname='zkcommerce_v42'");
    if (!res.rows.length) {
      await adminClient.query('CREATE DATABASE zkcommerce_v42');
      console.log('✅ Created database zkcommerce_v42');
    } else {
      console.log('ℹ️ Database zkcommerce_v42 already exists');
    }
  } finally {
    await adminClient.end();
  }

  const dbClient = new Client({
    connectionString: 'postgresql://postgres:Admin%40123@localhost:5433/zkcommerce_v42'
  });

  try {
    await dbClient.connect();
    console.log('✅ Connected to zkcommerce_v42 on port 5433');

    // Run schema.sql without pgcrypto
    let schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    schemaSql = schemaSql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '-- pgcrypto skipped');
    await dbClient.query(schemaSql);
    console.log('✅ Schema migration applied successfully');

    // Run seed.sql
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await dbClient.query(seedSql);
    console.log('✅ Smeram Naturals & demo seed applied successfully');

    // Ensure status is published so public storefront routing works immediately
    await dbClient.query("UPDATE stores SET status='published' WHERE slug='smeram'");

    const sRow = (await dbClient.query("SELECT * FROM stores WHERE slug='smeram'")).rows[0];
    const [pRows, pgRows] = await Promise.all([
      dbClient.query("SELECT p.*, c.name AS category_name, c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC, p.created_at DESC", [sRow.id]),
      dbClient.query("SELECT * FROM store_pages WHERE store_id=$1 AND status='published' ORDER BY sort_order, id", [sRow.id])
    ]);
    const snap = {
      version: 1,
      published_at: new Date().toISOString(),
      store: {
        store_name: sRow.store_name, slug: sRow.slug, custom_domain: sRow.custom_domain,
        tagline: sRow.tagline, hero_headline: sRow.hero_headline, hero_subtext: sRow.hero_subtext,
        hero_cta_text: sRow.hero_cta_text, primary_colour: sRow.primary_colour, bg_colour: sRow.bg_colour,
        accent_colour: sRow.accent_colour, logo_url: sRow.logo_url, whatsapp_number: sRow.whatsapp_number,
        instagram_handle: sRow.instagram_handle, address: sRow.address, city: sRow.city, state: sRow.state
      },
      theme_config: sRow.theme_config || {},
      products: pRows.rows,
      pages: pgRows.rows
    };
    await dbClient.query("UPDATE stores SET published_snapshot=$1::jsonb, published_at=NOW() WHERE id=$2", [JSON.stringify(snap), sRow.id]);
    console.log('✅ Generated & saved published snapshot for Smeram Naturals');

    // Verify Smeram store
    const storeRes = await dbClient.query("SELECT id, store_name, slug, status FROM stores WHERE slug='smeram'");
    console.log('✅ Smeram store in DB:', storeRes.rows);

    const catRes = await dbClient.query("SELECT name, slug FROM categories WHERE store_id=$1", [storeRes.rows[0].id]);
    console.log('✅ Smeram categories in DB:', catRes.rows);

    const prodRes = await dbClient.query("SELECT name, slug, price FROM products WHERE store_id=$1", [storeRes.rows[0].id]);
    console.log('✅ Smeram products in DB:', prodRes.rows);

    const pageRes = await dbClient.query("SELECT title, slug FROM store_pages WHERE store_id=$1", [storeRes.rows[0].id]);
    console.log('✅ Smeram pages in DB:', pageRes.rows);
  } finally {
    await dbClient.end();
  }
}

setup().catch(err => {
  console.error('❌ Setup error:', err);
  process.exit(1);
});
