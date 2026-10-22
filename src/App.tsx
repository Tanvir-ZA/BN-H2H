
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { supabase } from './lib/supabase'
import type { Player } from './types'

import LoginForm from './components/LoginForm'
import H2HSection from './components/H2HSection'
import SubmitMatchForm from './components/SubmitMatchForm'
import MatchManager from './components/MatchManager'

export default function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [saving, setSaving] = useState(false)

  async function loadPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, created_at')
      .order('name')

    if (error) {
      setMessageType('error')
      setMessage(`Could not load players: ${error.message}`)
      return
    }

    setPlayers((data ?? []) as Player[])
  }

  async function checkAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    return !error && Boolean(data)
  }

  useEffect(() => {
    let active = true

    async function initialize() {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        if (active) {
          setMessageType('error')
          setMessage(`Session error: ${error.message}`)
          setSessionChecked(true)
        }
        return
      }

      const user = data.session?.user

      if (user) {
        const admin = await checkAdmin(user.id)

        if (active) setIsAdmin(admin)

        if (!admin) {
          await supabase.auth.signOut()
        }
      }

      await loadPlayers()

      if (active) setSessionChecked(true)
    }

    void initialize()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setIsAdmin(false)
          return
        }

        setTimeout(() => {
          void checkAdmin(session.user.id).then(admin => {
            if (active) setIsAdmin(admin)
          })
        }, 0)
      },
    )

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = playerName.trim()
    if (!name || saving) return

    setSaving(true)
    setMessage('')

    try {
      const { error } = await supabase.from('players').insert({ name })

      if (error) {
        setMessageType('error')
        setMessage(
          error.code === '23505'
            ? 'This player already exists.'
            : `Could not add player: ${error.message}`,
        )
        return
      }

      setPlayerName('')
      setMessageType('success')
      setMessage(`${name} added successfully.`)
      await loadPlayers()
    } finally {
      setSaving(false)
    }
  }

  async function removePlayer(player: Player) {
    if (saving) return

    const confirmed = window.confirm(
      `Remove ${player.name}?\n\nPlayers with existing match history cannot be removed, so no records are accidentally lost.`,
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')

    try {
      // Preserve historical matches: never delete a player who has matches.
      const { data: linkedMatches, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .limit(1)

      if (matchError) {
        setMessageType('error')
        setMessage(`Could not check match history: ${matchError.message}`)
        return
      }

      if (linkedMatches && linkedMatches.length > 0) {
        setMessageType('error')
        setMessage(
          `${player.name} has existing matches and cannot be removed without affecting match history.`,
        )
        return
      }

      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id)

      if (error) {
        setMessageType('error')
        setMessage(`Could not remove player: ${error.message}`)
        return
      }

      setPlayers(current => current.filter(item => item.id !== player.id))
      setMessageType('success')
      setMessage(`${player.name} removed successfully.`)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessageType('error')
      setMessage(`Sign out failed: ${error.message}`)
      return
    }

    setIsAdmin(false)
    setShowLogin(false)
    setMessage('')
  }

  if (!sessionChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-teal-400" />
          <p className="font-bold tracking-wide">BN PES</p>
          <p className="mt-1 text-sm text-slate-400">Loading your database...</p>
        </div>
      </main>
    )
  }

  if (showLogin && !isAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="mb-6 rounded-xl px-3 py-2 text-sm text-teal-300 transition hover:bg-teal-400/10"
          >
            ← Back to Home
          </button>

          <LoginForm
            onLoginSuccess={() => {
              setIsAdmin(true)
              setShowLogin(false)
              setMessage('')
              void loadPlayers()
            }}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="relative mb-7 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/50 p-5 shadow-2xl shadow-black/20 sm:mb-8 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-400" />
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-teal-300 sm:text-xs">
                  BN PES · eFootball
                </p>
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                H2H <span className="text-teal-400">Database</span>
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400 sm:text-base">
                Every match. Every rivalry. One record.
              </p>
            </div>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm font-semibold text-red-300 transition hover:border-red-400/50 hover:bg-red-400/10 sm:w-auto"
              >
                Sign Out ↗
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="w-full rounded-xl border border-teal-400/30 bg-teal-400/10 px-5 py-3 text-sm font-bold text-teal-300 transition hover:border-teal-300 hover:bg-teal-400/20 sm:w-auto"
              >
                Admin Login →
              </button>
            )}
          </div>

          <div className="relative mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
            <span className="rounded-lg bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <span className="font-bold text-teal-300">{players.length}</span>{' '}
              Registered Players
            </span>
            <span className="rounded-lg bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              Official stats use approved matches
            </span>
          </div>
        </header>

        {/* Admin panel */}
        {isAdmin && (
          <section className="mb-6 rounded-2xl border border-teal-400/20 bg-slate-900/80 p-4 shadow-xl shadow-black/10 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400">
                  Management
                </p>
                <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">
                  Admin Dashboard
                </h2>
                <p className="mt-2 text-sm leading-5 text-slate-400">
                  Register players and manage the database.
                </p>
              </div>

              <span className="shrink-0 rounded-xl border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs font-bold text-teal-300">
                ADMIN
              </span>
            </div>

            <form
              onSubmit={addPlayer}
              className="mt-5 flex flex-col gap-3 sm:flex-row"
            >
              <input
                value={playerName}
                onChange={event => setPlayerName(event.target.value)}
                required
                maxLength={60}
                placeholder="Enter player name..."
                aria-label="Player name"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/10"
              />

              <button
                type="submit"
                disabled={saving}
                className="min-h-12 rounded-xl bg-teal-400 px-6 py-3 font-extrabold text-slate-950 transition hover:bg-teal-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Please wait...' : '+ Add Player'}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">Registered Players</h3>
                <button
                  type="button"
                  onClick={() => void loadPlayers()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-teal-400 hover:text-teal-300"
                >
                  ↻ Refresh
                </button>
              </div>

              {players.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
                  No players yet. Add your first player above.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {players.map(player => (
                    <div
                      key={player.id}
                      className="flex max-w-full items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2 transition hover:border-teal-400/40"
                    >
                      <span className="max-w-[180px] break-words text-sm font-medium text-slate-200">
                        {player.name}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void removePlayer(player)}
                        title={`Remove ${player.name}`}
                        aria-label={`Remove ${player.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base text-red-400 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-40"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Feedback message */}
        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              messageType === 'error'
                ? 'border-red-400/20 bg-red-400/5 text-red-300'
                : 'border-teal-400/20 bg-teal-400/5 text-teal-300'
            }`}
          >
            <p className="min-w-0 break-words">{message}</p>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="shrink-0 rounded-md px-2 text-lg leading-5 opacity-70 transition hover:opacity-100"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {/* Main sections */}
        <div className="grid min-w-0 gap-5 sm:gap-6">
          <H2HSection players={players} />

          <SubmitMatchForm
            players={players}
            onSubmitted={() => {
              setMessageType('success')
              setMessage('Match submitted! It will count after admin approval.')
            }}
          />

          {isAdmin && <MatchManager players={players} />}
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-800/80 py-7 text-center sm:mt-12">
          <p className="text-sm font-extrabold tracking-wide text-slate-300">
            BN PES <span className="text-teal-400">H2H</span> Database
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
            Built for the rivalry. Only approved matches count towards official statistics.
          </p>
        </footer>
      </div>
    </main>
  )
}
