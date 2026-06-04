/**
 * Home do portal — KPIs no topo + linha do tempo cronológica.
 * Carrega eventos reais (contratos, boletos, mensagens) e ordena por data.
 */
import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { kpisProdutor } from '@/lib/bi/produtor'
import { db } from '@/lib/db'
import { HomeTimeline, type TimelineEvent } from './_components/HomeTimeline'

export const dynamic = 'force-dynamic'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function PortalDashboard({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)

  const kpis = await kpisProdutor(sess.clienteId).catch(() => null)

  const [contratos, boletos, mensagens] = await Promise.all([
    db.contrato.findMany({
      where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
      orderBy: { criadoEm: 'desc' },
      take: 30,
      select: {
        id: true,
        numero: true,
        statusAssinatura: true,
        criadoEm: true,
        assinadoEm: true,
      },
    }),
    db.boleto.findMany({
      where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
      orderBy: { criadoEm: 'desc' },
      take: 30,
      select: {
        id: true,
        numero: true,
        valor: true,
        vencimento: true,
        status: true,
        confirmadoEm: true,
        criadoEm: true,
        contrato: { select: { numero: true } },
      },
    }),
    db.mensagemProdutor.findMany({
      where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const events: TimelineEvent[] = []

  for (const c of contratos) {
    events.push({
      id: `c-${c.id}-create`,
      tipo: 'contrato',
      when: c.criadoEm.toISOString(),
      kind:
        c.statusAssinatura === 'enviada'
          ? 'warn'
          : c.statusAssinatura === 'assinado'
          ? 'ok'
          : 'info',
      title:
        c.statusAssinatura === 'enviada'
          ? `Contrato ${c.numero} aguarda sua assinatura`
          : `Contrato ${c.numero} criado`,
      actions:
        c.statusAssinatura === 'enviada'
          ? [
              {
                label: 'Revisar e assinar',
                href: `/portal/${params.workspaceSlug}/contratos`,
                primary: true,
              },
            ]
          : [
              {
                label: 'Ver contrato',
                href: `/portal/${params.workspaceSlug}/documentos`,
              },
            ],
    })
    if (c.assinadoEm) {
      events.push({
        id: `c-${c.id}-sign`,
        tipo: 'contrato',
        when: c.assinadoEm.toISOString(),
        kind: 'ok',
        title: `Contrato ${c.numero} assinado`,
        actions: [
          {
            label: 'Baixar evidências',
            href: `/api/portal/contratos-assinados/${c.id}/evidencias`,
          },
        ],
      })
    }
  }

  for (const b of boletos) {
    const venc = new Date(b.vencimento)
    const hoje = new Date()
    const vencido = venc < hoje && b.status !== 'pago'
    events.push({
      id: `b-${b.id}`,
      tipo: 'boleto',
      when: b.criadoEm.toISOString(),
      kind: vencido ? 'danger' : b.status === 'pago' ? 'ok' : 'warn',
      title:
        b.status === 'pago'
          ? `Boleto ${b.numero} pago · ${fmtBRL(Number(b.valor))}`
          : vencido
          ? `Boleto ${b.numero} vencido · ${fmtBRL(Number(b.valor))}`
          : `Boleto ${b.numero} · ${fmtBRL(Number(b.valor))} · vence em ${venc.toLocaleDateString('pt-BR')}`,
    })
  }

  for (const m of mensagens) {
    events.push({
      id: `m-${m.id}`,
      tipo: 'mensagem',
      when: m.createdAt.toISOString(),
      kind: 'info',
      title:
        (m.remetente === 'corretora' ? 'Mensagem da corretora: ' : 'Você enviou: ') +
        m.texto.slice(0, 120),
    })
  }

  events.sort((a, b) => (a.when < b.when ? 1 : -1))

  const kpiCards = kpis
    ? [
        { lbl: 'Contratos ativos', val: String(kpis.contratosAtivos) },
        { lbl: 'Sacas safra atual', val: kpis.qtdSafraAtual.toLocaleString('pt-BR') },
        { lbl: 'Valor recebido', val: fmtBRL(kpis.valorRecebido) },
        { lbl: 'A receber', val: fmtBRL(kpis.valorAReceber) },
      ]
    : []

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
        Olá, {kpis?.nome ?? ''}
      </h1>
      {kpiCards.length > 0 && (
        <div className="portal-kpi-grid">
          {kpiCards.map((k) => (
            <div className="portal-kpi-card" key={k.lbl}>
              <div className="lbl">{k.lbl}</div>
              <div className="val">{k.val}</div>
            </div>
          ))}
        </div>
      )}
      <HomeTimeline events={events} />
    </div>
  )
}
