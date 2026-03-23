-- ── Schedule expire_old_boosts() daily ──────────────────────────
-- pg_cron is pre-installed on all Supabase projects.
-- Run this once in the SQL editor.

-- 18:30 UTC = 00:00 IST (midnight India time)
SELECT cron.schedule(
  'expire-old-boosts',           -- job name (unique)
  '30 18 * * *',                 -- cron: every day at 18:30 UTC
  $$SELECT expire_old_boosts()$$ -- the function we created
);

-- Verify it was registered:
-- SELECT * FROM cron.job;

-- To remove it later:
-- SELECT cron.unschedule('expire-old-boosts');
