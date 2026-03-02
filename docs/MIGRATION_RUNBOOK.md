# Mission Control PostgreSQL Migration Runbook

## Overview

This document provides step-by-step instructions for migrating Mission Control from SQLite to PostgreSQL.

---

## Prerequisites

- [ ] PostgreSQL database (Neon Cloud recommended)
- [ ] Connection string with SSL enabled
- [ ] Node.js 20+ installed
- [ ] Access to all Mission Control instances
- [ ] Backup storage location

---

## Pre-Migration Checklist

### 1. Environment Setup

```bash
# Set environment variable
export POSTGRES_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Verify connection
psql $POSTGRES_URL -c "SELECT 1;"
```

### 2. Backup Current Data

```bash
# Create SQLite backup
cd /path/to/mission-control
cp mission-control.db mission-control.db.pre-migration-$(date +%Y%m%d-%H%M%S)

# Export to JSON (for validation)
npx tsx scripts/export-sqlite-to-json.ts > backup-data-$(date +%Y%m%d).json
```

### 3. Verify Dependencies

```bash
# Check Node.js version (20+)
node --version

# Check npm packages
npm ls pg better-sqlite3
```

---

## Migration Procedure

### Phase 1: STOP (5 minutes)

```bash
# Stop all Mission Control instances
pm2 stop mission-control  # or equivalent

# Stop agent polling scripts
pm2 stop dev-manager-poll

# Verify no active processes
ps aux | grep mission-control
```

### Phase 2: BACKUP (5 minutes)

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup SQLite database
cp mission-control.db backups/$(date +%Y%m%d)/mission-control.db

# Export data to JSON
npx tsx scripts/export-sqlite-to-json.ts > backups/$(date +%Y%m%d)/data.json

# Verify backup
ls -lh backups/$(date +%Y%m%d)/
```

### Phase 3: MIGRATE (10-30 minutes)

```bash
# Step 1: Apply PostgreSQL schema
psql $POSTGRES_URL -f migrations/schema-v2.sql

# Step 2: Run data migration
npx tsx scripts/migrate-sqlite-to-postgres.ts

# Step 3: Validate migration
npx tsx scripts/validate-migration.ts
```

**Expected output:**
```
| Table                 | SQLite | PostgreSQL | Match |
|-----------------------|--------|------------|-------|
| tasks                 |     42 |         42 | ✅    |
| agents                |      5 |          5 | ✅    |
| events                |    128 |        128 | ✅    |
...
✅ All tables validated successfully!
```

### Phase 4: STARTUP (10 minutes)

```bash
# Update environment
export DATABASE_URL=""  # Clear SQLite URL
export POSTGRES_URL="postgresql://..."  # Ensure set

# Start Mission Control
pm2 start mission-control

# Check logs
pm2 logs mission-control --lines 50

# Test basic operations
curl http://localhost:4000/api/tasks
curl http://localhost:4000/api/agents
```

---

## Validation Checklist

### Dashboard Tests

- [ ] Dashboard loads without errors
- [ ] All tasks visible
- [ ] All agents visible
- [ ] Task counts correct
- [ ] Agent statuses correct

### API Tests

```bash
# Test task creation
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Migration Test","description":"Testing PostgreSQL migration"}'

# Test task list
curl http://localhost:4000/api/tasks

# Test agent list
curl http://localhost:4000/api/agents
```

### Real-time Tests

- [ ] SSE stream works
- [ ] Task updates broadcast
- [ ] Agent status changes reflect

---

## Rollback Procedure

If migration fails:

```bash
# 1. Stop PostgreSQL MC instances
pm2 stop mission-control

# 2. Rollback PostgreSQL schema (optional, keeps data)
psql $POSTGRES_URL -f migrations/rollback.sql

# 3. Restore SQLite environment
export DATABASE_URL="sqlite://./mission-control.db"
unset POSTGRES_URL

# 4. Restore SQLite backup
cp backups/YYYYMMDD/mission-control.db ./mission-control.db

# 5. Start SQLite MC
pm2 start mission-control

# 6. Verify SQLite MC works
curl http://localhost:4000/api/tasks
```

---

## Troubleshooting

### Common Issues

**1. Connection refused**
```
Error: connect ECONNREFUSED
```
Solution: Check POSTGRES_URL, verify database is running, check firewall

**2. SSL required**
```
Error: no pg_hba.conf entry for host
```
Solution: Add `?sslmode=require` to connection string

**3. Foreign key violations**
```
Error: insert or update on table "tasks" violates foreign key constraint
```
Solution: Run migration script which handles referential integrity

**4. Table already exists**
```
Error: relation "tasks" already exists
```
Solution: Tables may exist from previous attempt, run rollback first

### Performance Checks

```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'inbox';

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'tasks';

-- Check table sizes
SELECT 
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Post-Migration Tasks

- [ ] Update environment variables in production
- [ ] Update CI/CD pipeline
- [ ] Document new connection details
- [ ] Archive SQLite backups
- [ ] Monitor for issues (first 24 hours)
- [ ] Update agent configurations

---

## Contacts

- **Dev Manager:** Dev Manager agent (Discord #dev-manager)
- **Database:** Neon Cloud Support
- **Escalation:** Matt Valenta

---

*Document Version: 1.0*
*Created: 2026-03-01*
*Last Updated: 2026-03-01*
