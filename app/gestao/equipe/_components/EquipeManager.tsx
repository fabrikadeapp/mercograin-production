'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { UserPlus, Pencil, Trash2, Mail, X, Check, BarChart3, ArrowRightLeft, Clock } from 'lucide-react'
import { AREAS, AREA_LABEL, type Area } from '@/lib/areas'
import { FUNCOES, FUNCAO_LABEL, FUNCAO_AREA_SUGERIDA, type Funcao } from '@/lib/equipe/funcoes'
import { maskCPF, maskTelefone } from '@/lib/equipe/rh'
import { isValidCPF } from '@/lib/br/documento'

interface Member {
  id: string
  email: string
  role: string
  status: string
  cargo: string | null
  funcoes: string[]
  areasPermitidas: string[]
  cpf: string | null
  telefoneWhats: string | null
  invitedAt: string | null
  acceptedAt: string | null
  createdAt: string
  user: { id: string; nome: string | null; email: string; perfilCompleto?: boolean } | null
}

interface Props {
  initialMembers: Member[]
}

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--success)',
  invited: 'var(--warning)',
  suspended: 'var(--danger)',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  invited: 'Convidado',
  suspended: 'Suspenso',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
}

export function EquipeManager({ initialMembers }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [editing, setEditing] = useState<Member | null>(null)
  const [creating, setCreating] = useState(false)
  const [transferindo, setTransferindo] = useState<Member | null>(null)

  const refresh = async () => {
    const res = await fetch('/api/workspace/members')
    if (res.ok) {
      const j = await res.json()
      setMembers(j.members ?? [])
    }
  }

  return (
    <div className="space-y-4">
      <header style={{ paddingTop: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          GESTÃO · EQUIPE
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Equipe da licença
            </h1>
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: 'var(--text-mute)',
                maxWidth: 600,
              }}
            >
              Cadastre colaboradores, defina as áreas que cada um pode acessar e
              quais funções desempenha. Cobrança por seat ativo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn primary"
          >
            <UserPlus className="w-3.5 h-3.5" /> Adicionar colaborador
          </button>
        </div>
      </header>

      <section className="sec-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            minWidth: 720,
          }}
        >
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <Th>Colaborador</Th>
              <Th>Cargo</Th>
              <Th>Funções</Th>
              <Th>Áreas</Th>
              <Th>Acesso</Th>
              <Th>Status</Th>
              <Th>Perfil</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                  }}
                >
                  Nenhum colaborador cadastrado ainda.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>
                  <div style={{ fontWeight: 500 }}>
                    {m.user?.nome ?? m.email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {m.email}
                  </div>
                </Td>
                <Td>
                  <span style={{ color: m.cargo ? 'var(--text)' : 'var(--text-dim)' }}>
                    {m.cargo ?? '—'}
                  </span>
                </Td>
                <Td>
                  {m.funcoes.length === 0 ? (
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {m.funcoes.map((f) => (
                        <Pill key={f}>{FUNCAO_LABEL[f as Funcao] ?? f}</Pill>
                      ))}
                    </div>
                  )}
                </Td>
                <Td>
                  {m.role === 'owner' || m.role === 'admin' ? (
                    <Pill tone="accent">Todas</Pill>
                  ) : m.areasPermitidas.length === 0 ? (
                    <span style={{ color: 'var(--text-dim)' }}>Nenhuma</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {m.areasPermitidas.map((a) => (
                        <Pill key={a}>{AREA_LABEL[a as Area] ?? a}</Pill>
                      ))}
                    </div>
                  )}
                </Td>
                <Td>{ROLE_LABEL[m.role] ?? m.role}</Td>
                <Td>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: STATUS_COLOR[m.status] ?? 'var(--text-dim)',
                      }}
                    />
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                </Td>
                <Td>
                  <PerfilBadge member={m} />
                </Td>
                <Td align="right">
                  <div className="flex items-center gap-1 justify-end">
                    <Link
                      href={`/gestao/equipe/${m.id}`}
                      className="btn icon"
                      aria-label="Ver performance"
                      title="Ver performance"
                    >
                      <BarChart3 className="w-3 h-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTransferindo(m)}
                      className="btn icon"
                      aria-label="Transferir carteira"
                      title="Transferir carteira"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                    </button>
                    {m.role !== 'owner' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(m)}
                          className="btn icon"
                          aria-label="Editar"
                          title="Editar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <RemoveButton memberId={m.id} onDone={refresh} />
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {creating && (
        <MemberForm
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}
      {editing && (
        <MemberForm
          mode="edit"
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      {transferindo && (
        <TransferirCarteiraModal
          origem={transferindo}
          candidatos={members.filter((m) => m.id !== transferindo.id)}
          onClose={() => setTransferindo(null)}
          onDone={() => {
            setTransferindo(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function TransferirCarteiraModal({
  origem,
  candidatos,
  onClose,
  onDone,
}: {
  origem: Member
  candidatos: Member[]
  onClose: () => void
  onDone: () => void
}) {
  const [destinatarioId, setDestinatarioId] = useState<string>('')
  const [motivo, setMotivo] = useState('transferencia')
  const [observacao, setObservacao] = useState('')
  const [carteira, setCarteira] = useState<{ id: string; nome: string }[] | null>(null)
  const [seleção, setSeleção] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Carrega clientes onde este membro é responsável atual
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/clientes?responsavelId=${origem.id}&limit=500`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (cancelled) return
        const lista = (j?.data ?? []) as Array<{
          id: string
          nome: string
          responsavelId: string | null
        }>
        const filtrada = lista
          .filter((c) => c.responsavelId === origem.id)
          .map((c) => ({ id: c.id, nome: c.nome }))
        setCarteira(filtrada)
        setSeleção(new Set(filtrada.map((c) => c.id)))
      })
      .catch(() => {
        if (!cancelled) setCarteira([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [origem.id])

  const toggleCliente = (id: string) => {
    setSeleção((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = () => {
    setErr(null)
    if (!destinatarioId) {
      setErr('Escolha quem vai receber a carteira.')
      return
    }
    if (seleção.size === 0) {
      setErr('Selecione pelo menos um cliente para transferir.')
      return
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/equipe/${origem.id}/transferir-carteira`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinatarioId,
            clienteIds: Array.from(seleção),
            motivo,
            observacao: observacao || undefined,
          }),
        },
      )
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j.error || 'Erro ao transferir.')
        return
      }
      onDone()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Transferir carteira
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>
              {origem.user?.nome ?? origem.email}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn icon" aria-label="Fechar">
            <X className="w-3.5 h-3.5" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <p style={{ fontSize: 12, color: 'var(--text-mute)', margin: 0 }}>
            Os clientes selecionados passarão a ter o destinatário como
            responsável atual. O histórico de vendas anteriores é preservado.
          </p>

          <Field label="Destinatário">
            <select
              value={destinatarioId}
              onChange={(e) => setDestinatarioId(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                color: 'var(--text)',
                outline: 'none',
                fontSize: 14,
              }}
            >
              <option value="">— Escolher membro —</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user?.nome ?? c.email}
                  {c.cargo ? ` — ${c.cargo}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Motivo">
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                color: 'var(--text)',
                outline: 'none',
                fontSize: 14,
              }}
            >
              <option value="transferencia">Transferência</option>
              <option value="ferias">Férias do responsável</option>
              <option value="desligamento">Desligamento</option>
              <option value="redistribuicao">Redistribuição interna</option>
              <option value="manual">Outro</option>
            </select>
          </Field>

          <Field label="Observação (opcional)">
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: cobertura até retorno em 02/06"
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                color: 'var(--text)',
                outline: 'none',
                fontSize: 14,
              }}
            />
          </Field>

          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                fontFamily: 'var(--f-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              Clientes a transferir
            </div>
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface-2)',
                padding: 6,
              }}
            >
              {loading && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>
                  Carregando carteira…
                </div>
              )}
              {!loading && carteira && carteira.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>
                  Nenhum cliente sob responsabilidade deste membro.
                </div>
              )}
              {!loading &&
                carteira?.map((c) => (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={seleção.has(c.id)}
                      onChange={() => toggleCliente(c.id)}
                    />
                    {c.nome}
                  </label>
                ))}
            </div>
            {carteira && carteira.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSeleção(new Set(carteira.map((c) => c.id)))}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0,
                  }}
                >
                  Selecionar todos
                </button>
                <span style={{ color: 'var(--border)' }}>·</span>
                <button
                  type="button"
                  onClick={() => setSeleção(new Set())}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0,
                  }}
                >
                  Limpar
                </button>
                <span style={{ marginLeft: 'auto' }}>
                  {seleção.size} de {carteira.length} selecionados
                </span>
              </div>
            )}
          </div>

          {err && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(255,80,80,0.12)',
                border: '1px solid var(--danger, #ff5050)',
                color: 'var(--danger, #ff5050)',
                borderRadius: 'var(--r-sm)',
                fontSize: 12,
              }}
            >
              {err}
            </div>
          )}
        </div>

        <footer
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <button type="button" onClick={onClose} className="btn ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || loading}
            className="btn primary"
          >
            {pending ? 'Transferindo…' : `Transferir ${seleção.size} cliente${seleção.size === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
        padding: '10px 14px',
        fontSize: 11,
        fontFamily: 'var(--f-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-dim)',
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td
      style={{
        textAlign: align ?? 'left',
        padding: '12px 14px',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'accent' | 'default'
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        borderRadius: 'var(--r-pill)',
        background: tone === 'accent' ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: tone === 'accent' ? 'var(--accent)' : 'var(--text)',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </span>
  )
}

function PerfilBadge({ member }: { member: Member }) {
  // Owner é sempre considerado completo (não faz wizard de colaborador).
  if (member.role === 'owner') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--text-dim)',
        }}
      >
        —
      </span>
    )
  }
  if (member.status === 'invited') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: 'var(--text-dim)',
        }}
      >
        <Clock className="w-3 h-3" /> Aguardando aceite
      </span>
    )
  }
  const completo = member.user?.perfilCompleto === true
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        fontSize: 11,
        borderRadius: 'var(--r-pill)',
        background: completo ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: completo ? 'var(--accent)' : 'var(--warning, #d97706)',
        border: `1px solid ${completo ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      {completo ? (
        <>
          <Check className="w-3 h-3" /> Completo
        </>
      ) : (
        <>
          <Clock className="w-3 h-3" /> Pendente
        </>
      )}
    </span>
  )
}

function RemoveButton({
  memberId,
  onDone,
}: {
  memberId: string
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="btn icon"
      aria-label="Remover"
      title="Remover colaborador"
      disabled={pending}
      onClick={() => {
        if (!confirm('Remover este colaborador? Ele perderá o acesso ao workspace.')) return
        startTransition(async () => {
          const res = await fetch(`/api/workspace/members/${memberId}`, { method: 'DELETE' })
          if (res.ok) onDone()
          else alert('Não foi possível remover.')
        })
      }}
    >
      <Trash2 className="w-3 h-3" />
    </button>
  )
}

// ============================================================================
// Form de criação / edição
// ============================================================================

function MemberForm({
  mode,
  member,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  member?: Member
  onClose: () => void
  onSaved: () => void
}) {
  const [email, setEmail] = useState(member?.email ?? '')
  const [cargo, setCargo] = useState(member?.cargo ?? '')
  const [cpf, setCpf] = useState(member?.cpf ? maskCPF(member.cpf) : '')
  const [telefoneWhats, setTelefoneWhats] = useState(
    member?.telefoneWhats ? maskTelefone(member.telefoneWhats) : '',
  )
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>(
    (member?.role as any) ?? 'member',
  )
  const [funcoes, setFuncoes] = useState<Funcao[]>(
    ((member?.funcoes ?? []) as Funcao[]).filter((f) => FUNCOES.includes(f)),
  )
  const [areas, setAreas] = useState<Area[]>(
    ((member?.areasPermitidas ?? ['mesa']) as Area[]).filter((a) =>
      AREAS.includes(a),
    ),
  )
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggleFuncao = (f: Funcao) => {
    setFuncoes((cur) => {
      const has = cur.includes(f)
      const next = has ? cur.filter((x) => x !== f) : [...cur, f]
      // Sugestão: adiciona áreas vinculadas à função quando marca
      if (!has) {
        const sug = FUNCAO_AREA_SUGERIDA[f] ?? []
        setAreas((curA) => {
          const out = [...curA]
          for (const a of sug) {
            if (!out.includes(a as Area)) out.push(a as Area)
          }
          return out
        })
      }
      return next
    })
  }

  const toggleArea = (a: Area) => {
    setAreas((cur) =>
      cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a],
    )
  }

  const submit = () => {
    setErr(null)
    if (!email.trim() || !email.includes('@')) {
      setErr('Informe um e-mail válido.')
      return
    }
    if (role !== 'admin' && areas.length === 0) {
      setErr('Marque pelo menos uma área para um membro comum.')
      return
    }
    // CPF/telefone só são obrigatórios na criação inicial — no edit podem ficar em branco
    if (mode === 'create') {
      const cpfDigits = cpf.replace(/\D/g, '')
      if (!cpfDigits || !isValidCPF(cpfDigits)) {
        setErr('Informe um CPF válido.')
        return
      }
      const telDigits = telefoneWhats.replace(/\D/g, '')
      if (telDigits.length < 10) {
        setErr('Informe o telefone/WhatsApp do colaborador.')
        return
      }
    }
    startTransition(async () => {
      const url =
        mode === 'create'
          ? '/api/workspace/members'
          : `/api/workspace/members/${member!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body =
        mode === 'create'
          ? {
              email,
              role,
              cargo: cargo || null,
              areasPermitidas: areas,
              funcoes,
              cpf: cpf.replace(/\D/g, '') || null,
              telefoneWhats: telefoneWhats.replace(/\D/g, '') || null,
            }
          : { role, cargo: cargo || null, areasPermitidas: areas, funcoes }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j?.error || 'Erro ao salvar.')
        return
      }
      onSaved()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {mode === 'create' ? 'Novo colaborador' : 'Editar colaborador'}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>
              {mode === 'create' ? 'Adicionar à equipe' : member?.email}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn icon" aria-label="Fechar">
            <X className="w-3.5 h-3.5" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* E-mail */}
          <Field label="E-mail">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
              <input
                type="email"
                value={email}
                disabled={mode === 'edit'}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: 14,
                }}
              />
            </div>
          </Field>

          {/* Cargo */}
          <Field label="Cargo (texto livre, exibido na equipe)">
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="ex.: Trader Sênior, CFO"
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                color: 'var(--text)',
                outline: 'none',
                fontSize: 14,
              }}
            />
          </Field>

          {mode === 'create' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="CPF *">
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: 14,
                  }}
                />
              </Field>
              <Field label="Telefone / WhatsApp *">
                <input
                  type="text"
                  value={telefoneWhats}
                  onChange={(e) => setTelefoneWhats(maskTelefone(e.target.value))}
                  placeholder="(00) 0 0000-0000"
                  inputMode="tel"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: 14,
                  }}
                />
              </Field>
            </div>
          )}

          {/* Nível de acesso */}
          <Field label="Nível de acesso">
            <div className="flex gap-2 flex-wrap">
              {(['admin', 'member', 'viewer'] as const).map((r) => (
                <Chip
                  key={r}
                  active={role === r}
                  onClick={() => setRole(r)}
                >
                  {ROLE_LABEL[r]}
                </Chip>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              Administradores enxergam tudo, independente das áreas marcadas
              abaixo.
            </p>
          </Field>

          {/* Funções (multi) */}
          <Field label="Funções (multi-seleção)">
            <div className="flex gap-1.5 flex-wrap">
              {FUNCOES.map((f) => (
                <Chip key={f} active={funcoes.includes(f)} onClick={() => toggleFuncao(f)}>
                  {FUNCAO_LABEL[f]}
                </Chip>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              Funções gerenciais (Gerente de Mesa, CFO, Gerente Fiscal, Gerente
              Administrativo) dão visão completa da área correspondente.
            </p>
          </Field>

          {/* Áreas */}
          <Field label="Áreas que pode acessar">
            <div className="flex gap-2 flex-wrap">
              {AREAS.map((a) => {
                const active = areas.includes(a) || role === 'admin'
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => role !== 'admin' && toggleArea(a)}
                    disabled={role === 'admin'}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--r-md)',
                      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      color: active ? 'var(--accent)' : 'var(--text)',
                      fontSize: 13,
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: role === 'admin' ? 'not-allowed' : 'pointer',
                      opacity: role === 'admin' ? 0.7 : 1,
                    }}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {AREA_LABEL[a]}
                  </button>
                )
              })}
            </div>
            {role === 'admin' && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                Administradores têm acesso a todas as áreas automaticamente.
              </p>
            )}
          </Field>

          {err && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--danger-soft, rgba(255,80,80,0.12))',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                borderRadius: 'var(--r-sm)',
                fontSize: 12,
              }}
            >
              {err}
            </div>
          )}
        </div>

        <footer
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <button type="button" onClick={onClose} className="btn ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="btn primary"
          >
            {pending ? 'Salvando…' : mode === 'create' ? 'Enviar convite' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'var(--f-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: '8px 10px',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 11px',
        fontSize: 12,
        borderRadius: 'var(--r-pill)',
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? 'var(--accent-ink)' : 'var(--text)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}
