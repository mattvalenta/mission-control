/**
 * Next.js instrumentation file
 * Runs once when the server starts
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');
    
    // Initialize sync service
    if (process.env.POSTGRES_URL) {
      try {
        const { initializeSyncService } = await import('./src/lib/db/init-sync');
        initializeSyncService();
        console.log('[Instrumentation] Sync service initialized');
      } catch (err) {
        console.error('[Instrumentation] Failed to initialize sync service:', err);
      }
    } else {
      console.log('[Instrumentation] POSTGRES_URL not set, skipping sync service');
    }
    
    console.log('[Instrumentation] Server ready');
  }
}
