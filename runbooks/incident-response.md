# Incident Response Runbook

## Overview

This runbook provides procedures for responding to incidents in Mission Control.

## Incident Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| P1 - Critical | System down | Immediate | Matt + All agents |
| P2 - Major | Feature degraded | < 15 min | Skippy + Dev Manager |
| P3 - Minor | Limited impact | < 1 hour | Dev Manager |

## Detection

### Automated Alerts

- Instance offline > 5 minutes
- PostgreSQL connection failure
- High error rate (> 1%)
- DLQ items added
- Token usage threshold exceeded

### Manual Detection

- User reports
- Monitoring dashboard
- Log review

## Response Procedure

### Step 1: Triage (5 minutes)

```bash
# Check system health
curl localhost:4000/api/health/detailed

# Check instance status
curl localhost:4000/api/health/detailed | jq '.instances'

# Check recent errors
pm2 logs mission-control --lines 100 | grep -i error
```

### Step 2: Assess Impact

- Which features affected?
- How many users impacted?
- Is data integrity at risk?

### Step 3: Mitigate

| Issue | Action |
|-------|--------|
| Instance down | Restart, check logs, database connection |
| High error rate | Check recent changes, consider rollback |
| Database slow | Check queries, scale read replicas |
| DLQ filling | Check job failures, fix root cause |

### Step 4: Communicate

**P1/P2:**
1. Post in #dev-manager Discord
2. Notify Matt directly
3. Update incident channel

**P3:**
1. Log in incident tracker
2. Notify team lead

### Step 5: Resolve

1. Fix root cause
2. Verify fix works
3. Monitor for 30 minutes
4. Document resolution

## Common Incidents

### Database Connection Failure

```bash
# Check Neon status
# https://console.neon.tech

# Test connection
psql $POSTGRES_URL -c "SELECT 1"

# Restart application (may reconnect)
pm2 restart mission-control
```

### Instance Not Heartbeating

```bash
# Check instance logs
pm2 logs mission-control --lines 200

# Check OpenClaw gateway
curl localhost:18789/status

# Restart instance
pm2 restart mission-control
```

### High Memory Usage

```bash
# Check memory
pm2 show mission-control

# Restart to clear memory
pm2 restart mission-control

# Check for memory leaks in code
```

### Job Queue Stuck

```bash
# Check scheduler status
curl localhost:4000/api/scheduler

# Check for stuck jobs
psql $POSTGRES_URL -c "SELECT * FROM job_executions WHERE status = 'running' AND heartbeat_at < NOW() - INTERVAL '5 minutes'"

# Clear stuck jobs
psql $POSTGRES_URL -c "UPDATE job_executions SET status = 'failed' WHERE status = 'running' AND heartbeat_at < NOW() - INTERVAL '5 minutes'"
```

## Post-Incident

1. Update incident log
2. Schedule post-mortem (within 48 hours)
3. Implement preventive measures
4. Update runbooks if needed

---

**Version:** 1.0
**Last Updated:** March 2, 2026
