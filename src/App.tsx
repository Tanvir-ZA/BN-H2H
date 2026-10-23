
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from './lib/supabase'
import type { Player } from './types'
import LoginForm from './components/LoginForm'
import H2HSection from './components/H2HSection'
import SubmitMatchForm from './components/SubmitMatchForm'
import MatchManager from './components/MatchManager'
import PlayerProfiles from './components/PlayerProfiles'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  Home,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Swords,
  Trash2,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'

type Tab = 'home' | 'h2h' | 'players' | 'submit' | 'admin'
type MessageType = 'success' | 'error'

const tabs = [
  { id: 'home' as const, label: 'Home', icon: Home, active: 'bg-blue-400/15 text-blue-300' },
  { id: 'h2h' as const, label: 'H2H Arena', icon: Swords, active: 'bg-violet-400/15 text-violet-300' },
  { id: 'players' as const, label: 'Players', icon: Users, active: 'bg-emerald-400/15 text-emerald-300' },
  { id: 'submit' as const, label: 'Submit Match', icon: Send, active: 'bg-orange-400/15 text-orange-300' },
  { id: 'admin' as const, label: 'Admin', icon: ShieldCheck, active: 'bg-pink-400/15 text-pink-300' },
]

export default function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [playerName, setPlayerName] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('success')
  const [saving, setSaving] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(true)

  async function loadPlayers() {
    setLoadingPlayers(true)

    const { data, error } = await supabase
      .from('players')
      .select('id, name, created_at')
      .order('name', { ascending: true })

    if (error) {
      setMessage(`Could not load players: ${error.message}`)
      setMessageType('error')
    } else {
      setPlayers((data ?? []) as Player[])
    }

    setLoadingPlayers(false)
  }

  async function checkAdmin(userId: string) {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Admin check failed:', error.message)
      setIsAdmin(false)
      return false
    }

    const admin = Boolean(data)
    setIsAdmin(admin)
    return admin
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data, error } = await supabase.auth.getSession()

      if (error) console.error('Session check failed:', error.message)
      if (!mounted) return

      if (data.session?.user) {
        const admin = await checkAdmin(data.session.user.id)
        if (!mounted) return

        if (!admin) {
          await supabase.auth.signOut()
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }

      await loadPlayers()
      if (mounted) setSessionChecked(true)
    }

    void initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session?.user) {
        setIsAdmin(false)
        return
      }

      setTimeout(() => {
        if (mounted) void checkAdmin(session.user.id)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  function showStatus(text: string, type: MessageType = 'success') {
    setMessage(text)
    setMessageType(type)
  }

  async function handleLoginSuccess() {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      showStatus('Login succeeded, but no active session was found.', 'error')
      return
    }

    const admin = await checkAdmin(user.id)

    if (admin) {
      setActiveTab('admin')
      showStatus('Welcome back, admin!')
    } else {
      await supabase.auth.signOut()
      showStatus('This account does not have admin access.', 'error')
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      showStatus(`Logout failed: ${error.message}`, 'error')
      return
    }

    setIsAdmin(false)
    setActiveTab('home')
    showStatus('Logged out successfully.')
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = playerName.trim()

    if (!name) {
      showStatus('Please enter a player name.', 'error')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('players').insert([{ name }])

    if (error) {
      showStatus(
        error.code === '23505'
          ? 'This player already exists.'
          : `Could not add player: ${error.message}`,
        'error',
      )
    } else {
      setPlayerName('')
      showStatus(`${name} added successfully!`)
      await loadPlayers()
    }

    setSaving(false)
  }

  async function removePlayer(player: Player) {
    if (
      !window.confirm(
        `Delete ${player.name}? This player must not have any existing matches.`,
      )
    ) return

    setSaving(true)

    const { data: linkedMatches, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .limit(1)

    if (matchError) {
      showStatus(`Could not check matches: ${matchError.message}`, 'error')
      setSaving(false)
      return
    }

    if (linkedMatches && linkedMatches.length > 0) {
      showStatus('This player has match records and cannot be deleted.', 'error')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', player.id)

    if (error) {
      showStatus(`Could not delete player: ${error.message}`, 'error')
    } else {
      showStatus(`${player.name} deleted.`)
      await loadPlayers()
    }

    setSaving(false)
  }

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080d13] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
            <Swords className="animate-pulse text-cyan-300" size={28} />
          </div>
          <p className="font-bold tracking-wide">BN PES DATABASE</p>
          <p className="mt-2 text-sm text-slate-500">Loading the arena...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080d13] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-blue-500/[0.06] blur-3xl" />
        <div className="absolute -right-40 top-80 h-96 w-96 rounded-full bg-violet-500/[0.05] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/[0.04] blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/[0.07] bg-[#080d13]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button onClick={() => setActiveTab('home')} className="flex min-w-0 items-center gap-3 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-[#071017] shadow-lg shadow-cyan-500/10">
              <Swords size={23} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[0.12em] sm:text-base">
                BN PES <span className="text-cyan-300">H2H</span>
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Rivalry database
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin ? (
              <>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-300 sm:inline-flex">
                  <ShieldCheck size={14} /> Admin
                </span>
                <button
                  onClick={() => void handleLogout()}
                  title="Log out"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-rose-400/30 hover:text-rose-300"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab('admin')}
                className="flex items-center gap-2 rounded-xl border border-pink-300/20 bg-pink-300/10 px-3 py-2 text-sm font-bold text-pink-200 transition hover:bg-pink-300/15"
              >
                <LogIn size={16} /> Admin login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto min-h-[70vh] max-w-7xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8">
        {message && (
          <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            messageType === 'success'
              ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200'
              : 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200'
          }`}>
            {messageType === 'success'
              ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
              : <XCircle className="mt-0.5 shrink-0" size={18} />}
            <p className="flex-1">{message}</p>
            <button onClick={() => setMessage('')} aria-label="Dismiss message" className="shrink-0 opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[2rem] border border-blue-400/20 bg-gradient-to-br from-blue-500/15 via-[#101722] to-violet-500/10 p-6 sm:p-10 lg:p-12">
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" />

              <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                    <Activity size={14} /> The ultimate rivalry tracker
                  </div>
                  <h1 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                    THE RIVALRY
                    <br />
                    <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                      LIVES HERE.
                    </span>
                  </h1>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                    Every match. Every goal. Every rivalry. Explore your BN PES community's head-to-head records in one place.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button onClick={() => setActiveTab('h2h')} className="inline-flex items-center gap-2 rounded-xl bg-blue-400 px-5 py-3 text-sm font-black text-[#07111d] transition hover:bg-blue-300">
                      Enter H2H Arena <ArrowRight size={17} />
                    </button>
                    <button onClick={() => setActiveTab('players')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]">
                      <Users size={17} /> Explore players
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <HomeStat icon={<Users size={19} />} label="Registered players" value={loadingPlayers ? '—' : players.length} color="border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-300" />
                  <HomeStat icon={<Swords size={19} />} label="H2H battles" value="Explore" color="border-violet-300/20 bg-violet-300/[0.07] text-violet-300" onClick={() => setActiveTab('h2h')} />
                  <HomeStat icon={<Send size={19} />} label="Submit a result" value="Play" color="border-orange-300/20 bg-orange-300/[0.07] text-orange-300" onClick={() => setActiveTab('submit')} />
                  <HomeStat icon={<Database size={19} />} label="Database status" value="Connected" color="border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-300" />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Choose your destination</p>
                  <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Your arena, your records.</h2>
                </div>
                <Zap className="text-amber-300" size={23} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FeatureCard icon={<Swords size={22} />} title="H2H Arena" description="Compare two rivals and their head-to-head results." color="border-violet-400/20 bg-violet-400/[0.06] text-violet-300" onClick={() => setActiveTab('h2h')} />
                <FeatureCard icon={<Users size={22} />} title="Players Hub" description="Player profiles, career stats and match history." color="border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300" onClick={() => setActiveTab('players')} />
                <FeatureCard icon={<Send size={22} />} title="Submit Match" description="Send your latest match result for approval." color="border-orange-400/20 bg-orange-400/[0.06] text-orange-300" onClick={() => setActiveTab('submit')} />
                <FeatureCard icon={<ShieldCheck size={22} />} title="Admin Panel" description="Manage players and review submitted matches." color="border-pink-400/20 bg-pink-400/[0.06] text-pink-300" onClick={() => setActiveTab('admin')} />
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><Database size={19} /></div>
                <div>
                  <p className="text-sm font-bold text-white">Supabase database</p>
                  <p className="mt-1 text-xs text-slate-500">Player records are loaded from your existing database.</p>
                </div>
              </div>
              <button onClick={() => void loadPlayers()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05]">
                <RefreshCw size={15} className={loadingPlayers ? 'animate-spin' : ''} /> Refresh players
              </button>
            </section>
          </div>
        )}

        {activeTab === 'h2h' && (
          <div className="space-y-5">
            <SectionHeading eyebrow="Violet zone · Head-to-head" title="H2H Arena" description="Pick your rivals and see who owns the matchup." color="text-violet-300" />
            <div className="rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-400/[0.06] to-transparent p-4 sm:p-6">
              <H2HSection players={players} />
            </div>
          </div>
        )}

        {activeTab === 'players' && <PlayerProfiles players={players} />}

        {activeTab === 'submit' && (
          <div className="space-y-5">
            <SectionHeading eyebrow="Orange zone · Match reporting" title="Submit a Match" description="Record your latest battle and send it for approval." color="text-orange-300" />
            <div className="rounded-3xl border border-orange-400/15 bg-gradient-to-br from-orange-400/[0.06] to-transparent p-4 sm:p-6">
              <SubmitMatchForm players={players} onSubmitted={() => showStatus('Match submitted! It will appear in records after approval.')} />
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <SectionHeading eyebrow="Pink zone · Restricted access" title="Admin Control" description="Manage the player directory and moderate match submissions." color="text-pink-300" />

            {!isAdmin ? (
              <div className="mx-auto max-w-lg rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-400/[0.07] to-transparent p-5 sm:p-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-300/20 bg-pink-300/10 text-pink-300">
                  <ShieldCheck size={28} />
                </div>
                <h3 className="mb-2 text-xl font-black text-white">Admin sign in</h3>
                <p className="mb-6 text-sm leading-6 text-slate-400">
                  Sign in with your authorized admin account to manage players and approve match results.
                </p>
                <LoginForm onLoginSuccess={handleLoginSuccess} />
              </div>
            ) : (
              <div className="space-y-6">
                <section className="rounded-3xl border border-pink-400/15 bg-gradient-to-br from-pink-400/[0.06] to-transparent p-4 sm:p-6">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-pink-300">
                        <Users size={19} />
                        <h3 className="text-lg font-black text-white">Player management</h3>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Add players to or remove them from the directory.</p>
                    </div>
                    <span className="w-fit rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1.5 text-xs font-bold text-pink-200">{players.length} players</span>
                  </div>

                  <form onSubmit={addPlayer} className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      placeholder="Enter new player name..."
                      maxLength={60}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1117] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-pink-300/40"
                    />
                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-300 px-5 py-3 text-sm font-black text-[#180b15] transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-50">
                      <Plus size={17} /> {saving ? 'Please wait...' : 'Add player'}
                    </button>
                  </form>

                  <div className="mt-5 space-y-2">
                    {loadingPlayers ? (
                      <p className="py-5 text-center text-sm text-slate-500">Loading players...</p>
                    ) : players.length === 0 ? (
                      <p className="py-5 text-center text-sm text-slate-500">No players yet. Add your first player above.</p>
                    ) : (
                      players.map((player) => (
                        <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-300/10 text-sm font-black text-pink-200">{player.name.slice(0, 2).toUpperCase()}</div>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">{player.name}</span>
                          <button onClick={() => void removePlayer(player)} disabled={saving} title={`Delete ${player.name}`} className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.05] to-transparent p-4 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300"><ShieldCheck size={20} /></div>
                    <div>
                      <h3 className="text-lg font-black text-white">Match moderation</h3>
                      <p className="mt-1 text-sm text-slate-500">Review match reports using your existing controls.</p>
                    </div>
                  </div>
                  <MatchManager players={players} />
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] px-4 pb-28 pt-6 text-center">
        <p className="text-xs font-bold tracking-[0.15em] text-slate-500">BN PES H2H DATABASE</p>
        <p className="mt-2 text-xs text-slate-600">Built for the rivalry. Powered by the community.</p>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#080d13]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 pb-2 pt-2 sm:px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 transition duration-200 sm:gap-1.5 ${
                  active ? `${tab.active} scale-[1.02]` : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                {active && <span className="absolute -top-2 h-0.5 w-7 rounded-full bg-current" />}
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="truncate text-[10px] font-bold sm:hidden">{tab.id === 'submit' ? 'Submit' : tab.label === 'H2H Arena' ? 'H2H' : tab.label}</span>
                <span className="hidden truncate text-xs font-bold sm:block">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  color,
}: {
  eyebrow: string
  title: string
  description: string
  color: string
}) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-[0.2em] ${color}`}>{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function HomeStat({
  icon,
  label,
  value,
  color,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string | number
  color: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:bg-white/[0.04]' : 'cursor-default'
      } ${color}`}
    >
      <div className="mb-4">{icon}</div>
      <p className="text-xl font-black text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{label}</p>
    </button>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  color,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-1 hover:bg-white/[0.04] sm:p-5 ${color}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl bg-black/20 p-3">{icon}</div>
        <ArrowRight size={17} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-white" />
      </div>
      <h3 className="font-extrabold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
    </button>
  )
}
