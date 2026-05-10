import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { NovaNotaWizard } from '../../_components/NovaNotaWizard'

export const dynamic = 'force-dynamic'

export default async function NovaNotaPage({
  searchParams,
}: {
  searchParams?: Promise<{ contratoId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const params = (await searchParams) ?? {}

  const [cfg, empresa, contratos, clientes] = await Promise.all([
    db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } }),
    db.dadosEmpresa.findUnique({ where: { workspaceId: scope.workspaceId } }),
    db.contrato.findMany({
      where: { ...scope.whereOwn() },
      orderBy: { criadoEm: 'desc' },
      take: 50,
      select: { id: true, numero: true, clienteId: true, cliente: { select: { nome: true } } },
    }),
    db.cliente.findMany({
      where: scope.whereOwn(),
      orderBy: { nome: 'asc' },
      take: 200,
      select: { id: true, nome: true, cnpj: true, tipo: true, endereco: true },
    }),
  ])

  if (!cfg) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Fiscal · Nova NF-e"
          title="Configuração fiscal pendente"
          subtitle="Antes de emitir uma NF-e configure os dados do emissor."
        />
        <a href="/fiscal/configuracao" className="text-accent">Ir para configuração →</a>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · Nova NF-e"
        title={`NF-e nº ${cfg.proximoNumeroNFe}/série ${cfg.serieNFe}`}
        subtitle="Wizard de emissão em 4 passos: tipo, destinatário, itens (com cálculo de tributos), revisão."
      />
      <NovaNotaWizard
        regime={cfg.regimeTributario}
        emitenteUF={empresa?.uf ?? 'RS'}
        contratos={contratos as any}
        clientes={clientes as any}
        contratoIdInicial={params.contratoId}
        cfopPadraoEntrada={cfg.cfopCompraProdutorPF}
        cfopPadraoSaidaInter={cfg.cfopVendaInterestadual}
        cfopPadraoSaidaIntra={cfg.cfopVendaIntraestadual}
      />
    </AppShell>
  )
}
