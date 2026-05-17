import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { withCronLog } from '@/lib/cron/with-log'
import { uploadFile } from '@/lib/storage/local'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Cron — backup Postgres diário.
 *
 * Roda pg_dump em modo plain (compatível com mais ferramentas),
 * comprime gzip, salva no Railway Volume em /data/uploads/backups/.
 *
 * Retenção: 30 dias (purga arquivos antigos).
 *
 * Auth: Bearer CRON_SECRET
 * Schedule sugerido: 0 4 * * * (diário 04:00 UTC)
 */
async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!directUrl) {
    throw new Error('DIRECT_URL não configurada')
  }

  // Roda pg_dump
  const { buffer, sizeBytes } = await runPgDump(directUrl)
  const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const fileName = `mercograin-${date}.sql.gz`

  await uploadFile({
    bucket: 'backups',
    path: fileName,
    buffer,
    contentType: 'application/gzip',
  })

  // Limpa backups antigos (>30 dias) — usa Prisma metadata via lib mas como
  // estamos em volume puro, precisamos listar e filtrar
  const { listFiles, deleteFile } = await import('@/lib/storage/local')
  const all = await listFiles('backups')
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000
  const toDelete = all
    .filter((f) => f.createdAt.getTime() < cutoff)
    .map((f) => f.name)
  if (toDelete.length > 0) {
    await deleteFile('backups', toDelete)
  }

  // Log via SpedExport-like opcional — pulamos pra simplicidade
  return NextResponse.json({
    ok: true,
    fileName,
    sizeBytes,
    purged: toDelete.length,
  })
}

async function runPgDump(
  directUrl: string,
): Promise<{ buffer: Buffer; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    // pg_dump | gzip
    const dump = spawn('pg_dump', [directUrl, '--no-owner', '--no-acl'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const gzip = spawn('gzip', ['-c'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    dump.stdout.pipe(gzip.stdin)

    const chunks: Buffer[] = []
    gzip.stdout.on('data', (c: Buffer) => chunks.push(c))

    let stderrAcc = ''
    dump.stderr.on('data', (d) => (stderrAcc += d.toString()))
    gzip.stderr.on('data', (d) => (stderrAcc += d.toString()))

    dump.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump exited ${code}: ${stderrAcc}`))
      }
    })

    gzip.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`gzip exited ${code}: ${stderrAcc}`))
        return
      }
      const buffer = Buffer.concat(chunks)
      resolve({ buffer, sizeBytes: buffer.length })
    })
  })
}

export async function GET(req: Request) {
  return withCronLog('pg-backup', () => handle(req))
}
export async function POST(req: Request) {
  return withCronLog('pg-backup', () => handle(req))
}
