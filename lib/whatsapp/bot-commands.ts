/**
 * Parser e handlers de comandos do bot WhatsApp.
 *
 * Quando uma mensagem inbound começa com "/", interpretamos como comando
 * e respondemos automaticamente via Evolution API. Mensagens livres NÃO
 * são respondidas (corretor responde manualmente via inbox UI).
 *
 * Multi-tenant: ctx.workspaceId scoping em TODA query.
 */
import type { PrismaClient } from '@prisma/client'
import { db as defaultDb } from '@/lib/db'
import { sendText as defaultSendText } from './evolution'
import { captureError } from '@/lib/observability/capture'
import { gerarTokenAceite } from '@/lib/contratos/aceite'

type DbLike = PrismaClient | typeof defaultDb
type SendTextFn = typeof defaultSendText

export interface BotContext {
  workspaceId: string
  instanceName: string
  remoteJid: string
}

interface Deps {
  db?: DbLike
  sendText?: SendTextFn
}

const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL || 'https://www.profitsync.ia.br').replace(
    /\/+$/,
    ''
  )

const GRAOS = ['soja', 'milho', 'trigo'] as const
type Grao = (typeof GRAOS)[number]

const GRAO_EMOJI: Record<Grao, string> = {
  soja: '🟢',
  milho: '🟡',
  trigo: '🟠',
}

const GRAO_UNIT: Record<Grao, string> = {
  soja: 'sc',
  milho: 'sc',
  trigo: 't',
}

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Tenta processar `text` como comando. Retorna true se foi reconhecido
 * (independente de sucesso no envio da resposta), false se não é comando.
 */
export async function processCommand(
  text: string,
  ctx: BotContext,
  deps: Deps = {}
): Promise<boolean> {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return false

  const parts = trimmed.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1).map((s) => s.toLowerCase())

  const db = deps.db ?? defaultDb
  const sendText = deps.sendText ?? defaultSendText

  let body: string | null = null
  switch (cmd) {
    case '/cotacao':
    case '/cotação':
      body = await buildCotacao(args[0], db)
      break
    case '/propostas':
    case '/proposta':
      body = await buildPropostas(ctx.workspaceId, db)
      break
    case '/contratos':
    case '/contrato':
      if (args[0] === 'pendentes') {
        body = await buildContratosPendentes(ctx, db)
      } else {
        body = await buildContratos(ctx.workspaceId, db)
      }
      break
    case '/aceitar':
      body = await buildAceitar(parts[1], ctx, db)
      break
    case '/recebiveis':
    case '/recebíveis':
      body = await buildRecebiveis(ctx, db)
      break
    case '/ajuda':
    case '/help':
      body = buildAjuda()
      break
    default:
      return false
  }

  if (!body) return true // comando reconhecido mas sem corpo (não envia)

  try {
    await sendText(ctx.instanceName, ctx.remoteJid, body)
  } catch (e) {
    captureError(e, {
      where: 'bot-commands.sendText',
      cmd,
      workspaceId: ctx.workspaceId,
    })
  }
  return true
}

// ---------------------------------------------------------------------------
// Builders (puros — recebem db, retornam string)
// ---------------------------------------------------------------------------

