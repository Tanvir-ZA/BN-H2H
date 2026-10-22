
export type Player = {
  id: string
  name: string
  created_at: string
}

export type Match = {
  id: string
  player1_id: string
  player2_id: string
  player1_goals: number
  player2_goals: number
  played_at: string
  status: 'pending' | 'approved' | 'rejected'
}
