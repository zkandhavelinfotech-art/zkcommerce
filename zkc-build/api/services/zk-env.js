'use strict';
// One runtime config for every page: zk-env.js at the app root sets
//   window.ZK = { env, siteUrl, backendUrl, api, php, storeUrl(slug) } and window.API_BASE (= ZK.api).
// Three environments:
//   nodedev → served by the Node app from .env (ZK_ENV, FRONTEND_URL, API_URL)
//   phpdev  → written into the PHP packages built for the "development" environment (MAMP)
//   prod    → written into the PHP packages built for "production"
// Pages load it with a relative <script src="../zk-env.js"> so the same HTML works at a domain root or in a subfolder.

const ENV_NAME = { development: 'phpdev', production: 'prod' };
const trimUrl = u => String(u || '').trim().replace(/\/+$/, '');

// Default URLs for a PHP environment; the Publish portal saves the real ones per environment.
//   prod:   https://<domain>               + backend in /<slug>-backend-api
//   phpdev: http://localhost/live/<domain name>/<slug>-frontend + /<slug>-backend-api
function defaultPhpUrls(store, env, customDomain) {
  const slug = String(store.slug || 'store').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const domain = String(customDomain || store.custom_domain || '').trim().toLowerCase();
  if (env === 'production' && domain) {
    return { site_url: 'https://' + domain, backend_url: `https://${domain}/${slug}-backend-api` };
  }
  const base = 'http://localhost/live/' + (domain ? domain.replace(/\.[a-z]+$/, '') : slug);
  return { site_url: `${base}/${slug}-frontend`, backend_url: `${base}/${slug}-backend-api` };
}

function zkEnvScript({ env, siteUrl, backendUrl, api, php }) {
  const cfg = { env, siteUrl: trimUrl(siteUrl), backendUrl: trimUrl(backendUrl), api: trimUrl(api || trimUrl(backendUrl) + '/api'), php: !!php };
  return `/* ZKCommerce environment: ${env}. Generated — change it in .env (Node) or Publish portal → Environment URLs (PHP). */
(function () {
  var ZK = window.ZK = window.ZK || {};
  var cfg = ${JSON.stringify(cfg)};
  for (var k in cfg) ZK[k] = cfg[k];
  // Live storefront link: the Node app serves each store at /store/<slug>; a PHP frontend is the store itself.
  ZK.storeUrl = function (slug) { return ZK.php ? ZK.siteUrl : ZK.siteUrl + '/store/' + encodeURIComponent(slug || ''); };
  window.API_BASE = ZK.api;
  if (!ZK.php) return;
  // PHP hosting: send API calls to <backend>/api.php?route=... so they work without a URL rewrite module,
  // whether a page calls ZK.api + '/x', the same path without the host, or the storefront's '/api/x'.
  var apiPath = ZK.api.replace(/^https?:\\/\\/[^/]+/i, '');
  var nativeFetch = window.fetch;
  window.fetch = function (u, o) {
    if (typeof u === 'string') {
      var rest = null;
      if (u.indexOf(ZK.api + '/') === 0) rest = u.slice(ZK.api.length + 1);
      else if (apiPath && u.indexOf(apiPath + '/') === 0) rest = u.slice(apiPath.length + 1);
      else if (u.indexOf('/api/') === 0) rest = u.slice(5);
      if (rest !== null) {
        var q = rest.indexOf('?');
        u = ZK.backendUrl + '/api.php?route=' + encodeURIComponent(q < 0 ? rest : rest.slice(0, q)) + (q < 0 ? '' : '&' + rest.slice(q + 1));
      }
    }
    return nativeFetch.call(this, u, o);
  };
})();
`;
}

// nodedev: values from .env, falling back to the address the page was requested on.
function nodeEnvScript(req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const siteUrl = trimUrl(process.env.FRONTEND_URL) || origin;
  return zkEnvScript({ env: process.env.ZK_ENV || 'nodedev', siteUrl, backendUrl: siteUrl, api: trimUrl(process.env.API_URL) || siteUrl + '/api', php: false });
}

module.exports = { ENV_NAME, defaultPhpUrls, zkEnvScript, nodeEnvScript, trimUrl };
