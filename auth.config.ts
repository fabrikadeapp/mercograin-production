import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'

export const authConfig = {
  pages: {
    signIn: '/auth/login',
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
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.email = user.email
      }
      // Refresh role e subscription status em cada chamada (simples; otimizar depois)
      // Subscription agora pertence ao Workspace owned pelo user.
      if (token.id) {
        try {
          const u = await db.user.findUnique({
            where: { id: token.id as string },
            select: {
              role: true,
              workspacesOwned: {
                select: {
                  id: true,
                  onboardingCompletedAt: true,
                  subscription: { select: { status: true, trialEnd: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
              workspaceMemberships: {
                where: { status: 'active' },
                select: { id: true },
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
