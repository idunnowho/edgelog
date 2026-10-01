import { NextResponse } from 'next/server'
import { ensureSchema } from '@/lib/db/ensure-schema'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSchema()
    await pool.query('select 1 as ok')
    return NextResponse.json({ ok: true, db: 'up' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ ok: false, db: 'down', error: message }, { status: 503 })
  }
}
