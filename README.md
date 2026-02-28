# Welokl — Your Neighbourhood, Delivered

> A hyperlocal marketplace for every local shop. Food, grocery, pharmacy, electronics, salon & more — delivered or pick up yourself. UPI & Cash on Delivery.

## Tech Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Auth, Postgres, Realtime)
- **Tailwind CSS** (custom design system)
- **Zustand** (cart state, persisted)
- **Vercel** (deployment)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# 3. Run Supabase schema
# → paste supabase/schema.sql into Supabase SQL Editor

# 4. Start local dev
npm run dev
# → http://localhost:3000
```

## Setup Guide

### 1. Supabase
- Create project at supabase.com
- SQL Editor → run `supabase/schema.sql`
- Database → Replication → enable for `orders`, `delivery_partners`
- Settings → API → copy URL + anon key + service_role key

### 2. Run seed data
- Sign up as a business user at /auth/signup
- Supabase SQL Editor → run `supabase/seed.sql`

### 3. Test accounts
Create these at /auth/signup:
- `customer@demo.com` — role: customer
- `business@demo.com` — role: business
- `delivery@demo.com` — role: delivery

Make admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@demo.com';
```

### 4. Deploy to Vercel
- Push to GitHub
- Import at vercel.com
- Add env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL)
- Deploy

## Roles & Dashboards

| Role | Dashboard | Key Actions |
|------|-----------|-------------|
| Customer | /dashboard/customer | Browse shops, order, track live |
| Business | /dashboard/business | Accept orders, manage products, view revenue |
| Delivery | /dashboard/delivery | Go online, get assigned, pick up, deliver, earn |
| Admin | /dashboard/admin | Platform analytics, shop control, order override |

## Payment Methods
- **UPI** — customer enters UPI transaction ID after paying
- **Cash on Delivery** — pay when order arrives
- No Stripe, no card — India-first

## Revenue Model
Per delivered order:
- Platform commission: 15% of subtotal (configurable per shop)
- Delivery margin: delivery fee charged − ₹20 paid to partner = ₹5
- Platform fee: flat ₹5
- Delivery partner earns: ₹20 per delivery (wallet credited automatically)
