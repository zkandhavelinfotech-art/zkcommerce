// Full-layout storefront designs built from the Smeram Naturals and Miliro client sources.
// Each design renders the merchant's own catalog, pages, text and colors; only the layout and
// styling come from the reference sites. Cart and checkout are supplied by store-renderer.js.

const skins = {
  smeram: {
    brand: '#ED6375', accent: '#A3B545', page: '#FFFFFF', dark: '#2F0916', text: '#241812', muted: '#6B5547',
    border: '#EADBCE', borderLight: '#F4EBE3', soft: '#FAF7F2', method: '#E85D04', gold: '#F0C040', star: '#D4A017',
    headingFont: "'Cormorant Garamond',Georgia,serif", bodyFont: "'Inter',-apple-system,sans-serif",
    fonts: 'family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=Inter:wght@300;400;500;600;700;800',
    floralTop: '/assets/themes/smeram/floral-top-banner.png', floralBottom: '/assets/themes/smeram/floral-bottom-banner.png',
    heroDark: false, whyDark: false, leaf: '🍃',
    defaultOrder: ['trust','hero','products','why','ingredients','howtouse','gallery','reviews','contact']
  },
  miliro: {
    brand: '#1A4D2E', accent: '#AEEA00', page: '#FFFFFF', dark: '#1A2E1A', text: '#2E3D2E', muted: '#5D7A5D',
    border: '#D4E6D4', borderLight: '#E8F2E4', soft: '#F1F8E9', method: '#2E7D32', gold: '#AEEA00', star: '#FFD600',
    headingFont: "'Playfair Display',Georgia,serif", bodyFont: "'Inter',-apple-system,sans-serif",
    fonts: 'family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,400&family=Inter:wght@300;400;500;600;700;800',
    floralTop: '', floralBottom: '',
    heroDark: true, whyDark: true, leaf: '🌿',
    defaultOrder: ['hero','trust','products','why','ingredients','howtouse','reviews','gallery','contact']
  }
};

// `design: 'none'` is set when a merchant switches to a section-based preset after using a design.
const designFor = config => {
  if (!config || config.design === 'none') return null;
  const value = config.design || ({ 'smeram-natural':'smeram', 'miliro-natural':'miliro' })[config.template_id];
  return skins[value] ? value : null;
};

function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}
const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;
function mix(hex, target, amount) {
  const a = hexToRgb(hex), b = hexToRgb(target);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

const emoji = /^((?:\p{Regional_Indicator}{2})|\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)\s*/u;
// "🌿 Title — description | tag" style items typed one per line in Store Builder.
function parseItem(raw) {
  let text = String(raw || '').trim(), icon = '';
  const m = text.match(emoji);
  if (m) { icon = m[1]; text = text.slice(m[0].length); }
  if (text.includes('|')) { const [title, desc, tag] = text.split('|').map(x => x.trim()); return { icon, title, desc: desc || '', tag: tag || '' }; }
  const sep = text.match(/\s+[—–-]\s+|:\s+/);
  if (sep) return { icon, title: text.slice(0, sep.index).trim(), desc: text.slice(sep.index + sep[0].length).trim(), tag: '' };
  return { icon, title: text, desc: '', tag: '' };
}
function parseReview(raw) {
  const text = String(raw || '').trim(), idx = text.lastIndexOf(' — ');
  if (idx < 0) return { quote: text.replace(/^["“]|["”]$/g, ''), name: '', role: '' };
  const [name, ...role] = text.slice(idx + 3).split(',');
  return { quote: text.slice(0, idx).replace(/^["“]|["”]$/g, ''), name: name.trim(), role: role.join(',').trim() };
}
// Product descriptions may hold bullet lines ("- Double boiled"); the rest stays as prose.
function splitDescription(text) {
  const bullets = [], prose = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const t = line.trim(); if (!t) return;
    if (/^[-•*✓]\s+/.test(t)) bullets.push(t.replace(/^[-•*✓]\s+/, '')); else prose.push(t);
  });
  return { bullets, prose: prose.join(' ') };
}

const UNIT_LABEL = { ml: 'ml', l: 'L', g: 'g', kg: 'kg', pcs: 'pcs' };
const netQuantityLabel = p => (p && p.net_quantity_value && p.net_quantity_unit ? `${Number(p.net_quantity_value)} ${UNIT_LABEL[p.net_quantity_unit] || p.net_quantity_unit}` : '');

