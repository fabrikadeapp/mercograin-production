'use client'

/**
 * /portal/[workspaceSlug]/cadastro — página PÚBLICA de captação de lead.
 *
 * O produtor preenche e o lead cai na mesa da corretora (identificada pelo
 * slug). Sem login. Tema dark sóbrio standalone (não usa AppShell).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Corretora { nome: string; logoUrl: string | null }

export default function CadastroPublicoPage() {
  const params = useParams<{ workspaceSlug: string }>()
  const slug = params.workspaceSlug
  const [corretora, setCorretora] = useState<Corretora | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [form, setForm] = useState({
    nome: '', whatsapp: '', email: '', cidade: '', uf: '', interesse: 'vendedor', mensagem: '', website: '',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/portal/${slug}/info`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCorretora(d.corretora))
      .catch(() => setNotFound(true))
  }, [slug])

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (form.nome.trim().length < 2) { setErro('Informe seu nome'); return }
    if (!form.email && !form.whatsapp) { setErro('Informe e-mail ou WhatsApp'); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/portal/${slug}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'Não foi possível enviar')
      }
      setDone(true)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao enviar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {notFound ? (
          <div style={{ textAlign: 'center' }}>
            <div style={S.brand}>BH Grain</div>
            <p style={S.muted}>Corretora não encontrada. Verifique o link.</p>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={S.check}>✓</div>
            <h1 style={S.title}>Cadastro recebido!</h1>
            <p style={S.muted}>
              Obrigado. A equipe da {corretora?.nome ?? 'corretora'} vai entrar em contato em breve.
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {corretora?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={corretora.logoUrl} alt={corretora.nome} style={{ height: 44, margin: '0 auto 12px', objectFit: 'contain' }} />
              ) : (
                <div style={S.brand}>{corretora?.nome ?? 'BH Grain'}</div>
              )}
              <div style={S.eyebrow}>Cadastro de produtor</div>
              <h1 style={S.title}>Venda seus grãos com a {corretora?.nome ?? 'nossa mesa'}</h1>
              <p style={S.muted}>Preencha seus dados e nossa equipe entra em contato com as melhores condições.</p>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* honeypot — oculto para humanos */}
              <input type="text" name="website" value={form.website} onChange={(e) => set('website', e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden />

              <Field label="Nome completo *">
                <input style={S.input} value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Seu nome ou da fazenda" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="WhatsApp"><input style={S.input} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(00) 00000-0000" /></Field>
                <Field label="E-mail"><input style={S.input} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="opcional" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="Cidade"><input style={S.input} value={form.cidade} onChange={(e) => set('cidade', e.target.value)} placeholder="opcional" /></Field>
                <Field label="UF"><input style={S.input} maxLength={2} value={form.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} placeholder="UF" /></Field>
              </div>
              <Field label="Interesse">
                <select style={S.input} value={form.interesse} onChange={(e) => set('interesse', e.target.value)}>
                  <option value="vendedor">Quero vender grãos</option>
                  <option value="comprador">Quero comprar grãos</option>
                  <option value="ambos">Ambos</option>
                </select>
              </Field>
              <Field label="Mensagem (opcional)">
                <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }} value={form.mensagem} onChange={(e) => set('mensagem', e.target.value)} placeholder="Ex: 2.000 sc de soja para a próxima safra" />
              </Field>

              {erro && <div style={S.erro}>{erro}</div>}

              <button type="submit" disabled={loading} style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Enviando…' : 'Enviar cadastro'}
              </button>
              <p style={{ ...S.muted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                Ao enviar, você concorda em ser contatado pela {corretora?.nome ?? 'corretora'}.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9AA0AB', marginBottom: 5, fontFamily: 'monospace' }}>{label}</span>
      {children}
    </label>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'radial-gradient(1000px 500px at 80% -10%, rgba(200,240,81,0.08), transparent 60%), #0A0B0E', color: '#ECEEF2', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: 'min(440px, 100%)', background: '#14171D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' },
  brand: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 },
  eyebrow: { fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C8F051', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 8 },
  muted: { fontSize: 13.5, color: '#9AA0AB', lineHeight: 1.55 },
  input: { width: '100%', background: '#1B1F27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: '#ECEEF2', outline: 'none', fontFamily: 'inherit' },
  btn: { marginTop: 6, background: '#C8F051', color: '#0A0B0E', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer' },
  erro: { background: 'rgba(248,113,113,0.14)', color: '#F87171', fontSize: 12.5, padding: '8px 12px', borderRadius: 8 },
  check: { width: 48, height: 48, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', color: '#4ADE80', display: 'grid', placeItems: 'center', fontSize: 24, margin: '0 auto 14px' },
}
