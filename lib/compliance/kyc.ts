/**
 * S4 M1 — Orquestrador KYC unificado.
 *
 * Roda em paralelo todas as verificações de compliance disponíveis para um
 * Cliente e consolida em um veredito (`aprovado` | `pendencias` | `reprovado`).
 *
 * Regras:
 *   - Reprovado: registro em CEIS/CNEP/Trabalho Escravo confirmado (não-mock).
 *   - Pendências: dados faltantes (sem CNPJ/CPF), ou fontes em mock, ou PEP true.
 *   - Aprovado: todas as consultas retornaram limpo com fontes oficiais.
 */
import { consultarCnpj, type CnpjData } from '@/lib/br/receitaws'
import { consultarSancoesCGU, type CguResultado } from './cgu'
import {
  consultarTrabalhoEscravo,
  type TrabalhoEscravoResultado,
} from './trabalho-escravo'
import { consultarPEP, type PepResultado } from './pep'
import { consultarCAR, type SicarResultado } from '@/lib/br/sicar'

export interface KycCliente {
  id: string
  nome: string
  cpf?: string | null
  cnpj?: string | null
}

export interface KycPropriedade {
  id: string
  nome: string
  car?: string | null
}

export interface KycResultado {
  cliente: KycCliente
  status: 'aprovado' | 'pendencias' | 'reprovado'
  rodadoEm: string
  verificacoes: {
    cnpj?: { ok: boolean; dados?: CnpjData | null; erro?: string }
    cgu?: CguResultado
    trabalhoEscravo?: TrabalhoEscravoResultado
    pep?: PepResultado
    sicar?: Array<{ propriedadeId: string; nome: string; resultado: SicarResultado | null }>
  }
  alertas: string[]
}

export async function rodarKyc(
  cliente: KycCliente,
  propriedades: KycPropriedade[] = [],
): Promise<KycResultado> {
  const alertas: string[] = []
  const verificacoes: KycResultado['verificacoes'] = {}
  const documento = cliente.cnpj || cliente.cpf || ''

  // Sem documento — pendência crítica
  if (!documento) {
    return {
      cliente,
      status: 'pendencias',
      rodadoEm: new Date().toISOString(),
      verificacoes: {},
      alertas: ['Cliente sem CPF/CNPJ — KYC não pôde ser realizado.'],
    }
  }

  // Consultas em paralelo (apenas as aplicáveis)
  const tasks: Promise<any>[] = []

  if (cliente.cnpj) {
    tasks.push(
      consultarCnpj(cliente.cnpj)
        .then((dados) => {
          verificacoes.cnpj = { ok: !!dados, dados }
          if (!dados) alertas.push('Não foi possível consultar dados públicos do CNPJ.')
          else if (dados.situacao && dados.situacao.toUpperCase() !== 'ATIVA')
            alertas.push(`CNPJ com situação "${dados.situacao}".`)
        })
        .catch((e) => {
          verificacoes.cnpj = { ok: false, erro: e?.message || 'erro' }
          alertas.push('Erro ao consultar CNPJ.')
        }),
    )
    tasks.push(
      consultarSancoesCGU(cliente.cnpj).then((r) => {
        verificacoes.cgu = r
        if (r.ceis.temRegistro) alertas.push(`CNPJ com restrição CEIS (${r.ceis.registros.length}).`)
        if (r.cnep.temRegistro) alertas.push(`CNPJ com restrição CNEP (${r.cnep.registros.length}).`)
        if (r.cepim.temRegistro) alertas.push(`CNPJ com restrição CEPIM (${r.cepim.registros.length}).`)
        if (r.fonte === 'mock')
          alertas.push('CGU em modo mock: configurar CGU_API_TOKEN para validação oficial.')
      }),
    )
  }

  tasks.push(
    consultarTrabalhoEscravo(documento).then((r) => {
      verificacoes.trabalhoEscravo = r
      if (r.temRegistro)
        alertas.push(`Documento consta em lista de trabalho escravo (${r.registros.length}).`)
      if (r.fonte === 'mock')
        alertas.push('Lista de trabalho escravo em modo mock: sync de cron pendente.')
    }),
  )

  tasks.push(
    consultarPEP(documento).then((r) => {
      verificacoes.pep = r
      if (r.pep) alertas.push(`PEP detectado: ${r.cargo || 'cargo não informado'}.`)
    }),
  )

  if (propriedades.length > 0) {
    tasks.push(
      Promise.all(
        propriedades
          .filter((p) => p.car)
          .map(async (p) => ({
            propriedadeId: p.id,
            nome: p.nome,
            resultado: await consultarCAR(p.car!),
          })),
      ).then((arr) => {
        verificacoes.sicar = arr
        for (const item of arr) {
          if (!item.resultado) alertas.push(`CAR inválido em ${item.nome}.`)
          else if (item.resultado.fonte === 'mock')
            alertas.push(`CAR de ${item.nome} sem validação SICAR oficial (mock).`)
          else if (item.resultado.status === 'cancelado')
            alertas.push(`CAR de ${item.nome} CANCELADO.`)
        }
      }),
    )
  }

  await Promise.allSettled(tasks)

  // Decisão de status
  const reprovado =
    verificacoes.cgu?.ceis.temRegistro ||
    verificacoes.cgu?.cnep.temRegistro ||
    verificacoes.cgu?.cepim.temRegistro ||
    verificacoes.trabalhoEscravo?.temRegistro

  let status: KycResultado['status']
  if (reprovado) status = 'reprovado'
  else if (alertas.length > 0) status = 'pendencias'
  else status = 'aprovado'

  return {
    cliente,
    status,
    rodadoEm: new Date().toISOString(),
    verificacoes,
    alertas,
  }
}
