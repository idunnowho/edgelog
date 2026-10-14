import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}
