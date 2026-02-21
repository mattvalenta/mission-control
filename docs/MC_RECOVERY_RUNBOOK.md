# Mission Control Recovery Runbook

## Quick Recovery Commands

### Check Status
```bash
/Users/matt/clawd/mission-control/scripts/mc-health-monitor.sh --check
```

### Auto-Recover (Fixes Everything)
```bash
/Users/matt/clawd/mission-control/scripts/mc-health-monitor.sh --recover
```

### Manual Quick Start
```bash
/Users/matt/clawd/mission-control/scripts/mc-start.sh
```

## Common Issues

### MC Not Running (localhost:4000 down)
```bash
pkill -f "next dev.*4000"
cd /Users/matt/clawd/mission-control && npm run dev -- -p 4000 &
```

### ngrok Tunnel Down
```bash
pkill -f "ngrok http"
/tmp/ngrok http 4000 --authtoken="2tKg6ra7pKpNieY0mNaoNc61Iko_7uJMAJkkGxvDy23QTumBA" &
```

### Both Down
```bash
/Users/matt/clawd/mission-control/scripts/mc-start.sh
```

## URLs

- **Local:** http://localhost:4000
- **Public:** https://loculicidally-unfluttering-clemmie.ngrok-free.dev

## Logs

- MC Server: `/tmp/mc-server.log`
- Recovery: `/tmp/mc-recovery.log`

## Auto-Recovery

Cron job runs every 5 minutes:
- Checks MC health
- Restarts if down
- No notifications sent

To manually trigger: Run the auto-recover command above.
