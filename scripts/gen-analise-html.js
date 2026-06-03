/**
 * Converte docs/analise/*.md para HTML standalone com estilo NewDB v2.
 * Uso: node scripts/gen-analise-html.js
 * Saída: docs/analise/*.html
 */
const fs = require('fs')
const path = require('path')
const { marked } = require('marked')

const SRC_DIR = path.join(__dirname, '..', 'docs', 'analise')

const CSS = `
:root {
  --bg: #0A0B0E;
  --bg-elev: #0E1015;
  --surface-1: #14171D;
  --surface-2: #1B1F27;
  --surface-3: #232831;
  --border: rgba(255,255,255,0.06);
  --border-strong: rgba(255,255,255,0.12);
  --text: #ECEEF2;
  --text-mute: #9AA0AB;
  --text-dim: #5C6370;
  --accent: #C8F051;
  --accent-ink: #0A0B0E;
  --accent-soft: rgba(200, 240, 81, 0.14);
  --accent-2: #7FA8FF;
  --success: #4ADE80;
  --warning: #FBBF24;
  --danger: #F87171;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
  --r-pill: 9999px;
}
@media print {
  :root {
    --bg: #ffffff; --surface-1: #f8f9fa; --surface-2: #ffffff;
    --text: #0d1117; --text-mute: #57606a; --text-dim: #6e7781;
    --border: rgba(0,0,0,0.10); --border-strong: rgba(0,0,0,0.20);
    --accent: #6f9c1d; --accent-ink: #ffffff; --accent-soft: rgba(132,170,28,0.08);
  }
  body { background: white !important; }
  .toc { display: none; }
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.65;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}
.container {
  max-width: 880px;
  margin: 0 auto;
  padding: 48px 32px 96px;
}
header.doc-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 32px;
  margin-bottom: 40px;
}
.eyebrow {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}
.brand-mark {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent) 0%, #8fd900 100%);
  display: grid;
  place-items: center;
  color: var(--accent-ink);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 15px;
}
.brand-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
h1 {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 48px;
  line-height: 1.05;
  letter-spacing: -0.025em;
  font-weight: 400;
  margin: 0 0 16px;
}
h2 {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 48px 0 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
h2:first-of-type { border-top: 0; padding-top: 0; }
h3 {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 32px 0 12px;
  color: var(--text);
}
h4 {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin: 24px 0 8px;
}
p { margin: 0 0 14px; color: var(--text-mute); }
p strong, li strong { color: var(--text); font-weight: 600; }
blockquote {
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  padding: 16px 20px;
  margin: 20px 0;
  border-radius: 0 var(--r-md) var(--r-md) 0;
  color: var(--text);
}
blockquote p { color: var(--text); margin: 0; }
blockquote p + p { margin-top: 12px; }
ul, ol { padding-left: 24px; margin: 0 0 16px; color: var(--text-mute); }
li { margin-bottom: 6px; }
li::marker { color: var(--text-dim); }
code {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 13px;
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: var(--r-sm);
  color: var(--accent);
}
pre {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 16px 20px;
  overflow-x: auto;
  margin: 20px 0;
}
pre code {
  background: transparent;
  padding: 0;
  color: var(--text);
  font-size: 12px;
  line-height: 1.55;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 13px;
  background: var(--surface-1);
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid var(--border);
}
th, td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
th {
  background: var(--surface-2);
  color: var(--text-mute);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
td { color: var(--text); }
tbody tr:hover { background: var(--surface-2); }
tbody tr:last-child td { border-bottom: 0; }
hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 40px 0;
}
a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 160ms; }
a:hover { border-bottom-color: var(--accent); }
.meta {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 8px;
}
.toc {
  position: fixed;
  top: 32px;
  right: 32px;
  width: 240px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  padding: 20px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  font-size: 12px;
}
.toc-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  margin-bottom: 12px;
}
.toc ul { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 0; }
.toc a {
  display: block;
  padding: 5px 0;
  color: var(--text-mute);
  border-bottom: 0;
  font-size: 12px;
  line-height: 1.4;
}
.toc a:hover { color: var(--accent); }
@media (max-width: 1200px) {
  .toc { display: none; }
}
footer.doc-footer {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif&display=swap');
`

function buildToc(html) {
  const headings = []
  const regex = /<h2[^>]*>(.*?)<\/h2>/gi
  let match
  let i = 0
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim()
    const id = `s${++i}`
    headings.push({ id, text })
  }
  // Re-injetar ids nos h2
  let j = 0
  const htmlWithIds = html.replace(/<h2([^>]*)>/gi, (m, attrs) => {
    j++
    return `<h2 id="s${j}"${attrs}>`
  })
  const tocHtml = headings.length
    ? `<aside class="toc">
        <div class="toc-title">Sumário</div>
        <ul>
          ${headings.map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}
        </ul>
      </aside>`
    : ''
  return { htmlWithIds, tocHtml }
}

