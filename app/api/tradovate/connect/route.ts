import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, authorizeUrl, oauthConfigured, parseEnvironment, requestOrigin, sanitizeClientMessage, tradovateClientId, tradovateRedirectUri } from '@/lib/tradovate/config'
import { createOAuthState } from '@/lib/tradovate/oauth-state'
import { currentUserId } from '@/lib/tradovate/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const origin = requestOrigin(request)
  const userId = await currentUserId()
  if (!userId) return NextResponse.redirect(new URL('/sign-in', origin))

  const environment = parseEnvironment(new URL(request.url).searchParams.get('environment'))
  if (!environment) return fail(origin, 'Choose the simulation or live Tradovate environment.')
  if (!oauthConfigured()) return fail(origin, 'Tradovate sign-in is not configured for this workspace yet. Connect with an API key instead.')

  const response = NextResponse.redirect(buildAuthorizeUrl(origin, environment))
  response.cookies.set(OAUTH_COOKIE, createOAuthState(userId, environment), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  })
  return response
}

function buildAuthorizeUrl(origin: string, environment: 'live' | 'demo') {
  const url = new URL(authorizeUrl(environment))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', tradovateClientId())
  url.searchParams.set('redirect_uri', tradovateRedirectUri(origin))
  return url
}

function fail(origin: string, message: string) {
  const destination = new URL('/', origin)
  destination.searchParams.set('section', 'Accounts')
  destination.searchParams.set('tradovate', 'error')
  destination.searchParams.set('message', sanitizeClientMessage(message))
  return NextResponse.redirect(destination)
}
