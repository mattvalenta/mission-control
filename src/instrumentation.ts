/**
 * Next.js Instrumentation Hook
 * 
 * Runs once when the server starts. Used to initialize
 * background services like the job scheduler.
 * 
 * IMPORTANT: Use dynamic imports inside the runtime guard
 * to avoid edge runtime incompatibility with 'pg' module.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Starting initialization...');

    // Dynamic imports to avoid edge runtime issues with 'pg' module
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
