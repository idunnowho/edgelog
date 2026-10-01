import EdgeLogDashboard from '@/components/edge-log-dashboard'
import { auth } from '@/lib/auth'
import { ensureSchema } from '@/lib/db/ensure-schema'
import { getTradeWorkspace } from '@/lib/trades'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  try {
    await ensureSchema()
    const { trades, metrics } = await getTradeWorkspace(session.user.id)

    return (
      <EdgeLogDashboard
        user={{ name: session.user.name, email: session.user.email }}
        trades={trades}
        metrics={metrics}
      />
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    console.error('[edgelog] failed to load workspace', error)

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080c12] px-5 text-slate-200">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0d141e] p-6">
          <h1 className="text-lg font-semibold text-white">Workspace unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            You&apos;re signed in, but EdgeLog couldn&apos;t load your journal from the database.
            Check that <code className="text-cyan-300">DATABASE_URL</code> is set in this
            deployment and that Postgres is reachable (SSL enabled for hosted providers).
          </p>
          <p className="mt-3 break-words rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-rose-300">
            {message}
          </p>
          <div className="mt-5 flex gap-3">
            <a
              href="/"
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
            >
              Retry
            </a>
            <a href="/sign-in" className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">
              Back to sign in
            </a>
          </div>
        </div>
      </main>
    )
  }
}
