/**
 * Separa super-admin Mercograin da conta de cliente de teste.
 *
 * Cria/garante DUAS contas distintas:
 *
 * 1. gus@mercograin.com — SUPER-ADMIN PURO
 *    - User.role='admin'
 *    - SEM WorkspaceMember (não acessa o app cliente)
 *    - 2FA TOTP obrigatório (precisa ativar no primeiro login)
 *    - Acesso EXCLUSIVO a /admin/*
 *
 * 2. aero.gus@hotmail.com — CONTA DE TESTE (cliente normal)
 *    - User.role='user' (rebaixado de 'admin')
 *    - Continua owner do workspace Mercograin Trading
 *    - Vê tudo como um cliente vê
 *
 * Uso:
 *   DATABASE_URL=... node scripts/separate-super-admin.js
 *
 * Idempotente — pode rodar várias vezes.
 */

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// Hash de "Admin@123456" — TROQUE no primeiro login via /perfil/seguranca
const DEFAULT_HASH = '$2b$10$SGpktd9FFIANxrtHGz3aCeCJMa5XWOuV3Z7.lI.VgF0eCQyQiaD92'

async function main() {
  console.log('===========================================')
  console.log('Separando super-admin de conta de cliente')
  console.log('===========================================\n')

  // 1. Cria/atualiza super-admin puro
  const superAdmin = await p.user.upsert({
    where: { email: 'gus@mercograin.com' },
    update: { role: 'admin', emailVerificado: true },
    create: {
      email: 'gus@mercograin.com',
      senha: DEFAULT_HASH,
      role: 'admin',
      nome: 'Gus Mercograin (Super-Admin)',
      emailVerificado: true,
    },
  })
  console.log(`✓ Super-admin criado/atualizado: ${superAdmin.email} (id: ${superAdmin.id})`)

  // 2. Remove TODOS os WorkspaceMember do super-admin (estanqueidade)
  const removed = await p.workspaceMember.deleteMany({
    where: { userId: superAdmin.id },
  })
  if (removed.count > 0) {
    console.log(`✓ Removidos ${removed.count} WorkspaceMember do super-admin (estanqueidade)`)
  } else {
    console.log('✓ Super-admin já está sem WorkspaceMember (puro)')
  }

  // 3. Rebaixa aero.gus@hotmail.com (que tinha role='admin') para 'user'
  const testUser = await p.user.findUnique({
    where: { email: 'aero.gus@hotmail.com' },
    select: { id: true, role: true, email: true },
  })
  if (testUser) {
    if (testUser.role === 'admin') {
      await p.user.update({
        where: { id: testUser.id },
        data: { role: 'user' },
      })
      console.log(`✓ Conta de teste rebaixada: ${testUser.email} → role='user'`)
    } else {
      console.log(`✓ ${testUser.email} já está com role='${testUser.role}'`)
    }
  } else {
    console.log('⚠ aero.gus@hotmail.com não encontrado — pular rebaixamento')
  }

  // 4. Verifica se há OUTROS admins com workspace (anomalia)
  const anomalies = await p.user.findMany({
    where: {
      role: 'admin',
      workspaceMemberships: { some: {} },
    },
    select: { id: true, email: true, workspaceMemberships: { select: { workspaceId: true } } },
  })
  if (anomalies.length > 0) {
    console.log('\n⚠ ATENÇÃO: encontrei outros admins com workspace:')
    anomalies.forEach((a) => {
      console.log(`  - ${a.email} (${a.workspaceMemberships.length} workspaces)`)
    })
    console.log('  Decida manualmente: rebaixar pra user OU mover pra super-admin puro.')
  } else {
    console.log('\n✓ Nenhuma anomalia: todos os admins são super-admin puros')
  }

  console.log('\n===========================================')
  console.log('Próximos passos:')
  console.log('===========================================')
  console.log('1. Login em gus@mercograin.com (senha Admin@123456)')
  console.log('2. Ative 2FA em /perfil/seguranca/2fa')
  console.log('3. Acesse /admin diretamente pela URL')
  console.log('4. TROQUE a senha em /perfil/seguranca')
  console.log('')
}

main()
  .catch((e) => {
    console.error('ERRO:', e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
