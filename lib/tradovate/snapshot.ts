import { randomUUID } from 'node:crypto'
import { asNumber, asRecords, exchangeAuthorizationCode, fetchMe, isAuthError, mapLimit, renewAccessToken, requestAccessToken, refreshOAuthToken, tradovateRequest, type TokenBundle } from './api'
import { environmentLabel, oauthConfigured, sanitizeClientMessage, tradingHost } from './config'
import { pairFills, type FillInput } from './pair-fills'
import { findConnection, listConnections, upsertConnection, type SavedConnection } from './store'
import type { TradovateAccountView, TradovateAuthMethod, TradovateEnvironment, TradovatePositionView, TradovateSnapshot, TradovateTradeView } from './types'

const TRIP_LIMIT = 1000
const RENEW_WITHIN_MS = 15 * 60 * 1000

type JsonRecord = Record<string, unknown>

export async function connectWithCredentials(userId: string, input: {
  environment: TradovateEnvironment
  name: string
  password: string
  cid: number
  sec: string
}) {
  const existing = await findConnection(userId, input.environment)
  const deviceId = existing?.deviceId || randomUUID()
  const bundle = await requestAccessToken({ ...input, deviceId })
  await saveBundle({
    userId,
    environment: input.environment,
    authMethod: 'credentials',
    bundle,
    deviceId,
    usernameHint: input.name,
    previous: existing,
  })
}

export async function connectWithOAuthCode(userId: string, environment: TradovateEnvironment, code: string, redirectUri: string) {
  const bundle = await exchangeAuthorizationCode(environment, code, redirectUri)
  const existing = await findConnection(userId, environment)
  await saveBundle({
    userId,
    environment,
    authMethod: 'oauth',
    bundle,
    deviceId: existing?.deviceId ?? null,
    previous: existing,
  })
}

export async function loadTradovateSnapshot(userId: string): Promise<TradovateSnapshot> {
  const connections = await listConnections(userId)
  const loaded = await Promise.all(connections.map(connection => loadConnection(connection)))
  return {
    oauthAvailable: oauthConfigured(),
    syncedAt: new Date().toISOString(),
    connections: loaded.map(item => item.status),
    accounts: loaded.flatMap(item => item.accounts),
    positions: loaded.flatMap(item => item.positions),
    trades: loaded.flatMap(item => item.trades).sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt)).slice(0, TRIP_LIMIT),
    warnings: loaded.flatMap(item => item.warnings),
  }
}

async function loadConnection(connection: SavedConnection) {
  const warnings: string[] = []
  const label = environmentLabel(connection.environment)
  try {
    const ready = await freshConnection(connection)
    if (ready.expired) {
      return emptyLoad(connection, true, [`${label} session expired. Connect again to refresh your trades.`])
    }
    const data = await fetchEnvironment(ready.connection, warnings)
    return { ...data, status: statusFor(ready.connection, false) }
  } catch (error) {
    if (isAuthError(error)) {
      return emptyLoad(connection, true, [`${label} session expired. Connect again to refresh your trades.`])
    }
    const message = error instanceof Error ? sanitizeClientMessage(error.message) : `${label} data could not be loaded.`
    return emptyLoad(connection, false, [`${label}: ${message}`])
  }
}

function emptyLoad(connection: SavedConnection, needsReconnect: boolean, warnings: string[]) {
  return { status: statusFor(connection, needsReconnect), accounts: [], positions: [], trades: [], warnings }
}

function statusFor(connection: SavedConnection, needsReconnect: boolean) {
  return {
    environment: connection.environment,
    username: connection.tradovateUsername,
    expiresAt: connection.accessTokenExpiresAt?.toISOString() ?? null,
    needsReconnect,
  }
}

async function freshConnection(connection: SavedConnection) {
  const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? null
  const expired = expiresAt != null && expiresAt <= Date.now()
  const due = expiresAt == null || expiresAt - Date.now() < RENEW_WITHIN_MS
  if (!due && !expired) return { connection, expired: false }
  try {
    return { connection: await renewConnection(connection), expired: false }
  } catch (error) {
    if (expired || isAuthError(error)) return { connection, expired: true }
    return { connection, expired: false }
  }
}

