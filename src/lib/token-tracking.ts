/**
 * Token Tracking Utility
 * 
 * Provides utilities for recording and querying token usage.
 */

import { run, queryOne } from '@/lib/db';
import { calculateCost, calculateTotalTokens } from './token-pricing';

export interface TokenUsageInput {
  agent_id?: string;
  task_id?: string;
  session_id?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export interface TokenUsageResult {
  id: string;
  total_tokens: number;
  cost: number;
}

/**
 * Record token usage from an agent
 */
export async function recordTokenUsage(input: TokenUsageInput): Promise<TokenUsageResult> {
  const { agent_id, task_id, session_id, model, input_tokens, output_tokens } = input;

  const totalTokens = calculateTotalTokens(input_tokens, output_tokens);
  const cost = calculateCost(model, input_tokens, output_tokens);
  const id = crypto.randomUUID();

  await run(
    `INSERT INTO token_usage (id, session_id, agent_id, task_id, model, input_tokens, output_tokens, total_tokens, cost, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [id, session_id || null, agent_id || null, task_id || null, model, input_tokens, output_tokens, totalTokens, cost]
  );

  return { id, total_tokens: totalTokens, cost };
}

/**
 * Record token usage from OpenClaw session response
 * 
 * Call this when an agent reports completion with usage data
 */
export async function recordTokenUsageFromResponse(
  response: { usage?: { prompt_tokens?: number; completion_tokens?: number } },
  metadata: { agent_id?: string; task_id?: string; session_id?: string; model?: string }
): Promise<TokenUsageResult | null> {
  if (!response.usage) return null;

  const inputTokens = response.usage.prompt_tokens || 0;
  const outputTokens = response.usage.completion_tokens || 0;
  const model = metadata.model || 'unknown';

  return recordTokenUsage({
    agent_id: metadata.agent_id,
    task_id: metadata.task_id,
    session_id: metadata.session_id,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}
