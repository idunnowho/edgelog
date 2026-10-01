'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trade } from '@/lib/db/schema'
import { computePnl, getTradeWorkspace } from '@/lib/trades'

const createTradeSchema = z.object({
  symbol: z.string().trim().min(1).max(32).transform((v) => v.toUpperCase()),
  side: z.enum(['long', 'short']),
  setup: z.string().trim().max(80).optional().nullable(),
  accountName: z.string().trim().max(80).optional().nullable(),
  quantity: z.coerce.number().positive().max(1_000_000),
  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().positive(),
  stopLoss: z.union([z.coerce.number().positive(), z.nan(), z.null()]).optional(),
  takeProfit: z.union([z.coerce.number().positive(), z.nan(), z.null()]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  openedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional().nullable(),
})

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

function optionalNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return value
}

export async function createTradeAction(input: z.infer<typeof createTradeSchema>) {
  const userId = await requireUserId()
  const parsed = createTradeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid trade' }
  }

  const data = parsed.data
  const stopLoss = optionalNumber(data.stopLoss ?? null)
  const takeProfit = optionalNumber(data.takeProfit ?? null)
  const pnl = computePnl({
    side: data.side,
    entryPrice: data.entryPrice,
    exitPrice: data.exitPrice,
    quantity: data.quantity,
  })
  const openedAt = data.openedAt ? new Date(data.openedAt) : new Date()
  const closedAt = data.closedAt === undefined ? openedAt : data.closedAt ? new Date(data.closedAt) : null

  await db.insert(trade).values({
    id: nanoid(),
    userId,
    symbol: data.symbol,
    side: data.side,
    setup: data.setup?.trim() ? data.setup.trim() : null,
    accountName: data.accountName?.trim() ? data.accountName.trim() : null,
    quantity: data.quantity.toFixed(6),
    entryPrice: data.entryPrice.toFixed(6),
    exitPrice: data.exitPrice.toFixed(6),
    stopLoss: stopLoss === null ? null : stopLoss.toFixed(6),
    takeProfit: takeProfit === null ? null : takeProfit.toFixed(6),
    pnl: pnl.toFixed(2),
    notes: data.notes?.trim() ? data.notes.trim() : null,
    openedAt,
    closedAt,
  })

  revalidatePath('/')
  return { ok: true as const }
}

export async function deleteTradeAction(tradeId: string) {
  const userId = await requireUserId()
  if (!tradeId) return { ok: false as const, error: 'Missing trade id' }

  await db.delete(trade).where(and(eq(trade.id, tradeId), eq(trade.userId, userId)))
  revalidatePath('/')
  return { ok: true as const }
}

export async function getWorkspaceAction(accountName?: string | null) {
  const userId = await requireUserId()
  return getTradeWorkspace(userId, accountName)
}
