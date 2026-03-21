-- ============================================================
-- Welokl — Subscription feature migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Subscription plans (created by shop owners)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,          -- "Daily 1L Milk", "Morning Tiffin"
  description   TEXT,
  price         NUMERIC NOT NULL,       -- price per delivery (₹)
  delivery_time TEXT DEFAULT '07:00',  -- preferred delivery time e.g. "07:00"
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Customer subscriptions
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id          UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status           TEXT DEFAULT 'active',  -- 'active' | 'paused' | 'cancelled'
  delivery_address TEXT,
  delivery_lat     NUMERIC,
  delivery_lng     NUMERIC,
  delivery_time    TEXT,                   -- override plan delivery_time if set
  pause_until      DATE,                   -- pause until this date (null = not paused)
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans: anyone can read active ones; only shop owner can write
CREATE POLICY "plans_public_read"  ON subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "plans_owner_write"  ON subscription_plans FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- Subscriptions: customers manage their own; shop owners can read their shop's
CREATE POLICY "subs_customer_all"  ON customer_subscriptions FOR ALL
  USING (customer_id = auth.uid());
CREATE POLICY "subs_shop_read"     ON customer_subscriptions FOR SELECT
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_sub_plans_shop    ON subscription_plans(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_subs_shop ON customer_subscriptions(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_subs_cust ON customer_subscriptions(customer_id, status);
