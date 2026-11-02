/* ZKCommerce environment runtime config */
(function () {
  var ZK = window.ZK = window.ZK || {};
  var local = ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';
  var isNodeDev = local && location.port === '3000';
  var pathname = location.pathname || '';
  var subfolder = '';
  var subMatch = pathname.match(/^(.*?)\/(store-builder|merchant|storefront|clients|auth|admin|page|products|collections)\//);
  if (subMatch && subMatch[1]) {
    subfolder = subMatch[1];
  }
  var baseOrigin = isNodeDev ? 'http://localhost:3000' : (location.origin + subfolder);
  var isPhp = !isNodeDev;
  var cfg = {
    env: isNodeDev ? 'nodedev' : 'prod',
    siteUrl: baseOrigin,
    backendUrl: baseOrigin,
    api: baseOrigin + '/api',
    php: isPhp
  };
  for (var k in cfg) ZK[k] = cfg[k];
  ZK.storeUrl = function (slug) { return ZK.php ? ZK.siteUrl : ZK.siteUrl + '/store/' + encodeURIComponent(slug || ''); };
  window.API_BASE = ZK.api;
})();

