import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { PageHeader, Card, KPICard } from '@/components/ui/phb'
import { BhGrainShellServer } from '@/app/_shared/BhGrainShellServer'
import { FileText, FileWarning, FileCheck, Cog, Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function FiscalHubPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  const [cfg, totalMes, valorMes, pendentes, rejeitadas, spedRecentes] = await Promise.all([
    db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } }),
    db.notaFiscal.count({
      where: { ...scope.whereOwn(), dataEmissao: { gte: inicioMes }, status: 'autorizada' },
    }),
    db.notaFiscal.aggregate({
      where: { ...scope.whereOwn(), dataEmissao: { gte: inicioMes }, status: 'autorizada' },
      _sum: { valorTotal: true },
    }),
    db.notaFiscal.count({ where: { ...scope.whereOwn(), status: { in: ['rascunho', 'enviada'] } } }),
    db.notaFiscal.count({ where: { ...scope.whereOwn(), status: 'rejeitada' } }),
    db.spedExport.findMany({ where: scope.whereOwn(), orderBy: { createdAt: 'desc' }, take: 4 }),
  ])

  const configurado = !!cfg
  const competenciaAtual = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}`

  return (
    <BhGrainShellServer>
      <PageHeader
        eyebrow="Operações · Fiscal"
        title="Fiscal NF-e + SPED"
        subtitle="Emissão de NF-e, cálculo de tributos (FUNRURAL, ICMS, PIS/COFINS) e geração de SPED Fiscal e Contribuições para corretora de grãos."
        actions={
          <Link
            href="/fiscal/notas/nova"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-ink text-small font-semibold hover:opacity-90"
          >
            <Receipt className="h-4 w-4" />
            Nova NF-e
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="Configuração"
          value={configurado ? (cfg!.ativo ? 'Ativa' : 'Inativa') : 'Pendente'}
          subtitle={cfg ? `Provider: ${cfg.providerNome} · ${cfg.ambiente}` : 'Cadastre dados fiscais'}
          delta={configurado ? undefined : { value: 'configurar', trend: 'neg' }}
        />
        <KPICard
          eyebrow="NF-e no mês"
          value={String(totalMes)}
          subtitle={fmtBRL(Number(valorMes._sum.valorTotal ?? 0))}
        />
        <KPICard
          eyebrow="Pendentes"
          value={String(pendentes)}
          delta={pendentes > 0 ? { value: 'rascunho/envio', trend: 'neutral' } : undefined}
        />
        <KPICard
          eyebrow="Rejeitadas"
          value={String(rejeitadas)}
          delta={rejeitadas > 0 ? { value: 'reemitir', trend: 'neg' } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/fiscal/configuracao" className="block">
          <Card className="h-full p-5 hover:border-accent/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Cog className="h-5 w-5 text-accent" />
              <span className="t-num-sm">Configuração</span>
            </div>
            <div className="text-fg-3 text-small">
              {configurado ? `Provider: ${cfg!.providerNome}` : 'Cadastre emissor e provider'}
            </div>
          </Card>
        </Link>
        <Link href="/fiscal/notas" className="block">
          <Card className="h-full p-5 hover:border-accent/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-accent" />
              <span className="t-num-sm">Notas fiscais</span>
            </div>
            <div className="text-fg-3 text-small">{totalMes} emitidas no mês</div>
          </Card>
        </Link>
        <Link href="/fiscal/sped" className="block">
          <Card className="h-full p-5 hover:border-accent/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <FileCheck className="h-5 w-5 text-accent" />
              <span className="t-num-sm">SPED Fiscal</span>
            </div>
            <div className="text-fg-3 text-small">EFD-ICMS/IPI · {competenciaAtual}</div>
          </Card>
        </Link>
        <Link href="/fiscal/sped" className="block">
          <Card className="h-full p-5 hover:border-accent/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <FileWarning className="h-5 w-5 text-accent" />
              <span className="t-num-sm">SPED Contribuições</span>
            </div>
            <div className="text-fg-3 text-small">PIS/COFINS · {competenciaAtual}</div>
          </Card>
        </Link>
        <Link href="/fiscal/guias" className="block">
          <Card className="h-full p-5 hover:border-accent/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <FileCheck className="h-5 w-5 text-accent" />
              <span className="t-num-sm">Guias</span>
            </div>
            <div className="text-fg-3 text-small">DARF · GNRE · GARE-SP</div>
          </Card>
        </Link>
        <Link href="/fiscal/simulador-uf" className="block">
          <Card className="h-full p-5 hover:border-accent/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <FileCheck className="h-5 w-5 text-accent" />
              <span className="t-num-sm">Simulador UF</span>
            </div>
            <div className="text-fg-3 text-small">Comparar carga tributária entre estados</div>
          </Card>
        </Link>
      </div>

      {!configurado && (
        <Card className="p-5 mb-6 border-neg/40">
          <h3 className="text-h3 text-fg-1 mb-2">Configuração fiscal pendente</h3>
          <p className="text-fg-2 text-small mb-3">
            Para emitir notas fiscais é necessário cadastrar CNPJ, regime tributário, certificado digital A1 e provider de emissão.
          </p>
          <Link href="/fiscal/configuracao" className="text-accent text-small font-medium">
            Configurar agora →
          </Link>
        </Card>
      )}

      {spedRecentes.length > 0 && (
        <Card className="p-5">
          <h3 className="text-h3 text-fg-1 mb-3">SPED recentes</h3>
          <div className="space-y-2">
            {spedRecentes.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-small">
                <div>
                  <span className="font-medium">{s.tipo === 'fiscal' ? 'SPED Fiscal' : 'SPED Contribuições'}</span>
                  <span className="text-fg-3 ml-2">{s.competencia}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-micro uppercase ${s.status === 'pronto' ? 'text-pos' : s.status === 'erro' ? 'text-neg' : 'text-fg-3'}`}>
                    {s.status}
                  </span>
                  {s.status === 'pronto' && (
                    <a href={`/api/fiscal/sped/${s.id}/download`} className="text-accent hover:underline">
                      Baixar
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </BhGrainShellServer>
  )
}
