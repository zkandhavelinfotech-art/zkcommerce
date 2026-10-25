/* Environment-aware URLs shared by setup, dashboard, and storefront pages. */
(function attachEnvironmentUrls(root) {
  'use strict';

  const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'dev', 'development', 'staging']);

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'yourstore';
  }

  function detectEnvironment(locationLike = root.location || {}) {
    const explicit = root.ZK_RUNTIME_CONFIG && root.ZK_RUNTIME_CONFIG.environment;
    if (explicit) return String(explicit).toLowerCase();

    const host = String(locationLike.hostname || '').toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'local';
    if (host.includes('staging') || host.startsWith('stage.')) return 'staging';
    if (host.includes('dev') || host.endsWith('.vercel.app')) return 'development';
    return 'production';
  }

  function storeSlug(locationLike = root.location || {}) {
    if (root.ZK_STORE && root.ZK_STORE.slug) return slugify(root.ZK_STORE.slug);

    const params = new URLSearchParams(locationLike.search || '');
    const querySlug = params.get('store') || params.get('slug');
    if (querySlug) return slugify(querySlug);

    const host = String(locationLike.hostname || '').toLowerCase();
    const parts = host.split('.');
    if (parts.length >= 3 && parts.slice(-2).join('.') === 'zkcommerce.in' && !RESERVED_SUBDOMAINS.has(parts[0])) {
      return slugify(parts[0]);
    }
    return '';
  }

  function storefrontUrl(slug, locationLike = root.location || {}, environment = detectEnvironment(locationLike)) {
    const cleanSlug = slugify(slug);
    const protocol = locationLike.protocol === 'http:' ? 'http:' : 'https:';
    const host = String(locationLike.hostname || '').toLowerCase();

    if (environment === 'production' && (host === 'zkcommerce.in' || host.endsWith('.zkcommerce.in'))) {
      return `https://${cleanSlug}.zkcommerce.in/`;
    }

    const origin = locationLike.origin || `${protocol}//${locationLike.host || 'localhost:8080'}`;
    return `${origin}/storefront/home.html?store=${encodeURIComponent(cleanSlug)}`;
  }

  function dashboardUrl(locationLike = root.location || {}) {
    const origin = locationLike.origin || 'http://localhost:8080';
    return `${origin}/merchant/dashboard.html`;
  }

  function displayUrl(url) {
    return String(url).replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  const api = { dashboardUrl, detectEnvironment, displayUrl, slugify, storeSlug, storefrontUrl };
  root.ZKEnvironment = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
