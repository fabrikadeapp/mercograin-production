/**
 * Seed PHB Grain — admin + dados de demonstração
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const daysAgo = (n) => new Date(Date.now() - n * 86400000)
const daysAhead = (n) => new Date(Date.now() + n * 86400000)

async function main() {
  console.log('[Seed] Iniciando seed PHB Grain...')

  // ===== Admin =====
  const adminEmail = 'admin@mercograin.com'
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        nome: 'Administrador PHB Grain',
        senha: await bcrypt.hash('Admin@123456', 10),
        role: 'admin',
        emailVerificado: true,
      },
    })
    console.log(`[Seed] ✅ Admin criado: ${adminEmail} / Admin@123456`)
  } else {
    console.log(`[Seed] ℹ️  Admin já existe`)
  }

  // ===== Clientes =====
  const clientesData = [
    { nome: 'Sementes Horizonte', cnpj: '12.345.678/0001-01', uf: 'SP', cidade: 'Ribeirão Preto', tipo: 'comprador',  whatsapp: '5516999000001' },
    { nome: 'Agropecuária São João', cnpj: '12.345.678/0001-02', uf: 'PR', cidade: 'Cascavel',     tipo: 'vendedor',   whatsapp: '5545999000002' },
    { nome: 'Cooperativa Vale Verde', cnpj: '12.345.678/0001-03', uf: 'MT', cidade: 'Sorriso',     tipo: 'ambos',      whatsapp: '5566999000003' },
    { nome: 'Fazenda Boa Vista',     cnpj: '12.345.678/0001-04', uf: 'GO', cidade: 'Rio Verde',    tipo: 'vendedor',   whatsapp: '5564999000004' },
    { nome: 'Grupo Triagri',         cnpj: '12.345.678/0001-05', uf: 'RS', cidade: 'Passo Fundo',  tipo: 'comprador',  whatsapp: '5554999000005' },
    { nome: 'Tropical Grãos',        cnpj: '12.345.678/0001-06', uf: 'MT', cidade: 'Lucas do Rio Verde', tipo: 'ambos', whatsapp: '5565999000006' },
    { nome: 'Estância Três Marias',  cnpj: '12.345.678/0001-07', uf: 'MS', cidade: 'Dourados',     tipo: 'vendedor',   whatsapp: '5567999000007' },
    { nome: 'Faz. Águas Claras',     cnpj: '12.345.678/0001-08', uf: 'GO', cidade: 'Jataí',        tipo: 'vendedor',   whatsapp: '5564999000008' },
  ]

  const clientes = []
  for (const c of clientesData) {
    const cli = await prisma.cliente.upsert({
      where: { cnpj: c.cnpj },
      update: {},
      create: {
        usuarioId: admin.id,
        nome: c.nome,
        cnpj: c.cnpj,
        endereco: `${c.cidade} · ${c.uf}`,
        whatsapp: c.whatsapp,
        telefone: c.whatsapp,
        email: `contato@${c.nome.toLowerCase().replace(/[^a-z]/g, '')}.com.br`,
        tipo: c.tipo,
      },
    })
    clientes.push(cli)
  }
  console.log(`[Seed] ✅ ${clientes.length} clientes`)

  // ===== Propostas =====
  const propostasSpec = [
    { num: 'PROP-2841', cliIdx: 0, tipo: 'venda',  grao: 'soja',  qty: 12450, preco: 142.30, status: 'aceita',     daysOff: 5  },
    { num: 'PROP-2840', cliIdx: 2, tipo: 'compra', grao: 'milho', qty: 8300,  preco: 62.45,  status: 'enviada',    daysOff: 8  },
    { num: 'PROP-2839', cliIdx: 3, tipo: 'venda',  grao: 'soja',  qty: 5000,  preco: 141.80, status: 'aceita',     daysOff: 12 },
    { num: 'PROP-2838', cliIdx: 4, tipo: 'compra', grao: 'trigo', qty: 3200,  preco: 84.10,  status: 'rascunho',   daysOff: 15 },
    { num: 'PROP-2837', cliIdx: 0, tipo: 'venda',  grao: 'soja',  qty: 18700, preco: 143.10, status: 'aceita',     daysOff: 3  },
    { num: 'PROP-2836', cliIdx: 5, tipo: 'compra', grao: 'milho', qty: 4800,  preco: 62.80,  status: 'enviada',    daysOff: 20 },
    { num: 'PROP-2835', cliIdx: 6, tipo: 'venda',  grao: 'soja',  qty: 9200,  preco: 142.90, status: 'enviada',    daysOff: 25 },
    { num: 'PROP-2834', cliIdx: 7, tipo: 'venda',  grao: 'trigo', qty: 2400,  preco: 83.90,  status: 'rejeitada',  daysOff: 30 },
    { num: 'PROP-2833', cliIdx: 1, tipo: 'compra', grao: 'soja',  qty: 6500,  preco: 140.50, status: 'aceita',     daysOff: 35 },
  ]

  const propostas = []
  for (const p of propostasSpec) {
    const subtotal = Number((p.qty * p.preco).toFixed(2))
    const prop = await prisma.proposta.upsert({
      where: { numero: p.num },
      update: {},
      create: {
        numero: p.num,
        clienteId: clientes[p.cliIdx].id,
        tipo: p.tipo,
        graos: [{ grao: p.grao, quantidade: p.qty, preco: p.preco, subtotal }],
        valorTotal: subtotal,
        status: p.status,
        descricao: `${p.tipo === 'venda' ? 'Venda' : 'Compra'} de ${p.grao} safra 24/25`,
        criadaEm: daysAgo(p.daysOff + 5),
        enviadaEm: p.status !== 'rascunho' ? daysAgo(p.daysOff + 3) : null,
        validadeEm: daysAhead(15),
      },
    })
    propostas.push({ ...prop, _grao: p.grao, _qty: p.qty })
  }
  console.log(`[Seed] ✅ ${propostas.length} propostas`)

  // ===== Contratos (apenas para propostas aceitas) =====
  const contratosNumeros = ['CT-2841', 'CT-2839', 'CT-2837', 'CT-2833']
  const propsAceitas = propostas.filter((p) => p.status === 'aceita')

  for (let i = 0; i < propsAceitas.length; i++) {
    const prop = propsAceitas[i]
    const numero = contratosNumeros[i] || `CT-DEMO-${i}`
    const isAssinado = i < 3
    await prisma.contrato.upsert({
      where: { numero },
      update: {},
      create: {
        numero,
        proposIdFk: prop.id,
        clienteId: prop.clienteId,
        dataInicio: daysAgo(20 - i * 5),
        dataFim: daysAhead(60),
        statusAssinatura: isAssinado ? 'assinado' : 'pendente',
        assinadoEm: isAssinado ? daysAgo(15 - i * 3) : null,
      },
    })
  }
  console.log(`[Seed] ✅ ${propsAceitas.length} contratos`)

  // ===== Boletos =====
  const contratosCriados = await prisma.contrato.findMany({ take: 4, orderBy: { criadoEm: 'desc' } })
  const boletosSpec = [
    { contIdx: 0, valor: 412000, daysOff: 0,   status: 'aberto' },
    { contIdx: 1, valor: 312000, daysOff: 1,   status: 'aberto' },
    { contIdx: 2, valor: 580000, daysOff: 3,   status: 'aberto' },
    { contIdx: 0, valor: 318000, daysOff: 5,   status: 'aberto' },
    { contIdx: 3, valor: 198000, daysOff: 7,   status: 'aberto' },
    { contIdx: 1, valor: 234000, daysOff: -2,  status: 'vencido' },
    { contIdx: 2, valor: 1200000, daysOff: -10, status: 'pago' },
    { contIdx: 0, valor: 870000, daysOff: -25, status: 'pago' },
    { contIdx: 3, valor: 540000, daysOff: -40, status: 'pago' },
  ]

  for (let i = 0; i < boletosSpec.length; i++) {
    const b = boletosSpec[i]
    const contrato = contratosCriados[b.contIdx]
    if (!contrato) continue
    const numero = `BLT-${1000 + i}`
    await prisma.boleto.upsert({
      where: { numero },
      update: {},
      create: {
        numero,
        contratoIdFk: contrato.id,
        clienteId: contrato.clienteId,
        banco: ['itau', 'sicredi', 'bradesco'][i % 3],
        valor: b.valor,
        vencimento: daysAhead(b.daysOff),
        status: b.status,
        confirmadoEm: b.status === 'pago' ? daysAgo(Math.abs(b.daysOff) - 1) : null,
      },
    })
  }
  console.log(`[Seed] ✅ ${boletosSpec.length} boletos`)

  // ===== Cotações histórico (60 dias por grão) =====
  const grãos = [
    { grao: 'soja',  base: 142.0, vol: 4 },
    { grao: 'milho', base: 62.0,  vol: 3 },
    { grao: 'trigo', base: 84.0,  vol: 2.5 },
  ]
  const existingCot = await prisma.cotacao.count()
  if (existingCot < 60) {
    const tasks = []
    for (const g of grãos) {
      for (let d = 60; d >= 0; d--) {
        const noise = (Math.sin(d / 4) + Math.cos(d / 7)) * g.vol
        const preco = Number((g.base + noise + (60 - d) * 0.05).toFixed(2))
        tasks.push(
          prisma.cotacao.create({
            data: {
              grao: g.grao,
              fonte: 'seed',
              precoUSD: preco / 5.18,
              precoBRL: preco,
              dolarReal: 5.18,
              tipo: 'spot',
              criadaEm: daysAgo(d),
            },
          }).catch(() => null)
        )
      }
    }
    await Promise.all(tasks)
    console.log(`[Seed] ✅ ~180 cotações histórico`)
  }

  // ===== Classificados =====
  const classSpec = [
    { tipo: 'venda',  grao: 'soja',  variedade: 'em grão · Safra 24/25', vol: 12500, preco: 142.50, modal: 'FOB', cidade: 'Sorriso',         uf: 'MT', delta: 1.8 },
    { tipo: 'compra', grao: 'milho', variedade: 'amarelo · Tipo 2',      vol: 8000,  preco: 62.00,  modal: 'CIF', cidade: 'Rio Verde',       uf: 'GO', delta: -0.4 },
    { tipo: 'venda',  grao: 'trigo', variedade: 'CWAD · Premium',        vol: 3200,  preco: 84.80,  modal: 'FOB', cidade: 'Passo Fundo',     uf: 'RS', delta: 0.6 },
    { tipo: 'venda',  grao: 'soja',  variedade: 'convencional',          vol: 20000, preco: 144.10, modal: 'FOB', cidade: 'Cascavel',        uf: 'PR', delta: 2.1 },
    { tipo: 'compra', grao: 'sorgo', variedade: 'granífero',             vol: 4500,  preco: 49.20,  modal: 'CIF', cidade: 'Uberlândia',      uf: 'MG', delta: 0.3 },
    { tipo: 'venda',  grao: 'milho', variedade: 'safrinha',              vol: 15000, preco: 61.80,  modal: 'FOB', cidade: 'Lucas do Rio Verde', uf: 'MT', delta: -0.8 },
  ]
  const existingClass = await prisma.classificado.count()
  if (existingClass < classSpec.length) {
    for (const c of classSpec) {
      await prisma.classificado.create({
        data: {
          tipo: c.tipo, grao: c.grao, variedade: c.variedade, safra: '24/25',
          volumeSc: c.vol, precoSc: c.preco, modal: c.modal, cidade: c.cidade, uf: c.uf,
          deltaPct: c.delta, status: 'ativo',
          autorId: admin.id,
          expiraEm: daysAhead(30),
        },
      })
    }
    console.log(`[Seed] ✅ ${classSpec.length} classificados`)
  }

  // ===== Alertas =====
  const existingAlertas = await prisma.alertaPreco.count()
  if (existingAlertas === 0) {
    await prisma.alertaPreco.createMany({
      data: [
        { userId: admin.id, symbol: 'ZS=F',     graoLabel: 'soja',  operador: '>', preco: 145, status: 'ativo' },
        { userId: admin.id, symbol: 'ZC=F',     graoLabel: 'milho', operador: '<', preco: 60,  status: 'ativo' },
        { userId: admin.id, symbol: 'ZW=F',     graoLabel: 'trigo', operador: '>', preco: 90,  status: 'disparado', ultimoDisparo: daysAgo(1) },
        { userId: admin.id, symbol: 'USDBRL=X', graoLabel: 'usdbrl',operador: '<', preco: 5.10,status: 'ativo' },
      ],
    })
    console.log(`[Seed] ✅ 4 alertas`)
  }

  console.log('[Seed] ✅ Concluído')
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error('[Seed] ERRO:', e); await prisma.$disconnect(); process.exit(1) })
