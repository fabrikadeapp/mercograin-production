'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, Send } from 'lucide-react'

interface Solicitacao {
  id: string
  tipo: string
  grao: string
  quantidade: string
  unidade: string
  precoAlvo: string | null
  prazoEntregaDias: number | null
  localEntrega: string | null
  observacao: string | null
  status: string
  createdAt: string
  proposta: { id: string; numero: string; valorTotal: string; status: string } | null
}

const GRAOS = ['soja', 'milho', 'trigo', 'sorgo']

export function SolicitarCotacaoView() {
  const [items, setItems] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState<'venda' | 'compra'>('venda')
  const [grao, setGrao] = useState('soja')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState<'t' | 'sc'>('t')
  const [precoAlvo, setPrecoAlvo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [local, setLocal] = useState('')
  const [obs, setObs] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function load() {
    const r = await fetch('/api/portal/solicitacoes')
    if (r.ok) {
      const j = await r.json()
      setItems(j.items ?? [])
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErro(null)
    setEnviado(false)
    try {
      const body: Record<string, unknown> = {
        tipo,
        grao,
        unidade,
        quantidade: Number(quantidade),
      }
      if (precoAlvo) body.precoAlvo = Number(precoAlvo)
      if (prazo) body.prazoEntregaDias = Number(prazo)
      if (local) body.localEntrega = local
      if (obs) body.observacao = obs
      const r = await fetch('/api/portal/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error ?? 'erro')
        return
      }
      setQuantidade('')
      setPrecoAlvo('')
      setPrazo('')
      setLocal('')
      setObs('')
      setEnviado(true)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>
        Solicitar cotação
      </h1>
      <p className="portal-empty" style={{ padding: 0, textAlign: 'left', marginBottom: 16 }}>
        Envie um pedido para sua corretora. Eles recebem por email e respondem com a proposta formal.
      </p>

      <form className="portal-card" onSubmit={submit} style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            <div style={lbl}>Tipo</div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'venda' | 'compra')} style={input}>
              <option value="venda">Quero VENDER</option>
              <option value="compra">Quero COMPRAR</option>
            </select>
          </label>
          <label>
            <div style={lbl}>Grão</div>
            <select value={grao} onChange={(e) => setGrao(e.target.value)} style={input}>
              {GRAOS.map((g) => (
                <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            <div style={lbl}>Quantidade *</div>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              style={input}
            />
          </label>
          <label>
            <div style={lbl}>Unidade</div>
            <select value={unidade} onChange={(e) => setUnidade(e.target.value as 't' | 'sc')} style={input}>
              <option value="t">toneladas</option>
              <option value="sc">sacas (60 kg)</option>
            </select>
          </label>
          <label>
            <div style={lbl}>Preço alvo (R$ por {unidade})</div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precoAlvo}
              onChange={(e) => setPrecoAlvo(e.target.value)}
              style={input}
              placeholder="Opcional"
            />
          </label>
          <label>
            <div style={lbl}>Prazo de entrega (dias)</div>
            <input
              type="number"
              min="1"
              max="365"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              style={input}
              placeholder="Opcional"
            />
          </label>
          <label style={{ gridColumn: '1 / span 2' }}>
            <div style={lbl}>Local de entrega/retirada</div>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              style={input}
              placeholder="Ex.: Porto de Paranaguá, Fazenda Rei do Gado..."
            />
          </label>
          <label style={{ gridColumn: '1 / span 2' }}>
            <div style={lbl}>Observação</div>
            <textarea
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              style={{ ...input, fontFamily: 'inherit' }}
              placeholder="Algum detalhe extra?"
            />
          </label>
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            disabled={busy || !quantidade}
            className="portal-btn primary"
            style={{ padding: '10px 16px' }}
          >
            {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
            {busy ? ' Enviando…' : ' Enviar solicitação'}
          </button>
          {enviado && (
            <span style={{ color: 'var(--portal-accent)', fontSize: 13, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <CheckCircle2 size={14} /> Solicitação enviada à corretora
            </span>
          )}
          {erro && <span style={{ color: 'var(--portal-danger)', fontSize: 13 }}>{erro}</span>}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </form>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Suas solicitações</h2>
      {loading ? (
        <div className="portal-empty">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="portal-empty">Nenhuma solicitação ainda. Use o formulário acima.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((s) => (
            <div className="portal-card" key={s.id} style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {s.tipo === 'venda' ? 'Venda' : 'Compra'} de {Number(s.quantidade)} {s.unidade} de {s.grao}
                </div>
                <div style={{ fontSize: 12, color: 'var(--portal-ink-mute)' }}>
                  Solicitado em {new Date(s.createdAt).toLocaleString('pt-BR')}
                </div>
                {s.proposta && (
                  <div style={{ fontSize: 12, color: 'var(--portal-accent)', marginTop: 4 }}>
                    Proposta {s.proposta.numero} · R$ {Number(s.proposta.valorTotal).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
              <span style={badgeStyle(s.status)}>{labelStatus(s.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function labelStatus(s: string) {
  return (
    {
      pendente: 'Aguardando corretora',
      em_analise: 'Em análise',
      convertida: 'Proposta enviada',
      recusada: 'Recusada',
      cancelada: 'Cancelada',
    } as Record<string, string>
  )[s] ?? s
}
function badgeStyle(s: string): React.CSSProperties {
  const m: Record<string, { bg: string; fg: string }> = {
    pendente: { bg: '#fef3c7', fg: '#92400e' },
    em_analise: { bg: '#e8f0fe', fg: '#1a73e8' },
    convertida: { bg: '#d1fae5', fg: '#065f46' },
    recusada: { bg: '#fdecea', fg: '#c0392b' },
    cancelada: { bg: '#f4f4f5', fg: '#52525b' },
  }
  const v = m[s] ?? { bg: '#f4f4f5', fg: '#52525b' }
  return {
    background: v.bg,
    color: v.fg,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  }
}

const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--portal-ink-mute)', marginBottom: 4 }
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--portal-border)',
  background: 'var(--portal-surface)',
  color: 'var(--portal-ink)',
  fontSize: 13,
}
