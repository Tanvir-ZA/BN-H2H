
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Match, Player } from '../types'

type Props = {
  players: Player[]
}

export default function PendingMatches({ players }: Props) {
  const [matches, setMatches] = useState<Match[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadPending() {
    setLoading(true)

    const { data, error } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, player1_goals, player2_goals, played_at, status')
      .eq('status', 'pending')
      .order('played_at', { ascending: false })

    if (error) setMessage(`Could not load pending matches: ${error.message}`)
    else {
      setMatches((data as Match[]) ?? [])
      setMessage('')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPending()
  }, [])

  async function reviewMatch(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', id)
      .eq('status', 'pending')

    if (error) setMessage(`Could not update match: ${error.message}`)
    else {
      setMessage(status === 'approved' ? 'Match approved.' : 'Match rejected.')
      await loadPending()
    }
  }

  function name(id: string) {
    return players.find(p => p.id === id)?.name ?? 'Unknown player'
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Pending Matches</h2>
        <button onClick={loadPending} className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-teal-400">
          Refresh
        </button>
      </div>

      {message && <p role="status" className="mt-3 text-sm text-teal-300">{message}</p>}
      {loading ? <p className="mt-4 text-slate-400">Loading...</p> :
        matches.length === 0 ? <p className="mt-4 text-slate-400">No pending matches. All caught up!</p> :
        <ul className="mt-4 divide-y divide-slate-800">
          {matches.map(match => (
            <li key={match.id} className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium">{name(match.player1_id)} <span className="text-slate-500">vs</span> {name(match.player2_id)}</p>
                <p className="mt-1 text-xl font-bold text-teal-300">{match.player1_goals} - {match.player2_goals}</p>
                <p className="text-xs text-slate-500">{new Date(match.played_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => reviewMatch(match.id, 'approved')} className="rounded-lg bg-teal-400 px-4 py-2 font-semibold text-slate-950 hover:bg-teal-300">
                  Approve
                </button>
                <button onClick={() => reviewMatch(match.id, 'rejected')} className="rounded-lg border border-red-500/50 px-4 py-2 text-red-300 hover:bg-red-500/10">
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      }
    </section>
  )
}
