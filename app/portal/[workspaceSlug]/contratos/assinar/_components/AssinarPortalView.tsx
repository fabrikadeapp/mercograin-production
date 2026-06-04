'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, FileText, Shield, LogIn, UserPlus, KeyRound, ListChecks, Lock } from 'lucide-react'

type Etapa =
  | 'carregando'
  | 'erro'
  | 'login'
  | 'signup'
  | 'esqueci-senha'
  | 'perfil'
  | 'consentimento'
  | 'assinar'
  | 'sucesso'

interface StatusResp {
  ok: true
  workspaceSlug: string
  workspaceNome: string
  contratoId: string
  contratoNumero: string
  signatario: { nome: string | null; email: string | null; telefone: string | null; jaAssinou: boolean }
  contaPortal: { existe: boolean; temSenha: boolean; perfilCompletoEm: string | null }
  proximoPasso: 'signup' | 'setup-senha' | 'login' | 'assinar-logado'
}

interface PerfilResp {
  ok: true
  perfil: Record<string, string | null>
  obrigatoriosFaltando: string[]
  completo: boolean
}

const CAMPOS_OBRIG: Array<{ key: string; label: string; tipo?: string; maxLength?: number }> = [
  { key: 'nomeCompleto', label: 'Nome completo' },
  { key: 'cpfCnpj', label: 'CPF ou CNPJ' },
  { key: 'rg', label: 'RG' },
  { key: 'nomePai', label: 'Nome do pai' },
  { key: 'nomeMae', label: 'Nome da mãe' },
  { key: 'profissao', label: 'Profissão' },
  { key: 'nacionalidade', label: 'Nacionalidade' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'enderecoCep', label: 'CEP', maxLength: 9 },
  { key: 'enderecoLogradouro', label: 'Rua/Logradouro' },
  { key: 'enderecoNumero', label: 'Número' },
  { key: 'enderecoBairro', label: 'Bairro' },
  { key: 'enderecoCidade', label: 'Cidade' },
  { key: 'enderecoUf', label: 'UF', maxLength: 2 },
]

