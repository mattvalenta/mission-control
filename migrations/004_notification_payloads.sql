-- ============================================================
-- Notification Payloads Table
-- ============================================================
-- 
-- Stores large notification payloads that exceed PostgreSQL's
-- 8KB NOTIFY limit. Notifications reference these payloads by ID.
--
-- ============================================================

-- Create notification_payloads table
CREATE TABLE IF NOT EXISTS notification_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_notification_payloads_created 
  ON notification_payloads(created_at);

-- Auto-cleanup function (call periodically or via cron)
CREATE OR REPLACE FUNCTION cleanup_old_notification_payloads()
RETURNS void AS $$
BEGIN
  DELETE FROM notification_payloads 
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule cleanup every hour (requires pg_cron extension)
-- SELECT cron.schedule('cleanup_notifications', '0 * * * *', 
--   'SELECT cleanup_old_notification_payloads();');

SELECT 'notification_payloads table created' as result;
