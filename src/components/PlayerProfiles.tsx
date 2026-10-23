
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../types'
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleUserRound,
  Crown,
  Flame,
  Goal,
  Search,
  Shield,
  Swords,
  Trophy,
  X,
} from 'lucide-react'

type Match = {
  id: string
  player1_id: string
  player2_id: string
  player1_goals: number
  player2_goals: number
  status: string
  played_at: string
}

type Stats = {
  played: number
  wins: number
  losses: number
  draws: number
  goalsFor: number
  goalsAgainst: number
}

type HistoryItem = {
  match: Match
  opponent: Player
  scoreFor: number
  scoreAgainst: number
  result: 'W' | 'D' | 'L'
}

const palettes = [
  'from-cyan-500/20 to-blue-600/10 border-cyan-400/20',
  'from-violet-500/20 to-fuchsia-600/10 border-violet-400/20',
  'from-emerald-500/20 to-teal-600/10 border-emerald-400/20',
  'from-orange-500/20 to-rose-600/10 border-orange-400/20',
  'from-pink-500/20 to-purple-600/10 border-pink-400/20',
]

const resultColors = {
  W: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/20',
  D: 'bg-amber-400/15 text-amber-300 border-amber-400/20',
  L: 'bg-rose-400/15 text-rose-300 border-rose-400/20',
}

