import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { trade, type Trade } from '@/lib/db/schema'
import {
  buildMetrics,
  computeRMultiple,
  type TradeDTO,
  type TradeMetrics,
} from '@/lib/trade-metrics'

export type { TradeDTO, TradeMetrics }
export { buildMetrics, computePnl, computeRMultiple } from '@/lib/trade-metrics'

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function serializeTrade(row: Trade): TradeDTO {
  const quantity = toNumber(row.quantity) ?? 0
  const entryPrice = toNumber(row.entryPrice) ?? 0
  const exitPrice = toNumber(row.exitPrice) ?? 0
  const stopLoss = toNumber(row.stopLoss)
  const takeProfit = toNumber(row.takeProfit)
  const pnl = toNumber(row.pnl) ?? 0

  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    setup: row.setup,
    accountName: row.accountName,
    quantity,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    pnl,
    notes: row.notes,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    rMultiple: computeRMultiple({
      side: row.side,
      entryPrice,
      stopLoss,
      quantity,
      pnl,
    }),
  }
}

export async function listTradesForUser(userId: string, accountName?: string | null) {
  const rows = await db
    .select()
    .from(trade)
    .where(
      accountName && accountName !== 'All accounts'
        ? and(eq(trade.userId, userId), eq(trade.accountName, accountName))
        : eq(trade.userId, userId),
    )
    .orderBy(desc(trade.openedAt))

  return rows.map(serializeTrade)
}

export async function getTradeWorkspace(userId: string, accountName?: string | null) {
  const trades = await listTradesForUser(userId, accountName)
  return {
    trades,
    metrics: buildMetrics(trades),
  }
}
