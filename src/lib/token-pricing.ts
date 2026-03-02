/**
 * Token Pricing Module
 * 
 * Provides model pricing data and cost calculation for LLM API calls.
 * Prices are per 1 million tokens.
 */

// Model pricing (USD per 1M tokens)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI Models
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },

  // Anthropic Models
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku': { input: 0.80, output: 4.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },

  // OpenRouter Models
  'openrouter/auto': { input: 1.00, output: 3.00 },
  'openrouter/anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'openrouter/openai/gpt-4o': { input: 2.50, output: 10.00 },

  // Moonshot AI (Kimi)
  'moonshot/kimi-k2.5': { input: 0.50, output: 2.00 },
  'moonshot/kimi-latest': { input: 0.50, output: 2.00 },

  // Zhipu AI (GLM)
  'zai/glm-4-plus': { input: 0.70, output: 0.70 },
  'zai/glm-4': { input: 0.10, output: 0.10 },
  'openrouter/z-ai/glm-4': { input: 0.10, output: 0.10 },
  'openrouter/z-ai/glm-5': { input: 0.15, output: 0.15 },
  'zhipu/glm-4': { input: 0.10, output: 0.10 },

  // DeepSeek
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-coder': { input: 0.14, output: 0.28 },

  // Llama Models
  'meta-llama/llama-3.1-405b-instruct': { input: 2.00, output: 6.00 },
  'meta-llama/llama-3.1-70b-instruct': { input: 0.50, output: 1.00 },

  // Default fallback
  'default': { input: 1.00, output: 3.00 },
};

// Model aliases (map variations to canonical names)
const MODEL_ALIASES: Record<string, string> = {
  'gpt-4o-2024-08-06': 'gpt-4o',
  'gpt-4o-2024-05-13': 'gpt-4o',
  'gpt-4-turbo-preview': 'gpt-4-turbo',
  'claude-3-5-sonnet-20240620': 'claude-3-5-sonnet',
  'claude-3-5-haiku-20241022': 'claude-3-5-haiku',
  'kimi': 'moonshot/kimi-k2.5',
  'glm-4': 'zhipu/glm-4',
  'glm-5': 'openrouter/z-ai/glm-5',
};

/**
 * Normalize model name
 */
export function normalizeModelName(model: string): string {
  const normalized = model.toLowerCase().trim();
  return MODEL_ALIASES[normalized] || normalized;
}

/**
 * Get pricing for a model
 */
export function getModelPricing(model: string): { input: number; output: number } {
  const normalized = normalizeModelName(model);
  return MODEL_PRICING[normalized] || MODEL_PRICING['default'];
}

/**
 * Calculate cost for token usage
 * 
 * @param model - Model identifier
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(model);
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Calculate total tokens
 */
export function calculateTotalTokens(
  inputTokens: number,
  outputTokens: number
): number {
  return inputTokens + outputTokens;
}

/**
 * Token usage record for database
 */
export interface TokenUsageRecord {
  id?: string;
  session_id?: string;
  agent_id?: string;
  task_id?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

/**
 * Create a token usage record
 */
export function createTokenUsageRecord(
  model: string,
  inputTokens: number,
  outputTokens: number,
  metadata?: {
    session_id?: string;
    agent_id?: string;
    task_id?: string;
  }
): TokenUsageRecord {
  const totalTokens = calculateTotalTokens(inputTokens, outputTokens);
  const cost = calculateCost(model, inputTokens, outputTokens);
  
  return {
    session_id: metadata?.session_id,
    agent_id: metadata?.agent_id,
    task_id: metadata?.task_id,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(3)}¢`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Aggregate token usage
 */
export interface TokenUsageSummary {
  total_tokens: number;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  record_count: number;
}

/**
 * Aggregate an array of usage records
 */
export function aggregateTokenUsage(records: TokenUsageRecord[]): TokenUsageSummary {
  return records.reduce(
    (acc, record) => ({
      total_tokens: acc.total_tokens + record.total_tokens,
      total_cost: acc.total_cost + record.cost,
      total_input_tokens: acc.total_input_tokens + record.input_tokens,
      total_output_tokens: acc.total_output_tokens + record.output_tokens,
      record_count: acc.record_count + 1,
    }),
    {
      total_tokens: 0,
      total_cost: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      record_count: 0,
    }
  );
}
