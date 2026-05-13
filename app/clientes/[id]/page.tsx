import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { ArrowLeft, FileText, Wallet, MapPin, MessageCircle, ShieldCheck, Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClienteHubPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const { id } = await params

  const cliente = await db.cliente.findFirst({
    where: { id, workspaceId: scope.workspaceId },
    include: {
      _count: { select: { propostas: true, contratos: true, boletos: true } },
    },
  })
  if (!cliente) notFound()

  // Propostas abertas para contexto rápido
  const propostasAbertas = await db.proposta.count({
    where: {
      clienteId: id,
      workspaceId: scope.workspaceId,
      status: { in: ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao'] },
    },
  })

  const tabs: { href: string; label: string; Icon: typeof FileText; count?: number }[] = [
    { href: `/clientes/${id}/editar`, label: 'Editar dados', Icon: Pencil },
    { href: `/clientes/${id}/kyc`, label: 'KYC / Compliance', Icon: ShieldCheck },
    { href: `/clientes/${id}/propriedades`, label: 'Propriedades rurais', Icon: MapPin },
    { href: `/clientes/${id}/documentos`, label: 'Documentos', Icon: FileText },
    { href: `/clientes/${id}/chat`, label: 'Conversas', Icon: MessageCircle },
  ]

  const status =
    !cliente.ativo
      ? 'Inativo'
      : cliente.statusCadastral === 'analise' || cliente.statusCadastral === 'rascunho'
        ? 'Lead'
        : 'Ativo'

  return (
    <AppShell>
      <div className="mb-3">
        <Link href="/clientes" className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar para clientes
        </Link>
      </div>
      <PageHeader
        eyebrow={cliente.tipoPessoa === 'PJ' ? 'Pessoa jurídica' : cliente.tipoPessoa === 'PF' ? 'Pessoa física' : 'Cliente'}
        title={cliente.nome}
        subtitle={[cliente.email, cliente.telefone, cliente.cnpj ?? cliente.cpf, status].filter(Boolean).join(' · ')}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Card className="p-3"><div className="text-xs opacity-60">Propostas (total)</div><div className="text-xl font-semibold tabular-nums">{cliente._count.propostas}</div></Card>
        <Card className="p-3"><div className="text-xs opacity-60">Propostas abertas</div><div className="text-xl font-semibold tabular-nums">{propostasAbertas}</div></Card>
        <Card className="p-3"><div className="text-xs opacity-60">Contratos</div><div className="text-xl font-semibold tabular-nums">{cliente._count.contratos}</div></Card>
        <Card className="p-3"><div className="text-xs opacity-60">Boletos</div><div className="text-xl font-semibold tabular-nums">{cliente._count.boletos}</div></Card>
      </div>

      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Áreas do cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {tabs.map((t) => {
            const Icon = t.Icon
            return (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center gap-3 p-3 rounded-lg bg-black/10 hover:bg-black/20 transition"
              >
                <Icon className="w-4 h-4 opacity-70" />
                <span className="text-sm font-medium">{t.label}</span>
              </Link>
            )
          })}
        </div>
      </Card>

      {cliente.endereco && (
        <Card className="p-4 mt-4">
          <div className="text-xs opacity-60 uppercase tracking-wider mb-1">Endereço</div>
          <div className="text-sm">{cliente.endereco}</div>
        </Card>
      )}
    </AppShell>
  )
}
