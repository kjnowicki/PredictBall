import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PredictionLeague } from '../models';

@Injectable({
  providedIn: 'root'
})
export class PredictionLeagueService {
  private api = inject(ApiService);

  getPredictionLeague(leagueId: string): Observable<PredictionLeague> {
    return this.api.get<PredictionLeague>(`prediction-league/${leagueId}`);
  }

  createPredictionLeague(league: PredictionLeague): Observable<PredictionLeague> {
    return this.api.put<PredictionLeague>('prediction-league', league);
  }
}