-- ═══════════════════════════════════════════════════════════════
-- BOOST SYSTEM SECURITY PATCH — Run in Supabase SQL Editor
-- Fixes identified in OWASP audit (2026-03-23)
-- ═══════════════════════════════════════════════════════════════

-- ── FIX 1: increment_boost_impression — require authenticated user ──
-- BUG: SECURITY DEFINER with no auth check allowed anonymous callers
-- to fake impression counts and trigger rotation penalties on competitors.
-- FIX: abort if caller is not authenticated (auth.uid() IS NULL).
-- Also set search_path to prevent schema-injection attacks.
CREATE OR REPLACE FUNCTION increment_boost_impression(p_shop_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- A01: only logged-in users can log impressions
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate date is today or yesterday (prevents backdating manipulation)
  IF p_date < CURRENT_DATE - INTERVAL '1 day' OR p_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Invalid date';
  END IF;

  INSERT INTO vendor_boost_metrics (shop_id, date, impressions)
  VALUES (p_shop_id, p_date, 1)
  ON CONFLICT (shop_id, date)
  DO UPDATE SET impressions = vendor_boost_metrics.impressions + 1;
END;
$$;

-- ── FIX 2: increment_boost_click — same auth guard + date validation ──
CREATE OR REPLACE FUNCTION increment_boost_click(p_shop_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_date < CURRENT_DATE - INTERVAL '1 day' OR p_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Invalid date';
  END IF;

  INSERT INTO vendor_boost_metrics (shop_id, date, clicks)
  VALUES (p_shop_id, p_date, 1)
  ON CONFLICT (shop_id, date)
  DO UPDATE SET clicks = vendor_boost_metrics.clicks + 1;
END;
$$;

-- ── FIX 3: expire_old_boosts — restrict to admin or postgres superuser ──
-- BUG: any authenticated user could call this and expire ALL active boosts (DoS).
-- FIX: only allow admin role users or postgres (pg_cron runs as postgres).
CREATE OR REPLACE FUNCTION expire_old_boosts()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE expired_count INTEGER;
BEGIN
  -- Allow postgres superuser (pg_cron) or admin users only
  IF current_user != 'postgres' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Admin only';
    END IF;
  END IF;

  UPDATE vendor_boosts
  SET status = 'expired'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- ── FIX 4: vendor_boosts_admin_write — add WITH CHECK for INSERT/UPDATE ──
-- BUG: using only USING clause means INSERT could bypass the policy check
-- in some Postgres versions since USING applies to row visibility, not writes.
-- FIX: separate explicit policies for INSERT and UPDATE with WITH CHECK.
DROP POLICY IF EXISTS "vendor_boosts_admin_write" ON vendor_boosts;

CREATE POLICY "vendor_boosts_admin_insert" ON vendor_boosts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "vendor_boosts_admin_update" ON vendor_boosts FOR UPDATE
  USING  (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "vendor_boosts_admin_delete" ON vendor_boosts FOR DELETE
  USING  (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ── FIX 5: boost_plans — add explicit WITH CHECK on admin write policy ──
DROP POLICY IF EXISTS "boost_plans_admin" ON boost_plans;

CREATE POLICY "boost_plans_admin_insert" ON boost_plans FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "boost_plans_admin_update" ON boost_plans FOR UPDATE
  USING  (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "boost_plans_admin_delete" ON boost_plans FOR DELETE
  USING  (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ── FIX 6: vendor_boost_metrics — add explicit NO direct write policy ──
-- The table should only be written via SECURITY DEFINER RPCs, never directly.
-- Ensure no accidental INSERT/UPDATE/DELETE policies exist for non-RPC callers.
DROP POLICY IF EXISTS "boost_metrics_write" ON vendor_boost_metrics;

-- Verify policies: SELECT * FROM pg_policies WHERE tablename IN ('boost_plans','vendor_boosts','vendor_boost_metrics');
