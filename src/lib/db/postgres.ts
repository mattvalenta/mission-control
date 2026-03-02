/**
 * PostgreSQL Database Module for Mission Control
 * 
 * Replaces SQLite with PostgreSQL for distributed architecture.
 * 
 * Features:
 * - Connection pooling
 * - Type-safe query helpers
 * - Transaction support
 * - Error handling and logging
 */

import pg, { Pool, PoolClient, QueryResult } from 'pg';

const { Pool: PgPool } = pg;

// Pool configuration
const POOL_MIN = parseInt(process.env.DATABASE_POOL_MIN || '2', 10);
const POOL_MAX = parseInt(process.env.DATABASE_POOL_MAX || '10', 10);
const CONNECTION_TIMEOUT = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000', 10);
const IDLE_TIMEOUT = parseInt(process.env.DATABASE_IDLE_TIMEOUT || '10000', 10);

let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is required');
    }

    pool = new PgPool({
      connectionString,
      ssl: process.env.POSTGRES_SSL !== 'false' ? { rejectUnauthorized: false } : false,
      min: POOL_MIN,
      max: POOL_MAX,
      connectionTimeoutMillis: CONNECTION_TIMEOUT,
      idleTimeoutMillis: IDLE_TIMEOUT,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Pool error:', err);
    });

    console.log('[PostgreSQL] Pool initialized');
  }

  return pool;
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] Pool closed');
  }
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T = any>(
  sql: string, 
  params: any[] = []
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows;
}

/**
 * Execute a query and return a single row
 */
export async function queryOne<T = any>(
  sql: string, 
  params: any[] = []
): Promise<T | undefined> {
  const result = await getPool().query(sql, params);
  return result.rows[0] as T | undefined;
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export async function run(
  sql: string, 
  params: any[] = []
): Promise<QueryResult> {
  return await getPool().query(sql, params);
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database health
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await getPool().query('SELECT 1');
    const latency = Date.now() - start;
    
    return {
      healthy: true,
      latency
    };
  } catch (err: any) {
    return {
      healthy: false,
      error: err.message
    };
  }
}

/**
 * Get pool statistics
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  const p = getPool();
  return {
    totalCount: p.totalCount,
    idleCount: p.idleCount,
    waitingCount: p.waitingCount
  };
}

// Re-export types
export type { Pool, PoolClient, QueryResult };
