/**
 * Performance Monitoring Utilities
 */

import { queryOne, queryAll } from './db';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 1000;

/**
 * Record a performance metric
 */
export function recordMetric(name: string, value: number, unit: string = 'ms') {
  metrics.push({
    name,
    value,
    unit,
    timestamp: new Date(),
  });

  // Keep only last MAX_METRICS
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Time an async operation
 */
export async function timeOperation<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    recordMetric(name, duration, 'ms');
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    recordMetric(`${name}_error`, duration, 'ms');
    throw error;
  }
}

/**
 * Get performance stats for an operation
 */
export function getPerformanceStats(name: string): {
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
} | null {
  const relevantMetrics = metrics.filter((m) => m.name === name);

  if (relevantMetrics.length === 0) {
    return null;
  }

  const values = relevantMetrics.map((m) => m.value).sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const min = values[0];
  const max = values[count - 1];
  const p95Index = Math.floor(count * 0.95);
  const p95 = values[p95Index];

  return { count, avg, min, max, p95 };
}

/**
 * Get database performance stats
 */
export async function getDatabaseStats(): Promise<{
  connectionCount: number;
  queryCount: number;
  slowQueries: number;
}> {
  try {
    // Get connection stats
    const connectionResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()`
    );

    // Get query stats if pg_stat_statements is available
    let queryCount = 0;
    let slowQueries = 0;

    try {
      const queryStats = await queryAll<{ calls: string; mean_exec_time: string }>(
        `SELECT calls, mean_exec_time FROM pg_stat_statements LIMIT 100`
      );

      queryCount = queryStats.reduce((sum, q) => sum + parseInt(q.calls), 0);
      slowQueries = queryStats.filter((q) => parseFloat(q.mean_exec_time) > 100).length;
    } catch {
      // pg_stat_statements not available
    }

    return {
      connectionCount: parseInt(connectionResult?.count || '0'),
      queryCount,
      slowQueries,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return {
      connectionCount: 0,
      queryCount: 0,
      slowQueries: 0,
    };
  }
}

/**
 * Get all performance metrics
 */
export function getAllMetrics(): PerformanceMetric[] {
  return [...metrics];
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metrics.length = 0;
}

/**
 * Get system performance summary
 */
export async function getPerformanceSummary(): Promise<{
  memory: NodeJS.MemoryUsage;
  uptime: number;
  metrics: Record<string, ReturnType<typeof getPerformanceStats>>;
  database: Awaited<ReturnType<typeof getDatabaseStats>>;
}> {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  // Get stats for all unique metric names
  const uniqueNames = [...new Set(metrics.map((m) => m.name))];
  const metricsStats: Record<string, ReturnType<typeof getPerformanceStats>> = {};

  for (const name of uniqueNames) {
    metricsStats[name] = getPerformanceStats(name);
  }

  const database = await getDatabaseStats();

  return {
    memory,
    uptime,
    metrics: metricsStats,
    database,
  };
}
