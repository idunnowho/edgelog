'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { trade } from '@/lib/db/schema'
import { computePnl } from '@/lib/trades'

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isNaN(value)) return null
  return value
}, z.coerce.number().positive().nullable())

const optionalText = z.preprocess((value) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length ? text : null
}, z.string().max(2000).nullable())

const createTradeSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .max(32)
    .transform((v) => v.toUpperCase()),
  side: z.enum(['long', 'short']),
  setup: optionalText,
  accountName: optionalText,
  quantity: z.coerce.number().positive('Quantity must be greater than 0').max(1_000_000),
  entryPrice: z.coerce.number().positive('Entry price must be greater than 0'),
  exitPrice: z.coerce.number().positive('Exit price must be greater than 0'),
  stopLoss: optionalPositiveNumber,
  takeProfit: optionalPositiveNumber,
  notes: optionalText,
  openedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional().nullable(),
})

export type CreateTradeInput = {
  symbol: string
  side: 'long' | 'short'
  setup?: string | null
  accountName?: string | null
  quantity: number | string
  entryPrice: number | string
  exitPrice: number | string
  stopLoss?: number | string | null
  takeProfit?: number | string | null
  notes?: string | null
  openedAt?: string
  closedAt?: string | null
}

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function createTradeAction(input: CreateTradeInput) {
  const userId = await requireUserId()
  const parsed = createTradeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid trade' }
  }

  const data = parsed.data
  const pnl = computePnl({
    side: data.side,
    entryPrice: data.entryPrice,
    exitPrice: data.exitPrice,
    quantity: data.quantity,
  })
  const openedAt = data.openedAt ? new Date(data.openedAt) : new Date()
  const closedAt =
    data.closedAt === undefined ? openedAt : data.closedAt ? new Date(data.closedAt) : null

  await db.insert(trade).values({
    id: nanoid(),
    userId,
    symbol: data.symbol,
    side: data.side,
    setup: data.setup,
    accountName: data.accountName,
    quantity: data.quantity.toFixed(6),
    entryPrice: data.entryPrice.toFixed(6),
    exitPrice: data.exitPrice.toFixed(6),
    stopLoss: data.stopLoss === null ? null : data.stopLoss.toFixed(6),
    takeProfit: data.takeProfit === null ? null : data.takeProfit.toFixed(6),
    pnl: pnl.toFixed(2),
    notes: data.notes,
    openedAt,
    closedAt,
  })

  revalidatePath('/')
  return { ok: true as const, pnl }
}

export async function deleteTradeAction(tradeId: string) {
  const userId = await requireUserId()
  if (!tradeId) return { ok: false as const, error: 'Missing trade id' }

  await db.delete(trade).where(and(eq(trade.id, tradeId), eq(trade.userId, userId)))
  revalidatePath('/')
  return { ok: true as const }
}