async function renewConnection(connection: SavedConnection) {
  const host = tradingHost(connection.environment, connection.apiHosts, connection.apiHost)
  if (connection.authMethod === 'oauth' && connection.refreshToken && oauthConfigured()) {
    try {
      const bundle = await refreshOAuthToken(connection.environment, connection.refreshToken)
      return saveBundle({
        userId: connection.userId,
        environment: connection.environment,
        authMethod: 'oauth',
        bundle,
        deviceId: connection.deviceId,
        usernameHint: connection.tradovateUsername,
        previous: connection,
      })
    } catch (error) {
      if (!isAuthError(error) && !(error instanceof Error)) throw error
    }
  }
  const renewed = await renewAccessToken(host, connection.accessToken)
  return saveBundle({
    userId: connection.userId,
    environment: connection.environment,
    authMethod: connection.authMethod,
    bundle: { ...renewed.bundle, apiHosts: renewed.bundle.apiHosts ?? connection.apiHosts },
    deviceId: connection.deviceId,
    usernameHint: connection.tradovateUsername,
    previous: connection,
    apiHostHint: renewed.host,
  })
}

async function saveBundle(input: {
  userId: string
  environment: TradovateEnvironment
  authMethod: TradovateAuthMethod
  bundle: TokenBundle
  deviceId: string | null
  usernameHint?: string | null
  previous?: SavedConnection | null
  apiHostHint?: string | null
}) {
  const apiHosts = input.bundle.apiHosts ?? input.previous?.apiHosts ?? null
  let apiHost = tradingHost(input.environment, apiHosts, input.apiHostHint ?? input.previous?.apiHost ?? null)
  let username = input.bundle.username ?? input.usernameHint ?? null
  let tradovateUserId = input.bundle.userId ?? input.previous?.tradovateUserId ?? null
  try {
    const me = await fetchMe(apiHost, input.bundle.accessToken)
    username = me.username ?? username
    tradovateUserId = me.userId ?? tradovateUserId
    apiHost = me.host || apiHost
  } catch (error) {
    if (isAuthError(error)) throw error
  }
  return upsertConnection({
    userId: input.userId,
    environment: input.environment,
    tradovateUserId,
    tradovateUsername: username,
    accessToken: input.bundle.accessToken,
    refreshToken: input.authMethod === 'oauth' ? input.bundle.refreshToken : null,
    accessTokenExpiresAt: input.bundle.expiresAt,
    apiHost,
    apiHosts,
    deviceId: input.deviceId,
    authMethod: input.authMethod,
  })
}

