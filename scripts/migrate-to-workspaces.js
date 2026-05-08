/**
 * Backfill: cria 1 Workspace por User existente e migra dados de
 * usuarioId/userId → workspaceId em todas as tabelas.
 *
 * Idempotente: se um user já tem workspace owned, reusa.
 *
 * Uso:
 *   DATABASE_URL="..." node scripts/migrate-to-workspaces.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32) || 'workspace'
}

async function ensureUniqueSlug(base) {
  let slug = base
  let i = 1
  // tenta base, base-2, base-3...
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.workspace.findUnique({ where: { slug } })
    if (!exists) return slug
    i += 1
    slug = `${base}-${i}`
  }
}

async function main() {
  console.log('[migrate-ws] início')

  const users = await prisma.user.findMany({
    select: { id: true, email: true, nome: true },
    orderBy: { criadoEm: 'asc' },
  })
  console.log(`[migrate-ws] users: ${users.length}`)

  let createdWs = 0
  let createdMembers = 0
  let createdEmpresa = 0

  for (const u of users) {
    // 1. Workspace owned por esse user
    let ws = await prisma.workspace.findFirst({ where: { ownerId: u.id } })
    if (!ws) {
      const baseSlug = slugify(`${u.nome || u.email || u.id}-ws`)
      const slug = await ensureUniqueSlug(baseSlug)
      ws = await prisma.workspace.create({
        data: {
          ownerId: u.id,
          name: `${u.nome || u.email} Workspace`,
          slug,
        },
      })
      createdWs += 1
    }

    // 2. WorkspaceMember owner
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_email: { workspaceId: ws.id, email: u.email } },
    }).catch(() => null)
    if (!member) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId: u.id,
          email: u.email,
          role: 'owner',
          status: 'active',
          acceptedAt: new Date(),
        },
      })
      createdMembers += 1
    }

    // 3. DadosEmpresa placeholder se não existe
    const emp = await prisma.dadosEmpresa.findUnique({
      where: { workspaceId: ws.id },
    })
    if (!emp) {
      await prisma.dadosEmpresa.create({
        data: {
          workspaceId: ws.id,
          razaoSocial: u.nome || u.email,
        },
      })
      createdEmpresa += 1
    }

    // 4. Subscription: vincula ao workspace via SQL bruto (campo userId é legado)
    await prisma.$executeRawUnsafe(
      `UPDATE "Subscription" SET "workspaceId" = $1 WHERE "userId" = $2 AND "workspaceId" IS NULL`,
      ws.id,
      u.id
    )

    // 5. Migra dados owned por esse user
    const tables = [
      ['Cliente', 'usuarioId'],
      ['Proposta', 'usuarioId'],
      ['Contrato', 'usuarioId'],
      ['Boleto', 'usuarioId'],
      ['ContratoFuturo', 'usuarioId'],
      ['AlertaPreco', 'userId'],
    ]
    for (const [tbl, col] of tables) {
      await prisma.$executeRawUnsafe(
        `UPDATE "${tbl}" SET "workspaceId" = $1 WHERE "${col}" = $2 AND "workspaceId" IS NULL`,
        ws.id,
        u.id
      )
    }

    // Classificados: usa autorId (não muda autorId — apenas associa workspace)
    await prisma.$executeRawUnsafe(
      `UPDATE "Classificado" SET "workspaceId" = $1 WHERE "autorId" = $2 AND "workspaceId" IS NULL`,
      ws.id,
      u.id
    )

    console.log(`[migrate-ws] user ${u.email} → ws ${ws.slug}`)
  }

  // Stats
  const counts = {
    workspaces: await prisma.workspace.count(),
    members: await prisma.workspaceMember.count(),
    empresas: await prisma.dadosEmpresa.count(),
    clientesMigrados: await prisma.cliente.count({ where: { workspaceId: { not: null } } }),
    propostasMigradas: await prisma.proposta.count({ where: { workspaceId: { not: null } } }),
    contratosMigrados: await prisma.contrato.count({ where: { workspaceId: { not: null } } }),
    boletosMigrados: await prisma.boleto.count({ where: { workspaceId: { not: null } } }),
    futurosMigrados: await prisma.contratoFuturo.count({ where: { workspaceId: { not: null } } }),
    alertasMigrados: await prisma.alertaPreco.count({ where: { workspaceId: { not: null } } }),
    classifMigrados: await prisma.classificado.count({ where: { workspaceId: { not: null } } }),
    subsMigradas: await prisma.subscription.count({ where: { workspaceId: { not: null } } }),
  }

  console.log('[migrate-ws] criados:', { createdWs, createdMembers, createdEmpresa })
  console.log('[migrate-ws] totais:', counts)
  console.log('[migrate-ws] OK')
}

main()
  .catch((e) => {
    console.error('[migrate-ws] erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
