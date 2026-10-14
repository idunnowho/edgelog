'use client'

import { useMemo, useState } from 'react'
import { Activity, BarChart3, Target, TrendingUp } from 'lucide-react'

export type Trade = { id: number | string; symbol: string; side: 'Long' | 'Short'; setup: string; detail?: string; date: string; pnl: number; r: number; tradedAt?: string }

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5 ${className}`}>{children}</section>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.015] px-6 text-center"><p className="text-[13px] font-medium text-slate-300">{title}</p><p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-600">{text}</p>{action && onAction && <button onClick={onAction} className="mt-4 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200">{action}</button>}</div>
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card className="p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] text-slate-500">{label}</span><span className="text-cyan-300">{icon}</span></div><p className="truncate text-[20px] font-semibold tracking-[-0.04em] text-white">{value}</p><p className="mt-2 text-[10px] text-slate-600">{detail}</p></Card>
}

export function TradeTable({ trades }: { trades: Trade[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.12em] text-slate-600"><th className="pb-2 font-medium">Trade</th><th className="pb-2 font-medium">Setup</th><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">R</th><th className="pb-2 text-right font-medium">P&L</th></tr></thead><tbody>{trades.map(trade => <tr key={trade.id} className="border-b border-white/[0.045] text-[11px] last:border-0"><td className="py-3"><span className="font-semibold text-white">{trade.symbol}</span><span className={`ml-2 text-[10px] ${trade.side === 'Long' ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.side}</span>{trade.detail && <p className="mt-0.5 text-[10px] text-slate-600">{trade.detail}</p>}</td><td className="py-3 text-slate-400">{trade.setup}</td><td className="py-3 text-slate-500">{trade.date}</td><td className="py-3 text-slate-500">{trade.r ? `${trade.r.toFixed(1)}R` : '—'}</td><td className={`py-3 text-right font-semibold ${trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{signedMoney(trade.pnl)}</td></tr>)}</tbody></table></div>
}

export function Overview({ trades, positions, syncing, connected, onAdd, onTradeLog, onConnect }: { trades: Trade[]; positions: { id: string; symbol: string; netPos: number; accountName: string }[]; syncing: boolean; connected: boolean; onAdd: () => void; onTradeLog: () => void; onConnect: () => void }) {
  const stats = tradeStats(trades)
  const empty = !trades.length
    ? syncing
      ? { title: 'Checking Tradovate', text: 'Balances and fills will show here after the sync finishes.', action: undefined, onAction: undefined }
      : connected
        ? { title: 'No closed round trips yet', text: 'Open positions still appear here and on Accounts.', action: 'Add a trade', onAction: onAdd }
        : { title: 'Your equity curve starts here', text: 'Connect Tradovate to import fills, or log a trade yourself.', action: 'Connect Tradovate', onAction: onConnect }
    : null
  return <>
    <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Net P&L" value={trades.length ? signedMoney(stats.net) : '$0.00'} detail={trades.length ? `${trades.length} trades logged` : 'No trades yet'} icon={<TrendingUp size={15} />} />
      <Metric label="Win rate" value={stats.winRate == null ? '—' : `${Math.round(stats.winRate * 100)}%`} detail="Across logged trades" icon={<Target size={15} />} />
      <Metric label="Profit factor" value={stats.profitFactor == null ? (stats.hasWins ? '∞' : '—') : stats.profitFactor.toFixed(2)} detail={stats.profitFactor == null ? 'Needs a win and a loss' : 'Gross profit ÷ gross loss'} icon={<Activity size={15} />} />
      <Metric label="Max drawdown" value={money(stats.maxDrawdown)} detail={stats.maxDrawdown ? 'Peak to trough' : 'No drawdown recorded'} icon={<BarChart3 size={15} />} />
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
      <Card>
        <div className="mb-5"><h3 className="text-[13px] font-semibold text-white">Equity curve</h3><p className="mt-1 text-[11px] text-slate-500">Cumulative performance across logged and synced trades</p></div>
        {empty ? <EmptyState title={empty.title} text={empty.text} action={empty.action} onAction={empty.onAction} /> : <EquityCurve values={stats.curve} />}
      </Card>
      <Card>
        <h3 className="text-[13px] font-semibold text-white">Open positions</h3>
        <p className="mt-1 text-[11px] text-slate-500">{positions.length ? `${positions.length} open from Tradovate` : 'No open Tradovate positions'}</p>
        {positions.length ? <div className="mt-5 space-y-2">{positions.slice(0, 6).map(position => <div key={position.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-[11px]"><span className="font-medium text-white">{position.symbol}<span className="mt-0.5 block text-[10px] font-normal text-slate-600">{position.accountName}</span></span><span className={position.netPos > 0 ? 'text-emerald-300' : 'text-rose-300'}>{Math.abs(position.netPos)} {position.netPos > 0 ? 'Long' : 'Short'}</span></div>)}</div> : <div className="mt-5"><EmptyState title={connected ? 'Flat right now' : 'No broker positions'} text={connected ? 'New positions show up the next time EdgeLog syncs.' : 'Connect Tradovate to see live positions here.'} action={connected ? undefined : 'Connect Tradovate'} onAction={connected ? undefined : onConnect} /></div>}
      </Card>
    </div>
    <Card className="mt-5">
      <div className="mb-4 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-white">Recent trades</h3><p className="mt-1 text-[11px] text-slate-500">Manual entries and Tradovate round trips</p></div><button onClick={onTradeLog} className="text-[11px] font-medium text-cyan-300">View trade log →</button></div>
      {trades.length ? <TradeTable trades={trades.slice(0, 5)} /> : <EmptyState title="No trades logged yet" text={connected ? 'Closed Tradovate round trips will show up after the next fill.' : 'Connect Tradovate or add your first trade.'} action={connected ? 'Add trade' : 'Connect Tradovate'} onAction={connected ? onAdd : onConnect} />}
    </Card>
  </>
}

export function Calendar({ trades }: { trades: Trade[] }) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date().getDate())
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad = (new Date(year, month, 1).getDay() + 6) % 7
  const byDay = useMemo(() => {
    const map = new Map<number, Trade[]>()
    for (const trade of trades) {
      if (!trade.tradedAt) continue
      const stamp = new Date(trade.tradedAt)
      if (stamp.getFullYear() !== year || stamp.getMonth() !== month) continue
      const day = stamp.getDate()
      map.set(day, [...(map.get(day) ?? []), trade])
    }
    return map
  }, [trades, year, month])
  const activeDay = Math.min(selected, daysInMonth)
  const selectedTrades = byDay.get(activeDay) ?? []
  const selectedPnl = selectedTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const today = new Date()
  const label = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedLabel = new Date(year, month, activeDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const shift = (delta: number) => { setCursor(new Date(year, month + delta, 1)); setSelected(1) }
  return <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><Card><div className="mb-5 flex items-center justify-between"><div><h3 className="text-[13px] font-semibold text-white">{label}</h3><p className="mt-1 text-[11px] text-slate-500">Days with closed trades are marked</p></div><div className="flex gap-2"><button onClick={() => shift(-1)} className="rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] text-slate-400">Prev</button><button onClick={() => shift(1)} className="rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] text-slate-400">Next</button></div></div><div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-600">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="pb-2">{day}</span>)}{Array.from({ length: startPad }, (_, index) => <span key={`pad-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const dayTrades = byDay.get(day) ?? []
    const pnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0)
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
    const isSelected = activeDay === day
    return <button key={day} onClick={() => setSelected(day)} className={`flex h-10 flex-col items-center justify-center rounded-lg ${isSelected ? 'border border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : isToday ? 'border border-white/[0.12] bg-white/[0.04] text-slate-200' : 'bg-white/[0.02] text-slate-500'}`}><span>{day}</span>{dayTrades.length > 0 && <span className={`mt-0.5 h-1 w-1 rounded-full ${pnl >= 0 ? 'bg-emerald-300' : 'bg-rose-300'}`} />}</button>
  })}</div></Card><Card><h3 className="text-[13px] font-semibold text-white">Day summary</h3><p className="mt-1 text-[11px] text-slate-500">{selectedLabel}</p><div className="mt-5">{selectedTrades.length ? <div><p className={`text-[20px] font-semibold ${selectedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{signedMoney(selectedPnl)}</p><p className="mt-1 text-[11px] text-slate-500">{selectedTrades.length} closed trade{selectedTrades.length === 1 ? '' : 's'}</p><div className="mt-4"><TradeTable trades={selectedTrades} /></div></div> : <EmptyState title="No session logged" text="Select a marked day to review the round trips closed in that session." />}</div></Card></div>
}

export function Analytics({ trades }: { trades: Trade[] }) {
  const winners = trades.filter(trade => trade.pnl > 0)
  const losers = trades.filter(trade => trade.pnl < 0)
  const average = (list: Trade[]) => list.length ? list.reduce((sum, trade) => sum + trade.pnl, 0) / list.length : null
  const bySetup = groupPnl(trades, trade => trade.setup)
  const bySymbol = groupPnl(trades, trade => trade.symbol)
  const longPnl = trades.filter(trade => trade.side === 'Long').reduce((sum, trade) => sum + trade.pnl, 0)
  const shortPnl = trades.filter(trade => trade.side === 'Short').reduce((sum, trade) => sum + trade.pnl, 0)
  const best = bySymbol[0]
  return <>
    <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Sample size" value={`${trades.length}`} detail="Logged and synced trades" icon={<Activity size={15} />} />
      <Metric label="Average winner" value={average(winners) == null ? '—' : signedMoney(average(winners)!)} detail={winners.length ? `${winners.length} winners` : 'No winning trades'} icon={<TrendingUp size={15} />} />
      <Metric label="Average loser" value={average(losers) == null ? '—' : signedMoney(average(losers)!)} detail={losers.length ? `${losers.length} losers` : 'No losing trades'} icon={<BarChart3 size={15} />} />
      <Metric label="Best symbol" value={best?.label ?? '—'} detail={best ? signedMoney(best.pnl) : 'Needs trade data'} icon={<Target size={15} />} />
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <h3 className="text-[13px] font-semibold text-white">Performance by setup</h3>
        <p className="mt-1 text-[11px] text-slate-500">Tradovate fills are grouped with the account they came from</p>
        {bySetup.length ? <Breakdown rows={bySetup.slice(0, 6)} /> : <div className="mt-5"><EmptyState title="Not enough data" text="Log a trade or connect Tradovate to compare setups." /></div>}
      </Card>
      <Card>
        <h3 className="text-[13px] font-semibold text-white">Behavior patterns</h3>
        <p className="mt-1 text-[11px] text-slate-500">Long and short results from the same trade set</p>
        {trades.length ? <div className="mt-5 space-y-2"><Pattern label="Long trades" value={signedMoney(longPnl)} positive={longPnl >= 0} /><Pattern label="Short trades" value={signedMoney(shortPnl)} positive={shortPnl >= 0} /></div> : <div className="mt-5"><EmptyState title="Patterns will appear here" text="EdgeLog needs trading history before it can compare directions." /></div>}
      </Card>
    </div>
  </>
}

function EquityCurve({ values }: { values: number[] }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 640
  const height = 180
  const line = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 20) - 10
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = values[values.length - 1] ?? 0
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label={`Equity curve ending at ${money(last)}`}><path d={line} fill="none" stroke={last >= 0 ? '#67e8f9' : '#fb7185'} strokeWidth="2.5" /></svg>
}

function Breakdown({ rows }: { rows: { label: string; pnl: number; count: number }[] }) {
  return <div className="mt-5 space-y-2">{rows.map(row => <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-3 text-[11px]"><span className="min-w-0 truncate text-slate-300">{row.label}<span className="ml-2 text-slate-600">{row.count}</span></span><span className={row.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signedMoney(row.pnl)}</span></div>)}</div>
}

function Pattern({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-3 text-[11px]"><span className="text-slate-300">{label}</span><span className={positive ? 'text-emerald-300' : 'text-rose-300'}>{value}</span></div>
}

function tradeStats(trades: Trade[]) {
  const ordered = [...trades].sort((a, b) => (a.tradedAt ? Date.parse(a.tradedAt) : 0) - (b.tradedAt ? Date.parse(b.tradedAt) : 0))
  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  let grossProfit = 0
  let grossLoss = 0
  let wins = 0
  const curve = [0]
  for (const trade of ordered) {
    equity += trade.pnl
    curve.push(equity)
    peak = Math.max(peak, equity)
    maxDrawdown = Math.max(maxDrawdown, peak - equity)
    if (trade.pnl > 0) { grossProfit += trade.pnl; wins += 1 }
    else if (trade.pnl < 0) grossLoss += Math.abs(trade.pnl)
  }
  return { net: equity, winRate: ordered.length ? wins / ordered.length : null, profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null, hasWins: wins > 0, maxDrawdown, curve }
}

function groupPnl(trades: Trade[], key: (trade: Trade) => string) {
  const map = new Map<string, { label: string; pnl: number; count: number }>()
  for (const trade of trades) {
    const label = key(trade)
    const current = map.get(label) ?? { label, pnl: 0, count: 0 }
    current.pnl += trade.pnl
    current.count += 1
    map.set(label, current)
  }
  return [...map.values()].sort((a, b) => b.pnl - a.pnl)
}

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function signedMoney(value: number) {
  const formatted = money(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}