async function fetchEnvironment(connection: SavedConnection, warnings: string[]) {
  const host = tradingHost(connection.environment, connection.apiHosts, connection.apiHost)
  const accountsResult = await tradovateRequest({ host, path: '/account/list', token: connection.accessToken })
  const accounts = asRecords(accountsResult.data)
  const [positionsResult, fillsResult, ordersResult] = await Promise.all([
    tradovateRequest({ host: accountsResult.host, path: '/position/list', token: connection.accessToken }),
    tradovateRequest({ host: accountsResult.host, path: '/fill/list', token: connection.accessToken }),
    tradovateRequest({ host: accountsResult.host, path: '/order/list', token: connection.accessToken }).then(
      result => ({ ok: true as const, records: asRecords(result.data) }),
      error => {
        if (isAuthError(error)) throw error
        warnings.push(`${environmentLabel(connection.environment)} orders could not be loaded, so some fills have no account name.`)
        return { ok: false as const, records: [] as JsonRecord[] }
      },
    ),
  ])

  const accountName = new Map<number, string>()
  for (const account of accounts) {
    const id = asNumber(account.id)
    if (id == null) continue
    accountName.set(id, typeof account.name === 'string' ? account.name : `Account ${id}`)
  }
  const orderAccount = new Map<number, number>()
  for (const order of ordersResult.records) {
    const id = asNumber(order.id)
    const accountId = asNumber(order.accountId)
    if (id != null && accountId != null) orderAccount.set(id, accountId)
  }

  const positions = asRecords(positionsResult.data)
  const fills = asRecords(fillsResult.data)
  const contractIds = uniqueIds([
    ...positions.map(position => asNumber(position.contractId)),
    ...fills.map(fill => asNumber(fill.contractId)),
  ])
  const contracts = await loadContracts(accountsResult.host, connection.accessToken, contractIds, warnings, connection.environment)

  const openAccounts = accounts.filter(account => account.closed !== true && asNumber(account.id) != null)
  const balanceByAccount = new Map<number, JsonRecord>()
  const balances = await mapLimit(openAccounts, 4, async account => {
    const accountId = asNumber(account.id)!
    try {
      const result = await tradovateRequest({
        host: accountsResult.host,
        path: '/cashBalance/getcashbalancesnapshot',
        token: connection.accessToken,
        method: 'POST',
        body: { accountId },
      })
      return { accountId, snapshot: asRecord(result.data) }
    } catch (error) {
      if (isAuthError(error)) throw error
      return { accountId, snapshot: null }
    }
  })
  for (const balance of balances) {
    if (balance.snapshot) balanceByAccount.set(balance.accountId, balance.snapshot)
  }

  const accountViews: TradovateAccountView[] = accounts.flatMap(account => {
    const id = asNumber(account.id)
    if (id == null) return []
    const snapshot = balanceByAccount.get(id)
    return [{
      id,
      environment: connection.environment,
      name: accountName.get(id) ?? `Account ${id}`,
      accountType: typeof account.accountType === 'string' ? account.accountType : 'Customer',
      closed: account.closed === true,
      evaluationSize: asNumber(account.evaluationSize),
      netLiq: asNumber(snapshot?.netLiq),
      cash: asNumber(snapshot?.cashUSD) ?? asNumber(snapshot?.totalCashValue),
      openPnl: asNumber(snapshot?.openPnL),
      realizedPnl: asNumber(snapshot?.realizedPnL),
      weekRealizedPnl: asNumber(snapshot?.weekRealizedPnL),
    }]
  })

  const positionViews: TradovatePositionView[] = positions.flatMap(position => {
    const netPos = asNumber(position.netPos)
    const contractId = asNumber(position.contractId)
    const accountId = asNumber(position.accountId)
    if (netPos == null || netPos === 0 || contractId == null) return []
    return [{
      id: `${connection.environment}-${asNumber(position.id) ?? contractId}-${accountId ?? 0}`,
      environment: connection.environment,
      accountName: accountId != null ? accountName.get(accountId) ?? `Account ${accountId}` : 'Tradovate',
      symbol: contracts.get(contractId)?.symbol ?? `Contract ${contractId}`,
      netPos,
      netPrice: asNumber(position.netPrice),
    }]
  })

  const fillInputs: Array<FillInput & { accountName: string }> = []
  for (const fill of fills) {
    const id = asNumber(fill.id)
    const contractId = asNumber(fill.contractId)
    const qty = asNumber(fill.qty)
    const price = asNumber(fill.price)
    const action = fill.action === 'Buy' || fill.action === 'Sell' ? fill.action : null
    if (id == null || contractId == null || qty == null || price == null || !action) continue
    const orderId = asNumber(fill.orderId)
    const accountId = orderId == null ? null : orderAccount.get(orderId) ?? null
    fillInputs.push({
      id,
      contractId,
      action,
      qty,
      price,
      time: fillTime(fill),
      accountName: accountId != null ? accountName.get(accountId) ?? `Account ${accountId}` : '',
    })
  }

  const { trips, unpricedContractIds } = pairFills(fillInputs, contractId => contracts.get(contractId)?.valuePerPoint ?? null)
  if (unpricedContractIds.length) {
    warnings.push(`${environmentLabel(connection.environment)} could not price ${unpricedContractIds.length} contract${unpricedContractIds.length === 1 ? '' : 's'}.`)
  }

  const fillAccount = new Map(fillInputs.map(fill => [fill.id, fill.accountName]))
  const trades: TradovateTradeView[] = trips.slice(0, TRIP_LIMIT).map(trip => {
    const symbol = contracts.get(trip.contractId)?.symbol ?? `Contract ${trip.contractId}`
    const account = accountFromTrip(trip.id, fillAccount)
    return {
      id: `${connection.environment}-${trip.id}`,
      symbol,
      side: trip.side,
      setup: `Tradovate · ${environmentLabel(connection.environment)}${account ? ` · ${account}` : ''}`,
      detail: `${trimNumber(trip.quantity)} · ${trimPrice(trip.entryPrice)} → ${trimPrice(trip.exitPrice)}`,
      closedAt: trip.closedAt,
      pnl: trip.pnl,
      quantity: trip.quantity,
      entryPrice: trip.entryPrice,
      exitPrice: trip.exitPrice,
    }
  })
  if (trips.length > TRIP_LIMIT) warnings.push(`Showing the latest ${TRIP_LIMIT} closed ${environmentLabel(connection.environment).toLowerCase()} round trips.`)

  return { accounts: accountViews, positions: positionViews, trades, warnings }
}

