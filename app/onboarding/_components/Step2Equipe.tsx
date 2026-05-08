'use client'
import { useEffect, useState } from 'react'
import { UserPlus, Mail, X } from 'lucide-react'
import { Button, Input, Select, Chip } from '@/components/ui/phb'

interface Props {
  workspaceId: string
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

interface Member {
  id: string
  email: string
  role: string
  status: string
  user?: { nome?: string | null; email: string } | null
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Membro' },
  { value: 'viewer', label: 'Visualizador' },
]

export function Step2Equipe({ onNext, onSkip, onBack }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/workspace/members')
      .then((r) => r.json())
      .then((data) => setMembers(data.members || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/workspace/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao convidar')
      setMembers((prev) => [...prev, data.member])
      setEmail('')
      setRole('member')
    } catch (e: any) {
      setError(e?.message || 'Erro')
    } finally {
      setAdding(false)
    }
  }

  const extraMembers = Math.max(0, members.length - 1)
  const extraPriceCents = 15000
  const extraTotal = (extraMembers * extraPriceCents) / 100

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-fg-3 mb-2">PASSO 2 · EQUIPE</div>
        <h1 className="text-h2 text-fg-1 mb-2">Convide sua equipe</h1>
        <p className="text-fg-3">
          Adicione admins, membros e visualizadores. Eles recebem convite por
          email para acessar o workspace.
        </p>
      </div>

      <div className="border border-border-1 rounded-card bg-bg-1 p-5">
        <div className="eyebrow text-fg-3 mb-3">RESUMO DE COBRANÇA</div>
        <div className="text-sm text-fg-2">
          {members.length} membro{members.length !== 1 ? 's' : ''} no workspace
          {' · '}1 incluído + {extraMembers} extra{extraMembers !== 1 ? 's' : ''}
        </div>
        {extraMembers > 0 && (
          <div className="mt-2 text-fg-1 t-num">
            R$ {extraTotal.toFixed(2)} <span className="text-fg-4 text-xs">/mês</span>
          </div>
        )}
      </div>

      <form onSubmit={handleAdd} className="border border-border-1 rounded-card bg-bg-1 p-5 space-y-4">
        <div className="eyebrow text-fg-3">ADICIONAR MEMBRO</div>
        {error && (
          <div className="p-3 rounded-md bg-neg/10 border border-neg/30 text-neg text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            leftIcon={<Mail className="w-4 h-4" />}
          />
          <Select
            label="Papel"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={ROLES}
          />
          <Button type="submit" loading={adding} leftIcon={<UserPlus className="w-4 h-4" />}>
            Convidar
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        <div className="eyebrow text-fg-3">MEMBROS ATUAIS ({members.length})</div>
        {loading ? (
          <div className="text-fg-4 text-sm py-4">Carregando...</div>
        ) : members.length === 0 ? (
          <div className="text-fg-4 text-sm py-4 text-center border border-dashed border-border-1 rounded-md">
            Nenhum membro ainda. Adicione acima para convidar sua equipe.
          </div>
        ) : (
          <ul className="divide-y divide-border-1 border border-border-1 rounded-card bg-bg-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-fg-1 font-medium">
                    {m.user?.nome || m.email}
                  </div>
                  <div className="text-fg-3 text-xs">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Chip variant="neutral">{m.role}</Chip>
                  <Chip variant={m.status === 'active' ? 'pos' : 'warn'}>
                    {m.status === 'active' ? 'Ativo' : 'Convidado'}
                  </Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onSkip}>
            Pular por enquanto
          </Button>
          <Button type="button" onClick={onNext} size="lg">
            Continuar
          </Button>
        </div>
      </div>
    </div>
  )
}
