/* eslint-disable */
/**
 * Smoke test: persistence end-to-end of onboarding wizard data flow.
 * Bypasses HTTP — exercises the same DB writes the API does.
 *
 * Run:
 *   DATABASE_URL="..." node scripts/test-onboarding.js
 */
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const db = new PrismaClient()

const TAG = '[ONBOARDING-TEST]'
const log = (msg, data) => console.log(`${TAG} ${msg}`, data ?? '')
const err = (msg, e) => console.error(`${TAG} ✗ ${msg}`, e?.message || e)

async function main() {
  let userId, workspaceId
  const result = { steps: {} }

  try {
    // SETUP
    const email = `onb-test-${Date.now()}@phb.test`
    const user = await db.user.create({
      data: { email, senha: 'hash', nome: 'Onb Test User', role: 'user' },
    })
    userId = user.id

    const ws = await db.workspace.create({
      data: { name: 'Onb Test WS', slug: `onb-${Date.now()}`, ownerId: userId },
    })
    workspaceId = ws.id
    await db.workspaceMember.create({
      data: { workspaceId, userId, email, role: 'owner', status: 'active' },
    })
    log('Setup OK', { userId, workspaceId })

    // STEP 1 — Empresa
    const empresa = await db.dadosEmpresa.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        razaoSocial: 'Test Empresa S.A.',
        cnpj: '12.345.678/0001-90',
        cidade: 'Porto Alegre',
        uf: 'RS',
        telefone: '(51) 99999-0000',
        email: 'contato@test.empresa',
        logoUrl: 'data:image/png;base64,iVBORw0KG',
        dadosBancarios: { banco: 'Itaú', agencia: '0001', conta: '12345-6', pix: 'cnpj' },
      },
      update: {},
    })
    const empresaCheck = await db.dadosEmpresa.findUnique({ where: { workspaceId } })
    result.steps.empresa = !!(empresaCheck && empresaCheck.razaoSocial === 'Test Empresa S.A.')
    log(result.steps.empresa ? '✓ Step1 Empresa persisted' : '✗ Step1 Empresa FAILED')

    // STEP 2 — Equipe (invite)
    const inviteToken = crypto.randomBytes(24).toString('hex')
    await db.workspaceMember.create({
      data: {
        workspaceId,
        email: 'invitee@test.com',
        role: 'member',
        status: 'invited',
        inviteToken,
        invitedAt: new Date(),
      },
    })
    const memberCount = await db.workspaceMember.count({ where: { workspaceId } })
    result.steps.equipe = memberCount === 2
    log(result.steps.equipe ? '✓ Step2 Equipe persisted' : `✗ Step2 Equipe FAILED (count=${memberCount})`)

    // STEP 3 — Clientes
    await db.cliente.createMany({
      data: [
        { workspaceId, nome: 'Cliente Comprador X', tipo: 'comprador', cnpj: `00.000.001/0001-${Date.now() % 100}` },
        { workspaceId, nome: 'Cliente Vendedor Y', tipo: 'vendedor' },
      ],
    })
    const clientesCount = await db.cliente.count({ where: { workspaceId } })
    result.steps.clientes = clientesCount === 2
    log(result.steps.clientes ? '✓ Step3 Clientes persisted' : `✗ Step3 Clientes FAILED (count=${clientesCount})`)

    // STEP 4 — Fornecedores
    await db.fornecedor.createMany({
      data: [
        { workspaceId, tipo: 'transportadora', razaoSocial: 'Transportes Águia', cidade: 'Cuiabá', uf: 'MT' },
        { workspaceId, tipo: 'armazem', razaoSocial: 'Armazém Sul', cidade: 'Passo Fundo', uf: 'RS' },
      ],
    })
    const fornCount = await db.fornecedor.count({ where: { workspaceId } })
    result.steps.fornecedores = fornCount === 2
    log(result.steps.fornecedores ? '✓ Step4 Fornecedores persisted' : `✗ Step4 Fornecedores FAILED (count=${fornCount})`)

    // STEP 5 — Template
    await db.contratoTemplate.create({
      data: {
        workspaceId,
        nome: 'Compra de soja CBOT',
        tipo: 'compra',
        descricao: 'Test template',
        contentJson: { type: 'doc', content: [] },
        variaveis: ['empresa.razaoSocial', 'cliente.nome'],
        ativo: true,
        isDefault: true,
      },
    })
    const tplCount = await db.contratoTemplate.count({ where: { workspaceId } })
    result.steps.template = tplCount === 1
    log(result.steps.template ? '✓ Step5 Template persisted' : `✗ Step5 Template FAILED (count=${tplCount})`)

    // STEP 6 — Complete
    const wsBefore = await db.workspace.findUnique({ where: { id: workspaceId } })
    if (wsBefore.onboardingCompletedAt) throw new Error('Should not be completed before step 6')
    await db.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompletedAt: new Date() },
    })
    const wsAfter = await db.workspace.findUnique({ where: { id: workspaceId } })
    result.steps.complete = !!wsAfter.onboardingCompletedAt
    log(result.steps.complete ? '✓ Step6 Complete persisted' : '✗ Step6 Complete FAILED')

  } catch (e) {
    err('FATAL', e)
    result.fatal = e.message
  } finally {
    // CLEANUP
    if (workspaceId) {
      try {
        await db.workspace.delete({ where: { id: workspaceId } })
      } catch (e) { err('cleanup workspace', e) }
    }
    if (userId) {
      try {
        await db.user.delete({ where: { id: userId } })
      } catch (e) { err('cleanup user', e) }
    }
    await db.$disconnect()

    console.log(`\n${TAG} ===== RESULT =====`)
    console.log(JSON.stringify(result.steps, null, 2))
    const allPass = Object.values(result.steps).every(Boolean) && !result.fatal
    console.log(`${TAG} ${allPass ? '✅ ALL STEPS PERSIST' : '❌ FAILURES DETECTED'}`)
    process.exit(allPass ? 0 : 1)
  }
}

main()
