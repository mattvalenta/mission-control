# Rollback Runbook

## Overview

This runbook provides procedures for rolling back Mission Control to a previous version.

## When to Rollback

- Critical bugs in production
- Performance degradation
- Security vulnerabilities
- Failed feature deployment

## Rollback Decision

### Quick Assessment (5 minutes)

1. Check error rate: `curl localhost:4000/api/health/detailed`
2. Check recent errors: `pm2 logs mission-control --lines 100`
3. Determine scope of issue

### Decision Matrix

| Issue Severity | Action |
|----------------|--------|
| Critical (system down) | Immediate rollback |
| Major (feature broken) | Rollback within 15 min |
| Minor (degraded performance) | Fix forward if quick, otherwise rollback |

## Rollback Procedure

### Option A: Code Rollback (Recommended)

```bash
# 1. Stop current instance
pm2 stop mission-control

# 2. Find previous good commit
git log --oneline -10
# Note the commit hash to rollback to

# 3. Checkout previous version
git checkout <commit-hash>

# 4. Rebuild
pnpm build

# 5. Start
pm2 start mission-control

# 6. Verify
curl localhost:4000/api/health
```

### Option B: Database Rollback (If schema changed)

```bash
# ⚠️ WARNING: Database rollback can cause data loss

# 1. Stop application
pm2 stop mission-control

# 2. Backup current state
pg_dump $POSTGRES_URL > backup-$(date +%Y%m%d).sql

# 3. Restore from previous backup
psql $POSTGRES_URL < backup-previous.sql

# 4. Restart application
pm2 start mission-control
```

### Option C: Emergency Maintenance Mode

```bash
# 1. Stop accepting requests
pm2 stop mission-control

# 2. Put up maintenance page (if applicable)
# Or redirect DNS

# 3. Fix issue

# 4. Restart
pm2 start mission-control
```

## Post-Rollback

1. Document what happened
2. Update incident log
3. Notify stakeholders
4. Schedule post-mortem
5. Plan fix for rolled-back changes

## Rollback Checklist

- [ ] Application stopped
- [ ] Previous version deployed
- [ ] Database restored (if needed)
- [ ] Health check passes
- [ ] Logs show no errors
- [ ] Stakeholders notified
- [ ] Incident documented

---

**Version:** 1.0
**Last Updated:** March 2, 2026
