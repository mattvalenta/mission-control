# CLAWG-UI Integration for Mission Control

**Purpose:** Enable robust, retry-capable communication between Mission Control app and OpenClaw agents (Skippy, Dev Manager, Marketing Manager, Insights Manager).

**Why clawg-ui?**
- AG-UI protocol with SSE streaming for real-time responses
- Device pairing auth (no master token exposure)
- Proper error handling and retry mechanisms
- Can route to specific agents via headers

## Architecture

```
┌─────────────────────┐
│  Mission Control    │
│  (Next.js App)      │
└──────────┬──────────┘
           │
           │ POST /v1/clawg-ui
           │ Authorization: Bearer <device-token>
           │ X-OpenClaw-Agent-Id: <agent-id>
           │
           ▼
┌─────────────────────┐
│  OpenClaw Gateway   │
│  (clawg-ui plugin)  │
└──────────┬──────────┘
           │
           │ SSE Stream
           │ RUN_STARTED → TEXT_MESSAGE_CONTENT → RUN_FINISHED
           │
           ▼
┌─────────────────────┐
│  Target Agent       │
│  (Skippy/Managers)  │
└─────────────────────┘
```

## Setup Steps

### 1. Install clawg-ui Plugin

```bash
# On the OpenClaw gateway machine
openclaw plugins install @contextableai/clawg-ui

# Restart gateway
openclaw gateway restart
```

### 2. Device Pairing Flow

**Step 2a: MC app initiates pairing (first time only)**

```typescript
// In MC app - utils/clawg-ui-client.ts
const CLAWG_UI_URL = 'http://localhost:18789/v1/clawg-ui';

export async function initiatePairing(): Promise<{ pairingCode: string; token: string }> {
  const response = await fetch(CLAWG_UI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'pairing request' }] })
  });

  if (response.status === 403) {
    const data = await response.json();
    if (data.error?.type === 'pairing_pending') {
      return {
        pairingCode: data.error.pairing.pairingCode,
        token: data.error.pairing.token
      };
    }
  }

  throw new Error('Unexpected pairing response');
}
```

**Step 2b: Save device token**

```typescript
// Store in MC app's .env or database
// .env.local
CLAWG_UI_DEVICE_TOKEN=<token-from-pairing>
```

**Step 2c: Gateway owner approves device**

```bash
# On gateway machine
openclaw pairing list clawg-ui
openclaw pairing approve clawg-ui ABCD1234  # the pairing code
```

### 3. MC Client Implementation

```typescript
// utils/clawg-ui-client.ts

const CLAWG_UI_URL = process.env.CLAWG_UI_URL || 'http://localhost:18789/v1/clawg-ui';
const DEVICE_TOKEN = process.env.CLAWG_UI_DEVICE_TOKEN;

export interface ClawgUIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClawgUIRequest {
  threadId?: string;
  runId?: string;
  messages: ClawgUIMessage[];
  agentId?: string;  // Target specific agent
}

export interface ClawgUIEvent {
  type: 'RUN_STARTED' | 'TEXT_MESSAGE_START' | 'TEXT_MESSAGE_CONTENT' | 
        'TEXT_MESSAGE_END' | 'TOOL_CALL_START' | 'TOOL_CALL_END' | 
        'RUN_FINISHED' | 'RUN_ERROR';
  [key: string]: any;
}

/**
 * Send message to OpenClaw agent via clawg-ui with SSE streaming
 */
export async function* sendMessage(
  request: ClawgUIRequest
): AsyncGenerator<ClawgUIEvent> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Authorization': `Bearer ${DEVICE_TOKEN}`,
  };

  // Route to specific agent if provided
  if (request.agentId) {
    headers['X-OpenClaw-Agent-Id'] = request.agentId;
  }

  const response = await fetch(CLAWG_UI_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      threadId: request.threadId,
      runId: request.runId,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`clawg-ui error: ${JSON.stringify(error)}`);
  }

  // Parse SSE stream
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const event = JSON.parse(data);
          yield event;
        } catch (e) {
          console.warn('Failed to parse SSE event:', data);
        }
      }
    }
  }
}

/**
 * Send message and collect full response
 */
export async function sendMessageComplete(
  request: ClawgUIRequest
): Promise<string> {
  let fullContent = '';

  for await (const event of sendMessage(request)) {
    if (event.type === 'TEXT_MESSAGE_CONTENT') {
      fullContent += event.delta || '';
    }
    if (event.type === 'RUN_ERROR') {
      throw new Error(event.message || 'Agent run failed');
    }
  }

  return fullContent;
}
```

### 4. Retry Mechanism with Multiple Approaches

