export interface Player {
  id: number;
  name: string;
}

export interface MatchDetails {
  homeScore: number;
  awayScore: number;
  scorers: Player[];
}

export interface Prediction {
  id?: number;
  // TODO: Add other prediction fields matching backend
  [key: string]: unknown;
}

export interface PredictionLeague {
  id?: number;
  // TODO: Add other league fields matching backend
  [key: string]: unknown;
}

export interface ScoringSystem {
  scoreDif: number;
  scoreExact: number;
  scoreHomeExact: number;
  scoreAwayExact: number;
  scorer: number;
}

export interface User {
  id?: number;
  // TODO: Add other user fields matching backend
  [key: string]: unknown;
}

export interface Match {
  id: number;
  [key: string]: unknown;
}

export interface Team {
  id: number;
  [key: string]: unknown;
}

export interface MatchesResponse {
  filters: unknown;
  resultSet: unknown;
  competition: unknown;
  matches: Match[];
}