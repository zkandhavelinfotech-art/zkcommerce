-- Local/demo-only admin login (password: demo1234). Do not use these defaults in production.
INSERT INTO merchants (name,email,password_hash,role) VALUES
 ('ZKCommerce Product Owner','admin@zkcommerce.in','$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS','admin')
ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role='admin';

-- Local/demo-only merchant logins (password: demo1234). Do not use these defaults in production.
INSERT INTO merchants (name,email,password_hash,role) VALUES
 ('Miliro Store Owner','merchant@miliro.in','$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS','merchant'),
 ('Smeram Store Owner','merchant@smeramnaturals.in','$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS','merchant'),
 ('Demo Store Owner','merchant@zkdemo.in','$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS','merchant')
ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,role='merchant';

-- v4.2 database-backed demo stores. These start as drafts for review before publishing.
INSERT INTO stores (merchant_id,store_name,slug,status,theme_name,primary_colour,bg_colour,accent_colour,tagline,hero_headline,hero_subtext,hero_cta_text,whatsapp_number,instagram_handle,city,state,theme_config)
SELECT id,'Miliro','miliro','draft','forest-green','#1A4D2E','#FFFFFF','#AEEA00','Powerful grease cutting. Safe on hands.','Plant-powered dishwash, made for everyday homes','LABSA-free, plant-derived surfactants. Made in India by Lumipure Essentials Pvt Ltd.','Shop Miliro','+91 44 75399 72026','@miliro','Coimbatore','Tamil Nadu',
'{"body_font":"Inter","primary_colour":"#1A4D2E","bg_colour":"#FFFFFF","accent_colour":"#AEEA00","fields":{"ann_text":"Plant-based & LABSA-free · Free delivery above ₹199","ann_bg":"#1A4D2E","ann_show":true,"hero_h1":"Powerful grease cutting. Safe on hands.","hero_desc":"Plant-powered, LABSA-free liquid dishwash. Made in India.","hero_bg":"#1A4D2E","hero_cta":"Shop Miliro","hero_img_show":true,"footer_bg":"#1A2E1A"},"sections":{"announcement":{"text":"Plant-based & LABSA-free · Free delivery above ₹199"},"hero":{"heading":"Powerful grease cutting. Safe on hands.","description":"Plant-powered, LABSA-free liquid dishwash. Made in India.","background":"#1A4D2E"},"offers":{"heading":"Launch offer","text":"Free delivery on orders above ₹199","visible":true},"footer":{"background":"#1A2E1A"}}}'::jsonb
FROM merchants WHERE email='merchant@miliro.in' ON CONFLICT (slug) DO NOTHING;

INSERT INTO stores (merchant_id,store_name,slug,status,theme_name,primary_colour,bg_colour,accent_colour,tagline,hero_headline,hero_subtext,hero_cta_text,whatsapp_number,instagram_handle,city,state,theme_config)
SELECT id,'Smeram Naturals','smeram','draft','floral-pink','#E91E8C','#FFF8F0','#D4A017','Pure · Powerful · Plant-Based','Siddha Hair Oil — Double Boiled, Double Infused','Traditional Siddha hair oil with 11 authentic herbs. Made in Chennai.','Buy Now — ₹349','+91 75399 72026','@smeramnaturals','Chennai','Tamil Nadu',
'{"body_font":"Inter","primary_colour":"#E91E8C","bg_colour":"#FFF8F0","accent_colour":"#D4A017","fields":{"ann_text":"🌿 VEGAN · CRUELTY FREE · 100% NATURAL","ann_bg":"#E65100","ann_show":true,"hero_h1":"Smeram Naturals Hair Oil","hero_sub":"Siddha Formulation · Double Boiled · Double Infused","hero_desc":"Traditional Siddha hair oil with 11 authentic herbs. Cold-pressed coconut base.","hero_bg":"#FFF8F0","hero_cta":"Buy Now — ₹349","hero_img_show":true,"footer_bg":"#2C1A0E"},"sections":{"announcement":{"text":"Vegan · Cruelty free · 100% natural"},"hero":{"heading":"Smeram Naturals Hair Oil","description":"Traditional Siddha hair oil with 11 authentic herbs.","background":"#FFF8F0"},"offers":{"heading":"Launch price ₹349","text":"Free delivery Tamil Nadu","visible":true},"footer":{"background":"#2C1A0E"}}}'::jsonb
FROM merchants WHERE email='merchant@smeramnaturals.in' ON CONFLICT (slug) DO NOTHING;

