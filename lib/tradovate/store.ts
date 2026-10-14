import { randomUUID } from 'node:crypto'
import { pool } from '@/lib/db'
import type { TradovateAuthMethod, TradovateEnvironment } from './types'

export type SavedConnection = {
  id: string
  userId: string
  environment: TradovateEnvironment
  tradovateUserId: string | null
  tradovateUsername: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  apiHost: string | null
  apiHosts: Record<string, string> | null
  deviceId: string | null
  authMethod: TradovateAuthMethod
}

type ConnectionRow = {
  id: string
  userId: string
  environment: string
  tradovateUserId: string | null
  tradovateUsername: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | string | null
  apiHost: string | null
  apiHosts: string | null
  deviceId: string | null
  authMethod: string
}

let schemaReady: Promise<void> | null = null

export function ensureTradovateSchema() {
  schemaReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS tradovate_connection (
      id text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      environment text NOT NULL,
      "tradovateUserId" text,
      "tradovateUsername" text,
      "accessToken" text NOT NULL,
      "refreshToken" text,
      "accessTokenExpiresAt" timestamptz,
      "apiHost" text,
      "apiHosts" text,
      "deviceId" text,
      "authMethod" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("userId", environment)
    )
  `).then(() => undefined).catch(error => {
    schemaReady = null
    throw error
  })
  return schemaReady
}

export async function listConnections(userId: string) {
  await ensureTradovateSchema()
  const result = await pool.query<ConnectionRow>(
    'SELECT * FROM tradovate_connection WHERE "userId" = $1 ORDER BY environment',
    [userId],
  )
  return result.rows.map(mapRow)
}

export async function findConnection(userId: string, environment: TradovateEnvironment) {
  const connections = await listConnections(userId)
  return connections.find(connection => connection.environment === environment) ?? null
}

export async function upsertConnection(input: {
  userId: string
  environment: TradovateEnvironment
  tradovateUserId: string | null
  tradovateUsername: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  apiHost: string | null
  apiHosts: Record<string, string> | null
  deviceId: string | null
  authMethod: TradovateAuthMethod
}) {
  await ensureTradovateSchema()
  const result = await pool.query<ConnectionRow>(`
    INSERT INTO tradovate_connection (
      id, "userId", environment, "tradovateUserId", "tradovateUsername",
      "accessToken", "refreshToken", "accessTokenExpiresAt", "apiHost", "apiHosts",
      "deviceId", "authMethod", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, now(), now()
    )
    ON CONFLICT ("userId", environment)
    DO UPDATE SET
      "tradovateUserId" = EXCLUDED."tradovateUserId",
      "tradovateUsername" = EXCLUDED."tradovateUsername",
      "accessToken" = EXCLUDED."accessToken",
      "refreshToken" = EXCLUDED."refreshToken",
      "accessTokenExpiresAt" = EXCLUDED."accessTokenExpiresAt",
      "apiHost" = EXCLUDED."apiHost",
      "apiHosts" = EXCLUDED."apiHosts",
      "deviceId" = COALESCE(EXCLUDED."deviceId", tradovate_connection."deviceId"),
      "authMethod" = EXCLUDED."authMethod",
      "updatedAt" = now()
    RETURNING *
  `, [
    randomUUID(),
    input.userId,
    input.environment,
    input.tradovateUserId,
    input.tradovateUsername,
    input.accessToken,
    input.refreshToken,
    input.accessTokenExpiresAt,
    input.apiHost,
    input.apiHosts ? JSON.stringify(input.apiHosts) : null,
    input.deviceId,
    input.authMethod,
  ])
  const row = result.rows[0]
  if (!row) throw new Error('Tradovate connection was not saved.')
  return mapRow(row)
}

export async function deleteConnection(userId: string, environment: TradovateEnvironment) {
  await ensureTradovateSchema()
  await pool.query('DELETE FROM tradovate_connection WHERE "userId" = $1 AND environment = $2', [userId, environment])
}

function mapRow(row: ConnectionRow): SavedConnection {
  if (row.environment !== 'live' && row.environment !== 'demo') {
    throw new Error('Stored Tradovate environment is invalid.')
  }
  if (row.authMethod !== 'oauth' && row.authMethod !== 'credentials') {
    throw new Error('Stored Tradovate auth method is invalid.')
  }
  let apiHosts: Record<string, string> | null = null
  if (row.apiHosts) {
    try {
      const parsed = JSON.parse(row.apiHosts) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) apiHosts = parsed as Record<string, string>
    } catch {
      apiHosts = null
    }
  }
  return {
    id: row.id,
    userId: row.userId,
    environment: row.environment,
    tradovateUserId: row.tradovateUserId,
    tradovateUsername: row.tradovateUsername,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    accessTokenExpiresAt: row.accessTokenExpiresAt ? new Date(row.accessTokenExpiresAt) : null,
    apiHost: row.apiHost,
    apiHosts,
    deviceId: row.deviceId,
    authMethod: row.authMethod,
  }
}
