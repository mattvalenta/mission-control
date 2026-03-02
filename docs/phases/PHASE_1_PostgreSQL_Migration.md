# Phase 1: PostgreSQL Migration

**Duration:** 3 Weeks  
**Priority:** 🔴 Critical  
**Risk Level:** High  
**Dependencies:** None (First Phase)

---

## Objective

Replace SQLite with PostgreSQL as the primary database for Mission Control. This is the foundation for all subsequent phases and enables distributed multi-instance architecture.

---

## Success Criteria

- [ ] All SQLite tables migrated to PostgreSQL
- [ ] All API routes work with PostgreSQL
- [ ] Data integrity validated (row counts match)
- [ ] Rollback procedure tested and documented
- [ ] Zero data loss during migration
- [ ] Performance acceptable (< 100ms query times)

---

## Week 1: Schema & Scripts

### Tasks

#### 1.1 Create PostgreSQL Schema
- [ ] Create `schema-v2.sql` with all tables
- [ ] Add UUID extension
- [ ] Add all indexes
- [ ] Add constraints and foreign keys
- [ ] Test schema in Neon development database

**Deliverable:** `migrations/schema-v2.sql`

```sql
-- Key tables to create:
-- - mc_instances
-- - workspaces
-- - agents
-- - tasks (with version column)
-- - planning_questions
-- - planning_specs
-- - task_activities
-- - task_deliverables
-- - openclaw_sessions
-- - events
-- - token_usage (new)
-- - dead_letter_queue (new)
-- - scheduled_jobs (new)
-- - job_executions (new)
-- - audit_log (new)
-- - quality_reviews (new)
-- - webhooks (new)
-- - webhook_deliveries (new)
-- - feature_flags (new)
-- - metrics (new)
```

#### 1.2 Create Migration Scripts
- [ ] `scripts/export-sqlite-to-json.ts` - Export SQLite data
- [ ] `scripts/migrate-sqlite-to-postgres.ts` - Main migration
- [ ] `scripts/validate-migration.ts` - Validate counts

**Deliverable:** Migration scripts in `scripts/`

#### 1.3 Create Database Module
- [ ] Create `src/lib/db/postgres.ts`
- [ ] Implement connection pooling
- [ ] Create query helpers (queryAll, queryOne, run, transaction)
- [ ] Add error handling and logging

**Deliverable:** `src/lib/db/postgres.ts`

---

## Week 2: API Updates

### Tasks

#### 2.1 Update Database Connection
- [ ] Replace SQLite imports with PostgreSQL
- [ ] Update environment variable: `DATABASE_URL=postgresql://...`
- [ ] Test connection from local development

#### 2.2 Update All API Routes

Query syntax changes:
```typescript
// SQLite → PostgreSQL
datetime('now') → NOW()
? placeholders → $1, $2, $3
RETURNING * → RETURNING * (works in Postgres)
INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
```

Routes to update:
- [ ] `/api/tasks` - All CRUD operations
- [ ] `/api/tasks/[id]` - Single task operations
- [ ] `/api/tasks/[id]/dispatch` - Task dispatch
- [ ] `/api/tasks/[id]/planning/*` - Planning routes
- [ ] `/api/tasks/[id]/activities` - Activity logging
- [ ] `/api/tasks/[id]/deliverables` - Deliverables
- [ ] `/api/agents` - Agent CRUD
- [ ] `/api/agents/register` - Agent registration
- [ ] `/api/agent/*` - Agent-specific routes
- [ ] `/api/events/*` - Events and SSE
- [ ] `/api/clarifications/*` - Clarification queue
- [ ] `/api/sync/*` - Sync status

#### 2.3 Update Query Syntax
- [ ] Replace all `datetime('now')` with `NOW()`
- [ ] Replace `?` placeholders with `$1, $2, $3`
- [ ] Update INSERT statements for RETURNING
- [ ] Add ON CONFLICT clauses where needed

#### 2.4 Update TypeScript Types
- [ ] Update any SQLite-specific types
- [ ] Add new PostgreSQL-specific types if needed

