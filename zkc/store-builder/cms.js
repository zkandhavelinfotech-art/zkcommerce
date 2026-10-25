/* API-backed Store Builder for v4.2. */
var defaultApi = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && location.port && location.port !== '3000'
  ? `${location.protocol}//${location.hostname}:3000/api` : '/api';
var API_BASE = (new URLSearchParams(location.search).get('apiBase') || window.ZK_API_BASE || defaultApi).replace(/\/$/, '');
var TOKEN = localStorage.getItem('zk_token') || '';
var storeRecords = [], activeStore = null, activeStoreId = null, draftFields = {}, previewUrl = '';
var currentProductId = null;
var currentPageId = null;
var previewRefreshTimer = null;
var currentTemplate = 'home';
var templateFields = {};
var sectionFieldDefaults = null;
products = [];
pages = [];

async function api(path, options) {
  options = options || {};
  options.headers = Object.assign({ Authorization: 'Bearer ' + TOKEN }, options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(API_BASE + path, options);
  if ((options.headers.Accept || '').includes('text/html')) {
    const html = await response.text();
    if (!response.ok) throw new Error(html || 'Request failed');
    return html;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function safeText(value) {
  const el = document.createElement('span');
  el.textContent = value == null ? '' : String(value);
  return el.innerHTML;
}

function hydrateFields(source) {
  if(!sectionFieldDefaults){sectionFieldDefaults={};Object.keys(sectionConfigs).forEach(section=>sectionConfigs[section].fields.forEach(field=>{sectionFieldDefaults[field.key]=field.val;}));}
  const fields=Object.assign({},source||{});
  Object.keys(sectionConfigs).forEach(section=>sectionConfigs[section].fields.forEach(field=>{
    if(Object.prototype.hasOwnProperty.call(fields,field.key))field.val=fields[field.key];
    else {fields[field.key]=sectionFieldDefaults[field.key];field.val=sectionFieldDefaults[field.key];}
  }));
  return fields;
}

function friendlyProduct(p) {
  return Object.assign({}, p, {
    compare: p.compare_price || 0, status: p.active ? 'active' : 'draft',
    stock: p.in_stock ? 'in_stock' : 'out_of_stock', cat: p.category_name || '',
    img: Array.isArray(p.images) && p.images[0] ? p.images[0] : '', desc: p.description || ''
  });
}

async function bootstrapStores() {
  if (!TOKEN) {
    showToast('Please sign in first. Redirecting to login…');
    setTimeout(() => { location.href = '../auth/login.html'; }, 900);
    return;
  }
  try {
    const data = await api('/stores');
    storeRecords = data.stores || [];
    const select = document.getElementById('storeSelect');
    select.innerHTML = '';
    storeRecords.forEach(store => {
      const option = document.createElement('option');
      option.value = String(store.id);
      option.textContent = store.store_name;
      select.appendChild(option);
    });
    if (!storeRecords.length) return showToast('Create a store before opening the builder.');
    await switchStore(String(storeRecords[0].id));
  } catch (error) { showToast(error.message); }
}

async function switchStore(value) {
  activeStoreId = Number(value);
  activeStore = storeRecords.find(store => store.id === activeStoreId);
  if (!activeStore) return;
  currentStore = String(activeStoreId);
  const domain = activeStore.custom_domain || `${activeStore.slug}.zkcommerce.in`;
  storeDomains[currentStore] = domain;
  const badge = document.getElementById('storeBadge');
  badge.className = 'store-badge badge-' + (activeStore.status === 'live' ? 'live' : activeStore.status === 'published' ? 'published' : 'draft');
  badge.textContent = '● ' + activeStore.status;
  document.getElementById('storeUrl').textContent = domain;
  document.getElementById('domainRow').textContent = domain;
  document.getElementById('statusVal').textContent = '● ' + activeStore.status;
  try {
    const data = await api(`/stores/${activeStoreId}/builder`);
    activeStore = data.store;
    products = (data.products || []).map(friendlyProduct);
    populateTemplateSelectors();
    pages = data.pages || [];
    renderPageNavigation();
    templateFields = Object.assign({}, (data.store.theme_config || {}).templates || {});
    templateFields.page_overrides=Object.assign({},(data.store.theme_config||{}).page_templates||{});
    currentTemplate = 'home';
    draftFields = hydrateFields((templateFields.home || {}).fields || (data.store.theme_config || {}).fields || {});
    if (!draftFields.slider_urls && draftFields.slider_images) draftFields.slider_urls=draftFields.slider_images.join(', ');
    Object.keys(sectionConfigs).forEach(section => sectionConfigs[section].fields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(draftFields, field.key)) field.val = draftFields[field.key];
    }));
    [['set-name','store_name'],['set-tagline','tagline'],['set-slug','slug'],['set-domain','custom_domain'],['set-wa','whatsapp_number'],['set-ig','instagram_handle']]
      .forEach(([id,key]) => { const el=document.getElementById(id); if(el) el.value=data.store[key]||''; });
    document.getElementById('set-title').value=(data.store.theme_config||{}).meta_title||data.store.store_name;
    document.getElementById('set-desc').value=(data.store.theme_config||{}).meta_description||data.store.hero_subtext||'';
    renderProducts(); renderPages();
    initSectionManager();
    renderSrBody(sectionConfigs[currentSection] || defaultConfig, currentTab);
    await refreshPreview();
  } catch (error) { showToast(error.message); }
}

