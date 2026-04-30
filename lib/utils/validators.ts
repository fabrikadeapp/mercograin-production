import { z } from 'zod'

export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')

  if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) {
    return false
  }

  let sum = 0
  let remainder: number

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i)
  }

  remainder = (sum * 10) % 11

  if (remainder === 10 || remainder === 11) {
    remainder = 0
  }

  if (remainder !== parseInt(cleaned.substring(9, 10))) {
    return false
  }

  sum = 0

  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i)
  }

  remainder = (sum * 10) % 11

  if (remainder === 10 || remainder === 11) {
    remainder = 0
  }

  if (remainder !== parseInt(cleaned.substring(10, 11))) {
    return false
  }

  return true
}

export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '')

  if (cleaned.length !== 14 || /^(\d)\1{13}$/.test(cleaned)) {
    return false
  }

  let sum = 0
  let remainder: number
  const multiplier = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * multiplier[i]
  }

  remainder = sum % 11

  if (remainder < 2) {
    remainder = 0
  } else {
    remainder = 11 - remainder
  }

  if (remainder !== parseInt(cleaned[12])) {
    return false
  }

  sum = 0
  const multiplier2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * multiplier2[i]
  }

  remainder = sum % 11

  if (remainder < 2) {
    remainder = 0
  } else {
    remainder = 11 - remainder
  }

  if (remainder !== parseInt(cleaned[13])) {
    return false
  }

  return true
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')

  return cleaned.length === 10 || cleaned.length === 11
}

export const schemas = {
  cpf: z.string().refine(isValidCPF, { message: 'CPF inválido' }),
  cnpj: z.string().refine(isValidCNPJ, { message: 'CNPJ inválido' }),
  email: z.string().email('Email inválido'),
  phone: z.string().refine(isValidPhone, { message: 'Telefone inválido' }),
  currency: z.coerce.number().positive('Valor deve ser maior que zero'),
  date: z.coerce.date(),
  requiredString: z.string().min(1, 'Campo obrigatório'),
  optionalString: z.string().optional(),
}
