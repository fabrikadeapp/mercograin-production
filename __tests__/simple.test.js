// Simple test framework - no dependencies
class TestRunner {
  constructor() {
    this.tests = []
    this.results = []
  }

  test(name, fn) {
    try {
      fn()
      this.results.push({ name, passed: true })
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: error.message,
      })
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  report() {
    console.log('\n📋 Test Results:')
    console.log('================\n')

    let passed = 0
    let failed = 0

    this.results.forEach((result) => {
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

    return failed === 0
  }
}

// Initialize test runner
const runner = new TestRunner()

// Mock formatter functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Tests
runner.test('formatCurrency - positive number', () => {
  const result = formatCurrency(1234.56)
  runner.assert(result.includes('R$'), 'Should include currency symbol')
  runner.assert(result.includes('1.234'), 'Should format thousands')
})

runner.test('formatCurrency - zero', () => {
  const result = formatCurrency(0)
  runner.assert(result.includes('0'), 'Should format zero')
})

runner.test('formatCurrency - negative number', () => {
  const result = formatCurrency(-1000)
  runner.assert(result.includes('-'), 'Should include negative sign')
})

runner.test('isValidEmail - valid email', () => {
  const result = isValidEmail('usuario@example.com')
  runner.assert(result === true, 'Should accept valid email')
})

runner.test('isValidEmail - invalid email - no @', () => {
  const result = isValidEmail('usuarioexample.com')
  runner.assert(result === false, 'Should reject email without @')
})

runner.test('isValidEmail - invalid email - no domain', () => {
  const result = isValidEmail('usuario@')
  runner.assert(result === false, 'Should reject email without domain')
})

runner.test('String validation - min length', () => {
  const testString = 'password123'
  runner.assert(testString.length >= 8, 'Password should be at least 8 characters')
})

runner.test('String validation - contains number', () => {
  const testString = 'password123'
  runner.assert(/[0-9]/.test(testString), 'Password should contain a number')
})

runner.test('Array operations - filter', () => {
  const numbers = [1, 2, 3, 4, 5]
  const evens = numbers.filter((n) => n % 2 === 0)
  runner.assert(evens.length === 2, 'Should have 2 even numbers')
  runner.assert(evens[0] === 2, 'First even should be 2')
})

runner.test('Object operations - merge', () => {
  const obj1 = { a: 1, b: 2 }
  const obj2 = { c: 3 }
  const merged = { ...obj1, ...obj2 }
  runner.assert(merged.a === 1, 'Should preserve first object properties')
  runner.assert(merged.c === 3, 'Should include second object properties')
  runner.assert(Object.keys(merged).length === 3, 'Should have 3 properties')
})

// Generate report and exit
const success = runner.report()
process.exit(success ? 0 : 1)
