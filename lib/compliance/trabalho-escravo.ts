/**
 * S4 M1 — Consulta Cadastro de Empregadores (trabalho escravo).
 *
 * Lista oficial publicada trimestralmente pelo Ministério do Trabalho:
 *   https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/areas-de-atuacao/cadastro-de-empregadores
 *
 * Lista é também consolidada pelo SmartLab (https://smartlabbr.org/trabalhoescravo).
 *
 * Estratégia: lookup local em tabela `ListaSuja` (lista='trabalho_escravo'),
 * populada por cron mensal `/api/cron/sync-listas-suja`.
 *
 * Para MVP, sem cron rodando, retorna sempre `{ temRegistro: false, fonte: 'mock' }`
 * — estrutura pronta para quando a lista for importada.
 */
import { db } from '@/lib/db'

export interface TrabalhoEscravoRegistro {
  nome: string
  uf: string
  municipio: string
  periodoFiscalizacao?: string
}

export interface TrabalhoEscravoResultado {
  cnpjOuCpf: string
  consultadoEm: string
  temRegistro: boolean
  registros: TrabalhoEscravoRegistro[]
  fonte: 'smartlab' | 'gov_br' | 'mock'
}

export async function consultarTrabalhoEscravo(
  cnpjOuCpf: string,
): Promise<TrabalhoEscravoResultado> {
  const clean = (cnpjOuCpf || '').replace(/\D/g, '')

  if (!clean || (clean.length !== 11 && clean.length !== 14)) {
    return {
      cnpjOuCpf: clean,
      consultadoEm: new Date().toISOString(),
      temRegistro: false,
      registros: [],
      fonte: 'mock',
    }
  }

  let matches: any[] = []
  try {
    matches = await db.listaSuja.findMany({
      where: { cnpjOuCpf: clean, lista: 'trabalho_escravo' },
    })
  } catch {
    matches = []
  }

  const registros: TrabalhoEscravoRegistro[] = matches.map((m) => {
    const det = (m.detalhes as Record<string, any>) || {}
    return {
      nome: m.nome,
      uf: m.uf || '',
      municipio: m.municipio || '',
      periodoFiscalizacao: det.periodoFiscalizacao,
    }
  })

  return {
    cnpjOuCpf: clean,
    consultadoEm: new Date().toISOString(),
    temRegistro: registros.length > 0,
    registros,
    // fonte 'mock' quando nada importado ainda — sinaliza degradação.
    fonte: registros.length > 0 ? 'gov_br' : 'mock',
  }
}
