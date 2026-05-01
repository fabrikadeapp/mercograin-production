/**
 * Backup Cron Job
 * Run daily automated backups
 *
 * Usage:
 * 1. Local: node scripts/backup-cron.ts
 * 2. Scheduled: Add to crontab: 0 2 * * * cd /path && npm run backup
 * 3. Via API: POST /api/backups (with auth)
 *
 * Runs at 2 AM daily (configurable via BACKUP_TIME env var)
 */

import { runFullBackup, listBackups } from '../lib/backup-service'
import { redis } from '../lib/redis'

/**
 * Run backup with lock to prevent concurrent runs
 */
async function runBackupWithLock() {
  try {
    // Check if backup is already running
    const lockKey = 'backup-lock'
    const lock = await redis.get(lockKey)

    if (lock) {
      console.log('[Cron] Backup já em progresso, pulando...')
      return
    }

    // Set lock for 1 hour
    await redis.setex(lockKey, 3600, '1')

    console.log('\n' + '='.repeat(60))
    console.log('[Cron] 🚀 Iniciando backup automático')
    console.log('='.repeat(60))

    const startTime = Date.now()

    // Run backup
    const result = await runFullBackup()

    // Remove lock
    await redis.del(lockKey)

    // Log result
    const duration = Date.now() - startTime
    const success = 'duration' in result && result.duration

    if (success) {
      console.log('\n[Cron] ✅ Backup completado com sucesso!')
      console.log(`[Cron] Tempo total: ${(duration / 1000).toFixed(2)}s`)

      // List backups to show recent ones
      const backupList = await listBackups()
      if (backupList.success && backupList.backups) {
        console.log(`[Cron] Total de backups: ${backupList.count}`)
        console.log('[Cron] Últimos 3 backups:')
        backupList.backups.slice(0, 3).forEach((backup) => {
          console.log(`  - ${backup.filename} (${backup.sizeInMB}MB)`)
        })
      }
    } else {
      console.log('\n[Cron] ⚠️ Backup completado com erros')
      console.log('[Cron] Detalhes:', JSON.stringify(result, null, 2))
    }

    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('[Cron] ❌ Erro crítico:', error)

    // Remove lock on error
    await redis.del('backup-lock').catch(() => {})
  } finally {
    // Disconnect Redis
    process.exit(0)
  }
}

// Run if called directly
if (require.main === module) {
  runBackupWithLock()
}

export { runBackupWithLock }
