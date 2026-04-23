// api/admin.js — Vercel serverless function
// POST /api/admin/login             → verify admin password, return token
// PATCH /api/admin/bookings/:id     → update booking status
// DELETE /api/admin/bookings/:id    → delete a booking

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function supabase(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function isAdmin(req) {
  return req.headers.authorization === `Bearer ${ADMIN_SECRET}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id } = req.query;

  try {
    // ── POST /api/admin?action=login ─────────────────────────────────
    if (req.method === 'POST' && action === 'login') {
      const { password } = req.body;
      if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      return res.status(200).json({ token: ADMIN_SECRET });
    }

    // All other routes require admin auth
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    // ── GET /api/admin?action=bookings ───────────────────────────────
    if (req.method === 'GET' && action === 'bookings') {
      const bookings = await supabase(
        '/bookings?select=*,booking_items(*)&order=created_at.desc'
      );
      return res.status(200).json(bookings);
    }

    // ── GET /api/admin?action=stats ──────────────────────────────────
    if (req.method === 'GET' && action === 'stats') {
      const [all, pending, confirmed] = await Promise.all([
        supabase('/bookings?select=id,subtotal'),
        supabase('/bookings?select=id&status=eq.pending'),
        supabase('/bookings?select=id,subtotal&status=eq.confirmed'),
      ]);
      const revenue = confirmed.reduce((s, b) => s + (b.subtotal || 0), 0);
      return res.status(200).json({
        total: all.length,
        pending: pending.length,
        confirmed: confirmed.length,
        revenue: revenue.toFixed(2),
      });
    }

    // ── PATCH /api/admin?action=booking&id=X ─────────────────────────
    if (req.method === 'PATCH' && action === 'booking' && id) {
      const updates = req.body; // { status: 'confirmed' | 'denied' | 'completed' }
      const result = await supabase(`/bookings?id=eq.${id}`, 'PATCH', {
        ...updates,
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json({ success: true, booking: result?.[0] });
    }

    // ── DELETE /api/admin?action=booking&id=X ────────────────────────
    if (req.method === 'DELETE' && action === 'booking' && id) {
      await supabase(`/booking_items?booking_id=eq.${id}`, 'DELETE');
      await supabase(`/bookings?id=eq.${id}`, 'DELETE');
      return res.status(200).json({ success: true });
    }

    // ── PATCH /api/admin?action=product&id=X ─────────────────────────
    if (req.method === 'PATCH' && action === 'product' && id) {
      await supabase(`/products?id=eq.${encodeURIComponent(id)}`, 'PATCH', req.body);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Admin error:', err);
    return res.status(500).json({ error: err.message });
  }
}
