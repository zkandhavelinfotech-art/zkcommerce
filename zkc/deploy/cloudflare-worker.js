/**
 * ZKCommerce Cloudflare Worker
 * Routes *.zkcommerce.in subdomains to the correct merchant storefront
 * Deploy to: https://dash.cloudflare.com → Workers
 */

const API_URL       = 'https://api.zkcommerce.in';
const FRONTEND_URL  = 'https://zkcommerce.vercel.app';

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const host = url.hostname; // e.g. rajanTextiles.zkcommerce.in

    // Strip subdomain
    const parts = host.split('.');
    const isSubdomain = parts.length === 3 && parts[1] === 'zkcommerce' && parts[2] === 'in';

    if (!isSubdomain) {
      // Main domain — proxy to Vercel
      return fetch(`${FRONTEND_URL}${url.pathname}${url.search}`, request);
    }

    const slug = parts[0]; // e.g. rajanTextiles

    // Validate store exists
    const storeRes = await fetch(`${API_URL}/api/storefront/${slug}`);
    if (!storeRes.ok) {
      return new Response(`<h1>Store not found</h1><p>${slug}.zkcommerce.in does not exist.</p>`, {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    const { store } = await storeRes.json();

    // Inject store context into the storefront
    const path = url.pathname || '/';
    if (path === '/' || path === '/index.html') {
      // Fetch storefront home and inject store data
      const sfRes = await fetch(`${FRONTEND_URL}/storefront/home.html`);
      let html = await sfRes.text();
      // Inject store config as global JS variable
      html = html.replace('<head>', `<head>
<script>
window.ZK_STORE = ${JSON.stringify({
  id:    store.id,
  name:  store.name,
  slug:  store.slug,
  theme: store.theme,
  primaryColor: store.primary_color,
  logo:  store.logo_url,
  plan:  store.plan,
})};
</script>`);
      html = html.replace('Rajan Textiles', store.name);
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }

    // Pass through all other paths
    return fetch(`${FRONTEND_URL}${path}${url.search}`, request);
  },
};
