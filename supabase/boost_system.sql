-- ═══════════════════════════════════════════════════════════════
-- WELOKL VENDOR BOOST SYSTEM — Migration
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. BOOST PLANS ───────────────────────────────────────────────
-- Admin-managed tiers. boost_weight is added directly to shop score.
CREATE TABLE IF NOT EXISTS boost_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,           -- 'Basic', 'Featured', 'Premium'
  badge_label     TEXT NOT NULL,           -- shown on card: 'Sponsored', 'Featured', 'Premium'
  badge_color     TEXT NOT NULL DEFAULT '#6b7280',  -- hex colour for badge
  boost_weight    INTEGER NOT NULL,        -- raw score bonus: 20 / 50 / 100
  price_weekly    NUMERIC(10,2) NOT NULL,
  price_monthly   NUMERIC(10,2) NOT NULL,
  max_concurrent  INTEGER DEFAULT NULL,    -- NULL = unlimited slots for this plan
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. VENDOR BOOSTS ─────────────────────────────────────────────
-- Which shop has which plan and for how long.
-- Only one ACTIVE boost per shop at a time (partial unique index).
CREATE TABLE IF NOT EXISTS vendor_boosts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  plan_id     UUID NOT NULL REFERENCES boost_plans(id) ON DELETE RESTRICT,
  start_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
  admin_note  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active boost per shop
CREATE UNIQUE INDEX IF NOT EXISTS vendor_boosts_one_active
  ON vendor_boosts(shop_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_vendor_boosts_shop   ON vendor_boosts(shop_id);
CREATE INDEX IF NOT EXISTS idx_vendor_boosts_status ON vendor_boosts(status);
CREATE INDEX IF NOT EXISTS idx_vendor_boosts_end    ON vendor_boosts(end_date);

-- ── 3. DAILY METRICS ─────────────────────────────────────────────
-- Aggregated per-shop per-day. Used for rotation fairness + analytics.
-- Incrementing via RPC (upsert) keeps writes cheap.
CREATE TABLE IF NOT EXISTS vendor_boost_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions INTEGER DEFAULT 0,   -- times shop appeared in boosted feed section
  clicks      INTEGER DEFAULT 0,   -- times user tapped the shop card
  orders      INTEGER DEFAULT 0,   -- orders placed (linked via order created_at = same day)
  UNIQUE(shop_id, date)
);

CREATE INDEX IF NOT EXISTS idx_boost_metrics_date ON vendor_boost_metrics(shop_id, date);

-- ── 4. RPC FUNCTIONS ─────────────────────────────────────────────
-- Atomic increment helpers called from client.
-- SECURITY DEFINER so anon/authed users can increment without direct table access.

CREATE OR REPLACE FUNCTION increment_boost_impression(p_shop_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO vendor_boost_metrics (shop_id, date, impressions)
  VALUES (p_shop_id, p_date, 1)
  ON CONFLICT (shop_id, date)
  DO UPDATE SET impressions = vendor_boost_metrics.impressions + 1;
END;
$$;

CREATE OR REPLACE FUNCTION increment_boost_click(p_shop_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO vendor_boost_metrics (shop_id, date, clicks)
  VALUES (p_shop_id, p_date, 1)
  ON CONFLICT (shop_id, date)
  DO UPDATE SET clicks = vendor_boost_metrics.clicks + 1;
END;
$$;

-- Auto-expire boosts whose end_date has passed (call daily via pg_cron or Supabase scheduled function)
CREATE OR REPLACE FUNCTION expire_old_boosts()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE expired_count INTEGER;
BEGIN
  UPDATE vendor_boosts
  SET status = 'expired'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE boost_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_boosts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_boost_metrics  ENABLE ROW LEVEL SECURITY;

-- boost_plans: anyone can read active plans, only admin can write
CREATE POLICY "boost_plans_read"   ON boost_plans FOR SELECT USING (true);
CREATE POLICY "boost_plans_admin"  ON boost_plans FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- vendor_boosts: read by owner + admin, write admin only
CREATE POLICY "vendor_boosts_owner_read" ON vendor_boosts FOR SELECT
  USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "vendor_boosts_admin_write" ON vendor_boosts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- vendor_boost_metrics: read by owner + admin, increment via RPC only
CREATE POLICY "boost_metrics_read" ON vendor_boost_metrics FOR SELECT
  USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 6. SEED DEFAULT PLANS ────────────────────────────────────────
INSERT INTO boost_plans (name, badge_label, badge_color, boost_weight, price_weekly, price_monthly) VALUES
  ('Basic',    'Sponsored', '#6b7280',  20,   499,  1499),
  ('Featured', 'Featured',  '#f59e0b',  50,  1199,  3499),
  ('Premium',  'Premium',   '#8b5cf6', 100,  2499,  6999)
ON CONFLICT DO NOTHING;
