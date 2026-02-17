import { startSyncService, stopSyncService, closePostgresConnection } from './sync-service';
import { getDb } from './index';

let isInitialized = false;

/**
 * Initialize the sync service
 * Called once when the application starts
 */
export function initializeSyncService(): void {
  if (isInitialized) {
    console.log('[Init] Sync service already initialized');
    return;
  }

  if (!process.env.POSTGRES_URL) {
    console.warn('[Init] POSTGRES_URL not set, skipping sync service');
    return;
  }

  try {
    const db = getDb();
    startSyncService(db, 5000); // Sync every 5 seconds
    isInitialized = true;
    console.log('[Init] Sync service initialized');
  } catch (err) {
    console.error('[Init] Failed to initialize sync service:', err);
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownSyncService(): Promise<void> {
  stopSyncService();
  await closePostgresConnection();
  isInitialized = false;
  console.log('[Init] Sync service shut down');
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeSyncService();
}
