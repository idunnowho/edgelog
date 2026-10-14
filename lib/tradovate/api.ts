import { TRADOVATE_APP_ID, TRADOVATE_APP_VERSION, defaultTradingHost, oauthTokenUrl, tradovateClientId, tradovateClientSecret } from './config'
import type { TradovateEnvironment } from './types'

export class TradovateError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TradovateError'
    this.status = status
  }
}

export type TokenBundle = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  userId: string | null
  username: string | null
  apiHosts: Record<string, string> | null
}

type JsonRecord = Record<string, unknown>

export function isAuthError(error: unknown) {
  return error instanceof TradovateError && (error.status === 401 || /session expired/i.test(error.message))
}

export async function requestAccessToken(input: {
  environment: TradovateEnvironment
  name: string
  password: string
  cid: number
  sec: string
  deviceId: string
}) {
  return requestAccessTokenOnce(input, false)
}

async function requestAccessTokenOnce(input: {
  environment: TradovateEnvironment
  name: string
  password: string
  cid: number
  sec: string
  deviceId: string
  ticket?: string
}, retried: boolean): Promise<TokenBundle> {
  const body: JsonRecord = {
    name: input.name,
    password: input.password,
    appId: TRADOVATE_APP_ID,
    appVersion: TRADOVATE_APP_VERSION,
    cid: input.cid,
    sec: input.sec,
    deviceId: input.deviceId,
  }
  if (input.ticket) body['p-ticket'] = input.ticket

  const response = await fetch(`https://${defaultTradingHost(input.environment)}/v1/auth/accesstokenrequest`, {
    method: 'POST',
    cache: 'no-store',
    redirect: 'manual',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  const data = await readJson(response)
  if (record(data)?.['p-captcha'] === true) {
    throw new TradovateError('Tradovate is asking for a captcha after repeated sign-in attempts. Wait about an hour, then try again.')
  }
  const ticket = typeof record(data)?.['p-ticket'] === 'string' ? String(record(data)?.['p-ticket']) : ''
  if (ticket && !retried) {
    const wait = Number(record(data)?.['p-time'])
    if (!Number.isFinite(wait) || wait > 5) {
      const seconds = Number.isFinite(wait) ? Math.ceil(wait) : 60
      throw new TradovateError(`Tradovate is rate limiting sign-in. Try again in ${seconds} seconds.`)
    }
    await delay(Math.max(0, wait) * 1000)
    return requestAccessTokenOnce({ ...input, ticket }, true)
  }
  if (!response.ok) throw new TradovateError(messageFrom(data) || `Tradovate sign-in failed (${response.status}).`, response.status)
  const bundle = parseToken(data)
  if (!bundle) throw new TradovateError(messageFrom(data) || 'Tradovate did not return an access token.')
  return bundle
}

export async function exchangeAuthorizationCode(environment: TradovateEnvironment, code: string, redirectUri: string) {
  return postOAuthToken(environment, {
    grant_type: 'authorization_code',
    client_id: tradovateClientId(),
    client_secret: tradovateClientSecret(),
    redirect_uri: redirectUri,
    code,
  })
}

export async function refreshOAuthToken(environment: TradovateEnvironment, refreshToken: string) {
  return postOAuthToken(environment, {
    grant_type: 'refresh_token',
    client_id: tradovateClientId(),
    client_secret: tradovateClientSecret(),
    refresh_token: refreshToken,
  })
}

async function postOAuthToken(environment: TradovateEnvironment, form: Record<string, string>) {
  const response = await fetch(oauthTokenUrl(environment), {
    method: 'POST',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(20000),
  })
  const data = await readJson(response)
  if (!response.ok) throw new TradovateError(messageFrom(data) || 'Tradovate authorization failed.', response.status)
  const bundle = parseToken(data)
  if (!bundle) throw new TradovateError(messageFrom(data) || 'Tradovate did not return an access token.')
  return bundle
}

export async function renewAccessToken(host: string, accessToken: string) {
  const result = await tradovateRequest({ host, path: '/auth/renewaccesstoken', token: accessToken, method: 'POST', body: {} })
  const bundle = parseToken(result.data)
  if (!bundle) throw new TradovateError('Tradovate did not return a renewed token.', 401)
  return { bundle, host: result.host }
}

export async function fetchMe(host: string, accessToken: string) {
  const { data, host: nextHost } = await tradovateRequest({ host, path: '/auth/me', token: accessToken })
  const body = record(data) ?? {}
  const userId = body.userId ?? body.id
  return {
    host: nextHost,
    userId: userId == null ? null : String(userId),
    username: typeof body.name === 'string' ? body.name : null,
  }
}

export async function tradovateRequest(options: {
  host: string
  path: string
  token?: string
  method?: 'GET' | 'POST'
  body?: unknown
  redirects?: number
}): Promise<{ data: unknown; host: string }> {
  const host = options.host.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const url = options.path.startsWith('http') ? options.path : `https://${host}/v1${options.path}`
  const response = await fetch(url, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20000),
  })

  if ((response.status === 307 || response.status === 308) && (options.redirects ?? 0) < 2) {
    const location = response.headers.get('location')
    if (!location) throw new TradovateError('Tradovate redirected without a new host.', response.status)
    const next = new URL(location, url)
    return tradovateRequest({
      ...options,
      host: next.host,
      path: next.toString(),
      redirects: (options.redirects ?? 0) + 1,
    })
  }

  const data = await readJson(response)
  if (response.status === 401) throw new TradovateError('Your Tradovate session expired.', 401)
  if (!response.ok) throw new TradovateError(messageFrom(data) || `Tradovate request failed (${response.status}).`, response.status)
  const errorText = messageFrom(data)
  if (errorText && !Array.isArray(data)) throw new TradovateError(errorText, response.status === 200 ? 400 : response.status)
  return { data, host: new URL(url).host }
}

export function asRecords(data: unknown): JsonRecord[] {
  if (!Array.isArray(data)) return []
  return data.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object')
}

export function asNumber(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await fn(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

function parseToken(data: unknown): TokenBundle | null {
  const body = record(data)
  if (!body) return null
  const accessToken = stringField(body, 'accessToken') || stringField(body, 'access_token')
  if (!accessToken) return null
  const expiresIn = asNumber(body.expires_in)
  const expirationTime = stringField(body, 'expirationTime')
  const expiresAt = expirationTime ? new Date(expirationTime) : new Date(Date.now() + (expiresIn ?? 80 * 60) * 1000)
  const userId = body.userId ?? body.user_id
  return {
    accessToken,
    refreshToken: stringField(body, 'refreshToken') || stringField(body, 'refresh_token') || null,
    expiresAt: Number.isNaN(expiresAt.getTime()) ? new Date(Date.now() + 80 * 60 * 1000) : expiresAt,
    userId: userId == null ? null : String(userId),
    username: stringField(body, 'name'),
    apiHosts: hostMap(body.apiHosts),
  }
}

function hostMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const hosts: Record<string, string> = {}
  for (const [key, host] of Object.entries(value)) {
    if (typeof host === 'string' && host.trim()) hosts[key] = host.trim()
  }
  return Object.keys(hosts).length ? hosts : null
}

function messageFrom(data: unknown) {
  const body = record(data)
  if (!body) return ''
  return stringField(body, 'errorText') || stringField(body, 'error_description') || stringField(body, 'error') || ''
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { errorText: text.slice(0, 180) }
  }
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function stringField(body: JsonRecord, key: string) {
  return typeof body[key] === 'string' && body[key] ? body[key] as string : ''
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
