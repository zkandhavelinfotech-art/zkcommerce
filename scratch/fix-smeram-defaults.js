const fs = require('fs');
const path = require('path');

const smeramDefaultsCode = `const SMERAM_DEFAULTS = {
  'smeram naturals hair oil': {
    benefits: [
      'Deep Root Nourishment — Classical Sneha-Kalka-Drava herb decoction stimulates dormant follicles.',
      '100% Dandruff Control — Antibacterial Ratanjot & Vetiver soothe scalp irritation.',
      'Hair Fall Reduction — Bhringraj, Amla & Brahmi strengthen keratin roots.',
      'Zero Mineral Oil — 100% pure cold-pressed coconut oil base with no liquid paraffin.'
    ],
    ingredients: ['Virgin Coconut Oil', 'Brahmi', 'Amla', 'Bhringraj', 'Ratanjot Roots', 'Jadamanshi', 'Vetiver', 'Curry Leaves', 'Hibiscus', 'Fenugreek', 'Lemongrass', 'Neem', 'Henna'],
    howto: 'Step 1: Take 5–10 ml of oil, warm gently between palms.\\nStep 2: Apply evenly across scalp and hair roots.\\nStep 3: Massage in circular fingertip motions for 10 minutes.\\nStep 4: Leave for 1–2 hours or overnight; wash with mild cleanser. Use 3 times weekly.'
  },
  'mahanarayan ortho pain oil': {
    benefits: [
      'Fast Joint & Muscular Relief — Eases knee stiffness, back pain and neck discomfort.',
      'Deep Penetrating Heat Therapy — Stimulates micro-circulation for soothing warmth.',
      'Cartilage & Synovial Support — Nourishes connective tissues and joint mobility.',
      'Non-Greasy Herbal Aroma — Pure classical formulation with zero pungent synthetic smell.'
    ],
    ingredients: ['Mahanarayan Taila (52 classical herbs)', 'Gandhapura (Wintergreen)', 'Shallaki (Boswellia)', 'Nilgiri (Eucalyptus)', 'Nirgundi', 'Camphor', 'Virgin Sesame Oil'],
    howto: 'Step 1: Clean and gently pat dry affected joint or muscle area.\\nStep 2: Apply 5–8 ml of Mahanarayan Ortho Oil.\\nStep 3: Massage gently with firm strokes for 8–10 minutes.\\nStep 4: Cover with warm dry compress for deeper penetration. Apply twice daily.'
  },
  'ayurgold kumkumadi face oil': {
    benefits: [
      'Fades Pigmentation & Dark Spots — Pure Kashmiri saffron and Manjistha restore clear tone.',
      'Luminous Golden Radiance — Imparts a healthy youthful glow to dull complexion.',
      'Lightweight Overnight Elixir — Fast-absorbing botanical lipids nourish without greasy residue.',
      'Clean Beauty Guarantee — Free of parabens, mineral oils, silicones, and synthetic fragrance.'
    ],
    ingredients: ['Grade-A Kashmiri Saffron (Crocus Sativus)', 'Red Sandalwood', 'Manjistha', 'Blue Lotus', 'Licorice', 'Pure Goat Milk', 'Virgin Sesame Seed Oil'],
    howto: 'Step 1: Cleanse face and pat dry.\\nStep 2: Dispense 2–3 drops onto clean fingertips.\\nStep 3: Dab lightly across forehead, cheeks, and jawline; massage upward.\\nStep 4: Leave on overnight as a restorative beauty treatment. Use nightly.'
  },
  'vedic a2 desi gir cow bilona ghee': {
    benefits: [
      'Traditional Wooden Bilona Method — Churned strictly from whole cultured A2 curd.',
      'Golden Granular Texture (Danedar) — Divine Vedic aroma and unmatched purity.',
      'Stimulates Digestive Fire (Agni) — Rich in natural butyric acid for gut flora.',
      'High Thermal Smoke Point (~250°C) — Does not degrade or release free radicals in cooking.'
    ],
    ingredients: ['100% Pure Cultured Desi Gir Cow A2 Milk Fat (Traditional Bi-Directional Wooden Bilona Method)'],
    howto: 'Step 1: Add 1–2 teaspoons daily to warm rice, rotis, or warm milk.\\nStep 2: Take 1 tsp in the morning with warm water to kindle digestive agni.\\nStep 3: Suitable for daily Ayurvedic wellness, cooking, and sautéing.'
  }
};
`;

const files = [
  path.join(__dirname, '..', 'zkc', 'api', 'theme-designs.js'),
  path.join(__dirname, '..', 'zkc-build', 'api', 'theme-designs.js')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  // Remove existing SMERAM_DEFAULTS definition wherever it is inside renderDesign
  content = content.replace(/\n\s*const SMERAM_DEFAULTS = \{[\s\S]*?\n\s*\};\n/, '\n');

  // Insert SMERAM_DEFAULTS above function renderDesign
  content = content.replace('function renderDesign(name, ctx) {', smeramDefaultsCode + '\nfunction renderDesign(name, ctx) {');

  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Fixed SMERAM_DEFAULTS hoisting in:', file);
}

