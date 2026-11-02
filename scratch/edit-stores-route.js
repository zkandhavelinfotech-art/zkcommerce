const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'zkc', 'api', 'routes', 'stores.js');
let content = fs.readFileSync(file, 'utf8');

const target = `    if (fields.custom_domain) {
      const conflict = await pool.query('SELECT id FROM stores WHERE lower(custom_domain)=lower($1) AND id<>$2',[fields.custom_domain,req.params.id]);
      if (conflict.rows.length) return res.status(409).json({ error: 'Custom domain is already connected to another store' });
    }
    const { rows } = await pool.query(
      \`UPDATE stores SET theme_config=$3::jsonb, store_name=COALESCE($4,store_name), tagline=COALESCE($5,tagline),
       hero_headline=COALESCE($6,hero_headline),hero_subtext=COALESCE($7,hero_subtext),hero_cta_text=COALESCE($8,hero_cta_text),
       primary_colour=COALESCE($9,primary_colour),bg_colour=COALESCE($10,bg_colour),accent_colour=COALESCE($11,accent_colour),
       logo_url=COALESCE($12,logo_url),whatsapp_number=COALESCE($13,whatsapp_number),instagram_handle=COALESCE($14,instagram_handle),
       address=COALESCE($15,address),city=COALESCE($16,city),state=COALESCE($17,state),custom_domain=COALESCE($18,custom_domain),updated_at=NOW()
       WHERE id=$1 AND merchant_id=$2 RETURNING id,store_name,slug,status,theme_config,updated_at\`,
      [req.params.id, req.user.id, JSON.stringify(theme_config), fields.store_name, fields.tagline,
       fields.hero_headline, fields.hero_subtext, fields.hero_cta_text, fields.primary_colour,
       fields.bg_colour, fields.accent_colour, fields.logo_url, fields.whatsapp_number, fields.instagram_handle,
       fields.address, fields.city, fields.state, fields.custom_domain]
    );`;

const replacement = `    if (fields.custom_domain) {
      const conflict = await pool.query('SELECT id FROM stores WHERE lower(custom_domain)=lower($1) AND id<>$2',[fields.custom_domain,req.params.id]);
      if (conflict.rows.length) return res.status(409).json({ error: 'Custom domain is already connected to another store' });
    }
    // Retain settings between Store Builder and Merchant Portal (both keep what the other saved)
    const existingRes = await pool.query('SELECT theme_config FROM stores WHERE id=$1 AND merchant_id=$2', [req.params.id, req.user.id]);
    if (!existingRes.rows.length) return res.status(404).json({ error: 'Store not found' });
    const existingConfig = existingRes.rows[0].theme_config || {};
    const finalThemeConfig = {
      ...existingConfig,
      ...theme_config,
      checkout: {
        ...(existingConfig.checkout || {}),
        ...(theme_config.checkout || {})
      }
    };
    const { rows } = await pool.query(
      \`UPDATE stores SET theme_config=$3::jsonb, store_name=COALESCE($4,store_name), tagline=COALESCE($5,tagline),
       hero_headline=COALESCE($6,hero_headline),hero_subtext=COALESCE($7,hero_subtext),hero_cta_text=COALESCE($8,hero_cta_text),
       primary_colour=COALESCE($9,primary_colour),bg_colour=COALESCE($10,bg_colour),accent_colour=COALESCE($11,accent_colour),
       logo_url=COALESCE($12,logo_url),whatsapp_number=COALESCE($13,whatsapp_number),instagram_handle=COALESCE($14,instagram_handle),
       address=COALESCE($15,address),city=COALESCE($16,city),state=COALESCE($17,state),custom_domain=COALESCE($18,custom_domain),updated_at=NOW()
       WHERE id=$1 AND merchant_id=$2 RETURNING id,store_name,slug,status,theme_config,updated_at\`,
      [req.params.id, req.user.id, JSON.stringify(finalThemeConfig), fields.store_name, fields.tagline,
       fields.hero_headline, fields.hero_subtext, fields.hero_cta_text, fields.primary_colour,
       fields.bg_colour, fields.accent_colour, fields.logo_url, fields.whatsapp_number, fields.instagram_handle,
       fields.address, fields.city, fields.state, fields.custom_domain]
    );`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updated = normalizedContent.replace(normalizedTarget, replacement.replace(/\r\n/g, '\n'));
  fs.writeFileSync(file, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated stores.js');
} else {
  console.error('Target not found in stores.js');
}

