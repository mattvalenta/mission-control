/**
 * Circuit Breaker
 * 
 * Prevents cascading failures by temporarily blocking
 * dispatch to agents that have failed repeatedly.
 * 
 * States:
 * - CLOSED: Normal operation, dispatches allowed
 * - OPEN: Agent failing, dispatches blocked
 * - HALF_OPEN: Testing if agent recovered
 */

import { queryOne, run } from './db';

// Configuration
const CIRCUIT_BREAKER_THRESHOLD = 3; // Failures before opening
const CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes
const HALF_OPEN_MAX_CALLS = 1; // Test calls in half-open state

// Circuit state tracking (in-memory for speed)
interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  successes: number;
  status: 'closed' | 'open' | 'half-open';
  openedAt: Date | null;
  testCalls: number;
}

const circuits = new Map<string, CircuitState>();

/**
 * Check if dispatch is allowed to an agent
 */
export function canDispatchToAgent(agentId: string): boolean {
  const circuit = circuits.get(agentId);

  if (!circuit) {
    return true; // No failures, allow
  }

  switch (circuit.status) {
    case 'closed':
      return true;

    case 'open':
      // Check if timeout has passed
      if (circuit.openedAt) {
        const timeSinceOpen = Date.now() - circuit.openedAt.getTime();
        if (timeSinceOpen > CIRCUIT_BREAKER_TIMEOUT) {
          // Transition to half-open
          circuit.status = 'half-open';
          circuit.testCalls = 0;
          return true;
        }
      }
      return false;

    case 'half-open':
      // Allow limited test calls
      return circuit.testCalls < HALF_OPEN_MAX_CALLS;

    default:
      return true;
  }
}

/**
 * Record a successful dispatch
 */
export function recordAgentSuccess(agentId: string): void {
  const circuit = circuits.get(agentId);

  if (!circuit) {
    return; // No circuit, nothing to do
  }

  if (circuit.status === 'half-open') {
    // Successful test call, close the circuit
    circuit.status = 'closed';
    circuit.failures = 0;
    circuit.successes++;
    circuit.openedAt = null;

    // Persist to database
    persistCircuitState(agentId, circuit);
  } else if (circuit.status === 'closed') {
    circuit.successes++;
    circuit.failures = 0; // Reset failure count on success
  }
}

/**
 * Record a failed dispatch
 */
export function recordAgentFailure(agentId: string, error?: string): void {
  let circuit = circuits.get(agentId);

  if (!circuit) {
    circuit = {
      failures: 0,
      lastFailure: null,
      successes: 0,
      status: 'closed',
      openedAt: null,
      testCalls: 0,
    };
    circuits.set(agentId, circuit);
  }

  circuit.failures++;
  circuit.lastFailure = new Date();

  if (circuit.status === 'half-open') {
    // Failed test call, reopen circuit
    circuit.status = 'open';
    circuit.openedAt = new Date();
    circuit.testCalls = 0;

    // Persist to database
    persistCircuitState(agentId, circuit, error);
  } else if (circuit.status === 'closed') {
    if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      // Threshold reached, open circuit
      circuit.status = 'open';
      circuit.openedAt = new Date();

      // Persist to database
      persistCircuitState(agentId, circuit, error);
    }
  }
}

/**
 * Get circuit state for an agent
 */
export function getCircuitState(agentId: string): CircuitState | undefined {
  return circuits.get(agentId);
}

/**
 * Get all circuit states
 */
export function getAllCircuitStates(): Map<string, CircuitState> {
  return circuits;
}

/**
 * Manually reset a circuit
 */
export function resetCircuit(agentId: string): void {
  circuits.delete(agentId);
}

/**
 * Persist circuit state to database for recovery
 */
async function persistCircuitState(
  agentId: string,
  circuit: CircuitState,
  error?: string
): Promise<void> {
  try {
    // Check if agent_circuit_breaker table exists
    await run(
      `INSERT INTO agent_circuit_breaker (agent_id, status, failures, last_failure, opened_at, last_error, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (agent_id) 
       DO UPDATE SET 
         status = $2, 
         failures = $3, 
         last_failure = $4, 
         opened_at = $5, 
         last_error = $6, 
         updated_at = NOW()`,
      [
        agentId,
        circuit.status,
        circuit.failures,
        circuit.lastFailure,
        circuit.openedAt,
        error || null,
      ]
    );
  } catch (err) {
    // Table may not exist yet, ignore
    console.error('Failed to persist circuit state:', err);
  }
}

/**
 * Load circuit states from database on startup
 */
export async function loadCircuitStates(): Promise<void> {
  try {
    const states = await queryAll<{
      agent_id: string;
      status: string;
      failures: number;
      last_failure: Date | null;
      opened_at: Date | null;
    }>(
      `SELECT agent_id, status, failures, last_failure, opened_at 
       FROM agent_circuit_breaker 
       WHERE status IN ('open', 'half-open')`
    );

    for (const state of states) {
      circuits.set(state.agent_id, {
        failures: state.failures,
        lastFailure: state.last_failure,
        successes: 0,
        status: state.status as 'open' | 'half-open',
        openedAt: state.opened_at,
        testCalls: 0,
      });
    }
  } catch (err) {
    // Table may not exist yet, ignore
    console.error('Failed to load circuit states:', err);
  }
}

/**
 * Get time until circuit can retry
 */
export function getRetryAfter(agentId: string): number {
  const circuit = circuits.get(agentId);

  if (!circuit || circuit.status !== 'open' || !circuit.openedAt) {
    return 0;
  }

  const timeSinceOpen = Date.now() - circuit.openedAt.getTime();
  const remaining = CIRCUIT_BREAKER_TIMEOUT - timeSinceOpen;

  return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
}
