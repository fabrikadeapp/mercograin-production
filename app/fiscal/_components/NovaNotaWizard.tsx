'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card as PhbCard, Button } from '@/components/ui/phb'
import { Trash2, Plus, ArrowRight, ArrowLeft, Check } from 'lucide-react'

interface ContratoLite { id: string; numero: string; clienteId: string; cliente: { nome: string } | null }
interface ClienteLite { id: string; nome: string; cnpj: string | null; tipo: string }

interface Props {
  regime: string
  emitenteUF: string
  contratos: ContratoLite[]
  clientes: ClienteLite[]
  contratoIdInicial?: string
  cfopPadraoEntrada: string
  cfopPadraoSaidaInter: string
  cfopPadraoSaidaIntra: string
}

interface ItemForm {
  descricao: string
  ncm: string
  cfop: string
  qtd: number
  unidade: string
  valorUnitario: number
  destinoUF: string
  destinatarioTipo: 'PF' | 'PJ'
  operacao: 'compra_produtor' | 'venda_industria' | 'venda_exportacao' | 'devolucao' | 'transferencia'
  diferimentoICMS: boolean
}

function novoItem(emitenteUF: string, cfop: string, destinoUF: string, destTipo: 'PF' | 'PJ', op: ItemForm['operacao']): ItemForm {
  return {
    descricao: 'Soja em grão',
    ncm: '12019000',
    cfop,
    qtd: 0,
    unidade: 'SC',
    valorUnitario: 0,
    destinoUF,
    destinatarioTipo: destTipo,
    operacao: op,
    diferimentoICMS: false,
  }
}

