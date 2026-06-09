'use client'

/**
 * Comissionamento de colaborador — marca vendedor/comissionado e edita a regra
 * de comissão (% / fixo / piso+% / faixas) por colaborador, + relatório do mês.
 */
import { useEffect, useState, useCallback } from 'react'
import { Card, DenseTable, Skeleton, EmptyState } from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Percent, Settings2 } from 'lucide-react'

interface Member { id: string; email: string; cargo: string | null; user?: { nome?: string } | null }
interface RelLinha { memberId: string; nome: string; valorVendido: number; qtdContratos: number; tipoRegra: string; valorComissao: number; detalhe: string }

const TIPO_LABEL: Record<string, string> = {
  percentual: 'Percentual', fixo: 'Valor fixo', piso_percentual: 'Piso + %', faixas: 'Faixas', '—': '—',
}
function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }

export function ComissionamentoView({ canEdit }: { canEdit: boolean }) {
  const [members, setMembers] = useState<Member[]>([])
  const [rel, setRel] = useState<{ linhas: RelLinha[]; totais: { vendido: number; comissao: number; colaboradores: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Member | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/workspace/members').then((r) => (r.ok ? r.json() : { members: [] })),
      fetch('/api/comissao/colaborador/relatorio').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, r]) => {
        setMembers(m.members ?? m ?? [])
        setRel(r && r.ok ? r : null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const relColumns: DenseTableColumn<RelLinha>[] = [
    { key: 'nome', header: 'Colaborador', accessor: (r) => <span className="font-semibold text-[var(--text)]">{r.nome}</span> },
    { key: 'regra', header: 'Regra', accessor: (r) => <span className="text-[var(--text-mute)]">{TIPO_LABEL[r.tipoRegra] ?? r.tipoRegra}</span> },
    { key: 'vendido', header: 'Vendido', align: 'right', accessor: (r) => brl(r.valorVendido) },
    { key: 'qtd', header: 'Negócios', align: 'right', accessor: (r) => r.qtdContratos },
    { key: 'detalhe', header: 'Cálculo', accessor: (r) => <span className="font-mono text-[11px] text-[var(--text-dim)]">{r.detalhe}</span> },
    { key: 'comissao', header: 'Comissão', align: 'right', accessor: (r) => <span className="font-bold text-[var(--accent)]">{brl(r.valorComissao)}</span> },
  ]

  return (
    <div className="space-y-5">
      {/* Relatório do mês */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Vendido (mês)</div><div className="mt-2 font-mono text-[22px] font-bold text-[var(--text)]">{rel ? brl(rel.totais.vendido) : '—'}</div></Card>
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Comissão total</div><div className="mt-2 font-mono text-[22px] font-bold text-[var(--accent)]">{rel ? brl(rel.totais.comissao) : '—'}</div></Card>
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Comissionados</div><div className="mt-2 font-mono text-[22px] font-bold text-[var(--text)]">{rel?.totais.colaboradores ?? '—'}</div></Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-[18px] py-[14px] text-[14px] font-semibold text-[var(--text)]">Comissão do mês por colaborador</div>
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
        ) : (rel?.linhas.length ?? 0) === 0 ? (
          <EmptyState icon={Percent} title="Nenhum comissionado" description="Marque colaboradores como comissionados abaixo para começar." />
        ) : (
          <DenseTable columns={relColumns} rows={rel!.linhas} rowKey={(r) => r.memberId} />
        )}
      </Card>

      {/* Configuração por colaborador */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-[18px] py-[14px] text-[14px] font-semibold text-[var(--text)]">Colaboradores</div>
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
        ) : members.length === 0 ? (
          <EmptyState icon={Settings2} title="Sem colaboradores" description="Cadastre a equipe em Gestão → Funcionários." />
        ) : (
          <div>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0">
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[9px] bg-[var(--surface-2)] text-[12px] font-bold text-[var(--text-mute)]">
                  {(m.user?.nome || m.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{m.user?.nome || m.email}</div>
                  <div className="font-mono text-[11px] text-[var(--text-mute)]">{m.cargo || m.email}</div>
                </div>
                {canEdit && (
                  <button onClick={() => setEditing(m)} className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--border-strong)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-mute)] hover:text-[var(--text)]">
                    <Settings2 size={14} /> Configurar comissão
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && <RegraModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

/* ───────────── Modal de regra ───────────── */

interface Faixa { ate: number | null; pct?: number; valor?: number }

function RegraModal({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isVendedor, setIsVendedor] = useState(false)
  const [comissionado, setComissionado] = useState(false)
  const [tipo, setTipo] = useState<'percentual' | 'fixo' | 'piso_percentual' | 'faixas'>('percentual')
  const [pct, setPct] = useState(1.5)
  const [valorFixo, setValorFixo] = useState(0)
  const [baseFixo, setBaseFixo] = useState<'periodo' | 'negocio'>('periodo')
  const [faixas, setFaixas] = useState<Faixa[]>([{ ate: 100000, pct: 1 }, { ate: 200000, pct: 1.5 }, { ate: null, pct: 2 }])
  const toast = useToast()

  useEffect(() => {
    fetch(`/api/comissao/colaborador/${member.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const mm = d?.member
        if (mm) {
          setIsVendedor(!!mm.isVendedor)
          setComissionado(!!mm.comissionado)
          const r = mm.regraComissao
          if (r) {
            setTipo(r.tipo)
            setPct(r.pct ?? 1.5)
            setValorFixo(r.valorFixo ? Number(r.valorFixo) : 0)
            setBaseFixo(r.baseFixo ?? 'periodo')
            if (Array.isArray(r.faixas) && r.faixas.length) setFaixas(r.faixas)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [member.id])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/comissao/colaborador/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isVendedor, comissionado,
          regra: {
            tipo, pct: Number(pct) || 0, valorFixo: Number(valorFixo) || null, baseFixo,
            faixas: tipo === 'faixas' ? faixas : null, ativo: true,
          },
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Falha') }
      toast.success('Comissão salva')
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  function setFaixa(i: number, patch: Partial<Faixa>) {
    setFaixas((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-[var(--r-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-[17px] font-semibold text-[var(--text)]">Comissão · {member.user?.nome || member.email}</h2>
        <p className="mb-4 text-[12.5px] text-[var(--text-mute)]">Defina o papel e a regra de comissão deste colaborador.</p>

        {loading ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Toggle label="É vendedor" checked={isVendedor} onChange={setIsVendedor} />
              <Toggle label="Comissionado" checked={comissionado} onChange={setComissionado} />
            </div>

            <div>
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-[var(--text-mute)]">Tipo de regra</span>
              <div className="grid grid-cols-2 gap-2">
                {([['percentual', 'Percentual (%)'], ['fixo', 'Valor fixo'], ['piso_percentual', 'Piso + %'], ['faixas', 'Faixas progressivas']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setTipo(v)} className={`rounded-[var(--r-sm)] border px-3 py-2 text-[12.5px] font-medium ${tipo === v ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--text-mute)]'}`}>{l}</button>
                ))}
              </div>
            </div>

            {tipo === 'percentual' && (
              <Field label="Percentual (%)"><input type="number" step="0.01" value={pct} onChange={(e) => setPct(+e.target.value)} className="cinp" /></Field>
            )}
            {tipo === 'fixo' && (
              <>
                <Field label="Valor fixo (R$)"><input type="number" value={valorFixo} onChange={(e) => setValorFixo(+e.target.value)} className="cinp" /></Field>
                <Field label="Base">
                  <select value={baseFixo} onChange={(e) => setBaseFixo(e.target.value as any)} className="cinp">
                    <option value="periodo">Por período (mês)</option>
                    <option value="negocio">Por negócio fechado</option>
                  </select>
                </Field>
              </>
            )}
            {tipo === 'piso_percentual' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Piso garantido (R$)"><input type="number" value={valorFixo} onChange={(e) => setValorFixo(+e.target.value)} className="cinp" /></Field>
                <Field label="Percentual (%)"><input type="number" step="0.01" value={pct} onChange={(e) => setPct(+e.target.value)} className="cinp" /></Field>
              </div>
            )}
            {tipo === 'faixas' && (
              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-[var(--text-mute)]">Faixas por volume vendido</span>
                <div className="space-y-2">
                  {faixas.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--text-dim)]">até</span>
                      <input type="number" placeholder="∞" value={f.ate ?? ''} onChange={(e) => setFaixa(i, { ate: e.target.value === '' ? null : +e.target.value })} className="cinp flex-1" />
                      <span className="text-[11px] text-[var(--text-dim)]">→</span>
                      <input type="number" step="0.01" placeholder="%" value={f.pct ?? ''} onChange={(e) => setFaixa(i, { pct: +e.target.value, valor: undefined })} className="cinp w-20" />
                      <span className="text-[11px] text-[var(--text-dim)]">%</span>
                      <button onClick={() => setFaixas((fs) => fs.filter((_, idx) => idx !== i))} className="text-[var(--danger)]">✕</button>
                    </div>
                  ))}
                  <button onClick={() => setFaixas((fs) => [...fs, { ate: null, pct: 2 }])} className="text-[12px] text-[var(--accent-2)]">+ Adicionar faixa</button>
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-dim)]">Ex.: até R$100k → 1% · até R$150k → 1,5% · acima (vazio) → 2%.</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[var(--r-sm)] px-4 py-2 text-sm text-[var(--text-mute)] hover:text-[var(--text)]">Cancelar</button>
          <button onClick={save} disabled={saving || loading} className="rounded-[var(--r-sm)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
      <style jsx>{`
        :global(.cinp) { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 11px; font-size: 13px; color: var(--text); }
        :global(.cinp:focus) { outline: none; border-color: var(--accent-2); }
      `}</style>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--text)]">
      <span onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {label}
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-[var(--text-mute)]">{label}</span>
      {children}
    </label>
  )
}
