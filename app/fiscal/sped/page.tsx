import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { SpedActions } from '../_components/SpedActions'

export const dynamic = 'force-dynamic'

export default async function SpedPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const exports_ = await db.spedExport.findMany({
    where: scope.whereOwn(),
    orderBy: [{ competencia: 'desc' }, { tipo: 'asc' }],
    take: 50,
  })

  const hoje = new Date()
  const competenciaAtual = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const compAnterior = (() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · SPED"
        title="SPED Fiscal & Contribuições"
        subtitle="Geração mensal de EFD-ICMS/IPI e EFD-Contribuições conforme layout 2024 da Receita Federal."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="text-h3 mb-2">SPED Fiscal — EFD-ICMS/IPI</h3>
          <p className="text-fg-3 text-small mb-3">Bloco 0 (cadastros), Bloco C (NF-e), Bloco 9 (totalizadores).</p>
          <SpedActions tipo="fiscal" competencia={compAnterior} compAtual={competenciaAtual} />
        </Card>
        <Card className="p-5">
          <h3 className="text-h3 mb-2">SPED Contribuições — PIS/COFINS</h3>
          <p className="text-fg-3 text-small mb-3">Apuração mensal de contribuições federais para Lucro Real / Presumido.</p>
          <SpedActions tipo="contribuicoes" competencia={compAnterior} compAtual={competenciaAtual} />
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="text-h3">Histórico de exportações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="text-micro uppercase text-fg-3 bg-bg-2">
              <tr>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Competência</th>
                <th className="px-4 py-3 text-right">Registros</th>
                <th className="px-4 py-3 text-left">Hash</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Gerado em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {exports_.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-fg-3">Nenhum SPED gerado.</td></tr>
              )}
              {exports_.map((s) => (
                <tr key={s.id} className="border-t border-border-1">
                  <td className="px-4 py-3">{s.tipo === 'fiscal' ? 'SPED Fiscal' : 'SPED Contribuições'}</td>
                  <td className="px-4 py-3 t-num">{s.competencia}</td>
                  <td className="px-4 py-3 text-right t-num">{s.totalRegistros}</td>
                  <td className="px-4 py-3 font-mono text-micro">{s.hashArquivo?.slice(0, 12) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-micro uppercase font-semibold ${s.status === 'pronto' ? 'text-pos' : s.status === 'erro' ? 'text-neg' : 'text-fg-3'}`}>
                      {s.status}
                    </span>
                    {s.erroMsg && <div className="text-micro text-neg">{s.erroMsg}</div>}
                  </td>
                  <td className="px-4 py-3 text-fg-3">
                    {s.geradoEm ? new Date(s.geradoEm).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'pronto' && (
                      <a href={`/api/fiscal/sped/${s.id}/download`} className="text-accent">Baixar</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
