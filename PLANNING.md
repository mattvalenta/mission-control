# Planning Protocol

**Version:** 4.0 (Two-Phase Planning with clawg-ui)

## Overview

All tasks go through a two-phase planning process before execution:

1. **Phase 1: User Planning** — Skippy asks questions → User answers → Skippy optimizes & assigns
2. **Phase 2: Agent Planning** — Manager asks questions → Skippy answers → Task moves to in_progress

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER PLANNING PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│  1. User clicks "Start Planning"                                 │
│  2. MC triggers Skippy via clawg-ui                              │
│  3. Skippy generates up to 10 task-specific questions            │
│  4. Skippy POSTs to /api/tasks/{id}/planning/questions           │
│  5. User answers questions (instant transitions)                 │
│  6. MC triggers Skippy to optimize                               │
│  7. Skippy optimizes description & assigns to manager            │
│  8. Task status → "assigned", planning_stage → "agent_planning"  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT PLANNING PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Manager notified via Discord                                 │
│  2. Manager generates follow-up questions                        │
│  3. Manager POSTs to /api/tasks/{id}/planning/questions          │
│  4. Skippy detects questions via heartbeat                       │
│  5. Skippy answers automatically                                 │
│  6. Skippy POSTs to /api/tasks/{id}/planning/answers             │
│  7. Task status → "in_progress", planning_stage → "complete"     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        EXECUTION
```

## Key Principle: Simple Questions, Fast Flow

**Questions are:**
- Simple, non-technical language (for "monkeys")
- Pre-generated in a batch (up to 10 questions)
- Presented like a form — instant transitions, no waiting
- Submitted all at once when complete

## Phase 1: User Planning

### When
- Task is created with status `planning`
- Task is assigned to Skippy or no agent assigned
- `planning_stage` = `user_planning`

### Purpose
- Clarify the user's intent and requirements
- Gather context and constraints
- Optimize the task description for clarity

### Question Generation

Questions are **task-specific**, not generic templates:

```typescript
// MC triggers Skippy via clawg-ui
POST /v1/clawg-ui
{
  "messages": [{
    "role": "user",
    "content": "GENERATE_BATCH_QUESTIONS for task..."
  }],
  "agentId": "main"  // Skippy
}
```

Skippy analyzes the task and generates relevant questions, then POSTs them:
```bash
POST /api/tasks/{id}/planning/questions
{
  "questions": [
    {"id": "q1", "question": "...", "options": [...]},
    ...
  ]
}
```

### Question Format

Each question MUST be multiple choice with an "Other" option:

```json
{
  "id": "q1",
  "question": "What is the main goal of this task?",
  "options": [
    {"id": "A", "label": "Build something new"},
    {"id": "B", "label": "Fix a problem"},
    {"id": "C", "label": "Improve something existing"},
    {"id": "other", "label": "Other (please specify)"}
  ]
}
```

### After User Answers

Skippy optimizes the task:

1. **Rewrites the title** to be clear and actionable
2. **Creates a structured description** with:
   - **Objective:** What we're trying to achieve
   - **Context:** Background information
   - **Requirements:** Specific deliverables
   - **Constraints:** Limitations and requirements
   - **Success Criteria:** How to verify completion
3. **Assigns to appropriate manager** based on task type
4. **Calls transition endpoint:**

```bash
POST /api/tasks/{id}/planning/transition
{
  "optimizedDescription": "...",
  "assignedAgentId": "manager-id-here"
}
```

## Phase 2: Agent Planning

### When
- Task status is `assigned`
- `planning_stage` = `agent_planning`
- Task has been assigned to a manager

### Purpose
- Manager clarifies technical details
- Skippy provides context from his knowledge
- Ensures manager has all info needed for execution

### Manager Question Generation

1. **Manager is notified** via Discord when task is assigned
2. **Manager fetches task details** from MC API
3. **Manager generates 5-10 follow-up questions**
4. **Manager POSTs questions** to MC:

```bash
POST /api/tasks/{id}/planning/questions
{
  "questions": [...]
}
```

### Skippy Auto-Answers

1. **Heartbeat detects** task in `agent_planning` with questions
2. **Skippy fetches questions** from MC API
3. **Skippy generates answers** based on:
   - Task context and description
   - Knowledge base and memory
   - Previous user answers
4. **Skippy POSTs answers** to MC:

```bash
POST /api/tasks/{id}/planning/answers
{
  "answers": [
    {"questionId": "q1", "answer": "..."},
    ...
  ]
}
```

5. **Task moves to `in_progress`**

## Manager Notification

When Skippy assigns a task, the manager is notified via Discord:

```
**AGENT PLANNING REQUIRED** 🔧

Task: **task title**
Task ID: `task-id`
Status: `assigned` → Planning Stage: `agent_planning`

**Your next steps:**
1. GET task details: `http://localhost:4000/api/tasks/{id}`
2. Generate 5-10 follow-up questions
3. POST questions to: `http://localhost:4000/api/tasks/{id}/planning/questions`

