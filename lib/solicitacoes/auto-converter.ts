/**
 * Auto-conversão de SolicitacaoCotacao em Proposta usando cotação CEPEA.
 *
 * Regras:
 *  - Grão conhecido (soja/milho/trigo) + quantidade > 0 + cotação CEPEA disponível
 *    → cria Proposta status 'rascunho' e marca solicitação como 'em_analise'
 *  - Caso contrário → mantém solicitação 'pendente' (vai para o card "Não processadas")
 *
 * A proposta criada fica em rascunho — o humano da corretora revisa antes de
 * enviar para o cliente.
 */
import { db } from '@/lib/db'
import { fetchCepeaQuote, type CepeaLabel } from '@/lib/quotes/cepea'
import { nextNumber } from '@/lib/numbering/next-number'
import type { SolicitacaoCotacao } from '@prisma/client'

export interface AutoConvertResult {
  ok: boolean
  motivo?: 'grao_nao_suportado' | 'sem_cotacao' | 'quantidade_invalida' | 'erro_interno'
  propostaId?: string
  propostaNumero?: string
  preco?: number
  valorTotal?: number
}

const SUPPORTED: CepeaLabel[] = ['soja', 'milho', 'trigo']

export async function autoConverterSolicitacao(
  sol: SolicitacaoCotacao,
): Promise<AutoConvertResult> {
  try {
    const grao = sol.grao.toLowerCase() as CepeaLabel
    if (!SUPPORTED.includes(grao)) {
      return { ok: false, motivo: 'grao_nao_suportado' }
    }
    const qtd = Number(sol.quantidade)
    if (!Number.isFinite(qtd) || qtd <= 0) {
      return { ok: false, motivo: 'quantidade_invalida' }
    }

    const cepea = await fetchCepeaQuote(grao).catch(() => null)
    if (!cepea || !cepea.precoSc60) {
      return { ok: false, motivo: 'sem_cotacao' }
    }

    // Preço fechado = cotação CEPEA atual em R$/sc (60kg).
    // Convertendo para a unidade da solicitação:
    //   - 't' (tonelada) = 1000 kg = 16.667 sacas (1000/60)
    //   - 'sc' = 1 saca
    const precoSc = cepea.precoSc60
    const isTon = sol.unidade === 't'
    const preco = isTon ? precoSc * (1000 / 60) : precoSc
    const subtotal = qtd * preco

    const cliente = await db.cliente.findFirst({
      where: { id: sol.clienteId, workspaceId: sol.workspaceId },
      select: { id: true, responsavelId: true },
    })
    if (!cliente) return { ok: false, motivo: 'erro_interno' }

    const numero = await nextNumber(sol.workspaceId, 'proposta')

    const proposta = await db.proposta.create({
      data: {
        numero,
        clienteId: sol.clienteId,
        workspaceId: sol.workspaceId,
        tipo: sol.tipo,
        graos: [
          {
            grao,
            quantidade: qtd,
            unidade: sol.unidade,
            preco,
            subtotal,
            cotacaoOrigem: 'CEPEA',
            cotacaoData: cepea.dataReferencia,
          },
        ],
        valorTotal: String(subtotal),
        // status 'rascunho' = aguardando revisão do humano
        status: 'rascunho',
        descricao: `Proposta gerada automaticamente a partir da solicitação ${sol.id} · preço cruzado com CEPEA (${cepea.dataReferencia})`,
        validadeEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        validadeCotacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        canalAutorizacao: 'web',
        origem: 'portal_solicitacao_auto',
        localEntrega: sol.localEntrega ?? undefined,
        gerenteContaId: cliente.responsavelId ?? null,
      },
    })

    await db.solicitacaoCotacao.update({
      where: { id: sol.id },
      data: {
        status: 'em_analise',
        propostaId: proposta.id,
        respondidoEm: new Date(),
      },
    })

    return {
      ok: true,
      propostaId: proposta.id,
      propostaNumero: proposta.numero,
      preco,
      valorTotal: subtotal,
    }
  } catch (err) {
    console.warn('[autoConverterSolicitacao] falhou:', err)
    return { ok: false, motivo: 'erro_interno' }
  }
}
