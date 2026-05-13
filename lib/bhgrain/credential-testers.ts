/**
 * BH Grain — Testers de credenciais (conexão real).
 *
 * Cada tester tenta uma operação minimal contra o serviço externo:
 *  - Email IMAP: net.connect + STARTTLS opcional, lê greeting
 *  - Email SMTP: usa nodemailer (já instalado) com verify()
 *  - Instagram: GET /me?fields=id,name no Graph API
 *  - WhatsApp Evolution: GET /instance/connectionState/{instanceName}
 *
 * Cada tester é puro (recebe credentials, retorna {ok, message}).
 */

import * as net from 'node:net'
import * as tls from 'node:tls'

export interface TestResult {
  ok: boolean
  message: string
  latencyMs?: number
}

// ============================================================================
// EMAIL IMAP — net.connect + greeting
// ============================================================================

export async function testImap(
  host: string,
  port: number,
  user: string,
  password: string,
  useTls = true
): Promise<TestResult> {
  const start = Date.now()
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        sock.destroy()
        reject(new Error('Timeout (10s) ao conectar no IMAP'))
      }, 10_000)

      const sock = useTls
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
        : net.connect({ host, port })

      let buffer = ''
      let stage: 'greeting' | 'login' | 'done' = 'greeting'

      sock.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      sock.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
        if (stage === 'greeting' && /^\*\s+OK/i.test(buffer)) {
          stage = 'login'
          buffer = ''
          // LOGIN A1
          const safeUser = user.replace(/"/g, '\\"')
          const safePass = password.replace(/"/g, '\\"')
          sock.write(`A1 LOGIN "${safeUser}" "${safePass}"\r\n`)
        } else if (stage === 'login') {
          if (/A1 OK/i.test(buffer)) {
            stage = 'done'
            sock.write('A2 LOGOUT\r\n')
            clearTimeout(timeout)
            sock.end()
            resolve()
          } else if (/A1 (NO|BAD)/i.test(buffer)) {
            clearTimeout(timeout)
            sock.destroy()
            reject(new Error('IMAP LOGIN rejeitado (usuário/senha inválidos)'))
          }
        }
      })

      sock.on('close', () => {
        if (stage !== 'done') {
          clearTimeout(timeout)
          reject(new Error('Conexão IMAP encerrada antes do login'))
        }
      })
    })
    return { ok: true, message: 'IMAP login OK', latencyMs: Date.now() - start }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro IMAP' }
  }
}

// ============================================================================
// EMAIL SMTP — nodemailer verify()
// ============================================================================

export async function testSmtp(
  host: string,
  port: number,
  user: string,
  password: string,
  useTls = true
): Promise<TestResult> {
  const start = Date.now()
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: useTls && port === 465, // 465=SMTPS, 587=STARTTLS
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
      tls: { rejectUnauthorized: false },
    })
    await transporter.verify()
    return { ok: true, message: 'SMTP autenticado', latencyMs: Date.now() - start }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro SMTP' }
  }
}

// ============================================================================
// INSTAGRAM — GET /me via Graph API
// ============================================================================

export async function testInstagram(pageAccessToken: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10_000)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`,
      { signal: ctrl.signal }
    )
    clearTimeout(t)
    const j = (await res.json().catch(() => ({}))) as {
      id?: string
      name?: string
      instagram_business_account?: { id: string }
      error?: { message?: string; code?: number }
    }
    if (!res.ok || j.error) {
      return {
        ok: false,
        message: j.error?.message ?? `HTTP ${res.status}`,
      }
    }
    const igConnected = !!j.instagram_business_account
    return {
      ok: true,
      message: `Conectado: ${j.name ?? j.id} ${igConnected ? '· Instagram Business vinculado' : '· SEM Instagram Business vinculado'}`,
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro Graph API' }
  }
}

// ============================================================================
// WHATSAPP EVOLUTION — GET /instance/connectionState/{instance}
// ============================================================================

export async function testWhatsapp(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<TestResult> {
  const start = Date.now()
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/instance/connectionState/${encodeURIComponent(instanceName)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10_000)
    const res = await fetch(url, {
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const body = (await res.json().catch(() => ({}))) as {
      state?: string
      instance?: { state?: string; instanceName?: string }
      status?: string
    }
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status} — ${JSON.stringify(body).slice(0, 200)}` }
    }
    const state = body.state ?? body.instance?.state ?? body.status ?? 'desconhecido'
    return {
      ok: true,
      message: `Evolution conectado — instance "${instanceName}" estado: ${state}`,
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erro Evolution' }
  }
}