async function refreshPreview() {
  if (!activeStoreId) return;
  clearTimeout(previewRefreshTimer);
  try {
    let path = `/stores/${activeStoreId}/preview?format=html&template=${encodeURIComponent(currentTemplate)}&theme_config=${encodeURIComponent(JSON.stringify(buildConfig()))}`;
    if (currentPageId) path += `&page_id=${encodeURIComponent(currentPageId)}`;
    if(currentTemplate==='product'&&document.getElementById('previewProductSelect').value)path+=`&product_id=${encodeURIComponent(document.getElementById('previewProductSelect').value)}`;
    if(currentTemplate==='collection'&&document.getElementById('previewCollectionSelect').value)path+=`&collection=${encodeURIComponent(document.getElementById('previewCollectionSelect').value)}`;
    let html = await api(path, { headers: { Accept: 'text/html' } });
    const apiOrigin = new URL(API_BASE, location.href).origin;
    const apiRoot = new URL(API_BASE, location.href).href.replace(/\/$/, '');
    html = html.replace(/(["'(])\/assets\//g, '$1' + apiOrigin + '/assets/');
    html = html.replace(/fetch\('\/api\//g, "fetch('" + apiRoot + '/');
    html = html.replace('</head>', '<style>[data-zkc-section]{transition:outline .15s,outline-offset .15s;cursor:pointer}.zkc-editor-selected{outline:3px solid #5b8cff!important;outline-offset:-3px}</style></head>');
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const frame = document.getElementById('previewFrame');
    frame.onload = () => { bindPreviewInspector(); focusPreviewSection(currentSection, false); };
    frame.src = previewUrl;
  } catch (error) { showToast('Preview: ' + error.message); }
}

function liveUpdate(key, value) {
  draftFields[key] = value;
  if (key === 'slider_urls') draftFields.slider_images=String(value||'').split(',').map(url=>url.trim()).filter(url=>/^https:\/\//i.test(url));
  if (key === 'gallery_urls') draftFields.gallery_images=String(value||'').split(/\n|,/).map(url=>url.trim()).filter(url=>/^https:\/\//i.test(url));
  Object.keys(sectionConfigs).forEach(section => sectionConfigs[section].fields.forEach(field => {
    if (field.key === key) field.val = value;
  }));
  schedulePreviewRefresh();
}
function updateField(key, value) { liveUpdate(key, value); }
function updateColour(key, input) {
  input.parentElement.style.background = input.value;
  const hex = document.getElementById('hex_' + key);
  if (hex) hex.value = input.value.toUpperCase();
  liveUpdate(key, input.value);
}
function applyHex(key, value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) liveUpdate(key, value);
  else showToast('Enter a valid hex color such as #1688E8');
}
function resetField(key) {
  delete draftFields[key];
  Object.keys(sectionConfigs).forEach(section => sectionConfigs[section].fields.forEach(field => {
    if (field.key === key) field.val = field.type === 'toggle' ? false : '';
  }));
  renderSrBody(sectionConfigs[currentSection] || defaultConfig, currentTab);
  schedulePreviewRefresh();
}
function selectFont(key, font, element) {
  document.querySelectorAll('.font-opt').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected'); liveUpdate(key, font);
}

async function uploadFile(file, scope) {
  const form = new FormData(); form.append('file', file); form.append('scope', scope);
  return (await api(`/upload/${activeStoreId}`, { method:'POST', body:form })).url;
}
async function handleImgUpload(key, input) {
  if (!input.files || !input.files[0]) return;
  try {
    liveUpdate(key, await uploadFile(input.files[0], key));
    renderSrBody(sectionConfigs[currentSection] || defaultConfig, currentTab);
    await refreshPreview();
    showToast('Image uploaded and preview updated. Save draft to keep this change.');
  }
  catch (error) { showToast(error.message); }
}
async function handleMultiImgUpload(key,input) {
  if(!input.files?.length)return;
  const urls=Array.isArray(draftFields[key])?draftFields[key].slice():[];
  try {
    for(const file of Array.from(input.files).slice(0,10-urls.length))urls.push(await uploadFile(file,key));
    liveUpdate(key,urls);
    if(key==='slider_images')draftFields.slider_urls=urls.join(', ');
    renderSrBody(sectionConfigs[currentSection]||defaultConfig,currentTab);
    await refreshPreview();
    showToast(`${urls.length} image(s) ready in preview. Save draft to keep changes.`);
  } catch(error){showToast(error.message);}
}
function applyTheme(name) {
  const theme = themes[name]; if (!theme) return;
  draftFields.primary_colour = theme.primary; draftFields.bg_colour = theme.bg;
  draftFields.accent_colour = theme.accent; draftFields.hero_bg = theme.hero_bg;
  schedulePreviewRefresh();
  showToast('Theme applied to draft. Save to keep it.');
}

async function refreshProducts() {
  const data = await api(`/products?store_id=${activeStoreId}&limit=100`);
  products = (data.products || []).map(friendlyProduct); renderProducts(); populateTemplateSelectors(); await refreshPreview();
}
function getCurrentProducts() { return products; }
function renderProducts() {
  const html = products.map(p => `<tr><td>${p.img ? `<img class="prod-img" src="${safeText(p.img)}" alt="">` : '<div class="prod-img">🛍️</div>'}</td><td><div class="prod-name-cell"><div class="pn">${safeText(p.name)}</div><div class="ps">${safeText(p.sku||'')}</div></div></td><td><div class="prod-price-cell">₹${Number(p.price).toLocaleString('en-IN')}</div><div class="prod-compare">${p.compare?'₹'+p.compare:''}</div></td><td><div class="prod-status ${p.active?'ps-active':'ps-draft'}">${p.active?'Active':'Draft'}</div></td><td>${p.in_stock?'In stock':'Out of stock'}</td><td><div class="prod-actions"><button class="pa-btn pa-edit" onclick="editProduct(${p.id})">Edit</button><button class="pa-btn pa-del" onclick="deleteProduct(${p.id})">Del</button></div></td></tr>`).join('');
  document.getElementById('prodTableBody').innerHTML = html || '<tr><td colspan="6">No products yet.</td></tr>';
}
function filterProducts(query) {
  const matches = products.filter(p => p.name.toLowerCase().includes(String(query||'').toLowerCase()));
  const saved=products; products=matches; renderProducts(); products=saved;
}
function openProdModal() {
  currentProductId=null; document.getElementById('modalTitle').textContent='Add New Product';
  ['pm-name','pm-price','pm-compare','pm-sku','pm-desc','pm-ingr','pm-variants'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('prodImgPreviews').innerHTML=''; document.getElementById('prodModal').classList.add('open');
}
function editProduct(id) {
  const p=products.find(item=>item.id===id); if(!p)return; currentProductId=id;
  document.getElementById('modalTitle').textContent='Edit '+p.name;
  document.getElementById('pm-name').value=p.name;document.getElementById('pm-price').value=p.price;
  document.getElementById('pm-compare').value=p.compare_price||'';document.getElementById('pm-sku').value=p.sku||'';
  document.getElementById('pm-desc').value=p.description||'';document.getElementById('pm-ingr').value=p.ingredients||'';document.getElementById('pm-variants').value=Array.isArray(p.variants)?p.variants.map(v=>typeof v==='string'?v:v.name).join(', '):'';
  document.getElementById('pm-stock').value=p.in_stock?'in_stock':'out_of_stock';document.getElementById('pm-status').value=p.active?'active':'draft';
  document.getElementById('prodImgPreviews').innerHTML=(p.images||[]).map(url=>`<img class="img-thumb" src="${safeText(url)}" alt="">`).join('');
  document.getElementById('prodModal').classList.add('open');
}
async function deleteProduct(id) {
  if(!confirm('Archive this product?'))return;
  try{await api(`/products/${id}?store_id=${activeStoreId}`,{method:'DELETE'});await refreshProducts();showToast('Product archived.');}
  catch(error){showToast(error.message);}
}
async function saveProduct() {
  const name=document.getElementById('pm-name').value.trim(),price=Number(document.getElementById('pm-price').value);
  if(!name||!Number.isFinite(price)||price<0)return showToast('Enter a product name and valid price.');
  const images=Array.from(document.querySelectorAll('#prodImgPreviews img')).map(img=>img.getAttribute('src')||img.src).filter(url=>/^https:\/\//i.test(url)||url.startsWith('/assets/'));
  const variants=document.getElementById('pm-variants').value.split(',').map(value=>value.trim()).filter(Boolean);
  const body={store_id:activeStoreId,name,sku:document.getElementById('pm-sku').value,price,compare_price:Number(document.getElementById('pm-compare').value)||null,description:document.getElementById('pm-desc').value,ingredients:document.getElementById('pm-ingr').value,variants,images,in_stock:document.getElementById('pm-stock').value==='in_stock',active:document.getElementById('pm-status').value==='active',featured:false};
  try{if(currentProductId)await api(`/products/${currentProductId}?store_id=${activeStoreId}`,{method:'PUT',body});else await api('/products',{method:'POST',body});closeProdModal();await refreshProducts();showToast('Product saved. Publish to make it live.');}
  catch(error){showToast(error.message);}
}
async function handleProdImages(event) {
  const files=Array.from(event.target.files||[]).slice(0,10),wrap=document.getElementById('prodImgPreviews');
  for(const file of files){try{const url=await uploadFile(file,'products');const img=document.createElement('img');img.src=url;img.className='img-thumb';wrap.appendChild(img);}catch(error){showToast(error.message);return;}}
}

function renderPages() {
  document.getElementById('pagesList').innerHTML=pages.map(p=>`<div class="page-item"><div class="pi-icon">📄</div><div style="flex:1"><div class="pi-name">${safeText(p.title)}</div><div class="pi-slug">/page/${safeText(p.slug)}</div></div><div class="pi-status ${p.status==='published'?'ps-active':'ps-draft'}">${safeText(p.status)}</div><button class="pa-btn pa-edit" onclick="openPageInBuilder(${p.id})">Open</button><button class="pa-btn pa-edit" onclick="editPage(${p.id})">Edit</button><button class="pa-btn pa-del" onclick="deletePage(${p.id})">Del</button></div>`).join('')||'<p>No pages yet.</p>';
  renderPageNavigation();
}
async function reloadPages(){pages=(await api(`/stores/${activeStoreId}/pages`)).pages;renderPages();await refreshPreview();}
async function addPage(){const title=prompt('Page title');if(!title)return;const slug=prompt('Page slug (letters, numbers, hyphens)',title.toLowerCase().replace(/[^a-z0-9]+/g,'-'));if(!slug)return;const body=prompt('Page content');try{await api(`/stores/${activeStoreId}/pages`,{method:'POST',body:{title,slug,content:{body:body||''},status:'draft'}});await reloadPages();showToast('Draft page created.');}catch(error){showToast(error.message);}}
async function editPage(id){const page=pages.find(p=>p.id===id);if(!page)return;const title=prompt('Page title',page.title);if(title===null)return;const body=prompt('Page content',(page.content||{}).body||'');if(body===null)return;const status=confirm('Include this page in the next published storefront?')?'published':'draft';try{await api(`/stores/${activeStoreId}/pages/${id}`,{method:'PUT',body:{title,content:{body},status}});await reloadPages();}catch(error){showToast(error.message);}}
async function deletePage(id){if(!confirm('Delete this page?'))return;try{await api(`/stores/${activeStoreId}/pages/${id}`,{method:'DELETE'});await reloadPages();}catch(error){showToast(error.message);}}

function renderPageNavigation() {
  const host = document.getElementById('builderPageList');
  if (!host) return;
  host.innerHTML = `<button class="sl-item ${currentTemplate==='home' ? 'active' : ''}" onclick="selectEditorPage(null)"><span class="icon">⌂</span>Home page</button>` +
    pages.map(page => `<button class="sl-item ${String(currentPageId)===String(page.id)?'active':''}" onclick="selectEditorPage(${Number(page.id)})"><span class="icon">📄</span>${safeText(page.title)}</button>`).join('');
}
function saveCurrentTemplateDraft(){
  const value={fields:Object.assign({},draftFields),sections:sectionConfigFromFields(draftFields),primary_colour:draftFields.primary_colour,bg_colour:draftFields.bg_colour,accent_colour:draftFields.accent_colour,logo_url:draftFields.nav_logo,body_font:draftFields.body_font,section_order:draftFields.section_order||[],hidden_sections:draftFields.hidden_sections||[],removed_sections:draftFields.removed_sections||[]};
  if(currentTemplate==='page'&&currentPageId){templateFields.page_overrides=templateFields.page_overrides||{};templateFields.page_overrides[currentPageId]=value;}
  else templateFields[currentTemplate]=value;
}
async function selectEditorPage(id) {
  saveCurrentTemplateDraft();
  currentPageId = id ? Number(id) : null;
  currentTemplate=id?'page':'home';
  const selectedPageConfig=currentPageId&&templateFields.page_overrides?templateFields.page_overrides[currentPageId]:null;
  draftFields=hydrateFields((selectedPageConfig||templateFields[currentTemplate]||{}).fields||(currentTemplate==='home'?(activeStore?.theme_config||{}).fields||{}:{}));
  document.getElementById('templateSelect').value=currentTemplate;
  document.getElementById('previewProductSelect').style.display='none';document.getElementById('previewCollectionSelect').style.display='none';
  currentSection = currentPageId ? 'page_content' : 'announcement';
  renderPageNavigation();
  document.querySelectorAll('#leftSidebar .section-nav .sl-item').forEach(el => el.classList.toggle('active', el.dataset.section === currentSection));
  if (currentPageId) {
    const page = pages.find(item => Number(item.id) === currentPageId);
    document.getElementById('srIcon').textContent = '📄';
    document.getElementById('srTitle').textContent = page ? page.title : 'Page content';
    document.getElementById('srSub').textContent = 'Edit this page';
    currentTab = 'content';
    renderPageContentFields(page);
  } else {
    selectSection('announcement','Announcement Bar',document.querySelector('[data-section="announcement"]'));
  }
  await refreshPreview();
}
function renderPageContentFields(page) {
  if (!page) return;
  const content = page.content || {};
  document.getElementById('srBody').innerHTML = `<div class="prop-row"><div class="prop-label"><span>Page title</span></div><input id="page-title-field" class="prop-input" value="${safeText(page.title)}"></div><div class="prop-row"><div class="prop-label"><span>Page content</span></div><textarea id="page-body-field" class="prop-input prop-textarea" rows="12">${safeText(content.body || content.text || '')}</textarea></div><button class="tb-btn btn-save" onclick="saveCurrentPage()">Save page draft</button>`;
}
async function saveCurrentPage() {
  const page = pages.find(item => Number(item.id) === Number(currentPageId));
  if (!page) return;
  try {
    await api(`/stores/${activeStoreId}/pages/${page.id}`, {method:'PUT', body:{title:document.getElementById('page-title-field').value,content:{body:document.getElementById('page-body-field').value},status:'draft'}});
    await reloadPages();
    await refreshPreview();
    showToast('Page draft saved. Publish the store to make it live.');
  } catch (error) { showToast(error.message); }
}
function openPageInBuilder(id) { switchView('theme', document.getElementById('vb-theme')); selectEditorPage(id); }
function changeTemplate(template) {
  if(!['home','product','collection','page'].includes(template))return;
  saveCurrentTemplateDraft();
  currentTemplate=template;
  currentPageId=template==='page'&&pages.length?Number(pages[0].id):null;
  const selectedPageConfig=currentPageId&&templateFields.page_overrides?templateFields.page_overrides[currentPageId]:null;
  draftFields=hydrateFields((selectedPageConfig||templateFields[template]||{}).fields||(template==='home'?(activeStore?.theme_config||{}).fields||{}:{}));
  Object.keys(sectionConfigs).forEach(section=>sectionConfigs[section].fields.forEach(field=>{if(Object.prototype.hasOwnProperty.call(draftFields,field.key))field.val=draftFields[field.key];}));
  document.getElementById('templateSelect').value=template;
  document.getElementById('previewProductSelect').style.display=template==='product'?'':'none';
  document.getElementById('previewCollectionSelect').style.display=template==='collection'?'':'none';
  currentSection=currentPageId?'page_content':(template==='product'||template==='collection'?'product':'hero');
  if(currentPageId)renderPageContentFields(pages.find(page=>Number(page.id)===currentPageId));
  else selectSection(currentSection,sectionConfigs[currentSection]?.title,document.querySelector(`[data-section="${currentSection}"]`));
  renderPageNavigation();refreshPreview();
}
function populateTemplateSelectors(){
  const productSelect=document.getElementById('previewProductSelect'),collectionSelect=document.getElementById('previewCollectionSelect');
  if(productSelect)productSelect.innerHTML=products.map(product=>`<option value="${Number(product.id)}">${safeText(product.name)}</option>`).join('');
  if(collectionSelect){const cats=[...new Set(products.map(product=>product.cat).filter(Boolean))];collectionSelect.innerHTML='<option value="">All products</option>'+cats.map(cat=>`<option value="${safeText(cat)}">${safeText(cat)}</option>`).join('');}
}
function schedulePreviewRefresh() {
  clearTimeout(previewRefreshTimer);
  previewRefreshTimer = setTimeout(() => refreshPreview(), 300);
}
function previewTargetKey(key) { if(key==='product')return currentTemplate==='product'?'product':'products';return ({nav:'navigation',footer_above:'footer_above',page_content:'page_content'})[key] || key; }
function focusPreviewSection(key, scroll=true) {
  const frame = document.getElementById('previewFrame');
  try {
    const doc = frame.contentDocument;
    doc.querySelectorAll('[data-zkc-section].zkc-editor-selected').forEach(el => el.classList.remove('zkc-editor-selected'));
    const target = doc.querySelector(`[data-zkc-section="${previewTargetKey(key)}"]`);
    if (!target) return;
    target.classList.add('zkc-editor-selected');
    if (scroll) target.scrollIntoView({behavior:'smooth',block:'center'});
  } catch (_) {}
}
function bindPreviewInspector() {
  const frame = document.getElementById('previewFrame');
  try {
    const doc = frame.contentDocument;
    if (!doc || doc.__zkcInspectorBound) return;
    doc.__zkcInspectorBound = true;
    doc.addEventListener('click', event => {
      const target = event.target.closest('[data-zkc-section]');
      if (!target) return;
      event.preventDefault();
      const key = ({announcement:'announcement',navigation:'nav',hero:'hero',slider:'slider',offers:'offers',products:'product',footer_above:'footer_above',footer:'footer',page_content:'page_content'})[target.dataset.zkcSection];
      const item = document.querySelector(`#leftSidebar [data-section="${key}"]`);
      if (key === 'page_content') { focusPreviewSection(key); return; }
      if (item) selectSection(key, item.textContent.trim(), item);
    });
  } catch (_) {}
}
function selectSection(key, label, el) {
  currentSection = key;
  document.querySelectorAll('#leftSidebar .section-nav .sl-item').forEach(item => item.classList.toggle('active', item === el));
  const cfg = sectionConfigs[key] || defaultConfig;
  document.getElementById('srIcon').textContent = cfg.icon || '⚙️';
  document.getElementById('srTitle').textContent = cfg.title || label || key;
  document.getElementById('srSub').textContent = 'Edit section content & style';
  currentTab = 'content';
  document.querySelectorAll('.sr-tab').forEach((tab,i) => tab.classList.toggle('active',i===0));
  renderSrBody(cfg, 'content');
  addSectionManagementControls();
  focusPreviewSection(key);
}
function srTab(tab,el){
  currentTab=tab;
  document.querySelectorAll('.sr-tab').forEach(item=>item.classList.toggle('active',item===el));
  if(currentSection==='page_content'){renderPageContentFields(pages.find(page=>Number(page.id)===Number(currentPageId)));return;}
  renderSrBody(sectionConfigs[currentSection]||defaultConfig,tab);
  addSectionManagementControls();
}

function addSectionManagementControls() {
  const body=document.getElementById('srBody');
  if (!body || currentSection==='page_content') return;
  body.querySelector('.section-management')?.remove();
  const controls=document.createElement('div');
  controls.className='section-management';
  controls.innerHTML=`<button type="button" onclick="moveSection(-1)" title="Move up">↑</button><button type="button" onclick="moveSection(1)" title="Move down">↓</button><button type="button" onclick="duplicateSection()">Duplicate</button><button type="button" onclick="removeSection()">Remove</button><button type="button" onclick="toggleSelectedSection()">${(draftFields.hidden_sections||[]).includes(currentSection)?'Show':'Hide'}</button><button type="button" onclick="addContentBlock()">+ Add block</button><button type="button" onclick="manageContentBlocks()">Manage blocks</button>`;
  body.prepend(controls);
}
function initSectionManager() {
  const list=document.querySelector('.section-nav');
  if(!list)return;
  list.querySelectorAll('.sl-item[data-section]').forEach(item=>{
    const key=item.dataset.section;
    item.draggable=key!=='page_content';
    item.ondragstart=event=>{if(key==='page_content')return;event.dataTransfer.setData('text/zk-section',key);event.dataTransfer.effectAllowed='move';};
    item.ondragover=event=>{if(event.dataTransfer.types.includes('text/zk-section')){event.preventDefault();item.classList.add('drag-target');}};
    item.ondragleave=()=>item.classList.remove('drag-target');
    item.ondrop=event=>{event.preventDefault();item.classList.remove('drag-target');const source=event.dataTransfer.getData('text/zk-section');const from=list.querySelector(`[data-section="${source}"]`);if(from&&from!==item){list.insertBefore(from,item);saveSidebarOrder();}};
    const eye=item.querySelector('.eye');
    if(eye)eye.onclick=event=>{event.stopPropagation();toggleSectionVisibility(key);};
    item.classList.toggle('section-hidden',(draftFields.hidden_sections||[]).includes(key));
    item.style.display=(draftFields.removed_sections||[]).includes(key)?'none':'';
  });
  applySidebarOrder();
}
function saveSidebarOrder() {
  draftFields.section_order=Array.from(document.querySelectorAll('.section-nav .sl-item[data-section]')).map(item=>item.dataset.section).filter(key=>key!=='page_content');
  schedulePreviewRefresh();
}
function applySidebarOrder() {
  const list=document.querySelector('.section-nav');if(!list)return;
  const add=list.querySelector('.sl-add'),items=Array.from(list.querySelectorAll('.sl-item[data-section]'));
  (draftFields.section_order||[]).forEach(key=>{const item=items.find(node=>node.dataset.section===key);if(item)list.insertBefore(item,add);});
}
function moveSection(delta) {
  const item=document.querySelector(`.section-nav [data-section="${currentSection}"]`);if(!item)return;
  const peers=Array.from(document.querySelectorAll('.section-nav .sl-item[data-section]')).filter(node=>node.dataset.section!=='page_content');
  const index=peers.indexOf(item),next=peers[index+delta];if(!next)return;
  if(delta<0)item.parentNode.insertBefore(item,next);else item.parentNode.insertBefore(next,item);
  saveSidebarOrder();focusPreviewSection(currentSection);
}
function toggleSectionVisibility(key=currentSection) {
  const hidden=new Set(draftFields.hidden_sections||[]);hidden.has(key)?hidden.delete(key):hidden.add(key);draftFields.hidden_sections=Array.from(hidden);
  const item=document.querySelector(`.section-nav [data-section="${key}"]`);if(item)item.classList.toggle('section-hidden',hidden.has(key));
  schedulePreviewRefresh();if(key===currentSection)addSectionManagementControls();
}
function toggleSelectedSection(){toggleSectionVisibility();}
function duplicateSection(){draftFields.section_order=Array.isArray(draftFields.section_order)?draftFields.section_order:[];draftFields.section_order.push(currentSection);schedulePreviewRefresh();showToast('Section duplicated in this template draft.');}
function removeSection(){draftFields.removed_sections=Array.from(new Set([...(draftFields.removed_sections||[]),currentSection]));draftFields.section_order=(draftFields.section_order||[]).filter(key=>key!==currentSection);const item=document.querySelector(`.section-nav [data-section="${currentSection}"]`);if(item)item.style.display='none';schedulePreviewRefresh();showToast('Section removed from this template draft. Use Add Section to restore it.');}
function addContentBlock(){
  const type=prompt('Block type: text, image, button, benefit, or app');if(!['text','image','button','benefit','app'].includes(type||''))return;
  const content=prompt(type==='image'?'HTTPS image URL':type==='button'?'Button label':type==='app'?'HTTPS app extension URL':'Block text');if(!content)return;
  const block={id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type,section:currentSection,content};
  if(type==='button')block.url=prompt('Button destination URL','/');
  draftFields.content_blocks=[...(draftFields.content_blocks||[]),block];schedulePreviewRefresh();showToast('Block added to the selected section draft.');
}
function manageContentBlocks(){
  const all=draftFields.content_blocks||[],blocks=all.filter(block=>block.section===currentSection);const local=blocks.map((block,index)=>`${index+1}. ${block.type}: ${block.content}`).join('\n');
  if(!blocks.length)return showToast('No content blocks in this draft.');
  const command=prompt(`Manage blocks in ${currentSection}. Commands: remove 1, edit 1, up 2, down 2\n${local}`)||'';
  const match=command.match(/^(remove|edit|up|down)\s+(\d+)$/i);if(!match)return;
  const action=match[1].toLowerCase(),index=Number(match[2])-1;if(index<0||index>=blocks.length)return;
  const target=blocks[index],allIndex=all.indexOf(target);
  if(action==='remove')all.splice(allIndex,1);
  else if(action==='edit'){const content=prompt('Block content',target.content||'');if(content===null)return;target.content=content;if(target.type==='button')target.url=prompt('Button destination URL',target.url||'/')||target.url;}
  else {const next=index+(action==='up'?-1:1);if(next<0||next>=blocks.length)return;const otherIndex=all.indexOf(blocks[next]);[all[allIndex],all[otherIndex]]=[all[otherIndex],all[allIndex]];}
  draftFields.content_blocks=all;schedulePreviewRefresh();showToast('Content block updated in draft.');
}

function sectionConfigFromFields(f){return {
    announcement:{text:f.ann_text,ann_text:f.ann_text,background:f.ann_bg,ann_bg:f.ann_bg,background_image:f.ann_bg_img,ann_text_c:f.ann_text_c,show:f.ann_show!==false,visible:f.ann_show!==false},
    nav:{background:f.nav_bg,background_image:f.nav_bg_img,visible:true},
    hero:{heading:f.hero_h1,hero_h1:f.hero_h1,description:f.hero_desc,hero_desc:f.hero_desc,image:f.hero_bg_img,hero_bg_img:f.hero_bg_img,background:f.hero_bg,hero_bg:f.hero_bg,visible:f.hero_img_show!==false},
    product:{compare_price:f.prod_compare_show!==false,show_stars:f.prod_stars_show!==false,show_whatsapp:f.prod_wa_show!==false,show_manufacturer:f.prod_mfg_show!==false,button_color:f.prod_cta_c,price_color:f.prod_price_c,background:f.prod_bg,visible:true},
    products:{heading:f.products_heading,button_color:f.prod_cta_c,price_color:f.prod_price_c,background:f.prod_bg,visible:true},
    trust:{items:f.trust_items,background:f.trust_bg,color:f.trust_text_c,visible:f.trust_show!==false},
    why:{heading:f.why_heading,text:f.why_text,items:f.why_items,background:f.why_bg,visible:f.why_show!==false},
    ingredients:{heading:f.ingredients_heading,text:f.ingredients_text,items:f.ingredients_items,background:f.ingredients_bg,visible:f.ingredients_show!==false},
    howtouse:{heading:f.how_heading,text:f.how_text,items:f.how_items,background:f.how_bg,visible:f.how_show!==false},
    gallery:{heading:f.gallery_heading,images:f.gallery_images,visible:f.gallery_show!==false},
    reviews:{heading:f.review_heading,items:f.review_items,visible:f.reviews_show!==false},
    contact:{heading:f.contact_heading,visible:f.contact_show!==false},
    slider:{images:f.slider_images||f.slider_urls||[],visible:f.slider_show!==false},
    offers:{heading:f.offer_heading,text:f.offer_text,background:f.offer_bg,visible:f.offer_show!==false},
    footer:{background:f.footer_bg,image:f.footer_img,visible:true},
    footer_above:{heading:f.footer_above_heading,text:f.footer_above_text,background:f.footer_above_bg,image:f.footer_above_img,visible:f.footer_above_show!==false}
  };}
function buildConfig(){
  const sections=sectionConfigFromFields(draftFields);
  saveCurrentTemplateDraft();
  const savedTemplates=Object.fromEntries(Object.entries(templateFields).filter(([key])=>key!=='page_overrides'));
  return {
  fields:draftFields, templates:savedTemplates, page_templates:templateFields.page_overrides||{}, section_order:draftFields.section_order||[], hidden_sections:draftFields.hidden_sections||[], removed_sections:draftFields.removed_sections||[], primary_colour:draftFields.primary_colour,bg_colour:draftFields.bg_colour,accent_colour:draftFields.accent_colour,
  logo_url:draftFields.nav_logo,body_font:draftFields.body_font||'Inter',meta_title:document.getElementById('set-title').value,
  meta_description:document.getElementById('set-desc').value,
  sections
};}
async function saveSettings(){
  const store_fields={store_name:document.getElementById('set-name').value,tagline:document.getElementById('set-tagline').value,hero_headline:draftFields.hero_h1,hero_subtext:draftFields.hero_desc,hero_cta_text:draftFields.hero_cta,primary_colour:draftFields.primary_colour,bg_colour:draftFields.bg_colour,accent_colour:draftFields.accent_colour,logo_url:draftFields.nav_logo,whatsapp_number:document.getElementById('set-wa').value,instagram_handle:document.getElementById('set-ig').value,address:document.getElementById('set-addr').value,custom_domain:document.getElementById('set-domain').value||null};
  try{await api(`/stores/${activeStoreId}/draft`,{method:'PUT',body:{theme_config:buildConfig(),store_fields}});showToast('Store settings saved as draft.');await refreshPreview();}
  catch(error){showToast(error.message);throw error;}
}
async function saveChanges(){try{await saveSettings();document.getElementById('lastSaved').textContent=new Date().toLocaleTimeString();}catch(_error){}}
async function publishStore(){if(!activeStoreId)return;try{await saveSettings();const result=await api(`/stores/${activeStoreId}/publish`,{method:'POST',body:{}});showToast('Published: https://'+(activeStore.custom_domain||activeStore.slug+'.zkcommerce.in'));await switchStore(String(activeStoreId));}catch(error){showToast(error.message);}}
function openPreview(){if(previewUrl)window.open(previewUrl,'_blank','noopener');else refreshPreview();}
function openInNewTab(){openPreview();}
function reloadPreview(){refreshPreview();}
async function addSection(){
  const options=['hero','trust','why','ingredients','howtouse','slider','offers','products','gallery','reviews','contact','footer_above'];
  const kind=prompt(`Add or restore section:\n${options.join(', ')}`);if(!options.includes(kind))return;
  draftFields.removed_sections=(draftFields.removed_sections||[]).filter(key=>key!==kind);
  draftFields.hidden_sections=(draftFields.hidden_sections||[]).filter(key=>key!==kind);
  draftFields.section_order=Array.isArray(draftFields.section_order)?draftFields.section_order:[];
  if(!draftFields.section_order.includes(kind))draftFields.section_order.push(kind);
  const item=document.querySelector(`.section-nav [data-section="${kind}"]`);if(item)item.style.display='';
  initSectionManager();schedulePreviewRefresh();
  showToast(`${kind} section added to the ${currentTemplate} draft. Save to persist it.`);
}

bootstrapStores();
