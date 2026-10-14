import { NextResponse } from 'next/server'
import { TradovateError } from '@/lib/tradovate/api'
import { parseEnvironment, sanitizeClientMessage } from '@/lib/tradovate/config'
import { currentUserId } from '@/lib/tradovate/session'
import { connectWithCredentials } from '@/lib/tradovate/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter your Tradovate API key details.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Enter your Tradovate API key details.' }, { status: 400 })

  const input = body as Record<string, unknown>
  const environment = parseEnvironment(input.environment)
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const sec = typeof input.sec === 'string' ? input.sec.trim() : ''
  const cidValue = typeof input.cid === 'number' ? input.cid : typeof input.cid === 'string' ? Number(input.cid.trim()) : NaN
  if (!environment) return NextResponse.json({ error: 'Choose simulation or live.' }, { status: 400 })
  if (!name || name.length > 80) return NextResponse.json({ error: 'Enter your Tradovate username.' }, { status: 400 })
  if (!password || password.length > 200) return NextResponse.json({ error: 'Enter the API key password.' }, { status: 400 })
  if (!sec || sec.length > 200) return NextResponse.json({ error: 'Enter the API key secret.' }, { status: 400 })
  if (!Number.isInteger(cidValue) || cidValue <= 0) return NextResponse.json({ error: 'Enter the API key id (cid).' }, { status: 400 })

  try {
    await connectWithCredentials(userId, { environment, name, password, cid: cidValue, sec })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof TradovateError ? error.message : 'Tradovate connection failed.'
    return NextResponse.json({ error: sanitizeClientMessage(message) }, { status: 400 })
  }
}