function wrap(title, eyebrow, bodyHtml, tocHtml) {
  const now = new Date().toISOString().slice(0, 10)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — BH Grain</title>
<style>${CSS}</style>
</head>
<body>
${tocHtml}
<div class="container">
  <header class="doc-header">
    <div class="brand">
      <span class="brand-mark">B</span>
      <span class="brand-name">BH Grain · Mercograin</span>
    </div>
    <div class="eyebrow">${eyebrow}</div>
    <h1>${title}</h1>
    <p class="meta">Gerado em ${now} · Atlas (Business Analyst) · v2.0 recalibrado</p>
  </header>
  <main>
    ${bodyHtml}
  </main>
  <footer class="doc-footer">
    Documento estratégico interno — BH Grain / Mercograin · <a href="index.html">↑ Voltar ao índice</a>
  </footer>
</div>
</body>
</html>`
}

function convert(filename, title, eyebrow) {
  const srcPath = path.join(SRC_DIR, filename + '.md')
  const md = fs.readFileSync(srcPath, 'utf8')
  // Remove o H1 do markdown (vamos usar nosso header)
  const mdSemH1 = md.replace(/^#\s+.+$/m, '').replace(/^\*\*Versão:.+$/m, '')
  const rawHtml = marked.parse(mdSemH1)
  const { htmlWithIds, tocHtml } = buildToc(rawHtml)
  const fullHtml = wrap(title, eyebrow, htmlWithIds, tocHtml)
  const outPath = path.join(SRC_DIR, filename + '.html')
  fs.writeFileSync(outPath, fullHtml, 'utf8')
  console.log(`✓ ${filename}.html (${Math.round(fullHtml.length / 1024)}KB)`)
  return { filename, title, eyebrow, sizeKB: Math.round(fullHtml.length / 1024) }
}

function makeIndex(docs) {
  const now = new Date().toISOString().slice(0, 10)
  const list = docs
    .map(
      (d) => `
        <a class="doc-card" href="${d.filename}.html">
          <div class="doc-eyebrow">${d.eyebrow}</div>
          <div class="doc-title">${d.title}</div>
          <div class="doc-meta">${d.sizeKB}KB · HTML standalone</div>
          <div class="doc-cta">Abrir →</div>
        </a>`,
    )
    .join('\n')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Análise estratégica — BH Grain</title>
<style>${CSS}
.doc-grid { display: grid; gap: 16px; margin-top: 32px; }
.doc-card {
  display: block;
  padding: 24px 28px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  text-decoration: none;
  color: inherit;
  border-bottom: 0;
  transition: border-color 200ms, transform 200ms;
}
.doc-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  border-bottom: 1px solid var(--accent);
}
.doc-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 8px;
}
.doc-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.doc-meta {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 12px;
}
.doc-cta {
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
}
</style>
</head>
<body>
<div class="container">
  <header class="doc-header">
    <div class="brand">
      <span class="brand-mark">B</span>
      <span class="brand-name">BH Grain · Mercograin</span>
    </div>
    <div class="eyebrow">Análise estratégica · pre-launch</div>
    <h1>Documentos de análise.</h1>
    <p class="meta">Gerado em ${now} · v2.0 recalibrado · Atlas (Business Analyst)</p>
  </header>
  <main>
    <p>Dois documentos consolidados sobre o estado, posicionamento e potencial comercial do BH Grain. Premissas recalibradas em ${now} com churn, CAC e valuation realistas para SaaS B2B agro no Brasil 2026.</p>
    <div class="doc-grid">
      ${list}
    </div>
    <h2>Como usar</h2>
    <ul>
      <li><strong>Pitch a investidores</strong>: comece pelo Project Brief (executive summary + cenários financeiros).</li>
      <li><strong>Onboarding de sócio/vendedor</strong>: leia ambos na ordem (competitor primeiro pra contexto, depois project brief).</li>
      <li><strong>Decisão de roadmap</strong>: seção 6 (cenários) + seção 11 (asks) do Project Brief.</li>
      <li><strong>Estratégia comercial</strong>: seções 2 (concorrentes) + 5 (posicionamento) do Competitor Analysis.</li>
    </ul>
    <h2>Imprimir</h2>
    <p>Cada HTML tem estilo de impressão otimizado (fundo branco, contraste preto). Use Cmd+P (Mac) ou Ctrl+P (Windows) e salve como PDF.</p>
  </main>
  <footer class="doc-footer">
    BH Grain / Mercograin · documento interno
  </footer>
</div>
</body>
</html>`
  fs.writeFileSync(path.join(SRC_DIR, 'index.html'), html, 'utf8')
  console.log(`✓ index.html`)
}

const docs = [
  convert('project-brief', 'Project Brief', 'Documento estratégico consolidado'),
  convert('competitor-analysis', 'Análise Competitiva', 'Mapeamento de mercado e concorrência'),
]
makeIndex(docs)

console.log('\n📂 Arquivos em:', SRC_DIR)
console.log('🌐 Abrir índice: file://' + path.join(SRC_DIR, 'index.html'))
