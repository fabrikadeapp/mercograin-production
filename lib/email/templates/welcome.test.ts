/**
 * Standalone test for welcomeTemplate — runs without vitest/jest.
 * Exec: `npx tsx lib/email/templates/welcome.test.ts`
 */
import { welcomeTemplate } from './welcome'

const tests: { name: string; fn: () => void }[] = []
function test(name: string, fn: () => void) { tests.push({ name, fn }) }
function assert(cond: any, msg: string) { if (!cond) throw new Error(msg) }

test('subject contains user name', () => {
  const out = welcomeTemplate({ name: 'Gustavo' })
  assert(out.subject.includes('Gustavo'), `subject missing name: ${out.subject}`)
})

test('html contains brand + personalization', () => {
  const out = welcomeTemplate({
    name: 'Maria',
    workspaceName: 'PHB Trading',
    dashboardUrl: 'https://app.example.com/dashboard',
  })
  assert(out.html.includes('PHB Grain'), 'html missing brand')
  assert(out.html.includes('Maria'), 'html missing user name')
  assert(out.html.includes('PHB Trading'), 'html missing workspaceName')
  assert(out.html.includes('https://app.example.com/dashboard'), 'html missing dashboardUrl')
  assert(out.html.includes('Acessar painel'), 'html missing CTA label')
})

test('plain text strips HTML tags', () => {
  const out = welcomeTemplate({ name: 'Lucas' })
  assert(out.text && out.text.length > 0, 'text empty')
  assert(!/<[^>]+>/.test(out.text), 'text still contains HTML tags')
  assert(out.text.includes('PHB Grain'), 'text missing brand')
})

test('escapes HTML in name (XSS protection)', () => {
  const out = welcomeTemplate({ name: '<script>alert(1)</script>' })
  assert(!out.html.includes('<script>alert(1)</script>'), 'HTML injection not escaped')
  assert(out.html.includes('&lt;script&gt;'), 'expected escaped script tag')
})

let passed = 0, failed = 0
for (const t of tests) {
  try { t.fn(); console.log('✓', t.name); passed++ }
  catch (e: any) { console.error('✗', t.name, '—', e.message); failed++ }
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
