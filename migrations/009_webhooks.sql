-- ============================================================
-- Phase 7: Outbound Webhooks
-- ============================================================
-- 
-- Webhook system for integrating with external systems.
-- Events trigger webhooks with retry logic and HMAC signing.
--
-- ============================================================

-- Webhook definitions
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled) WHERE enabled = true;

-- Webhook delivery history
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt TIMESTAMP,
  next_retry TIMESTAMP,
  response_code INTEGER,
  response_body TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(status) 
  WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- View for webhook status with delivery stats
CREATE OR REPLACE VIEW webhook_status_view AS
SELECT 
  w.id,
  w.name,
  w.url,
  w.enabled,
  w.events,
  w.created_at,
  (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.webhook_id = w.id) as total_deliveries,
  (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.webhook_id = w.id AND wd.status = 'sent') as successful,
  (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.webhook_id = w.id AND wd.status = 'failed') as failed,
  (SELECT wd.last_attempt FROM webhook_deliveries wd WHERE wd.webhook_id = w.id ORDER BY wd.created_at DESC LIMIT 1) as last_delivery
FROM webhooks w;

SELECT 'Webhook schema created' as result;
