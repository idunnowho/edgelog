import EdgeLogDashboard from '@/components/edge-log-dashboard'
import { auth } from '@/lib/auth'
import { getTradeWorkspace } from '@/lib/trades'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const { trades, metrics } = await getTradeWorkspace(session.user.id)

  return (
    <EdgeLogDashboard
      user={{ name: session.user.name, email: session.user.email }}
      trades={trades}
      metrics={metrics}
    />
  )
}
