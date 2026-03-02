# Phase 4: Quality Review Gates

**Duration:** 1 Week  
**Priority:** 🟡 Medium  
**Risk Level:** Low  
**Dependencies:** Phase 1 (PostgreSQL Migration)

---

## Objective

Implement formal approval workflow that blocks task completion without sign-off. This ensures quality control for critical work.

---

## Success Criteria

- [ ] Tasks can require approval before completion
- [ ] Review history tracked
- [ ] Notification on review submission
- [ ] Workflow enforces approval gate

---

## Day 1-2: Schema & API

### Tasks

#### 1.1 Create Quality Review Schema
- [ ] Add `quality_review` status to tasks
- [ ] Create quality_reviews table

```sql
-- Add quality_review status
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'quality_review', 'done'));

-- Quality reviews table
CREATE TABLE quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_reviews_task ON quality_reviews(task_id);
CREATE INDEX idx_quality_reviews_status ON quality_reviews(status);
```

#### 1.2 Create API Endpoints
- [ ] `POST /api/tasks/:id/review` - Submit review
- [ ] `GET /api/tasks/:id/reviews` - List reviews

---

## Day 3-4: Workflow Integration

### Tasks

#### 2.1 Update Task Status Flow
- [ ] Agent completes work → `review`
- [ ] Reviewer approves → `quality_review`
- [ ] Master approves → `done`
- [ ] Reviewer rejects → `in_progress`

```
... → in_progress → testing → review → quality_review → done
                                    ↓
                              rejected → in_progress
```

#### 2.2 Update Dispatch Logic
- [ ] Check if task requires review
- [ ] Block completion without approval
- [ ] Notify reviewer when task ready for review

#### 2.3 Create Review UI Component
- [ ] Create `src/components/QualityReviewPanel.tsx`
- [ ] Show review history
- [ ] Add approve/reject buttons
- [ ] Add notes field

---

## Day 5: Testing

### Tasks

#### 3.1 Testing
- [ ] Review submission works
- [ ] Status transitions correctly
- [ ] Review history displayed
- [ ] Notifications sent

---

## Workflow Rules

### When Review Required
- High priority tasks
- Deployment tasks
- Tasks with `requires_review: true`
- Tasks assigned to subagents

### Review States

| Status | Meaning | Next State |
|--------|---------|------------|
| pending | Awaiting review | approved/rejected |
| approved | Reviewer approved | → quality_review |
| rejected | Reviewer rejected | → in_progress |
| changes_requested | Needs rework | → in_progress |

---

## API Reference

### POST /api/tasks/:id/review
Submit a quality review.

```typescript
// Request
{
  "status": "approved",
  "notes": "Looks good, LGTM"
}

// Response
{
  "id": "uuid",
  "taskId": "task-123",
  "status": "approved",
  "reviewedAt": "2026-03-01T12:00:00Z"
}
```

---

## Files Changed

### New Files
- `src/app/api/tasks/[id]/review/route.ts`
- `src/app/api/tasks/[id]/reviews/route.ts`
- `src/components/QualityReviewPanel.tsx`
- `migrations/006_quality_reviews.sql`

### Modified Files
- `src/lib/types.ts` - Add quality review types
- `src/components/TaskModal.tsx` - Add review section
- `src/app/api/tasks/[id]/route.ts` - Status validation

---

## Sign-Off

- [ ] Schema created
- [ ] API endpoints working
- [ ] Workflow enforced
- [ ] UI complete

**Approved by:** ________________  
**Date:** ________________
