export type TradeDTO = {
  id: string
  symbol: string
  side: string
  setup: string | null
  accountName: string | null
  quantity: number
  entryPrice: number
  exitPrice: number
  stopLoss: number | null
  takeProfit: number | null
  pnl: number
  notes: string | null
  openedAt: string
  closedAt: string | null
  createdAt: string
  rMultiple: number | null
}

export type DailyPnl = {
  date: string
  label: string
  pnl: number
}

export type EquityPoint = {
  date: string
  label: string
  equity: number
}

export type PulseItem = {
  label: string
  value: string
  detail: string
  width: number
}

export type TradeMetrics = {
  tradeCount: number
  netPnl: number
  winRate: number | null
  profitFactor: number | null
  maxDrawdown: number
  avgDailyPnl: number | null
  bestDay: number | null
  avgR: number | null
  equityCurve: EquityPoint[]
  dailyPnl: DailyPnl[]
  weekPnl: number
  pulse: PulseItem[]
  insight: string | null
  accounts: string[]
}

export function computeRMultiple(input: {
  side: string
  entryPrice: number
  stopLoss: number | null
  quantity: number
  pnl: number
}) {
  if (input.stopLoss === null || input.quantity === 0) return null
  const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss)
  const risk = riskPerUnit * input.quantity
  if (risk <= 0) return null
  return input.pnl / risk
}

