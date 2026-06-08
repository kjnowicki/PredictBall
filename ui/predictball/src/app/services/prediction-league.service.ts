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
    return this.api.get<PredictionLeague>(`prediction-leagues/${leagueId}`);
  }

  createPredictionLeague(league: PredictionLeague): Observable<PredictionLeague> {
    return this.api.post<PredictionLeague>('prediction-leagues', league);
  }
}