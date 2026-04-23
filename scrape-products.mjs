// scrape-products.mjs — run once with: node scrape-products.mjs
// Fetches every category page from allaboutyourentals.com and saves products.json

const CATEGORIES = [
  { slug: "backdrops-arches",           name: "Backdrops / Arches / Screens" },
  { slug: "whiskey-barrels-antique-doors", name: "Whiskey Barrels / Antique Doors / Crates / Riser Boxes / Milk Cans / Buckets" },
  { slug: "wood-metal-signs",           name: "Signs / Mirrors / Easels" },
  { slug: "vintage-crates-trunks",      name: "Baskets / Rattan / Wicker / Vintage Suitcases / Trunks" },
  { slug: "garlands-floral",            name: "Garlands / Sprays / Greenery / Floral" },
  { slug: "furniture",                  name: "Furniture / Rugs" },
  { slug: "lanterns-birdcages",         name: "Lanterns / Birdcages / Terrariums" },
  { slug: "centerpieces",               name: "Chargers / Table Runners / Wood Slabs / Chandeliers" },
  { slug: "gift-carts",                 name: "Games" },
  { slug: "card-boxes",                 name: "Card Boxes / Envelope Holders" },
  { slug: "chalkboards",                name: "Chalkboards" },
  { slug: "gold-brass-decor",           name: "Gold / Brass Décor" },
  { slug: "silver-white-decor",         name: "Black Decor / Silver Decor / White Décor" },
  { slug: "candlesticks",               name: "Candlesticks / Flameless Taper Candles" },
  { slug: "geometric-style",            name: "Tea Light Holders / Cylinder Vases / Votives / Fairy Lights" },
  { slug: "dessert-beverage-bars",      name: "Dessert Stands / Carts / Beverage Bars" },
  { slug: "cake-stands",                name: "Cake Stands / Cake Serving Sets" },
  { slug: "glassware",                  name: "Vases / Vintage Bottles / Bud Vases / Large Glass" },
  { slug: "beverage-dispensers-food-displays", name: "Serving / Food Display" },
  { slug: "accessories",                name: "Accessories" },
];

function parsePrice(str) {
  if (!str) return null;
  const match = str.match(/\$[\d.,]+/);
  return match ? match[0] : str.trim() || null;
}

function extractQty(name) {
  const m = name.match(/(\d+)\s*(?:qty|QTY|Qty)/);
  return m ? parseInt(m[1]) : 1;
}

async function scrapePage(slug) {
  const url = `https://www.allaboutyourentals.com/event-rentals/${slug}/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  const html = await res.text();

  const products = [];
  // Match MasonryProduct blocks
  const blockRe = /<div class="MasonryProduct">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let block;
  while ((block = blockRe.exec(html)) !== null) {
    const chunk = block[1];
    // Image
    const imgMatch = chunk.match(/<img[^>]+src="([^"]+)"/);
    const img = imgMatch ? imgMatch[1] : '';
    // Description
    const descMatch = chunk.match(/class="rental-description"[^>]*>([\s\S]*?)<\/p>/);
    const name = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    // Price
    const priceMatch = chunk.match(/class="rental-price"[^>]*>([\s\S]*?)<\/p>/);
    const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const price = parsePrice(priceRaw);

    if (name && price) {
      const qty = extractQty(name);
      const id = slug + '-' + products.length;
      products.push({ id, name, price, priceRaw, qty, img, category: slug });
    }
  }
  return products;
}

async function main() {
  const catalog = [];
  for (const cat of CATEGORIES) {
    process.stdout.write(`Scraping: ${cat.name} ... `);
    try {
      const products = await scrapePage(cat.slug);
      // Dedupe by name
      const seen = new Set();
      const unique = products.filter(p => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      });
      catalog.push({ ...cat, id: cat.slug, products: unique });
      console.log(`${unique.length} products`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      catalog.push({ ...cat, id: cat.slug, products: [] });
    }
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 400));
  }

  const { writeFileSync } = await import('fs');
  writeFileSync('./products.json', JSON.stringify(catalog, null, 2));
  const total = catalog.reduce((s, c) => s + c.products.length, 0);
  console.log(`\n✅ Saved products.json — ${total} unique products across ${catalog.length} categories`);
}

main().catch(console.error);
