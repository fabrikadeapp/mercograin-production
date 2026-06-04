'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2, FileText, Shield } from 'lucide-react'

interface MetaResponse {
  ok: boolean
  contrato: {
    numero: string
    clienteNome?: string
    propostaNumero?: string
    valor?: number | string
  }
  signatario: {
    nome?: string
    email?: string
    cpfCnpj?: string
    authMode: string
    jaAssinou: boolean
    assinadoEm: string | null
  }
  assinatura: {
    status: string
    totalSignatarios: number
    totalAssinados: number
    expiraEm?: string
  }
}

function formatarMoeda(v: number | string | undefined): string {
  if (v == null) return '—'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function validarCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i)
  let d1 = 11 - (s % 11)
  if (d1 > 9) d1 = 0
  if (d1 !== parseInt(c[9])) return false
  s = 0
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i)
  let d2 = 11 - (s % 11)
  if (d2 > 9) d2 = 0
  return d2 === parseInt(c[10])
}

function validarCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let s = 0
  for (let i = 0; i < 12; i++) s += parseInt(c[i]) * w1[i]
  let d1 = s % 11
  d1 = d1 < 2 ? 0 : 11 - d1
  if (d1 !== parseInt(c[12])) return false
  s = 0
  for (let i = 0; i < 13; i++) s += parseInt(c[i]) * w2[i]
  let d2 = s % 11
  d2 = d2 < 2 ? 0 : 11 - d2
  return d2 === parseInt(c[13])
}

function formatarCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function AssinarView({ token }: { token: string }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // form
  const [nome, setNome] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [li, setLi] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState<{
    protocolo: string
    assinadoEm: string
    todosAssinaram: boolean
  } | null>(null)

  useEffect(() => {
    fetch(`/api/assinar/${token}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          setErro(String(j.erro ?? 'erro_desconhecido'))
        } else {
          setMeta(j as MetaResponse)
          if (j.signatario?.nome) setNome(j.signatario.nome)
          if (j.signatario?.cpfCnpj) setCpfCnpj(formatarCpfCnpj(j.signatario.cpfCnpj))
        }
      })
      .catch(() => setErro('falha_carregar'))
      .finally(() => setLoading(false))
  }, [token])

  const cpfCnpjValido =
    cpfCnpj.replace(/\D/g, '').length <= 11
      ? validarCPF(cpfCnpj)
      : validarCNPJ(cpfCnpj)

  const podeAssinar =
    nome.trim().length >= 5 && cpfCnpjValido && li && !submitting

  const submeter = async () => {
    if (!podeAssinar) return
    setSubmitting(true)
    try {
      // Geo opcional (não força permissão)
      let geo: { lat: number; lng: number } | undefined
      try {
        if ('geolocation' in navigator) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 60_000,
            })
          )
          geo = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }
      } catch {
        /* sem geo */
      }

      const r = await fetch(`/api/assinar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeCompleto: nome.trim(),
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          liEConcordo: li,
          geo,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(String(j.erro ?? 'falha_assinar'))
        return
      }
      setSucesso({
        protocolo: String(j.protocolo ?? ''),
        assinadoEm: String(j.assinadoEm ?? new Date().toISOString()),
        todosAssinaram: !!j.todosAssinaram,
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={paginaCentralStyle}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0a8a3a' }} />
        <p style={{ color: '#666', marginTop: 12 }}>Carregando documento…</p>
      </div>
    )
  }

  if (erro) {
    const msgs: Record<string, string> = {
      invalido: 'Link inválido. Solicite à parte remetente um novo envio.',
      expirado:
        'Este link expirou. Solicite à parte remetente um novo link de assinatura.',
      cancelada:
        'A coleta de assinatura deste documento foi cancelada. Entre em contato com quem enviou.',
      nao_encontrada: 'Documento não encontrado.',
      token_revogado:
        'Este link foi revogado e não é mais válido. Solicite um novo envio.',
      signatario_invalido: 'Erro de identificação do signatário.',
      falha_carregar: 'Não foi possível carregar o documento. Tente novamente.',
    }
    return (
      <div style={paginaCentralStyle}>
        <AlertCircle className="h-12 w-12" style={{ color: '#c0392b' }} />
        <h1 style={{ color: '#1a1a1a', marginTop: 16, marginBottom: 8 }}>
          Não foi possível abrir o documento
        </h1>
        <p style={{ color: '#666', maxWidth: 440, textAlign: 'center' }}>
          {msgs[erro] ?? erro}
        </p>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div style={paginaCentralStyle}>
        <CheckCircle2 className="h-16 w-16" style={{ color: '#0a8a3a' }} />
        <h1 style={{ color: '#1a1a1a', marginTop: 16, marginBottom: 8 }}>
          Assinatura registrada!
        </h1>
        <p style={{ color: '#666', maxWidth: 500, textAlign: 'center' }}>
          {sucesso.todosAssinaram
            ? 'Todos os signatários assinaram. O documento está concluído.'
            : 'Sua assinatura foi registrada. Aguardando os demais signatários.'}
        </p>
        <div
          style={{
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 16,
            marginTop: 24,
            fontSize: 13,
            color: '#444',
          }}
        >
          <p style={{ margin: 0, marginBottom: 6 }}>
            <strong>Protocolo:</strong>{' '}
            <code style={{ fontFamily: 'monospace' }}>{sucesso.protocolo}</code>
          </p>
          <p style={{ margin: 0 }}>
            <strong>Assinado em:</strong>{' '}
            {new Date(sucesso.assinadoEm).toLocaleString('pt-BR')}
          </p>
        </div>
        <p style={{ marginTop: 24, fontSize: 12, color: '#999', textAlign: 'center' }}>
          Você pode fechar esta página. Uma confirmação foi enviada para a parte
          remetente.
        </p>
      </div>
    )
  }

  if (!meta) return null

  // Já assinou
  if (meta.signatario.jaAssinou) {
    return (
      <div style={paginaCentralStyle}>
        <CheckCircle2 className="h-12 w-12" style={{ color: '#0a8a3a' }} />
        <h1 style={{ color: '#1a1a1a', marginTop: 16, marginBottom: 8 }}>
          Você já assinou este documento
        </h1>
        <p style={{ color: '#666' }}>
          Assinado em{' '}
          {meta.signatario.assinadoEm
            ? new Date(meta.signatario.assinadoEm).toLocaleString('pt-BR')
            : '—'}
        </p>
        <p style={{ marginTop: 16, fontSize: 13, color: '#888' }}>
          Status atual: {meta.assinatura.totalAssinados} de{' '}
          {meta.assinatura.totalSignatarios} signatários
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Shield
            className="h-10 w-10 mx-auto"
            style={{ color: '#0a8a3a', marginBottom: 12 }}
          />
          <h1 style={{ color: '#1a1a1a', margin: 0, fontSize: 24 }}>
            Documento aguardando sua assinatura
          </h1>
          <p style={{ color: '#666', marginTop: 8 }}>
            Contrato <strong>{meta.contrato.numero}</strong> ·{' '}
            {meta.contrato.clienteNome}
          </p>
          <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
            Valor: {formatarMoeda(meta.contrato.valor)}
          </p>
        </div>

        {/* PDF Preview */}
        <div
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 24,
            height: 600,
          }}
        >
          <iframe
            src={`/api/assinar/${token}?pdf=1`}
            style={{ width: '100%', height: '100%', border: 0 }}
            title="Documento para assinatura"
          />
        </div>

        {/* Formulário */}
        <div
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <FileText className="h-5 w-5" style={{ color: '#0a8a3a' }} />
            <h2 style={{ margin: 0, fontSize: 18, color: '#1a1a1a' }}>
              Identificação para assinatura
            </h2>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <label>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: '#666',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Nome completo *
              </span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="João da Silva Santos"
                style={inputStyle}
              />
            </label>

            <label>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: '#666',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                CPF ou CNPJ *
              </span>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(formatarCpfCnpj(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                style={{
                  ...inputStyle,
                  borderColor:
                    cpfCnpj.length > 0 && !cpfCnpjValido ? '#c0392b' : '#ccc',
                }}
              />
              {cpfCnpj.length > 0 && !cpfCnpjValido && (
                <span style={{ color: '#c0392b', fontSize: 12 }}>
                  Documento inválido
                </span>
              )}
            </label>

            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 14,
                background: '#fbfbfb',
                border: '1px solid #eee',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={li}
                onChange={(e) => setLi(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                <strong>Li e concordo</strong> com todo o conteúdo do documento
                acima. Ao clicar em &quot;Assinar agora&quot;, manifesto minha
                vontade de aceitar suas cláusulas. Esta assinatura tem validade
                legal conforme <strong>Lei nº 14.063/2020</strong> (assinatura
                eletrônica simples). Serão registrados meu IP, dispositivo,
                horário e localização aproximada para fins de auditoria.
              </span>
            </label>

            <button
              type="button"
              onClick={submeter}
              disabled={!podeAssinar}
              style={{
                background: podeAssinar ? '#0a8a3a' : '#aaa',
                color: 'white',
                border: 0,
                borderRadius: 6,
                padding: '14px 24px',
                fontSize: 15,
                fontWeight: 600,
                cursor: podeAssinar ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Registrando assinatura…' : 'Assinar agora'}
            </button>

            <p style={{ fontSize: 11, color: '#999', textAlign: 'center', margin: 0 }}>
              Seus dados são tratados conforme a Lei Geral de Proteção de Dados
              (LGPD).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const paginaCentralStyle: React.CSSProperties = {
  background: '#f5f7fa',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
}
