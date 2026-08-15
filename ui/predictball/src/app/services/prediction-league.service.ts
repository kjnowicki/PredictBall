import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PredictionLeague } from '../models/predictball.models';

@Injectable({
  providedIn: 'root'
})
export class PredictionLeagueService {
  private api = inject(ApiService);

  getPredictionLeague(competitionId: string | number, leagueId: string | number, season?: string): Observable<any> {
    const query = season ? `?season=${encodeURIComponent(season)}` : '';
    return this.api.get<any>(`competition/${competitionId}/league/${leagueId}${query}`);
  }

  createPredictionLeague(competitionId: string | number, userId: string | number, name: string, isCasual?: boolean): Observable<PredictionLeague> {
    const league: any = { name: name, isCasual: !!isCasual };
    return this.api.put<PredictionLeague>(`competition/${competitionId}/league?user=${userId}`, league);
  }

  joinGlobalLeague(competitionId: string | number, userId: string | number): Observable<any> {
    return this.api.put<any>(`join/${competitionId}?user=${userId}`, {});
  }

  getCompetitionLeagues(competitionId: string | number, userId: string | number, season?: string): Observable<{ publicLeagues: any[], yourLeagues: any[] }> {
    const params: any = { user: userId };
    if (season) {
      params.season = season;
    }
    return this.api.get<{ publicLeagues: any[], yourLeagues: any[] }>(`competition/${competitionId}/get-leagues`, params);
  }

  joinLeagueByCode(competitionId: string | number, userId: string | number, joinCode: string): Observable<any> {
    return this.api.put<any>(`competition/${competitionId}/join-by-code?user=${userId}`, { joinCode });
  }

  getCasualMatches(competitionId: string | number): Observable<{ casualMatchIds: number[], byMatchday: { [key: string]: number[] } }> {
    return this.api.get<{ casualMatchIds: number[], byMatchday: { [key: string]: number[] } }>(`competition/${competitionId}/casual-matches`);
  }
}