/**
 * Validate SQLite → PostgreSQL migration
 * 
 * Compares row counts between SQLite and PostgreSQL databases.
 * 
 * Usage: npx tsx scripts/validate-migration.ts
 * 
 * Environment variables:
 *   POSTGRES_URL - PostgreSQL connection string
 *   SQLITE_PATH - Path to SQLite database (default: ./mission-control.db)
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'mission-control.db');

if (!POSTGRES_URL) {
  console.error('ERROR: POSTGRES_URL environment variable is required');
  process.exit(1);
}

const TABLES = [
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
  'messages',
  'content_items',
  'calendar_events',
  'team_members',
  'businesses',
];

interface TableValidation {
  table: string;
  sqliteCount: number;
  postgresCount: number;
  match: boolean;
  error?: string;
}

async function main() {
  console.log('=== Migration Validation ===');
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`PostgreSQL: ${POSTGRES_URL.replace(/:[^:@]+@/, ':****@')}`);
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
  
  const results: TableValidation[] = [];
  let allMatch = true;
  
  try {
    for (const table of TABLES) {
      const result: TableValidation = {
        table,
        sqliteCount: 0,
        postgresCount: 0,
        match: false
      };
      
      try {
        // Get SQLite count
        const sqliteCheck = sqlite.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name=?
        `).get(table);
        
        if (sqliteCheck) {
          const sqliteRow = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
          result.sqliteCount = sqliteRow.count;
        }
        
        // Get PostgreSQL count
        const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${table}`);
        result.postgresCount = parseInt(pgResult.rows[0].count);
        
        // Compare
        result.match = result.sqliteCount === result.postgresCount;
        if (!result.match) {
          allMatch = false;
        }
        
      } catch (err: any) {
        result.error = err.message;
        result.match = false;
        allMatch = false;
      }
      
      results.push(result);
    }
    
    // Print results
    console.log('\n| Table                 | SQLite | PostgreSQL | Match |');
    console.log('|-----------------------|--------|------------|-------|');
    
    for (const r of results) {
      const status = r.match ? '✅' : (r.error ? '❓' : '❌');
      console.log(`| ${r.table.padEnd(21)} | ${String(r.sqliteCount).padStart(6)} | ${String(r.postgresCount).padStart(10)} | ${status}    |`);
      if (r.error) {
        console.log(`|   Error: ${r.error}`);
      }
    }
    
    console.log('');
    
    if (allMatch) {
      console.log('✅ All tables validated successfully!');
    } else {
      console.log('❌ Validation failed - counts do not match');
      
      const mismatched = results.filter(r => !r.match);
      console.log(`\nMismatched tables: ${mismatched.map(r => r.table).join(', ')}`);
      
      process.exit(1);
    }
    
  } finally {
    sqlite.close();
    await pgPool.end();
  }
}

main().catch(err => {
  console.error('[Validation] Fatal error:', err);
  process.exit(1);
});
