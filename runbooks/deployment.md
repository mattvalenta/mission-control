# Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying Mission Control to production.

## Prerequisites

- Node.js 20+ installed
- pnpm installed
- PM2 installed
- PostgreSQL database accessible
- Environment variables configured

## Deployment Steps

### 1. Pre-Deployment

```bash
# Verify database connection
psql $POSTGRES_URL -c "SELECT 1"

# Pull latest code
cd mission-control
git pull origin main

# Check for breaking changes
git log --oneline -5
```

### 2. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### 3. Run Database Migrations

```bash
# Check pending migrations
ls migrations/

# Apply new migrations
for file in migrations/*.sql; do
  psql $POSTGRES_URL -f $file
done
```

### 4. Build Application

```bash
pnpm build
```

### 5. Start with PM2

```bash
# Stop existing instance
pm2 stop mission-control

# Start new instance
pm2 start npm --name "mission-control" -- start

# Save PM2 configuration
pm2 save
```

### 6. Verify Deployment

```bash
# Health check
curl http://localhost:4000/api/health

# Detailed health
curl http://localhost:4000/api/health/detailed

# Check logs
pm2 logs mission-control --lines 50
```

### 7. Monitor

- Watch logs for errors
- Check metrics at /api/scheduler
- Verify instance heartbeat at /api/health/detailed

## Rollback Procedure

If deployment fails:

```bash
# Stop current version
pm2 stop mission-control

# Revert code
git checkout HEAD~1

# Rebuild
pnpm build

# Restart
pm2 start mission-control
```

## Troubleshooting

### Build Fails

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall
pnpm install

# Rebuild
pnpm build
```

### Database Connection Fails

```bash
# Check environment
echo $POSTGRES_URL

# Test connection
psql $POSTGRES_URL -c "SELECT 1"

# Check Neon status at console.neon.tech
```

### PM2 Issues

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs mission-control

# Restart PM2
pm2 restart mission-control
```

---

**Version:** 1.0
**Last Updated:** March 2, 2026
