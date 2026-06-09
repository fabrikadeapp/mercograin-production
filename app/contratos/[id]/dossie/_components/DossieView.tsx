'use client'

import { useEffect, useState } from 'react'
import { PageHeader, Card, Skeleton, EmptyState, Chip } from '@/components/ui/phb'
import { FileText, FileCheck, Truck, Receipt, ShieldCheck, History, Download, FolderOpen } from 'lucide-react'

interface Dossie {
  contrato: { numero: string; cliente?: string; documento?: string | null; tipo?: string; proposta?: string; valor: number; graos: any; statusAssinatura: string; assinatura?: { status: string; signatarios: any } | null; corretagem?: { valor: number; status: string } | null }
  timeline: { data: string; tipo: string; titulo: string; detalhe?: string }[]
  documentos: { tipo: string; titulo: string; url?: string | null; data?: string | null }[]
}

const ICON: Record<string, any> = { contrato: FileText, assinatura: FileCheck, fiscal: Receipt, logistica: Truck, comissao: Receipt, auditoria: History }
function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export function DossieView({ contratoId }: { contratoId: string }) {
  const [d, setD] = useState<Dossie | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch(`/api/dossie/${contratoId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }, [contratoId])

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
  if (erro || !d) return <EmptyState icon={FolderOpen} title="Negócio não encontrado" description="Verifique o contrato." />

  const graos = Array.isArray(d.contrato.graos) ? d.contrato.graos : []

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={`Dossiê · ${d.contrato.cliente ?? ''}`} title={`Negócio ${d.contrato.numero}`} subtitle={`Histórico consolidado: termos, documentos e linha do tempo.`} />

      {/* Termos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Termos do negócio</div>
          <div className="grid grid-cols-2 gap-y-3 text-[13px]">
            <Termo k="Cliente" v={d.contrato.cliente} />
            <Termo k="Documento" v={d.contrato.documento ?? '—'} />
            <Termo k="Proposta" v={d.contrato.proposta} />
            <Termo k="Operação" v={d.contrato.tipo} />
            <Termo k="Valor" v={brl(d.contrato.valor)} accent />
            <Termo k="Assinatura" v={<Chip variant={d.contrato.statusAssinatura === 'assinado' ? 'pos' : 'warn'}>{d.contrato.statusAssinatura}</Chip>} />
          </div>
          {graos.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Mercadoria</div>
              {graos.map((g: any, i: number) => (
                <div key={i} className="flex justify-between py-1 text-[12.5px]"><span className="capitalize text-[var(--text)]">{g.grao}</span><span className="font-mono text-[var(--text-mute)]">{Number(g.quantidade ?? 0).toLocaleString('pt-BR')} t · {brl(Number(g.preco ?? 0))}</span></div>
              ))}
            </div>
          )}
        </Card>

        {/* Compliance/corretagem */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]"><ShieldCheck size={13} /> Status</div>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between"><span className="text-[var(--text-mute)]">Assinatura digital</span><Chip variant={d.contrato.assinatura?.status === 'assinado' ? 'pos' : 'warn'}>{d.contrato.assinatura?.status ?? 'pendente'}</Chip></div>
            {d.contrato.corretagem && <div className="flex justify-between"><span className="text-[var(--text-mute)]">Corretagem</span><span className="font-mono font-semibold text-[var(--accent)]">{brl(d.contrato.corretagem.valor)}</span></div>}
            {d.contrato.corretagem && <div className="flex justify-between"><span className="text-[var(--text-mute)]">Status corretagem</span><Chip variant="neutral">{d.contrato.corretagem.status}</Chip></div>}
          </div>
        </Card>
      </div>

      {/* Timeline + Documentos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-[18px] py-[14px] text-[14px] font-semibold text-[var(--text)]">Linha do tempo</div>
          <div className="p-4">
            {d.timeline.length === 0 ? <p className="text-[12.5px] text-[var(--text-dim)]">Sem eventos.</p> : (
              <div className="space-y-3">
                {d.timeline.map((e, i) => {
                  const Icon = ICON[e.tipo] ?? History
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-mute)]"><Icon size={13} /></div>
                      <div className="min-w-0 flex-1 border-b border-[var(--border)] pb-3">
                        <div className="text-[12.5px] font-medium text-[var(--text)]">{e.titulo}</div>
                        <div className="font-mono text-[10.5px] text-[var(--text-dim)]">{new Date(e.data).toLocaleString('pt-BR')}{e.detalhe ? ` · ${e.detalhe}` : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-[18px] py-[14px] text-[14px] font-semibold text-[var(--text)]">Documentos</div>
          <div className="p-2">
            {d.documentos.length === 0 ? <p className="p-3 text-[12.5px] text-[var(--text-dim)]">Sem documentos anexados.</p> : d.documentos.map((doc, i) => (
              <a key={i} href={doc.url ?? '#'} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[var(--r-sm)] p-3 hover:bg-[var(--row-hover)]">
                <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[var(--surface-2)] text-[var(--text-mute)]"><FileText size={15} /></div>
                <div className="min-w-0 flex-1"><div className="text-[12.5px] font-medium text-[var(--text)]">{doc.titulo}</div><div className="font-mono text-[10.5px] text-[var(--text-dim)] capitalize">{doc.tipo}{doc.data ? ` · ${new Date(doc.data).toLocaleDateString('pt-BR')}` : ''}</div></div>
                {doc.url && <Download size={15} className="text-[var(--text-mute)]" />}
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Termo({ k, v, accent }: { k: string; v: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{k}</div>
      <div className={`mt-0.5 ${accent ? 'font-mono font-bold text-[var(--accent)]' : 'text-[var(--text)]'}`}>{v}</div>
    </div>
  )
}
