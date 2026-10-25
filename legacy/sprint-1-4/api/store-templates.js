// Curated, editable starter storefronts. These settings are copied into each
// merchant's own store; the template catalog itself remains platform-owned.
const templates = [
  { id:'smeram-natural', name:'Smeram Naturals', category:'Natural care', preview:'/api/stores/templates/smeram-natural/preview', description:'Floral garland header and footer, category boxes, rose-pink and olive branding with detailed product label pages.', colors:['#ED6375','#FFFFFF','#A3B545'], preset:'botanical', design:'smeram', source:'smeram' },
  { id:'miliro-natural', name:'Miliro', category:'Home & personal care', preview:'/api/stores/templates/miliro-natural/preview', description:'Deep forest-green hero, bright lemon accents and a clean product focused layout.', colors:['#1A4D2E','#FFFFFF','#AEEA00'], preset:'botanical', design:'miliro', source:'miliro' },
  { id:'studio', name:'Studio', category:'Minimal', preview:null, description:'A calm, versatile layout for a polished product catalog.', colors:['#202223','#FFFFFF','#008060'], preset:'studio' },
  { id:'atelier', name:'Atelier', category:'Editorial', preview:null, description:'Typography led editorial styling for considered collections.', colors:['#47352D','#FBF7F0','#BD8C48'], preset:'atelier' },
  { id:'market', name:'Market', category:'Catalog', preview:null, description:'Compact product cards designed for broad catalogs.', colors:['#174A72','#F5F8FA','#EF8A36'], preset:'market' },
  { id:'playful', name:'Playful', category:'Bright', preview:null, description:'Rounded shapes and bold color for energetic brands.', colors:['#7145C7','#FFF9F0','#F2A900'], preset:'playful' },
  { id:'tech', name:'Tech', category:'Modern', preview:null, description:'Crisp structure for modern and technical products.', colors:['#1769AA','#F7FAFC','#11A88A'], preset:'tech' },
  { id:'midnight', name:'Midnight', category:'Dark', preview:null, description:'A dark storefront with high contrast product details.', colors:['#45A8FF','#07121D','#A8E65B'], preset:'midnight' }
];

// Starter copy for the full-layout designs. Merchants replace it in Store Builder.
const designFields = {
  smeram: {
    body_font:'Inter', hero_font:'Playfair Display',
    ann_text:'ðŸŒ¿ Pure, natural care Â· Free shipping above â‚¹399 across India',
    trust_items:['VEGAN','CRUELTY FREE','ECOFRIENDLY','NATURAL'],
    hero_sub:'ðŸŒ¸ Natural & Ayurvedic formulations',
    hero_h1:'Shop by Category',
    hero_desc:'Choose from our pure, small-batch natural formulations. Click any category box to explore products.',
    hero_cta:'Shop all products',
    products_heading:'All Products',
    why_heading:'Why choose us?',
    why_text:'Traditional knowledge blended with clean, careful manufacturing â€” no synthetic shortcuts.',
    why_items:[
      'ðŸº Traditional methods â€” Prepared in small batches using time-honoured methods.',
      'ðŸ”¥ Slow processed â€” Low-heat preparation keeps every ingredient potent.',
      'ðŸŒ¿ Real ingredients â€” Every ingredient is listed openly on our labels.',
      'âœ¨ Visible results â€” Formulations our customers come back to.',
      'ðŸš« No harmful chemicals â€” No mineral oil, parabens or synthetic fragrance.',
      'ðŸ­ Made in India â€” Manufactured and marketed by us, with full batch traceability.'
    ],
    footer_text:'Natural formulations crafted with care.'
  },
  miliro: {
    body_font:'Inter', hero_font:'Playfair Display',
    ann_text:'ðŸŒ¿ Plant-based & safe for your family â€” Free delivery on orders above â‚¹199',
    trust_items:['ðŸŒ¿ Plant-derived ingredients','ðŸ§ª No harsh chemicals','â™»ï¸ Biodegradable formula','ðŸ­ Made in India'],
    hero_sub:'ðŸš€ Now available',
    hero_h1:'Powerful cleaning. Safe on hands.',
    hero_desc:'Plant-powered home care made for everyday Indian homes â€” tough on grease, gentle on you.',
    hero_cta:'Shop now',
    products_heading:'Our Products',
    why_heading:'The safer choice for every household.',
    why_items:[
      'ðŸš« Zero harsh chemicals â€” Safer, plant-derived surfactants that clean just as powerfully.',
      'ðŸ¤² Gentle on hands â€” Safe for daily use, even for sensitive skin.',
      'ðŸ‹ Natural freshness â€” Fresh fragrance with no chemical after-smell.',
      'ðŸ«§ Rich foam â€” A few drops go a long way.',
      'â™»ï¸ Earth friendly â€” Biodegradable formula and recyclable packaging.',
      'ðŸ­ Made in India â€” Proudly manufactured in Tamil Nadu.'
    ],
    howtouse_items:['ðŸ’§ Take a few drops â€” Squeeze onto a wet sponge or scrubber.','ðŸ«§ Scrub gently â€” The rich lather lifts oil and residue.','âœ¨ Rinse clean â€” No residue, no chemical smell.'],
    footer_text:'Plant-based home care, made in India.'
  }
};

