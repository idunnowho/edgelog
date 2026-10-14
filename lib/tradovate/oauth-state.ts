import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { TradovateEnvironment } from './types'

type OAuthState = { userId: string; environment: TradovateEnvironment }

function signingKey() {
  return process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || 'edgelog-dev-tradovate'
}

export function createOAuthState(userId: string, environment: TradovateEnvironment) {
  const payload = Buffer.from(JSON.stringify({
    nonce: randomBytes(16).toString('hex'),
    userId,
    environment,
    exp: Date.now() + 10 * 60 * 1000,
  })).toString('base64url')
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function readOAuthState(value: string | undefined): OAuthState | null {
  if (!value) return null
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', signingKey()).update(payload).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { userId?: unknown; environment?: unknown; exp?: unknown }
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    if ((data.environment !== 'live' && data.environment !== 'demo') || typeof data.userId !== 'string') return null
    return { userId: data.userId, environment: data.environment }
  } catch {
    return null
  }
}
