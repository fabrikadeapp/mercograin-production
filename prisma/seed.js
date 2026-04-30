/**
 * Seed script para popular o banco com dados iniciais
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('[Seed] Iniciando seed do banco de dados...')

  // Criar usuário admin padrão
  const adminEmail = 'admin@mercograin.com'

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Admin@123456', 10)

      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          nome: 'Administrador',
          senha: hashedPassword,
          role: 'admin'
        }
      })

      console.log(`[Seed] ✅ Usuário admin criado: ${adminEmail}`)
      console.log(`[Seed] Senha padrão: Admin@123456`)
      console.log(`[Seed] ⚠️  MUDE ESTA SENHA APÓS O PRIMEIRO LOGIN`)
    } else {
      console.log(`[Seed] ℹ️  Usuário admin já existe: ${adminEmail}`)
    }
  } catch (error) {
    console.error('[Seed] Erro ao criar usuário:', error)
    throw error
  }

  console.log('[Seed] ✅ Seed concluído com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('[Seed] Erro:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