function accountFromTrip(tripId: string, fillAccount: Map<number, string>) {
  const parts = tripId.split('-')
  const exitFillId = Number(parts[2])
  return Number.isInteger(exitFillId) ? fillAccount.get(exitFillId) ?? '' : ''
}

async function loadContracts(host: string, token: string, ids: number[], warnings: string[], environment: TradovateEnvironment) {
  const contracts = new Map<number, { symbol: string; maturityId: number }>()
  if (!ids.length) return new Map<number, { symbol: string; valuePerPoint: number | null }>()
  try {
    for (const item of await fetchItems(host, token, 'contract', ids)) {
      const id = asNumber(item.id)
      const maturityId = asNumber(item.contractMaturityId)
      if (id == null || typeof item.name !== 'string') continue
      contracts.set(id, { symbol: item.name, maturityId: maturityId ?? 0 })
    }
  } catch (error) {
    if (isAuthError(error)) throw error
    warnings.push(`${environmentLabel(environment)} contract names could not be loaded.`)
  }

  const maturityIds = uniqueIds([...contracts.values()].map(contract => contract.maturityId || null))
  const maturityProduct = new Map<number, number>()
  try {
    for (const item of await fetchItems(host, token, 'contractMaturity', maturityIds)) {
      const id = asNumber(item.id)
      const productId = asNumber(item.productId)
      if (id != null && productId != null) maturityProduct.set(id, productId)
    }
  } catch (error) {
    if (isAuthError(error)) throw error
  }

  const pointValue = new Map<number, number>()
  try {
    for (const item of await fetchItems(host, token, 'product', uniqueIds([...maturityProduct.values()]))) {
      const id = asNumber(item.id)
      const value = asNumber(item.valuePerPoint)
      if (id != null && value != null) pointValue.set(id, value)
    }
  } catch (error) {
    if (isAuthError(error)) throw error
  }

  const resolved = new Map<number, { symbol: string; valuePerPoint: number | null }>()
  for (const id of ids) {
    const contract = contracts.get(id)
    const productId = contract ? maturityProduct.get(contract.maturityId) : undefined
    resolved.set(id, {
      symbol: contract?.symbol ?? `Contract ${id}`,
      valuePerPoint: productId == null ? null : pointValue.get(productId) ?? null,
    })
  }
  return resolved
}

function fillTime(fill: JsonRecord) {
  if (typeof fill.timestamp === 'string') {
    const parsed = Date.parse(fill.timestamp)
    if (!Number.isNaN(parsed)) return parsed
  }
  const tradeDate = asRecord(fill.tradeDate)
  const year = asNumber(tradeDate?.year)
  const month = asNumber(tradeDate?.month)
  const day = asNumber(tradeDate?.day)
  if (year && month && day) return Date.UTC(year, month - 1, day)
  return 0
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function uniqueIds(values: Array<number | null>) {
  return [...new Set(values.filter((value): value is number => value != null && Number.isInteger(value)))]
}

async function fetchItems(host: string, token: string, entity: 'contract' | 'contractMaturity' | 'product', ids: number[]) {
  const records: JsonRecord[] = []
  for (const chunk of chunks(ids, 40)) {
    const commaPath = `/${entity}/items?ids=${chunk.join(',')}`
    try {
      const result = await tradovateRequest({ host, path: commaPath, token })
      records.push(...asRecords(result.data))
    } catch (error) {
      if (isAuthError(error)) throw error
      const params = new URLSearchParams()
      for (const id of chunk) params.append('ids', String(id))
      const result = await tradovateRequest({ host, path: `/${entity}/items?${params.toString()}`, token })
      records.push(...asRecords(result.data))
    }
  }
  return records
}

function chunks<T>(values: T[], size: number) {
  const groups: T[][] = []
  for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size))
  return groups
}

function trimPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function trimNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
