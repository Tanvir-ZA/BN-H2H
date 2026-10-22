
import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../types'

type Props = {
  players: Player[]
  onSubmitted: () => void
}

export default function SubmitMatchForm({ players, onSubmitted }: Props) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [g1, setG1] = useState('0')
  const [g2, setG2] = useState('0')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    if (!p1 || !p2 || p1 === p2) {
      setMessage('Please select two different players.')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('matches').insert({
      player1_id: p1,
      player2_id: p2,
      player1_goals: Number(g1),
      player2_goals: Number(g2),
      status: 'pending',
    })

    if (error) {
      setMessage(`Submission failed: ${error.message}`)
    } else {
      setP1('')
      setP2('')
      setG1('0')
      setG2('0')
      setMessage('Match submitted! It will count after admin approval.')
      onSubmitted()
    }

    setLoading(false)
  }

  const selectClass =
    'w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-teal-400'

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-bold">Submit Match</h2>
      <p className="mt-1 text-sm text-slate-400">
        Submit your result for admin approval.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            Player 1
            <select className={selectClass} value={p1} onChange={e => setP1(e.target.value)} required>
              <option value="">Select player</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-300">
            Player 2
            <select className={selectClass} value={p2} onChange={e => setP2(e.target.value)} required>
              <option value="">Select player</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <label className="text-sm text-slate-300">
            Player 1 goals
            <input type="number" min="0" max="99" required value={g1}
              onChange={e => setG1(e.target.value)}
              className={`${selectClass} mt-2`} />
          </label>

          <span className="pt-6 font-bold text-slate-500">VS</span>

          <label className="text-sm text-slate-300">
            Player 2 goals
            <input type="number" min="0" max="99" required value={g2}
              onChange={e => setG2(e.target.value)}
              className={`${selectClass} mt-2`} />
          </label>
        </div>

        <button disabled={loading || players.length < 2}
          className="w-full rounded-xl bg-teal-400 px-4 py-3 font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-50">
          {loading ? 'Submitting...' : 'Submit Result'}
        </button>

        {message && <p role="status" className="text-sm text-teal-300">{message}</p>}
      </form>
    </section>
  )
}
