'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return

    setLoading(true)
    setError('')

    try {
      const form = new FormData(event.currentTarget)
      const result = isSignUp
        ? await authClient.signUp.email({
            name: String(form.get('name')),
            email: String(form.get('email')),
            password: String(form.get('password')),
          })
        : await authClient.signIn.email({
            email: String(form.get('email')),
            password: String(form.get('password')),
          })

      if (result.error) {
        setError(result.error.message || 'Unable to authenticate with those details.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080c12] px-5 text-slate-200">
      <div className="w-full max-w-[400px] rounded-2xl border border-white/[0.08] bg-[#0d141e] p-6 shadow-2xl">
        <div className="mb-7">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-[15px] font-black text-slate-950">
              E
            </div>
            <span className="text-[16px] font-semibold text-white">
              Edge<span className="text-cyan-300">Log</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSignUp
              ? 'Start building a clearer trading edge.'
              : 'Sign in to your private trading workspace.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <label className="block text-sm">
              <span className="mb-1.5 block text-slate-400">Name</span>
              <input
                name="name"
                required
                autoComplete="name"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-400">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-400">Password</span>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
          <Link className="text-cyan-300 hover:text-cyan-200" href={isSignUp ? '/sign-in' : '/sign-up'}>
            {isSignUp ? 'Sign in' : 'Register'}
          </Link>
        </p>
      </div>
    </main>
  )
}
