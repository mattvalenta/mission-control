-- Migration: Add deny functionality to social media posts
-- Adds denied status for posts pending review

ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS denied BOOLEAN DEFAULT FALSE;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS denied_at TIMESTAMP;

-- Add constraint to ensure mutual exclusivity between approved and denied
-- A post cannot be both approved and denied
ALTER TABLE social_media_posts ADD CONSTRAINT check_approval_status 
  CHECK (NOT (approved = TRUE AND denied = TRUE));

-- Create index for querying denied posts
CREATE INDEX IF NOT EXISTS idx_social_posts_denied ON social_media_posts(denied);