```typescript
// utils/planning-webhook.ts

import { sendMessageComplete } from './clawg-ui-client';

const MC_API_URL = process.env.MC_API_URL || 'http://localhost:4000';
const PLANNING_WEBHOOK_TOKEN = 'mc-planning-webhook-secret';

interface PlanningQuestion {
  question: string;
  options: Array<{ id: string; label: string }>;
}

/**
 * Post planning question with retry logic
 * Tries multiple approaches in order
 */
export async function postPlanningQuestion(
  taskId: string,
  question: PlanningQuestion,
  maxRetries: number = 3
): Promise<{ success: boolean; attempt: number; error?: string }> {
  
  const approaches = [
    // Approach 1: Direct endpoint (no auth required)
    async () => {
      const response = await fetch(
        `${MC_API_URL}/api/tasks/${taskId}/planning/answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(question),
        }
      );
      if (!response.ok) throw new Error(`Direct endpoint failed: ${response.status}`);
      return response.json();
    },

    // Approach 2: Planning webhook with Bearer token
    async () => {
      const response = await fetch(
        `${MC_API_URL}/api/planning-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PLANNING_WEBHOOK_TOKEN}`,
          },
          body: JSON.stringify({ taskId, ...question }),
        }
      );
      if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
      return response.json();
    },

    // Approach 3: Use clawg-ui to send message to Skippy
    async () => {
      const content = await sendMessageComplete({
        threadId: `planning-${taskId}`,
        messages: [{
          role: 'user',
          content: `PLANNING_REQUEST for task ${taskId}:\n\nQuestion: ${question.question}\nOptions: ${JSON.stringify(question.options)}\n\nPlease add this question to the planning session.`
        }],
        agentId: 'main', // Skippy
      });
      return { success: true, via: 'clawg-ui', content };
    },
  ];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const [index, approach] of approaches.entries()) {
      try {
        const result = await approach();
        console.log(`[Planning] Success via approach ${index + 1} on attempt ${attempt}`);
        return { success: true, attempt, ...result };
      } catch (error) {
        lastError = error as Error;
        console.warn(`[Planning] Approach ${index + 1} failed on attempt ${attempt}:`, error);
        
        // Exponential backoff between approaches
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, index)));
      }
    }

    // Wait before retrying all approaches
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return { 
    success: false, 
    attempt: maxRetries, 
    error: lastError?.message || 'All approaches failed' 
  };
}

/**
 * Notify agent to check for planning tasks
 */
export async function notifyAgentForPlanning(
  agentId: string
): Promise<void> {
  try {
    await sendMessageComplete({
      threadId: `heartbeat-${agentId}`,
      messages: [{
        role: 'user',
        content: 'PLANNING_CHECK: Please check for planning tasks that need your attention.'
      }],
      agentId,
    });
  } catch (error) {
    console.error(`[Planning] Failed to notify agent ${agentId}:`, error);
  }
}
```

### 5. Agent IDs for Routing

| Agent | ID | Use Case |
|-------|-----|----------|
| Skippy (Main) | `main` | User planning, coordination |
| Dev Manager | `8d3f0bf2-aaa4-4d0f-986f-38e32beb07ab` | Development tasks |
| Marketing Manager | `da315bbd-0c06-4bba-9c6c-3280e50b35f8` | Marketing tasks |
| Insights Manager | `4aef75a1-e6d2-43df-bb05-a64bcadae598` | Analytics tasks |

### 6. Environment Variables

Add to MC app's `.env.local`:

```env
# clawg-ui Configuration
CLAWG_UI_URL=http://localhost:18789/v1/clawg-ui
CLAWG_UI_DEVICE_TOKEN=<from-pairing-flow>

# MC API
MC_API_URL=http://localhost:4000
```

### 7. Usage Example: Planning Session

```typescript
// In MC app's planning logic

import { postPlanningQuestion, notifyAgentForPlanning } from '@/utils/planning-webhook';

// When Skippy needs to ask a question
async function askPlanningQuestion(taskId: string) {
  const question = {
    question: "What's the primary goal of this task?",
    options: [
      { id: "A", label: "Build new functionality" },
      { id: "B", label: "Fix an existing issue" },
      { id: "C", label: "Improve performance" },
      { id: "other", label: "Other (please specify)" }
    ]
  };

  const result = await postPlanningQuestion(taskId, question);
  
  if (!result.success) {
    // Log to monitoring/alerting
    console.error('Failed to post planning question after retries:', result.error);
  }
}

// Notify Skippy to check for planning tasks
await notifyAgentForPlanning('main');
```

## Error Handling

| Error | Action |
|-------|--------|
| 401 Unauthorized | Re-initiate pairing flow |
| 403 pairing_pending | Prompt user to approve device |
| Network error | Retry with exponential backoff |
| RUN_ERROR | Log and fall back to next approach |

## Testing

```bash
# Test pairing
curl -X POST http://localhost:18789/v1/clawg-ui \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Test with device token
curl -N -X POST http://localhost:18789/v1/clawg-ui \
  -H "Authorization: Bearer $CLAWG_UI_DEVICE_TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello from MC"}]}'
```

## Migration Path

1. **Phase 1:** Use direct `/api/tasks/{id}/planning/answer` endpoint (current)
2. **Phase 2:** Add clawg-ui as fallback for retry mechanism
3. **Phase 3:** Migrate all agent communication to clawg-ui for SSE streaming

## Related Documentation

- [PLANNING.md](./PLANNING.md) - Two-stage planning protocol
- [HEARTBEAT.md](../HEARTBEAT.md) - Agent heartbeat configuration
- [clawg-ui GitHub](https://github.com/contextablemark/clawg-ui)
