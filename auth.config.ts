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
      if (token.id) {
        try {
          const u = await db.user.findUnique({
            where: { id: token.id as string },
            select: {
              role: true,
              subscription: { select: { status: true, trialEnd: true } },
            },
          })
          if (u) {
            token.role = u.role
            token.subscriptionStatus = u.subscription?.status || 'none'
            token.trialEnd = u.subscription?.trialEnd?.toISOString() || null
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