-- Requested Smeram Naturals demo catalog groups. Categories are optional when creating products.
INSERT INTO categories (store_id,name,slug,sort_order)
SELECT s.id,v.name,v.slug,v.sort_order
FROM stores s
CROSS JOIN (VALUES
  ('Hair Care Oil','hair-care-oil',1),
  ('Joint Pain & Orthocare','joint-pain-orthocare',2),
  ('Ayurgold Face Care','ayurgold-face-care',3),
  ('Health Foods','health-foods',4)
) AS v(name,slug,sort_order)
WHERE s.slug='smeram'
  AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.store_id=s.id AND c.slug=v.slug);

INSERT INTO stores (merchant_id,store_name,slug,status,theme_name,primary_colour,bg_colour,accent_colour,tagline,hero_headline,hero_subtext,hero_cta_text,city,state,theme_config)
SELECT id,'ZK Demo Market','zk-demo','draft','market','#087F8C','#F5F7F8','#DDF3EF','Everyday finds, thoughtfully selected','Discover your next favorite','A ready-to-customize demo storefront. Add your products, images, and brand details.','Shop the collection','Chennai','Tamil Nadu',
'{"style_preset":"market","primary_colour":"#087F8C","bg_colour":"#F5F7F8","accent_colour":"#DDF3EF","section_order":["hero","products","offers","trust","reviews","contact"],"sections":{"hero":{"heading":"Discover your next favorite","description":"A ready-to-customize demo storefront. Add your products, images, and brand details."},"products":{"heading":"Shop the collection"}}}'::jsonb
FROM merchants WHERE email='merchant@zkdemo.in' ON CONFLICT (slug) DO NOTHING;

-- Keep demo stores attached to their corresponding merchant accounts, including on re-seed.
UPDATE stores s SET merchant_id=m.id FROM merchants m
WHERE (s.slug='miliro' AND m.email='merchant@miliro.in')
   OR (s.slug='smeram' AND m.email='merchant@smeramnaturals.in');
UPDATE stores s SET merchant_id=m.id FROM merchants m
WHERE s.slug='zk-demo' AND m.email='merchant@zkdemo.in';
UPDATE merchants m SET store_id=s.id FROM stores s
WHERE (m.email='merchant@miliro.in' AND s.slug='miliro')
   OR (m.email='merchant@smeramnaturals.in' AND s.slug='smeram')
   OR (m.email='merchant@zkdemo.in' AND s.slug='zk-demo');

INSERT INTO products(store_id,name,slug,description,price,compare_price,images,in_stock,active,featured,badge_text)
SELECT s.id,'Dishwash Liquid 400ml','dishwash-400ml','Plant-based, LABSA-free lemon fresh liquid dishwash.',89,110,'[]'::jsonb,true,true,true,'Launch price'
FROM stores s WHERE s.slug='miliro' AND NOT EXISTS(SELECT 1 FROM products p WHERE p.store_id=s.id AND p.slug='dishwash-400ml');

INSERT INTO products(store_id,name,slug,description,price,compare_price,images,in_stock,active,featured,badge_text,ingredients)
SELECT s.id,'Siddha Hair Oil 100ml','siddha-hair-oil-100ml','Traditional Siddha hair oil with 11 herbs; double boiled and double infused.',349,399,'["/assets/smeram-product-1.jpg","/assets/smeram-product-2.jpg","/assets/smeram-product-3.jpg","/assets/smeram-product-4.jpg"]'::jsonb,true,true,true,'Bestseller','Cold-pressed coconut oil and traditional herbs'
FROM stores s WHERE s.slug='smeram' AND NOT EXISTS(SELECT 1 FROM products p WHERE p.store_id=s.id AND p.slug='siddha-hair-oil-100ml');

