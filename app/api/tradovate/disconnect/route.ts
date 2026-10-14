import { NextResponse } from 'next/server'
import { parseEnvironment } from '@/lib/tradovate/config'
import { currentUserId } from '@/lib/tradovate/session'
import { deleteConnection } from '@/lib/tradovate/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Choose which Tradovate connection to remove.' }, { status: 400 })
  }
  const environment = parseEnvironment(body && typeof body === 'object' ? (body as { environment?: unknown }).environment : null)
  if (!environment) return NextResponse.json({ error: 'Choose which Tradovate connection to remove.' }, { status: 400 })
  await deleteConnection(userId, environment)
  return NextResponse.json({ ok: true })
}