---

## Week 3: Testing & Deployment

### Tasks

#### 3.1 Pre-Migration Testing
- [ ] Run full test suite against PostgreSQL
- [ ] Manual testing of all dashboard features
- [ ] Performance testing (query times)
- [ ] Test migration scripts on staging data

#### 3.2 Migration Day Procedure

**STOP Phase (15 minutes):**
- [ ] Stop all Mission Control instances
- [ ] Stop all agent polling scripts
- [ ] Verify no active tasks in progress

**BACKUP Phase (10 minutes):**
- [ ] Create SQLite backup:
  ```bash
  cp mission-control.db mission-control.db.pre-migration-$(date +%Y%m%d)
  ```
- [ ] Export data to JSON:
  ```bash
  node scripts/export-sqlite-to-json.ts > backup-data.json
  ```
- [ ] Verify backup integrity

**MIGRATE Phase (30-60 minutes):**
- [ ] Run migration script:
  ```bash
  node scripts/migrate-sqlite-to-postgres.ts
  ```
- [ ] Validate row counts match:
  ```bash
  node scripts/validate-migration.ts
  ```
- [ ] Spot-check data integrity

**STARTUP Phase (15 minutes):**
- [ ] Update environment variables
- [ ] Start Skippy's MC with PostgreSQL
- [ ] Verify dashboard loads
- [ ] Test basic operations
- [ ] Start other instances

#### 3.3 Post-Migration Validation
- [ ] All tasks visible
- [ ] All agents visible
- [ ] Task creation works
- [ ] Task dispatch works
- [ ] Agent status updates work
- [ ] Planning workflow works

#### 3.4 Documentation
- [ ] Update README with PostgreSQL requirements
- [ ] Document environment variables
- [ ] Document rollback procedure

---

## Rollback Plan

If migration fails:

```bash
# 1. Stop PostgreSQL MC instances
pm2 stop mission-control  # or equivalent

# 2. Revert environment
export DATABASE_URL="sqlite://./mission-control.db"

# 3. Restore SQLite backup
cp mission-control.db.pre-migration-$(date +%Y%m%d) mission-control.db

# 4. Restart with SQLite
npm run dev  # or production equivalent
```

---

## Files Changed

### New Files
- `migrations/schema-v2.sql`
- `scripts/export-sqlite-to-json.ts`
- `scripts/migrate-sqlite-to-postgres.ts`
- `scripts/validate-migration.ts`
- `src/lib/db/postgres.ts`

### Modified Files
- `src/lib/db/index.ts` - Switch to PostgreSQL
- `src/app/api/**/route.ts` - All API routes
- `.env.example` - Add POSTGRES_URL
- `package.json` - Add pg dependency

---

## Environment Variables

```bash
# Required
POSTGRES_URL=postgresql://user:pass@host:5432/database?sslmode=require

# Optional
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

---

## Testing Checklist

### Unit Tests
- [ ] Database connection
- [ ] Query helpers
- [ ] Transaction handling
- [ ] Error handling

### Integration Tests
- [ ] Task CRUD
- [ ] Agent CRUD
- [ ] Planning workflow
- [ ] Dispatch flow
- [ ] Activity logging

### Performance Tests
- [ ] Query time < 100ms for simple queries
- [ ] Query time < 500ms for complex queries
- [ ] Connection pooling works
- [ ] Concurrent connections handled

---

## Dependencies

- `pg` - PostgreSQL client
- `@types/pg` - TypeScript types

```bash
pnpm add pg @types/pg
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss | Full backup + JSON export |
| Migration script bug | Test on staging first |
| Performance regression | Benchmark before/after |
| API breaking changes | Keep SQLite fallback |
| Connection pool exhaustion | Configure pool limits |

---

## Sign-Off

- [ ] Dev Manager approved
- [ ] Migration scripts tested on staging
- [ ] Rollback procedure tested
- [ ] Documentation updated

**Approved by:** ________________  
**Date:** ________________
