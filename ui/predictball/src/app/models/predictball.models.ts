export interface User {
  id: string;
  displayName: string;
  email: string;
  leagueViewPreferences?: { [leagueId: string]: boolean };
}

export interface Competition {
  id: string;
  name: string;
  logoUrl?: string;
  points?: number;
}

export interface League {
  id: string;
  name: string;
  competitionId: string;
  competitionName?: string;
  rank: number;
  joinCode?: string;
}

export interface PredictionLeague {
  id: string | number;
  name: string;
  joinCode?: string;
  public?: boolean;
  userIds?: number[];
  isCasual?: boolean;
}

export interface LeagueUser {
  userId: number;
  name: string;
  points: number;
}

export interface GlobalLeague extends PredictionLeague {
  users: LeagueUser[];
}

export interface Match {
  id: string;
  matchday?: number;
  competitionId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  status: 'scheduled' | 'in_progress' | 'finished';
  matchDetails?: { homeScore: number, awayScore: number, scorers: any[], substitutions?: any[] };
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