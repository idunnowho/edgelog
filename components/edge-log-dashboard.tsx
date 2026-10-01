'use client'

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
  Filter,
} from 'lucide-react'
import { createTradeAction, deleteTradeAction } from '@/app/actions/trades'
import { signOut } from '@/lib/auth-client'
import {
  durationLabel,
  firstName,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatR,
  formatShortDate,
  formatTime,
  greetingForHour,
  initialsFromName,
} from '@/lib/format'
import { buildMetrics, type TradeDTO, type TradeMetrics } from '@/lib/trade-metrics'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Trade log', icon: Activity },
] as const

const workspaceItems = [
  { label: 'EdgeCoach', icon: Sparkles, accent: true },
] as const

type DashboardProps = {
  user: { name: string; email: string }
  trades: TradeDTO[]
  metrics: TradeMetrics
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-[15px] font-black text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.28)]">
        E
      </div>
      <span className="text-[16px] font-semibold tracking-[-0.03em] text-white">
        Edge<span className="text-cyan-300">Log</span>
      </span>
    </div>
  )
}

function Sparkline({ positive = true }: { positive?: boolean }) {
  return (
    <svg viewBox="0 0 110 34" className="h-9 w-24" aria-hidden="true">
      <path
        d={
          positive
            ? 'M1 29 C12 25, 14 20, 24 23 S35 21, 43 19 S52 24, 60 16 S69 18, 75 11 S84 15, 91 7 S101 8, 109 2'
            : 'M1 5 C12 9, 16 4, 25 11 S37 10, 44 17 S52 14, 62 19 S72 16, 79 25 S92 21, 109 31'
        }
        fill="none"
        stroke={positive ? '#22d3ee' : '#fb7185'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EquityChart({ points }: { points: TradeMetrics['equityCurve'] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-[236px] items-center justify-center rounded-xl bg-[#0b111b] px-6 text-center text-[12px] text-slate-500">
        Equity curve appears after you log your first closed trade.
      </div>
    )
  }

  const values = points.map((p) => p.equity)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = Math.max(max - min, 1)
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 700 : (index / (points.length - 1)) * 700
    const y = 200 - ((point.equity - min) / range) * 180
    return { x, y, label: point.label, equity: point.equity }
  })
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ')
  const area = `${line} L700 220 L0 220Z`
  const last = coords[coords.length - 1]
  const yLabels = [max, (max + min) / 2, min]

  return (
    <div className="relative h-[236px] w-full overflow-hidden rounded-xl bg-[#0b111b] px-2 pt-5">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_24%,rgba(148,163,184,0.08)_25%,transparent_26%,transparent_49%,rgba(148,163,184,0.08)_50%,transparent_51%,transparent_74%,rgba(148,163,184,0.08)_75%,transparent_76%)]" />
      <div className="absolute left-3 top-3 flex flex-col gap-8 text-[10px] text-slate-500">
        {yLabels.map((value) => (
          <span key={value}>{formatMoney(value, true)}</span>
        ))}
      </div>
      <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="relative h-full w-full">
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#22d3ee" stopOpacity=".23" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#area)" />
        <path d={line} fill="none" stroke="#22d3ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <circle cx={last.x} cy={last.y} r="4" fill="#22d3ee" />
      </svg>
      <div className="absolute bottom-2 left-3 right-3 flex justify-between text-[10px] text-slate-600">
        <span>{points[0]?.label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.label}</span>}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export default function EdgeLogDashboard({ user, trades, metrics }: DashboardProps) {
  const router = useRouter()
  const [active, setActive] = useState('Overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [account, setAccount] = useState('All accounts')
  const [search, setSearch] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
  }, [])

  const accountOptions = useMemo(() => {
    return ['All accounts', ...metrics.accounts]
  }, [metrics.accounts])

  const visibleTrades = useMemo(() => {
    return trades.filter((trade) => {
      const matchesAccount = account === 'All accounts' || trade.accountName === account
      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        trade.symbol.toLowerCase().includes(query) ||
        (trade.setup ?? '').toLowerCase().includes(query) ||
        trade.side.toLowerCase().includes(query)
      return matchesAccount && matchesSearch
    })
  }, [trades, account, search])

  const scopedMetrics = useMemo(() => {
    if (account === 'All accounts') return metrics
    return buildMetrics(trades.filter((t) => t.accountName === account))
  }, [account, metrics, trades])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (typing) return
      if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setAddOpen(true)
      }
      if (event.key === 'Escape') setAddOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push('/sign-in')
            router.refresh()
          },
        },
      })
      router.push('/sign-in')
      router.refresh()
    } catch {
      // Fall through to hard navigation if the client helper fails.
      window.location.href = '/sign-in'
    } finally {
      setSigningOut(false)
    }
  }

  function handleDelete(tradeId: string) {
    startTransition(async () => {
      await deleteTradeAction(tradeId)
      router.refresh()
    })
  }

  const rangeLabel =
    scopedMetrics.equityCurve.length > 0
      ? `${scopedMetrics.equityCurve[0].label} — ${scopedMetrics.equityCurve[scopedMetrics.equityCurve.length - 1].label}`
      : now
        ? formatShortDate(now)
        : '—'

  const netPositive = scopedMetrics.netPnl >= 0
  const drawdownPositive = scopedMetrics.maxDrawdown >= 0
  const greeting = now ? `${greetingForHour(now)}, ${firstName(user.name)}` : firstName(user.name)
  const longDate = now ? formatLongDate(now) : '—'

  return (
    <div className="min-h-screen bg-[#080c12] text-slate-200 selection:bg-cyan-300/30">
      <aside
        className={`${mobileNav ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col border-r border-white/[0.07] bg-[#0b1018] px-4 py-5 transition-transform lg:translate-x-0`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <Logo />
          <button onClick={() => setMobileNav(false)} className="text-slate-500 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="mb-5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
            <span>Private workspace</span>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          </div>
          <p className="text-[11px] leading-4 text-slate-500">
            {scopedMetrics.tradeCount === 0
              ? 'Log your first trade to unlock live analytics.'
              : `${scopedMetrics.tradeCount} trade${scopedMetrics.tradeCount === 1 ? '' : 's'} synced to your journal.`}
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActive(item.label)
                setMobileNav(false)
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium transition ${
                active === item.label ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
              }`}
            >
              <item.icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.label === 'Trade log' && (
                <span className="ml-auto text-[10px] text-slate-600">{trades.length}</span>
              )}
            </button>
          ))}
        </nav>
        <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-600">Workspace</p>
        <nav className="space-y-1">
          {workspaceItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActive(item.label)
                setMobileNav(false)
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium transition ${
                active === item.label ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
              }`}
            >
              <item.icon size={16} strokeWidth={1.8} />
              <span className={'accent' in item && item.accent ? 'text-cyan-300' : ''}>{item.label}</span>
              {'accent' in item && item.accent && (
                <span className="ml-auto rounded bg-cyan-400/10 px-1.5 py-0.5 text-[9px] text-cyan-300">AI</span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-white/[0.07] pt-4">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] text-slate-500 hover:text-slate-300 disabled:opacity-60"
          >
            <LogOut size={16} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-cyan-300 text-[10px] font-bold text-slate-950">
              {initialsFromName(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-slate-200">{user.name}</p>
              <p className="truncate text-[10px] text-slate-600">{user.email}</p>
            </div>
            <MoreHorizontal size={15} className="ml-auto text-slate-600" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[246px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-white/[0.07] bg-[#080c12]/90 px-5 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNav(true)} className="text-slate-400 lg:hidden" aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div>
              <p className="text-[11px] text-slate-500">{longDate}</p>
              <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-white">{greeting}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 md:flex">
              <CalendarDays size={14} className="text-slate-500" />
              <span className="text-[11px] text-slate-300">{rangeLabel}</span>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 md:flex">
              <WalletCards size={14} className="text-slate-500" />
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="max-w-[160px] bg-transparent text-[11px] text-slate-300 outline-none"
              >
                {accountOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="hidden items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-200 sm:flex"
            >
              <Plus size={15} strokeWidth={2.5} /> Add trade
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
          {active === 'Overview' && (
            <>
              <div className="mb-7 flex items-end justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Live overview
                    </span>
                  </div>
                  <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-white">Your trading edge</h2>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Metrics update from your journal — not sample data.
                  </p>
                </div>
                <div className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
                  <Command size={13} /> Press{' '}
                  <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    N
                  </kbd>{' '}
                  to add a trade
                </div>
              </div>

              <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Metric
                  label="Net P&L"
                  value={formatMoney(scopedMetrics.netPnl, true)}
                  change={
                    scopedMetrics.tradeCount
                      ? `${scopedMetrics.tradeCount} trade${scopedMetrics.tradeCount === 1 ? '' : 's'}`
                      : 'No trades yet'
                  }
                  positive={netPositive}
                  icon={<TrendingUp size={15} />}
                />
                <Metric
                  label="Win rate"
                  value={scopedMetrics.winRate === null ? '—' : `${scopedMetrics.winRate.toFixed(1)}%`}
                  change={scopedMetrics.winRate === null ? 'Log trades' : 'Closed trades'}
                  positive={(scopedMetrics.winRate ?? 0) >= 50}
                  icon={<Target size={15} />}
                />
                <Metric
                  label="Profit factor"
                  value={
                    scopedMetrics.profitFactor === null
                      ? scopedMetrics.netPnl > 0 && scopedMetrics.tradeCount > 0
                        ? '∞'
                        : '—'
                      : formatNumber(scopedMetrics.profitFactor)
                  }
                  change={
                    scopedMetrics.profitFactor === null
                      ? scopedMetrics.netPnl > 0 && scopedMetrics.tradeCount > 0
                        ? 'No losing trades yet'
                        : 'Needs wins & losses'
                      : 'Gross profit / loss'
                  }
                  positive={(scopedMetrics.profitFactor ?? (scopedMetrics.netPnl > 0 ? 2 : 0)) >= 1}
                  icon={<Activity size={15} />}
                />
                <Metric
                  label="Max drawdown"
                  value={formatMoney(scopedMetrics.maxDrawdown, true)}
                  change={scopedMetrics.tradeCount ? 'Peak to trough' : 'No equity yet'}
                  positive={drawdownPositive}
                  icon={<ArrowDownRight size={15} />}
                />
              </section>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
                <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5">
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-white">Equity curve</h3>
                        {scopedMetrics.tradeCount > 0 && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                              netPositive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
                            }`}
                          >
                            {formatMoney(scopedMetrics.netPnl, true)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Cumulative performance from logged trades</p>
                    </div>
                  </div>
                  <EquityChart points={scopedMetrics.equityCurve} />
                  <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.07]">
                    <div>
                      <p className="text-[10px] text-slate-500">Avg. daily P&L</p>
                      <p className="mt-1 text-[14px] font-semibold text-white">
                        {scopedMetrics.avgDailyPnl === null ? '—' : formatMoney(scopedMetrics.avgDailyPnl, true)}
                      </p>
                    </div>
                    <div className="pl-3 sm:pl-5">
                      <p className="text-[10px] text-slate-500">Best day</p>
                      <p className="mt-1 text-[14px] font-semibold text-emerald-300">
                        {scopedMetrics.bestDay === null ? '—' : formatMoney(scopedMetrics.bestDay, true)}
                      </p>
                    </div>
                    <div className="pl-3 sm:pl-5">
                      <p className="text-[10px] text-slate-500">Avg. R</p>
                      <p className="mt-1 text-[14px] font-semibold text-white">{formatR(scopedMetrics.avgR)}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-[13px] font-semibold text-white">Performance pulse</h3>
                      <p className="mt-1 text-[11px] text-slate-500">Derived from your journal</p>
                    </div>
                  </div>
                  {scopedMetrics.pulse.length === 0 ? (
                    <EmptyBlock message="Pulse metrics appear once you have a few logged trades with setups and session times." />
                  ) : (
                    <div className="space-y-4">
                      {scopedMetrics.pulse.map((row) => (
                        <PulseRow
                          key={row.label}
                          label={row.label}
                          value={row.value}
                          detail={row.detail}
                          width={`${Math.min(100, Math.max(8, row.width))}%`}
                          color="bg-cyan-300"
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-6 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3">
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold text-cyan-300">
                      <Sparkles size={12} /> EdgeCoach insight
                    </div>
                    <p className="text-[11px] leading-5 text-slate-400">
                      {scopedMetrics.insight ??
                        'Add trades with setups and stop losses to generate personalized coaching insights.'}
                    </p>
                  </div>
                </section>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                <TradeTable
                  trades={visibleTrades.slice(0, 8)}
                  search={search}
                  onSearch={setSearch}
                  onViewAll={() => setActive('Trade log')}
                  onDelete={handleDelete}
                  pending={pending}
                  compact
                />
                <DailyPnlPanel metrics={scopedMetrics} />
              </div>
            </>
          )}

          {active === 'Trade log' && (
            <div className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-white">Trade log</h2>
                  <p className="mt-1 text-[12px] text-slate-500">Every execution you’ve journaled.</p>
                </div>
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200"
                >
                  <Plus size={15} strokeWidth={2.5} /> Add trade
                </button>
              </div>
              <TradeTable
                trades={visibleTrades}
                search={search}
                onSearch={setSearch}
                onDelete={handleDelete}
                pending={pending}
              />
            </div>
          )}

          {active === 'EdgeCoach' && (
            <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-6">
              <div className="mb-3 flex items-center gap-2 text-cyan-300">
                <Sparkles size={18} />
                <h2 className="text-[18px] font-semibold text-white">EdgeCoach</h2>
              </div>
              <p className="max-w-2xl text-[13px] leading-6 text-slate-400">
                {scopedMetrics.insight ??
                  'EdgeCoach reads your closed trades to surface session bias, setup quality, and risk habits. Keep logging with setups and stops to sharpen the signal.'}
              </p>
            </section>
          )}
        </main>
      </div>

      {addOpen && (
        <AddTradeModal
          accounts={metrics.accounts}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            router.refresh()
          }}
        />
      )}

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-300 text-slate-950 shadow-[0_4px_25px_rgba(34,211,238,0.25)] sm:hidden"
        aria-label="Add trade"
      >
        <Plus size={20} />
      </button>
    </div>
  )
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center text-[11px] leading-5 text-slate-500">
      {message}
    </div>
  )
}

function DailyPnlPanel({ metrics }: { metrics: TradeMetrics }) {
  const maxAbs = Math.max(...metrics.dailyPnl.map((d) => Math.abs(d.pnl)), 1)
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-white">Daily P&L</h3>
          <p className="mt-1 text-[11px] text-slate-500">Last 7 days</p>
        </div>
        <BarChart3 size={16} className="text-slate-600" />
      </div>
      <div className="flex h-[132px] items-end justify-between gap-2 border-b border-white/[0.07] px-2">
        {metrics.dailyPnl.map((day) => {
          const height = Math.max(6, (Math.abs(day.pnl) / maxAbs) * 100)
          const negative = day.pnl < 0
          return (
            <div key={day.date} className="group flex h-full flex-1 flex-col justify-end gap-2">
              <div
                className={`relative w-full rounded-t-md transition ${
                  day.pnl === 0 ? 'bg-slate-700/50' : negative ? 'bg-rose-400/70' : 'bg-cyan-300/75 group-hover:bg-cyan-200'
                }`}
                style={{ height: `${height}%` }}
              >
                <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] text-slate-400 group-hover:block">
                  {formatMoney(day.pnl, true)}
                </span>
              </div>
              <span className="text-center text-[9px] text-slate-600">{day.label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-lg bg-white/[0.025] px-3 py-2.5">
        <span className="text-[10px] text-slate-500">This week</span>
        <span className={`text-[13px] font-semibold ${metrics.weekPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          {formatMoney(metrics.weekPnl, true)}
        </span>
      </div>
    </section>
  )
}

function TradeTable({
  trades,
  search,
  onSearch,
  onViewAll,
  onDelete,
  pending,
  compact = false,
}: {
  trades: TradeDTO[]
  search: string
  onSearch: (value: string) => void
  onViewAll?: () => void
  onDelete: (id: string) => void
  pending: boolean
  compact?: boolean
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-white">{compact ? 'Recent trades' : 'All trades'}</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {compact ? 'Your latest executions' : `${trades.length} matching trade${trades.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="text-[11px] font-medium text-cyan-300 hover:text-cyan-200">
            View trade log →
          </button>
        )}
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
        <Search size={14} className="text-slate-600" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search symbol or setup"
          className="w-full bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
        />
        <Filter size={13} className="text-slate-600" />
      </div>
      {trades.length === 0 ? (
        <EmptyBlock message="No trades yet. Press N or use Add trade to journal your first execution." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.12em] text-slate-600">
                <th className="pb-2 font-medium">Trade</th>
                <th className="pb-2 font-medium">Setup</th>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">R</th>
                <th className="pb-2 text-right font-medium">Net P&L</th>
                <th className="pb-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const opened = new Date(trade.openedAt)
                const closed = trade.closedAt ? new Date(trade.closedAt) : null
                const positive = trade.pnl >= 0
                return (
                  <tr key={trade.id} className="border-b border-white/[0.045] text-[11px] last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ${
                            positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'
                          }`}
                        >
                          {trade.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-medium capitalize text-slate-200">{trade.side}</p>
                          <p className="text-[10px] text-slate-600">{durationLabel(opened, closed)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-400">{trade.setup || '—'}</td>
                    <td className="text-slate-500">
                      {formatShortDate(opened)} · {formatTime(opened)}
                    </td>
                    <td className={positive ? 'text-emerald-300' : 'text-rose-300'}>{formatR(trade.rMultiple)}</td>
                    <td className={`text-right font-semibold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {formatMoney(trade.pnl, true)}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => onDelete(trade.id)}
                        disabled={pending}
                        className="rounded p-1.5 text-slate-600 hover:bg-white/[0.04] hover:text-rose-300 disabled:opacity-50"
                        aria-label={`Delete ${trade.symbol} trade`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AddTradeModal({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const form = new FormData(event.currentTarget)
      const emptyToNull = (value: FormDataEntryValue | null) => {
        const text = String(value ?? '').trim()
        return text ? text : null
      }
      const result = await createTradeAction({
        symbol: String(form.get('symbol') ?? ''),
        side,
        setup: emptyToNull(form.get('setup')),
        accountName: emptyToNull(form.get('accountName')),
        quantity: String(form.get('quantity') ?? ''),
        entryPrice: String(form.get('entryPrice') ?? ''),
        exitPrice: String(form.get('exitPrice') ?? ''),
        stopLoss: emptyToNull(form.get('stopLoss')),
        takeProfit: emptyToNull(form.get('takeProfit')),
        notes: emptyToNull(form.get('notes')),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this trade. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-trade-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[520px] rounded-2xl border border-white/10 bg-[#111923] p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id="add-trade-title" className="text-[16px] font-semibold text-white">
              Add a trade
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">P&L is calculated from entry, exit, quantity, and side.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="symbol" label="Symbol" placeholder="NQ" required />
          <Field name="quantity" label="Quantity" placeholder="1" type="number" step="any" required />
          <Field name="entryPrice" label="Entry price" placeholder="0.00" type="number" step="any" required />
          <Field name="exitPrice" label="Exit price" placeholder="0.00" type="number" step="any" required />
          <Field name="stopLoss" label="Stop loss" placeholder="Optional" type="number" step="any" />
          <Field name="takeProfit" label="Take profit" placeholder="Optional" type="number" step="any" />
          <Field name="setup" label="Setup" placeholder="Opening Range" className="col-span-2" />
          <label className="col-span-2 space-y-1.5">
            <span className="text-[10px] font-medium text-slate-500">Account</span>
            <input
              name="accountName"
              list="account-options"
              placeholder="e.g. Tradovate · Live"
              className="w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-cyan-300/60"
            />
            <datalist id="account-options">
              {accounts.map((account) => (
                <option key={account} value={account} />
              ))}
            </datalist>
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-[10px] font-medium text-slate-500">Direction</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide('long')}
                className={`rounded-lg border py-2.5 text-[11px] font-medium ${
                  side === 'long'
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/[0.09] text-slate-500'
                }`}
              >
                Long
              </button>
              <button
                type="button"
                onClick={() => setSide('short')}
                className={`rounded-lg border py-2.5 text-[11px] font-medium ${
                  side === 'short'
                    ? 'border-rose-400/40 bg-rose-400/10 text-rose-300'
                    : 'border-white/[0.09] text-slate-500'
                }`}
              >
                Short
              </button>
            </div>
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-[10px] font-medium text-slate-500">Notes</span>
            <textarea
              name="notes"
              rows={2}
              placeholder="What worked / what to improve"
              className="w-full resize-none rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-cyan-300/60"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[12px] text-rose-300">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[11px] text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save trade'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  name,
  label,
  placeholder,
  type = 'text',
  step,
  required,
  className = '',
}: {
  name: string
  label: string
  placeholder?: string
  type?: string
  step?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-cyan-300/60"
      />
    </label>
  )
}

function Metric({
  label,
  value,
  change,
  positive,
  icon,
}: {
  label: string
  value: string
  change: string
  positive: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className={positive ? 'text-cyan-300' : 'text-rose-300'}>{icon}</span>
      </div>
      <p className="text-[20px] font-semibold tracking-[-0.04em] text-white">{value}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className={`flex items-center gap-1 text-[10px] ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {change}
        </span>
        <Sparkline positive={positive} />
      </div>
    </div>
  )
}

function PulseRow({
  label,
  value,
  detail,
  width,
  color,
}: {
  label: string
  value: string
  detail: string
  width: string
  color: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-slate-300">{label}</p>
          <p className="text-[10px] text-slate-600">{detail}</p>
        </div>
        <span className="text-[12px] font-semibold text-white">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  )
}
