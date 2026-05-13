import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'
import { setWhatsappMode } from './_actions'

export const dynamic = 'force-dynamic'

interface WhatsappModeValue {
  mode?: 'central' | 'byo' | 'hybrid'
  centralBaseUrl?: string
  centralApiKey?: string
}

export default async function IntegracoesHealthPage() {
  const [rows, modeRow, credCount] = await Promise.all([
    db.integrationHealth.findMany({
      orderBy: [{ workspaceId: 'asc' }, { integration: 'asc' }],
      include: { workspace: { select: { name: true } } },
    }),
    db.systemConfig.findUnique({ where: { key: 'bhgrain.whatsapp.mode' } }),
    db.integrationCredential.groupBy({
      by: ['channel'],
      _count: { _all: true },
    }),
  ])

  const modeValue = (modeRow?.value as WhatsappModeValue | null) ?? {}
  const mode = modeValue.mode ?? 'hybrid'
  const credCountMap = Object.fromEntries(credCount.map((c) => [c.channel, c._count._all]))

  return (
    <div>
      <PageHeader
        eyebrow="BH Grain · SaaS global"
        title="Integrações"
        subtitle="Modo WhatsApp + health por workspace + cadastros de credenciais"
      />

      {/* Modo WhatsApp */}
      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Modo WhatsApp (Evolution)</h3>
        <p className="text-xs opacity-70 mb-3">
          Define como os workspaces conectam o WhatsApp:
          <strong> central</strong> = instância única do BH Grain provisiona;
          <strong> byo</strong> = cliente roda Evolution próprio;
          <strong> hybrid</strong> = cliente escolhe.
        </p>
        <form action={setWhatsappMode} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <select name="mode" defaultValue={mode} className="bg-black/20 border border-white/10 rounded px-2 py-1.5">
            <option value="central">Central</option>
            <option value="byo">BYO (Bring Your Own)</option>
            <option value="hybrid">Híbrido (cliente escolhe)</option>
          </select>
          <input
            name="centralBaseUrl"
            defaultValue={modeValue.centralBaseUrl ?? ''}
            placeholder="https://evolution.bhgrain.com.br"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5 md:col-span-2"
          />
          <input
            name="centralApiKey"
            type="password"
            placeholder={modeValue.centralApiKey ? '•••••• (deixe em branco para manter)' : 'API Key central (Evolution)'}
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
            autoComplete="new-password"
          />
          <button type="submit" className="md:col-span-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded px-3 py-1.5 transition">
            Salvar modo
          </button>
        </form>
        <p className="text-xs opacity-60 mt-2">
          Modo atual: <strong className="text-vg-accent">{mode}</strong> · centralBaseUrl: <code>{modeValue.centralBaseUrl ?? '—'}</code>
        </p>
      </Card>

      {/* Cadastros de credenciais (read-only) */}
      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Workspaces com credenciais cadastradas</h3>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-black/10 rounded p-3">
            <div className="opacity-60">E-mail (IMAP/SMTP)</div>
            <div className="text-2xl font-semibold tabular-nums">{credCountMap.email_imap_smtp ?? 0}</div>
          </div>
          <div className="bg-black/10 rounded p-3">
            <div className="opacity-60">Instagram</div>
            <div className="text-2xl font-semibold tabular-nums">{credCountMap.instagram ?? 0}</div>
          </div>
          <div className="bg-black/10 rounded p-3">
            <div className="opacity-60">WhatsApp</div>
            <div className="text-2xl font-semibold tabular-nums">{credCountMap.whatsapp ?? 0}</div>
          </div>
        </div>
        <p className="text-xs opacity-60 mt-2">
          Super-admin não consegue ler segredos. Workspaces gerenciam suas próprias credenciais em <code>/configuracoes/integracoes</code>.
        </p>
      </Card>

      {/* Health table */}
      <Card className="p-0 mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-black/10">
              <th className="px-3 py-2">Workspace</th>
              <th className="px-3 py-2">Integração</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Pendentes</th>
              <th className="px-3 py-2 text-right">Processados</th>
              <th className="px-3 py-2">Último sucesso</th>
              <th className="px-3 py-2">Último erro</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center opacity-60">Sem registros de health.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.workspace.name}</td>
                  <td className="px-3 py-2 capitalize">{r.integration}</td>
                  <td className="px-3 py-2 uppercase text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.pendingEvents}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.processedEvents}</td>
                  <td className="px-3 py-2 opacity-60 tabular-nums">{r.lastSuccessAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '—'}</td>
                  <td className="px-3 py-2 opacity-70 text-xs max-w-xs truncate">{r.lastErrorMessage ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
