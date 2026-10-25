require('dotenv').config();
const pool = require('./api/db');

async function main() {
  console.log('--- Setting Custom Domain and Refreshing Snapshot for Smeram Naturals ---');
  await pool.query("UPDATE stores SET custom_domain='smeram-naturals.in', updated_at=NOW() WHERE id=2");
  const storeRes = await pool.query('SELECT * FROM stores WHERE id=2');
  const store = storeRes.rows[0];
  const [products, pages] = await Promise.all([
    pool.query('SELECT p.*, c.name AS category_name, c.image_url AS category_image FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 AND p.active=true ORDER BY p.featured DESC, p.created_at DESC', [store.id]),
    pool.query("SELECT * FROM store_pages WHERE store_id=$1 AND status='published' ORDER BY sort_order, id", [store.id])
  ]);

  const snapshot = {
    version: 1,
    published_at: new Date().toISOString(),
    store: {
      store_name: store.store_name,
      slug: store.slug,
      custom_domain: store.custom_domain,
      tagline: store.tagline,
      hero_headline: store.hero_headline,
      hero_subtext: store.hero_subtext,
      hero_cta_text: store.hero_cta_text,
      primary_colour: store.primary_colour,
      bg_colour: store.bg_colour,
      accent_colour: store.accent_colour,
      logo_url: store.logo_url,
      whatsapp_number: store.whatsapp_number,
      instagram_handle: store.instagram_handle,
      address: store.address,
      city: store.city,
      state: store.state
    },
    theme_config: store.theme_config || {},
    products: products.rows,
    pages: pages.rows
  };

  await pool.query(
    "UPDATE stores SET published_snapshot=$1::jsonb, status='published', published_at=NOW(), updated_at=NOW() WHERE id=2",
    [JSON.stringify(snapshot)]
  );

  console.log('✅ Successfully updated store 2:');
  console.log('   Custom Domain:', store.custom_domain);
  console.log('   Status:', store.status);
  console.log('   Products in snapshot:', products.rows.length);
  products.rows.forEach(p => {
    console.log(`   - ${p.name} | Size: ${p.product_size} | Offer: ${p.offer_text} | ₹${p.price}`);
  });
  process.exit(0);
}

main().catch(err => {
  console.error('Error applying domain:', err);
  process.exit(1);
});
