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

export interface Substitution {
	minute: number;
	teamId: number;
	teamName: string;
	playerOut: Player;
	playerIn: Player;
}

export interface MatchDetails {
	homeScore: number;
	homeLineup: TeamSquad;
	homeBench?: TeamSquad;
	awayScore: number;
	awayLineup: TeamSquad;
	awayBench?: TeamSquad;
	scorers: Player[];
	substitutions?: Substitution[];
}

export interface Match {
	id: number;
	homeTeamId: number;
	awayTeamId: number;
	startTime: string;
	status: MatchStatus;
	matchDetails: MatchDetails;
}