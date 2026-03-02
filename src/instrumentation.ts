/**
 * Next.js Instrumentation Hook
 * 
 * Runs once when the server starts. Used to initialize
 * background services like the job scheduler.
 */

export async function register() {
  // Only run in Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Starting initialization...');

    // Dynamic imports to avoid Edge runtime bundling issues
    const { registerBuiltinHandlers, instanceHeartbeat } = await import('./lib/job-handlers');
    const { getPendingJobs, claimAndRunJob } = await import('./lib/scheduler');

    // Register all built-in handlers
    registerBuiltinHandlers();

    // Send initial heartbeat immediately
    try {
      await instanceHeartbeat();
      console.log('[Instrumentation] Initial heartbeat sent');
    } catch (error) {
      console.error('[Instrumentation] Failed to send initial heartbeat:', error);
    }

    // Start scheduler loop
    const SCHEDULE_INTERVAL = 30000; // 30 seconds

    async function runScheduler() {
      try {
        const pendingJobs = await getPendingJobs();

        for (const job of pendingJobs) {
          try {
            await claimAndRunJob(job.name);
          } catch (error) {
            console.error(`[Scheduler] Job ${job.name} failed:`, error);
          }
        }
      } catch (error) {
        console.error('[Scheduler] Error polling jobs:', error);
      }
    }

    // Run immediately
    runScheduler().catch(console.error);

    // Then run on interval
    setInterval(runScheduler, SCHEDULE_INTERVAL);
    console.log('[Instrumentation] Job scheduler started (30s interval)');
  }
}
