/**
 * clawg-ui Client for Mission Control
 * 
 * Communicates with OpenClaw agents via AG-UI protocol
 * Uses SSE streaming for real-time responses
 */

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
 * Check if clawg-ui is configured
 */
export function isClawgUIConfigured(): boolean {
  return !!DEVICE_TOKEN;
}

/**
 * Initiate device pairing flow
 * Returns pairing code that needs to be approved by gateway owner
 */
export async function initiatePairing(): Promise<{ pairingCode: string; token: string }> {
  const response = await fetch(CLAWG_UI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      messages: [{ role: 'user', content: 'pairing request from Mission Control' }] 
    })
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

  // If already approved, the token should work
  if (response.ok) {
    const reader = response.body?.getReader();
    // Consume the stream
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
    throw new Error('Device already approved - save the token you have');
  }

  throw new Error('Unexpected pairing response: ' + response.status);
}

/**
 * Send message to OpenClaw agent via clawg-ui with SSE streaming
 */
export async function* sendMessage(
  request: ClawgUIRequest
): AsyncGenerator<ClawgUIEvent> {
  if (!DEVICE_TOKEN) {
    throw new Error('CLAWG_UI_DEVICE_TOKEN not configured. Run pairing first.');
  }

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

  if (response.status === 403) {
    const data = await response.json();
    if (data.error?.type === 'pairing_pending') {
      throw new Error('Device not approved. Run: openclaw pairing approve clawg-ui ' + data.error.pairing.pairingCode);
    }
  }

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

/**
 * Send a planning request to Skippy
 */
export async function sendPlanningRequest(
  taskId: string,
  taskTitle: string,
  taskDescription: string,
  requestType: 'generate_questions' | 'process_answers'
): Promise<string> {
  const prompt = requestType === 'generate_questions'
    ? `GENERATE_BATCH_QUESTIONS for task "${taskId}"

Task Title: "${taskTitle}"
Task Description: "${taskDescription}"

Please generate up to 10 SIMPLE clarifying questions for this task. Questions should be:
- Simple, non-technical language (for a "monkey" to understand)
- Multiple choice with 4 options (A, B, C, Other)
- Relevant to the specific task, NOT generic templates

Format as JSON array:
[
  {
    "id": "q1",
    "question": "Simple question here?",
    "options": [
      {"id": "A", "label": "Option 1"},
      {"id": "B", "label": "Option 2"},
      {"id": "C", "label": "Option 3"},
      {"id": "other", "label": "Other (please specify)"}
    ]
  }
]

Then POST all questions at once to: http://localhost:4000/api/tasks/${taskId}/planning/questions
Body: {"questions": [...array of question objects...]}`
    : `BATCH PLANNING COMPLETE for task "${taskId}"

The user has answered all planning questions. Please:

1. Read the answers from the task's planning_messages
2. Optimize the task description based on the answers
3. Determine the best manager (Dev/Marketing/Insights) to assign
4. Call the transition endpoint:

POST http://localhost:4000/api/tasks/${taskId}/planning/transition
Body: {
  "optimizedDescription": "Optimized task description with objective, context, requirements, constraints, success criteria",
  "assignedAgentId": "agent-id-here"
}

Agent IDs:
- Dev Manager: 8d3f0bf2-aaa4-4d0f-986f-38e32beb07ab
- Marketing Manager: da315bbd-0c06-4bba-9c6c-3280e50b35f8  
- Insights Manager: 4aef75a1-e6d2-43df-bb05-a64bcadae598`;

  return sendMessageComplete({
    threadId: `planning-${taskId}`,
    messages: [{ role: 'user', content: prompt }],
    agentId: 'main', // Skippy
  });
}
