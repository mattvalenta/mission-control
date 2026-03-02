-- ============================================================
-- Mission Control Instances Table
-- ============================================================
-- 
-- Tracks all MC instances for health monitoring and
-- distributed job coordination.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS mc_instances (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'worker')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
  last_heartbeat TIMESTAMP,
  started_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_instances_status ON mc_instances(status);
CREATE INDEX IF NOT EXISTS idx_mc_instances_heartbeat ON mc_instances(last_heartbeat DESC);

-- View for active instances
CREATE OR REPLACE VIEW active_instances AS
SELECT * FROM mc_instances 
WHERE status = 'online' 
  AND last_heartbeat > NOW() - INTERVAL '5 minutes'
ORDER BY last_heartbeat DESC;

SELECT 'mc_instances table created' as result;
