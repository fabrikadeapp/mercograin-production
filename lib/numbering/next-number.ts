/**
 * Numeração inteligente de propostas e contratos.
 *
 * Formato: `<CODIGO_WORKSPACE><AAAA><MM><DD><NN><P|C>`
 * Exemplo: MCG2026051701P (1ª proposta da Mercograin em 17/05/2026)
 *          AGY2026051702C (2º contrato da Agrosoy em 17/05/2026)
 *
 * Reseta o contador a cada dia (timezone America/Sao_Paulo, pra alinhar com
 * o expediente do trader).
 *
 * Atomicidade: usa Prisma upsert+increment dentro de transação curta.
 */

import { db } from '@/lib/db'

export type NumberingTipo = 'proposta' | 'contrato'

const SUFIXO: Record<NumberingTipo, 'P' | 'C'> = {
  proposta: 'P',
  contrato: 'C',
}

/**
 * Retorna o dia atual em São Paulo no formato YYYY-MM-DD.
 */
function diaSaoPaulo(now = new Date()): string {
  // pt-BR com timeZone retorna dd/mm/yyyy — invertemos pra ISO-like.
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Gera o próximo número para um workspace + tipo.
 *
 * @returns string formatada pronta pra gravar em Proposta.numero / Contrato.numero
 */
export async function nextNumber(
  workspaceId: string,
  tipo: NumberingTipo,
): Promise<string> {
  // Carrega o código do workspace (3 letras)
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { codigo: true, name: true },
  })
  if (!ws) throw new Error('workspace_not_found')

  const codigo =
    (ws.codigo && ws.codigo.length >= 2
      ? ws.codigo
      : (ws.name ?? 'WKS').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) ||
    'WKS'

  const dia = diaSaoPaulo()
  const sufixo = SUFIXO[tipo]
  const tipoKey = sufixo // 'P' | 'C' — usado como discriminator no contador

  // Upsert + increment atômico
  const counter = await db.numberingCounter.upsert({
    where: {
      workspaceId_dia_tipo: { workspaceId, dia, tipo: tipoKey },
    },
    create: {
      workspaceId,
      dia,
      tipo: tipoKey,
      ultimo: 1,
    },
    update: {
      ultimo: { increment: 1 },
    },
    select: { ultimo: true },
  })

  const seq = counter.ultimo.toString().padStart(2, '0')
  // dia vem 'YYYY-MM-DD' → compacta pra YYYYMMDD
  const compactDia = dia.replace(/-/g, '')

  return `${codigo}${compactDia}${seq}${sufixo}`
}

/**
 * Preview do próximo número (sem incrementar — usado em UI antes do submit).
 * Por ser preview, pode ficar fora de sincronia com criação real.
 */
export async function previewNextNumber(
  workspaceId: string,
  tipo: NumberingTipo,
): Promise<string> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { codigo: true, name: true },
  })
  if (!ws) throw new Error('workspace_not_found')

  const codigo =
    (ws.codigo && ws.codigo.length >= 2
      ? ws.codigo
      : (ws.name ?? 'WKS').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) ||
    'WKS'

  const dia = diaSaoPaulo()
  const sufixo = SUFIXO[tipo]

  const counter = await db.numberingCounter.findUnique({
    where: { workspaceId_dia_tipo: { workspaceId, dia, tipo: sufixo } },
    select: { ultimo: true },
  })
  const proximo = (counter?.ultimo ?? 0) + 1
  const seq = proximo.toString().padStart(2, '0')
  const compactDia = dia.replace(/-/g, '')

  return `${codigo}${compactDia}${seq}${sufixo}`
}
