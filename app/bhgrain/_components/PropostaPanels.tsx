'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge, fmtBRL, useJson } from './_shared'
import { updatePropostaLogistica, updatePropostaEstoque, updatePropostaQualidade } from '../_actions'

interface ArmazemRef {
  id: string
  nome: string
  cidade: string | null
  uf: string | null
}

interface LoteRef {
  id: string
  numero: string
  cultura: string
  qtdAtualSc: number
  armazem: { nome: string }
}

const MODAIS = [
  { v: 'rodoviario', l: 'Rodoviário' },
  { v: 'ferroviario', l: 'Ferroviário' },
  { v: 'hidroviario', l: 'Hidroviário' },
  { v: 'multimodal', l: 'Multimodal' },
]

const FRETE_TIPOS = [
  { v: 'incluso', l: 'Frete incluso' },
  { v: 'comprador', l: 'Por conta do comprador' },
  { v: 'vendedor', l: 'Por conta do vendedor' },
  { v: 'definir', l: 'A definir' },
]

function Panel({ title, edit, onEdit, children }: { title: string; edit: boolean; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] uppercase tracking-wider text-vg-fg-3">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] text-vg-accent hover:underline"
        >
          {edit ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      {children}
    </section>
  )
}

function inputCls(): string {
  return 'w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-[12px]'
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-vg-fg-3">{label}</div>
      <div className="text-[12px] font-medium">{value ?? '—'}</div>
    </div>
  )
}

interface LogisticaProps {
  propostaId: string
  commodity: string
  logistica: {
    origem: string | null
    destino: string | null
    localEntrega: string | null
    modalTransporte: string | null
    freteTipo: string | null
    freteCustoTotal: number | null
    freteCustoUnit: number | null
    prazoLogistico: string | null
    incoterm: string | null
    armazemOrigem: { id: string; nome: string } | null
    armazemDestino: { id: string; nome: string } | null
    pendenteInformacao: boolean
  }
}

