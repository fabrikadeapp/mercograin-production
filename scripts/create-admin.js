const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  try {
    const HASH = '$2b$10$SGpktd9FFIANxrtHGz3aCeCJMa5XWOuV3Z7.lI.VgF0eCQyQiaD92'
    const user = await p.user.upsert({
      where: { email: 'admin@mercograin.com' },
      update: { senha: HASH, role: 'admin', nome: 'Admin Mercograin', emailVerificado: true },
      create: {
        email: 'admin@mercograin.com',
        senha: HASH,
        role: 'admin',
        nome: 'Admin Mercograin',
        emailVerificado: true,
      },
    })
    console.log('OK', user.id, user.email, user.role)
  } catch (e) {
    console.error('FAIL:', e.message)
    process.exit(1)
  } finally {
    await p.$disconnect()
  }
})()
