import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

function resolveBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  throw new Error('BETTER_AUTH_URL is required in production')
}

function resolveTrustedOrigins(baseURL: string) {
  const origins = new Set<string>([baseURL])

  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }

  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000')
    for (const key of ['V0_RUNTIME_URL', 'V0_DEV_APP_URL', 'V0_BUILD_URL', 'V0_SANDBOX_URL'] as const) {
      const value = process.env[key]
      if (value) origins.add(value)
    }
  }

  return [...origins]
}

const secret = process.env.BETTER_AUTH_SECRET
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('BETTER_AUTH_SECRET is required in production')
}

const baseURL = resolveBaseURL()

export const auth = betterAuth({
  database: pool,
  secret: secret || 'development-only-secret-change-me-32chars',
  baseURL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  trustedOrigins: resolveTrustedOrigins(baseURL),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development' && process.env.V0_RUNTIME_URL
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
