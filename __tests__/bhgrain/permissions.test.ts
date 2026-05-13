import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, effectivePermissions, requirePermission, isCommercialRole } from '../../lib/bhgrain/permissions'

test('global admin pode tudo', () => {
  assert.equal(can({ workspaceRole: 'viewer', isGlobalAdmin: true }, 'manage_commercial_rules'), true)
  assert.equal(can({ workspaceRole: 'viewer', isGlobalAdmin: true }, 'import_data'), true)
})

test('owner workspace pode tudo via fallback', () => {
  assert.equal(can({ workspaceRole: 'owner' }, 'manage_goal'), true)
  assert.equal(can({ workspaceRole: 'owner' }, 'approve_proposal'), true)
})

test('viewer só lê', () => {
  assert.equal(can({ workspaceRole: 'viewer' }, 'view_dashboard'), true)
  assert.equal(can({ workspaceRole: 'viewer' }, 'create_proposal'), false)
  assert.equal(can({ workspaceRole: 'viewer' }, 'manage_margin'), false)
})

test('commercialRole tem precedência sobre workspaceRole', () => {
  // Member que é "leitura" comercial não pode criar proposta, mesmo sendo member
  assert.equal(can({ workspaceRole: 'member', commercialRole: 'leitura' }, 'create_proposal'), false)
  // Mas pode ver
  assert.equal(can({ workspaceRole: 'member', commercialRole: 'leitura' }, 'view_dashboard'), true)
})

test('vendedor cria mas não aprova proposta', () => {
  const ctx = { workspaceRole: 'member', commercialRole: 'vendedor' }
  assert.equal(can(ctx, 'create_proposal'), true)
  assert.equal(can(ctx, 'send_proposal'), true)
  assert.equal(can(ctx, 'approve_proposal'), false)
  assert.equal(can(ctx, 'manage_margin'), false)
})

test('financeiro vê dashboard, gerencia meta, não envia proposta', () => {
  const ctx = { workspaceRole: 'member', commercialRole: 'financeiro' }
  assert.equal(can(ctx, 'view_financials'), true)
  assert.equal(can(ctx, 'manage_goal'), true)
  assert.equal(can(ctx, 'send_proposal'), false)
  assert.equal(can(ctx, 'create_proposal'), false)
})

test('operador vê e processa inbox, não envia proposta', () => {
  const ctx = { workspaceRole: 'member', commercialRole: 'operador' }
  assert.equal(can(ctx, 'view_inbox'), true)
  assert.equal(can(ctx, 'process_inbox'), true)
  assert.equal(can(ctx, 'send_proposal'), false)
})

test('gestor aprova proposta e gerencia regras', () => {
  const ctx = { workspaceRole: 'member', commercialRole: 'gestor' }
  assert.equal(can(ctx, 'approve_proposal'), true)
  assert.equal(can(ctx, 'manage_commercial_rules'), true)
  assert.equal(can(ctx, 'manage_margin'), true)
})

test('trader cria e envia, mas não aprova nem mexe em regras', () => {
  const ctx = { workspaceRole: 'member', commercialRole: 'trader' }
  assert.equal(can(ctx, 'create_proposal'), true)
  assert.equal(can(ctx, 'send_proposal'), true)
  assert.equal(can(ctx, 'approve_proposal'), false)
  assert.equal(can(ctx, 'manage_commercial_rules'), false)
})

test('requirePermission lança erro quando negado', () => {
  assert.throws(
    () => requirePermission({ workspaceRole: 'viewer' }, 'create_proposal'),
    /Acesso negado/
  )
})

test('isCommercialRole valida strings', () => {
  assert.equal(isCommercialRole('gestor'), true)
  assert.equal(isCommercialRole('admin'), false)
  assert.equal(isCommercialRole(null), false)
  assert.equal(isCommercialRole(undefined), false)
})

test('effectivePermissions vazio para role inválida', () => {
  assert.equal(effectivePermissions({ workspaceRole: 'inexistente' }).length, 0)
})
