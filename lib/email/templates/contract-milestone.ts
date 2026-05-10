/**
 * Email para marcos de vencimento de contrato (30d/15d/7d/1d/vencido).
 */
import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export type ContractMilestone = '30d' | '15d' | '7d' | '1d' | 'vencido'

export interface ContractMilestoneArgs {
  contractNumber: string
  clienteNome: string
  dataFim: Date | string
  marco: ContractMilestone
  contractUrl: string
}

const LABEL: Record<ContractMilestone, { titulo: string; subtitulo: string }> = {
  '30d': {
    titulo: 'Contrato vence em 30 dias',
    subtitulo: 'Boa hora pra revisar entregas e pagamentos pendentes.',
  },
  '15d': {
    titulo: 'Contrato vence em 15 dias',
    subtitulo: 'Confirme com o cliente os próximos passos antes do vencimento.',
  },
  '7d': {
    titulo: 'Contrato vence em 7 dias',
    subtitulo: 'Reta final — alinhe entrega e cobrança restantes.',
  },
  '1d': {
    titulo: 'Contrato vence amanhã',
    subtitulo: 'Última chance pra revisar antes do vencimento.',
  },
  vencido: {
    titulo: 'Contrato vencido',
    subtitulo: 'Verifique pendências e considere renovação ou aditivo.',
  },
}

function fmtDate(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('pt-BR', { dateStyle: 'long' })
}

export function contractMilestoneTemplate(args: ContractMilestoneArgs) {
  const meta = LABEL[args.marco]
  const num = escapeHtml(args.contractNumber)
  const cliente = escapeHtml(args.clienteNome)
  const venc = escapeHtml(fmtDate(args.dataFim))

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${escapeHtml(meta.subtitulo)}</p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0 0 4px 0;font-size:13px;color:${COLORS.textMuted};">Contrato</p>
      <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:${COLORS.text};font-family:'SF Mono',Monaco,monospace;">${num}</p>
      <p style="margin:0 0 4px 0;font-size:13px;color:${COLORS.textMuted};">Cliente</p>
      <p style="margin:0 0 12px 0;font-size:15px;color:${COLORS.text};">${cliente}</p>
      <p style="margin:0 0 4px 0;font-size:13px;color:${COLORS.textMuted};">Vencimento</p>
      <p style="margin:0;font-size:14px;color:${COLORS.text};">${venc}</p>
    </div>
  `

  const html = renderEmailLayout({
    title: meta.titulo,
    preheader: `${meta.titulo} — ${args.contractNumber}`,
    bodyHtml,
    ctaLabel: 'Abrir contrato',
    ctaUrl: args.contractUrl,
  })

  return {
    subject: `${meta.titulo} — ${args.contractNumber}`,
    html,
    text: plainText(html),
  }
}
