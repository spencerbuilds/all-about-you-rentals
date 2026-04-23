-- ============================================================
-- All About You Rentals — Supabase Database Schema
-- Run this once in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Products ────────────────────────────────────────────────
create table if not exists products (
  id           text primary key,          -- e.g. "backdrops-arches-0"
  name         text not null,
  category     text not null,
  category_slug text not null,
  price        text not null,             -- "$12.50" (display string)
  price_cents  integer generated always as (
    (regexp_replace(price, '[^0-9.]', '', 'g')::numeric * 100)::integer
  ) stored,
  total_qty    integer not null default 1,
  available_qty integer not null default 1,
  img          text,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index on products(category_slug);
create index on products(active);

-- ── Bookings ────────────────────────────────────────────────
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text,
  event_date      date not null,
  event_type      text,                   -- Wedding, Corporate, Birthday, Other
  fulfillment     text default 'pickup',  -- pickup | delivery
  notes           text,
  subtotal        numeric(10,2),
  status          text not null default 'pending',
    -- pending | confirmed | denied | picked_up | returned | cancelled
  admin_notes     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on bookings(event_date);
create index on bookings(status);
create index on bookings(customer_email);

-- ── Booking Items ────────────────────────────────────────────
create table if not exists booking_items (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  product_id   text not null references products(id),
  product_name text not null,             -- snapshot at time of booking
  qty          integer not null default 1,
  price        text not null,             -- snapshot at time of booking
  created_at   timestamptz default now()
);

create index on booking_items(booking_id);
create index on booking_items(product_id);

-- ── Updated_at trigger ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_products_updated_at
  before update on products
  for each row execute function update_updated_at();

create trigger set_bookings_updated_at
  before update on bookings
  for each row execute function update_updated_at();

-- ── Row Level Security ──────────────────────────────────────
-- Products: anyone can read, only service role can write
alter table products enable row level security;
create policy "Public can read active products"
  on products for select using (active = true);

-- Bookings: only service role (via API) can read/write
alter table bookings enable row level security;
-- No public policies — all booking access goes through our API

-- Booking items: same
alter table booking_items enable row level security;

-- ── Useful views ────────────────────────────────────────────
create or replace view booking_summary as
select
  b.id,
  b.customer_name,
  b.customer_email,
  b.event_date,
  b.event_type,
  b.fulfillment,
  b.subtotal,
  b.status,
  b.created_at,
  count(bi.id) as item_count
from bookings b
left join booking_items bi on bi.booking_id = b.id
group by b.id
order by b.created_at desc;

-- ============================================================
-- DONE. Next steps:
-- 1. Go to Supabase > Project Settings > API
-- 2. Copy your Project URL and service_role key
-- 3. Add them to Vercel Environment Variables:
--    SUPABASE_URL=https://xxxx.supabase.co
--    SUPABASE_SERVICE_KEY=eyJ...
--    ADMIN_PASSWORD=choose-a-password
--    ADMIN_SECRET=choose-a-long-random-secret
--    RESEND_API_KEY=re_xxx (from resend.com, free tier)
--    ADMIN_EMAIL=your@email.com
-- 4. After deploying, POST to /api/inventory?action=seed
--    with Authorization: Bearer <ADMIN_SECRET> to seed products
-- ============================================================