export function computePnl(input: {
  side: string
  entryPrice: number
  exitPrice: number
  quantity: number
}) {
  const direction = input.side.toLowerCase() === 'short' ? -1 : 1
  return (input.exitPrice - input.entryPrice) * input.quantity * direction
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shortDayLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPulseMoney(value: number) {
  const abs = Math.abs(value)
  const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(2)}k` : `$${abs.toFixed(0)}`
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

export function buildMetrics(trades: TradeDTO[]): TradeMetrics {
  const accounts = Array.from(
    new Set(trades.map((t) => t.accountName).filter((name): name is string => Boolean(name))),
  ).sort()

  if (trades.length === 0) {
    return {
      tradeCount: 0,
      netPnl: 0,
      winRate: null,
      profitFactor: null,
      maxDrawdown: 0,
      avgDailyPnl: null,
      bestDay: null,
      avgR: null,
      equityCurve: [],
      dailyPnl: [],
      weekPnl: 0,
      pulse: [],
      insight: null,
      accounts,
    }
  }

  const chronological = [...trades].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  )

  const netPnl = chronological.reduce((sum, t) => sum + t.pnl, 0)
  const wins = chronological.filter((t) => t.pnl > 0)
  const losses = chronological.filter((t) => t.pnl < 0)
  const winRate = (wins.length / chronological.length) * 100
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : null) : grossProfit / grossLoss

  const rValues = chronological
    .map((t) => t.rMultiple)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  const avgR = rValues.length ? rValues.reduce((sum, v) => sum + v, 0) / rValues.length : null

  const byDay = new Map<string, number>()
  for (const t of chronological) {
    const key = dayKey(new Date(t.openedAt))
    byDay.set(key, (byDay.get(key) ?? 0) + t.pnl)
  }

  const dayEntries = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  const equityCurve: EquityPoint[] = dayEntries.map(([date, dayPnl]) => {
    equity += dayPnl
    peak = Math.max(peak, equity)
    maxDrawdown = Math.min(maxDrawdown, equity - peak)
    return {
      date,
      label: shortDayLabel(new Date(`${date}T12:00:00.000Z`)),
      equity,
    }
  })

  const dailyTotals = dayEntries.map(([, pnl]) => pnl)
  const avgDailyPnl = dailyTotals.length
    ? dailyTotals.reduce((sum, v) => sum + v, 0) / dailyTotals.length
    : null
  const bestDay = dailyTotals.length ? Math.max(...dailyTotals) : null

  const today = new Date()
  const dailyPnl: DailyPnl[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setHours(12, 0, 0, 0)
    d.setDate(today.getDate() - i)
    const key = dayKey(d)
    dailyPnl.push({
      date: key,
      label: String(d.getDate()),
      pnl: byDay.get(key) ?? 0,
    })
  }
  const weekPnl = dailyPnl.reduce((sum, d) => sum + d.pnl, 0)

  const morning = chronological.filter((t) => new Date(t.openedAt).getHours() < 12)
  const afternoon = chronological.filter((t) => new Date(t.openedAt).getHours() >= 12)
  const morningWinRate = morning.length
    ? (morning.filter((t) => t.pnl > 0).length / morning.length) * 100
    : null
  const afternoonWinRate = afternoon.length
    ? (afternoon.filter((t) => t.pnl > 0).length / afternoon.length) * 100
    : null

  const bySetup = new Map<string, { pnl: number; r: number[]; count: number }>()
  for (const t of chronological) {
    const key = t.setup?.trim() || 'Uncategorized'
    const existing = bySetup.get(key) ?? { pnl: 0, r: [], count: 0 }
    existing.pnl += t.pnl
    existing.count += 1
    if (t.rMultiple !== null) existing.r.push(t.rMultiple)
    bySetup.set(key, existing)
  }
  const topSetup = [...bySetup.entries()].sort((a, b) => b[1].pnl - a[1].pnl)[0]

  const bySymbol = new Map<string, number>()
  for (const t of chronological) {
    bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + t.pnl)
  }
  const topSymbol = [...bySymbol.entries()].sort((a, b) => b[1] - a[1])[0]

  const pulse: PulseItem[] = []
  if (morningWinRate !== null) {
    pulse.push({
      label: 'Morning session',
      value: `${morningWinRate.toFixed(0)}%`,
      detail: `${morning.length} trades · win rate`,
      width: Math.min(100, Math.max(8, morningWinRate)),
    })
  }
  if (topSetup) {
    const avgSetupR =
      topSetup[1].r.length > 0
        ? topSetup[1].r.reduce((sum, v) => sum + v, 0) / topSetup[1].r.length
        : null
    pulse.push({
      label: topSetup[0],
      value:
        avgSetupR !== null
          ? `${avgSetupR > 0 ? '+' : ''}${avgSetupR.toFixed(2)}R`
          : formatPulseMoney(topSetup[1].pnl),
      detail: avgSetupR !== null ? 'Avg. R multiple' : 'Net P&L',
      width: Math.min(100, Math.max(8, 50 + (avgSetupR ?? topSetup[1].pnl / 100))),
    })
  }
  if (topSymbol) {
    pulse.push({
      label: topSymbol[0],
      value: formatPulseMoney(topSymbol[1]),
      detail: 'Net P&L',
      width: Math.min(100, Math.max(8, 40 + Math.abs(topSymbol[1]) / 50)),
    })
  }
  if (rValues.length) {
    const planLike = chronological.filter((t) => t.setup && t.setup.trim().length > 0).length
    const adherence = (planLike / chronological.length) * 100
    pulse.push({
      label: 'Tagged setups',
      value: `${adherence.toFixed(0)}%`,
      detail: 'Of all trades',
      width: Math.min(100, Math.max(8, adherence)),
    })
  }

  let insight: string | null = null
  if (morningWinRate !== null && afternoonWinRate !== null && morning.length >= 3 && afternoon.length >= 3) {
    const delta = morningWinRate - afternoonWinRate
    if (Math.abs(delta) >= 8) {
      insight =
        delta > 0
          ? `Your morning win rate (${morningWinRate.toFixed(0)}%) is ${delta.toFixed(0)} pts higher than after noon. Protect that edge by sizing down later in the day.`
          : `Your afternoon win rate (${afternoonWinRate.toFixed(0)}%) is outperforming mornings by ${Math.abs(delta).toFixed(0)} pts. Consider shifting more size to later sessions.`
    }
  } else if (topSetup && topSetup[1].count >= 3) {
    insight = `${topSetup[0]} is your strongest tagged setup at ${formatPulseMoney(topSetup[1].pnl)} across ${topSetup[1].count} trades. Keep journaling when you deviate from it.`
  } else if (chronological.length > 0) {
    insight =
      'Log setups and stop losses on each trade to unlock R-multiples, setup rankings, and sharper EdgeCoach insights.'
  }

  return {
    tradeCount: chronological.length,
    netPnl,
    winRate,
    profitFactor: profitFactor === Infinity ? null : profitFactor,
    maxDrawdown,
    avgDailyPnl,
    bestDay,
    avgR,
    equityCurve,
    dailyPnl,
    weekPnl,
    pulse: pulse.slice(0, 4),
    insight,
    accounts,
  }
}
