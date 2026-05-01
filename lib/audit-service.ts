import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

interface AuditLogData {
  userId: string
  acao: 'criar' | 'atualizar' | 'deletar' | 'visualizar' | 'download'
  entidade: string
  entidadeId: string
  mudancas?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(data: AuditLogData) {
  try {
    const createData: any = {
      userId: data.userId,
      acao: data.acao,
      entidade: data.entidade,
      entidadeId: data.entidadeId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    }

    if (data.mudancas) {
      createData.mudancas = data.mudancas
    }

    await db.auditLog.create({
      data: createData,
    })
  } catch (error) {
    console.error('[Audit] Erro ao registrar ação:', error)
    // Não lançar erro para não afetar a requisição principal
  }
}

export function extractClientInfo(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  }
}

// Helper para calcular mudanças entre dois objetos
export function calculateChanges<T extends Record<string, any>>(before: T, after: T): Record<string, any> {
  const changes: Record<string, any> = {}

  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = {
        antes: before[key],
        depois: after[key],
      }
    }
  }

  return changes
}
