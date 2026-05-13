/**
 * BH Grain — Gerador automático de CommercialAlert.
 *
 * Lê estado do workspace e cria alertas idempotentes (não duplica se o mesmo
 * alerta já está aberto). Roda via cron.
 */

import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'

export type AlertCategory =
  | 'preco_vencido'
  | 'margem_baixa'
  | 'proposta_parada'
  | 'sem_resposta'
  | 'concentracao_receita'
  | 'meta_em_risco'
  | 'integracao_erro'

export interface AlertGeradorStats {
  workspaceId: string
  criados: number
  resolvidos: number
  total: number
}

const STATUS_ABERTOS = ['rascunho', 'rascunho_ia', 'pendente', 'pronta_para_enviar', 'enviada', 'em_negociacao']

/**
 * Upsert "lógico": se já existe alerta aberto com mesmo (category, relatedEntityId),
 * não cria de novo. Caso contrário, cria + notifica owners/admins se crítico.
 */
async function upsertAlert(workspaceId: string, params: {
  severity: 'critico' | 'atencao' | 'informativo'
  category: AlertCategory
  title: string
  description?: string
  relatedEntityType?: string
  relatedEntityId?: string | null
}): Promise<boolean> {
  const existing = await db.commercialAlert.findFirst({
    where: {
      workspaceId,
      status: 'aberto',
      category: params.category,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
    },
    select: { id: true },
  })
  if (existing) return false
  await db.commercialAlert.create({
    data: {
      workspaceId,
      severity: params.severity,
      category: params.category,
      title: params.title,
      description: params.description,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId ?? null,
      status: 'aberto',
    },
  })

  // Notifica owners/admins por email apenas se crítico (evita spam)
  if (params.severity === 'critico') {
    await notificarAlertaCritico(workspaceId, params).catch(() => {
      /* silencioso */
    })
  }
  return true
}

async function notificarAlertaCritico(workspaceId: string, params: {
  severity: string
  category: string
  title: string
  description?: string
}): Promise<void> {
  const destinatarios = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      status: 'active',
      role: { in: ['owner', 'admin'] },
    },
    select: { email: true },
    take: 10,
  })
  const emails = destinatarios.map((d) => d.email).filter(Boolean)
  if (emails.length === 0) return

  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } })
  const subject = `[BH Grain] Alerta crítico · ${params.title}`
  const html = `
    <p>Olá,</p>
    <p>O BH Grain detectou um <strong>alerta crítico</strong> no workspace <strong>${ws?.name ?? workspaceId}</strong>:</p>
    <blockquote style="border-left: 3px solid #ef4444; padding-left: 12px; margin: 16px 0;">
      <strong>${params.title}</strong><br>
      ${params.description ?? ''}
    </blockquote>
    <p>Acesse o dashboard para detalhes: <a href="${process.env.NEXTAUTH_URL ?? ''}/bhgrain">Abrir BH Grain</a></p>
    <p style="color:#888;font-size:11px;margin-top:24px">Categoria: ${params.category} · Severidade: crítico · Gerado automaticamente pelo sistema BH Grain</p>
  `
  await sendEmail({
    to: emails,
    subject,
    html,
    tags: [
      { name: 'product', value: 'bhgrain' },
      { name: 'severity', value: 'critico' },
      { name: 'category', value: params.category },
    ],
  })
}