async function buildCotacao(
  graoArg: string | undefined,
  db: DbLike
): Promise<string> {
  // Comando específico: /cotacao soja|milho|trigo
  if (graoArg && (GRAOS as readonly string[]).includes(graoArg)) {
    return buildCotacaoDetalhada(graoArg as Grao, db)
  }

  // Visão geral: 3 grãos + USD
  const lastByGrao = await Promise.all(
    GRAOS.map((grao) =>
      db.cotacao.findFirst({
        where: { grao },
        orderBy: { data: 'desc' },
        select: { preco: true, dolarReal: true, data: true },
      })
    )
  )

  const lines: string[] = ['🌾 Cotações ao vivo — BH Grain', '']
  let dolar: number | null = null
  let dataMaisRecente: Date | null = null

  GRAOS.forEach((grao, i) => {
    const row = lastByGrao[i]
    if (row) {
      lines.push(
        `${GRAO_EMOJI[grao]} ${cap(grao)}: R$ ${fmtBRL(Number(row.preco))}/${GRAO_UNIT[grao]}`
      )
      if (row.dolarReal !== null && dolar === null) dolar = Number(row.dolarReal)
      if (!dataMaisRecente || row.data > dataMaisRecente) dataMaisRecente = row.data
    } else {
      lines.push(`${GRAO_EMOJI[grao]} ${cap(grao)}: sem dados`)
    }
  })

  if (dolar !== null) {
    lines.push(`💵 USD/BRL: R$ ${fmtBRL(dolar)}`)
  }

  lines.push('')
  if (dataMaisRecente) {
    lines.push(`Atualizado em ${fmtDate(dataMaisRecente)}`)
  }
  lines.push(`Ver detalhes: ${APP_URL}/cotacoes`)
  return lines.join('\n')
}

async function buildCotacaoDetalhada(grao: Grao, db: DbLike): Promise<string> {
  const since30 = new Date(Date.now() - 30 * 86400_000)
  const rows = await db.cotacao.findMany({
    where: { grao, data: { gte: since30 } },
    orderBy: { data: 'asc' },
    select: { preco: true, data: true, dolarReal: true },
  })

  if (rows.length === 0) {
    return `${GRAO_EMOJI[grao]} ${cap(grao)}\n\nSem dados nos últimos 30 dias.\n\nVer detalhes: ${APP_URL}/cotacoes`
  }

  const precos = rows.map((r) => Number(r.preco))
  const atual = precos[precos.length - 1]
  const minimo = Math.min(...precos)
  const maximo = Math.max(...precos)

  // Variação 7d: comparar ponto atual com o mais antigo dentro de 7d
  const since7 = new Date(Date.now() - 7 * 86400_000)
  const rows7 = rows.filter((r) => r.data >= since7)
  const ref7 = rows7.length > 0 ? Number(rows7[0].preco) : precos[0]
  const var7 = ref7 === 0 ? null : ((atual - ref7) / ref7) * 100

  const dataAtual = rows[rows.length - 1].data
  const unit = GRAO_UNIT[grao]

  const lines = [
    `${GRAO_EMOJI[grao]} ${cap(grao)} — detalhe`,
    '',
    `Atual: R$ ${fmtBRL(atual)}/${unit}`,
    var7 !== null
      ? `Variação 7d: ${var7 >= 0 ? '+' : ''}${var7.toFixed(2)}%`
      : 'Variação 7d: —',
    `Mín 30d: R$ ${fmtBRL(minimo)}/${unit}`,
    `Máx 30d: R$ ${fmtBRL(maximo)}/${unit}`,
    '',
    `Atualizado em ${fmtDate(dataAtual)}`,
    `Ver detalhes: ${APP_URL}/cotacoes`,
  ]
  return lines.join('\n')
}

async function buildPropostas(workspaceId: string, db: DbLike): Promise<string> {
  const propostas = await db.proposta.findMany({
    where: { workspaceId },
    orderBy: { criadaEm: 'desc' },
    take: 3,
    include: { cliente: { select: { nome: true } } },
  })

  if (propostas.length === 0) {
    return `📋 Suas propostas\n\nNenhuma proposta cadastrada ainda.\n\nCriar nova: ${APP_URL}/propostas`
  }

  const lines: string[] = ['📋 Suas últimas propostas', '']
  for (const p of propostas) {
    const graos = formatGraos(p.graos)
    lines.push(`#${p.numero} — ${p.cliente?.nome ?? 'Cliente'}`)
    lines.push(
      `${graos} · R$ ${fmtBRL(Number(p.valorTotal))} · ${p.status.toUpperCase()}`
    )
    lines.push('')
  }
  lines.push(`Ver todas: ${APP_URL}/propostas`)
  return lines.join('\n')
}