export function NovaNotaWizard(props: Props) {
  const router = useRouter()
  const [step, setStep] = React.useState(1)
  const [submitting, setSubmitting] = React.useState(false)
  const [calculating, setCalculating] = React.useState(false)

  // Passo 1
  const [tipo, setTipo] = React.useState<'entrada' | 'saida' | 'devolucao' | 'complementar' | 'triangular'>('saida')
  const [contratoId, setContratoId] = React.useState<string>(props.contratoIdInicial ?? '')
  const [naturezaOperacao, setNaturezaOperacao] = React.useState('Venda de mercadoria')

  // Passo 2 - destinatário
  const [destSelecionado, setDestSelecionado] = React.useState<string>('')
  const [destDoc, setDestDoc] = React.useState('')
  const [destNome, setDestNome] = React.useState('')
  const [destUF, setDestUF] = React.useState('SC')
  const [destIE, setDestIE] = React.useState('')

  React.useEffect(() => {
    if (!destSelecionado) return
    const c = props.clientes.find((x) => x.id === destSelecionado)
    if (!c) return
    setDestNome(c.nome)
    setDestDoc((c.cnpj ?? '').replace(/\D/g, ''))
  }, [destSelecionado])

  // Passo 3 - itens
  const destTipoInferido: 'PF' | 'PJ' = destDoc.replace(/\D/g, '').length === 11 ? 'PF' : 'PJ'
  const isInterestadual = destUF !== props.emitenteUF
  const cfopPadrao = tipo === 'entrada'
    ? props.cfopPadraoEntrada
    : isInterestadual ? props.cfopPadraoSaidaInter : props.cfopPadraoSaidaIntra
  const operacaoPadrao: ItemForm['operacao'] = tipo === 'entrada' ? 'compra_produtor' : 'venda_industria'

  const [itens, setItens] = React.useState<ItemForm[]>([
    novoItem(props.emitenteUF, cfopPadrao, destUF, destTipoInferido, operacaoPadrao),
  ])
  const [tributos, setTributos] = React.useState<any>(null)

  function atualizarItem(i: number, patch: Partial<ItemForm>) {
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  function removerItem(i: number) {
    setItens((arr) => arr.filter((_, idx) => idx !== i))
  }
  function adicionarItem() {
    setItens((arr) => [...arr, novoItem(props.emitenteUF, cfopPadrao, destUF, destTipoInferido, operacaoPadrao)])
  }

  async function recalcular() {
    if (itens.length === 0 || itens.some((i) => i.qtd <= 0 || i.valorUnitario <= 0)) {
      setTributos(null)
      return
    }
    setCalculating(true)
    try {
      const payload = {
        regime: props.regime,
        itens: itens.map((it) => ({
          descricao: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          qtd: it.qtd,
          unidade: it.unidade,
          valorUnitario: it.valorUnitario,
          valorTotal: it.qtd * it.valorUnitario,
          origemUF: props.emitenteUF,
          destinoUF: it.destinoUF,
          destinatarioTipo: it.destinatarioTipo,
          operacao: it.operacao,
          diferimentoICMS: it.diferimentoICMS,
        })),
      }
      const r = await fetch('/api/fiscal/notas/calcular-tributos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (r.ok) setTributos(data.totais)
    } finally {
      setCalculating(false)
    }
  }

  React.useEffect(() => {
    if (step === 3) {
      const t = setTimeout(recalcular, 400)
      return () => clearTimeout(t)
    }
  }, [step, JSON.stringify(itens)])

  async function emitir() {
    if (!tributos) {
      alert('Calcule os tributos primeiro')
      return
    }
    setSubmitting(true)
    try {
      // 1. criar nota (rascunho)
      const body = {
        tipo,
        modelo: '55',
        contratoId: contratoId || null,
        destinatarioDoc: destDoc.replace(/\D/g, ''),
        destinatarioNome: destNome,
        destinatarioUF: destUF,
        destinatarioIE: destIE || null,
        naturezaOperacao,
        finalidadeEmissao: '1',
        cfopPrincipal: itens[0].cfop,
        diferimentoICMS: itens.some((i) => i.diferimentoICMS),
        valorICMS: tributos.valorICMS,
        valorPIS: tributos.valorPIS,
        valorCOFINS: tributos.valorCOFINS,
        valorFUNRURAL: tributos.valorFUNRURAL,
        valorFrete: 0,
        valorOutros: 0,
        itens: itens.map((it) => ({
          descricao: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          qtd: it.qtd,
          unidade: it.unidade,
          valorUnitario: it.valorUnitario,
          valorTotal: it.qtd * it.valorUnitario,
          origemUF: props.emitenteUF,
          destinoUF: it.destinoUF,
          diferimentoICMS: it.diferimentoICMS,
        })),
      }
      const r = await fetch('/api/fiscal/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(`Erro: ${err.error ?? r.status}`)
        return
      }
      const { data: nota } = await r.json()

      // 2. emitir
      const e = await fetch(`/api/fiscal/notas/${nota.id}/emitir`, { method: 'POST' })
      const eData = await e.json()
      if (!e.ok) {
        alert(`Nota criada (rascunho) mas falhou ao emitir: ${eData.error ?? 'erro'}`)
        router.push(`/fiscal/notas/${nota.id}`)
        return
      }
      router.push(`/fiscal/notas/${nota.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Stepper step={step} />

      {step === 1 && (
        <Section title="1. Tipo de operação">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tipo *">
              <select className="phb-input" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="saida">Saída (venda)</option>
                <option value="entrada">Entrada (compra/produtor)</option>
                <option value="devolucao">Devolução</option>
                <option value="complementar">Complementar</option>
                <option value="triangular">Triangular</option>
              </select>
            </Field>
            <Field label="Natureza da operação *">
              <input className="phb-input" value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)} />
            </Field>
            <Field label="Contrato vinculado (opcional)">
              <select className="phb-input" value={contratoId} onChange={(e) => setContratoId(e.target.value)}>
                <option value="">— sem contrato —</option>
                {props.contratos.map((c) => (
                  <option key={c.id} value={c.id}>{c.numero} · {c.cliente?.nome ?? ''}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section title="2. Destinatário">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cliente cadastrado (opcional)">
              <select className="phb-input" value={destSelecionado} onChange={(e) => setDestSelecionado(e.target.value)}>
                <option value="">— ou preencha manualmente —</option>
                {props.clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="CPF / CNPJ *">
              <input className="phb-input" value={destDoc} onChange={(e) => setDestDoc(e.target.value)} placeholder="apenas dígitos" />
            </Field>
            <Field label="Nome / Razão social *">
              <input className="phb-input" value={destNome} onChange={(e) => setDestNome(e.target.value)} />
            </Field>
            <Field label="UF *">
              <input className="phb-input" maxLength={2} value={destUF} onChange={(e) => setDestUF(e.target.value.toUpperCase())} />
            </Field>
            <Field label="Inscrição estadual (se PJ)">
              <input className="phb-input" value={destIE} onChange={(e) => setDestIE(e.target.value)} />
            </Field>
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title={`3. Itens (${itens.length})`}>
          <div className="space-y-3">
            {itens.map((it, i) => (
              <div key={i} className="border border-border-1 rounded-md p-3 grid grid-cols-1 md:grid-cols-12 gap-2">
                <Field label="Descrição" className="md:col-span-4">
                  <input className="phb-input" value={it.descricao} onChange={(e) => atualizarItem(i, { descricao: e.target.value })} />
                </Field>
                <Field label="NCM" className="md:col-span-2">
                  <input className="phb-input" value={it.ncm} onChange={(e) => atualizarItem(i, { ncm: e.target.value })} />
                </Field>
                <Field label="CFOP" className="md:col-span-1">
                  <input className="phb-input" value={it.cfop} onChange={(e) => atualizarItem(i, { cfop: e.target.value })} />
                </Field>
                <Field label="Qtd" className="md:col-span-1">
                  <input type="number" step="any" className="phb-input" value={it.qtd} onChange={(e) => atualizarItem(i, { qtd: Number(e.target.value) })} />
                </Field>
                <Field label="Un" className="md:col-span-1">
                  <input className="phb-input" value={it.unidade} onChange={(e) => atualizarItem(i, { unidade: e.target.value })} />
                </Field>
                <Field label="Vlr unitário" className="md:col-span-2">
                  <input type="number" step="any" className="phb-input" value={it.valorUnitario} onChange={(e) => atualizarItem(i, { valorUnitario: Number(e.target.value) })} />
                </Field>
                <div className="md:col-span-1 flex items-end justify-end">
                  <button type="button" onClick={() => removerItem(i)} className="text-neg p-2"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="md:col-span-12 flex items-center gap-4 text-micro">
                  <label className="flex items-center gap-1 text-fg-2">
                    <input type="checkbox" checked={it.diferimentoICMS} onChange={(e) => atualizarItem(i, { diferimentoICMS: e.target.checked })} />
                    Diferimento ICMS
                  </label>
                  <select className="phb-input !py-0.5 !text-micro" value={it.operacao} onChange={(e) => atualizarItem(i, { operacao: e.target.value as any })}>
                    <option value="compra_produtor">Compra de produtor</option>
                    <option value="venda_industria">Venda indústria</option>
                    <option value="venda_exportacao">Venda exportação</option>
                    <option value="devolucao">Devolução</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                  <span className="t-num text-fg-3 ml-auto">
                    Total: R$ {(it.qtd * it.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            <button type="button" onClick={adicionarItem} className="inline-flex items-center gap-2 text-accent text-small">
              <Plus className="h-4 w-4" /> Adicionar item
            </button>
          </div>

          {/* Live preview de tributos */}
          <div className="mt-4 p-4 border border-border-1 rounded-md bg-bg-2/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-fg-1 font-medium">Tributos calculados</h4>
              {calculating && <span className="text-micro text-fg-3">calculando…</span>}
            </div>
            {!tributos ? (
              <p className="text-fg-3 text-small">Preencha os itens para ver o cálculo.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-small">
                <Stat label="Produtos" value={tributos.valorProdutos} />
                <Stat label="ICMS" value={tributos.valorICMS} />
                <Stat label="PIS" value={tributos.valorPIS} />
                <Stat label="COFINS" value={tributos.valorCOFINS} />
                <Stat label="FUNRURAL" value={tributos.valorFUNRURAL} negative />
                <Stat label="Total" value={tributos.valorTotal} highlight />
                {tributos.observacoes?.length > 0 && (
                  <div className="col-span-full text-micro text-fg-3 leading-relaxed mt-2">
                    {tributos.observacoes.map((o: string, i: number) => <div key={i}>· {o}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {step === 4 && (
        <Section title="4. Revisão e emissão">
          <dl className="grid grid-cols-2 gap-3 text-small">
            <Dl label="Tipo" value={tipo} />
            <Dl label="Natureza" value={naturezaOperacao} />
            <Dl label="Destinatário" value={`${destNome} (${destDoc})`} />
            <Dl label="UF destino" value={destUF} />
            <Dl label="Itens" value={String(itens.length)} />
            {tributos && <Dl label="Total" value={`R$ ${tributos.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />}
          </dl>
          <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-md text-small text-fg-2">
            Provider em modo <strong>mock</strong> emitirá uma chave de acesso simulada. Para emissão real configure NFE.io em <a href="/fiscal/configuracao" className="text-accent">/fiscal/configuracao</a>.
          </div>
        </Section>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button type="button" onClick={emitir} disabled={submitting || !tributos}>
            <Check className="h-4 w-4 mr-1" /> {submitting ? 'Emitindo…' : 'Emitir NF-e'}
          </Button>
        )}
      </div>

      <style jsx global>{`
        .phb-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--bg-2);
          border: 1px solid var(--border-1);
          border-radius: 6px;
          color: var(--fg-1);
          font-size: 0.875rem;
        }
        .phb-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PhbCard className="p-5">
      <h3 className="text-h3 font-sans tracking-tight text-fg-1 mb-4">{title}</h3>
      {children}
    </PhbCard>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-micro uppercase tracking-wider text-fg-3">{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, highlight, negative }: { label: string; value: number; highlight?: boolean; negative?: boolean }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`t-num ${highlight ? 'text-fg-1 text-h3' : negative ? 'text-neg' : 'text-fg-2'}`}>
        R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  )
}

function Dl({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-fg-3 text-micro uppercase">{label}</dt>
      <dd className="text-fg-1">{value}</dd>
    </>
  )
}

function Stepper({ step }: { step: number }) {
  const titles = ['Tipo', 'Destinatário', 'Itens', 'Revisão']
  return (
    <div className="flex items-center gap-2 mb-4">
      {titles.map((t, i) => {
        const n = i + 1
        const active = step === n
        const done = step > n
        return (
          <React.Fragment key={t}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-pill text-micro uppercase tracking-wider ${
              active ? 'bg-accent text-accent-ink' : done ? 'bg-pos/20 text-pos' : 'bg-bg-2 text-fg-3'
            }`}>
              <span className="font-bold">{n}</span>
              <span>{t}</span>
            </div>
            {i < titles.length - 1 && <div className="flex-1 h-px bg-border-1" />}
          </React.Fragment>
        )
      })}
    </div>
  )
}
