/**
 * GET /api/dossie/[contratoId] — Dossiê consolidado do negócio (F1-07).
 * Read-only. Feature-gated por 'dossie'. Agrega termos + timeline + documentos
 * de um contrato a partir das entidades já existentes (sem novo storage).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Evento { data: string; tipo: string; titulo: string; detalhe?: string }
interface Doc { tipo: string; titulo: string; url?: string | null; data?: string | null }

export async function GET(_req: NextRequest, { params }: { params: { contratoId: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'dossie'))) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }

  const contrato = await db.contrato.findFirst({
    where: { id: params.contratoId, ...scope.whereOwn() },
    include: {
      cliente: { select: { nome: true, cnpj: true, cpf: true } },
      proposta: { select: { numero: true, graos: true, valorTotal: true, tipo: true } },
      assinaturaDigital: { select: { status: true, signatarios: true, enviadoEm: true, finalizadoEm: true, providerNome: true } },
      notasFiscais: { select: { id: true, numero: true, status: true, danfeUrl: true, createdAt: true } },
      boletos: { select: { id: true, valor: true, status: true, vencimento: true } },
    },
  })
  if (!contrato) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [romaneios, comissao, auditoria] = await Promise.all([
    db.romaneio.findMany({ where: { contratosIds: { has: contrato.id }, ...scope.whereOwn() }, select: { id: true, numero: true, status: true, createdAt: true } }).catch(() => []),
    db.comissaoApurada.findFirst({ where: { contratoId: contrato.id, ...scope.whereOwn() }, select: { valorTotalComissao: true, status: true, createdAt: true } }).catch(() => null),
    db.auditLog.findMany({ where: { workspaceId: scope.workspaceId, entidadeId: contrato.id }, orderBy: { criadoEm: 'desc' }, take: 30, select: { acao: true, criadoEm: true, mudancas: true } }).catch(() => []),
  ])

  // Timeline
  const eventos: Evento[] = []
  eventos.push({ data: contrato.criadoEm.toISOString(), tipo: 'contrato', titulo: `Contrato ${contrato.numero} criado` })
  if (contrato.assinaturaDigital?.enviadoEm) eventos.push({ data: contrato.assinaturaDigital.enviadoEm.toISOString(), tipo: 'assinatura', titulo: 'Enviado para assinatura', detalhe: contrato.assinaturaDigital.providerNome })
  if (contrato.assinadoEm) eventos.push({ data: contrato.assinadoEm.toISOString(), tipo: 'assinatura', titulo: 'Contrato assinado' })
  for (const nf of contrato.notasFiscais) eventos.push({ data: nf.createdAt.toISOString(), tipo: 'fiscal', titulo: `NF-e ${nf.numero ?? ''} (${nf.status})` })
  for (const r of romaneios as any[]) eventos.push({ data: r.createdAt.toISOString(), tipo: 'logistica', titulo: `Romaneio ${r.numero ?? ''} (${r.status})` })
  if (comissao) eventos.push({ data: (comissao as any).createdAt.toISOString(), tipo: 'comissao', titulo: `Corretagem apurada (${(comissao as any).status})` })
  for (const a of auditoria as any[]) eventos.push({ data: a.criadoEm.toISOString(), tipo: 'auditoria', titulo: a.acao })
  eventos.sort((x, y) => new Date(y.data).getTime() - new Date(x.data).getTime())

  // Documentos
  const documentos: Doc[] = []
  if (contrato.pdfUrl) documentos.push({ tipo: 'contrato', titulo: `Contrato ${contrato.numero}`, url: contrato.pdfUrl, data: contrato.criadoEm.toISOString() })
  for (const nf of contrato.notasFiscais) documentos.push({ tipo: 'nf', titulo: `NF-e ${nf.numero ?? nf.id.slice(0, 6)}`, url: nf.danfeUrl, data: nf.createdAt.toISOString() })

  return NextResponse.json({
    ok: true,
    contrato: {
      numero: contrato.numero,
      cliente: contrato.cliente?.nome,
      documento: contrato.cliente?.cnpj || contrato.cliente?.cpf || null,
      tipo: contrato.proposta?.tipo,
      proposta: contrato.proposta?.numero,
      valor: Number(contrato.proposta?.valorTotal ?? 0),
      graos: contrato.proposta?.graos ?? [],
      statusAssinatura: contrato.statusAssinatura,
      assinatura: contrato.assinaturaDigital
        ? { status: contrato.assinaturaDigital.status, signatarios: contrato.assinaturaDigital.signatarios }
        : null,
      corretagem: comissao ? { valor: Number((comissao as any).valorTotalComissao), status: (comissao as any).status } : null,
    },
    timeline: eventos,
    documentos,
  })
}
