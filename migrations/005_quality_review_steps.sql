-- ============================================================
-- Quality Review Steps Table
-- ============================================================
-- 
-- Tracks multi-step quality review workflows.
-- Each review can have multiple steps/approvers.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS quality_review_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES quality_reviews(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL DEFAULT 1,
  step_name TEXT NOT NULL,
  reviewer_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  notes TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying steps by review
CREATE INDEX IF NOT EXISTS idx_quality_review_steps_review 
  ON quality_review_steps(review_id);

-- Index for querying by reviewer
CREATE INDEX IF NOT EXISTS idx_quality_review_steps_reviewer 
  ON quality_review_steps(reviewer_id);

-- Ensure step numbers are unique per review
CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_review_steps_unique 
  ON quality_review_steps(review_id, step_number);

-- View for complete review status with steps
CREATE OR REPLACE VIEW review_status_complete AS
SELECT 
  qr.id as review_id,
  qr.task_id,
  qr.status as overall_status,
  qr.notes as review_notes,
  qr.created_at,
  COUNT(qrs.id) as total_steps,
  COUNT(qrs.id) FILTER (WHERE qrs.status = 'approved') as approved_steps,
  COUNT(qrs.id) FILTER (WHERE qrs.status = 'rejected') as rejected_steps,
  COUNT(qrs.id) FILTER (WHERE qrs.status = 'pending') as pending_steps
FROM quality_reviews qr
LEFT JOIN quality_review_steps qrs ON qr.id = qrs.review_id
GROUP BY qr.id, qr.task_id, qr.status, qr.notes, qr.created_at;

-- Function to auto-create review steps when review is created
CREATE OR REPLACE FUNCTION create_review_steps()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a double review (high/urgent priority)
  IF EXISTS (
    SELECT 1 FROM tasks 
    WHERE id = NEW.task_id 
    AND (priority = 'high' OR priority = 'urgent')
  ) THEN
    -- Create step 1: Manager review
    INSERT INTO quality_review_steps (review_id, step_number, step_name, status)
    VALUES (NEW.id, 1, 'Manager Review', 'pending');
    
    -- Create step 2: Master agent review
    INSERT INTO quality_review_steps (review_id, step_number, step_name, status)
    VALUES (NEW.id, 2, 'Master Agent Review', 'pending');
  ELSE
    -- Single review
    INSERT INTO quality_review_steps (review_id, step_number, step_name, status)
    VALUES (NEW.id, 1, 'Quality Review', 'pending');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create steps
DROP TRIGGER IF EXISTS auto_create_review_steps ON quality_reviews;
CREATE TRIGGER auto_create_review_steps
AFTER INSERT ON quality_reviews
FOR EACH ROW
EXECUTE FUNCTION create_review_steps();

SELECT 'quality_review_steps table created' as result;
