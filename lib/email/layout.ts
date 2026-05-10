/**
 * HTML email layout — light theme, mobile-friendly, inline styles only.
 *
 * Gmail/Outlook strip <style> blocks, so EVERYTHING is inline.
 * Width capped at 600px (industry standard for email rendering).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  border: '#e5e7eb',
  accent: '#0a8a3a',
  accentDark: '#066627',
  text: '#0a0a0a',
  textMuted: '#525252',
  textFaint: '#737373',
}

export interface LayoutOpts {
  title: string
  preheader?: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
}

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="border-radius:8px;background-color:${C.accent};">
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`
}

export function renderEmailLayout(opts: LayoutOpts): string {
  const { title, preheader = '', bodyHtml, ctaLabel, ctaUrl, footerNote } = opts
  const unsubscribeMailto = `mailto:noreply@profitsync.ia.br?subject=${encodeURIComponent('Cancelar notificações')}`
  const dashboardUrl = `${APP_URL}/dashboard`
  const cta = ctaLabel && ctaUrl ? ctaButton(ctaLabel, ctaUrl) : ''
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.text};-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${C.card};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid ${C.border};">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${C.accent};vertical-align:middle;margin-right:8px;"></span>
              <span style="font-size:14px;font-weight:700;letter-spacing:0.6px;color:${C.text};vertical-align:middle;">PHB Grain</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:${C.text};font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${escapeHtml(title)}</h1>
              <div style="font-size:15px;line-height:1.6;color:${C.textMuted};">
                ${bodyHtml}
              </div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 24px 28px;border-top:1px solid ${C.border};background-color:${C.bg};">
              ${safeFooterNote ? `<p style="margin:0 0 12px 0;font-size:12px;line-height:1.5;color:${C.textFaint};">${safeFooterNote}</p>` : ''}
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:${C.textFaint};">
                <a href="${escapeHtml(dashboardUrl)}" style="color:${C.accent};text-decoration:none;font-weight:600;">Acessar painel</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(unsubscribeMailto)}" style="color:${C.textFaint};text-decoration:underline;">Cancelar notificações</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:${C.textFaint};">
                PHB Grain &middot; Mesa de operações de grãos<br/>
                © ${new Date().getFullYear()} PHB Grain. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Strip HTML tags for plain-text fallback. */
export function plainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(\n)?/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Re-export so templates can use brand colors consistently. */
export const COLORS = C
