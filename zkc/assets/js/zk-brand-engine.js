/**
 * ZKCommerce Universal Merchant Brand & Theme Engine
 * Automatically applies merchant-specific branding, logo, background,
 * and redesigned sidebar menu as per the merchant's logo and brand palette.
 * Supports Smeram Naturals, Rajan Textiles, Miliro, and ANY newly created merchant store.
 */
(function(window, document) {
  'use strict';

  // Known brand profiles (instant zero-latency cache; also fetched from DB/API)
  var BRAND_PROFILES = {
    'smeram': {
      slug: 'smeram',
      name: 'Smeram Naturals',
      tagline: 'Authentic Classical Ayurvedic Care',
      domain: 'smeram-naturals.in',
      logoUrl: '/assets/themes/smeram/smeram-round-logo.jpg',
      icon: '🌿',
      primaryColor: '#E11D74',        // Smeram Magenta / Hibiscus Pink
      accentColor: '#7EA82B',         // Smeram Herbal Olive Leaf Green
      bgColor: '#FFF9FA',             // Soft Rose-Cream Ivory Canvas
      sidebarBg: '#180D18',           // Deep Velvet Botanical Plum-Navy
      sidebarActive: 'linear-gradient(135deg, rgba(225, 29, 116, 0.24) 0%, rgba(126, 168, 43, 0.18) 100%)',
      sidebarActiveBorder: '#E11D74',
      storefrontUrl: '/store/smeram',
      builderUrl: '/store-builder/?store=smeram'
    },
    'rajantextiles': {
      slug: 'rajantextiles',
      name: 'Rajan Textiles',
      tagline: 'Finest Handlooms & Pure Silk Sarees',
      domain: 'rajantextiles.com',
      logoUrl: '/assets/themes/rajan/rajan-logo.png',
      icon: '🥻',
      primaryColor: '#FF6B00',        // Silk Orange
      accentColor: '#C41E3A',         // Zari Crimson
      bgColor: '#FAF7F2',             // Handloom Silk Cream
      sidebarBg: '#160B05',           // Deep Warm Obsidian
      sidebarActive: 'rgba(255, 107, 0, 0.22)',
      sidebarActiveBorder: '#FF6B00',
      storefrontUrl: '/store/rajanTextiles',
      builderUrl: '/store-builder/?store=rajanTextiles'
    },
    'miliro': {
      slug: 'miliro',
      name: 'Miliro Lifestyle',
      tagline: 'Modern Apparel & Sustainable Living',
      domain: 'shop.miliro.com',
      logoUrl: '/assets/themes/miliro/miliro-logo.png',
      icon: '🫧',
      primaryColor: '#0284C7',
      accentColor: '#10B981',
      bgColor: '#F8FAFC',
      sidebarBg: '#091322',
      sidebarActive: 'rgba(2, 132, 199, 0.22)',
      sidebarActiveBorder: '#0284C7',
      storefrontUrl: '/store/miliro',
      builderUrl: '/store-builder/?store=miliro'
    }
  };

  // Helper to convert hex to RGB
  function hexToRgb(hex) {
    if (!hex) return { r: 21, g: 101, b: 192 };
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  // Derive palette for any merchant store
  function generatePaletteFromColor(primaryHex, customAccent, customBg, customSidebar) {
    var rgb = hexToRgb(primaryHex || '#E11D74');
    var accent = customAccent || '#7EA82B';
    var bgR = Math.round(255 * 0.96 + rgb.r * 0.04);
    var bgG = Math.round(255 * 0.96 + rgb.g * 0.04);
    var bgB = Math.round(255 * 0.96 + rgb.b * 0.04);
    var bg = customBg || ('#' + ((1 << 24) + (bgR << 16) + (bgG << 8) + bgB).toString(16).slice(1));
    var sbR = Math.min(28, Math.max(10, Math.round(rgb.r * 0.12)));
    var sbG = Math.min(28, Math.max(10, Math.round(rgb.g * 0.10)));
    var sbB = Math.min(32, Math.max(12, Math.round(rgb.b * 0.12)));
    var sb = customSidebar || ('#' + ((1 << 24) + (sbR << 16) + (sbG << 8) + sbB).toString(16).slice(1));

    return {
      primary: primaryHex || '#E11D74',
      accent: accent,
      bg: bg,
      sidebarBg: sb,
      sidebarActive: 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.22)',
      sidebarActiveBorder: primaryHex || '#E11D74'
    };
  }

  // Detect which store is currently active
  function detectActiveStore() {
    var params = new URLSearchParams(window.location.search);
    var explicit = (params.get('store') || params.get('client') || '').toLowerCase().trim();
    if (explicit) return explicit;

    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('/smeram') !== -1) return 'smeram';
    if (path.indexOf('/rajantextiles') !== -1 || path.indexOf('/rajan') !== -1) return 'rajantextiles';
    if (path.indexOf('/miliro') !== -1) return 'miliro';

    var m = path.match(/\/(?:store|clients)\/([a-z0-9_-]+)/i);
    if (m && m[1]) return m[1].toLowerCase();

    var saved = (localStorage.getItem('zk_active_store') || localStorage.getItem('zk_active_client') || '').toLowerCase();
    if (saved) return saved;

    return 'smeram';
  }

  // Apply CSS Variables to :root and body
  function applyBrandStyles(brand) {
    var root = document.documentElement;
    var pal = generatePaletteFromColor(brand.primaryColor, brand.accentColor, brand.bgColor, brand.sidebarBg);

    root.style.setProperty('--brand-primary', pal.primary);
    root.style.setProperty('--brand-accent', pal.accent);
    root.style.setProperty('--brand-bg', pal.bg);
    root.style.setProperty('--brand-sidebar-bg', pal.sidebarBg);
    root.style.setProperty('--brand-sidebar-border', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--brand-sidebar-active', brand.sidebarActive || pal.sidebarActive);
    root.style.setProperty('--brand-sidebar-active-border', pal.sidebarActiveBorder);

    // Override existing tokens
    root.style.setProperty('--zk-fire', pal.primary);
    root.style.setProperty('--zk-chalk', pal.bg);
    root.style.setProperty('--zk-deep', pal.sidebarBg);

    if (document.body) {
      document.body.setAttribute('data-brand', brand.slug);
      document.body.style.backgroundColor = pal.bg;
      var zkMain = document.querySelector('.zk-main');
      if (zkMain) zkMain.style.backgroundColor = pal.bg;
    }
  }

  // Render Redesigned Sidebar Header
  function renderSidebarHeader(brand) {
    var sidebar = document.getElementById('sidebar') || document.querySelector('.zk-sidebar') || document.querySelector('aside');
    if (!sidebar) return;

    var existingHeader = sidebar.querySelector('.zk-sidebar-header, .zk-sidebar-logo, .brand');
    var headerContainer = document.createElement('div');
    headerContainer.className = 'zk-sidebar-header merchant-theme-header';

    // Format merchant logo with click-to-edit action
    var savedLogo = localStorage.getItem('zk_store_logo_' + brand.slug) || localStorage.getItem('zk_store_logo') || brand.logoUrl;
    var merchantLogoHtml = '';
    if (savedLogo) {
      merchantLogoHtml = '<img id="sidebarMerchantLogo" src="' + savedLogo + '" alt="' + brand.name + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" onerror="this.src=\'' + (brand.logoUrl || '/assets/themes/smeram/smeram-round-logo.jpg') + '\'">';
    } else {
      merchantLogoHtml = '<span style="font-size:16px;font-weight:800;color:' + brand.primaryColor + '">' + (brand.name || 'S')[0] + '</span>';
    }

    headerContainer.innerHTML = ''
      // Top row: [Official ZKCommerce Full Banner Logo (Transparent & Expanded Width)]
      + '<div class="zk-merchant-brand-bar" style="display:flex;align-items:center;justify-content:center;width:100%;position:relative;padding:8px 0 10px">'
      +   '<img src="/assets/zkcommerce-logo-banner.png" alt="ZKCommerce" style="width:100%;max-width:215px;height:auto;max-height:64px;object-fit:contain;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))" onerror="this.src=\'../assets/zkcommerce-logo-banner.png\'">'
      + '</div>'
      // Store info strip & quick navigation links
      + '<div class="zk-merchant-info-strip" style="margin-top:4px">'
      +   '<div class="zk-merchant-store-name" title="' + brand.name + '">' + (brand.icon ? brand.icon + ' ' : '') + brand.name + '</div>'
      +   '<div class="zk-merchant-actions">'
      +     '<a href="' + (brand.storefrontUrl || '/store/' + brand.slug) + '" target="_blank" class="zk-merchant-action-btn store" title="Open Live Storefront">🌐 Store</a>'
      +     '<a href="' + (brand.builderUrl || '/store-builder/?store=' + brand.slug) + '" target="_blank" class="zk-merchant-action-btn builder" title="Open StoreBuilder">🖌️ Theme</a>'
      +   '</div>'
      + '</div>'
      // Store Switcher Pills
      + '<div class="zk-store-switch-bar">'
      +   '<button type="button" class="zk-store-switch-pill ' + (brand.slug === 'smeram' ? 'active' : '') + '" onclick="window.ZKBrandEngine.switchStore(\'smeram\')">🌿 Smeram</button>'
      +   '<button type="button" class="zk-store-switch-pill ' + (brand.slug === 'rajantextiles' ? 'active' : '') + '" onclick="window.ZKBrandEngine.switchStore(\'rajantextiles\')">🥻 Rajan</button>'
      +   '<button type="button" class="zk-store-switch-pill ' + (brand.slug === 'miliro' ? 'active' : '') + '" onclick="window.ZKBrandEngine.switchStore(\'miliro\')">🫧 Miliro</button>'
      + '</div>';

    if (existingHeader) {
      existingHeader.replaceWith(headerContainer);
    } else {
      sidebar.insertBefore(headerContainer, sidebar.firstChild);
    }
  }

  // Redesign Sidebar Menu Links
  function styleSidebarMenu(brand) {
    var nav = document.querySelector('.zk-sidebar-nav, nav.nav, #sidebarNav');
    if (!nav) return;

    var currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    var links = nav.querySelectorAll('.zk-sidebar-link, .nav-item, a');
    links.forEach(function(link) {
      var href = (link.getAttribute('href') || '').split('?')[0].split('/').pop();
      if (href && href === currentPath) {
        link.classList.add('active');
      }
    });
  }

  // StoreBuilder specific enhancements
  function applyStoreBuilderTheme(brand) {
    if (!window.location.pathname.includes('store-builder')) return;

    var brandEl = document.querySelector('.topbar .brand');
    if (brandEl) {
      brandEl.innerHTML = ''
        + '<div style="display:flex;align-items:center;gap:10px">'
        +   '<img src="/assets/zk-logo-square.png" alt="ZK" style="height:32px;width:32px;border-radius:6px;object-fit:contain;background:#fff;padding:2px;box-shadow:0 1px 4px rgba(0,0,0,0.15)">'
        +   '<div>'
        +     '<div style="font-size:13px;font-weight:800;color:var(--ink,#0f172a)">ZKCommerce <span style="font-size:11px;font-weight:600;color:' + brand.primaryColor + ';background:rgba(225,29,116,0.1);padding:1px 6px;border-radius:4px">StoreBuilder</span></div>'
        +     '<small style="font-size:9.5px;color:var(--sub,#64748b)">' + brand.name + ' · Theme Engine</small>'
        +   '</div>'
        +   '<div class="sidebar-merchant-logo-wrap" style="margin-left:8px;cursor:pointer" onclick="window.ZKBrandEngine.openLogoModal()" title="Edit Store Logo">'
        +     '<img id="sbMerchantLogo" src="' + (brand.logoUrl || '/assets/themes/smeram/smeram-round-logo.jpg') + '" style="height:34px;width:34px;border-radius:50%;object-fit:cover;border:2px solid ' + brand.primaryColor + ';background:#fff;padding:1px">'
        +   '</div>'
        + '</div>';
    }

    var pubBtn = document.getElementById('publishBtn');
    if (pubBtn) {
      pubBtn.style.background = brand.primaryColor;
      pubBtn.style.borderColor = brand.primaryColor;
    }
  }

  // Universal in-page Logo Edit/Replace Modal
  function openLogoModal() {
    // If the page already has openLogoUploadModal (like index.html), invoke it
    if (typeof window.openLogoUploadModal === 'function') {
      window.openLogoUploadModal();
      return;
    }

    var currentSlug = detectActiveStore();
    var brand = BRAND_PROFILES[currentSlug] || BRAND_PROFILES.smeram;
    var currentLogo = localStorage.getItem('zk_store_logo_' + brand.slug) || localStorage.getItem('zk_store_logo') || brand.logoUrl;

    var existingModal = document.getElementById('zkUniversalLogoModal');
    if (existingModal) existingModal.remove();

    var modal = document.createElement('div');
    modal.id = 'zkUniversalLogoModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    modal.innerHTML = ''
      + '<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.35);overflow:hidden;font-family:sans-serif">'
      +   '<div style="padding:16px 20px;background:#0f172a;color:#fff;display:flex;justify-content:space-between;align-items:center">'
      +     '<strong style="font-size:15px;display:flex;align-items:center;gap:8px">🖼️ Edit / Replace ' + brand.name + ' Logo</strong>'
      +     '<button type="button" onclick="document.getElementById(\'zkUniversalLogoModal\').remove()" style="border:none;background:none;color:#94a3b8;font-size:22px;cursor:pointer;line-height:1">×</button>'
      +   '</div>'
      +   '<div style="padding:20px">'
      +     '<div style="text-align:center;margin-bottom:18px">'
      +       '<div style="width:84px;height:84px;border-radius:50%;margin:0 auto 10px;overflow:hidden;border:2.5px solid ' + brand.primaryColor + ';background:#fff;padding:3px;box-shadow:0 4px 12px rgba(0,0,0,0.12)">'
      +         '<img id="zkModalPreviewImg" src="' + currentLogo + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.src=\'/assets/themes/smeram/smeram-round-logo.jpg\'">'
      +       '</div>'
      +       '<div style="font-size:12px;color:#64748b">Displays in sidebar top right, invoices, and storefront navigation.</div>'
      +     '</div>'
      +     '<label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px">Upload Image File (PNG, JPG, SVG):</label>'
      +     '<input type="file" id="zkModalFileInput" accept="image/*" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;margin-bottom:12px">'
      +     '<label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px">Or Image / Asset URL:</label>'
      +     '<input type="text" id="zkModalUrlInput" value="' + currentLogo + '" placeholder="e.g. /assets/themes/smeram/smeram-round-logo.jpg" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:18px">'
      +     '<div style="display:flex;justify-content:flex-end;gap:10px">'
      +       '<button type="button" onclick="document.getElementById(\'zkUniversalLogoModal\').remove()" style="padding:9px 16px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">Cancel</button>'
      +       '<button type="button" id="zkModalSaveBtn" style="padding:9px 20px;border:none;background:' + brand.primaryColor + ';color:#fff;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2)">Save & Apply Logo</button>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(modal);

    var fileInput = document.getElementById('zkModalFileInput');
    var urlInput = document.getElementById('zkModalUrlInput');
    var previewImg = document.getElementById('zkModalPreviewImg');

    fileInput.onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          previewImg.src = evt.target.result;
          urlInput.value = evt.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    urlInput.oninput = function() {
      previewImg.src = urlInput.value.trim();
    };

    document.getElementById('zkModalSaveBtn').onclick = async function() {
      var newUrl = urlInput.value.trim();
      if (!newUrl) {
        alert('Please choose an image file or enter a valid URL.');
        return;
      }
      localStorage.setItem('zk_store_logo_' + brand.slug, newUrl);
      localStorage.setItem('zk_store_logo', newUrl);
      brand.logoUrl = newUrl;

      // Update in DOM
      var sideLogos = document.querySelectorAll('#sidebarMerchantLogo, #sbMerchantLogo, #headerStoreLogo, #settingsStoreLogoPreview');
      sideLogos.forEach(function(img) { img.src = newUrl; });

      // Save to backend API if available
      try {
        var apiBase = (window.ZK && window.ZK.api) || '/api';
        await fetch(apiBase + '/stores/' + brand.slug, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo_url: newUrl })
        }).catch(function() {});
      } catch(e) {}

      modal.remove();
      if (window.toast && window.toast.success) {
        window.toast.success('Store logo updated successfully!');
      } else {
        alert('Store logo updated and applied in sidebar!');
      }
    };
  }

  // Main initialize function
  async function initBrandEngine() {
    var slug = detectActiveStore();
    var brand = BRAND_PROFILES[slug];

    var apiBase = (window.ZK && window.ZK.api) || '/api';
    try {
      var res = await fetch(apiBase + '/stores');
      if (res.ok) {
        var data = await res.json();
        var storesList = data.stores || (Array.isArray(data) ? data : []);
        var found = storesList.find(function(s) {
          return String(s.slug || '').toLowerCase() === slug || String(s.id) === slug;
        });

        if (found) {
          var settings = found.settings || {};
          brand = {
            slug: found.slug,
            name: found.name || found.store_name,
            tagline: found.tagline || '',
            domain: found.custom_domain || found.domain || (found.slug + '.zkcommerce.in'),
            logoUrl: found.logo_url || (BRAND_PROFILES[found.slug] ? BRAND_PROFILES[found.slug].logoUrl : null),
            icon: BRAND_PROFILES[found.slug] ? BRAND_PROFILES[found.slug].icon : '🏪',
            primaryColor: found.primary_color || (BRAND_PROFILES[found.slug] ? BRAND_PROFILES[found.slug].primaryColor : '#E11D74'),
            accentColor: settings.accent_color || (BRAND_PROFILES[found.slug] ? BRAND_PROFILES[found.slug].accentColor : '#7EA82B'),
            bgColor: settings.bg_color || (BRAND_PROFILES[found.slug] ? BRAND_PROFILES[found.slug].bgColor : '#FFF9FA'),
            sidebarBg: settings.sidebar_bg || (BRAND_PROFILES[found.slug] ? BRAND_PROFILES[found.slug].sidebarBg : '#180D18'),
            storefrontUrl: '/store/' + found.slug,
            builderUrl: '/store-builder/?store=' + found.slug
          };
          BRAND_PROFILES[found.slug] = brand;
        }
      }
    } catch(err) {}

    if (!brand) brand = BRAND_PROFILES.smeram;

    applyBrandStyles(brand);
    renderSidebarHeader(brand);
    styleSidebarMenu(brand);
    applyStoreBuilderTheme(brand);
  }

  // Public API
  window.ZKBrandEngine = {
    init: initBrandEngine,
    openLogoModal: openLogoModal,
    switchStore: function(slug) {
      localStorage.setItem('zk_active_store', slug);
      localStorage.setItem('zk_active_client', slug);
      var url = new URL(window.location.href);
      url.searchParams.set('store', slug);
      window.location.href = url.toString();
    },
    getBrand: function(slug) {
      return BRAND_PROFILES[slug] || BRAND_PROFILES.smeram;
    },
    profiles: BRAND_PROFILES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBrandEngine);
  } else {
    initBrandEngine();
  }

})(window, document);
