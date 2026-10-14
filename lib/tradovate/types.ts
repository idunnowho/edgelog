export type TradovateEnvironment = 'live' | 'demo'
export type TradovateAuthMethod = 'oauth' | 'credentials'

export type TradovateConnectionStatus = {
  environment: TradovateEnvironment
  username: string | null
  expiresAt: string | null
  needsReconnect: boolean
}

export type TradovateAccountView = {
  id: number
  environment: TradovateEnvironment
  name: string
  accountType: string
  closed: boolean
  evaluationSize: number | null
  netLiq: number | null
  cash: number | null
  openPnl: number | null
  realizedPnl: number | null
  weekRealizedPnl: number | null
}

export type TradovatePositionView = {
  id: string
  environment: TradovateEnvironment
  accountName: string
  symbol: string
  netPos: number
  netPrice: number | null
}

export type TradovateTradeView = {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  setup: string
  detail: string
  closedAt: string
  pnl: number
  quantity: number
  entryPrice: number
  exitPrice: number
}

export type TradovateSnapshot = {
  oauthAvailable: boolean
  syncedAt: string
  connections: TradovateConnectionStatus[]
  accounts: TradovateAccountView[]
  positions: TradovatePositionView[]
  trades: TradovateTradeView[]
  warnings: string[]
}
