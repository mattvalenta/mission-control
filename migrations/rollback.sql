-- ============================================================
-- Mission Control PostgreSQL Rollback Script
-- ============================================================
-- 
-- This script drops all Mission Control tables in the correct order
-- to handle foreign key constraints.
--
-- WARNING: This will DELETE ALL DATA!
-- Only use this if the migration fails and you need to start over.
--
-- Usage:
--   psql $POSTGRES_URL -f migrations/rollback.sql
--
-- ============================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS dead_letter_queue CASCADE;
DROP TABLE IF EXISTS job_executions CASCADE;
DROP TABLE IF EXISTS scheduled_jobs CASCADE;
DROP TABLE IF EXISTS metrics CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS quality_reviews CASCADE;
DROP TABLE IF EXISTS token_usage CASCADE;
DROP TABLE IF EXISTS memory_files CASCADE;
DROP TABLE IF EXISTS task_deliverables CASCADE;
DROP TABLE IF EXISTS task_activities CASCADE;
DROP TABLE IF EXISTS planning_specs CASCADE;
DROP TABLE IF EXISTS planning_questions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS openclaw_sessions CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS mc_instances CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS task_notify ON tasks;
DROP TRIGGER IF EXISTS agent_notify ON agents;

-- Drop functions
DROP FUNCTION IF EXISTS notify_task_change();
DROP FUNCTION IF EXISTS notify_agent_change();

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Success message
SELECT '✅ Rollback complete. All Mission Control tables dropped.' as result;
