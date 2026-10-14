'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity, BarChart3, BookOpen, CalendarDays, Check, CircleHelp,
  FileText, Filter, LayoutDashboard, Link2, Menu, MoreHorizontal, Plus, Search,
  Settings2, ShieldCheck, Sparkles, Target, WalletCards, X,
} from 'lucide-react'
import { TradovateAccounts } from '@/components/tradovate-accounts'
import { Analytics, Calendar, Overview, TradeTable, type Trade } from '@/components/trading-views'
import type { TradovateSnapshot } from '@/lib/tradovate/types'
const navItems = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Trade log', icon: Activity },
  { label: 'Calendar', icon: CalendarDays }, { label: 'Analytics', icon: BarChart3 },
  { label: 'Strategies', icon: Target }, { label: 'Journal', icon: BookOpen },
]
const workspaceItems = [
  { label: 'Playbook', icon: FileText }, { label: 'Accounts', icon: WalletCards },
  { label: 'Prop firms', icon: ShieldCheck }, { label: 'EdgeCoach', icon: Sparkles, accent: true },
  { label: 'Reports', icon: FileText },
]
const initialTrades: Trade[] = []

const pageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  Overview: { eyebrow: 'Live overview', title: 'Your trading edge', description: "A clear view of what's working and where to improve." },
  'Trade log': { eyebrow: 'Execution journal', title: 'Trade log', description: 'Review, filter, and annotate every execution.' },
  Calendar: { eyebrow: 'Trading schedule', title: 'Calendar', description: 'Plan your sessions and review daily performance.' },
  Analytics: { eyebrow: 'Performance lab', title: 'Analytics', description: 'Turn your trade history into decisions you can repeat.' },
  Strategies: { eyebrow: 'Your edge library', title: 'Strategies', description: 'Define the setups you trade and measure their outcomes.' },
  Journal: { eyebrow: 'Session notes', title: 'Journal', description: 'Capture context before it disappears.' },
  Playbook: { eyebrow: 'Operating system', title: 'Playbook', description: 'Keep your rules, checklists, and best practices close.' },
  Accounts: { eyebrow: 'Capital overview', title: 'Accounts', description: 'Connect Tradovate and review balances, positions, and synced fills.' },
  'Prop firms': { eyebrow: 'Evaluation tracker', title: 'Prop firms', description: 'Monitor rules and progress across your evaluations.' },
  EdgeCoach: { eyebrow: 'Personal coach', title: 'EdgeCoach', description: 'Use your journal and metrics to build better habits.' },
  Reports: { eyebrow: 'Export center', title: 'Reports', description: 'Create clean summaries for review, sharing, or tax time.' },
  Settings: { eyebrow: 'Workspace controls', title: 'Settings', description: 'Configure your workspace and trading preferences.' },
  'Help center': { eyebrow: 'Support', title: 'Help center', description: 'Find answers and learn how to get more from EdgeLog.' },
}

function Logo() { return <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-[15px] font-black text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.28)]">E</div><span className="text-[16px] font-semibold tracking-[-0.03em] text-white">Edge<span className="text-cyan-300">Log</span></span></div> }
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-white/[0.07] bg-[#0d141e] p-4 sm:p-5 ${className}`}>{children}</section> }
function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) { return <div className="flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.015] px-6 text-center"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300"><Sparkles size={18} /></div><p className="text-[13px] font-medium text-slate-300">{title}</p><p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-600">{text}</p>{action && <button onClick={onAction} className="mt-4 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200">{action}</button>}</div> }
function greeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good morning'; if (hour < 17) return 'Good afternoon'; return 'Good evening' }