function configFor(template) {
  const config = {
    template_id: template.id,
    template_name: template.name,
    style_preset: template.preset,
    primary_colour: template.colors[0],
    bg_colour: template.colors[1],
    accent_colour: template.colors[2],
    fields: {
      primary_colour: template.colors[0], bg_colour: template.colors[1], accent_colour: template.colors[2],
      body_font: 'Inter', hero_font: 'Playfair Display',
      hero_h1: 'A little better, every day',
      hero_desc: 'Thoughtfully made essentials for your home and everyday life.',
      hero_cta: 'Shop the collection',
      ann_text: 'Welcome to our store Â· Thoughtful products, delivered to you',
      products_heading: 'Shop our collection',
      trust_items: ['Thoughtfully selected','Secure checkout','Made with care'],
      footer_text: 'Thoughtful essentials for everyday living.'
    }
  };
  if (template.design) {
    config.design = template.design;
    Object.assign(config.fields, designFields[template.design]);
  }
  return config;
}

// Sample catalog used only to preview a design in the setup wizard.
const demoProducts = {
  smeram: [
    { id:1, name:'Smeram Naturals Hair Oil', slug:'hair-oil', category_name:'Hair Care Oil', price:299, compare_price:349, badge_text:'Sneha - Kalka - Drava Method', in_stock:true,
      product_size:'100 ml', offer_text:'Special Festive Offer - Save ₹50',
      description:'- Double Boiled & Double Infused\n- Hair Growth Promoter from Roots\n- 100% Dandruff Control & Scalp Cooling\n- 100% Natural, Vegan & Cruelty-Free\n\nCrafted according to the traditional Sneha - Kalka - Drava method. Fresh botanical herbs are slowly infused into cold-pressed virgin coconut oil over 72 hours to preserve potent phytochemicals.',
      ingredients:'Cold pressed virgin Coconut Oil, Ratanjot Roots, Jadamanshi Roots, Vettiver, Lemongrass, Jal Brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag, Bhringraj',
      user_instructions:'Take 5-10 ml of Smeram Herbal Hair Oil. Warm gently between palms and apply directly to scalp and roots. Massage gently with circular fingertip motions for 10 minutes to stimulate blood circulation. Leave on for at least 1-2 hours or overnight for deep root nourishment. Wash off thoroughly with a mild herbal shampoo. Recommended 3 times weekly.',
      benefits:'• Stimulates healthy hair growth from dormant follicles\n• 100% Dandruff control & soothing itchy scalp\n• Reduces hair fall & strengthens roots from base\n• Enriched with Brahmi, Amla, Bhringraj & 12 cold-infused herbs',
      additional_note:'Inclusive of GST and free shipping.',
      images:['/assets/themes/smeram/smeram-box-bottle.jpg','/assets/themes/smeram/smeram-bottles-pair.jpg','/assets/themes/smeram/smeram-bottle-single.jpg','/assets/themes/smeram/smeram-label.jpg','/assets/themes/smeram/smeram-ingredients-card.jpg'] },
    { id:2, name:'Mahanarayan Ortho Pain Oil', slug:'ortho-pain-oil', category_name:'Joint Pain & Orthocare', price:349, compare_price:450, badge_text:'Fast Relief', in_stock:true,
      description:'- Relieves knee stiffness\n- Deep penetrating warmth\n- Fast absorption', ingredients:'Mahanarayan Taila, Gandhapura, Eucalyptus, Shallaki', images:['/assets/themes/smeram/ortho-pain.jpg'] },
    { id:3, name:'Ayurgold Kumkumadi Face Oil', slug:'kumkumadi-face-oil', category_name:'Ayurgold Face Care', price:499, compare_price:699, badge_text:'Radiant Glow', in_stock:true,
      description:'- Fades dark spots\n- Restores golden glow\n- Lightweight, non-sticky', ingredients:'Kashmiri Saffron, Red Sandalwood, Manjistha, Lotus', images:['/assets/themes/smeram/face-care.jpg'] },
    { id:4, name:'Vedic A2 Gir Cow Bilona Ghee', slug:'a2-bilona-ghee', category_name:'Health Foods', price:799, compare_price:999, badge_text:'100% Pure', in_stock:true,
      description:'- Granular golden texture\n- Cultured curd churned', ingredients:'Cultured Gir Cow A2 milk fat', images:['/assets/themes/smeram/health-foods.jpg'] }
  ],
  miliro: [
    { id:1, name:'Miliro Liquid Dishwash 400ml', slug:'dishwash-400ml', category_name:'Dishwash', price:89, compare_price:110, badge_text:'Launch Price', in_stock:true,
      description:'- Removes tough grease\n- Gentle on hands\n- Rich, long-lasting foam', ingredients:'Plant surfactants, Lemon extract, Aloe vera, Purified water', images:[] },
    { id:2, name:'Miliro Dishwash 750ml', slug:'dishwash-750ml', category_name:'Dishwash', price:159, compare_price:189, in_stock:false, description:'Orange burst fragrance â€” coming soon.', images:[] }
  ]
};

function demoSnapshot(template) {
  const design = template.design;
  return {
    store: { store_name: template.name, slug: 'demo', tagline: template.description, primary_colour: template.colors[0], bg_colour: template.colors[1], accent_colour: template.colors[2],
      logo_url: design === 'smeram' ? '/assets/themes/smeram/smeram-logo.png' : null, whatsapp_number: '9876543210', address: 'Chennai', state: 'Tamil Nadu' },
    theme_config: configFor(template),
    products: demoProducts[design] || [],
    pages: []
  };
}

module.exports = { templates, configFor, demoSnapshot, designFields };

