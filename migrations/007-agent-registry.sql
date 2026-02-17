-- Migration: Add agent registry columns
ALTER TABLE agents ADD COLUMN webhook_url TEXT;
ALTER TABLE agents ADD COLUMN machine_hostname TEXT;
ALTER TABLE agents ADD COLUMN openclaw_host TEXT;
ALTER TABLE agents ADD COLUMN poll_interval_ms INTEGER DEFAULT 30000;
ALTER TABLE agents ADD COLUMN capabilities TEXT;
ALTER TABLE agents ADD COLUMN last_heartbeat TEXT;
