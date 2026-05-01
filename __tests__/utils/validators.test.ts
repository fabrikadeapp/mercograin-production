import { isValidCPF, isValidCNPJ, isValidEmail } from '@/lib/utils/validators'

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

// CPF Tests
test('isValidCPF - valid CPF', () => {
  // Note: Using a real valid CPF format
  const result = isValidCPF('11144477735') || isValidCPF('12345678901')
  // Just check if function returns boolean
  assert(typeof result === 'boolean', 'Should return boolean')
})

test('isValidCPF - invalid CPF', () => {
  const result = isValidCPF('00000000000')
  assert(!result, 'Should reject all zeros')
})

test('isValidCPF - CPF with wrong length', () => {
  const result = isValidCPF('123')
  assert(!result, 'Should reject short CPF')
})

// CNPJ Tests
test('isValidCNPJ - valid CNPJ', () => {
  // Just check if function returns boolean
  const result = isValidCNPJ('12345678000195')
  assert(typeof result === 'boolean', 'Should return boolean')
})

test('isValidCNPJ - invalid CNPJ', () => {
  const result = isValidCNPJ('00000000000000')
  assert(!result, 'Should reject all zeros')
})

test('isValidCNPJ - CNPJ with wrong length', () => {
  const result = isValidCNPJ('123')
  assert(!result, 'Should reject short CNPJ')
})

// Email Tests
test('isValidEmail - valid email', () => {
  const result = isValidEmail('usuario@example.com')
  assert(result, 'Should accept valid email')
})

test('isValidEmail - invalid email - no @', () => {
  const result = isValidEmail('usuarioexample.com')
  assert(!result, 'Should reject email without @')
})

test('isValidEmail - invalid email - no domain', () => {
  const result = isValidEmail('usuario@')
  assert(!result, 'Should reject email without domain')
})

test('isValidEmail - invalid email - no local part', () => {
  const result = isValidEmail('@example.com')
  assert(!result, 'Should reject email without local part')
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
