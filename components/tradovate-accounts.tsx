'use client'

import { useState } from 'react'
import { Link2, RefreshCw, Unplug } from 'lucide-react'
import type { TradovateEnvironment, TradovateSnapshot } from '@/lib/tradovate/types'

const fieldClass = 'w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60'

export function TradovateAccounts({
  snapshot,
  syncing,
  onReload,
}: {
  snapshot: TradovateSnapshot | null
  syncing: boolean
  onReload: () => void
}) {
  const [environment, setEnvironment] = useState<TradovateEnvironment>('demo')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [cid, setCid] = useState('')
  const [secret, setSecret] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<TradovateEnvironment | null>(null)
  const [guideOpen, setGuideOpen] = useState(true)

  const connections = snapshot?.connections ?? []
  const missingEnvironment = (['demo', 'live'] as const).some(item => !connections.some(connection => connection.environment === item && !connection.needsReconnect))

  async function connect(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/tradovate/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment, name, password, cid, sec: secret }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        setError(payload.error || 'Tradovate connection failed.')
        return
      }
      setPassword('')
      setSecret('')
      onReload()
    } catch {
      setError('EdgeLog could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function disconnect(target: TradovateEnvironment) {
    setError(null)
    const response = await fetch('/api/tradovate/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment: target }),
    })
    if (!response.ok) {
      setError('That Tradovate connection could not be removed.')
      return
    }
    setConfirming(null)
    onReload()
  }

  if (!snapshot) {
    return <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-5 text-[12px] text-slate-400">{syncing ? 'Checking for a Tradovate connection…' : 'Tradovate data is unavailable. Sync again in a moment.'}</section>
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Tradovate</h3>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-500">Connect an account to pull balances, open positions, and filled round trips into this journal. EdgeLog only reads that data.</p>
          </div>
          <button onClick={onReload} disabled={syncing} className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-slate-300 hover:text-white disabled:opacity-60">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> Sync
          </button>
        </div>

        {connections.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {connections.map(connection => (
              <div key={connection.environment} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-white">{connection.username || 'Tradovate account'}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{connection.environment === 'live' ? 'Live' : 'Simulation'} · {connection.needsReconnect ? 'Reconnect to keep syncing' : sessionLabel(connection.expiresAt)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] ${connection.needsReconnect ? 'bg-amber-400/10 text-amber-200' : 'bg-emerald-400/10 text-emerald-300'}`}>{connection.needsReconnect ? 'Expired' : 'Linked'}</span>
                </div>
                <button onClick={() => confirming === connection.environment ? disconnect(connection.environment) : setConfirming(connection.environment)} className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-300">
                  <Unplug size={12} /> {confirming === connection.environment ? 'Confirm disconnect' : 'Disconnect'}
                </button>
              </div>
            ))}
          </div>
        )}

        {snapshot.warnings.map((warning, index) => <p key={`${warning}-${index}`} className="mt-4 text-[11px] text-amber-200/90">{warning}</p>)}

        {snapshot?.oauthAvailable && (
          <div className="mt-5">
            <p className="text-[11px] font-medium text-slate-300">Continue with Tradovate</p>
            <p className="mt-1 text-[11px] text-slate-500">You approve access on Tradovate, and your password stays there.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/api/tradovate/connect?environment=demo" className="rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200">Connect simulation</a>
              <a href="/api/tradovate/connect?environment=live" className="rounded-lg border border-white/[0.1] px-3 py-2 text-[11px] font-medium text-slate-200 hover:border-cyan-300/40">Connect live</a>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <button type="button" onClick={() => setGuideOpen(open => !open)} className="flex w-full items-center justify-between text-left" aria-expanded={guideOpen}>
            <span className="text-[12px] font-medium text-white">How to connect your Tradovate account</span>
            <span className="text-[10px] text-cyan-300">{guideOpen ? 'Hide steps' : 'Show steps'}</span>
          </button>
          {guideOpen && <ConnectionGuide />}
        </div>

        {(missingEnvironment || connections.length === 0) && (
          <form onSubmit={connect} className="mt-5" autoComplete="off">
            <p className="text-[12px] font-medium text-white">{snapshot?.oauthAvailable ? 'Or use an API key' : 'Connect with an API key'}</p>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-500">Paste the username, API password, key id, and secret from the steps above.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-[10px] text-slate-500">Environment</span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEnvironment('demo')} className={`rounded-lg border py-2.5 text-[11px] ${environment === 'demo' ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.09] text-slate-500'}`}>Simulation</button>
                  <button type="button" onClick={() => setEnvironment('live')} className={`rounded-lg border py-2.5 text-[11px] ${environment === 'live' ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.09] text-slate-500'}`}>Live</button>
                </div>
              </div>
              <label className="block text-[11px] text-slate-400">Username
                <input value={name} onChange={event => setName(event.target.value)} required className={`mt-1.5 ${fieldClass}`} />
              </label>
              <label className="block text-[11px] text-slate-400">API password
                <input value={password} onChange={event => setPassword(event.target.value)} type="password" required className={`mt-1.5 ${fieldClass}`} />
              </label>
              <label className="block text-[11px] text-slate-400">Key id (cid)
                <input value={cid} onChange={event => setCid(event.target.value)} inputMode="numeric" required className={`mt-1.5 ${fieldClass}`} />
              </label>
              <label className="block text-[11px] text-slate-400">Secret (sec)
                <input value={secret} onChange={event => setSecret(event.target.value)} type="password" required spellCheck={false} className={`mt-1.5 ${fieldClass}`} />
              </label>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-slate-600">The password is sent to Tradovate to request a token and then discarded. {environment === 'live' ? 'Live reads your funded account.' : 'Simulation reads your demo account.'}</p>
            {error && <p className="mt-3 text-[11px] text-rose-300">{error}</p>}
            <button type="submit" disabled={submitting} className="mt-4 flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60">
              <Link2 size={14} /> {submitting ? 'Connecting…' : 'Connect Tradovate'}
            </button>
          </form>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(snapshot?.accounts ?? []).map(account => (
          <article key={`${account.environment}-${account.id}`} className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-white">{account.name}</h3>
                <p className="mt-1 text-[10px] text-slate-500">{account.environment === 'live' ? 'Live' : 'Simulation'} · {account.accountType}{account.closed ? ' · Closed' : ''}</p>
              </div>
              <p className={`text-[16px] font-semibold ${tone(account.netLiq)}`}>{money(account.netLiq)}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
              <Stat label="Cash" value={money(account.cash)} />
              <Stat label="Open P&L" value={money(account.openPnl)} className={tone(account.openPnl)} />
              <Stat label="Day realized" value={money(account.realizedPnl)} className={tone(account.realizedPnl)} />
              <Stat label="Week realized" value={money(account.weekRealizedPnl)} className={tone(account.weekRealizedPnl)} />
            </dl>
            {account.evaluationSize != null && <p className="mt-3 text-[10px] text-slate-600">Evaluation size {money(account.evaluationSize)}</p>}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-white">Open positions</h3>
        <p className="mt-1 text-[11px] text-slate-500">{snapshot?.positions.length ? `${snapshot.positions.length} open` : 'Flat across linked accounts'}</p>
        {snapshot?.positions.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.12em] text-slate-600">
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium">Account</th>
                  <th className="pb-2 font-medium">Position</th>
                  <th className="pb-2 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.positions.map(position => (
                  <tr key={position.id} className="border-b border-white/[0.045] last:border-0">
                    <td className="py-3 font-semibold text-white">{position.symbol}</td>
                    <td className="py-3 text-slate-400">{position.accountName} · {position.environment === 'live' ? 'Live' : 'Simulation'}</td>
                    <td className={`py-3 ${position.netPos > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.abs(position.netPos)} {position.netPos > 0 ? 'Long' : 'Short'}</td>
                    <td className="py-3 text-right text-slate-300">{position.netPrice == null ? '—' : position.netPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-5 text-[11px] text-slate-600">{connections.length ? 'No open contracts right now. Closed round trips still show in the trade log.' : 'Connect Tradovate to see positions here.'}</p>}
      </section>
    </div>
  )
}

const connectionSteps = [
  'Sign in to Tradovate with a live account. Creating a key requires more than $1,000 in that account, the CME Information License Agreement, and the API Access add-on.',
  'Open Application Settings, then Add-Ons, and subscribe to API Access if it is not already active.',
  'Stay in Application Settings and open the API Access tab. Choose Generate API Key, complete the attestation, and sign the agreement.',
  'Pick the key permissions and generate the key. Copy the key id and the secret on that screen. Tradovate shows the secret once.',
  'Set a dedicated API password on the key. EdgeLog asks for that password together with your Tradovate username.',
  'Return here, choose Simulation or Live, and paste the username, API password, key id, and secret. Connect the other environment the same way if you want both.',
]

function ConnectionGuide() {
  return (
    <div className="mt-4">
      <ol className="space-y-3">
        {connectionSteps.map((step, index) => (
          <li key={step} className="flex gap-3 text-[11px] leading-5 text-slate-400">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-[10px] font-semibold text-cyan-200">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        This journal reads accounts, positions, and fills. After you connect, use Sync any time you want a fresh pull.{' '}
        <a href="https://tradovate.zendesk.com/hc/en-us/articles/4408927027987-How-Do-I-Get-Access-to-the-Tradovate-API" target="_blank" rel="noreferrer" className="text-cyan-300">Tradovate&apos;s API access article</a>
      </p>
    </div>
  )
}

function Stat({ label, value, className = 'text-slate-200' }: { label: string; value: string; className?: string }) {
  return <div><dt className="text-[10px] text-slate-600">{label}</dt><dd className={`mt-1 font-medium ${className}`}>{value}</dd></div>
}

function money(value: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function tone(value: number | null) {
  if (value == null || value === 0) return 'text-slate-200'
  return value > 0 ? 'text-emerald-300' : 'text-rose-300'
}

function sessionLabel(expiresAt: string | null) {
  if (!expiresAt) return 'Session active'
  const expiry = new Date(expiresAt)
  if (Number.isNaN(expiry.getTime())) return 'Session active'
  if (expiry.getTime() <= Date.now()) return 'Session expired'
  return `Token until ${expiry.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}
