export interface User {
  id: string;
  displayName: string;
  email: string;
}

export interface Competition {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface League {
  id: string;
  name: string;
  competitionId: string;
  competitionName?: string;
  rank: number;
  joinCode?: string;
}

export interface Match {
  id: string;
  competitionId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  status: 'scheduled' | 'in_progress' | 'finished';
}

export interface Task {
  id: string;
  match: Match;
  timeRemainingMs: number;
}

export interface PredictionPayload {
  homeGoals: number;
  awayGoals: number;
  scorerName: string;
  modifier: 'triple' | 'reversal' | 'addScorer' | 'none';
}