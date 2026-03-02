// Run all pending migrations on PostgreSQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw?sslmode=require&channel_binding=require'
  });

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  // Get all migration files in order
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    console.log(`Running ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await pool.query(sql);
      console.log(`  ✅ ${file} applied`);
    } catch (err) {
      console.log(`  ⚠️  ${file}: ${err.message}`);
    }
  }

  await pool.end();
  console.log('Done');
}

runMigrations().catch(console.error);
