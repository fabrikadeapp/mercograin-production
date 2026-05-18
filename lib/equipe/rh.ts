/**
 * Helpers RH para colaboradores — bancos, PIX, máscaras e validações
 * compartilhados entre wizard de "completar perfil" e form de convite.
 */

// Top bancos brasileiros usados em folha/PIX. "outro" é texto livre.
export const BANCOS_BR = [
  { codigo: '341', nome: 'Itaú' },
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '380', nome: 'PicPay' },
] as const

export const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Conta Poupança' },
  { value: 'pagamento', label: 'Conta Pagamento' },
] as const

export const TIPOS_PIX = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
] as const

export type PixTipo = (typeof TIPOS_PIX)[number]['value']

// ----------------------------------------------------------------------------
// Máscaras
// ----------------------------------------------------------------------------

export function maskCPF(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function maskTelefone(v: string): string {
  // (99) 9 9999-9999 — 11 dígitos (celular)
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1')
  if (d.length <= 3) return d.replace(/^(\d{2})(\d{0,1})/, '($1) $2')
  if (d.length <= 7) return d.replace(/^(\d{2})(\d{1})(\d{0,4})/, '($1) $2 $3')
  return d.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4')
}

export function maskCEP(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

export function maskRG(v: string): string {
  // RG não tem padrão único; mantemos só alfanumérico e limita 14
  return v.replace(/[^0-9A-Za-z]/g, '').slice(0, 14).toUpperCase()
}

export function maskPIS(v: string): string {
  // PIS/PASEP/NIS: 11 dígitos, formato 000.00000.00-0
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 8) return d.replace(/^(\d{3})(\d{0,5})/, '$1.$2')
  if (d.length <= 10) return d.replace(/^(\d{3})(\d{5})(\d{0,2})/, '$1.$2.$3')
  return d.replace(/^(\d{3})(\d{5})(\d{2})(\d{0,1})/, '$1.$2.$3-$4')
}

// ----------------------------------------------------------------------------
// Validações
// ----------------------------------------------------------------------------

/**
 * Valida formato da chave PIX. Não consulta DICT (precisaria credencial PIX),
 * só checa que a chave tem formato plausível para o tipo informado.
 */
export function isValidPixKey(tipo: PixTipo, chave: string): boolean {
  const v = chave.trim()
  if (!v) return false
  switch (tipo) {
    case 'cpf': {
      const d = v.replace(/\D/g, '')
      return d.length === 11
    }
    case 'cnpj': {
      const d = v.replace(/\D/g, '')
      return d.length === 14
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    case 'telefone': {
      const d = v.replace(/\D/g, '')
      return d.length === 10 || d.length === 11 || d.length === 13 // com DDI
    }
    case 'aleatoria':
      // UUID v4 (formato padrão de chave aleatória PIX)
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  }
}

export function isValidTelefoneBR(v: string): boolean {
  const d = v.replace(/\D/g, '')
  return d.length === 10 || d.length === 11
}

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

// ----------------------------------------------------------------------------
// Tipos de payload (compartilhados client/server)
// ----------------------------------------------------------------------------

export interface DadosBancariosColaborador {
  banco: string // código ou nome livre
  bancoNome: string
  agencia: string
  conta: string
  tipo: 'corrente' | 'poupanca' | 'pagamento'
  titular: string
  pix: string
  pixTipo: PixTipo | ''
}
