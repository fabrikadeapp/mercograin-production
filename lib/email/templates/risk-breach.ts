import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface RiskBreachArgs {
  name: string
  escopo: string
  tipo: string
  valorAtual: number | string
  valorMaximo: number | string
  excedidoEm: number // %
  severidade: 'aviso' | 'breach' | 'critico'
  contexto?: string
}

function fmtNum(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!isFinite(n)) return String(v)
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function severidadeLabel(s: 'aviso' | 'breach' | 'critico'): string {
  if (s === 'critico') return 'CRÍTICO'
  if (s === 'breach') return 'BREACH'
  return 'AVISO'
}

function severidadeCor(s: 'aviso' | 'breach' | 'critico'): string {
  if (s === 'critico') return '#b91c1c'
  if (s === 'breach') return '#dc2626'
  return '#d97706'
}

export function riskBreachTemplate(args: RiskBreachArgs) {
  const name = escapeHtml(args.name || 'operador')
  const escopo = escapeHtml(args.escopo)
  const tipo = escapeHtml(args.tipo)
  const sev = severidadeLabel(args.severidade)
  const cor = severidadeCor(args.severidade)
  const valorAtual = fmtNum(args.valorAtual)
  const valorMaximo = fmtNum(args.valorMaximo)
  const excedidoPctTxt = (args.excedidoEm >= 0 ? '+' : '') + args.excedidoEm.toFixed(2) + '%'
  const contexto = escapeHtml(args.contexto || '')
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://www.profitsync.ia.br'

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá, ${name}. Um limite de risco foi <strong style="color:${cor};">${sev}</strong>.</p>
    <div style="padding:18px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0 0 6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:${COLORS.textMuted};font-weight:600;">Escopo / Tipo</p>
      <p style="margin:0 0 14px 0;font-size:15px;color:${COLORS.text};"><strong>${escopo}</strong> · ${tipo}</p>
      <p style="margin:0 0 6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:${COLORS.textMuted};font-weight:600;">Valor atual</p>
      <p style="margin:0 0 14px 0;font-size:28px;font-weight:700;color:${cor};">${valorAtual}</p>
      <p style="margin:0 0 6px 0;font-size:13px;color:${COLORS.textMuted};">Limite máximo: <strong style="color:${COLORS.text};">${valorMaximo}</strong></p>
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Excedido em: <strong style="color:${cor};">${excedidoPctTxt}</strong></p>
    </div>
    ${contexto ? `<p style="margin:0 0 14px 0;font-size:13px;color:${COLORS.textMuted};">${contexto}</p>` : ''}
    <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Acesse o painel de risco para resolver o breach.</p>
  `

  const subject = `[${sev}] Limite de risco ${escopo}/${tipo} excedido (${excedidoPctTxt})`

  const html = renderEmailLayout({
    title: subject,
    preheader: `${escopo} · ${tipo} — valor ${valorAtual} (máximo ${valorMaximo})`,
    bodyHtml,
    ctaLabel: 'Ver breaches',
    ctaUrl: `${APP_URL}/risco/breaches`,
  })

  return { subject, html, text: plainText(html) }
}
