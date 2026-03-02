/**
 * Database Module for Mission Control
 * 
 * PostgreSQL-based database module for distributed architecture.
 * Replaces SQLite with PostgreSQL as the primary database.
 */

import { 
  getPool, 
  closePool, 
  queryAll as pgQueryAll, 
  queryOne as pgQueryOne, 
  run as pgRun, 
  transaction as pgTransaction,
  healthCheck,
  getPoolStats,
  PoolClient,
  QueryResult
} from './postgres';

// Re-export types
export type { PoolClient, QueryResult };

/**
 * Execute a query and return all rows
 */
export function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return pgQueryAll<T>(sql, params);
}

/**
 * Execute a query and return a single row
 */
export function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return pgQueryOne<T>(sql, params);
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export function run(sql: string, params: unknown[] = []): Promise<QueryResult> {
  return pgRun(sql, params);
}

/**
 * Execute a transaction
 */
export function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return pgTransaction(fn);
}

/**
 * Close the database connection
 */
export function closeDb(): Promise<void> {
  return closePool();
}

/**
 * Check database health
 */
export { healthCheck, getPoolStats };

/**
 * Get the connection pool (for advanced usage)
 */
export { getPool };
