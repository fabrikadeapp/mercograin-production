'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Inbox,
  ListChecks,
  Send,
  FileText,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface ItemBase {
  id: string
  cliente: string
}
interface SolicitacaoItem extends ItemBase {
  grao: string
  quantidade: number
  unidade: string
  tipo: string
  precoAlvo: number | null
  observacao: string | null
  createdAt: string
}
interface PropostaItem extends ItemBase {
  numero: string
  valor: number
  tipo?: string
  criadaEm?: string
  enviadaEm?: string
  origem?: string | null
}
interface ContratoItem extends ItemBase {
  numero: string
  propostaNumero: string | null
  valor: number | null
  criadoEm: string
}

interface FluxoData {
  ok: true
  cards: {
    naoProcessadas: { total: number; items: SolicitacaoItem[] }
    emRevisao: { total: number; items: PropostaItem[] }
    noCliente: { total: number; items: PropostaItem[] }
    contratosAguardando: { total: number; items: ContratoItem[] }
  }
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function FluxoCards() {
  const [data, setData] = useState<FluxoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const r = await fetch('/api/dashboard/fluxo')
        if (cancel) return
        if (r.ok) setData(await r.json())
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => {
      cancel = true
      clearInterval(id)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-fg-2">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando fluxo…
      </div>
    )
  }
  if (!data) return null

  const { naoProcessadas, emRevisao, noCliente, contratosAguardando } = data.cards

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <FluxoCard
        title="Solicitações não processadas"
        subtitle="Precisam de atenção humana"
        total={naoProcessadas.total}
        accentBorder="border-warn"
        icon={<Inbox size={16} />}
        href="/solicitacoes?status=pendente"
      >
        {naoProcessadas.items.slice(0, 5).map((s) => (
          <Row
            key={s.id}
            cliente={s.cliente}
            sub={`${s.tipo === 'venda' ? 'Vender' : 'Comprar'} ${s.quantidade} ${s.unidade} de ${s.grao}`}
            extra={
              s.precoAlvo
                ? `Preço alvo: R$ ${s.precoAlvo.toFixed(2)}/${s.unidade}`
                : 'Sem preço alvo'
            }
            href={`/solicitacoes/${s.id}`}
          />
        ))}
        {naoProcessadas.items.length === 0 && <Empty>Nada aqui — automação está funcionando.</Empty>}
      </FluxoCard>

      <FluxoCard
        title="Propostas em revisão"
        subtitle="Geradas automaticamente, aguardando você"
        total={emRevisao.total}
        accentBorder="border-info"
        icon={<ListChecks size={16} />}
        href="/propostas?status=rascunho"
      >
        {emRevisao.items.slice(0, 5).map((p) => (
          <Row
            key={p.id}
            cliente={p.cliente}
            sub={`#${p.numero} · ${fmtBRL(p.valor)}`}
            extra={p.origem === 'portal_solicitacao_auto' ? 'Cruzado com CEPEA' : ''}
            href={`/propostas/${p.id}`}
          />
        ))}
        {emRevisao.items.length === 0 && <Empty>Nenhuma proposta para revisar.</Empty>}
      </FluxoCard>

      <FluxoCard
        title="Propostas no cliente"
        subtitle="Enviadas, aguardando aceite"
        total={noCliente.total}
        accentBorder="border-accent"
        icon={<Send size={16} />}
        href="/propostas?status=enviada"
      >
        {noCliente.items.slice(0, 5).map((p) => (
          <Row
            key={p.id}
            cliente={p.cliente}
            sub={`#${p.numero} · ${fmtBRL(p.valor)}`}
            extra={p.enviadaEm ? `Enviada em ${new Date(p.enviadaEm).toLocaleDateString('pt-BR')}` : ''}
            href={`/propostas/${p.id}`}
          />
        ))}
        {noCliente.items.length === 0 && <Empty>Nenhuma proposta no cliente.</Empty>}
      </FluxoCard>

      <FluxoCard
        title="Contratos aguardando envio"
        subtitle="Aceitos, prontos para enviar"
        total={contratosAguardando.total}
        accentBorder="border-pos"
        icon={<FileText size={16} />}
        href="/contratos?status=pendente"
      >
        {contratosAguardando.items.slice(0, 5).map((c) => (
          <Row
            key={c.id}
            cliente={c.cliente}
            sub={`#${c.numero}${c.valor ? ` · ${fmtBRL(c.valor)}` : ''}`}
            extra={`Criado em ${new Date(c.criadoEm).toLocaleDateString('pt-BR')}`}
            href={`/contratos/${c.id}`}
          />
        ))}
        {contratosAguardando.items.length === 0 && <Empty>Nenhum contrato pendente.</Empty>}
      </FluxoCard>
    </div>
  )
}

function FluxoCard({
  title,
  subtitle,
  total,
  accentBorder,
  icon,
  href,
  children,
}: {
  title: string
  subtitle: string
  total: number
  accentBorder: string
  icon: React.ReactNode
  href: string
  children: React.ReactNode
}) {
  return (
    <div className={`card flex flex-col gap-3 border-t-2 ${accentBorder}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-small font-medium text-fg-1">
            {icon} {title}
          </div>
          <div className="text-mini text-fg-2 mt-0.5">{subtitle}</div>
        </div>
        <div className="text-h2 font-semibold text-fg-1">{total}</div>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
      <Link
        href={href}
        className="mt-auto inline-flex items-center gap-1 text-mini text-fg-2 hover:text-fg-1"
      >
        Ver todos <ArrowRight size={12} />
      </Link>
    </div>
  )
}

function Row({
  cliente,
  sub,
  extra,
  href,
}: {
  cliente: string
  sub: string
  extra?: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border-1 px-2 py-1.5 transition-colors hover:bg-bg-2"
    >
      <div className="text-small font-medium text-fg-1 truncate">{cliente}</div>
      <div className="text-mini text-fg-2 truncate">{sub}</div>
      {extra && <div className="text-mini text-fg-3 truncate">{extra}</div>}
    </Link>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border-1 px-3 py-4 text-center text-mini text-fg-3">
      {children}
    </div>
  )
}
