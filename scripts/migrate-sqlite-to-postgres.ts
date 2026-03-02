/**
 * Migrate SQLite data to PostgreSQL
 * 
 * Usage: 
 *   node scripts/export-sqlite-to-json.ts > backup-data.json
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts
 * 
 * Environment variables:
 *   POSTGRES_URL - PostgreSQL connection string
 *   SQLITE_PATH - Path to SQLite database (default: ./mission-control.db)
 *   DRY_RUN - Set to 'true' to preview without making changes
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'mission-control.db');
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!POSTGRES_URL) {
  console.error('ERROR: POSTGRES_URL environment variable is required');
  process.exit(1);
}

// Tables to migrate (in order of dependencies)
const MIGRATION_ORDER = [
  'workspaces',
  'mc_instances',
  'agents',
  'tasks',
  'planning_questions',
  'planning_specs',
  'task_activities',
  'task_deliverables',
  'openclaw_sessions',
  'events',
  'conversations',
  'conversation_participants',
  'messages',
  'content_items',
  'calendar_events',
  'team_members',
  'memory_files',
  'businesses',
];

// SQLite → PostgreSQL type conversions
function convertValue(value: any, columnName: string): any {
  if (value === null || value === undefined) return null;
  
  // Boolean conversion (INTEGER 0/1 → BOOLEAN)
  const booleanColumns = ['is_master', 'planning_complete', 'enabled'];
  if (booleanColumns.includes(columnName)) {
    return value === 1 || value === true;
  }
  
  // JSON conversion (TEXT → JSONB)
  const jsonColumns = ['planning_messages', 'planning_agents', 'metadata', 'options', 'detail', 'tags', 'events', 'payload'];
  if (jsonColumns.includes(columnName) && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value; // Keep as string if not valid JSON
    }
  }
  
  return value;
}

// Generate INSERT statement for PostgreSQL
function generateInsert(table: string, row: Record<string, any>): { sql: string; params: any[] } {
  const columns = Object.keys(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const params = columns.map(col => convertValue(row[col], col));
  
  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET
      ${columns.map(col => `${col} = EXCLUDED.${col}`).join(',\n      ')}
  `;
  
  return { sql, params };
}

async function main() {
  console.log('=== SQLite to PostgreSQL Migration ===');
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`PostgreSQL: ${POSTGRES_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');
  
  // Check SQLite exists
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`ERROR: SQLite database not found: ${SQLITE_PATH}`);
    process.exit(1);
  }
  
  // Connect to databases
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pgPool = new Pool({ 
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log('[Migration] Connected to both databases');
  
  // Stats
  const stats = {
    tables: 0,
    rows: 0,
    errors: 0,
    skipped: 0
  };
  
  try {
    for (const table of MIGRATION_ORDER) {
      console.log(`\n[Migration] Processing table: ${table}`);
      
      // Check if table exists in SQLite
      const tableCheck = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      
      if (!tableCheck) {
        console.log(`[Migration] Table ${table} not found in SQLite, skipping`);
        stats.skipped++;
        continue;
      }
      
      // Get rows from SQLite
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
      console.log(`[Migration] Found ${rows.length} rows in ${table}`);
      
      if (rows.length === 0) {
        console.log(`[Migration] No data to migrate for ${table}`);
        stats.tables++;
        continue;
      }
      
      // Migrate each row
      let migrated = 0;
      for (const row of rows) {
        try {
          const { sql, params } = generateInsert(table, row);
          
          if (DRY_RUN) {
            console.log(`[DRY RUN] Would insert:`, row.id || 'no id');
          } else {
            await pgPool.query(sql, params);
          }
          migrated++;
          stats.rows++;
        } catch (err: any) {
          console.error(`[Migration] Error inserting row in ${table}:`, err.message);
          console.error(`[Migration] Row data:`, JSON.stringify(row, null, 2).slice(0, 200));
          stats.errors++;
        }
      }
      
      console.log(`[Migration] Migrated ${migrated}/${rows.length} rows for ${table}`);
      stats.tables++;
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Tables processed: ${stats.tables}`);
    console.log(`Total rows migrated: ${stats.rows}`);
    console.log(`Tables skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
    if (DRY_RUN) {
      console.log('\n[DRY RUN] No changes were made to PostgreSQL');
    }
    
    if (stats.errors > 0) {
      console.log('\n⚠️  Migration completed with errors');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully');
    }
    
  } finally {
    sqlite.close();
    await pgPool.end();
  }
}

main().catch(err => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
