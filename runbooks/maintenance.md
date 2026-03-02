# Maintenance Runbook

## Overview

This runbook provides procedures for regular maintenance of Mission Control.

## Daily Tasks

### Health Check (Automated)

- Instance heartbeats verified
- Database connection verified
- No new DLQ items

### Manual Check (5 minutes)

```bash
# Quick health check
curl localhost:4000/api/health/detailed

# Check for errors in last 24 hours
pm2 logs mission-control --lines 100 | grep -i error

# Verify backup ran (if automated)
```

## Weekly Tasks

### Log Review

```bash
# Check audit logs
curl localhost:4000/api/audit?limit=50

# Look for patterns
# - Failed logins
# - Unauthorized access attempts
# - Unusual activity
```

### Database Maintenance

```bash
# Check table sizes
psql $POSTGRES_URL -c "
SELECT 
  schemaname,
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
"

# Run VACUUM if needed (Neon handles this automatically, but check)
```

### Dependency Updates

```bash
# Check for security updates
pnpm outdated

# Update if needed
pnpm update

# Rebuild and restart
pnpm build && pm2 restart mission-control
```

## Monthly Tasks

### Full Backup

```bash
# Export database
pg_dump $POSTGRES_URL > backup-$(date +%Y%m%d).sql

# Store in secure location
# (S3, local backup, etc.)
```

### Performance Review

```bash
# Check slow queries (if query logging enabled)
psql $POSTGRES_URL -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
"

# Review and optimize if needed
```

### Security Audit

```bash
# Check for unused API keys
# Review access logs
# Verify rate limiting

# Check agent permissions
psql $POSTGRES_URL -c "SELECT * FROM agents WHERE is_master = true"
```

### Documentation Review

- Update runbooks if procedures changed
- Verify contact info current
- Review monitoring thresholds

## Scheduled Jobs Review

| Job | Frequency | Verify |
|-----|-----------|--------|
| instance-heartbeat | 30s | Instances showing online |
| cleanup-stale-sessions | 1h | Sessions being cleaned |
| check-agent-heartbeats | 30m | Agents showing offline correctly |
| cleanup-old-audit-logs | 7d | Audit logs under 90 days |
| aggregate-token-usage | 1h | Daily stats updating |

## Maintenance Windows

### Planned Maintenance

1. Notify team 24 hours in advance
2. Choose low-traffic time (typically 2-4 AM CT)
3. Apply updates/migrations
4. Verify system health
5. Monitor for 1 hour post-maintenance

### Emergency Maintenance

1. Post notification immediately
2. Follow incident response procedure
3. Update team when resolved

---

**Version:** 1.0
**Last Updated:** March 2, 2026
