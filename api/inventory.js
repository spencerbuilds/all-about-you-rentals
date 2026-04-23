// api/inventory.js — Vercel serverless function
// GET  /api/inventory           → get all products with availability
// GET  /api/inventory?date=X    → get availability for a specific date
// PUT  /api/inventory/:id       → update product qty (admin)
// POST /api/inventory/seed      → seed products from products.json (admin, run once)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function supabase(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${err}`);
  }
  return method === 'DELETE' || method === 'PATCH' ? null : res.json();
}

function isAdmin(req) {
  return req.headers.authorization === `Bearer ${ADMIN_SECRET}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, date, action } = req.query;

  try {
    // ── GET: fetch products + availability ───────────────────────────
    if (req.method === 'GET') {
      if (date) {
        // Get items already booked on this date (confirmed bookings)
        const booked = await supabase(
          `/booking_items?select=product_id,qty,bookings!inner(event_date,status)` +
          `&bookings.event_date=eq.${date}&bookings.status=in.(confirmed,pending)`
        );
        // Build a map: product_id → qty booked
        const bookedMap = {};
        booked.forEach(b => {
          bookedMap[b.product_id] = (bookedMap[b.product_id] || 0) + b.qty;
        });
        const products = await supabase('/products?select=*&order=category,name');
        const withAvailability = products.map(p => ({
          ...p,
          available_on_date: Math.max(0, p.total_qty - (bookedMap[p.id] || 0)),
        }));
        return res.status(200).json(withAvailability);
      }

      // Return all products
      const products = await supabase('/products?select=*&order=category,name');
      return res.status(200).json(products);
    }

    // ── PATCH: update a product's qty (admin) ────────────────────────
    if (req.method === 'PATCH') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      if (!id) return res.status(400).json({ error: 'Missing product id' });
      const updates = req.body; // { total_qty, name, price, etc. }
      await supabase(`/products?id=eq.${id}`, 'PATCH', updates);
      return res.status(200).json({ success: true });
    }

    // ── POST /api/inventory/seed: populate products table (admin, run once) ──
    if (req.method === 'POST' && action === 'seed') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

      // Load products.json
      const { readFileSync } = await import('fs');
      const { join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const raw = readFileSync(join(__dirname, '../products.json'), 'utf-8');
      const catalog = JSON.parse(raw);

      let inserted = 0;
      for (const category of catalog) {
        for (const p of category.products) {
          try {
            await supabase('/products', 'POST', {
              id: p.id,
              name: p.name,
              category: category.name,
              category_slug: category.id,
              price: p.price,
              total_qty: p.qty || 1,
              available_qty: p.qty || 1,
              img: p.img,
              active: true,
            });
            inserted++;
          } catch (e) {
            // Skip duplicates
          }
        }
      }
      return res.status(200).json({ success: true, inserted });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Inventory error:', err);
    return res.status(500).json({ error: err.message });
  }
}
