/**
 * Seed de dados ficcionais realistas pra demo do PHB Grain à corretora piloto MercoGrain.
 *
 * IDEMPOTENTE — rodar 2x não duplica entries (detecta via número/cnpj).
 *
 * Uso (com DATABASE_PUBLIC_URL apontando pra prod):
 *   DATABASE_URL=$DATABASE_PUBLIC_URL npx tsx scripts/seed-mercograin-demo.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const ADMIN_EMAIL = 'admin@mercograin.com'

const CLIENTES = [
  {
    nome: 'Cooperativa Agropecuária Vale Verde',
    tipo: 'vendedor',
    cnpj: '11.222.333/0001-44',
    email: 'comercial@cooperativavaleverde.com.br',
    telefone: '(46) 3522-1100',
    whatsapp: '5546999889977',
    endereco: 'Rodovia BR-277 KM 510, Pato Branco/PR · CEP 85501-000',
  },
  {
    nome: 'Fazenda Bela Vista LTDA',
    tipo: 'vendedor',
    cnpj: '22.333.444/0001-55',
    email: 'admin@fazendabelavista.com.br',
    telefone: '(67) 3421-5500',
    whatsapp: '5567988774455',
    endereco: 'Rod. MS-376, KM 28, Dourados/MS · CEP 79806-340',
  },
  {
    nome: 'Agropecuária Santa Helena',
    tipo: 'vendedor',
    cnpj: '33.444.555/0001-66',
    email: 'contato@agropecuariastahelena.com.br',
    telefone: '(65) 3531-2200',
    whatsapp: '5565991122334',
    endereco: 'Av. Brasília 1450, Sinop/MT · CEP 78550-000',
  },
  {
    nome: 'João Pedro Ramires',
    tipo: 'vendedor',
    cnpj: null, // PF — sem CNPJ
    email: 'jp.ramires@gmail.com',
    telefone: '(54) 9 9988-7766',
    whatsapp: '5554999887766',
    endereco: 'Linha São Roque, Erechim/RS · CEP 99700-000',
  },
  {
    nome: 'Cooperativa Triticola Mista',
    tipo: 'vendedor',
    cnpj: '44.555.666/0001-77',
    email: 'cotacoes@coopertritis.coop.br',
    telefone: '(55) 3322-7700',
    whatsapp: '5555998877665',
    endereco: 'Av. Independência 980, Ijuí/RS · CEP 98700-000',
  },
] as const

const FORNECEDORES = [
  {
    tipo: 'outros',
    razaoSocial: 'COFCO International Brasil S.A.',
    nomeFantasia: 'COFCO',
    cnpj: '55.666.777/0001-88',
    email: 'compras@cofco.com.br',
    telefone: '(11) 3251-7000',
    cidade: 'São Paulo',
    uf: 'SP',
    observacao: 'Indústria compradora · soja e milho',
  },
  {
    tipo: 'outros',
    razaoSocial: 'Cargill Agrícola S.A.',
    nomeFantasia: 'Cargill',
    cnpj: '66.777.888/0001-99',
    email: 'originacao@cargill.com.br',
    telefone: '(11) 5099-3500',
    cidade: 'São Paulo',
    uf: 'SP',
    observacao: 'Indústria compradora · originação grãos',
  },
] as const

async function main() {
  console.log('🌾 Seed MercoGrain Demo iniciado\n')

  // 1. Localizar workspace de admin@mercograin.com
  const adminUser = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, nome: true },
  })
  if (!adminUser) {
    console.error(`❌ User ${ADMIN_EMAIL} não encontrado`)
    process.exit(1)
  }

  let workspace = await db.workspace.findFirst({
    where: { ownerId: adminUser.id },
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) {
    console.error(`❌ Workspace não encontrado pra ${ADMIN_EMAIL}`)
    process.exit(1)
  }

  console.log(`👤 User: ${adminUser.email}`)
  console.log(`📦 Workspace: ${workspace.name} (${workspace.id})\n`)

  // 2. Renomear workspace pra MercoGrain Corretora
  if (workspace.name !== 'MercoGrain Corretora') {
    workspace = await db.workspace.update({
      where: { id: workspace.id },
      data: { name: 'MercoGrain Corretora' },
    })
    console.log(`✏️  Workspace renomeado pra "MercoGrain Corretora"`)
  }

  const wsId = workspace.id

  // 3. CLIENTES (idempotente por cnpj OU nome+workspaceId)
  const clientesIds: Record<string, string> = {}
  for (const c of CLIENTES) {
    const existing = await db.cliente.findFirst({
      where: {
        workspaceId: wsId,
        OR: c.cnpj ? [{ cnpj: c.cnpj }, { nome: c.nome }] : [{ nome: c.nome }],
      },
    })
    if (existing) {
      const updated = await db.cliente.update({
        where: { id: existing.id },
        data: {
          tipo: c.tipo,
          email: c.email,
          telefone: c.telefone,
          whatsapp: c.whatsapp,
          endereco: c.endereco,
          ativo: true,
        },
      })
      clientesIds[c.nome] = updated.id
      console.log(`✓ Cliente atualizado: ${c.nome}`)
    } else {
      const created = await db.cliente.create({
        data: {
          workspaceId: wsId,
          nome: c.nome,
          tipo: c.tipo,
          cnpj: c.cnpj,
          email: c.email,
          telefone: c.telefone,
          whatsapp: c.whatsapp,
          endereco: c.endereco,
          ativo: true,
        },
      })
      clientesIds[c.nome] = created.id
      console.log(`+ Cliente criado: ${c.nome}`)
    }
  }

  // 4. FORNECEDORES (idempotente por cnpj)
  for (const f of FORNECEDORES) {
    const existing = await db.fornecedor.findFirst({
      where: { workspaceId: wsId, cnpj: f.cnpj },
    })
    if (existing) {
      await db.fornecedor.update({
        where: { id: existing.id },
        data: {
          tipo: f.tipo,
          razaoSocial: f.razaoSocial,
          nomeFantasia: f.nomeFantasia,
          email: f.email,
          telefone: f.telefone,
          cidade: f.cidade,
          uf: f.uf,
          observacao: f.observacao,
          ativo: true,
        },
      })
      console.log(`✓ Fornecedor atualizado: ${f.razaoSocial}`)
    } else {
      await db.fornecedor.create({
        data: {
          workspaceId: wsId,
          tipo: f.tipo,
          razaoSocial: f.razaoSocial,
          nomeFantasia: f.nomeFantasia,
          cnpj: f.cnpj,
          email: f.email,
          telefone: f.telefone,
          cidade: f.cidade,
          uf: f.uf,
          observacao: f.observacao,
          ativo: true,
        },
      })
      console.log(`+ Fornecedor criado: ${f.razaoSocial}`)
    }
  }

  // 5. PROPOSTAS — 3 estágios diferentes (idempotente por numero único)
  const now = new Date()
  const PROPOSTAS = [
    {
      numero: 'PRP-DEMO-001',
      clienteId: clientesIds['Cooperativa Agropecuária Vale Verde'],
      tipo: 'compra',
      graos: [{ grao: 'soja', quantidadeSc: 1500, precoSc: 145.0 }],
      valorTotal: 1500 * 145.0,
      status: 'rascunho',
      descricao: 'Soja safra 2025/26 · Paranaguá',
      validadeEm: new Date(now.getTime() + 7 * 24 * 3600_000),
      criadaEm: new Date(now.getTime() - 1 * 24 * 3600_000),
    },
    {
      numero: 'PRP-DEMO-002',
      clienteId: clientesIds['Fazenda Bela Vista LTDA'],
      tipo: 'compra',
      graos: [{ grao: 'milho', quantidadeSc: 800, precoSc: 67.0 }],
      valorTotal: 800 * 67.0,
      status: 'enviada',
      descricao: 'Milho safrinha · Dourados/MS',
      validadeEm: new Date(now.getTime() + 5 * 24 * 3600_000),
      enviadaEm: new Date(now.getTime() - 3 * 3600_000),
      criadaEm: new Date(now.getTime() - 4 * 3600_000),
    },
    {
      numero: 'PRP-DEMO-003',
      clienteId: clientesIds['Agropecuária Santa Helena'],
      tipo: 'compra',
      graos: [{ grao: 'soja', quantidadeSc: 2200, precoSc: 148.0 }],
      valorTotal: 2200 * 148.0,
      status: 'aceita',
      descricao: 'Soja exportação · Sinop/MT',
      validadeEm: new Date(now.getTime() + 30 * 24 * 3600_000),
      enviadaEm: new Date(now.getTime() - 3 * 24 * 3600_000),
      criadaEm: new Date(now.getTime() - 5 * 24 * 3600_000),
    },
  ]

  const propostasIds: Record<string, string> = {}
  for (const p of PROPOSTAS) {
    const existing = await db.proposta.findUnique({ where: { numero: p.numero } })
    if (existing) {
      const updated = await db.proposta.update({
        where: { id: existing.id },
        data: {
          tipo: p.tipo,
          graos: p.graos,
          valorTotal: p.valorTotal,
          status: p.status,
          descricao: p.descricao,
          validadeEm: p.validadeEm,
          ...(p.enviadaEm ? { enviadaEm: p.enviadaEm } : {}),
        },
      })
      propostasIds[p.numero] = updated.id
      console.log(`✓ Proposta atualizada: ${p.numero} (${p.status})`)
    } else {
      const created = await db.proposta.create({
        data: {
          workspaceId: wsId,
          numero: p.numero,
          clienteId: p.clienteId,
          tipo: p.tipo,
          graos: p.graos,
          valorTotal: p.valorTotal,
          status: p.status,
          descricao: p.descricao,
          validadeEm: p.validadeEm,
          enviadaEm: p.enviadaEm ?? null,
          criadaEm: p.criadaEm,
        },
      })
      propostasIds[p.numero] = created.id
      console.log(`+ Proposta criada: ${p.numero} (${p.status})`)
    }
  }

  // 6. CONTRATO assinado a partir da proposta aceita (PRP-DEMO-003)
  const numeroContrato = 'CTR-DEMO-001'
  const propostaAceitaId = propostasIds['PRP-DEMO-003']
  const clienteSantaHelenaId = clientesIds['Agropecuária Santa Helena']
  let contratoId: string

  const existingContrato = await db.contrato.findUnique({ where: { numero: numeroContrato } })
  if (existingContrato) {
    contratoId = existingContrato.id
    console.log(`✓ Contrato já existe: ${numeroContrato}`)
  } else {
    const novo = await db.contrato.create({
      data: {
        workspaceId: wsId,
        numero: numeroContrato,
        proposIdFk: propostaAceitaId,
        clienteId: clienteSantaHelenaId,
        dataInicio: new Date(now.getTime() - 1 * 24 * 3600_000),
        dataFim: new Date(now.getTime() + 60 * 24 * 3600_000),
        statusAssinatura: 'assinado',
        assinadoEm: new Date(now.getTime() - 1 * 24 * 3600_000),
        criadoEm: new Date(now.getTime() - 2 * 24 * 3600_000),
      },
    })
    contratoId = novo.id
    console.log(`+ Contrato criado: ${numeroContrato} (assinado)`)
  }

  // 7. BOLETOS — sinal 50% + parcela final 50%
  const valorTotalContrato = 2200 * 148.0 // R$ 325.600
  const sinalValor = valorTotalContrato * 0.5

  const BOLETOS = [
    {
      numero: 'BOL-DEMO-001',
      banco: 'bb',
      valor: sinalValor,
      vencimento: new Date(now.getTime() + 5 * 24 * 3600_000),
      status: 'aberto',
    },
    {
      numero: 'BOL-DEMO-002',
      banco: 'bb',
      valor: sinalValor,
      vencimento: new Date(now.getTime() + 25 * 24 * 3600_000),
      status: 'aberto',
    },
  ]

  for (const b of BOLETOS) {
    const existing = await db.boleto.findUnique({ where: { numero: b.numero } })
    if (existing) {
      await db.boleto.update({
        where: { id: existing.id },
        data: {
          banco: b.banco,
          valor: b.valor,
          vencimento: b.vencimento,
          status: b.status,
        },
      })
      console.log(`✓ Boleto atualizado: ${b.numero} · R$ ${b.valor.toFixed(2)}`)
    } else {
      await db.boleto.create({
        data: {
          workspaceId: wsId,
          numero: b.numero,
          contratoIdFk: contratoId,
          clienteId: clienteSantaHelenaId,
          banco: b.banco,
          valor: b.valor,
          vencimento: b.vencimento,
          status: b.status,
        },
      })
      console.log(`+ Boleto criado: ${b.numero} · R$ ${b.valor.toFixed(2)} · venc ${b.vencimento.toLocaleDateString('pt-BR')}`)
    }
  }

  // 8. COTAÇÕES históricas — 5 dias por grão (idempotente via @@unique([grao, data]))
  const COTACOES = [
    { grao: 'soja', simbolo: 'ZS', precos: [142.30, 143.10, 143.80, 144.50, 145.20] },
    { grao: 'milho', simbolo: 'ZC', precos: [65.80, 66.10, 66.40, 66.90, 67.40] },
    { grao: 'trigo', simbolo: 'ZW', precos: [1420, 1430, 1440, 1445, 1450] },
  ]
  const dolarReal = [5.02, 5.03, 5.04, 5.05, 5.05]

  let cotacoesCriadas = 0
  for (const c of COTACOES) {
    for (let i = 0; i < 5; i++) {
      const data = new Date(now)
      data.setDate(data.getDate() - (4 - i))
      data.setHours(20, 0, 0, 0) // 20h fechamento
      try {
        await db.cotacao.upsert({
          where: { grao_data: { grao: c.grao, data } },
          create: {
            grao: c.grao,
            preco: c.precos[i],
            simbolo: c.simbolo,
            fonte: 'CEPEA-DEMO',
            dolarReal: dolarReal[i],
            data,
          },
          update: {
            preco: c.precos[i],
            dolarReal: dolarReal[i],
          },
        })
        cotacoesCriadas++
      } catch (e) {
        // Tabela pode não ter unique composite ainda — fallback create-only se não existir
        const existing = await db.cotacao.findFirst({ where: { grao: c.grao, data } })
        if (!existing) {
          await db.cotacao.create({
            data: { grao: c.grao, preco: c.precos[i], simbolo: c.simbolo, fonte: 'CEPEA-DEMO', dolarReal: dolarReal[i], data },
          })
          cotacoesCriadas++
        }
      }
    }
  }
  console.log(`✓ Cotações: ${cotacoesCriadas} pontos (5 dias × 3 grãos)`)

  // 9. TaxaCambio — mesma janela
  let taxasCriadas = 0
  for (let i = 0; i < 5; i++) {
    const data = new Date(now)
    data.setDate(data.getDate() - (4 - i))
    data.setHours(20, 0, 0, 0)
    try {
      await db.taxaCambio.upsert({
        where: { origem_destino_data: { origem: 'USD', destino: 'BRL', data } },
        create: { origem: 'USD', destino: 'BRL', taxa: dolarReal[i], fonte: 'BCB-DEMO', data },
        update: { taxa: dolarReal[i] },
      })
      taxasCriadas++
    } catch {
      const existing = await db.taxaCambio.findFirst({ where: { origem: 'USD', destino: 'BRL', data } })
      if (!existing) {
        await db.taxaCambio.create({
          data: { origem: 'USD', destino: 'BRL', taxa: dolarReal[i], fonte: 'BCB-DEMO', data },
        })
        taxasCriadas++
      }
    }
  }
  console.log(`✓ Taxas câmbio: ${taxasCriadas} pontos`)

  // 10. Resumo final
  const counts = {
    clientes: await db.cliente.count({ where: { workspaceId: wsId } }),
    fornecedores: await db.fornecedor.count({ where: { workspaceId: wsId } }),
    propostas: await db.proposta.count({ where: { workspaceId: wsId } }),
    contratos: await db.contrato.count({ where: { workspaceId: wsId } }),
    boletos: await db.boleto.count({ where: { workspaceId: wsId } }),
  }

  console.log('\n📊 Resumo final do workspace MercoGrain:')
  console.log(`   ${counts.clientes} clientes`)
  console.log(`   ${counts.fornecedores} fornecedores`)
  console.log(`   ${counts.propostas} propostas`)
  console.log(`   ${counts.contratos} contratos`)
  console.log(`   ${counts.boletos} boletos`)
  console.log('\n✅ Seed completo!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
