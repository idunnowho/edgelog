import { NextResponse } from 'next/server'
import { oauthConfigured } from '@/lib/tradovate/config'
import { currentUserId } from '@/lib/tradovate/session'
import { loadTradovateSnapshot } from '@/lib/tradovate/snapshot'
import type { TradovateSnapshot } from '@/lib/tradovate/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  try {
    return NextResponse.json(await loadTradovateSnapshot(userId))
  } catch (error) {
    console.error('Tradovate snapshot failed', error instanceof Error ? error.name : 'unknown')
    const empty: TradovateSnapshot = {
      oauthAvailable: oauthConfigured(),
      syncedAt: new Date().toISOString(),
      connections: [],
      accounts: [],
      positions: [],
      trades: [],
      warnings: ['Trading data could not be loaded. Try syncing again.'],
    }
    return NextResponse.json(empty)
  }
}
