-- ============================================================
-- Migration 010: Quality Reviews
-- Phase 4: Quality Review Gates Implementation
-- ============================================================

-- Add quality_review status to tasks if not already present
-- Note: This may fail if the constraint already exists with different values
DO $$
BEGIN
    -- Check if quality_review status already exists in the constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'tasks_status_check' 
        AND check_clause LIKE '%quality_review%'
    ) THEN
        -- Drop existing constraint and re-add with quality_review
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
        ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
            CHECK (status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'quality_review', 'done'));
    END IF;
END $$;

-- Create quality_reviews table
CREATE TABLE IF NOT EXISTS quality_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_id TEXT REFERENCES agents(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
    notes TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for quality_reviews
CREATE INDEX IF NOT EXISTS idx_quality_reviews_task ON quality_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_status ON quality_reviews(status);

-- Create quality_review_steps table for multi-step reviews
CREATE TABLE IF NOT EXISTS quality_review_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES quality_reviews(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
    notes TEXT,
    checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_steps_review ON quality_review_steps(review_id);

-- Add requires_review flag to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false;

-- Add reviewed_by tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_by_agent_id TEXT REFERENCES agents(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
