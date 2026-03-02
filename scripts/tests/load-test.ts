/**
 * Load Test Script for Mission Control
 * 
 * Tests system performance under load.
 * Run with: npx tsx scripts/tests/load-test.ts
 */

const BASE_URL = process.env.MC_BASE_URL || 'http://localhost:4000';

interface LoadTestResult {
  name: string;
  totalMs: number;
  count: number;
  avgMs: number;
  success: number;
  failed: number;
  errors: string[];
}

async function measureTime<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

async function loadTest(
  name: string,
  count: number,
  fn: (i: number) => Promise<void>
): Promise<LoadTestResult> {
  console.log(`\n🧪 Running: ${name} (${count} requests)`);
  
  const start = Date.now();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const batchSize = 10;
  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && i + j < count; j++) {
      batch.push(
        fn(i + j)
          .then(() => success++)
          .catch((err) => {
            failed++;
            errors.push(err.message);
          })
      );
    }
    await Promise.all(batch);
  }

  const totalMs = Date.now() - start;

  return {
    name,
    totalMs,
    count,
    avgMs: totalMs / count,
    success,
    failed,
    errors: errors.slice(0, 5), // Keep first 5 errors
  };
}

async function runLoadTests() {
  console.log('============================================================');
  console.log('Mission Control Load Test');
  console.log('============================================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('============================================================');

  const results: LoadTestResult[] = [];

  // Test 1: Health checks
  results.push(
    await loadTest('Health Check (100 requests)', 100, async (i) => {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
  );

  // Test 2: Task list queries
  results.push(
    await loadTest('Task List Query (100 requests)', 100, async (i) => {
      const response = await fetch(`${BASE_URL}/api/tasks?limit=20`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
  );

  // Test 3: Task creation (smaller batch)
  results.push(
    await loadTest('Task Creation (50 requests)', 50, async (i) => {
      const response = await fetch(`${BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Load Test Task ${i}`,
          description: 'Created by load test',
          priority: 'normal',
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
  );

  // Test 4: Agent list queries
  results.push(
    await loadTest('Agent List Query (100 requests)', 100, async (i) => {
      const response = await fetch(`${BASE_URL}/api/agents`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
  );

  // Test 5: Scheduler status
  results.push(
    await loadTest('Scheduler Status (50 requests)', 50, async (i) => {
      const response = await fetch(`${BASE_URL}/api/scheduler`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
  );

  // Test 6: Audit log queries
  results.push(
    await loadTest('Audit Log Query (50 requests)', 50, async (i) => {
      const response = await fetch(`${BASE_URL}/api/audit?limit=100`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
  );

  // Print results
  console.log('\n============================================================');
  console.log('Results Summary');
  console.log('============================================================\n');

  for (const result of results) {
    const status = result.failed === 0 ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    console.log(`   Total: ${result.totalMs}ms | Avg: ${result.avgMs.toFixed(1)}ms | Success: ${result.success}/${result.count}`);
    if (result.failed > 0) {
      console.log(`   Failed: ${result.failed}`);
      result.errors.forEach((e) => console.log(`   Error: ${e}`));
    }
    console.log('');
  }

  // Overall summary
  const totalRequests = results.reduce((sum, r) => sum + r.count, 0);
  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const overallPass = totalFailed === 0;

  console.log('============================================================');
  console.log(`Overall: ${overallPass ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Success Rate: ${((totalSuccess / totalRequests) * 100).toFixed(1)}%`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log('============================================================');

  process.exit(overallPass ? 0 : 1);
}

runLoadTests().catch(console.error);
