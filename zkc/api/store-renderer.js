const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeColor = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(String(value||'')) ? value : fallback;
const safeImage = value => (/^https:\/\//i.test(String(value||'')) || /^\/assets\/[a-z0-9._/-]+$/i.test(String(value||'')) && !String(value).includes('..')) ? escapeHtml(value) : '';
const safeLink = value => (/^https:\/\//i.test(String(value||'')) || /^\/(?!\/)/.test(String(value||'')) || /^#[a-z0-9_-]*$/i.test(String(value||''))) ? escapeHtml(value) : '#';
const list = value => Array.isArray(value) ? value : String(value||'').split(/\n|,/).map(item=>item.trim()).filter(Boolean);
const slugify = value => String(value||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const { designFor, renderDesign } = require('./theme-designs');
const { checkoutSettings, enabledPaymentMethods, preferredPaymentMethod, PAYMENT_LABELS } = require('./services/checkout-settings');
const clamp = (n,min,max,fallback) => Number.isFinite(Number(n)) ? Math.max(min,Math.min(max,Number(n))) : fallback;

function renderStore(snapshot, options={}) {
  const store=snapshot.store||{},rootConfig=snapshot.theme_config||{},template=options.template|| (options.page?'page':'home');
  const basePath=options.basePath||'';
  const storeUrl=p=>(basePath?(p==='/'?basePath:basePath+p):p);
  const cfg=Object.assign({},rootConfig,(rootConfig.templates||{})[template]||{},options.page?(rootConfig.page_templates||{})[options.page.id]||{}:{});
  cfg.sections=Object.assign({},rootConfig.sections||{},cfg.sections||{});
  const fields=Object.assign({},cfg.fields||rootConfig.fields||{},cfg.sections.footer||{}),storeName=escapeHtml(store.store_name||'Online Store'),slug=escapeHtml(store.slug||'');
  const primary=safeColor(cfg.primary_colour||store.primary_colour,'#1688E8'),background=safeColor(cfg.bg_colour||store.bg_colour,'#fff'),accent=safeColor(cfg.accent_colour||store.accent_colour,'#A6D900');
  const requestedPreset=cfg.style_preset||rootConfig.style_preset||(store.theme_name==='dark-navy'?'dark-navy':'studio');
  const stylePreset=['dark-navy','studio','botanical','midnight','atelier','market','playful','tech'].includes(requestedPreset)?requestedPreset:'studio';
  const designClass=rootConfig.design==='none'?'':rootConfig.template_id==='smeram-natural'?'design-smeram':rootConfig.template_id==='miliro-natural'?'design-miliro':'';
  const darkTheme=stylePreset==='dark-navy'||stylePreset==='midnight';
  const darkSurface=stylePreset==='dark-navy'?'#0B2342':'#172635',darkBorder=stylePreset==='dark-navy'?'#263B57':'#344656';
  const font=['Inter','Poppins','Roboto','Playfair Display','Dancing Script','Georgia','Arial'].includes(fields.body_font)?fields.body_font:'Inter';
  const headingFont=['Inter','Poppins','Playfair Display','Dancing Script','Georgia','Arial'].includes(fields.hero_font)?fields.hero_font:font;
  const page=options.page,product=options.product,allProducts=snapshot.products||[],listedProducts=allProducts.filter(p=>!p.unlisted);
  let products=options.products||listedProducts;
  if(template==='collection'&&options.collection)products=listedProducts.filter(p=>slugify(p.category_name||p.category||'')===slugify(options.collection));
  const title=escapeHtml(page?.title||product?.name||cfg.meta_title||store.hero_headline||storeName);
  const description=escapeHtml(cfg.meta_description||store.hero_subtext||'');
  const format=amount=>'₹'+Number(amount||0).toLocaleString('en-IN');
  const sec=key=>cfg.sections[key]||{};
  const isVisible=key=>sec(key).visible!==false && sec(key).show!==false && !(cfg.hidden_sections||[]).includes(key) && !(cfg.removed_sections||[]).includes(key);
  const showOffers=p=>(p&&p.show_offer!==undefined&&p.show_offer!==null?p.show_offer!==false:(rootConfig.display||{}).show_offers!==false);const card=p=>{const img=safeImage(Array.isArray(p.images)&&p.images[0]);const soldOut=p.in_stock===false;const path=p.slug?storeUrl(`/products/${encodeURIComponent(p.slug)}`):'#';return `<article class="card" data-zkc-section="products"><a class="product-link" href="${path}"><div class="product-image">${img?`<img src="${img}" alt="${escapeHtml(p.name)}">`:'<span>Product</span>'}</div></a><div class="product-body"><h3><a class="product-link" href="${path}">${escapeHtml(p.name)}</a></h3><p class="description">${escapeHtml(p.description||'')}</p><div class="price">${format(p.price)} ${p.compare_price&&showOffers(p)?`<del>${format(p.compare_price)}</del>`:''}</div>${soldOut?`<form class="notify" onsubmit="return notifyMe(event,${JSON.stringify(String(p.name)).replace(/</g,'\\u003c')})"><input type="email" required placeholder="Email for restock"><button>Notify me</button></form>`:`<button class="buy" onclick="addCart(${Number(p.id)})">Add to cart</button>`}</div></article>`;};
  const heading=(text,sub='')=>`<div class="section-heading"><h2>${escapeHtml(text)}</h2>${sub?`<p>${escapeHtml(sub)}</p>`:''}</div>`;
  const announcement=()=>{const s=sec('announcement'),img=safeImage(s.background_image||fields.ann_bg_img);if(!isVisible('announcement') || fields.ann_show === false || s.visible === false || cfg.announcement_enabled === false)return '';return `<div class="announce" data-zkc-section="announcement" style="background-color:${safeColor(s.background||fields.ann_bg,primary)};${img?`background-image:url('${img}');`:''}color:${safeColor(s.color||fields.ann_text_c,'#fff')};font-size:${clamp(fields.ann_size,10,22,13)}px">${escapeHtml(s.text||fields.ann_text||'')}</div>`;};
  const nav=()=>{
    if(!isVisible('nav'))return '';
    const s=sec('nav'),
          logo=safeImage(fields.nav_logo||cfg.logo_url||store.logo_url),
          image=safeImage(s.background_image||fields.nav_bg_img),
          categories=[...new Set(listedProducts.map(p=>p.category_name||p.category).filter(Boolean))].slice(0,4);

    const linkColor = s.link_color || fields.nav_link_color || '';
    const linkHoverColor = s.link_hover_color || fields.nav_link_hover || '';
    const subColor = s.sub_color || fields.nav_sub_color || '';
    const subHoverColor = s.sub_hover_color || fields.nav_sub_hover || '';
    const subBg = s.sub_bg || fields.nav_sub_bg || '#ffffff';

    const menuStyles = `
      <style>
        ${linkColor ? `header[data-zkc-section="navigation"] .main-nav a, header[data-zkc-section="navigation"] .brand, header[data-zkc-section="navigation"] .cart-link { color: ${safeColor(linkColor, '#111827')} !important; }` : ''}
        ${linkHoverColor ? `header[data-zkc-section="navigation"] .main-nav a:hover, header[data-zkc-section="navigation"] .cart-link:hover { color: ${safeColor(linkHoverColor, '#FF6B00')} !important; border-color: ${safeColor(linkHoverColor, '#FF6B00')} !important; }` : ''}
        ${subColor ? `header[data-zkc-section="navigation"] .main-nav .dropdown a, header[data-zkc-section="navigation"] .mega-prod, .nav-links .mega .mega-cat, .nav-links .mega .mega-prod { color: ${safeColor(subColor, '#374151')} !important; }` : ''}
        ${subHoverColor ? `header[data-zkc-section="navigation"] .main-nav .dropdown a:hover, header[data-zkc-section="navigation"] .mega-prod:hover, .nav-links .mega .mega-cat:hover, .nav-links .mega .mega-prod:hover { color: ${safeColor(subHoverColor, '#FF6B00')} !important; }` : ''}
        ${subBg ? `header[data-zkc-section="navigation"] .dropdown-menu, .nav-links .mega-inner { background: ${safeColor(subBg, '#ffffff')} !important; }` : ''}
      </style>
    `;

    return `${menuStyles}<header data-zkc-section="navigation" style="background-color:${safeColor(s.background||fields.nav_bg,'#fff')};${image?`background-image:url('${image}');background-size:cover;background-position:center;`:''};${fields.nav_sticky===false?'position:static':''}"><a class="brand" href="${storeUrl('/')}">${logo?`<img src="${logo}" alt="">`:''}${escapeHtml(fields.nav_name||store.store_name||'')}</a><nav class="main-nav">${isVisible('products')?`<a href="${template==='home'?'#products':storeUrl('/#products')}">All Products</a>`:''}${categories.map(category=>`<a href="${storeUrl('/collections/'+encodeURIComponent(slugify(category)))}">${escapeHtml(category)}</a>`).join('')}${(snapshot.pages||[]).filter(p=>p.status==='published').slice(0,5).map(p=>`<a href="${storeUrl('/page/'+encodeURIComponent(p.slug))}">${escapeHtml(p.title)}</a>`).join('')}</nav><a class="cart-link" href="#checkout" onclick="openCheckout(event)">Cart <span id="cart">0</span></a></header>`;
  };
  const hero=()=>{const s=sec('hero'),image=safeImage(s.image||s.hero_bg_img||fields.hero_bg_img||store.hero_image_url);if(!isVisible('hero'))return '';const position=['center','top','bottom','left','right'].includes(fields.hero_image_position)?fields.hero_image_position:'center';const align=s.align||fields.hero_text_align||'left';return `<section class="hero" data-zkc-section="hero" style="background-color:${safeColor(s.background||fields.hero_bg,background)};${image?`background-image:linear-gradient(90deg,rgba(0,0,0,.48),rgba(0,0,0,.08)),url('${image}');background-position:${position};`:''};min-height:${clamp(s.min_height||fields.hero_min_height,280,800,420)}px;padding:${clamp(fields.hero_padding,24,160,80)}px max(5%,calc((100% - 1180px)/2));text-align:${align};color:${safeColor(fields.hero_text_color,'#fff')}"><div><p class="eyebrow">${escapeHtml(store.tagline||'')}</p><h1 style="color:${safeColor(fields.hero_h1_c,'#fff')};font-size:clamp(${clamp(fields.hero_mobile_size,24,64,34)}px,6vw,${clamp(fields.hero_h1_size,28,88,58)}px)">${escapeHtml(s.heading||fields.hero_h1||store.hero_headline||storeName)}</h1><p>${escapeHtml(s.description||fields.hero_desc||store.hero_subtext||'')}</p><a class="button" style="background:${safeColor(fields.hero_cta_c,primary)};border-radius:${clamp(fields.button_radius,0,40,8)}px" href="#products">${escapeHtml(s.button||fields.hero_cta||store.hero_cta_text||'Shop now')}</a></div></section>`;};
  const renderSection=key=>{
    const s=sec(key);if(!isVisible(key))return '';
    if(key==='hero')return hero();
    if(key==='slider'){const urls=list(s.images||fields.slider_images||fields.slider_urls).map(safeImage).filter(Boolean);return urls.length?`<section class="slider" data-zkc-section="slider">${urls.map(src=>`<img src="${src}" alt="${storeName}">`).join('')}</section>`:'';}
    if(key==='offers')return (s.heading||fields.offer_heading||s.text||fields.offer_text)?`<section class="offer" data-zkc-section="offers" style="background:${safeColor(s.background||fields.offer_bg,accent)}"><h2>${escapeHtml(s.heading||fields.offer_heading||'Special offer')}</h2><p>${escapeHtml(s.text||fields.offer_text||'')}</p></section>`:'';
    if(key==='trust'){const items=list(s.items||fields.trust_items);return items.length?`<section class="trust" data-zkc-section="trust" style="background:${safeColor(s.background||fields.trust_bg,'#388E3C')};color:${safeColor(s.color||fields.trust_text_c,'#fff')}">${items.map(item=>`<span>${escapeHtml(item)}</span>`).join('')}</section>`:'';}
    if(key==='why'){const items=list(s.items||fields.why_items);return (s.heading||fields.why_heading||items.length)?`<section class="content-section why" data-zkc-section="why" style="background:${safeColor(s.background||fields.why_bg,'#fff')}">${heading(s.heading||fields.why_heading||'Why shop with us',s.text||fields.why_text)}<div class="benefits">${items.map(item=>`<div class="benefit">${escapeHtml(item)}</div>`).join('')}</div></section>`:'';}
    if(key==='ingredients'||key==='howtouse'){const isIngredients=key==='ingredients',items=list(s.items||fields[isIngredients?'ingredients_items':'how_items']);return (s.heading||fields[isIngredients?'ingredients_heading':'how_heading']||items.length)?`<section class="content-section ${key}" data-zkc-section="${key}" style="background:${safeColor(s.background||fields[isIngredients?'ingredients_bg':'how_bg'],'#fff')}">${heading(s.heading||fields[isIngredients?'ingredients_heading':'how_heading']||(isIngredients?'Ingredients':'How to use'),s.text||fields[isIngredients?'ingredients_text':'how_text'])}<ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`:'';}
    if(key==='gallery'){const urls=list(s.images||fields.gallery_images).map(safeImage).filter(Boolean);return urls.length?`<section class="content-section gallery" data-zkc-section="gallery">${heading(s.heading||fields.gallery_heading||'Gallery')}<div class="gallery-grid">${urls.map(src=>`<img src="${src}" alt="${storeName}">`).join('')}</div></section>`:'';}
    if(key==='reviews'){const items=list(s.items||fields.review_items);return items.length?`<section class="content-section reviews" data-zkc-section="reviews">${heading(s.heading||fields.review_heading||'Customer reviews')}<div class="review-grid">${items.map(item=>`<blockquote>“${escapeHtml(item)}”</blockquote>`).join('')}</div></section>`:'';}
    if(key==='products')return `<main class="products" data-zkc-section="products" id="products">${heading(s.heading||fields.products_heading||'Featured products')}<div class="grid">${products.map(card).join('')||'<p>No products are available yet.</p>'}</div></main>`;
    if(key==='contact'&&options.showContact!==false&&isVisible('contact'))return `<form class="contact" data-zkc-section="contact" onsubmit="return contactStore(event)"><h2>${escapeHtml(s.heading||fields.contact_heading||'Contact us')}</h2><input name="name" required placeholder="Your name"><input name="email" type="email" placeholder="Email"><input name="phone" placeholder="Phone"><textarea name="message" required placeholder="How can we help?"></textarea><button>Send message</button></form>`;
    if(key==='footer_above'){const image=safeImage(s.image||fields.footer_above_img);return (s.heading||fields.footer_above_heading||s.text||fields.footer_above_text||image)?`<section class="footer-above" data-zkc-section="footer_above" style="background:${safeColor(s.background||fields.footer_above_bg,'#f3f4f6')};${image?`background-image:url('${image}');`:''}"><h2>${escapeHtml(s.heading||fields.footer_above_heading||'')}</h2><p>${escapeHtml(s.text||fields.footer_above_text||'')}</p></section>`:'';}
    return '';
  };
  const defaultOrder=['hero','trust','why','ingredients','howtouse','slider','offers','products','gallery','reviews','contact'];
  const order=Array.isArray(cfg.section_order)?cfg.section_order.filter(key=>defaultOrder.includes(key)&&!(cfg.removed_sections||[]).includes(key)):defaultOrder.filter(key=>!(cfg.removed_sections||[]).includes(key));
  let content='';
  if(template==='product'&&product){const image=safeImage(Array.isArray(product.images)&&product.images[0]),detailStyle=sec('product');content=`<main class="product-detail" data-zkc-section="product" style="background:${safeColor(detailStyle.background,'#fff')}"><div class="detail-image">${image?`<img src="${image}" alt="${escapeHtml(product.name)}">`:''}</div><div><p class="eyebrow">${escapeHtml(product.category_name||'')}</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description||'')}</p>${detailStyle.show_manufacturer!==false&&product.manufacturer?`<p>${escapeHtml(product.manufacturer)}</p>`:''}<div class="price" style="color:${safeColor(detailStyle.price_color||fields.prod_price_c,primary)}">${format(product.price)} ${product.compare_price&&detailStyle.compare_price!==false&&showOffers(product)?`<del>${format(product.compare_price)}</del>`:''}</div>${product.in_stock?`<button class="buy" style="background:${safeColor(detailStyle.button_color||fields.prod_cta_c,primary)}">Add to cart</button>`:'<p>Currently unavailable</p>'}${detailStyle.show_whatsapp!==false&&store.whatsapp_number?`<a class="button" href="https://wa.me/${encodeURIComponent(String(store.whatsapp_number).replace(/\D/g,''))}">Order on WhatsApp</a>`:''}${detailStyle.show_stars!==false?'<p aria-label="5 stars">★★★★★</p>':''}</div></main>`;}
  else if(template==='collection')content=`<main class="products" id="products" data-zkc-section="collection" style="background:${safeColor(sec('collection').background,background)}"><h1>${escapeHtml(sec('collection').heading||fields.collection_heading||options.collection||'Shop all')}</h1><div class="grid">${products.map(card).join('')||'<p>No products in this collection yet.</p>'}</div></main>`;
  else if(page){
    const body=String((page.content||{}).body||(page.content||{}).text||'').replace(/\\r\\n|\\n/g,'\n').replace(/\r\n/g,'\n');
    content=`<section class="page-content" data-zkc-section="page_content"><h1>${escapeHtml(page.title)}</h1>${body.split(/\n{2,}/).map(p=>`<p>${escapeHtml(p).replace(/\n/g,'<br>')}</p>`).join('')}</section>`;
  }
  else content=order.map(key=>renderSection(key)+renderBlocks(key)).join('');
  if(template==='product'&&product)content=content.replace('<button class="buy" style="background:',`<button class="buy" onclick="addCart(${Number(product.id)});openCheckout()" style="background:`);
  function renderBlocks(key){return (fields.content_blocks||[]).filter(block=>block.section===key).map(block=>{
    const text=escapeHtml(block.content||''),url=safeImage(block.content),blockUrl=safeLink(block.url);
    if(block.type==='image'&&url)return `<section class="content-section" data-zkc-section="${escapeHtml(key)}"><img src="${url}" alt="${escapeHtml(block.alt||'') }" style="display:block;max-width:100%;height:auto;margin:auto"></section>`;
    if(block.type==='button')return `<section class="content-section" data-zkc-section="${escapeHtml(key)}" style="text-align:center"><a class="button" href="${blockUrl}">${text}</a></section>`;
    if(block.type==='benefit')return `<section class="content-section" data-zkc-section="${escapeHtml(key)}"><div class="benefit">${text}</div></section>`;
    if(block.type==='app'&&/^https:\/\//i.test(String(block.content||'')))return `<section class="content-section app-block" data-zkc-section="${escapeHtml(key)}"><iframe title="Store app extension" src="${url}" loading="lazy" sandbox="allow-scripts allow-forms" referrerpolicy="no-referrer" style="width:100%;min-height:320px;border:0"></iframe></section>`;
    if(block.type==='text')return `<section class="content-section" data-zkc-section="${escapeHtml(key)}"><p>${text}</p></section>`;
    return '';
  }).join('');}
  const above=renderSection('footer_above');
  // Merchant checkout settings: discount box visibility and which payment methods are offered.
  const checkout=checkoutSettings(rootConfig),paymentMethods=enabledPaymentMethods(checkout);
  const paymentDescriptions={cod:'Pay when your order is delivered.',razorpay:'UPI, cards, netbanking and wallets.'};
  // When both methods are enabled, always show both choices. A single enabled method is submitted silently.
  const paymentField=paymentMethods.length>1?`<style id="zkc-payment-choice-styles">#checkoutForm .zkc-payment-options{display:grid!important;gap:9px!important;width:100%!important;min-width:0!important;border:0!important;padding:0!important;margin:12px 0!important}#checkoutForm .zkc-payment-legend{display:block!important;width:100%!important;padding:0!important;margin:0 0 2px!important;font-size:12px!important;font-weight:800!important;color:#475569!important}#checkoutForm .zkc-payment-option{display:grid!important;grid-template-columns:20px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;width:100%!important;min-width:0!important;margin:0!important;padding:12px!important;border:1.5px solid #cbd5e1!important;border-radius:10px!important;background:#fff!important;cursor:pointer!important;box-sizing:border-box!important;text-align:left!important}#checkoutForm .zkc-payment-option:has(input:checked){border-color:${primary}!important;box-shadow:0 0 0 2px ${primary}20!important;background:${primary}08!important}#checkoutForm .zkc-payment-radio{display:block!important;width:18px!important;height:18px!important;min-width:18px!important;margin:0!important;padding:0!important;accent-color:${primary}!important}#checkoutForm .zkc-payment-copy{display:block!important;min-width:0!important;line-height:1.3!important}#checkoutForm .zkc-payment-title{display:block!important;margin:0 0 2px!important;font-size:13px!important;font-weight:800!important;color:#17202b!important;white-space:normal!important}#checkoutForm .zkc-payment-description{display:block!important;margin:0!important;font-size:11.5px!important;font-weight:400!important;color:#64748b!important;white-space:normal!important}</style><fieldset class="zkc-payment-options"><legend class="zkc-payment-legend">Choose payment method</legend>${paymentMethods.map((m,i)=>`<label class="zkc-payment-option"><input class="zkc-payment-radio" type="radio" name="payment_method" value="${m}"${i===0?' checked':''}><span class="zkc-payment-copy"><strong class="zkc-payment-title">${PAYMENT_LABELS[m]}</strong><small class="zkc-payment-description">${paymentDescriptions[m]}</small></span></label>`).join('')}</fieldset>`:`<input type="hidden" name="payment_method" value="${preferredPaymentMethod(checkout)}">`;
  // Checkout button text and style from Merchant portal → Checkout & Payments (empty values keep the theme look).
  const pb=checkout.pay_button,payFontLink=pb.font_family&&!['Georgia','Arial'].includes(pb.font_family)?`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(pb.font_family).replace(/%20/g,'+')}:wght@400;500;700;800&display=swap">`:'';
  const payStyle=[pb.bg_color&&`background:${pb.bg_color}`,pb.text_color&&`color:${pb.text_color}`,pb.font_family&&`font-family:'${pb.font_family}',sans-serif`,pb.font_size&&`font-size:${pb.font_size}px`,pb.radius!==null&&`border-radius:${pb.radius}px`,!pb.bold&&'font-weight:500'].filter(Boolean).join(';');
  const initialPaymentMethod=paymentMethods.length>1?paymentMethods[0]:preferredPaymentMethod(checkout);
  const initialPayButtonText=initialPaymentMethod==='cod'?'Confirm Order':pb.text;
  const payButtonHtml=`${payFontLink}<button class="buy" id="zkPayButton" type="submit"${payStyle?` style="${payStyle}"`:''}>${escapeHtml(initialPayButtonText)}</button>`;
  const checkoutFormStyles=`<style id="zkc-checkout-form-styles">#checkoutForm .zkc-checkout-heading{margin:8px 0 6px!important;font-size:13px!important;font-weight:800!important;color:#334155!important}#checkoutForm .zkc-address-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px 10px!important;min-width:0!important}#checkoutForm .zkc-field{display:grid!important;gap:4px!important;min-width:0!important;margin:0!important}#checkoutForm .zkc-field-wide{grid-column:1/-1!important}#checkoutForm .zkc-field-label{display:block!important;font-size:11.5px!important;font-weight:700!important;color:#475569!important}#checkoutForm .zkc-field input{display:block!important;width:100%!important;min-width:0!important;margin:0!important;padding:11px 12px!important;border:1.5px solid #cbd5e1!important;border-radius:8px!important;background:#fff!important;color:#17202b!important;font:inherit!important;font-size:14px!important;box-sizing:border-box!important}#checkoutForm .zkc-field input:focus{outline:0!important;border-color:${primary}!important;box-shadow:0 0 0 3px ${primary}20!important}#checkoutForm .zkc-field input[aria-invalid="true"]{border-color:#dc2626!important;background:#fff7f7!important;box-shadow:0 0 0 2px #fecaca!important}#checkoutForm .zkc-field-error{display:block!important;min-height:0!important;margin:0!important;color:#b91c1c!important;font-size:11px!important;font-weight:600!important;line-height:1.3!important}#checkoutForm .zkc-field-error:empty{display:none!important}#checkoutForm .zkc-whatsapp-optin{display:grid!important;grid-template-columns:20px minmax(0,1fr)!important;align-items:start!important;gap:9px!important;margin:10px 0 4px!important;padding:11px 12px!important;border:1px solid #bbf7d0!important;border-radius:9px!important;background:#f0fdf4!important;color:#14532d!important;font-size:12px!important;line-height:1.4!important;cursor:pointer!important}#checkoutForm .zkc-whatsapp-optin input{width:18px!important;height:18px!important;margin:0!important;padding:0!important;accent-color:#16a34a!important}#checkoutForm .zkc-whatsapp-optin strong{display:block!important;font-size:12.5px!important}#checkoutForm .zkc-whatsapp-optin small{display:block!important;color:#477052!important;font-size:11px!important;margin-top:2px!important}#checkoutForm .zkc-checkout-alert{display:flex!important;align-items:flex-start!important;gap:8px!important;width:100%!important;margin:8px 0 2px!important;padding:10px 12px!important;border-radius:9px!important;font-size:12.5px!important;font-weight:600!important;line-height:1.4!important;box-sizing:border-box!important}#checkoutForm .zkc-checkout-alert[hidden]{display:none!important}#checkoutForm .zkc-checkout-alert[data-type="error"]{color:#991b1b!important;background:#fef2f2!important;border:1px solid #fecaca!important}#checkoutForm .zkc-checkout-alert[data-type="info"]{color:#1e40af!important;background:#eff6ff!important;border:1px solid #bfdbfe!important}#checkoutForm #zkPayButton:disabled{opacity:.65!important;cursor:wait!important}@media(max-width:520px){.cart-panel{padding:18px!important}.cart-panel h2{font-size:21px!important}#checkoutForm .zkc-address-grid{grid-template-columns:1fr!important}#checkoutForm .zkc-field-wide{grid-column:auto!important}#checkoutForm .zkc-field input{font-size:16px!important;padding:12px!important}#checkoutForm .zkc-checkout-alert{font-size:12px!important}}</style>`;
  const cartMarkup=`${checkoutFormStyles}<div class="cart-backdrop" id="cartBackdrop" onclick="if(event.target===this)closeCheckout()"><section class="cart-panel" id="checkout">
  <!-- Active Cart & Checkout View -->
  <div id="cartActiveView">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid #e2e8f0;padding-bottom:10px">
      <button class="button continue-shopping" type="button" onclick="closeCheckout()" style="font-size:12px;padding:6px 12px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1">← Continue Shopping</button>
      <button class="cart-close" type="button" onclick="closeCheckout()">×</button>
    </div>
    <h2>Your cart</h2>
    <div id="cartItems"></div>
    <p class="cart-total">Subtotal: <strong id="cartSubtotal">₹0</strong></p>
    ${checkout.show_coupon?'<div class="coupon-row"><input id="couponCode" placeholder="Discount code"><button type="button" onclick="applyCoupon()">Apply</button></div><p id="couponMessage" role="status"></p>':''}
    <form id="checkoutForm" onsubmit="placeOrder(event)" novalidate>
      <h3 class="zkc-checkout-heading">Shipping address</h3>
      <div class="zkc-address-grid">
        <label class="zkc-field zkc-field-wide"><span class="zkc-field-label">Full name</span><input name="name" required maxlength="150" autocomplete="name" placeholder="Full name"><small class="zkc-field-error" data-error-for="name"></small></label>
        <label class="zkc-field"><span class="zkc-field-label">Phone number</span><input name="phone" required inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number"><small class="zkc-field-error" data-error-for="phone"></small></label>
        <label class="zkc-field"><span class="zkc-field-label">Email <span style="font-weight:400;color:#94a3b8">(optional)</span></span><input name="email" type="email" autocomplete="email" placeholder="Email address"><small class="zkc-field-error" data-error-for="email"></small></label>
        <label class="zkc-field zkc-field-wide"><span class="zkc-field-label">Address</span><input name="address" required autocomplete="street-address" placeholder="House / flat, street and area"><small class="zkc-field-error" data-error-for="address"></small></label>
        <label class="zkc-field"><span class="zkc-field-label">City</span><input name="city" required autocomplete="address-level2" placeholder="City"><small class="zkc-field-error" data-error-for="city"></small></label>
        <label class="zkc-field"><span class="zkc-field-label">State</span><input name="state" required autocomplete="address-level1" placeholder="State"><small class="zkc-field-error" data-error-for="state"></small></label>
        <label class="zkc-field zkc-field-wide"><span class="zkc-field-label">PIN code</span><input name="pincode" required inputmode="numeric" autocomplete="postal-code" maxlength="6" placeholder="6-digit PIN code"><small class="zkc-field-error" data-error-for="pincode"></small></label>
      </div>
      <!--zk-shipping-->
      ${paymentField}
      <label class="zkc-whatsapp-optin" id="zkcWhatsappOptin" style="${checkout.show_whatsapp_updates === true ? '' : 'display:none'}"><input type="checkbox" name="whatsapp_opt_in" value="1"><span><strong>Receive order updates on WhatsApp</strong><small>Optional. We will send confirmation and delivery tracking automatically through our WhatsApp Business service.</small></span></label>
      ${payButtonHtml}
      <div id="checkoutMessage" class="zkc-checkout-alert" data-type="error" role="alert" aria-live="assertive" hidden></div>
      <button class="button continue-shopping-block" type="button" onclick="closeCheckout()" style="width:100%;margin-top:8px;font-size:13px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155">🛍️ Continue Shopping</button>
    </form>
  </div>

  <!-- Dedicated Order Confirmation View (Shown immediately on payment receipt) -->
  <div id="orderSuccessView" style="display:none;padding:4px 0">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:10px">
      <span style="font-size:13px;font-weight:700;color:#059669;display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#10b981"></span>
        <span id="confStatusText">Payment Received &amp; Confirmed</span>
      </span>
      <button class="cart-close" type="button" onclick="resetAndCloseCheckout()">×</button>
    </div>

    <div style="text-align:center;padding:16px 12px;background:linear-gradient(180deg,#ecfdf5 0%,#f0fdf4 100%);border:1.5px solid #a7f3d0;border-radius:12px;margin-bottom:16px">
      <div style="width:56px;height:56px;border-radius:50%;background:#10b981;color:#fff;display:inline-grid;place-items:center;font-size:28px;font-weight:bold;box-shadow:0 0 0 6px #d1fae5;margin:0 auto 10px">✓</div>
      <h3 style="font-size:18px;font-weight:800;color:#065f46;margin:0 0 4px">Order Placed Successfully!</h3>
      <p style="font-size:12.5px;color:#047857;margin:0;font-weight:500">Thank you for your order. We are preparing it for dispatch.</p>
    </div>

    <!-- Order Summary Card -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Order Number</span>
        <span id="confOrderBadge" style="font-family:monospace;font-size:13px;font-weight:700;background:#f1f5f9;color:#0f172a;padding:3px 8px;border-radius:6px;border:1px solid #cbd5e1">ORD-XXXX</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span id="confAmountLabel" style="font-size:12px;color:#64748b">Amount Paid</span>
        <strong id="confOrderTotal" style="font-size:16px;color:#059669">₹0</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:#64748b">Payment Mode</span>
        <span id="confPaymentMethod" style="font-size:12px;font-weight:700;color:#0f172a">Online (Razorpay)</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:#64748b">Logistics Partner</span>
        <span style="font-size:11.5px;font-weight:700;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:4px;border:1px solid #bfdbfe">Ekart Logistics</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:#64748b">Fulfillment Status</span>
        <span style="font-size:11.5px;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:4px;border:1px solid #fde68a">Packaging Queue</span>
      </div>
    </div>

    <!-- Ordered Items Summary -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Items Ordered</div>
      <div id="confOrderItems" style="font-size:12px;color:#1e293b;line-height:1.6"></div>
    </div>

    <!-- Shipping Address Summary -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Delivery Address</div>
      <div id="confShippingAddress" style="font-size:12px;color:#334155;line-height:1.5"></div>
    </div>

    <!-- Action Buttons -->
    <div style="display:grid;gap:9px;margin-bottom:14px">
      <a id="confInvoiceLink" href="#" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#0f172a;color:#fff;padding:12px 14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.15)">
        <span>🧾</span> Download Official Tax Invoice (PDF)
      </a>
      <button type="button" class="button" onclick="resetAndCloseCheckout()" style="width:100%;padding:11px;background:#fff;border:1px solid #cbd5e1;color:#334155;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">
        🛍️ Continue Shopping
      </button>
    </div>

    <div style="padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11.5px;color:#92400e;line-height:1.5">
      <strong>📦 What happens next?</strong><br>
      1. Warehouse packs your items and issues shipping label.<br>
      2. Ekart Logistics assigns AWB tracking number.<br>
      <span id="confTrackingNote">3. Delivery tracking will be available after dispatch.</span>
    </div>
  </div>
</section></div>`;
  const shippingDropdownHtml = checkout.show_shipping_field !== false ? '<div class="cart-shipping-field" style="margin:10px 0"><label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Delivery &amp; Tax Fee</label><div class="delivery-tax-badge" style="display:flex;align-items:center;gap:6px;background:#ecfdf5;border:1.5px solid #a7f3d0;color:#065f46;padding:9px 12px;border-radius:8px;font-size:12.5px;font-weight:700"><span style="color:#059669;font-size:15px">✓</span> Inclusive of GST and free shipping</div><input type="hidden" name="shipping_rate_id" id="shippingRate" value="inclusive_gst_free_shipping"></div>' : '';
  const cartMarkupWithShipping=cartMarkup.replace('<!--zk-shipping-->', shippingDropdownHtml);
  const cartLogic=`${checkout.razorpay?'<script src="https://checkout.razorpay.com/v1/checkout.js"></script>':''}<script>
  (function(){
  const storeSlug=${JSON.stringify(String(store.slug||''))};
  const storeName=${JSON.stringify(String(store.store_name||'Smeram Naturals'))};
  const storeWhatsapp=${JSON.stringify(String(store.whatsapp_number||store.phone||'919901640727'))};
  const onlineCheckoutButtonText=${JSON.stringify(pb.text)};
  const catalog=${JSON.stringify(allProducts.map(p=>({id:Number(p.id),name:String(p.name),price:Number(p.price),variants:(Array.isArray(p.variants)?p.variants:[]).filter(v=>v&&typeof v==='object'&&v.id&&v.active!==false).map(v=>({id:String(v.id),label:String(v.label||''),price:Number(v.price)}))}))).replace(/</g,'\\u003c')};
  let zkCart=[];let appliedCoupon='';
  try{zkCart=JSON.parse(sessionStorage.getItem('zk_cart')||'[]')}catch(_){}
  const byId=id=>catalog.find(p=>String(p.id)===String(id));
  const variantOf=(p,vid)=>p&&vid?(p.variants||[]).find(v=>v.id===String(vid)):null;
  const unitPrice=item=>{const p=byId(item.product_id),v=variantOf(p,item.variant_id);return v?v.price:(p?p.price:0)};
  const cartSubtotal=()=>zkCart.reduce((n,x)=>n+unitPrice(x)*x.quantity,0);
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
  function updateCheckoutAction(){
    const form=document.getElementById('checkoutForm'),button=document.getElementById('zkPayButton');
    if(!form||!button)return;
    const field=form.elements.payment_method;
    const method=field&&field.value?field.value:'cod';
    button.textContent=method==='cod'?'Confirm Order':onlineCheckoutButtonText;
    button.setAttribute('aria-label',method==='cod'?'Confirm cash on delivery order':onlineCheckoutButtonText);
  }
  function showCheckoutAlert(message,type){
    const alert=document.getElementById('checkoutMessage');
    if(!alert)return;
    alert.dataset.type=type||'error';
    alert.textContent=(type==='info'?'⏳ ':'⚠️ ')+message;
    alert.hidden=false;
  }
  function clearCheckoutAlert(){
    const alert=document.getElementById('checkoutMessage');
    if(alert){alert.hidden=true;alert.textContent=''}
  }
  function setCheckoutFieldError(form,name,message){
    const input=form.elements[name],error=form.querySelector('[data-error-for="'+name+'"]');
    if(input&&input.setAttribute)input.setAttribute('aria-invalid','true');
    if(error)error.textContent=message;
    return input;
  }
  function validateCheckoutForm(form){
    form.querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.zkc-field-error').forEach(el=>el.textContent='');
    clearCheckoutAlert();
    const value=name=>String(form.elements[name]?.value||'').trim();
    const errors=[];
    if(value('name').length<2)errors.push(['name','Enter the customer’s full name.']);
    const phoneDigits=value('phone').replace(/[^0-9]/g,'');
    if(phoneDigits.length<10||phoneDigits.length>15)errors.push(['phone','Enter a valid 10-digit mobile number.']);
    const email=value('email');
    if(email&&(!email.includes('@')||!email.includes('.')))errors.push(['email','Enter a valid email address.']);
    if(value('address').length<8)errors.push(['address','Enter the house / flat, street and area.']);
    if(value('city').length<2)errors.push(['city','Enter the delivery city.']);
    if(value('state').length<2)errors.push(['state','Enter the delivery state.']);
    if(!/^[0-9]{6}$/.test(value('pincode')))errors.push(['pincode','Enter a valid 6-digit PIN code.']);
    if(!value('payment_method'))errors.push(['payment_method','Choose a payment method.']);
    let first=null;
    errors.forEach(([name,message])=>{const input=setCheckoutFieldError(form,name,message);if(!first&&input)first=input});
    if(errors.length){
      showCheckoutAlert('Please check the highlighted shipping details and try again.','error');
      if(first&&first.focus){first.focus();first.scrollIntoView({block:'center',behavior:'smooth'})}
      return false;
    }
    return true;
  }
  function setCheckoutBusy(busy){
    const button=document.getElementById('zkPayButton');
    if(!button)return;
    button.disabled=!!busy;
    button.setAttribute('aria-busy',busy?'true':'false');
    if(!busy)updateCheckoutAction();
  }
  const zkFetch=async(ep,opts)=>{
    const c=ep.indexOf('/api/')===0?ep.slice(5):(ep.indexOf('api/')===0?ep.slice(4):(ep.charAt(0)==='/'?ep.slice(1):ep));
    try{
      const r=await fetch('/api/'+c,opts);
      if(!r.ok&&(r.status===404||r.status===405))return await fetch('api.php?route='+encodeURIComponent(c),opts);
      return r;
    }catch(_){
      return await fetch('api.php?route='+encodeURIComponent(c),opts);
    }
  };
  window.openCheckout=function(e){if(e)e.preventDefault();document.getElementById('cartBackdrop').classList.add('open');drawCart()};
  window.closeCheckout=function(){document.getElementById('cartBackdrop').classList.remove('open')};
  window.openCart=window.openCheckout;window.closeCart=window.closeCheckout;
  window.changeCartQty=function(id,variantId,delta){
    const vid=variantId?String(variantId):null;
    const row=zkCart.find(x=>String(x.product_id)===String(id)&&(x.variant_id||null)===vid);
    if(!row)return;
    row.quantity+=delta;
    if(row.quantity<=0){zkCart=zkCart.filter(x=>!(String(x.product_id)===String(id)&&(x.variant_id||null)===vid))}
    sessionStorage.setItem('zk_cart',JSON.stringify(zkCart));
    drawCart();
  };
  window.showStoreToast=function(msg){
    let t=document.getElementById('zkStoreToast');
    if(!t){
      t=document.createElement('div');t.id='zkStoreToast';
      t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:#0f172a;color:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600';
      document.body.appendChild(t);
    }
    t.innerHTML='<span>✓ '+msg+'</span><button type="button" onclick="openCheckout()" style="background:#22c55e;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-weight:700;cursor:pointer">🛒 View Cart →</button><button type="button" onclick="this.parentNode.remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px">×</button>';
    clearTimeout(t._timer);t._timer=setTimeout(()=>{if(t.parentNode)t.remove()},5000);
  };
  window.addCart=function(id,variantId){
    const p=byId(id);if(!p)return false;
    if((p.variants||[]).length&&!variantOf(p,variantId)){if(window.zkQuickView){window.zkQuickView(Number(id));return false}variantId=p.variants[0].id}
    const vid=variantId?String(variantId):null;
    const row=zkCart.find(x=>String(x.product_id)===String(id)&&(x.variant_id||null)===vid);
    if(row)row.quantity++;else zkCart.push({product_id:Number(id),variant_id:vid,quantity:1});
    sessionStorage.setItem('zk_cart',JSON.stringify(zkCart));
    drawCart();
    ${checkout.show_cart_popup?"window.showStoreToast(p.name+' added to cart');":''}
    openCheckout();
    return true;
  };
  function drawCart(){
    const host=document.getElementById('cartItems');if(!host)return;
    if(typeof host.replaceChildren==='function')host.replaceChildren();else host.innerHTML='';
    if(!zkCart.length){
      const emptyMsg=document.createElement('div');
      emptyMsg.style.cssText='text-align:center;padding:24px 8px;color:#64748b;font-size:14px';
      emptyMsg.innerHTML='Your cart is empty.<br><button type="button" class="button" style="margin-top:10px;font-size:12px;padding:6px 14px" onclick="closeCheckout()">🛍️ Continue Shopping</button>';
      host.append(emptyMsg);
    }
    let sum=0;
    zkCart.forEach(item=>{
      const p=byId(item.product_id);if(!p)return;
      const v=variantOf(p,item.variant_id),price=unitPrice(item);
      sum+=price*item.quantity;
      const row=document.createElement('div');row.className='cart-item';
      row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #eee';
      const leftCol=document.createElement('div');leftCol.style.cssText='flex:1;min-width:0';
      const label=document.createElement('div');label.style.cssText='font-weight:600;font-size:13px;color:#0f172a';
      label.textContent=p.name+(v?' ('+v.label+')':'');
      const unitPr=document.createElement('div');unitPr.style.cssText='font-size:11.5px;color:#64748b;margin-top:2px';
      unitPr.textContent=money(price);
      leftCol.append(label,unitPr);
      const qtyWrap=document.createElement('div');qtyWrap.style.cssText='display:inline-flex;align-items:center;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;background:#fff';
      const minusBtn=document.createElement('button');minusBtn.type='button';minusBtn.textContent='−';minusBtn.title='Decrease quantity';
      minusBtn.style.cssText='border:none;background:#f8fafc;width:26px;height:26px;cursor:pointer;font-weight:800;font-size:14px';
      minusBtn.onclick=function(){window.changeCartQty(item.product_id,item.variant_id,-1)};
      const qtyVal=document.createElement('span');qtyVal.style.cssText='padding:0 8px;font-size:12px;font-weight:700';qtyVal.textContent=item.quantity;
      const plusBtn=document.createElement('button');plusBtn.type='button';plusBtn.textContent='+';plusBtn.title='Increase quantity';
      plusBtn.style.cssText='border:none;background:#f8fafc;width:26px;height:26px;cursor:pointer;font-weight:800;font-size:14px';
      plusBtn.onclick=function(){window.changeCartQty(item.product_id,item.variant_id,1)};
      qtyWrap.append(minusBtn,qtyVal,plusBtn);
      const rightCol=document.createElement('div');rightCol.style.cssText='text-align:right;white-space:nowrap';
      const amount=document.createElement('strong');amount.style.cssText='font-size:13px;color:#0f172a;display:block';
      amount.textContent=money(price*item.quantity);
      const delBtn=document.createElement('button');delBtn.type='button';delBtn.textContent='🗑';delBtn.title='Remove item';
      delBtn.style.cssText='border:none;background:none;cursor:pointer;font-size:13px;color:#94a3b8;padding:2px';
      delBtn.onclick=function(){window.changeCartQty(item.product_id,item.variant_id,-item.quantity)};
      rightCol.append(amount,delBtn);
      row.append(leftCol,qtyWrap,rightCol);
      host.append(row);
    });
    const count=zkCart.reduce((n,x)=>n+Number(x.quantity||0),0);
    document.querySelectorAll('#cart').forEach(el=>el.textContent=String(count));
    document.getElementById('cartSubtotal').textContent=money(sum);
  }
  window.applyCoupon=async function(){
    const code=document.getElementById('couponCode').value.trim(),subtotal=cartSubtotal(),msg=document.getElementById('couponMessage');
    if(!code){appliedCoupon='';msg.textContent='';return}
    try{
      const r=await zkFetch('coupons/validate/'+encodeURIComponent(storeSlug),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,subtotal})});
      const d=await r.json();if(!r.ok||!d.valid)throw Error(d.error||'Coupon is not valid');
      appliedCoupon=d.code;msg.textContent='Discount applied: '+money(d.discount);
    }catch(err){appliedCoupon='';msg.textContent=err.message}
  };
  window.loadShipping=async function(){
    const select=document.getElementById('shippingRate'),form=document.getElementById('checkoutForm'),subtotal=cartSubtotal(),postal=new FormData(form).get('pincode');
    if(!select||select.value==='inclusive_gst_free_shipping')return;
    try{
      const r=await zkFetch('storefront/'+encodeURIComponent(storeSlug)+'/shipping-rates?subtotal='+subtotal+'&postal_code='+encodeURIComponent(postal||''));
      const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load shipping options');
      if(typeof select.replaceChildren==='function')select.replaceChildren(new Option(d.rates.length?'Choose a shipping rate':'No shipping fee configured',''));
      else{select.innerHTML='';select.add(new Option(d.rates.length?'Choose a shipping rate':'No shipping fee configured',''))}
      d.rates.forEach(rate=>select.add(new Option(rate.name+' — '+money(rate.amount)+(rate.estimated_days?' · '+rate.estimated_days:''),rate.id)));
    }catch(err){showCheckoutAlert(err.message,'error')}
  };

  function showOrderConfirmation(order, customerData, paymentMethod, paymentRef, whatsappOptIn) {
    const activeView = document.getElementById('cartActiveView');
    const successView = document.getElementById('orderSuccessView');
    if (activeView) activeView.style.display = 'none';
    if (successView) successView.style.display = 'block';

    const isCod = paymentMethod !== 'Razorpay';
    const statusText = document.getElementById('confStatusText');
    if (statusText) statusText.textContent = isCod ? 'Order Confirmed - Cash on Delivery' : 'Payment Received & Confirmed';
    const amountLabel = document.getElementById('confAmountLabel');
    if (amountLabel) amountLabel.textContent = isCod ? 'Amount due on delivery' : 'Amount paid';

    const orderNum = order.order_number || ('ORD-' + (order.order_id || Date.now()));
    const badgeEl = document.getElementById('confOrderBadge');
    if (badgeEl) badgeEl.textContent = orderNum;

    const totalEl = document.getElementById('confOrderTotal');
    const totalAmt = order.total_amount !== undefined ? order.total_amount : (order.subtotal || 0);
    if (totalEl) totalEl.textContent = money(totalAmt);

    const payEl = document.getElementById('confPaymentMethod');
    if (payEl) {
      payEl.textContent = paymentMethod === 'Razorpay' 
        ? ('Paid Online' + (paymentRef ? ' (' + String(paymentRef).slice(0, 14) + '…)' : ' (Razorpay)'))
        : (paymentMethod || 'Paid');
    }

    const itemsEl = document.getElementById('confOrderItems');
    if (itemsEl) {
      if (zkCart && zkCart.length) {
        itemsEl.innerHTML = zkCart.map(it => {
          const p = byId(it.product_id);
          const v = variantOf(p, it.variant_id);
          const pr = unitPrice(it);
          const name = p ? (p.name + (v ? ' (' + v.label + ')' : '')) : 'Item';
          return '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + it.quantity + '× ' + name + '</span><span style="font-weight:600">' + money(pr * it.quantity) + '</span></div>';
        }).join('');
      } else if (order.items && Array.isArray(order.items)) {
        itemsEl.innerHTML = order.items.map(it => 
          '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>' + it.quantity + '× ' + it.name + '</span><span style="font-weight:600">' + money(it.price * it.quantity) + '</span></div>'
        ).join('');
      }
    }

    const addrEl = document.getElementById('confShippingAddress');
    if (addrEl && customerData) {
      addrEl.innerHTML = '<strong>' + (customerData.name || '') + '</strong> · ' + (customerData.phone || '') + '<br>' + (customerData.address || '') + (customerData.city ? ', ' + customerData.city : '') + (customerData.state ? ' ' + customerData.state : '') + (customerData.pincode ? ' - ' + customerData.pincode : '');
    }

    const invLink = document.getElementById('confInvoiceLink');
    const orderIdParam = order.order_id || order.id;
    const invoiceBackend = window.ZK && window.ZK.backendUrl ? window.ZK.backendUrl.replace(/\\/+$/,'') + '/' : '';
    const invoicePdfUrl = invoiceBackend + 'invoice.php?id=' + encodeURIComponent(orderIdParam) + '&download=1';
    if (invLink) {
      invLink.href = invoicePdfUrl;
      invLink.title = 'Download Official GST Tax Invoice for ' + orderNum;
    }

    const trackingNote = document.getElementById('confTrackingNote');
    if (trackingNote) trackingNote.textContent = whatsappOptIn
      ? '3. Live delivery tracking updates are sent automatically to your WhatsApp.'
      : '3. Delivery tracking will be available after dispatch.';

    zkCart = [];
    appliedCoupon = '';
    try { sessionStorage.removeItem('zk_cart'); } catch (_) {}
    document.querySelectorAll('#cart').forEach(el => el.textContent = '0');

  }

  window.resetAndCloseCheckout = function() {
    const activeView = document.getElementById('cartActiveView');
    const successView = document.getElementById('orderSuccessView');
    if (activeView) activeView.style.display = 'block';
    if (successView) successView.style.display = 'none';
    const form = document.getElementById('checkoutForm');
    if (form) form.reset();
    clearCheckoutAlert();
    setCheckoutBusy(false);
    drawCart();
    closeCheckout();
  };

  window.placeOrder=async function(e){
    e.preventDefault();
    const form=e.target;
    if(!zkCart.length){showCheckoutAlert('Your cart is empty. Add an item before checkout.','error');return}
    if(!validateCheckoutForm(form))return;
    const f=new FormData(form);
    const customerData={name:f.get('name'),email:f.get('email'),phone:f.get('phone'),address:f.get('address'),city:f.get('city'),state:f.get('state'),pincode:f.get('pincode')};
    const address={line1:customerData.address,city:customerData.city,state:customerData.state,pincode:customerData.pincode};
    showCheckoutAlert(f.get('payment_method')==='cod'?'Confirming your order…':'Starting secure payment…','info');
    setCheckoutBusy(true);
    try{
      const whatsappOptIn=f.get('whatsapp_opt_in')==='1';
      const r=await zkFetch('storefront/'+encodeURIComponent(storeSlug)+'/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:{name:customerData.name,email:customerData.email,phone:customerData.phone},address,items:zkCart,payment_method:f.get('payment_method'),coupon_code:appliedCoupon||undefined,shipping_rate_id:f.get('shipping_rate_id')||undefined,whatsapp_opt_in:whatsappOptIn})});
      const order=await r.json();
      if(!r.ok)throw Error(order.error||'Could not create order');
      if(order.next==='confirmed'){
        showOrderConfirmation(order, customerData, 'Cash on Delivery (COD)', '', whatsappOptIn);
        return;
      }
      const pr=await zkFetch('payments/razorpay/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:order.order_id})});
      const paymentOrder=await pr.json();
      if(!pr.ok)throw Error(paymentOrder.error||'Could not start payment');
      const checkout=new Razorpay({
        key:paymentOrder.key,
        amount:paymentOrder.amount,
        currency:paymentOrder.currency,
        name:document.title,
        order_id:paymentOrder.razorpay_order_id,
        prefill:{name:customerData.name,email:customerData.email,contact:customerData.phone},
        handler:async response=>{
          const vr=await zkFetch('payments/razorpay/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...response,order_id:order.order_id})});
          const vd=await vr.json();
          if(!vr.ok){showCheckoutAlert(vd.error||'Payment confirmation is pending. Please retry.','error');setCheckoutBusy(false);return}
          showOrderConfirmation(order, customerData, 'Razorpay', response.razorpay_payment_id, whatsappOptIn);
        },
        modal:{ondismiss:()=>{setCheckoutBusy(false);recordFailure(order.order_id,paymentOrder.razorpay_order_id,'Payment window closed. Retry payment.')}}
      });
      checkout.on('payment.failed',response=>recordFailure(order.order_id,paymentOrder.razorpay_order_id,response.error?.description||'Payment failed. Retry payment.'));
      checkout.open();
      setCheckoutBusy(false);
    }catch(err){setCheckoutBusy(false);showCheckoutAlert(err.message||'Checkout could not be completed. Please try again.','error')}
  };

  async function recordFailure(orderId,paymentId,reason){
    await zkFetch('payments/razorpay/failure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:orderId,razorpay_order_id:paymentId,reason})}).catch(()=>{});
    showCheckoutAlert(reason+' Your cart is saved; submit again to retry.','error');
  }
  function clearCart(){zkCart=[];appliedCoupon='';sessionStorage.removeItem('zk_cart');drawCart()};
  const paymentMethodFields=document.querySelectorAll('#checkoutForm [name="payment_method"]');
  paymentMethodFields.forEach(field=>field.addEventListener('change',updateCheckoutAction));
  document.querySelectorAll('#checkoutForm .zkc-field input').forEach(input=>input.addEventListener('input',()=>{
    input.removeAttribute('aria-invalid');
    const error=document.querySelector('#checkoutForm [data-error-for="'+input.name+'"]');
    if(error)error.textContent='';
    clearCheckoutAlert();
  }));
  updateCheckoutAction();
  drawCart();
  })();
  </script>`;
  const design=designFor(rootConfig);
  if(design)return renderDesign(design,{store,cfg,fields,allProducts:listedProducts,template,product,page,collection:options.collection,pages:snapshot.pages||[],categories:snapshot.categories||[],sec,isVisible,list,escapeHtml,safeImage,safeColor,safeLink,slugify,format,cartMarkup:cartMarkupWithShipping,cartLogic,slug,title,description,showContact:options.showContact,renderBlocks,basePath});
  const footer=sec('footer'),footerImage=safeImage(footer.image||fields.footer_img||footer.background_image),socialHtml=fields.footer_social===false?'':`<div class="social-links">${store.instagram_handle?`<a href="https://instagram.com/${encodeURIComponent(store.instagram_handle.replace(/^@/,''))}" rel="noopener">Instagram</a>`:''}${store.whatsapp_number?`<a href="https://wa.me/${encodeURIComponent(String(store.whatsapp_number).replace(/\D/g,''))}" rel="noopener">WhatsApp</a>`:''}</div>`,creditHtml=fields.footer_zk===false?'':'<small class="zk-credit">Powered by ZKCommerce</small>',footerText=`${escapeHtml(fields.footer_text||'')}${socialHtml}${creditHtml}`;
  const footerHtml=!isVisible('footer')||footer.visible===false||footer.show===false?'':`<footer data-zkc-section="footer" style="background:${safeColor(footer.background||fields.footer_bg,'#17202b')};${footerImage?`background-image:linear-gradient(rgba(0,0,0,.65),rgba(0,0,0,.65)),url('${footerImage}');`:''};color:${safeColor(fields.footer_text_c,'#fff')}"><div>${storeName} · ${escapeHtml(store.tagline||'')}</div><nav>${isVisible('products')?`<a href="${template==='home'?'#products':storeUrl('/#products')}">All Products</a>`:''}${(snapshot.pages||[]).filter(p=>p.status==='published').map(p=>`<a href="${storeUrl('/page/'+encodeURIComponent(p.slug))}">${escapeHtml(p.title)}</a>`).join('')}</nav>${footerText}</footer>`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}">${product&&product.unlisted?'<meta name="robots" content="noindex,nofollow">':''}<style>*{box-sizing:border-box}body{margin:0;font:16px ${font},Arial,sans-serif;background:${background};color:#17202b}header{min-height:68px;padding:8px max(5%,calc((100% - 1180px)/2));display:flex;align-items:center;justify-content:space-between;background:#fff;position:sticky;top:0;z-index:2;border-bottom:1px solid #eee}.brand{font-size:22px;font-weight:800;text-decoration:none;color:${primary};display:flex;align-items:center;gap:10px}.brand img{max-height:44px;max-width:180px;object-fit:contain}.main-nav{display:flex;gap:16px}.main-nav a,.product-link{color:inherit;text-decoration:none}.cart-link{color:${primary};text-decoration:none;font-weight:700}.button,.buy,.contact button,.notify button{border:0;border-radius:${clamp(fields.button_radius,0,40,8)}px;background:${safeColor(fields.button_color,primary)};color:${safeColor(fields.button_text_color,'#fff')};padding:12px 20px;text-decoration:none;font-weight:700;cursor:pointer}.hero{min-height:${clamp(fields.hero_min_height,280,800,420)}px;display:flex;align-items:center;background-position:center;background-size:cover;color:#fff}.hero>div{max-width:720px}.hero h1{font-family:${headingFont},${font},sans-serif;line-height:1.05;margin:8px 0 16px}.hero p{line-height:1.7;max-width:560px}.eyebrow{letter-spacing:.12em;text-transform:uppercase}.announce{text-align:center;padding:9px 16px;background-size:cover;background-position:center}.slider{display:flex;overflow:auto;gap:12px;padding:18px}.slider img{height:300px;min-width:min(80vw,650px);object-fit:cover;border-radius:12px}.offer{text-align:center;padding:38px 18px}.section-heading{text-align:center;margin:0 auto 28px;max-width:760px}.section-heading h2{font-size:clamp(26px,4vw,38px);margin:0 0 8px}.trust{padding:16px 5%;display:flex;justify-content:center;gap:28px;flex-wrap:wrap}.content-section{padding:clamp(32px,6vw,70px) max(5%,calc((100% - 1180px)/2))}.benefits,.review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.benefit,blockquote{padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0}.ingredients ul,.howtouse ul{max-width:760px;margin:auto;line-height:2}.gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.gallery-grid img{width:100%;height:240px;object-fit:cover;border-radius:12px}.products{max-width:1180px;margin:auto;padding:58px 24px}.products h2{font-size:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}.card{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}.product-image{height:240px;background:#f5f6f7;display:grid;place-items:center;color:#64748b}.product-image img{width:100%;height:100%;object-fit:cover}.product-body{padding:18px}.product-body h3{margin:0 0 8px}.description{color:#64748b;min-height:24px}.price{font-size:21px;font-weight:800;color:${safeColor(fields.price_color,primary)};margin:14px 0}.price del{font-size:13px;color:#888;margin-left:6px}.buy{width:100%}.notify{display:flex;gap:6px}.notify input{min-width:0;width:100%;padding:10px;border:1px solid #ddd;border-radius:7px}.footer-above{padding:42px;text-align:center;background-position:center;background-size:cover}footer{padding:36px 5%;text-align:center;background-position:center;background-size:cover}footer nav{display:flex;justify-content:center;gap:18px;padding:16px;flex-wrap:wrap}footer a{color:inherit}.page-content{max-width:850px;min-height:55vh;margin:auto;padding:70px 24px;line-height:1.8}.contact{max-width:620px;margin:0 auto 64px;padding:24px;display:grid;gap:10px}.contact input,.contact textarea{padding:12px;border:1px solid #ddd;border-radius:8px;font:inherit}.product-detail{max-width:1180px;margin:auto;padding:60px 24px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}.detail-image img{width:100%;max-height:680px;object-fit:contain}.detail-image{min-height:300px;background:#f8fafc;border-radius:16px}.product-detail h1{font-size:clamp(32px,5vw,52px)}[data-zkc-section]{transition:outline .15s,outline-offset .15s}.zkc-editor-selected{outline:3px solid #5b8cff!important;outline-offset:-3px;cursor:pointer}@media(max-width:650px){.main-nav{display:none}.hero{min-height:${clamp(fields.hero_mobile_height,260,600,360)}px}.hero>div{max-width:100%}.slider img{height:220px}.product-detail{grid-template-columns:1fr;gap:20px;padding:30px 18px}.product-detail h1{font-size:${clamp(fields.product_mobile_heading,26,44,32)}px}.content-section{padding:36px 20px}}</style></head><body>${announcement()}${nav()}${content}${above}${footerHtml}<script>let cart=0;function addCart(){cart++;const el=document.getElementById('cart');if(el)el.textContent=cart}async function contactStore(e){e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const r=await fetch('/api/notify/${slug}/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});alert(r.ok?'Message sent':'Could not send message');return false}async function notifyMe(e,label){e.preventDefault();const email=e.target.querySelector('input').value;const r=await fetch('/api/notify/${slug}/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,product_label:label})});alert(r.ok?'We will notify you':'Could not save request');return false}</script></body></html>`;
  const editorStyles=`<style>.card{background:${safeColor(fields.prod_bg,'#fff')}}.price{color:${safeColor(fields.prod_price_c,primary)}}.buy,.button{background:${safeColor(fields.prod_cta_c||fields.button_color,primary)};border-radius:${clamp(fields.button_radius,0,32,8)}px}.content-section{padding:${clamp(fields.section_spacing,24,100,58)}px max(5%,calc((100% - 1180px)/2))}.products{padding:${clamp(fields.section_spacing,24,100,58)}px 24px}${fields.nav_cart_show===false?'.cart-link{display:none}':''}${fields.prod_compare_show===false?'.price del{display:none}':''}.social-links{display:flex;justify-content:center;gap:16px;margin:12px}.zk-credit{display:block;margin-top:10px;opacity:.7}.cart-backdrop{display:none;position:fixed;inset:0;background:#0008;z-index:20;justify-content:flex-end}.cart-backdrop.open{display:flex}.cart-panel{position:relative;background:#fff;color:#17202b;width:min(480px,100%);height:100%;overflow:auto;padding:28px;box-shadow:0 0 35px #0003}.cart-close{float:right;border:0;background:none;font-size:28px;cursor:pointer}.cart-item{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.cart-total{display:flex;justify-content:space-between;font-size:18px}.coupon-row{display:flex;gap:8px}.coupon-row input,#checkoutForm input:not([type="radio"]),#checkoutForm select{min-width:0;width:100%;padding:11px;border:1px solid #d1d5db;border-radius:7px;margin:5px 0}.coupon-row button{border:0;border-radius:7px;padding:0 15px}.cart-panel form{display:grid;gap:4px;margin-top:14px}.payment-methods{display:grid;gap:8px;border:0;padding:0;margin:10px 0}.payment-methods legend{font-size:12px;font-weight:800;color:#475569;margin-bottom:2px}.payment-method{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1.5px solid #cbd5e1;border-radius:9px;cursor:pointer;background:#fff}.payment-method:has(input:checked){border-color:${primary};box-shadow:0 0 0 2px ${primary}20;background:${primary}08}.payment-method input{width:18px;height:18px;margin:0;accent-color:${primary};flex:0 0 auto}.payment-method span{display:grid;gap:2px}.payment-method strong{font-size:13px}.payment-method small{font-size:11.5px;color:#64748b}.cart-panel #checkoutMessage,.cart-panel #couponMessage{color:#b45309;min-height:22px}</style>`;
  const htmlWithCheckout=html.replace('</body></html>',`${cartMarkupWithShipping}${cartLogic}</body></html>`);
  const themeStyles=`<style>.theme-studio .card{border-radius:8px;box-shadow:0 2px 12px #17202b0b}.theme-botanical .card,.theme-botanical .benefit,.theme-botanical blockquote{border-radius:18px}.theme-botanical .section-heading h2,.theme-atelier .section-heading h2{font-family:${headingFont},Georgia,serif}.theme-atelier .main-nav{text-transform:uppercase;letter-spacing:.08em;font-size:12px}.theme-atelier .card{border:0;border-radius:0;background:transparent!important}.theme-atelier .product-image{height:340px}.theme-market .products{max-width:1320px}.theme-market .grid{grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}.theme-market .product-image{height:210px}.theme-playful .card,.theme-playful .benefit,.theme-playful blockquote{border-radius:24px}.theme-playful .buy,.theme-playful .button{border-radius:999px}.theme-tech .card{border-radius:8px;box-shadow:0 4px 18px #10243a12}.design-smeram .brand,.design-smeram .cart-link,.design-smeram .price{color:${primary}}.design-smeram .hero h1,.design-smeram .section-heading h2{font-family:${headingFont},'Playfair Display',Georgia,serif}.design-smeram .announce{letter-spacing:.035em}.design-smeram .card{border-color:${accent}66}.design-miliro .brand,.design-miliro .cart-link,.design-miliro .price{color:${primary}}.design-miliro .hero h1,.design-miliro .section-heading h2{font-family:${headingFont},'Playfair Display',Georgia,serif}.design-miliro .card{border-color:${primary}30}.cart-link{display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid currentColor;border-radius:999px}.cart-link #cart{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:${primary};color:#fff;font-size:11px}.${darkTheme?`body.theme-${stylePreset}{color:#EAF1FA}.theme-${stylePreset} header{background:${darkSurface}!important;color:#EAF1FA;border-color:${darkBorder}!important}.theme-${stylePreset} .main-nav a,.theme-${stylePreset} .product-link{color:inherit}.theme-${stylePreset} .benefit,.theme-${stylePreset} blockquote,.theme-${stylePreset} .card{background:${darkSurface}!important;color:#EAF1FA;border-color:${darkBorder}!important}.theme-${stylePreset} .description,.theme-${stylePreset} .product-image{color:#B7C7DA}.theme-${stylePreset} .product-image,.theme-${stylePreset} .detail-image{background:#102A48}.theme-${stylePreset} .product-detail{color:#EAF1FA;background:${darkSurface}!important}.theme-${stylePreset} .content-section{background:${darkSurface}!important}.theme-${stylePreset} .cart-panel{background:${darkSurface};color:#EAF1FA}.theme-${stylePreset} .cart-item{border-color:${darkBorder}}.theme-${stylePreset} .cart-close{color:#EAF1FA}.theme-${stylePreset} .coupon-row input,.theme-${stylePreset} #checkoutForm input,.theme-${stylePreset} #checkoutForm select{background:#102A48;color:#EAF1FA;border-color:${darkBorder}}.theme-${stylePreset} .contact input,.theme-${stylePreset} .contact textarea{background:#102A48;color:#EAF1FA;border-color:${darkBorder}}.theme-${stylePreset} .page-content{color:#EAF1FA}`:''}</style>`;
  return htmlWithCheckout.replace('<body>','<body class="theme-'+stylePreset+' '+designClass+'">').replace('<style>*{','<style>@import url(https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&display=swap);*{').replace('</head>',`${editorStyles}${themeStyles}</head>`);
}

module.exports={renderStore,escapeHtml};
