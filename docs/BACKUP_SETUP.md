# Automated Backup Setup Guide

## Overview

MercoGrain has automated backup system that:
- ✅ Daily database backups (PostgreSQL)
- ✅ Compressed file archives
- ✅ Local storage with retention policy (30 days)
- ✅ Manual triggers via API
- ✅ Admin dashboard

---

## Quick Start

### 1. Manual Backup (Test)

**Via API:**
```bash
# Trigger backup
curl -X POST http://localhost:3000/api/backups \
  -H "Authorization: Bearer YOUR_SESSION"

# List backups
curl http://localhost:3000/api/backups \
  -H "Authorization: Bearer YOUR_SESSION"
```

**Via CLI:**
```bash
npm run backup:run
```

### 2. Setup Automated Daily Backup

Choose one method:

#### **Method A: crontab (Linux/macOS)**

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM daily):
0 2 * * * cd /path/to/mercograin && npm run backup:run

# Or at 3 AM:
0 3 * * * cd /path/to/mercograin && npm run backup:run

# Verify:
crontab -l
```

#### **Method B: systemd timer (Linux)**

Create `/etc/systemd/system/mercograin-backup.service`:
```ini
[Unit]
Description=MercoGrain Daily Backup
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/mercograin
ExecStart=/usr/bin/npm run backup:run
User=your_user
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/mercograin-backup.timer`:
```ini
[Unit]
Description=MercoGrain Daily Backup Timer
Requires=mercograin-backup.service

[Timer]
OnBootSec=10min
OnUnitActiveSec=1d
AccuracySec=1min

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable mercograin-backup.timer
sudo systemctl start mercograin-backup.timer
sudo systemctl status mercograin-backup.timer
```

#### **Method C: Heroku (if using)**

Add this file as `.heroku/release`:
```bash
#!/bin/sh
npm run backup:run
```

#### **Method D: Docker (Compose)**

Add to `docker-compose.yml`:
```yaml
backup:
  image: node:18-alpine
  working_dir: /app
  command: npm run backup:run
  volumes:
    - .:/app
    - /path/to/backups:/app/.backups
  environment:
    - DATABASE_URL=postgresql://...
    - REDIS_URL=redis://...
  depends_on:
    - postgres
    - redis
  schedule: "0 2 * * *"  # 2 AM daily
```

---

## Backup Storage

### Default Location
```
.backups/
├── backup-db-2026-05-01T02-00-00.sql.gz
├── backup-files-2026-05-01T02-05-00.tar.gz
└── ...
```

### What Gets Backed Up

**Database:**
- All tables (User, Cliente, Proposta, Contrato, Boleto, Cotacao, etc)
- Compressed with gzip
- ~5-50MB typical

**Files:**
- `.data/whatsapp-auth` (Baileys session)
- `public/uploads` (user files)
- `prisma/` (schema, migrations)
- ~10-100MB typical

---

## Retention Policy

- **Keep:** Last 30 days of backups
- **Auto-cleanup:** Runs after each backup
- **Manual delete:** Via `GET /api/backups?delete=filename.gz`

Example: Backup from April 1st is deleted on May 1st

---

## Restore from Backup

### Restore Database

```bash
# List available backups
ls -lah .backups/backup-db-*.sql.gz

# Decompress
gunzip backup-db-2026-05-01T02-00-00.sql.gz

# Restore (be careful!)
psql "$DATABASE_URL" < backup-db-2026-05-01T02-00-00.sql
```

### Restore Files

```bash
# Extract files
tar -xzf backup-files-2026-05-01T02-05-00.tar.gz

# This restores:
# - .data/whatsapp-auth/
# - public/uploads/
# - prisma/
```

---

## Monitoring

### Check Last Backup

```bash
# Via API
curl http://localhost:3000/api/backups \
  -H "Authorization: Bearer YOUR_SESSION" | jq '.backups[0]'

# Via CLI
ls -lt .backups/ | head -1
```

### Check Backup Health

```bash
# Verify compressed file integrity
gunzip -t .backups/backup-db-*.sql.gz && echo "✅ OK"

# Extract and test
tar -tzf .backups/backup-files-*.tar.gz | head -10
```

### Logs

Backups are logged to:
- **Console:** stdout/stderr
- **Docker:** `docker logs container_name`
- **Systemd:** `journalctl -u mercograin-backup.timer -f`
- **Cron:** `/var/log/syslog` or `mail`

---

## Upload to Remote Storage

For production, back up to cloud storage (free options):

### Option 1: Google Drive (Free)

```bash
# Install gdrive CLI
curl https://github.com/prasmussen/gdrive/releases/download/2.1.1/gdrive-linux-x64.gz | gunzip > gdrive
chmod +x gdrive

# Authenticate
./gdrive auth

# Add to cron:
0 2 * * * cd /path && npm run backup:run && ./gdrive upload .backups/backup-*.gz --parent YOUR_FOLDER_ID
```

### Option 2: AWS S3 (Free tier)

```bash
# Install AWS CLI
npm install aws-cli-js

# Configure
aws configure

# Add to script:
aws s3 sync .backups/ s3://mercograin-backups/ --delete
```

### Option 3: Backblaze B2 (Free 10GB)

```bash
# Install CLI
npm install @backblaze-b2/cli

# Authenticate and sync
b2 sync --keepDays 30 .backups/ b2://mercograin-backups/
```

### Option 4: Vercel Postgres Backups

If using Vercel Postgres:
```bash
# Automatic backups included!
# Access via: vercel.com/dashboard → Storage → Backups
```

---

## Troubleshooting

### "pg_dump not found"

Install PostgreSQL client:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Docker
docker run -v /path/to/backups postgres pg_dump "$DATABASE_URL" > backup.sql
```

### "Backup lock exists"

Backup already running:
```bash
# Check if process is stuck
redis-cli GET backup-lock

# Force clear (careful!):
redis-cli DEL backup-lock
```

### "Out of disk space"

Manual cleanup:
```bash
# Delete old backups manually
rm .backups/backup-db-2026-04-*.gz

# Or change retention policy in lib/backup-service.ts:
# const RETENTION_DAYS = 30  // Change to 7, 14, etc
```

---

## Configuration

Edit `lib/backup-service.ts`:

```typescript
// Change retention days
const RETENTION_DAYS = 30

// Change backup directory
const BACKUP_DIR = path.join(process.cwd(), '.backups')

// Change directories to backup
const dirsToBackup = ['.data/whatsapp-auth', 'public/uploads', 'prisma']
```

---

## Security

✅ Backups stored locally (outside `.gitignore`)
✅ Admin-only API endpoints
✅ Compressed with gzip
✅ Lock mechanism prevents concurrent runs
✅ Path traversal protection on delete

⚠️ **For production:**
- Upload to remote (S3, Google Drive, etc)
- Encrypt backups before upload
- Test restore procedures monthly
- Monitor backup job success

---

## Costs

| Storage | Cost | Setup |
|---------|------|-------|
| Local disk | Free | Already set up |
| Google Drive | Free (15GB) | 5 min |
| AWS S3 | Free (12 months, 5GB) | 10 min |
| Backblaze B2 | Free (10GB) | 10 min |
| Vercel Postgres | Included | N/A |

---

## Next Steps

- [ ] Run manual backup: `npm run backup:run`
- [ ] Set up cron job (choose method above)
- [ ] Configure remote storage (recommended)
- [ ] Test restore procedure
- [ ] Monitor first backup run
- [ ] Set up alerting on failure

---

*Automated backups are critical for production systems!*
