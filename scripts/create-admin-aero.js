const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  try {
    // Mesmo hash de Admin@123456 já gerado anteriormente
    const HASH = '$2b$10$SGpktd9FFIANxrtHGz3aCeCJMa5XWOuV3Z7.lI.VgF0eCQyQiaD92'
    const user = await p.user.upsert({
      where: { email: 'aero.gus@hotmail.com' },
      update: { senha: HASH, role: 'admin', nome: 'Gustavo (Aero)', emailVerificado: true },
      create: {
        email: 'aero.gus@hotmail.com',
        senha: HASH,
        role: 'admin',
        nome: 'Gustavo (Aero)',
        emailVerificado: true,
      },
    })
    console.log('OK user:', user.id, user.email, 'role:', user.role)

    // Adicionar ao workspace Mercograin como owner também
    const ws = await p.workspace.findUnique({ where: { slug: 'mercograin' } })
    if (ws) {
      const existing = await p.workspaceMember.findFirst({
        where: { workspaceId: ws.id, userId: user.id },
      })
      if (!existing) {
        await p.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: user.id,
            email: user.email,
            role: 'admin',
            status: 'active',
            acceptedAt: new Date(),
          },
        })
        console.log('OK workspaceMember adicionado')
      } else {
        console.log('OK workspaceMember já existia')
      }
    }
  } catch (e) {
    console.error('FAIL:', e.message)
    process.exit(1)
  } finally {
    await p.$disconnect()
  }
})()
