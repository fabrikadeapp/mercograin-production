/**
 * QW10 — Página de Aging de Boletos.
 *
 * Server component: consulta direto via Prisma (mesma lógica do endpoint).
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

type FaixaKey = 'a_vencer' | '1-30d' | '31-60d' | '61-90d' | '90d+'

const FAIXA_LABEL: Record<FaixaKey, string> = {
  a_vencer: 'A vencer',
  '1-30d': '1 a 30 dias',
  '31-60d': '31 a 60 dias',
  '61-90d': '61 a 90 dias',
  '90d+': 'Acima de 90 dias',
}

const FAIXA_COR: Record<FaixaKey, string> = {
  a_vencer: 'var(--success)',
  '1-30d': 'var(--info)',
  '31-60d': 'var(--warning)',
  '61-90d': 'color-mix(in srgb, var(--warning) 60%, var(--danger))',
  '90d+': 'var(--danger)',
}

function classify(diasAtraso: number): FaixaKey {
  if (diasAtraso <= 0) return 'a_vencer'
  if (diasAtraso <= 30) return '1-30d'
  if (diasAtraso <= 60) return '31-60d'
  if (diasAtraso <= 90) return '61-90d'
  return '90d+'
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AgingBoletosPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const boletos = await db.boleto.findMany({
    where: scope.whereOwn({ status: 'aberto' }),
    include: { cliente: { select: { nome: true } } },
    orderBy: { vencimento: 'asc' },
  })

  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const faixas: Record<
    FaixaKey,
    { qtd: number; valor: number; itens: typeof boletos }
  > = {
    a_vencer: { qtd: 0, valor: 0, itens: [] },
    '1-30d': { qtd: 0, valor: 0, itens: [] },
    '31-60d': { qtd: 0, valor: 0, itens: [] },
    '61-90d': { qtd: 0, valor: 0, itens: [] },
    '90d+': { qtd: 0, valor: 0, itens: [] },
  }
  let totalQtd = 0
  let totalValor = 0
  for (const b of boletos) {
    const dias = Math.floor(
      (startOfToday.getTime() - new Date(b.vencimento).getTime()) / 86_400_000
    )
    const k = classify(dias)
    faixas[k].qtd++
    faixas[k].valor += Number(b.valor)
    faixas[k].itens.push(b)
    totalQtd++
    totalValor += Number(b.valor)
  }

  const order: FaixaKey[] = ['a_vencer', '1-30d', '31-60d', '61-90d', '90d+']

  return (
    <AppShell>
      <PageHeader
        title="Aging de boletos"
        subtitle={`${totalQtd} boletos em aberto · ${brl(totalValor)} total`}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {order.map((k) => (
          <Card key={k}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {FAIXA_LABEL[k]}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: FAIXA_COR[k],
                marginTop: 4,
              }}
            >
              {brl(faixas[k].valor)}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {faixas[k].qtd} boleto{faixas[k].qtd === 1 ? '' : 's'}
            </div>
            <div
              style={{
                marginTop: 8,
                height: 4,
                background: 'var(--bg-2)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${
                    totalValor > 0 ? (faixas[k].valor / totalValor) * 100 : 0
                  }%`,
                  background: FAIXA_COR[k],
                  height: '100%',
                }}
              />
            </div>
          </Card>
        ))}
      </div>

      {order.map((k) =>
        faixas[k].itens.length === 0 ? null : (
          <Card key={`tbl-${k}`} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: FAIXA_COR[k] }}>
              {FAIXA_LABEL[k]} ({faixas[k].qtd})
            </h3>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th>Boleto</th>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th style={{ textAlign: 'right' }}>Dias atraso</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {faixas[k].itens.map((b) => {
                  const dias = Math.floor(
                    (startOfToday.getTime() -
                      new Date(b.vencimento).getTime()) /
                      86_400_000
                  )
                  return (
                    <tr key={b.id}>
                      <td>{b.numero}</td>
                      <td>{b.cliente?.nome ?? '—'}</td>
                      <td>{new Date(b.vencimento).toLocaleDateString('pt-BR')}</td>
                      <td style={{ textAlign: 'right' }}>
                        {dias <= 0 ? '—' : dias}
                      </td>
                      <td style={{ textAlign: 'right' }}>{brl(Number(b.valor))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      )}

      {totalQtd === 0 ? (
        <Card>
          <p style={{ color: 'var(--text-muted)' }}>
            Nenhum boleto em aberto.
          </p>
        </Card>
      ) : null}
    </AppShell>
  )
}
