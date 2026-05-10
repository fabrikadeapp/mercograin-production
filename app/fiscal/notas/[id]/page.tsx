import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { NotaActions } from '../../_components/NotaActions'

export const dynamic = 'force-dynamic'

function fmtBRL(n: any): string {
  const v = Number(n)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'text-fg-3' },
  enviada: { label: 'Enviada à SEFAZ', color: 'text-fg-2' },
  autorizada: { label: 'Autorizada', color: 'text-pos' },
  rejeitada: { label: 'Rejeitada', color: 'text-neg' },
  cancelada: { label: 'Cancelada', color: 'text-neg' },
  inutilizada: { label: 'Inutilizada', color: 'text-fg-3' },
  denegada: { label: 'Denegada', color: 'text-neg' },
}

export default async function NotaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')
  const { id } = await params

  const nota = await db.notaFiscal.findFirst({
    where: { id, ...scope.whereOwn() },
    include: { contrato: { select: { id: true, numero: true } }, cartasCorrecao: { orderBy: { sequencia: 'asc' } } },
  })
  if (!nota) notFound()

  const itens = Array.isArray(nota.itens) ? (nota.itens as any[]) : []
  const status = STATUS_LABEL[nota.status] ?? { label: nota.status, color: 'text-fg-2' }

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Fiscal · NF-e ${nota.numero}/${nota.serie}`}
        title={`Nota fiscal nº ${nota.numero}`}
        subtitle={nota.chave ? `Chave: ${nota.chave}` : 'Aguardando autorização SEFAZ'}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="eyebrow">Status</div>
          <div className={`text-h3 font-semibold ${status.color}`}>{status.label}</div>
          {nota.motivoRejeicao && <div className="text-micro text-neg mt-1">{nota.motivoRejeicao}</div>}
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Valor total</div>
          <div className="text-h3 t-num">{fmtBRL(nota.valorTotal)}</div>
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Emissão</div>
          <div className="text-h3 t-num">{new Date(nota.dataEmissao).toLocaleDateString('pt-BR')}</div>
          {nota.dataAutorizacao && (
            <div className="text-micro text-fg-3">Autorizada {new Date(nota.dataAutorizacao).toLocaleString('pt-BR')}</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="eyebrow">Protocolo SEFAZ</div>
          <div className="text-small font-mono break-all">{nota.protocolo ?? '—'}</div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="text-h3 mb-3">Itens</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="text-micro uppercase text-fg-3">
              <tr>
                <th className="text-left py-2">Descrição</th>
                <th className="text-left py-2">NCM</th>
                <th className="text-left py-2">CFOP</th>
                <th className="text-right py-2">Qtd</th>
                <th className="text-left py-2">Un</th>
                <th className="text-right py-2">Vlr unit.</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, i) => (
                <tr key={i} className="border-t border-border-1">
                  <td className="py-2">{it.descricao}</td>
                  <td className="py-2 font-mono">{it.ncm}</td>
                  <td className="py-2 font-mono">{it.cfop}</td>
                  <td className="py-2 text-right t-num">{Number(it.qtd).toLocaleString('pt-BR')}</td>
                  <td className="py-2">{it.unidade}</td>
                  <td className="py-2 text-right t-num">{fmtBRL(it.valorUnitario)}</td>
                  <td className="py-2 text-right t-num">{fmtBRL(it.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="text-h3 mb-3">Tributos</h3>
          <dl className="grid grid-cols-2 gap-2 text-small">
            <dt className="text-fg-3">Produtos</dt><dd className="t-num text-right">{fmtBRL(nota.valorProdutos)}</dd>
            <dt className="text-fg-3">ICMS</dt><dd className="t-num text-right">{fmtBRL(nota.valorICMS)}</dd>
            <dt className="text-fg-3">PIS</dt><dd className="t-num text-right">{fmtBRL(nota.valorPIS)}</dd>
            <dt className="text-fg-3">COFINS</dt><dd className="t-num text-right">{fmtBRL(nota.valorCOFINS)}</dd>
            <dt className="text-fg-3">FUNRURAL (retido)</dt><dd className="t-num text-right text-neg">- {fmtBRL(nota.valorFUNRURAL)}</dd>
            <dt className="text-fg-3">Frete</dt><dd className="t-num text-right">{fmtBRL(nota.valorFrete)}</dd>
            <dt className="text-fg-3">Outros</dt><dd className="t-num text-right">{fmtBRL(nota.valorOutros)}</dd>
            <dt className="text-fg-1 font-semibold border-t border-border-1 pt-2">Total NF-e</dt>
            <dd className="t-num text-right text-fg-1 font-semibold border-t border-border-1 pt-2">{fmtBRL(nota.valorTotal)}</dd>
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="text-h3 mb-3">Destinatário</h3>
          <div className="text-small space-y-1">
            <div className="text-fg-1 font-medium">{nota.destinatarioNome}</div>
            <div className="text-fg-3">{nota.destinatarioDoc} · {nota.destinatarioUF}</div>
            {nota.destinatarioIE && <div className="text-fg-3">IE: {nota.destinatarioIE}</div>}
          </div>
          {nota.contrato && (
            <div className="mt-4 pt-4 border-t border-border-1">
              <div className="eyebrow">Contrato vinculado</div>
              <Link href={`/contratos/${nota.contrato.id}`} className="text-accent text-small">
                {nota.contrato.numero} →
              </Link>
            </div>
          )}
        </Card>
      </div>

      <NotaActions
        notaId={nota.id}
        chave={nota.chave}
        status={nota.status}
        xmlUrl={nota.xmlUrl}
        danfeUrl={nota.danfeUrl}
      />

      {nota.cartasCorrecao.length > 0 && (
        <Card className="p-5 mt-6">
          <h3 className="text-h3 mb-3">Cartas de correção</h3>
          <ul className="space-y-2 text-small">
            {nota.cartasCorrecao.map((c) => (
              <li key={c.id} className="border-t border-border-1 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">CC-e #{c.sequencia}</span>
                  <span className={c.status === 'aceita' ? 'text-pos' : 'text-neg'}>{c.status}</span>
                </div>
                <p className="text-fg-2 mt-1">{c.texto}</p>
                {c.protocolo && <div className="text-micro text-fg-3 font-mono">Protocolo: {c.protocolo}</div>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  )
}