export default function EdgeLogDashboard({ user, initialSection = 'Overview', tradovateNotice = null }: { user: { name: string; email: string }; initialSection?: string; tradovateNotice?: string | null }) {
  const [active, setActive] = useState(initialSection); const [mobileNav, setMobileNav] = useState(false); const [addOpen, setAddOpen] = useState(false)
  const [trades, setTrades] = useState<Trade[]>(initialTrades); const [search, setSearch] = useState(''); const [symbol, setSymbol] = useState(''); const [side, setSide] = useState<'Long' | 'Short'>('Long'); const [pnl, setPnl] = useState('')
  const [snapshot, setSnapshot] = useState<TradovateSnapshot | null>(null); const [syncing, setSyncing] = useState(true); const [reloadKey, setReloadKey] = useState(0); const [notice, setNotice] = useState<string | null>(tradovateNotice)
  const displayTrades = useMemo(() => [...trades, ...(snapshot?.trades ?? []).map(trade => ({ id: trade.id, symbol: trade.symbol, side: trade.side, setup: trade.setup, detail: trade.detail, date: new Date(trade.closedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), pnl: trade.pnl, r: 0, tradedAt: trade.closedAt }))].sort((a, b) => (b.tradedAt ? Date.parse(b.tradedAt) : Date.now()) - (a.tradedAt ? Date.parse(a.tradedAt) : Date.now())), [trades, snapshot])
  const copy = pageCopy[active] ?? pageCopy.Overview
  const filteredTrades = useMemo(() => displayTrades.filter(t => `${t.symbol} ${t.setup} ${t.detail ?? ''}`.toLowerCase().includes(search.toLowerCase())), [displayTrades, search])
  const connected = Boolean(snapshot?.connections.some(connection => !connection.needsReconnect))
  const go = (label: string) => { setActive(label); setMobileNav(false) }
  const addTrade = () => { if (!symbol.trim()) return; const now = new Date().toISOString(); setTrades(current => [{ id: Date.now(), symbol: symbol.toUpperCase(), side, setup: 'Manual entry', date: 'Today', pnl: Number(pnl) || 0, r: 0, tradedAt: now }, ...current]); setSymbol(''); setPnl(''); setAddOpen(false) }
  useEffect(() => {
    if (!tradovateNotice) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('tradovate')) return
    url.searchParams.delete('tradovate'); url.searchParams.delete('message')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [tradovateNotice])
  useEffect(() => {
    let cancelled = false
    setSyncing(true)
    fetch('/api/tradovate/snapshot', { cache: 'no-store' }).then(async response => {
      if (response.status === 401) throw new Error('Sign in again to sync Tradovate.')
      if (!response.ok) throw new Error('Trading data could not be loaded.')
      return response.json() as Promise<TradovateSnapshot>
    }).then(data => { if (!cancelled) setSnapshot(data) }).catch(error => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Trading data could not be loaded.') }).finally(() => { if (!cancelled) setSyncing(false) })
    return () => { cancelled = true }
  }, [reloadKey])
  return <div className="min-h-screen bg-[#080c12] text-slate-200 selection:bg-cyan-300/30">
    <aside className={`${mobileNav ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col border-r border-white/[0.07] bg-[#0b1018] px-4 py-5 transition-transform lg:translate-x-0`}>
      <div className="mb-8 flex items-center justify-between px-2"><Logo /><button onClick={() => setMobileNav(false)} className="text-slate-500 lg:hidden" aria-label="Close menu"><X size={18} /></button></div>
      <nav className="space-y-1">{navItems.map(item => <NavButton key={item.label} {...item} active={active} onClick={go} />)}</nav>
      <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-600">Workspace</p><nav className="space-y-1">{workspaceItems.map(item => <NavButton key={item.label} {...item} active={active} onClick={go} />)}</nav>
      <div className="mt-auto space-y-1 border-t border-white/[0.07] pt-4"><NavButton label="Settings" icon={Settings2} active={active} onClick={go} /><NavButton label="Help center" icon={CircleHelp} active={active} onClick={go} /><div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-cyan-300 text-[10px] font-bold text-slate-950">{user.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-200">{user.name}</p><p className="text-[10px] text-slate-600">Pro plan</p></div><MoreHorizontal size={15} className="ml-auto text-slate-600" /></div></div>
    </aside>
    <div className="lg:pl-[246px]"><header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-white/[0.07] bg-[#080c12]/90 px-5 backdrop-blur-xl lg:px-8"><div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="text-slate-400 lg:hidden" aria-label="Open menu"><Menu size={20} /></button><div><p className="text-[11px] text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><h1 className="text-[16px] font-semibold tracking-[-0.02em] text-white">{greeting()}, {user.name}</h1></div></div><div className="flex items-center gap-2.5">{!syncing && !connected && <button onClick={() => go('Accounts')} className="hidden items-center gap-2 rounded-lg border border-cyan-300/30 px-3 py-2 text-[11px] font-semibold text-cyan-200 sm:flex"><Link2 size={14} /> Connect Tradovate</button>}<button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.18)] hover:bg-cyan-200"><Plus size={15} strokeWidth={2.5} /> Add trade</button></div></header>
      <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">{notice && <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-[12px] text-cyan-100"><p>{notice}</p><button onClick={() => setNotice(null)} aria-label="Dismiss notice" className="text-cyan-100/70 hover:text-white"><X size={14} /></button></div>}<div className="mb-7 flex items-end justify-between"><div><div className="mb-2 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.eyebrow}</span></div><h2 className="text-[26px] font-semibold tracking-[-0.04em] text-white">{copy.title}</h2><p className="mt-1 text-[12px] text-slate-500">{copy.description}</p></div></div>
        {active === 'Overview' && <Overview trades={displayTrades} positions={snapshot?.positions ?? []} syncing={syncing} connected={connected} onAdd={() => setAddOpen(true)} onTradeLog={() => go('Trade log')} onConnect={() => go('Accounts')} />}
        {active === 'Trade log' && <TradeLog trades={filteredTrades} search={search} setSearch={setSearch} onAdd={() => setAddOpen(true)} />}
        {active === 'Calendar' && <Calendar trades={displayTrades} />}
        {active === 'Analytics' && <Analytics trades={displayTrades} />}
        {active === 'Accounts' && <TradovateAccounts snapshot={snapshot} syncing={syncing} onReload={() => setReloadKey(key => key + 1)} />}
        {['Strategies', 'Journal', 'Playbook', 'Prop firms', 'EdgeCoach', 'Reports', 'Settings', 'Help center'].includes(active) && <WorkspacePage key={active} active={active} onAdd={() => setAddOpen(true)} />}
      </main></div>
    {addOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[#111923] p-5 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-[16px] font-semibold text-white">Add a trade</h2><p className="mt-1 text-[11px] text-slate-500">Log an execution while it's fresh.</p></div><button onClick={() => setAddOpen(false)} aria-label="Close" className="text-slate-500 hover:text-white"><X size={18} /></button></div><div className="grid grid-cols-2 gap-3"><label className="col-span-2 space-y-1.5"><span className="text-[10px] text-slate-500">Symbol</span><input autoFocus value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="NQ" className="w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-cyan-300/60" /></label><label className="space-y-1.5"><span className="text-[10px] text-slate-500">Net P&L</span><input value={pnl} onChange={e => setPnl(e.target.value)} placeholder="0.00" inputMode="decimal" className="w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-cyan-300/60" /></label><div className="space-y-1.5"><span className="text-[10px] text-slate-500">Direction</span><div className="grid grid-cols-2 gap-2"><button onClick={() => setSide('Long')} className={`rounded-lg border py-2.5 text-[11px] ${side === 'Long' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-white/[0.09] text-slate-500'}`}>Long</button><button onClick={() => setSide('Short')} className={`rounded-lg border py-2.5 text-[11px] ${side === 'Short' ? 'border-rose-400/40 bg-rose-400/10 text-rose-300' : 'border-white/[0.09] text-slate-500'}`}>Short</button></div></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setAddOpen(false)} className="rounded-lg px-3 py-2 text-[11px] text-slate-400 hover:text-white">Cancel</button><button onClick={addTrade} className="rounded-lg bg-cyan-300 px-4 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200">Save trade</button></div></div></div>}
  </div>
}

function NavButton({ label, icon: Icon, active, onClick, accent }: { label: string; icon: React.ElementType; active: string; onClick: (label: string) => void; accent?: boolean }) { return <button onClick={() => onClick(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition ${active === label ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}><Icon size={16} strokeWidth={1.8} /><span className={accent ? 'text-cyan-300' : ''}>{label}</span>{accent && <span className="ml-auto rounded bg-cyan-400/10 px-1.5 py-0.5 text-[9px] text-cyan-300">AI</span>}</button> }
function TradeLog({ trades, search, setSearch, onAdd }: { trades: Trade[]; search: string; setSearch: (value: string) => void; onAdd: () => void }) { return <Card><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-[13px] font-semibold text-white">All executions</h3><p className="mt-1 text-[11px] text-slate-500">{trades.length} matching trades</p></div><button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950"><Plus size={14} /> Add trade</button></div><div className="mb-4 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2"><Search size={14} className="text-slate-600" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol or setup" className="w-full bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600" /><Filter size={13} className="text-slate-600" /></div>{trades.length ? <TradeTable trades={trades} /> : <EmptyState title="Your trade log is empty" text="Capture the next execution and it will show up here." action="Log a trade" onAction={onAdd} />}</Card> }
function WorkspacePage({ active, onAdd }: { active: string; onAdd: () => void }) {
  const [items, setItems] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const configs: Record<string, { title: string; text: string; placeholder: string; button: string }> = {
    Strategies: { title: 'Strategy library', text: 'Create named setups with rules you can review against your results.', placeholder: 'e.g. Opening range breakout', button: 'Add strategy' },
    Journal: { title: 'Trading journal', text: 'Capture a pre-market plan, review, or lesson while it is still fresh.', placeholder: 'Write a journal prompt or session note', button: 'Save note' },
    Playbook: { title: 'Your playbook', text: 'Turn your best process into a checklist you can follow every session.', placeholder: 'e.g. Check higher timeframe bias', button: 'Add rule' },
    Accounts: { title: 'Trading accounts', text: 'Keep account names and risk limits visible before you place a trade.', placeholder: 'e.g. Apex evaluation', button: 'Add account' },
    'Prop firms': { title: 'Prop firm tracker', text: 'Track an evaluation, its target, and your current risk plan.', placeholder: 'e.g. 50K evaluation', button: 'Add evaluation' },
    EdgeCoach: { title: 'EdgeCoach workspace', text: 'Build a coaching queue from the questions you want to answer next.', placeholder: 'e.g. Review my losing trades', button: 'Add coaching focus' },
    Reports: { title: 'Report builder', text: 'Create a report scope, then use it for your weekly or monthly review.', placeholder: 'e.g. June performance review', button: 'Create report' },
    Settings: { title: 'Workspace settings', text: 'Your workspace controls are ready for configuration.', placeholder: 'e.g. Preferred trading session', button: 'Save preference' },
    'Help center': { title: 'Help center', text: 'Add a question to your support queue and keep moving.', placeholder: 'What do you need help with?', button: 'Add question' },
  }
  const config = configs[active]
  const addItem = () => { if (!draft.trim()) return; setItems(current => [draft.trim(), ...current]); setDraft('') }
  return <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
    <Card><div className="mb-5"><h3 className="text-[16px] font-semibold text-white">{config.title}</h3><p className="mt-1 max-w-lg text-[11px] leading-5 text-slate-500">{config.text}</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) addItem() }} placeholder={config.placeholder} className="min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-cyan-300/60" /><button onClick={addItem} className="flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-cyan-200"><Plus size={14} /> {config.button}</button></div>{items.length ? <div className="mt-5 space-y-2">{items.map((item, index) => <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-[12px] text-slate-300"><Check size={14} className="text-emerald-300" />{item}</div>)}</div> : <div className="mt-5"><EmptyState title="Nothing here yet" text="Use the field above to add your first item. It will stay in this page while you work." /></div>}</Card>
    <Card><h3 className="text-[13px] font-semibold text-white">Quick actions</h3><p className="mt-1 text-[11px] text-slate-500">Jump into the workflow that matters most.</p><div className="mt-5 space-y-2"><button onClick={onAdd} className="flex w-full items-center justify-between rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-left text-[11px] text-cyan-200">Log a trade <Plus size={14} /></button><div className="rounded-lg border border-white/[0.06] px-3 py-3 text-[11px] text-slate-500">{items.length ? `${items.length} item${items.length === 1 ? '' : 's'} added in this workspace` : 'No items added yet'}</div></div></Card>
  </div>
}