async function buildContratos(workspaceId: string, db: DbLike): Promise<string> {
  const contratos = await db.contrato.findMany({
    where: { workspaceId },
    orderBy: { criadoEm: 'desc' },
    take: 3,
    include: {
      cliente: { select: { nome: true } },
      proposta: { select: { graos: true, valorTotal: true } },
    },
  })

  if (contratos.length === 0) {
    return `📜 Contratos ativos\n\nNenhum contrato registrado ainda.\n\nVer todos: ${APP_URL}/contratos`
  }

  const lines: string[] = ['📜 Contratos ativos', '']
  for (const c of contratos) {
    const graos = formatGraos(c.proposta?.graos)
    const valor = c.proposta?.valorTotal ? fmtBRL(Number(c.proposta.valorTotal)) : '—'
    lines.push(`#${c.numero} — ${c.cliente?.nome ?? 'Cliente'}`)
    lines.push(
      `${graos} · R$ ${valor} total · ${c.statusAssinatura.toUpperCase()}`
    )
    lines.push('')
  }
  lines.push(`Ver todos: ${APP_URL}/contratos`)
  return lines.join('\n')
}

function buildAjuda(): string {
  return [
    '🤖 Comandos disponíveis:',
    '',
    '/cotacao — Cotações ao vivo',
    '/cotacao soja|milho|trigo — Cotação específica',
    '/propostas — Últimas propostas',
    '/contratos — Contratos ativos',
    '/contratos pendentes — Contratos aguardando assinatura',
    '/aceitar [nº] — Link de aceite digital do contrato',
    '/recebiveis — Boletos pendentes (apenas produtor)',
    '/ajuda — Esta mensagem',
    '',
    `Acesse o painel: ${APP_URL}`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Portal-lite (S2 M10) — comandos voltados ao produtor identificado por whatsapp
// ---------------------------------------------------------------------------

/**
 * Resolve cliente do workspace pelo remoteJid (formato 5551999...@s.whatsapp.net).
 * Retorna null se não houver match.
 */
async function resolveClienteByJid(
  ctx: BotContext,
  db: DbLike
): Promise<{ id: string; nome: string } | null> {
  const phone = ctx.remoteJid.replace(/@.*$/, '').replace(/\D/g, '')
  if (!phone) return null
  // Tenta match exato e variações com/sem 9 (BR)
  const variants = Array.from(
    new Set([
      phone,
      phone.replace(/^55/, ''),
      phone.startsWith('55') ? phone : `55${phone}`,
    ])
  )
  const cliente = await db.cliente.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      OR: variants.map((p) => ({ whatsapp: { contains: p } })),
    },
    select: { id: true, nome: true },
  })
  return cliente
}

async function buildContratosPendentes(
  ctx: BotContext,
  db: DbLike
): Promise<string> {
  const cliente = await resolveClienteByJid(ctx, db)
  if (!cliente) {
    return 'Você não está cadastrado como cliente desta corretora.'
  }
  const contratos = await db.contrato.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: cliente.id,
      statusAssinatura: 'pendente',
    },
    orderBy: { criadoEm: 'desc' },
    take: 5,
    select: { id: true, numero: true, criadoEm: true },
  })
  if (contratos.length === 0) {
    return `📜 ${cliente.nome}\n\nNenhum contrato pendente de assinatura.`
  }
  const lines = [`📜 ${cliente.nome} — pendentes de assinatura`, '']
  for (const c of contratos) {
    lines.push(`#${c.numero} — criado ${fmtDate(c.criadoEm)}`)
    lines.push(`Aceite: /aceitar ${c.numero}`)
    lines.push('')
  }
  return lines.join('\n')
}

