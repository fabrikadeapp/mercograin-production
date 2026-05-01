import { formatCurrency, formatDate, formatCPF, formatCNPJ } from '@/lib/utils/formatters'

// Simple test framework
interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// Tests
test('formatCurrency - positive number', () => {
  const result = formatCurrency(1234.56)
  assert(result.includes('R$'), 'Should include currency symbol')
  assert(result.includes('1.234'), 'Should format thousands')
})

test('formatCurrency - zero', () => {
  const result = formatCurrency(0)
  assert(result.includes('0'), 'Should format zero')
})

test('formatCurrency - negative number', () => {
  const result = formatCurrency(-1000)
  assert(result.includes('-'), 'Should include negative sign')
})

test('formatDate - valid date', () => {
  const date = new Date('2026-05-01')
  const result = formatDate(date)
  assert(result.includes('01'), 'Should include day')
})

test('formatCPF - valid format', () => {
  const result = formatCPF('12345678901')
  assert(result.includes('.'), 'Should include dots')
  assert(result.includes('-'), 'Should include dash')
})

test('formatCNPJ - valid format', () => {
  const result = formatCNPJ('12345678000195')
  assert(result.includes('/'), 'Should include slash')
  assert(result.includes('-'), 'Should include dash')
})

// Print results
console.log('\n📋 Test Results:')
console.log('================\n')

let passed = 0
let failed = 0

results.forEach((result) => {
  if (result.passed) {
    console.log(`✅ ${result.name}`)
    passed++
  } else {
    console.log(`❌ ${result.name}`)
    console.log(`   Error: ${result.error}`)
    failed++
  }
})

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed\n`)

process.exit(failed > 0 ? 1 : 0)
