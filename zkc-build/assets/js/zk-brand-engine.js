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
      logoUrl: '/assets/themes/smeram/smeram-banner-logo.jpg',
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
    var rgb = hexToRgb(primaryHex || '#1565C0');
    // Accent: use custom if given, else complement / gold
    var accent = customAccent || '#7EA82B';
    // Very soft tinted canvas (mix 96% white with 4% brand color)
    var bgR = Math.round(255 * 0.96 + rgb.r * 0.04);
    var bgG = Math.round(255 * 0.96 + rgb.g * 0.04);
    var bgB = Math.round(255 * 0.96 + rgb.b * 0.04);
    var bg = customBg || ('#' + ((1 << 24) + (bgR << 16) + (bgG << 8) + bgB).toString(16).slice(1));
    // Dark velvet obsidian sidebar (mix 8% brand color with 92% dark night #0b0c10)
    var sbR = Math.min(28, Math.max(10, Math.round(rgb.r * 0.12)));
    var sbG = Math.min(28, Math.max(10, Math.round(rgb.g * 0.10)));
    var sbB = Math.min(32, Math.max(12, Math.round(rgb.b * 0.12)));
    var sb = customSidebar || ('#' + ((1 << 24) + (sbR << 16) + (sbG << 8) + sbB).toString(16).slice(1));

    return {
      primary: primaryHex || '#1565C0',
      accent: accent,
      bg: bg,
      sidebarBg: sb,
      sidebarActive: 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.22)',
      sidebarActiveBorder: primaryHex || '#1565C0'
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

    // Default to smeram for herbal/natural showcase, or first available
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

    // Also override existing ZKCommerce tokens so entire platform adopts the theme
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

    // Check if we already have the merchant header
    var existingHeader = sidebar.querySelector('.zk-sidebar-header, .zk-sidebar-logo, .brand');
    var headerContainer = document.createElement('div');
    headerContainer.className = 'zk-sidebar-header merchant-theme-header';

    // Format logo image or fallback
    var logoHtml = '';
    if (brand.logoUrl) {
      logoHtml = '<div class="zk-merchant-logo-frame" title="' + brand.name + '">'
        + '<img src="' + brand.logoUrl + '" alt="' + brand.name + '" onerror="this.parentElement.innerHTML=\'<span class=zk-merchant-logo-fallback>' + (brand.icon || '🛍️') + '</span>\'">'
        + '</div>';
    } else {
      logoHtml = '<div class="zk-merchant-logo-fallback" title="' + brand.name + '">' + (brand.icon || '🛍️') + '</div>';
    }

    headerContainer.innerHTML = ''
      // Top row: Merchant Logo (sized as per sidebar left top header) + ZKCommerce platform text
      + '<div class="zk-merchant-brand-bar">'
      +   logoHtml
      +   '<div class="zk-platform-badge">'
      +     '<span class="zk-platform-text"><span style="color:#38bdf8">⚡</span> ZKCommerce</span>'
      +     '<span class="zk-platform-sub">Merchant Engine</span>'
      +   '</div>'
      + '</div>'
      // Store info strip & quick navigation links
      + '<div class="zk-merchant-info-strip">'
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

    // Ensure active links have the proper active class styling
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

    var topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.style.borderBottom = '1.5px solid var(--brand-sidebar-border, #e1e3e5)';
    }

    var brandEl = document.querySelector('.topbar .brand');
    if (brandEl) {
      brandEl.innerHTML = ''
        + '<div style="display:flex;align-items:center;gap:10px">'
        +   (brand.logoUrl 
              ? '<img src="' + brand.logoUrl + '" style="height:32px;max-width:120px;object-fit:contain;border-radius:6px;background:rgba(255,255,255,0.1);padding:1px 4px" alt="' + brand.name + '">'
              : '<span style="font-size:22px">' + (brand.icon || '🛍️') + '</span>')
        +   '<div>'
        +     '<div style="font-size:13px;font-weight:800;color:var(--ink,#0f172a)">' + brand.name + ' <span style="font-size:11px;font-weight:600;color:var(--brand-primary,#E11D74);background:rgba(225,29,116,0.1);padding:1px 6px;border-radius:4px">StoreBuilder</span></div>'
        +     '<small style="font-size:9.5px;color:var(--sub,#64748b)">Powered by ZKCommerce Platform</small>'
        +   '</div>'
        + '</div>';
    }

    // Set buttons to match brand
    var pubBtn = document.getElementById('publishBtn');
    if (pubBtn) {
      pubBtn.style.background = 'var(--brand-primary, #E11D74)';
      pubBtn.style.borderColor = 'var(--brand-primary, #E11D74)';
    }
  }

  // Main initialize function
  async function initBrandEngine() {
    var slug = detectActiveStore();
    var brand = BRAND_PROFILES[slug];

    // If not in cache or for any newly created merchant, fetch store metadata from API
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
    } catch(err) {
      // Fallback cleanly to local brand profiles
    }

    if (!brand) brand = BRAND_PROFILES.smeram;

    // Apply branding across page
    applyBrandStyles(brand);
    renderSidebarHeader(brand);
    styleSidebarMenu(brand);
    applyStoreBuilderTheme(brand);
  }

  // Public API
  window.ZKBrandEngine = {
    init: initBrandEngine,
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

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBrandEngine);
  } else {
    initBrandEngine();
  }

})(window, document);
