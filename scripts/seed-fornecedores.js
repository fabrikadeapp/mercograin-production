/**
 * Seed de fornecedores demo no workspace do admin@mercograin.com.
 * Idempotente via combinação (workspaceId, razaoSocial).
 *
 * Uso: DATABASE_URL="..." node scripts/seed-fornecedores.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const FORNECEDORES = [
  {
    tipo: 'transportadora',
    razaoSocial: 'Transportadora ABC Ltda',
    nomeFantasia: 'Transportadora ABC',
    cnpj: '12.345.678/0001-90',
    contato: 'Carlos Souza',
    telefone: '(65) 9 9123-4567',
    email: 'comercial@transportadoraabc.com.br',
    endereco: 'Av. Brasil, 1500',
    cidade: 'Cuiabá',
    uf: 'MT',
    observacao: 'Atende toda região Centro-Oeste com 50 caminhões.',
    metadata: {
      placaPrincipal: 'OAB1234',
      antt: '12345678',
      frota: 50,
      regiaoCobertura: 'MT, MS, GO',
    },
  },
  {
    tipo: 'transportadora',
    razaoSocial: 'Logística Sul Transportes S.A.',
    nomeFantasia: 'Logística Sul',
    cnpj: '23.456.789/0001-01',
    contato: 'Roberto Müller',
    telefone: '(51) 9 8765-4321',
    email: 'op@logisticasul.com.br',
    endereco: 'Rua dos Andradas, 200',
    cidade: 'Porto Alegre',
    uf: 'RS',
    observacao: 'Especializada em rota Sul → Porto de Rio Grande.',
    metadata: {
      antt: '87654321',
      frota: 30,
      regiaoCobertura: 'RS, SC, PR',
    },
  },
  {
    tipo: 'armazem',
    razaoSocial: 'Cargill Armazenagem Brasil',
    nomeFantasia: 'Cargill Armazéns',
    cnpj: '34.567.890/0001-12',
    contato: 'Patrícia Lima',
    telefone: '(65) 3 3030-2020',
    email: 'armazem.mt@cargill.com',
    endereco: 'Rod. BR-163, KM 720',
    cidade: 'Sorriso',
    uf: 'MT',
    observacao: 'Capacidade 250.000 sacas, certificada.',
    metadata: {
      capacidadeSc: 250000,
      tipoArmazem: 'silo',
      municipioOperacao: 'Sorriso',
    },
  },
  {
    tipo: 'armazem',
    razaoSocial: 'Silo Cooperativa Agroeste',
    nomeFantasia: 'Coop Agroeste',
    cnpj: '45.678.901/0001-23',
    contato: 'José Pereira',
    telefone: '(44) 3 3210-9876',
    email: 'silo@agroeste.coop.br',
    endereco: 'Av. Paraná, 800',
    cidade: 'Maringá',
    uf: 'PR',
    observacao: 'Silo cooperativa, 80.000 sc.',
    metadata: {
      capacidadeSc: 80000,
      tipoArmazem: 'silo',
      municipioOperacao: 'Maringá',
    },
  },
  {
    tipo: 'insumos',
    razaoSocial: 'Bayer S.A.',
    nomeFantasia: 'Bayer Crop Science',
    cnpj: '56.789.012/0001-34',
    contato: 'Mariana Alves',
    telefone: '(11) 9 9000-1234',
    email: 'comercial.br@bayer.com',
    endereco: 'Rua Domingos Jorge, 1100',
    cidade: 'São Paulo',
    uf: 'SP',
    observacao: 'Defensivos e sementes.',
    metadata: {
      produtosPrincipais: 'Glifosato, Sementes de soja, Fungicidas',
    },
  },
  {
    tipo: 'insumos',
    razaoSocial: 'Syngenta Proteção de Cultivos',
    nomeFantasia: 'Syngenta',
    cnpj: '67.890.123/0001-45',
    contato: 'Felipe Costa',
    telefone: '(11) 9 8888-5555',
    email: 'br.contato@syngenta.com',
    endereco: 'Av. Nações Unidas, 14401',
    cidade: 'São Paulo',
    uf: 'SP',
    observacao: 'Defensivos premium.',
    metadata: {
      produtosPrincipais: 'Herbicidas, Inseticidas, Fungicidas',
    },
  },
  {
    tipo: 'certificadora',
    razaoSocial: 'SGS do Brasil Ltda',
    nomeFantasia: 'SGS Brasil',
    cnpj: '78.901.234/0001-56',
    contato: 'Ana Beatriz',
    telefone: '(11) 9 7777-3333',
    email: 'agri.br@sgs.com',
    endereco: 'Av. Andromeda, 832',
    cidade: 'Barueri',
    uf: 'SP',
    observacao: 'Certificadora internacional.',
    metadata: {
      certificacoes: 'ISO 9001, RTRS, ProTerra, 2BSvs',
    },
  },
  {
    tipo: 'certificadora',
    razaoSocial: 'Bureau Veritas Brasil',
    nomeFantasia: 'Bureau Veritas',
    cnpj: '89.012.345/0001-67',
    contato: 'Leonardo Martins',
    telefone: '(21) 9 6666-2222',
    email: 'agri.br@bureauveritas.com',
    endereco: 'Av. Marechal Câmara, 160',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    observacao: 'Inspeção e certificação de commodities.',
    metadata: {
      certificacoes: 'ISCC, RTRS, ProTerra, FSC',
    },
  },
]

async function main() {
  const adminEmail = 'admin@mercograin.com'
  const user = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!user) {
    throw new Error(
      `Usuário admin "${adminEmail}" não encontrado. Crie-o antes de rodar este seed.`
    )
  }

  // Pega primeiro workspace owned, ou primeira membership ativa
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'asc' },
  })

  if (!workspace) {
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    })
    workspace = member?.workspace ?? null
  }

  if (!workspace) {
    throw new Error(
      `Nenhum workspace encontrado para "${adminEmail}". Crie um workspace antes.`
    )
  }

  console.log(`→ Usando workspace ${workspace.id} (${workspace.name || ''})`)

  let created = 0
  let updated = 0
  for (const f of FORNECEDORES) {
    const existing = await prisma.fornecedor.findFirst({
      where: { workspaceId: workspace.id, razaoSocial: f.razaoSocial },
    })
    if (existing) {
      await prisma.fornecedor.update({
        where: { id: existing.id },
        data: {
          tipo: f.tipo,
          nomeFantasia: f.nomeFantasia,
          cnpj: f.cnpj,
          contato: f.contato,
          telefone: f.telefone,
          email: f.email,
          endereco: f.endereco,
          cidade: f.cidade,
          uf: f.uf,
          observacao: f.observacao,
          ativo: true,
          metadata: f.metadata,
        },
      })
      updated++
    } else {
      await prisma.fornecedor.create({
        data: {
          workspaceId: workspace.id,
          tipo: f.tipo,
          razaoSocial: f.razaoSocial,
          nomeFantasia: f.nomeFantasia,
          cnpj: f.cnpj,
          contato: f.contato,
          telefone: f.telefone,
          email: f.email,
          endereco: f.endereco,
          cidade: f.cidade,
          uf: f.uf,
          observacao: f.observacao,
          ativo: true,
          metadata: f.metadata,
        },
      })
      created++
    }
  }

  console.log(`✓ Seed concluído: ${created} criados, ${updated} atualizados.`)
}

main()
  .catch((err) => {
    console.error('Erro no seed-fornecedores:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
