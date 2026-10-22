
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Match, Player } from '../types'

type Props = {
  players: Player[]
}

type ManagedMatch = Match & {
  status: 'pending' | 'approved' | 'rejected'
}

export default function MatchManager({ players }: Props) {
  const [matches, setMatches] = useState<ManagedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all')

  const playerName = (id: string) =>
    players.find(player => player.id === id)?.name ?? 'Unknown Player'

  const loadMatches = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('matches')
      .select(
        'id, player1_id, player2_id, player1_goals, player2_goals, played_at, status',
      )
      .order('played_at', { ascending: false })

    if (error) {
      setMessage(`Could not load matches: ${error.message}`)
    } else {
      setMatches((data ?? []) as ManagedMatch[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadMatches()
  }, [loadMatches])

  async function updateStatus(
    id: string,
    status: 'approved' | 'rejected',
  ) {
    setBusyId(id)
    setMessage('')

    const { error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', id)

    if (error) {
      setMessage(`Update failed: ${error.message}`)
    } else {
      setMessage(
        status === 'approved'
          ? 'Match approved successfully.'
          : 'Match rejected successfully.',
      )
      await loadMatches()
    }

    setBusyId(null)
  }

  async function editMatch(match: ManagedMatch) {
    const first = window.prompt(
      `${playerName(match.player1_id)} — goals`,
      String(match.player1_goals),
    )
    if (first === null) return

    const second = window.prompt(
      `${playerName(match.player2_id)} — goals`,
      String(match.player2_goals),
    )
    if (second === null) return

    const goals1 = Number(first)
    const goals2 = Number(second)

    if (
      first.trim() === '' ||
      second.trim() === '' ||
      !Number.isInteger(goals1) ||
      !Number.isInteger(goals2) ||
      goals1 < 0 ||
      goals2 < 0 ||
      goals1 > 99 ||
      goals2 > 99
    ) {
      setMessage('Enter whole-number scores between 0 and 99.')
      return
    }

    setBusyId(match.id)
    setMessage('')

    const { error } = await supabase
      .from('matches')
      .update({
        player1_goals: goals1,
        player2_goals: goals2,
      })
      .eq('id', match.id)

    if (error) {
      setMessage(`Edit failed: ${error.message}`)
    } else {
      setMessage('Score updated successfully.')
      await loadMatches()
    }

    setBusyId(null)
  }

  async function deleteMatch(id: string) {
    if (!window.confirm('Permanently delete this match?')) return

    setBusyId(id)
    setMessage('')

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(`Delete failed: ${error.message}`)
    } else {
      setMessage('Match deleted successfully.')
      await loadMatches()
    }

    setBusyId(null)
  }

  const pending = matches.filter(m => m.status === 'pending')
  const approved = matches.filter(m => m.status === 'approved')
  const rejected = matches.filter(m => m.status === 'rejected')

  const filteredMatches =
    filter === 'all'
      ? matches
      : matches.filter(match => match.status === filter)

  const statusStyle = {
    pending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    approved: 'border-teal-400/20 bg-teal-400/10 text-teal-300',
    rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  }

  const actionButton =
    'inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40'

  function renderMatch(match: ManagedMatch) {
    const busy = busyId === match.id
    const firstWon = match.player1_goals > match.player2_goals
    const secondWon = match.player2_goals > match.player1_goals
    const date = new Date(match.played_at)

    return (
      <article
        key={match.id}
        className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101923] transition duration-300 hover:-translate-y-0.5 hover:border-teal-400/30 hover:shadow-[0_12px_40px_rgba(20,184,166,0.06)]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusStyle[match.status]}`}
          >
            <span className="mr-1.5">●</span>
            {match.status}
          </span>

          <span className="text-[11px] text-slate-500">
            {Number.isNaN(date.getTime())
              ? 'Unknown date'
              : date.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-6 sm:gap-5 sm:px-6 sm:py-7">
          <div className="min-w-0 text-center">
            <div
              className={`mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border text-sm font-black sm:size-14 sm:text-lg ${
                firstWon
                  ? 'border-teal-400/30 bg-teal-400/10 text-teal-300'
                  : 'border-white/[0.08] bg-white/[0.04] text-slate-300'
              }`}
            >
              {playerName(match.player1_id).slice(0, 2).toUpperCase()}
            </div>
            <p className="break-words text-sm font-bold text-white sm:text-base">
              {playerName(match.player1_id)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Home
            </p>
          </div>

          <div className="min-w-0 text-center">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">
              Full time
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className={`text-3xl font-black tabular-nums tracking-tight sm:text-5xl ${
                  firstWon ? 'text-teal-300' : 'text-white'
                }`}
              >
                {match.player1_goals}
              </span>
              <span className="text-xl font-light text-slate-600 sm:text-3xl">
                :
              </span>
              <span
                className={`text-3xl font-black tabular-nums tracking-tight sm:text-5xl ${
                  secondWon ? 'text-teal-300' : 'text-white'
                }`}
              >
                {match.player2_goals}
              </span>
            </div>
            <p className="mt-2 text-[10px] font-medium text-slate-600">
              {match.player1_goals === match.player2_goals
                ? 'DRAW'
                : firstWon
                  ? 'HOME WIN'
                  : 'AWAY WIN'}
            </p>
          </div>

          <div className="min-w-0 text-center">
            <div
              className={`mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border text-sm font-black sm:size-14 sm:text-lg ${
                secondWon
                  ? 'border-teal-400/30 bg-teal-400/10 text-teal-300'
                  : 'border-white/[0.08] bg-white/[0.04] text-slate-300'
              }`}
            >
              {playerName(match.player2_id).slice(0, 2).toUpperCase()}
            </div>
            <p className="break-words text-sm font-bold text-white sm:text-base">
              {playerName(match.player2_id)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Away
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-black/10 px-4 py-3 sm:px-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Match ID · {match.id.slice(0, 8)}
          </span>

          <div className="flex flex-wrap gap-2">
            {match.status === 'pending' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateStatus(match.id, 'approved')}
                  className="rounded-xl bg-teal-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-teal-300 disabled:opacity-40"
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateStatus(match.id, 'rejected')}
                  className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40"
                >
                  ✕ Reject
                </button>
              </>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void editMatch(match)}
              className={actionButton}
            >
              ✎ Edit
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteMatch(match.id)}
              className="rounded-xl border border-rose-400/10 bg-rose-400/[0.04] px-3 py-2 text-xs font-semibold text-rose-300 transition hover:border-rose-400/30 hover:bg-rose-400/10 disabled:opacity-40"
            >
              ♲ Delete
            </button>
          </div>
        </div>

        {busy && (
          <div className="border-t border-teal-400/10 bg-teal-400/[0.04] px-5 py-2 text-xs text-teal-300">
            Updating match...
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="relative space-y-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b1118] p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-teal-400/[0.06] blur-3xl" />

      <header className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/[0.06] px-3 py-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-teal-300" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">
              Control Center
            </span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Match <span className="text-teal-300">Operations</span>
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Review submissions, verify results and manage your match history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadMatches()}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-teal-400/30 hover:text-teal-300 disabled:opacity-40"
        >
          ↻ Refresh
        </button>
      </header>

      {message && (
        <div
          role="status"
          className="relative flex items-start justify-between gap-3 rounded-xl border border-teal-400/15 bg-teal-400/[0.05] px-4 py-3 text-sm text-teal-200"
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Dismiss message"
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Total Matches
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums text-white">
            {matches.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">All records</p>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/70">
            Pending
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums text-amber-300">
            {pending.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Needs review</p>
        </div>

        <div className="rounded-2xl border border-teal-400/15 bg-teal-400/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300/70">
            Approved
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums text-teal-300">
            {approved.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Official results</p>
        </div>

        <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300/70">
            Rejected
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums text-rose-300">
            {rejected.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Not counted</p>
        </div>
      </div>

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Match Records</h3>
            <p className="mt-1 text-xs text-slate-500">
              Filter and manage every submitted result.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {filteredMatches.length} records
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All Matches'],
              ['pending', 'Pending'],
              ['approved', 'Approved'],
              ['rejected', 'Rejected'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                filter === value
                  ? 'border-teal-400/30 bg-teal-400/10 text-teal-300'
                  : 'border-white/[0.08] bg-white/[0.02] text-slate-500 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              {label}
              <span className="ml-2 opacity-60">
                {value === 'all'
                  ? matches.length
                  : value === 'pending'
                    ? pending.length
                    : value === 'approved'
                      ? approved.length
                      : rejected.length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-14 text-center">
            <div className="mx-auto mb-4 size-7 animate-spin rounded-full border-2 border-slate-700 border-t-teal-300" />
            <p className="text-sm text-slate-400">Loading match records...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-14 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xl text-slate-500">
              ⚽
            </div>
            <p className="font-semibold text-slate-300">No matches here</p>
            <p className="mt-2 text-sm text-slate-500">
              There are no records in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredMatches.map(renderMatch)}
          </div>
        )}
      </div>

      <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600">
        <span>BN PES · Admin Console</span>
        <span>Only approved results count in H2H</span>
      </footer>
    </section>
  )
}