function emptyStats(): Stats {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PlayerProfiles({ players }: { players: Player[] }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  async function loadMatches() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('matches')
      .select(
        'id, player1_id, player2_id, player1_goals, player2_goals, status, played_at',
      )
      .eq('status', 'approved')
      .order('played_at', { ascending: false })

    if (fetchError) {
      console.error('Could not load player matches:', fetchError.message)
      setError(`Could not load statistics: ${fetchError.message}`)
      setMatches([])
    } else {
      setMatches((data ?? []) as Match[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadMatches()
  }, [])

  const statsByPlayer = useMemo(() => {
    const result = new Map<string, Stats>()
    players.forEach((player) => result.set(player.id, emptyStats()))

    matches.forEach((match) => {
      const first = result.get(match.player1_id)
      const second = result.get(match.player2_id)
      if (!first || !second) return

      const firstGoals = Number(match.player1_goals) || 0
      const secondGoals = Number(match.player2_goals) || 0

      first.played++
      second.played++
      first.goalsFor += firstGoals
      first.goalsAgainst += secondGoals
      second.goalsFor += secondGoals
      second.goalsAgainst += firstGoals

      if (firstGoals > secondGoals) {
        first.wins++
        second.losses++
      } else if (firstGoals < secondGoals) {
        first.losses++
        second.wins++
      } else {
        first.draws++
        second.draws++
      }
    })

    return result
  }, [players, matches])

  const filteredPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => {
        const aStats = statsByPlayer.get(a.id) ?? emptyStats()
        const bStats = statsByPlayer.get(b.id) ?? emptyStats()
        return bStats.wins - aStats.wins || a.name.localeCompare(b.name)
      })
      .filter((player) =>
        player.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
  }, [players, search, statsByPlayer])

  const selectedStats = selectedPlayer
    ? statsByPlayer.get(selectedPlayer.id) ?? emptyStats()
    : emptyStats()

  const history: HistoryItem[] = selectedPlayer
    ? matches
        .filter(
          (match) =>
            match.player1_id === selectedPlayer.id ||
            match.player2_id === selectedPlayer.id,
        )
        .map((match) => {
          const isFirst = match.player1_id === selectedPlayer.id
          const scoreFor = Number(
            isFirst ? match.player1_goals : match.player2_goals,
          ) || 0
          const scoreAgainst = Number(
            isFirst ? match.player2_goals : match.player1_goals,
          ) || 0
          const opponentId = isFirst ? match.player2_id : match.player1_id
          const opponent = players.find((player) => player.id === opponentId)

          return {
            match,
            opponent: opponent ?? ({
              id: opponentId,
              name: 'Unknown player',
            } as Player),
            scoreFor,
            scoreAgainst,
            result: scoreFor > scoreAgainst
              ? 'W'
              : scoreFor < scoreAgainst
                ? 'L'
                : 'D',
          }
        })
    : []

  const totalWins = [...statsByPlayer.values()].reduce(
    (sum, stats) => sum + stats.wins,
    0,
  )
  const totalMatches = [...statsByPlayer.values()].reduce(
    (sum, stats) => sum + stats.played,
    0,
  ) / 2

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-[#101b20] to-cyan-500/10 p-5 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              <CircleUserRound size={14} /> Player directory
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Players <span className="text-emerald-300">Hub</span>
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
              Explore every rival, check career stats and relive approved matches.
            </p>
          </div>
          <button
            onClick={() => void loadMatches()}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 sm:self-auto"
          >
            <ChartNoAxesColumnIncreasing size={16} /> Refresh stats
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          <SummaryStat label="Players" value={players.length} color="text-cyan-300" />
          <SummaryStat label="Matches" value={totalMatches} color="text-amber-300" />
          <SummaryStat label="Total wins" value={totalWins} color="text-emerald-300" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a player..."
            className="w-full rounded-2xl border border-white/10 bg-[#10171d] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50"
          />
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#10171d] px-4 py-3 text-sm text-slate-400">
          <Shield size={16} className="text-emerald-300" />
          Approved matches only
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-slate-400">
          Loading player records...
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <CircleUserRound className="mx-auto mb-3 text-slate-600" size={32} />
          <p className="font-bold text-white">No players found</p>
          <p className="mt-1 text-sm text-slate-500">Try a different search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPlayers.map((player, index) => {
            const stats = statsByPlayer.get(player.id) ?? emptyStats()
            const winRate = stats.played
              ? Math.round((stats.wins / stats.played) * 100)
              : 0

            return (
              <button
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-black/20 ${palettes[index % palettes.length]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1117]/80 text-lg font-black text-white shadow-lg">
                      {initials(player.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold text-white">{player.name}</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {stats.played} matches played
                      </p>
                    </div>
                  </div>
                  {index === 0 && stats.wins > 0 && (
                    <span className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200">
                      <Crown size={17} />
                    </span>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <MiniStat label="Wins" value={stats.wins} color="text-emerald-300" />
                  <MiniStat label="Draws" value={stats.draws} color="text-amber-300" />
                  <MiniStat label="Losses" value={stats.losses} color="text-rose-300" />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Win rate</span>
                    <span className="font-bold text-white">{winRate}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                    <div className="h-full rounded-full bg-emerald-300" style={{ width: `${winRate}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Goal size={14} className="text-cyan-300" />
                    {stats.goalsFor} goals scored
                  </span>
                  <span className="font-bold transition group-hover:text-white">View profile ↗</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedPlayer && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedPlayer(null)
          }}
        >
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0c1319] shadow-2xl sm:rounded-3xl">
            <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-emerald-500/15 via-[#101a20] to-violet-500/10 p-5 sm:p-7">
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-xl font-black text-emerald-200">
                    {initials(selectedPlayer.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Player profile</p>
                    <h3 className="mt-1 break-words text-2xl font-black text-white">{selectedPlayer.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">Career record · Approved matches</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  aria-label="Close profile"
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 sm:p-6">
              <ProfileStat label="Played" value={selectedStats.played} color="text-cyan-300" />
              <ProfileStat label="Wins" value={selectedStats.wins} color="text-emerald-300" />
              <ProfileStat label="Draws" value={selectedStats.draws} color="text-amber-300" />
              <ProfileStat label="Losses" value={selectedStats.losses} color="text-rose-300" />
              <ProfileStat label="Goals for" value={selectedStats.goalsFor} color="text-violet-300" />
              <ProfileStat label="Goals against" value={selectedStats.goalsAgainst} color="text-orange-300" />
              <ProfileStat label="Goal difference" value={selectedStats.goalsFor - selectedStats.goalsAgainst} color="text-pink-300" />
              <ProfileStat
                label="Win rate"
                value={`${selectedStats.played ? Math.round((selectedStats.wins / selectedStats.played) * 100) : 0}%`}
                color="text-teal-300"
              />
            </div>

            <div className="px-5 pb-6 sm:px-6">
              <div className="mb-4 flex items-center gap-2">
                <Flame className="text-orange-300" size={19} />
                <h4 className="text-lg font-extrabold text-white">Match history</h4>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">{history.length}</span>
              </div>

              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                  <Swords className="mx-auto mb-2 text-slate-600" size={26} />
                  <p className="font-semibold text-slate-300">No approved matches yet</p>
                  <p className="mt-1 text-sm text-slate-500">This player's match history will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(({ match, opponent, scoreFor, scoreAgainst, result }) => (
                    <div key={match.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${resultColors[result]}`}>
                        {result}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">vs {opponent.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays size={12} /> {formatDate(match.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black tabular-nums text-white">{scoreFor} - {scoreAgainst}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Final score</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedPlayer(null)}
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
              >
                Back to players
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <div className={`mb-2 ${color}`}><ChartNoAxesColumnIncreasing size={17} /></div>
      <p className="text-xl font-black tabular-nums text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">{label}</p>
    </div>
  )
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-2 py-3 text-center">
      <p className={`text-lg font-black ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  )
}

function ProfileStat({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4">
      <p className={`text-xl font-black tabular-nums sm:text-2xl ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}
