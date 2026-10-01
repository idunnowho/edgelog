import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const protectedPaths = new Set(['/'])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)

  if (protectedPaths.has(pathname) && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  if ((pathname === '/sign-in' || pathname === '/sign-up') && sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/sign-in', '/sign-up'],
}