export function LogisticaPanel({ propostaId, logistica }: LogisticaProps) {
  const [edit, setEdit] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { data } = useJson<{ armazens: ArmazemRef[] }>(edit ? '/api/bhgrain/refs' : null, [edit])

  if (!edit) {
    return (
      <Panel title="Logística" edit={false} onEdit={() => setEdit(true)}>
        {logistica.pendenteInformacao && (
          <div className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
            <AlertTriangle className="w-3 h-3" /> Pendente de informação logística
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <KV label="Origem" value={logistica.origem} />
          <KV label="Destino" value={logistica.destino} />
          <KV label="Local de entrega" value={logistica.localEntrega} />
          <KV label="Modal" value={modalLabel(logistica.modalTransporte)} />
          <KV label="Frete" value={freteLabel(logistica.freteTipo)} />
          <KV
            label="Custo frete"
            value={logistica.freteCustoTotal != null ? `R$ ${fmtBRL(logistica.freteCustoTotal, 2)}` : '—'}
          />
          <KV
            label="Custo/unidade"
            value={logistica.freteCustoUnit != null ? `R$ ${fmtBRL(logistica.freteCustoUnit, 4)}/sc` : '—'}
          />
          <KV
            label="Prazo logístico"
            value={logistica.prazoLogistico ? new Date(logistica.prazoLogistico).toLocaleDateString('pt-BR') : '—'}
          />
          <KV label="Incoterm" value={logistica.incoterm} />
          <KV label="Armazém origem" value={logistica.armazemOrigem?.nome ?? null} />
          <KV label="Armazém destino" value={logistica.armazemDestino?.nome ?? null} />
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="Logística" edit onEdit={() => setEdit(false)}>
      <form
        action={async (fd) => {
          setFormError(null)
          try {
            await updatePropostaLogistica(fd)
            setEdit(false)
          } catch (e) {
            setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
          }
        }}
        className="grid grid-cols-2 gap-2"
      >
        <input type="hidden" name="propostaId" value={propostaId} />
        <input name="origem" defaultValue={logistica.origem ?? ''} placeholder="Origem" className={inputCls()} />
        <input name="destino" defaultValue={logistica.destino ?? ''} placeholder="Destino" className={inputCls()} />
        <input name="localEntrega" defaultValue={logistica.localEntrega ?? ''} placeholder="Local de entrega" className={`${inputCls()} col-span-2`} />
        <select name="modalTransporte" defaultValue={logistica.modalTransporte ?? ''} className={inputCls()}>
          <option value="">Modal —</option>
          {MODAIS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <select name="freteTipo" defaultValue={logistica.freteTipo ?? ''} className={inputCls()}>
          <option value="">Frete —</option>
          {FRETE_TIPOS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
        <input
          name="freteCustoTotal"
          type="number"
          step="0.01"
          defaultValue={logistica.freteCustoTotal ?? ''}
          placeholder="Custo frete total"
          className={inputCls()}
        />
        <input
          name="freteCustoUnit"
          type="number"
          step="0.0001"
          defaultValue={logistica.freteCustoUnit ?? ''}
          placeholder="Custo/sc"
          className={inputCls()}
        />
        <input
          name="prazoLogistico"
          type="date"
          defaultValue={logistica.prazoLogistico?.slice(0, 10) ?? ''}
          className={inputCls()}
        />
        <input name="incoterm" defaultValue={logistica.incoterm ?? ''} placeholder="Incoterm" className={inputCls()} />
        <select name="armazemOrigemRefId" defaultValue={logistica.armazemOrigem?.id ?? ''} className={inputCls()}>
          <option value="">Armazém origem —</option>
          {data?.armazens.map((a) => <option key={a.id} value={a.id}>{a.nome} {a.cidade ? `(${a.cidade}/${a.uf})` : ''}</option>)}
        </select>
        <select name="armazemDestinoRefId" defaultValue={logistica.armazemDestino?.id ?? ''} className={inputCls()}>
          <option value="">Armazém destino —</option>
          {data?.armazens.map((a) => <option key={a.id} value={a.id}>{a.nome} {a.cidade ? `(${a.cidade}/${a.uf})` : ''}</option>)}
        </select>
        {formError && (
          <div className="col-span-2 text-[11px] flex items-start gap-1.5 px-2 py-1.5 rounded"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--vg-destructive, #ef4444)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}
        <button type="submit" className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-semibold rounded py-2">
          Salvar logística
        </button>
      </form>
    </Panel>
  )
}

interface EstoqueProps {
  propostaId: string
  commodity: string
  estoque: {
    lote: { id: string; numero: string; cultura: string; qtdAtualSc: number; armazem: { nome: string } } | null
    excedeDisponivel: boolean
    quantidadeProposta: number | null
  }
}

export function EstoquePanel({ propostaId, commodity, estoque }: EstoqueProps) {
  const [edit, setEdit] = useState(false)
  const cultura = commodity.toLowerCase().includes('soja')
    ? 'soja'
    : commodity.toLowerCase().includes('milho')
      ? 'milho'
      : commodity.toLowerCase().includes('trigo')
        ? 'trigo'
        : null
  const { data } = useJson<{ lotes: LoteRef[] }>(
    edit ? `/api/bhgrain/refs${cultura ? `?cultura=${cultura}` : ''}` : null,
    [edit]
  )

  if (!edit) {
    return (
      <Panel title="Estoque e disponibilidade" edit={false} onEdit={() => setEdit(true)}>
        {estoque.lote ? (
          <div className="space-y-1.5">
            <div className="text-[13px] font-medium">Lote {estoque.lote.numero}</div>
            <div className="text-[11px] text-vg-fg-3">
              {estoque.lote.cultura} · Armazém: {estoque.lote.armazem.nome}
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span>Disponível: <strong>{fmtBRL(estoque.lote.qtdAtualSc)} sc</strong></span>
              {estoque.quantidadeProposta != null && (
                <span>· Proposta: <strong>{fmtBRL(estoque.quantidadeProposta)} sc</strong></span>
              )}
            </div>
            {estoque.excedeDisponivel ? (
              <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--vg-destructive, #ef4444)' }}>
                <AlertTriangle className="w-3 h-3" /> Volume solicitado excede disponibilidade atual
              </div>
            ) : (
              <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--vg-success, #10b981)' }}>
                <CheckCircle2 className="w-3 h-3" /> Volume compatível com estoque
              </div>
            )}
          </div>
        ) : (
          <div className="text-[12px] text-vg-fg-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" style={{ color: '#f59e0b' }} />
            Nenhum lote vinculado à proposta
          </div>
        )}
      </Panel>
    )
  }

  return (
    <Panel title="Estoque e disponibilidade" edit onEdit={() => setEdit(false)}>
      <form action={async (fd) => { await updatePropostaEstoque(fd); setEdit(false) }} className="space-y-2">
        <input type="hidden" name="propostaId" value={propostaId} />
        <select name="loteEstoqueRefId" defaultValue={estoque.lote?.id ?? ''} className={inputCls()}>
          <option value="">Nenhum lote vinculado</option>
          {data?.lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.numero} · {l.cultura} · {fmtBRL(l.qtdAtualSc)} sc · {l.armazem.nome}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-vg-fg-3">Apenas lotes ativos do workspace são listados.</p>
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-semibold rounded py-2">
          Vincular lote
        </button>
      </form>
    </Panel>
  )
}

interface QualidadeProps {
  propostaId: string
  qualidade: {
    umidadeMax: number | null
    impurezaMax: number | null
    ph: number | null
    proteinaMin: number | null
    ardidosMax: number | null
    avariadosMax: number | null
    padraoComercial: string | null
    observacoes: string | null
    preenchida: boolean
  }
}

export function QualidadePanel({ propostaId, qualidade }: QualidadeProps) {
  const [edit, setEdit] = useState(false)

  if (!edit) {
    return (
      <Panel title="Qualidade e especificações" edit={false} onEdit={() => setEdit(true)}>
        {qualidade.preenchida ? (
          <>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <KV label="Umidade máx" value={qualidade.umidadeMax != null ? `${qualidade.umidadeMax}%` : null} />
              <KV label="Impureza máx" value={qualidade.impurezaMax != null ? `${qualidade.impurezaMax}%` : null} />
              <KV label="PH" value={qualidade.ph} />
              <KV label="Proteína mín" value={qualidade.proteinaMin != null ? `${qualidade.proteinaMin}%` : null} />
              <KV label="Ardidos máx" value={qualidade.ardidosMax != null ? `${qualidade.ardidosMax}%` : null} />
              <KV label="Avariados máx" value={qualidade.avariadosMax != null ? `${qualidade.avariadosMax}%` : null} />
            </div>
            {qualidade.padraoComercial && (
              <div className="mt-2"><Badge tone="info" label={qualidade.padraoComercial} /></div>
            )}
            {qualidade.observacoes && <div className="mt-2 text-[11px] text-vg-fg-2">{qualidade.observacoes}</div>}
          </>
        ) : (
          <div className="text-[12px] text-vg-fg-3">Sem especificações de qualidade definidas.</div>
        )}
      </Panel>
    )
  }

  return (
    <Panel title="Qualidade e especificações" edit onEdit={() => setEdit(false)}>
      <form action={async (fd) => { await updatePropostaQualidade(fd); setEdit(false) }} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="propostaId" value={propostaId} />
        <input name="umidadeMax" type="number" step="0.1" defaultValue={qualidade.umidadeMax ?? ''} placeholder="Umidade máx %" className={inputCls()} />
        <input name="impurezaMax" type="number" step="0.1" defaultValue={qualidade.impurezaMax ?? ''} placeholder="Impureza máx %" className={inputCls()} />
        <input name="ph" type="number" step="0.1" defaultValue={qualidade.ph ?? ''} placeholder="PH" className={inputCls()} />
        <input name="proteinaMin" type="number" step="0.1" defaultValue={qualidade.proteinaMin ?? ''} placeholder="Proteína mín %" className={inputCls()} />
        <input name="ardidosMax" type="number" step="0.1" defaultValue={qualidade.ardidosMax ?? ''} placeholder="Ardidos máx %" className={inputCls()} />
        <input name="avariadosMax" type="number" step="0.1" defaultValue={qualidade.avariadosMax ?? ''} placeholder="Avariados máx %" className={inputCls()} />
        <input
          name="padraoComercial"
          defaultValue={qualidade.padraoComercial ?? ''}
          placeholder="Padrão comercial (ex.: Soja exportação)"
          className={`${inputCls()} col-span-2`}
        />
        <textarea
          name="observacoes"
          defaultValue={qualidade.observacoes ?? ''}
          placeholder="Observações"
          rows={2}
          className={`${inputCls()} col-span-2`}
        />
        <button type="submit" className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-semibold rounded py-2">
          Salvar qualidade
        </button>
      </form>
    </Panel>
  )
}

function modalLabel(v: string | null): string | null {
  if (!v) return null
  return MODAIS.find((m) => m.v === v)?.l ?? v
}

function freteLabel(v: string | null): string | null {
  if (!v) return null
  return FRETE_TIPOS.find((f) => f.v === v)?.l ?? v
}
