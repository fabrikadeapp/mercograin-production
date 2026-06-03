/**
 * Conversão server-side de TipTap JSON → HTML.
 *
 * Cobertura mínima: paragraph, heading, bullet/ordered list, listItem,
 * blockquote, codeBlock, horizontalRule, hardBreak, table, tableRow,
 * tableHeader, tableCell, text com marks (bold, italic, underline, code,
 * strike, link).
 *
 * Não usa @tiptap/html para evitar dependência adicional. Caso o editor
 * use extensions exóticas no futuro, basta adicionar branches aqui.
 */

interface Node {
  type?: string
  content?: Node[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  attrs?: Record<string, unknown>
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function applyMarks(text: string, marks: Node['marks']): string {
  if (!marks || marks.length === 0) return text
  let out = escape(text)
  for (const m of marks) {
    switch (m.type) {
      case 'bold':
      case 'strong':
        out = `<strong>${out}</strong>`
        break
      case 'italic':
      case 'em':
        out = `<em>${out}</em>`
        break
      case 'underline':
        out = `<u>${out}</u>`
        break
      case 'strike':
        out = `<s>${out}</s>`
        break
      case 'code':
        out = `<code>${out}</code>`
        break
      case 'link': {
        const href = (m.attrs?.href as string) ?? '#'
        out = `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${out}</a>`
        break
      }
    }
  }
  return out
}

export function tiptapJsonToHtml(node: Node | null | undefined): string {
  if (!node) return ''
  if (Array.isArray(node)) {
    return node.map((n) => tiptapJsonToHtml(n)).join('')
  }

  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')
    case 'paragraph': {
      const inner = (node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')
      const align = node.attrs?.textAlign as string | undefined
      const style = align ? ` style="text-align:${align}"` : ''
      return `<p${style}>${inner || '&nbsp;'}</p>`
    }
    case 'heading': {
      const lvl = Math.min(Math.max((node.attrs?.level as number) ?? 1, 1), 6)
      const inner = (node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')
      return `<h${lvl}>${inner}</h${lvl}>`
    }
    case 'bulletList':
      return `<ul>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</ul>`
    case 'orderedList':
      return `<ol>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</ol>`
    case 'listItem':
      return `<li>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</li>`
    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</blockquote>`
    case 'codeBlock':
      return `<pre><code>${escape((node.content ?? []).map((n) => n.text ?? '').join(''))}</code></pre>`
    case 'horizontalRule':
      return '<hr />'
    case 'hardBreak':
      return '<br />'
    case 'table':
      return `<table>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</table>`
    case 'tableRow':
      return `<tr>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</tr>`
    case 'tableHeader':
      return `<th>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</th>`
    case 'tableCell':
      return `<td>${(node.content ?? []).map((n) => tiptapJsonToHtml(n)).join('')}</td>`
    case 'text':
      return applyMarks(node.text ?? '', node.marks)
    default:
      // Fallback: tenta renderizar content. Se houver text bruto, escapa.
      if (node.content) {
        return node.content.map((n) => tiptapJsonToHtml(n)).join('')
      }
      if (node.text) return escape(node.text)
      return ''
  }
}
