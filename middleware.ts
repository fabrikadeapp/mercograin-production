import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth).*)'],
}

const PUBLIC_PATHS = ['/', '/precos', '/sobre', '/contato', '/legal', '/aceite']

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const path = req.nextUrl.pathname

  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/')) ||
    path.startsWith('/auth')

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (isLoggedIn && path.startsWith('/auth')) {
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
  }

  return NextResponse.next()
})
