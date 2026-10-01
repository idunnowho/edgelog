# EdgeLog

EdgeLog is a private trading journal. Sign in, log executions, and review live P&L, win rate, equity curve, and session insights — all computed from your own data.

## Stack

- Next.js App Router
- better-auth (email/password)
- PostgreSQL + Drizzle ORM
- Tailwind CSS

## Setup

1. Copy environment defaults:

```bash
cp .env.example .env.local
```

2. Set required values in `.env.local`:

- `DATABASE_URL` — Postgres connection string
- `BETTER_AUTH_SECRET` — at least 32 characters (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` — public app URL (e.g. `http://localhost:3000`)

3. Install and push the schema:

```bash
pnpm install
pnpm db:push
```

4. Run the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and add a trade.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build & serve |
| `pnpm db:push` | Sync Drizzle schema to the database |
| `pnpm db:generate` | Generate SQL migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm typecheck` | TypeScript check |

## Notes

- Overview metrics and charts are derived from persisted trades for the signed-in user.
- On boot / first request the app ensures auth + trade tables exist (safe for fresh Postgres).
- Sign out is available from the sidebar.
- Health check: `GET /api/health`

## Deploy (Vercel)

Set these environment variables for Production **and** Preview:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (your canonical public URL, e.g. `https://edgelog.app`)

Point your custom domain DNS to Vercel (A/CNAME per Vercel’s domain UI). If the domain resolves to an unrelated IP and times out, update the DNS records — the app cannot fix that from code.

After changing env vars, redeploy. Then hit `/api/health` — it should return `{ "ok": true }`.
