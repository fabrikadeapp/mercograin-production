/**
 * Helpers de orquestração — criar Aprovacao a partir de uma entidade.
 * Multi-tenancy estrita.
 */
import { db } from '@/lib/db'
import {
  deveDispararWorkflow,
  calcularPrazoInicial,
  AprovacaoEntidade,
  EntidadeTrigger,
} from './aprovacao'

export interface CriarAprovacaoInput {
  workspaceId: string
  solicitanteId: string
  entidade: EntidadeTrigger & { tipo: AprovacaoEntidade; id: string }
  snapshot: any
  observacoes?: string
}

/**
 * Verifica se há workflow ativo aplicável e cria Aprovacao se houver.
 * Retorna a aprovação criada (ou null se nenhum workflow se aplica).
 */
export async function tryIniciarAprovacao(
  input: CriarAprovacaoInput
): Promise<{ aprovacao: any; workflow: any } | null> {
  const workflows = await db.aprovacaoWorkflow.findMany({
    where: {
      workspaceId: input.workspaceId,
      entidade: input.entidade.tipo,
      ativo: true,
    },
  })

  const aplicavel = workflows.find((w) =>
    deveDispararWorkflow(
      { entidade: w.entidade, condicao: w.condicao, ativo: w.ativo },
      {
        tipo: input.entidade.tipo,
        valorTotal: input.entidade.valorTotal,
        qtdSc: input.entidade.qtdSc,
      }
    )
  )
  if (!aplicavel) return null

  const etapas = Array.isArray(aplicavel.etapas)
    ? (aplicavel.etapas as any[])
    : []
  const totalEtapas = etapas.length
  if (totalEtapas === 0) return null

  const aprovacao = await db.aprovacao.create({
    data: {
      workspaceId: input.workspaceId,
      workflowId: aplicavel.id,
      entidadeTipo: input.entidade.tipo,
      entidadeId: input.entidade.id,
      snapshot: input.snapshot,
      etapaAtual: 1,
      totalEtapas,
      status: 'pendente',
      solicitanteId: input.solicitanteId,
      prazoEtapaAtual: calcularPrazoInicial(aplicavel.slaHoras),
      observacoes: input.observacoes,
    },
  })

  return { aprovacao, workflow: aplicavel }
}

/**
 * Callback chamado quando uma aprovação atinge status 'aprovada'.
 * Ativa a entidade real conforme o tipo.
 */
export async function ativarEntidadeAprovada(
  entidadeTipo: string,
  entidadeId: string
): Promise<void> {
  switch (entidadeTipo) {
    case 'contrato':
      await db.contrato.update({
        where: { id: entidadeId },
        data: { statusAprovacao: 'aprovado' },
      })
      break
    case 'cliente':
      // QW5 — cadastro de cliente aprovado pelo workflow
      await db.cliente.update({
        where: { id: entidadeId },
        data: { statusCadastral: 'aprovado' } as any,
      })
      break
    // Outras entidades podem ser plugadas aqui (fixacao, washout, etc)
    default:
      break
  }
}

/**
 * Callback de rejeição.
 */
export async function rejeitarEntidade(
  entidadeTipo: string,
  entidadeId: string
): Promise<void> {
  switch (entidadeTipo) {
    case 'contrato':
      await db.contrato.update({
        where: { id: entidadeId },
        data: { statusAprovacao: 'rejeitado' },
      })
      break
    case 'cliente':
      await db.cliente.update({
        where: { id: entidadeId },
        data: { statusCadastral: 'rejeitado' } as any,
      })
      break
    default:
      break
  }
}
