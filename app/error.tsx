'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isOpaqueReactError = /Minified React error #441/i.test(error.message || '')

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080c12] px-5 text-slate-200">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d141e] p-6 text-center">
        <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {isOpaqueReactError
            ? 'The server failed while loading your workspace. This is usually a database connection or schema issue on the deployment — verify DATABASE_URL and redeploy after the latest fix.'
            : error.message || 'An unexpected error occurred while loading EdgeLog.'}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[10px] text-slate-600">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-5 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
