export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080c12] text-slate-400">
      <div className="flex items-center gap-3 text-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
        Loading EdgeLog…
      </div>
    </main>
  )
}