export async function gerarAlertasWorkspace(workspaceId: string): Promise<AlertGeradorStats> {
  let criados = 0
  let resolvidos = 0

  const agora = new Date()
  const propostas = await db.proposta.findMany({
    where: { workspaceId, status: { in: STATUS_ABERTOS } },
    include: { cliente: { select: { id: true, nome: true } } },
    take: 500,
  })

  // 1. Preço vencido: cada proposta com validadeCotacao < agora
  for (const p of propostas) {
    if (p.validadeCotacao && p.validadeCotacao < agora) {
      const c = await upsertAlert(workspaceId, {
        severity: 'critico',
        category: 'preco_vencido',
        title: `Cotação vencida — ${p.cliente.nome}`,
        description: `Proposta ${p.numero} usa preço com validade expirada.`,
        relatedEntityType: 'Proposta',
        relatedEntityId: p.id,
      })
      if (c) criados++
    }
  }

  // 2. Margem baixa: margem < 3% (default; ideal: ler de CommercialRule)
  for (const p of propostas) {
    if (p.margemPercent != null && Number(p.margemPercent) < 3) {
      const c = await upsertAlert(workspaceId, {
        severity: 'atencao',
        category: 'margem_baixa',
        title: `Margem baixa — ${p.cliente.nome}`,
        description: `Proposta ${p.numero} com margem ${Number(p.margemPercent).toFixed(2)}%.`,
        relatedEntityType: 'Proposta',
        relatedEntityId: p.id,
      })
      if (c) criados++
    }
  }

  // 3. Proposta parada: enviada/em_negociacao há > 72h sem update
  for (const p of propostas) {
    if (!p.enviadaEm) continue
    const horas = (agora.getTime() - p.enviadaEm.getTime()) / 3600000
    if (horas > 72 && /negocia|enviada/.test(p.status.toLowerCase())) {
      const c = await upsertAlert(workspaceId, {
        severity: 'atencao',
        category: 'proposta_parada',
        title: `Proposta parada — ${p.cliente.nome}`,
        description: `Sem resposta há ${Math.round(horas)}h.`,
        relatedEntityType: 'Proposta',
        relatedEntityId: p.id,
      })
      if (c) criados++
    }
  }

  // 4. Concentração de receita: se top-2 clientes > 60% do valorTotal aberto
  const porCliente = new Map<string, { nome: string; valor: number }>()
  for (const p of propostas) {
    const cur = porCliente.get(p.cliente.id) ?? { nome: p.cliente.nome, valor: 0 }
    cur.valor += Number(p.valorTotal)
    porCliente.set(p.cliente.id, cur)
  }
  const ranked = Array.from(porCliente.entries()).sort((a, b) => b[1].valor - a[1].valor)
  const total = ranked.reduce((s, [, v]) => s + v.valor, 0)
  if (total > 0 && ranked.length >= 2) {
    const top2 = ranked[0][1].valor + ranked[1][1].valor
    const pct = (top2 / total) * 100
    if (pct > 60) {
      const c = await upsertAlert(workspaceId, {
        severity: 'atencao',
        category: 'concentracao_receita',
        title: 'Concentração de receita',
        description: `${pct.toFixed(0)}% da previsão depende de ${ranked[0][1].nome} + ${ranked[1][1].nome}.`,
        relatedEntityType: 'Goal',
      })
      if (c) criados++
    }
  }

  // 5. Meta em risco: se atingido pro-rata < esperado pro-rata - 10%
  const periodo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const metaRow = await db.metaComercial.findFirst({
    where: { workspaceId, periodo, userId: null, commodity: null },
  })
  if (metaRow && Number(metaRow.valorMeta) > 0) {
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const fechadas = await db.proposta.aggregate({
      where: {
        workspaceId,
        status: { in: ['sucesso', 'concluido', 'faturado'] },
        atualizadaEm: { gte: inicioMes },
      },
      _sum: { valorTotal: true },
    })
    const atingido = fechadas._sum.valorTotal ? Number(fechadas._sum.valorTotal) : 0
    const meta = Number(metaRow.valorMeta)
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    const diaHoje = agora.getDate()
    const esperado = (diaHoje / fimMes) * meta
    if (atingido < esperado * 0.9) {
      const c = await upsertAlert(workspaceId, {
        severity: 'atencao',
        category: 'meta_em_risco',
        title: 'Meta em risco',
        description: `Atingido R$ ${atingido.toLocaleString('pt-BR')} vs esperado R$ ${esperado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} (pro-rata).`,
        relatedEntityType: 'Goal',
      })
      if (c) criados++
    }
  }

  // 6. Resolução automática: alertas de preço_vencido cuja proposta saiu do status aberto
  const abertosPrecoVencido = await db.commercialAlert.findMany({
    where: { workspaceId, status: 'aberto', category: 'preco_vencido', relatedEntityType: 'Proposta' },
    select: { id: true, relatedEntityId: true },
  })
  const idsPropAbertas = new Set(propostas.map((p) => p.id))
  for (const a of abertosPrecoVencido) {
    if (a.relatedEntityId && !idsPropAbertas.has(a.relatedEntityId)) {
      await db.commercialAlert.update({
        where: { id: a.id },
        data: { status: 'resolvido', resolvedAt: agora, resolvedBy: 'system:auto' },
      })
      resolvidos++
    }
  }

  const totalAbertos = await db.commercialAlert.count({ where: { workspaceId, status: 'aberto' } })

  return { workspaceId, criados, resolvidos, total: totalAbertos }
}

export async function gerarAlertasTodos(): Promise<AlertGeradorStats[]> {
  // Itera apenas workspaces que tenham o BH Grain v1 implicitamente ligado.
  // Como a flag é global hoje, processa todos os workspaces ativos.
  const workspaces = await db.workspace.findMany({ select: { id: true }, take: 1000 })
  const resultados: AlertGeradorStats[] = []
  for (const w of workspaces) {
    try {
      const r = await gerarAlertasWorkspace(w.id)
      resultados.push(r)
    } catch {
      // segue para o próximo workspace
    }
  }
  return resultados
}
