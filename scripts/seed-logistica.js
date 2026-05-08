/**
 * Seed da Logística: 3 armazéns + 5 motoristas + 6 ordens de carga
 * vinculadas ao workspace do admin@mercograin.com.
 *
 * Uso: DATABASE_URL="..." node scripts/seed-logistica.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@mercograin.com' } })
  if (!admin) {
    console.error('Usuário admin@mercograin.com não encontrado')
    process.exit(1)
  }
  const workspace = await prisma.workspace.findFirst({ where: { ownerId: admin.id } })
  if (!workspace) {
    console.error('Workspace do admin não encontrado')
    process.exit(1)
  }
  const wsId = workspace.id
  console.log(`Seedeando logística no workspace ${workspace.name} (${wsId})`)

  // Pegar fornecedores existentes
  const transportadoras = await prisma.fornecedor.findMany({
    where: { workspaceId: wsId, tipo: 'transportadora', ativo: true },
    take: 2,
    orderBy: { razaoSocial: 'asc' },
  })
  if (transportadoras.length < 2) {
    console.warn(`Apenas ${transportadoras.length} transportadora(s) encontradas. Continuando...`)
  }
  const armazemFornecedores = await prisma.fornecedor.findMany({
    where: { workspaceId: wsId, tipo: 'armazem', ativo: true },
    take: 1,
  })

  // Cliente e contrato (opcionais)
  const cliente = await prisma.cliente.findFirst({ where: { workspaceId: wsId, ativo: true } })
  const contrato = await prisma.contrato.findFirst({ where: { workspaceId: wsId } })

  // ─── Armazéns ─────────────────────────────────────────────
  const armazensData = [
    {
      nome: 'Armazém Sorriso · Sede',
      tipo: 'silo',
      capacidadeSc: 100000,
      cidade: 'Sorriso',
      uf: 'MT',
      cep: '78890-000',
      endereco: 'Rod. MT-242, km 35',
      contato: 'Operador 24h',
      telefone: '(66) 3544-1000',
      proprio: true,
      ativo: true,
      workspaceId: wsId,
    },
    {
      nome: 'Terminal Paranaguá',
      tipo: 'horizontal',
      capacidadeSc: 250000,
      cidade: 'Paranaguá',
      uf: 'PR',
      endereco: 'Cais do Porto · Terminal 3',
      contato: 'Despachante',
      telefone: '(41) 3422-9000',
      proprio: false,
      fornecedorId: armazemFornecedores[0]?.id ?? null,
      ativo: true,
      workspaceId: wsId,
    },
    {
      nome: 'Silo Cascavel · Filial PR',
      tipo: 'silo',
      capacidadeSc: 60000,
      cidade: 'Cascavel',
      uf: 'PR',
      cep: '85800-000',
      endereco: 'BR-277, km 580',
      proprio: true,
      ativo: true,
      workspaceId: wsId,
    },
  ]

  const armazensCriados = []
  for (const a of armazensData) {
    const existing = await prisma.armazem.findFirst({ where: { workspaceId: wsId, nome: a.nome } })
    if (existing) {
      armazensCriados.push(existing)
    } else {
      armazensCriados.push(await prisma.armazem.create({ data: a }))
    }
  }
  console.log(`✔ Armazéns: ${armazensCriados.length}`)

  // ─── Motoristas ───────────────────────────────────────────
  const motoristasData = [
    {
      nome: 'José Aparecido da Silva',
      cpf: '123.456.789-00',
      cnh: '01234567890',
      cnhCategoria: 'E',
      telefone: '(65) 99988-1100',
      whatsapp: '(65) 99988-1100',
      placa: 'KQX-1A23',
      veiculo: 'Volvo FH 540 · Bitrem',
      capacidadeSc: 700,
      transportadoraId: transportadoras[0]?.id ?? null,
      ativo: true,
      workspaceId: wsId,
    },
    {
      nome: 'Carlos Henrique Rocha',
      cpf: '234.567.890-11',
      cnh: '02345678901',
      cnhCategoria: 'E',
      telefone: '(66) 99877-2200',
      placa: 'PXR-2B34',
      veiculo: 'Scania R450 · Carreta',
      capacidadeSc: 600,
      transportadoraId: transportadoras[0]?.id ?? null,
      ativo: true,
      workspaceId: wsId,
    },
    {
      nome: 'Marcelo dos Santos',
      cpf: '345.678.901-22',
      cnh: '03456789012',
      cnhCategoria: 'E',
      telefone: '(51) 99766-3300',
      placa: 'IXF-3C45',
      veiculo: 'Mercedes Actros 2651 · Bitrem',
      capacidadeSc: 720,
      transportadoraId: transportadoras[1]?.id ?? transportadoras[0]?.id ?? null,
      ativo: true,
      workspaceId: wsId,
    },
    {
      nome: 'Anderson Felipe Lima',
      cpf: '456.789.012-33',
      cnh: '04567890123',
      cnhCategoria: 'E',
      telefone: '(51) 99655-4400',
      placa: 'JBC-4D56',
      veiculo: 'Volvo FM 460 · Carreta',
      capacidadeSc: 580,
      transportadoraId: transportadoras[1]?.id ?? transportadoras[0]?.id ?? null,
      ativo: true,
      workspaceId: wsId,
    },
    {
      nome: 'Paulo César Ribeiro',
      cpf: '567.890.123-44',
      cnh: '05678901234',
      cnhCategoria: 'D',
      telefone: '(65) 99544-5500',
      placa: 'NRT-5E67',
      veiculo: 'Iveco Stralis · Truck',
      capacidadeSc: 350,
      transportadoraId: transportadoras[0]?.id ?? null,
      ativo: true,
      workspaceId: wsId,
    },
  ]

  const motoristasCriados = []
  for (const m of motoristasData) {
    const existing = await prisma.motorista.findFirst({ where: { workspaceId: wsId, cpf: m.cpf } })
    if (existing) {
      motoristasCriados.push(existing)
    } else {
      motoristasCriados.push(await prisma.motorista.create({ data: m }))
    }
  }
  console.log(`✔ Motoristas: ${motoristasCriados.length}`)

  // ─── Ordens de Carga ──────────────────────────────────────
  const dia = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return d
  }

  const baseSeq = await prisma.ordemCarga.count({ where: { workspaceId: wsId } })
  if (baseSeq >= 6) {
    console.log(`✔ Ordens já existem (${baseSeq}). Skip seed de ordens.`)
    return
  }

  const ano = new Date().getFullYear()
  const start = baseSeq

  const ordensData = [
    // 2 agendadas (futuro)
    {
      _seq: start + 1,
      dataAgendada: dia(7),
      grao: 'soja',
      quantidadeSc: 700,
      pesoToneladas: 42,
      status: 'agendada',
      armazemOrigemId: armazensCriados[0].id,
      armazemDestinoId: armazensCriados[1].id,
      motoristaId: motoristasCriados[0].id,
      transportadoraId: transportadoras[0]?.id ?? null,
    },
    {
      _seq: start + 2,
      dataAgendada: dia(15),
      grao: 'milho',
      quantidadeSc: 600,
      pesoToneladas: 36,
      status: 'agendada',
      armazemOrigemId: armazensCriados[2].id,
      armazemDestinoId: armazensCriados[1].id,
      motoristaId: motoristasCriados[1].id,
      transportadoraId: transportadoras[0]?.id ?? null,
    },
    // 2 em trânsito
    {
      _seq: start + 3,
      dataAgendada: dia(-2),
      dataCarregamento: dia(-2),
      grao: 'soja',
      quantidadeSc: 720,
      pesoToneladas: 43.2,
      status: 'em_transito',
      armazemOrigemId: armazensCriados[0].id,
      armazemDestinoId: armazensCriados[1].id,
      motoristaId: motoristasCriados[2].id,
      transportadoraId: transportadoras[1]?.id ?? transportadoras[0]?.id ?? null,
      ctEnumero: '35260512345678000123550010000001231',
      ctEdataEmissao: dia(-2),
    },
    {
      _seq: start + 4,
      dataAgendada: dia(-3),
      dataCarregamento: dia(-1),
      grao: 'milho',
      quantidadeSc: 580,
      pesoToneladas: 34.8,
      status: 'em_transito',
      armazemOrigemId: armazensCriados[2].id,
      armazemDestinoId: armazensCriados[1].id,
      motoristaId: motoristasCriados[3].id,
      transportadoraId: transportadoras[1]?.id ?? transportadoras[0]?.id ?? null,
    },
    // 2 entregues
    {
      _seq: start + 5,
      dataAgendada: dia(-20),
      dataCarregamento: dia(-19),
      dataDescarga: dia(-15),
      grao: 'soja',
      quantidadeSc: 700,
      pesoToneladas: 42,
      status: 'entregue',
      armazemOrigemId: armazensCriados[0].id,
      armazemDestinoId: armazensCriados[1].id,
      motoristaId: motoristasCriados[0].id,
      transportadoraId: transportadoras[0]?.id ?? null,
      ctEnumero: '35260512345678000123550010000001230',
      ctEdataEmissao: dia(-19),
    },
    {
      _seq: start + 6,
      dataAgendada: dia(-12),
      dataCarregamento: dia(-11),
      dataDescarga: dia(-7),
      grao: 'milho',
      quantidadeSc: 350,
      pesoToneladas: 21,
      status: 'entregue',
      armazemOrigemId: armazensCriados[2].id,
      armazemDestinoId: armazensCriados[1].id,
      motoristaId: motoristasCriados[4].id,
      transportadoraId: transportadoras[0]?.id ?? null,
    },
  ]

  for (const o of ordensData) {
    const numero = `OC-${ano}-${String(o._seq).padStart(3, '0')}`
    delete o._seq
    await prisma.ordemCarga.create({
      data: {
        numero,
        workspaceId: wsId,
        contratoId: contrato?.id ?? null,
        clienteId: cliente?.id ?? null,
        ...o,
      },
    })
  }
  console.log(`✔ Ordens de carga: ${ordensData.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
