import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { TradovateError } from '@/lib/tradovate/api'
import { OAUTH_COOKIE, requestOrigin, sanitizeClientMessage, tradovateRedirectUri } from '@/lib/tradovate/config'
import { readOAuthState } from '@/lib/tradovate/oauth-state'
import { currentUserId } from '@/lib/tradovate/session'
import { connectWithOAuthCode } from '@/lib/tradovate/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const origin = requestOrigin(request)
  const userId = await currentUserId()
  if (!userId) return NextResponse.redirect(new URL('/sign-in', origin))

  const query = new URL(request.url).searchParams
  const jar = await cookies()
  const state = readOAuthState(jar.get(OAUTH_COOKIE)?.value)
  if (!state || state.userId !== userId) return finish(origin, 'This Tradovate sign-in expired. Start it again from Accounts.')

  const failure = query.get('error_description') || query.get('error')
  if (failure) return finish(origin, sanitizeClientMessage(failure))
  const code = query.get('code')
  if (!code) return finish(origin, 'Tradovate did not return an authorization code.')

  try {
    await connectWithOAuthCode(userId, state.environment, code, tradovateRedirectUri(origin))
    return finish(origin)
  } catch (error) {
    const message = error instanceof TradovateError ? error.message : 'Tradovate connection failed.'
    return finish(origin, message)
  }
}

function finish(origin: string, message?: string) {
  const destination = new URL('/', origin)
  destination.searchParams.set('section', 'Accounts')
  destination.searchParams.set('tradovate', message ? 'error' : 'connected')
  if (message) destination.searchParams.set('message', sanitizeClientMessage(message))
  const response = NextResponse.redirect(destination)
  response.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  return response
}
