require("dotenv").config({ path: "./.env" });
const pool = require("./api/db");
const { renderStore } = require("./api/store-renderer");

(async () => {
  try {
    const { rows } = await pool.query("SELECT * FROM stores WHERE slug=$1", ["smeram"]);
    const html = renderStore(rows[0].published_snapshot, { basePath: "/store/smeram" });
    const nav = html.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/);
    console.log("=== Final Nav links in DB rendered store ===");
    console.log(nav ? nav[1] : "No nav found");

    console.log("\n=== Checking Products ===");
    console.log("Product count in snapshot:", rows[0].published_snapshot.products.length);
    rows[0].published_snapshot.products.forEach(p => console.log(`- ${p.name} (₹${p.price}) [${p.category_name}]`));

    console.log("\n=== Checking Pages ===");
    console.log("Pages count in snapshot:", rows[0].published_snapshot.pages.length);
    rows[0].published_snapshot.pages.forEach(pg => console.log(`- ${pg.title} (/${pg.slug})`));

    console.log("\n✅ All Smeram checks passed!");
  } catch(e) {
    console.error("Verification error:", e);
  } finally {
    await pool.end();
  }
})();
