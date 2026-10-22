import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Match, Player } from '../types'

type Props = {
  players: Player[]
}

export default function H2HSection({ players }: Props) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [hasCompared, setHasCompared] = useState(false)

  useEffect(() => {
    if (!hasCompared || !p1 || !p2 || p1 === p2) {
      setMatches([])
      setLoading(false)
      setErrorMessage('')
      return
    }

    let active = true

    async function loadMatches() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('matches')
        .select(
          'id, player1_id, player2_id, player1_goals, player2_goals, played_at, status',
        )
        .eq('status', 'approved')
        .or(
          `and(player1_id.eq.${p1},player2_id.eq.${p2}),and(player1_id.eq.${p2},player2_id.eq.${p1})`,
        )
        .order('played_at', { ascending: false })

      if (!active) return

      if (error) {
        setMatches([])
        setErrorMessage('Could not load match history. Please try again.')
      } else {
        setMatches((data ?? []) as Match[])
      }

      setLoading(false)
    }

    void loadMatches()

    return () => {
      active = false
    }
  }, [p1, p2, hasCompared])

  const first = players.find(player => player.id === p1)
  const second = players.find(player => player.id === p2)

  const stats = matches.reduce(
    (result, match) => {
      const firstGoals =
        match.player1_id === p1
          ? match.player1_goals
          : match.player2_goals

      const secondGoals =
        match.player1_id === p1
          ? match.player2_goals
          : match.player1_goals

      result.goals1 += firstGoals
      result.goals2 += secondGoals

      if (firstGoals > secondGoals) result.wins1++
      else if (firstGoals < secondGoals) result.wins2++
      else result.draws++

      return result
    },
    { wins1: 0, wins2: 0, draws: 0, goals1: 0, goals2: 0 },
  )

  const selectClass =
    'mt-2.5 min-h-12 w-full min-w-0 rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-3 text-base text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/10'

  function handleCompare() {
    if (!p1 || !p2 || p1 === p2) return

    setHasCompared(true)
  }

  return (
    <section className="relative min-w-0 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b1118] p-4 shadow-xl shadow-black/10 sm:p-6 lg:p-7">
      <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-teal-400/[0.06] blur-3xl" />

      <header className="relative">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/[0.06] px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-teal-300" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">
            Rivalry Center
          </span>
        </div>

        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Head-to-<span className="text-teal-300">Head</span>
        </h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
          Pick two players and compare their official match records.
        </p>
      </header>

      <div className="relative mt-6 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-4">
        <label className="block min-w-0 text-sm font-semibold text-slate-300">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-400/10 text-xs font-black text-teal-300">
              1
            </span>
            First Player
          </span>

          <select
            className={selectClass}
            value={p1}
            onChange={event => {
              setP1(event.target.value)
              setHasCompared(false)
            }}
          >
            <option value="">Choose player</option>
            {players.map(player => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-center sm:pb-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-black tracking-widest text-slate-400">
            VS
          </span>
        </div>

        <label className="block min-w-0 text-sm font-semibold text-slate-300">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-xs font-black text-sky-300">
              2
            </span>
            Second Player
          </span>

          <select
            className={selectClass}
            value={p2}
            onChange={event => {
              setP2(event.target.value)
              setHasCompared(false)
            }}
          >
            <option value="">Choose player</option>
            {players.map(player => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="relative mt-5 flex justify-center">
        <button
          type="button"
          onClick={handleCompare}
          disabled={!p1 || !p2 || p1 === p2 || loading}
          className="w-full rounded-xl bg-teal-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {loading ? 'Loading Records...' : 'Compare H2H'}
        </button>
      </div>

      {players.length < 2 && (
        <div className="relative mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm text-amber-200">
          At least two registered players are needed for an H2H comparison.
        </div>
      )}

      {p1 && p2 && p1 === p2 && (
        <div className="relative mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3.5 text-sm text-amber-200">
          Choose two different players to compare their records.
        </div>
      )}

      {hasCompared && first && second && p1 !== p2 && (
        <div className="relative mt-6 space-y-5">
          {/* Player matchup banner */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-slate-900 to-slate-950 p-4 sm:p-6">
            <div className="min-w-0 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-teal-400/25 bg-teal-400/10 text-sm font-black text-teal-300 sm:size-16 sm:text-xl">
                {first.name.slice(0, 2).toUpperCase()}
              </div>
              <p className="mt-3 break-words text-sm font-bold text-white sm:text-base">
                {first.name}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Player 1
              </p>
            </div>

            <div className="px-1 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                Official
              </p>
              <p className="mt-1 text-xs font-black tracking-widest text-teal-300 sm:text-sm">
                H2H
              </p>
            </div>

            <div className="min-w-0 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-400/10 text-sm font-black text-sky-300 sm:size-16 sm:text-xl">
                {second.name.slice(0, 2).toUpperCase()}
              </div>
              <p className="mt-3 break-words text-sm font-bold text-white sm:text-base">
                {second.name}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Player 2
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-12 text-center">
              <div className="mx-auto mb-4 size-7 animate-spin rounded-full border-2 border-slate-700 border-t-teal-300" />
              <p className="text-sm text-slate-400">
                Loading official match records...
              </p>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-4 text-sm text-rose-300"
            >
              {errorMessage}
            </div>
          ) : (
            <>
              {/* Win / draw statistics */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">
                    Match Statistics
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Approved only
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="min-w-0 rounded-2xl border border-teal-400/15 bg-teal-400/[0.045] p-3 text-center sm:p-4">
                    <p className="break-words text-[10px] font-bold uppercase tracking-wide text-teal-300/80 sm:text-xs">
                      {first.name} Wins
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-teal-300 sm:text-4xl">
                      {stats.wins1}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-center sm:p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
                      Draws
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-white sm:text-4xl">
                      {stats.draws}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-sky-400/15 bg-sky-400/[0.045] p-3 text-center sm:p-4">
                    <p className="break-words text-[10px] font-bold uppercase tracking-wide text-sky-300/80 sm:text-xs">
                      {second.name} Wins
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-sky-300 sm:text-4xl">
                      {stats.wins2}
                    </p>
                  </div>
                </div>
              </div>

              {/* Goal comparison */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Total Matches
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">
                      {matches.length}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-400">
                      Total Goals
                    </p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-teal-300">
                      {stats.goals1 + stats.goals2}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words text-xs font-semibold text-teal-300">
                    {first.name}
                  </span>
                  <p className="shrink-0 text-lg font-black tabular-nums text-white sm:text-xl">
                    {stats.goals1} <span className="text-slate-600">–</span>{' '}
                    {stats.goals2}
                  </p>
                  <span className="min-w-0 break-words text-right text-xs font-semibold text-sky-300">
                    {second.name}
                  </span>
                </div>

                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="rounded-full bg-teal-400 transition-all duration-500"
                    style={{
                      width:
                        stats.goals1 + stats.goals2 === 0
                          ? '50%'
                          : `${(stats.goals1 / (stats.goals1 + stats.goals2)) * 100}%`,
                    }}
                  />
                  <div
                    className="rounded-full bg-sky-400 transition-all duration-500"
                    style={{
                      width:
                        stats.goals1 + stats.goals2 === 0
                          ? '50%'
                          : `${(stats.goals2 / (stats.goals1 + stats.goals2)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Match history */}
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-white">Match History</h3>
                  <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400">
                    {matches.length} {matches.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>

                {matches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-10 text-center">
                    <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xl">
                      ⚽
                    </div>
                    <p className="text-sm font-semibold text-slate-300">
                      No matches yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Approved matches between these players will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015]">
                    {matches.map(match => {
                      const normalOrder = match.player1_id === p1
                      const score1 = normalOrder
                        ? match.player1_goals
                        : match.player2_goals
                      const score2 = normalOrder
                        ? match.player2_goals
                        : match.player1_goals

                      const firstWon = score1 > score2
                      const secondWon = score2 > score1
                      const date = new Date(match.played_at)

                      return (
                        <li
                          key={match.id}
                          className="flex items-center justify-between gap-3 px-3 py-4 transition hover:bg-white/[0.025] sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-semibold text-slate-200">
                              {first.name}
                              <span className="mx-1.5 text-slate-600">vs</span>
                              {second.name}
                            </p>
                            <p className="mt-1.5 text-xs text-slate-500">
                              {Number.isNaN(date.getTime())
                                ? 'Unknown date'
                                : date.toLocaleDateString(undefined, {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="rounded-xl border border-white/[0.07] bg-slate-950 px-3 py-2 text-lg font-black tabular-nums sm:px-4 sm:text-xl">
                              <span
                                className={
                                  firstWon ? 'text-teal-300' : 'text-white'
                                }
                              >
                                {score1}
                              </span>
                              <span className="mx-1.5 text-slate-600">–</span>
                              <span
                                className={
                                  secondWon ? 'text-sky-300' : 'text-white'
                                }
                              >
                                {score2}
                              </span>
                            </p>
                            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                              {firstWon
                                ? `${first.name} won`
                                : secondWon
                                  ? `${second.name} won`
                                  : 'Draw'}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {(!hasCompared || !p1 || !p2) && (
        <div className="relative mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center sm:py-10">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-teal-400/15 bg-teal-400/[0.05] text-xl">
            ⚔️
          </div>
          <p className="font-semibold text-slate-300">
            Choose your rivalry
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-slate-500">
            Select two different players above, then click Compare H2H to reveal their record.
          </p>
        </div>
      )}
    </section>
  )
}