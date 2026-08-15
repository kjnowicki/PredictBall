export interface Season {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner: any | null;
    isRetired?: boolean;
    isFinished?: boolean;
}

export interface Competition {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
    currentSeason?: Season;
    seasons?: Season[];
}