**Do NOT start work yet.** Generate questions first.
```

## API Endpoints

| Endpoint | Method | Purpose | Caller |
|----------|--------|---------|--------|
| `/api/tasks/{id}/planning/questions/batch` | POST | Start user planning | MC Frontend |
| `/api/tasks/{id}/planning/questions/batch` | GET | Poll for questions | MC Frontend |
| `/api/tasks/{id}/planning/questions/batch` | PATCH | Submit user answers | MC Frontend |
| `/api/tasks/{id}/planning/questions` | POST | Add questions | Skippy or Manager |
| `/api/tasks/{id}/planning/answers` | POST | Submit Skippy answers | Skippy |
| `/api/tasks/{id}/planning/transition` | POST | Optimize & assign | Skippy |

1. **Optimizes the task description:**
   - Rewrites the title to be clear and actionable
   - Creates a structured description with:
     - **Objective:** What we're trying to achieve
     - **Context:** Background information
     - **Requirements:** Specific deliverables
     - **Constraints:** Limitations and requirements
     - **Success Criteria:** How to verify completion

2. **Determines the best agent:**
   - Analyzes task requirements
   - Identifies which manager (Dev/Marketing/Insights) is best suited
   - Updates `assigned_agent_id` to the appropriate manager

3. **Transitions to Stage 2:**
   - Sets `planning_stage` = `agent_planning`
   - Creates a fresh planning session for the manager

### Example Optimized Description

```markdown
# Objective
Build a REST API endpoint for user authentication.

# Context
The current system uses session-based auth. We need to migrate to JWT-based auth for mobile app support.

# Requirements
- POST /api/auth/login endpoint
- POST /api/auth/logout endpoint
- POST /api/auth/refresh endpoint
- Token expiration: 7 days
- Support for role-based permissions

# Constraints
- Must work with existing PostgreSQL database
- No external auth services (build in-house)
- Must pass security audit

# Success Criteria
- All endpoints return correct HTTP status codes
- Tokens validate correctly
- Unit tests pass with >80% coverage
- Security audit approved
```

## Stage 2: Agent Planning (Manager → Task Context)

### When
- Task has been assigned to a manager (Dev/Marketing/Insights)
- `planning_stage` = `agent_planning`
- Manager opens the task

### Purpose
- Manager asks technical/specialized questions
- Gather implementation details
- Identify dependencies and risks

### Manager Questions

Each manager type has specialized questions:

#### Dev Manager Questions
- Architecture decisions
- Technology choices
- Database schema changes
- API contracts
- Testing strategy

#### Marketing Manager Questions
- Target audience details
- Brand voice preferences
- Platform-specific requirements
- Content format
- Distribution channels

#### Insights Manager Questions
- Data sources
- Metrics to track
- Reporting format
- Stakeholder requirements
- Timeline

### After Manager Planning

When the manager has enough information:

1. Manager marks planning as complete
2. Task status changes to `assigned` or `in_progress`
3. Manager can now execute the task or spawn subagents

## Status Flow

```
[NEW TASK]
    ↓
status: planning
planning_stage: user_planning
assigned: Skippy
    ↓
[Skippy asks user questions]
    ↓
[Skippy optimizes description]
    ↓
[Skippy assigns to manager]
    ↓
status: planning
planning_stage: agent_planning
assigned: Dev/Marketing/Insights Manager
    ↓
[Manager asks clarifying questions]
    ↓
[Manager marks ready]
    ↓
status: in_progress
planning_stage: complete
    ↓
[Execution begins]
```

## API Endpoints

### Start User Planning
```
POST /api/tasks/{id}/planning
→ Starts Stage 1 planning with Skippy
```

### Submit Answer
```
POST /api/tasks/{id}/planning/answer
→ User answers Skippy's question
```

### Transition to Agent Planning
```
POST /api/tasks/{id}/planning/transition
→ Skippy optimizes description and assigns to manager
→ Starts Stage 2 planning
```

### Complete Planning
```
POST /api/tasks/{id}/planning/complete
→ Manager marks planning complete
→ Task ready for execution
```

## Database Fields

| Field | Type | Values |
|-------|------|--------|
| `planning_stage` | TEXT | `user_planning`, `agent_planning`, `complete` |
| `optimized_description` | TEXT | Skippy's rewritten description |
| `planning_messages` | TEXT | JSON array of Q&A messages |
| `planning_complete` | INTEGER | 0 or 1 |
| `planning_spec` | TEXT | JSON spec from planning |

## Frontend UI

### Stage 1 (User Planning)
- Shows Skippy's avatar and questions
- Multiple choice options with "Other" text input
- Progress indicator (Question 1 of 4)
- "Optimize & Assign" button when Skippy has enough info

### Stage 2 (Agent Planning)
- Shows Manager's avatar and specialized questions
- Technical/specialized options
- "Ready to Execute" button when Manager has enough info

### Planning Complete
- Shows optimized description
- Shows assigned manager
- Shows estimated timeline
- "Start Work" button