INSERT INTO products(store_id,name,slug,description,price,compare_price,images,in_stock,active,featured,badge_text)
SELECT s.id,'Everyday Tote','everyday-tote','A simple demo product. Replace its details and image from the Products workspace.',499,699,'[]'::jsonb,true,true,true,'Demo pick'
FROM stores s WHERE s.slug='zk-demo' AND NOT EXISTS(SELECT 1 FROM products p WHERE p.store_id=s.id AND p.slug='everyday-tote');

-- Smeram Naturals and Miliro demo stores use the full-layout designs (api/theme-designs.js).
UPDATE stores SET logo_url='/assets/themes/smeram/smeram-logo.png',primary_colour='#ED6375',bg_colour='#FFFFFF',accent_colour='#A3B545',
  whatsapp_number='+91 75399 72026',address='22/13 Rajaveedhi Street, Choolaimedu',city='Chennai',state='Tamil Nadu',
  tagline='Authentic Siddha & Ayurvedic wellness',
  hero_headline='Shop by Ayurvedic Category',hero_subtext='Authentic Siddha formulations, Ayurgold face care, orthocare and Vedic health foods.',
  -- Drop section overrides saved by the older design so the new content shows.
  theme_config=(COALESCE(theme_config,'{}'::jsonb) - 'sections' - 'templates' - 'hidden_sections' - 'removed_sections') || jsonb_build_object(
    'design','smeram','template_id','smeram-natural','style_preset','botanical',
    'primary_colour','#ED6375','bg_colour','#FFFFFF','accent_colour','#A3B545','logo_url','/assets/themes/smeram/smeram-logo.png',
    'section_order',jsonb_build_array('trust','hero','products','why','ingredients','reviews','contact'),
    'fields',jsonb_build_object(
      'body_font','Inter','hero_font','Playfair Display','nav_logo','/assets/themes/smeram/smeram-logo.png',
      'ann_text','🌿 Smeram Naturals · Sneha-Kalka-Drava Siddha Formulation · Free Shipping Above ₹399 Across India',
      'contact_phone','91-44-75399 72026','contact_email','smeramindustries@gmail.com',
      'trust_items',jsonb_build_array('VEGAN','CRUELTY FREE','ECOFRIENDLY','NATURAL'),
      'hero_sub','🌸 Siddha & Ayurvedic Formulations','hero_h1','Shop by Ayurvedic Category',
      'hero_desc','Choose from our pure Siddha hair care oils, joint mobility remedies, Ayurgold face care, and Vedic health foods. Click any category box below to explore products.',
      'products_heading','All Products','why_tag','Siddha Formulation Excellence','why_heading','Why Smeram Naturals?',
      'why_text','Centuries of documented Siddha knowledge blended with clinical hygiene. Smeram Industries produces uncompromised natural formulations without synthetic shortcuts.',
      'why_items',jsonb_build_array(
        '🏺 Sneha-Kalka-Drava Method — The authentic classical Siddha procedure where herbal paste (Kalka) is gently decocted into virgin cold-pressed oil (Sneha) with pure botanical juice (Drava).',
        '🔥 Double Boiled & Double Infused — Two-stage low-heat simmering ensures maximum phytonutrient extraction without denaturing fragile herbs.',
        '🌿 13 Documented Herbs — Ratanjot, Jadamanshi, Lemongrass, Jal Brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag and Bhringraj in virgin coconut oil.',
        '✨ 100% Dandruff Control — Soothes flaking, eliminates itchy fungus and purifies scalp follicles to stimulate thick new hair regrowth.',
        '🚫 Zero Harmful Chemicals — 0% mineral oil, no liquid paraffin, no silicones, parabens or synthetic fragrance.',
        '🏭 Choolaimedu, Chennai Origin — Manufactured and marketed by Smeram Industries in Chennai with complete batch traceability.'),
      'ingredients_heading','The 13 Classical Medicinal Herbs',
      'ingredients_items',jsonb_build_array(
        'Cold Pressed Virgin Coconut Oil — Pure medium-chain triglycerides that penetrate directly into the hair cortex.',
        'Ratanjot Roots — Cooling root that prevents premature greying and gives the rich natural reddish hue.',
        'Jadamanshi Roots — Calms nervous tension and reduces stress-induced hair fall.',
        'Vettiver — Cools the head and balances excess body heat.',
        'Lemongrass — Natural antifungal that clears stubborn dandruff.',
        'Jal Brahmi — Strengthens micro-capillaries supplying hair bulbs.',
        'Jalapippali — Soothes scalp infections and stimulates dormant roots.',
        'Amla — Rich in Vitamin C; strengthens roots and delays greying.',
        'Henna — Conditions cuticles and balances scalp pH.',
        'Curry Leaves — Prevents thinning and restores natural lustre.',
        'Hibiscus — Adds bounce, volume and silky softness.',
        'Gudrisag — Cooling greens that boost hair density.',
        'Bhringraj — The King of Hair; re-energises dormant follicles.'),
      'footer_text','Smeram Industries — Traditional Siddha Formulation Hair Oils & Authentic Ayurvedic Wellness crafted with double boiled infusion.'))
