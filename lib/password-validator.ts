/**
 * Password strength validation
 */

export interface PasswordStrengthResult {
  isValid: boolean
  score: number // 0-5
  feedback: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'
}

/**
 * Validate password strength
 * Score breakdown:
 * - 0-1: Weak (não atende critérios mínimos)
 * - 2: Fair (comprimento mínimo + 1 critério)
 * - 3: Good (comprimento mínimo + 2 critérios)
 * - 4: Strong (comprimento mínimo + 3 critérios)
 * - 5: Very Strong (todos os critérios)
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = []
  let score = 0

  // Check minimum length
  if (password.length < 8) {
    feedback.push('Mínimo 8 caracteres')
  } else if (password.length < 12) {
    score += 1
  } else {
    score += 2
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    feedback.push('Deve conter letras minúsculas')
  } else {
    score += 1
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    feedback.push('Deve conter letras maiúsculas')
  } else {
    score += 1
  }

  // Check for numbers
  if (!/\d/.test(password)) {
    feedback.push('Deve conter números')
  } else {
    score += 1
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Deve conter caracteres especiais (!@#$%^&* etc)')
  } else {
    score += 1
  }

  // Determine strength
  let strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'
  if (score <= 1) strength = 'weak'
  else if (score <= 2) strength = 'fair'
  else if (score <= 3) strength = 'good'
  else if (score <= 4) strength = 'strong'
  else strength = 'very-strong'

  // For production, we require at least 'good' strength
  const isValid = score >= 3

  return {
    isValid,
    score,
    feedback,
    strength,
  }
}

/**
 * Get password strength color for UI
 */
export function getPasswordStrengthColor(strength: string): string {
  switch (strength) {
    case 'weak':
      return 'text-red-600 bg-red-50'
    case 'fair':
      return 'text-orange-600 bg-orange-50'
    case 'good':
      return 'text-yellow-600 bg-yellow-50'
    case 'strong':
      return 'text-blue-600 bg-blue-50'
    case 'very-strong':
      return 'text-green-600 bg-green-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

/**
 * Get password strength bar color for progress indicator
 */
export function getPasswordStrengthBarColor(strength: string): string {
  switch (strength) {
    case 'weak':
      return 'bg-red-500'
    case 'fair':
      return 'bg-orange-500'
    case 'good':
      return 'bg-yellow-500'
    case 'strong':
      return 'bg-blue-500'
    case 'very-strong':
      return 'bg-green-500'
    default:
      return 'bg-gray-300'
  }
}
