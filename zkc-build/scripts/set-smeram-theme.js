require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("SELECT id, slug, store_name, theme_config FROM stores WHERE slug = 'smeram'");
    if (!res.rows.length) {
      console.error('Store smeram not found');
      process.exit(1);
    }
    const store = res.rows[0];
    console.log('Current store:', store.id, store.store_name);
    console.log('Current theme_config:', store.theme_config);

    const tc = store.theme_config || {};
    tc.announcement_enabled = false;
    tc.sections = tc.sections || {};
    tc.sections.announcement = { ...tc.sections.announcement, visible: false };
    tc.sections.products = { ...tc.sections.products, visible: false };
    tc.sections.nav = {
      ...tc.sections.nav,
      menu: [
        { type: 'page', page: 'about-us', label: 'About Us' },
        { type: 'shop', label: 'Shop' },
        { type: 'contact', label: 'Contact Us' }
      ]
    };
    tc.fields = tc.fields || {};
    tc.fields.announcement_enabled = false;
    tc.fields.ann_show = false;
    tc.style_preset = 'smeram';
    tc.template_id = 'smeram-natural';
    tc.design = 'smeram';
    tc.primary_colour = '#ED6375';
    tc.bg_colour = '#FFF5F7';
    tc.accent_colour = '#A3B545';

    // Also update published_snapshot if present
    const snapRes = await pool.query("SELECT published_snapshot FROM stores WHERE id = $1", [store.id]);
    let snap = snapRes.rows[0]?.published_snapshot;
    if (snap) {
      if (typeof snap === 'string') {
        try { snap = JSON.parse(snap); } catch (e) {}
      }
      snap.theme_config = { ...(snap.theme_config || {}), ...tc };
      if (snap.store) {
        snap.store.theme_config = { ...(snap.store.theme_config || {}), ...tc };
        snap.store.primary_colour = '#ED6375';
        snap.store.bg_colour = '#FFF5F7';
        snap.store.accent_colour = '#A3B545';
      }
    }

    await pool.query(
      "UPDATE stores SET theme_name = 'smeram-natural', primary_colour = '#ED6375', bg_colour = '#FFF5F7', accent_colour = '#A3B545', theme_config = $1, published_snapshot = $2 WHERE id = $3",
      [JSON.stringify(tc), snap ? JSON.stringify(snap) : null, store.id]
    );

    console.log('Updated Smeram store theme_config and published_snapshot successfully!');
    const verify = await pool.query("SELECT id, theme_name, primary_colour, bg_colour, theme_config, published_snapshot FROM stores WHERE id = $1", [store.id]);
    console.log('Verification theme_config:', JSON.stringify(verify.rows[0].theme_config, null, 2));
    console.log('Verification snap theme_config:', JSON.stringify(verify.rows[0].published_snapshot?.theme_config, null, 2));
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
run();
