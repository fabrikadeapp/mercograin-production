/**
 * lib/bi/produtor.ts
 * KPIs do produtor (B2C lite) — visão do produtor dos seus contratos com a corretora.
 */
import { db } from '@/lib/db'

export interface KpisProdutor {
  clienteId: string
  nome: string
  contratosAtivos: number
  contratosFechados: number
  qtdSafraAtual: number // sacas Σ contratos da safra ativa
  valorRecebido: number
  valorAReceber: number
  recebimentosPontualidade: number // % boletos pagos em dia
  ultimosContratos: { id: string; numero: string; status: string; valor: number; criadoEm: string }[]
}

export async function kpisProdutor(clienteId: string): Promise<KpisProdutor> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, workspaceId: true },
  })
  if (!cliente) throw new Error('Cliente não encontrado')

  const [contratos, boletos] = await Promise.all([
    db.contrato.findMany({
      where: { clienteId },
      select: {
        id: true,
        numero: true,
        criadoEm: true,
        assinadoEm: true,
        dataFim: true,
        statusAssinatura: true,
        proposta: { select: { valorTotal: true, graos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    }),
    db.boleto.findMany({
      where: { clienteId },
      select: { valor: true, status: true, vencimento: true, confirmadoEm: true },
    }),
  ])

  const now = new Date()
  const contratosAtivos = contratos.filter(
    (c) => !c.dataFim || c.dataFim > now
  ).length
  const contratosFechados = contratos.filter((c) => !!c.assinadoEm).length

  // Sacas safra atual (heurística: contratos criados nos últimos 12 meses)
  const safraStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  let qtdSafraAtual = 0
  for (const c of contratos) {
    if (c.criadoEm < safraStart) continue
    const arr = Array.isArray(c.proposta?.graos) ? (c.proposta!.graos as any[]) : []
    for (const g of arr) {
      qtdSafraAtual += Number(g?.quantidadeSc ?? g?.quantidade ?? 0)
    }
  }

  const valorRecebido = boletos
    .filter((b) => b.status === 'pago' || !!b.confirmadoEm)
    .reduce((s, b) => s + Number(b.valor), 0)
  const valorAReceber = boletos
    .filter((b) => b.status === 'aberto' || b.status === 'vencido')
    .reduce((s, b) => s + Number(b.valor), 0)

  // Pontualidade
  const pagos = boletos.filter((b) => !!b.confirmadoEm)
  let emDia = 0
  for (const b of pagos) {
    if (b.confirmadoEm && b.confirmadoEm <= b.vencimento) emDia++
  }
  const recebimentosPontualidade =
    pagos.length > 0 ? (emDia / pagos.length) * 100 : 0

  const ultimosContratos = contratos.slice(0, 5).map((c) => ({
    id: c.id,
    numero: c.numero,
    status: c.statusAssinatura,
    valor: Number(c.proposta?.valorTotal || 0),
    criadoEm: c.criadoEm.toISOString(),
  }))

  return {
    clienteId,
    nome: cliente.nome,
    contratosAtivos,
    contratosFechados,
    qtdSafraAtual: Math.round(qtdSafraAtual * 100) / 100,
    valorRecebido: Math.round(valorRecebido * 100) / 100,
    valorAReceber: Math.round(valorAReceber * 100) / 100,
    recebimentosPontualidade: Math.round(recebimentosPontualidade * 100) / 100,
    ultimosContratos,
  }
}
