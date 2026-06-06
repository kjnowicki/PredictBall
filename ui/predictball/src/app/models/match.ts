export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'LINEUPS-READY';

export interface Player {
	id: number;
	name: string;
	position: string;
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
	homeTeamId: number;
	awayTeamId: number;
	startTime: string;
	status: MatchStatus;
	matchDetails: MatchDetails;
}