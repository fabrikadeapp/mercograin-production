import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plug,
  Workflow,
  Receipt,
  Users,
  CreditCard,
  ImageIcon,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * /admin-empresa — Dashboard administrativo da workspace (cliente).
 *
 * NÃO CONFUNDIR com /admin (super-admin global da Mercograin).
 * Aqui o admin DO WORKSPACE vê:
 *  - Saúde do cadastro (% completude)
 *  - Resumo de contagens (clientes, propostas, integrações ativas)
 *  - Atalhos para subsistemas administrativos
 */
export default async function AdminEmpresaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const allowed =
    scope.isAdmin || ['owner', 'admin'].includes(scope.workspaceRole)
  if (!allowed) redirect('/dashboard')

  const [empresa, workspace, counts] = await Promise.all([
    db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true, slug: true, createdAt: true },
    }),
    Promise.all([
      db.cliente.count({ where: { workspaceId: scope.workspaceId, ativo: true } }),
      db.proposta.count({ where: { workspaceId: scope.workspaceId } }),
      db.contrato.count({ where: { workspaceId: scope.workspaceId } }),
      db.movimentoFinanceiro.count({ where: { workspaceId: scope.workspaceId } }),
      db.integrationCredential.count({
        where: { workspaceId: scope.workspaceId, enabled: true },
      }),
      db.user.count({
        where: { workspaceMemberships: { some: { workspaceId: scope.workspaceId } } },
      }),
    ]),
  ])
  const [clientesAtivos, propostasTotal, contratosTotal, movimentosTotal, integracoesAtivas, usuariosTotal] = counts

  // Completude do cadastro
  const checks: Array<{ label: string; done: boolean; href: string }> = [
    {
      label: 'Razão social',
      done: !!empresa?.razaoSocial,
      href: '/configuracoes/empresa',
    },
    { label: 'CNPJ', done: !!empresa?.cnpj, href: '/configuracoes/empresa' },
    { label: 'Endereço', done: !!empresa?.endereco, href: '/configuracoes/empresa' },
    { label: 'Contato (telefone/e-mail)', done: !!(empresa?.telefone ?? empresa?.email), href: '/configuracoes/empresa' },
    {
      label: 'Logo da empresa',
      done: !!empresa?.logoUrl,
      href: '/configuracoes/marca',
    },
    {
      label: 'Conta bancária',
      done: !!empresa?.dadosBancarios,
      href: '/configuracoes/empresa',
    },
  ]
  const completos = checks.filter((c) => c.done).length
  const completudePct = Math.round((completos / checks.length) * 100)

  return (
    <AppShell>
      <PageHeader
        eyebrow="Administração · Workspace"
        title={workspace?.name ?? 'Painel administrativo'}
        subtitle="Visão geral da empresa, cadastros, integrações e dados gerenciais."
        actions={
          <Link href="/configuracoes" className="btn" style={{ fontSize: 12, textDecoration: 'none' }}>
            Configurações <ArrowRight className="w-3 h-3" />
          </Link>
        }
      />

      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-2">
        <KpiTile label="Clientes ativos" value={clientesAtivos.toString()} icon={<Users className="w-3.5 h-3.5" />} href="/clientes" />
        <KpiTile label="Propostas" value={propostasTotal.toString()} icon={<Receipt className="w-3.5 h-3.5" />} href="/propostas" />
        <KpiTile label="Contratos" value={contratosTotal.toString()} icon={<Receipt className="w-3.5 h-3.5" />} href="/contratos" />
        <KpiTile label="Movimentos" value={movimentosTotal.toString()} icon={<TrendingUp className="w-3.5 h-3.5" />} href="/financeiro/movimentos" />
        <KpiTile label="Integrações" value={integracoesAtivas.toString()} icon={<Plug className="w-3.5 h-3.5" />} href="/configuracoes/integracoes" />
        <KpiTile label="Usuários" value={usuariosTotal.toString()} icon={<Users className="w-3.5 h-3.5" />} href="#" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Completude do cadastro */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Cadastro da empresa
            </h2>
            <span
              className="tabular-nums"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: completudePct === 100 ? 'var(--success)' : completudePct >= 50 ? 'var(--accent)' : 'var(--warning)',
                letterSpacing: '-0.02em',
              }}
            >
              {completudePct}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-mute)' }}>
            {completos} de {checks.length} itens preenchidos
          </p>

          {/* Barra de progresso */}
          <div
            style={{
              height: 6,
              background: 'var(--surface-3)',
              borderRadius: 999,
              overflow: 'hidden',
              marginTop: 8,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: `${completudePct}%`,
                height: '100%',
                background: completudePct === 100 ? 'var(--success)' : 'var(--accent)',
                borderRadius: 999,
                transition: '300ms ease',
              }}
            />
          </div>

          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className="flex items-center gap-2 py-1 transition"
                  style={{
                    fontSize: 12,
                    color: c.done ? 'var(--text-mute)' : 'var(--text)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = c.done ? 'var(--text-mute)' : 'var(--text)')
                  }
                >
                  {c.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)', flexShrink: 0 }} />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  )}
                  <span>{c.label}</span>
                  {!c.done && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        color: 'var(--text-dim)',
                      }}
                    >
                      configurar →
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* Resumo da empresa */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
            Resumo da empresa
          </h2>
          {empresa ? (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <Row label="Razão social" value={empresa.razaoSocial} />
              <Row label="Nome fantasia" value={empresa.nomeFantasia} />
              <Row label="CNPJ" value={empresa.cnpj} />
              <Row label="Inscrição estadual" value={empresa.inscricaoEstadual} />
              <Row label="Endereço" value={empresa.endereco} />
              <Row label="Cidade/UF" value={[empresa.cidade, empresa.uf].filter(Boolean).join(' / ')} />
              <Row label="CEP" value={empresa.cep} />
              <Row label="Telefone" value={empresa.telefone} />
              <Row label="E-mail" value={empresa.email} />
              <Row
                label="Workspace"
                value={`${workspace?.name ?? '—'} (${workspace?.slug ?? ''})`}
              />
            </dl>
          ) : (
            <div
              className="p-4 text-sm flex items-center gap-3"
              style={{
                background: 'var(--warning-soft)',
                color: 'var(--warning)',
                borderRadius: 'var(--r-md)',
                border: '1px solid rgba(251, 191, 36, 0.25)',
              }}
            >
              <AlertCircle className="w-4 h-4" />
              <span>
                A empresa ainda não foi cadastrada.{' '}
                <Link
                  href="/configuracoes/empresa"
                  style={{ color: 'var(--warning)', textDecoration: 'underline', fontWeight: 600 }}
                >
                  Cadastrar agora →
                </Link>
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* Atalhos administrativos */}
      <Card className="p-5 mt-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
          Atalhos administrativos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <ShortcutTile href="/configuracoes/empresa" icon={<Building2 className="w-4 h-4" />} label="Dados da empresa" />
          <ShortcutTile href="/configuracoes/marca" icon={<ImageIcon className="w-4 h-4" />} label="Marca & Logo" />
          <ShortcutTile href="/configuracoes/integracoes" icon={<Plug className="w-4 h-4" />} label="Integrações" />
          <ShortcutTile href="/configuracoes/fluxo-trabalho" icon={<Workflow className="w-4 h-4" />} label="Fluxo de trabalho" />
          <ShortcutTile href="/configuracoes/ai" icon={<Sparkles className="w-4 h-4" />} label="Agente IA" />
          <ShortcutTile href="/financeiro" icon={<TrendingUp className="w-4 h-4" />} label="Financeiro" />
          <ShortcutTile href="/financeiro/centros-custo" icon={<Receipt className="w-4 h-4" />} label="Centros de custo" />
          <ShortcutTile href="/fornecedores" icon={<Users className="w-4 h-4" />} label="Fornecedores" />
          <ShortcutTile href="/clientes" icon={<Users className="w-4 h-4" />} label="Clientes" />
          <ShortcutTile href="/assinatura" icon={<CreditCard className="w-4 h-4" />} label="Assinatura" />
        </div>
      </Card>
    </AppShell>
  )
}

function KpiTile({
  label,
  value,
  icon,
  href,
}: {
  label: string
  value: string
  icon: React.ReactNode
  href: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 14,
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'var(--text)',
        transition: '120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="eyebrow">{label}</span>
        <span style={{ color: 'var(--text-dim)' }}>{icon}</span>
      </div>
      <p
        className="tabular-nums"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
    </Link>
  )
}

function ShortcutTile({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'var(--text)',
        minHeight: 72,
        transition: '120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <span style={{ color: 'var(--text-mute)' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, marginTop: 8 }}>
        {label}
      </span>
    </Link>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="eyebrow" style={{ marginBottom: 2 }}>
        {label}
      </dt>
      <dd
        style={{
          fontSize: 13,
          color: value ? 'var(--text)' : 'var(--text-dim)',
          fontStyle: value ? 'normal' : 'italic',
        }}
      >
        {value || 'não preenchido'}
      </dd>
    </div>
  )
}
