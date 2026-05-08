/**
 * Detecção de mercado aberto/fechado baseado em horário Brasília.
 *
 * Mercados:
 *  - CEPEA (Soja/Milho/Trigo BR à vista): dias úteis 9h-17h Brasília
 *  - B3 (futuros BR): dias úteis 9h-17h Brasília
 *  - CBOT (Chicago futuros, USD): dias úteis 11h-15h Brasília (9h-13h CT)
 *  - PTAX/USDBRL: dias úteis 9h-17h Brasília (BCB publica intraday)
 *
 * Fim de semana e feriados nacionais BR: TUDO fechado.
 *
 * Não consideramos feriados regionais nem CME extended hours por simplicidade.
 */

export type MarketKey = 'cepea' | 'b3' | 'cbot' | 'ptax'

interface MarketHours {
  /** Hora de abertura em horário Brasília (0-23) */
  openHour: number
  openMinute: number
  closeHour: number
  closeMinute: number
}

const HOURS: Record<MarketKey, MarketHours> = {
  cepea: { openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 0 },
  b3:    { openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 0 },
  cbot:  { openHour: 11, openMinute: 0, closeHour: 15, closeMinute: 30 },
  ptax:  { openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 0 },
}

/**
 * Feriados nacionais BR fixos (sem páscoa/carnaval por simplicidade).
 * Lista de strings 'MM-DD'.
 */
const FERIADOS_NACIONAIS: string[] = [
  '01-01',  // Confraternização
  '04-21',  // Tiradentes
  '05-01',  // Trabalho
  '09-07',  // Independência
  '10-12',  // Nossa Senhora
  '11-02',  // Finados
  '11-15',  // Proclamação da República
  '11-20',  // Consciência Negra (federal a partir 2024)
  '12-25',  // Natal
]

/** Pega data atual em horário de Brasília (UTC-3, ignorando horário de verão atual abolido). */
function nowInBrasilia(now = new Date()): Date {
  // Brasília não usa mais horário de verão. Offset fixo -3.
  // toLocaleString gera string mas é mais simples calcular manualmente.
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  return new Date(utcMs - 3 * 60 * 60_000)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isFeriado(d: Date): boolean {
  const key = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  return FERIADOS_NACIONAIS.includes(key)
}

function isDiaUtil(d: Date): boolean {
  const dow = d.getDay()  // 0=dom, 6=sab
  if (dow === 0 || dow === 6) return false
  if (isFeriado(d)) return false
  return true
}

export interface MarketStatus {
  /** Aberto agora (dia útil + dentro do horário) */
  open: boolean
  /** Estado: 'open' | 'closed' (resultado para UI) */
  state: 'open' | 'closed'
  /** Razão do fechamento, se fechado */
  reason?: 'fora_horario' | 'fim_de_semana' | 'feriado'
  /** Próxima abertura (ISO string Brasília convertido para UTC) — null se aberto */
  nextOpen?: string | null
  /** Última data útil (para mostrar 'fechamento de dia X') */
  lastBusinessDay: string  // 'YYYY-MM-DD'
}

/**
 * Calcula a próxima abertura: avança para o próximo dia útil às openHour:openMinute.
 */
function nextOpenAt(d: Date, hours: MarketHours): Date {
  const next = new Date(d)
  // Hoje após o horário OU dia não útil → vai para próximo dia útil
  next.setHours(hours.openHour, hours.openMinute, 0, 0)

  if (next <= d) {
    // Já passou o horário de abertura de hoje → amanhã
    next.setDate(next.getDate() + 1)
    next.setHours(hours.openHour, hours.openMinute, 0, 0)
  }

  // Avança até cair em dia útil
  while (!isDiaUtil(next)) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

/**
 * Retorna o último dia útil <= d (incluindo o próprio se for dia útil).
 */
function ultimoDiaUtil(d: Date): Date {
  const cur = new Date(d)
  cur.setHours(0, 0, 0, 0)
  while (!isDiaUtil(cur)) {
    cur.setDate(cur.getDate() - 1)
  }
  return cur
}

/**
 * Status de um mercado dado um instante (default = agora).
 */
export function marketStatus(market: MarketKey, now = new Date()): MarketStatus {
  const br = nowInBrasilia(now)
  const hours = HOURS[market]
  const dow = br.getDay()

  // Último dia útil (string)
  const lastBd = ultimoDiaUtil(br)
  const lastBusinessDay = `${lastBd.getFullYear()}-${pad2(lastBd.getMonth() + 1)}-${pad2(lastBd.getDate())}`

  // Não é dia útil
  if (dow === 0 || dow === 6) {
    return {
      open: false,
      state: 'closed',
      reason: 'fim_de_semana',
      nextOpen: nextOpenAt(br, hours).toISOString(),
      lastBusinessDay,
    }
  }
  if (isFeriado(br)) {
    return {
      open: false,
      state: 'closed',
      reason: 'feriado',
      nextOpen: nextOpenAt(br, hours).toISOString(),
      lastBusinessDay,
    }
  }

  // Dia útil — checa horário
  const minutosNow = br.getHours() * 60 + br.getMinutes()
  const minutosOpen = hours.openHour * 60 + hours.openMinute
  const minutosClose = hours.closeHour * 60 + hours.closeMinute

  if (minutosNow < minutosOpen || minutosNow >= minutosClose) {
    return {
      open: false,
      state: 'closed',
      reason: 'fora_horario',
      nextOpen: nextOpenAt(br, hours).toISOString(),
      lastBusinessDay,
    }
  }

  return {
    open: true,
    state: 'open',
    nextOpen: null,
    lastBusinessDay,
  }
}