async function buildAceitar(
  contractRef: string | undefined,
  ctx: BotContext,
  db: DbLike
): Promise<string> {
  if (!contractRef) {
    return 'Use: /aceitar [número-do-contrato]'
  }
  const cliente = await resolveClienteByJid(ctx, db)
  if (!cliente) {
    return 'Você não está cadastrado como cliente desta corretora.'
  }
  const contrato = await db.contrato.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: cliente.id,
      numero: contractRef,
    },
    select: { id: true, numero: true, statusAssinatura: true },
  })
  if (!contrato) {
    return `Contrato ${contractRef} não encontrado.`
  }
  if (contrato.statusAssinatura === 'assinado') {
    return `Contrato ${contrato.numero} já está assinado.`
  }
  // Verifica se já existe aceite válido
  const existente = await db.aceiteContrato.findUnique({
    where: { contratoId: contrato.id },
  })
  let token: string
  if (
    existente &&
    existente.status === 'pendente' &&
    existente.expiraEm > new Date()
  ) {
    // Não temos token cru (só hash) — gera novo e atualiza
    const fresh = gerarTokenAceite(contrato.id)
    token = fresh.token
    await db.aceiteContrato.update({
      where: { id: existente.id },
      data: { tokenHash: fresh.tokenHash, enviadoEm: new Date() },
    })
  } else {
    const fresh = gerarTokenAceite(contrato.id)
    token = fresh.token
    await db.aceiteContrato.upsert({
      where: { contratoId: contrato.id },
      create: {
        workspaceId: ctx.workspaceId,
        contratoId: contrato.id,
        tokenHash: fresh.tokenHash,
        status: 'pendente',
        expiraEm: new Date(Date.now() + 7 * 86400_000),
      },
      update: {
        tokenHash: fresh.tokenHash,
        status: 'pendente',
        expiraEm: new Date(Date.now() + 7 * 86400_000),
        enviadoEm: new Date(),
        aceitoEm: null,
        observacoesRecusa: null,
      },
    })
  }
  return [
    `📜 Contrato ${contrato.numero}`,
    '',
    'Revise e assine digitalmente:',
    `${APP_URL}/aceite/${token}`,
    '',
    'Link válido por 7 dias.',
  ].join('\n')
}

async function buildRecebiveis(ctx: BotContext, db: DbLike): Promise<string> {
  const cliente = await resolveClienteByJid(ctx, db)
  if (!cliente) {
    return 'Você não está cadastrado como cliente desta corretora.'
  }
  const boletos = await db.boleto.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: cliente.id,
      status: { in: ['aberto', 'pendente'] },
    },
    orderBy: { vencimento: 'asc' },
    take: 10,
    select: {
      numero: true,
      valor: true,
      vencimento: true,
      status: true,
      linkBoleto: true,
    },
  })
  if (boletos.length === 0) {
    return `💰 ${cliente.nome}\n\nNenhum boleto pendente.`
  }
  const lines = [`💰 ${cliente.nome} — boletos pendentes`, '']
  for (const b of boletos) {
    lines.push(
      `#${b.numero} — R$ ${fmtBRL(Number(b.valor))} · venc ${fmtDate(b.vencimento)}`
    )
    if (b.linkBoleto) lines.push(b.linkBoleto)
    lines.push('')
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Tenta extrair descrição legível do JSON `graos` de Proposta. Schema é livre
 * (Json), então acomodamos vários shapes razoáveis.
 */
function formatGraos(raw: unknown): string {
  if (!raw) return '—'
  try {
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) {
      const parts: string[] = []
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, any>
        const grao = obj.grao || obj.tipo || obj.nome
        const qtd = obj.quantidade || obj.qtd || obj.volume
        const unit = obj.unidade || obj.unit || 'sc'
        if (grao && qtd) parts.push(`${cap(String(grao))} · ${qtd} ${unit}`)
        else if (grao) parts.push(cap(String(grao)))
      }
      if (parts.length > 0) return parts.join(' + ')
    }
    if (typeof raw === 'object') {
      const obj = raw as Record<string, any>
      const grao = obj.grao || obj.tipo
      const qtd = obj.quantidade || obj.qtd || obj.volume
      const unit = obj.unidade || obj.unit || 'sc'
      if (grao && qtd) return `${cap(String(grao))} · ${qtd} ${unit}`
      if (grao) return cap(String(grao))
    }
  } catch {
    /* ignore — fallback */
  }
  return 'Grãos diversos'
}
