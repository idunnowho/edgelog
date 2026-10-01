import { pool } from '@/lib/db'

let ensurePromise: Promise<void> | null = null

/**
 * Idempotent schema bootstrap for hosted environments where drizzle-kit
 * may not have been run after a deploy. Safe to call on every request.
 */
export function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = runEnsure().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  return ensurePromise
}

async function runEnsure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" boolean DEFAULT false NOT NULL,
      "image" text,
      "createdAt" timestamptz DEFAULT now() NOT NULL,
      "updatedAt" timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "token" text NOT NULL UNIQUE,
      "createdAt" timestamptz DEFAULT now() NOT NULL,
      "updatedAt" timestamptz DEFAULT now() NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY NOT NULL,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      "scope" text,
      "password" text,
      "createdAt" timestamptz DEFAULT now() NOT NULL,
      "updatedAt" timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY NOT NULL,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz DEFAULT now() NOT NULL,
      "updatedAt" timestamptz DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "trade" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "symbol" text NOT NULL,
      "side" text NOT NULL,
      "setup" text,
      "accountName" text,
      "quantity" numeric(18, 6) NOT NULL,
      "entryPrice" numeric(18, 6) NOT NULL,
      "exitPrice" numeric(18, 6) NOT NULL,
      "stopLoss" numeric(18, 6),
      "takeProfit" numeric(18, 6),
      "pnl" numeric(18, 2) NOT NULL,
      "notes" text,
      "openedAt" timestamptz NOT NULL,
      "closedAt" timestamptz,
      "createdAt" timestamptz DEFAULT now() NOT NULL
    );
  `)

  // Upgrade older trade tables from the original demo schema.
  await pool.query(`
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "accountName" text;
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "stopLoss" numeric(18, 6);
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "takeProfit" numeric(18, 6);
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "notes" text;
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "setup" text;
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "closedAt" timestamptz;
    ALTER TABLE "trade" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now() NOT NULL;
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "trade_user_created_idx" ON "trade" ("userId", "createdAt");
    CREATE INDEX IF NOT EXISTS "trade_user_opened_idx" ON "trade" ("userId", "openedAt");
  `)
}