WHERE slug='smeram';

UPDATE categories c SET image_url=v.img FROM stores s, (VALUES
  ('hair-care-oil','/assets/themes/smeram/smeram-box-bottle.jpg'),('joint-pain-orthocare','/assets/themes/smeram/ortho-pain.jpg'),
  ('ayurgold-face-care','/assets/themes/smeram/face-care.jpg'),('health-foods','/assets/themes/smeram/health-foods.jpg')) AS v(slug,img)
WHERE c.store_id=s.id AND s.slug='smeram' AND c.slug=v.slug;

UPDATE products p SET name='Smeram Naturals Hair Oil',price=299,compare_price=349,badge_text='Sneha - Kalka - Drava Method',
  description=E'- Double Boiled\n- Double Infused\n- Hair Growth Promoter\n- 100% Dandruff Control\nAuthentic Siddha formulation, slow double-boiled with 13 herbs in pure virgin coconut oil.',
  ingredients='Cold pressed virgin Coconut Oil, Ratanjot Roots, Jadamanshi Roots, Vettiver, Lemongrass, Jal Brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag, Bhringraj',
  images='["/assets/themes/smeram/smeram-box-bottle.jpg","/assets/themes/smeram/smeram-bottles-pair.jpg","/assets/themes/smeram/smeram-bottle-single.jpg","/assets/themes/smeram/smeram-label.jpg","/assets/themes/smeram/smeram-ingredients-card.jpg"]'::jsonb,
  category_id=(SELECT c.id FROM categories c WHERE c.store_id=p.store_id AND c.slug='hair-care-oil')
FROM stores s WHERE p.store_id=s.id AND s.slug='smeram' AND p.slug='siddha-hair-oil-100ml';

INSERT INTO products(store_id,category_id,name,slug,description,ingredients,price,compare_price,images,in_stock,active,featured,badge_text)
SELECT s.id,(SELECT c.id FROM categories c WHERE c.store_id=s.id AND c.slug=v.cat),v.name,v.slug,v.descr,v.ingr,v.price,v.mrp,v.imgs::jsonb,true,true,false,v.badge
FROM stores s CROSS JOIN (VALUES
  ('joint-pain-orthocare','Mahanarayan Ortho Pain Oil','ortho-pain-oil',E'- Relieves knee stiffness\n- Deep penetrating warmth\n- Fast absorption\n- Restores joint mobility','Mahanarayan Taila, Gandhapura, Eucalyptus, Shallaki',349,450,'["/assets/themes/smeram/ortho-pain.jpg"]','Fast Relief'),
  ('ayurgold-face-care','Ayurgold Kumkumadi Face Oil','ayurgold-kumkumadi-oil',E'- Fades dark spots\n- Restores golden glow\n- Lightweight non-sticky\n- Pure Kashmiri Saffron','Kashmiri Saffron, Red Sandalwood, Manjistha, Lotus',499,699,'["/assets/themes/smeram/face-care.jpg"]','Ayurgold Radiance'),
  ('health-foods','Vedic A2 Desi Gir Cow Bilona Ghee','health-a2-ghee',E'- Granular golden texture\n- Boosts immunity\n- Vedic aroma\n- Cultured curd churned','100% Pure Cultured Gir Cow A2 Milk Fat',799,999,'["/assets/themes/smeram/health-foods.jpg"]','100% Pure')
) AS v(cat,name,slug,descr,ingr,price,mrp,imgs,badge)
WHERE s.slug='smeram' AND NOT EXISTS(SELECT 1 FROM products p WHERE p.store_id=s.id AND p.slug=v.slug);

