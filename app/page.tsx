import EdgeLogDashboard from '@/components/edge-log-dashboard'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; tradovate?: string; message?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const params = await searchParams
  return (
    <EdgeLogDashboard
      user={{ name: session.user.name, email: session.user.email }}
      initialSection={params.section === 'Accounts' ? 'Accounts' : 'Overview'}
      tradovateNotice={tradovateNotice(params)}
    />
  )
}

function tradovateNotice(params: { tradovate?: string; message?: string }) {
  if (params.tradovate === 'connected') return 'Tradovate is connected. Accounts, positions, and fills are syncing.'
  if (params.tradovate !== 'error') return null
  return (params.message || 'Tradovate connection failed.').replace(/\s+/g, ' ').slice(0, 180)
}
