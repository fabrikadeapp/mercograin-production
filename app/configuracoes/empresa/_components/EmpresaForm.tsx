'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2, Building2, Banknote } from 'lucide-react'

interface EmpresaState {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  endereco: string
  cidade: string
  uf: string
  cep: string
  telefone: string
  email: string
  dadosBancarios: Record<string, unknown> | null
}

interface BankAccount {
  banco: string
  agencia: string
  conta: string
  tipo: 'corrente' | 'poupanca'
  pix?: string
}

const inputCls =
  'w-full px-3 py-2 rounded-md text-sm bg-white/5 border border-white/10 focus:border-accent focus:outline-none transition'

const UFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

function parseBankAccounts(data: Record<string, unknown> | null | undefined): BankAccount[] {
  if (!data) return []
  // dadosBancarios: pode ser objeto único (legado) ou array
  if (Array.isArray(data)) return data as unknown as BankAccount[]
  if (typeof data === 'object' && 'banco' in data) {
    return [data as unknown as BankAccount]
  }
  if (typeof data === 'object' && 'contas' in data && Array.isArray((data as { contas: unknown[] }).contas)) {
    return (data as { contas: BankAccount[] }).contas
  }
  return []
}

export function EmpresaForm({ initial }: { initial: EmpresaState | null }) {
  const router = useRouter()
  const [state, setState] = useState<EmpresaState>(
    initial ?? {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      inscricaoEstadual: '',
      endereco: '',
      cidade: '',
      uf: '',
      cep: '',
      telefone: '',
      email: '',
      dadosBancarios: null,
    }
  )
  const [contas, setContas] = useState<BankAccount[]>(parseBankAccounts(initial?.dadosBancarios))
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [cepLoading, setCepLoading] = useState(false)

  const upd = <K extends keyof EmpresaState>(key: K, value: EmpresaState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const lookupCEP = async () => {
    const digits = state.cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const j = (await r.json()) as {
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
        erro?: boolean
      }
      if (j.erro) {
        setFeedback({ kind: 'err', msg: 'CEP não encontrado.' })
        return
      }
      setState((s) => ({
        ...s,
        endereco: j.logradouro
          ? `${j.logradouro}${j.bairro ? ' - ' + j.bairro : ''}`
          : s.endereco,
        cidade: j.localidade ?? s.cidade,
        uf: j.uf ?? s.uf,
      }))
    } catch {
      setFeedback({ kind: 'err', msg: 'Falha ao consultar CEP.' })
    } finally {
      setCepLoading(false)
    }
  }

  const handleSave = () => {
    setFeedback(null)
    startTransition(async () => {
      try {
        const payload = {
          razaoSocial: state.razaoSocial.trim(),
          nomeFantasia: state.nomeFantasia.trim() || null,
          cnpj: state.cnpj.trim() || null,
          inscricaoEstadual: state.inscricaoEstadual.trim() || null,
          endereco: state.endereco.trim() || null,
          cidade: state.cidade.trim() || null,
          uf: state.uf.trim() || null,
          cep: state.cep.trim() || null,
          telefone: state.telefone.trim() || null,
          email: state.email.trim() || null,
          dadosBancarios: contas.length > 0 ? { contas } : null,
        }
        if (!payload.razaoSocial) {
          throw new Error('Razão Social é obrigatória.')
        }
        const res = await fetch('/api/workspace/empresa', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`)
        setFeedback({ kind: 'ok', msg: 'Dados salvos com sucesso.' })
        router.refresh()
      } catch (e) {
        setFeedback({
          kind: 'err',
          msg: e instanceof Error ? e.message : 'Erro ao salvar',
        })
      }
    })
  }

  const addConta = () =>
    setContas((c) => [
      ...c,
      { banco: '', agencia: '', conta: '', tipo: 'corrente' as const, pix: '' },
    ])
  const updConta = <K extends keyof BankAccount>(i: number, key: K, v: BankAccount[K]) =>
    setContas((c) => {
      const next = [...c]
      next[i] = { ...next[i], [key]: v }
      return next
    })
  const delConta = (i: number) => setContas((c) => c.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-6">
      {/* Seção 1: Identificação */}
      <section className="space-y-3">
        <h3
          className="flex items-center gap-2 font-semibold"
          style={{ fontSize: 13, color: 'var(--text)' }}
        >
          <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          Identificação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Razão social *
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.razaoSocial}
              onChange={(e) => upd('razaoSocial', e.target.value)}
              placeholder="Ex.: BH Grain Trading Ltda"
              maxLength={200}
            />
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Nome fantasia
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.nomeFantasia}
              onChange={(e) => upd('nomeFantasia', e.target.value)}
              placeholder="BH Grain"
              maxLength={200}
            />
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              CNPJ
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.cnpj}
              onChange={(e) => upd('cnpj', maskCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Inscrição estadual
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.inscricaoEstadual}
              onChange={(e) => upd('inscricaoEstadual', e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="000000000"
              inputMode="numeric"
            />
          </div>
        </div>
      </section>

      {/* Seção 2: Endereço */}
      <section
        className="space-y-3 pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <h3
          className="font-semibold"
          style={{ fontSize: 13, color: 'var(--text)' }}
        >
          Endereço
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              CEP
            </label>
            <div className="flex gap-2">
              <input
                data-phb-input
                className={inputCls}
                value={state.cep}
                onChange={(e) => upd('cep', maskCEP(e.target.value))}
                onBlur={lookupCEP}
                placeholder="00000-000"
                inputMode="numeric"
              />
              {cepLoading && <Loader2 className="w-4 h-4 animate-spin self-center" />}
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              Preenchimento automático via ViaCEP
            </p>
          </div>
          <div className="md:col-span-4">
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Endereço
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.endereco}
              onChange={(e) => upd('endereco', e.target.value)}
              placeholder="Rua, número, bairro"
              maxLength={300}
            />
          </div>
          <div className="md:col-span-4">
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Cidade
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.cidade}
              onChange={(e) => upd('cidade', e.target.value)}
              placeholder="Curitiba"
              maxLength={100}
            />
          </div>
          <div className="md:col-span-2">
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              UF
            </label>
            <select
              data-phb-input
              className={inputCls}
              value={state.uf}
              onChange={(e) => upd('uf', e.target.value)}
            >
              <option value="">—</option>
              {UFs.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Seção 3: Contato */}
      <section
        className="space-y-3 pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <h3 className="font-semibold" style={{ fontSize: 13, color: 'var(--text)' }}>
          Contato
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Telefone
            </label>
            <input
              data-phb-input
              className={inputCls}
              value={state.telefone}
              onChange={(e) => upd('telefone', maskPhone(e.target.value))}
              placeholder="(41) 99999-9999"
              inputMode="tel"
            />
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              E-mail oficial
            </label>
            <input
              data-phb-input
              className={inputCls}
              type="email"
              value={state.email}
              onChange={(e) => upd('email', e.target.value)}
              placeholder="contato@empresa.com"
              maxLength={200}
            />
          </div>
        </div>
      </section>

      {/* Seção 4: Contas bancárias */}
      <section
        className="space-y-3 pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h3
            className="flex items-center gap-2 font-semibold"
            style={{ fontSize: 13, color: 'var(--text)' }}
          >
            <Banknote className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            Contas bancárias
          </h3>
          <button
            type="button"
            onClick={addConta}
            className="btn ghost"
            style={{ fontSize: 11, padding: '5px 10px' }}
          >
            + Adicionar conta
          </button>
        </div>
        {contas.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-mute)' }}>
            Nenhuma conta cadastrada. Boletos e dados de pagamento usam estas contas.
          </p>
        ) : (
          <ul className="space-y-3">
            {contas.map((conta, i) => (
              <li
                key={i}
                className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <div className="col-span-2">
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Banco</label>
                  <input
                    data-phb-input
                    className={inputCls}
                    value={conta.banco}
                    onChange={(e) => updConta(i, 'banco', e.target.value)}
                    placeholder="Itaú"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Agência</label>
                  <input
                    data-phb-input
                    className={inputCls}
                    value={conta.agencia}
                    onChange={(e) => updConta(i, 'agencia', e.target.value)}
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Conta</label>
                  <input
                    data-phb-input
                    className={inputCls}
                    value={conta.conta}
                    onChange={(e) => updConta(i, 'conta', e.target.value)}
                    placeholder="56789-0"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Tipo</label>
                  <select
                    data-phb-input
                    className={inputCls}
                    value={conta.tipo}
                    onChange={(e) =>
                      updConta(i, 'tipo', e.target.value as 'corrente' | 'poupanca')
                    }
                  >
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => delConta(i)}
                    className="btn ghost"
                    style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      color: 'var(--danger)',
                      width: '100%',
                    }}
                  >
                    Remover
                  </button>
                </div>
                <div className="col-span-2 md:col-span-6">
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    Chave PIX (opcional)
                  </label>
                  <input
                    data-phb-input
                    className={inputCls}
                    value={conta.pix ?? ''}
                    onChange={(e) => updConta(i, 'pix', e.target.value)}
                    placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Feedback + Save */}
      {feedback && (
        <div
          className="flex items-start gap-2 p-3 text-sm"
          style={{
            borderRadius: 'var(--r-md)',
            background:
              feedback.kind === 'ok' ? 'var(--success-soft)' : 'var(--danger-soft)',
            border: `1px solid ${feedback.kind === 'ok' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
            color: feedback.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      <div className="flex justify-end pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !state.razaoSocial.trim()}
          className="btn primary"
          style={{ fontSize: 13 }}
        >
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {pending ? 'Salvando…' : 'Salvar dados da empresa'}
        </button>
      </div>
    </div>
  )
}
