# Phase 3: Token Usage Tracking

**Duration:** 1 Week  
**Priority:** 🟡 Medium  
**Risk Level:** Low  
**Dependencies:** Phase 1 (PostgreSQL Migration)

---

## Objective

Implement comprehensive token usage tracking for all LLM API calls. This provides visibility into costs per agent, per model, per task.

---

## Success Criteria

- [ ] All API calls logged to token_usage table
- [ ] Cost calculated per model pricing
- [ ] Dashboard shows usage by agent/model/day
- [ ] Historical trends available
- [ ] Cost alerts configured

---

## Day 1-2: Schema & API

### Tasks

#### 1.1 Create Token Usage Schema
- [ ] Create migration file
- [ ] Add token_usage table
- [ ] Add indexes

```sql
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_usage_agent ON token_usage(agent_id);
CREATE INDEX idx_token_usage_task ON token_usage(task_id);
CREATE INDEX idx_token_usage_date ON token_usage(created_at);
CREATE INDEX idx_token_usage_model ON token_usage(model);
```

#### 1.2 Create Token Pricing Module
- [ ] Create `src/lib/token-pricing.ts`
- [ ] Define pricing for all models
- [ ] Implement cost calculation

```typescript
const MODEL_PRICING = {
  // OpenAI (per 1M tokens)
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  
  // Anthropic
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku': { input: 0.80, output: 4.00 },
  
  // OpenRouter
  'openrouter/auto': { input: 1.00, output: 3.00 },
  
  // Add more as needed
};

export function calculateCost(model, inputTokens, outputTokens): number
export function recordTokenUsage(data): Promise<{ totalTokens, cost }>
```

#### 1.3 Create API Endpoints
- [ ] `POST /api/tokens` - Record usage
- [ ] `GET /api/tokens` - List usage with filters
- [ ] `GET /api/tokens/summary` - Aggregated stats
- [ ] `GET /api/tokens/trends` - Time-series data

---

## Day 3-4: Integration

### Tasks

#### 2.1 Integrate with Agent Dispatch
- [ ] Add token tracking to dispatch flow
- [ ] Track tokens in agent responses
- [ ] Log to token_usage table

**In dispatch route:**
```typescript
// After agent completes
if (response.usage) {
  await recordTokenUsage({
    agentId: agent.id,
    taskId: task.id,
    model: agent.model,
    inputTokens: response.usage.prompt_tokens,
    outputTokens: response.usage.completion_tokens
  });
}
```

#### 2.2 Create Token Dashboard Component
- [ ] Create `src/components/TokenUsageDashboard.tsx`
- [ ] Show usage by agent (pie chart)
- [ ] Show usage by model (bar chart)
- [ ] Show daily trend (line chart)
- [ ] Show total cost

---

## Day 5: Testing & Polish

### Tasks

#### 3.1 Testing
- [ ] Token recording works
- [ ] Cost calculation accurate
- [ ] Dashboard renders correctly
- [ ] Filters work (by agent, model, date range)

#### 3.2 Cost Alerts (Optional)
- [ ] Add daily cost threshold
- [ ] Alert when threshold exceeded
- [ ] Notify via Discord/webhook

---

## API Reference

### POST /api/tokens
Record token usage.

```typescript
// Request
{
  "sessionId": "optional",
  "agentId": "dev-manager",
  "taskId": "task-123",
  "model": "gpt-4o",
  "inputTokens": 1500,
  "outputTokens": 800
}

// Response
{
  "id": "uuid",
  "totalTokens": 2300,
  "cost": 0.0115
}
```

### GET /api/tokens
List token usage with filters.

```
GET /api/tokens?agentId=dev-manager&startDate=2026-03-01&endDate=2026-03-07
```

### GET /api/tokens/summary
Aggregated statistics.

```typescript
// Response
{
  "totalTokens": 1500000,
  "totalCost": 45.50,
  "byAgent": [
    { "agentId": "dev-manager", "tokens": 500000, "cost": 15.00 }
  ],
  "byModel": [
    { "model": "gpt-4o", "tokens": 800000, "cost": 30.00 }
  ]
}
```

---

## Files Changed

### New Files
- `src/lib/token-pricing.ts`
- `src/app/api/tokens/route.ts`
- `src/app/api/tokens/summary/route.ts`
- `src/app/api/tokens/trends/route.ts`
- `src/components/TokenUsageDashboard.tsx`
- `migrations/005_token_usage.sql`

### Modified Files
- `src/app/api/tasks/[id]/dispatch/route.ts` - Add tracking
- `src/app/(dashboard)/tokens/page.tsx` - New page
- `src/components/Header.tsx` - Add nav link

---

## Model Pricing Reference

| Model | Input ($/1M) | Output ($/1M) |
|-------|-------------|---------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| claude-3-5-sonnet | $3.00 | $15.00 |
| claude-3-5-haiku | $0.80 | $4.00 |
| openrouter/auto | $1.00 | $3.00 |

---

## Sign-Off

- [ ] Token recording working
- [ ] Cost calculation accurate
- [ ] Dashboard complete
- [ ] Testing passed

**Approved by:** ________________  
**Date:** ________________
