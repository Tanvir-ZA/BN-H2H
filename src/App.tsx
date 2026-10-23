import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import type { Player } from './types'
import LoginForm from './components/LoginForm'
import H2HSection from './components/H2HSection'
import SubmitMatchForm from './components/SubmitMatchForm'
import MatchManager from './components/MatchManager'
import PlayerProfiles from './components/PlayerProfiles'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Swords,
  Trash2,
  Users,
  X,
  XCircle,
  Menu,
} from 'lucide-react'

type Tab = 'home' | 'h2h' | 'players' | 'submit' | 'admin'
type MessageType = 'success' | 'error'

const tabs = [
  { id: 'h2h' as const, label: 'H2H', icon: Swords, active: 'bg-cyan-300/15 text-cyan-200' },
  { id: 'players' as const, label: 'Players', icon: Users, active: 'bg-violet-300/15 text-violet-200' },
  { id: 'submit' as const, label: 'Submit', icon: Send, active: 'bg-fuchsia-300/15 text-fuchsia-200' },
]

export default function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [tabHistory, setTabHistory] = useState<Tab[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('success')
  const [saving, setSaving] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(true)

  function navigateTo(tab: Tab) {
    if (tab !== activeTab) {
      setTabHistory((history) => [...history, activeTab])
    }
    setActiveTab(tab)
    setMenuOpen(false)
  }

  function goBack() {
    const previous = tabHistory[tabHistory.length - 1]
    setActiveTab(previous ?? 'home')
    setTabHistory((history) => history.slice(0, -1))
    setMenuOpen(false)
  }

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
      navigateTo('admin')
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
    setTabHistory([])
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
    ) {
      return
    }

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

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080b14]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <button
            onClick={() => navigateTo('home')}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Go to home"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-200 via-cyan-400 to-blue-600 text-[#071017] shadow-lg shadow-cyan-400/20">
              <Swords size={21} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[0.13em] sm:text-base">
                BN PES <span className="bg-gradient-to-r from-cyan-200 to-violet-300 bg-clip-text text-transparent">H2H</span>
              </p>
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Rivalry database
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-bold text-emerald-200 sm:inline-flex">
                <ShieldCheck size={14} /> Admin
              </span>
            )}

            {isAdmin && (
              <button
                onClick={() => void handleLogout()}
                title="Log out"
                className="hidden items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-rose-300/30 hover:text-rose-200 sm:flex"
              >
                <LogOut size={16} /> Logout
              </button>
            )}

            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-cyan-200/30 hover:bg-white/[0.08]"
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <>
            <button
              aria-label="Close menu overlay"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 top-[65px] -z-10 cursor-default bg-black/30 sm:top-[69px]"
            />
            <div className="absolute right-4 top-[calc(100%-2px)] w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#111827]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:right-6">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Menu
              </div>
              {isAdmin ? (
                <button
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-300/10"
                >
                  <LogOut size={17} /> Log out
                </button>
              ) : (
                <button
                  onClick={() => navigateTo('admin')}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white transition hover:bg-gradient-to-r hover:from-fuchsia-400/15 hover:to-violet-400/15"
                >
                  <ShieldCheck size={17} className="text-fuchsia-200" />
                  Admin login
                  <ArrowRight size={15} className="ml-auto text-slate-500" />
                </button>
              )}
            </div>
          </>
        )}
      </header>

      <main className="relative z-10 mx-auto min-h-[75vh] max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8">
        {activeTab !== 'home' && (
          <button
            onClick={goBack}
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-200/25 hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {message && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              messageType === 'success'
                ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200'
                : 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200'
            }`}
          >
            {messageType === 'success' ? (
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            ) : (
              <XCircle className="mt-0.5 shrink-0" size={18} />
            )}
            <p className="flex-1">{message}</p>
            <button
              onClick={() => setMessage('')}
              aria-label="Dismiss message"
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-5 sm:space-y-7">
            <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#101525] p-6 shadow-2xl shadow-blue-950/20 sm:p-10 lg:p-12">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.20),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.24),transparent_45%),linear-gradient(125deg,rgba(20,30,54,0.9),rgba(9,13,25,0.98))]" />
              <div className="pointer-events-none absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />

              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
                  Built for the rivalry
                </span>
                <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl">
                  Know your rival.
                  <br />
                  <span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                    Own the pitch.
                  </span>
                </h1>
                <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
                  Every match. Every goal. Your BN PES story, all in one arena.
                </p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <button
                onClick={() => navigateTo('h2h')}
                className="group relative isolate overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#0f1c29] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40 hover:shadow-xl hover:shadow-cyan-950/30 sm:p-6"
              >
                <span className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-cyan-300/[0.14] via-blue-400/[0.04] to-transparent opacity-80 transition group-hover:opacity-100" />
                <div className="mb-8 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-200/10 text-cyan-100">
                    <Swords size={21} />
                  </span>
                  <ArrowRight size={18} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-100" />
                </div>
                <h2 className="text-lg font-extrabold tracking-tight">View H2H</h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">Compare rivals head-to-head</p>
              </button>

              <button
                onClick={() => navigateTo('players')}
                className="group relative isolate overflow-hidden rounded-2xl border border-violet-200/15 bg-[#171429] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-violet-200/40 hover:shadow-xl hover:shadow-violet-950/30 sm:p-6"
              >
                <span className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-violet-400/[0.16] via-fuchsia-400/[0.04] to-transparent" />
                <div className="mb-8 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-100/15 bg-violet-200/10 text-violet-100">
                    <Users size={21} />
                  </span>
                  <ArrowRight size={18} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-violet-100" />
                </div>
                <h2 className="text-lg font-extrabold tracking-tight">Player Profiles</h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">Stats, records & match history</p>
              </button>

              <button
                onClick={() => navigateTo('submit')}
                className="group relative isolate overflow-hidden rounded-2xl border border-fuchsia-200/15 bg-[#211426] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-fuchsia-200/40 hover:shadow-xl hover:shadow-fuchsia-950/30 sm:p-6"
              >
                <span className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-fuchsia-400/[0.16] via-pink-400/[0.04] to-transparent" />
                <div className="mb-8 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-fuchsia-100/15 bg-fuchsia-200/10 text-fuchsia-100">
                    <Send size={21} />
                  </span>
                  <ArrowRight size={18} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-fuchsia-100" />
                </div>
                <h2 className="text-lg font-extrabold tracking-tight">Submit a Match</h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">Add your latest result</p>
              </button>
            </section>

            <p className="pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              {loadingPlayers
                ? 'Loading player database…'
                : `${players.length} players · One community · Every rivalry`}
            </p>
          </div>
        )}

        {activeTab === 'h2h' && (
          <div className="space-y-5">
            <SectionHeading
              eyebrow="Violet zone · Head-to-head"
              title="H2H Arena"
              description="Pick your rivals and see who owns the matchup."
              color="text-violet-300"
            />
            <div className="rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-400/[0.06] to-transparent p-4 sm:p-6">
              <H2HSection players={players} />
            </div>
          </div>
        )}

        {activeTab === 'players' && <PlayerProfiles players={players} />}

        {activeTab === 'submit' && (
          <div className="space-y-5">
            <SectionHeading
              eyebrow="Orange zone · Match reporting"
              title="Submit a Match"
              description="Record your latest battle and send it for approval."
              color="text-orange-300"
            />
            <div className="rounded-3xl border border-orange-400/15 bg-gradient-to-br from-orange-400/[0.06] to-transparent p-4 sm:p-6">
              <SubmitMatchForm
                players={players}
                onSubmitted={() =>
                  showStatus('Match submitted! It will appear in records after approval.')
                }
              />
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <SectionHeading
              eyebrow="Pink zone · Restricted access"
              title="Admin Control"
              description="Manage the player directory and moderate match submissions."
              color="text-pink-300"
            />

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
                      <p className="mt-1 text-sm text-slate-500">
                        Add players to or remove them from the directory.
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1.5 text-xs font-bold text-pink-200">
                      {players.length} players
                    </span>
                  </div>

                  <form onSubmit={addPlayer} className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      placeholder="Enter new player name..."
                      maxLength={60}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1117] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-pink-300/40"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-300 px-5 py-3 text-sm font-black text-[#180b15] transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={17} /> {saving ? 'Please wait...' : 'Add player'}
                    </button>
                  </form>

                  <div className="mt-5 space-y-2">
                    {loadingPlayers ? (
                      <p className="py-5 text-center text-sm text-slate-500">Loading players...</p>
                    ) : players.length === 0 ? (
                      <p className="py-5 text-center text-sm text-slate-500">
                        No players yet. Add your first player above.
                      </p>
                    ) : (
                      players.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-3"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-300/10 text-sm font-black text-pink-200">
                            {player.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">
                            {player.name}
                          </span>
                          <button
                            onClick={() => void removePlayer(player)}
                            disabled={saving}
                            title={`Delete ${player.name}`}
                            className="rounded-xl border border-rose-400/15 p-2.5 text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.05] to-transparent p-4 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">Match moderation</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Review match reports using your existing controls.
                      </p>
                    </div>
                  </div>
                  <MatchManager players={players} />
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#090d17]/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2 px-3 pb-2 pt-2 sm:px-5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => navigateTo(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition duration-200 ${
                  active
                    ? `${tab.active} bg-gradient-to-b from-white/[0.07] to-transparent`
                    : 'text-slate-500 hover:bg-white/[0.035] hover:text-slate-200'
                }`}
              >
                {active && (
                  <span className="absolute -top-2 h-0.5 w-8 rounded-full bg-gradient-to-r from-cyan-200 to-violet-300 shadow-[0_0_12px_rgba(103,232,249,0.4)]" />
                )}
                <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[10px] font-bold sm:text-xs">{tab.label}</span>
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