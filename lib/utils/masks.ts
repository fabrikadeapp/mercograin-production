export function maskCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  return cleaned.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  return cleaned
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '')

  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
  }

  return cleaned
}

export function maskCurrency(value: string): string {
  let cleaned = value.replace(/\D/g, '')

  if (!cleaned) return ''

  const numValue = parseInt(cleaned) / 100 || 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue)
}

export function unmaskCPF(value: string): string {
  return value.replace(/\D/g, '')
}

export function unmaskCNPJ(value: string): string {
  return value.replace(/\D/g, '')
}

export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function unmaskCurrency(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  return (parseInt(cleaned) / 100).toString()
}
