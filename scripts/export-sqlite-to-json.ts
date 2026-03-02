/**
 * Export SQLite data to JSON for migration
 * 
 * Usage: npx tsx scripts/export-sqlite-to-json.ts > backup-data.json
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'mission-control.db');

interface ExportData {
  exportedAt: string;
  databasePath: string;
  tables: Record<string, {
    count: number;
    rows: any[];
  }>;
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  
  // Get all tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    databasePath: DB_PATH,
    tables: {}
  };

  console.error(`[Export] Found ${tables.length} tables`);

  for (const { name } of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${name}`).all();
      exportData.tables[name] = {
        count: rows.length,
        rows: rows as any[]
      };
      console.error(`[Export] ${name}: ${rows.length} rows`);
    } catch (err) {
      console.error(`[Export] Error reading table ${name}:`, err);
      exportData.tables[name] = {
        count: 0,
        rows: []
      };
    }
  }

  db.close();

  // Output JSON to stdout
  console.log(JSON.stringify(exportData, null, 2));
  console.error(`[Export] Complete`);
}

main().catch(err => {
  console.error('[Export] Failed:', err);
  process.exit(1);
});
