/**
 * Pix BR Code — padrão EMV TLV (BCB / FEBRABAN).
 *
 * Referência: Manual de Padrões para Iniciação do Pix — BCB.
 * Formato: cada campo = ID(2) + LEN(2) + VALUE. Final inclui campo 63 CRC16.
 *
 * Campos:
 *   - 00: Payload Format Indicator ("01")
 *   - 01: Point of Initiation Method ("11" estático, "12" dinâmico). Quando
 *         valor é fixo / txid presente, usar 12.
 *   - 26: Merchant Account Info (Pix) — sub-tags:
 *         00 = GUI "BR.GOV.BCB.PIX"
 *         01 = chave Pix
 *         02 = info adicional (opcional)
 *   - 52: Merchant Category Code ("0000")
 *   - 53: Currency ("986" = BRL ISO4217)
 *   - 54: Transaction Amount (opcional)
 *   - 58: Country Code ("BR")
 *   - 59: Merchant Name (≤25 chars)
 *   - 60: Merchant City (≤15 chars)
 *   - 62: Additional Data Field — sub-tag 05 = txid (≤25 chars)
 *   - 63: CRC16-CCITT (poly 0x1021, init 0xFFFF), 4 chars hex uppercase
 */

export interface GerarPixInput {
  chave: string
  beneficiarioNome: string
  beneficiarioCidade: string
  valor?: number
  txid?: string
  infoAdicional?: string
}

export interface GerarPixOutput {
  payload: string
  checksum: string
}

/**
 * CRC16-CCITT (poly 0x1021, init 0xFFFF) — algoritmo oficial BCB.
 * Retorna string hex de 4 chars uppercase.
 */
export function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function sanitize(s: string, maxLen: number): string {
  // remove acentos + caracteres não-ASCII
  const norm = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
  return norm.slice(0, maxLen)
}

export function gerarPixBRCode(input: GerarPixInput): GerarPixOutput {
  const { chave, beneficiarioNome, beneficiarioCidade, valor, txid, infoAdicional } =
    input

  if (!chave) throw new Error('Pix: chave obrigatória')
  if (!beneficiarioNome) throw new Error('Pix: beneficiarioNome obrigatório')
  if (!beneficiarioCidade) throw new Error('Pix: beneficiarioCidade obrigatório')

  const nome = sanitize(beneficiarioNome, 25)
  const cidade = sanitize(beneficiarioCidade, 15)
  const txidSan = txid ? sanitize(txid, 25).replace(/[^A-Za-z0-9]/g, '') : '***'

  // Merchant Account Info (26)
  let mai = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave)
  if (infoAdicional) {
    mai += tlv('02', sanitize(infoAdicional, 72))
  }

  const payloadParts: string[] = []
  payloadParts.push(tlv('00', '01'))
  // Static (sem txid e sem valor) vs dynamic. Usamos 12 quando txid é informado.
  payloadParts.push(tlv('01', txid ? '12' : '11'))
  payloadParts.push(tlv('26', mai))
  payloadParts.push(tlv('52', '0000'))
  payloadParts.push(tlv('53', '986'))
  if (typeof valor === 'number' && valor > 0) {
    payloadParts.push(tlv('54', valor.toFixed(2)))
  }
  payloadParts.push(tlv('58', 'BR'))
  payloadParts.push(tlv('59', nome))
  payloadParts.push(tlv('60', cidade))
  payloadParts.push(tlv('62', tlv('05', txidSan)))

  // CRC: calcular sobre payload + "6304"
  const base = payloadParts.join('') + '6304'
  const checksum = crc16(base)
  const payload = base + checksum

  return { payload, checksum }
}
