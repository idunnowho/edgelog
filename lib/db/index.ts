import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolConfig } from 'pg'
import * as schema from './schema'

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it in your hosting env (Vercel → Settings → Environment Variables).',
    )
  }
  return url
}

function poolConfig(): PoolConfig {
  const connectionString = requireDatabaseUrl()
  const needsSsl =
    process.env.PGSSL === 'true' ||
    process.env.NODE_ENV === 'production' ||
    /sslmode=require|neon\.tech|supabase\.co|amazonaws\.com/i.test(connectionString)

  return {
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: needsSsl ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' } : undefined,
  }
}

const globalForDb = globalThis as unknown as {
  pgPool?: Pool
}

export const pool = globalForDb.pgPool ?? new Pool(poolConfig())

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool
}

export const db = drizzle(pool, { schema })

export type Database = typeof db
