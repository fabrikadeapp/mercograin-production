/**
 * GET /api/backups - List all backups
 * POST /api/backups - Trigger manual backup
 * Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  listBackups,
  runFullBackup,
  deleteBackup,
} from '@/lib/backup-service'
import { checkRateLimit, DEFAULT_LIMITS } from '@/lib/rate-limiter-v2'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }

    // Check for delete action
    const { searchParams } = new URL(request.url)
    const deleteFile = searchParams.get('delete')

    if (deleteFile) {
      const result = await deleteBackup(deleteFile)
      return NextResponse.json(result)
    }

    // List backups
    const result = await listBackups()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error listing backups:', error)
    return NextResponse.json(
      {
        error: 'Erro ao listar backups',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }
    // Rate limit: max 5 backups per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const rateLimitKey = `api:backup:${ip}`
    const rateLimitResult = await checkRateLimit(rateLimitKey, DEFAULT_LIMITS['api:backup'])

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Limite de 5 backups por hora atingido',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': (rateLimitResult.retryAfter || 60).toString(),
          },
        }
      )
    }

    console.log('[API] Iniciando backup manual...')

    const result = await runFullBackup()

    return NextResponse.json({
      success: 'duration' in result,
      message: 'Backup iniciado com sucesso',
      ...result,
    })
  } catch (error) {
    console.error('Error running backup:', error)
    return NextResponse.json(
      {
        error: 'Erro ao executar backup',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
