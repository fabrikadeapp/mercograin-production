import { auth } from '@/auth'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { DDSDetailActions } from '../_components/DDSDetailActions'

export const dynamic = 'force-dynamic'

export default async function DDSDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const dds = await db.dueDiligenceStatement.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { contrato: { select: { id: true, numero: true } } },
  })
  if (!dds) notFound()

  const propriedades = Array.isArray(dds.propriedadesOrigem) ? (dds.propriedadesOrigem as any[]) : []
  const lotes = Array.isArray(dds.lotesEnvolvidos) ? (dds.lotesEnvolvidos as any[]) : []
  const fatores = Array.isArray(dds.riscoFatores) ? (dds.riscoFatores as any[]) : []

  return (
    <AppShell>
      <PageHeader
        eyebrow={`EUDR · ${dds.numero}`}
        title={`DDS ${dds.numero}`}
        subtitle={`Conclusão: ${dds.conclusao} · Risco: ${dds.riscoNivel}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <h3 className="font-semibold mb-2">Operador</h3>
          <p className="text-sm">{dds.operadorNome}</p>
          <p className="text-xs text-zinc-400">CNPJ {dds.operadorCnpj}</p>
          <p className="text-xs text-zinc-400 mt-1">{dds.operadorEndereco}</p>
        </Card>
        <Card>
          <h3 className="font-semibold mb-2">Produto</h3>
          <p className="text-sm">{dds.cultura} (NCM {dds.ncm})</p>
          <p className="text-xs text-zinc-400">
            {dds.qtdToneladas.toLocaleString('pt-BR')} t
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold mb-2">Risco</h3>
          <p className="text-sm capitalize">Nível: {dds.riscoNivel}</p>
          <p className="text-xs text-zinc-400">{fatores.length} fator(es)</p>
        </Card>
      </div>

      <DDSDetailActions
        dds={{
          id: dds.id,
          conclusao: dds.conclusao,
          atestadoEm: dds.atestadoEm?.toISOString() || null,
          pdfUrl: dds.pdfUrl,
          riscoNivel: dds.riscoNivel,
        }}
      />

      <Card className="mt-4">
        <h3 className="font-semibold mb-2">Cadeia de Custódia — Lotes</h3>
        {lotes.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem lotes vinculados.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-zinc-400 text-left">
              <tr>
                <th className="px-2 py-1">Lote</th>
                <th className="px-2 py-1">Qtd (sc)</th>
                <th className="px-2 py-1">Talhões origem</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-2 py-1">{l.numero}</td>
                  <td className="px-2 py-1">{Number(l.qtdSc).toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-1">{(l.talhoesOrigem || []).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold mb-2">Propriedades de Origem</h3>
        {propriedades.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem propriedades vinculadas.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-zinc-400 text-left">
              <tr>
                <th className="px-2 py-1">Propriedade</th>
                <th className="px-2 py-1">CAR</th>
                <th className="px-2 py-1">Status CAR</th>
                <th className="px-2 py-1">UF</th>
                <th className="px-2 py-1">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {propriedades.map((p, i) => {
                const alertas = [
                  p.embargoIbama ? 'IBAMA' : null,
                  p.sobreposicaoTI ? 'TI' : null,
                  p.sobreposicaoUC ? 'UC' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-2 py-1">{p.nome}</td>
                    <td className="px-2 py-1">{p.car || '—'}</td>
                    <td className="px-2 py-1">{p.carStatus || '—'}</td>
                    <td className="px-2 py-1">{p.uf || '—'}</td>
                    <td className="px-2 py-1">{alertas}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold mb-2">Fatores de Risco</h3>
        {fatores.length === 0 ? (
          <p className="text-sm text-emerald-400">Sem fatores identificados.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {fatores.map((f, i) => (
              <li key={i}>
                <span className="text-zinc-400">[{f.gravidade}]</span> {f.descricao}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  )
}
