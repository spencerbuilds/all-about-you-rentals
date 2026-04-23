// api/bookings.js — Vercel serverless function
// POST /api/bookings  → create a new booking request
// GET  /api/bookings  → list all bookings (admin only)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'spencerdaems@gmail.com';
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
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  return method === 'DELETE' ? null : res.json();
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return; // Skip email if not configured
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'All About You Rentals <bookings@allaboutyourentals.com>',
      to,
      subject,
      html,
    }),
  });
}

function buildAdminEmailHtml(booking, items) {
  const itemRows = items.map(i =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.price}</td></tr>`
  ).join('');
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#B07068">New Booking Request</h2>
      <p><strong>Customer:</strong> ${booking.customer_name}</p>
      <p><strong>Email:</strong> ${booking.customer_email}</p>
      <p><strong>Phone:</strong> ${booking.customer_phone}</p>
      <p><strong>Event Date:</strong> ${booking.event_date}</p>
      <p><strong>Event Type:</strong> ${booking.event_type}</p>
      <p><strong>Fulfillment:</strong> ${booking.fulfillment}</p>
      <p><strong>Notes:</strong> ${booking.notes || 'None'}</p>
      <h3>Items Requested</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f5f0eb">
          <th style="padding:8px;text-align:left">Item</th>
          <th style="padding:8px;text-align:center">Qty</th>
          <th style="padding:8px;text-align:right">Price</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="margin-top:16px"><strong>Subtotal: $${booking.subtotal.toFixed(2)}</strong></p>
      <p style="margin-top:24px">
        <a href="${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/admin.html"
           style="background:#B07068;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none">
          View in Admin Panel
        </a>
      </p>
    </div>`;
}

function buildCustomerEmailHtml(booking) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#B07068">Booking Request Received!</h2>
      <p>Hi ${booking.customer_name},</p>
      <p>Thank you for your rental request! Christina will review your order and be in touch within 24–48 hours to confirm availability and finalize details.</p>
      <p><strong>Event Date:</strong> ${booking.event_date}</p>
      <p><strong>Booking Reference:</strong> #${booking.id?.toString().slice(0,8).toUpperCase()}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:13px;color:#888">All About You Rentals · Highland, UT · (801) 669-1201</p>
    </div>`;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: list bookings (admin only) ──────────────────────────────
    if (req.method === 'GET') {
      const auth = req.headers.authorization;
      if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const bookings = await supabase('/bookings?select=*,booking_items(*)&order=created_at.desc');
      return res.status(200).json(bookings);
    }

    // ── POST: create booking ─────────────────────────────────────────
    if (req.method === 'POST') {
      const { customer_name, customer_email, customer_phone, event_date,
              event_type, fulfillment, notes, items } = req.body;

      // Basic validation
      if (!customer_name || !customer_email || !event_date || !items?.length) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Calculate subtotal
      const subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.price?.replace(/[^0-9.]/g, '') || 0);
        return sum + price * (item.qty || 1);
      }, 0);

      // Create booking record
      const [booking] = await supabase('/bookings', 'POST', {
        customer_name, customer_email, customer_phone,
        event_date, event_type, fulfillment: fulfillment || 'pickup',
        notes, subtotal, status: 'pending',
      });

      // Create booking items
      const bookingItems = items.map(item => ({
        booking_id: booking.id,
        product_id: item.id,
        product_name: item.name,
        qty: item.qty || 1,
        price: item.price,
      }));
      await supabase('/booking_items', 'POST', bookingItems);

      // Send emails
      await Promise.all([
        sendEmail(ADMIN_EMAIL, `New Booking Request from ${customer_name}`,
          buildAdminEmailHtml({ ...booking, subtotal }, items)),
        sendEmail(customer_email, 'Your Rental Request — All About You Rentals',
          buildCustomerEmailHtml(booking)),
      ]);

      return res.status(201).json({
        success: true,
        bookingId: booking.id,
        message: 'Booking request submitted successfully!',
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: err.message });
  }
}
