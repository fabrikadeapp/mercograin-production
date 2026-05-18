import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/security/rate-limit'

export const authConfig = {
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt' as const,
    // TTL curto (4h) pra invalidar membership desligado mais rápido
    maxAge: 60 * 60 * 4,
    // Renova se a sessão estiver dentro da última hora
    updateAge: 60 * 60,
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const pathname = request.nextUrl.pathname
      const isOnAuthPage = pathname.startsWith('/auth')

      if (isOnAuthPage) {
        return !isLoggedIn
      }

      return isLoggedIn
    },
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.id = user.id
        token.email = user.email
        ;(token as any).refreshedAt = 0 // força refresh logo na primeira validação após login
      }
      // Cache: só recarrega dados do DB se passaram >60s OU se foi pedido refresh
      // explicito via update() OU se ainda não foi refrescado nesta sessão.
      // Antes: hit no DB a cada request (~1.5-2s no TTFB).
      const REFRESH_TTL_MS = 60_000
      const lastRefresh = ((token as any).refreshedAt as number) ?? 0
      const isStale = Date.now() - lastRefresh > REFRESH_TTL_MS
      const forced = trigger === 'update' || trigger === 'signIn' || trigger === 'signUp'
      const needsRefresh = !!user || forced || isStale
      if (token.id && needsRefresh) {
        try {
          const u = await db.user.findUnique({
            where: { id: token.id as string },
            select: {
              role: true,
              totpEnabled: true,
              perfilCompleto: true,
              workspacesOwned: {
                select: {
                  id: true,
                  onboardingCompletedAt: true,
                  require2FA: true,
                  subscription: { select: { status: true, trialEnd: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
              workspaceMemberships: {
                where: { status: 'active' },
                select: {
                  id: true,
                  role: true,
                  areasPermitidas: true,
                  workspaceId: true,
                },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          })
          if (u) {
            const ownedWs = u.workspacesOwned[0]
            const sub = ownedWs?.subscription
            token.role = u.role
            token.subscriptionStatus = sub?.status || 'none'
            token.trialEnd = sub?.trialEnd?.toISOString() || null
            token.hasWorkspace =
              u.workspacesOwned.length > 0 || u.workspaceMemberships.length > 0
            token.onboardingCompleted = !!ownedWs?.onboardingCompletedAt
            ;(token as any).totpEnabled = !!u.totpEnabled
            ;(token as any).workspaceRequire2FA = !!ownedWs?.require2FA
            // Owner é sempre considerado "perfil completo" — o wizard é para colaboradores.
            ;(token as any).perfilCompleto = !!u.perfilCompleto || u.workspacesOwned.length > 0
            // Areas: se o user é owner, workspaceRole='owner' (acesso total).
            // Caso contrário usa o primeiro membership ativo.
            const member = u.workspaceMemberships[0]
            if (ownedWs) {
              ;(token as any).workspaceRole = 'owner'
              ;(token as any).areasPermitidas = []
              ;(token as any).activeWorkspaceId = ownedWs.id
              ;(token as any).isWorkspaceOwner = true
            } else if (member) {
              ;(token as any).workspaceRole = member.role
              ;(token as any).areasPermitidas = member.areasPermitidas ?? []
              ;(token as any).activeWorkspaceId = member.workspaceId
              ;(token as any).isWorkspaceOwner = false
            } else {
              ;(token as any).workspaceRole = null
              ;(token as any).areasPermitidas = []
              ;(token as any).activeWorkspaceId = null
              ;(token as any).isWorkspaceOwner = false
            }
            ;(token as any).refreshedAt = Date.now()
          }
        } catch (e) {
          // não bloqueia auth se DB falhar
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        ;(session.user as any).role = token.role as string | undefined
        ;(session.user as any).subscriptionStatus = token.subscriptionStatus as string | undefined
        ;(session.user as any).trialEnd = token.trialEnd as string | null | undefined
        ;(session.user as any).hasWorkspace = (token as any).hasWorkspace as boolean | undefined
        ;(session.user as any).onboardingCompleted = (token as any).onboardingCompleted as boolean | undefined
        ;(session.user as any).workspaceRole = (token as any).workspaceRole as string | null | undefined
        ;(session.user as any).areasPermitidas = (token as any).areasPermitidas as string[] | undefined
        ;(session.user as any).activeWorkspaceId = (token as any).activeWorkspaceId as string | null | undefined
        ;(session.user as any).isWorkspaceOwner = (token as any).isWorkspaceOwner as boolean | undefined
        ;(session.user as any).totpEnabled = (token as any).totpEnabled as boolean | undefined
        ;(session.user as any).workspaceRequire2FA = (token as any).workspaceRequire2FA as boolean | undefined
        ;(session.user as any).perfilCompleto = (token as any).perfilCompleto as boolean | undefined
      }
      return session
    },
  },
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Rate limit: 5 tentativas / 15min por email.
        // Em NextAuth Credentials, o request não é exposto ao authorize de forma confiável,
        // por isso usamos o email como chave (trade-off: atacante pode rotacionar emails,
        // mas defende contra brute-force em uma conta-alvo, que é o caso comum).
        const emailKey = String(credentials.email).toLowerCase()
        const limit = rateLimit(`login:email:${emailKey}`, 5, 15 * 60 * 1000)
        if (!limit.ok) {
          const minutes = Math.ceil(limit.resetIn / 60000)
          console.warn(`[auth] login rate limit triggered for ${emailKey}`)
          throw new Error(
            `Muitas tentativas de login. Aguarde ${minutes} minuto(s).`,
          )
        }

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email as string },
          })

          if (!user) {
            return null
          }

          const passwordsMatch = await compare(
            credentials.password as string,
            user.senha
          )

          if (!passwordsMatch) {
            return null
          }

          // 2FA TOTP — se ativo, exige código (totpCode) ou recoveryCode
          if ((user as any).totpEnabled && (user as any).totpSecret) {
            const totpCode = (credentials as any).totpCode as
              | string
              | undefined
            const recoveryCode = (credentials as any).recoveryCode as
              | string
              | undefined

            if (!totpCode && !recoveryCode) {
              // Sinal pro frontend: precisa 2FA
              throw new Error('2FA_REQUIRED')
            }

            // Validação inline (evita import circular com lib/auth/totp.ts)
            const OTPAuth = await import('otpauth')
            let ok = false

            if (totpCode && /^\d{6}$/.test(totpCode)) {
              const totp = new OTPAuth.TOTP({
                issuer: 'BH Grain',
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromBase32(
                  (user as any).totpSecret as string
                ),
              })
              ok = totp.validate({ token: totpCode, window: 1 }) !== null
            }

            if (!ok && recoveryCode) {
              const bcryptMod = await import('bcryptjs')
              const codes: string[] = ((user as any).recoveryCodes ||
                []) as string[]
              const normalized = recoveryCode.trim().toUpperCase()
              for (let i = 0; i < codes.length; i++) {
                if (await bcryptMod.compare(normalized, codes[i])) {
                  ok = true
                  // consome o código
                  const remaining = codes.filter((_, idx) => idx !== i)
                  await db.user.update({
                    where: { id: user.id },
                    data: { recoveryCodes: remaining },
                  })
                  break
                }
              }
            }

            if (!ok) {
              throw new Error('2FA_INVALID')
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.nome,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
} satisfies NextAuthConfig
