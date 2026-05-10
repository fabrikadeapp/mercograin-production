'use client'
import * as React from 'react'
import {
  PageHeader,
  Card,
  Button,
  DenseTable,
  EmptyState,
} from '@/components/ui/phb'
import { Database, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { RelativeTime } from '../../_components/atoms'

interface Backup {
  name: string
  size: number | null
  createdAt: string | null
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function BackupsContent({
  initialBackups,
  loadError,
}: {
  initialBackups: Backup[]
  loadError: string | null
}) {
  const [backups] = React.useState<Backup[]>(initialBackups)
  const [downloading, setDownloading] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showRestore, setShowRestore] = React.useState(false)

  async function handleDownload(name: string) {
    setError(null)
    setDownloading(name)
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const { url } = (await res.json()) as { url: string }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar URL')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups Postgres"
        subtitle="Backup automático diário (00:00 BRT) → Supabase Storage. Retenção: 30 dias."
      />

      {loadError && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-small text-red-400">
            Erro ao carregar backups: {loadError}
          </p>
          <p className="text-micro text-fg-3 mt-2">
            Verifique se o bucket <code>phb-grain-backups</code> existe no
            Supabase e se a service_role key tem acesso.
          </p>
        </Card>
      )}

      {error && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-small text-red-400">{error}</p>
        </Card>
      )}

      {backups.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Database}
            title="Nenhum backup ainda"
            description="O cron diário roda às 00:00 BRT (03:00 UTC). Primeiro backup aparecerá aqui amanhã. Você também pode disparar manualmente via GitHub Actions → Backup Postgres Diário → Run workflow."
          />
        </Card>
      ) : (
        <DenseTable<Backup>
          rows={backups}
          rowKey={(b) => b.name}
          columns={[
            {
              key: 'name',
              header: 'Arquivo',
              accessor: (b) => (
                <span className="font-mono text-micro">{b.name}</span>
              ),
            },
            {
              key: 'size',
              header: 'Tamanho',
              accessor: (b) => formatBytes(b.size),
              isNumeric: true,
              align: 'right',
            },
            {
              key: 'createdAt',
              header: 'Criado',
              accessor: (b) =>
                b.createdAt ? (
                  <RelativeTime date={b.createdAt} />
                ) : (
                  <span className="text-fg-3">—</span>
                ),
            },
            {
              key: 'action',
              header: '',
              align: 'right',
              accessor: (b) => (
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                  loading={downloading === b.name}
                  onClick={() => handleDownload(b.name)}
                >
                  Baixar
                </Button>
              ),
            },
          ]}
        />
      )}

      <Card className="p-5">
        <button
          type="button"
          onClick={() => setShowRestore((v) => !v)}
          className="flex items-center gap-2 text-body font-semibold text-fg-1 hover:text-accent transition-colors"
        >
          {showRestore ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Como restaurar um backup
        </button>
        {showRestore && (
          <div className="mt-4 space-y-3 text-small text-fg-2">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Baixar o arquivo <code>.sql.gz</code> via botão acima (URL
                assinada válida por 1h).
              </li>
              <li>
                Descomprimir:{' '}
                <code className="font-mono text-micro bg-bg-2 px-1.5 py-0.5 rounded">
                  gunzip phb-grain-YYYY-MM-DD_HHMMSS.sql.gz
                </code>
              </li>
              <li>
                Conectar ao Postgres destino — <strong>NUNCA</strong> aplicar em
                produção sem backup atual.
              </li>
              <li>
                Executar:{' '}
                <code className="font-mono text-micro bg-bg-2 px-1.5 py-0.5 rounded">
                  psql DATABASE_URL &lt; phb-grain-YYYY-MM-DD_HHMMSS.sql
                </code>
              </li>
              <li>
                Verificar tabelas: <code>\dt</code>
              </li>
              <li>
                Validar:{' '}
                <code className="font-mono text-micro bg-bg-2 px-1.5 py-0.5 rounded">
                  SELECT count(*) FROM &quot;Workspace&quot;;
                </code>
              </li>
            </ol>
            <div className="mt-4 p-3 rounded border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 text-micro">
              <strong>Atenção:</strong> pg_dump foi usado com{' '}
              <code>--clean --if-exists</code> — vai DROPAR tabelas existentes
              antes de recriá-las. Para restore parcial, edite o <code>.sql</code>{' '}
              antes de aplicar. Schemas <code>auth</code> e <code>storage</code>{' '}
              (Supabase) NÃO estão no dump.
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
