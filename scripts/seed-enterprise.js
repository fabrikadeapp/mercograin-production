/**
 * Seed enterprise — popula o banco com dados realistas para testar todas as
 * áreas. Idempotente + tolerante a falhas: cada bloco em try/catch.
 *
 * Uso:
 *   DATABASE_URL='...' NODE_OPTIONS='--dns-result-order=ipv4first' \
 *     node scripts/seed-enterprise.js
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const ADMIN_EMAIL = 'admin@mercograin.com'
const WORKSPACE_SLUG = 'mercograin'
const TARGET = 10

const pad = (n, w = 4) => String(n).padStart(w, '0')
const now = new Date()
const daysAgo = (d) => new Date(now.getTime() - d * 86400_000)
const daysAhead = (d) => new Date(now.getTime() + d * 86400_000)
const monthsAgo = (m) => new Date(now.getFullYear(), now.getMonth() - m, 1)
const pick = (arr, i) => arr[i % arr.length]
const rand = (min, max) => +(min + Math.random() * (max - min)).toFixed(2)

const fakeCnpj = (seed) => {
  const base = String(10000000 + (seed * 100003) % 89999999)
  return `${base.slice(0, 2)}.${base.slice(2, 5)}.${base.slice(5, 8)}/0001-${pad((seed * 13) % 100, 2)}`
}
const fakeCpf = (seed) => {
  const base = String(100000000 + (seed * 100003) % 899999999)
  return `${base.slice(0, 3)}.${base.slice(3, 6)}.${base.slice(6, 9)}-${pad((seed * 11) % 100, 2)}`
}
const onlyDigits = (s) => (s || '').replace(/\D/g, '')

async function step(name, fn) {
  try {
    const r = await fn()
    console.log(`✓ ${name}`)
    return r
  } catch (e) {
    console.warn(`✗ ${name}: ${e.message}`)
    return null
  }
}

// Datasets BR
const TRADERS = [
  { nome: 'Bunge Alimentos S.A.', uf: 'SP', cidade: 'São Paulo' },
  { nome: 'Cargill Agrícola S.A.', uf: 'SP', cidade: 'São Paulo' },
  { nome: 'ADM do Brasil Ltda.', uf: 'SP', cidade: 'Rondonópolis' },
  { nome: 'Louis Dreyfus Company Brasil', uf: 'SP', cidade: 'São Paulo' },
  { nome: 'COFCO International Brasil', uf: 'SP', cidade: 'Santos' },
  { nome: 'Amaggi Exportação e Importação', uf: 'MT', cidade: 'Cuiabá' },
  { nome: 'CHS Inc. Brasil', uf: 'PR', cidade: 'Paranaguá' },
  { nome: 'Glencore Agriculture Brasil', uf: 'RJ', cidade: 'Rio de Janeiro' },
  { nome: 'Multigrain Trading S.A.', uf: 'MS', cidade: 'Dourados' },
  { nome: 'Caramuru Alimentos S.A.', uf: 'GO', cidade: 'Itumbiara' },
]
const PRODUTORES = [
  'Fazenda Boa Vista — Silva & Filhos',
  'Agropecuária Três Marias',
  'Fazenda Santa Helena',
  'Agropecuária Vale Verde',
  'Rancho da Serra Ltda.',
  'Fazenda São José do Pinhal',
  'Agropecuária Horizonte',
  'Fazenda Bela Vista do Sul',
  'Agronegócios Pampa',
  'Fazenda Nova Esperança',
]
const FORN_INSUMOS = [
  { nome: 'Syngenta Proteção de Cultivos', tipo: 'insumos' },
  { nome: 'Bayer S.A. Crop Science', tipo: 'insumos' },
  { nome: 'BASF S.A. Soluções Agrícolas', tipo: 'insumos' },
  { nome: 'Yara Brasil Fertilizantes', tipo: 'insumos' },
  { nome: 'Mosaic Fertilizantes do Brasil', tipo: 'insumos' },
  { nome: 'Heringer Fertilizantes', tipo: 'insumos' },
  { nome: 'Transportes Pampa Ltda.', tipo: 'transportadora' },
  { nome: 'Brevant Sementes', tipo: 'insumos' },
  { nome: 'GDM Genética do Brasil', tipo: 'insumos' },
  { nome: 'TMG Tropical Melhoramento', tipo: 'insumos' },
]
const CORRETORES = [
  'Ricardo Almeida', 'Patrícia Souza', 'João Pedro Lima', 'Mariana Costa', 'Felipe Andrade',
  'Camila Ferreira', 'Eduardo Martins', 'Beatriz Carvalho', 'André Ribeiro', 'Larissa Pereira',
]
const MOTORISTAS = [
  'Carlos Eduardo Santos', 'Antônio Pereira', 'José Roberto Lima', 'Marcos Vinícius Oliveira',
  'Luís Fernando Costa', 'Paulo Henrique Souza', 'Sebastião Rodrigues', 'Gilberto de Almeida',
  'Adilson Marques', 'Ronaldo Ferreira',
]
const CULTURAS = ['soja', 'milho', 'trigo']
const PRECO_BASE = { soja: 132.5, milho: 64.2, trigo: 87.4 }

async function main() {
  console.log('=== Seed Enterprise — Mercograin ===')

  // ===== FASE 1: workspace + sub + empresa + mesa =====
  const admin = await p.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) throw new Error(`User ${ADMIN_EMAIL} não existe`)
  console.log(`✓ admin: ${admin.id}`)

  let workspace = await p.workspace.findUnique({ where: { slug: WORKSPACE_SLUG } })
  if (!workspace) {
    workspace = await p.workspace.create({
      data: {
        name: 'Mercograin Trading',
        slug: WORKSPACE_SLUG,
        ownerId: admin.id,
        moedaPadrao: 'BRL',
        aiMode: 'managed',
        aiModel: 'gpt-4o-mini',
        onboardingCompletedAt: now,
      },
    })
  }
  const WS = workspace.id
  console.log(`✓ workspace: ${WS}`)

  // WorkspaceMember (unique: workspaceId + email)
  await step('workspaceMember owner', async () => {
    const exists = await p.workspaceMember.findFirst({
      where: { workspaceId: WS, userId: admin.id },
    })
    if (exists) return
    await p.workspaceMember.create({
      data: {
        workspaceId: WS,
        userId: admin.id,
        email: admin.email,
        role: 'owner',
        status: 'active',
        acceptedAt: now,
      },
    })
  })

  await step('subscription enterprise', async () => {
    await p.subscription.upsert({
      where: { workspaceId: WS },
      update: { plan: 'enterprise', status: 'active' },
      create: {
        workspaceId: WS,
        stripeSubscriptionId: `sub_seed_${WS.slice(0, 16)}`,
        stripeCustomerId: `cus_seed_${WS.slice(0, 16)}`,
        stripePriceId: 'price_enterprise_seed',
        plan: 'enterprise',
        status: 'active',
        currentPeriodStart: monthsAgo(1),
        currentPeriodEnd: daysAhead(30),
      },
    })
  })

  await step('dadosEmpresa', async () => {
    await p.dadosEmpresa.upsert({
      where: { workspaceId: WS },
      update: {},
      create: {
        workspaceId: WS,
        razaoSocial: 'Mercograin Trading Ltda.',
        nomeFantasia: 'Mercograin',
        cnpj: '12.345.678/0001-90',
        inscricaoEstadual: '123.456.789.012',
        endereco: 'Av. Brasil, 1500',
        cidade: 'Maringá',
        uf: 'PR',
        cep: '87010-000',
        telefone: '(44) 3210-0000',
        email: 'contato@mercograin.com',
        comissaoPadrao: 1.8,
      },
    })
  })

  let mesa = await p.mesa.findFirst({ where: { workspaceId: WS } })
  if (!mesa) {
    mesa = await step('mesa default', () =>
      p.mesa.create({
        data: { workspaceId: WS, nome: 'Mesa Sul', descricao: 'Mesa principal', ativo: true },
      }),
    )
  }
  const MESA_ID = mesa?.id

  // ===== FASE 2: cadastros base =====
  console.log('\n--- Fase 2: cadastros base ---')

  // Safra (cultura única por safra)
  const safras = []
  for (const [i, cfg] of [
    { nome: '2024/25', cultura: 'soja', ai: 2024 },
    { nome: '2024/25', cultura: 'milho', ai: 2024 },
    { nome: '2024/25', cultura: 'trigo', ai: 2024 },
    { nome: '2025/26', cultura: 'soja', ai: 2025 },
  ].entries()) {
    const existing = await p.safra.findFirst({
      where: { workspaceId: WS, nome: cfg.nome, cultura: cfg.cultura },
    })
    if (existing) { safras.push(existing); continue }
    const s = await step(`safra ${cfg.nome} ${cfg.cultura}`, () =>
      p.safra.create({
        data: {
          workspaceId: WS,
          nome: cfg.nome,
          cultura: cfg.cultura,
          inicio: new Date(cfg.ai, 8, 1),
          fim: new Date(cfg.ai + 1, 7, 31),
          ativa: cfg.ai === 2024,
        },
      }),
    )
    if (s) safras.push(s)
  }
  const safraAtiva = safras[0] || null

  // Armazem
  const armNames = ['Maringá Sul', 'Cascavel I', 'Rondonópolis Centro', 'Sorriso Norte', 'Campo Grande', 'Sapezal', 'Sinop', 'Lucas do Rio Verde', 'Querência', 'Primavera do Leste']
  const armazens = []
  for (const [i, nome] of armNames.entries()) {
    const existing = await p.armazem.findFirst({ where: { workspaceId: WS, nome } })
    if (existing) { armazens.push(existing); continue }
    const a = await step(`armazem ${nome}`, () =>
      p.armazem.create({
        data: {
          workspaceId: WS,
          nome,
          tipo: pick(['silo', 'granel', 'horizontal', 'misto'], i),
          capacidadeSc: 500_000 + i * 100_000,
          endereco: `Rod. BR-${163 + i}, km ${100 + i * 10}`,
          cidade: pick(['Maringá', 'Cascavel', 'Rondonópolis', 'Sorriso', 'Campo Grande'], i),
          uf: pick(['PR', 'PR', 'MT', 'MT', 'MS'], i),
          ativo: true,
        },
      }),
    )
    if (a) armazens.push(a)
  }

  // Cliente compradores (CNPJ único — busca antes)
  const clientesC = []
  for (let i = 0; i < TARGET; i++) {
    const src = TRADERS[i]
    const cnpj = fakeCnpj(i + 1)
    let c = await p.cliente.findFirst({ where: { workspaceId: WS, nome: src.nome } })
    if (!c) c = await p.cliente.findUnique({ where: { cnpj } }).catch(() => null)
    if (c) { clientesC.push(c); continue }
    c = await step(`cliente comprador ${src.nome}`, () =>
      p.cliente.create({
        data: {
          workspaceId: WS,
          nome: src.nome,
          tipo: 'comprador',
          email: `compras@${src.nome.toLowerCase().split(' ')[0].replace(/\W/g, '')}.com.br`,
          whatsapp: `5511999${String(100000 + i * 137).slice(0, 6)}`,
          cnpj,
          tipoPessoa: 'PJ',
          endereco: `${src.cidade} · ${src.uf}`,
          porte: 'grande',
          ativo: true,
        },
      }),
    )
    if (c) clientesC.push(c)
  }

  // Cliente produtores
  const clientesV = []
  for (let i = 0; i < TARGET; i++) {
    const nome = PRODUTORES[i]
    const cnpj = fakeCnpj(100 + i)
    let c = await p.cliente.findFirst({ where: { workspaceId: WS, nome } })
    if (!c) c = await p.cliente.findUnique({ where: { cnpj } }).catch(() => null)
    if (c) { clientesV.push(c); continue }
    c = await step(`cliente produtor ${nome}`, () =>
      p.cliente.create({
        data: {
          workspaceId: WS,
          nome,
          tipo: 'vendedor',
          email: `contato@produtor${i + 1}.com.br`,
          whatsapp: `5544997${String(100000 + i * 211).slice(0, 6)}`,
          cnpj,
          tipoPessoa: 'PJ',
          endereco: `Zona Rural, ${pick(['Maringá', 'Cascavel', 'Sorriso', 'Sinop'], i)} · ${pick(['PR', 'PR', 'MT', 'MT'], i)}`,
          porte: pick(['medio', 'grande'], i),
          ativo: true,
        },
      }),
    )
    if (c) clientesV.push(c)
  }

  // Fornecedor
  const fornecedores = []
  for (let i = 0; i < TARGET; i++) {
    const src = FORN_INSUMOS[i]
    const existing = await p.fornecedor.findFirst({ where: { workspaceId: WS, razaoSocial: src.nome } })
    if (existing) { fornecedores.push(existing); continue }
    const f = await step(`fornecedor ${src.nome}`, () =>
      p.fornecedor.create({
        data: {
          workspaceId: WS,
          tipo: src.tipo,
          razaoSocial: src.nome,
          nomeFantasia: src.nome.split(' ')[0],
          cnpj: fakeCnpj(200 + i),
          email: `vendas@forn${i + 1}.com.br`,
          telefone: `(11) 4${String(100 + i)}-${String(1000 + i * 23).slice(0, 4)}`,
          cidade: 'São Paulo',
          uf: 'SP',
          ativo: true,
        },
      }),
    )
    if (f) fornecedores.push(f)
  }

  // Corretor
  const corretores = []
  for (let i = 0; i < TARGET; i++) {
    const email = `${CORRETORES[i].toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')}@mercograin.com`
    const existing = await p.corretor.findFirst({ where: { workspaceId: WS, email } })
    if (existing) { corretores.push(existing); continue }
    const c = await step(`corretor ${CORRETORES[i]}`, () =>
      p.corretor.create({
        data: {
          workspaceId: WS,
          nome: CORRETORES[i],
          email,
          whatsapp: `554499${String(100000 + i * 41).slice(0, 6)}`,
          cpf: fakeCpf(300 + i),
          mesaId: MESA_ID,
          comissaoPct: 0.5 + i * 0.05,
          ativo: true,
        },
      }),
    )
    if (c) corretores.push(c)
  }

  // Motorista
  const motoristas = []
  for (let i = 0; i < TARGET; i++) {
    const cnh = pad(1234567890 + i, 11)
    const existing = await p.motorista.findFirst({ where: { workspaceId: WS, cnh } })
    if (existing) { motoristas.push(existing); continue }
    const m = await step(`motorista ${MOTORISTAS[i]}`, () =>
      p.motorista.create({
        data: {
          workspaceId: WS,
          nome: MOTORISTAS[i],
          cnh,
          cpf: fakeCpf(400 + i),
          whatsapp: `556699${String(100000 + i * 53).slice(0, 6)}`,
          placa: `${String.fromCharCode(65 + i)}${String.fromCharCode(65 + ((i * 3) % 26))}${String.fromCharCode(65 + ((i * 5) % 26))}-${pad((i * 7) % 10000, 4)}`,
          veiculo: pick(['Volvo FH 540', 'Scania R450', 'Mercedes Actros', 'Iveco Stralis'], i),
          ativo: true,
        },
      }),
    )
    if (m) motoristas.push(m)
  }

  // PropriedadeRural + Talhao
  const propriedades = []
  for (let i = 0; i < Math.min(TARGET, clientesV.length); i++) {
    const produtor = clientesV[i]
    const existing = await p.propriedadeRural.findFirst({ where: { workspaceId: WS, produtorId: produtor.id } })
    if (existing) { propriedades.push(existing); continue }
    const prop = await step(`propriedade ${produtor.nome}`, () =>
      p.propriedadeRural.create({
        data: {
          workspaceId: WS,
          produtorId: produtor.id,
          nome: `Propriedade ${produtor.nome.split(' ').slice(0, 2).join(' ')}`,
          car: `MT-${pad(100000 + i * 13, 7)}-${pad(i + 1, 4)}`,
          areaTotalHa: rand(400, 5000),
          municipio: pick(['Sorriso', 'Sinop', 'Lucas do Rio Verde', 'Campo Verde', 'Querência'], i),
          centroideLat: -(12 + rand(0, 6)),
          centroideLng: -(55 + rand(0, 3)),
        },
      }),
    )
    if (prop) propriedades.push(prop)

    if (prop) {
      await step(`talhão ${i + 1}`, async () => {
        const exists = await p.talhao.findFirst({ where: { propriedadeId: prop.id } })
        if (exists) return
        await p.talhao.create({
          data: {
            workspaceId: WS,
            produtorId: produtor.id,
            propriedadeId: prop.id,
            nome: `Talhão ${i + 1}`,
            area: rand(50, 800),
            cultura: pick(CULTURAS, i),
            safraId: safraAtiva?.id,
            municipio: pick(['Sorriso', 'Sinop'], i),
            uf: 'MT',
            ativo: true,
          },
        })
      })
    }
  }

  // Balanca (1 por armazém)
  for (let i = 0; i < Math.min(TARGET, armazens.length); i++) {
    const existing = await p.balanca.findFirst({ where: { workspaceId: WS, armazemId: armazens[i].id } })
    if (existing) continue
    await step(`balança ${armazens[i].nome}`, () =>
      p.balanca.create({
        data: {
          workspaceId: WS,
          armazemId: armazens[i].id,
          nome: `Balança ${armazens[i].nome}`,
          modelo: pick(['Toledo MGR-3000', 'Filizola BR-30', 'Marques 8000'], i),
          capacidadeMaxKg: 80_000,
          ativa: true,
        },
      }),
    )
  }

  // CentroCusto
  const ccNames = ['Comercial', 'Logística', 'Administrativo', 'Fiscal', 'Originação', 'Mesa', 'Hedge', 'Marketing', 'TI', 'RH']
  const centrosCusto = []
  for (const [i, nome] of ccNames.entries()) {
    const existing = await p.centroCusto.findFirst({ where: { workspaceId: WS, nome } })
    if (existing) { centrosCusto.push(existing); continue }
    const cc = await step(`centroCusto ${nome}`, () =>
      p.centroCusto.create({
        data: {
          workspaceId: WS,
          nome,
          codigo: `CC${pad(i + 1, 3)}`,
          ativo: true,
        },
      }),
    )
    if (cc) centrosCusto.push(cc)
  }

  // ConfiguracaoFiscal
  let configFiscal = await p.configuracaoFiscal.findUnique({ where: { workspaceId: WS } }).catch(() => null)
  if (!configFiscal) {
    configFiscal = await step('configuracaoFiscal', () =>
      p.configuracaoFiscal.create({
        data: {
          workspaceId: WS,
          cnpjEmissor: '12.345.678/0001-90',
          inscricaoEstadual: '123.456.789.012',
          regimeTributario: 'lucro_real',
          providerNome: 'mock',
          ambiente: 'homologacao',
        },
      }),
    )
  }

  // ===== FASE 3: originação =====
  console.log('\n--- Fase 3: originação ---')

  const propostas = []
  const contratos = []
  for (let i = 0; i < TARGET; i++) {
    const isVenda = i % 2 === 0
    const cliente = isVenda ? pick(clientesC, i) : pick(clientesV, i)
    const cultura = pick(CULTURAS, i)
    const qtd = 1000 + i * 500
    const preco = PRECO_BASE[cultura] + rand(-5, 5)
    const valorTotal = qtd * preco
    const numProp = `PROP-2025-${pad(i + 1)}`

    let prop = await p.proposta.findUnique({ where: { numero: numProp } }).catch(() => null)
    if (!prop) {
      prop = await step(`proposta ${numProp}`, () =>
        p.proposta.create({
          data: {
            numero: numProp,
            workspaceId: WS,
            clienteId: cliente.id,
            tipo: isVenda ? 'venda' : 'compra',
            graos: [{ cultura, qtdSc: qtd, precoSc: preco, safra: safraAtiva?.nome || '2024/25' }],
            valorTotal,
            status: pick(['rascunho', 'enviada', 'aceita', 'aceita', 'expirada'], i),
            descricao: `${isVenda ? 'Venda' : 'Compra'} ${cultura} ${qtd}sc à R$ ${preco.toFixed(2)}/sc`,
            enviadaEm: i < 7 ? daysAgo(30 - i * 2) : null,
            validadeEm: daysAhead(15 + i),
          },
        }),
      )
    }
    if (prop) propostas.push(prop)

    if (i < 7 && prop) {
      const numCont = `CT-2025-${pad(i + 1)}`
      let cont = await p.contrato.findUnique({ where: { numero: numCont } }).catch(() => null)
      if (!cont) {
        cont = await step(`contrato ${numCont}`, () =>
          p.contrato.create({
            data: {
              numero: numCont,
              workspaceId: WS,
              proposIdFk: prop.id,
              clienteId: cliente.id,
              dataInicio: daysAgo(30 - i * 3),
              dataFim: daysAhead(60 + i * 10),
              statusAssinatura: pick(['pendente', 'assinado', 'assinado', 'assinado'], i),
              assinadoEm: i >= 1 ? daysAgo(25 - i * 3) : null,
              modalidade: pick(['fixo', 'a_fixar', 'misto', 'barter'], i),
              formaPagamento: pick(['a_vista', 'parcelado', '30_60_90', 'safra'], i),
              prazoPagamentoDias: pick([0, 30, 60, 90], i),
              localEntrega: pick(['Armazém Maringá', 'Porto de Paranaguá', 'Armazém Sorriso'], i),
            },
          }),
        )
      }
      if (cont) contratos.push(cont)
    }
  }
  console.log(`  propostas: ${propostas.length}, contratos: ${contratos.length}`)

  // ContratoFixacao
  for (const cont of contratos) {
    if (!['a_fixar', 'misto'].includes(cont.modalidade)) continue
    const exists = await p.contratoFixacao.findUnique({ where: { contratoId: cont.id } }).catch(() => null)
    if (exists) continue
    const qtd = rand(1000, 5000)
    await step(`contratoFixacao ${cont.numero}`, () =>
      p.contratoFixacao.create({
        data: {
          workspaceId: WS,
          contratoId: cont.id,
          modalidade: cont.modalidade,
          qtdTotalSc: qtd,
          qtdFixadaSc: 0,
          qtdRemanescenteSc: qtd,
          gatilhoCultura: pick(CULTURAS, contratos.indexOf(cont)),
          statusFixacao: 'pendente',
        },
      }),
    )
  }

  // Fixacao parcial
  const cfs = await p.contratoFixacao.findMany({ where: { workspaceId: WS } })
  for (const [i, cf] of cfs.entries()) {
    const exists = await p.fixacao.count({ where: { contratoFixacaoId: cf.id } })
    if (exists > 0) continue
    await step(`fixacao ${i + 1}`, () =>
      p.fixacao.create({
        data: {
          workspaceId: WS,
          contratoFixacaoId: cf.id,
          qtdSc: 500 + i * 100,
          precoSc: 130 + i,
          precoUSDSc: 22 + i * 0.5,
          cotacaoUSDBRL: 5.2 + i * 0.05,
          premio: 0.5,
          base: -1.2,
          fixadoPor: admin.id,
          observacoes: `Fixação ${i + 1} CBOT + base PR`,
        },
      }),
    )
  }

  // Adiantamento
  const adiantamentos = []
  for (let i = 0; i < Math.min(TARGET, contratos.length * 2); i++) {
    if (contratos.length === 0) break
    const cont = pick(contratos, i)
    const produtor = pick(clientesV, i)
    const numAd = `AD-2025-${pad(i + 1)}`
    const existing = await p.adiantamento.findFirst({ where: { workspaceId: WS, numero: numAd } })
    if (existing) { adiantamentos.push(existing); continue }
    const ad = await step(`adiantamento ${numAd}`, () =>
      p.adiantamento.create({
        data: {
          workspaceId: WS,
          numero: numAd,
          contratoId: cont.id,
          produtorId: produtor.id,
          valor: rand(50_000, 300_000),
          tipo: pick(['dinheiro', 'insumo', 'misto'], i),
          dataPrevistaQuit: daysAhead(60 + i * 10),
          qtdEsperadaSc: 500 + i * 100,
          status: pick(['aberto', 'parcial'], i),
        },
      }),
    )
    if (ad) adiantamentos.push(ad)
  }

  // BarterInsumo
  for (let i = 0; i < TARGET && contratos.length > 0; i++) {
    const cont = pick(contratos, i)
    const fornec = pick(fornecedores, i)
    const exists = await p.barterInsumo.findFirst({
      where: { workspaceId: WS, contratoId: cont.id, descricao: `Insumo barter ${i + 1}` },
    })
    if (exists) continue
    const qtd = rand(10, 100)
    const precoUnit = rand(120, 380)
    await step(`barter insumo ${i + 1}`, () =>
      p.barterInsumo.create({
        data: {
          workspaceId: WS,
          adiantamentoId: adiantamentos[i]?.id,
          contratoId: cont.id,
          descricao: `Insumo barter ${i + 1}`,
          fornecedorId: fornec.id,
          quantidade: qtd,
          unidade: pick(['kg', 'l', 'sc'], i),
          precoUnit,
          valorTotal: qtd * precoUnit,
          precoFixadoSc: PRECO_BASE.soja,
          qtdGraoEquivalenteSc: +((qtd * precoUnit) / PRECO_BASE.soja).toFixed(2),
          status: pick(['pendente', 'entregue', 'recebido_grao'], i),
        },
      }),
    )
  }

  // PlanoVendas
  for (let i = 0; i < 3; i++) {
    const cultura = CULTURAS[i]
    const exists = await p.planoVendas.findFirst({
      where: { workspaceId: WS, cultura, safraId: safraAtiva?.id },
    })
    if (exists) continue
    await step(`planoVendas ${cultura}`, () =>
      p.planoVendas.create({
        data: {
          workspaceId: WS,
          cultura,
          safraId: safraAtiva?.id,
          qtdPrevistaSc: 100_000 + i * 50_000,
          qtdContratadaSc: rand(30_000, 80_000),
          qtdFixadaSc: rand(20_000, 60_000),
          qtdEntregueSc: rand(10_000, 40_000),
          precoMedioPrevistoSc: PRECO_BASE[cultura],
          status: 'ativo',
        },
      }),
    )
  }

  // Washout
  for (let i = 0; i < Math.min(TARGET, contratos.length); i++) {
    const cont = contratos[i]
    const exists = await p.washout.count({ where: { contratoId: cont.id } })
    if (exists > 0) continue
    await step(`washout ${i + 1}`, () =>
      p.washout.create({
        data: {
          workspaceId: WS,
          contratoId: cont.id,
          motivo: pick(['cliente_desistiu', 'forcas_maior', 'preco_inviavel', 'outro'], i),
          motivoDescricao: 'Washout seed',
          custoWashout: rand(5_000, 50_000),
          custoQuemPaga: pick(['comprador', 'vendedor', 'corretora'], i),
          qtdAfetadaSc: rand(500, 3000),
        },
      }),
    )
  }

  // ===== FASE 4: operação física =====
  console.log('\n--- Fase 4: operação física ---')

  const lotes = []
  for (let i = 0; i < TARGET && armazens.length > 0; i++) {
    const arm = pick(armazens, i)
    const cultura = pick(CULTURAS, i)
    const num = `LOTE-2425-${pad(i + 1)}`
    const existing = await p.loteEstoque.findFirst({ where: { workspaceId: WS, numero: num } })
    if (existing) { lotes.push(existing); continue }
    const lote = await step(`lote ${num}`, () =>
      p.loteEstoque.create({
        data: {
          workspaceId: WS,
          numero: num,
          cultura,
          safraId: safraAtiva?.id,
          armazemId: arm.id,
          qtdInicialSc: 1000 + i * 200,
          qtdAtualSc: 1000 + i * 200 - rand(0, 300),
          umidadeMedia: rand(12, 14.5),
          impurezaMedia: rand(0.5, 2.0),
          status: 'ativo',
        },
      }),
    )
    if (lote) lotes.push(lote)
  }

  // Romaneio
  for (let i = 0; i < TARGET; i++) {
    const numR = `ROM-2025-${pad(i + 1)}`
    const existing = await p.romaneio.findFirst({ where: { workspaceId: WS, numero: numR } })
    if (existing) continue
    await step(`romaneio ${numR}`, () =>
      p.romaneio.create({
        data: {
          workspaceId: WS,
          numero: numR,
          contratosIds: contratos[i % Math.max(1, contratos.length)] ? [contratos[i % contratos.length].id] : [],
          motoristaId: motoristas[i % Math.max(1, motoristas.length)]?.id,
          origem: armazens[i % Math.max(1, armazens.length)]?.nome || 'Origem',
          destino: pick(['Porto de Paranaguá', 'Porto de Santos', 'Armazém Sorriso'], i),
          cultura: pick(CULTURAS, i),
          safraId: safraAtiva?.id,
          status: pick(['rascunho', 'em_transito', 'recebido', 'recebido'], i),
          dataSaida: daysAgo(15 - i),
          dataChegada: i > 1 ? daysAgo(10 - i) : null,
        },
      }),
    )
  }

  // OrdemCarga
  for (let i = 0; i < Math.min(TARGET, contratos.length); i++) {
    const numO = `OC-2025-${pad(i + 1)}`
    const existing = await p.ordemCarga.findFirst({ where: { workspaceId: WS, numero: numO } })
    if (existing) continue
    await step(`ordemCarga ${numO}`, () =>
      p.ordemCarga.create({
        data: {
          workspaceId: WS,
          numero: numO,
          contratoId: contratos[i].id,
          clienteId: contratos[i].clienteId,
          motoristaId: pick(motoristas, i)?.id,
          armazemOrigemId: armazens[i % Math.max(1, armazens.length)]?.id,
          armazemDestinoId: armazens[(i + 3) % Math.max(1, armazens.length)]?.id,
          grao: pick(CULTURAS, i),
          quantidadeSc: 500 + i * 100,
          dataAgendada: daysAhead(5 + i),
          status: pick(['agendada', 'em_transito', 'concluida'], i),
        },
      }),
    )
  }

  // ===== FASE 5: hedge & risco =====
  console.log('\n--- Fase 5: hedge & risco ---')

  // TaxaCambio histórica (30 dias)
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(i)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    const exists = await p.taxaCambio.findFirst({
      where: { origem: 'USD', destino: 'BRL', data: { gte: dayStart, lt: dayEnd } },
    })
    if (exists) continue
    await p.taxaCambio.create({
      data: {
        origem: 'USD',
        destino: 'BRL',
        taxa: 4.85 + rand(-0.15, 0.20),
        data: d,
        fonte: 'BCB',
      },
    }).catch(() => {})
  }
  console.log('  taxa câmbio 30d')

  // ContratoFuturo (futures B3/CBOT)
  for (let i = 0; i < TARGET; i++) {
    const codigoVenc = pick(['ZSF26', 'ZSH26', 'ZSK26', 'ZCN26', 'ZCU26', 'ZWN26', 'SBM-26', 'CCM-26', 'ICF-26', 'BGI-26'], i)
    const existing = await p.contratoFuturo.findFirst({ where: { workspaceId: WS, codigoVenc } })
    if (existing) continue
    await step(`contratoFuturo ${codigoVenc}`, () =>
      p.contratoFuturo.create({
        data: {
          workspaceId: WS,
          grao: pick(['soja', 'soja', 'soja', 'milho', 'milho', 'trigo', 'soja', 'soja', 'soja', 'soja'], i),
          lado: i % 2 === 0 ? 'compra' : 'venda',
          vencimento: daysAhead(60 + i * 30),
          precoSc: rand(120, 180),
          volumeSc: 5000 + i * 1000,
          codigoVenc,
          praca: pick(['Paranaguá', 'Santos', 'Rio Grande'], i),
          status: 'ativo',
        },
      }),
    )
  }

  // PosicaoHedge
  const posicoes = []
  for (let i = 0; i < TARGET; i++) {
    const numH = `HDG-2025-${pad(i + 1)}`
    const existing = await p.posicaoHedge.findFirst({ where: { workspaceId: WS, numero: numH } })
    if (existing) { posicoes.push(existing); continue }
    const tipo = i % 2 === 0 ? 'long' : 'short'
    const cultura = pick(CULTURAS, i)
    const qtdContratos = 5 + i
    const precoEntrada = rand(11, 14)
    const pos = await step(`posicaoHedge ${numH}`, () =>
      p.posicaoHedge.create({
        data: {
          workspaceId: WS,
          numero: numH,
          tipo,
          cultura,
          contratoFuturo: pick(['ZS', 'ZC', 'ZW'], i),
          vencimento: daysAhead(60 + i * 30),
          qtdContratos,
          qtdEquivalenteSc: qtdContratos * 5000 / 60,
          precoEntradaUsdBu: precoEntrada,
          cambioEntradaUsdBrl: 4.95,
          margemDepositadaUSD: qtdContratos * 1500,
          margemDepositadaBRL: qtdContratos * 1500 * 4.95,
          corretagemUSD: qtdContratos * 12,
          contratoOrigemId: i < contratos.length ? contratos[i].id : null,
          status: pick(['aberta', 'aberta', 'aberta', 'fechada'], i),
          observacoes: `${tipo.toUpperCase()} hedge ${cultura}`,
          corretorId: pick(corretores, i)?.id,
          mesaId: MESA_ID,
        },
      }),
    )
    if (pos) posicoes.push(pos)
  }

  // NDF
  for (let i = 0; i < TARGET; i++) {
    const numN = `NDF-2025-${pad(i + 1)}`
    const existing = await p.nDF.findFirst({ where: { workspaceId: WS, numero: numN } })
    if (existing) continue
    await step(`NDF ${numN}`, () =>
      p.nDF.create({
        data: {
          workspaceId: WS,
          numero: numN,
          tipo: i < 7 ? 'moeda' : 'commodity',
          contraparteNome: pick(['Banco Itaú', 'Bradesco', 'Santander', 'BTG Pactual', 'Banco do Brasil'], i),
          contraparteCnpj: fakeCnpj(500 + i),
          direcao: i % 2 === 0 ? 'venda' : 'compra',
          ativoTipo: i < 7 ? 'USDBRL' : pick(['ZS', 'ZC', 'ZW'], i),
          notional: rand(500_000, 2_000_000),
          strike: 4.95 + rand(-0.1, 0.15),
          dataVencimento: daysAhead(60 + i * 20),
          status: pick(['aberta', 'aberta', 'aberta', 'liquidada'], i),
        },
      }),
    )
  }

  // MarcacaoMercado
  for (const pos of posicoes) {
    const exists = await p.marcacaoMercado.count({ where: { workspaceId: WS, posicaoHedgeId: pos.id } })
    if (exists > 0) continue
    for (let d = 0; d < 5; d++) {
      await p.marcacaoMercado.create({
        data: {
          workspaceId: WS,
          posicaoHedgeId: pos.id,
          data: daysAgo(d),
          precoMercadoUsdBu: Number(pos.precoEntradaUsdBu) + rand(-0.5, 0.5),
          cambioUsdBrl: 4.95 + rand(-0.10, 0.10),
          variacaoDiaBRL: rand(-15_000, 25_000),
          pnlUnrealizedUSD: rand(-3_000, 8_000),
          pnlUnrealizedBRL: rand(-15_000, 40_000),
        },
      }).catch(() => {})
    }
  }
  console.log('  marcações a mercado')

  // AlertaPreco
  for (let i = 0; i < TARGET; i++) {
    const cultura = pick(CULTURAS, i)
    const exists = await p.alertaPreco.findFirst({
      where: { workspaceId: WS, graoLabel: cultura, preco: PRECO_BASE[cultura] + i },
    }).catch(() => null)
    if (exists) continue
    await step(`alerta ${i + 1}`, () =>
      p.alertaPreco.create({
        data: {
          workspaceId: WS,
          symbol: pick(['ZS=F', 'ZC=F', 'ZW=F'], i),
          graoLabel: cultura,
          operador: i % 2 === 0 ? '>' : '<',
          preco: PRECO_BASE[cultura] + i,
          status: 'ativo',
          tipo: 'preco',
        },
      }),
    )
  }

  // ===== FASE 6: financeiro =====
  console.log('\n--- Fase 6: financeiro ---')

  // Boleto
  for (let i = 0; i < TARGET; i++) {
    const numB = `BOL-2025-${pad(i + 1)}`
    const existing = await p.boleto.findUnique({ where: { numero: numB } }).catch(() => null)
    if (existing) continue
    const cont = contratos[i % Math.max(1, contratos.length)]
    const clienteId = cont?.clienteId || clientesC[0]?.id
    if (!clienteId) continue
    await step(`boleto ${numB}`, () =>
      p.boleto.create({
        data: {
          numero: numB,
          workspaceId: WS,
          contratoIdFk: cont?.id,
          clienteId,
          banco: pick(['001', '237', '341', '033', '104'], i),
          valor: rand(30_000, 200_000),
          vencimento: daysAhead(15 + i * 5),
          status: pick(['aberto', 'pago', 'aberto', 'vencido', 'aberto'], i),
          confirmadoEm: i % 5 === 1 ? daysAgo(2) : null,
        },
      }),
    )
  }

  // MovimentoFinanceiro
  for (let i = 0; i < TARGET; i++) {
    const isReceita = i % 2 === 0
    const exists = await p.movimentoFinanceiro.findFirst({
      where: { workspaceId: WS, descricao: `Movimento seed ${i + 1}` },
    })
    if (exists) continue
    await step(`movimento ${i + 1}`, () =>
      p.movimentoFinanceiro.create({
        data: {
          workspaceId: WS,
          data: daysAgo(i * 3),
          tipo: isReceita ? 'entrada' : 'saida',
          natureza: pick(
            isReceita ? ['venda_grao', 'fixacao', 'royalty'] : ['frete', 'armazenagem', 'comissao', 'imposto'],
            i,
          ),
          valor: isReceita ? rand(50_000, 500_000) : rand(2_000, 80_000),
          descricao: `Movimento seed ${i + 1}`,
          centroCustoId: pick(centrosCusto, i)?.id,
          contratoId: contratos[i % Math.max(1, contratos.length)]?.id,
          safraId: safraAtiva?.id,
          cultura: pick(CULTURAS, i),
          conciliado: i % 3 === 0,
        },
      }),
    )
  }

  // ComissaoRegra
  let regras = await p.comissaoRegra.findMany({ where: { workspaceId: WS } })
  if (regras.length < TARGET) {
    for (let i = regras.length; i < TARGET; i++) {
      await step(`regra ${i + 1}`, () =>
        p.comissaoRegra.create({
          data: {
            workspaceId: WS,
            nome: `Regra ${i + 1} — ${pick(['Soja PR', 'Milho MT', 'Trigo RS', 'Exportação', 'Mercado Interno'], i)}`,
            descricao: 'Regra de comissão seed',
            escopoTipo: 'cultura',
            escopoFiltro: { cultura: pick(CULTURAS, i) },
            pctTotal: rand(1.0, 2.5),
            pctCorretor: rand(0.5, 1.5),
            pctOriginador: 0.3,
            pctMesa: 0.2,
            pctHouse: rand(0.2, 0.8),
            ativo: true,
            prioridade: i,
          },
        }),
      )
    }
    regras = await p.comissaoRegra.findMany({ where: { workspaceId: WS } })
  }

  // ComissaoApurada
  for (let i = 0; i < Math.min(TARGET, contratos.length); i++) {
    const cont = contratos[i]
    const exists = await p.comissaoApurada.findUnique({ where: { contratoId: cont.id } }).catch(() => null)
    if (exists) continue
    const valorContrato = rand(150_000, 800_000)
    const pctTotal = 1.8
    const valorTotal = +(valorContrato * pctTotal / 100).toFixed(2)
    await step(`comissao apurada ${i + 1}`, () =>
      p.comissaoApurada.create({
        data: {
          workspaceId: WS,
          contratoId: cont.id,
          regraId: pick(regras, i)?.id,
          valorContrato,
          pctTotalAplicado: pctTotal,
          valorTotalComissao: valorTotal,
          corretorId: pick(corretores, i)?.id,
          valorCorretor: valorTotal * 0.55,
          originadorId: pick(corretores, i + 1)?.id,
          valorOriginador: valorTotal * 0.15,
          mesaId: MESA_ID,
          valorMesa: valorTotal * 0.10,
          valorHouse: valorTotal * 0.20,
          status: pick(['apurada', 'paga', 'apurada'], i),
        },
      }),
    )
  }

  // Royalty (detentor é Fornecedor)
  for (let i = 0; i < Math.min(TARGET, contratos.length); i++) {
    const exists = await p.royalty.findFirst({
      where: { workspaceId: WS, contratoId: contratos[i].id, cultivar: `Cultivar ${i + 1}` },
    })
    if (exists) continue
    const valorPorSc = rand(0.40, 1.20)
    const qtdSc = rand(500, 5000)
    await step(`royalty ${i + 1}`, () =>
      p.royalty.create({
        data: {
          workspaceId: WS,
          contratoId: contratos[i].id,
          detentorId: pick(fornecedores, i).id,
          cultivar: `Cultivar ${i + 1}`,
          qtdSc,
          valorPorSc,
          valorTotal: qtdSc * valorPorSc,
          status: pick(['apurado', 'pago', 'apurado'], i),
        },
      }),
    )
  }

  // ===== FASE 7: fiscal =====
  console.log('\n--- Fase 7: fiscal ---')

  // NotaFiscal
  if (configFiscal) {
    for (let i = 0; i < TARGET; i++) {
      const chave = `35251212345678000190550010000${pad(i + 1, 4)}1${pad(i, 7)}`
      const exists = await p.notaFiscal.findUnique({ where: { chave } }).catch(() => null)
      if (exists) continue
      const cont = contratos[i % Math.max(1, contratos.length)]
      const isSaida = i % 2 === 0
      const valorProdutos = rand(50_000, 500_000)
      const icms = valorProdutos * 0.12
      const pis = valorProdutos * 0.0165
      const cofins = valorProdutos * 0.076
      await step(`nota fiscal ${i + 1}`, () =>
        p.notaFiscal.create({
          data: {
            workspaceId: WS,
            configFiscalId: configFiscal.id,
            tipo: isSaida ? 'saida' : 'entrada',
            modelo: '55',
            serie: 1,
            numero: 1000 + i,
            chave,
            protocolo: i > 1 ? `135250000${pad(i + 1, 9)}` : null,
            status: pick(['rascunho', 'autorizada', 'autorizada', 'cancelada'], i),
            dataAutorizacao: i > 1 ? daysAgo(i) : null,
            contratoId: cont?.id,
            emitenteCnpj: '12.345.678/0001-90',
            emitenteNome: 'Mercograin Trading Ltda.',
            emitenteUF: 'PR',
            destinatarioDoc: fakeCnpj(600 + i),
            destinatarioNome: pick(clientesC, i)?.nome || 'Cliente',
            destinatarioUF: pick(['SP', 'MT', 'PR', 'RS'], i),
            destinatarioIE: '123456789',
            itens: [
              {
                descricao: `${pick(CULTURAS, i)} a granel`,
                ncm: pick(['12019000', '10059010', '10019900'], i),
                cfop: isSaida ? '5102' : '1102',
                qtd: rand(500, 5000),
                valorUnitario: PRECO_BASE[pick(CULTURAS, i)],
                valorTotal: valorProdutos,
              },
            ],
            valorProdutos,
            valorICMS: icms,
            valorPIS: pis,
            valorCOFINS: cofins,
            valorFUNRURAL: valorProdutos * 0.015,
            valorTotal: valorProdutos + icms,
            cfopPrincipal: isSaida ? '5102' : '1102',
            naturezaOperacao: isSaida ? 'Venda de mercadoria' : 'Compra para industrialização',
          },
        }),
      )
    }
  }

  // Guia
  for (let i = 0; i < TARGET; i++) {
    const numG = `GUIA-2025-${pad(i + 1)}`
    const exists = await p.guia.findFirst({ where: { workspaceId: WS, numero: numG } })
    if (exists) continue
    const valorPrincipal = rand(5_000, 80_000)
    await step(`guia ${numG}`, () =>
      p.guia.create({
        data: {
          workspaceId: WS,
          numero: numG,
          tipo: pick(['darf', 'gnre', 'gare'], i),
          codigoReceita: pick(['0220', '0211', '0561'], i),
          contribuinteDoc: '12345678000190',
          contribuinteNome: 'Mercograin Trading Ltda.',
          periodoApuracao: `2025${pad((i % 12) + 1, 2)}`,
          valorPrincipal,
          multa: 0,
          juros: 0,
          valorTotal: valorPrincipal,
          vencimento: daysAhead(10 + i * 3),
          status: pick(['aberto', 'pago', 'aberto'], i),
          uf: 'PR',
        },
      }),
    )
  }

  // ===== FASE 8: mesa & cotações =====
  console.log('\n--- Fase 8: mesa & cotações ---')

  // Oferta
  for (let i = 0; i < TARGET; i++) {
    const num = `OF-2025-${pad(i + 1)}`
    const exists = await p.oferta.findUnique({ where: { numero: num } }).catch(() => null)
    if (exists) continue
    const cultura = pick(CULTURAS, i)
    await step(`oferta ${num}`, () =>
      p.oferta.create({
        data: {
          workspaceId: WS,
          numero: num,
          tipo: i % 2 === 0 ? 'venda' : 'compra',
          cultura,
          qtdSc: 1000 + i * 200,
          precoSc: PRECO_BASE[cultura] + rand(-3, 5),
          precoMoeda: 'BRL',
          origem: 'PR',
          destino: 'SP',
          validadeHoras: 72,
          validaAte: daysAhead(3),
          status: pick(['aberta', 'aberta', 'aceita', 'expirada'], i),
          publica: i < 3,
          proprietarioId: admin.id,
          observacao: `Oferta seed ${i + 1}`,
        },
      }),
    )
  }

  // Cotacao histórica
  for (let i = 0; i < 30; i++) {
    for (const grao of CULTURAS) {
      const d = daysAgo(i)
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      try {
        const exists = await p.cotacao.findFirst({ where: { grao, data: { gte: day, lt: new Date(day.getTime() + 86400_000) } } })
        if (exists) continue
        const base = PRECO_BASE[grao]
        await p.cotacao.create({
          data: {
            grao,
            preco: base + rand(-2, 2),
            simbolo: { soja: 'ZS', milho: 'ZC', trigo: 'ZW' }[grao],
            fonte: 'CEPEA',
            dolarReal: 4.95 + rand(-0.10, 0.10),
            open: base + rand(-1, 1),
            high: base + rand(0, 3),
            low: base - rand(0, 3),
            close: base + rand(-1.5, 1.5),
            data: day,
          },
        })
      } catch {}
    }
  }
  console.log('  cotações 30d × 3 culturas')

  // CenarioCalculadora
  for (let i = 0; i < TARGET; i++) {
    const nome = `Cenário ${i + 1}`
    const exists = await p.cenarioCalculadora.findFirst({
      where: { workspaceId: WS, userId: admin.id, nome },
    })
    if (exists) continue
    await step(`cenário ${i + 1}`, () =>
      p.cenarioCalculadora.create({
        data: {
          workspaceId: WS,
          userId: admin.id,
          nome,
          inputJson: {
            grao: pick(CULTURAS, i),
            precoBruto: PRECO_BASE[pick(CULTURAS, i)],
            quantidade: 1000 + i * 100,
            frete: 4.5,
            comissao: 1.8,
          },
          resultadoJson: {
            precoLiquido: PRECO_BASE[pick(CULTURAS, i)] * 0.85,
            totalReceber: PRECO_BASE[pick(CULTURAS, i)] * 0.85 * (1000 + i * 100),
          },
        },
      }),
    )
  }

  // Classificado
  for (let i = 0; i < TARGET; i++) {
    const exists = await p.classificado.findFirst({
      where: { workspaceId: WS, autorId: admin.id, variedade: `Lote seed ${i + 1}` },
    })
    if (exists) continue
    await step(`classificado ${i + 1}`, () =>
      p.classificado.create({
        data: {
          workspaceId: WS,
          autorId: admin.id,
          tipo: i % 2 === 0 ? 'venda' : 'compra',
          grao: pick(CULTURAS, i),
          variedade: `Lote seed ${i + 1}`,
          safra: safraAtiva?.nome || '2024/25',
          volumeSc: 500 + i * 100,
          precoSc: PRECO_BASE[pick(CULTURAS, i)],
          modal: pick(['FOB', 'CIF'], i),
          cidade: pick(['Maringá', 'Sorriso', 'Cascavel'], i),
          uf: pick(['PR', 'MT', 'PR'], i),
          status: 'ativo',
        },
      }),
    )
  }

  // ===== FASE 9: compliance & portal =====
  console.log('\n--- Fase 9: compliance & portal ---')

  // DDS / EUDR
  for (let i = 0; i < Math.min(TARGET, contratos.length); i++) {
    const num = `DDS-2025-${pad(i + 1)}`
    const exists = await p.dueDiligenceStatement.findFirst({ where: { workspaceId: WS, numero: num } })
    if (exists) continue
    await step(`DDS ${num}`, () =>
      p.dueDiligenceStatement.create({
        data: {
          workspaceId: WS,
          numero: num,
          contratoId: contratos[i].id,
          operadorNome: pick(clientesC, i)?.nome || 'Operador',
          operadorCnpj: '12.345.678/0001-90',
          operadorEndereco: 'Av. Brasil, 1500, Maringá-PR',
          cultura: pick(CULTURAS, i),
          ncm: '12019000',
          qtdToneladas: rand(60, 600),
          propriedadesOrigem: propriedades.slice(0, 2).map((pr) => ({
            propriedadeId: pr.id,
            nome: pr.nome,
            car: pr.car,
            areaHa: pr.areaTotalHa,
            carStatus: 'ativo',
          })),
          lotesEnvolvidos: lotes.slice(0, 2).map((l) => ({
            loteId: l.id,
            numero: l.numero,
            qtdSc: l.qtdAtualSc,
          })),
          riscoNivel: pick(['baixo', 'baixo', 'medio'], i),
          riscoFatores: [{ tipo: 'desmatamento', descricao: 'Sem evidência MapBiomas', gravidade: 'baixa' }],
          conclusao: pick(['aprovada', 'aprovada', 'em_revisao'], i),
        },
      }),
    )
  }

  // ListaSuja (verificação por cliente)
  for (let i = 0; i < Math.min(TARGET, clientesV.length); i++) {
    const cliente = clientesV[i]
    const exists = await p.listaSuja.findFirst({ where: { clienteId: cliente.id } })
    if (exists) continue
    await step(`listaSuja ${i + 1}`, () =>
      p.listaSuja.create({
        data: {
          lista: pick(['trabalho_escravo', 'ceis', 'cnep'], i),
          cnpjOuCpf: onlyDigits(cliente.cnpj || cliente.cpf || '00000000000000'),
          nome: cliente.nome,
          uf: 'MT',
          clienteId: cliente.id,
          workspaceId: WS,
          detalhes: { resultado: 'limpo', verificadoEm: now.toISOString() },
        },
      }),
    )
  }

  // AuditLog
  for (let i = 0; i < TARGET; i++) {
    await step(`audit ${i + 1}`, () =>
      p.auditLog.create({
        data: {
          workspaceId: WS,
          userId: admin.id,
          acao: pick(['create', 'update', 'delete', 'login', 'export'], i),
          entidade: pick(['Contrato', 'Proposta', 'Cliente', 'Boleto', 'NotaFiscal'], i),
          entidadeId: `seed-${i}`,
          mudancas: { source: 'seed', index: i },
          ipAddress: `192.168.1.${10 + i}`,
          userAgent: 'Mozilla/5.0 (Seed)',
        },
      }),
    )
  }

  console.log('\n=== Seed concluído! ===')
  await p.$disconnect()
}

main().catch((e) => {
  console.error('FATAL:', e)
  p.$disconnect()
  process.exit(1)
})
