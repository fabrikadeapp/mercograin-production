/**
 * Separa super-admin Mercograin (aero.gus@hotmail.com) de conta de teste cliente.
 *
 * Estado desejado:
 *
 * 1. aero.gus@hotmail.com — SUPER-ADMIN PURO
 *    - User.role='admin'
 *    - SEM WorkspaceMember nenhum (não acessa /bhgrain nem nada de cliente)
 *    - 2FA TOTP obrigatório no /admin (middleware força)
 *    - Acessa exclusivamente /admin/*
 *
 * 2. Workspace Mercograin Trading continua existindo, mas com OUTRO owner
 *    de teste (precisa ser informado abaixo, OWNER_EMAIL).
 *
 * Uso:
 *   DATABASE_URL=... OWNER_EMAIL=novo.owner@email.com node scripts/separate-super-admin.js
 *
 * Idempotente — pode rodar várias vezes.
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const p = new PrismaClient()

const SUPER_ADMIN_EMAIL = 'aero.gus@hotmail.com'
const NEW_OWNER_EMAIL = process.env.OWNER_EMAIL || 'gus.teste@bhgrain.com'
// Hash de "Teste@123456" — TROQUE no primeiro login do novo owner
const DEFAULT_HASH = '$2b$10$SGpktd9FFIANxrtHGz3aCeCJMa5XWOuV3Z7.lI.VgF0eCQyQiaD92'

async function main() {
  console.log('===========================================')
  console.log('Separando super-admin de conta de cliente')
  console.log('===========================================\n')

  // 1. Garante que aero.gus@hotmail.com existe e é admin global.
  // SENHA NUNCA É ALTERADA — mantém a que o usuário já configurou.
  const existing = await p.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
  let superAdmin
  if (existing) {
    superAdmin = await p.user.update({
      where: { email: SUPER_ADMIN_EMAIL },
      data: { role: 'admin', emailVerificado: true },
    })
    console.log(`✓ Super-admin já existe: ${superAdmin.email} (senha preservada)`)
  } else {
    superAdmin = await p.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        senha: DEFAULT_HASH,
        role: 'admin',
        nome: 'Gustavo (Mercograin Super-Admin)',
        emailVerificado: true,
      },
    })
    console.log(`✓ Super-admin criado: ${superAdmin.email} (senha default — TROQUE)`)
  }

  // 2. Lista todos os workspaces onde aero.gus é OWNER (Workspace.ownerId)
  const ownedWorkspaces = await p.workspace.findMany({
    where: { ownerId: superAdmin.id },
    select: { id: true, name: true, slug: true },
  })

  if (ownedWorkspaces.length > 0) {
    console.log(
      `\n⚠ ${superAdmin.email} é ownerId de ${ownedWorkspaces.length} workspace(s):`,
    )
    ownedWorkspaces.forEach((w) => console.log(`  - ${w.name} (${w.slug})`))

    // Cria ou pega o novo owner de teste
    let newOwner = await p.user.findUnique({ where: { email: NEW_OWNER_EMAIL } })
    if (!newOwner) {
      newOwner = await p.user.create({
        data: {
          email: NEW_OWNER_EMAIL,
          senha: DEFAULT_HASH,
          role: 'user',
          nome: 'Owner de Teste',
          emailVerificado: true,
          perfilCompleto: true,
        },
      })
      console.log(`\n✓ Criado novo owner de teste: ${newOwner.email} (senha: Teste@123456)`)
    } else {
      console.log(`\n✓ Owner de teste já existe: ${newOwner.email}`)
    }

    // Transfere ownerId dos workspaces para o novo owner e garante membership
    for (const ws of ownedWorkspaces) {
      await p.workspace.update({
        where: { id: ws.id },
        data: { ownerId: newOwner.id },
      })
      await p.workspaceMember.upsert({
        where: {
          workspaceId_email: { workspaceId: ws.id, email: newOwner.email },
        },
        update: {
          role: 'owner',
          status: 'active',
          userId: newOwner.id,
          acceptedAt: new Date(),
        },
        create: {
          workspaceId: ws.id,
          userId: newOwner.id,
          email: newOwner.email,
          role: 'owner',
          status: 'active',
          acceptedAt: new Date(),
          areasPermitidas: ['mesa', 'financeiro', 'fiscal', 'gestao'],
          funcoes: [],
        },
      })
      console.log(`  ✓ ${ws.name}: ownerId transferido para ${newOwner.email}`)
    }
  } else {
    console.log(`\n✓ ${superAdmin.email} não é owner de nenhum workspace`)
  }

  // 3. Remove TODOS os WorkspaceMember do super-admin (estanqueidade total)
  const removed = await p.workspaceMember.deleteMany({
    where: { userId: superAdmin.id },
  })
  if (removed.count > 0) {
    console.log(`\n✓ Removidos ${removed.count} WorkspaceMember de ${superAdmin.email}`)
  } else {
    console.log(`\n✓ ${superAdmin.email} já está sem WorkspaceMember`)
  }

  // 4. Detecta outros admins com workspace (anomalia)
  const anomalies = await p.user.findMany({
    where: {
      role: 'admin',
      workspaceMemberships: { some: {} },
      NOT: { id: superAdmin.id },
    },
    select: { id: true, email: true, workspaceMemberships: { select: { workspaceId: true } } },
  })
  if (anomalies.length > 0) {
    console.log('\n⚠ ATENÇÃO: outros admins com workspace (anomalia):')
    anomalies.forEach((a) => {
      console.log(`  - ${a.email} (${a.workspaceMemberships.length} workspace(s))`)
    })
    console.log('  Decida manualmente: rebaixar pra role=user OU virar super-admin puro.')
  } else {
    console.log('\n✓ Nenhuma anomalia: aero.gus é o único super-admin global')
  }

  console.log('\n===========================================')
  console.log('Próximos passos:')
  console.log('===========================================')
  console.log(`1. Login em ${SUPER_ADMIN_EMAIL} (senha já configurada)`)
  console.log(`2. Ativar 2FA em /perfil/seguranca/2fa (obrigatório pra /admin)`)
  console.log(`3. Acessar /admin diretamente pela URL`)
  console.log(`4. Para testar o app cliente: login em ${NEW_OWNER_EMAIL} (senha Teste@123456)`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('ERRO:', e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
