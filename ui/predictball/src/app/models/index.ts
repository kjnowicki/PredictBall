export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'LINEUPS-READY';

export interface Player {
  id: number;
  name: string;
  position: string;
  nationality?: string;
}

export interface TeamSquad {
  teamId: number;
  players: Player[];
}

export interface MatchDetails {
  homeScore: number;
  homeLineup: TeamSquad;
  awayScore: number;
  awayLineup: TeamSquad;
  scorers: Player[];
}

export interface Match {
  id: number;
  matchday: number;
  homeTeamId: number;
  awayTeamId: number;
  startTime: string;
  status: MatchStatus;
  matchDetails: MatchDetails;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  displayName: string;
  nameLastChanged: string;
}

export interface PredictionLeague {
  id: number;
  name: string;
  joinCode: string;
  public: boolean;
  userIds?: number[];
}

export interface Prediction {
  id: number;
  userId: number;
  matchId: number;
  homeScore: number;
  awayScore: number;
  scorerId: number;
}

export interface ScoringSystem {
  scoreDif: number;
  scoreExact: number;
  scoreHomeExact: number;
  scoreAwayExact: number;
  scorer: number;
}

export interface Team {
  id: number;
  [key: string]: unknown;
}

export interface UserCompetitionLeagues {
  competitionId: number;
  leagueIds: number[];
}

export interface UserLeagues {
  userId: number;
  competitions: UserCompetitionLeagues[];
}