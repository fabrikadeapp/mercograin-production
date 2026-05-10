import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import {
  AppShell,
  PageHeader,
  Card,
  KPICard,
  ProgressBar,
} from '@/components/ui/phb'
import { NovoPlanoDialog } from '../_components/NovoPlanoDialog'

export const dynamic = 'force-dynamic'

export default async function PlanoVendasPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const [planos, contratos, safras] = await Promise.all([
    db.planoVendas.findMany({
      where: { ...scope.whereOwn(), status: 'ativo' },
      include: { safra: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.contrato.findMany({
      where: {
        ...scope.whereOwn(),
        statusAssinatura: { not: 'cancelado' },
      },
      select: {
        fixacao: { select: { qtdFixadaSc: true } },
        proposta: { select: { graos: true } },
      },
    }),
    db.safra.findMany({
      where: { ...scope.whereOwn() },
      select: { id: true, nome: true, cultura: true, ativa: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Agrega contratado/fixado por cultura
  const aggByCultura = new Map<
    string,
    { contratada: number; fixada: number }
  >()
  for (const c of contratos) {
    const graos = (c.proposta?.graos as any) || []
    if (Array.isArray(graos)) {
      for (const g of graos) {
        const cultura = String(g.grao || g.label || '').toLowerCase()
        if (!cultura) continue
        const acc = aggByCultura.get(cultura) || { contratada: 0, fixada: 0 }
        acc.contratada += Number(g.volumeSc ?? g.quantidadeSc ?? 0)
        aggByCultura.set(cultura, acc)
      }
    }
    if (c.fixacao) {
      // Sem ligação direta de fixacao→cultura: distribui pra todas culturas iguais (heurística simples).
      // Se tiver 1 cultura no contrato, soma toda; se tiver mais, divide igual.
      const culturas = Array.isArray(c.proposta?.graos)
        ? Array.from(
            new Set(
              (c.proposta!.graos as any[])
                .map((g) => String(g.grao || g.label || '').toLowerCase())
                .filter(Boolean)
            )
          )
        : []
      const share =
        culturas.length > 0 ? c.fixacao.qtdFixadaSc / culturas.length : 0
      for (const cult of culturas) {
        const acc = aggByCultura.get(cult) || { contratada: 0, fixada: 0 }
        acc.fixada += share
        aggByCultura.set(cult, acc)
      }
    }
  }

  const totalPrevisto = planos.reduce((a, p) => a + p.qtdPrevistaSc, 0)
  const totalContratado = planos.reduce(
    (a, p) =>
      a + (aggByCultura.get(p.cultura.toLowerCase())?.contratada || 0),
    0
  )
  const totalFixado = planos.reduce(
    (a, p) => a + (aggByCultura.get(p.cultura.toLowerCase())?.fixada || 0),
    0
  )
  const totalEntregue = planos.reduce((a, p) => a + p.qtdEntregueSc, 0)

  return (
    <AppShell>
      <PageHeader
        eyebrow="Originação · Plano"
        title="Plano de Vendas"
        subtitle="Forecast por safra e cultura, com progresso vs realizado."
        actions={<NovoPlanoDialog safras={safras} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="Previsto (sc)"
          value={Math.round(totalPrevisto).toLocaleString('pt-BR')}
        />
        <KPICard
          eyebrow="Contratado (sc)"
          value={Math.round(totalContratado).toLocaleString('pt-BR')}
        />
        <KPICard
          eyebrow="Fixado (sc)"
          value={Math.round(totalFixado).toLocaleString('pt-BR')}
        />
        <KPICard
          eyebrow="Entregue (sc)"
          value={Math.round(totalEntregue).toLocaleString('pt-BR')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {planos.length === 0 && (
          <Card>
            <p className="text-fg-3 text-center py-6">
              Nenhum plano de vendas ativo. Crie um para começar a acompanhar.
            </p>
          </Card>
        )}
        {planos.map((p) => {
          const agg = aggByCultura.get(p.cultura.toLowerCase()) || {
            contratada: 0,
            fixada: 0,
          }
          const pctContrat =
            p.qtdPrevistaSc > 0 ? (agg.contratada / p.qtdPrevistaSc) * 100 : 0
          const pctFixada =
            p.qtdPrevistaSc > 0 ? (agg.fixada / p.qtdPrevistaSc) * 100 : 0
          const pctEntreg =
            p.qtdPrevistaSc > 0 ? (p.qtdEntregueSc / p.qtdPrevistaSc) * 100 : 0
          return (
            <Card key={p.id}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold capitalize text-fg-1">
                    {p.cultura}
                  </h3>
                  <p className="text-small text-fg-3">
                    {p.safra ? `Safra ${p.safra.nome}` : 'Sem safra vinculada'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-h3 t-num text-fg-1">
                    {p.qtdPrevistaSc.toLocaleString('pt-BR')} sc
                  </div>
                  <div className="text-micro text-fg-3 uppercase">previsto</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-small mb-1">
                    <span className="text-fg-2">Contratado</span>
                    <span className="t-num text-fg-1">
                      {Math.round(agg.contratada).toLocaleString('pt-BR')} sc ·{' '}
                      {pctContrat.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={pctContrat} />
                </div>
                <div>
                  <div className="flex justify-between text-small mb-1">
                    <span className="text-fg-2">Fixado</span>
                    <span className="t-num text-fg-1">
                      {Math.round(agg.fixada).toLocaleString('pt-BR')} sc ·{' '}
                      {pctFixada.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={pctFixada} />
                </div>
                <div>
                  <div className="flex justify-between text-small mb-1">
                    <span className="text-fg-2">Entregue</span>
                    <span className="t-num text-fg-1">
                      {Math.round(p.qtdEntregueSc).toLocaleString('pt-BR')} sc ·{' '}
                      {pctEntreg.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={pctEntreg} />
                </div>
              </div>

              {p.precoMedioPrevistoSc ? (
                <div className="mt-3 pt-3 border-t border-border-1 text-small text-fg-3">
                  Preço médio previsto:{' '}
                  <span className="t-num text-fg-1">
                    R$ {p.precoMedioPrevistoSc.toFixed(2)}/sc
                  </span>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>
    </AppShell>
  )
}
