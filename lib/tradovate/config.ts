import type { TradovateEnvironment } from './types'

export const TRADOVATE_APP_ID = 'EdgeLog'
export const TRADOVATE_APP_VERSION = '1.0.0'
export const OAUTH_COOKIE = 'edgelog_tradovate_oauth'

export function oauthConfigured() {
  return Boolean(process.env.TRADOVATE_CLIENT_ID && process.env.TRADOVATE_CLIENT_SECRET)
}

export function tradovateClientId() {
  return process.env.TRADOVATE_CLIENT_ID ?? ''
}

export function tradovateClientSecret() {
  return process.env.TRADOVATE_CLIENT_SECRET ?? ''
}

export function authorizeUrl(environment: TradovateEnvironment) {
  return environment === 'live'
    ? 'https://trader.tradovate.com/oauth'
    : 'https://trader.devel.ninjatrader.dev/oauth'
}

export function oauthTokenUrl(environment: TradovateEnvironment) {
  return environment === 'live'
    ? 'https://live.tradovateapi.com/auth/oauthtoken'
    : 'https://live-api-d.tradovate.com/auth/oauthtoken'
}

export function defaultTradingHost(environment: TradovateEnvironment) {
  return environment === 'live' ? 'live.tradovateapi.com' : 'demo.tradovateapi.com'
}

export function requestOrigin(request: Request) {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, '')
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}

export function tradovateRedirectUri(origin: string) {
  return process.env.TRADOVATE_REDIRECT_URI || `${origin}/api/tradovate/callback`
}

export function tradingHost(environment: TradovateEnvironment, apiHosts: Record<string, string> | null, apiHost: string | null) {
  const named = environment === 'live' ? apiHosts?.live : apiHosts?.demo
  const host = named || apiHost || defaultTradingHost(environment)
  return host.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

export function environmentLabel(environment: TradovateEnvironment) {
  return environment === 'live' ? 'Live' : 'Simulation'
}

export function sanitizeClientMessage(message: string) {
  const clean = message.replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > 240 || /bearer\s+|eyJ[a-zA-Z0-9_-]{10,}/i.test(clean)) {
    return 'Tradovate rejected the connection request.'
  }
  return clean
}

export function parseEnvironment(value: unknown): TradovateEnvironment | null {
  return value === 'live' || value === 'demo' ? value : null
}