function validarCPF(c: string): boolean {
  const d = c.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i)
  let d1 = 11 - (s % 11); if (d1 > 9) d1 = 0
  if (d1 !== parseInt(d[9])) return false
  s = 0
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i)
  let d2 = 11 - (s % 11); if (d2 > 9) d2 = 0
  return d2 === parseInt(d[10])
}
function validarCNPJ(c: string): boolean {
  const d = c.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]; const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  let s = 0; for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i]
  let r = s % 11; r = r < 2 ? 0 : 11 - r
  if (r !== parseInt(d[12])) return false
  s = 0; for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i]
  r = s % 11; r = r < 2 ? 0 : 11 - r
  return r === parseInt(d[13])
}
function formatarDoc(s: string): string {
  const d = s.replace(/\D/g, '')
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
  return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
function formatarTel(s: string): string {
  const d = s.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
function formatarCep(s: string): string {
  return s.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
}

const ERROS: Record<string, string> = {
  invalido: 'Link inválido.',
  expirado: 'Link expirou.',
  cancelada: 'Coleta de assinatura cancelada.',
  nao_encontrada: 'Documento não encontrado.',
  token_revogado: 'Link revogado.',
  conta_ja_existe_login: 'Conta existente — faça login.',
}

export function AssinarPortalView({ workspaceSlug, token }: { workspaceSlug: string; token: string }) {
  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [status, setStatus] = useState<StatusResp | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Form fields
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [emailLogin, setEmailLogin] = useState('')
  const [perfil, setPerfil] = useState<Record<string, string>>({})
  const [perfilFaltando, setPerfilFaltando] = useState<string[]>([])
  const [consent, setConsent] = useState({
    execucaoContrato: false,
    comunicacaoWhatsapp: false,
    compartilhamentoBancoCartorio: false,
    marketing: false,
  })
  const [sucesso, setSucesso] = useState<{ protocolo: string; todosAssinaram: boolean } | null>(null)

  // Inicial: pega status do portal a partir do token
  useEffect(() => {
    if (!token) {
      setErro('token_ausente')
      setEtapa('erro')
      return
    }
    ;(async () => {
      try {
        const r = await fetch(`/api/assinar/${token}/status-portal`)
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          setErro(String(j.erro ?? 'erro_desconhecido'))
          setEtapa('erro')
          return
        }
        setStatus(j)
        setEmailLogin(j.signatario?.email ?? '')
        if (j.signatario?.jaAssinou) {
          setEtapa('sucesso')
          setSucesso({ protocolo: '', todosAssinaram: false })
          return
        }
        // Já logado? Pula direto para perfil/consent/assinar.
        const me = await fetch('/api/portal/me').catch(() => null)
        if (me && me.ok) {
          await carregarPerfil()
          return
        }
        setEtapa(j.proximoPasso === 'login' ? 'login' : 'signup')
      } catch {
        setErro('falha_carregar')
        setEtapa('erro')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function carregarPerfil() {
    const r = await fetch('/api/portal/perfil')
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      setErro(String(j.error ?? 'falha_perfil'))
      setEtapa('erro')
      return
    }
    setPerfilFaltando(j.obrigatoriosFaltando ?? [])
    const inicial: Record<string, string> = {}
    for (const k of Object.keys(j.perfil ?? {})) {
      const v = j.perfil[k]
      if (v != null) inicial[k] = String(v)
    }
    if (status?.signatario?.nome && !inicial.nomeCompleto) inicial.nomeCompleto = status.signatario.nome
    if (status?.signatario?.telefone && !inicial.telefone) inicial.telefone = formatarTel(status.signatario.telefone)
    setPerfil((p) => ({ ...inicial, ...p }))
    if ((j.obrigatoriosFaltando ?? []).length > 0) setEtapa('perfil')
    else {
      // Carrega consent atual
      const rc = await fetch('/api/portal/consentimentos')
      const jc = await rc.json().catch(() => ({}))
      const arr = Array.isArray(jc.consentimentos) ? jc.consentimentos : []
      const ult: Record<string, boolean> = {}
      for (const c of arr) {
        if (c?.finalidade && typeof c.granted === 'boolean') ult[c.finalidade] = c.granted
      }
      if (ult.execucaoContrato && ult.compartilhamentoBancoCartorio) {
        setEtapa('assinar')
      } else {
        setEtapa('consentimento')
      }
    }
  }

  async function submitLogin() {
    setBusy(true)
    try {
      const r = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLogin, senha }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(String(j.error ?? 'falha_login'))
        return
      }
      setErro(null)
      await carregarPerfil()
    } finally {
      setBusy(false)
    }
  }

  async function submitSignup() {
    if (senha !== senha2) {
      setErro('senhas_diferentes')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/portal/signup-por-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(String(j.error ?? 'falha_signup'))
        if (j.error === 'conta_ja_existe_login') setEtapa('login')
        return
      }
      setErro(null)
      await carregarPerfil()
    } finally {
      setBusy(false)
    }
  }

  async function submitForgot() {
    setBusy(true)
    try {
      await fetch('/api/portal/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLogin }),
      })
      setErro('forgot_enviado')
    } finally {
      setBusy(false)
    }
  }

  async function submitPerfil() {
    // valida CPF/CNPJ
    if (perfil.cpfCnpj) {
      const ok = perfil.cpfCnpj.replace(/\D/g, '').length <= 11 ? validarCPF(perfil.cpfCnpj) : validarCNPJ(perfil.cpfCnpj)
      if (!ok) { setErro('cpf_cnpj_invalido'); return }
    }
    setBusy(true)
    try {
      const r = await fetch('/api/portal/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfil),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(String(j.error ?? 'falha_perfil'))
        return
      }
      setErro(null)
      if (j.completo) setEtapa('consentimento')
      else {
        setPerfilFaltando(j.obrigatoriosFaltando ?? [])
        setErro('faltam_campos')
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitConsent() {
    if (!consent.execucaoContrato || !consent.compartilhamentoBancoCartorio) {
      setErro('consent_obrig')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/portal/consentimentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consent),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(String(j.error ?? 'falha_consent'))
        return
      }
      setErro(null)
      setEtapa('assinar')
    } finally {
      setBusy(false)
    }
  }

  async function submitAssinar() {
    setBusy(true)
    try {
      // Coleta geo opcional
      let geo: { lat: number; lng: number } | undefined
      try {
        if ('geolocation' in navigator) {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: 60000 }),
          )
          geo = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }
      } catch { /* sem geo */ }

      const nomeCompleto = perfil.nomeCompleto || status?.signatario?.nome || ''
      const cpfCnpj = (perfil.cpfCnpj || '').replace(/\D/g, '')
      const r = await fetch(`/api/assinar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeCompleto, cpfCnpj, liEConcordo: true, geo }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(String(j.erro ?? 'falha_assinar'))
        return
      }
      setSucesso({ protocolo: String(j.protocolo ?? ''), todosAssinaram: !!j.todosAssinaram })
      setEtapa('sucesso')
    } finally {
      setBusy(false)
    }
  }

  // ---------- RENDER ----------

  if (etapa === 'carregando') {
    return (
      <div style={S.center}>
        <Loader2 className="animate-spin" style={{ color: '#0a8a3a', width: 28, height: 28 }} />
        <p style={{ color: '#666', marginTop: 12 }}>Verificando seu acesso…</p>
      </div>
    )
  }
  if (etapa === 'erro') {
    return (
      <div style={S.center}>
        <AlertCircle style={{ color: '#c0392b', width: 48, height: 48 }} />
        <h2 style={{ marginTop: 12 }}>Não foi possível abrir</h2>
        <p style={{ color: '#666', maxWidth: 440, textAlign: 'center' }}>
          {ERROS[erro ?? ''] ?? `Erro: ${erro}`}
        </p>
      </div>
    )
  }

  const headerInfo = status ? (
    <div style={S.headerInfo}>
      <Shield style={{ color: '#0a8a3a', width: 28, height: 28 }} />
      <div>
        <div style={{ fontSize: 12, color: '#666' }}>{status.workspaceNome}</div>
        <div style={{ fontWeight: 600 }}>Contrato {status.contratoNumero}</div>
      </div>
    </div>
  ) : null

  return (
    <div style={S.page}>
      <div style={S.container}>
        {headerInfo}

        {etapa === 'login' && (
          <div style={S.card}>
            <Titulo icon={<LogIn />}>Entrar no portal</Titulo>
            <p style={S.muted}>Já tem cadastro? Faça login para assinar o contrato.</p>
            <Campo label="Email">
              <input value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} type="email" style={S.input} />
            </Campo>
            <Campo label="Senha">
              <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" style={S.input} />
            </Campo>
            <Botao onClick={submitLogin} disabled={busy || senha.length < 8}>Entrar</Botao>
            <button onClick={() => setEtapa('esqueci-senha')} style={S.linkBtn}>Esqueci minha senha</button>
            <button onClick={() => setEtapa('signup')} style={S.linkBtn}>Não tenho conta — criar agora</button>
            {erro && <Erro msg={erro} />}
          </div>
        )}

        {etapa === 'signup' && (
          <div style={S.card}>
            <Titulo icon={<UserPlus />}>Criar conta</Titulo>
            <p style={S.muted}>
              Para assinar este contrato, precisamos criar seu acesso ao portal.
              Email: <strong>{status?.signatario?.email}</strong>
            </p>
            <Campo label="Senha (mín. 8 com maiúscula, minúscula e número)">
              <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" style={S.input} />
            </Campo>
            <Campo label="Confirme a senha">
              <input value={senha2} onChange={(e) => setSenha2(e.target.value)} type="password" style={S.input} />
            </Campo>
            <Botao onClick={submitSignup} disabled={busy || senha.length < 8}>Criar conta</Botao>
            <button onClick={() => setEtapa('login')} style={S.linkBtn}>Já tenho conta — entrar</button>
            {erro && <Erro msg={erro} />}
          </div>
        )}

        {etapa === 'esqueci-senha' && (
          <div style={S.card}>
            <Titulo icon={<KeyRound />}>Esqueci a senha</Titulo>
            <p style={S.muted}>Informe seu email cadastrado. Enviaremos um link para redefinir a senha (válido por 1h).</p>
            <Campo label="Email">
              <input value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} type="email" style={S.input} />
            </Campo>
            <Botao onClick={submitForgot} disabled={busy || !emailLogin}>Enviar link</Botao>
            <button onClick={() => setEtapa('login')} style={S.linkBtn}>Voltar para login</button>
            {erro === 'forgot_enviado' && (
              <div style={S.success}>Se o email existir, enviamos as instruções. Verifique sua caixa de entrada e spam.</div>
            )}
          </div>
        )}

        {etapa === 'perfil' && (
          <div style={S.card}>
            <Titulo icon={<ListChecks />}>Complete seu cadastro (1x)</Titulo>
            <p style={S.muted}>
              Esses dados são reutilizados em todos os contratos futuros — você não precisa preencher de novo.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {CAMPOS_OBRIG.map((c) => (
                <label key={c.key} style={{ gridColumn: ['nomeCompleto', 'nomePai', 'nomeMae', 'enderecoLogradouro'].includes(c.key) ? '1 / span 2' : 'auto' }}>
                  <span style={S.label}>{c.label} *</span>
                  <input
                    value={perfil[c.key] ?? ''}
                    onChange={(e) => {
                      let v = e.target.value
                      if (c.key === 'cpfCnpj') v = formatarDoc(v)
                      if (c.key === 'telefone' || c.key === 'whatsapp') v = formatarTel(v)
                      if (c.key === 'enderecoCep') v = formatarCep(v)
                      if (c.key === 'enderecoUf') v = v.toUpperCase().slice(0, 2)
                      setPerfil((p) => ({ ...p, [c.key]: v }))
                    }}
                    style={{
                      ...S.input,
                      borderColor: perfilFaltando.includes(c.key) ? '#c0392b' : '#ccc',
                    }}
                    maxLength={c.maxLength}
                  />
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
              Tratamento sob base legal art. 7º, V LGPD (execução de contrato).
            </p>
            <Botao onClick={submitPerfil} disabled={busy}>Salvar e continuar</Botao>
            {erro && <Erro msg={erro} />}
          </div>
        )}

        {etapa === 'consentimento' && (
          <div style={S.card}>
            <Titulo icon={<Shield />}>Consentimentos LGPD</Titulo>
            <p style={S.muted}>
              Conforme a Lei Geral de Proteção de Dados (LGPD), você precisa autorizar separadamente o uso dos seus dados para cada finalidade.
            </p>
            <Checkbox
              label="Execução do contrato — registro, cobrança, entrega"
              checked={consent.execucaoContrato}
              onChange={(v) => setConsent((s) => ({ ...s, execucaoContrato: v }))}
              obrigatorio
            />
            <Checkbox
              label="Compartilhamento com banco/cartório/contraparte para liquidar e registrar o contrato"
              checked={consent.compartilhamentoBancoCartorio}
              onChange={(v) => setConsent((s) => ({ ...s, compartilhamentoBancoCartorio: v }))}
              obrigatorio
            />
            <Checkbox
              label="Receber comunicações operacionais por WhatsApp/SMS (lembretes, confirmações)"
              checked={consent.comunicacaoWhatsapp}
              onChange={(v) => setConsent((s) => ({ ...s, comunicacaoWhatsapp: v }))}
            />
            <Checkbox
              label="Receber novidades e oportunidades comerciais (marketing)"
              checked={consent.marketing}
              onChange={(v) => setConsent((s) => ({ ...s, marketing: v }))}
            />
            <Botao onClick={submitConsent} disabled={busy}>Confirmar consentimentos</Botao>
            {erro && <Erro msg={erro} />}
          </div>
        )}

        {etapa === 'assinar' && status && (
          <AssinarMobileSheet
            contratoNumero={status.contratoNumero}
            workspaceNome={status.workspaceNome}
            pdfSrc={`/api/assinar/${token}?pdf=1`}
            nome={perfil.nomeCompleto || status.signatario?.nome || ''}
            cpfCnpj={perfil.cpfCnpj || ''}
            busy={busy}
            onAssinar={submitAssinar}
            erroMsg={erro}
          />
        )}

        {etapa === 'sucesso' && (
          <div style={S.card}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 style={{ color: '#0a8a3a', width: 56, height: 56 }} />
              <h2 style={{ margin: '12px 0 4px 0' }}>Assinatura registrada!</h2>
              <p style={{ color: '#666' }}>
                {sucesso?.todosAssinaram
                  ? 'Todos assinaram. O contrato está concluído.'
                  : 'Sua assinatura foi registrada. Aguardando os demais signatários.'}
              </p>
              {sucesso?.protocolo && (
                <div style={S.protocolo}>
                  <div style={{ fontSize: 12, color: '#666' }}>Protocolo</div>
                  <code style={{ fontFamily: 'monospace', fontSize: 13 }}>{sucesso.protocolo}</code>
                </div>
              )}
              <a href={`/portal/${workspaceSlug}/contratos`} style={S.linkBtnCenter}>Ir para meus contratos</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Titulo({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 0', fontSize: 18 }}>
      <span style={{ color: '#0a8a3a', display: 'inline-flex' }}>{icon}</span>
      {children}
    </h2>
  )
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  )
}
function Botao({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} type="button" style={{
      width: '100%', background: p.disabled ? '#aaa' : '#0a8a3a', color: 'white',
      border: 0, borderRadius: 6, padding: '12px 18px', fontWeight: 600, fontSize: 15,
      cursor: p.disabled ? 'not-allowed' : 'pointer', marginTop: 8,
    }}>{children}</button>
  )
}
function Erro({ msg }: { msg: string }) {
  const map: Record<string, string> = {
    senhas_diferentes: 'As senhas não conferem.',
    cpf_cnpj_invalido: 'CPF ou CNPJ inválido.',
    faltam_campos: 'Preencha os campos destacados.',
    consent_obrig: 'É preciso aceitar os consentimentos obrigatórios para assinar.',
    falha_login: 'Email ou senha incorretos.',
    forgot_enviado: '',
    conta_ja_existe_login: 'Já existe conta — clique em "Já tenho conta".',
    token_ausente: 'Link sem token.',
  }
  if (!msg || msg === 'forgot_enviado') return null
  return <div style={S.errBox}>{map[msg] ?? msg}</div>
}
function Checkbox({ label, checked, onChange, obrigatorio }: { label: string; checked: boolean; onChange: (v: boolean) => void; obrigatorio?: boolean }) {
  return (
    <label style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12,
      background: '#fafafa', border: '1px solid #eee', borderRadius: 6, marginBottom: 8, cursor: 'pointer',
    }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span style={{ fontSize: 13, color: '#333', lineHeight: 1.4 }}>
        {label} {obrigatorio && <strong style={{ color: '#c0392b' }}>(obrigatório)</strong>}
      </span>
    </label>
  )
}

const S = {
  page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 } as React.CSSProperties,
  container: { maxWidth: 720, margin: '0 auto' } as React.CSSProperties,
  center: { background: '#f5f7fa', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 } as React.CSSProperties,
  card: { background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: 24, marginBottom: 16 } as React.CSSProperties,
  headerInfo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  muted: { color: '#666', fontSize: 14, marginBottom: 16 } as React.CSSProperties,
  errBox: { background: '#fef0f0', color: '#c0392b', padding: 10, borderRadius: 6, marginTop: 12, fontSize: 13 } as React.CSSProperties,
  success: { background: '#eaf7ee', color: '#0a8a3a', padding: 12, borderRadius: 6, marginTop: 12, fontSize: 13 } as React.CSSProperties,
  linkBtn: { display: 'block', textAlign: 'center', color: '#0a8a3a', background: 'transparent', border: 0, marginTop: 12, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', width: '100%' } as React.CSSProperties,
  linkBtnCenter: { display: 'inline-block', marginTop: 16, color: '#0a8a3a', textDecoration: 'underline', fontSize: 13 } as React.CSSProperties,
  pdfBox: { border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', marginBottom: 12 } as React.CSSProperties,
  recap: { background: '#f9f9f9', padding: 12, borderRadius: 6, fontSize: 13, color: '#333', marginBottom: 8 } as React.CSSProperties,
  protocolo: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, padding: 12, marginTop: 16, display: 'inline-block' } as React.CSSProperties,
}

// ============= Mobile-first bottom sheet (L7) =============
function maskCpf(d?: string): string {
  if (!d) return ''
  const v = d.replace(/\D/g, '')
  if (v.length === 11) return `***.${v.slice(3, 6)}.${v.slice(6, 9)}-**`
  if (v.length === 14) return `**.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-**`
  return v
}

function AssinarMobileSheet(props: {
  contratoNumero: string
  workspaceNome: string
  pdfSrc: string
  nome: string
  cpfCnpj: string
  busy: boolean
  onAssinar: () => void
  erroMsg: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [vh, setVh] = useState(0)
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cores derivam do tema portal via CSS vars (funciona em light e dark)
  const sheetBg = 'var(--portal-surface, #fff)'
  const ink = 'var(--portal-ink, #18181b)'
  const inkDim = 'var(--portal-ink-mute, #71717a)'
  const accent = 'var(--portal-accent, #0a8a3a)'
  const border = 'var(--portal-border, #e4e4e7)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--portal-bg, #f4f4f5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Header curto */}
      <div
        style={{
          background: sheetBg,
          borderBottom: `1px solid ${border}`,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          color: ink,
        }}
      >
        <strong>{props.workspaceNome}</strong>
        <span style={{ color: inkDim }}>Contrato {props.contratoNumero}</span>
      </div>

      {/* PDF tela cheia */}
      <iframe
        src={props.pdfSrc}
        title="Contrato"
        style={{
          flex: 1,
          width: '100%',
          border: 0,
          background: '#000',
        }}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: sheetBg,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
          padding: '12px 18px 18px',
          maxHeight: expanded ? Math.min(vh - 60, 480) : 220,
          overflow: 'auto',
          transition: 'max-height .2s ease',
          color: ink,
        }}
      >
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: 40,
            height: 4,
            background: border,
            borderRadius: 2,
            margin: '0 auto 12px',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 15 }}>Confirmar assinatura</strong>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'transparent',
              border: 0,
              color: inkDim,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Recolher' : 'Detalhes'}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
          <div>
            <span style={{ color: accent, fontWeight: 700, marginRight: 6 }}>✓</span>
            Sou <strong>{props.nome || '—'}</strong>
          </div>
          <div>
            <span style={{ color: accent, fontWeight: 700, marginRight: 6 }}>✓</span>
            CPF {maskCpf(props.cpfCnpj)}
          </div>
          <div>
            <span style={{ color: accent, fontWeight: 700, marginRight: 6 }}>✓</span>
            Li e aceito o conteúdo do contrato (LGPD/Lei 14.063/2020)
          </div>
        </div>

        {expanded && (
          <p style={{ fontSize: 11, color: inkDim, lineHeight: 1.5, marginTop: 14 }}>
            Ao confirmar, registramos seu IP, dispositivo, horário e geolocalização
            aproximada (se permitir). Estes dados são armazenados como evidência da
            assinatura e podem ser apresentados em juízo conforme Lei nº 14.063/2020.
          </p>
        )}

        <button
          onClick={props.onAssinar}
          disabled={props.busy}
          style={{
            width: '100%',
            marginTop: 14,
            background: props.busy ? inkDim : accent,
            color: '#fff',
            padding: 14,
            border: 0,
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
            cursor: props.busy ? 'not-allowed' : 'pointer',
          }}
        >
          {props.busy ? 'Registrando…' : 'Assinar agora'}
        </button>
        {props.erroMsg && <Erro msg={props.erroMsg} />}
      </div>
    </div>
  )
}
