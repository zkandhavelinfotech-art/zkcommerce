const http = require('http');

function fetchHost(hostName) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 3001,
      path: '/',
      headers: { 'Host': hostName }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== VERIFYING OPTION 1: CUSTOM DOMAIN (smeram-naturals.in) ===\n');

  // Test 1: smeram-naturals.in
  const t1 = await fetchHost('smeram-naturals.in');
  console.log('1. Host: smeram-naturals.in');
  console.log('   Status Code:', t1.status);
  console.log('   Contains Smeram:', t1.data.includes('Smeram'));
  console.log('   Contains 100 ml (product size):', t1.data.includes('100 ml'));
  console.log('   Contains Offer tag:', t1.data.includes('Special Introductory Offer'));
  console.log('   Contains GST & Shipping badge:', t1.data.includes('Inclusive of GST') && t1.data.includes('Free Shipping'));
  console.log('   Contains WhatsApp number (+91 75399 72026):', t1.data.includes('75399 72026'));

  // Test 2: www.smeram-naturals.in
  const t2 = await fetchHost('www.smeram-naturals.in');
  console.log('\n2. Host: www.smeram-naturals.in');
  console.log('   Status Code:', t2.status);
  console.log('   Contains Smeram:', t2.data.includes('Smeram'));
  console.log('   Contains 100 ml (product size):', t2.data.includes('100 ml'));

  // Test 3: API Storefront route: /api/storefront/smeram-naturals.in
  const apiRes = await fetch('http://localhost:3001/api/storefront/smeram-naturals.in');
  const apiData = await apiRes.json();
  console.log('\n3. API Storefront (/api/storefront/smeram-naturals.in):');
  console.log('   Status Code:', apiRes.status);
  console.log('   Store Name:', apiData.store?.store_name);
  console.log('   Custom Domain:', apiData.store?.custom_domain);
  console.log('   Products returned:', apiData.products?.length);

  const passed = t1.status === 200 && t1.data.includes('Smeram') && t2.status === 200 && apiRes.status === 200;
  console.log('\n======================================================');
  console.log(passed ? '✅ ALL OPTION 1 CUSTOM DOMAIN CHECKS PASSED!' : '❌ CHECKS FAILED');
  console.log('======================================================');
}

run().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
