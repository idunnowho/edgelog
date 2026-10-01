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
- Incomplete product areas (Calendar, Analytics deep-dive, Playbook, etc.) are marked **Soon** instead of showing fake data.
- Sign out is available from the sidebar.