UPDATE stores SET theme_config=COALESCE(theme_config,'{}'::jsonb) || '{"design":"miliro","template_id":"miliro-natural"}'::jsonb WHERE slug='miliro';

-- Seed standard statutory/legal pages for Smeram Naturals
INSERT INTO store_pages (store_id, title, slug, content, status, sort_order)
SELECT s.id, v.title, v.slug, jsonb_build_object('body', v.body), 'published', v.sort_order
FROM stores s CROSS JOIN (VALUES
  ('About Us', 'about-us', 1, 'Welcome to Smeram Naturals.\n\nWe produce authentic Siddha & Ayurvedic formulations using time-honored traditional methods. Centered on the classical Sneha-Kalka-Drava procedure, our flagship hair oils and herbal remedies are crafted in small batches in Chennai, Tamil Nadu.\n\nEvery batch is slow-simmered, double boiled, and double infused with 13 hand-selected medicinal herbs to preserve maximum phytonutrient efficacy. 100% plant-based, vegan, cruelty-free, and chemical-free.'),
  ('Contact Us', 'contact-us', 2, 'Customer Support & Inquiries — Smeram Naturals\n\nOperating Address:\nSmeram Industries\n22/13 Rajaveedhi Street, Choolaimedu, Chennai, Tamil Nadu - 600094\n\nEmail: smeramindustries@gmail.com\nPhone / WhatsApp: +91 75399 72026\n\nSupport Hours: Monday to Saturday, 9:00 AM – 6:00 PM IST.'),
  ('Privacy Policy', 'privacy-policy', 3, 'Privacy Policy — Smeram Naturals\n\nYour privacy is paramount to us. We collect customer details (name, shipping address, contact phone, and email) solely to process your orders, provide dispatch tracking alerts via WhatsApp, and improve our services.\n\nAll online payment transactions are processed securely via RBI-licensed payment gateways (Razorpay) using 256-bit SSL encryption. We never sell, rent, or trade your personal data with third-party marketers.'),
  ('Terms of Service', 'terms-of-service', 4, 'Terms of Service — Smeram Naturals\n\nBy placing an order on our store, you confirm that you have read and agreed to these terms. All prices are listed in Indian Rupees (INR) and are inclusive of statutory GST where applicable.\n\nOrders are accepted subject to product availability and delivery serviceability. We reserve the right to cancel orders with incorrect information or suspected fraud.'),
  ('Refund & Cancellation Policy', 'refund-policy', 5, 'Refund & Return Policy — Smeram Naturals\n\nIf you receive a damaged, leaking, or defective bottle, please inform our support team within 48 hours of receipt at smeramindustries@gmail.com or via WhatsApp at +91 75399 72026 with unboxing photo/video evidence.\n\nWe will promptly ship a free replacement or issue a full refund to your original payment method within 5–7 business days.'),
  ('Shipping & Delivery Policy', 'shipping-policy', 6, 'Shipping Policy — Smeram Naturals\n\nOrders are dispatched within 24 to 48 hours via leading domestic courier partners (ST Courier, Delhivery, Professional Couriers).\n\nStandard delivery time:\n- Tamil Nadu & South India: 2 to 3 business days.\n- Rest of India: 3 to 6 business days.\n\nFree shipping applies on orders above ₹399 across India. Live tracking information is automatically sent to your WhatsApp number upon parcel handover.')
) AS v(title, slug, sort_order, body)
WHERE s.slug='smeram'
ON CONFLICT (store_id, slug) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, status='published';
