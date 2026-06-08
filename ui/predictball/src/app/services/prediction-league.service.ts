import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PredictionLeague } from '../models';

@Injectable({
  providedIn: 'root'
})
export class PredictionLeagueService {
  private api = inject(ApiService);

  getPredictionLeague(competitionId: string | number, leagueId: string | number): Observable<any> {
    return this.api.get<any>(`competition/${competitionId}/league/${leagueId}`);
  }

  createPredictionLeague(competitionId: string | number, league: PredictionLeague): Observable<PredictionLeague> {
    return this.api.put<PredictionLeague>(`competition/${competitionId}/league`, league);
  }

  joinGlobalLeague(competitionId: string | number, userId: string | number): Observable<any> {
    return this.api.put<any>(`join/${competitionId}?user=${userId}`, {});
  }
}