import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { routeToArea, canAccessArea, getDefaultRouteFor } from '@/lib/areas'

export const config = {
  // Exclui rotas que não devem passar pelo middleware (assets públicos + auth).
  // /landing — assets da landing page
  // /icons, /logos — assets diversos
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth|landing|icons|logos|manifest.json|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$).*)',
  ],
}

const PUBLIC_PATHS = ['/', '/precos', '/sobre', '/contato', '/legal', '/aceite', '/status']

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const path = req.nextUrl.pathname

  // S12 M10 — Portal Produtor: auth separada (cookie bh_portal_session).
  // /portal/[slug]/login e /portal/[slug]/setup são públicos; demais
  // /portal/* exigem o cookie do portal (validado nas próprias páginas/APIs).
  if (path.startsWith('/portal/')) {
    const sub = path.split('/').slice(3).join('/') // após /portal/{slug}/
    const isPublicPortal = sub === 'login' || sub === 'setup' || sub === ''
    if (isPublicPortal) return NextResponse.next()
    const hasPortalCookie = !!req.cookies.get('bh_portal_session')?.value
    if (!hasPortalCookie) {
      const slug = path.split('/')[2] || ''
      return NextResponse.redirect(new URL(`/portal/${slug}/login`, req.url))
    }
    return NextResponse.next()
  }

  // /playground é só pra desenvolvimento — bloqueia em produção
  if (path.startsWith('/playground') && process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/')) ||
    path.startsWith('/auth')

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (isLoggedIn && path.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Landing: usuário logado vai direto pra /dashboard
  if (isLoggedIn && path === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Onboarding redirect: user logado sem workspace
  if (isLoggedIn) {
    const u = (req.auth as any)?.user || {}
    const role = u.role
    const subStatus = u.subscriptionStatus
    const hasWorkspace = u.hasWorkspace !== false
    const onboardingCompleted = u.onboardingCompleted === true
    const isAdmin = role === 'admin'

    const isOnboardingPath = path === '/onboarding' || path.startsWith('/onboarding/')

    // ============================================================
    // SUPER-ADMIN MERCOGRAIN — guard estanque para /admin e /api/admin
    // ============================================================
    // Regras simultâneas:
    //   1. role='admin' (global)
    //   2. NÃO ter workspace (super-admin puro, sem conta de cliente)
    //   3. TOTP 2FA habilitado
    // Falhar qualquer uma redireciona pra /dashboard (ou /auth/login se
    // não logado, já tratado acima) — nunca mostra 403 pra não revelar
    // existência da rota.
    const isAdminRoute =
      path === '/admin' ||
      path.startsWith('/admin/') ||
      path === '/api/admin' ||
      path.startsWith('/api/admin/')

    if (isAdminRoute) {
      const totpEnabled = (u as any).totpEnabled === true
      const isPureSuperAdmin = isAdmin && !hasWorkspace
      if (!isPureSuperAdmin) {
        // User comum (ou admin com workspace de teste) — fora
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      if (!totpEnabled) {
        // Super-admin sem 2FA — força ativar antes
        const url = new URL('/perfil/seguranca/2fa', req.url)
        url.searchParams.set('motivo', 'super_admin_exige_2fa')
        return NextResponse.redirect(url)
      }
      // OK — segue pro layout que faz double-check via DB
      return NextResponse.next()
    }

    // Super-admin Mercograin nunca passa pelo onboarding nem assinatura —
    // ele não opera workspace nenhum, só o /admin. Manda direto pra lá.
    if (isAdmin && !hasWorkspace) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }

    if (!hasWorkspace && !isOnboardingPath && !isPublic) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }

    // Tem workspace mas não completou onboarding
    if (hasWorkspace && !onboardingCompleted && !isAdmin && !isOnboardingPath && !isPublic) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }

    // Bloqueio por assinatura
    const hasActiveAccess = isAdmin || ['trialing', 'active'].includes(subStatus)
    const isAssinaturaPath = path === '/assinatura' || path.startsWith('/assinatura/')

    if (!hasActiveAccess && !isAssinaturaPath && !isOnboardingPath && !isPublic) {
      const url = new URL('/assinatura/checkout', req.url)
      return NextResponse.redirect(url)
    }

    // Perfil RH incompleto: colaborador convidado precisa completar wizard antes
    // de acessar qualquer área do sistema. Owner/admin global ignorados — owner
    // já tem perfilCompleto setado em true via auth.config quando é dono de workspace.
    const perfilCompleto = (u as any).perfilCompleto === true
    const isPerfilCompletar =
      path === '/perfil/completar' || path.startsWith('/perfil/completar/')
    if (
      !isAdmin &&
      hasWorkspace &&
      !perfilCompleto &&
      !isPerfilCompletar &&
      !isOnboardingPath &&
      !isAssinaturaPath &&
      !isPublic &&
      !path.startsWith('/auth') &&
      !path.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/perfil/completar', req.url))
    }

    // 2FA obrigatório (políticas por workspace)
    const totpEnabled = (u as any).totpEnabled === true
    const require2FA = (u as any).workspaceRequire2FA === true
    const isWorkspaceOwner = (u as any).isWorkspaceOwner === true
    const isPerfilSeg = path.startsWith('/perfil/seguranca')
    if (
      require2FA &&
      isWorkspaceOwner &&
      !totpEnabled &&
      !isPerfilSeg &&
      !isOnboardingPath &&
      !isPublic &&
      !path.startsWith('/auth')
    ) {
      const url = new URL('/perfil/seguranca/2fa', req.url)
      url.searchParams.set('motivo', 'workspace_exige_2fa')
      return NextResponse.redirect(url)
    }

    // Bloqueio por área (Mesa / Financeiro / Fiscal / Gestão).
    // Admin global sempre passa; owner/admin do workspace também.
    if (!isAdmin && !isOnboardingPath && !isAssinaturaPath && !isPublic) {
      const area = routeToArea(path)
      if (area) {
        const accessUser = {
          globalRole: role,
          workspaceRole: u.workspaceRole ?? null,
          areasPermitidas: u.areasPermitidas ?? [],
        }
        if (!canAccessArea(accessUser, area)) {
          const dest = getDefaultRouteFor(accessUser)
          if (dest !== path) {
            return NextResponse.redirect(new URL(dest, req.url))
          }
        }
      }
    }
  }

  const res = NextResponse.next()

  // Cache-Control p/ rotas públicas — middleware sempre seta cookies (NextAuth csrf),
  // o que faz Next.js mandar private/no-cache. Forçamos público em rotas
  // de marketing pra Railway-edge/Cloudflare cachear o HTML.
  if (!isLoggedIn && isPublic && path !== '/aceite') {
    res.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
    )
  }

  return res
})
