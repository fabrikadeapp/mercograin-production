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