function renderDesign(name, ctx) {
  const skin = skins[name];
  const { store, cfg, fields, allProducts, template, product, page, collection, pages, sec, isVisible, list,
    escapeHtml: esc, safeImage, safeColor, safeLink, slugify, format, cartMarkup, cartLogic, slug, title, description } = ctx;
  const basePath = ctx.basePath || '';
  const storeUrl = p => (basePath ? (p === '/' ? basePath : basePath + p) : p);

  const brand = safeColor(cfg.primary_colour || store.primary_colour, skin.brand);
  const accent = safeColor(cfg.accent_colour || store.accent_colour, skin.accent);
  const page_bg = safeColor(cfg.bg_colour || store.bg_colour, skin.page);
  const brandDark = mix(brand, '#000000', .14), brandLight = mix(brand, '#FFFFFF', .9), brandBorder = mix(brand, '#FFFFFF', .62);
  const accentDark = mix(accent, '#000000', .28), accentLight = mix(accent, '#FFFFFF', .88);
  const storeName = store.store_name || 'Online Store';
  const logo = safeImage(fields.nav_logo || cfg.logo_url || store.logo_url);
  const digits = String(store.whatsapp_number || '').replace(/\D/g, '');
  const waNumber = digits.length === 10 ? '91' + digits : digits;
  const wa = msg => waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}` : '';
  const phone = fields.contact_phone || store.whatsapp_number || '';
  const email = fields.contact_email || '';
  const address = [store.address, store.city, store.state].filter(Boolean).join(', ');
  const publishedPages = (pages || []).filter(p => p.status === 'published');
  const productPath = p => p.slug ? storeUrl(`/products/${encodeURIComponent(p.slug)}`) : '#';
  const imagesOf = p => (Array.isArray(p.images) ? p.images : []).map(safeImage).filter(Boolean);
  const catOverrides = (sec('hero') && sec('hero').category_images) || fields.category_images || {};
  const categoryName = p => p.category_name || p.category || '';
  const categories = (ctx.categories && ctx.categories.length)
    ? ctx.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug || slugify(cat.name),
        image: safeImage(catOverrides[cat.id] || catOverrides[cat.slug] || catOverrides[cat.name] || cat.image_url || ''),
        count: 0
      }))
    : [];
  allProducts.forEach(p => {
    const n = categoryName(p); if (!n) return;
    let c = categories.find(x => x.name === n || (p.category_id && String(x.id) === String(p.category_id)));
    if (!c) {
      categories.push(c = {
        name: n,
        slug: slugify(n),
        image: safeImage(catOverrides[n] || catOverrides[slugify(n)] || p.category_image) || imagesOf(p)[0] || '',
        count: 0
      });
    }
    c.count++;
    if (!c.image) c.image = safeImage(catOverrides[c.id] || catOverrides[c.slug] || catOverrides[c.name] || p.category_image) || imagesOf(p)[0] || '';
  });
  categories.forEach(c => {
    const override = catOverrides[c.id] || catOverrides[c.slug] || catOverrides[c.name];
    if (override) c.image = safeImage(override);
  });
  const trustItems = list(sec('trust').items || fields.trust_items);
  const stars = '★★★★★';

  const wordmark = (cls = '') => {
    if (logo) return `<img src="${logo}" alt="${esc(storeName)}" class="brand-logo-img ${cls}">`;
    const [first, ...rest] = String(fields.nav_name || storeName).trim().split(/\s+/);
    return `<span class="wordmark ${cls}"><span class="wm-1">${esc(first)}</span>${rest.length ? `<span class="wm-2">${esc(rest.join(' '))}</span>` : ''}</span>`;
  };
  const showOffers = p => (p && p.show_offer !== undefined && p.show_offer !== null ? p.show_offer !== false : (cfg.display || {}).show_offers !== false);
  const discount = p => showOffers(p) && p.compare_price && Number(p.compare_price) > Number(p.price) ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  // "All Products" links follow the products section: hide the section and every link to it goes too.
  const showAllProducts = isVisible('products');

  const productCard = p => {
    const img = imagesOf(p)[0], off = discount(p), d = splitDescription(p.description);
    const size = p.product_size || p.size || '';
    const offer = showOffers(p) ? (p.offer_text || p.offer || '') : '';
    return `<article class="prod-box-card" data-zkc-section="products"><a href="${productPath(p)}" class="prod-box-link" aria-label="${esc(p.name)}" onclick="return zkQuickView(${Number(p.id)})"></a>${p.badge_text ? `<div class="prod-box-badge">${esc(p.badge_text)}</div>` : ''}${off ? `<div class="prod-box-discount">${off}% OFF</div>` : ''}<div class="prod-box-media">${img ? `<img src="${img}" alt="${esc(p.name)}" loading="lazy">` : `<span class="no-img">${esc(p.name.slice(0, 1))}</span>`}</div><div class="prod-box-body"><div class="prod-box-meta-line">${categoryName(p) ? `<span class="prod-box-cat">${esc(categoryName(p))}</span>` : ''}${size ? `<span class="prod-box-size-pill">${esc(size)}</span>` : ''}</div><h3 class="prod-box-title">${esc(p.name)}</h3>${offer ? `<div class="prod-box-offer-badge">🎁 ${esc(offer)}</div>` : ''}<div class="prod-box-subtitle">${esc((d.bullets.length ? d.bullets.join(' · ') : d.prose).slice(0, 120))}</div><div class="prod-box-stars"><span class="star-text">${stars}</span></div><div class="prod-box-footer"><div><div class="prod-box-price">${format(p.price)}</div>${p.compare_price && Number(p.compare_price) > Number(p.price) && showOffers(p) ? `<div class="prod-box-mrp">MRP ${format(p.compare_price)}</div>` : ''}<div class="prod-box-tax-ship">✓ Inclusive of GST · Free Shipping</div></div><div class="prod-box-actions"><a class="btn-view-details" href="${productPath(p)}" onclick="return zkQuickView(${Number(p.id)})">View Details</a>${p.in_stock === false ? '<span class="sold-out">Sold out</span>' : `<button class="btn-quick-cart" type="button" onclick="event.stopPropagation();zkAdd(${Number(p.id)},1)">🛒 Add</button>`}</div></div></div></article>`;
  };

  const categoryTabs = active => categories.length ? `<div class="category-tabs">${showAllProducts ? `<a class="cat-tab-btn ${!active ? 'active' : ''}" href="${template === 'home' ? '#products' : storeUrl('/#products')}">All Products <span class="badge">${allProducts.length}</span></a>` : ''}${categories.map(c => `<a class="cat-tab-btn ${active === c.slug ? 'active' : ''}" href="${storeUrl('/collections/' + encodeURIComponent(c.slug))}">${esc(c.name)} <span class="badge">${c.count}</span></a>`).join('')}</div>` : '';
  const sectionHead = (tag, heading, text) => `<div class="section-headline">${tag ? `<span class="section-eyebrow">${esc(tag)}</span>` : ''}<h2 class="section-title">${esc(heading)}</h2>${text ? `<p class="section-sub">${esc(text)}</p>` : ''}</div>`;

  // ── Shared header and footer ──
  const announcement = () => {
    if (!isVisible('announcement')) return '';
    const s = sec('announcement'), text = s.text || fields.ann_text || '', link = wa(`Hello ${storeName}, I have an enquiry`);
    const bg = s.background || fields.ann_bg, color = s.color || fields.ann_text_c;
    return `<div class="ann-bar" data-zkc-section="announcement" style="${bg ? `background:${safeColor(bg, skin.dark)};` : ''}${color ? `color:${safeColor(color, '#fff')};` : ''}"><span>${esc(text || storeName)}</span>${link ? `<a href="${link}" target="_blank" rel="noopener" class="contact-top-link">💬 WhatsApp${phone ? ': ' + esc(phone) : ''}</a>` : ''}</div>`;
  };
  const floralTop = () => {
    const img = safeImage(fields.floral_top_img) || skin.floralTop;
    return img && fields.floral_show !== false ? `<div class="header-top-floral-bar" style="background-image:url('${img}')" aria-hidden="true"></div>` : '';
  };
  const nav = () => {
    if (!isVisible('nav')) return '';
    const s = sec('nav'), bg = s.background || fields.nav_bg;
    const catLinks = categories.slice(0, 6).map(c => `<li><a href="${storeUrl('/collections/' + encodeURIComponent(c.slug))}">${esc(c.name)}</a></li>`);
    const navPageSlugs = ['about-us', 'contact-us', 'privacy-policy'];
    const topPages = publishedPages.filter(p => navPageSlugs.includes(p.slug));
    const otherPages = publishedPages.filter(p => !navPageSlugs.includes(p.slug));
    const pageLinks = [...topPages, ...otherPages].slice(0, 3).map(p => `<li><a href="${storeUrl('/page/' + encodeURIComponent(p.slug))}">${esc(p.title)}</a></li>`);
    const whyLabel = esc(sec('why').nav_label || fields.why_nav || ('Why ' + storeName.split(/\s+/)[0]));
    const whyLink = isVisible('why') ? `<li><a href="${template === 'home' ? '#why' : storeUrl('/#why')}">${whyLabel}</a></li>` : '';
    const allProductsLink = `<li><a href="${template === 'home' ? '#products' : storeUrl('/#products')}">All Products</a></li>`;
    const links = [...(showAllProducts ? [allProductsLink] : []), ...catLinks, ...pageLinks];
    if (whyLink) links.push(whyLink);
    const link = wa(`Hello ${storeName}, I have an enquiry about your products`);
    return `<nav data-zkc-section="navigation" style="${bg ? `background:${safeColor(bg, '#fff')};` : ''}"><div class="nav-inner"><a href="${storeUrl('/')}" class="brand-logo-wrap">${wordmark()}</a><ul class="nav-links">${links.join('')}</ul><div class="nav-right">${link ? `<a href="${link}" target="_blank" rel="noopener" class="whatsapp-btn-top">💬 <span>WhatsApp</span></a>` : ''}${fields.nav_cart_show === false ? '' : `<button class="cart-btn" type="button" onclick="openCheckout(event)">🛒 Cart <span class="cart-badge" id="cart">0</span></button>`}</div></div></nav>`;
  };
  const footerAbove = () => {
    if (!isVisible('footer_above')) return '';
    const s = sec('footer_above'), img = safeImage(s.image || fields.footer_above_img) || skin.floralBottom;
    const heading = s.heading || fields.footer_above_heading, text = s.text || fields.footer_above_text;
    return `${heading || text ? `<section class="footer-feature" data-zkc-section="footer_above" style="${s.background || fields.footer_above_bg ? `background:${safeColor(s.background || fields.footer_above_bg, '#fff')}` : ''}">${heading ? `<h2 class="section-title">${esc(heading)}</h2>` : ''}${text ? `<p class="section-sub">${esc(text)}</p>` : ''}</section>` : ''}${img ? `<div class="footer-above-floral-bar" data-zkc-section="footer_above" style="background-image:url('${img}')" aria-hidden="true"></div>` : '<div class="footer-spacer"></div>'}`;
  };
  const footer = () => {
    if (!isVisible('footer')) return '';
    const s = sec('footer'), bg = s.background || fields.footer_bg, img = safeImage(s.image || fields.footer_img);
    const tagline = fields.footer_text || store.tagline || '';
    const ig = store.instagram_handle ? `https://instagram.com/${encodeURIComponent(String(store.instagram_handle).replace(/^@/, ''))}` : '';
    const whyLabel = esc(sec('why').nav_label || fields.why_nav || ('Why ' + storeName.split(/\s+/)[0]));
    return `<footer data-zkc-section="footer" style="${bg ? `background-color:${safeColor(bg, skin.dark)};` : ''}${img ? `background-image:linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,.7)),url('${img}');background-size:cover;` : ''}${fields.footer_text_c ? `color:${safeColor(fields.footer_text_c, '#fff')}` : ''}"><div class="footer-inner"><div class="footer-top"><div><div class="footer-logo-badge">${wordmark('footer-logo')}</div>${tagline ? `<p class="footer-about">${esc(tagline)}</p>` : ''}${trustItems.length ? `<div class="footer-pillars">${trustItems.slice(0, 4).map(t => `<span>${esc(parseItem(t).title.toUpperCase())}</span>`).join(' · ')}</div>` : ''}</div><div class="footer-col"><h4>${categories.length ? 'Categories' : 'Shop'}</h4>${showAllProducts ? `<a href="${template === 'home' ? '#products' : storeUrl('/#products')}">All Products</a>` : ''}${categories.slice(0, 6).map(c => `<a href="${storeUrl('/collections/' + encodeURIComponent(c.slug))}">${esc(c.name)}</a>`).join('')}</div><div class="footer-col"><h4>About</h4>${isVisible('why') ? `<a href="${template === 'home' ? '#why' : storeUrl('/#why')}">${whyLabel}</a>` : ''}${publishedPages.map(p => `<a href="${storeUrl('/page/' + encodeURIComponent(p.slug))}">${esc(p.title)}</a>`).join('')}${isVisible('contact') ? `<a href="${template === 'home' ? '#contact' : storeUrl('/#contact')}">Contact</a>` : ''}</div><div class="footer-col footer-contact"><h4>Contact</h4><span class="fc-strong">${esc(storeName)}</span>${address ? `<span>📍 ${esc(address)}</span>` : ''}${phone ? `<span>📞 ${esc(phone)}</span>` : ''}${waNumber ? `<a href="${wa('Hello ' + storeName)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}${email ? `<a href="mailto:${esc(email)}">✉️ ${esc(email)}</a>` : ''}${ig && fields.footer_social !== false ? `<a href="${ig}" target="_blank" rel="noopener">📸 Instagram</a>` : ''}</div></div><div class="footer-bottom"><div>© ${new Date().getFullYear()} ${esc(storeName)}${address ? ' · ' + esc(address) : ''} · All rights reserved</div>${fields.footer_zk === false ? '' : '<div>Store powered by <b>ZKCommerce™</b></div>'}</div></div></footer>`;
  };

  // ── Home sections ──
  const sections = {
    trust() {
      if (!trustItems.length) return '';
      const s = sec('trust');
      return `<div class="pillars-band" data-zkc-section="trust" style="${s.background || fields.trust_bg ? `background:${safeColor(s.background || fields.trust_bg, '#fff')};` : ''}"><div class="pillars-inner">${trustItems.map(t => { const it = parseItem(t); return `<div class="pillar-item" style="${s.color || fields.trust_text_c ? `color:${safeColor(s.color || fields.trust_text_c, accentDark)}` : ''}"><span class="dot">${esc(it.icon || '✦')}</span> ${esc(it.title)}</div>`; }).join('')}</div></div>`;
    },
    hero() {
      const s = sec('hero'), img = safeImage(s.image || s.hero_bg_img || fields.hero_bg_img || store.hero_image_url);
      const heading = s.heading || fields.hero_h1 || store.hero_headline || storeName;
      const sub = s.description || fields.hero_desc || store.hero_subtext || '';
      const eyebrow = fields.hero_sub || store.tagline || '';
      const cta = s.button || fields.hero_cta || store.hero_cta_text || 'Shop now';
      const bg = s.background || fields.hero_bg;
      const boxes = categories.length ? `<div class="category-grid">${categories.map(c => `<a class="cat-box" href="${storeUrl('/collections/' + encodeURIComponent(c.slug))}"><div class="cat-box-top"><span class="cat-pill">${esc(c.name.split(/\s+/)[0])}</span><span class="cat-count">${c.count} Product${c.count === 1 ? '' : 's'}</span></div><div class="cat-img-wrap">${c.image ? `<img src="${c.image}" alt="${esc(c.name)}" loading="lazy">` : `<span class="no-img">${esc(c.name.slice(0, 1))}</span>`}</div><div class="cat-box-title"><span>${esc(c.name)}</span><span class="cat-star">★ 4.9</span></div><div class="cat-box-action"><span>Explore Products</span><span class="arrow">→</span></div></a>`).join('')}</div>` : `<div class="hero-cta-row"><a class="btn-primary" href="#products">${esc(cta)} →</a></div>`;
      return `<section class="category-hero-section${img ? ' has-image' : ''}" data-zkc-section="hero" style="${bg ? `background-color:${safeColor(bg, '#fff')};` : ''}${img ? `background-image:linear-gradient(${rgba(skin.heroDark ? '#000000' : '#FFFFFF', skin.heroDark ? .45 : .82)},${rgba(skin.heroDark ? '#000000' : '#FFFFFF', skin.heroDark ? .45 : .82)}),url('${img}');` : ''}text-align:${['left', 'right'].includes(s.align) ? s.align : 'center'}"><div class="category-hero-inner"><div class="cat-header">${eyebrow ? `<div class="cat-badge-top">${esc(eyebrow)}</div>` : ''}<h1 class="cat-main-title">${esc(heading)}</h1>${sub ? `<p class="cat-main-subtitle">${esc(sub)}</p>` : ''}</div>${boxes}</div></section>`;
    },
    products() {
      const s = sec('products');
      return `<main class="main-container" id="products" data-zkc-section="products"><div class="list-head"><h2 class="list-title">${esc(s.heading || fields.products_heading || 'All Products')}</h2>${s.text ? `<p class="list-sub">${esc(s.text)}</p>` : ''}</div>${categoryTabs('')}<div class="products-box-grid">${allProducts.map(productCard).join('') || '<p class="empty">No products are available yet.</p>'}</div></main>`;
    },
    why() {
      const s = sec('why'), items = list(s.items || fields.why_items);
      const heading = s.heading || fields.why_heading || `Why ${storeName}?`, text = s.text || fields.why_text;
      if (!items.length && !s.heading && !fields.why_heading) return '';
      const icons = ['🏺', '🔥', '🌿', '✨', '🚫', '🏭'];
      return `<section class="why-section" id="why" data-zkc-section="why" style="${s.background || fields.why_bg ? `background:${safeColor(s.background || fields.why_bg, '#fff')}` : ''}"><div class="inner">${sectionHead(s.tag || fields.why_tag || 'Why choose us', heading, text)}<div class="why-grid">${items.map((raw, i) => { const it = parseItem(raw); return `<div class="why-card"><span class="why-icon">${esc(it.icon || icons[i % icons.length])}</span><h3 class="why-card-title">${esc(it.title)}</h3>${it.desc ? `<p class="why-card-desc">${esc(it.desc)}</p>` : ''}${it.tag ? `<span class="why-tag-pill">${esc(it.tag)}</span>` : ''}</div>`; }).join('')}</div></div></section>`;
    },
    ingredients() {
      const s = sec('ingredients'), items = list(s.items || fields.ingredients_items);
      if (!items.length) return '';
      return `<section class="plain-section" id="ingredients" data-zkc-section="ingredients" style="${s.background || fields.ingredients_bg ? `background:${safeColor(s.background || fields.ingredients_bg, '#fff')}` : ''}"><div class="inner"><div class="ingredients-grid-section">${sectionHead(s.tag || 'Ingredients', s.heading || fields.ingredients_heading || 'What goes into our products', s.text || fields.ingredients_text)}<div class="herb-grid">${items.map((raw, i) => { const it = parseItem(raw); return `<div class="herb-card"><div class="herb-card-top"><span class="herb-card-num">${i + 1}</span><div class="herb-name">${esc(it.title)}</div></div>${it.desc ? `<div class="herb-benefit">${esc(it.desc)}</div>` : ''}</div>`; }).join('')}</div></div></div></section>`;
    },
    howtouse() {
      const s = sec('howtouse'), items = list(s.items || fields.howtouse_items || fields.how_items);
      if (!items.length) return '';
      return `<section class="plain-section" data-zkc-section="howtouse" style="${s.background || fields.how_bg ? `background:${safeColor(s.background || fields.how_bg, '#fff')}` : ''}"><div class="inner">${sectionHead('Simple ritual', s.heading || fields.how_heading || 'How to use', s.text || fields.how_text)}<div class="ritual-steps">${items.map((raw, i) => { const it = parseItem(raw); return `<div class="ritual-card"><div class="ritual-step-num">Step ${String(i + 1).padStart(2, '0')}</div><h4>${esc(it.title)}</h4>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}</div>`; }).join('')}</div></div></section>`;
    },
    gallery() {
      const s = sec('gallery');
      let urls = list(s.images || fields.gallery_images).map(safeImage).filter(Boolean);
      if (!urls.length) urls = [...new Set(allProducts.flatMap(imagesOf))].slice(0, 6);
      if (!urls.length) return '';
      return `<section class="plain-section soft" data-zkc-section="gallery"><div class="inner">${sectionHead('Gallery', s.heading || fields.gallery_heading || 'See every angle', '')}<div class="full-gallery">${urls.map(src => `<button type="button" class="fg-item" onclick="zkLightbox('${src}')"><img src="${src}" alt="${esc(storeName)}" loading="lazy"></button>`).join('')}</div></div></section>`;
    },
    slider() {
      const s = sec('slider'), urls = list(s.images || fields.slider_images || fields.slider_urls).map(safeImage).filter(Boolean);
      return urls.length ? `<section class="slider" data-zkc-section="slider">${urls.map(src => `<img src="${src}" alt="${esc(storeName)}">`).join('')}</section>` : '';
    },
    offers() {
      const s = sec('offers'), heading = s.heading || fields.offer_heading, text = s.text || fields.offer_text;
      return heading || text ? `<section class="offer-band" data-zkc-section="offers" style="${s.background || fields.offer_bg ? `background:${safeColor(s.background || fields.offer_bg, brand)}` : ''}"><h2>${esc(heading || 'Special offer')}</h2>${text ? `<p>${esc(text)}</p>` : ''}</section>` : '';
    },
    reviews() {
      const s = sec('reviews'), items = list(s.items || fields.review_items);
      if (!items.length) return '';
      return `<section class="plain-section soft" id="reviews" data-zkc-section="reviews"><div class="inner">${sectionHead('Customer reviews', s.heading || fields.review_heading || 'Real results. Real people.', s.text)}<div class="testi-grid">${items.map(raw => { const r = parseReview(raw); return `<div class="tc"><div class="tc-stars">${stars}</div><p class="tc-text">“${esc(r.quote)}”</p>${r.name ? `<div class="tc-author"><div class="tc-av">${esc(r.name.slice(0, 1).toUpperCase())}</div><div><div class="tc-name">${esc(r.name)}</div>${r.role ? `<div class="tc-role">${esc(r.role)}</div>` : ''}</div></div>` : ''}</div>`; }).join('')}</div></div></section>`;
    },
    contact() {
      if (ctx.showContact === false) return '';
      const s = sec('contact');
      return `<section class="plain-section contact-sec" id="contact" data-zkc-section="contact"><div class="inner">${sectionHead('Contact us', s.heading || fields.contact_heading || 'Get in touch.', s.text || 'Questions about a product, bulk orders or distribution — we are here.')}<div class="contact-grid"><div class="contact-info">${phone ? `<div class="ci"><div class="ci-icon">📞</div><div><div class="ci-label">Customer care</div><div class="ci-val">${esc(phone)}</div></div></div>` : ''}${waNumber ? `<div class="ci"><div class="ci-icon">💬</div><div><div class="ci-label">WhatsApp orders</div><div class="ci-val"><a href="${wa('Hello ' + storeName + ', I want to place an order')}" target="_blank" rel="noopener">Chat on WhatsApp</a></div></div></div>` : ''}${email ? `<div class="ci"><div class="ci-icon">✉️</div><div><div class="ci-label">Email</div><div class="ci-val"><a href="mailto:${esc(email)}">${esc(email)}</a></div></div></div>` : ''}${address ? `<div class="ci"><div class="ci-icon">📍</div><div><div class="ci-label">Address</div><div class="ci-val">${esc(address)}</div></div></div>` : ''}</div><form class="contact-form" onsubmit="return contactStore(event)"><div class="form-title">Send us a message</div><div class="form-row"><label class="form-field"><span>Your name</span><input name="name" required></label><label class="form-field"><span>Phone / WhatsApp</span><input name="phone"></label></div><label class="form-field"><span>Email</span><input name="email" type="email"></label><label class="form-field"><span>Message</span><textarea name="message" required></textarea></label><button class="btn-primary full">Send message →</button></form></div></div></section>`;
    }
  };

  // ── Templates ──
  let content = '';
  if (template === 'product' && product) {
    const imgs = imagesOf(product), d = splitDescription(product.description), off = discount(product);
    const ingredients = String(product.ingredients || '').split(/,|\n/).map(x => x.trim()).filter(Boolean);
    // Sizes with their own price/stock (v4.6). Older plain-string "variants" stay as decorative chips.
    const sized = (Array.isArray(product.variants) ? product.variants : []).filter(v => v && typeof v === 'object' && v.id && v.active !== false);
    const firstSize = sized.find(v => Number(v.quantity) > 0) || sized[0] || null;
    const variants = sized.length ? [] : (Array.isArray(product.variants) ? product.variants : []).map(v => typeof v === 'string' ? v : v && (v.name || v.size)).filter(Boolean);
    const netLabel = netQuantityLabel(product);
    const ds = sec('product'), cat = categoryName(product);
    const related = allProducts.filter(p => p.id !== product.id && (!cat || categoryName(p) === cat)).slice(0, 3);
    const waLink = wa(`Hello ${storeName}, I want to order ${product.name}`);
    content = `<div class="breadcrumb-bar"><div class="breadcrumb-inner"><div class="breadcrumb-links"><a href="${storeUrl('/')}">Home</a><span class="sep">/</span>${cat ? `<a href="${storeUrl('/collections/' + encodeURIComponent(slugify(cat)))}">${esc(cat)}</a><span class="sep">/</span>` : ''}<span class="current">${esc(product.name)}</span></div><a href="${storeUrl('/#products')}" class="btn-back-store">← Back to ${esc(storeName)}</a></div></div><main class="main-container"><section class="product-details-hero" data-zkc-section="product" style="${ds.background ? `background:${safeColor(ds.background, '#fff')}` : ''}"><div class="detail-grid"><div class="detail-gallery"><div class="detail-main-media">${imgs[0] ? `<img src="${imgs[0]}" alt="${esc(product.name)}" id="mainImage" onclick="zkLightbox(this.src)">` : `<span class="no-img big">${esc(product.name.slice(0, 1))}</span>`}</div>${imgs.length > 1 ? `<div class="detail-thumbs">${imgs.map((src, i) => `<button type="button" class="detail-thumb ${i ? '' : 'active'}" onclick="zkThumb(this,'${src}')"><img src="${src}" alt="Photo ${i + 1}"></button>`).join('')}</div>` : ''}</div><div class="detail-info">${cat ? `<div class="detail-cat-pill">${esc(cat)}</div>` : ''}<h1 class="detail-title">${esc(product.name)}</h1>${product.badge_text ? `<div class="detail-method-banner">${esc(product.badge_text)}</div>` : ''}${ds.show_stars !== false ? `<div class="detail-stars"><span class="stars">${stars}</span><span class="count">Loved by our customers</span></div>` : ''}<div class="detail-price-box"><div class="detail-price-row"><span class="detail-price-current" id="zkDetailPrice" style="${ds.price_color || fields.prod_price_c ? `color:${safeColor(ds.price_color || fields.prod_price_c, brand)}` : ''}">${format(firstSize ? firstSize.price : product.price)}</span>${product.compare_price && ds.compare_price !== false && Number(product.compare_price) > Number(product.price) && showOffers(product) ? `<span class="detail-price-mrp">MRP ${format(product.compare_price)}</span>` : ''}${off ? `<span class="detail-discount-tag">${off}% OFF</span>` : ''}</div><div class="price-note">Inclusive of all taxes</div></div>${d.bullets.length ? `<div class="label-bullet-grid">${d.bullets.map(b => `<div class="label-bullet-item"><span class="leaf-ico">${skin.leaf}</span><span>${esc(b)}</span></div>`).join('')}</div>` : ''}${d.prose ? `<p class="detail-desc">${esc(d.prose)}</p>` : ''}${sized.length ? `<div class="variant-section-title">Choose size</div><div class="detail-variants-grid">${sized.map(v => `<button type="button" class="variant-chip ${v === firstSize ? 'active' : ''}" data-variant="${esc(v.id)}" data-price="${Number(v.price)}"${Number(v.quantity) > 0 ? '' : ' disabled title="Out of stock"'} onclick="zkVariant(this)">${esc(v.label)} · ${format(v.price)}${Number(v.quantity) > 0 ? '' : ' (sold out)'}</button>`).join('')}</div><script>window.zkSelectedVariant=${JSON.stringify(firstSize ? String(firstSize.id) : null)}</script>` : ''}${netLabel && !sized.length ? `<div class="variant-section-title">Net quantity: ${esc(netLabel)}</div>` : ''}${variants.length ? `<div class="variant-section-title">Available options</div><div class="detail-variants-grid">${variants.map((v, i) => `<button type="button" class="variant-chip ${i ? '' : 'active'}" onclick="zkVariant(this)">${esc(v)}</button>`).join('')}</div>` : ''}${product.in_stock === false ? `<form class="notify-row" onsubmit="return notifyMe(event,${JSON.stringify(String(product.name)).replace(/</g, '\\u003c').replace(/"/g, '&quot;')})"><input type="email" required placeholder="Email me when it is back"><button class="btn-primary">Notify me</button></form>` : `<div class="purchase-action-row"><div class="qty-stepper"><button type="button" class="qty-btn" onclick="zkQty(-1)">−</button><span class="qty-display" id="qtyDisplay">1</span><button type="button" class="qty-btn" onclick="zkQty(1)">+</button></div><button type="button" class="btn-buy-now" style="${ds.button_color || fields.prod_cta_c ? `background:${safeColor(ds.button_color || fields.prod_cta_c, brand)}` : ''}" onclick="if(zkAdd(${Number(product.id)},zkQtyValue(),window.zkSelectedVariant))openCheckout()">⚡ Buy Now</button><button type="button" class="btn-add-cart" onclick="zkAdd(${Number(product.id)},zkQtyValue(),window.zkSelectedVariant)">🛒 Add to Cart</button></div>`}${ds.show_whatsapp !== false && waLink ? `<a href="${waLink}" target="_blank" rel="noopener" class="whatsapp-order-btn">💬 Quick order via WhatsApp</a>` : ''}${trustItems.length ? `<div class="trust-strip">${trustItems.slice(0, 4).map(t => { const it = parseItem(t); return `<div class="trust-item">${esc(it.icon || '✓')} ${esc(it.title)}</div>`; }).join('')}</div>` : ''}${ingredients.length ? `<div class="ingredients-block"><div class="ing-title">Ingredients:</div><div class="ingredients-pill-list">${ingredients.map(i => `<span class="ing-tag">${skin.leaf} ${esc(i)}</span>`).join('')}</div></div>` : ''}${ds.show_manufacturer !== false && (product.manufacturer || address) ? `<div class="mfg-info-card"><b>Manufactured &amp; Marketed by:</b><br><strong>${esc(product.manufacturer || storeName)}</strong>${address ? `<br>${esc(address)}` : ''}${phone ? `<br>Customer care: <b>${esc(phone)}</b>` : ''}${email ? `<br>Email: ${esc(email)}` : ''}</div>` : ''}</div></div></section>${ingredients.length && fields.label_show !== false ? `<section class="packaging-label-section">${sectionHead('Product label', 'What is inside', '')}<div class="label-card-replica">${skin.floralTop ? `<div class="label-floral-top" style="background-image:url('${safeImage(fields.floral_top_img) || skin.floralTop}')"></div>` : ''}<div class="label-body-content"><div class="label-left-col"><div class="label-heading-orange">Ingredients:</div><div class="label-ingredients-list">${esc(ingredients.join(', '))}.</div><div class="label-mfg-box"><b>Manufactured &amp; Marketed by</b><br><span class="label-mfg-name">${esc(product.manufacturer || storeName)}</span>${address ? `<br>${esc(address)}` : ''}${email ? `<br>Email: <b>${esc(email)}</b>` : ''}${phone ? `<br>Customer care: <b>${esc(phone)}</b>` : ''}<div class="label-mrp">MRP : ${format(product.compare_price || product.price)}</div><span class="price-note">Inclusive of GST</span></div></div><div class="label-right-col">${wordmark('label-logo')}<div class="label-product-title-bold"><span>❀</span> ${esc(product.name)} <span>❀</span></div>${product.badge_text ? `<div class="label-orange-bar">${esc(product.badge_text)}</div>` : ''}${d.bullets.length ? `<div class="label-bullet-vertical">${d.bullets.map(b => `<div class="label-bullet-row"><span class="leaf-glyph">${skin.leaf}</span><span>${esc(b)}</span></div>`).join('')}</div>` : ''}</div></div>${skin.floralBottom ? `<div class="label-floral-bottom" style="background-image:url('${safeImage(fields.footer_above_img) || skin.floralBottom}')"></div>` : ''}</div></section>` : ''}${related.length ? `<section class="related">${sectionHead('You may also like', cat ? 'More from ' + cat : 'More products', '')}<div class="products-box-grid">${related.map(productCard).join('')}</div></section>` : ''}</main>`;
  } else if (template === 'collection') {
    const s = sec('collection'), active = collection ? slugify(collection) : '';
    const products = active ? allProducts.filter(p => slugify(categoryName(p)) === active) : allProducts;
    const label = (categories.find(c => c.slug === active) || {}).name || collection || 'All Products';
    content = `<div class="breadcrumb-bar"><div class="breadcrumb-inner"><div class="breadcrumb-links"><a href="${storeUrl('/')}">Home</a><span class="sep">/</span><span class="current">${esc(label)}</span></div></div></div><main class="main-container" id="products" data-zkc-section="collection" style="${s.background ? `background:${safeColor(s.background, '#fff')}` : ''}"><div class="list-head"><h1 class="list-title">${esc(s.heading || fields.collection_heading || label)}</h1></div>${categoryTabs(active)}<div class="products-box-grid">${products.map(productCard).join('') || '<p class="empty">No products in this collection yet.</p>'}</div></main>`;
  } else if (page) {
    const body = String((page.content || {}).body || (page.content || {}).text || '');
    content = `<div class="breadcrumb-bar"><div class="breadcrumb-inner"><div class="breadcrumb-links"><a href="${storeUrl('/')}">Home</a><span class="sep">/</span><span class="current">${esc(page.title)}</span></div></div></div><main class="main-container"><section class="page-card" data-zkc-section="page_content"><h1 class="detail-title">${esc(page.title)}</h1>${body.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</section></main>`;
  } else {
    const keys = Object.keys(sections);
    const order = (Array.isArray(cfg.section_order) && cfg.section_order.length ? cfg.section_order : skin.defaultOrder)
      .filter(key => keys.includes(key) && !(cfg.removed_sections || []).includes(key));
    content = order.map(key => isVisible(key) ? sections[key]() + ctx.renderBlocks(key) : '').join('');
  }

  const font = (fields.body_font && ['Inter', 'Poppins', 'Roboto', 'Georgia', 'Arial'].includes(fields.body_font)) ? `'${fields.body_font}',sans-serif` : skin.bodyFont;
  const headingFont = fields.hero_font && fields.hero_font !== 'Inter' && ['Poppins', 'Playfair Display', 'Georgia', 'Dancing Script'].includes(fields.hero_font) ? `'${fields.hero_font}',Georgia,serif` : skin.headingFont;
  const radius = Number.isFinite(Number(fields.button_radius)) && fields.button_radius !== '' ? Math.max(0, Math.min(40, Number(fields.button_radius))) : 10;
  const heroText = skin.heroDark ? '#FFFFFF' : skin.dark;

  const css = `*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
:root{--brand:${brand};--brand-dark:${brandDark};--brand-light:${brandLight};--brand-border:${brandBorder};--accent:${accent};--accent-dark:${accentDark};--accent-light:${accentLight};--method:${skin.method};--gold:${skin.gold};--star:${skin.star};--page:${page_bg};--dark:${skin.dark};--text:${skin.text};--muted:${skin.muted};--border:${skin.border};--border-light:${skin.borderLight};--soft:${skin.soft};--hf:${headingFont};--radius:${radius}px;--shadow-sm:0 4px 14px ${rgba(skin.dark, .06)};--shadow-md:0 8px 24px ${rgba(skin.dark, .09)}}
body{font-family:${font};color:var(--text);background:var(--page);overflow-x:hidden;line-height:1.5}a{color:inherit}img{max-width:100%}
.no-img{display:grid;place-items:center;width:100%;height:100%;font:700 48px var(--hf);color:var(--brand);background:var(--brand-light);border-radius:12px}.no-img.big{font-size:96px}
.ann-bar{background:var(--dark);color:rgba(255,255,255,.95);text-align:center;padding:9px 20px;font-size:12px;font-weight:600;letter-spacing:.03em;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
.contact-top-link{color:#fff;text-decoration:none;background:rgba(255,255,255,.15);padding:2px 10px;border-radius:99px;font-size:11px}.contact-top-link:hover{background:var(--brand)}
.header-top-floral-bar{width:100%;height:115px;background-color:#fff;background-repeat:repeat-x;background-size:auto 115px;background-position:top center;border-bottom:1.5px solid var(--border-light)}
nav{background:rgba(255,255,255,.98);backdrop-filter:blur(12px);border-bottom:1.5px solid var(--border);position:sticky;top:0;z-index:300;box-shadow:0 2px 16px ${rgba(skin.dark, .05)}}
.nav-inner{max-width:1440px;margin:0 auto;padding:0 20px;height:86px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.brand-logo-wrap{display:flex;align-items:center;text-decoration:none;flex-shrink:0}.brand-logo-img{height:58px;width:auto;max-width:220px;object-fit:contain;display:block}
.wordmark{display:flex;flex-direction:column;line-height:1}.wm-1{font:700 42px var(--hf);color:var(--brand);letter-spacing:-.01em;line-height:0.95}.wm-2{font:700 22px var(--hf);color:var(--accent-dark);margin-top:2px;padding-left:26px;position:relative}.wm-2::before{content:'';position:absolute;left:0;top:50%;width:20px;height:10px;border-bottom:2.5px solid var(--accent);border-radius:0 0 50% 50%;transform:translateY(-70%)}
.nav-links{display:flex;gap:12px;list-style:none;flex-wrap:nowrap;white-space:nowrap;overflow-x:auto;scrollbar-width:none}.nav-links::-webkit-scrollbar{display:none}.nav-links a{font-size:12px;font-weight:600;color:var(--muted);text-decoration:none;transition:color .2s;white-space:nowrap}.nav-links a:hover{color:var(--brand)}
.nav-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.whatsapp-btn-top{background:#E8F8EE;color:#1E8E3E;border:1.5px solid #25D366;padding:7px 12px;border-radius:99px;font-size:11.5px;font-weight:800;text-decoration:none;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(37,211,102,.15);white-space:nowrap}.whatsapp-btn-top:hover{background:#25D366;color:#fff}
.cart-btn{background:var(--brand);color:#fff;padding:8px 16px;border-radius:99px;font-size:12.5px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;box-shadow:0 4px 14px ${rgba(brand, .3)};white-space:nowrap}.cart-btn:hover{background:var(--brand-dark)}
.cart-badge{background:var(--gold);color:var(--dark);padding:2px 7px;border-radius:99px;font-size:11px;font-weight:800}
.prod-box-meta-line{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.prod-box-size-pill{font-size:10.5px;font-weight:800;color:var(--muted);background:var(--soft);border:1px solid var(--border);padding:2px 8px;border-radius:99px}
.prod-box-offer-badge{font-size:11px;font-weight:800;color:var(--method);background:rgba(232,93,4,0.08);border:1px solid rgba(232,93,4,0.2);padding:3px 8px;border-radius:6px;margin:3px 0 6px;display:inline-block}
.prod-box-tax-ship{font-size:11px;color:var(--accent-dark);font-weight:700;margin-top:4px}
.pillars-band{background:#FDFCF8;border-bottom:1.5px solid var(--border-light);padding:10px 24px}.pillars-inner{max-width:1260px;margin:0 auto;display:flex;justify-content:center;gap:36px;flex-wrap:wrap}
.pillar-item{font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-dark);display:flex;align-items:center;gap:8px}.pillar-item .dot{color:var(--brand);font-size:13px}
.category-hero-section{background:${skin.heroDark ? `linear-gradient(160deg,${mix(brand, '#000000', .45)} 0%,${brand} 50%,${mix(brand, '#FFFFFF', .2)} 100%)` : '#fff'};background-size:cover;background-position:center;padding:40px 24px 48px;border-bottom:1.5px solid var(--border-light);color:${heroText}}
.category-hero-inner{max-width:1260px;margin:0 auto}.cat-header{max-width:780px;margin:0 auto 30px}
.cat-badge-top{display:inline-flex;align-items:center;gap:8px;background:${skin.heroDark ? rgba(accent, .15) : 'var(--brand-light)'};border:1px solid ${skin.heroDark ? rgba(accent, .35) : 'var(--brand-border)'};border-radius:99px;padding:5px 16px;font-size:11px;font-weight:800;color:${skin.heroDark ? 'var(--accent)' : 'var(--brand)'};text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
.cat-main-title{font-family:var(--hf);font-size:clamp(30px,4.4vw,52px);font-weight:700;color:${heroText};line-height:1.12;margin-bottom:10px}
.cat-main-subtitle{font-size:15px;color:${skin.heroDark ? 'rgba(255,255,255,.72)' : 'var(--muted)'};line-height:1.65}
.hero-cta-row{margin-top:8px}
.category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px;text-align:left}
.cat-box{background:#fff;border:1.5px solid var(--border);border-radius:20px;padding:20px;text-decoration:none;color:var(--text);display:flex;flex-direction:column;transition:all .28s cubic-bezier(.16,1,.3,1);box-shadow:var(--shadow-sm);overflow:hidden}
.cat-box:hover{transform:translateY(-6px);border-color:var(--brand);box-shadow:0 16px 36px ${rgba(brand, .18)}}
.cat-box-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.cat-pill{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:4px 10px;border-radius:99px;background:var(--brand-light);color:var(--brand);border:1px solid var(--brand-border)}.cat-count{font-size:11px;color:var(--muted);font-weight:600}
.cat-img-wrap{width:100%;height:165px;border-radius:14px;overflow:hidden;margin-bottom:14px;background:var(--soft);border:1px solid var(--border-light)}.cat-img-wrap img{width:100%;height:100%;object-fit:cover;transition:transform .45s}.cat-box:hover .cat-img-wrap img{transform:scale(1.06)}
.cat-box-title{font:700 22px var(--hf);color:var(--dark);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;line-height:1.2}.cat-star{font:600 12px Inter,sans-serif;color:var(--star);white-space:nowrap}
.cat-box-action{display:flex;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:12px;margin-top:auto;font-size:12.5px;font-weight:700;color:var(--brand)}.cat-box .arrow{transition:transform .2s}.cat-box:hover .arrow{transform:translateX(4px)}
.main-container{max-width:1260px;margin:0 auto;padding:36px 24px 60px}
.list-head{margin-bottom:18px}.list-title{font:700 34px var(--hf);color:var(--dark)}.list-sub{font-size:14px;color:var(--muted)}
.category-tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px;border-bottom:1.5px solid var(--border-light);padding-bottom:16px}
.cat-tab-btn{background:#fff;border:1.5px solid var(--border);color:var(--text);padding:8px 18px;border-radius:99px;font-size:13px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s}.cat-tab-btn:hover{border-color:var(--brand);color:var(--brand)}
.cat-tab-btn.active{background:var(--brand);color:#fff;border-color:var(--brand);box-shadow:0 4px 14px ${rgba(brand, .25)}}.cat-tab-btn .badge{font-size:10px;background:rgba(0,0,0,.08);padding:2px 7px;border-radius:99px}.cat-tab-btn.active .badge{background:#fff;color:var(--brand);font-weight:800}
.products-box-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:26px}
.prod-box-card{background:#fff;border:1.5px solid var(--border);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;transition:all .28s;position:relative;box-shadow:var(--shadow-sm)}
.prod-box-card:hover{transform:translateY(-5px);border-color:var(--brand);box-shadow:0 16px 32px ${rgba(brand, .16)}}
.prod-box-link{position:absolute;inset:0;z-index:1}
.prod-box-badge{position:absolute;top:14px;left:14px;z-index:2;background:var(--brand);color:#fff;font-size:10.5px;font-weight:800;padding:4px 12px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em}
.prod-box-discount{position:absolute;top:14px;right:14px;z-index:2;background:var(--accent);color:${skin.heroDark ? 'var(--dark)' : '#fff'};font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:99px}
.prod-box-media{background:#FFFDF9;height:240px;overflow:hidden;padding:12px}.prod-box-media img{width:100%;height:100%;object-fit:cover;border-radius:14px;transition:transform .4s}.prod-box-card:hover .prod-box-media img{transform:scale(1.05)}
.prod-box-body{padding:20px;display:flex;flex-direction:column;flex-grow:1}
.prod-box-cat{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent-dark);margin-bottom:4px}
.prod-box-title{font:700 22px var(--hf);color:var(--dark);margin-bottom:6px;line-height:1.25}
.prod-box-subtitle{font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.45}
.prod-box-stars{margin-bottom:14px}.star-text{color:var(--star);font-size:14px;letter-spacing:1px}
.prod-box-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;border-top:1px solid var(--border-light);padding-top:16px}
.prod-box-price{font:700 24px var(--hf);color:var(--brand);line-height:1}.prod-box-mrp{font-size:12px;color:#9C7D6A;text-decoration:line-through;margin-top:2px}
.prod-box-actions{display:flex;gap:6px;position:relative;z-index:2}
.btn-view-details{background:var(--brand-light);color:var(--brand);border:1px solid var(--brand-border);padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap}.btn-view-details:hover{background:var(--brand);color:#fff}
.btn-quick-cart{background:var(--brand);color:#fff;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}.btn-quick-cart:hover{background:var(--brand-dark)}
.sold-out{font-size:12px;font-weight:700;color:var(--muted);padding:8px 4px}
.btn-primary{background:linear-gradient(135deg,var(--brand),var(--brand-dark));color:#fff;border:none;border-radius:var(--radius);padding:13px 26px;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;box-shadow:0 6px 20px ${rgba(brand, .3)}}.btn-primary.full{width:100%}
.section-headline{text-align:center;max-width:760px;margin:0 auto 32px}.section-eyebrow{font-size:11.5px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;display:inline-block}
.section-title{font:700 clamp(28px,3.6vw,40px) var(--hf);color:var(--dark);line-height:1.2}.section-sub{font-size:14.5px;color:var(--muted);margin-top:8px;line-height:1.65}
.inner{max-width:1260px;margin:0 auto}
.why-section{background:${skin.whyDark ? `var(--brand)` : 'linear-gradient(180deg,#fff 0%,#FDFBF8 100%)'};border-top:1.5px solid var(--border-light);border-bottom:1.5px solid var(--border-light);padding:64px 24px}
${skin.whyDark ? `.why-section .section-title{color:#fff}.why-section .section-eyebrow{color:var(--accent)}.why-section .section-sub{color:rgba(255,255,255,.65)}.why-card{background:rgba(255,255,255,.06)!important;border-color:rgba(255,255,255,.12)!important}.why-card-title{color:#fff!important}.why-card-desc{color:rgba(255,255,255,.6)!important}.why-tag-pill{color:var(--accent)!important;background:${rgba(accent, .1)}!important;border-color:${rgba(accent, .3)}!important}` : ''}
.why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.why-card{background:#fff;border:1.5px solid var(--border);border-radius:20px;padding:26px;box-shadow:var(--shadow-sm);transition:all .25s}.why-card:hover{transform:translateY(-4px);border-color:var(--brand);box-shadow:var(--shadow-md)}
.why-icon{font-size:32px;margin-bottom:14px;display:block}.why-card-title{font:700 20px var(--hf);color:var(--dark);margin-bottom:8px}.why-card-desc{font-size:13px;color:var(--muted);line-height:1.6}
.why-tag-pill{display:inline-block;margin-top:10px;font-size:11px;font-weight:700;color:var(--method);background:${rgba(skin.method, .08)};border:1px solid ${rgba(skin.method, .2)};border-radius:99px;padding:3px 10px}
.plain-section{padding:64px 24px}.plain-section.soft{background:#FDFBF8}
.ingredients-grid-section{background:#FDFBF8;border:1.5px solid var(--border-light);border-radius:28px;padding:44px 36px}
.herb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.herb-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:20px;transition:all .25s}.herb-card:hover{transform:translateY(-4px);border-color:var(--accent);box-shadow:0 8px 20px ${rgba(accent, .15)}}
.herb-card-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}.herb-card-num{width:28px;height:28px;border-radius:50%;background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.herb-name{font:700 19px var(--hf);color:var(--dark)}.herb-benefit{font-size:13px;color:var(--muted);line-height:1.55}
.ritual-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}.ritual-card{background:var(--soft);border:1px solid var(--border);border-radius:12px;padding:20px}
.ritual-step-num{font-size:12px;font-weight:800;color:var(--brand);text-transform:uppercase;margin-bottom:6px}.ritual-card h4{font-size:16px;color:var(--dark);margin-bottom:8px}.ritual-card p{font-size:13px;color:var(--muted);line-height:1.6}
.full-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.fg-item{border:1px solid var(--border);border-radius:14px;overflow:hidden;aspect-ratio:3/4;cursor:zoom-in;background:var(--soft);padding:0}.fg-item img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.fg-item:hover img{transform:scale(1.04)}
.slider{display:flex;overflow:auto;gap:12px;padding:18px 24px}.slider img{height:300px;min-width:min(80vw,650px);object-fit:cover;border-radius:16px}
.offer-band{background:var(--brand);color:#fff;text-align:center;padding:40px 24px}.offer-band h2{font:700 clamp(24px,3vw,34px) var(--hf);margin-bottom:6px}
.testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.tc{background:#fff;border:1px solid var(--border);border-radius:16px;padding:24px}
.tc-stars{color:var(--star);margin-bottom:10px;letter-spacing:2px}.tc-text{font-size:14px;line-height:1.75;margin-bottom:16px;font-style:italic}.tc-author{display:flex;align-items:center;gap:10px}
.tc-av{width:40px;height:40px;border-radius:50%;background:var(--brand);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff}.tc-name{font-size:14px;font-weight:700;color:var(--dark)}.tc-role{font-size:12px;color:var(--muted)}
.contact-sec{background:linear-gradient(145deg,#FFFDF9,var(--brand-light))}.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}.contact-info{display:flex;flex-direction:column;gap:14px}
.ci{display:flex;gap:14px;background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px}.ci-icon{width:42px;height:42px;border-radius:12px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0}
.ci-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}.ci-val{font-size:14px;font-weight:600;color:var(--dark)}.ci-val a{color:var(--brand);text-decoration:none}
.contact-form{background:#fff;border-radius:20px;padding:30px;border:1px solid var(--border);box-shadow:var(--shadow-sm)}.form-title{font:700 22px var(--hf);color:var(--dark);margin-bottom:18px}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.form-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}.form-field span{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.form-field input,.form-field textarea,.notify-row input{padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font:14px inherit;color:var(--dark);background:#FFFDF9;outline:none}.form-field input:focus,.form-field textarea:focus{border-color:var(--brand);background:#fff}.form-field textarea{height:100px;resize:vertical}
.footer-feature{text-align:center;padding:44px 24px 8px}
.footer-above-floral-bar{width:100%;height:72px;background-color:#fff;background-repeat:repeat-x;background-size:auto 72px;background-position:bottom center;border-top:1.5px solid var(--border-light);margin-top:40px}.footer-spacer{height:40px}
footer{background:var(--dark);color:#fff;padding:50px 24px 30px}.footer-inner{max-width:1260px;margin:0 auto}.footer-top{display:grid;grid-template-columns:2fr 1fr 1fr 1.2fr;gap:40px;margin-bottom:40px}
.footer-logo-badge{background:#fff;border-radius:12px;padding:8px 16px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,.25);margin-bottom:16px}.footer-logo-badge .brand-logo-img{height:48px}
.footer-about{font-size:13px;color:rgba(255,255,255,.75);line-height:1.7;max-width:320px}.footer-pillars{margin-top:12px;font-size:10.5px;color:var(--gold);font-weight:800}
.footer-col h4{font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:16px}.footer-col a,.footer-col span{display:block;font-size:13px;color:rgba(255,255,255,.7);text-decoration:none;margin-bottom:8px}.footer-col a:hover{color:var(--gold)}.footer-col .fc-strong{color:#fff;font-weight:700}
.footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding-top:20px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:12px;color:rgba(255,255,255,.45)}
.breadcrumb-bar{background:var(--soft);border-bottom:1px solid var(--border-light);padding:12px 24px}.breadcrumb-inner{max-width:1260px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.breadcrumb-links{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}.breadcrumb-links a{color:var(--muted);text-decoration:none}.breadcrumb-links a:hover{color:var(--brand)}.breadcrumb-links .sep{color:#C0B0A4}.breadcrumb-links .current{color:var(--brand);font-weight:700}
.btn-back-store{font-size:12.5px;font-weight:700;color:var(--dark);text-decoration:none;background:#fff;border:1px solid var(--border);padding:6px 14px;border-radius:99px}.btn-back-store:hover{border-color:var(--brand);color:var(--brand)}
.product-details-hero{background:#fff;border:1.5px solid var(--border);border-radius:28px;padding:36px;box-shadow:var(--shadow-sm);margin-bottom:44px}
.detail-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:48px;align-items:start}.detail-gallery{display:flex;flex-direction:column;gap:16px;position:sticky;top:96px}
.detail-main-media{height:480px;border-radius:20px;border:1.5px solid var(--border);background:var(--soft);overflow:hidden;display:flex;align-items:center;justify-content:center}.detail-main-media img{width:100%;height:100%;object-fit:contain;cursor:zoom-in}
.detail-thumbs{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px}.detail-thumb{width:82px;height:82px;border-radius:10px;border:2px solid var(--border);background:var(--soft);overflow:hidden;cursor:pointer;flex-shrink:0;padding:0}.detail-thumb.active{border-color:var(--brand);box-shadow:0 0 0 3px ${rgba(brand, .2)}}.detail-thumb img{width:100%;height:100%;object-fit:cover}
.detail-info{display:flex;flex-direction:column}.detail-cat-pill{font-size:12px;font-weight:800;color:var(--accent-dark);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.detail-title{font:700 clamp(30px,4vw,42px) var(--hf);color:var(--dark);line-height:1.15;margin-bottom:12px}
.detail-method-banner{background:linear-gradient(90deg,var(--method),${mix(skin.method, '#FFFFFF', .25)});color:#fff;padding:9px 18px;border-radius:8px;font-size:14px;font-weight:800;letter-spacing:.03em;align-self:flex-start;margin-bottom:14px;box-shadow:0 4px 12px ${rgba(skin.method, .25)}}
.detail-stars{display:flex;align-items:center;gap:8px;margin-bottom:16px}.detail-stars .stars{color:var(--star);letter-spacing:2px}.detail-stars .count{font-size:13px;color:var(--muted);font-weight:600}
.detail-price-box{background:var(--soft);border:1.5px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:22px}.detail-price-row{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:4px}
.detail-price-current{font-size:34px;font-weight:800;color:var(--brand)}.detail-price-mrp{font-size:18px;color:var(--muted);text-decoration:line-through}.detail-discount-tag{background:var(--brand-dark);color:#fff;font-size:11.5px;font-weight:800;padding:3px 8px;border-radius:4px}.price-note{font-size:12px;color:var(--muted)}
.label-bullet-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}.label-bullet-item{display:flex;align-items:center;gap:10px;border:1.5px solid var(--border-light);padding:10px 14px;border-radius:10px;font-size:13px;font-weight:700;color:var(--dark)}
.detail-desc{font-size:14.5px;line-height:1.75;color:var(--text);margin-bottom:20px}
.variant-section-title{font-size:12.5px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}.detail-variants-grid{display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap}
.variant-chip{background:#fff;border:2px solid var(--border);border-radius:10px;padding:9px 18px;cursor:pointer;font:700 13.5px inherit;color:var(--dark)}.variant-chip.active{border-color:var(--brand);background:var(--brand-light);color:var(--brand)}
.purchase-action-row{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}.qty-stepper{display:inline-flex;align-items:center;border:2px solid var(--border);border-radius:10px;background:#fff;height:52px}
.qty-btn{background:none;border:none;font-size:20px;font-weight:700;color:var(--dark);width:42px;height:100%;cursor:pointer}.qty-btn:hover{color:var(--brand)}.qty-display{width:36px;text-align:center;font-weight:800}
.btn-buy-now{flex:1;min-width:180px;background:linear-gradient(135deg,var(--brand),var(--brand-dark));color:#fff;border:none;border-radius:var(--radius);font-size:15px;font-weight:800;height:52px;cursor:pointer;box-shadow:0 6px 20px ${rgba(brand, .35)}}
.btn-add-cart{background:#fff;border:2px solid var(--dark);color:var(--dark);border-radius:var(--radius);font-size:14px;font-weight:800;padding:0 22px;height:52px;cursor:pointer}.btn-add-cart:hover{background:var(--dark);color:#fff}
.whatsapp-order-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:#fff;padding:12px 18px;border-radius:10px;font-size:13.5px;font-weight:700;text-decoration:none;margin-bottom:20px}
.notify-row{display:flex;gap:8px;margin-bottom:18px}.notify-row input{flex:1;min-width:0}
.trust-strip{display:flex;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:16px;gap:12px;flex-wrap:wrap;margin-bottom:8px}.trust-item{font-size:12px;font-weight:700;color:var(--muted)}
.ingredients-block{margin-top:14px;border-top:1px solid var(--border-light);padding-top:16px}.ing-title{font-size:14px;font-weight:800;color:var(--method);margin-bottom:8px}
.ingredients-pill-list{display:flex;flex-wrap:wrap;gap:8px}.ing-tag{background:var(--accent-light);border:1px solid ${mix(accent, '#FFFFFF', .6)};color:var(--accent-dark);font-size:12px;font-weight:700;padding:6px 12px;border-radius:99px}
.mfg-info-card{background:#FCFBF9;border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:20px;font-size:12.5px;color:var(--muted);line-height:1.6}.mfg-info-card b,.mfg-info-card strong{color:var(--dark)}
.packaging-label-section{margin-bottom:48px}.label-card-replica{background:#fff;border:2px solid ${mix(skin.border, '#000000', .06)};border-radius:20px;max-width:900px;margin:0 auto;box-shadow:0 16px 40px ${rgba(skin.dark, .09)};overflow:hidden}
.label-floral-top,.label-floral-bottom{height:60px;background-repeat:repeat-x;background-size:auto 60px;background-color:#FFFDF9}.label-floral-top{background-position:top center;border-bottom:1.5px solid var(--border-light)}.label-floral-bottom{background-position:bottom center;border-top:1.5px solid var(--border-light)}
.label-body-content{padding:36px 40px;display:grid;grid-template-columns:1.15fr 1fr;gap:36px}.label-left-col{border-right:1.5px solid var(--border-light);padding-right:32px}
.label-heading-orange{font-size:22px;font-weight:800;color:var(--method);margin-bottom:14px}.label-ingredients-list{font-size:13.5px;color:${skin.heroDark ? 'var(--brand)' : '#2D5A27'};font-weight:600;line-height:1.75;margin-bottom:24px}
.label-mfg-box{font-size:12.5px;line-height:1.6;color:#3B2E26;border-top:1.5px dashed var(--border);padding-top:16px}.label-mfg-name{font-size:15px;font-weight:800;color:var(--dark)}.label-mrp{font-size:16px;font-weight:800;color:var(--dark);margin-top:12px}
.label-right-col{display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:14px}.label-logo.brand-logo-img{height:62px}
.label-product-title-bold{font:700 28px var(--hf);color:var(--dark)}.label-product-title-bold span{color:var(--method);font-size:18px}
.label-orange-bar{background:var(--method);color:#fff;font-size:14px;font-weight:800;padding:9px 20px;border-radius:6px;width:100%;max-width:320px}
.label-bullet-vertical{display:flex;flex-direction:column;gap:10px;align-items:flex-start}.label-bullet-row{display:flex;gap:10px;font-size:14px;font-weight:700;color:var(--dark)}
.related{margin-top:20px}.page-card{background:#fff;border:1.5px solid var(--border);border-radius:28px;padding:44px;max-width:900px;margin:0 auto;line-height:1.8;min-height:40vh}.page-card p{margin-bottom:14px}
.empty{grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)}
.zk-toast{position:fixed;bottom:28px;right:28px;background:var(--dark);color:#fff;padding:14px 22px;border-radius:14px;font-size:13.5px;font-weight:600;box-shadow:0 10px 32px ${rgba(skin.dark, .35)};transform:translateY(120px);opacity:0;transition:all .35s;z-index:2000}.zk-toast.show{transform:none;opacity:1}
.zk-lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:2000;align-items:center;justify-content:center;cursor:zoom-out}.zk-lightbox.open{display:flex}.zk-lightbox img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:12px}
.cart-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);z-index:1000;justify-content:flex-end}.cart-backdrop.open{display:flex}
.cart-panel{position:relative;background:#fff;color:var(--text);width:min(440px,100%);height:100%;overflow:auto;padding:28px;box-shadow:-8px 0 36px rgba(0,0,0,.2)}.cart-panel h2{font:700 26px var(--hf);color:var(--brand);margin-bottom:12px}
.cart-close{float:right;border:0;background:none;font-size:28px;cursor:pointer;color:var(--muted)}.cart-item{display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--border-light)}.cart-total{display:flex;justify-content:space-between;font-size:17px;font-weight:700;color:var(--dark);margin:16px 0}
.coupon-row{display:flex;gap:8px}.coupon-row input,#checkoutForm input,#checkoutForm select{min-width:0;width:100%;padding:11px;border:1.5px solid var(--border);border-radius:8px;margin:4px 0;font:14px inherit}
.coupon-row button,#checkoutForm button[type=button]{border:1.5px solid var(--brand-border);background:var(--brand-light);color:var(--brand);border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}
.cart-panel form{display:grid;gap:4px;margin-top:14px}.cart-panel .buy{background:linear-gradient(135deg,var(--brand),var(--brand-dark));color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;margin-top:6px}.cart-panel #checkoutMessage,.cart-panel #couponMessage{color:var(--method);min-height:22px;font-size:13px}
[data-zkc-section]{transition:outline .15s}.zkc-editor-selected{outline:3px solid #5b8cff!important;outline-offset:-3px}
.zk-qv{display:none;position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:1500;align-items:center;justify-content:center;padding:16px}.zk-qv.open{display:flex}body.qv-open{overflow:hidden}
.zk-qv-box{position:relative;background:#fff;border-radius:20px;width:min(1140px,100%);max-height:92vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.3);padding:30px}
.zk-qv-close{position:sticky;top:0;float:right;margin:-14px -14px 0 0;width:40px;height:40px;border-radius:50%;border:1px solid var(--border);background:#fff;font-size:24px;line-height:1;cursor:pointer;z-index:2;color:var(--dark)}
.qv-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:34px;align-items:start}.qv-media{position:sticky;top:0}
.qv-main{background:var(--soft);border:1.5px solid var(--border-light);border-radius:16px;height:min(520px,62vh);display:flex;align-items:center;justify-content:center;overflow:hidden}.qv-main img{width:100%;height:100%;object-fit:contain;cursor:zoom-in}
.qv-thumbs{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.qv-thumbs button{width:66px;height:66px;border:1.5px solid var(--border-light);border-radius:10px;padding:2px;background:#fff;cursor:pointer}.qv-thumbs button.active{border-color:var(--brand)}.qv-thumbs img{width:100%;height:100%;object-fit:cover;border-radius:8px}
.qv-cat{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent-dark);background:var(--accent-light);padding:3px 10px;border-radius:99px}.qv-badge{display:inline-block;margin-left:6px;font-size:11px;font-weight:800;background:var(--method);color:#fff;padding:3px 10px;border-radius:6px}
.qv-title{font-family:var(--hf);font-size:clamp(24px,3vw,32px);color:var(--dark);line-height:1.2;margin:10px 0 6px}.qv-stars{color:var(--star);font-size:13px;margin-bottom:10px}.qv-stars span{color:var(--muted)}
.qv-price-box{background:var(--soft);border:1.5px solid var(--border-light);border-radius:14px;padding:14px 16px;margin:12px 0}.qv-price{font-family:var(--hf);font-size:30px;font-weight:700;color:var(--brand)}.qv-mrp{color:var(--muted);text-decoration:line-through;margin-left:10px}.qv-off{background:var(--accent);color:#fff;font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:99px;margin-left:10px;vertical-align:middle}.qv-note{font-size:12px;color:var(--accent-dark);font-weight:700;margin-top:6px}
.qv-pill{display:inline-block;font-size:12px;font-weight:700;border:1.5px solid var(--brand-border);background:var(--brand-light);color:var(--brand);padding:5px 12px;border-radius:8px;margin:0 6px 6px 0}.qv-offer{background:linear-gradient(90deg,#FFF3E0,#FFE0B2);border:1px solid #FFCC80;color:#E65100;padding:8px 12px;border-radius:8px;font-size:12.5px;font-weight:800;margin-top:8px}
.qv-cta{display:flex;gap:10px;align-items:center;margin:16px 0;flex-wrap:wrap}.qv-qty{display:flex;align-items:center;border:1.5px solid var(--border);border-radius:10px;overflow:hidden;background:#fff}.qv-qty button{width:38px;height:44px;border:none;background:#fff;font-size:18px;cursor:pointer}.qv-qty span{min-width:34px;text-align:center;font-weight:800}
.qv-add,.qv-buy{flex:1;min-width:140px;height:46px;border-radius:var(--radius);font-weight:800;font-size:14px;cursor:pointer}.qv-add{background:var(--brand-light);color:var(--brand);border:1.5px solid var(--brand-border)}.qv-buy{background:linear-gradient(135deg,var(--brand),var(--brand-dark));color:#fff;border:none}
.qv-sec{margin-top:18px;border-top:1.5px solid var(--border-light);padding-top:14px}.qv-sec h4{font-family:var(--hf);font-size:17px;color:var(--dark);margin-bottom:8px}.qv-sec p,.qv-sec li{font-size:14px;line-height:1.7;color:var(--text)}.qv-sec ul{padding-left:18px}.qv-chips{display:flex;flex-wrap:wrap;gap:6px}.qv-chips span{font-size:12px;background:var(--soft);border:1px solid var(--border-light);padding:4px 10px;border-radius:99px}.qv-sizes{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.qv-size{border:1.5px solid var(--brand-border);background:#fff;color:var(--dark);padding:8px 14px;border-radius:10px;font-weight:700;cursor:pointer}.qv-size.active{background:var(--brand-light);color:var(--brand);border-color:var(--brand)}.qv-size[disabled],.variant-chip[disabled]{opacity:.45;cursor:not-allowed}.qv-full{display:inline-block;margin-top:16px;color:var(--brand);font-weight:700;font-size:13px}
@media(max-width:820px){.qv-grid{grid-template-columns:1fr;gap:18px}.qv-media{position:static}.qv-main{height:320px}.zk-qv-box{padding:20px 16px;border-radius:16px}.zk-qv{padding:8px}}
@media(max-width:900px){.detail-grid,.label-body-content,.contact-grid{grid-template-columns:1fr}.detail-gallery{position:static}.label-left-col{border-right:none;border-bottom:1.5px solid var(--border-light);padding:0 0 24px}.why-grid,.testi-grid{grid-template-columns:1fr}.footer-top{grid-template-columns:1fr 1fr}.nav-links{display:none}.full-gallery{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.nav-inner{padding:0 14px;gap:10px}.brand-logo-img{height:40px}.wm-1{font-size:24px}.whatsapp-btn-top span{display:none}.footer-top,.form-row,.label-bullet-grid{grid-template-columns:1fr}.product-details-hero{padding:18px;border-radius:20px}.detail-main-media{height:340px}.ingredients-grid-section{padding:28px 16px}.label-body-content{padding:24px 18px}.products-box-grid{grid-template-columns:1fr}.pillars-inner{gap:14px}.header-top-floral-bar{height:48px;background-size:auto 48px}}`;

  // "View Details" quick-view popup: everything the modal shows, keyed by product id.
  // Image URLs are already HTML-escaped by safeImage; text is escaped in the browser.
  const quickView = {};
  for (const p of allProducts) {
    const d = splitDescription(p.description);
    quickView[p.id] = {
      name: String(p.name || ''), cat: categoryName(p), badge: p.badge_text || '', images: imagesOf(p),
      price: Number(p.price) || 0, mrp: showOffers(p) ? Number(p.compare_price) || 0 : 0, off: discount(p),
      size: p.product_size || p.size || '', offer: showOffers(p) ? (p.offer_text || p.offer || '') : '',
      bullets: d.bullets, prose: d.prose,
      ingredients: String(p.ingredients || '').split(/,|\n/).map(x => x.trim()).filter(Boolean),
      benefits: String(p.benefits || '').split('\n').map(x => x.replace(/^[•\-*\s]+/, '').trim()).filter(Boolean),
      howto: String(p.user_instructions || ''), note: String(p.additional_note || ''),
      in_stock: p.in_stock !== false, url: productPath(p),
      sizes: (Array.isArray(p.variants) ? p.variants : []).filter(v => v && typeof v === 'object' && v.id && v.active !== false).map(v => ({ id: String(v.id), label: String(v.label || ''), price: Number(v.price) || 0, in: Number(v.quantity) > 0 })),
      net: netQuantityLabel(p)
    };
  }
  const quickViewMarkup = `<div class="zk-qv" id="zkQV" role="dialog" aria-modal="true" aria-label="Product details" onclick="if(event.target===this)zkQVClose()"><div class="zk-qv-box"><button class="zk-qv-close" type="button" onclick="zkQVClose()" aria-label="Close">×</button><div id="zkQVBody"></div></div></div>`;
  const quickViewScript = `<script>(function(){var QV=${JSON.stringify(quickView).replace(/</g, '\\u003c')},qvId=null,qvQty=1,qvSize=null;
function qe(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function qm(n){return '₹'+Number(n||0).toLocaleString('en-IN')}
function sec(title,body){return body?'<div class="qv-sec"><h4>'+title+'</h4>'+body+'</div>':''}
function ul(items){return items.length?'<ul>'+items.map(function(x){return '<li>'+qe(x)+'</li>'}).join('')+'</ul>':''}
function paras(text){return String(text||'').split(/\\n+/).filter(Boolean).map(function(x){return '<p>'+qe(x)+'</p>'}).join('')}
window.zkQuickView=function(id){var p=QV[id];if(!p)return true;qvId=id;qvQty=1;qvSize=(p.sizes||[]).filter(function(x){return x.in})[0]||(p.sizes||[])[0]||null;var im=p.images;
var media='<div class="qv-media"><div class="qv-main">'+(im[0]?'<img id="qvMain" src="'+im[0]+'" alt="'+qe(p.name)+'" onclick="zkLightbox(this.src)">':'<span class="no-img big">'+qe(p.name.charAt(0))+'</span>')+'</div>'+(im.length>1?'<div class="qv-thumbs">'+im.map(function(src,i){return '<button type="button" class="'+(i?'':'active')+'" onclick="zkQVThumb(this,'+i+')"><img src="'+src+'" alt="Photo '+(i+1)+'"></button>'}).join('')+'</div>':'')+'</div>';
var price='<div class="qv-price-box"><span class="qv-price" id="qvPrice">'+qm(qvSize?qvSize.price:p.price)+'</span>'+(p.mrp>p.price?'<span class="qv-mrp">MRP '+qm(p.mrp)+'</span>':'')+(p.off?'<span class="qv-off">'+p.off+'% OFF</span>':'')+'<div class="qv-note">✓ '+qe(p.note||'Inclusive of all taxes')+'</div></div>';
var sizes=(p.sizes||[]).length?'<div class="qv-sizes">'+p.sizes.map(function(x,i){return '<button type="button" class="qv-size'+(x===qvSize?' active':'')+'"'+(x.in?'':' disabled')+' onclick="zkQVSize('+i+')">'+qe(x.label)+' · '+qm(x.price)+(x.in?'':' (sold out)')+'</button>'}).join('')+'</div>':(p.net?'<div class="qv-note">Net quantity: '+qe(p.net)+'</div>':'');
var cta=p.in_stock?'<div class="qv-cta"><div class="qv-qty"><button type="button" onclick="zkQVQty(-1)" aria-label="Decrease">−</button><span id="qvQty">1</span><button type="button" onclick="zkQVQty(1)" aria-label="Increase">+</button></div><button type="button" class="qv-add" onclick="zkAdd('+id+',qvGet(),qvSizeId())">🛒 Add to cart</button><button type="button" class="qv-buy" onclick="if(zkAdd('+id+',qvGet(),qvSizeId())){zkQVClose();openCheckout()}">Buy now</button></div>':'<div class="qv-cta"><span class="sold-out">Sold out</span></div>';
var info='<div class="qv-info">'+(p.cat?'<span class="qv-cat">'+qe(p.cat)+'</span>':'')+(p.badge?'<span class="qv-badge">'+qe(p.badge)+'</span>':'')+'<h2 class="qv-title">'+qe(p.name)+'</h2><div class="qv-stars">★★★★★ <span>Loved by our customers</span></div>'+price+(p.size?'<span class="qv-pill">'+qe(p.size)+'</span>':'')+(p.offer?'<div class="qv-offer">🎁 '+qe(p.offer)+'</div>':'')+sizes+cta
+sec('About this product',ul(p.bullets)+paras(p.prose))+sec('Key benefits',ul(p.benefits))+sec('Ingredients',p.ingredients.length?'<div class="qv-chips">'+p.ingredients.map(function(x){return '<span>'+qe(x)+'</span>'}).join('')+'</div>':'')+sec('How to use',paras(p.howto))
+(p.url&&p.url!=='#'?'<a class="qv-full" href="'+qe(p.url)+'">Open full product page →</a>':'')+'</div>';
document.getElementById('zkQVBody').innerHTML='<div class="qv-grid">'+media+info+'</div>';
document.getElementById('zkQV').classList.add('open');document.body.classList.add('qv-open');document.querySelector('#zkQV .zk-qv-box').scrollTop=0;return false};
window.qvGet=function(){return qvQty};
window.qvSizeId=function(){return qvSize?qvSize.id:null};
window.zkQVSize=function(i){var p=QV[qvId];if(!p||!p.sizes[i]||!p.sizes[i].in)return;qvSize=p.sizes[i];var el=document.getElementById('qvPrice');if(el)el.textContent=qm(qvSize.price);document.querySelectorAll('.qv-size').forEach(function(b,j){b.classList.toggle('active',j===i)})};
window.zkQVQty=function(d){qvQty=Math.max(1,Math.min(99,qvQty+d));document.getElementById('qvQty').textContent=qvQty};
window.zkQVThumb=function(btn,i){var p=QV[qvId],img=document.getElementById('qvMain');if(img&&p)img.src=p.images[i];document.querySelectorAll('.qv-thumbs button').forEach(function(x){x.classList.toggle('active',x===btn)})};
window.zkQVClose=function(){document.getElementById('zkQV').classList.remove('open');document.body.classList.remove('qv-open')};
document.addEventListener('keydown',function(e){if(e.key==='Escape')zkQVClose()});})();</script>`;

  const script = `<script>(function(){var t;window.zkToast=function(m){var el=document.getElementById('zkToast');if(!el)return;el.textContent=m;el.classList.add('show');clearTimeout(t);t=setTimeout(function(){el.classList.remove('show')},2800)};
window.zkAdd=function(id,qty,vid){var n=Math.max(1,qty||1);for(var i=0;i<n;i++){if(addCart(id,vid)===false)return false}zkToast('🛒 Added to cart');return true};
window.zkQtyValue=function(){var el=document.getElementById('qtyDisplay');return el?Number(el.textContent)||1:1};
window.zkQty=function(d){var el=document.getElementById('qtyDisplay');if(el)el.textContent=String(Math.max(1,Math.min(99,zkQtyValue()+d)))};
window.zkThumb=function(btn,src){var img=document.getElementById('mainImage');if(img)img.src=src;document.querySelectorAll('.detail-thumb').forEach(function(x){x.classList.toggle('active',x===btn)})};
window.zkVariant=function(btn){if(btn.disabled)return;document.querySelectorAll('.variant-chip').forEach(function(x){x.classList.toggle('active',x===btn)});if(btn.dataset.variant){window.zkSelectedVariant=btn.dataset.variant;var el=document.getElementById('zkDetailPrice');if(el&&btn.dataset.price)el.textContent='₹'+Number(btn.dataset.price).toLocaleString('en-IN')}};
window.zkLightbox=function(src){var lb=document.getElementById('zkLightbox');lb.querySelector('img').src=src;lb.classList.add('open')};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){document.getElementById('zkLightbox').classList.remove('open');closeCheckout()}});})();
async function contactStore(e){e.preventDefault();var d=Object.fromEntries(new FormData(e.target));var r=await fetch('/api/notify/${slug}/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});zkToast(r.ok?'✅ Message sent. We will contact you soon.':'Could not send message');if(r.ok)e.target.reset();return false}
async function notifyMe(e,label){e.preventDefault();var email=e.target.querySelector('input').value;var r=await fetch('/api/notify/${slug}/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,product_label:label})});zkToast(r.ok?'We will notify you':'Could not save request');return false}</script>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}">${product && product.unlisted ? '<meta name="robots" content="noindex,nofollow">' : ''}<meta name="theme-color" content="${brand}"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?${skin.fonts}${fields.body_font && !['Inter', 'Georgia', 'Arial'].includes(fields.body_font) ? '&family=' + encodeURIComponent(fields.body_font).replace(/%20/g, '+') + ':wght@400;600;700' : ''}&display=swap" rel="stylesheet"><style>${css}</style></head><body class="design-${name}"><div class="zk-toast" id="zkToast" role="status"></div><div class="zk-lightbox" id="zkLightbox" onclick="this.classList.remove('open')"><img alt=""></div>${announcement()}${floralTop()}${nav()}${content}${footerAbove()}${footer()}${quickViewMarkup}${cartMarkup}${cartLogic}${script}${quickViewScript}</body></html>`;
}

module.exports = { designFor, renderDesign, skins };
